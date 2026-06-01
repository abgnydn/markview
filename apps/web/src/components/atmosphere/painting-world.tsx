// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { ensureDepth } from '@/lib/atmosphere/depth';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface PaintingWorldProps {
  /** Painting image URL to enter. */
  src: string;
  onClose: () => void;
}

/**
 * PaintingWorld — "go inside" the painting. The depth map drives a
 * heavily Z-displaced relief landscape (the painting becomes terrain);
 * a first-person camera walks through it with WASD + drag-to-look.
 * Each file in the workspace is anchored as a glowing waypoint card
 * floating above the terrain — walk up to one and the card enlarges;
 * click (or press E) to open that file and exit the world.
 *
 * Pure Three.js (already a dep). Fullscreen overlay; Esc exits.
 */
export function PaintingWorld({ src, onClose }: PaintingWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const files = useWorkspaceStore((s) => s.files);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nearFile, setNearFile] = useState<string | null>(null);
  // Refs so the rAF loop sees current values without re-running the effect.
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

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x0a0910, 0.045);

      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
      // Start at the near edge of the terrain, slightly elevated, looking in.
      camera.position.set(0, 1.4, 8);

      // Lights — warm key + cool fill so the relief reads dimensionally.
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xfff0d8, 1.2);
      key.position.set(-4, 8, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x9ab0ff, 0.5);
      fill.position.set(5, 3, -4);
      scene.add(fill);

      // ── Terrain mesh from the painting ────────────────────────────
      const texLoader = new THREE.TextureLoader();
      const paintTex = await new Promise<InstanceType<typeof THREE.Texture>>((res, rej) => {
        texLoader.load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej);
      });
      if (cancelled) { paintTex.dispose(); renderer.dispose(); return; }
      const depthTex = depthResult ? new THREE.CanvasTexture(depthResult.bitmap) : null;

      // A large ground plane laid flat (rotateX -90°) with the painting
      // as its albedo and the depth map driving vertex height. 200×200
      // segments = smooth terrain. World extent 30×30 units.
      const SIZE = 30;
      const SEG = 200;
      const HEIGHT = 7.5; // max relief height in world units
      const geom = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uPaint:  { value: paintTex },
          uDepth:  { value: depthTex },
          uHeight: { value: depthTex ? HEIGHT : 0 },
        },
        vertexShader: `
          uniform sampler2D uDepth;
          uniform float uHeight;
          varying vec2 vUv;
          varying float vH;
          void main() {
            vUv = uv;
            float d = uHeight > 0.0 ? texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r : 0.0;
            vH = d;
            vec3 p = position;
            p.z += d * uHeight;     // plane is in XY, extruded along Z; rotated flat by the mesh
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform sampler2D uPaint;
          varying vec2 vUv;
          varying float vH;
          void main() {
            vec3 c = texture2D(uPaint, vUv).rgb;
            // Slight height-based brightening so peaks catch more light.
            c *= 0.7 + vH * 0.5;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      });
      const terrain = new THREE.Mesh(geom, mat);
      terrain.rotation.x = -Math.PI / 2; // lay flat
      scene.add(terrain);

      // Sample terrain height at a world (x,z) — mirrors the vertex
      // displacement so the camera can walk ON the surface.
      const heightAt = (wx: number, wz: number): number => {
        if (!depthResult) return 0;
        // World (x,z) → plane uv. Plane spans [-SIZE/2, SIZE/2].
        const u = (wx / SIZE) + 0.5;
        const v = 1.0 - ((wz / SIZE) + 0.5);
        if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
        // Read the depth bitmap via a scratch canvas (one-time).
        return sampleDepthBitmap(u, v) * HEIGHT;
      };

      // One-time: rasterize the depth bitmap to a tiny canvas for CPU reads.
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
      function sampleDepthBitmap(u: number, v: number): number {
        if (!depthData) return 0;
        const px = Math.min(depthW - 1, Math.max(0, Math.floor(u * depthW)));
        const py = Math.min(depthH - 1, Math.max(0, Math.floor((1 - v) * depthH)));
        return depthData[(py * depthW + px) * 4] / 255;
      }

      // ── File waypoints ────────────────────────────────────────────
      // Each file is a glowing billboard placed on the terrain in a
      // loose spiral, lifted to sit just above the surface.
      const waypoints: Array<{ id: string; group: InstanceType<typeof THREE.Group>; label: string }> = [];
      const makeLabelTexture = (text: string) => {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 128;
        const cx = c.getContext('2d')!;
        cx.clearRect(0, 0, c.width, c.height);
        cx.fillStyle = 'rgba(11,10,13,0.82)';
        roundRect(cx, 8, 30, 496, 68, 14); cx.fill();
        cx.strokeStyle = 'rgba(185,164,255,0.7)'; cx.lineWidth = 2;
        roundRect(cx, 8, 30, 496, 68, 14); cx.stroke();
        cx.fillStyle = '#ece8e0';
        cx.font = '500 34px Georgia, serif';
        cx.textBaseline = 'middle';
        const t = text.length > 26 ? text.slice(0, 25) + '…' : text;
        cx.fillText(t, 28, 66);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };
      function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
      }

      filesRef.current.forEach((f, i) => {
        // Loose spiral placement within the central 70% of the terrain.
        const ang = i * 2.399963; // golden angle
        const rad = 2 + Math.sqrt(i) * 2.2;
        const wx = Math.cos(ang) * rad;
        const wz = Math.sin(ang) * rad - 2;
        const wy = heightAt(wx, wz) + 1.6;
        const group = new THREE.Group();
        group.position.set(wx, wy, wz);
        // Glow orb.
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0xb9a4ff }),
        );
        group.add(orb);
        // Label billboard.
        const labelTex = makeLabelTexture(f.displayName || f.filename);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
        sprite.scale.set(3.2, 0.8, 1);
        sprite.position.y = 0.7;
        group.add(sprite);
        scene.add(group);
        waypoints.push({ id: f.id, group, label: f.displayName || f.filename });
      });

      // ── Controls — WASD + drag-look ───────────────────────────────
      const keysDown = new Set<string>();
      let yaw = Math.PI; // looking toward -z (into the terrain)
      let pitch = -0.15;
      let dragging = false;
      let lastX = 0, lastY = 0;

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { onClose(); return; }
        if (e.key === 'e' || e.key === 'E') {
          const near = nearFileRef.current;
          if (near) { void setActiveFile(near); onClose(); }
          return;
        }
        keysDown.add(e.key.toLowerCase());
      };
      const onKeyUp = (e: KeyboardEvent) => keysDown.delete(e.key.toLowerCase());
      const onMouseDown = (e: MouseEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onMouseUp = () => { dragging = false; };
      const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        yaw   -= (e.clientX - lastX) * 0.0032;
        pitch -= (e.clientY - lastY) * 0.0032;
        pitch = Math.max(-1.2, Math.min(0.6, pitch));
        lastX = e.clientX; lastY = e.clientY;
      };
      // Click a waypoint when near it.
      const onClick = () => {
        const near = nearFileRef.current;
        if (near) { void setActiveFile(near); onClose(); }
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
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

      let last = performance.now();
      let raf = 0;
      const draw = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        // Look direction from yaw/pitch.
        const dir = new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        );
        // Movement on the horizontal plane.
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
        const speed = 6 * dt;
        if (keysDown.has('w') || keysDown.has('arrowup'))    camera.position.addScaledVector(fwd, speed);
        if (keysDown.has('s') || keysDown.has('arrowdown'))  camera.position.addScaledVector(fwd, -speed);
        if (keysDown.has('a') || keysDown.has('arrowleft'))  camera.position.addScaledVector(right, speed);
        if (keysDown.has('d') || keysDown.has('arrowright')) camera.position.addScaledVector(right, -speed);

        // Clamp to terrain bounds + ride the surface (eye height 1.5).
        const half = SIZE / 2 - 1;
        camera.position.x = Math.max(-half, Math.min(half, camera.position.x));
        camera.position.z = Math.max(-half, Math.min(half, camera.position.z));
        const ground = heightAt(camera.position.x, camera.position.z);
        camera.position.y += (ground + 1.5 - camera.position.y) * Math.min(1, dt * 8);

        camera.lookAt(camera.position.clone().add(dir));

        // Waypoint proximity — pulse the nearest within 3 units, billboard all.
        let closest: { id: string; dist: number } | null = null;
        for (const wp of waypoints) {
          const d = wp.group.position.distanceTo(camera.position);
          const s = d < 3 ? 1.3 : 1.0;
          const orb = wp.group.children[0] as InstanceType<typeof THREE.Mesh>;
          orb.scale.setScalar(s + Math.sin(now / 300) * 0.08 * (d < 3 ? 1 : 0.3));
          if (!closest || d < closest.dist) closest = { id: wp.id, dist: d };
        }
        const newNear = closest && closest.dist < 3 ? closest.id : null;
        if (newNear !== nearFileRef.current) setNearFile(newNear);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      setStatus('ready');

      cleanup = () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('click', onClick);
        window.removeEventListener('resize', resize);
        if (raf) cancelAnimationFrame(raf);
        geom.dispose(); mat.dispose(); paintTex.dispose(); depthTex?.dispose();
        renderer.dispose();
      };
    })().catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; cleanup?.(); };
  }, [src, onClose, setActiveFile]);

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
        {nearFile
          ? <span className="mv-world-near"><kbd>E</kbd> / click · open this file</span>
          : <span>walk to a glowing marker to open a file</span>}
        <span><kbd>esc</kbd> leave</span>
      </div>
    </div>
  );
}
