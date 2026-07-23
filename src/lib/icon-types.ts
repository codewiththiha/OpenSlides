import type { ComponentType } from "svelte";

/**
 * lucide-svelte 1.x ships legacy `SvelteComponentTyped` class components —
 * not Svelte 5 `Component` functions. Any prop (or snippet parameter) that
 * receives "a lucide icon component" must use this constructor type, or TS
 * rejects icons at the boundary. Rendering `<Icon class="…" />` works
 * identically for both component kinds.
 */
export type IconComponent = ComponentType;
