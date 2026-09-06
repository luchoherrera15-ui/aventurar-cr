import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { filasCrudasPorAntiguedad, laDelLinkDeFilasCrudas, resumenDeFila } from "@/lib/wallet/programa-principal";
import { buscarPorLlave } from "@/lib/lealtad/llave-tarjeta";
import { estadoVisible, operaAhora } from "@/lib/lealtad/programas";
import { datosVistaDeFila } from "@/lib/lealtad/datos-vista-pase";
import { tipoDe, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { minutoISOCR } from "@/lib/fechas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PREVIA DE UNA TARJETA — lo que se ve al COMPARTIR el link
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): «cada vez que uno envía el link de
 * bookea.lat, cuando alguien va a enviar el código QR o así, salen
 * cosas que nada que ver. Si alguien tiene un lavacar inscrito en
 * Lealtad, que salga el link con los datos del lavacar: más
 * profesional, personalizado hacia cada negocio que reenvía el link».
 *
 * ── QUÉ PASABA ─────────────────────────────────────────────────────
 * `/tarjeta/<negocio>` no declaraba metadatos, así que WhatsApp,
 * Instagram y Telegram mostraban los del sitio entero: «¿Necesitás un
 * servicio? Mirá todos los locales en Bookea» con la imagen genérica.
 * El link del lavacar parecía publicidad de Bookea.
 *
 * ── QUÉ HACE ESTO ──────────────────────────────────────────────────
 * Resuelve el negocio y la tarjeta que pide el link con LAS MISMAS
 * reglas que la pantalla (`vista-tarjeta.tsx`): el slug del rancho, la
 * tarjeta del link viejo (`laDelLinkDeFilasCrudas`) o la de la llave
 * (`buscarPorLlave`), y la apariencia con los mismos ojos que el pase
 * (`datosVistaDeFila`). Con eso `metadata-tarjeta.ts` escribe el
 * título y la descripción, y `opengraph-image.tsx` dibuja la imagen.
 *
 * Solo lectura, con la llave de servicio y `cache()` por petición:
 * `generateMetadata` y la página comparten la lectura.
 */

export type PreviaTarjeta = {
  negocio: { nombre: string; slug: string };
  /** null = el link no apunta a ninguna tarjeta de este negocio. */
  tarjeta: {
    nombre: string;
    tipo: TipoTarjeta;
    unidad: string;
    colorFondo: string;
    colorSello: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    /** ¿Reparte pases hoy? Si no, la previa igual muestra el negocio. */
    opera: boolean;
    estado: string;
  } | null;
  /** La regalía activa más barata, la misma que promete el pase. */
  premio: { nombre: string; meta: number } | null;
};

export const previaDeTarjeta = cache(
  async (slug: string, llave: string | null): Promise<PreviaTarjeta | null> => {
    const admin = createAdminClient();
    if (!admin || !slug) return null;

    const { data: negocio } = await admin.from("ranchos").select("id, nombre, slug").eq("slug", slug).maybeSingle();
    if (!negocio) return null;
    const nombre = ((negocio.nombre as string) ?? "").trim();
    const base = { negocio: { nombre, slug: negocio.slug as string } };

    const { data: filasCrudas } = await admin.from("programa_lealtad").select("*").eq("rancho_id", negocio.id);
    const filas = filasCrudasPorAntiguedad((filasCrudas ?? []) as Record<string, unknown>[]);
    const pedida = llave === null ? laDelLinkDeFilasCrudas(filas) : buscarPorLlave(filas, llave);
    if (!pedida) return { ...base, tarjeta: null, premio: null };

    const ahoraCR = minutoISOCR();
    const resumen = resumenDeFila(pedida);
    const vista = datosVistaDeFila(nombre, pedida);
    const tipo = tipoDe(vista.modo);

    const { data: recompensa } = await admin
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", pedida.id as string)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      ...base,
      tarjeta: {
        nombre: typeof pedida.nombre === "string" ? pedida.nombre.trim() : "",
        tipo,
        unidad: UNIDAD_SALDO[tipo],
        // Sin color guardado, los de Lealtad por defecto (navy y azul claro).
        colorFondo: vista.colorFondo ?? "#062653",
        colorSello: vista.colorSello ?? "#9db4ff",
        logoUrl: vista.logoUrl ?? null,
        bannerUrl: vista.bannerUrl ?? null,
        opera: operaAhora(resumen, ahoraCR),
        estado: estadoVisible(resumen, ahoraCR),
      },
      premio: recompensa
        ? { nombre: (recompensa.nombre as string).trim(), meta: Number(recompensa.costo_puntos) || 0 }
        : null,
    };
  },
);

/**
 * La frase que acompaña al link: lo que el cliente gana. Es la misma
 * promesa del pase («Juntá 10 sellos y llevate un café»), no un
 * eslogan de Bookea.
 */
export function fraseDePrevia(p: PreviaTarjeta): string {
  const n = p.negocio.nombre;
  if (!p.tarjeta) return `La tarjeta de lealtad de ${n}. Agregala a tu teléfono y sumá con cada visita.`;
  const { tipo, unidad, nombre } = p.tarjeta;
  if (p.premio && (tipo === "sellos" || tipo === "puntos")) {
    return `Juntá ${p.premio.meta} ${unidad} en ${n} y llevate ${p.premio.nombre}. Agregá tu tarjeta al teléfono gratis: sin app y en un toque.`;
  }
  if (p.premio) {
    return `${nombre || "Tu tarjeta"} de ${n}: ${p.premio.nombre}. Agregala a tu teléfono gratis, sin app.`;
  }
  return `${nombre || "La tarjeta de lealtad"} de ${n}, en tu teléfono. Sumá con cada visita.`;
}
