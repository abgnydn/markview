'use client';

import React, { useEffect, useRef } from 'react';

interface Chapter {
  align: 'center' | 'left' | 'right';
  kicker: string | null;
  title: string;
  body: string;
}

const CHAPTERS: Chapter[] = [
  {
    align: 'center',
    kicker: null,
    title: 'Your second brain,\non every tab.',
    body: "A browser assistant that reads what you're reading, searches your own vault, and saves what matters — powered by a local LLM and a zero-upload MCP bridge. Built for solo researchers who keep their own notes.",
  },
  {
    align: 'right',
    kicker: '01 · Chapter',
    title: 'Brain on every page.',
    body: 'A Chrome extension drops a floating assistant onto GitHub PRs, arxiv papers, Claude chats, Slack threads — any site. Highlight text, ask a question, and the answer streams back in-page, grounded in your own vault.',
  },
  {
    align: 'left',
    kicker: '02 · Chapter',
    title: 'Grounded in your vault.',
    body: "Context is pulled from your Obsidian notes via TF-IDF relevance — the more you write, the sharper the answers. Save anything you're reading back into the vault with one click. Your notes become the model's long-term memory.",
  },
  {
    align: 'center',
    kicker: '03 · Chapter',
    title: 'Local LLM.\nZero uploads.',
    body: 'Inference runs on your own machine via Ollama. Your notes never leave your laptop. When cloud agents need access, a WebRTC bridge hands them only what you approve — nothing persists, nothing lands on a server.',
  },
  {
    align: 'center',
    kicker: '04 · Chapter',
    title: '25 composable\nMCP tools.',
    body: 'Search, headings, tables, Mermaid, math, readability, rename-with-link-refactor, validate-workspace. Your vault becomes a programmable surface any MCP-compatible agent can drive — from Claude to Cursor to your own scripts.',
  },
];

export function LandingCinema() {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const innerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const vh = window.innerHeight;
      sectionRefs.current.forEach((sec, i) => {
        const inner = innerRefs.current[i];
        if (!sec || !inner) return;
        const rect = sec.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - vh / 2) / vh;
        const op = Math.max(0, 1 - dist * 1.9);
        inner.style.opacity = String(op);
        inner.style.transform = `translateY(${(1 - op) * 32}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {CHAPTERS.map((c, i) => {
        const isCenter = c.align === 'center';
        const isRight = c.align === 'right';

        const flexJustify = isCenter ? 'center' : isRight ? 'flex-end' : 'flex-start';
        const textAlign = isCenter ? 'center' : 'left';
        const maxW = isCenter ? 'min(780px, 92vw)' : 'min(560px, 46vw)';

        return (
          <section
            key={i}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            data-scene={`chapter-${i}`}
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: flexJustify,
              padding: isCenter ? '0 8vw' : '0 6vw',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <div
              ref={(el) => {
                innerRefs.current[i] = el;
              }}
              style={{
                maxWidth: maxW,
                width: '100%',
                textAlign,
                opacity: 0,
                transform: 'translateY(32px)',
                willChange: 'opacity, transform',
              }}
            >
              {c.kicker && (
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '12px',
                    letterSpacing: '0.3em',
                    color: 'rgba(103, 232, 249, 0.9)',
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                  }}
                >
                  {c.kicker}
                </div>
              )}
              <h2
                style={{
                  fontSize: 'clamp(38px, 6.6vw, 82px)',
                  lineHeight: 1.02,
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  margin: 0,
                  backgroundImage:
                    'linear-gradient(135deg, #ffffff 0%, #bae6fd 45%, #c4b5fd 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  whiteSpace: 'pre-line',
                  textShadow: '0 0 40px rgba(103, 232, 249, 0.12)',
                }}
              >
                {c.title}
              </h2>
              <p
                style={{
                  marginTop: '24px',
                  marginBottom: 0,
                  fontSize: 'clamp(15px, 1.25vw, 19px)',
                  lineHeight: 1.6,
                  color: 'rgba(226, 232, 240, 0.9)',
                  ...(isCenter
                    ? { marginLeft: 'auto', marginRight: 'auto', maxWidth: '620px' }
                    : { maxWidth: '540px' }),
                  textShadow: '0 1px 20px rgba(0, 0, 0, 0.45)',
                }}
              >
                {c.body}
              </p>
            </div>
          </section>
        );
      })}
    </>
  );
}
