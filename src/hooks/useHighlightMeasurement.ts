import { useLayoutEffect, useRef, useState } from "react";
import {
  measureHighlight,
  measureHighlightPureMath,
  type HighlightMeasurement,
} from "@/lib/highlight-utils";
import { clearLineNodesCache } from "@/lib/line-nodes-cache";
import type { HighlightPlan } from "@/lib/highlight-tokens";

interface UseHighlightMeasurementArgs {
  containerRef: React.RefObject<HTMLDivElement | null>;
  codeContainerRef: React.RefObject<HTMLDivElement | null>;
  plan: HighlightPlan | null;
  fontSize: number;
  lineHeight: number;
  theme: string;
}

export function useHighlightMeasurement({
  containerRef,
  codeContainerRef,
  plan,
  fontSize,
  lineHeight,
  theme,
}: UseHighlightMeasurementArgs) {
  const [measurement, setMeasurement] = useState<HighlightMeasurement | null>(null);
  const rafRef = useRef<number>(0);
  const roRafRef = useRef<number>(0);
  const cacheRafRef = useRef<number>(0);
  const settleRafRef = useRef<number>(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const moRef = useRef<MutationObserver | null>(null);

  // Optimized measure: container ResizeObserver + codeRoot MutationObserver (no textContent read)
  useLayoutEffect(() => {
    let disposed = false;

    const measure = () => {
      if (disposed) return;
      const container = containerRef.current;
      const codeRoot = codeContainerRef.current;

      if (!container || !codeRoot) {
        rafRef.current = requestAnimationFrame(measure);
        return;
      }

      if (!roRef.current) {
        roRef.current = new ResizeObserver(() => {
          if (disposed) return;
          if (roRafRef.current) return;
          roRafRef.current = requestAnimationFrame(() => {
            roRafRef.current = 0;
            if (!disposed) measure();
          });
        });
        roRef.current.observe(container);
      }

      // MutationObserver instead of reading textContent.length (which forces layout O(n))
      // Only fires when DOM actually changes, not on every measure
      if (!moRef.current) {
        moRef.current = new MutationObserver(() => {
          if (disposed) return;
          // Coalesce cache invalidation and the follow-up measure to one frame.
          if (cacheRafRef.current) return;
          cacheRafRef.current = requestAnimationFrame(() => {
            cacheRafRef.current = 0;
            const cr = codeContainerRef.current;
            if (cr) clearLineNodesCache(cr);
            if (!disposed) measure();
          });
        });
        moRef.current.observe(codeRoot, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      if (!plan) {
        setMeasurement(null);
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
      if (!disposed && m) setMeasurement(m);
    };

    measure();
    const r1 = requestAnimationFrame(() => {
      if (disposed) return;
      const r2 = requestAnimationFrame(() => {
        if (!disposed) measure();
      });
      settleRafRef.current = r2;
    });
    rafRef.current = r1 as unknown as number;

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(roRafRef.current);
      cancelAnimationFrame(cacheRafRef.current);
      cacheRafRef.current = 0;
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = 0;
      roRafRef.current = 0;
      roRef.current?.disconnect();
      roRef.current = null;
      moRef.current?.disconnect();
      moRef.current = null;
    };
  }, [containerRef, codeContainerRef, plan, fontSize, lineHeight, theme]);

  return measurement;
}
