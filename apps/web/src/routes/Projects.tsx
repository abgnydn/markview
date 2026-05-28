// SPDX-License-Identifier: Apache-2.0
//
// Projects — the portfolio hub. Loads /portfolio/index.json (synced daily
// by scripts/sync-portfolio.mjs) and renders three stacked surfaces on
// zen paper: a featured row, a day-grouped commit river with filter
// chips, and a full project grid. Per-project deep view lives at
// /p/:slug (M3).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./projects.css";

interface LastCommit {
  sha: string;
  short_sha: string;
  message: string;
  type: string;
  date: string;
  url: string;
  additions: number;
  deletions: number;
}

interface Project {
  slug: string;
  name: string;
  tagline: string;
  repo: string;
  repo_url: string;
  live_url: string | null;
  featured: boolean;
  order: number | null;
  private: boolean;
  archived: boolean;
  language: string | null;
  language_color: string | null;
  stars: number;
  topics: string[];
  pushed_at: string;
  default_branch: string;
  latest_tag: string | null;
  commits_30d: number;
  commits_synced: number;
  last_commit: LastCommit | null;
}

interface RiverCommit extends LastCommit {
  slug: string;
  name: string;
  language: string | null;
}

interface PortfolioIndex {
  generated_at: string;
  project_count: number;
  river_count: number;
  projects: Project[];
  commits: RiverCommit[];
  errors: { slug: string; repo: string; error: string }[];
}

const FILTERS = ["all", "feat", "fix", "docs", "research", "bench", "perf"] as const;
type Filter = (typeof FILTERS)[number];

// ── helpers ──────────────────────────────────────────────────────────────
function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return fmt.format(d);
}

function timeOfDay(iso: string) {
  return iso.slice(11, 16);
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 14) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 8) return `${w}w ago`;
  const mo = Math.round(d / 30);
  return `${mo}mo ago`;
}

function commitsThisWeek(commits: RiverCommit[]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return commits.filter((c) => new Date(c.date).getTime() >= cutoff).length;
}

function isLive(iso: string | null | undefined) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

