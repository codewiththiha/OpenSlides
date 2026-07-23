/** Shiki Web Worker — one prioritized tokenization pipeline. */
import { createShikiLoader } from "$lib/shiki/shiki-loader";
import { extractShikiCodeHtml } from "./extract-html";

const loader = createShikiLoader();

export interface WorkerRequest {
  id: number;
  code: string;
  lang: string;
  theme: string;
  /** High-priority editor work drains before low-priority thumbnails. */
  priority?: "high" | "low";
}

export interface WorkerAbort {
  type: "abort";
  id: number;
}

export type WorkerIncoming = WorkerRequest | WorkerAbort;

export interface WorkerResponse {
  id: number;
  html?: string;
  error?: string;
  aborted?: boolean;
}

const abortedIds = new Set<number>();
const ABORTED_MAX = 64;

function addAborted(id: number) {
  abortedIds.add(id);
  if (abortedIds.size > ABORTED_MAX) {
    const iterator = abortedIds.values();
    for (let i = 0; i < Math.floor(ABORTED_MAX / 2); i++) {
      const value = iterator.next().value;
      if (value !== undefined) abortedIds.delete(value);
    }
  }
}

function isAborted(id: number) {
  return abortedIds.has(id);
}

interface QueuedRequest {
  id: number;
  code: string;
  lang: string;
  theme: string;
  priority: "high" | "low";
}

const queue: QueuedRequest[] = [];
let pumping = false;

function enqueue(request: QueuedRequest) {
  if (request.priority === "high") {
    const firstLow = queue.findIndex((item) => item.priority === "low");
    if (firstLow < 0) queue.push(request);
    else queue.splice(firstLow, 0, request);
  } else {
    queue.push(request);
  }
}

self.onmessage = (event: MessageEvent<WorkerIncoming>) => {
  const data = event.data as any;

  // Abort messages bypass the queue and are handled immediately.
  if (data?.type === "abort" && typeof data.id === "number") {
    addAborted(data.id);
    return;
  }

  const request = data as WorkerRequest;
  if (typeof request.id !== "number") return;
  if (isAborted(request.id)) {
    abortedIds.delete(request.id);
    (self as any).postMessage({ id: request.id, aborted: true } as WorkerResponse);
    return;
  }

  enqueue({
    id: request.id,
    code: request.code,
    lang: request.lang,
    theme: request.theme,
    priority: request.priority === "low" ? "low" : "high",
  });
  void pump();
};

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const request = queue.shift()!;
      if (isAborted(request.id)) {
        abortedIds.delete(request.id);
        (self as any).postMessage({ id: request.id, aborted: true } as WorkerResponse);
        continue;
      }
      try {
        await processRequest(request);
      } catch {
        // processRequest owns error responses; never stall the queue.
      }
    }
  } finally {
    pumping = false;
  }
}

async function processRequest(request: QueuedRequest): Promise<void> {
  const { id, code, lang, theme } = request;
  if (code.length > 20_000) {
    console.warn(`[Shiki Worker] code too large (${code.length} chars) — using plain fallback`);
    (self as any).postMessage({ id, error: "code_too_large" } as WorkerResponse);
    return;
  }

  try {
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }

    const highlighter = await loader.getHighlighter(theme, lang);
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }

    const html = highlighter.codeToHtml(code, { lang: lang as any, theme: theme as any });
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }

    (self as any).postMessage({ id, html: extractShikiCodeHtml(html) } as WorkerResponse);
  } catch (error) {
    if (isAborted(id)) {
      abortedIds.delete(id);
      (self as any).postMessage({ id, aborted: true } as WorkerResponse);
      return;
    }
    (self as any).postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    } as WorkerResponse);
  }
}
