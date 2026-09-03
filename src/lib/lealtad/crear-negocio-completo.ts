import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIPOS_TARJETA } from "@/lib/lealtad/tipos-tarjeta";
import { acumulacionDe, recompensaInicial } from "@/lib/lealtad/mostrador";
import { sembrarRecompensa } from "@/lib/lealtad/sembrar-recompensa";
import type { TarjetaAltaValidada } from "@/lib/lealtad/tarjeta-alta";
import { finDePrueba } from "@/lib/lealtad/prueba";
import { generarSlugUnico } from "@/lib/slug";
import { apagarModulosOperativos } from "@/lib/lealtad/solo-lealtad";
import { crearPaginaDelNegocio } from "@/lib/lealtad/pagina-negocio";
import { avisarAAdministradores } from "@/lib/correo/administradores";
// El escapador de la casa. Este archivo llegó con una copia propia de
// siete líneas; dos escapadores de HTML es uno de más — el día que a
// uno se le agregue una comilla, el otro se queda corto.
import { escaparHtml as escapar } from "@/lib/email";

/**
 * ════════════════════════════════════════════════════════════════════
 *  CREAR UN NEGOCIO DE LEALTAD ENTERO, DE UNA
 * ════════════════════════════════════════════════════════════════════
 *
 * Rancho + programa + tarjeta + recompensa + complemento + el registro
 * en `solicitudes_lealtad`. Todo lo que hace falta para que alguien
 * entre a su panel y ya tenga un pase que funciona.
 *
 * ------------------------------------------------------------------
 * POR QUÉ VIVE ACÁ Y NO EN `nuevo/actions.ts`
 * ------------------------------------------------------------------
 * Nació ahí adentro, como una función privada del alta pública (el
 * plan gratis, que se crea al instante en vez de pedirse). Desde el
 * 1 sep 2026 hay un SEGUNDO camino: un administrador de Bookea le
 * arma el pase a un cliente desde `/admin/lealtad/nuevo` y le pone el
 * correo de quien lo va a administrar.
 *
 * Es el mismo problema que ya resolvió `alta-desde-solicitud.ts`: dos
 * puertas al mismo negocio tienen que producir EXACTAMENTE el mismo
 * negocio. Copiada, el día que se agregue un paso —una tabla nueva, un
 * default distinto— una de las dos se queda atrás, y la que se queda
 * atrás es siempre la que nadie mira todos los días.
 *
 * ------------------------------------------------------------------
 * ⚠️ ACÁ ADENTRO NO HAY NINGUNA AUTORIZACIÓN
 * ------------------------------------------------------------------
 * Quien llama ya decidió: el alta pública con su `puedeCrearNegocio`
 * y su tope por cuenta, el admin con su `requireAdmin`. Esta función
 * escribe con la llave de servicio y crea un rancho a nombre de otra
 * persona — llamarla sin haber decidido antes es regalar un negocio.
 */

export type ResultadoCreacion =
  | { ok: true; creado: { ranchoId: string; slug: string | null } }
  | { ok: false; motivo: string };
/**
 * @param d.userId Dueño del negocio. En el alta pública es quien pide;
 *                 desde el admin, la cuenta cuyo correo se escribió.
 * @param d.origen De dónde vino. Solo cambia el texto del aviso al
 *                 equipo y la nota del complemento — un negocio creado
 *                 por un admin y otro por el creador tienen que ser
 *                 indistinguibles para el resto del sistema.
 */
