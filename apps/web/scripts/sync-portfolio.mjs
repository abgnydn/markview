#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// sync-portfolio.mjs — pulls every project listed in apps/web/projects.json
// from GitHub (description / language / stars / topics / last-50-commits /
// README / CHANGELOG / latest tags) via one GraphQL query per repo, then
// writes static bundles under apps/web/public/portfolio/<slug>/ plus a
// single apps/web/public/portfolio/index.json that powers the /projects
// grid + commit river.
//
// Auth: reads GH_TOKEN or GITHUB_TOKEN from env. Locally:
//   GH_TOKEN=$(gh auth token) node apps/web/scripts/sync-portfolio.mjs
// In CI: secrets.GITHUB_TOKEN is provided automatically.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, "..");                       // apps/web
// Manifest lives next to this script (apps/web/scripts/projects.json),
// NOT in apps/web/ — Vite's dev server would otherwise resolve the URL
// /projects to the JSON file before the SPA fallback can hand it to the
// React router.
const MANIFEST  = resolve(__dirname, "projects.json");
const OUT_DIR   = resolve(ROOT, "public", "portfolio");
const TOKEN     = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("error: GH_TOKEN or GITHUB_TOKEN must be set.");
  console.error("       local: GH_TOKEN=$(gh auth token) node apps/web/scripts/sync-portfolio.mjs");
  process.exit(1);
}

// ── GraphQL ───────────────────────────────────────────────────────────────
const QUERY = `
query Project($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    description
    url
    stargazerCount
    isPrivate
    isArchived
    pushedAt
    primaryLanguage { name color }
    repositoryTopics(first: 12) { nodes { topic { name } } }
    defaultBranchRef {
      name
      target {
        ... on Commit {
          history(first: 50) {
            totalCount
            nodes {
              oid
              messageHeadline
              committedDate
              additions
              deletions
              url
            }
          }
        }
      }
    }
    readme: object(expression: "HEAD:README.md") {
      ... on Blob { text isTruncated }
    }
    changelog: object(expression: "HEAD:CHANGELOG.md") {
      ... on Blob { text isTruncated }
    }
    tags: refs(refPrefix: "refs/tags/", first: 5, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
      nodes { name }
    }
  }
}
`;

async function gql(variables, query = QUERY) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "authorization": `bearer ${TOKEN}`,
      "content-type": "application/json",
      "user-agent": "barisgunaydin-portfolio-sync",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`graphql ${res.status} ${res.statusText}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`graphql errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// Date-only paginated history — used to build the 90-day activity histogram
// without burning commit slots in the 500-entry river. Per-repo, walks
// every commit since $since (max 10 pages × 100 = 1000 commits/repo).
const ACTIVITY_QUERY = `
query Activity($owner: String!, $name: String!, $since: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, since: $since, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { committedDate }
          }
        }
      }
    }
  }
}
`;

async function fetchActivity(owner, name, sinceISO) {
  const dayCounts = new Map();
  let after = null;
  for (let page = 0; page < 10; page++) {
    const data = await gql({ owner, name, since: sinceISO, after }, ACTIVITY_QUERY);
    const history = data.repository?.defaultBranchRef?.target?.history;
    if (!history) break;
    for (const n of history.nodes) {
      const k = n.committedDate.slice(0, 10);
      dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
    }
    if (!history.pageInfo.hasNextPage) break;
    after = history.pageInfo.endCursor;
  }
  return dayCounts;
}

// ── helpers ───────────────────────────────────────────────────────────────
// Extends conventional-commits with the project-specific verbs that
// dominate this portfolio's history: `research(scope): ...` and
// `bench(scope): ...`.
const CONVENTIONAL_RE = /^(feat|fix|docs|refactor|test|chore|perf|style|build|ci|revert|research|bench)(\([^)]+\))?!?:/i;

function commitType(message) {
  const m = message.match(CONVENTIONAL_RE);
  return m ? m[1].toLowerCase() : "other";
}

function dayKey(iso) {
  // YYYY-MM-DD in UTC. Good enough for grouping; we don't need TZ-locality.
  return iso.slice(0, 10);
}

function timeOfDay(iso) {
  return iso.slice(11, 16); // HH:MM
}

function synthesizeChangelog(name, tags, commits) {
  // Tiny fallback when the repo has no CHANGELOG.md: list the tag names
  // we found and the latest dozen feat/fix commits. Markview will render
  // this beautifully; richer synthesis can come later.
  const tagList = tags.length
    ? tags.map((t) => `- \`${t}\``).join("\n")
    : "_no tags yet_";
  const highlights = commits
    .filter((c) => ["feat", "fix"].includes(c.type))
    .slice(0, 12)
    .map((c) => `- **${c.type}**: ${c.message} — [\`${c.short_sha}\`](${c.url})`)
    .join("\n");
  return [
    `# Changelog — ${name}`,
    ``,
    `_Synthesized from tags + conventional commits. No CHANGELOG.md in the repo yet._`,
    ``,
    `## Tags`,
    ``,
    tagList,
    ``,
    `## Recent highlights`,
    ``,
    highlights || "_no feat/fix commits in the last 50_",
    ``,
  ].join("\n");
}

