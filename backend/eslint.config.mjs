// ════════════════════════════════════════════════════════════════════════════
// ESLint configuration (flat config, ESLint 9+).
//
// STARTER CONFIG — the goal right now is a working `npm run lint` that catches
// obvious mistakes without drowning the (legacy-migrated) codebase in warnings.
// Strictness will be increased in a later stage (testing + maintainability).
//
// Run:  cd eon_backend && npm run lint
// ════════════════════════════════════════════════════════════════════════════

import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "scripts/**", "assets/**"] },

  ...tseslint.configs.recommended,

  {
    files: ["src/**/*.ts"],
    rules: {
      // The migrated codebase intentionally uses `any` in many places (SQL rows,
      // legacy-shaped payloads). Re-enable these as the code is typed properly.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // Legacy catch blocks may intentionally swallow errors (documented).
      "no-empty": "off",
    },
  },
);
