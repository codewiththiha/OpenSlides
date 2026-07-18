/**
 * Mock of src/lib/tauri-api for the save-race suite (esbuild resolves
 * `lib/tauri-api` imports here, so hooks run with full manual control
 * over IPC resolution order — the knob the real pool of 5 SQLite
 * connections does not give us). Only the surface used by the modules
 * under test is implemented.
 */

export interface DeferredSave {
  slideId: string;
  code: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

/** Every updateSlideCode call, in the order the writer was invoked. */
export const saveCalls: Array<{ slideId: string; code: string }> = [];
/** One entry per call, resolve/reject manually to control completion order. */
export const pendingSaves: DeferredSave[] = [];

export function resolveNextSave(): void {
  const d = pendingSaves.shift();
  if (!d) throw new Error("no pending save to resolve");
  d.resolve();
}

export function resolveSaveAt(i: number): void {
  const d = pendingSaves.splice(i, 1)[0];
  if (!d) throw new Error("no pending save at index " + i);
  d.resolve();
}

export function resetApiMocks(): void {
  saveCalls.length = 0;
  pendingSaves.length = 0;
}

export const api = {
  updateSlideCode: (slideId: string, code: string) => {
    saveCalls.push({ slideId, code });
    return new Promise<void>((res, rej) => {
      pendingSaves.push({
        slideId,
        code,
        resolve: res,
        reject: (err: Error) => rej(err),
      });
    });
  },
  updateSlideSettings: (slideId: string, payload: unknown) =>
    Promise.resolve({
      id: slideId,
      ...(payload as object),
    }),
};

export type SlideSettingsPatch = Record<string, unknown>;
