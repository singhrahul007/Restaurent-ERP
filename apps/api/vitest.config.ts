import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
loadDotenv({ path: resolve(repoRoot, ".env") });

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
  },
});
