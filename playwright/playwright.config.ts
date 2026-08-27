import {defineConfig} from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

const env = process.env.ENV ?? 'sit'
dotenv.config({path: path.resolve(__dirname, `.env.${env}`)})

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const API_BASE_URL = requireEnv('API_BASE_URL')

export default defineConfig({
  tsconfig: './tsconfig.json',
  testDir: './tests',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 9 : 9,

  reporter: [['html'], ['json', {outputFile: 'test-results/results.json'}]],

  use: {
    video: process.env.CI ? 'retain-on-failure' : 'on',
    trace: process.env.CI ? 'retain-on-failure' : 'on'
  },

  projects: [
    // -------------------
    // API setup (fetches auth token)
    // -------------------
    {
      name: 'api-setup',
      testMatch: /api\/setup\/api\.setup\.ts/
    },

    // -------------------
    // API tests — dev / sit / pre (full suite)
    // -------------------
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['api-setup'],
      use: {
        baseURL: process.env.API_BASE_URL
      }
    }
  ]
})
