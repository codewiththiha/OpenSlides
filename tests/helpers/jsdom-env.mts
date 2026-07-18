/**
 * jsdom globals for the save-race suite. MUST be imported before any
 * react/react-dom import — ESM evaluates dependencies in import order.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.navigator = dom.window.navigator;
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
g.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = clearTimeout;
g.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom omits IE-era DOM APIs that react-dom still feature-probes (its
// check `typeof elm.attachEvent === "function"` only guards the attach
// path; the detach path calls it unconditionally).
g.attachEvent = () => {};
g.detachEvent = () => {};
const proto = dom.window.HTMLElement.prototype as unknown as Record<
  string,
  unknown
>;
proto.attachEvent = function () {};
proto.detachEvent = function () {};