function renderCommitsMd(name, commits) {
  if (commits.length === 0) return `# Commits — ${name}\n\n_no commits found_\n`;
  const days = new Map();
  for (const c of commits) {
    const k = dayKey(c.date);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(c);
  }
  const lines = [`# Commits — ${name}`, ``];
  for (const [day, list] of days) {
    lines.push(`## ${day}`, ``);
    for (const c of list) {
      const stats = `+${c.additions} −${c.deletions}`;
      lines.push(`- \`${timeOfDay(c.date)}\` **${c.message}** — ${stats} — [\`${c.short_sha}\`](${c.url})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function commitsLast30d(commits) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return commits.filter((c) => new Date(c.date).getTime() >= cutoff).length;
}

// ── per-project sync ──────────────────────────────────────────────────────
async function syncProject(entry) {
  const [owner, name] = entry.repo.split("/");
  const repo = await gql({ owner, name }).then((d) => d.repository);
  if (!repo) throw new Error(`repository not found: ${entry.repo}`);

  const branch  = repo.defaultBranchRef?.name ?? "main";
  const history = repo.defaultBranchRef?.target?.history?.nodes ?? [];
  const tags    = (repo.tags?.nodes ?? []).map((t) => t.name);

  const commits = history.map((c) => ({
    sha:       c.oid,
    short_sha: c.oid.slice(0, 7),
    message:   c.messageHeadline,
    type:      commitType(c.messageHeadline),
    date:      c.committedDate,
    url:       c.url,
    additions: c.additions,
    deletions: c.deletions,
  }));

  const slug = entry.slug;
  const bundleDir = resolve(OUT_DIR, slug);
  await mkdir(bundleDir, { recursive: true });

  // README — verbatim, or a placeholder so the workspace renders something.
  const readme = repo.readme?.text
    ?? `# ${slug}\n\n${repo.description ?? ""}\n\n_No README.md in this repo yet._\n`;
  await writeFile(resolve(bundleDir, "readme.md"), readme);

  // CHANGELOG — verbatim if present, else synthesize.
  const changelog = repo.changelog?.text
    ?? synthesizeChangelog(slug, tags, commits);
  await writeFile(resolve(bundleDir, "changelog.md"), changelog);

  // commits.md — day-grouped markdown.
  await writeFile(resolve(bundleDir, "commits.md"), renderCommitsMd(slug, commits));

  // Per-project summary for the grid.
  const summary = {
    slug,
    name:           slug,
    tagline:        entry.tagline ?? repo.description ?? "",
    repo:           entry.repo,
    repo_url:       repo.url,
    live_url:       entry.url ?? null,
    featured:       Boolean(entry.featured),
    order:          entry.order ?? null,
    private:        repo.isPrivate,
    archived:       repo.isArchived,
    language:       repo.primaryLanguage?.name ?? null,
    language_color: repo.primaryLanguage?.color ?? null,
    stars:          repo.stargazerCount,
    topics:         (repo.repositoryTopics?.nodes ?? []).map((t) => t.topic.name),
    pushed_at:      repo.pushedAt,
    default_branch: branch,
    latest_tag:     tags[0] ?? null,
    commits_30d:    commitsLast30d(commits),
    commits_synced: commits.length,
    last_commit:    commits[0] ?? null,
  };
  return { summary, commits };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  const manifestText = await readFile(MANIFEST, "utf8");
  const manifest     = JSON.parse(manifestText);
  const entries      = manifest.projects;

  // Fresh OUT_DIR each run so deleted projects vanish cleanly.
  if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`syncing ${entries.length} projects...`);
  const t0 = Date.now();

  // 90-day window for the heatmap/sparkline aggregate.
  const sinceISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const summaries = [];
  const allCommits = [];
  const activity90d = new Map(); // dayKey → count, aggregated across all repos
  const errors = [];

  for (const entry of entries) {
    process.stdout.write(`  ${entry.slug.padEnd(28)} `);
    try {
      const { summary, commits } = await syncProject(entry);
      summaries.push(summary);
      for (const c of commits) {
        allCommits.push({ slug: summary.slug, name: summary.name, language: summary.language, ...c });
      }
      // Pull the 90-day per-day activity histogram for this repo.
      const [owner, name] = entry.repo.split("/");
      const dayCounts = await fetchActivity(owner, name, sinceISO);
      let repoTotal = 0;
      for (const [day, n] of dayCounts) {
        activity90d.set(day, (activity90d.get(day) ?? 0) + n);
        repoTotal += n;
      }
      const tail = summary.last_commit
        ? `${summary.commits_synced} recent · ${repoTotal} in 90d`
        : "no commits";
      console.log(`✓ ${tail}`);
    } catch (err) {
      console.log(`✗ ${err.message.split("\n")[0]}`);
      errors.push({ slug: entry.slug, repo: entry.repo, error: String(err.message) });
    }
    // Be polite to the GraphQL endpoint.
    await new Promise((r) => setTimeout(r, 40));
  }

  // Global commit river — newest first, cap at 500.
  allCommits.sort((a, b) => (a.date < b.date ? 1 : -1));
  const river = allCommits.slice(0, 500);

  // Sort grid: featured first (by order), then by pushed_at desc.
  summaries.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.featured && b.featured) return (a.order ?? 99) - (b.order ?? 99);
    return a.pushed_at < b.pushed_at ? 1 : -1;
  });

  // Convert activity Map → sorted plain object for the JSON.
  const activity = Object.fromEntries(
    Array.from(activity90d.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  );
  const activityTotal = Object.values(activity).reduce((a, n) => a + n, 0);

  const index = {
    generated_at: new Date().toISOString(),
    project_count: summaries.length,
    river_count: river.length,
    activity_90d_total: activityTotal,
    activity_90d: activity,        // { "YYYY-MM-DD": count, ... }
    projects: summaries,
    commits: river,
    errors,
  };
  await writeFile(resolve(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\ndone — ${summaries.length} ok, ${errors.length} errors, ${river.length} commits in river, ${dt}s`);
  if (errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
