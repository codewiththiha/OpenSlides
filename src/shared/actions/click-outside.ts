/**
 * Calls the handler on mousedown outside the element. Attaching is delayed
 * to the next task so the pointer interaction that mounted the node (right-
 * click / drag-end) can't immediately dismiss it — pass the same delay the
 * menu previously used via setTimeout.
 *
 * @example
 *   <div use:clickOutside={{ onOutside: onClose, delayMs: 50 }}>...</div>
 */
export function clickOutside(
  node: HTMLElement,
  options: { onOutside: () => void; delayMs?: number },
) {
  let { onOutside, delayMs = 0 } = options;

  function handle(event: MouseEvent) {
    if (event.button === 2) return;
    if (!node.contains(event.target as Node)) {
      onOutside();
    }
  }

  const timer = window.setTimeout(() => {
    document.addEventListener("mousedown", handle);
  }, delayMs);

  return {
    update(next: { onOutside: () => void; delayMs?: number }) {
      ({ onOutside, delayMs = 0 } = next);
    },
    destroy() {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handle);
    },
  };
}
