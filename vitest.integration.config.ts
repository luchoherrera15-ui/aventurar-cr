import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config APARTE para supabase/tests-integracion/** — pruebas que
 * golpean un Postgres local real (npx supabase start), nunca
 * mockeado. Separada de vitest.config.ts para que `npm test` (la
 * suite normal, sin dependencias externas) nunca las recoja por
 * accidente.
 *
 *   npx supabase start
 *   npm run test:wallet-v2-local
 */
export default defineConfig({
  test: {
    pool: "threads",
    include: ["supabase/tests-integracion/**/*.test.ts"],
    // Estas pruebas crean filas reales y a veces esperan locks/colas
    // de Postgres bajo concurrencia — más tiempo que el default.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
