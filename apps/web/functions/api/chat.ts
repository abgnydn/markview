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

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export const onRequestOptions: PagesFunction<Env> = () =>
  new Response(null, { headers: CORS_HEADERS });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "messages required (array of {role, content})" }, 400);
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
          ...CORS_HEADERS,
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
      });
    }
    return json(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "ai_run_failed", detail: message }, 500);
  }
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}
