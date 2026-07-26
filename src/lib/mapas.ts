/**
 * Saca las coordenadas de lo que pegue el dueño en el formulario:
 * un link de Google Maps (largo o corto), un link de Waze, o las
 * coordenadas escritas a mano.
 *
 * No usa la API de Google — solo lee el texto y, si es un link corto,
 * sigue la redirección para ver a dónde apunta.
 */

const COORD = String.raw`(-?\d{1,3}\.\d{3,})`;

// Los formatos en los que Google y Waze dejan las coordenadas dentro
// de sus URLs, en orden de qué tan confiable es cada uno.
const PATRONES = [
  // .../place/Rancho/@9.9281,-84.0907,17z  — el @ es la vista del mapa
  new RegExp(String.raw`@${COORD},${COORD}`),
  // ...!3d9.9281!4d-84.0907 — el punto real del lugar, más exacto que el @
  new RegExp(String.raw`!3d${COORD}!4d${COORD}`),
  // ...?q=9.9281,-84.0907 / &query=... / waze ?ll=...
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=${COORD}%2C\s*${COORD}`, "i"),
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=${COORD},\s*${COORD}`, "i"),
  // Coordenadas pegadas a mano: "9.9281, -84.0907"
  new RegExp(String.raw`^\s*${COORD},\s*${COORD}\s*$`),
];

// Solo seguimos redirecciones hacia estos dominios: sin esta lista, el
// servidor haría una petición a cualquier dirección que le peguen.
const HOSTS_PERMITIDOS = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "google.com",
  "www.google.com",
];

function esHostPermitido(url: URL) {
  return HOSTS_PERMITIDOS.some(
    (h) => url.hostname === h || url.hostname.endsWith("." + h),
  );
}

function buscarEnTexto(texto: string): { lat: number; lng: number } | null {
  for (const patron of PATRONES) {
    const m = texto.match(patron);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      return { lat, lng };
    }
  }
  return null;
}

export async function extraerCoordenadas(
  entrada: string,
): Promise<{ lat: number; lng: number } | null> {
  const texto = entrada.trim();
  if (!texto) return null;

  // Primero sin red: coordenadas a mano o link largo ya traen todo.
  const directo = buscarEnTexto(texto);
  if (directo) return directo;

  if (!/^https?:\/\//i.test(texto)) return null;

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (!esHostPermitido(url)) return null;

  // Los links que se comparten desde el celular son cortos y no traen
  // las coordenadas: hay que ver a dónde redirigen.
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AventureaCR/1.0)" },
    });

    const enUrlFinal = buscarEnTexto(res.url);
    if (enUrlFinal) return enUrlFinal;

    // Algunos links cortos devuelven una página intermedia con el
    // destino adentro en vez de redirigir de una.
    const cuerpo = (await res.text()).slice(0, 200_000);
    return buscarEnTexto(cuerpo);
  } catch {
    // Sin conexión o link caído: no es un error del dueño, simplemente
    // se guarda sin coordenadas y los botones usan la dirección escrita.
    return null;
  }
}
