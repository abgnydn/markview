// SPDX-License-Identifier: Apache-2.0
//
// Projects — portfolio hub. Loads /portfolio/index.json (synced daily by
// scripts/sync-portfolio.mjs) and renders five surfaces on zen paper:
// (1) a 6-stat masthead, (2) a 52-week activity heatmap aggregated across
// all repos, (3) a 90-day commits-per-day sparkline, (4) a featured row
// of hero projects, (5) a filterable + searchable commit river with
// burst grouping, and (6) a searchable + sortable + groupable project
// grid. Per-project deep view lives at /p/:slug.

import { useEffect, useMemo, useRef, useState } from "react";
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
  activity_90d_total?: number;
  activity_90d?: Record<string, number>; // dayKey → count, aggregated across all repos
  projects: Project[];
  commits: RiverCommit[];
  errors: { slug: string; repo: string; error: string }[];
}

const TYPE_FILTERS = ["all", "feat", "fix", "docs", "research", "bench", "perf"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const DATE_RANGES = ["all", "today", "7d", "30d"] as const;
type DateRange = (typeof DATE_RANGES)[number];

const GRID_SORTS = ["recent", "commits", "stars", "alpha"] as const;
type GridSort = (typeof GRID_SORTS)[number];

const GRID_GROUPS = ["none", "language", "live"] as const;
type GridGroup = (typeof GRID_GROUPS)[number];

// Conventional-commit type → accent color. Falls back to ghost for
// untyped / "other" / chore-y commits.
const TYPE_COLORS: Record<string, string> = {
  feat: "#9b7dff",      // violet (matches --proj-accent)
  fix: "#e07a5f",       // burnt orange
  docs: "#7ab989",      // sage green
  research: "#5ea1e6",  // blue
  bench: "#e0bd7a",     // amber
  perf: "#bc8cff",      // light violet
  refactor: "#a5a5b2",
  test: "#a5a5b2",
  chore: "rgba(236,232,224,0.32)",
  ci: "rgba(236,232,224,0.32)",
  build: "rgba(236,232,224,0.32)",
  style: "rgba(236,232,224,0.32)",
  other: "rgba(236,232,224,0.20)",
};
const typeColor = (t: string) => TYPE_COLORS[t] ?? TYPE_COLORS.other;

// ── helpers ──────────────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
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

function todayUTCKey() {
  return new Date().toISOString().slice(0, 10);
}

function isLive(iso: string | null | undefined) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < DAY_MS;
}

function inRange(iso: string, range: DateRange) {
  if (range === "all") return true;
  const t = new Date(iso).getTime();
  const now = Date.now();
  if (range === "today") return iso.slice(0, 10) === todayUTCKey();
  if (range === "7d") return now - t <= 7 * DAY_MS;
  if (range === "30d") return now - t <= 30 * DAY_MS;
  return true;
}

function commitMatches(c: RiverCommit, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    c.message.toLowerCase().includes(needle) ||
    c.slug.toLowerCase().includes(needle) ||
    (c.language ?? "").toLowerCase().includes(needle)
  );
}

function projectMatches(p: Project, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    p.slug.toLowerCase().includes(needle) ||
    (p.tagline ?? "").toLowerCase().includes(needle) ||
    (p.language ?? "").toLowerCase().includes(needle) ||
    p.topics.some((t) => t.toLowerCase().includes(needle))
  );
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

// Burst = ≥3 consecutive same-slug, same-day commits in the (already
// chronologically-sorted) river. Collapsed by default; expandable.
type RiverItem =
  | { kind: "commit"; commit: RiverCommit }
  | {
      kind: "burst";
      slug: string;
      language: string | null;
      commits: RiverCommit[];
      key: string;
    };

function groupBursts(commits: RiverCommit[]): RiverItem[] {
  const out: RiverItem[] = [];
  let i = 0;
  while (i < commits.length) {
    const c = commits[i];
    let j = i + 1;
    while (
      j < commits.length &&
      commits[j].slug === c.slug &&
      dayKey(commits[j].date) === dayKey(c.date)
    ) {
      j++;
    }
    const run = commits.slice(i, j);
    if (run.length >= 3) {
      out.push({
        kind: "burst",
        slug: c.slug,
        language: c.language,
        commits: run,
        key: `${c.slug}@${dayKey(c.date)}:${i}`,
      });
    } else {
      for (const x of run) out.push({ kind: "commit", commit: x });
    }
    i = j;
  }
  return out;
}

