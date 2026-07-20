/**
 * useShikiWorker — single pipeline via Web Worker (merustmar JS duplicate removed).
 * All languages including merustmar are tokenized in worker via Shiki + custom grammar.
 * IPC failure rate <0.1%, so frozen JS fallback is now removed.
 *
 * Enhancement: AbortController for rapid typing / highlight plan changes.
 * - Each request gets its own AbortController; previous controller is aborted on new input.
 * - Main thread sends {type:'abort', id} to worker to terminate stale Shiki tokenization early.
 * - Worker listens for abort and skips posting stale result, freeing thread for current highlight.
 */

import { useEffect, useRef, useState } from "react";
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerAbort,
} from "@/workers/shiki.worker";

const DEBOUNCE_MS = 80;

interface Args {
  code: string;
  language: string;
  theme: string;
  isDark: boolean;
}

export function useShikiWorker({ code, language, theme }: Args): string | null {
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const lastRef = useRef<string | null>(null);
  const timer = useRef<number>(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(
      new URL("../workers/shiki.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = w;

    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      // Ignore aborted responses — worker freed thread for current highlight
      if ((e.data as any).aborted) return;
      if (e.data.id !== reqId.current) return;
      if (e.data.error || !e.data.html) return;
      lastRef.current = e.data.html;
      setHtml(e.data.html);
    };

    return () => {
      // Abort any in-flight work on unmount
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      if (reqId.current) {
        w.postMessage({
          type: "abort",
          id: reqId.current,
        } as WorkerAbort);
      }
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;

    // Abort previous highlight plan / typing request to free worker thread
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    // Tell worker to terminate stale tokenization early
    if (reqId.current) {
      workerRef.current.postMessage({
        type: "abort",
        id: reqId.current,
      } as WorkerAbort);
    }

    window.clearTimeout(timer.current);

    const controller = new AbortController();
    controllerRef.current = controller;

    timer.current = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      const id = ++reqId.current;
      workerRef.current?.postMessage({
        id,
        code,
        lang: language,
        theme,
      } as WorkerRequest);
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer.current);
      controller.abort();
      // Also send abort to worker for the pending id if it was already sent
      // (If id not yet incremented, abort previous)
      if (workerRef.current && reqId.current) {
        workerRef.current.postMessage({
          type: "abort",
          id: reqId.current,
        } as WorkerAbort);
      }
    };
  }, [code, language, theme]);

  return html ?? lastRef.current;
}

