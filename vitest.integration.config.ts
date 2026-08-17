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
    // Fase 2D: por defecto Vitest corre ARCHIVOS de prueba distintos en
    // paralelo — descubierto porque wallet-v2-worker-sincronizacion.test.ts
    // (su propio drenarCola() opera sobre TODA wallet_sincronizaciones, a
    // propósito, para limpiar lo que hayan dejado otros archivos) empezó
    // a fallar de forma real cuando corrió AL MISMO TIEMPO que
    // wallet-v2-cola-sincronizacion.test.ts, que encola filas reales en
    // esa misma tabla compartida — una carrera entre archivos, no un bug
    // de ninguno de los dos por separado. Todos los archivos de esta
    // suite comparten el mismo Postgres local real (a propósito, no hay
    // base "por archivo"), así que correrlos en paralelo entre sí nunca
    // fue seguro — solo no se había notado hasta que un archivo empezó a
    // limpiar la tabla entera.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
