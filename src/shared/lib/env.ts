/**
 * Test-environment detection for the esbuild/jsdom test harness (tests set
 * __OPENSLIDES_TEST_ENV__ on window/globalThis before importing app code).
 */
export function isTestEnv(): boolean {
  return Boolean(
    (typeof window !== "undefined" && window.__OPENSLIDES_TEST_ENV__) ||
    (typeof globalThis !== "undefined" && globalThis.__OPENSLIDES_TEST_ENV__),
  );
}
