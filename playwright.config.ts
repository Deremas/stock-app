import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const browserChannel = process.env.PLAYWRIGHT_CHANNEL as
  | "chrome"
  | "msedge"
  | undefined;
const webServerCommand = process.env.PLAYWRIGHT_USE_BUILD
  ? `npm run start -- --port ${port}`
  : `npm run dev -- --port ${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
