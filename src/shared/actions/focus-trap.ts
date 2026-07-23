import { tick } from "svelte";

/**
 * Modal focus trap (§11.1): moves focus into the dialog on mount, keeps Tab
 * cycling among its focusable descendants, and restores focus to the
 * previously focused element on destroy.
 */

const FOCUSABLE = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
}

export function focusTrap(node: HTMLElement): { destroy(): void } {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  void tick().then(() => {
    if (!node.isConnected) return;
    const first = visibleFocusables(node)[0];
    if (first && !node.contains(document.activeElement)) first.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const items = visibleFocusables(node);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  node.addEventListener("keydown", onKeydown);
  return {
    destroy() {
      node.removeEventListener("keydown", onKeydown);
      previouslyFocused?.focus?.();
    },
  };
}
