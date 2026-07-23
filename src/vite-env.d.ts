/// <reference types="vite/client" />

interface Window {
  __OPENSLIDES_TEST_ENV__?: boolean;
}

/** Set by the test harness (tests/helpers/jsdom-env.mts). */
// eslint-disable-next-line no-var
var __OPENSLIDES_TEST_ENV__: boolean | undefined;
