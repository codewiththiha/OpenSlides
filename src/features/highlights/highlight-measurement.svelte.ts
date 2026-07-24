import {
  measureHighlight,
  measureHighlightPureMath,
  type HighlightMeasurement,
} from "@/features/highlights/highlight-utils";
import { clearLineNodesCache } from "$lib/lib/line-nodes-cache";
import type { HighlightPlan } from "@/features/highlights/highlight-tokens";

interface UseHighlightMeasurementArgs {
  container: () => HTMLElement | null;
  codeContainer: () => HTMLElement | null;
  plan: () => HighlightPlan | null;
  fontSize: () => number;
  lineHeight: () => number;
  theme: () => string;
}

export function createHighlightMeasurement(args: UseHighlightMeasurementArgs) {
  let measurement = $state<HighlightMeasurement | null>(null);

  // Optimized measure: container ResizeObserver + codeRoot MutationObserver (no textContent read)
  $effect(() => {
    // tracked inputs — any change re-runs the whole measurement setup
    const plan = args.plan();
    const fontSize = args.fontSize();
    const lineHeight = args.lineHeight();
    args.theme();

    let disposed = false;
    let raf = 0;
    let roRaf = 0;
    let cacheRaf = 0;
    let settleRaf = 0;
    let pollRaf = 0;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const hasRenderedCode = (root: HTMLElement) =>
      root.querySelector("span.line, .shiki-magic-move-item") !== null;

    const measure = () => {
      if (disposed) return;
      const container = args.container();
      const codeRoot = args.codeContainer();

      if (!container || !codeRoot) {
        raf = requestAnimationFrame(measure);
        return;
      }

      if (!ro) {
        ro = new ResizeObserver(() => {
          if (disposed || roRaf) return;
          roRaf = requestAnimationFrame(() => {
            roRaf = 0;
            if (!disposed) measure();
          });
        });
        ro.observe(container);
      }

      // MutationObserver instead of reading textContent.length (which forces layout O(n))
      // Only fires when DOM actually changes, not on every measure
      if (!mo) {
        mo = new MutationObserver(() => {
          if (disposed || cacheRaf) return;
          // Coalesce cache invalidation and the follow-up measure to one frame.
          cacheRaf = requestAnimationFrame(() => {
            cacheRaf = 0;
            const cr = args.codeContainer();
            if (cr) clearLineNodesCache(cr);
            if (!disposed) measure();
          });
        });
        mo.observe(codeRoot, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      if (!plan) {
        measurement = null;
        return;
      }

      // ── Re-key guard (theme / language change) ───────────────────────
      // A theme hover re-keys the magic-move block: the old rendered code
      // spans are destroyed and new ones mounted. This effect re-runs on that
      // change, but on the first synchronous pass the new spans may not exist
      // yet. Measuring an empty block would fall through to pure-math geometry
      // and publish a wrong rect — snapping the clone + eraser to a bad region
      // and painting the eraser over live code. Geometry is theme-independent,
      // so retain the previous measurement and let the observer or bounded
      // poll below refresh once rendered code exists again.
      if (!hasRenderedCode(codeRoot)) return;

      // DOM Range geometry follows the rendered Shiki output, including line
      // numbers, tabs, Unicode glyph widths, and font fallback. The pure-math
      // path is retained only as a last-resort fallback when Range measurement
      // cannot produce a usable result on a populated block.
      let m = measureHighlight(container, codeRoot, plan, fontSize, lineHeight);
      if (!m) {
        m = measureHighlightPureMath(
          container,
          codeRoot,
          plan,
          fontSize,
          lineHeight,
        );
      }
      if (!disposed && m) measurement = m;
    };

    // The container element survives re-keys while its descendant spans are
    // replaced, so a cached node list here would point at detached spans —
    // invalidate once per (re)run before the first measure.
    const cr0 = args.codeContainer();
    if (cr0) clearLineNodesCache(cr0);

    measure();
    raf = requestAnimationFrame(() => {
      if (disposed) return;
      settleRaf = requestAnimationFrame(() => {
        if (!disposed) measure();
      });
    });

    // Safety net for the "new spans rendered before the observer attached"
    // ordering. In that case no later mutation fires the observer, so poll
    // until the line spans appear, then measure once. Bounded so a broken DOM
    // cannot loop; it stops the instant the block is populated.
    let pollLeft = 30;
    const poll = () => {
      if (disposed) return;
      const cr = args.codeContainer();
      if (cr && hasRenderedCode(cr)) {
        clearLineNodesCache(cr);
        measure();
        return;
      }
      if (--pollLeft > 0) pollRaf = requestAnimationFrame(poll);
    };

    if (cr0 && !hasRenderedCode(cr0)) {
      pollRaf = requestAnimationFrame(poll);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(roRaf);
      cancelAnimationFrame(cacheRaf);
      cancelAnimationFrame(settleRaf);
      cancelAnimationFrame(pollRaf);
      ro?.disconnect();
      ro = null;
      mo?.disconnect();
      mo = null;
    };
  });

  return {
    get measurement() {
      return measurement;
    },
  };
}
