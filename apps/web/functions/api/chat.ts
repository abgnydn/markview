// SPDX-License-Identifier: Apache-2.0
//
// Cloudflare Pages Function — /api/chat
// Pipes chat requests to Cloudflare Workers AI (Llama-3.3-70B by default,
// gpt-oss-20b as alt). Free tier: ~10k neurons/day, plenty for a portfolio
// chat. No API key, no Anthropic billing, no Google dependency — same
// Cloudflare account that already serves markview.ai.
//
// Request shape:
//   POST /api/chat
//   { messages: [{role, content}], stream?: boolean, model?: string }
//
// Response: text/event-stream by default (chunked tokens), or JSON when
// stream: false.
//
// Abuse guards (this endpoint spends a shared, exhaustible free quota):
//   1. Origin allowlist — 403 for anything else, and the allowed origin is
//      echoed back instead of `*`.
//   2. Per-IP sliding window, best-effort (see RATE_LIMIT_* below) — 429.
//   3. Body size + message-count caps, so one call can't burn the day's
//      neurons — 413 / 400.

interface Env {
  AI: Ai;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  stream?: boolean;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ALLOWED_MODELS = new Set<string>([
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/openai/gpt-oss-20b",
  "@cf/qwen/qwen2.5-coder-32b-instruct",
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
]);

// Origin allowlist. Only our own surfaces may drive this endpoint.
//
// A request with *no* Origin is refused: browsers attach Origin to every POST
// — same-origin included, because Fetch appends it for any non-GET/HEAD method
// — and the site's `Referrer-Policy: strict-origin-when-cross-origin` keeps
// the real value (it only nulls Origin on an https→http downgrade, which
// can't happen here). So a missing Origin means a non-browser client, which
// is exactly the casual `curl` freeloading this is meant to stop.
const ALLOWED_ORIGINS = [
  /^https:\/\/markview\.ai$/,
  // Pages production URL + per-deploy/branch preview subdomains. Project name
  // is `markview` (see .github/workflows/deploy.yml and apps/web/wrangler.toml).
  /^https:\/\/(?:[a-z0-9-]+\.)?markview\.pages\.dev$/,
  // Local dev (`vite` on :3001, `wrangler pages dev`, previews on any port).
  /^http:\/\/localhost(?::\d{1,5})?$/,
  /^http:\/\/127\.0\.0\.1(?::\d{1,5})?$/,
  // Tauri desktop shell. It serves the apps/web build off a custom protocol:
  // `tauri://localhost` on macOS/Linux, `http://tauri.localhost` on Windows.
  // NOTE: today's client fetches the *relative* path `/api/chat`
  // (src/lib/generation.ts → generateChatCloud), which resolves inside the
  // Tauri origin and never reaches this function — so these entries are not
  // load-bearing yet. They are here so that pointing the desktop build at the
  // absolute https://markview.ai/api/chat is a one-line change that does not
  // silently 403.
  /^tauri:\/\/localhost$/,
  /^https?:\/\/tauri\.localhost$/,
];

// Best-effort per-IP sliding window. This Map lives at module scope, which on
// Workers means *per isolate*: it resets whenever Cloudflare recycles the
// isolate and is not shared across colos, so the real-world ceiling is looser
// than the numbers below and a determined attacker can spread around it. The
// goal is making casual scripted draining not worth the effort — a hard,
// global quota would need a KV namespace or a Durable Object, and this
// function is deployed with only the AI binding.
const RATE_LIMIT_MINUTE = 10;
const RATE_LIMIT_HOUR = 60;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

// Bound the work a single accepted call can ask for.
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 40;

/** client IP → ascending request timestamps within the last hour. */
const hits = new Map<string, number[]>();
let lastPrune = 0;

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return ALLOWED_ORIGINS.some((re) => re.test(origin)) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  // `vary: origin` even on rejections — the response differs per origin, so a
  // shared cache must not serve one origin's answer to another.
  const headers: Record<string, string> = {
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}

/** Seconds until the window starting at `oldest` releases a slot. */
function retryAfter(now: number, oldest: number, windowMs: number): number {
  return Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
}

/** Records the request. Returns retry-after seconds if it should be refused. */
function rateLimited(ip: string, now: number): number | null {
  // Drop IPs that went quiet, at most once a minute — otherwise the Map grows
  // for the whole life of the isolate.
  if (now - lastPrune > MINUTE_MS) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < HOUR_MS)) hits.delete(key);
    }
    lastPrune = now;
  }

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
  hits.set(ip, recent);
  const inMinute = recent.filter((t) => now - t < MINUTE_MS);

  // A refused request is not recorded, so hammering can't extend the window.
  if (inMinute.length >= RATE_LIMIT_MINUTE) {
    return retryAfter(now, inMinute[0] ?? now, MINUTE_MS);
  }
  if (recent.length >= RATE_LIMIT_HOUR) {
    return retryAfter(now, recent[0] ?? now, HOUR_MS);
  }

  recent.push(now);
  return null;
}

export const onRequestOptions: PagesFunction<Env> = ({ request }) => {
  const origin = allowedOrigin(request);
  if (!origin) return json({ error: "origin not allowed" }, 403, null);
  return new Response(null, { headers: corsHeaders(origin) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = allowedOrigin(request);
  if (!origin) return json({ error: "origin not allowed" }, 403, null);

  // No CF-Connecting-IP means local `wrangler pages dev`; bucket those
  // together rather than handing out an unlimited key.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const retry = rateLimited(ip, Date.now());
  if (retry !== null) {
    return json(
      { error: "rate limited", detail: `max ${RATE_LIMIT_MINUTE}/min and ${RATE_LIMIT_HOUR}/hour per IP` },
      429,
      origin,
      { "retry-after": String(retry) },
    );
  }

  // Cheap rejection before buffering, when the client declares a size.
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ error: "payload too large", detail: `max ${MAX_BODY_BYTES} bytes` }, 413, origin);
  }

  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) {
    return json({ error: "payload too large", detail: `max ${MAX_BODY_BYTES} bytes` }, 413, origin);
  }

  let body: ChatRequest;
  try {
    body = JSON.parse(new TextDecoder().decode(raw)) as ChatRequest;
  } catch {
    return json({ error: "invalid json" }, 400, origin);
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "messages required (array of {role, content})" }, 400, origin);
  }

  if (body.messages.length > MAX_MESSAGES) {
    return json({ error: "too many messages", detail: `max ${MAX_MESSAGES} messages per request` }, 400, origin);
  }

  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const stream = body.stream !== false;

  try {
    const result = await env.AI.run(model, {
      messages: body.messages,
      stream,
      max_tokens: Math.min(body.max_tokens ?? 1024, 2048),
      temperature: body.temperature ?? 0.6,
    });

    if (stream) {
      return new Response(result as ReadableStream, {
        headers: {
          ...corsHeaders(origin),
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
      });
    }
    return json(result, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "ai_run_failed", detail: message }, 500, origin);
  }
};

function json(
  payload: unknown,
  status: number,
  origin: string | null,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), ...extra, "content-type": "application/json" },
  });
}