// 90-day calendar grid for the activity heatmap. Returns a 7×N matrix
// where N is the number of weeks shown (~13–14 depending on weekday math).
// Reads from the pre-aggregated activity_90d map (which sees every commit
// in the window, not just the 500-entry river).
function buildHeatmap(activity: Record<string, number>) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Walk back 89 days. Align grid so today is in the rightmost column.
  const days: { date: string; count: number; weekday: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    days.push({ date: k, count: activity[k] ?? 0, weekday: d.getUTCDay() });
  }
  // Pad the first column so it lines up with the day-of-week of the
  // earliest day (so each column is a complete Sun→Sat week visually).
  const firstWeekday = days[0].weekday;
  const padded: ({
    date: string;
    count: number;
    weekday: number;
  } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) padded.push(null);
  padded.push(...days);
  // Bucket into 7-row columns.
  const cols: ({
    date: string;
    count: number;
    weekday: number;
  } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
  const max = Math.max(...days.map((d) => d.count), 1);
  return { cols, max };
}

// 90-day commits-per-day series for the sparkline. Reads from the same
// pre-aggregated activity_90d map as the heatmap.
function buildSparkline(activity: Record<string, number>) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const points: { x: number; y: number; date: string }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    points.push({ x: 89 - i, y: activity[k] ?? 0, date: k });
  }
  const max = Math.max(...points.map((p) => p.y), 1);
  return { points, max };
}

// ── small components ─────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="proj-stat">
      <div className="proj-stat-value">{value}</div>
      <div className="proj-stat-label">{label}</div>
    </div>
  );
}

function LangChip({
  language,
  color,
  small = false,
}: {
  language: string | null;
  color: string | null;
  small?: boolean;
}) {
  if (!language) return null;
  return (
    <span className={`proj-lang-chip${small ? " is-small" : ""}`}>
      <span
        className="proj-lang-dot"
        style={{ background: color ?? "rgba(236,232,224,0.4)" }}
      />
      <span>{language}</span>
    </span>
  );
}

function TypeChip({ type }: { type: string }) {
  return (
    <span
      className="proj-type-chip"
      style={{
        color: typeColor(type),
        borderColor: type === "other" ? "transparent" : typeColor(type),
      }}
      title={`type: ${type}`}
    >
      {type}
    </span>
  );
}

function DiffBar({ adds, dels }: { adds: number; dels: number }) {
  const total = adds + dels;
  if (total === 0) {
    return <span className="proj-diff-empty" title="no diff">·</span>;
  }
  const addsPct = (adds / total) * 100;
  const delsPct = (dels / total) * 100;
  return (
    <span className="proj-diff" title={`+${adds} −${dels}`}>
      <span className="proj-diff-text">+{adds}</span>
      <span className="proj-diff-bar" aria-hidden>
        <span
          className="proj-diff-adds"
          style={{ width: `${addsPct}%` }}
        />
        <span
          className="proj-diff-dels"
          style={{ width: `${delsPct}%` }}
        />
      </span>
      <span className="proj-diff-text proj-diff-dels-text">−{dels}</span>
    </span>
  );
}

