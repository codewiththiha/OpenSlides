/**
 * Tiny logger. debug() is dev-build only; warn/error always pass through.
 * Use for recoverable catches instead of swallowing errors silently.
 */
const IS_DEV = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

export const logger = {
  debug: (...args: unknown[]) => {
    if (IS_DEV) console.debug(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
