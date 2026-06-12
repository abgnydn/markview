import { defineConfig, globalIgnores } from "eslint/config";
import markview from "@markview/eslint-config";

// The web app is a Vite + React SPA — it lints with the shared workspace
// config (typescript-eslint recommended + the repo's rule overrides), NOT
// eslint-config-next. There is no Next.js in this project.
export default defineConfig([
  ...markview,
  globalIgnores([
    "out/**",
    "dist/**",
    "build/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
