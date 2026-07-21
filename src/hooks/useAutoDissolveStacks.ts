import { useEffect, useRef } from "react";
import { findSingleMemberGroups } from "@/lib/stacking";

/**
 * Auto-dissolves any stack (group or slide section) that has <= 1 member remaining.
 * `unstack` is kept in a ref so the effect only triggers when `items` changes.
 */
export function useAutoDissolveStacks<T>(
  items: T[],
  getGroupId: (i: T) => string | null | undefined,
  getId: (i: T) => string,
  unstack: (ids: string[]) => void,
): void {
  const unstackRef = useRef(unstack);
  unstackRef.current = unstack;

  const getGroupIdRef = useRef(getGroupId);
  getGroupIdRef.current = getGroupId;

  const getIdRef = useRef(getId);
  getIdRef.current = getId;

  useEffect(() => {
    const singleGroups = findSingleMemberGroups(
      items,
      getGroupIdRef.current,
      getIdRef.current,
    );
    for (const ids of singleGroups) {
      unstackRef.current(ids);
    }
  }, [items]);
}