function FeaturedCard({ p }: { p: Project }) {
  const live = isLive(p.last_commit?.date);
  return (
    <Link to={`/p/${p.slug}`} className={`proj-feat ${live ? "is-live" : ""}`}>
      <div className="proj-feat-head">
        <span className="proj-feat-eyebrow">
          {String(p.order ?? 0).padStart(2, "0")}
          {p.private ? " · private" : ""}
        </span>
        {live && <span className="proj-pulse" aria-label="live" />}
      </div>
      <h3 className="proj-feat-title">{p.name}</h3>
      <p className="proj-feat-tag">{p.tagline}</p>
      {p.last_commit && (
        <div className="proj-feat-msg" title={p.last_commit.message}>
          <TypeChip type={p.last_commit.type} />
          <span className="proj-feat-msg-text">{p.last_commit.message}</span>
        </div>
      )}
      <div className="proj-feat-chips">
        <LangChip language={p.language} color={p.language_color} />
        {p.live_url && (
          <a
            className="proj-chip-link"
            href={p.live_url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
          >
            live ↗
          </a>
        )}
        {p.latest_tag && (
          <span className="proj-tag-pill">{p.latest_tag}</span>
        )}
        {p.stars > 0 && (
          <span className="proj-star-pill">★ {p.stars}</span>
        )}
      </div>
      {p.topics.length > 0 && (
        <div className="proj-feat-topics">
          {p.topics.slice(0, 3).map((t) => (
            <span key={t} className="proj-topic">{t}</span>
          ))}
        </div>
      )}
      <div className="proj-feat-foot">
        <span>{p.commits_30d} commits · 30d</span>
        {p.last_commit && <span>last {timeAgo(p.last_commit.date)}</span>}
      </div>
    </Link>
  );
}

function RiverRow({
  c,
  onProject,
}: {
  c: RiverCommit;
  onProject: (slug: string) => void;
}) {
  return (
    <div className="proj-river-row">
      <span className="proj-river-time">{timeOfDay(c.date)}</span>
      <span
        className="proj-river-typebar"
        style={{ background: typeColor(c.type) }}
        aria-hidden
      />
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
      <DiffBar adds={c.additions} dels={c.deletions} />
      {c.language && <span className="proj-river-lang">{c.language}</span>}
    </div>
  );
}

function BurstRow({
  burst,
  expanded,
  onToggle,
  onProject,
}: {
  burst: Extract<RiverItem, { kind: "burst" }>;
  expanded: boolean;
  onToggle: () => void;
  onProject: (slug: string) => void;
}) {
  const first = burst.commits[0];
  const last = burst.commits[burst.commits.length - 1];
  const adds = burst.commits.reduce((a, c) => a + c.additions, 0);
  const dels = burst.commits.reduce((a, c) => a + c.deletions, 0);
  const tStart = timeOfDay(last.date); // last == oldest (chrono desc river)
  const tEnd = timeOfDay(first.date);
  return (
    <div className={`proj-burst ${expanded ? "is-open" : ""}`}>
      <button
        type="button"
        className="proj-burst-head"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="proj-river-time">{tStart}–{tEnd}</span>
        <span
          className="proj-river-typebar"
          style={{ background: typeColor("other") }}
          aria-hidden
        />
        <span
          className="proj-river-slug proj-burst-slug"
          onClick={(e) => {
            e.stopPropagation();
            onProject(burst.slug);
          }}
        >
          {burst.slug}
        </span>
        <span className="proj-burst-summary">
          {burst.commits.length} commits {expanded ? "▾" : "▸"}
        </span>
        <DiffBar adds={adds} dels={dels} />
        {burst.language && (
          <span className="proj-river-lang">{burst.language}</span>
        )}
      </button>
      {expanded && (
        <div className="proj-burst-list">
          {burst.commits.map((c) => (
            <RiverRow key={c.sha} c={c} onProject={onProject} />
          ))}
        </div>
      )}
    </div>
  );
}

function GridCard({
  p,
  recent,
}: {
  p: Project;
  recent: RiverCommit[];
}) {
  const live = isLive(p.last_commit?.date);
  return (
    <Link to={`/p/${p.slug}`} className={`proj-grid-card ${live ? "is-live" : ""}`}>
      <div className="proj-grid-head">
        <span className="proj-grid-name">{p.name}</span>
        {p.private && <span className="proj-grid-lock" aria-label="private">◆</span>}
        {p.live_url && (
          <span
            className="proj-grid-live-dot"
            title={`live: ${p.live_url}`}
          />
        )}
        {live && <span className="proj-pulse" />}
      </div>
      {p.tagline && <p className="proj-grid-tag">{p.tagline}</p>}
      {p.topics.length > 0 && (
        <div className="proj-grid-topics">
          {p.topics.slice(0, 3).map((t) => (
            <span key={t} className="proj-topic">{t}</span>
          ))}
        </div>
      )}
      <div className="proj-grid-foot">
        <LangChip language={p.language} color={p.language_color} small />
        <span className="proj-grid-when">
          {p.commits_synced} commits
          {p.last_commit && <> · {timeAgo(p.last_commit.date)}</>}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="proj-grid-hover">
          <div className="proj-grid-hover-label">recent</div>
          {recent.map((c) => (
            <div className="proj-grid-hover-row" key={c.sha}>
              <span
                className="proj-river-typebar"
                style={{ background: typeColor(c.type) }}
                aria-hidden
              />
              <span className="proj-grid-hover-time">
                {timeAgo(c.date)}
              </span>
              <span className="proj-grid-hover-msg">{c.message}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

// ── route ────────────────────────────────────────────────────────────────
export default function Projects() {
  const [index, setIndex] = useState<PortfolioIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  // River filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [riverSearch, setRiverSearch] = useState("");
  const [expandedBursts, setExpandedBursts] = useState<Set<string>>(new Set());

  // Grid controls
  const [gridSearch, setGridSearch] = useState("");
  const [gridSort, setGridSort] = useState<GridSort>("recent");
  const [gridGroup, setGridGroup] = useState<GridGroup>("none");

  // /projects is a single-column reading surface — undo the editor's
  // body-locked overflow while this route is mounted.
  useEffect(() => {
    document.body.classList.add("proj-route-mounted");
    return () => document.body.classList.remove("proj-route-mounted");
  }, []);

  useEffect(() => {
    fetch("/portfolio/index.json")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
      )
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

  // Per-project last-3 commits, for grid card hover-reveal.
  const recentByProject = useMemo(() => {
    const map = new Map<string, RiverCommit[]>();
    if (!index) return map;
    for (const c of index.commits) {
      if (!map.has(c.slug)) map.set(c.slug, []);
      const list = map.get(c.slug)!;
      if (list.length < 3) list.push(c);
    }
    return map;
  }, [index]);

  const filteredCommits = useMemo(() => {
    if (!index) return [] as RiverCommit[];
    return index.commits.filter(
      (c) =>
        (typeFilter === "all" || c.type === typeFilter) &&
        (!projectFilter || c.slug === projectFilter) &&
        inRange(c.date, dateRange) &&
        commitMatches(c, riverSearch)
    );
  }, [index, typeFilter, projectFilter, dateRange, riverSearch]);

  const days = useMemo(() => groupByDay(filteredCommits), [filteredCommits]);

  const stats = useMemo(() => {
    if (!index) return null;
    const commits = index.commits;
    const now = Date.now();
    const today = todayUTCKey();
    const week = commits.filter((c) => now - new Date(c.date).getTime() <= 7 * DAY_MS);
    const month = commits.filter((c) => now - new Date(c.date).getTime() <= 30 * DAY_MS);
    const todayList = commits.filter((c) => dayKey(c.date) === today);
    const active7d = new Set(week.map((c) => c.slug)).size;
    const synced = index.projects.reduce((a, p) => a + (p.commits_synced ?? 0), 0);
    const langs = new Set(
      index.projects.map((p) => p.language).filter(Boolean) as string[]
    ).size;
    const adds = todayList.reduce((a, c) => a + (c.additions ?? 0), 0);
    const dels = todayList.reduce((a, c) => a + (c.deletions ?? 0), 0);
    const typeCounts: Record<string, number> = {};
    for (const c of todayList) typeCounts[c.type] = (typeCounts[c.type] ?? 0) + 1;
    const topType =
      Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return {
      projects: index.project_count,
      week: week.length,
      month: month.length,
      synced,
      active7d,
      langs,
      todayCount: todayList.length,
      todayProjects: new Set(todayList.map((c) => c.slug)).size,
      todayAdds: adds,
      todayDels: dels,
      topType,
    };
  }, [index]);

  // Fall back to the river-derived view for backward compatibility if an
  // older index.json doesn't carry the aggregate field yet.
  const activity = useMemo(() => {
    if (!index) return {} as Record<string, number>;
    if (index.activity_90d) return index.activity_90d;
    const m: Record<string, number> = {};
    for (const c of index.commits) {
      const k = dayKey(c.date);
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [index]);

  const heatmap = useMemo(() => buildHeatmap(activity), [activity]);
  const sparkline = useMemo(() => buildSparkline(activity), [activity]);

  // Grid: search → sort → group
  const filteredGrid = useMemo(() => {
    const arr = rest.filter((p) => projectMatches(p, gridSearch));
    arr.sort((a, b) => {
      switch (gridSort) {
        case "commits":
          return (b.commits_synced ?? 0) - (a.commits_synced ?? 0);
        case "stars":
          return (b.stars ?? 0) - (a.stars ?? 0);
        case "alpha":
          return a.slug.localeCompare(b.slug);
        case "recent":
        default:
          return a.pushed_at < b.pushed_at ? 1 : -1;
      }
    });
    return arr;
  }, [rest, gridSearch, gridSort]);

  const groupedGrid = useMemo(() => {
    if (gridGroup === "none") return [["", filteredGrid]] as Array<[string, Project[]]>;
    const groups = new Map<string, Project[]>();
    for (const p of filteredGrid) {
      let key = "";
      if (gridGroup === "language") key = p.language ?? "—";
      else if (gridGroup === "live") key = p.live_url ? "live demo" : "code only";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredGrid, gridGroup]);

  if (error) {
    return (
      <div className="proj-shell">
        <p className="proj-error">failed to load portfolio · {error}</p>
      </div>
    );
  }
  if (!index || !stats) {
    return (
      <div className="proj-shell">
        <p className="proj-loading">loading…</p>
      </div>
    );
  }

  const toggleBurst = (key: string) => {
    setExpandedBursts((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Sparkline path
  const sparkW = 720;
  const sparkH = 56;
  const sparkPath = sparkline
    ? sparkline.points
        .map((p, i) => {
          const x = (p.x / 89) * sparkW;
          const y = sparkH - (p.y / sparkline.max) * (sparkH - 4) - 2;
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : "";
  const sparkAreaPath = sparkPath
    ? `${sparkPath} L${sparkW},${sparkH} L0,${sparkH} Z`
    : "";

  return (
    <div className="proj-shell">
      <header className="proj-masthead">
        <p className="proj-mast-eyebrow">portfolio · barisgunaydin.com</p>
        <h1 className="proj-mast-title">Projects</h1>

        <div className="proj-stat-grid">
          <Stat label="projects" value={stats.projects} />
          <Stat label="commits · 7d" value={stats.week} />
          <Stat label="commits · 30d" value={stats.month} />
          <Stat label="commits synced" value={stats.synced.toLocaleString()} />
          <Stat label="active · 7d" value={stats.active7d} />
          <Stat label="languages" value={stats.langs} />
        </div>

        <p className="proj-mast-sync">
          last sync {timeAgo(index.generated_at)} · {index.river_count} commits in river
        </p>
      </header>

      {/* Heatmap */}
      {heatmap && (
        <section className="proj-section proj-section-tight">
          <h2 className="proj-section-title">90 days across all repos</h2>
          <div className="proj-heatmap" role="img" aria-label="commit activity heatmap">
            {heatmap.cols.map((col, ci) => (
              <div className="proj-heatmap-col" key={ci}>
                {col.map((cell, ri) =>
                  cell ? (
                    <button
                      key={ri}
                      type="button"
                      className="proj-heatmap-cell"
                      style={{
                        background:
                          cell.count === 0
                            ? "rgba(236,232,224,0.06)"
                            : `rgba(155,125,255,${Math.min(0.18 + (cell.count / heatmap.max) * 0.82, 1)})`,
                      }}
                      title={`${cell.date} — ${cell.count} commit${cell.count === 1 ? "" : "s"}`}
                      onClick={() => {
                        setRiverSearch("");
                        setProjectFilter(null);
                        setTypeFilter("all");
                        // Pin date by switching to "today" if it IS today, else
                        // narrow river to that specific day via search-by-date.
                        if (cell.date === todayUTCKey()) {
                          setDateRange("today");
                        } else {
                          setDateRange("all");
                          setRiverSearch(""); // we don't have a per-day filter; rely on scroll
                          // Smooth-scroll to the matching day header.
                          const el = document.getElementById(`day-${cell.date}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                    />
                  ) : (
                    <div key={ri} className="proj-heatmap-cell is-pad" />
                  )
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sparkline */}
      {sparkline && (
        <section className="proj-section proj-section-tight">
          <h2 className="proj-section-title">90-day rhythm</h2>
          <svg
            className="proj-sparkline"
            viewBox={`0 0 ${sparkW} ${sparkH}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="90-day commits per day sparkline"
          >
            <path d={sparkAreaPath} className="proj-sparkline-area" />
            <path d={sparkPath} className="proj-sparkline-line" />
          </svg>
        </section>
      )}

      {/* Featured */}
      <section className="proj-section">
        <h2 className="proj-section-title">Featured</h2>
        <div className="proj-featured-row">
          {featured.map((p) => (
            <FeaturedCard key={p.slug} p={p} />
          ))}
        </div>
      </section>

      {/* Today panel */}
      {stats.todayCount > 0 && (
        <section className="proj-section proj-section-tight">
          <div className="proj-today">
            <span className="proj-today-label">today</span>
            <span className="proj-today-stat">
              <b>{stats.todayCount}</b> commits
            </span>
            <span className="proj-today-stat">
              across <b>{stats.todayProjects}</b> repos
            </span>
            <span className="proj-today-stat">
              <span className="proj-today-adds">+{stats.todayAdds}</span>
              {" "}
              <span className="proj-today-dels">−{stats.todayDels}</span>
            </span>
            <span className="proj-today-stat">
              top type: <TypeChip type={stats.topType} />
            </span>
          </div>
        </section>
      )}

      {/* River */}
      <section className="proj-section">
        <div className="proj-section-head">
          <h2 className="proj-section-title">Commit river</h2>
          <div className="proj-controls">
            <input
              type="search"
              className="proj-input"
              placeholder="search commits…"
              value={riverSearch}
              onChange={(e) => setRiverSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="proj-filter-bar">
          <div className="proj-filter-group">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`proj-chip ${typeFilter === f ? "is-active" : ""}`}
                onClick={() => setTypeFilter(f)}
                style={
                  f !== "all" && typeFilter === f
                    ? {
                        color: typeColor(f),
                        borderColor: typeColor(f),
                      }
                    : undefined
                }
              >
                {f}
              </button>
            ))}
          </div>
          <div className="proj-filter-group">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`proj-chip ${dateRange === r ? "is-active" : ""}`}
                onClick={() => setDateRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
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

        {days.length === 0 ? (
          <p className="proj-river-empty">no commits match these filters</p>
        ) : (
          <div className="proj-river">
            {days.map(([day, list], i) => {
              const items = groupBursts(list);
              return (
                <div className="proj-river-day" key={day} id={`day-${day}`}>
                  <div className="proj-river-day-label">{dayLabel(day)}</div>
                  <div className="proj-river-list">
                    {items.map((it) =>
                      it.kind === "commit" ? (
                        <RiverRow
                          key={it.commit.sha}
                          c={it.commit}
                          onProject={setProjectFilter}
                        />
                      ) : (
                        <BurstRow
                          key={it.key}
                          burst={it}
                          expanded={expandedBursts.has(it.key)}
                          onToggle={() => toggleBurst(it.key)}
                          onProject={setProjectFilter}
                        />
                      )
                    )}
                  </div>
                  {i < days.length - 1 && (
                    <div className="proj-asterism" aria-hidden>
                      · · ·
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Grid */}
      <section className="proj-section">
        <div className="proj-section-head">
          <h2 className="proj-section-title">All projects</h2>
          <div className="proj-controls">
            <input
              type="search"
              className="proj-input"
              placeholder="search projects…"
              value={gridSearch}
              onChange={(e) => setGridSearch(e.target.value)}
            />
            <select
              className="proj-select"
              value={gridSort}
              onChange={(e) => setGridSort(e.target.value as GridSort)}
              aria-label="sort"
            >
              <option value="recent">sort: recent</option>
              <option value="commits">sort: commits</option>
              <option value="stars">sort: stars</option>
              <option value="alpha">sort: a→z</option>
            </select>
            <select
              className="proj-select"
              value={gridGroup}
              onChange={(e) => setGridGroup(e.target.value as GridGroup)}
              aria-label="group"
            >
              <option value="none">group: none</option>
              <option value="language">group: language</option>
              <option value="live">group: live demo</option>
            </select>
          </div>
        </div>

        {groupedGrid.map(([groupName, list]) => (
          <div key={groupName || "all"} className="proj-grid-group">
            {groupName && (
              <div className="proj-grid-group-label">
                {groupName} · {list.length}
              </div>
            )}
            <div className="proj-grid">
              {list.map((p) => (
                <GridCard
                  key={p.slug}
                  p={p}
                  recent={recentByProject.get(p.slug) ?? []}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <footer className="proj-footer">
        <span>generated {new Date(index.generated_at).toUTCString()}</span>
        <span>·</span>
        <a href="https://barisgunaydin.com">barisgunaydin.com</a>
      </footer>
    </div>
  );
}
