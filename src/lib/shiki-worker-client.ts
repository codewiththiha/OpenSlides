/**
 * App-wide Shiki worker client.
 *
 * A single worker is shared by the editor and lazy slide thumbnails. Requests
 * are correlated by id; aborting a request only drops that request, leaving
 * the worker alive for the rest of the app.
 */
import { getHighlighter } from "@/lib/shiki-instance";
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerAbort,
} from "@/workers/shiki.worker";

let worker: Worker | null = null;
let nextId = 0;

interface Pending {
  resolve: (response: WorkerResponse) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;

  const createdWorker = new Worker(
    new URL("../workers/shiki.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker = createdWorker;
  createdWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (entry.signal && entry.onAbort) {
      entry.signal.removeEventListener("abort", entry.onAbort);
    }
    if (response.aborted) {
      entry.reject(new DOMException("Aborted", "AbortError"));
    } else if (response.error) {
      entry.reject(new Error(response.error));
    } else {
      entry.resolve(response);
    }
  };
  createdWorker.onerror = (event) => {
    const error = event.error ?? new Error(event.message || "Shiki worker failed");
    // A fatal worker error leaves this instance unusable. Drop and terminate it
    // so the next request can create a clean worker rather than reusing a dead one.
    if (worker === createdWorker) {
      worker = null;
      createdWorker.terminate();
    }
    for (const [id, entry] of pending) {
      pending.delete(id);
      entry.reject(error);
    }
  };
  return createdWorker;
}

function send(
  request: Omit<WorkerRequest, "id">,
  signal?: AbortSignal,
): Promise<WorkerResponse> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  const id = ++nextId;
  const w = getWorker();
  return new Promise<WorkerResponse>((resolve, reject) => {
    const onAbort = () => {
      pending.delete(id);
      w.postMessage({ type: "abort", id } satisfies WorkerAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    pending.set(id, { resolve, reject, signal, onAbort });
    signal?.addEventListener("abort", onAbort, { once: true });
    w.postMessage({ ...request, id } satisfies WorkerRequest);
  });
}

export async function requestHtml(
  code: string,
  language: string,
  theme: string,
  signal?: AbortSignal,
  priority: "high" | "low" = "high",
): Promise<WorkerResponse> {
  if (
    typeof Worker === "undefined" ||
    (typeof window !== "undefined" && (window as any).IS_REACT_ACT_ENVIRONMENT) ||
    (typeof globalThis !== "undefined" && (globalThis as any).IS_REACT_ACT_ENVIRONMENT)
  ) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const h = await getHighlighter(theme, language);
    return {
      id: -1,
      html: h.codeToHtml(code, { lang: language, theme }),
    };
  }
  return send({ code, lang: language, theme, priority }, signal);
}
