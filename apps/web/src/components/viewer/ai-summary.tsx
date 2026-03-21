'use client';

import React, { useState, useMemo } from 'react';
import { Sparkles, ChevronDown, ChevronUp, BookOpen, BarChart3 } from 'lucide-react';

interface AiSummaryProps {
  content: string;
}

/**
 * Count syllables in a word (approximate English).
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/**
 * Flesch-Kincaid Grade Level
 */
function readingGrade(text: string): { grade: number; label: string; color: string } {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const words = text.split(/\s+/).filter(Boolean);
  if (sentences.length === 0 || words.length === 0) return { grade: 0, label: 'N/A', color: '#71717a' };

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (totalSyllables / words.length) - 15.59;
  const clamped = Math.max(1, Math.min(18, Math.round(grade)));

  if (clamped <= 6) return { grade: clamped, label: 'Easy', color: '#3fb950' };
  if (clamped <= 10) return { grade: clamped, label: 'Moderate', color: '#d29922' };
  if (clamped <= 14) return { grade: clamped, label: 'Advanced', color: '#f0883e' };
  return { grade: clamped, label: 'Technical', color: '#f85149' };
}

/**
 * Extract key points from markdown by grabbing the first meaningful sentence
 * after each heading (H1–H3).
 */
function extractSummaryPoints(content: string): string[] {
  const lines = content.split('\n');
  const points: string[] = [];
  let lastHeading = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);

    if (headingMatch) {
      lastHeading = headingMatch[1].replace(/[*_`\[\]]/g, '').trim();
      // Look ahead for the first non-empty, non-heading paragraph line
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const next = lines[j].trim();
        if (!next || next.startsWith('#') || next.startsWith('```') || next.startsWith('|') || next.startsWith('-') || next.startsWith('*') || next.startsWith('>')) continue;

        // Clean markdown syntax
        const cleaned = next
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
          .replace(/[*_`]/g, '')                     // bold/italic/code
          .replace(/!\[.*?\]\(.*?\)/g, '')           // images
          .trim();

        if (cleaned.length > 20) {
          // Truncate to first sentence
          const sentence = cleaned.split(/(?<=[.!?])\s/)[0] || cleaned;
          points.push(sentence.length > 180 ? sentence.slice(0, 177) + '...' : sentence);
          break;
        }
      }
    }
  }

  // Deduplicate and limit
  return [...new Set(points)].slice(0, 6);
}

/**
 * Extract auto-tags from content via keyword frequency.
 */
function extractTags(content: string): string[] {
  // Strip markdown formatting
  const text = content
    .replace(/```[\s\S]*?```/g, '')      // code blocks
    .replace(/`[^`]+`/g, '')             // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')     // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/[#*_>`|~\-\[\]()]/g, ' ') // markdown chars
    .toLowerCase();

  const words = text.split(/\s+/).filter((w) => w.length > 4);

  // Common stop words
  const stops = new Set(['about', 'above', 'after', 'again', 'being', 'below', 'between', 'could', 'would', 'should', 'their', 'there', 'these', 'those', 'through', 'under', 'until', 'where', 'which', 'while', 'other', 'using', 'within', 'without', 'before', 'during', 'having', 'because', 'every', 'first', 'second', 'third', 'still', 'might', 'since', 'based', 'following', 'example', 'different']);

  const freq = new Map<string, number>();
  for (const w of words) {
    if (stops.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return [...freq.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

export function AiSummary({ content }: AiSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const points = useMemo(() => extractSummaryPoints(content), [content]);
  const grade = useMemo(() => readingGrade(content), [content]);
  const tags = useMemo(() => extractTags(content), [content]);

  if (points.length === 0) return null;

  return (
    <div className="ai-summary-card">
      <button className="ai-summary-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="ai-summary-header-left">
          <Sparkles size={14} className="ai-summary-icon" />
          <span className="ai-summary-label">AI Summary</span>
          <span className="ai-summary-badge" style={{ color: grade.color, borderColor: `${grade.color}40` }}>
            <BarChart3 size={10} />
            Grade {grade.grade} · {grade.label}
          </span>
        </div>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="ai-summary-body">
          <div className="ai-summary-points">
            {points.map((point, i) => (
              <div key={i} className="ai-summary-point">
                <span className="ai-summary-bullet" />
                <span>{point}</span>
              </div>
            ))}
          </div>

          {tags.length > 0 && (
            <div className="ai-summary-tags">
              {tags.map((tag) => (
                <span key={tag} className="ai-summary-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
