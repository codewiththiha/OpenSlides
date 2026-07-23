/**
 * Facade: single import surface for the Shiki display state machines.
 * Implementation lives in shiki-policies.ts / shiki-html-display.svelte.ts /
 * shiki-highlighter-display.svelte.ts.
 */
export {
  SHIKI_DISPLAY_POLICIES,
  type ShikiDisplayPolicy,
  type ShikiDisplayPolicyName,
  type ShikiDisplayStatus,
} from "./shiki-policies";
export {
  shikiDisplayHtml,
  editorShikiHtml,
  type ShikiDisplayHtmlArgs,
} from "./shiki-html-display.svelte";
export {
  shikiHighlighterDisplay,
  magicMoveShikiDisplay,
  type ShikiHighlighterDisplayArgs,
} from "./shiki-highlighter-display.svelte";
