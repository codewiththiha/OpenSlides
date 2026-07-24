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
g.history = dom.window.history;
g.location = dom.window.location;
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
g.CustomEvent = dom.window.CustomEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
// Fire one initial observation per observe() — real ResizeObservers do this,
// and measured/virtualized layouts depend on the initial size.
g.ResizeObserver = class ResizeObserver {
  constructor(cb: (entries: unknown[], obs: unknown) => void) {
    this.cb = cb;
  }
  cb: (entries: unknown[], obs: unknown) => void;
  observed = new Set<Element>();
  observe(el: Element) {
    if (this.observed.has(el)) return;
    this.observed.add(el);
    queueMicrotask(() => {
      if (!this.observed.has(el)) return;
      this.cb(
        [
          {
            target: el,
            contentRect: (el as HTMLElement).getBoundingClientRect(),
          },
        ],
        this,
      );
    });
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
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
// jsdom stubs these behind `HTMLMediaElement` only when media features are
// on; app deps feature-probe them unconditionally (interactive-el checks).
g.HTMLMediaElement =
  dom.window.HTMLMediaElement ??
  class HTMLMediaElement extends dom.window.HTMLElement {};
g.HTMLVideoElement =
  dom.window.HTMLVideoElement ??
  class HTMLVideoElement extends (g.HTMLMediaElement as never) {};
g.HTMLAudioElement =
  dom.window.HTMLAudioElement ??
  class HTMLAudioElement extends (g.HTMLMediaElement as never) {};
g.HTMLImageElement = dom.window.HTMLImageElement;
const mql = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
});
g.matchMedia = mql;
(dom.window as unknown as Record<string, unknown>).matchMedia = mql;
const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
g.requestAnimationFrame = raf;
g.cancelAnimationFrame = clearTimeout;
// App code uses the window-scoped timers explicitly.
(dom.window as unknown as Record<string, unknown>).requestAnimationFrame = raf;
(dom.window as unknown as Record<string, unknown>).cancelAnimationFrame =
  clearTimeout;

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
// jsdom has no Web Animations API; Svelte 5 transitions are WAAPI-driven.
// A finished-immediately stub keeps intro/outro signals deterministic.
proto.animate = function () {
  const anim: Record<string, unknown> = {
    cancel() {},
    finish() {},
    pause() {},
    play() {},
    reverse() {},
    addEventListener() {},
    removeEventListener() {},
    currentTime: 0,
    playbackRate: 1,
    playState: "finished",
    effect: null,
    timeline: null,
  };
  anim.finished = Promise.resolve(anim);
  anim.ready = Promise.resolve(anim);
  return anim;
};
proto.getAnimations = function () {
  return [];
};
proto.scrollIntoView = function () {};
// jsdom layout returns 0×0 rects everywhere; virtualized lists then render
// no rows at all. Give CONNECTED elements a stable, realistic default rect.
proto.getBoundingClientRect = function () {
  const connected = this.isConnected;
  const width = connected ? 1280 : 0;
  const height = connected ? 800 : 0;
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON() {},
  };
};
// offset*/client* are also always 0 in jsdom; virtual-core's getRect reads
// offsetWidth/offsetHeight specifically.
for (const [prop, val] of [
  ["offsetWidth", 1280],
  ["clientWidth", 1280],
  ["offsetHeight", 800],
  ["clientHeight", 800],
] as const) {
  Object.defineProperty(proto, prop, {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? val : 0;
    },
  });
}
g.Animation = class Animation {};
