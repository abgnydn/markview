'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';

interface PresentationModeProps {
  html: string;
  onClose: () => void;
}

export function PresentationMode({ html, onClose }: PresentationModeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Split HTML by h1/h2 headings into slides
  const slides = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const container = doc.body.firstElementChild!;
    const slideList: string[] = [];
    let current = '';

    Array.from(container.children).forEach((el) => {
      if (el.tagName === 'H1' || el.tagName === 'H2') {
        if (current.trim()) slideList.push(current);
        current = el.outerHTML;
      } else {
        current += el.outerHTML;
      }
    });
    if (current.trim()) slideList.push(current);
    return slideList.length > 0 ? slideList : [`<div>${html}</div>`];
  }, [html]);

  const goNext = useCallback(() => setCurrentSlide((s) => Math.min(s + 1, slides.length - 1)), [slides.length]);
  const goPrev = useCallback(() => setCurrentSlide((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  return (
    <div className="presentation-overlay">
      <div className="presentation-controls">
        <span className="presentation-counter">
          {currentSlide + 1} / {slides.length}
        </span>
        <button className="presentation-btn" onClick={onClose} title="Exit (Esc)">
          <X size={20} />
        </button>
      </div>

      <div className="presentation-slide markdown-content">
        <div dangerouslySetInnerHTML={{ __html: slides[currentSlide] }} />
      </div>

      <div className="presentation-nav">
        <button
          className="presentation-nav-btn"
          onClick={goPrev}
          disabled={currentSlide === 0}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          className="presentation-nav-btn"
          onClick={goNext}
          disabled={currentSlide === slides.length - 1}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
