/**
 * measureCharWidth cache regression — the font probe previously created,
 * laid out and removed a DOM node on EVERY highlight measure call. Font
 * metrics are stable per (fontFamily, fontSize) for the app session, so
 * the probe must run once per metric key.
 */
import "./helpers/jsdom-env.mts";

import test from "node:test";
import assert from "node:assert/strict";
import { measureCharWidth } from "../src/shared/lib/char-width-cache";

test("measureCharWidth: one DOM probe per (fontFamily, fontSize) key", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  let appends = 0;
  const orig = container.appendChild.bind(container);
  (container as any).appendChild = (n: Node) => {
    appends++;
    return orig(n);
  };

  measureCharWidth(container, 14, "Menlo, monospace");
  measureCharWidth(container, 14, "Menlo, monospace");
  measureCharWidth(container, 14, "Menlo, monospace");
  assert.equal(appends, 1, "repeat calls hit the cache, not the layout");

  measureCharWidth(container, 16, "Menlo, monospace");
  assert.equal(appends, 2, "a font-size change re-probes (new key)");

  measureCharWidth(container, 14, "Fira Code, monospace");
  assert.equal(appends, 3, "a font-family change re-probes (new key)");

  container.remove(); // detaches from <body>

  // Leave the module-level cache warm-proof: another container reuses it.
  const c2 = document.createElement("div");
  document.body.appendChild(c2);
  let appends2 = 0;
  const orig2 = c2.appendChild.bind(c2);
  (c2 as any).appendChild = (n: Node) => {
    appends2++;
    return orig2(n);
  };
  measureCharWidth(c2, 14, "Menlo, monospace");
  assert.equal(appends2, 0, "cache is metric-keyed, not container-keyed");
  c2.remove();
});
