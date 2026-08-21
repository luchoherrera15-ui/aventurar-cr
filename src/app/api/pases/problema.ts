import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { llaveDeTarjeta, tarjetaConLlaveDeFila } from "@/lib/lealtad/llave-tarjeta";
import type { CodigoFalloPase } from "@/lib/wallet/identidad";

/**
 * CUANDO EL PASE NO SE PUEDE ENTREGAR, EL CLIENTE VE UNA PANTALLA.
 *
 * ------------------------------------------------------------------
 * QUÉ PASABA ANTES
 * ------------------------------------------------------------------
 * Los dos botones del pase son `<a href="/api/pases/…">` y
 * `<a href="/api/pases-google/…">`: el navegador NAVEGA a la ruta. Y la
 * ruta contestaba `NextResponse.json({error}, {status:409})`. O sea que
 * al cliente parado en la barbería, con el teléfono en la mano, se le
 * pintaba una pantalla blanca con
 *
 *     {"error":"El programa de este negocio está lleno por ahora — preguntá en el local."}
 *
 * Le pasaba al cliente 201 de un paquete lleno, al que llega con la
 * tarjeta en pausa, y a todos si el certificado de Apple vencía o el
 * servidor se quedaba sin credenciales. Un error de producto contado
 * como una respuesta de máquina.
 *
 * ------------------------------------------------------------------
 * CÓMO SE ARREGLA
 * ------------------------------------------------------------------
 * Se lo devuelve a la página de SU tarjeta con el motivo en la URL
 * (`/tarjeta/{slug}?problema={codigo}`), que es la pantalla que ya
 * conoce —el negocio, sus colores, su regalía— con el aviso arriba y
 * qué hacer. El código es un valor cerrado de `CodigoFalloPase`: nunca
 * viaja texto libre por la URL, así que nadie puede hacer que la página
 * diga lo que él quiera.
 *
 * Solo si el negocio no tiene slug (o no hay ni conexión de servicio
 * para buscarlo) queda el respaldo: una página mínima, servida acá
 * mismo, que igual se lee como algo escrito para una persona.
 *
 * Vive en `pases/` y lo importa también `pases-google/`: es la MISMA
 * salida para las dos plataformas, y duplicarla era garantizar que un
 * día dijeran cosas distintas.
 */

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function pantallaDeProblema(
  pedido: Request,
  ranchoId: string,
  codigo: CodigoFalloPase,
  /**
   * La tarjeta que se estaba pidiendo, si el botón la nombró.
   *
   * Sin esto, el rebote de la SEGUNDA tarjeta devolvía a la persona al
   * link viejo del negocio —que sirve la PRIMERA— y el formulario que
   * encontraba ahí la afiliaba a otra cosa. El destino es el link de la
   * tarjeta de la que salió.
   */
  programaId?: string | null,
): Promise<NextResponse> {
  const slug = await slugDelNegocio(ranchoId);

  if (slug) {
    const llave = await llaveDelPrograma(ranchoId, programaId);
    const ruta = `/tarjeta/${encodeURIComponent(slug)}${llave ? `/${encodeURIComponent(llave)}` : ""}`;
    const destino = new URL(ruta, pedido.url);
    destino.searchParams.set("problema", codigo);
    // 303: lo que sigue es una página para mirar, no otra descarga.
    return NextResponse.redirect(destino, 303);
  }

  return new NextResponse(HTML_DE_RESPALDO, {
    status: 409,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * La llave pública de una tarjeta (`llave-tarjeta.ts`), o null.
 *
 * ── EL `eq("rancho_id")` NO ES DECORATIVO ──────────────────────────
 * `programaId` llega del `?programa=` de la URL, o sea del navegador.
 * Sin filtrar por el negocio, pedir el pase del negocio A nombrando
 * una tarjeta del negocio B —que el generador rechaza, y con razón—
 * igual hacía que el rebote leyera la fila de B y devolviera el NOMBRE
 * de esa tarjeta metido en la URL de A. Es poco, pero es un dato de un
 * tercero servido a pedido de cualquiera. Si no es de este negocio, no
 * hay llave y el rebote va al link corto, que es lo correcto.
 *
 * `select *` y no `id, nombre, slug`: la columna `slug` la agrega la
 * 0199 y nombrarla antes haría fallar la consulta entera — o sea que
 * un rebote del pase terminaría en una pantalla de error en vez de en
 * la página de la tarjeta.
 */
async function llaveDelPrograma(
  ranchoId: string,
  programaId?: string | null,
): Promise<string | null> {
  if (!programaId || !UUID_REGEX.test(programaId)) return null;
  if (!UUID_REGEX.test(ranchoId)) return null;
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!data) return null;
  return llaveDeTarjeta(tarjetaConLlaveDeFila(data as Record<string, unknown>));
}

async function slugDelNegocio(ranchoId: string): Promise<string | null> {
  if (!UUID_REGEX.test(ranchoId)) return null;
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db.from("ranchos").select("slug").eq("id", ranchoId).maybeSingle();
  const slug = data?.slug;
  return typeof slug === "string" && slug !== "" ? slug : null;
}

/**
 * El respaldo. Sin dependencias ni componentes: si se llega hasta acá
 * es porque algo bastante básico no está (la llave de servicio, el
 * negocio, su dirección), y esta página tiene que salir igual.
 */
/*
 * El enlace va en #9db4ff: el azul claro de acción sobre fondo oscuro
 * (el valor de `--accion-claro` del scope .lealtad). Escrito como
 * literal y no como var() a propósito — esto es un HTML suelto que se
 * sirve sin la hoja de estilos del sitio, así que acá no existe ningún
 * token. Antes era el naranja retirado #ee7420.
 *
 * Y la explicación vive ACÁ AFUERA, no dentro del texto de abajo: ese
 * texto es un template literal, un comentario con acentos graves lo
 * cierra antes de tiempo y rompe el archivo entero (ya pasó). De paso,
 * un comentario adentro viajaría al navegador de cada cliente que vea
 * esta pantalla de error.
 */
const HTML_DE_RESPALDO = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>No pudimos darte la tarjeta</title>
<style>
  body { margin:0; min-height:100svh; display:flex; align-items:center; justify-content:center;
         background:#0a1226; color:#fff; padding:24px;
         font-family:system-ui,-apple-system,"Segoe UI",sans-serif; }
  .caja { max-width:24rem; text-align:center; }
  h1 { font-size:1.25rem; margin:0 0 .75rem; }
  p { font-size:.9rem; line-height:1.6; color:rgba(255,255,255,.7); margin:0 0 1rem; }
  a { color:#9db4ff; font-weight:700; }
</style>
</head>
<body>
  <div class="caja">
    <h1>No pudimos darte la tarjeta</h1>
    <p>Algo falló de nuestro lado. Volvé a escanear el QR del local en un
       momento — tus sellos, si ya tenías, siguen guardados.</p>
    <p>Si sigue igual, preguntá en el mostrador.</p>
    <p><a href="/">Ir a Bookea</a></p>
  </div>
</body>
</html>`;
