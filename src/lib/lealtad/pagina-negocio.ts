import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * LA PÁGINA PÚBLICA DEL NEGOCIO (0229) — «Mi página».
 *
 * El QR de la mesa abre /r/<slug>: portada con la marca del negocio y
 * sus puertas (menú, tarjeta de lealtad, info). Esta capa es el único
 * lector/escritor de `lealtad_paginas`; la parte visual vive en
 * src/app/r/ y la de edición en el panel.
 *
 * ------------------------------------------------------------------
 * DOS PUERTAS DE ALTA, UN SOLO CREADOR
 * ------------------------------------------------------------------
 * Un negocio de Lealtad nace por el creador de cards
 * (crear-negocio-completo.ts) O por una solicitud paga aprobada
 * (alta-desde-solicitud.ts). Las dos llaman a `crearPaginaDelNegocio`
 * para que la página nazca sola con el negocio — si se creara solo en
 * una puerta, la otra pariría negocios sin página y nadie sabría por
 * qué (es la misma razón por la que ambas comparten el armado del
 * programa).
 *
 * ------------------------------------------------------------------
 * DEGRADA EN SILENCIO (patrón productos-db.ts)
 * ------------------------------------------------------------------
 * Mientras la 0229 no esté aplicada, leer devuelve null y crear no
 * tumba el alta: el resto del módulo sigue como si la página no
 * existiera.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export const QR_DESTINOS = ["portada", "menu"] as const;
export type QrDestino = (typeof QR_DESTINOS)[number];

/** Tope duro de la prevista de mesas — espeja el CHECK de la 0229. */
export const TOPE_MESAS = 60;

export type PaginaLealtad = {
  rancho_id: string;
  publicada: boolean;
  bajada: string;
  foto_portada_url: string | null;
  promo_titulo: string;
  promo_detalle: string;
  promo_activa: boolean;
  qr_destino: QrDestino;
  mostrar_menu: boolean;
  mesas: number;
};

/** ¿El error es «la tabla lealtad_paginas no existe todavía»? */
function tablaAusente(mensaje: string | undefined): boolean {
  return !!mensaje && /lealtad_paginas/.test(mensaje);
}

function filaAPagina(fila: Record<string, unknown>): PaginaLealtad {
  const destino = fila.qr_destino;
  return {
    rancho_id: String(fila.rancho_id ?? ""),
    publicada: fila.publicada !== false,
    bajada: typeof fila.bajada === "string" ? fila.bajada : "",
    foto_portada_url:
      typeof fila.foto_portada_url === "string" && fila.foto_portada_url.trim()
        ? fila.foto_portada_url
        : null,
    promo_titulo: typeof fila.promo_titulo === "string" ? fila.promo_titulo : "",
    promo_detalle: typeof fila.promo_detalle === "string" ? fila.promo_detalle : "",
    promo_activa: fila.promo_activa === true,
    qr_destino: destino === "menu" ? "menu" : "portada",
    mostrar_menu: fila.mostrar_menu !== false,
    mesas:
      typeof fila.mesas === "number" && Number.isFinite(fila.mesas)
        ? Math.max(0, Math.min(TOPE_MESAS, Math.trunc(fila.mesas)))
        : 0,
  };
}

/**
 * La página del negocio, o null si no tiene (o la 0229 no corrió).
 * NO filtra por `publicada`: el panel necesita ver también la apagada.
 * Quien sirva al público debe chequear `.publicada` él mismo.
 */
export async function paginaDelNegocio(
  admin: Admin,
  ranchoId: string,
): Promise<PaginaLealtad | null> {
  const { data, error } = await admin
    .from("lealtad_paginas")
    .select("*")
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (error) {
    if (!tablaAusente(error.message)) {
      console.error("[mi-pagina] No se pudo leer la página:", error.message);
    }
    return null;
  }
  return data ? filaAPagina(data as Record<string, unknown>) : null;
}

/**
 * Crea la página del negocio con los valores por defecto (publicada,
 * con menú, QR a la portada). Idempotente y NO-FATAL: si ya existe no
 * pisa nada, y si falla el alta del negocio sigue — una página ausente
 * se crea después con el primer «Guardar» del panel.
 */
export async function crearPaginaDelNegocio(admin: Admin, ranchoId: string): Promise<void> {
  const { error } = await admin
    .from("lealtad_paginas")
    .upsert({ rancho_id: ranchoId }, { onConflict: "rancho_id", ignoreDuplicates: true });
  if (error && !tablaAusente(error.message)) {
    console.error("[mi-pagina] No se pudo crear la página del negocio:", error.message);
  }
}

/** La URL pública de la página, con el mismo respaldo de env que el póster. */
export function urlDePagina(slug: string): string {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat";
  return `${sitio}/r/${slug}`;
}
