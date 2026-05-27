// SPDX-License-Identifier: Apache-2.0

/**
 * Local-first generative LLM for markview.
 *
 * Uses transformers.js with `HuggingFaceTB/SmolLM2-360M-Instruct` (ONNX
 * INT4 quantized) — ~220 MB on first download. WebGPU when available,
 * WASM fallback. Coherent multi-sentence completions on M-series in
 * ~30 tokens/s.
 *
 * Loaded LAZILY — the import only happens when the user opts in (via the
 * AI settings panel or by invoking a generative feature for the first
 * time). Embeddings (Phase 0) ship at 23 MB and handle the always-on
 * features; this is for users who explicitly want chat / autocomplete /
 * rewrites in their voice.
 *
 * State machine:
 *   idle      — never loaded
 *   loading   — downloading or initializing
 *   ready     — ready to generate
 *   failed    — fetch / WebGPU / etc. error
 */

const MODEL_ID = 'HuggingFaceTB/SmolLM2-360M-Instruct';
const SETTING_KEY = 'markview-generative-opt-in';

export interface GenStatus {
  state: 'idle' | 'loading' | 'ready' | 'failed';
  progress?: number;       // 0-100 for download
  modelId?: string;
  error?: string;
}

let pipelinePromise: Promise<unknown> | null = null;
let currentStatus: GenStatus = { state: 'idle' };
let statusListeners = new Set<(s: GenStatus) => void>();

export function onGenStatus(cb: (s: GenStatus) => void): () => void {
  statusListeners.add(cb);
  cb(currentStatus);
  return () => statusListeners.delete(cb);
}

function setStatus(s: GenStatus) {
  currentStatus = s;
  statusListeners.forEach((cb) => cb(s));
}

export function isGenerativeOptedIn(): boolean {
  try { return localStorage.getItem(SETTING_KEY) === 'true'; } catch { return false; }
}

export function setGenerativeOptedIn(v: boolean): void {
  try { localStorage.setItem(SETTING_KEY, String(v)); } catch { /* ignore */ }
}

/**
 * Resolve the generation pipeline. Loads the model if it hasn't been
 * loaded yet. Marks the user as opted-in so subsequent sessions skip
 * the "are you sure?" prompt.
 */
/** Cached reference to the TextStreamer constructor — we need it
    per-call but only want one import. */
let textStreamerCtor: (new (
  tokenizer: unknown,
  opts: { skip_prompt?: boolean; skip_special_tokens?: boolean; callback_function?: (s: string) => void },
) => unknown) | null = null;

async function getPipeline(): Promise<unknown> {
  if (pipelinePromise) return pipelinePromise;
  setGenerativeOptedIn(true);
  pipelinePromise = (async () => {
    try {
      setStatus({ state: 'loading', progress: 0, modelId: MODEL_ID });
      const tfjs = await import('@huggingface/transformers');
      const { pipeline, env, TextStreamer } = tfjs as unknown as {
        pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>;
        env: { allowLocalModels: boolean; allowRemoteModels: boolean };
        TextStreamer: typeof textStreamerCtor extends infer T ? T : never;
      };
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      textStreamerCtor = TextStreamer as unknown as typeof textStreamerCtor;
      const pipe = await pipeline('text-generation', MODEL_ID, {
        dtype: 'q4',                  // q4 quantization keeps the bundle ~220 MB
        device: 'auto',                // prefer WebGPU, fall back to WASM
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === 'progress' && typeof p.progress === 'number') {
            setStatus({ state: 'loading', progress: p.progress, modelId: MODEL_ID });
          }
        },
      });
      setStatus({ state: 'ready', modelId: MODEL_ID });
      return pipe;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ state: 'failed', error: msg, modelId: MODEL_ID });
      pipelinePromise = null;
      throw e;
    }
  })();
  return pipelinePromise;
}

/** Warm-load on opt-in. */
export async function warmGenerative(): Promise<void> {
  try { await getPipeline(); } catch { /* errors surface via status */ }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  /** Max new tokens. Default 256. */
  maxNewTokens?: number;
  /** Temperature. Default 0.7 (chat). For autocomplete pass 0.3-0.5. */
  temperature?: number;
  /** Top-p. Default 0.9. */
  topP?: number;
  /** Called with each token-batch as it streams in. */
  onToken?: (chunk: string, fullSoFar: string) => void;
  /** AbortSignal — pass `controller.signal` to support stop button. */
  signal?: AbortSignal;
}

