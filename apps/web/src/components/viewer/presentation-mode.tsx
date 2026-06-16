
import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import {
  ChevronLeft, ChevronRight, X, Maximize2, Minimize2, LayoutGrid, Timer, Play, Pause,
  Pencil, Palette, Printer, Keyboard, StickyNote, MonitorPlay, Search, Film, Image, Link2, Volume2, VolumeX,
  SkipBack, SkipForward, Eraser, Undo2, Highlighter, Download, Repeat, BarChart3, Captions,
} from 'lucide-react';
import { toPng } from 'html-to-image';

interface PresentationModeProps {
  html: string;
  onClose: () => void;
}

type DeckTheme = 'midnight' | 'aurora' | 'sand' | 'noir' | 'forest' | 'paper' | 'contrast';
type Aspect = '16x9' | '16x10' | '4x3';
const ASPECTS: Aspect[] = ['16x9', '16x10', '4x3'];
type Transition = 'slide' | 'fade' | 'zoom' | 'flip' | 'none';

const THEMES: DeckTheme[] = ['midnight', 'aurora', 'sand', 'noir', 'forest', 'paper', 'contrast'];
const TRANSITIONS: Transition[] = ['slide', 'fade', 'zoom', 'flip', 'none'];
const lsGet = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const stripTags = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function isCoverSlide(slideHtml: string): boolean {
  const doc = new DOMParser().parseFromString(`<div>${slideHtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild!;
  const children = Array.from(root.children);
  const headings = children.filter((c) => /^H[1-3]$/.test(c.tagName));
  const rich = children.filter((c) => /^(UL|OL|PRE|TABLE|BLOCKQUOTE|FIGURE|HR)$/.test(c.tagName));
  if (headings.length === 0 || rich.length > 0) return false;
  const bodyText = children.filter((c) => !/^H[1-3]$/.test(c.tagName)).map((c) => c.textContent || '').join(' ').trim();
  return bodyText.length <= 180;
}

/** Pull a full-bleed background (`![bg](url)`), speaker notes (a blockquote
 *  starting "Note:" or a [!note] alert), the title, and a clean body out of
 *  one slide's HTML. */
function parseSlide(slideHtml: string) {
  const doc = new DOMParser().parseFromString(`<div>${slideHtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  let bg = '';
  root.querySelectorAll('img').forEach((img) => {
    if (/^bg\b/i.test(img.getAttribute('alt') || '')) { bg = img.getAttribute('src') || ''; img.remove(); }
  });
  const notes: string[] = [];
  root.querySelectorAll('blockquote, .markdown-alert-note, .markdown-alert').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (/^note[:\s]/i.test(t) || el.className.includes('note')) { notes.push(t.replace(/^note[:\s]+/i, '')); el.remove(); }
  });
  const title = (root.querySelector('h1, h2, h3')?.textContent || 'Slide').trim();
  return { body: root.innerHTML, bg, notes: notes.join('\n\n'), title, words: stripTags(slideHtml).split(' ').length };
}

