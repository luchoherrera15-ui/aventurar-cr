# Arnés de medición de rendimiento

Lo que produjo la línea base de [docs/rendimiento.md](../../docs/rendimiento.md) y lo
que hay que volver a correr, sin cambiarle nada, después de cada fase. Si la
medición de "después" no se hace con estos mismos scripts y las mismas URLs, la
comparación no vale.

## Instalación (una vez, fuera del proyecto)

Lighthouse pesa mucho y en Vercel las `devDependencies` se instalan en cada
build, así que **a propósito no está en el `package.json`**. Se instala aparte:

```bash
mkdir -p .rendimiento && cd .rendimiento
npm init -y
npm install lighthouse chrome-launcher puppeteer-core
cp ../scripts/rendimiento/*.mjs .
```

(`.rendimiento/` está ignorado por git.) Necesita Chrome instalado.

## Cómo se corre

```bash
node bateria.mjs prod        # Lighthouse + traza de red, 6 páginas, móvil y escritorio
node extras.mjs prod         # galería de 164 fotos, INP de laboratorio, TTFB por ruta
node repetir.mjs prod 3      # la mediana de 3 corridas: es LA cifra que se reporta
node supabase-tiempos.mjs    # cuánto tarda cada consulta de verdad
node resumen.mjs             # tabla en Markdown de todo lo medido
node analizar.mjs <etiqueta> # el detalle de una medición (waterfall, 20 más pesados…)
```

Para el build local: `npm run build && npm start` en otra terminal, y después
`node bateria.mjs local` / `node repetir.mjs local 3`.

## Antes / después

```bash
node resumen.mjs prod-antes prod-despues
```

Compara etiqueta por etiqueta y marca cada métrica con ✅ o ⚠️. Renombrar la
carpeta `resultados/` a `resultados-fase-N/` antes de volver a medir, para no
pisar la línea base.

## Qué hace cada script

| Script | Qué mide |
|---|---|
| `medir.mjs` | Lighthouse (LCP, FCP, TTFB, CLS, TBT, Speed Index) y guarda el JSON completo |
| `rastrear.mjs` | traza CDP: cada solicitud con bytes y tiempos, redirecciones, y el inventario de imágenes pedidas vs. visibles en pantalla |
| `interaccion.mjs` | INP de laboratorio: hace clics y scroll reales y mide la latencia de cada interacción |
| `ttfb-servidor.mjs` | TTFB por ruta a nivel de socket, separando conexión de espera del servidor |
| `supabase-tiempos.mjs` | las consultas del server component, cronometradas una por una |
| `analizar.mjs` | convierte una medición en el informe legible (fases del LCP, 20 recursos más pesados, cadenas encadenadas…) |
| `resumen.mjs` | la tabla comparativa |
| `repetir.mjs` | N corridas por página y reporta la mediana — una sola corrida varía hasta 700 ms |

## Dos advertencias que costaron tiempo

- **Una corrida no es una medición.** La misma URL dio 2185 ms y 2915 ms de LCP
  con minutos de diferencia. Siempre la mediana de 3, y se reporta el rango.
- **`localhost` no es producción.** No hay latencia de red real ni caché de
  Vercel. El build local sirve para comparar bytes, cantidad de solicitudes y
  tamaño de los bundles; los tiempos absolutos se leen de producción.
