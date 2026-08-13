// Typed build-time environment variables. See lib/analytics.ts for how the
// beacon token is provisioned (repo secret → deploy.yml → Vite build).

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token. Empty/unset = analytics off. */
  readonly VITE_CF_BEACON_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
