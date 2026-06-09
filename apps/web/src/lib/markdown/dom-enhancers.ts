// SPDX-License-Identifier: Apache-2.0

/**
 * DOM enhancers — progressive-enhancement passes applied to rendered
 * markdown after it lands in the DOM. Each is a pure function
 * `(root) => cleanup | void`: it queries inside `root`, wires
 * listeners / injects nodes, and returns a teardown (or nothing if it
 * no-ops). MarkdownRenderer runs them all in one effect and collects
 * the cleanups.
 *
 * These were previously eight separate useEffect blocks inside the
 * 1000-line MarkdownRenderer; extracting them keeps that component
 * focused on rendering + the prop-coupled passes (headings, internal-
 * link nav, mermaid, katex) and makes each enhancer independently
 * readable. Behavior is byte-identical to the inline versions.
 *
 * All are idempotent where it matters (guard classes / data attrs) so
 * re-running on the same DOM doesn't double-wire.
 */

import { getAssetUrl } from '@/lib/assets';

type Cleanup = (() => void) | void;

// ── Local image assets — swap `asset:<id>` srcs for object URLs ──────────
export function resolveAssets(root: HTMLElement): Cleanup {
  const imgs = root.querySelectorAll<HTMLImageElement>('img[src^="asset:"]');
  imgs.forEach((img) => {
    const id = (img.getAttribute('src') || '').slice('asset:'.length);
    if (!id) return;
    void getAssetUrl(id).then((url) => {
      if (url) {
        img.src = url;
      } else {
        img.alt = img.alt || 'image not found';
        img.style.opacity = '0.4';
      }
    });
  });
}

