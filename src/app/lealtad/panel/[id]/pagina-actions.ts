"use server";

import { revalidatePath } from "next/cache";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { comprobarImagenSubida } from "@/lib/media/comprobar-imagen-subida";
import { QR_DESTINOS, TOPE_MESAS, type QrDestino } from "@/lib/lealtad/pagina-negocio";

/**
 * LAS ACTIONS DE «MI PÁGINA» (0229).
 *
 * Mismo reparto que campanas-actions.ts: el portero es
 * `verificarAccesoLealtad` (solo dueño o admin — un colaborador de
 * mostrador no edita la página), la escritura va con la llave de
 * servicio (la RLS de lealtad_paginas no da INSERT/UPDATE a nadie
 * más), y las validaciones ESPEJAN los CHECK de la migración para que
 * el error llegue en español y no como un `check constraint` pelado.
 */

const MAX_BYTES_PORTADA = 4 * 1024 * 1024;

export type DatosPagina = {
  publicada: boolean;
  bajada: string;
  fotoPortadaUrl: string;
  promoTitulo: string;
  promoDetalle: string;
  promoActiva: boolean;
  qrDestino: QrDestino;
  mostrarMenu: boolean;
  mesas: number;
};

type Resultado = { ok: true } | { ok: false; motivo: string };

export async function guardarPaginaLealtad(
  ranchoId: string,
  datos: DatosPagina,
): Promise<Resultado> {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.ok || (!acceso.esDueno && !acceso.esAdmin)) {
    return { ok: false, motivo: "Solo el dueño puede editar la página." };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "Falta la llave de servicio en el entorno." };

  // ── Validaciones (espejo de los CHECK de la 0229) ─────────────────
  const bajada = datos.bajada.trim().slice(0, 140);
  const promoTitulo = datos.promoTitulo.trim().slice(0, 60);
  const promoDetalle = datos.promoDetalle.trim().slice(0, 140);
  const qrDestino: QrDestino = QR_DESTINOS.includes(datos.qrDestino) ? datos.qrDestino : "portada";
  const mesas = Number.isFinite(datos.mesas)
    ? Math.max(0, Math.min(TOPE_MESAS, Math.trunc(datos.mesas)))
    : 0;

  // La foto viene del navegador: toda URL subida se comprueba
  // estructuralmente (esUrlDeNuestroStorage — nunca startsWith) y por
  // contenido real (magic bytes), igual que el ícono del sello.
  let fotoPortadaUrl: string | null = null;
  const fotoCruda = datos.fotoPortadaUrl.trim();
  if (fotoCruda) {
    if (!esUrlDeNuestroStorage(fotoCruda, "ranchos-fotos")) {
      return { ok: false, motivo: "La foto de portada tiene que subirse desde el panel." };
    }
    const revision = await comprobarImagenSubida(fotoCruda, { maxBytes: MAX_BYTES_PORTADA });
    if (!revision.ok) return { ok: false, motivo: revision.motivo };
    fotoPortadaUrl = fotoCruda;
  }

  const { error } = await admin.from("lealtad_paginas").upsert(
    {
      rancho_id: ranchoId,
      publicada: datos.publicada === true,
      bajada,
      foto_portada_url: fotoPortadaUrl,
      promo_titulo: promoTitulo,
      promo_detalle: promoDetalle,
      promo_activa: datos.promoActiva === true && promoTitulo.length > 0,
      qr_destino: qrDestino,
      mostrar_menu: datos.mostrarMenu !== false,
      mesas,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "rancho_id" },
  );

  if (error) {
    if (/lealtad_paginas/.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0229 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo guardar la página: " + error.message };
  }

  // La página del panel Y la pública: apagarla la saca de la calle ya.
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  const { data: rancho } = await admin
    .from("ranchos")
    .select("slug")
    .eq("id", ranchoId)
    .maybeSingle();
  const slug = (rancho?.slug as string | null) ?? null;
  if (slug) {
    revalidatePath(`/r/${slug}`);
    revalidatePath(`/r/${slug}/menu`);
  }
  return { ok: true };
}
