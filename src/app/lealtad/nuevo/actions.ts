"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, esPlanOfrecido, esPlanSinCosto } from "@/lib/lealtad/planes";
import {
  validarTarjetaDeAlta,
  type TarjetaAltaValidada,
  type TarjetaDeAlta,
} from "@/lib/lealtad/tarjeta-alta";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { puedeCrearNegocioDeLealtad } from "@/lib/lealtad/tenencia";
import { crearNegocioDeLealtadCompleto } from "@/lib/lealtad/crear-negocio-completo";
import { escaparHtml as escapar } from "@/lib/email";

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
  | {
      ok: false;
      motivo: string;
      /**
       * Se alcanzó el tope de un negocio por cuenta. NO es un error de
       * lo que la persona escribió: la pantalla lo usa para ofrecer el
       * formulario de contacto en vez de un aviso rojo.
       */
      tope?: boolean;
    };

export async function solicitarAltaConPlan(datos: {
  nombreNegocio: string;
  tipo: string;
  /** Si el tipo es «otro»: qué negocio es, en sus palabras. */
  detalleOtro: string;
  plan: string;
  metodoPago: string;
  comprobanteUrl: string;
  telefono: string;
  /**
   * El código del agente de ventas que trajo este negocio (opcional).
   * Se valida contra `agentes_lealtad` (0219): escrito mal, se avisa
   * en vez de tragarse el typo — el agente cobra por sus altas y un
   * código mudo es una venta que no se le acredita a nadie.
   */
  codigoReferido?: string;
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
  // él una petición armada a mano con el id de un paquete retirado
  // entraba por acá y se llevaba un plan SIN TOPES: tarjetas y equipo
  // ilimitados y los ocho tipos de tarjeta, gratis y para siempre.
  // Elegir es distinto de tener: acá se elige.
  //
  // Hoy no hay ningún retirado en el catálogo (0179), o sea que el
  // agujero está sin munición, no cerrado: el primero que se retire
  // vuelve a cargarlo. La puerta se queda.
  if (!esPlanOfrecido(datos.plan)) return { ok: false, motivo: "Ese paquete no existe." };

  // Sin costo = sin depósito que verificar. Se pregunta por el catálogo
  // y no por `precioMensual === 0` suelto: hubo un paquete retirado que
  // también valía $0, y esa comparación floja era la segunda mitad del
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

  // ── UN NEGOCIO DE LEALTAD POR CUENTA (dueño, 31 ago 2026) ─────────
  // Va ACÁ ARRIBA, antes de la bifurcación de más abajo, porque las
  // DOS ramas dan de alta un negocio: la gratis lo crea al instante y
  // la de pago lo deja pedido para que el equipo lo cree. Puesto en
  // una sola, la otra queda de puerta trasera.
  //
  // El `tope` viaja en la respuesta para que la pantalla abra el
  // formulario de contacto en vez de pintar un error rojo: pedir el
  // segundo negocio es un camino válido, no una equivocación.
  const cupo = await puedeCrearNegocioDeLealtad(user.id, datos.plan);
  if (!cupo.puede) return { ok: false, motivo: cupo.motivo, tope: true };

  // ── EL CAMINO AUTOMÁTICO: Gratis + creador = se crea TODO al toque ──
  // Sin depósito no hay nada que verificar: el único requisito era la
  // cuenta, y ya la tiene. Los planes DE PAGO siguen el camino manual
  // (abajo): la confirmación del depósito es humana a propósito.
  // El personalizado también es humano aunque sea gratis: lo diseña el
  // equipo, no una plantilla.
  // ── EL CÓDIGO DE REFERIDO (28 ago 2026) ──────────────────────────
  const referido = await resolverCodigoReferido(datos.codigoReferido);
  if ("error" in referido) return { ok: false, motivo: referido.error };

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
      codigoReferido: referido.codigo,
      agenteId: referido.agenteId,
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
    codigo_referido: referido.codigo,
    agente_id: referido.agenteId,
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
 * Crea negocio + programa + recompensa AL INSTANTE (plan Gratis del
 * creador). Va con la llave de servicio: setea la aprobación de
 * lealtad (0129) que el trigger le niega a la sesión del usuario, y
 * deja la solicitud como registro YA ATENDIDO (atendida_por null =
 * el sistema). El correo al equipo es informativo, no una tarea.
 */
/**
 * EL ALTA INSTANTÁNEA — ahora es un envoltorio de tres líneas.
 *
 * Los ~260 renglones que armaban el rancho, el programa, la tarjeta, la
 * recompensa, el complemento y el registro vivían acá adentro. Se
 * mudaron a `lib/lealtad/crear-negocio-completo.ts` el 1 sep 2026,
 * cuando apareció el segundo camino: un admin armándole el pase a un
 * cliente desde /admin/lealtad/nuevo.
 *
 * Lo único que se queda de este lado es el ORIGEN: quién lo creó. Todo
 * lo demás tiene que ser idéntico por las dos puertas, y la forma de
 * garantizarlo es que sea el mismo código, no dos copias parecidas.
 */
async function crearGratisAlInstante(
  d: Omit<Parameters<typeof crearNegocioDeLealtadCompleto>[0], "origen" | "aprobadoPor">,
): Promise<Resultado> {
  return crearNegocioDeLealtadCompleto({ ...d, origen: "creador" });
}

/**
 * ¿De quién es este código de referido?
 *
 * Los agentes de ventas viven en `agentes_lealtad` (0219) y sus
 * códigos se guardan en MAYÚSCULA; acá se normaliza igual antes de
 * comparar. Se consulta con el cliente admin: la tabla no tiene
 * políticas públicas a propósito — los códigos de los agentes no son
 * un directorio que un anónimo pueda enumerar probando.
 *
 * Vacío = sin referido, y no es error: el campo es opcional. Pero un
 * código ESCRITO que no existe (o de un agente dado de baja) sí frena
 * con aviso: tragarse el typo en silencio es una venta que no se le
 * acredita a nadie.
 */
async function resolverCodigoReferido(
  crudo: string | undefined,
): Promise<{ codigo: string | null; agenteId: string | null } | { error: string }> {
  const codigo = (crudo ?? "").trim().toUpperCase();
  if (!codigo) return { codigo: null, agenteId: null };

  const admin = createAdminClient();
  // Sin service key (entorno a medio configurar) no hay contra qué
  // validar: el código viaja igual — el rastro vale más que rechazar
  // el alta — y el agente se amarra después a mano.
  if (!admin) return { codigo, agenteId: null };
  const { data } = await admin
    .from("agentes_lealtad")
    .select("id, activo")
    .eq("codigo", codigo)
    .maybeSingle();

  if (!data || data.activo === false) {
    return {
      error:
        "Ese código de referido no existe o ya no está activo. Revisalo — o dejá el campo vacío y seguí.",
    };
  }
  return { codigo, agenteId: data.id as string };
}