// ── Paragraph scroll-reveal ─────────────────────────────────────────────
export function revealOnScroll(root: HTMLElement): Cleanup {
  if (typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.querySelectorAll('p,li,blockquote,pre,table')
        .forEach((el) => el.classList.add('mv-revealed'));
    return;
  }
  const targets = root.querySelectorAll('p,li,blockquote,pre,table');
  if (!('IntersectionObserver' in window) || targets.length === 0) {
    targets.forEach((el) => el.classList.add('mv-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('mv-revealed');
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  targets.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

// ── Margin footnotes ────────────────────────────────────────────────────
export function marginFootnotes(root: HTMLElement): Cleanup {
  if (window.innerWidth < 1180) return;
  const refs = root.querySelectorAll<HTMLAnchorElement>('a[href^="#user-content-fn-"], a.footnote-ref');
  if (refs.length === 0) return;
  let pop: HTMLDivElement | null = null;
  let popScrollCleanup: (() => void) | null = null;
  let pinned = false;
  let hoverTimer: number | null = null;
  let hideTimer: number | null = null;

  const closePop = () => {
    if (pop) pop.classList.remove('mv-fn-margin-show');
    popScrollCleanup?.();
    popScrollCleanup = null;
    const old = pop;
    pop = null;
    pinned = false;
    window.setTimeout(() => old?.remove(), 220);
  };

  const place = (link: HTMLAnchorElement, isPin: boolean) => {
    const href = link.getAttribute('href') || '';
    const targetId = href.replace(/^#/, '');
    const target = document.getElementById(targetId);
    if (!target) return;
    const clone = target.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('a.data-footnote-backref, a.footnote-back').forEach((b) => b.remove());
    closePop();
    pop = document.createElement('div');
    pop.className = 'mv-fn-margin';
    pop.innerHTML = clone.innerHTML;
    document.body.appendChild(pop);
    const rect = link.getBoundingClientRect();
    const content = root.closest('.viewer-content') as HTMLElement | null;
    const right = content
      ? Math.max(20, window.innerWidth - content.getBoundingClientRect().right - 18)
      : 32;
    pop.style.right = `${right}px`;
    pop.style.top = `${rect.top}px`;
    pop.style.maxWidth = `${Math.min(280, right - 24)}px`;
    const num = link.textContent?.replace(/[^\d]/g, '') || '';
    if (num) {
      const tag = document.createElement('span');
      tag.className = 'mv-fn-margin-num';
      tag.textContent = num;
      pop.prepend(tag);
    }
    const main = root.closest('.viewer-main') as HTMLElement | null;
    const onScroll = () => {
      if (!pop || !link.isConnected) return;
      pop.style.top = `${link.getBoundingClientRect().top}px`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    main?.addEventListener('scroll', onScroll, { passive: true });
    popScrollCleanup = () => {
      window.removeEventListener('scroll', onScroll);
      main?.removeEventListener('scroll', onScroll);
    };
    requestAnimationFrame(() => pop?.classList.add('mv-fn-margin-show'));
    pinned = isPin;
  };

  const onEnter = (e: Event) => {
    const link = e.currentTarget as HTMLAnchorElement;
    if (hideTimer !== null) { window.clearTimeout(hideTimer); hideTimer = null; }
    if (pinned) return;
    hoverTimer = window.setTimeout(() => place(link, false), 220);
  };
  const onLeave = () => {
    if (hoverTimer !== null) { window.clearTimeout(hoverTimer); hoverTimer = null; }
    if (pinned) return;
    hideTimer = window.setTimeout(closePop, 240);
  };
  const onClick = (e: Event) => {
    e.preventDefault();
    const link = e.currentTarget as HTMLAnchorElement;
    place(link, true);
  };
  const onOutside = (e: MouseEvent) => {
    if (!pop) return;
    if (pop.contains(e.target as Node)) return;
    if ((e.target as HTMLElement)?.closest('a[href^="#user-content-fn-"], a.footnote-ref')) return;
    closePop();
  };
  refs.forEach((r) => {
    r.addEventListener('mouseenter', onEnter);
    r.addEventListener('mouseleave', onLeave);
    r.addEventListener('click', onClick);
  });
  document.addEventListener('mousedown', onOutside);
  return () => {
    refs.forEach((r) => {
      r.removeEventListener('mouseenter', onEnter);
      r.removeEventListener('mouseleave', onLeave);
      r.removeEventListener('click', onClick);
    });
    document.removeEventListener('mousedown', onOutside);
    popScrollCleanup?.();
    pop?.remove();
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    if (hideTimer !== null) window.clearTimeout(hideTimer);
  };
}

// ── ⌘-click wikilink → fly-in pane ──────────────────────────────────────
export function wikilinkFlyIn(root: HTMLElement): Cleanup {
  const links = root.querySelectorAll<HTMLAnchorElement>('a.internal-link');
  if (links.length === 0) return;
  let pane: HTMLDivElement | null = null;
  let backdrop: HTMLDivElement | null = null;
  const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const close = () => {
    if (!pane) return;
    pane.classList.remove('mv-flyin-show');
    const old = pane;
    const olda = backdrop;
    pane = null;
    backdrop = null;
    window.setTimeout(() => { old.remove(); olda?.remove(); }, 400);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const open = async (filename: string) => {
    close();
    backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
      position: 'fixed', inset: '0', zIndex: '5',
      background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(2px)',
    });
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);
    pane = document.createElement('div');
    pane.className = 'mv-flyin';
    pane.innerHTML = `<div class="mv-flyin-title">${escapeHtml(filename)}</div><div>loading…</div>`;
    document.body.appendChild(pane);
    requestAnimationFrame(() => pane?.classList.add('mv-flyin-show'));
    document.addEventListener('keydown', onKey);
    try {
      const { db } = await import('@/lib/storage/db');
      const lookup = filename.replace(/^[./]+/, '');
      const f = await db.files.where('filename').equalsIgnoreCase(lookup)
        .or('filename').equalsIgnoreCase(`${lookup}.md`)
        .first();
      if (!pane) return;
      if (!f) {
        pane.innerHTML = `<div class="mv-flyin-title">${escapeHtml(filename)}</div><em>not found in this workspace</em>`;
        return;
      }
      const stripped = f.content.replace(/^---[\s\S]*?---\n+/, '');
      pane.innerHTML = `<div class="mv-flyin-title">${escapeHtml(f.displayName || f.filename)}</div><pre style="white-space:pre-wrap;font:inherit;margin:0">${escapeHtml(stripped.slice(0, 8000))}</pre>`;
    } catch {
      if (pane) pane.innerHTML = `<div class="mv-flyin-title">${escapeHtml(filename)}</div><em>failed to load</em>`;
    }
  };
  const onClick = (e: MouseEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    e.stopPropagation();
    const link = e.currentTarget as HTMLAnchorElement;
    const filename = (link.getAttribute('href') || '').replace(/^[./]+/, '');
    void open(filename);
  };
  links.forEach((l) => l.addEventListener('click', onClick));
  return () => {
    links.forEach((l) => l.removeEventListener('click', onClick));
    close();
  };
}

// ── Long code-block collapse ────────────────────────────────────────────
export function collapseLongCode(root: HTMLElement): Cleanup {
  const blocks = root.querySelectorAll<HTMLPreElement>('pre');
  blocks.forEach((pre) => {
    if (pre.classList.contains('mv-code-collapsible')) return;
    const text = pre.textContent || '';
    const lines = text.split('\n').length;
    if (lines <= 20) return;
    pre.classList.add('mv-code-collapsible');
    const btn = document.createElement('button');
    btn.className = 'mv-code-expand-btn';
    btn.type = 'button';
    btn.textContent = `+ ${lines - 20} more lines`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = pre.classList.toggle('mv-code-expanded');
      btn.textContent = expanded ? 'collapse' : `+ ${lines - 20} more lines`;
    });
    pre.appendChild(btn);
  });
}

// ── Image ken-burns lightbox ────────────────────────────────────────────
export function imageLightbox(root: HTMLElement): Cleanup {
  const imgs = root.querySelectorAll<HTMLImageElement>('img');
  if (imgs.length === 0) return;
  let overlay: HTMLDivElement | null = null;
  const close = () => {
    overlay?.remove();
    overlay = null;
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const onClick = (e: MouseEvent) => {
    const srcImg = (e.currentTarget as HTMLImageElement).src;
    const alt = (e.currentTarget as HTMLImageElement).alt;
    if (!srcImg) return;
    e.preventDefault();
    close();
    overlay = document.createElement('div');
    overlay.className = 'mv-lightbox-overlay';
    const img = document.createElement('img');
    img.className = 'mv-lightbox-img';
    img.src = srcImg;
    img.alt = alt;
    overlay.appendChild(img);
    overlay.addEventListener('click', close);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
  };
  imgs.forEach((i) => i.addEventListener('click', onClick));
  return () => {
    imgs.forEach((i) => i.removeEventListener('click', onClick));
    close();
  };
}

// ── Heading anchors ─────────────────────────────────────────────────────
export function headingAnchors(root: HTMLElement): Cleanup {
  const headings = root.querySelectorAll<HTMLHeadingElement>('h1[id], h2[id], h3[id]');
  headings.forEach((h) => {
    if (h.querySelector('.mv-heading-anchor')) return;
    const a = document.createElement('a');
    a.className = 'mv-heading-anchor';
    a.textContent = '#';
    a.href = `#${h.id}`;
    a.title = 'Copy link to this heading';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const url = `${window.location.origin}${window.location.pathname}#${h.id}`;
      void navigator.clipboard.writeText(url).then(() => {
        window.dispatchEvent(new CustomEvent('markview:toast', {
          detail: { message: 'heading link copied' },
        }));
      }).catch(() => { /* clipboard rejected */ });
    });
    h.insertBefore(a, h.firstChild);
  });
}

// ── Audio waveform players ──────────────────────────────────────────────
export function audioWaveforms(root: HTMLElement): Cleanup {
  const audios = root.querySelectorAll<HTMLAudioElement>('audio:not([data-mv-enhanced])');
  // The per-audio canvas/element listeners die with their DOM nodes on
  // re-render, but the window 'resize' listener does not — collect those
  // so they're removed instead of leaking one per render forever.
  const cleanups: Array<() => void> = [];
  audios.forEach((audio) => {
    audio.setAttribute('data-mv-enhanced', '1');
    audio.controls = false;
    audio.preload = 'metadata';
    const src = audio.currentSrc || audio.querySelector('source')?.src || audio.src;
    if (!src) return;
    const wrap = document.createElement('div');
    wrap.className = 'mv-audio-wrap';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'mv-audio-play';
    play.textContent = '▶';
    const canvas = document.createElement('canvas');
    canvas.className = 'mv-audio-canvas';
    const time = document.createElement('span');
    time.className = 'mv-audio-time';
    time.textContent = '0:00';
    wrap.append(play, canvas, time);
    audio.parentNode?.insertBefore(wrap, audio);
    audio.style.display = 'none';

    let peaks: Float32Array | null = null;
    const drawWaveform = () => {
      const ctx2 = canvas.getContext('2d');
      if (!ctx2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, w, h);
      const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      const bars = Math.floor(w / 2);
      for (let i = 0; i < bars; i++) {
        const x = i * 2;
        const peak = peaks ? peaks[Math.floor((i / bars) * peaks.length)] ?? 0.1 : 0.3;
        const barH = Math.max(2, peak * h * 0.9);
        ctx2.fillStyle = (i / bars) < progress
          ? 'rgba(185, 164, 255, 0.85)'
          : 'rgba(255, 255, 255, 0.18)';
        ctx2.fillRect(x, (h - barH) / 2, 1.4, barH);
      }
    };

    const decode = async () => {
      try {
        const resp = await fetch(src);
        const buf = await resp.arrayBuffer();
        const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        const ac = new AC();
        const decoded = await ac.decodeAudioData(buf);
        const ch = decoded.getChannelData(0);
        const samples = 200;
        const block = Math.floor(ch.length / samples);
        const out = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
          let max = 0;
          for (let j = 0; j < block; j++) {
            const v = Math.abs(ch[i * block + j] ?? 0);
            if (v > max) max = v;
          }
          out[i] = max;
        }
        peaks = out;
        drawWaveform();
        void ac.close();
      } catch { /* decode failed — leave placeholder bars */ }
    };

    const fmt = (s: number) => {
      if (!isFinite(s)) return '0:00';
      const m = Math.floor(s / 60), r = Math.floor(s % 60);
      return `${m}:${r.toString().padStart(2, '0')}`;
    };

    play.addEventListener('click', () => {
      if (audio.paused) {
        if (!peaks) void decode();
        void audio.play();
        play.textContent = '❚❚';
      } else {
        audio.pause();
        play.textContent = '▶';
      }
    });
    canvas.addEventListener('click', (e) => {
      if (!audio.duration) return;
      const r = canvas.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
      drawWaveform();
    });
    audio.addEventListener('timeupdate', () => {
      time.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
      drawWaveform();
    });
    audio.addEventListener('loadedmetadata', () => {
      time.textContent = `0:00 / ${fmt(audio.duration)}`;
      drawWaveform();
    });
    audio.addEventListener('ended', () => { play.textContent = '▶'; });
    requestAnimationFrame(drawWaveform);
    window.addEventListener('resize', drawWaveform);
    cleanups.push(() => window.removeEventListener('resize', drawWaveform));
  });
  return () => cleanups.forEach((c) => c());
}

