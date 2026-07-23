<script lang="ts">
  /**
   * StackDeck — a card with ghost layers + count badge that behaves like a
   * pile (single click fans, double click opens the top item).
   *
   * Capture-phase click guards use native `onclickcapture` /
   * `ondblclickcapture` attributes; any extra props are spread onto the
   * root div.
   */
  import { cn } from "$lib/lib/utils";
  import type { Snippet } from "svelte";
  import StackLayers from "./StackLayers.svelte";
  import StackBadge from "./StackBadge.svelte";

  let {
    count = 1,
    onExpand,
    onOpenTop,
    children,
    class: className,
    badgeTitle,
    badgeClassName,
    variant = "project",
    onClick,
    onDoubleClick,
    ariaLabel,
    ...rest
  }: {
    count?: number;
    onExpand?: () => void;
    onOpenTop?: () => void;
    children?: Snippet;
    class?: string;
    badgeTitle?: string;
    badgeClassName?: string;
    variant?: "project" | "slide";
    onClick?: (e: MouseEvent) => void;
    onDoubleClick?: (e: MouseEvent) => void;
    ariaLabel?: string;
    [key: string]: unknown;
  } = $props();

  let hovered = $state(false);

  function isInteractiveTarget(target: EventTarget | null) {
    if (!target || !(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest(".hover-actions"),
    );
  }

  function handleClickCapture(e: MouseEvent) {
    if (count <= 1) return;
    if (isInteractiveTarget(e.target)) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.detail > 1) return; // ignore — double-click handler takes over
    if (onExpand) {
      onExpand();
    } else if (onClick) {
      onClick(e);
    }
  }

  function handleDoubleClickCapture(e: MouseEvent) {
    if (count <= 1) return;
    if (isInteractiveTarget(e.target)) return;

    e.stopPropagation();
    e.preventDefault();

    if (onOpenTop) {
      onOpenTop();
    } else if (onDoubleClick) {
      onDoubleClick(e);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (count > 1 && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onExpand?.();
    }
  }
</script>

<!-- The deck is ONLY interactive when count > 1 (fan-expand button then);
     role/tabindex are conditional, which the static a11y analyzer can't
     evaluate, so the tabindex rule is suppressed right here. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class={cn("relative isolate", count > 1 && "cursor-pointer", className)}
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  onclickcapture={handleClickCapture}
  ondblclickcapture={handleDoubleClickCapture}
  onclick={(e) => {
    if (count <= 1 && onClick) onClick(e);
  }}
  ondblclick={(e) => {
    if (count <= 1 && onDoubleClick) onDoubleClick(e);
  }}
  onkeydown={handleKeyDown}
  role={count > 1 ? "button" : undefined}
  tabindex={count > 1 ? 0 : undefined}
  aria-label={ariaLabel ||
    (count > 1 ? `Stack of ${count}, press Enter to expand` : undefined)}
  {...rest}
>
  <StackLayers {count} {hovered} {variant} />
  {@render children?.()}
  <StackBadge
    {count}
    class={badgeClassName}
    title={badgeTitle ||
      (count > 1
        ? `${count} ${variant === "slide" ? "slides" : "presentations"} — click to fan`
        : undefined)}
  />
</div>
