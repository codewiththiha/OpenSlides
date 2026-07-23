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
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

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

      // DOM Range geometry follows the rendered Shiki output, including line
      // numbers, tabs, Unicode glyph widths, and font fallback. The pure-math
      // path is retained only as a last-resort fallback when Range measurement
      // cannot produce a usable result.
      let m = measureHighlight(container, codeRoot, plan, fontSize, lineHeight);
      if (!m) {
        m = measureHighlightPureMath(container, codeRoot, plan, fontSize, lineHeight);
      }
      if (!disposed && m) measurement = m;
    };

    measure();
    raf = requestAnimationFrame(() => {
      if (disposed) return;
      settleRaf = requestAnimationFrame(() => {
        if (!disposed) measure();
      });
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(roRaf);
      cancelAnimationFrame(cacheRaf);
      cancelAnimationFrame(settleRaf);
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
