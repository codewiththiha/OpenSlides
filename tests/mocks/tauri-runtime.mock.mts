/**
 * Stubs for the @tauri-apps/api/* modules the component tree imports.
 * The app catches every Tauri failure ("not in tauri"), so no-op promises
 * keep behavior identical to running in a plain browser.
 */

/** @tauri-apps/api/event */
export async function listen(
  _event: string,
  _handler: (e: unknown) => void,
): Promise<() => void> {
  return () => {};
}
export async function emit(_event: string, _payload?: unknown): Promise<void> {}

/** @tauri-apps/api/core */
export async function invoke<T>(_cmd: string, _args?: unknown): Promise<T> {
  throw new Error("not in tauri (test env)");
}

/** @tauri-apps/api/window */
export function getCurrentWindow() {
  return {
    isFullscreen: async () => false,
    setFullscreen: async (_v: boolean) => {},
    setTitle: async (_t: string) => {},
  };
}
