'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Browser Web Speech API wrapper. SpeechRecognition for input,
 * speechSynthesis for output. Both are best-effort:
 *   - SpeechRecognition is Chromium-only as `webkitSpeechRecognition`.
 *   - speechSynthesis is broadly supported but voice quality varies.
 *
 * Returned `isListening` reflects mic state. `interim` is the live
 * partial transcript (rebuilt on each result event). `final` accumulates
 * the committed transcript across pauses until you explicitly stop.
 */

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | SpeechRecognitionCtor
    | undefined;
  return ctor ?? null;
}

export interface UseVoiceOpts {
  /** Called when the user stops speaking (final transcript only).
   *  Won't fire if the transcript is empty / whitespace. */
  onUtterance: (text: string) => void;
  /** Locale for SpeechRecognition. Defaults to 'en-US'. */
  lang?: string;
}

export interface UseVoiceApi {
  /** True if SpeechRecognition is available in this browser. */
  inputSupported: boolean;
  /** True if speechSynthesis is available. */
  outputSupported: boolean;
  /** True while the mic is active. */
  isListening: boolean;
  /** Live partial transcript while listening. */
  interim: string;
  /** Start the mic. Idempotent. */
  start: () => void;
  /** Stop the mic. The current accumulated transcript is sent
   *  to onUtterance via the onend handler. */
  stop: () => void;
  /**
   * Speak a string. Returns a token; the tracker callback reports
   * { type: 'word' | 'end' } so the caller can drive the mouth
   * uniform. Cancels any previous in-flight utterance.
   */
  speak: (
    text: string,
    onTrack?: (ev: { type: 'word' | 'end' }) => void,
  ) => void;
  /** Stop any in-flight TTS. */
  cancelSpeech: () => void;
}

export function useVoice({ onUtterance, lang = 'en-US' }: UseVoiceOpts): UseVoiceApi {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef('');
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  // Cooldown guard — if start() is called again within 800ms of the
  // previous attempt erroring out, skip. Prevents the tight permission-
  // rejection loop the previous version was hitting.
  const lastStartRef = useRef(0);
  const lastErrorRef = useRef(0);

  const inputSupported = typeof window !== 'undefined' && getRecognitionCtor() !== null;
  const outputSupported =
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

  const start = useCallback(() => {
    if (!inputSupported) return;
    if (recognitionRef.current) return;
    const now = performance.now();
    // If the last attempt errored within the past 800ms, back off — this
    // is what caused the rapid-fire permission-rejection loop.
    if (now - lastErrorRef.current < 800) return;
    if (now - lastStartRef.current < 200) return;
    lastStartRef.current = now;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    finalRef.current = '';
    setInterim('');
    r.onresult = (e) => {
      let interimTxt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const t = result[0].transcript;
        if (result.isFinal) {
          finalRef.current += (finalRef.current ? ' ' : '') + t.trim();
        } else {
          interimTxt += t;
        }
      }
      setInterim(interimTxt);
    };
    r.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      const t = finalRef.current.trim();
      setInterim('');
      finalRef.current = '';
      if (t) onUtteranceRef.current(t);
    };
    r.onerror = (ev) => {
      lastErrorRef.current = performance.now();
      // 'not-allowed' = user denied or hasn't responded to permission yet.
      // 'no-speech' / 'aborted' = benign. Anything else is worth a console.
      if (ev.error && ev.error !== 'no-speech' && ev.error !== 'aborted') {
        console.warn('[temple/voice] recognition error', ev.error);
      }
    };
    try {
      r.start();
      recognitionRef.current = r;
      setIsListening(true);
    } catch (err) {
      lastErrorRef.current = performance.now();
      console.warn('[temple/voice] failed to start', err);
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, [inputSupported, lang]);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try { r.stop(); } catch {}
  }, []);

  // Tear down on unmount.
  useEffect(() => () => {
    const r = recognitionRef.current;
    if (r) try { r.abort(); } catch {}
  }, []);

  const speak = useCallback(
    (text: string, onTrack?: (ev: { type: 'word' | 'end' }) => void) => {
      if (!outputSupported) {
        onTrack?.({ type: 'end' });
        return;
      }
      try { window.speechSynthesis.cancel(); } catch {}
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 0.85;
      u.volume = 1;
      u.lang = lang;
      // Pick a deeper voice if available — temple voice should not be peppy.
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /daniel|alex|fred|ralph/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith(lang.slice(0, 2)) && /male/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ??
        null;
      if (preferred) u.voice = preferred;
      u.onboundary = (ev) => {
        if (ev.name === 'word') onTrack?.({ type: 'word' });
      };
      u.onend = () => onTrack?.({ type: 'end' });
      u.onerror = () => onTrack?.({ type: 'end' });
      window.speechSynthesis.speak(u);
    },
    [outputSupported, lang],
  );

  const cancelSpeech = useCallback(() => {
    if (!outputSupported) return;
    try { window.speechSynthesis.cancel(); } catch {}
  }, [outputSupported]);

  return {
    inputSupported,
    outputSupported,
    isListening,
    interim,
    start,
    stop,
    speak,
    cancelSpeech,
  };
}
