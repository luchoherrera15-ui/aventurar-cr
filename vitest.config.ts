import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
