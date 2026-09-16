import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile('.env');
} catch {
  /* CI supplies environment directly. */
}

if (!process.env.CI && process.env.DATABASE_URL) {
  const e2eDatabase = new URL(process.env.DATABASE_URL);
  e2eDatabase.pathname = '/resaller_e2e';
  process.env.DATABASE_URL = e2eDatabase.toString();
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-android', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    {
      command:
        'node scripts/prepare-e2e-database.mjs && pnpm --filter @resaller/api dev',
      url: 'http://127.0.0.1:4000/api/v1/health/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        MEDIA_STORAGE_DRIVER: 'local',
        MEDIA_ROOT: './.e2e-data/media',
        PRIVATE_MEDIA_ROOT: './.e2e-data/private-media',
      },
    },
    {
      command: 'pnpm --filter @resaller/web dev',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @resaller/admin dev',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
