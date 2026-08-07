import { createClient } from "@/lib/supabase/server";
import { generarZip, nombreDeFoto, type ArchivoZip } from "@/lib/zip";

/**
 * GET /a/{slug}/zip — el álbum entero en un solo archivo.
 *
 * Va por el servidor y no por el navegador a propósito. Un álbum lleno
 * son 500 fotos, y armar el ZIP en el teléfono significa tener las 500
 * en memoria a la vez: en una compu pasa, en un celular de gama media
 * se cae la pestaña justo cuando el cliente quiere sus recuerdos.
 *
 * Acá se arma por streaming: se baja una foto, se escribe, se suelta.
 * La memoria del servidor nunca tiene más de dos fotos a la vez, pese a
 * un ZIP final de cien y pico de megas.
 *
 * Visibilidad: la misma que el álbum. Las fotos ya viven en un bucket
 * público y el álbum se comparte por un link que no está listado en
 * ningún lado — quien tiene el link ve las fotos, así que también puede
 * bajarlas. No agrega exposición.
 */

// Bajar 500 fotos y coserlas lleva minutos, no segundos.
export const maxDuration = 300;

type FotoFila = {
  id: string;
  path: string;
  autor: string | null;
  created_at: string;
};

/** Trae una foto del bucket. null si falla: una foto rota no tumba el ZIP. */
async function descargar(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Las fotos, de a una, con la SIGUIENTE ya viajando.
 *
 * Sin ese adelanto el servidor pasa la mayor parte del tiempo esperando
 * a Supabase con las manos quietas; con él, la descarga de la próxima
 * ocurre mientras se escribe la actual. Es una sola de adelanto para
 * que la memoria no crezca con el tamaño del álbum.
 */
async function* fotosComoArchivos(
  fotos: FotoFila[],
  base: string,
): AsyncGenerator<ArchivoZip> {
  if (fotos.length === 0) return;

  let enVuelo: Promise<Uint8Array | null> | null = descargar(base + fotos[0].path);

  for (let i = 0; i < fotos.length; i++) {
    const actual = enVuelo;
    enVuelo = i + 1 < fotos.length ? descargar(base + fotos[i + 1].path) : null;

    const datos = actual ? await actual : null;
    if (!datos) continue;

    const fecha = new Date(fotos[i].created_at);
    yield {
      nombre: nombreDeFoto(i, fotos[i].autor),
      datos,
      fecha: Number.isNaN(fecha.getTime()) ? undefined : fecha,
    };
  }
}

/**
 * GET = el álbum entero.
 *
 * POST = solo las elegidas, que llegan como campos `foto` de un
 * formulario. Va por POST y no por ?fotos=a,b,c porque una URL con
 * doscientos UUID pasa los ocho mil caracteres y el servidor la corta;
 * en el cuerpo de un POST no hay tope práctico. Y al ser un envío de
 * formulario normal, el navegador lo trata como descarga igual que el
 * link de "todas": misma barra de progreso, sin JavaScript de por medio.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return armarDescarga(slug, null);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let elegidas: string[];
  try {
    const form = await req.formData();
    elegidas = form.getAll("foto").map(String).filter(Boolean);
  } catch {
    return new Response("No se entendió la selección.", { status: 400 });
  }

  if (elegidas.length === 0) {
    return new Response("No elegiste ninguna foto.", { status: 400 });
  }

  return armarDescarga(slug, new Set(elegidas));
}

/** `elegidas` en null = el álbum entero. */
async function armarDescarga(slug: string, elegidas: Set<string> | null) {
  const supabase = await createClient();

  const { data: album } = await supabase
    .from("albumes")
    .select("id, titulo")
    .eq("slug", slug)
    .eq("estado", "activo")
    .maybeSingle();
  if (!album) {
    return new Response("Ese álbum no existe o ya no está disponible.", {
      status: 404,
    });
  }

  const { data } = await supabase
    .from("album_fotos")
    .select("id, path, autor, created_at")
    .eq("album_id", album.id as string)
    // De la más vieja a la más nueva: en un ZIP lo natural es el orden
    // en que pasaron las cosas, no el de la grilla (que muestra lo
    // último primero).
    .order("created_at", { ascending: true });

  // El filtro se hace acá y no en la consulta a propósito: así lo que
  // llega del navegador solo puede REDUCIR la lista de este álbum,
  // nunca traer fotos de otro. Un id inventado simplemente no aparece.
  const todas = (data ?? []) as FotoFila[];
  const fotos = elegidas ? todas.filter((f) => elegidas.has(f.id)) : todas;

  if (fotos.length === 0) {
    return new Response(
      elegidas
        ? "Las fotos que elegiste ya no están en el álbum."
        : "Este álbum todavía no tiene fotos.",
      { status: 404 },
    );
  }

  // .trim(): en Vercel el valor puede traer un \n pegado (ver
  // a/[slug]/page.tsx).
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()}/storage/v1/object/public/albumes/`;
  const iterador = generarZip(fotosComoArchivos(fotos, base));

  const cuerpo = new ReadableStream<Uint8Array>({
    async pull(controlador) {
      try {
        const { value, done } = await iterador.next();
        if (done) controlador.close();
        else controlador.enqueue(value);
      } catch (e) {
        // Si algo revienta a mitad, se corta el stream: el navegador
        // muestra la descarga como fallida en vez de guardar un ZIP
        // truncado que después no abre.
        console.error("[album] Se cortó el ZIP:", e);
        controlador.error(e);
      }
    },
    cancel() {
      // El usuario canceló la descarga: se deja de bajar fotos.
      void iterador.return(undefined);
    },
  });

  // El nombre lleva las dos formas: `filename` en ASCII para los
  // programas viejos y `filename*` en UTF-8 para que "Cumpleaños" no
  // llegue como "Cumplea_os".
  const limpio = String(album.titulo ?? "album")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "album";
  // Se distingue en el nombre: si el cliente baja una selección hoy y
  // el álbum entero mañana, los dos archivos conviven en Descargas sin
  // que uno pise al otro.
  const sufijo = elegidas ? `${fotos.length}-fotos` : "fotos";
  const utf8 = encodeURIComponent(
    `${album.titulo} - ${elegidas ? `${fotos.length} fotos` : "fotos"}.zip`,
  );

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${limpio}-${sufijo}.zip"; filename*=UTF-8''${utf8}`,
      // El ZIP se arma al vuelo y cambia con cada foto que suben.
      "Cache-Control": "no-store",
    },
  });
}
