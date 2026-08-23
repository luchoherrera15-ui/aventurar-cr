// Linter de la app. Ver https://docs.expo.dev/guides/using-eslint/
//
// Este archivo es CommonJS a propósito: ESLint lo carga con require() y
// `eslint-config-expo` se publica en CJS.
//
// Ojo con `package.json`: ahí hay un `overrides` que sube
// eslint-plugin-react-hooks a la 7 (eslint-config-expo pide la 5). Es a
// propósito y no se puede sacar: el código de la app ya tiene comentarios
// `eslint-disable-next-line react-hooks/set-state-in-effect`, una regla que
// solo existe de la 6 en adelante y que el sitio sí tiene. Con la 5 esos
// comentarios apuntan a una regla inexistente y ESLint falla por eso, no
// por el código.
//
// Criterio: la base es la que Expo recomienda para React Native
// (`eslint-config-expo` 10.x, que es la del SDK 54), y encima va la parte
// de TypeScript con las MISMAS severidades que el sitio (`eslint.config.mjs`
// en la raíz), para que un error en la app se lea igual que un error en el
// sitio. Lo que no se parece al sitio es lo que no puede parecerse: Next no
// tiene Metro ni módulos nativos.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');

/**
 * Todo el código de la app está en TypeScript. Se incluyen .mts/.cts para
 * que vitest.config.mts también se revise con el parser de TypeScript
 * (`eslint-config-expo` solo cubre .ts/.tsx/.d.ts).
 */
const TS = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

module.exports = defineConfig([
  globalIgnores([
    // Generado o nativo: se reescribe solo, no se corrige a mano.
    '.expo/**',
    'dist/**',
    'web-build/**',
    'android/**',
    'ios/**',
    'expo-env.d.ts',
  ]),

  expoConfig,

  // ---------------------------------------------------------------------
  // TypeScript, con el mismo juego de reglas que el sitio: el sitio saca su
  // parte de TS de `eslint-config-next/typescript`, que por dentro es el
  // "recommended" de typescript-eslint. Acá se pide ese mismo recommended
  // directamente, así `no-explicit-any`, `ban-ts-comment` y compañía son
  // ERROR en la app igual que en el sitio (la config de Expo sola los deja
  // en warn, o directamente no los trae).
  // ---------------------------------------------------------------------
  {
    files: TS,
    extends: [typescriptEslint.configs['flat/recommended']],
    rules: {
      // El guion bajo adelante ya se usa en el código para decir "esto no
      // se usa y es a propósito" (_e en un catch). Mismo patrón que el sitio.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // El recommended de typescript-eslint deja no-require-imports en error
      // pensando en un bundler que solo entiende ESM. Metro no es eso: las
      // imágenes y las fuentes se cargan con require('./x.png') y esa es la
      // forma correcta en React Native. Se conserva la severidad de error
      // del sitio pero con la lista de assets de Expo.
      '@typescript-eslint/no-require-imports': [
        'error',
        {
          allow: [
            '\\.(aac|aiff|avif|bmp|caf|db|gif|heic|html|jpeg|jpg|json|m4a|m4v|mov|mp3|mp4|mpeg|mpg|otf|pdf|png|psd|svg|ttf|wav|webm|webp|xml|yaml|yml|zip)$',
          ],
        },
      ],

      // Lo que esconde un bug de verdad sube a ERROR: en la config de Expo
      // casi todo está en warn, y un warn no frena a nadie. La lista es
      // corta a propósito.
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, enforceForJSX: true },
      ],
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },

  // ---------------------------------------------------------------------
  // Reglas del núcleo que valen para todo archivo.
  // ---------------------------------------------------------------------
  {
    rules: {
      // Código que nunca se ejecuta o comparaciones que siempre dan lo
      // mismo: no es estilo, es un bug ya escrito.
      'no-unreachable': 'error',
      'no-unsafe-negation': 'error',
      'no-empty-pattern': 'error',
      'no-extend-native': 'error',
      'no-constant-condition': 'error',
      eqeqeq: ['error', 'smart'],
      // El sitio los tiene en error (vienen de la config de Next); la de
      // Expo trae no-var en error y prefer-const no lo trae.
      'prefer-const': 'error',
      'no-var': 'error',

      // Hooks. rules-of-hooks ya viene en error del recommended de
      // react-hooks. exhaustive-deps queda en WARN, igual que en el sitio:
      // en pantallas con navegación la lista "completa" de dependencias a
      // veces cambia el comportamiento, y eso lo decide una persona, no el
      // linter.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ---------------------------------------------------------------------
  // Archivos de configuración de Node (Metro, Vitest): no son código de la
  // app, corren en Node y no en el teléfono. Metro carga metro.config.js
  // haciendo require() literal sobre él, así que ahí CommonJS no es un
  // estilo viejo, es el contrato.
  // ---------------------------------------------------------------------
  {
    files: ['*.config.js', '*.config.cjs', '*.config.mjs', '*.config.mts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['*.config.js', '*.config.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
]);
