import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
      // Non-null assertions (`thing!.method`) hide null-deref bugs from the
      // compiler. Allowed only with an explicit // eslint-disable-next-line.
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Use the `log` helper in apps/web/src/lib/logger.ts which no-ops in
      // production. console.warn / console.error stay allowed for real failures.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // CLI scripts print by design, and tests legitimately reach for `!` and
    // `any` when poking internals — the app-code rules above are about
    // production hygiene, not these contexts. Scoping them out keeps the
    // warning count a signal instead of noise.
    files: ["**/scripts/**", "**/e2e/**", "**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
