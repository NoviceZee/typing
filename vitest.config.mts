import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "127.0.0.1"
  },
  test: {
    environment: "node",
    globals: true,
    // The UI suites exercise shared jsdom timers, storage and audio mocks.
    // Running files concurrently can starve the event loop and turn valid
    // interactions into flaky 5-second timeouts in CI.
    maxWorkers: 1,
    minWorkers: 1
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname
    }
  }
});
