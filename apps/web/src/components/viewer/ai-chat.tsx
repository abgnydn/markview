// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, Square, FileText, Cpu, Cloud } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import {
  answerQuestionInWorkspace,
  warmGenerative,
  onGenStatus,
  isGenerativeOptedIn,
  setGenerativeOptedIn,
  type GenStatus,
  type ChatMode,
} from '@/lib/generation';

const MODE_KEY = 'markview-ai-chat-mode';
function readMode(): ChatMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'local' ? 'local' : 'cloud';
  } catch { return 'cloud'; }
}

interface AiChatProps {
  onClose: () => void;
}

interface Turn {
  id: string;
  question: string;
  answer: string;          // streams in
  citations: Array<{ fileId: string; preview: string; score: number }>;
  status: 'pending' | 'done' | 'error';
  error?: string;
}

/**
 * AiChat — workspace-grounded Q&A panel.
 *
 * Sits as a right-anchored drawer when open. Each turn:
 *  1. User types a question
 *  2. We embed it, pull top-K paragraphs from the embedding store
 *  3. Stuff into a system prompt as numbered context [1]..[N]
 *  4. SmolLM2 answers with citations
 *  5. Citations link to their source file
 *
 * First use shows an opt-in prompt — generative model is ~220 MB and
 * downloads once. After that the panel just works.
 */
