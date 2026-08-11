#!/usr/bin/env bash
#
# Carga en Vercel las 12 variables de Cloudflare, una por una.
#
# ── POR QUÉ ASÍ Y NO AUTOMATIZANDO EL NAVEGADOR ──────────────────────
#
# Cinco de estos valores son secretos (el Secret Access Key de R2, dos
# tokens de Cloudflare, la llave de firma y la secret de Turnstile).
# Automatizar el pegado en el panel web los haría pasar por capturas de
# pantalla, logs de automatización y el contexto de la conversación.
#
# Acá van de tu terminal a Vercel y nada más: el script NUNCA los
# imprime, no los guarda en ningún archivo y no quedan en el historial
# del shell (los lee `vercel env add` por su cuenta, desde stdin).
#
# ── USO ──────────────────────────────────────────────────────────────
#
#   bash scripts/cargar-variables-cloudflare.sh
#
# Te va a pedir cada valor. Pegalo y dale Enter. Si querés saltarte una
# (porque ya la cargaste), dejala vacía y Enter.
#
# Al final redespliega, que es el paso que más se olvida: Vercel no
# aplica variables nuevas a un despliegue que ya existe.

set -u

ENTORNO="${1:-production}"

echo "═══════════════════════════════════════════════════════════"
echo " Variables de Cloudflare → Vercel ($ENTORNO)"
echo "═══════════════════════════════════════════════════════════"
echo
echo "Dónde sale cada valor:"
echo
echo "  R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY"
echo "      R2 → Manage R2 API Tokens → el token que creaste"
echo "  R2_ENDPOINT"
echo "      https://<account_id>.r2.cloudflarestorage.com  (sale como 'S3 API')"
echo "  R2_REGION"
echo "      auto"
echo "  R2_BUCKET_ORIGINALS"
echo "      el nombre del bucket"
echo
echo "  CLOUDFLARE_ACCOUNT_ID           Panel → Overview, columna derecha"
echo "  CLOUDFLARE_IMAGES_ACCOUNT_HASH  Images → Overview"
echo "  CLOUDFLARE_IMAGES_DELIVERY_URL  https://imagedelivery.net/<hash>"
echo "  CLOUDFLARE_IMAGES_API_TOKEN     token con 'Cloudflare Images: Edit'"
echo "  CLOUDFLARE_IMAGES_SIGNING_KEY   Images → Keys"
echo
echo "  TURNSTILE_SECRET_KEY            Turnstile → tu widget"
echo "  NEXT_PUBLIC_TURNSTILE_SITE_KEY  ídem (esta es pública por diseño)"
echo
echo "Enter vacío = saltar esa variable."
echo

VARIABLES=(
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_ENDPOINT
  R2_REGION
  R2_BUCKET_ORIGINALS
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_IMAGES_ACCOUNT_HASH
  CLOUDFLARE_IMAGES_DELIVERY_URL
  CLOUDFLARE_IMAGES_API_TOKEN
  CLOUDFLARE_IMAGES_SIGNING_KEY
  TURNSTILE_SECRET_KEY
  NEXT_PUBLIC_TURNSTILE_SITE_KEY
)

cargadas=0
saltadas=0

for v in "${VARIABLES[@]}"; do
  echo "───────────────────────────────────────────────────────────"
  printf '  %s\n' "$v"

  # -s para los secretos: no se ve al escribir ni queda en pantalla.
  # Los tres que NO son secretos se muestran, para poder revisarlos.
  case "$v" in
    R2_REGION|R2_BUCKET_ORIGINALS|R2_ENDPOINT|CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_IMAGES_ACCOUNT_HASH|CLOUDFLARE_IMAGES_DELIVERY_URL|NEXT_PUBLIC_TURNSTILE_SITE_KEY)
      read -r -p "  valor: " valor
      ;;
    *)
      read -r -s -p "  valor (oculto): " valor
      echo
      ;;
  esac

  # `xargs` sin argumentos recorta espacios y saltos de línea pegados al
  # copiar del panel de Cloudflare, que es la causa más común de que una
  # variable "esté puesta" y no funcione.
  valor="$(printf '%s' "$valor" | xargs 2>/dev/null || printf '%s' "$valor")"

  if [ -z "$valor" ]; then
    echo "  → saltada"
    saltadas=$((saltadas + 1))
    continue
  fi

  # Si ya existía, se quita primero: `vercel env add` no pisa.
  npx --yes vercel env rm "$v" "$ENTORNO" --yes >/dev/null 2>&1

  if printf '%s' "$valor" | npx --yes vercel env add "$v" "$ENTORNO" >/dev/null 2>&1; then
    echo "  → cargada"
    cargadas=$((cargadas + 1))
  else
    echo "  → ERROR al cargar. Probá 'npx vercel login' y volvé a correr esto."
  fi

  unset valor
done

echo "═══════════════════════════════════════════════════════════"
echo "  cargadas: $cargadas    saltadas: $saltadas"
echo "═══════════════════════════════════════════════════════════"
echo
echo "Falta el paso que más se olvida: REDESPLEGAR."
echo "Vercel no aplica variables nuevas a un despliegue que ya existe."
echo
read -r -p "¿Redesplegar a producción ahora? [s/N] " confirma
case "$confirma" in
  s|S|si|SI|y|Y)
    npx --yes vercel --prod
    ;;
  *)
    echo "Ok. Cuando quieras: npx vercel --prod"
    ;;
esac

echo
echo "Después entrá a https://bookea.lat/api/media/diagnostico"
echo "y pegá el JSON. Ahí se comprueba de verdad contra R2 y Cloudflare."
