/**
 * Calls the handler on window Escape. Attaching is delayed to the next
 * task so the interaction that opened the overlay can't close it — menus
 * used a 50ms delay for the same reason.
 *
 * @example
 *   <div use:escapeKey={onClose}>...</div>
 */
export function escapeKey(_node: HTMLElement, options: (() => void) | { onEscape: () => void; delayMs?: number }) {
  let onEscape = typeof options === "function" ? options : options.onEscape;
  let delayMs = typeof options === "function" ? 0 : (options.delayMs ?? 0);

  function handle(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onEscape();
    }
  }

  const timer = window.setTimeout(() => {
    window.addEventListener("keydown", handle);
  }, delayMs);

  return {
    update(next: (() => void) | { onEscape: () => void; delayMs?: number }) {
      onEscape = typeof next === "function" ? next : next.onEscape;
      delayMs = typeof next === "function" ? 0 : (next.delayMs ?? 0);
    },
    destroy() {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handle);
    },
  };
}
