import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests drive shared app state via store hooks
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `${BASE}/Driftless/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
