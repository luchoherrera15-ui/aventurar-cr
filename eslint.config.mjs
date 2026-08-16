import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generado por Expo (está en mobile/.gitignore): sus tipos traen un
    // eslint-disable que acá sobra, y no tiene sentido corregir un
    // archivo que se reescribe solo en cada build.
    "mobile/.expo/**",
    // Generado por el CLI de Supabase en cada `supabase start`/`db
    // reset` (secretos de los contenedores locales, snapshots) — no es
    // código del repo, ya está en supabase/.gitignore, y se reescribe
    // solo. Fase 2C (Wallet V2): antes de esto, `npm run lint` fallaba
    // con 154 errores de un archivo generado acá adentro
    // (supabase_edge_runtime, un `index.ts` minificado de terceros),
    // sin que nada de `src/` estuviera involucrado.
    "supabase/.temp/**",
  ]),
  // El guion bajo adelante ya se usa en el código para decir "esto no se
  // usa y es a propósito" (_e en un catch, _estado en un destructuring).
  // La config de Next no lo reconoce por defecto, así que avisaba de
  // cosas que ya estaban marcadas como intencionales.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Los archivos de configuración de Node son CommonJS y no pueden dejar
  // de serlo: Metro carga mobile/metro.config.js haciendo literalmente
  // require() sobre él, así que escribirlo con `import` no es un estilo
  // más limpio, es un build roto. La regla no-require-imports viene de la
  // config de Next, pensada para el código de la app — acá no aplica.
  {
    files: ["**/*.config.js", "**/*.config.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
