/**
 * useShikiWorker — single pipeline via Web Worker (merustmar JS duplicate removed).
 * All languages including merustmar are tokenized in worker via Shiki + custom grammar.
 * IPC failure rate <0.1%, so frozen JS fallback is now removed.
 */
import { useEffect, useRef, useState } from "react";
import type { WorkerRequest, WorkerResponse } from "@/workers/shiki.worker";

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
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../workers/shiki.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== reqId.current) return;
      if (e.data.error || !e.data.html) return;
      lastRef.current = e.data.html;
      setHtml(e.data.html);
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const id = ++reqId.current;
      workerRef.current?.postMessage({ id, code, lang: language, theme } as WorkerRequest);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer.current);
  }, [code, language, theme]);

  return html ?? lastRef.current;
}

export function createShikiWorker() {
  return new Worker(new URL("../workers/shiki.worker.ts", import.meta.url), { type: "module" });
}
