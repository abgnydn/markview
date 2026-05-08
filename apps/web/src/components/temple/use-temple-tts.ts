'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PendingHandler {
  resolve: (ok: boolean) => void;
  reject: (err: Error) => void;
  onChunk?: (c: { audio: Float32Array; sampling_rate: number }) => void;
}

interface WorkerMsg {
  type: 'log' | 'loaded' | 'audio-chunk' | 'audio-end' | 'error';
  id?: number;
  audio?: Float32Array;
  sampling_rate?: number;
  error?: string;
  msg?: string;
}

const WORKER_URL = '/temple/kokoro-worker.mjs';

export interface UseTempleTtsApi {
  /** True once the worker has booted and finished pre-warm. */
  ready: boolean;
  /** True while audio is being scheduled / playing. */
  speaking: boolean;
  /** Kick off model load on first call (lazy — saves the 300MB download
   *  for visitors who never trigger speech). Idempotent. */
  warm: () => void;
  /**
   * Generate + play `text`. While playing, `onAmplitude` is called every
   * animation frame with a 0..1 RMS estimate sampled from an
   * AnalyserNode — drive the mouth-particle uniform off this for true
   * lip sync. Returns a promise that resolves when audio finishes.
   */
  speak: (text: string, onAmplitude?: (amp: number) => void) => Promise<void>;
  /** Stop in-flight playback and the worker call. */
  cancel: () => void;
}

export function useTempleTts(): UseTempleTtsApi {
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingRef = useRef(new Map<number, PendingHandler>());
  const msgIdRef = useRef(0);
  const loadStartedRef = useRef(false);

  const ensureWorker = useCallback((): Worker | null => {
    if (workerRef.current) return workerRef.current;
    if (typeof Worker === 'undefined') return null;
    try {
      const w = new Worker(WORKER_URL, { type: 'module' });
      w.onmessage = (e: MessageEvent<WorkerMsg>) => {
        const m = e.data;
        if (m.type === 'log') {
          console.log('[temple/kokoro]', m.msg);
          return;
        }
        const id = m.id;
        if (id === undefined) return;
        const handler = pendingRef.current.get(id);
        if (!handler) return;
        if (m.type === 'audio-chunk') {
          if (m.audio && m.sampling_rate) {
            handler.onChunk?.({ audio: m.audio, sampling_rate: m.sampling_rate });
          }
          return;
        }
        pendingRef.current.delete(id);
        if (m.type === 'audio-end' || m.type === 'loaded') handler.resolve(true);
        else handler.reject(new Error(m.error ?? m.type));
      };
      w.onerror = (ev) => console.warn('[temple/kokoro] worker error', ev.message);
      workerRef.current = w;
      return w;
    } catch (err) {
      console.warn('[temple/kokoro] worker spawn failed', err);
      return null;
    }
  }, []);

  const callWorker = useCallback(
    <T = boolean>(
      type: 'load' | 'speak',
      payload?: unknown,
      onChunk?: PendingHandler['onChunk'],
    ): Promise<T> => {
      const w = ensureWorker();
      if (!w) return Promise.reject(new Error('no worker'));
      const id = ++msgIdRef.current;
      return new Promise<T>((resolve, reject) => {
        pendingRef.current.set(id, {
          resolve: resolve as (ok: boolean) => void,
          reject,
          onChunk,
        });
        w.postMessage({ type, payload, id });
      });
    },
    [ensureWorker],
  );

  const warm = useCallback(() => {
    if (ready || loadStartedRef.current) return;
    loadStartedRef.current = true;
    callWorker('load')
      .then(() => setReady(true))
      .catch((err) => {
        console.warn('[temple/kokoro] load failed', err);
        loadStartedRef.current = false;
      });
  }, [ready, callWorker]);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const c = new Ctor();
    ctxRef.current = c;
    return c;
  }, []);

  const cancel = useCallback(() => {
    for (const s of sourcesRef.current) {
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    }
    sourcesRef.current = [];
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, onAmplitude?: (amp: number) => void): Promise<void> => {
      if (!text.trim()) return;
      warm();
      const c = ensureCtx();
      if (!c) return;
      // Browsers gate AudioContext until a user gesture — V key counts.
      if (c.state === 'suspended') {
        try { await c.resume(); } catch {}
      }

      cancel();

      // One analyser per utterance, fed by every chunk's BufferSource.
      const analyser = c.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(c.destination);

      let nextStartTime = c.currentTime + 0.05;
      let lastEndTime = c.currentTime;
      let rafId: number | null = null;

      const tick = (): void => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        // Normalise: typical speech sits around mean=40-90 in 0..255.
        const amp = Math.min(1, sum / buf.length / 110);
        onAmplitude?.(amp);
        if (c.currentTime < lastEndTime + 0.05) {
          rafId = requestAnimationFrame(tick);
        } else {
          onAmplitude?.(0);
          rafId = null;
        }
      };

      const onChunk = ({ audio, sampling_rate }: { audio: Float32Array; sampling_rate: number }): void => {
        if (!audio.length) return;
        const ab = c.createBuffer(1, audio.length, sampling_rate);
        // The transferred Float32Array is typed as ArrayBufferLike-backed in
        // TS 5.7+; copy into a fresh ArrayBuffer-backed view so AudioBuffer
        // .copyToChannel accepts it.
        const copy = new Float32Array(audio.length);
        copy.set(audio);
        ab.copyToChannel(copy, 0);
        const src = c.createBufferSource();
        src.buffer = ab;
        src.connect(analyser);
        const startAt = Math.max(c.currentTime, nextStartTime);
        src.start(startAt);
        nextStartTime = startAt + ab.duration;
        lastEndTime = nextStartTime;
        sourcesRef.current.push(src);
        src.onended = () => {
          sourcesRef.current = sourcesRef.current.filter((s) => s !== src);
        };
        if (rafId === null) rafId = requestAnimationFrame(tick);
      };

      setSpeaking(true);
      try {
        await callWorker('speak', { text }, onChunk);
        // Wait for last scheduled chunk to finish before resolving.
        const remaining = lastEndTime - c.currentTime;
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining * 1000 + 50));
      } catch (err) {
        console.warn('[temple/kokoro] speak failed', err);
      } finally {
        if (rafId !== null) cancelAnimationFrame(rafId);
        onAmplitude?.(0);
        setSpeaking(false);
      }
    },
    [warm, ensureCtx, cancel, callWorker],
  );

  useEffect(() => () => {
    cancel();
    workerRef.current?.terminate();
    workerRef.current = null;
    ctxRef.current?.close().catch(() => {});
  }, [cancel]);

  return { ready, speaking, warm, speak, cancel };
}
