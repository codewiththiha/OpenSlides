/**
 * jsdom globals for the editor suites. MUST be imported before any
 * svelte/component-code import — ESM evaluates dependencies in import order.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, "navigator", {
  value: dom.window.navigator,
  writable: true,
  configurable: true,
});
g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.HTMLFormElement = dom.window.HTMLFormElement;
g.HTMLSelectElement = dom.window.HTMLSelectElement;
g.HTMLButtonElement = dom.window.HTMLButtonElement;
g.HTMLDivElement = dom.window.HTMLDivElement;
g.HTMLSpanElement = dom.window.HTMLSpanElement;
g.HTMLAnchorElement = dom.window.HTMLAnchorElement;
g.HTMLLabelElement = dom.window.HTMLLabelElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
// Constructors Svelte's client runtime touches during init_operations and
// template cloning (Text.prototype descriptors etc.).
g.Text = dom.window.Text;
g.Comment = dom.window.Comment;
g.CharacterData = dom.window.CharacterData;
g.DocumentFragment = dom.window.DocumentFragment;
g.DocumentType = dom.window.DocumentType;
g.SVGElement = dom.window.SVGElement;
g.HTMLTemplateElement = dom.window.HTMLTemplateElement;
g.Event = dom.window.Event;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
g.DOMRect = class DOMRect {
  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {}
};
g.MutationObserver = dom.window.MutationObserver;
const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
g.requestAnimationFrame = raf;
g.cancelAnimationFrame = clearTimeout;
// App code uses the window-scoped timers explicitly.
(dom.window as unknown as Record<string, unknown>).requestAnimationFrame = raf;
(dom.window as unknown as Record<string, unknown>).cancelAnimationFrame = clearTimeout;

// Read by src/lib/shiki-worker-client.ts (inline getHighlighter fallback) and
// src/hooks/useShikiDisplayState.svelte.ts (zero debounce) so the jsdom
// suites get synchronous, deterministic highlighting without a Worker.
g.__OPENSLIDES_TEST_ENV__ = true;

// jsdom omits some IE-era DOM APIs that older frontend runtimes feature-probe.
g.attachEvent = () => {};
g.detachEvent = () => {};
const proto = dom.window.HTMLElement.prototype as unknown as Record<
  string,
  unknown
>;
proto.attachEvent = function () {};
proto.detachEvent = function () {};
