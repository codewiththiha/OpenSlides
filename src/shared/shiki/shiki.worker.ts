/** Shiki Web Worker — one prioritized tokenization pipeline. */
import type { BundledLanguage, BundledTheme } from "shiki";
import { createShikiLoader } from "$lib/shiki/shiki-loader";
import { extractShikiCodeHtml } from "./extract-html";
import { MAX_CODE_LENGTH } from "./shiki-limits";

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

const workerScope = self as unknown as {
  postMessage: (message: WorkerResponse) => void;
  onmessage: ((event: MessageEvent<WorkerIncoming>) => void) | null;
};

function post(message: WorkerResponse): void {
  workerScope.postMessage(message);
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

workerScope.onmessage = (event: MessageEvent<WorkerIncoming>) => {
  const data = event.data;

  // Abort messages bypass the queue and are handled immediately.
  if ("type" in data && data.type === "abort") {
    addAborted(data.id);
    return;
  }

  const request = data as WorkerRequest;
  if (typeof request.id !== "number") return;
  if (isAborted(request.id)) {
    abortedIds.delete(request.id);
    post({ id: request.id, aborted: true });
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
        post({ id: request.id, aborted: true });
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
  if (code.length > MAX_CODE_LENGTH) {
    console.warn(
      `[Shiki Worker] code too large (${code.length} chars) — using plain fallback`,
    );
    post({ id, error: "code_too_large" });
    return;
  }

  try {
    if (isAborted(id)) {
      abortedIds.delete(id);
      post({ id, aborted: true });
      return;
    }

    const highlighter = await loader.getHighlighter(theme, lang);
    if (isAborted(id)) {
      abortedIds.delete(id);
      post({ id, aborted: true });
      return;
    }

    const html = highlighter.codeToHtml(code, {
      lang: lang as BundledLanguage,
      theme: theme as BundledTheme,
    });
    if (isAborted(id)) {
      abortedIds.delete(id);
      post({ id, aborted: true });
      return;
    }

    post({ id, html: extractShikiCodeHtml(html) });
  } catch (error) {
    if (isAborted(id)) {
      abortedIds.delete(id);
      post({ id, aborted: true });
      return;
    }
    post({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
