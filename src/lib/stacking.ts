/**
 * Pure stacking and fan layout utilities.
 */

/**
 * Builds a Map<groupId, ids[]>, returning an array of id-lists for groups
 * that have <= 1 member (which should be auto-dissolved).
 */
export function findSingleMemberGroups<T>(
  items: T[],
  getGroupId: (i: T) => string | null | undefined,
  getId: (i: T) => string
): string[][] {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  const groupCounts = new Map<string, string[]>();
  for (const item of items) {
    if (item === null || item === undefined) continue;
    const rawId = getGroupId(item);
    if (rawId && typeof rawId === "string" && rawId.trim().length > 0) {
      const gid = rawId.trim();
      if (!groupCounts.has(gid)) groupCounts.set(gid, []);
      groupCounts.get(gid)!.push(getId(item));
    }
  }

  const result: string[][] = [];
  for (const [, ids] of groupCounts.entries()) {
    if (ids.length <= 1) {
      result.push(ids);
    }
  }
  return result;
}

/**
 * Computes rotation, horizontal offset, and vertical offset for a fanned card.
 */
export function computeFanLayout(
  total: number,
  index: number
): { rotate: number; x: number; y: number } {
  if (total <= 0) {
    return { rotate: 0, x: 0, y: 0 };
  }
  const offset = index - (total - 1) / 2;
  return {
    rotate: offset * 9,
    x: offset * 85,
    y: Math.abs(offset) * 12 - 20,
  };
}