export function AiChat({ onClose }: AiChatProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const files = useWorkspaceStore((s) => s.files);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);

  // R17 — Per-workspace chat memory. Each workspace gets its own
  // localStorage-backed thread keyed by workspace id, so the thinking
  // you did in `research/` survives a context switch to `posts/` and
  // is right there when you come back. We persist only finished turns
  // (no in-flight tokens) to keep the JSON small and resumable.
  const memoryKey = activeWorkspaceId ? `mv-ai-chat-${activeWorkspaceId}` : '';
  const [turns, setTurns] = useState<Turn[]>(() => {
    if (typeof window === 'undefined' || !memoryKey) return [];
    try {
      const raw = localStorage.getItem(memoryKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as Turn[] : [];
    } catch { return []; }
  });
  // Reload thread when the active workspace changes.
  useEffect(() => {
    if (!memoryKey) { setTurns([]); return; }
    try {
      const raw = localStorage.getItem(memoryKey);
      setTurns(raw ? (JSON.parse(raw) as Turn[]) : []);
    } catch { setTurns([]); }
  }, [memoryKey]);
  // Persist completed turns on every change.
  useEffect(() => {
    if (!memoryKey) return;
    const finished = turns.filter((t) => t.status === 'done');
    try { localStorage.setItem(memoryKey, JSON.stringify(finished)); } catch { /* quota */ }
  }, [turns, memoryKey]);
  const [input, setInput] = useState('');
  const [mode, setModeState] = useState<ChatMode>(() => readMode());
  const setMode = (m: ChatMode) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* quota */ }
    if (m === 'local' && isGenerativeOptedIn()) void warmGenerative();
  };
  const [optedIn, setOptedIn] = useState<boolean>(() => isGenerativeOptedIn());
  const [status, setStatus] = useState<GenStatus>({ state: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => onGenStatus(setStatus), []);

  useEffect(() => {
    // Warm SmolLM2 only if the user is in local mode AND opted in.
    if (mode === 'local' && optedIn) void warmGenerative();
  }, [optedIn, mode]);

  useEffect(() => {
    // Esc to close.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // Auto-scroll to bottom as new tokens land.
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  const handleOptIn = () => {
    setGenerativeOptedIn(true);
    setOptedIn(true);
    void warmGenerative();
  };

  const handleAsk = async () => {
    const question = input.trim();
    if (!question || !activeWorkspaceId) return;
    setInput('');
    const id = crypto.randomUUID();
    setTurns((t) => [...t, { id, question, answer: '', citations: [], status: 'pending' }]);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const result = await answerQuestionInWorkspace(activeWorkspaceId, question, {
        topK: mode === 'cloud' ? 8 : 4,
        mode,
        signal: ac.signal,
        onToken: (_chunk, full) => {
          setTurns((all) => all.map((t) => (t.id === id ? { ...t, answer: full } : t)));
        },
      });
      setTurns((all) => all.map((t) => (t.id === id
        ? { ...t, answer: result.answer || t.answer, citations: result.citations, status: 'done' }
        : t)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTurns((all) => all.map((t) => (t.id === id ? { ...t, status: 'error', error: msg } : t)));
    } finally {
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleAsk();
    }
  };

  const busy = turns.some((t) => t.status === 'pending');
  const loadingPct = status.state === 'loading' && typeof status.progress === 'number'
    ? Math.round(status.progress)
    : null;

  return (
    <div className="ai-chat-overlay" onClick={onClose}>
      <aside className="ai-chat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-chat-header">
          <Sparkles size={13} className="ai-chat-header-icon" />
          <span className="ai-chat-title">Chat with this workspace</span>
          <div className="ai-chat-mode-toggle" role="group" aria-label="engine">
            <button
              type="button"
              className={`ai-chat-mode-btn${mode === 'cloud' ? ' is-active' : ''}`}
              onClick={() => setMode('cloud')}
              title="Cloudflare Workers AI · Llama-3.3-70B · free, fast, in the cloud"
            >
              <Cloud size={11} /> cloud
            </button>
            <button
              type="button"
              className={`ai-chat-mode-btn${mode === 'local' ? ' is-active' : ''}`}
              onClick={() => setMode('local')}
              title="SmolLM2-360M · in your browser tab · private, offline, lower quality"
            >
              <Cpu size={11} /> local
            </button>
          </div>
          <button className="ai-chat-close" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        {mode === 'local' && !optedIn ? (
          <div className="ai-chat-opt-in">
            <div className="ai-chat-opt-in-icon"><Cpu size={20} /></div>
            <h3 className="ai-chat-opt-in-title">Local AI, your machine</h3>
            <p className="ai-chat-opt-in-body">
              Chat is powered by <code>SmolLM2-360M</code> running entirely
              in your browser tab. No cloud, no API keys. One-time download
              of about <strong>220 MB</strong>, cached forever after.
            </p>
            <p className="ai-chat-opt-in-body ai-chat-opt-in-body-quiet">
              Answers are grounded in your workspace via semantic retrieval —
              the model only sees relevant excerpts of your notes.
            </p>
            <button className="ai-chat-opt-in-btn" onClick={handleOptIn}>
              Download &amp; enable
            </button>
          </div>
        ) : mode === 'local' && status.state === 'loading' ? (
          <div className="ai-chat-loading">
            <Cpu size={18} />
            <span>Loading SmolLM2…</span>
            {loadingPct !== null && (
              <>
                <div className="ai-chat-loading-bar"><div style={{ width: `${loadingPct}%` }} /></div>
                <span className="ai-chat-loading-pct">{loadingPct}%</span>
              </>
            )}
            <span className="ai-chat-loading-hint">One-time download. Cached after.</span>
          </div>
        ) : mode === 'local' && status.state === 'failed' ? (
          <div className="ai-chat-error">
            <strong>Could not load the local model.</strong>
            <p>{status.error}</p>
            <button
              className="ai-chat-opt-in-btn"
              onClick={() => {
                setOptedIn(false);
                setGenerativeOptedIn(false);
                setMode('cloud');
              }}
            >
              Switch to cloud
            </button>
          </div>
        ) : (
          <>
            <div className="ai-chat-turns" ref={scrollRef}>
              {turns.length === 0 && (
                <div className="ai-chat-empty">
                  <p>Ask the workspace anything.</p>
                  <ul>
                    <li>What did I conclude about X?</li>
                    <li>Summarize the notes about Y</li>
                    <li>Where did I write about Z?</li>
                  </ul>
                </div>
              )}
              {turns.map((t) => (
                <div key={t.id} className="ai-chat-turn">
                  <div className="ai-chat-q">
                    <span className="ai-chat-label">You</span>
                    <div className="ai-chat-q-text">{t.question}</div>
                  </div>
                  <div className="ai-chat-a">
                    <span className="ai-chat-label">Markview</span>
                    <div className={`ai-chat-a-text${t.status === 'pending' ? ' is-pending' : ''}`}>
                      {t.answer || (t.status === 'pending' ? <span className="ai-chat-cursor" /> : <em>(empty)</em>)}
                    </div>
                    {t.citations.length > 0 && (
                      <ul className="ai-chat-citations">
                        {t.citations.map((c, i) => {
                          const file = files.find((f) => f.id === c.fileId);
                          const label = file?.displayName || file?.filename || 'untitled';
                          return (
                            <li key={`${c.fileId}-${i}`}>
                              <button
                                className="ai-chat-citation"
                                onClick={() => { void setActiveFile(c.fileId); onClose(); }}
                                title={c.preview}
                              >
                                <FileText size={10} />
                                <span>[{i + 1}]</span>
                                <span className="ai-chat-citation-name">{label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {t.status === 'error' && (
                      <div className="ai-chat-turn-error">{t.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="ai-chat-input-row">
              <textarea
                ref={inputRef}
                className="ai-chat-input"
                placeholder="Ask your workspace…  ↵ to send · ⇧↵ for newline"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={busy}
              />
              {busy ? (
                <button className="ai-chat-stop" onClick={handleStop} title="Stop">
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="ai-chat-send"
                  onClick={() => void handleAsk()}
                  disabled={!input.trim()}
                  title="Send (↵)"
                >
                  <Send size={13} />
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