function groupByDay(commits: RiverCommit[]): Array<[string, RiverCommit[]]> {
  const map = new Map<string, RiverCommit[]>();
  for (const c of commits) {
    const k = dayKey(c.date);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  return Array.from(map.entries());
}

// ── small components ─────────────────────────────────────────────────────
function FeaturedCard({ p }: { p: Project }) {
  const live = isLive(p.last_commit?.date);
  return (
    <Link to={`/p/${p.slug}`} className={`proj-feat ${live ? "is-live" : ""}`}>
      <div className="proj-feat-head">
        <span className="proj-feat-eyebrow">
          {String(p.order ?? 0).padStart(2, "0")} · {p.language ?? "—"}
          {p.private ? " · private" : ""}
        </span>
        {live && <span className="proj-pulse" aria-label="live" />}
      </div>
      <h3 className="proj-feat-title">{p.name}</h3>
      <p className="proj-feat-tag">{p.tagline}</p>
      <div className="proj-feat-foot">
        <span>{p.commits_30d} commits · 30d</span>
        {p.last_commit && <span>last {timeAgo(p.last_commit.date)}</span>}
      </div>
    </Link>
  );
}

function RiverEntry({
  c,
  onProject,
}: {
  c: RiverCommit;
  onProject: (slug: string) => void;
}) {
  const stats =
    c.additions || c.deletions ? `+${c.additions} −${c.deletions}` : "";
  return (
    <div className="proj-river-row">
      <span className="proj-river-time">{timeOfDay(c.date)}</span>
      <button
        type="button"
        className="proj-river-slug"
        onClick={() => onProject(c.slug)}
        title={`filter river to ${c.slug}`}
      >
        {c.slug}
      </button>
      <a
        className="proj-river-msg"
        href={c.url}
        target="_blank"
        rel="noreferrer noopener"
      >
        {c.message}
      </a>
      {stats && <span className="proj-river-stats">{stats}</span>}
      {c.language && <span className="proj-river-lang">{c.language}</span>}
    </div>
  );
}

function GridCard({ p }: { p: Project }) {
  const live = isLive(p.last_commit?.date);
  return (
    <Link to={`/p/${p.slug}`} className={`proj-grid-card ${live ? "is-live" : ""}`}>
      <div className="proj-grid-head">
        <span className="proj-grid-name">{p.name}</span>
        {p.private && <span className="proj-grid-lock" aria-label="private">◆</span>}
        {live && <span className="proj-pulse" />}
      </div>
      {p.tagline && <p className="proj-grid-tag">{p.tagline}</p>}
      <div className="proj-grid-foot">
        <span className="proj-grid-lang">{p.language ?? "—"}</span>
        {p.last_commit && (
          <span className="proj-grid-when">last {timeAgo(p.last_commit.date)}</span>
        )}
      </div>
    </Link>
  );
}

// ── route ────────────────────────────────────────────────────────────────
export default function Projects() {
  const [index, setIndex] = useState<PortfolioIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  // /projects is a single-column reading surface — undo the editor's
  // body-locked overflow while this route is mounted.
  useEffect(() => {
    document.body.classList.add("proj-route-mounted");
    return () => document.body.classList.remove("proj-route-mounted");
  }, []);

  useEffect(() => {
    fetch("/portfolio/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: PortfolioIndex) => setIndex(data))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const featured = useMemo(
    () => (index?.projects ?? []).filter((p) => p.featured),
    [index]
  );
  const rest = useMemo(
    () => (index?.projects ?? []).filter((p) => !p.featured),
    [index]
  );

  const filteredCommits = useMemo(() => {
    if (!index) return [] as RiverCommit[];
    return index.commits.filter((c) => {
      if (filter !== "all" && c.type !== filter) return false;
      if (projectFilter && c.slug !== projectFilter) return false;
      return true;
    });
  }, [index, filter, projectFilter]);

  const days = useMemo(() => groupByDay(filteredCommits), [filteredCommits]);

  if (error) {
    return (
      <div className="proj-shell">
        <p className="proj-error">failed to load portfolio · {error}</p>
      </div>
    );
  }
  if (!index) {
    return (
      <div className="proj-shell">
        <p className="proj-loading">loading…</p>
      </div>
    );
  }

  const totalCommitsWeek = commitsThisWeek(index.commits);
  const langs = new Set(
    index.projects.map((p) => p.language).filter(Boolean) as string[]
  );

  return (
    <div className="proj-shell">
      <header className="proj-masthead">
        <p className="proj-mast-eyebrow">portfolio · barisgunaydin.com</p>
        <h1 className="proj-mast-title">Projects</h1>
        <p className="proj-mast-stats">
          <span>{index.project_count} repos</span>
          <span>·</span>
          <span>{totalCommitsWeek} commits this week</span>
          <span>·</span>
          <span>{langs.size} languages</span>
          <span>·</span>
          <span>last sync {timeAgo(index.generated_at)}</span>
        </p>
      </header>

      <section className="proj-section">
        <h2 className="proj-section-title">Featured</h2>
        <div className="proj-featured-row">
          {featured.map((p) => (
            <FeaturedCard key={p.slug} p={p} />
          ))}
        </div>
      </section>

      <section className="proj-section">
        <div className="proj-section-head">
          <h2 className="proj-section-title">Commit river</h2>
          <div className="proj-filter-bar">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`proj-chip ${filter === f ? "is-active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
            {projectFilter && (
              <button
                type="button"
                className="proj-chip proj-chip-pin"
                onClick={() => setProjectFilter(null)}
              >
                {projectFilter} ✕
              </button>
            )}
          </div>
        </div>
        {days.length === 0 ? (
          <p className="proj-river-empty">
            no commits match these filters in the synced window
          </p>
        ) : (
          <div className="proj-river">
            {days.map(([day, list], i) => (
              <div className="proj-river-day" key={day}>
                <div className="proj-river-day-label">{dayLabel(day)}</div>
                <div className="proj-river-list">
                  {list.map((c) => (
                    <RiverEntry
                      key={c.sha}
                      c={c}
                      onProject={setProjectFilter}
                    />
                  ))}
                </div>
                {i < days.length - 1 && (
                  <div className="proj-asterism" aria-hidden>
                    · · ·
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="proj-section">
        <h2 className="proj-section-title">All projects</h2>
        <div className="proj-grid">
          {rest.map((p) => (
            <GridCard key={p.slug} p={p} />
          ))}
        </div>
      </section>

      <footer className="proj-footer">
        <span>generated {new Date(index.generated_at).toUTCString()}</span>
        <span>·</span>
        <a href="https://barisgunaydin.com">barisgunaydin.com</a>
      </footer>
    </div>
  );
}
