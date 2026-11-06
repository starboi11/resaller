import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile('.env');
} catch {
  /* CI supplies environment directly. */
}

const deployedTarget = Boolean(process.env.E2E_WEB_URL);
const productionBuilds = process.env.E2E_USE_PRODUCTION_BUILDS === 'true';
const apiCommand = productionBuilds ? 'pnpm --filter @resaller/api start' : 'pnpm --filter @resaller/api dev';

if (
  !process.env.CI &&
  !deployedTarget &&
  process.env.DATABASE_URL &&
  process.env.E2E_USE_CONFIGURED_DATABASE !== 'true'
) {
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
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
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
  webServer: deployedTarget
    ? undefined
    : [
        {
          command:
            process.env.E2E_USE_CONFIGURED_DATABASE === 'true'
              ? apiCommand
              : `node scripts/prepare-e2e-database.mjs && ${apiCommand}`,
          url: 'http://127.0.0.1:4000/api/v1/health/ready',
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DATABASE_URL: process.env.DATABASE_URL,
            MEDIA_STORAGE_DRIVER: 'local',
            MEDIA_ROOT: './.e2e-data/media',
            PRIVATE_MEDIA_ROOT: './.e2e-data/private-media',
          },
        },
        {
          command:
            productionBuilds
              ? 'pnpm --filter @resaller/web start'
              : 'pnpm --filter @resaller/web exec next dev --port 3000 --webpack',
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NODE_ENV: productionBuilds ? 'production' : 'development',
            E2E_ALLOW_WEBPACK_EVAL: productionBuilds ? 'false' : 'true',
          },
        },
        {
          command:
            productionBuilds
              ? 'pnpm --filter @resaller/admin start'
              : 'pnpm --filter @resaller/admin exec next dev --port 3001 --webpack',
          url: 'http://127.0.0.1:3001/owner',
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NODE_ENV: productionBuilds ? 'production' : 'development',
            E2E_ALLOW_WEBPACK_EVAL: productionBuilds ? 'false' : 'true',
          },
        },
      ],
});