export function PresentationMode({ html, onClose }: PresentationModeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overview, setOverview] = useState(false);
  const [blank, setBlank] = useState<null | 'black' | 'white'>(null);
  const [laser, setLaser] = useState(false);
  const [draw, setDraw] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clock, setClock] = useState('');
  const [targetMin, setTargetMin] = useState(0);
  const [incremental, setIncremental] = useState(false);
  const [frag, setFrag] = useState(0);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [numBuf, setNumBuf] = useState('');
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);
  const [theme, setTheme] = useState<DeckTheme>(() => lsGet('mv-deck-theme', 'midnight') as DeckTheme);
  const [aspect, setAspect] = useState<Aspect>(() => lsGet('mv-deck-aspect', '16x9') as Aspect);
  const [transition, setTransition] = useState<Transition>(() => lsGet('mv-deck-transition', 'slide') as Transition);
  const [notesOpen, setNotesOpen] = useState(false);
  const [autofit, setAutofit] = useState(true);
  const [spotlight, setSpotlight] = useState(false);
  const [magnify, setMagnify] = useState(false);
  const [filmstrip, setFilmstrip] = useState(false);
  const [toc, setToc] = useState(false);
  const [sound, setSound] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const [hint, setHint] = useState(() => lsGet('mv-deck-seen', '') !== '1');
  const [hoverPreview, setHoverPreview] = useState<{ i: number; x: number } | null>(null);
  const [agenda, setAgenda] = useState(false);
  const [endSlide, setEndSlide] = useState(false);
  const [sectionHue, setSectionHue] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [caption, setCaption] = useState(false);
  const [interval, setIntervalMs] = useState(5000);
  const [loop, setLoop] = useState(false);
  const [penColor, setPenColor] = useState('#9b7dff');
  const [penWidth, setPenWidth] = useState(3);
  const [penMode, setPenMode] = useState<'pen' | 'highlight' | 'erase'>('pen');
  const [zoomLevel, setZoomLevel] = useState(1.6);

  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawHistory = useRef<ImageData[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const numTimer = useRef<number | undefined>(undefined);
  const drawing = useRef(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const presenterWin = useRef<Window | null>(null);
  const trailId = useRef(0);

  const rawSlides = useMemo(() => {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const container = doc.body.firstElementChild!;
    const out: string[] = [];
    let cur = '';
    Array.from(container.children).forEach((el) => {
      if (el.tagName === 'H1' || el.tagName === 'H2') { if (cur.trim()) out.push(cur); cur = el.outerHTML; }
      else cur += el.outerHTML;
    });
    if (cur.trim()) out.push(cur);
    return out.length > 0 ? out : [`<div>${html}</div>`];
  }, [html]);

  const baseParsed = useMemo(() => rawSlides.map(parseSlide), [rawSlides]);
  const baseSections = useMemo(() => rawSlides.map((s) => /^<h1/i.test(s.trim())), [rawSlides]);
  const deckTitle = baseParsed[0]?.title ?? 'Presentation';

  // assemble the effective deck — optional agenda (front) + thank-you (back)
  const parsed = useMemo(() => {
    const items = baseParsed.map((p, i) => ({ ...p, section: baseSections[i] }));
    if (agenda) {
      const titles = baseParsed.map((p) => `<li>${p.title}</li>`).join('');
      items.unshift({ body: `<h2>Agenda</h2><ol>${titles}</ol>`, bg: '', notes: '', title: 'Agenda', words: 0, section: true });
    }
    if (endSlide) {
      items.push({ body: `<h1>Thank you</h1><p>${deckTitle}</p>`, bg: '', notes: '', title: 'Thank you', words: 0, section: true });
    }
    return items;
  }, [baseParsed, baseSections, agenda, endSlide, deckTitle]);

  const slides = useMemo(() => parsed.map((p) => p.body), [parsed]);
  const covers = useMemo(() => parsed.map((p) => isCoverSlide(p.body)), [parsed]);
  const sections = useMemo(() => parsed.map((p) => p.section), [parsed]);
  const totalWords = useMemo(() => parsed.reduce((a, p) => a + p.words, 0), [parsed]);
  const readMin = Math.max(1, Math.round(totalWords / 130));
  const kickers = useMemo(() => {
    let sec = '';
    return parsed.map((p, i) => { if (sections[i]) { sec = p.title; return ''; } return sec; });
  }, [parsed, sections]);

  // keep currentSlide in range when the deck length changes (agenda/end toggles)
  useEffect(() => { setCurrentSlide((s) => Math.min(s, slides.length - 1)); }, [slides.length]);

  const fragCount = useMemo(() => {
    if (!incremental) return 0;
    return new DOMParser().parseFromString(`<div>${slides[currentSlide]}</div>`, 'text/html').querySelectorAll('li').length;
  }, [slides, currentSlide, incremental]);

  const searchMatches = useMemo(() => {
    if (!search) return [] as number[];
    const q = search.toLowerCase();
    return slides.map((s, i) => ({ i, hit: stripTags(s).toLowerCase().includes(q) })).filter((x) => x.hit).map((x) => x.i);
  }, [search, slides]);

  const beep = useCallback(() => {
    if (!sound) return;
    try {
      audioCtx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioCtx.current; const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 660; o.type = 'sine'; g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); o.stop(ctx.currentTime + 0.13);
    } catch { /* ignore */ }
  }, [sound]);

  const goNext = useCallback(() => {
    if (incremental && frag < fragCount) { setFrag((f) => f + 1); return; }
    setCurrentSlide((s) => { setDir(1); return Math.min(s + 1, slides.length - 1); }); setFrag(0); beep();
  }, [incremental, frag, fragCount, slides.length, beep]);
  const goPrev = useCallback(() => {
    if (incremental && frag > 0) { setFrag((f) => f - 1); return; }
    setCurrentSlide((s) => { setDir(-1); return Math.max(s - 1, 0); }); setFrag(0); beep();
  }, [incremental, frag, beep]);
  const goTo = useCallback((i: number) => {
    setCurrentSlide((s) => { setDir(i >= s ? 1 : -1); return Math.max(0, Math.min(i, slides.length - 1)); }); setFrag(0); beep();
  }, [slides.length, beep]);

  const toggleFullscreen = useCallback(() => {
    const el = overlayRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {});
  }, []);
  const cycleTheme = useCallback(() => setTheme((t) => { const n = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]; lsSet('mv-deck-theme', n); return n; }), []);
  const toggleAspect = useCallback(() => setAspect((a) => { const n = ASPECTS[(ASPECTS.indexOf(a) + 1) % ASPECTS.length]; lsSet('mv-deck-aspect', n); return n; }), []);
  const jumpSection = useCallback((forward: boolean) => setCurrentSlide((s) => {
    if (forward) { for (let i = s + 1; i < sections.length; i++) if (sections[i]) { setDir(1); return i; } return s; }
    for (let i = s - 1; i >= 0; i--) if (sections[i]) { setDir(-1); return i; } return s;
  }), [sections]);
  const cycleTransition = useCallback(() => setTransition((t) => { const n = TRANSITIONS[(TRANSITIONS.indexOf(t) + 1) % TRANSITIONS.length]; lsSet('mv-deck-transition', n); return n; }), []);
  const clearDrawing = useCallback(() => { const c = canvasRef.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); drawHistory.current = []; }, []);

  const exportPng = useCallback(() => {
    const el = slideRef.current; if (!el) return;
    toPng(el, { pixelRatio: 2, backgroundColor: theme === 'paper' ? '#f4efe4' : '#0d0e13' })
      .then((url) => { const a = document.createElement('a'); a.href = url; a.download = `slide-${currentSlide + 1}.png`; a.click(); })
      .catch(() => {});
  }, [currentSlide, theme]);

  const exportHtml = useCallback(() => {
    const doc = `<!doctype html><meta charset=utf8><title>${deckTitle}</title><style>body{margin:0;background:#0a0b11;color:#eef1f6;font-family:system-ui,sans-serif}section{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:8% 9%;border-bottom:1px solid #222}h1,h2{font-size:3rem;margin:0 0 .4em}p,li{font-size:1.3rem;line-height:1.6;color:#aeb6c4}code{background:#ffffff14;padding:.1em .4em;border-radius:4px}pre{background:#0008;padding:1em;border-radius:8px;overflow:auto}</style>` +
      slides.map((s) => `<section>${s}</section>`).join('');
    const blob = new Blob([doc], { type: 'text/html' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${deckTitle.replace(/\W+/g, '-').toLowerCase()}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, [slides, deckTitle]);

  const copyLink = useCallback(() => { navigator.clipboard?.writeText(window.location.href).catch(() => {}); }, []);

  const openPresenter = useCallback(() => {
    const w = window.open('', 'mv-presenter', 'width=900,height=620');
    if (!w) return;
    presenterWin.current = w;
    w.document.write(`<!doctype html><meta charset=utf8><title>Presenter — ${deckTitle}</title><style>body{margin:0;background:#07080c;color:#eef1f6;font-family:system-ui,sans-serif;display:grid;grid-template-rows:auto 1fr auto;height:100vh}header{display:flex;justify-content:space-between;padding:10px 16px;font:13px ui-monospace,monospace;color:#9aa3b2;border-bottom:1px solid #1c1f27}#main{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;padding:14px;min-height:0}.card{background:#13151c;border:1px solid #ffffff14;border-radius:12px;padding:22px;overflow:auto}.card h4{margin:0 0 10px;font:11px ui-monospace,monospace;letter-spacing:2px;text-transform:uppercase;color:#9b7dff}.next{opacity:.7}#notes{font-size:15px;line-height:1.6;white-space:pre-wrap;color:#c7cdd8}footer{padding:8px 16px;font:13px ui-monospace,monospace;color:#9aa3b2;border-top:1px solid #1c1f27}h1,h2{font-size:1.8rem}p,li{color:#aeb6c4}</style><header><span id=pos></span><span id=time></span></header><div id=main><div class=card><h4>Current</h4><div id=cur></div></div><div style="display:grid;grid-template-rows:1fr 1fr;gap:14px;min-height:0"><div class="card next"><h4>Next</h4><div id=nxt></div></div><div class=card><h4>Notes</h4><div id=notes></div></div></div></div><footer>${deckTitle} · markview.ai</footer><script>const bc=new BroadcastChannel('mv-deck-pv');bc.onmessage=e=>{const d=e.data;document.getElementById('cur').innerHTML=d.cur;document.getElementById('nxt').innerHTML=d.nxt||'<p style=opacity:.5>— end —</p>';document.getElementById('notes').innerText=d.notes||'No notes.';document.getElementById('pos').textContent=d.pos;document.getElementById('time').textContent=d.time;};bc.postMessage({req:1});<\/script>`);
    w.document.close();
  }, [deckTitle]);

  // broadcast state to presenter window
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel('mv-deck-pv'); } catch { return; }
    const post = () => bc?.postMessage({
      cur: slides[currentSlide], nxt: slides[currentSlide + 1] || '', notes: parsed[currentSlide]?.notes || '',
      pos: `${currentSlide + 1} / ${slides.length}`, time: timerOn ? `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}` : clock,
    });
    bc.onmessage = (e) => { if (e.data?.req) post(); };
    post();
    return () => bc?.close();
  }, [currentSlide, slides, parsed, elapsed, timerOn, clock]);

  // deep link
  useEffect(() => { const m = window.location.hash.match(/slide-(\d+)/); if (m) { const n = +m[1] - 1; if (n >= 0 && n < slides.length) setCurrentSlide(n); } }, []); // eslint-disable-line
  useEffect(() => { try { window.history.replaceState(null, '', `#slide-${currentSlide + 1}`); } catch { /* ignore */ } }, [currentSlide]);

  useEffect(() => { const h = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  useEffect(() => { const zen = getComputedStyle(document.documentElement).getPropertyValue('--zen-accent').trim(); if (zen) overlayRef.current?.style.setProperty('--deck-accent', zen); }, []);

  // timer + clock
  useEffect(() => {
    if (!timerOn) return;
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const id = window.setInterval(() => { setElapsed((e) => e + 1); tick(); }, 1000); tick();
    return () => window.clearInterval(id);
  }, [timerOn]);

  // autoplay (speed + loop)
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setTimeout(() => {
      setCurrentSlide((s) => {
        if (s >= slides.length - 1) { if (loop) { setDir(1); return 0; } setAutoplay(false); return s; }
        setDir(1); return s + 1;
      });
      setFrag(0);
    }, interval);
    return () => window.clearTimeout(id);
  }, [autoplay, currentSlide, slides.length, interval, loop]);

  // per-section accent hue
  useEffect(() => {
    if (!sectionHue) {
      // restore the atmosphere accent if present, else let the theme's own accent show
      const zen = getComputedStyle(document.documentElement).getPropertyValue('--zen-accent').trim();
      if (zen) overlayRef.current?.style.setProperty('--deck-accent', zen);
      else overlayRef.current?.style.removeProperty('--deck-accent');
      return;
    }
    const palette = ['#9b7dff', '#3b9ed8', '#e0894a', '#46b98a', '#d65a8a', '#c2563b'];
    const idx = sections.slice(0, currentSlide + 1).filter(Boolean).length;
    overlayRef.current?.style.setProperty('--deck-accent', palette[idx % palette.length]);
  }, [sectionHue, currentSlide, sections]);

  // fragments
  useLayoutEffect(() => {
    const body = bodyRef.current; if (!body) return;
    body.querySelectorAll('li').forEach((li, i) => li.classList.toggle('frag-hidden', incremental && i >= frag));
  }, [incremental, frag, currentSlide, slides]);

  // auto-fit
  useLayoutEffect(() => {
    const body = bodyRef.current; if (!body) return;
    body.style.transform = ''; body.style.transformOrigin = ''; body.style.width = '';
    const slide = slideRef.current;
    if (!autofit || !slide || covers[currentSlide]) return;
    // fit-to-FILL: scale content up or down (from the centre) so the slide
    // uses the whole card height instead of floating in the top half.
    const cs = getComputedStyle(slide);
    const avail = slide.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0');
    const natural = body.scrollHeight;
    if (natural < 1 || avail < 1) return;
    const scale = Math.max(0.6, Math.min(1.45, avail / natural));
    if (Math.abs(scale - 1) > 0.04) {
      body.style.transformOrigin = 'center center';
      body.style.transform = `scale(${scale})`;
    }
  }, [autofit, currentSlide, aspect, theme, frag, slides, covers]);

  // code copy buttons
  useEffect(() => {
    const body = bodyRef.current; if (!body) return;
    body.querySelectorAll('pre').forEach((pre) => {
      if (!pre.querySelector('.deck-lang')) {
        const m = pre.querySelector('code')?.className.match(/language-([\w-]+)/);
        if (m) { const l = document.createElement('span'); l.className = 'deck-lang'; l.textContent = m[1]; pre.appendChild(l); }
      }
      if (pre.querySelector('.deck-copy')) return;
      const b = document.createElement('button'); b.className = 'deck-copy'; b.textContent = 'Copy';
      b.onclick = () => { const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''; navigator.clipboard?.writeText(code).then(() => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1200); }); };
      pre.appendChild(b);
    });
  }, [currentSlide, slides]);

  useLayoutEffect(() => { const c = canvasRef.current; if (!c) return; const r = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; }; r(); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, [draw]);
  useEffect(() => { clearDrawing(); }, [currentSlide, clearDrawing]);

  // idle cinema
  useEffect(() => {
    const wake = () => { setChromeHidden(false); window.clearTimeout(idleTimer.current); idleTimer.current = window.setTimeout(() => { if (!draw && !overview && !showHelp && !toc && search == null) setChromeHidden(true); }, 3500); };
    wake(); window.addEventListener('mousemove', wake); window.addEventListener('keydown', wake);
    return () => { window.removeEventListener('mousemove', wake); window.removeEventListener('keydown', wake); window.clearTimeout(idleTimer.current); };
  }, [draw, overview, showHelp, toc, search]);

  // first-run hint dismiss
  useEffect(() => { if (!hint) return; const id = window.setTimeout(() => { setHint(false); lsSet('mv-deck-seen', '1'); }, 4500); return () => window.clearTimeout(id); }, [hint]);

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    if (laser || spotlight) setPointer({ x: e.clientX, y: e.clientY });
    if (laser) {
      const id = trailId.current++;
      setTrail((t) => [...t.slice(-7), { x: e.clientX, y: e.clientY, id }]);
      window.setTimeout(() => setTrail((t) => t.filter((p) => p.id !== id)), 420);
    }
    if (magnify && slideRef.current) {
      const r = slideRef.current.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100, py = ((e.clientY - r.top) / r.height) * 100;
      slideRef.current.style.transformOrigin = `${Math.max(0, Math.min(100, px))}% ${Math.max(0, Math.min(100, py))}%`;
    }
    if (draw && drawing.current) {
      const c = canvasRef.current; if (!c) return; const r = c.getBoundingClientRect(); const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (penMode === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = penWidth * 6; }
      else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = penColor; ctx.globalAlpha = penMode === 'highlight' ? 0.32 : 1; ctx.lineWidth = penMode === 'highlight' ? penWidth * 5 : penWidth; }
      ctx.stroke();
    }
  }, [laser, spotlight, magnify, draw, penColor, penWidth, penMode]);
  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (!draw) return; const c = canvasRef.current; if (!c) return; const r = c.getBoundingClientRect(); const ctx = c.getContext('2d'); if (!ctx) return;
    try { drawHistory.current.push(ctx.getImageData(0, 0, c.width, c.height)); if (drawHistory.current.length > 30) drawHistory.current.shift(); } catch { /* ignore */ }
    drawing.current = true; ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  }, [draw]);
  const onPointerUp = useCallback(() => { drawing.current = false; }, []);
  const undoDraw = useCallback(() => { const c = canvasRef.current; const prev = drawHistory.current.pop(); if (c && prev) c.getContext('2d')?.putImageData(prev, 0, 0); }, []);
  const saveAnnotated = useCallback(() => {
    const el = stageRef.current; if (!el) return;
    toPng(el, { pixelRatio: 2, backgroundColor: theme === 'paper' ? '#f4efe4' : '#0d0e13' })
      .then((url) => { const a = document.createElement('a'); a.href = url; a.download = `slide-${currentSlide + 1}-annotated.png`; a.click(); }).catch(() => {});
  }, [currentSlide, theme]);

  const touchX = useRef<number | null>(null); const wheelLock = useRef(false);
  const onTouchStart = useCallback((e: React.TouchEvent) => { touchX.current = e.changedTouches[0]?.clientX ?? null; }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => { if (touchX.current == null) return; const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current; if (Math.abs(dx) > 60) { if (dx < 0) goNext(); else goPrev(); } touchX.current = null; }, [goNext, goPrev]);
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (magnify) { setZoomLevel((z) => Math.max(1.2, Math.min(3, z + (e.deltaY < 0 ? 0.15 : -0.15)))); return; }
    if (overview || wheelLock.current) return; if (Math.abs(e.deltaY) < 24 && Math.abs(e.deltaX) < 24) return;
    wheelLock.current = true; if (e.deltaY > 0 || e.deltaX > 0) goNext(); else goPrev(); window.setTimeout(() => { wheelLock.current = false; }, 650);
  }, [overview, magnify, goNext, goPrev]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (search != null) { if (e.key === 'Escape') { e.preventDefault(); setSearch(null); } return; }
      const k = e.key;
      if (/^[0-9]$/.test(k)) { e.preventDefault(); setNumBuf((b) => (b + k).slice(-3)); window.clearTimeout(numTimer.current); numTimer.current = window.setTimeout(() => setNumBuf(''), 1100); return; }
      if (k === 'Enter' && numBuf) { e.preventDefault(); goTo(+numBuf - 1); setNumBuf(''); return; }
      switch (k) {
        case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); goNext(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); goPrev(); break;
        case 'ArrowDown': if (overview) { e.preventDefault(); goNext(); } break;
        case 'ArrowUp': if (overview) { e.preventDefault(); goPrev(); } break;
        case 'Home': e.preventDefault(); goTo(0); break;
        case 'End': e.preventDefault(); goTo(slides.length - 1); break;
        case 'o': case 'O': e.preventDefault(); setOverview((v) => !v); break;
        case 'g': case 'G': e.preventDefault(); setToc((v) => !v); break;
        case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
        case 't': case 'T': e.preventDefault(); setTimerOn((v) => !v); break;
        case 'p': case 'P': e.preventDefault(); setAutoplay((v) => !v); break;
        case 'b': case 'B': e.preventDefault(); setBlank((v) => (v === 'black' ? null : 'black')); break;
        case 'w': case 'W': e.preventDefault(); setBlank((v) => (v === 'white' ? null : 'white')); break;
        case 'l': case 'L': e.preventDefault(); setLaser((v) => !v); break;
        case 'k': case 'K': e.preventDefault(); setSpotlight((v) => !v); break;
        case 'z': case 'Z': e.preventDefault(); setMagnify((v) => !v); break;
        case 'd': case 'D': e.preventDefault(); setDraw((v) => !v); break;
        case 'c': case 'C': e.preventDefault(); clearDrawing(); break;
        case 'i': case 'I': e.preventDefault(); setIncremental((v) => !v); setFrag(0); break;
        case 's': case 'S': e.preventDefault(); setNotesOpen((v) => !v); break;
        case 'v': case 'V': e.preventDefault(); openPresenter(); break;
        case 'a': case 'A': e.preventDefault(); setAutofit((v) => !v); break;
        case 'm': case 'M': e.preventDefault(); cycleTheme(); break;
        case 'r': case 'R': e.preventDefault(); toggleAspect(); break;
        case 'x': case 'X': e.preventDefault(); cycleTransition(); break;
        case 'e': case 'E': e.preventDefault(); window.print(); break;
        case ',': e.preventDefault(); setFilmstrip((v) => !v); break;
        case '+': case '=': e.preventDefault(); setTargetMin((m) => m + 1); setTimerOn(true); break;
        case '-': e.preventDefault(); setTargetMin((m) => Math.max(0, m - 1)); break;
        case '[': e.preventDefault(); setIntervalMs((v) => Math.min(15000, v + 1000)); break;
        case ']': e.preventDefault(); setIntervalMs((v) => Math.max(1500, v - 1000)); break;
        case '{': e.preventDefault(); jumpSection(false); break;
        case '}': e.preventDefault(); jumpSection(true); break;
        case 'u': case 'U': if (draw) { e.preventDefault(); undoDraw(); } break;
        case '/': e.preventDefault(); setSearch(''); break;
        case '?': case 'h': case 'H': e.preventDefault(); setShowHelp((v) => !v); break;
        case 'Escape':
          e.preventDefault();
          if (showHelp) setShowHelp(false); else if (toc) setToc(false); else if (blank) setBlank(null);
          else if (overview) setOverview(false); else if (magnify) setMagnify(false); else if (spotlight) setSpotlight(false);
          else if (draw) setDraw(false); else if (!document.fullscreenElement) onClose();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, goTo, onClose, toggleFullscreen, slides.length, overview, showHelp, blank, draw, numBuf, clearDrawing, cycleTheme, toggleAspect, cycleTransition, toc, magnify, spotlight, search, openPresenter, jumpSection, undoDraw]);

  const pct = ((currentSlide + 1) / slides.length) * 100;
  const overTime = targetMin > 0 && elapsed > targetMin * 60;
  const transClass = transition === 'slide' ? (dir === 1 ? 'from-right' : 'from-left') : transition === 'none' ? '' : `t-${transition}`;

  const renderSlide = (i: number, thumb = false) => {
    const p = parsed[i];
    return (
      <article
        ref={thumb ? undefined : slideRef}
        className={`presentation-slide markdown-content${thumb ? ' is-thumb' : ` ${transClass}`}${covers[i] ? ' is-cover' : ''}${p.bg ? ' has-bg' : ''}`}
        style={p.bg ? { backgroundImage: `linear-gradient(rgba(8,9,14,0.62),rgba(8,9,14,0.62)), url(${p.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <span className="presentation-accent" aria-hidden />
        {!thumb && kickers[i] && !covers[i] && <span className="presentation-kicker">{kickers[i]}</span>}
        {!thumb && <span className="presentation-slide-watermark" aria-hidden>{String(i + 1).padStart(2, '0')}</span>}
        <div className="presentation-slide-body" ref={thumb ? undefined : bodyRef} dangerouslySetInnerHTML={{ __html: p.body }} />
        {!thumb && <span className="presentation-slide-no">{String(i + 1).padStart(2, '0')}</span>}
      </article>
    );
  };

  return (
    <div
      ref={overlayRef}
      className={`presentation-overlay theme-${theme} aspect-${aspect}${overview ? ' is-overview' : ''}${chromeHidden ? ' chrome-hidden' : ''}${draw ? ' is-drawing' : ''}${magnify ? ' is-magnify' : ''}${spotlight ? ' is-spotlight' : ''}`}
      style={{ ['--deck-zoom' as string]: String(zoomLevel) }}
      onMouseMove={onPointerMove} onMouseDown={onPointerDown} onMouseUp={onPointerUp}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onWheel={onWheel}
      onDoubleClick={() => { if (!draw && !overview) setMagnify((v) => !v); }}
    >
      <span className="presentation-orb o1" aria-hidden />
      <span className="presentation-orb o2" aria-hidden />
      <span className="presentation-orb o3" aria-hidden />
      <div className="presentation-progress" aria-hidden
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); goTo(Math.floor(((e.clientX - r.left) / r.width) * slides.length)); }}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPreview({ i: Math.max(0, Math.min(slides.length - 1, Math.floor(((e.clientX - r.left) / r.width) * slides.length))), x: e.clientX }); }}
        onMouseLeave={() => setHoverPreview(null)}>
        <span style={{ width: `${pct}%` }} />
        {sections.map((isSec, i) => isSec && i > 0 ? <i key={i} className="presentation-tick" style={{ left: `${(i / slides.length) * 100}%` }} /> : null)}
      </div>
      {hoverPreview && (
        <div className="presentation-hoverpeek" style={{ left: Math.max(120, Math.min(window.innerWidth - 120, hoverPreview.x)) }}>
          {renderSlide(hoverPreview.i, true)}
          <span>{hoverPreview.i + 1}</span>
        </div>
      )}

      <div className="presentation-controls">
        {timerOn && <span className={`presentation-timer${overTime ? ' is-over' : ''}`}><Timer size={13} /> {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}{targetMin > 0 && ` / ${targetMin}:00`} · {clock}</span>}
        <span className="presentation-counter">{currentSlide + 1}<em>/</em>{slides.length}</span>
        <button className={`presentation-btn${autoplay ? ' is-on' : ''}`} onClick={() => setAutoplay((v) => !v)} title="Autoplay (P)">{autoplay ? <Pause size={15} /> : <Play size={15} />}</button>
        <button className={`presentation-btn${notesOpen ? ' is-on' : ''}`} onClick={() => setNotesOpen((v) => !v)} title="Notes (S)"><StickyNote size={15} /></button>
        <button className="presentation-btn" onClick={openPresenter} title="Presenter view (V)"><MonitorPlay size={15} /></button>
        <button className="presentation-btn" onClick={() => setSearch('')} title="Search (/)"><Search size={15} /></button>
        <button className={`presentation-btn${filmstrip ? ' is-on' : ''}`} onClick={() => setFilmstrip((v) => !v)} title="Filmstrip (,)"><Film size={15} /></button>
        <button className={`presentation-btn${draw ? ' is-on' : ''}`} onClick={() => setDraw((v) => !v)} title="Draw (D)"><Pencil size={15} /></button>
        <button className="presentation-btn" onClick={cycleTheme} title="Theme (M)"><Palette size={15} /></button>
        <button className={`presentation-btn${overview ? ' is-on' : ''}`} onClick={() => setOverview((v) => !v)} title="Overview (O)"><LayoutGrid size={15} /></button>
        <button className="presentation-btn" onClick={exportPng} title="Slide → PNG"><Image size={15} /></button>
        <button className="presentation-btn" onClick={() => window.print()} title="Export PDF (E)"><Printer size={15} /></button>
        <button className="presentation-btn" onClick={copyLink} title="Copy slide link"><Link2 size={15} /></button>
        <button className={`presentation-btn${sound ? ' is-on' : ''}`} onClick={() => setSound((v) => !v)} title="Advance sound">{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
        <button className={`presentation-btn${loop ? ' is-on' : ''}`} onClick={() => setLoop((v) => !v)} title="Loop"><Repeat size={15} /></button>
        <button className={`presentation-btn${caption ? ' is-on' : ''}`} onClick={() => setCaption((v) => !v)} title="Lower-third caption"><Captions size={15} /></button>
        <button className={`presentation-btn${statsOpen ? ' is-on' : ''}`} onClick={() => setStatsOpen((v) => !v)} title="Stats & options"><BarChart3 size={15} /></button>
        <button className="presentation-btn" onClick={() => setShowHelp((v) => !v)} title="Shortcuts (?)"><Keyboard size={15} /></button>
        <button className="presentation-btn" onClick={toggleFullscreen} title="Fullscreen (F)">{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        <button className="presentation-btn" onClick={onClose} title="Exit (Esc)"><X size={16} /></button>
      </div>

      {overview ? (
        <div className="presentation-grid">
          {slides.map((_, i) => (
            <button key={i} className={`presentation-thumb${i === currentSlide ? ' is-active' : ''}`} onClick={() => { goTo(i); setOverview(false); }} aria-label={`Slide ${i + 1}`}>
              {renderSlide(i, true)}<span className="presentation-thumb-no">{i + 1}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="presentation-stage" ref={stageRef}>
          <div key={currentSlide} className="presentation-slide-wrap">{renderSlide(currentSlide)}</div>
          {draw && <canvas ref={canvasRef} className="presentation-canvas" />}
          {autoplay && <div key={`cd-${currentSlide}-${interval}`} className="presentation-countdown" style={{ animationDuration: `${interval}ms` }} />}
        </div>
      )}

      {draw && (
        <div className="presentation-drawbar" onMouseDown={(e) => e.stopPropagation()}>
          {['#9b7dff', '#ff5f57', '#28c840', '#febc2e', '#ffffff'].map((col) => (
            <button key={col} className={`deck-swatch${penColor === col && penMode !== 'erase' ? ' is-active' : ''}`} style={{ background: col }} onClick={() => { setPenColor(col); setPenMode('pen'); }} aria-label={`Pen ${col}`} />
          ))}
          {[2, 4, 8].map((wpx) => (
            <button key={wpx} className={`deck-width${penWidth === wpx ? ' is-active' : ''}`} onClick={() => setPenWidth(wpx)} aria-label={`Width ${wpx}`}><span style={{ width: wpx + 2, height: wpx + 2 }} /></button>
          ))}
          <button className={`presentation-btn${penMode === 'highlight' ? ' is-on' : ''}`} onClick={() => setPenMode((m) => (m === 'highlight' ? 'pen' : 'highlight'))} title="Highlighter"><Highlighter size={15} /></button>
          <button className={`presentation-btn${penMode === 'erase' ? ' is-on' : ''}`} onClick={() => setPenMode((m) => (m === 'erase' ? 'pen' : 'erase'))} title="Eraser"><Eraser size={15} /></button>
          <button className="presentation-btn" onClick={undoDraw} title="Undo (U)"><Undo2 size={15} /></button>
          <button className="presentation-btn" onClick={saveAnnotated} title="Save annotated PNG"><Download size={15} /></button>
          <button className="presentation-btn" onClick={clearDrawing} title="Clear (C)"><X size={15} /></button>
        </div>
      )}

      {!overview && !blank && currentSlide < slides.length - 1 && !filmstrip && (
        <div className="presentation-peek" aria-hidden><span className="presentation-peek-label">Next</span>{renderSlide(currentSlide + 1, true)}</div>
      )}

      {filmstrip && (
        <div className="presentation-filmstrip">
          {slides.map((_, i) => (
            <button key={i} className={`presentation-film-item${i === currentSlide ? ' is-active' : ''}`} onClick={() => goTo(i)}>{renderSlide(i, true)}<span>{i + 1}</span></button>
          ))}
        </div>
      )}

      <div className="presentation-nav">
        <button className="presentation-nav-btn is-edge" onClick={() => goTo(0)} disabled={currentSlide === 0} aria-label="First"><SkipBack size={18} /></button>
        <button className="presentation-nav-btn" onClick={goPrev} disabled={currentSlide === 0 && frag === 0} aria-label="Previous"><ChevronLeft size={22} /></button>
        <div className="presentation-dots" role="tablist">
          {slides.map((_, i) => <button key={i} className={`presentation-dot${i === currentSlide ? ' is-active' : ''}${sections[i] && i > 0 ? ' is-section' : ''}`} onClick={() => goTo(i)} title={parsed[i]?.title} aria-label={parsed[i]?.title || `Slide ${i + 1}`} aria-selected={i === currentSlide} />)}
        </div>
        <button className="presentation-nav-btn" onClick={goNext} disabled={currentSlide === slides.length - 1 && frag >= fragCount} aria-label="Next"><ChevronRight size={22} /></button>
        <button className="presentation-nav-btn is-edge" onClick={() => goTo(slides.length - 1)} disabled={currentSlide === slides.length - 1} aria-label="Last"><SkipForward size={18} /></button>
      </div>

      <div className="presentation-footer">
        <span>{deckTitle}</span>
        <span className="presentation-footer-meta">
          {autofit && <em>fit</em>}{incremental && <em>reveal</em>}{loop && <em>loop</em>}{transition !== 'slide' && <em>{transition}</em>}{aspect !== '16x9' && <em>{aspect === '4x3' ? '4:3' : '16:10'}</em>}
          {Math.round(pct)}% · {readMin} min read · markview.ai
        </span>
      </div>

      <p className="presentation-hint">← → navigate · O overview · ? shortcuts</p>

      {notesOpen && (
        <div className="presentation-notes">
          <h4>Speaker notes</h4>
          <p>{parsed[currentSlide]?.notes || 'No notes for this slide. Add a blockquote starting "Note:" in your markdown.'}</p>
        </div>
      )}

      {search != null && (
        <div className="presentation-search">
          <Search size={15} />
          <input autoFocus value={search} placeholder="Search slides…" onChange={(e) => { setSearch(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && searchMatches.length) { const nx = searchMatches.find((m) => m > currentSlide) ?? searchMatches[0]; goTo(nx); } }} />
          <span>{search ? `${searchMatches.length} match${searchMatches.length === 1 ? '' : 'es'}` : ''}</span>
        </div>
      )}

      {numBuf && <div className="presentation-numbuf">→ {numBuf}</div>}
      {hint && <div className="presentation-firsthint">Press <kbd>?</kbd> for {40} shortcuts & features</div>}
      {laser && trail.map((t) => <div key={t.id} className="presentation-trail" style={{ left: t.x, top: t.y }} aria-hidden />)}
      {laser && pointer && <div className="presentation-laser" style={{ left: pointer.x, top: pointer.y }} aria-hidden />}
      {spotlight && pointer && <div className="presentation-spot" style={{ ['--sx' as string]: `${pointer.x}px`, ['--sy' as string]: `${pointer.y}px` }} aria-hidden />}
      {blank && <div className={`presentation-blank is-${blank}`} onClick={() => setBlank(null)} />}

      {toc && (
        <div className="presentation-help" onClick={() => setToc(false)}>
          <div className="presentation-help-card presentation-toc" onClick={(e) => e.stopPropagation()}>
            <h3>Contents</h3>
            <ol>{parsed.map((p, i) => <li key={i} className={i === currentSlide ? 'is-active' : ''}><button onClick={() => { goTo(i); setToc(false); }}><span>{i + 1}</span>{p.title}</button></li>)}</ol>
          </div>
        </div>
      )}

      {caption && (
        <div className="presentation-caption"><strong>{deckTitle}</strong>{kickers[currentSlide] && <span> · {kickers[currentSlide]}</span>}</div>
      )}

      {statsOpen && (
        <div className="presentation-help" onClick={() => setStatsOpen(false)}>
          <div className="presentation-help-card presentation-stats" onClick={(e) => e.stopPropagation()}>
            <h3>Deck stats & options</h3>
            <div className="presentation-stat-grid">
              <div><b>{slides.length}</b><span>slides</span></div>
              <div><b>{sections.filter(Boolean).length}</b><span>sections</span></div>
              <div><b>{totalWords.toLocaleString()}</b><span>words</span></div>
              <div><b>{readMin}</b><span>min read</span></div>
              <div><b>{Math.round((interval / 1000) * slides.length / 6) / 10}</b><span>min autoplay</span></div>
              <div><b>{interval / 1000}s</b><span>per slide</span></div>
            </div>
            <div className="presentation-opts">
              <button className={agenda ? 'is-on' : ''} onClick={() => setAgenda((v) => !v)}>Agenda slide</button>
              <button className={endSlide ? 'is-on' : ''} onClick={() => setEndSlide((v) => !v)}>Thank-you slide</button>
              <button className={sectionHue ? 'is-on' : ''} onClick={() => setSectionHue((v) => !v)}>Per-section accent</button>
              <button className={autofit ? 'is-on' : ''} onClick={() => setAutofit((v) => !v)}>Auto-fit text</button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="presentation-help" onClick={() => setShowHelp(false)}>
          <div className="presentation-help-card" onClick={(e) => e.stopPropagation()}>
            <h3>Keyboard shortcuts</h3>
            <dl>
              {[
                ['→ Space', 'Next / reveal'], ['←', 'Previous'], ['1–9 ↵', 'Jump to slide'], ['Home End', 'First / last'],
                ['O', 'Overview'], ['G', 'Contents'], [',', 'Filmstrip'], ['/', 'Search'],
                ['S', 'Speaker notes'], ['V', 'Presenter view'], ['F', 'Fullscreen'], ['A', 'Auto-fit'],
                ['P', 'Autoplay'], ['T', 'Timer'], ['+ −', 'Time target'], ['I', 'Incremental'],
                ['B / W', 'Blank black / white'], ['L', 'Laser'], ['K', 'Spotlight'], ['Z', 'Magnify'],
                ['D / C', 'Draw / clear'], ['M', 'Theme'], ['R', 'Aspect'], ['X', 'Transition'],
                ['E', 'Print PDF'], ['? H', 'This help'], ['Esc', 'Back / exit'],
              ].map(([key, desc]) => <div key={key}><dt>{key}</dt><dd>{desc}</dd></div>)}
            </dl>
          </div>
        </div>
      )}

      <div className="presentation-print" aria-hidden>
        {slides.map((s, i) => <div key={i} className="presentation-print-slide markdown-content" dangerouslySetInnerHTML={{ __html: s }} />)}
      </div>
    </div>
  );
}
