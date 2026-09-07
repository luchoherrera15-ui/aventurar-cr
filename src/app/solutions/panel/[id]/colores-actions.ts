"use server";

import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { conVariante, esUrlDeCloudflare } from "@/lib/solutions/fotos";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { paletaDePixeles, type PropuestaColores } from "@/lib/colores-imagen";

/**
 * LOS COLORES DE UNA IMAGEN YA GUARDADA — la red de seguridad.
 *
 * El camino normal es el del navegador (`coloresDeArchivo`): el color se
 * lee del archivo recién elegido, antes de subirlo, sin tocar la red.
 * Esta acción existe para las imágenes que YA estaban guardadas cuando
 * llegó la función (7 sep 2026) y para el navegador que no pueda leer
 * la imagen por CORS: el servidor la baja, la achica a 64 px con sharp
 * (el mismo sharp que dibuja los pases) y le pasa los píxeles al mismo
 * módulo neutral. Un solo algoritmo, dos entradas.
 *
 * Solo lee imágenes NUESTRAS (Cloudflare Images de la cuenta o el bucket
 * de Solutions): no es un proxy para bajar cualquier URL.
 */

const BUCKET = "solutions-fotos";
const MAX_BYTES = 12 * 1024 * 1024;

export async function coloresDeImagenSolutions(url: string): Promise<{ ok: true; colores: PropuestaColores } | { ok: false; motivo: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Se cerró tu sesión. Recargá la página." };

  const limpia = (url ?? "").trim();
  const deCloudflare = esUrlDeCloudflare(limpia, process.env.CLOUDFLARE_IMAGES_DELIVERY_URL);
  if (!deCloudflare && !esUrlDeNuestroStorage(limpia, BUCKET)) {
    return { ok: false, motivo: "Solo se leen imágenes subidas desde el panel." };
  }
  // De Cloudflare se pide la variante chica: 400 px alcanzan y pesan 20 veces menos.
  const aLeer = deCloudflare ? (conVariante(limpia, "thumb") ?? limpia) : limpia;

  try {
    const r = await fetch(aLeer, { cache: "no-store" });
    if (!r.ok) return { ok: false, motivo: "No se pudo leer la imagen." };
    if (Number(r.headers.get("content-length") ?? 0) > MAX_BYTES) return { ok: false, motivo: "La imagen es demasiado grande para analizarla." };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return { ok: false, motivo: "La imagen es demasiado grande para analizarla." };

    const datos = await sharp(buf).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer();
    const colores = paletaDePixeles(new Uint8ClampedArray(datos.buffer, datos.byteOffset, datos.byteLength));
    if (!colores) return { ok: false, motivo: "La imagen no tiene colores que leer." };
    return { ok: true, colores };
  } catch {
    return { ok: false, motivo: "No se pudo analizar la imagen. Probá de nuevo en un momento." };
  }
}
