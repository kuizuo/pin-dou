import stylistic from "@stylistic/eslint-plugin";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig, globalIgnores } from "eslint/config";

const formatting = stylistic.configs.customize({
  indent: 2,
  jsx: true,
  quotes: "double",
  semi: true,
});

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    plugins: {
      ...formatting.plugins,
      perfectionist,
    },
    rules: {
      ...formatting.rules,
      "@stylistic/jsx-max-props-per-line": [
        "error",
        { maximum: 1, when: "always" },
      ],
      "@stylistic/max-statements-per-line": "off",
      "perfectionist/sort-imports": [
        "error",
        { newlinesBetween: 0, order: "asc", type: "natural" },
      ],
      "perfectionist/sort-named-imports": [
        "error",
        { order: "asc", type: "natural" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    ".agents/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",
    "worker/.wrangler/**",
  ]),
]);
