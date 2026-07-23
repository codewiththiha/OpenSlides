<script lang="ts">
  /**
   * HighlightStepIndicator — small floating pill that shows highlight
   * playback progress for the current slide (●●○ 2/3).
   *
   * framer-motion replaced by svelte transitions + a spring for the dots.
   */
  import { fade, fly } from "svelte/transition";
  import { Spring } from "svelte/motion";
  import { Highlighter as HighlighterIcon } from "lucide-svelte";
  import { cn } from "@/lib/utils";

  let {
    total,
    current,
    compact = false,
    class: className,
    onSelect,
  }: {
    /** Total highlights on the current slide. */
    total: number;
    /** Active highlight index (-1 = none revealed yet). */
    current: number;
    /** Compact styling for the small editor preview. */
    compact?: boolean;
    class?: string;
    /** Called when user clicks a dot to jump to that step. */
    onSelect?: (index: number) => void;
  } = $props();

  const active = $derived(current >= 0);
  const shown = $derived(Math.min(current + 1, total));
  const interactive = $derived(typeof onSelect === "function");

  // Spring-driven scale mirroring framer's { stiffness: 500, damping: 30 }.
  // One spring per possible dot index keeps animation cheap and local.
  const dotScales = Array.from(
    { length: 9 },
    () => new Spring(1, { stiffness: 0.5, damping: 0.3 }),
  );

  $effect(() => {
    dotScales.forEach((s, i) => {
      s.set(i === current ? 1.35 : 1);
    });
  });
</script>

{#if total > 0}
  <div
    in:fly={{ y: 6, duration: 200 }}
    out:fade={{ duration: 200 }}
    class={cn(
      "inline-flex select-none items-center gap-2 rounded-full",
      "bg-black/55 text-white/90 shadow-lg backdrop-blur-sm",
      "border border-white/10",
      compact ? "px-2 py-1" : "px-3 py-1.5",
      interactive ? "pointer-events-auto" : "pointer-events-none",
      className,
    )}
    role="status"
    aria-label={active
      ? `Highlight ${shown} of ${total}`
      : `${total} highlight${total > 1 ? "s" : ""} — press → to reveal`}
  >
    <HighlighterIcon
      class={cn(
        compact ? "h-3 w-3" : "h-3.5 w-3.5",
        active ? "text-amber-300" : "text-white/60",
      )}
    />
    <span class="flex items-center gap-1">
      {#each Array.from({ length: total }, (_, i) => i) as i (i)}
        {@const isActive = i === current}
        <button
          type="button"
          disabled={!interactive}
          onclick={() => {
            if (!interactive) return;
            onSelect?.(i);
          }}
          title={interactive ? `Jump to highlight ${i + 1} of ${total}` : undefined}
          class={cn(
            "rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 focus-visible:ring-offset-0",
            compact ? "h-3 w-3" : "h-4 w-4",
            "flex items-center justify-center",
            interactive
              ? "cursor-pointer hover:scale-125 transition-transform"
              : "cursor-default",
          )}
          aria-label="Go to highlight {i + 1}"
          aria-current={isActive ? "step" : undefined}
        >
          <span
            class={cn("rounded-full", compact ? "h-1.5 w-1.5" : "h-2 w-2")}
            style="transform: scale({dotScales[i]?.current ?? 1}); opacity: {i > current ? 0.35 : 1}; background-color: {i <= current ? '#fcd34d' : '#ffffff'}; transition: background-color 150ms ease, opacity 150ms ease;"
          ></span>
        </button>
      {/each}
    </span>
    {#key active ? `on-${shown}` : "off"}
      <span
        role={interactive ? "button" : undefined}
        in:fly={{ y: 4, duration: 150 }}
        class={cn(
          "font-mono leading-none tabular-nums",
          compact ? "text-[9px]" : "text-[11px]",
          active ? "text-amber-200" : "text-white/60",
          interactive && "cursor-pointer hover:text-amber-100",
        )}
        onclick={() => {
          if (!interactive) return;
          // Clicking counter goes to clean (-1) when active, first highlight when clean.
          if (active) {
            onSelect?.(-1);
          } else if (total > 0) {
            onSelect?.(0);
          }
        }}
        title={interactive
          ? active
            ? "Back to clean slide"
            : "Reveal first highlight"
          : undefined}
      >
        {active ? `${shown}/${total}` : `→ ${total}`}
      </span>
    {/key}
  </div>
{/if}
