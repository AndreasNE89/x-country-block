import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __XCB_PROD__: "false",
  },
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
