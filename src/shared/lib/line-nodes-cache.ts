interface LineNodesCache {
  lineSpans: Element[];
  nodes: Text[][];
  dirty: boolean;
}

const nodesCache = new WeakMap<HTMLElement, LineNodesCache>();

function collectLineTextNodesUncached(root: HTMLElement): Text[][] {
  const lineSpans = root.querySelectorAll("span.line");
  if (lineSpans.length > 0) {
    const lines: Text[][] = [];
    lineSpans.forEach((span) => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        if ((n as Text).data) nodes.push(n as Text);
        n = walker.nextNode();
      }
      lines.push(nodes);
    });
    return lines;
  }

  const current: Text[][] = [[]];
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName === "BR") {
          current.push([]);
          return;
        }
        if (el.tagName === "STYLE" || el.tagName === "SCRIPT") return;
        if (el.classList.contains("shiki-magic-move-line-number")) return;
        if (el.classList.contains("shiki-magic-move-leave-active")) return;
        walk(el);
        return;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child as Text;
        if (t.data === "\n") {
          current.push([]);
        } else if (t.data) {
          current[current.length - 1]!.push(t);
        }
      }
    });
  };
  walk(root);
  while (current.length > 1 && current[current.length - 1]!.length === 0) {
    current.pop();
  }
  return current;
}

function collectLineSpanTextNodes(span: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if ((node as Text).data) nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

export function getLineTextNodes(root: HTMLElement): Text[][] {
  const cached = nodesCache.get(root);
  if (cached && !cached.dirty) return cached.nodes;

  const lineSpans = Array.from(root.querySelectorAll("span.line"));
  if (
    lineSpans.length > 0 &&
    cached &&
    cached.lineSpans.length === lineSpans.length
  ) {
    const nodes = lineSpans.map((span, index) =>
      span === cached.lineSpans[index]
        ? (cached.nodes[index] ?? collectLineSpanTextNodes(span))
        : collectLineSpanTextNodes(span),
    );
    nodesCache.set(root, { lineSpans, nodes, dirty: false });
    return nodes;
  }

  const nodes = collectLineTextNodesUncached(root);
  nodesCache.set(root, { lineSpans, nodes, dirty: false });
  return nodes;
}

export function clearLineNodesCache(root: HTMLElement) {
  const cached = nodesCache.get(root);
  if (cached) cached.dirty = true;
}
