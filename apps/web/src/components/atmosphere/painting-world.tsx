// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth } from '@/lib/atmosphere/depth';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { db } from '@/lib/storage/db';
import { startRafLoop } from '@/lib/raf-loop';

interface PaintingWorldProps {
  /** Painting image URL to enter. */
  src: string;
  /** Atmosphere id — drives wildlife + water + sky tint. */
  kind?: string;
  onClose: () => void;
}

/**
 * PaintingWorld — "go inside" the painting as a walkable 3D landscape.
 *
 * The depth map becomes terrain; a first-person camera walks it with
 * WASD + drag-look. On top of the base relief:
 *   - readable file pages anchored in the terrain (walk up to read)
 *   - footprint / ripple trail left as you move (per-atmosphere)
 *   - gradient sky dome tinted by time-of-day
 *   - fly mode (F to toggle; Space up / Shift down)
 *   - shimmering water plane for the Wave atmosphere
 *   - wind-driven camera sway
 *   - ambient wildlife (birds / fish / fireflies) by atmosphere
 *
 * Pure Three.js (already a dep). Fullscreen overlay; Esc exits.
 */
export function PaintingWorld({ src, kind = 'none', onClose }: PaintingWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const files = useWorkspaceStore((s) => s.files);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nearFile, setNearFile] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  const nearFileRef = useRef<string | null>(null);
  nearFileRef.current = nearFile;
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const depthResult = await ensureDepth(src);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const THREE = await import('three');
      if (cancelled) return;

      // Pre-load each file's first paragraph for the readable pages.
      const excerpts = new Map<string, string>();
      await Promise.all(filesRef.current.slice(0, 24).map(async (f) => {
        try {
          const dbFile = await db.files.get(f.id);
          const body = (dbFile?.content ?? '')
            .replace(/^---[\s\S]*?---\n+/, '')
            .replace(/^#.*$/m, '')
            .trim()
            .slice(0, 320);
          excerpts.set(f.id, body);
        } catch { /* leave blank */ }
      }));
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();

      // ── Sky dome + fog, tinted by time-of-day ─────────────────────
      const phase = document.documentElement.getAttribute('data-time-phase') || 'day';
      const SKY: Record<string, { top: number; bot: number; fog: number }> = {
        dawn:  { top: 0x2a3a6a, bot: 0xf6b9a0, fog: 0x6a5a6a },
        day:   { top: 0x4a78b8, bot: 0xcfe0ee, fog: 0x9fb4c8 },
        dusk:  { top: 0x3a2a5a, bot: 0xe0885a, fog: 0x5a4358 },
        night: { top: 0x070912, bot: 0x1a2240, fog: 0x0a0c1a },
        off:   { top: 0x4a78b8, bot: 0xcfe0ee, fog: 0x9fb4c8 },
      };
      const sky = SKY[phase] ?? SKY.day;
      scene.fog = new THREE.FogExp2(sky.fog, 0.030);

      const skyGeo = new THREE.SphereGeometry(60, 32, 16);
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color(sky.top) },
          uBot: { value: new THREE.Color(sky.bot) },
        },
        vertexShader: `
          varying vec3 vP;
          void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          varying vec3 vP;
          uniform vec3 uTop;
          uniform vec3 uBot;
          void main() {
            float h = clamp(vP.y / 60.0 * 0.5 + 0.5, 0.0, 1.0);
            gl_FragColor = vec4(mix(uBot, uTop, pow(h, 0.8)), 1.0);
          }
        `,
      });
      scene.add(new THREE.Mesh(skyGeo, skyMat));

      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 200);
      camera.position.set(0, 1.4, 8);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xfff0d8, 1.2);
      key.position.set(-4, 8, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x9ab0ff, 0.5);
      fill.position.set(5, 3, -4);
      scene.add(fill);

      // ── Terrain from the painting depth ───────────────────────────
      const texLoader = new THREE.TextureLoader();
      const paintTex = await new Promise<InstanceType<typeof THREE.Texture>>((res, rej) => {
        texLoader.load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej);
      });
      if (cancelled) { paintTex.dispose(); renderer.dispose(); return; }
      const depthTex = depthResult ? new THREE.CanvasTexture(depthResult.bitmap) : null;

      const SIZE = 30;
      const SEG = 200;
      const HEIGHT = 7.5;
      const geom = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uPaint: { value: paintTex },
          uDepth: { value: depthTex },
          uHeight: { value: depthTex ? HEIGHT : 0 },
        },
        vertexShader: `
          uniform sampler2D uDepth;
          uniform float uHeight;
          varying vec2 vUv; varying float vH;
          void main() {
            vUv = uv;
            float d = uHeight > 0.0 ? texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r : 0.0;
            vH = d;
            vec3 p = position; p.z += d * uHeight;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform sampler2D uPaint;
          varying vec2 vUv; varying float vH;
          void main() {
            vec3 c = texture2D(uPaint, vUv).rgb;
            c *= 0.7 + vH * 0.5;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      });
      const terrain = new THREE.Mesh(geom, mat);
      terrain.rotation.x = -Math.PI / 2;
      scene.add(terrain);

      // CPU depth read for walking on the surface.
      let depthData: Uint8ClampedArray | null = null;
      let depthW = 0, depthH = 0;
      if (depthResult) {
        const dc = document.createElement('canvas');
        dc.width = depthResult.width; dc.height = depthResult.height;
        const dctx = dc.getContext('2d')!;
        dctx.drawImage(depthResult.bitmap, 0, 0);
        depthData = dctx.getImageData(0, 0, dc.width, dc.height).data;
        depthW = dc.width; depthH = dc.height;
      }
      const sampleDepthBitmap = (u: number, v: number): number => {
        if (!depthData) return 0;
        const px = Math.min(depthW - 1, Math.max(0, Math.floor(u * depthW)));
        const py = Math.min(depthH - 1, Math.max(0, Math.floor((1 - v) * depthH)));
        return depthData[(py * depthW + px) * 4] / 255;
      };
      const heightAt = (wx: number, wz: number): number => {
        if (!depthResult) return 0;
        const u = (wx / SIZE) + 0.5;
        const v = 1.0 - ((wz / SIZE) + 0.5);
        if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
        return sampleDepthBitmap(u, v) * HEIGHT;
      };

      // ── #13 Water shimmer plane (Wave atmosphere) ─────────────────
      let water: InstanceType<typeof THREE.Mesh> | null = null;
      let waterMat: InstanceType<typeof THREE.ShaderMaterial> | null = null;
      if (kind === 'wave') {
        waterMat = new THREE.ShaderMaterial({
          transparent: true,
          uniforms: {
            uTime: { value: 0 },
            uSky:  { value: new THREE.Color(sky.bot) },
          },
          vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
          `,
          fragmentShader: `
            precision highp float;
            uniform float uTime; uniform vec3 uSky;
            varying vec2 vUv;
            void main() {
              // Layered sine "wavelets" + a fresnel-ish vertical fade
              // give a reflective shimmer without a second render pass.
              float w = sin((vUv.x * 40.0) + uTime * 1.2) * 0.5 + 0.5;
              w *= sin((vUv.y * 30.0) - uTime * 0.9) * 0.5 + 0.5;
              vec3 col = mix(vec3(0.05, 0.12, 0.22), uSky, 0.35 + w * 0.4);
              gl_FragColor = vec4(col, 0.78);
            }
          `,
        });
        water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = HEIGHT * 0.18; // sits in the low (water) zones
        scene.add(water);
      }

      // ── #1 Readable file pages ────────────────────────────────────
      const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
      };
      // Card geometry (canvas-local) + a shared aged-parchment base drawn ONCE
      // and reused by every page, so the texture work doesn't scale with files.
      const PX = 12, PY = 12, PW = 488, PH = 360, PR = 14;
      const parchment = (() => {
        const pc = document.createElement('canvas');
        pc.width = 512; pc.height = 384;
        const p = pc.getContext('2d')!;
        roundRect(p, PX, PY, PW, PH, PR); p.save(); p.clip();
        // Warm parchment gradient.
        const grad = p.createLinearGradient(0, PY, 0, PY + PH);
        grad.addColorStop(0, '#ece0c2'); grad.addColorStop(1, '#dcc699');
        p.fillStyle = grad; p.fillRect(0, 0, 512, 384);
        // Soft sepia staining blobs.
        for (let i = 0; i < 7; i++) {
          const sx = PX + Math.random() * PW, sy = PY + Math.random() * PH, sr = 40 + Math.random() * 90;
          const g = p.createRadialGradient(sx, sy, 0, sx, sy, sr);
          g.addColorStop(0, 'rgba(120,84,38,0.06)'); g.addColorStop(1, 'rgba(120,84,38,0)');
          p.fillStyle = g; p.fillRect(0, 0, 512, 384);
        }
        // Fibre grain — light + dark flecks.
        for (let i = 0; i < 900; i++) {
          p.globalAlpha = 0.04 + Math.random() * 0.04;
          p.fillStyle = Math.random() > 0.5 ? '#fffaf0' : '#5a431f';
          p.fillRect(PX + Math.random() * PW, PY + Math.random() * PH, 1.3, 1.3);
        }
        p.globalAlpha = 1;
        // Reddish-brown foxing spots.
        for (let i = 0; i < 24; i++) {
          p.fillStyle = `rgba(${(118 + Math.random() * 40) | 0},${(58 + Math.random() * 30) | 0},${(28 + Math.random() * 18) | 0},${0.12 + Math.random() * 0.16})`;
          p.beginPath(); p.arc(PX + Math.random() * PW, PY + Math.random() * PH, 1 + Math.random() * 2.4, 0, 6.2832); p.fill();
        }
        // Aged-edge vignette.
        const vg = p.createRadialGradient(256, 192, 120, 256, 192, 272);
        vg.addColorStop(0, 'rgba(70,52,28,0)'); vg.addColorStop(1, 'rgba(70,52,28,0.30)');
        p.fillStyle = vg; p.fillRect(0, 0, 512, 384);
        p.restore();
        // Scroll rods, top + bottom.
        const rod = (ry: number) => {
          const rg = p.createLinearGradient(0, ry, 0, ry + 15);
          rg.addColorStop(0, '#6f5839'); rg.addColorStop(1, '#493521');
          p.fillStyle = rg; roundRect(p, PX - 5, ry, PW + 10, 15, 5); p.fill();
        };
        rod(PY - 7); rod(PY + PH - 8);
        // Vermillion wax seal, lower-right.
        const seal = p.createRadialGradient(460, 336, 2, 466, 344, 22);
        seal.addColorStop(0, '#d75c49'); seal.addColorStop(1, '#7a2216');
        p.fillStyle = seal; p.beginPath(); p.arc(464, 340, 18, 0, 6.2832); p.fill();
        p.strokeStyle = 'rgba(120,32,20,0.9)'; p.lineWidth = 2; p.stroke();
        return pc;
      })();
      const makePageTexture = (title: string, body: string) => {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 384;
        const cx = c.getContext('2d')!;
        cx.drawImage(parchment, 0, 0);
        // Title — solid sepia ink + a faint brush rule beneath it.
        cx.fillStyle = '#241a0c';
        cx.font = '700 30px Georgia, serif';
        cx.textBaseline = 'top';
        const tt = title.length > 28 ? title.slice(0, 27) + '…' : title;
        cx.fillText(tt, 40, 44);
        cx.strokeStyle = 'rgba(40,28,14,0.32)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.moveTo(40, 82); cx.lineTo(470, 82); cx.stroke();
        // Body — solid sepia ink, word-wrapped excerpt.
        cx.fillStyle = 'rgba(36,27,14,0.9)';
        cx.font = '20px Georgia, serif';
        const words = (body || '(empty)').split(/\s+/);
        let line = ''; let yy = 100; const maxW = 416;
        for (const word of words) {
          const test = line ? line + ' ' + word : word;
          if (cx.measureText(test).width > maxW) {
            cx.fillText(line, 40, yy); yy += 28; line = word;
            if (yy > 318) { cx.fillText(line + '…', 40, yy); line = ''; break; }
          } else line = test;
        }
        if (line && yy <= 318) cx.fillText(line, 40, yy);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };

      const waypoints: Array<{ id: string; group: InstanceType<typeof THREE.Group> }> = [];
      filesRef.current.slice(0, 24).forEach((f, i) => {
        const ang = i * 2.399963;
        const rad = 2 + Math.sqrt(i) * 2.2;
        const wx = Math.cos(ang) * rad;
        const wz = Math.sin(ang) * rad - 2;
        const wy = heightAt(wx, wz) + 1.9;
        const group = new THREE.Group();
        group.position.set(wx, wy, wz);
        // Readable page billboard.
        const pageTex = makePageTexture(f.displayName || f.filename, excerpts.get(f.id) ?? '');
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: pageTex, transparent: true }));
        sprite.scale.set(2.6, 1.95, 1);
        group.add(sprite);
        // Glow orb anchor at the base.
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xb9a4ff }),
        );
        orb.position.y = -1.2;
        group.add(orb);
        scene.add(group);
        waypoints.push({ id: f.id, group });
      });

      // ── #2 Footprint / trail decals ───────────────────────────────
      const TRAIL_MAX = 80;
      const trailDecals: Array<{ mesh: InstanceType<typeof THREE.Mesh>; born: number }> = [];
      const trailColor = kind === 'snow' ? 0xdfe8f4
        : kind === 'fields' ? 0x4a5a2a
        : kind === 'wave' ? 0x9fc4e0
        : 0xb9a4ff;
      const trailGeo = new THREE.CircleGeometry(0.35, 12);
      let lastTrailPos = new THREE.Vector3(0, 0, 0);

      // ── #18 Ambient wildlife ──────────────────────────────────────
      type Creature = { mesh: InstanceType<typeof THREE.Object3D>; phase: number; kind: string };
      const creatures: Creature[] = [];
      const spawnCreatures = () => {
        if (kind === 'fuji') {
          // Birds — small dark V's gliding in wide arcs up high.
          for (let i = 0; i < 6; i++) {
            const g = new THREE.Group();
            const wingMat = new THREE.MeshBasicMaterial({ color: 0x2a2a32, side: THREE.DoubleSide });
            const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), wingMat);
            const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), wingMat);
            w1.rotation.z = 0.4; w2.rotation.z = -0.4; w1.position.x = -0.22; w2.position.x = 0.22;
            g.add(w1, w2);
            g.position.set((Math.random() - 0.5) * 24, 6 + Math.random() * 6, (Math.random() - 0.5) * 24);
            scene.add(g);
            creatures.push({ mesh: g, phase: Math.random() * 6.28, kind: 'bird' });
          }
        } else if (kind === 'fields') {
          // Fireflies — glowing amber points bobbing low.
          for (let i = 0; i < 28; i++) {
            const m = new THREE.Mesh(
              new THREE.SphereGeometry(0.05, 6, 6),
              new THREE.MeshBasicMaterial({ color: 0xf5cd82 }),
            );
            m.position.set((Math.random() - 0.5) * 26, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 26);
            scene.add(m);
            creatures.push({ mesh: m, phase: Math.random() * 6.28, kind: 'firefly' });
          }
        } else if (kind === 'wave') {
          // Fish — silver arcs that leap near the water plane occasionally.
          for (let i = 0; i < 5; i++) {
            const m = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.08, 0.3, 4, 8),
              new THREE.MeshBasicMaterial({ color: 0xc4d4e0 }),
            );
            m.position.set((Math.random() - 0.5) * 20, HEIGHT * 0.18, (Math.random() - 0.5) * 20);
            m.visible = false;
            scene.add(m);
            creatures.push({ mesh: m, phase: Math.random() * 20, kind: 'fish' });
          }
        }
      };
      spawnCreatures();

      // ── Controls ──────────────────────────────────────────────────
      const keysDown = new Set<string>();
      let yaw = Math.PI;
      let pitch = -0.15;
      let dragging = false;
      let lastX = 0, lastY = 0;
      let fly = false;

      // Keys the world owns. While inside, these must NOT also reach
      // the underlying viewer's keyboard-nav (which would switch the
      // active file behind the world — the "respawn" the user saw).
      // We register in the CAPTURE phase and stopImmediatePropagation
      // so window-level bubble listeners (useKeyboardNav etc.) never
      // fire for our movement keys.
      const OWNED = new Set([' ', 'w', 'a', 's', 'd', 'f', 'e',
        'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'escape']);
      const onKeyDown = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (OWNED.has(k)) { e.preventDefault(); e.stopImmediatePropagation(); }
        if (k === 'escape') { onClose(); return; }
        if (k === 'e') {
          const near = nearFileRef.current;
          if (near) { void setActiveFile(near); onClose(); }
          return;
        }
        if (k === 'f') { fly = !fly; setFlying(fly); return; }
        keysDown.add(k);
      };
      const onKeyUp = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (OWNED.has(k)) e.stopImmediatePropagation();
        keysDown.delete(k);
      };
      const onMouseDown = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onMouseUp = () => { dragging = false; };
      const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        yaw   -= (e.clientX - lastX) * 0.0032;
        pitch -= (e.clientY - lastY) * 0.0032;
        pitch = Math.max(-1.2, Math.min(0.9, pitch));
        lastX = e.clientX; lastY = e.clientY;
      };
      const onClick = () => {
        const near = nearFileRef.current;
        if (near) { void setActiveFile(near); onClose(); }
      };
      window.addEventListener('keydown', onKeyDown, { capture: true });
      window.addEventListener('keyup', onKeyUp, { capture: true });
      canvas.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('click', onClick);

      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', resize);

      // Wind sway (#17) — cheap value noise.
      const swayNoise = (t: number) => Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9 + 1.3) * 0.3;

      const startMs = performance.now();
      const draw = (dt: number, now: number) => {
        const tSec = (now - startMs) / 1000;

        const dir = new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        );
        const fwdFlat = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
        const right = new THREE.Vector3(fwdFlat.z, 0, -fwdFlat.x);
        // Walking: forward stays horizontal (you don't tunnel into the
        // ground when looking down). Flying: forward follows the full
        // look direction, so W while looking up climbs — that's what
        // reads as actual flight.
        const moveFwd = fly ? dir : fwdFlat;
        const speed = (fly ? 12 : 6) * dt;
        if (keysDown.has('w') || keysDown.has('arrowup'))    camera.position.addScaledVector(moveFwd, speed);
        if (keysDown.has('s') || keysDown.has('arrowdown'))  camera.position.addScaledVector(moveFwd, -speed);
        if (keysDown.has('a') || keysDown.has('arrowleft'))  camera.position.addScaledVector(right, speed);
        if (keysDown.has('d') || keysDown.has('arrowright')) camera.position.addScaledVector(right, -speed);
        if (fly) {
          if (keysDown.has(' '))     camera.position.y += speed;
          if (keysDown.has('shift')) camera.position.y -= speed;
        }

        const half = SIZE / 2 - 1;
        camera.position.x = Math.max(-half, Math.min(half, camera.position.x));
        camera.position.z = Math.max(-half, Math.min(half, camera.position.z));
        if (!fly) {
          const ground = heightAt(camera.position.x, camera.position.z);
          camera.position.y += (ground + 1.5 - camera.position.y) * Math.min(1, dt * 8);
        } else {
          camera.position.y = Math.max(0.5, Math.min(40, camera.position.y));
        }

        // Wind sway — small look-direction wobble (#17). Stronger
        // standing still; barely there while moving so it doesn't
        // induce motion sickness.
        const swayAmt = 0.012;
        const sway = new THREE.Vector3(
          swayNoise(tSec) * swayAmt,
          swayNoise(tSec + 11) * swayAmt * 0.6,
          0,
        );
        camera.lookAt(camera.position.clone().add(dir).add(sway));

        // Footprint trail (#2) — drop a decal every ~0.6 units travelled,
        // only on the ground (not flying).
        if (!fly && camera.position.distanceTo(lastTrailPos) > 0.6) {
          lastTrailPos = camera.position.clone();
          const gY = heightAt(camera.position.x, camera.position.z);
          const decalMat = new THREE.MeshBasicMaterial({
            color: trailColor, transparent: true, opacity: 0.5, depthWrite: false,
          });
          const decal = new THREE.Mesh(trailGeo, decalMat);
          decal.rotation.x = -Math.PI / 2;
          decal.position.set(camera.position.x, gY + 0.02, camera.position.z);
          scene.add(decal);
          trailDecals.push({ mesh: decal, born: now });
          if (trailDecals.length > TRAIL_MAX) {
            const old = trailDecals.shift()!;
            scene.remove(old.mesh);
            (old.mesh.material as InstanceType<typeof THREE.Material>).dispose?.();
          }
        }
        // Fade trail decals over 8s.
        for (let i = trailDecals.length - 1; i >= 0; i--) {
          const td = trailDecals[i];
          const age = (now - td.born) / 1000;
          const m = td.mesh.material as InstanceType<typeof THREE.MeshBasicMaterial>;
          m.opacity = Math.max(0, 0.5 * (1 - age / 8));
          if (age > 8) {
            scene.remove(td.mesh); m.dispose?.(); trailDecals.splice(i, 1);
          }
        }

        // Water shimmer.
        if (waterMat) (waterMat.uniforms.uTime as { value: number }).value = tSec;

        // Wildlife (#18).
        for (const c of creatures) {
          if (c.kind === 'bird') {
            const r = 8 + (c.phase % 3) * 2;
            c.mesh.position.x = Math.cos(tSec * 0.18 + c.phase) * r;
            c.mesh.position.z = Math.sin(tSec * 0.18 + c.phase) * r;
            c.mesh.position.y = 7 + Math.sin(tSec * 0.5 + c.phase) * 1.5;
            c.mesh.rotation.y = -tSec * 0.18 - c.phase + Math.PI / 2;
            // Wing flap.
            const g = c.mesh as InstanceType<typeof THREE.Group>;
            const flap = Math.sin(tSec * 8 + c.phase) * 0.3;
            g.children[0].rotation.z = 0.4 + flap;
            g.children[1].rotation.z = -0.4 - flap;
          } else if (c.kind === 'firefly') {
            c.mesh.position.x += Math.sin(tSec * 0.6 + c.phase) * 0.01;
            c.mesh.position.y += Math.cos(tSec * 0.9 + c.phase) * 0.008;
            const mm = (c.mesh as InstanceType<typeof THREE.Mesh>).material as InstanceType<typeof THREE.MeshBasicMaterial>;
            mm.opacity = 0.4 + Math.sin(tSec * 2 + c.phase) * 0.4;
            mm.transparent = true;
          } else if (c.kind === 'fish') {
            // Leap once per cycle: visible only on the arc.
            const cyc = (tSec + c.phase) % 14;
            if (cyc < 1.2) {
              c.mesh.visible = true;
              const u = cyc / 1.2;
              c.mesh.position.y = HEIGHT * 0.18 + Math.sin(u * Math.PI) * 1.6;
              c.mesh.rotation.z = (u - 0.5) * 2.4;
            } else {
              c.mesh.visible = false;
            }
          }
        }

        // Waypoint proximity.
        let closest: { id: string; dist: number } | null = null;
        for (const wp of waypoints) {
          const d = wp.group.position.distanceTo(camera.position);
          wp.group.scale.setScalar(d < 4 ? 1.15 : 1.0);
          if (!closest || d < closest.dist) closest = { id: wp.id, dist: d };
        }
        const newNear = closest && closest.dist < 4 ? closest.id : null;
        if (newNear !== nearFileRef.current) setNearFile(newNear);

        renderer.render(scene, camera);
      };
      const loop = startRafLoop(draw);
      setStatus('ready');

      cleanup = () => {
        window.removeEventListener('keydown', onKeyDown, { capture: true });
        window.removeEventListener('keyup', onKeyUp, { capture: true });
        canvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('click', onClick);
        window.removeEventListener('resize', resize);
        loop.stop();
        geom.dispose(); mat.dispose(); paintTex.dispose(); depthTex?.dispose();
        skyGeo.dispose(); skyMat.dispose();
        waterMat?.dispose();
        renderer.dispose();
      };
    })().catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; cleanup?.(); };
  }, [src, kind, onClose, setActiveFile]);

  return (
    <div className="mv-world-overlay">
      <canvas ref={canvasRef} className="mv-world-canvas" />
      {status === 'loading' && (
        <div className="mv-world-loading">entering the painting…</div>
      )}
      {status === 'error' && (
        <div className="mv-world-loading">couldn't enter — depth unavailable</div>
      )}
      <div className="mv-world-hud">
        <span><kbd>WASD</kbd> move</span>
        <span><kbd>drag</kbd> look</span>
        <span className={flying ? 'mv-world-near' : ''}>
          <kbd>F</kbd> {flying ? 'flying · space/shift' : 'fly'}
        </span>
        {nearFile
          ? <span className="mv-world-near"><kbd>E</kbd> / click · open</span>
          : <span>walk to a page to open it</span>}
        <span><kbd>esc</kbd> leave</span>
      </div>
    </div>
  );
}
