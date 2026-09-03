import { createAnonClient } from "@/lib/supabase/server";
import { esRegionDe, codigoPaisDe } from "@/lib/paises";

/**
 * ════════════════════════════════════════════════════════════════════
 *  DE UNAS COORDENADAS A UNA REGIÓN — «Mi ubicación» del buscador
 * ════════════════════════════════════════════════════════════════════
 *
 * El navegador da latitud y longitud; los directorios filtran por
 * PROVINCIA (o estado, o departamento, según el país). Este endpoint es
 * el puente.
 *
 * ── POR QUÉ CONTRA LOS NEGOCIOS Y NO CONTRA UNA TABLA DE CENTROIDES ──
 *
 * Lo obvio sería tener las coordenadas del centro de cada provincia y
 * elegir la más cercana. No se hace, y no es por pereza: esos centroides
 * habría que inventarlos o copiarlos de algún lado, y quedarían como un
 * segundo mapa del país que nadie mantiene — con el detalle de que la
 * provincia más cercana AL CENTRO no siempre es la provincia donde uno
 * está parado (Costa Rica tiene provincias largas y curvas).
 *
 * Acá se contesta con el negocio real más cercano. Eso responde la
 * pregunta que de verdad importa —«¿dónde hay algo para mí?»— y no
 * necesita ningún dato nuevo: `ranchos` ya guarda `latitud`, `longitud`
 * y `provincia`.
 *
 * Consecuencia honesta y aceptada: si no hay NINGÚN negocio con
 * coordenadas, se responde `null` y el buscador deja el «Dónde» como
 * estaba, en vez de inventar una provincia. Con el directorio recién
 * arrancando eso va a pasar seguido, y es la respuesta correcta.
 *
 * ── LA DISTANCIA ES APROXIMADA, Y ALCANZA ───────────────────────────
 *
 * Se usa equirectangular con corrección por coseno de la latitud, no
 * Haversine. A escala de un país la diferencia es de metros, y acá solo
 * hay que ORDENAR — no se muestra ninguna distancia, así que un error de
 * metros no puede equivocar el resultado.
 *
 * ── SIN LLAVE DE SERVICIO ───────────────────────────────────────────
 *
 * Lee con la anon key: son negocios aprobados y públicos, los mismos que
 * cualquiera ve en el directorio. Un endpoint sin autenticar que use la
 * llave de servicio es exactamente lo que no hay que hacer.
 */

export const dynamic = "force-dynamic";

type Fila = {
  provincia: string | null;
  pais: string | null;
  latitud: number | null;
  longitud: number | null;
};

/** Grados a kilómetros, aproximado y suficiente para ordenar. */
function distanciaAprox(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const KM_POR_GRADO = 111;
  const dLat = lat1 - lat2;
  // La longitud «se encoge» al alejarse del ecuador: sin este coseno,
  // un punto al este pesaría lo mismo que uno al norte y el orden
  // saldría torcido.
  const dLng = (lng1 - lng2) * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) * KM_POR_GRADO;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  // Rangos reales del planeta: un `NaN` o un 999 no merece una consulta.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ ok: false, motivo: "Coordenadas inválidas." }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json({ ok: false, motivo: "Coordenadas fuera de rango." }, { status: 400 });
  }

  const supabase = createAnonClient();
  if (!supabase) {
    return Response.json({ ok: false, motivo: "No hay conexión." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("ranchos")
    .select("provincia, pais, latitud, longitud")
    .eq("estado", "aprobado")
    // Faltaba (2 sep 2026): las demos inflaban el conteo por provincia.
    .neq("en_marketplace", false)
    .not("latitud", "is", null)
    .not("longitud", "is", null);

  if (error) {
    return Response.json({ ok: false, motivo: "No se pudo consultar." }, { status: 503 });
  }

  let mejor: { provincia: string; pais: string } | null = null;
  let mejorDistancia = Infinity;

  for (const fila of (data ?? []) as Fila[]) {
    if (fila.latitud === null || fila.longitud === null || !fila.provincia) continue;
    const pais = codigoPaisDe(fila.pais);
    // La provincia se valida contra SU país antes de devolverla: una
    // fila con «San José» y `pais='mx'` es un dato roto, y emitirlo
    // haría que el directorio filtre por una región que no existe allá.
    if (!esRegionDe(pais, fila.provincia)) continue;

    const d = distanciaAprox(lat, lng, fila.latitud, fila.longitud);
    if (d < mejorDistancia) {
      mejorDistancia = d;
      mejor = { provincia: fila.provincia, pais };
    }
  }

  // `null` es una respuesta legítima, no un error: significa «no hay
  // ningún negocio ubicado todavía». El buscador deja el «Dónde» como
  // estaba en vez de inventar una región.
  return Response.json({ ok: true, cerca: mejor });
}
