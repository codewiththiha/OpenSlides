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

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "src-tauri/**", ".cache-tests/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    rules: reactSmellRules,
  },
  {
    files: ["src/**/*.svelte"],
    plugins: { svelte: sveltePlugin },
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tseslint.parser },
    },
    rules: reactSmellRules,
  },
);
