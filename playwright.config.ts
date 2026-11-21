import { defineConfig, devices } from "@playwright/test";

/**
 * Two suites:
 *  - smoke  (tests/e2e/smoke.spec.ts): runs without Supabase credentials.
 *  - full   (tests/e2e/full-flow.spec.ts): requires a TEST Supabase project with
 *           migrations + seed applied and E2E_FULL=1 (see docs/TEST_REPORT.md).
 * The app is started with `next start` on port 3100 (run `npm run build` first).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
// Use an installed browser (e.g. E2E_CHANNEL=chrome or msedge) when the bundled
// Playwright Chromium cannot be downloaded.
const channel = process.env.E2E_CHANNEL || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    channel,
    locale: "tr-TR",
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "mobile-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        // /api/health returns 503 without Supabase, so readiness polls a static route.
        url: `http://localhost:${PORT}/robots.txt`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
