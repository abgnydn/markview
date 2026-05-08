'use client';

import React, { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { Upload, Github, Monitor } from 'lucide-react';
import { LandingCinema } from './landing-cinema';
import { CinemaBackdrop } from './cinema-backdrop';
import { LandingFinale } from './landing-finale';
import './landing.css';
import './landing-cinematic.css';

interface LandingPageProps {
  onFilesSelected: (files: { filename: string; content: string }[], title?: string) => void;
  onGitHubImport: (files: { filename: string; content: string }[], title?: string) => void;
  hasExistingWorkspace?: boolean;
  onBackToWorkspace?: () => void;
}

export function LandingPage({
  onFilesSelected,
  hasExistingWorkspace,
  onBackToWorkspace,
}: LandingPageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const dropped = e.dataTransfer.files;
      if (!dropped || dropped.length === 0) return;

      const results: { filename: string; content: string }[] = [];
      for (const file of Array.from(dropped)) {
        if (file.name.match(/\.(md|markdown)$/i)) {
          const content = await file.text();
          results.push({ filename: file.name, content });
        }
      }
      if (results.length > 0) onFilesSelected(results);
    },
    [onFilesSelected],
  );

  return (
    <>
      <CinemaBackdrop />
      <div
        className="landing landing-cinematic"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="landing-drop-overlay">
            <div className="landing-drop-content">
              <Upload size={48} className="landing-drop-icon" />
              <h2 className="landing-drop-title">Drop your .md files here</h2>
              <p className="landing-drop-subtitle">
                Release to render · no upload, no server, fully private
              </p>
            </div>
          </div>
        )}

        {/* Slim nav — brand + docs + github */}
        <nav className="landing-navbar">
          <div className="landing-navbar-inner">
            <div className="landing-navbar-brand">
              <img
                src="/icon-192.png"
                alt="MarkView"
                className="landing-navbar-logo"
              />
              <span className="landing-navbar-name">MarkView</span>
            </div>
            <div className="landing-navbar-links">
              <Link href="/vault" className="landing-navbar-link">
                Vault
              </Link>
              <Link href="/docs" className="landing-navbar-link">
                Docs
              </Link>
              <a
                href="https://github.com/abgnydn/markview"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-navbar-github"
              >
                <Github size={16} />
                <span>GitHub</span>
              </a>
              {hasExistingWorkspace && onBackToWorkspace && (
                <button
                  className="landing-navbar-workspace-btn"
                  onClick={onBackToWorkspace}
                >
                  <Monitor size={14} />
                  <span>Workspace</span>
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* The story — 5 scroll-driven chapters over the 3D orbit */}
        <LandingCinema />

        {/* Finale — single CTA moment */}
        <LandingFinale />

        {/* Minimal footer */}
        <footer
          className="landing-footer"
          style={{ position: 'relative', zIndex: 2 }}
        >
          <img
            src="/icon-192.png"
            alt="MarkView Logo"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              margin: '0 auto 20px auto',
              display: 'block',
              opacity: 0.9,
            }}
          />
          <p>
            <strong>MarkView</strong> — open-source personal AI brain, MCP-first
          </p>
          <p className="landing-footer-sub">
            Apache 2.0 · WebRTC · MCP · local LLM
          </p>
          <p className="landing-footer-links">
            <a href="/docs">Documentation</a>
            <span>·</span>
            <a
              href="https://github.com/abgnydn/markview"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span>·</span>
            <a href="/terms">Terms</a>
            <span>·</span>
            <a href="/privacy">Privacy</a>
          </p>
        </footer>
      </div>
    </>
  );
}
