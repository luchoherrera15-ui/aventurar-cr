"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";
import { esSelloElegido, type SelloElegido } from "@/lib/lealtad/iconos-sello";
import { esTipoTarjeta, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { armarContextoDeDiseno } from "@/lib/lealtad/ayuda-diseno";
import { hiloAbiertoDeAyuda, hilosDeAyuda, type HiloAyuda } from "@/lib/lealtad/ayuda-hilo";

/**
 * «NO ME GUSTA CÓMO ME ESTÁ QUEDANDO» — el lado del negocio.
 *
 * Abre (o continúa) el hilo con el equipo de Bookea sobre el diseño de
 * una tarjeta. La tabla es `ayuda_diseno` (0149); por qué no es el chat
 * ni `solicitudes_lealtad` está explicado arriba de esa migración.
 *
 * ------------------------------------------------------------------
 * QUÉ VIENE DE LA PANTALLA Y QUÉ LO PONE EL SERVIDOR
 * ------------------------------------------------------------------
 * De la PANTALLA viene lo VISUAL —tipo, colores, icono, si hay logo o
 * banda— y tiene que venir de ahí: en el creador todavía no existe
 * ninguna fila, y en el editor el dueño puede estar mirando cambios sin
 * guardar. Se pide ayuda por lo que se está viendo.
 *
 * Del SERVIDOR salen el nombre del negocio y el de la tarjeta, buscados
 * por id. Son los dos datos con los que el admin sabe A QUIÉN le
 * contesta, y un dato así no se le pregunta al navegador.
 *
 * La escritura va con la SESIÓN del usuario, no con la llave de
 * servicio: la política «Pedir ayuda y responderla» exige firmar con el
 * propio id y gestionar ese negocio, y el índice único parcial rebota
 * el doble clic. Nada de eso se cumpliría solo si insertáramos por
 * arriba de la RLS.
 */

export type PedidoAyuda = {
  ranchoId: string;
  /** La tarjeta, si ya existe. null = viene del creador. */
  programaId: string | null;
  /** Lo que el dueño escribió. */
  texto: string;
  /** Lo que tiene EN PANTALLA: */
  tipo: TipoTarjeta;
  colorFondo: string;
  colorSello: string;
  iconoSello: SelloElegido | null;
  tieneLogo: boolean;
  tieneBanda: boolean;
};

type Resultado =
  | { ok: true; hilo: HiloAyuda | null }
  | { ok: false; motivo: string };

const HEX = /^#[0-9A-Fa-f]{6}$/;
const TOPE_TEXTO = 2000;

/** El texto que el dueño escribió, listo para la columna. */
function textoValido(bruto: string): string | null {
  const texto = bruto.trim().slice(0, TOPE_TEXTO);
  return texto.length >= 5 ? texto : null;
}

/**
 * El error de la base, en algo que el dueño de una barbería pueda
 * hacer. Los tres casos que de verdad pasan: la migración sin pegar, el
 * hilo ya abierto y el resto.
 */
function traducir(error: { code?: string; message: string }, accion: string): string {
  if (error.code === "23505") {
    return "Ya tenés un pedido abierto — seguí la conversación ahí abajo y te contestamos por ese mismo hilo.";
  }
  if (
    /ayuda_diseno/.test(error.message) &&
    /does not exist|schema cache|Could not find/i.test(error.message)
  ) {
    return "Falta correr la migración 0149 en Supabase.";
  }
  return `No se pudo ${accion}: ${error.message}`;
}

export async function pedirAyudaDeDiseno(datos: PedidoAyuda): Promise<Resultado> {
  // Pedirle ayuda al equipo sobre el diseño es del DUEÑO, igual que
  // crear y editar la tarjeta: el colaborador de mostrador opera.
  const { user, ok, supabase } = await verificarAccesoRancho(datos.ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "Esto lo pide el dueño del negocio." };

  const texto = textoValido(datos.texto);
  if (!texto) {
    return { ok: false, motivo: "Contanos qué querés cambiar (unas palabras alcanzan)." };
  }

  // Lo visual se normaliza antes de escribirlo. No es una autorización
  // —el contexto es texto para que lo lea una persona— pero un valor
  // inventado dejaría al admin leyendo un dato falso sobre el negocio
  // al que le está por contestar.
  if (!esTipoTarjeta(datos.tipo)) return { ok: false, motivo: "Ese tipo de tarjeta no existe." };
  if (!HEX.test(datos.colorFondo) || !HEX.test(datos.colorSello)) {
    return { ok: false, motivo: "Los colores tienen que ser #RRGGBB." };
  }
  const icono = esSelloElegido(datos.iconoSello) ? datos.iconoSello : null;

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: rancho } = await db
    .from("ranchos")
    .select("nombre")
    .eq("id", datos.ranchoId)
    .maybeSingle();
  const negocioNombre = ((rancho?.nombre as string | null) ?? "").trim() || "(sin nombre)";

  // La tarjeta, SI es de este negocio. Un id de otro rancho no nombra
  // nada: el contexto diría «ya publicada» sobre una tarjeta ajena.
  const { data: programa } = datos.programaId
    ? await db
        .from("programa_lealtad")
        .select("id, nombre")
        .eq("id", datos.programaId)
        .eq("rancho_id", datos.ranchoId)
        .maybeSingle()
    : { data: null };
  const programaId = (programa?.id as string | undefined) ?? null;
  // Si la tarjeta EXISTE, el resumen tiene que decirlo aunque se haya
  // quedado sin nombre: `armarContextoDeDiseno` lee un texto vacío como
  // «todavía no existe», y eso mandaría al equipo a buscar una tarjeta
  // que sí está publicada.
  const tarjetaNombre = programaId
    ? ((programa?.nombre as string | null) ?? "").trim() || "(sin nombre)"
    : null;

  const contexto = armarContextoDeDiseno({
    negocioNombre,
    tarjetaNombre,
    tipo: datos.tipo,
    colorFondo: datos.colorFondo,
    colorSello: datos.colorSello,
    iconoSello: icono,
    tieneLogo: datos.tieneLogo === true,
    tieneBanda: datos.tieneBanda === true,
  });

  const { error } = await supabase.from("ayuda_diseno").insert({
    hilo_id: null,
    rancho_id: datos.ranchoId,
    programa_id: programaId,
    autor_id: user.id,
    texto,
    contexto,
    estado: "abierta",
  });

  if (error) return { ok: false, motivo: traducir(error, "enviar el pedido") };

  const correo = user.email ?? "(sin correo)";
  after(() =>
    avisarAAdministradores({
      subject: `AYUDA CON EL DISEÑO DE LA TARJETA — ${negocioNombre}`,
      html: `
        <h2 style="margin:0 0 12px">Piden ayuda con el diseño</h2>
        <p style="margin:0 0 12px;font-size:14px">
          <b>${escaparHtml(negocioNombre)}</b> no está conforme con cómo le queda su tarjeta
          y pide una mano. Escribió:
        </p>
        <blockquote style="margin:0 0 16px;border-left:3px solid #ddd;padding-left:12px;font-size:14px">
          ${escaparHtml(texto).replaceAll("\n", "<br>")}
        </blockquote>
        <p style="margin:0 0 12px;font-size:13px">Lo pide ${escaparHtml(correo)}.</p>
        <p style="margin:0 0 6px;font-size:13px"><b>Lo que tenía en pantalla:</b></p>
        <pre style="margin:0 0 16px;white-space:pre-wrap;font-family:inherit;font-size:13px;color:#444">${escaparHtml(contexto)}</pre>
        <p style="margin:0;font-size:14px">
          Se contesta desde
          <a href="${SITIO}/admin/complementos">el panel de complementos</a> — el hilo queda
          ahí aunque este correo se pierda.
        </p>
      `,
    }),
  );

  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return { ok: true, hilo: await hiloAbiertoDeAyuda(db, datos.ranchoId) };
}

