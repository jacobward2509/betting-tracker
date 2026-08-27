import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

const env = process.env.ENV ?? 'dev';
dotenv.config({ path: path.resolve(__dirname, `.env.${env}`) });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const API_BASE_URL = requireEnv('API_BASE_URL');
export const WEB_BASE_URL = requireEnv('WEB_BASE_URL');
// Optional (not required via requireEnv) — only needed once UI tests exist.
// dev today resolves to a locally-started frontend (npm run dev:web, Vite
// default http://localhost:5173); sit should point at a real deployed
// frontend URL once one exists. See playwright/.env.example.

export default defineConfig({
  tsconfig: './tsconfig.json',
  testDir: './tests',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 9 : 9,

  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],

  use: {
    video: process.env.CI ? 'retain-on-failure' : 'on',
    trace: process.env.CI ? 'retain-on-failure' : 'on',
    testIdAttribute: 'data-test-id',
  },

  projects: [
    // -------------------
    // API setup (fetches auth token)
    // -------------------
    {
      name: 'api-setup',
      testMatch: /api\/setup\/api\.setup\.ts/,
    },

    // -------------------
    // API tests — dev / sit / pre (full suite)
    // -------------------
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['api-setup'],
      use: {
        baseURL: process.env.API_BASE_URL,
      },
    },

    // -------------------
    // UI tests — dev / sit (smoke / functional / e2e tiers)
    // -------------------
    {
      name: 'smoke',
      testMatch: /smoke\/.*\.spec\.ts/,
      use: {
        baseURL: WEB_BASE_URL,
      },
    },
    {
      name: 'functional',
      testMatch: /functional\/.*\.spec\.ts/,
      use: {
        baseURL: WEB_BASE_URL,
      },
    },
    {
      name: 'e2e',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        baseURL: WEB_BASE_URL,
      },
    },
  ],
});
