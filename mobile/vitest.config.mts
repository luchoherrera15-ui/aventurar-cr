import { defineConfig } from "vitest/config";

/**
 * Pruebas de LÓGICA PURA del app.
 *
 * El app no tiene (ni necesita) un runner que sepa montar componentes
 * de React Native: eso pide jest-expo, un preset de Babel propio y un
 * transformer para cada módulo nativo, y se rompe en cada bump de SDK.
 * Lo que sí se puede probar sin nada de eso son las librerías de
 * `src/lib` que son aritmética y orden — que es justamente donde vive
 * la lógica GEMELA del sitio, la que se separó sin que nadie se diera
 * cuenta.
 *
 * Por eso `include` está atado a `src/lib`: si alguien escribe un test
 * que importe una pantalla, va a fallar acá y no a arrastrar medio
 * React Native adentro de vitest.
 */
export default defineConfig({
  test: {
    include: ["src/lib/**/*.test.ts"],
    environment: "node",
  },
});
