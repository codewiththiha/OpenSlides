/**
 * Tiny portal action for floating UI (hover previews, menus). Appends the
 * node to the target (document.body by default) and removes it on destroy.
 */
export function portal(
  node: HTMLElement,
  target: string | HTMLElement = "body",
) {
  const host =
    typeof target === "string"
      ? (document.querySelector(target) as HTMLElement | null)
      : target;
  host?.appendChild(node);
  return {
    destroy() {
      if (node.parentNode === host) host?.removeChild(node);
    },
  };
}
