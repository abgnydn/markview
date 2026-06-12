// Root ESLint flat config.
//
// Real linting happens per-workspace — apps/web has its own flat config
// (the shared @markview/eslint-config). This root config exists so that a
// bare `eslint .` from the repo root doesn't crash on generated build
// artifacts (Tauri/Rust codegen, static exports, dist output). It applies
// no rules of its own; lint a workspace via `bun --filter <name> lint`.
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/build/**",
      "**/.turbo/**",
      "apps/desktop/src-tauri/target/**",
      "apps/desktop/src-tauri/gen/**",
    ],
  },
];