export async function crearNegocioDeLealtadCompleto(d: {
  userId: string;
  /**
   * EL PLAN QUE LA PERSONA ELIGIÓ, no uno escrito a mano acá.
   *
   * Acá había escrito a mano el id de un paquete RETIRADO que costaba
   * $0, y eso vaciaba el tope sin que se notara: los retirados van sin
   * topes a propósito —a quien ya lo tenía no se le quita lo que
   * tenía—. Así que `definicionDe(plan).limites.programas` daba `null`,
   * el tope de `crear-actions.ts` ni se ejecutaba, y una cuenta gratis
   * podía crear pases ilimitados.
   *
   * El plan vigente sin costo es `prueba`, con tope de 1 programa. Al
   * pasar el que eligió la persona, el tope vuelve a ser el que dice el
   * catálogo — y el día que cambie el catálogo, no hay que acordarse de
   * venir a tocar esta función.
   */
  plan: string;
  nombre: string;
  tipo: string;
  detalle: string;
  paseColor: string;
  paseLogoUrl: string | null;
  regalia: string;
  metaSellos: number;
  telefono: string | null;
  correo: string;
  codigoReferido: string | null;
  agenteId: string | null;
  /**
   * QUIÉN LO CREÓ.
   *
   * "creador"  — la persona misma, desde /lealtad/nuevo con el plan
   *              sin costo. Es el camino de siempre.
   * "admin"    — un administrador de Bookea se lo armó a un cliente
   *              y le puso el correo de quien lo administra.
   *
   * Cambia DOS textos y nada más: el asunto del aviso al equipo y la
   * nota del complemento. El negocio que queda es idéntico — si algún
   * día el origen cambiara permisos o topes, tendría que ser una
   * columna en la base y no un parámetro de una función.
   */
  origen: "creador" | "admin";
  /** El admin que lo creó, para `lealtad_aprobado_por`. */
  aprobadoPor?: string | null;
  /**
   * La tarjeta del wizard nuevo, YA VALIDADA por `validarTarjetaDeAlta`
   * (tipo contra el paquete incluido). null = payload viejo: todo sigue
   * saliendo de paseColor/regalia/metaSellos, idéntico a siempre.
   */
  tarjeta: TarjetaAltaValidada | null;
}): Promise<ResultadoCreacion> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "No hay conexión de servicio." };

  const vertical = ["citas", "eventos", "hospedajes", "restaurantes"].includes(d.tipo)
    ? d.tipo
    : "citas";
  const slug = await generarSlugUnico(admin, d.nombre);

  const { data: rancho, error: eRancho } = await admin
    .from("ranchos")
    .insert({
      owner_id: d.userId,
      nombre: d.nombre,
      slug,
      vertical,
      categoria: "otros",
      estado: "pendiente",
      // Nace FUERA del directorio público (0187). Un cliente de Lealtad
      // no se ofreció como proveedor del marketplace: sin esta línea
      // aparece en la cola de aprobación del admin, y un clic en
      // «Aprobar» lo publica en un directorio donde no tiene ficha.
      en_marketplace: false,
      lealtad_aprobado_en: new Date().toISOString(),
      // Quién aprobó: el admin que lo armó, o null cuando lo creó la
      // propia persona (o sea, el sistema).
      lealtad_aprobado_por: d.aprobadoPor ?? null,
      // Una sola de las dos columnas del paquete, por la misma razón
      // que en `crearNegocioDesdeSolicitud`: el paquete manda desde
      // `cuentas.plan` (ver src/lib/lealtad/aplicar-plan.ts), pero un
      // rancho que la base acaba de crear no puede tener cuenta —
      // `cuentas.rancho_id` es una FK a un id que hasta este INSERT no
      // existía—. No hay con qué cruzarse.
      plan_lealtad: d.plan,
    })
    .select("id, slug")
    .single();
  if (eRancho) {
    if (eRancho.message.includes("plan_lealtad")) {
      // El CHECK de `ranchos.plan_lealtad` acepta los ids del catálogo
      // NUEVO recién con la 0133. Sin ella pegada, un alta con `prueba`
      // rebota acá — y el mensaje tiene que decir cuál falta, no la
      // 0131, que era la del catálogo viejo.
      return { ok: false, motivo: "Falta correr la migración 0133 en Supabase." };
    }
    if (eRancho.message.includes("lealtad_aprobado")) {
      return { ok: false, motivo: "Falta correr la migración 0129 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo crear el negocio: " + eRancho.message };
  }
  const ranchoId = rancho.id as string;

  // Nace SOLO para lealtad: sin agenda, catálogo, equipo ni finanzas.
  await apagarModulosOperativos(admin, ranchoId);

  // El programa base, con un INSERT directo — igual que siempre. (Una
  // versión intermedia de este archivo lo hacía con un RPC de un
  // esfuerzo que quedó descartado; ese RPC nunca existió en la base de
  // producción, así que acá vive el insert de toda la vida.)
  const { data: prog, error: eProg } = await admin
    .from("programa_lealtad")
    .insert({
      rancho_id: ranchoId,
      nombre: "Programa de lealtad",
      modo: "sellos",
      puntos_por_visita: 1,
      puntos_por_colon: 0,
      activo: true,
      estado: "activo",
      // `|| null`: con el wizard nuevo los campos legacy pueden venir
      // vacíos (la apariencia real viaja en `tarjeta` y se aplica en el
      // UPDATE de abajo) — un "" en la columna de color pintaría mal.
      pase_color_fondo: d.paseColor || null,
      pase_logo_url: d.paseLogoUrl || null,
    })
    .select("id")
    .single();
  if (eProg || !prog) {
    return { ok: false, motivo: "El negocio se creó pero el programa no: " + (eProg?.message ?? "") };
  }
  const programaId = prog.id as string;

  // La tarjeta del wizard nuevo, con las DOS piezas presentes. El tipo
  // se estrecha acá para que abajo no haga falta un `!` en cada uso.
  const t =
    d.tarjeta && d.tarjeta.modo && d.tarjeta.beneficio
      ? { ...d.tarjeta, modo: d.tarjeta.modo, beneficio: d.tarjeta.beneficio }
      : null;

  if (t) {
    // ── LO QUE LA PERSONA ARMÓ, SOBRE EL PROGRAMA BASE ──────────────
    // Este UPDATE con la llave de servicio escribe el tipo, el
    // beneficio (0135), la apariencia (0122/0132/0145) y las columnas
    // de acumulación — las mismas dos que el motor `acreditar_lealtad`
    // SÍ mira: sin `acumulacionDe`, un cashback del wizard acreditaría
    // 1 punto por visita y 0% de la compra (el bug exacto que ya se
    // arregló en `crearTarjeta`).
    const acumula = acumulacionDe(t.beneficio);
    const cambios: Record<string, unknown> = {
      modo: t.modo,
      beneficio: t.beneficio,
      puntos_por_visita: acumula.porVisita,
      puntos_por_colon: acumula.porColon,
      compra_minima: acumula.compraMinima,
    };
    // Solo las columnas que la persona de verdad eligió: las ausentes
    // conservan lo que el RPC ya dejó, no se pisan con null.
    if (t.colorFondo) cambios.pase_color_fondo = t.colorFondo;
    if (t.colorSello) cambios.pase_color_sello = t.colorSello;
    if (t.iconoSello) cambios.pase_sello_icono = t.iconoSello;
    // El archivo del sello «Mi ícono» (0174): `validarTarjetaDeAlta` ya
    // garantiza el par coherente (nunca 'propio' sin URL), que es lo
    // que exige el CHECK de la 0174.
    if (t.iconoUrl) cambios.pase_sello_icono_url = t.iconoUrl;
    if (t.logoUrl) cambios.pase_logo_url = t.logoUrl;
    if (t.bannerUrl) cambios.pase_banner_url = t.bannerUrl;
    // La geometría de la tira (0212). `validarTarjetaDeAlta` la deja en
    // null cuando es la de siempre, así que esta columna solo se escribe
    // si la persona de verdad movió los sellos.
    if (t.diseno) cambios.pase_diseno = t.diseno;
    // El logo del AVISO (0208), si lo subió durante el alta.
    if (t.notificacionLogoUrl) cambios.pase_notificacion_logo_url = t.notificacionLogoUrl;

    const { error: eTarjeta } = await admin
      .from("programa_lealtad")
      .update(cambios)
      .eq("id", programaId);
    // No tumba el alta: el negocio y el programa ya existen, y lo peor
    // que queda es una tarjeta con los defaults — el dueño la edita
    // desde su panel. Perderlo todo por esto sería peor.
    if (eTarjeta) {
      console.error("[alta-gratis] La tarjeta del wizard no se pudo aplicar:", eTarjeta.message);
    }

    // La recompensa según el TIPO (los ocho, no solo sellos): la misma
    // siembra que usa `crearTarjeta` — dos siembras distintas para la
    // misma tarjeta se separan el día que alguien toca una.
    await sembrarRecompensa(admin, programaId, t.beneficio);
  } else {
    const { error: eRec } = await admin.from("recompensas").insert({
      programa_id: programaId,
      nombre: d.regalia,
      costo_puntos: d.metaSellos,
      activo: true,
    });
    if (eRec) console.error("[alta-gratis] La recompensa no se pudo crear:", eRec.message);
  }

  // El complemento que gobierna el módulo (0077): sin él, el panel
  // muestra "sin activar" aunque todo lo demás exista.
  //
  // ── Y ACÁ SE ESCRIBE EL FINAL DE LA PRUEBA ──────────────────────
  // Antes iba `vence_en: null` fijo, y `null` en `tiene_addon()`
  // significa PARA SIEMPRE: el catálogo prometía 14 días, la landing
  // los pintaba, y el negocio operaba gratis sin fecha de corte hasta
  // que alguien lo notara a mano.
  //
  // El corte se escribe UNA vez, acá, y de ahí en adelante lo hace
  // cumplir la base —`and (a.vence_en is null or a.vence_en > now())`—
  // sin ningún proceso nuestro de por medio. Un paquete de PAGO sigue
  // dando `null`, que para él es lo correcto: no vence por tiempo.
  const ahora = new Date();
  const corte = finDePrueba(d.plan, ahora);
  const { error: eAddon } = await admin.from("addons_negocio").upsert(
    {
      rancho_id: ranchoId,
      addon: "lealtad",
      activo: true,
      vence_en: corte,
      activado_en: ahora.toISOString(),
      // La nota es lo que va a leer quien abra este negocio en el
      // admin dentro de seis meses preguntándose de dónde salió.
      notas: corte
        ? `Plan ${d.plan} — ${d.origen === "admin" ? "alta hecha por un admin" : "prueba del creador de cards"}, vence ${corte.slice(0, 10)}`
        : `Plan ${d.plan} — ${d.origen === "admin" ? "alta hecha por un admin de Bookea" : "creado solo por el creador de cards"}`,
    },
    { onConflict: "rancho_id,addon" },
  );
  if (eAddon) console.error("[alta-gratis] El addon no se pudo activar:", eAddon.message);

  // «Mi página» (0229): la página pública /r/<slug> nace CON el negocio
  // — no-fatal, igual que el addon: sin página el alta sigue y el panel
  // la crea con el primer «Guardar».
  await crearPaginaDelNegocio(admin, ranchoId);

  // El registro: la solicitud queda ATENDIDA por el sistema, con todo
  // lo que la persona armó — auditoría y finanzas la ven igual. Con la
  // tarjeta nueva, las columnas viejas del registro se llenan con su
  // equivalente honesto: la regalía es el premio que se sembró, y la
  // meta solo existe si la tarjeta es de sellos.
  const receta = t ? recompensaInicial(t.beneficio) : null;
  const { error: eSol } = await admin.from("solicitudes_lealtad").insert({
    rancho_id: ranchoId,
    solicitante_id: d.userId,
    negocio_nombre: d.nombre,
    negocio_vertical: d.tipo,
    negocio_detalle: d.detalle || null,
    plan: d.plan,
    telefono: d.telefono,
    codigo_referido: d.codigoReferido,
    agente_id: d.agenteId,
    personalizado: false,
    pase_color: t ? (t.colorFondo ?? (d.paseColor || null)) : d.paseColor,
    pase_logo_url: t ? t.logoUrl : d.paseLogoUrl,
    regalia: t ? (receta?.nombre ?? null) : d.regalia,
    meta_sellos: t ? (t.beneficio.tipo === "sellos" ? t.beneficio.requeridos : null) : d.metaSellos,
    estado: "atendida",
    atendida_en: new Date().toISOString(),
  });
  if (eSol) console.error("[alta-gratis] La solicitud-registro no se pudo guardar:", eSol.message);

  // El aviso al equipo. Dice de dónde salió el negocio porque son dos
  // hechos distintos: uno se creó SOLO y el otro lo armó alguien de
  // Bookea — leerlos iguales en la bandeja hace perder el segundo.
  const porAdmin = d.origen === "admin";
  const queTarjeta = t
    ? `tarjeta de ${escapar(TIPOS_TARJETA[t.modo].nombre.toLowerCase())}${
        receta ? ` — «${escapar(receta.nombre)}»` : ""
      }`
    : `regalía «${escapar(d.regalia)}» a ${d.metaSellos} sellos`;

  after(() =>
    avisarAAdministradores({
      subject: porAdmin
        ? `PASE CREADO DESDE EL ADMIN — ${d.nombre}`
        : `NEGOCIO NUEVO AUTO-CREADO (plan Gratis) — ${d.nombre}`,
      html: `
        <p><b>${escapar(d.nombre)}</b> (${escapar(d.tipo)}${d.detalle ? ` — ${escapar(d.detalle)}` : ""})
        ${
          porAdmin
            ? `se creó <b>desde la administración</b> con el paquete <b>${escapar(d.plan)}</b>`
            : `se creó SOLO con el plan Gratis`
        }: programa activo, ${queTarjeta}.
        ${
          porAdmin
            ? `Queda a nombre de <b>${escapar(d.correo)}</b>, que es quien lo administra.`
            : `Dueño: ${escapar(d.correo)}.`
        }</p>
        ${
          corte
            ? `<p>La prueba <b>vence el ${escapar(corte.slice(0, 10))}</b>: ese día el
               complemento se apaga solo (lo hace la base, no un cron) y el panel le
               explica cómo seguir. Se le avisa por correo unos días antes.</p>`
            : ""
        }
        <p>No hay nada que aprobar — es informativo.
        <a href="https://www.bookea.lat/admin/lealtad/${ranchoId}">Ver su programa</a>.</p>
      `,
    }),
  );

  return { ok: true, creado: { ranchoId, slug: (rancho.slug as string | null) ?? null } };
}