interface PipelineCall {
  (input: ChatMessage[] | string, options?: Record<string, unknown>): Promise<unknown>;
  tokenizer?: unknown;
}

/**
 * Generate a chat completion using the loaded SmolLM2 model.
 *
 * Streams tokens via `onToken` — wraps transformers.js's `TextStreamer`
 * with `skip_prompt: true` so only the *assistant's* tokens are emitted
 * (not the system + user prompt that's echoed back to the streamer).
 *
 * Returns the final string. Honors `signal.abort()` for a stop button.
 */
export async function generateChat(options: GenerateOptions): Promise<string> {
  const pipe = (await getPipeline()) as PipelineCall;
  const { messages, maxNewTokens = 256, temperature = 0.7, topP = 0.9, onToken, signal } = options;

  let accumulated = '';
  let abortRequested = false;
  const onAbort = () => { abortRequested = true; };
  signal?.addEventListener('abort', onAbort);

  // Real TextStreamer with skip_prompt so we ONLY see the assistant's tokens.
  let streamer: unknown = undefined;
  if (onToken && textStreamerCtor && pipe.tokenizer) {
    streamer = new (textStreamerCtor as new (
      tokenizer: unknown,
      opts: { skip_prompt?: boolean; skip_special_tokens?: boolean; callback_function?: (s: string) => void },
    ) => unknown)(pipe.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk: string) => {
        if (abortRequested) return;
        accumulated += chunk;
        onToken(chunk, accumulated);
      },
    });
  }

  try {
    const output = await pipe(messages, {
      max_new_tokens: maxNewTokens,
      temperature,
      top_p: topP,
      do_sample: true,
      return_full_text: false,
      streamer,
    });
    if (abortRequested) return accumulated;
    if (accumulated) return accumulated.trim();
    // Fallback for when streaming wasn't requested — extract the
    // assistant's reply from the pipeline output shape.
    const out = output as Array<{ generated_text: ChatMessage[] | string }>;
    const first = out?.[0]?.generated_text;
    if (typeof first === 'string') return first.trim();
    if (Array.isArray(first)) {
      const last = first[first.length - 1];
      const txt = typeof last === 'string' ? last : last?.content ?? '';
      return txt.trim();
    }
    return '';
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Convenience: a workspace Q&A. Pulls the top-K relevant paragraphs via
 * embeddings, stuffs them into the prompt as grounded context, then asks
 * the model to answer with citations.
 *
 * The system prompt is deliberately short — SmolLM2 360M is a small
 * model and bloated system messages crowd out the actual context. We
 * also retrieve fuller paragraphs (not the 140-char preview) so the
 * model has enough to ground on.
 */
export async function answerQuestionInWorkspace(
  workspaceId: string,
  question: string,
  options: {
    topK?: number;
    onToken?: (chunk: string, full: string) => void;
    signal?: AbortSignal;
  } = {},
): Promise<{ answer: string; citations: Array<{ fileId: string; preview: string; score: number }> }> {
  const { embedQuery, searchEmbeddings } = await import('./embeddings');
  const { db } = await import('@/lib/storage/db');
  const qVec = await embedQuery(question);
  const hits = await searchEmbeddings(workspaceId, qVec, { topK: options.topK ?? 4 });

  // Pull richer context for each hit — read the source paragraph fully
  // from the file content, not just the truncated preview.
  const context = await Promise.all(hits.map(async (h, i) => {
    const file = await db.files.get(h.fileId);
    if (!file) return `[${i + 1}] ${h.preview}`;
    const { chunkContent } = await import('./embeddings');
    const chunks = chunkContent(file.content);
    const para = chunks[h.paragraphIndex]?.text ?? h.preview;
    return `[${i + 1}] ${para}`;
  }));

  const contextBlock = context.join('\n\n');
  const system = `You answer questions about the user's notes. Use ONLY the numbered excerpts below as facts. Cite excerpts inline like [1] or [2]. If the excerpts don't contain the answer, say "I don't see that in the notes." Be concise — 1-3 sentences.

NOTES:
${contextBlock || '(no notes found)'}`;

  const answer = await generateChat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: question },
    ],
    maxNewTokens: 220,
    temperature: 0.3,            // low temp = stays close to the context
    topP: 0.85,
    onToken: options.onToken,
    signal: options.signal,
  });
  return {
    answer: answer.trim(),
    citations: hits.map((h) => ({ fileId: h.fileId, preview: h.preview, score: h.score })),
  };
}
