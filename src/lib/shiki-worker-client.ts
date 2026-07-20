/**
 * App-wide Shiki worker client.
 *
 * A single worker is shared by the editor and lazy slide thumbnails. Requests
 * are correlated by id; aborting a request only drops that request, leaving
 * the worker alive for the rest of the app.
 */
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

  worker = new Worker(
    new URL("../workers/shiki.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
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
  worker.onerror = (event) => {
    const error = event.error ?? new Error(event.message || "Shiki worker failed");
    for (const [id, entry] of pending) {
      pending.delete(id);
      entry.reject(error);
    }
  };
  return worker;
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

export function requestHtml(
  code: string,
  language: string,
  theme: string,
  signal?: AbortSignal,
): Promise<WorkerResponse> {
  return send({ code, lang: language, theme }, signal);
}