// ── External link tooltips (host + favicon) ─────────────────────────────
export function externalLinkTooltips(root: HTMLElement): Cleanup {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href^="http://"], a[href^="https://"]');
  if (links.length === 0) return;
  let tip: HTMLDivElement | null = null;
  let hoverTimer: number | null = null;
  const close = () => {
    tip?.classList.remove('mv-link-tooltip-show');
    const old = tip;
    tip = null;
    window.setTimeout(() => old?.remove(), 220);
  };
  const onEnter = (e: Event) => {
    const link = e.currentTarget as HTMLAnchorElement;
    let host = '';
    try { host = new URL(link.href).host; } catch { return; }
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      close();
      tip = document.createElement('div');
      tip.className = 'mv-link-tooltip';
      const img = document.createElement('img');
      img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      tip.appendChild(img);
      tip.appendChild(document.createTextNode(host));
      document.body.appendChild(tip);
      const rect = link.getBoundingClientRect();
      const left = Math.min(window.innerWidth - 280, Math.max(8, rect.left));
      tip.style.left = `${left}px`;
      tip.style.top = `${rect.bottom + 6}px`;
      requestAnimationFrame(() => tip?.classList.add('mv-link-tooltip-show'));
    }, 220);
  };
  const onLeave = () => {
    if (hoverTimer !== null) { window.clearTimeout(hoverTimer); hoverTimer = null; }
    close();
  };
  links.forEach((l) => {
    l.addEventListener('mouseenter', onEnter);
    l.addEventListener('mouseleave', onLeave);
  });
  return () => {
    links.forEach((l) => {
      l.removeEventListener('mouseenter', onEnter);
      l.removeEventListener('mouseleave', onLeave);
    });
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    close();
  };
}

/** All self-contained enhancers, in apply order. */
export const DOM_ENHANCERS = [
  resolveAssets,
  revealOnScroll,
  marginFootnotes,
  wikilinkFlyIn,
  collapseLongCode,
  imageLightbox,
  headingAnchors,
  audioWaveforms,
  externalLinkTooltips,
] as const;
