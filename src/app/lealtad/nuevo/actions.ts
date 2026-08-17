"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, esPlanOfrecido, esPlanSinCosto } from "@/lib/lealtad/planes";
import { TIPOS_TARJETA } from "@/lib/lealtad/tipos-tarjeta";
import { acumulacionDe, recompensaInicial } from "@/lib/lealtad/mostrador";
import { sembrarRecompensa } from "@/lib/lealtad/sembrar-recompensa";
import {
  validarTarjetaDeAlta,
  type TarjetaAltaValidada,
  type TarjetaDeAlta,
} from "@/lib/lealtad/tarjeta-alta";
import { finDePrueba } from "@/lib/lealtad/prueba";
import { generarSlugUnico } from "@/lib/slug";
import { apagarModulosOperativos } from "@/lib/lealtad/solo-lealtad";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { avisarAAdministradores } from "@/lib/correo/administradores";

/**
 * La solicitud de ALTA (0130): acá el negocio NO se crea — se PIDE.
 *
 * La persona deja el nombre del negocio, el tipo (con «otro»), el
 * paquete que eligió y su depósito con comprobante. Todo eso viaja en
 * UNA fila de solicitudes_lealtad sin rancho: si el admin acepta desde
 * /admin/complementos, ahí recién nace el rancho (ya aprobado para
 * lealtad, con su plan y su complemento); si rechaza, no existe nada
 * que borrar.
 *
 * El INSERT va con la sesión del usuario: la política "Pedir el alta
 * de un negocio nuevo" exige firmar con el propio id, nacer pendiente
 * y traer nombre — y el unique parcial rebota el doble clic.
 */

const TIPOS = ["citas", "eventos", "hospedajes", "restaurantes", "otro"] as const;
export type TipoNegocio = (typeof TIPOS)[number];

type Resultado =
  | {
      ok: true;
      /** Solo el plan Gratis del creador: se creó TODO al instante. */
      creado?: { ranchoId: string; slug: string | null };
    }
  | { ok: false; motivo: string };

