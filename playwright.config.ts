/**
 * Browser smoke tests (dev only — never imported by src/, so never bundled).
 * Default target: the production build served by `vite preview`. Set
 * PLAYWRIGHT_BASE_URL to test a deployed preview instead. For a protected Vercel
 * preview run it under `vercel env run --` so the short-lived OIDC token is available;
 * tests/e2e/fixtures.ts attaches it to that origin only (never committed or printed).
 * Uses the locally installed Google Chrome; set PW_BUNDLED=1 to use Playwright's own
 * Chromium instead (after `npx playwright install chromium`).
 */
import { defineConfig } from '@playwright/test';

/** Node's env, typed locally so we don't need @types/node (not an approved dependency). */
declare const process: { env: Record<string, string | undefined> };

const remote = process.env.PLAYWRIGHT_BASE_URL;
/** `npm run test:e2e:perf` sets this to run only the opt-in @perf specs. */
const perf = Boolean(process.env.PW_PERF);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  // @perf specs measure frame times; they're opt-in (see test:e2e:perf).
  grep: perf ? /@perf/ : undefined,
  grepInvert: perf ? undefined : /@perf/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Each test renders WebGL in a full Chrome; more than two at once overloads a laptop
  // and makes timing-based checks (clock, growth) flaky.
  fullyParallel: true,
  workers: 2,
  retries: remote ? 1 : 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: remote ?? 'http://localhost:4173',
    channel: process.env.PW_BUNDLED ? undefined : 'chrome',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    // Traces record request headers, so none for remote runs (they carry the Vercel access token).
    trace: remote ? 'off' : 'retain-on-failure',
  },
  webServer: remote ? undefined : {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
