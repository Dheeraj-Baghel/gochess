import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", timeout: 60_000, expect: { timeout: 15_000 }, fullyParallel: false, workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: process.env.BASE_URL || "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: process.env.BASE_URL ? undefined : { command: "npm run start", url: "http://localhost:3100", reuseExistingServer: !process.env.CI, timeout: 120_000 }
});