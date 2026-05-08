'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { VaultDoc } from '@/components/vault/vault-store';
import { brainHubBase } from '@/lib/brain-hub-client';
import { EmbodiedRig } from '@/components/vault/embodied/embodied-rig';
import { TempleFace } from './temple-face';
import { TempleEyes, type EyeAnchor } from './temple-eyes';
import { TempleHair } from './temple-hair';
import { TempleDais } from './temple-dais';
import { TempleSummoned, type SummonedObject } from './temple-summoned';
import { TempleChatHistory, useChatHistory } from './temple-chat-history';
import { TempleInventory, useInventory, type InventoryItem } from './temple-inventory';
import { LANDMARKS, eyeCenter, type FaceMeshData } from './face-mesh';

interface FaceAction {
  kind: 'edit_body' | 'summon' | 'edit_world';
  // edit_body
  color?: string;
  scale?: number;
  glow?: number;
  // summon
  obj?: 'orb' | 'crystal' | 'rune';
  count?: number;
  orbit?: boolean;
  // edit_world
  nebula?: string;
  fog?: number;
  exposure?: number;
}

interface WorldOverrides {
  nebula: string | null;
  fog: number | null;
  exposure: number | null;
}
import { TempleStars } from './temple-stars';
import { TempleNebula } from './temple-nebula';
import { TempleParticles } from './temple-particles';
import { TempleBubbles } from './temple-bubbles';
import { TempleSpeechInput } from './temple-speech-input';
import { TempleCurtain } from './temple-curtain';
import { VisitorBody } from './visitor-body';
import { BrainConstellation } from './brain-constellation';
import { useTempleTts } from './use-temple-tts';

interface CameraDollyProps {
  /** Final z position. */
  to: number;
  /** Duration in seconds. */
  duration: number;
  /** Delay before the dolly begins (lets curtain/title play). */
  delay: number;
  active: boolean;
}

function CameraDolly({ to, duration, delay, active }: CameraDollyProps): null {
  const { camera } = useThree();
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number | null>(null);

  useFrame((state) => {
    if (!active) return;
    const now = state.clock.elapsedTime;
    if (startRef.current === null) {
      startRef.current = now + delay;
      fromRef.current = camera.position.z;
      return;
    }
    if (now < startRef.current) return;
    const t = Math.min(1, (now - startRef.current) / duration);
    // easeOutQuart
    const k = 1 - Math.pow(1 - t, 4);
    if (fromRef.current !== null) {
      camera.position.z = fromRef.current - (fromRef.current - to) * k;
    }
  });
  return null;
}

