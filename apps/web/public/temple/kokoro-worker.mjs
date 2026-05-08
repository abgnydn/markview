// Kokoro TTS worker for /temple. Adapted from the user's
// wonder/src/kokoro-worker.js — defensive voice fallback, fp32 on
// WebGPU with wasm fallback, pre-warm on first load.

import { env } from 'https://esm.sh/@huggingface/transformers@3';
env.useBrowserCache    = true;
env.useFSCache         = false;
env.useCustomCache     = false;
env.allowRemoteModels  = true;
env.allowLocalModels   = false;

import { KokoroTTS } from 'https://esm.sh/kokoro-js@1.2';

let tts = null;
let loadPromise = null;
const DEFAULT_VOICE = 'af_heart';

async function ensureLoaded() {
  if (tts) return tts;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let model = null;
    try {
      model = await KokoroTTS.from_pretrained(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        { dtype: 'fp32', device: 'webgpu' },
      );
      self.postMessage({ type: 'log', msg: 'loaded on webgpu (fp32)' });
    } catch (e1) {
      self.postMessage({
        type: 'log',
        msg: `webgpu fp32 failed: ${e1?.message || e1}, trying wasm fp32`,
      });
      model = await KokoroTTS.from_pretrained(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        { dtype: 'fp32' },
      );
      self.postMessage({ type: 'log', msg: 'loaded on wasm (fp32)' });
    }
    tts = model;
    let voiceList = [];
    try { voiceList = Object.keys(tts.voices || {}); } catch {}
    self.postMessage({ type: 'log', msg: `voices (${voiceList.length}): ${voiceList.join(', ')}` });
    // Pre-warm — first call pays the graph-compile cost; do it on a tiny string.
    try {
      const v =
        voiceList.includes(DEFAULT_VOICE)
          ? DEFAULT_VOICE
          : voiceList.find((x) => x.startsWith('af_')) || voiceList[0];
      await tts.generate('hi', { voice: v });
      self.postMessage({ type: 'log', msg: `pre-warmed with voice: ${v}` });
    } catch (e) {
      self.postMessage({ type: 'log', msg: `pre-warm failed: ${e?.message || e}` });
    }
    return tts;
  })();
  return loadPromise;
}

self.onmessage = async (e) => {
  const { type, payload, id } = e.data || {};

  if (type === 'load') {
    try {
      await ensureLoaded();
      self.postMessage({ type: 'loaded', id });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err?.message || String(err) });
    }
    return;
  }

  if (type === 'speak') {
    try {
      const t = await ensureLoaded();
      const text = (payload?.text || '').toString();
      const voiceList = Object.keys(t.voices || {});
      let voice = payload?.voice || DEFAULT_VOICE;
      if (!voiceList.includes(voice)) {
        voice = voiceList.find((v) => v.startsWith('af_')) || voiceList[0];
        self.postMessage({ type: 'log', msg: `voice fallback → "${voice}"` });
      }
      const speed = payload?.speed || 1.0;
      const result = await t.generate(text, { voice, speed });
      const arr = result?.audio;
      const sr = result?.sampling_rate || 24000;
      if (!arr) {
        self.postMessage({ type: 'error', id, error: 'no audio returned' });
        return;
      }
      self.postMessage(
        { type: 'audio-chunk', id, chunkIndex: 0, audio: arr, sampling_rate: sr },
        [arr.buffer],
      );
      self.postMessage({ type: 'audio-end', id });
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err?.message || String(err) });
    }
    return;
  }
};
