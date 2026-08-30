#!/usr/bin/env bash
#
# ¿HACE FALTA CONSTRUIR ESTE COMMIT?
# ==================================
#
# Vercel corre este script antes de cada build (`ignoreCommand` en
# vercel.json) y lee su código de salida:
#
#   salida 0  → IGNORA el build (no construye, no cobra CPU)
#   salida 1  → construye normalmente
#
# Por qué existe (30 ago 2026): se midió que ~10 de cada 97 commits de
# un ciclo no tocaban NADA del sitio web —eran de la app móvil, de
# documentación o migraciones de Supabase— y aun así disparaban una
# construcción completa de ~5,7 minutos de CPU. Ver la nota de costos
# en docs/ y el desglose real de un build.
#
# ⚠️ REGLA DE ORO: ANTE LA DUDA, CONSTRUIR.
# Un build de más cuesta unos centavos; un build que NO se hizo cuando
# hacía falta deja producción vieja sin que nadie se entere. Por eso
# cada caso raro (sin commit anterior, git que falla, primer deploy)
# cae del lado de construir.

set -u

# Rutas que SÍ afectan lo que se publica. Cualquier cambio acá obliga a
# construir. Todo lo demás (mobile/, docs/, supabase/, scripts/, .claude/)
# no cambia ni una línea del sitio servido.
RUTAS=(
  "src"
  "public"
  "package.json"
  "package-lock.json"
  "next.config.ts"
  "tsconfig.json"
  "vercel.json"
  "postcss.config.mjs"
)

# ⚠️ SE MIRAN VARIOS COMMITS, NO SOLO EL ÚLTIMO.
#
# La primera versión comparaba HEAD^ contra HEAD y se saltó un deploy de
# verdad (30 ago 2026): el push llevaba dos commits —uno con cambios de
# `src/` y encima otro que solo restauraba un PNG de la raíz— y Vercel
# construye el ÚLTIMO. Como ese último no tocaba el sitio, el script dijo
# «saltear» y los cambios reales se quedaron sin publicar, en silencio,
# que es exactamente el peor resultado posible.
#
# Mirar una ventana de commits corrige eso: si CUALQUIERA de los últimos
# tocó el sitio, se construye. Puede construir de más cuando la ventana
# alcanza commits ya desplegados; eso cuesta centavos, mientras que no
# construir cuando hacía falta cuesta producción vieja sin que nadie se
# entere. La regla de oro manda.
VENTANA=8

BASE="HEAD~${VENTANA}"
if ! git rev-parse "$BASE" >/dev/null 2>&1; then
  # Historial más corto que la ventana (clone superficial, repo nuevo):
  # se compara contra lo que haya, y si tampoco existe, se construye.
  if ! git rev-parse HEAD^ >/dev/null 2>&1; then
    echo "Sin historial para comparar — construyo por las dudas."
    exit 1
  fi
  BASE="HEAD^"
fi

# `git diff --quiet` sale 0 si NO hay cambios y 1 si los hay: es
# exactamente la convención que espera Vercel, pero al revés de lo que
# uno leería, así que se hace explícito.
if git diff --quiet "$BASE" HEAD -- "${RUTAS[@]}" 2>/dev/null; then
  echo "Ningún commit reciente ($BASE..HEAD) toca el sitio (${RUTAS[*]}) — me salto el build."
  exit 0
fi

echo "Hay cambios en el sitio — construyo."
exit 1
