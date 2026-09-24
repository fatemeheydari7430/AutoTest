import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { CLOUDFLARE_STATE_PATH } from './src/config/paths';

const baseURL = process.env.WEB_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results',

  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      testMatch: /.*\.spec\.ts/,
    },

    {
      name: 'setup',
      testDir: './src',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'e2e-chromium',
      testDir: './tests/e2e',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: CLOUDFLARE_STATE_PATH },
    },
  ],
});