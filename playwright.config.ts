import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:3030', viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  webServer: { command: 'npm run dev', url: 'http://localhost:3030', reuseExistingServer: !process.env.CI },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
