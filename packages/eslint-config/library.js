import baseConfig from "./index.js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
