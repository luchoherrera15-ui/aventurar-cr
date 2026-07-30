import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// El alias "@/..." del tsconfig, para que los tests importen igual
// que el resto del código.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
