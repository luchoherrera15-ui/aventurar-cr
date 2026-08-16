import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// El alias "@/..." del tsconfig, para que los tests importen igual
// que el resto del código.
export default defineConfig({
  // `sharp` carga un binario nativo, y en los workers BIFURCADOS que
  // vitest usa por defecto ese binario tumba el proceso: la corrida
  // termina con "Worker exited unexpectedly" y un archivo sin correr,
  // aunque ningún test haya fallado de verdad.
  //
  // Con hilos comparten proceso y el binario se carga una sola vez.
  // Comprobado: mismos 986 tests, 42 archivos, sin errores.
  //
  // Si algún día un test necesita aislamiento de proceso de verdad
  // (variables de entorno globales, mocks del sistema de archivos),
  // se le pone `pool: "forks"` a ESE archivo, no a toda la suite.
  test: {
    pool: "threads",
    // supabase/tests-integracion/** necesita un Postgres local real
    // (npx supabase start) — no son parte de `npm test`, que no debe
    // depender de nada externo. Corren aparte con
    // `npm run test:wallet-v2-local` (vitest.integration.config.ts).
    // Se parte de los excludes DEFAULT de vitest (configDefaults) y
    // solo se agrega el nuevo — reemplazar el array a mano arriesga
    // perder node_modules/dist/etc. si vitest cambia sus defaults.
    exclude: [...configDefaults.exclude, "supabase/tests-integracion/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
