import { test as base } from '@playwright/test';

/**
 * Suite-wide network hygiene. Any test alive for >10s starts the
 * embeddings backfill, which downloads a ~23 MB model from Hugging Face
 * per fresh browser context — a CI bandwidth burn and a network-flake
 * source (offline/HF-outage → spurious reds). External hosts have no
 * place in a deterministic suite; the app degrades gracefully when these
 * fetches fail (embeddings are best-effort, favicons decorative).
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/https?:\/\/([^/]*\.)?(huggingface\.co|hf\.co)\//, (r) => r.abort());
    await context.route(/https?:\/\/www\.google\.com\/s2\/favicons/, (r) => r.abort());
    await use(context);
  },
});

export { expect } from '@playwright/test';