export async function solicitarAltaConPlan(datos: {
  nombreNegocio: string;
  tipo: string;
  /** Si el tipo es «otro»: qué negocio es, en sus palabras. */
  detalleOtro: string;
  plan: string;
  metodoPago: string;
  comprobanteUrl: string;
  telefono: string;
  /** true = «Crear personalizado»: queda en espera, el equipo diseña. */
  personalizado: boolean;
  /** La descripción del diseño soñado (solo personalizado). */
  descripcion: string;
  /** Lo del CREADOR (solo cuando NO es personalizado): */
  paseColor: string;
  /** El logo subido (opcional, "" = sin logo). */
  paseLogoUrl: string;
  regalia: string;
  metaSellos: number;
  /**
   * La tarjeta ARMADA EN EL WIZARD NUEVO (5 pasos): tipo, beneficio,
   * colores, icono del sello y las dos imágenes. Opcional y todo
   * opcional adentro — el payload del wizard viejo, que no la manda,
   * sigue funcionando idéntico. Solo la usa el alta GRATIS instantánea;
   * los caminos de solicitud (pago o personalizado) no la tocan.
   */
  tarjeta?: TarjetaDeAlta | null;
}): Promise<Resultado> {
  const nombre = datos.nombreNegocio.trim();
  if (!nombre || nombre.length > 80) {
    return { ok: false, motivo: "El nombre del negocio es obligatorio (máximo 80)." };
  }
  const tipo = (TIPOS as readonly string[]).includes(datos.tipo) ? datos.tipo : "otro";
  const detalle = tipo === "otro" ? datos.detalleOtro.trim().slice(0, 80) : "";
  if (tipo === "otro" && !detalle) {
    return { ok: false, motivo: "Contanos qué negocio es." };
  }
  // Contra los OFRECIDOS, no contra todos los que la base acepta.
  // `esPlan` incluye los RETIRADOS —tiene que incluirlos, para que las
  // cuentas que ya los tienen sigan resolviendo—, así que validando con
  // él una petición armada a mano con `plan: "gratis"` entraba por acá
  // y se llevaba `SIN_TOPES`: tarjetas y equipo ilimitados y los ocho
  // tipos de tarjeta, gratis y para siempre. Elegir es distinto de
  // tener: acá se elige.
  if (!esPlanOfrecido(datos.plan)) return { ok: false, motivo: "Ese paquete no existe." };

  // Sin costo = sin depósito que verificar. Se pregunta por el catálogo
  // y no por `precioMensual === 0` suelto: el paquete RETIRADO `gratis`
  // también vale $0, y esa comparación floja era la segunda mitad del
  // agujero de arriba.
  const gratis = esPlanSinCosto(datos.plan);

  // ── LA TARJETA DEL WIZARD NUEVO (opcional) ──────────────────────
  // Se valida SIEMPRE que venga —tipo contra el paquete, beneficio con
  // su forma real, colores, icono y URLs del storage propio—, con las
  // mismas reglas que `crearTarjeta` (ver tarjeta-alta.ts). Pero solo
  // REEMPLAZA al camino viejo en el alta gratis instantánea y cuando
  // trae el tipo: los caminos de solicitud (pago / personalizado)
  // siguen guardando exactamente las columnas de siempre.
  let tarjetaValidada: TarjetaAltaValidada | null = null;
  if (datos.tarjeta && !datos.personalizado) {
    const v = validarTarjetaDeAlta(datos.tarjeta, datos.plan);
    if (!v.ok) return { ok: false, motivo: v.motivo };
    tarjetaValidada = v.tarjeta;
  }
  const tarjeta = gratis && !datos.personalizado && tarjetaValidada?.modo ? tarjetaValidada : null;

  const descripcion = datos.descripcion.trim().slice(0, 500);
  const regalia = datos.regalia.trim().slice(0, 120);
  if (datos.personalizado) {
    if (descripcion.length < 5) {
      return { ok: false, motivo: "Contanos cómo soñás la tarjeta (unas palabras alcanzan)." };
    }
  } else if (!tarjeta) {
    // El camino VIEJO (color + regalía + meta): exige sus campos solo
    // cuando la tarjeta nueva no viene a reemplazarlos.
    if (!/^#[0-9a-fA-F]{6}$/.test(datos.paseColor)) {
      return { ok: false, motivo: "Elegí el color de tu tarjeta." };
    }
    if (!regalia) return { ok: false, motivo: "Contanos qué regalía vas a dar." };
    if (!Number.isInteger(datos.metaSellos) || datos.metaSellos < 1 || datos.metaSellos > 100) {
      return { ok: false, motivo: "La meta de sellos tiene que estar entre 1 y 100." };
    }
    // El logo es opcional, pero si viene tiene que ser de NUESTRO
    // storage — no una URL cualquiera que después sirva la tarjeta.
    if (datos.paseLogoUrl && !esUrlDeNuestroStorage(datos.paseLogoUrl, "comprobantes")) {
      return { ok: false, motivo: "El logo no se subió bien — probá de nuevo." };
    }
  }

  if (!gratis) {
    if (datos.metodoPago !== "sinpe" && datos.metodoPago !== "transferencia") {
      return { ok: false, motivo: "Elegí cómo pagaste: SINPE o transferencia." };
    }
    if (!esUrlDeNuestroStorage(datos.comprobanteUrl, "comprobantes")) {
      return { ok: false, motivo: "Adjuntá la captura del depósito para enviar la solicitud." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión para enviar la solicitud." };

  // ── UN COMERCIO CON PROGRAMA POR PERSONA ────────────────────────────
  // Regla del dueño: quien usa Lealtad tiene UN negocio con programa. No
  // limita cuántos negocios puede publicar en el marketplace — eso sigue
  // abierto—, solo cuántos pueden tener tarjeta de fidelidad.
  //
  // SE COMPRUEBA ACÁ, EN EL SERVIDOR, y no escondiendo un botón: la
  // pantalla ayuda, pero una petición armada a mano se salta cualquier
  // cosa que viva en el navegador.
  //
  // A QUIEN YA TIENE VARIOS NO SE LE QUITA NADA. Este bloqueo frena las
  // altas NUEVAS y nada más; los negocios que ya existen siguen con su
  // programa, sus clientes y sus sellos. Quitarle el programa a alguien
  // que lo está usando por un cambio de catálogo es exactamente lo que
  // este proyecto ya decidió no hacer con los planes retirados.
  const yaTiene = await negocioConProgramaDe(user.id);
  if (yaTiene) {
    return {
      ok: false,
      motivo: `Ya tenés tu programa de lealtad en «${yaTiene}». Por ahora cada cuenta maneja un solo comercio con programa — escribinos si necesitás más de uno.`,
    };
  }

  // ── EL CAMINO AUTOMÁTICO: Gratis + creador = se crea TODO al toque ──
  // Sin depósito no hay nada que verificar: el único requisito era la
  // cuenta, y ya la tiene. Los planes DE PAGO siguen el camino manual
  // (abajo): la confirmación del depósito es humana a propósito.
  // El personalizado también es humano aunque sea gratis: lo diseña el
  // equipo, no una plantilla.
  if (gratis && !datos.personalizado) {
    return crearGratisAlInstante({
      userId: user.id,
      plan: datos.plan,
      nombre,
      tipo,
      detalle,
      paseColor: datos.paseColor,
      paseLogoUrl: datos.paseLogoUrl || null,
      regalia,
      metaSellos: datos.metaSellos,
      telefono: datos.telefono.trim().slice(0, 30) || null,
      correo: user.email ?? "(sin correo)",
      tarjeta,
    });
  }

  const { error } = await supabase.from("solicitudes_lealtad").insert({
    rancho_id: null,
    solicitante_id: user.id,
    negocio_nombre: nombre,
    negocio_vertical: tipo,
    negocio_detalle: detalle || null,
    plan: datos.plan,
    metodo_pago: gratis ? null : datos.metodoPago,
    comprobante_url: gratis ? null : datos.comprobanteUrl,
    telefono: datos.telefono.trim().slice(0, 30) || null,
    personalizado: datos.personalizado,
    // El personalizado viaja como texto libre; el creador, como datos
    // que la aprobación convierte en programa funcionando.
    mensaje: datos.personalizado ? descripcion : null,
    pase_color: datos.personalizado ? null : datos.paseColor,
    pase_logo_url: datos.personalizado ? null : datos.paseLogoUrl || null,
    regalia: datos.personalizado ? null : regalia,
    meta_sellos: datos.personalizado ? null : datos.metaSellos,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        motivo: "Ya tenés una solicitud en revisión — te contactamos apenas la veamos.",
      };
    }
    if (/negocio_nombre|negocio_vertical/.test(error.message) && /schema cache|Could not find|does not exist/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0130 en Supabase." };
    }
    if (/metodo_pago|comprobante_url/.test(error.message) && /schema cache|Could not find|does not exist/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0128 en Supabase." };
    }
    if (error.code === "23502" && /rancho_id/.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0130 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo enviar: " + error.message };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();
  const quien = ((perfil?.nombre as string | null) ?? "").trim() || "(sin nombre)";
  const correo = user.email ?? "(sin correo)";
  const planNombre = definicionDe(datos.plan)?.nombre ?? datos.plan;

  after(() =>
    avisarAAdministradores({
      subject: `HAY UNA SOLICITUD DEL PASE DE LEALTAD — negocio NUEVO${datos.personalizado ? " (PERSONALIZADO)" : ""}: ${nombre}`,
      html: `
        <h2 style="margin:0 0 12px">Alta de negocio + plan de lealtad</h2>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0"><b>Negocio (a crear)</b></td><td>${escapar(nombre)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Tipo</b></td><td>${escapar(tipo)}${detalle ? ` — ${escapar(detalle)}` : ""}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Paquete</b></td><td>${escapar(planNombre)}${gratis ? " (gratis, sin depósito)" : ""}</td></tr>
          ${
            datos.personalizado
              ? `<tr><td style="padding:4px 12px 4px 0"><b>Diseño</b></td><td><b>PERSONALIZADO, en espera</b> — «${escapar(descripcion)}»</td></tr>`
              : `<tr><td style="padding:4px 12px 4px 0"><b>Tarjeta</b></td><td>color ${escapar(datos.paseColor)} · regalía «${escapar(regalia)}» · ${datos.metaSellos} sellos — al aceptar queda FUNCIONANDO sola</td></tr>`
          }
          <tr><td style="padding:4px 12px 4px 0"><b>Solicitante</b></td><td>${escapar(quien)} · ${escapar(correo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Teléfono</b></td><td>${escapar(datos.telefono.trim() || "—")}</td></tr>
          ${
            gratis
              ? ""
              : `<tr><td style="padding:4px 12px 4px 0"><b>Pagó por</b></td><td>${escapar(datos.metodoPago)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Comprobante</b></td><td><a href="${escapar(datos.comprobanteUrl)}">ver la captura del depósito</a></td></tr>`
          }
        </table>
        <p style="margin:16px 0 0">
          Aceptar CREA el negocio con su plan; rechazar no crea nada. Se atiende en
          <a href="https://www.bookea.lat/admin/complementos">el panel de complementos</a>.
        </p>
      `,
    }),
  );

  return { ok: true };
}

/**
 * ¿ESTA PERSONA YA TIENE UN NEGOCIO CON PROGRAMA DE LEALTAD?
 *
 * Devuelve el NOMBRE del primero que encuentre, o null. El nombre —y no
 * un booleano— porque el aviso tiene que decir CUÁL: «ya tenés tu
 * programa en Café Aroma» se puede obedecer; «ya tenés un programa» deja
 * a alguien con cinco negocios adivinando en cuál.
 *
 * Cuenta lo que de verdad tiene programa, no lo que tiene el complemento
 * encendido: un negocio puede tener el add-on activo y todavía no haber
 * armado su tarjeta, y en ese estado no debería consumir el cupo.
 *
 * Va con la llave de servicio porque tiene que ver TODOS los negocios de
 * la persona, incluidos los que están pendientes de aprobación — si no,
 * alguien podría pedir dos altas seguidas antes de que la primera se
 * apruebe y quedarse con dos.
 */
async function negocioConProgramaDe(userId: string): Promise<string | null> {
  const db = createAdminClient();
  if (!db) return null;

  const { data: mios } = await db.from("ranchos").select("id, nombre").eq("owner_id", userId);
  const ids = (mios ?? []).map((r) => r.id as string);
  if (ids.length === 0) return null;

  const { data: programas, error } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .in("rancho_id", ids)
    .limit(1);

  // Si la consulta falla NO se bloquea el alta: dejar a alguien sin
  // poder crear su programa por un error nuestro de lectura es peor que
  // permitir un segundo negocio que después se puede resolver a mano.
  if (error) {
    console.error("[alta-lealtad] No se pudo comprobar el cupo de comercios:", error.message);
    return null;
  }
  if (!programas || programas.length === 0) return null;

  const dueño = (mios ?? []).find((r) => r.id === programas[0].rancho_id);
  return ((dueño?.nombre as string | null) ?? "").trim() || "tu otro negocio";
}

/**
 * Crea negocio + programa + recompensa AL INSTANTE (plan Gratis del
 * creador). Va con la llave de servicio: setea la aprobación de
 * lealtad (0129) que el trigger le niega a la sesión del usuario, y
 * deja la solicitud como registro YA ATENDIDO (atendida_por null =
 * el sistema). El correo al equipo es informativo, no una tarea.
 */
async function crearGratisAlInstante(d: {
  userId: string;
  /**
   * EL PLAN QUE LA PERSONA ELIGIÓ, no uno escrito a mano acá.
   *
   * Acá decía `"gratis"` fijo, y eso vaciaba el tope del paquete sin que
   * se notara: `gratis` es un plan RETIRADO, y los retirados llevan
   * `SIN_TOPES` a propósito —a quien ya lo tenía no se le quita lo que
   * tenía—. Así que `definicionDe("gratis").limites.programas` daba
   * `null`, el tope de `crear-actions.ts` ni se ejecutaba, y una cuenta
   * gratis podía crear pases ilimitados.
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
  /**
   * La tarjeta del wizard nuevo, YA VALIDADA por `validarTarjetaDeAlta`
   * (tipo contra el paquete incluido). null = payload viejo: todo sigue
   * saliendo de paseColor/regalia/metaSellos, idéntico a siempre.
   */
  tarjeta: TarjetaAltaValidada | null;
}): Promise<Resultado> {
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
      lealtad_aprobado_en: new Date().toISOString(),
      lealtad_aprobado_por: null, // el sistema
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
    if (t.logoUrl) cambios.pase_logo_url = t.logoUrl;
    if (t.bannerUrl) cambios.pase_banner_url = t.bannerUrl;

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
      notas: corte
        ? `Plan ${d.plan} — prueba del creador de cards, vence ${corte.slice(0, 10)}`
        : `Plan ${d.plan} — creado solo por el creador de cards`,
    },
    { onConflict: "rancho_id,addon" },
  );
  if (eAddon) console.error("[alta-gratis] El addon no se pudo activar:", eAddon.message);

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
    personalizado: false,
    pase_color: t ? (t.colorFondo ?? (d.paseColor || null)) : d.paseColor,
    pase_logo_url: t ? t.logoUrl : d.paseLogoUrl,
    regalia: t ? (receta?.nombre ?? null) : d.regalia,
    meta_sellos: t ? (t.beneficio.tipo === "sellos" ? t.beneficio.requeridos : null) : d.metaSellos,
    estado: "atendida",
    atendida_en: new Date().toISOString(),
  });
  if (eSol) console.error("[alta-gratis] La solicitud-registro no se pudo guardar:", eSol.message);

  after(() =>
    avisarAAdministradores({
      subject: `NEGOCIO NUEVO AUTO-CREADO (plan Gratis) — ${d.nombre}`,
      html: `
        <p><b>${escapar(d.nombre)}</b> (${escapar(d.tipo)}${d.detalle ? ` — ${escapar(d.detalle)}` : ""})
        se creó SOLO con el plan Gratis: programa activo, ${
          t
            ? `tarjeta de ${escapar(TIPOS_TARJETA[t.modo].nombre.toLowerCase())}${
                receta ? ` — «${escapar(receta.nombre)}»` : ""
              }`
            : `regalía «${escapar(d.regalia)}» a ${d.metaSellos} sellos`
        }. Dueño: ${escapar(d.correo)}.</p>
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

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
