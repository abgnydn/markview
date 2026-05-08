'use client';

import { useEffect, useRef, useState } from 'react';
import { useVoice } from './use-voice';

export interface TempleSpeechInputProps {
  /** When the user submits, the parent decides what to do
   *  (echo to bubble, send to Claude, etc). */
  onSubmit: (text: string) => void;
  /** When true, the speech bridge is wired and live; we color the
   *  ring to indicate readiness. */
  bridgeReady?: boolean;
}

/**
 * Speech-input overlay — toggled by V. Esc closes. Enter submits.
 *
 * If the browser ships SpeechRecognition (Chromium), the mic auto-starts
 * when the box opens; live interim transcript streams into the input.
 * Mic button toggles dictation; the visitor can still type if they prefer.
 * Browsers without SR (Safari, Firefox) just see the type-only path.
 */
export function TempleSpeechInput({
  onSubmit,
  bridgeReady = false,
}: TempleSpeechInputProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const voice = useVoice({
    onUtterance: (finalText) => {
      // Always populate the input with the final transcript so the visitor
      // can edit / confirm before sending. Don't auto-submit — they may
      // want to add or correct.
      setText((curr) => (curr.trim() ? `${curr} ${finalText}` : finalText));
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea';
      // Don't toggle while the user is mid-sentence in another field.
      // T = harness convention; V kept as alias for muscle memory.
      const k = e.key.toLowerCase();
      if ((k === 't' || k === 'v') && !isTyping) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        setText('');
        voice.stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, voice]);

  // Don't auto-engage the mic when the input opens — Chrome's permission
  // prompt + the parent's per-render `voice` object identity caused a
  // tight start/error loop. Visitor explicitly clicks the mic button.
  // Just focus the text input on open and ensure mic is stopped on close.
  const stopRef = useRef(voice.stop);
  stopRef.current = voice.stop;
  useEffect(() => {
    if (!open) {
      stopRef.current();
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      stopRef.current();
    };
  }, [open]);

  if (!open) return <></>;

  const showText = text + (voice.interim ? (text ? ' ' : '') + voice.interim : '');
  const ringColor = bridgeReady
    ? voice.isListening
      ? 'rgba(255, 80, 120, 0.7)'
      : 'rgba(255, 215, 150, 0.55)'
    : 'rgba(180, 180, 220, 0.25)';

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 56,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = (text + (voice.interim ? ' ' + voice.interim : '')).trim();
          if (!t) return;
          voice.stop();
          onSubmit(t);
          setText('');
          setOpen(false);
        }}
        style={{
          pointerEvents: 'auto',
          minWidth: 420,
          maxWidth: 720,
          padding: '14px 20px',
          background: 'rgba(8, 6, 18, 0.78)',
          border: `1px solid ${ringColor}`,
          borderRadius: 999,
          backdropFilter: 'blur(14px)',
          boxShadow: voice.isListening
            ? '0 12px 60px rgba(255, 80, 120, 0.22)'
            : bridgeReady
              ? '0 12px 60px rgba(255, 215, 150, 0.22)'
              : '0 12px 60px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {voice.inputSupported && (
          <button
            type="button"
            onClick={() => (voice.isListening ? voice.stop() : voice.start())}
            title={voice.isListening ? 'stop dictation (esc)' : 'dictate'}
            style={{
              background: voice.isListening ? 'rgba(255, 80, 120, 0.18)' : 'transparent',
              border: `1px solid ${voice.isListening ? 'rgba(255, 80, 120, 0.6)' : 'rgba(255, 215, 150, 0.35)'}`,
              borderRadius: 999,
              color: voice.isListening ? '#ff7090' : '#ffe7c0',
              width: 30,
              height: 30,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              boxShadow: voice.isListening ? '0 0 18px rgba(255, 80, 120, 0.45)' : 'none',
              animation: voice.isListening ? 'temple-mic-pulse 1.4s ease-in-out infinite' : undefined,
            }}
          >
            <MicGlyph />
          </button>
        )}

        <span
          style={{
            color: bridgeReady ? '#ffe7c0' : 'rgba(232, 237, 246, 0.5)',
            fontFamily: 'ui-serif, "Iowan Old Style", Palatino, serif',
            fontStyle: 'italic',
            fontSize: 14,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {voice.isListening
            ? 'listening…'
            : voice.inputSupported
              ? bridgeReady ? 'speak to the face · or type' : 'speak (bridge coming)'
              : bridgeReady ? 'speak to the face' : 'speak (bridge coming)'}
        </span>
        <input
          ref={inputRef}
          value={showText}
          onChange={(e) => {
            // When the user types, replace the buffer (interim is just preview).
            setText(e.target.value);
          }}
          placeholder="…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 0,
            outline: 0,
            color: voice.interim ? 'rgba(251, 233, 196, 0.65)' : '#fbe9c4',
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
            fontSize: 16,
            letterSpacing: '0.01em',
          }}
        />
        <button
          type="submit"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 215, 150, 0.35)',
            borderRadius: 999,
            color: '#ffe7c0',
            padding: '4px 14px',
            fontFamily: 'inherit',
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          send ⏎
        </button>
      </form>
      <style jsx>{`
        @keyframes temple-mic-pulse {
          0%, 100% { box-shadow: 0 0 18px rgba(255, 80, 120, 0.45); }
          50% { box-shadow: 0 0 28px rgba(255, 80, 120, 0.85); }
        }
      `}</style>
    </div>
  );
}

function MicGlyph(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}