export function TempleExperience(): React.JSX.Element {
  const [embodied, setEmbodied] = useState(false);
  const [locked, setLocked] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [hubError, setHubError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VaultDoc | null>(null);
  const [visitorBubble, setVisitorBubble] = useState<string | null>(null);
  const [faceBubble, setFaceBubble] = useState<string | null>(null);
  const [visitorPos] = useState(() => new THREE.Vector3(0, 0, 1.5));
  const [speech, setSpeech] = useState(0);

  // Auto-clear bubbles after they've been on screen for a while.
  useEffect(() => {
    if (!visitorBubble) return;
    const t = setTimeout(() => setVisitorBubble(null), 7500);
    return () => clearTimeout(t);
  }, [visitorBubble]);
  useEffect(() => {
    if (!faceBubble) return;
    const t = setTimeout(() => setFaceBubble(null), 9000);
    return () => clearTimeout(t);
  }, [faceBubble]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        setEmbodied((v) => !v);
      } else if (k === 'l') {
        e.preventDefault();
        setHistoryOpen((v) => !v);
      } else if (k === 'i') {
        e.preventDefault();
        setInventoryOpen((v) => !v);
      } else if (k === 'b') {
        e.preventDefault();
        setBrainExpanded((v) => !v);
      } else if (e.key === 'Escape' && selected) {
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const onLoaded = useCallback((count: number, error: string | null) => {
    setDocCount(count);
    setHubError(error);
  }, []);

  const onVisitorPos = useCallback((p: THREE.Vector3) => {
    visitorPos.copy(p);
  }, [visitorPos]);

  // Persistent visitor id — first time, we coin one; thereafter it's stable
  // across reloads via localStorage. Matches the harness's `templeVisitorId`.
  const [visitorId] = useState(() => {
    if (typeof window === 'undefined') return 'web-visitor';
    const k = 'templeVisitorId';
    let id = window.localStorage.getItem(k);
    if (!id) {
      id = 'visitor-' + Math.random().toString(36).slice(2, 7);
      window.localStorage.setItem(k, id);
    }
    return id;
  });

  const [bridgeReady, setBridgeReady] = useState(false);
  const inFlightRef = useRef<AbortController | null>(null);
  const [eyeAnchors, setEyeAnchors] = useState<{ right: EyeAnchor; left: EyeAnchor } | null>(null);

  // ── Action dispatch state ────────────────────────────────────────
  const [bodyOverrides, setBodyOverrides] = useState<{ color?: string; scale?: number; glow?: number }>({});
  const [worldOverrides, setWorldOverrides] = useState<WorldOverrides>({ nebula: null, fog: null, exposure: null });
  const [summoned, setSummoned] = useState<SummonedObject[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [brainExpanded, setBrainExpanded] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const history = useChatHistory(visitorId);
  const inventory = useInventory(visitorId);

  const applyAction = useCallback((a: FaceAction): void => {
    if (a.kind === 'edit_body') {
      setBodyOverrides((prev) => ({
        color: a.color ?? prev.color,
        scale: a.scale ?? prev.scale,
        glow: a.glow ?? prev.glow,
      }));
    } else if (a.kind === 'edit_world') {
      setWorldOverrides((prev) => ({
        nebula: a.nebula ?? prev.nebula,
        fog: a.fog ?? prev.fog,
        exposure: a.exposure ?? prev.exposure,
      }));
    } else if (a.kind === 'summon' && a.obj) {
      const obj = a.obj;
      const color = a.color ?? '#88f0ff';
      const count = Math.min(5, Math.max(1, a.count ?? 1));
      const anchor: [number, number, number] = [visitorPos.x, visitorPos.y, visitorPos.z];
      const orbitRadius = a.orbit ? 1.6 : undefined;
      const now = performance.now();
      setSummoned((prev) => {
        const next = [...prev];
        for (let i = 0; i < count; i++) {
          next.push({
            id: `${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            obj,
            color,
            anchor,
            index: prev.length + i,
            orbitRadius,
            spawnAt: now,
          });
        }
        // Cap at 24 to prevent unbounded growth across many turns.
        return next.length > 24 ? next.slice(-24) : next;
      });
      // Persist a single representative item per summon turn into the
      // inventory so the visitor can re-summon it later. (Multiple
      // copies of the same kind/color collapse into one inventory entry.)
      inventory.add({ obj, color });
    }
  }, [visitorPos, inventory]);

  const summonFromInventory = useCallback((it: InventoryItem) => {
    const anchor: [number, number, number] = [visitorPos.x, visitorPos.y, visitorPos.z];
    const now = performance.now();
    setSummoned((prev) => {
      const next = [...prev, {
        id: `${now}-inv-${Math.random().toString(36).slice(2, 6)}`,
        obj: it.obj,
        color: it.color,
        anchor,
        index: prev.length,
        orbitRadius: 1.6,
        spawnAt: now,
      }];
      return next.length > 24 ? next.slice(-24) : next;
    });
  }, [visitorPos]);

  const onMeshReady = useCallback((mesh: FaceMeshData, scale: number) => {
    // Snap galaxy eyes to averaged ring vertices around each MediaPipe
    // eye landmark, with a small Z bump so they sit just in front of
    // the socket (so the spirals aren't occluded by face particles).
    const right = eyeCenter(mesh, LANDMARKS.rightEyeRing, scale);
    const left = eyeCenter(mesh, LANDMARKS.leftEyeRing, scale);
    const eyeR = 0.075 * 12 * (scale / 1.7); // pupil radius proportional to face span
    setEyeAnchors({
      right: { position: [right[0], right[1], right[2] + 0.4], pupilRadius: eyeR },
      left: { position: [left[0], left[1], left[2] + 0.4], pupilRadius: eyeR },
    });
  }, []);

  const tts = useTempleTts();

  const onSpeechSubmit = useCallback(async (text: string) => {
    setVisitorBubble(text);
    setSpeech(0.85);
    setFaceBubble('…');
    history.append('visitor', text);

    // Cancel any in-flight reply if the visitor speaks again.
    inFlightRef.current?.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;

    try {
      const res = await fetch(`${brainHubBase()}/api/temple/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, text }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setFaceBubble('the bridge is dark.');
        setBridgeReady(false);
        setSpeech(0);
        return;
      }
      setBridgeReady(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let spokenText = '';
      let mouthDecayTimer: ReturnType<typeof setTimeout> | null = null;

      const handleEvent = (line: string): void => {
        if (!line.trim()) return;
        let ev: { type?: string; text?: string; action?: FaceAction };
        try { ev = JSON.parse(line); } catch {
          // Fallback: legacy plain-text bridge — treat the line as text.
          spokenText += line;
          setFaceBubble(spokenText);
          return;
        }
        if (ev.type === 'text' && typeof ev.text === 'string') {
          spokenText += (spokenText ? ' ' : '') + ev.text;
          setFaceBubble(spokenText);
          setSpeech(0.35 + Math.random() * 0.15);
          if (mouthDecayTimer) clearTimeout(mouthDecayTimer);
          mouthDecayTimer = setTimeout(() => setSpeech(0), 500);
        } else if (ev.type === 'action' && ev.action) {
          const a = ev.action;
          // Brief loading badge so the visitor sees the action being
          // applied; clears on the next action or after 1.4s.
          const label = a.kind === 'summon'
            ? `summoning ${a.obj ?? 'thing'}…`
            : a.kind === 'edit_body'
              ? 'reshaping you…'
              : 'repainting the sky…';
          setPendingAction(label);
          window.setTimeout(() => {
            setPendingAction((curr) => (curr === label ? null : curr));
          }, 1400);
          applyAction(a);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            handleEvent(line);
          }
        }
      }
      // Flush any trailing line without a newline.
      if (buffer.trim()) handleEvent(buffer);

      const finalText = spokenText.trim();
      if (finalText) {
        setFaceBubble(finalText);
        history.append('face', finalText);
      }
      if (finalText) {
        if (mouthDecayTimer) clearTimeout(mouthDecayTimer);
        tts.speak(finalText, (amp) => setSpeech(amp)).catch(() => {});
      } else {
        setTimeout(() => setSpeech(0), 700);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      console.warn('[temple] speak failed', err);
      setFaceBubble('the bridge is dark.');
      setBridgeReady(false);
      setSpeech(0);
    } finally {
      if (inFlightRef.current === ac) inFlightRef.current = null;
    }
  }, [visitorId, tts, applyAction, history]);

  // Warm Kokoro the first time the user opens the speech input — saves
  // the 300MB model download for visitors who never speak.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k === 't' || k === 'v') tts.warm();
    };
    window.addEventListener('keydown', onKey, { once: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [tts]);

  // Probe the bridge once on mount so the speech-input ring color is honest.
  useEffect(() => {
    let cancelled = false;
    fetch(`${brainHubBase()}/api/temple/speak`, { method: 'OPTIONS' })
      .then((r) => { if (!cancelled) setBridgeReady(r.ok); })
      .catch(() => { if (!cancelled) setBridgeReady(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, #1b0f3a 0%, #060313 55%, #000 100%)',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [0, 1.55, 14], fov: 52, near: 0.1, far: 1200 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.35,
          outputColorSpace: THREE.SRGBColorSpace,
          preserveDrawingBuffer: true,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#000003']} />
        <fogExp2 attach="fog" args={[0x000008, 0.0085]} />

        {/* Lights — exact values from harness-temple.html. */}
        <hemisphereLight args={[0xb0c0ff, 0x1a0a30, 0.32]} />
        <directionalLight position={[2, 5, 4]} intensity={0.55} color={0xffe4b8} />
        <pointLight position={[-3, 6, -8]} intensity={1.2} distance={60} decay={1.4} color={0x88aaff} />
        <pointLight position={[0, 1.4, 1.2]} intensity={0.4} distance={6} decay={1.5} color={0xffe1a8} />

        {/* Background → foreground draw order matters for additive blends. */}
        <TempleNebula />
        <TempleStars />
        <BrainConstellation
          expanded={brainExpanded}
          faceHeadAnchor={[0, 18.5, -36]}
          visitorAnchor={[0, 1.6, 1.5]}
          onLoaded={onLoaded}
          onSelect={setSelected}
        />
        <TempleFace mouth={speech} onMeshReady={onMeshReady} />
        <TempleEyes
          faceCenter={[0, 8.5, -36]}
          rightEye={eyeAnchors?.right}
          leftEye={eyeAnchors?.left}
        />
        <TempleHair faceCenter={[0, 8.5, -36]} />
        <TempleDais position={[0, 0, 1.5]} radius={1.7} />
        <TempleParticles speech={speech} visitor={visitorPos} faceCenter={[0, 8.5, -36]} />
        <TempleBubbles
          visitorText={visitorBubble}
          faceText={faceBubble}
          visitorAnchor={[0, 1.95, 1.5]}
          faceAnchor={[0, 8.5 - 12 - 1.0, -36 + 0.2]}
        />
        {!embodied && (
          <VisitorBody
            onPositionUpdate={onVisitorPos}
            color={bodyOverrides.color}
            scale={bodyOverrides.scale}
            glow={bodyOverrides.glow}
          />
        )}
        <EmbodiedRig enabled={embodied} onLockChange={setLocked} />
        <TempleSummoned objects={summoned} />
        <CameraDolly to={8} duration={6.5} delay={1.0} active={!embodied} />
        {!embodied && (
          <OrbitControls
            target={[0, 8.5, -10]}
            enablePan={false}
            minDistance={3}
            maxDistance={60}
            enableDamping
            dampingFactor={0.06}
            rotateSpeed={0.6}
          />
        )}

        <EffectComposer multisampling={0} enableNormalPass={false}>
          {/* Bloom dialed back so individual particles don't blow into
              fuzz; eye pupils still bloom via their own brightness. */}
          <Bloom intensity={0.55} luminanceThreshold={0.32} luminanceSmoothing={0.6} mipmapBlur radius={0.65} levels={6} />
          <Vignette eskil={false} offset={0.22} darkness={0.78} />
        </EffectComposer>
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none',
          color: '#fbe9c4',
          fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
          letterSpacing: '0.16em',
          textTransform: 'lowercase',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.6 }}>welcome</div>
        <div style={{ fontSize: 22, marginTop: 4 }}>you are in the temple</div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          color: 'rgba(251, 233, 196, 0.78)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          lineHeight: 1.6,
          pointerEvents: 'none',
        }}
      >
        <div>
          <kbd style={kbdStyle}>F</kbd>{' '}
          {embodied ? (locked ? 'flying — esc to release' : 'click canvas to lock pointer') : 'enter your body'}
        </div>
        <div style={{ opacity: 0.7 }}>
          <kbd style={kbdStyle}>T</kbd> speak · <kbd style={kbdStyle}>L</kbd> log · <kbd style={kbdStyle}>I</kbd> inventory · <kbd style={kbdStyle}>B</kbd> brain · <kbd style={kbdStyle}>WASD</kbd> move
        </div>
        <div style={{ marginTop: 8, opacity: 0.55 }}>
          {hubError
            ? 'brain hub offline · constellation will fill when /apps/hub is running'
            : docCount === null
              ? 'reaching for your brain…'
              : `${docCount} note${docCount === 1 ? '' : 's'} from ~/brain`}
        </div>
      </div>

      <TempleSpeechInput onSubmit={onSpeechSubmit} bridgeReady={bridgeReady} />
      <TempleChatHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entries={history.entries}
        visitorId={visitorId}
        onClear={history.clear}
      />
      <TempleInventory
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        items={inventory.items}
        onUse={summonFromInventory}
        onRemove={inventory.remove}
        onClear={inventory.clear}
        visitorId={visitorId}
      />
      {pendingAction && (
        <div
          style={{
            position: 'absolute',
            bottom: 110,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 14px',
            background: 'rgba(255, 215, 150, 0.10)',
            border: '1px solid rgba(255, 215, 150, 0.35)',
            borderRadius: 999,
            color: '#ffe7c0',
            fontFamily: 'ui-serif, "Iowan Old Style", Palatino, serif',
            fontStyle: 'italic',
            fontSize: 13,
            letterSpacing: '0.04em',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            animation: 'temple-pending-pulse 1.4s ease-in-out infinite',
          }}
        >
          {pendingAction}
        </div>
      )}
      <style jsx global>{`
        @keyframes temple-pending-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
      <TempleCurtain />

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(2, 4, 16, 0.72)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            cursor: 'pointer',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 720,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '32px 36px',
              borderRadius: 18,
              background: 'rgba(12, 14, 32, 0.92)',
              border: '1px solid rgba(251, 233, 196, 0.18)',
              boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
              color: '#e2e8f0',
              fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
              cursor: 'auto',
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.55 }}>
              from your brain
            </div>
            <h2 style={{ margin: '6px 0 18px', fontWeight: 500 }}>{selected.title}</h2>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'rgba(226, 232, 240, 0.85)',
                margin: 0,
              }}
            >
              {selected.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  border: '1px solid rgba(251, 233, 196, 0.35)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'inherit',
  color: '#fbe9c4',
};