/** Seguir la conversación: el dueño le contesta al equipo. */
export async function responderAyudaDeDiseno(
  ranchoId: string,
  hiloId: string,
  bruto: string,
): Promise<Resultado> {
  const { user, ok, supabase } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "Esto lo responde el dueño del negocio." };

  const texto = textoValido(bruto);
  if (!texto) return { ok: false, motivo: "Escribí tu respuesta (unas palabras alcanzan)." };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // Que el hilo sea de ESTE negocio lo comprueba también la política de
  // la base (`ayuda_diseno_rancho(hilo_id) = rancho_id`). Acá se mira
  // antes solo para poder explicar qué pasó.
  const hilos = await hilosDeAyuda(db, ranchoId);
  const hilo = hilos.find((h) => h.id === hiloId);
  if (!hilo) return { ok: false, motivo: "Ese pedido no es de este negocio." };
  if (hilo.estado === "cerrada") {
    return { ok: false, motivo: "Este pedido ya se cerró. Abrí uno nuevo desde el botón." };
  }

  const { error } = await supabase.from("ayuda_diseno").insert({
    hilo_id: hiloId,
    rancho_id: ranchoId,
    autor_id: user.id,
    texto,
  });
  if (error) return { ok: false, motivo: traducir(error, "enviar la respuesta") };

  const { data: rancho } = await db
    .from("ranchos")
    .select("nombre")
    .eq("id", ranchoId)
    .maybeSingle();
  const negocioNombre = ((rancho?.nombre as string | null) ?? "").trim() || "(sin nombre)";

  after(() =>
    avisarAAdministradores({
      subject: `RESPONDIÓ sobre el diseño — ${negocioNombre}`,
      html: `
        <p style="margin:0 0 12px;font-size:14px">
          <b>${escaparHtml(negocioNombre)}</b> contestó en su hilo de ayuda con el diseño:
        </p>
        <blockquote style="margin:0 0 16px;border-left:3px solid #ddd;padding-left:12px;font-size:14px">
          ${escaparHtml(texto).replaceAll("\n", "<br>")}
        </blockquote>
        <p style="margin:0;font-size:14px">
          Se sigue desde <a href="${SITIO}/admin/complementos">el panel de complementos</a>.
        </p>
      `,
    }),
  );

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true, hilo: (await hilosDeAyuda(db, ranchoId)).find((h) => h.id === hiloId) ?? null };
}
