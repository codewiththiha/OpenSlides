import tseslint from "typescript-eslint";
import svelteParser from "svelte-eslint-parser";
import sveltePlugin from "eslint-plugin-svelte";

const HOOK_NAME_MESSAGE =
  "Do not use React-style hook names. Use createX, xQuery, xMutation, or plain utilities.";

const reactSmellRules = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "FunctionDeclaration[id.name=/^use[A-Z]/]",
      message: HOOK_NAME_MESSAGE,
    },
    {
      selector: "VariableDeclarator[id.name=/^use[A-Z]/]",
      message: HOOK_NAME_MESSAGE,
    },
  ],
};

const hygieneRules = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports" },
  ],
  "no-console": ["warn", { allow: ["warn", "error"] }],
};

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "src-tauri/**", ".cache-tests/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: { ...reactSmellRules, ...hygieneRules },
  },
  {
    files: ["src/**/*.svelte"],
    plugins: { svelte: sveltePlugin, "@typescript-eslint": tseslint.plugin },
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      ...reactSmellRules,
      ...hygieneRules,
      "svelte/no-unused-svelte-ignore": "warn",
    },
  },
  // Dependency boundaries: shared/ is the bottom layer.
  {
    files: ["src/shared/**/*.{ts,svelte}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "**/features/*"],
              message:
                "shared/ must not import from features/ — move the module down a layer or invert the dependency.",
            },
            {
              group: ["@/app/*", "**/app/*"],
              message: "shared/ must not import from app/.",
            },
          ],
        },
      ],
    },
  },
  // features/ may not reach up into app/.
  {
    files: ["src/features/**/*.{ts,svelte}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "**/app/*"],
              message: "features/ must not import from app/.",
            },
          ],
        },
      ],
    },
  },
);
