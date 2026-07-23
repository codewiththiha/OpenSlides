/**
 * stack-targeting — the pointer-based insertion math that keeps receiver
 * cards from hopping away from the cursor during slide-strip drags.
 *
 * The regression these lock in: svelte-dnd-action proposes reorder indices
 * from the dragged clone's CENTER, which crosses a card's midpoint before
 * the pointer is over that card. Applying those considers shifted the
 * receiver to the far side of the pointer on every approach. The strip
 * must instead pin the layout until the POINTER itself crosses a midpoint.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { pointerInsertIndex, shadowInsertAt } from "../src/shared/lib/stack-targeting";

// Zone with three 152px children at an 8px gap (pitch 160): centers 76/236/396.
const CENTERS = [76, 236, 396];

test("pointerInsertIndex: inserts before the first center right of the pointer", () => {
  assert.equal(pointerInsertIndex(0, CENTERS), 0);
  assert.equal(pointerInsertIndex(100, CENTERS), 1);
  assert.equal(pointerInsertIndex(300, CENTERS), 2);
  assert.equal(pointerInsertIndex(500, CENTERS), 3);
  assert.equal(pointerInsertIndex(10, []), 0);
});

test("pointerInsertIndex: exact midpoint ties belong to the slot after", () => {
  assert.equal(pointerInsertIndex(76, CENTERS), 1);
  assert.equal(pointerInsertIndex(236, CENTERS), 2);
});

test("shadowInsertAt: dom index maps into the shadow-less list", () => {
  assert.deepEqual(shadowInsertAt(2, 0), { insertAt: 1, unchanged: false });
  assert.deepEqual(shadowInsertAt(3, 0), { insertAt: 2, unchanged: false }); // to the end
  assert.deepEqual(shadowInsertAt(1, 2), { insertAt: 1, unchanged: false });
});

test("shadowInsertAt: the anti-leapfrog pins (receive cards stay put)", () => {
  // Pointer right of the shadow but not yet past the next card's midpoint:
  // the lib would already have reordered — we must report "unchanged".
  assert.deepEqual(shadowInsertAt(1, 0), { insertAt: 0, unchanged: true });
  // Same one slot further on.
  assert.deepEqual(shadowInsertAt(3, 2), { insertAt: 2, unchanged: true });
  // Hovering the shadow's own slot is unchanged.
  assert.deepEqual(shadowInsertAt(2, 2), { insertAt: 2, unchanged: true });
});
