import { defineConfig, devices } from "@playwright/test";

const PORT = 8787;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "live",
      testDir: "./tests/e2e/live",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "live-no-js",
      testDir: "./tests/e2e/no-js",
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
  ],
  webServer: {
    command: "pnpm preview",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
