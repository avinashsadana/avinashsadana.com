import { defineConfig, devices } from '@playwright/test';

// Tests assert against the database directly, so they need the same credentials
// the server uses. Vercel supplies these in CI; locally they come from the file
// `vercel env pull` writes.
try {
  process.loadEnvFile('.env.local');
} catch {
  // Absent in CI, where the variables are already in the environment.
}

// A dedicated port so the suite never collides with a dev server left open.
const PORT = 4322;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      // Mobile-layout assertions belong to the mobile project only.
      testIgnore: /responsive\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['iPhone 14'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    // `--ignore-lock` so a background dev server on another port cannot make
    // this one exit early.
    command: `npx astro dev --port ${PORT} --ignore-lock`,
    url: baseURL,
    // A server already running without PW_TEST would still have the dev toolbar
    // injected, so the suite always starts its own.
    reuseExistingServer: false,
    env: {
      PW_TEST: '1',
      // Astro auto-detects agent shells and daemonises the dev server, which
      // makes Playwright think the process died. This opts back into foreground.
      ASTRO_DEV_BACKGROUND: '0',
    },
    timeout: 120_000,
  },
});
