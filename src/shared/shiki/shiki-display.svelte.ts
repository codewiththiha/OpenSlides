/**
 * Facade: single import surface for the Shiki display state machines.
 * Implementation lives in shiki-policies.ts / shiki-html-display.svelte.ts /
 * shiki-highlighter-display.svelte.ts.
 */
export {
  shikiDisplayHtml,
  editorShikiHtml,
} from "./shiki-html-display.svelte";
export { magicMoveShikiDisplay } from "./shiki-highlighter-display.svelte";
