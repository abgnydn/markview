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
];
