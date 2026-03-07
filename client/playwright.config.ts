import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3001",
  },
  webServer: [
    {
      command: "npm --prefix ../server run dev",
      url: "http://localhost:3001/api/meta",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
