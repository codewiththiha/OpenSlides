<script lang="ts">
  import type { Component } from "svelte";
  import { cn } from "$lib/lib/utils";

  let {
    orientation,
    icon: Icon,
    label,
    onClick,
    title,
    class: className,
  }: {
    /** vertical = side rail (Code), horizontal = bottom bar (Slides) */
    orientation: "vertical" | "horizontal";
    icon: Component<{ class?: string }>;
    label: string;
    onClick: () => void;
    title?: string;
    class?: string;
  } = $props();

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }
</script>

<div
  class={cn(
    orientation === "vertical" &&
      "flex h-full w-full min-w-[28px] cursor-pointer flex-col items-center justify-center gap-2 border-l border-border/50 bg-card/60 hover:bg-muted/40",
    orientation === "horizontal" &&
      "flex h-full min-h-[36px] w-full cursor-pointer items-center justify-center bg-card/60 px-2 hover:bg-muted/30",
    className,
  )}
  onclick={onClick}
  {title}
  role="button"
  tabindex="0"
  onkeydown={onKeyDown}
>
  <Icon class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  <span
    class={cn(
      "text-muted-foreground select-none",
      orientation === "vertical" && "text-[11px] tracking-wide",
      orientation === "horizontal" && "text-xs",
    )}
    style={orientation === "vertical"
      ? "writing-mode: vertical-rl; text-orientation: mixed;"
      : undefined}
  >
    {label}
  </span>
</div>
