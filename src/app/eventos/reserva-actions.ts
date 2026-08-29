"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarReservaCompletada } from "@/lib/notificaciones-reserva";
import { leerCuentasDeCobro, SIN_CUENTAS } from "@/lib/ranchos-publicos";
import {
  calcularBaseLugar,
  parsearPrecioPorPersona,
  type ModalidadPrecio,
} from "@/lib/precio-lugar";
import { promoAplicableDelDia } from "@/lib/promociones";
import type { PromocionDia } from "@/app/mi-negocio/types";
import type { HorarioBloque, PrecioTier, ServicioAdicional } from "./tipos-lugar";

const MINUTOS_HOLD = 10;

// Límites contra bots: cuántos intentos de reserva puede hacer una
// misma conexión en 10 minutos, y cuántas fechas puede tener
// tomadas al mismo tiempo. Sin esto, alguien podría escribirle
// directo al servidor (sin pasar por la página) y tomar todas las
// fechas disponibles para bloquear las reservas reales.
// Cambiar de fecha ahora libera la anterior, así que comparar varios
// días es normal y no debería toparse con el límite: por eso la ventana
// admite más intentos que antes. El tope real contra el acaparamiento
// sigue siendo MAX_HOLDS_ACTIVOS_POR_IP (más el índice único por fecha).
const MAX_INTENTOS_POR_VENTANA = 20;
const VENTANA_INTENTOS_MINUTOS = 10;
const MAX_HOLDS_ACTIVOS_POR_IP = 2;

async function obtenerIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "desconocida";
}

/**
 * Toma una fecha por 10 minutos y, si sale, devuelve JUNTO con el hold
 * los datos de cobro del negocio.
 *
 * Que vengan de acá y no de la página es lo que cierra la fuga: la
 * ficha de un lugar es pública y cualquier dato que le pase al
 * calendario (que es `"use client"`) queda escrito en el HTML, a la
 * vista de Googlebot y de cualquier anónimo con un `curl`. En cambio
 * esta respuesta solo la recibe quien acaba de tomar una fecha de ESTE
 * negocio: tiene el hold a su nombre, verificado por IP, y los topes de
 * acá arriba (2 fechas tomadas a la vez, 20 intentos cada 10 minutos)
 * hacen que raspar las cuentas de todos los proveedores deje de ser
 * gratis. No alcanza con tener cuenta — hay que estar reservando.
 *
 * Las cuentas se piden en paralelo con los controles anti-bot: si el
 * hold sale, ya están listas y el paso "Cómo pagar" no espera otro
 * viaje a la base.
 */
export async function crearReservaTemporal(ranchoId: string, fecha: string) {
  const supabase = await createClient();
  // Con el cliente de servicio a propósito: acá se reserva SIN cuenta
  // (se crea en silencio al completar), así que el `supabase` de esta
  // acción es el rol anónimo — y desde la 0140 ese rol ya no puede leer
  // las cuentas de cobro. Sin esto, el paso "Cómo pagar" se quedaba sin
  // ningún método y nadie podía depositar. El permiso acá no lo da el
  // rol sino el hold: la persona acaba de tomar esta fecha, con tope de
  // intentos por IP.
  const cuentasPromesa = leerCuentasDeCobro(createAdminClient() ?? supabase, ranchoId);
  const ip = await obtenerIp();
  const nowIso = new Date().toISOString();
  const expiraEn = new Date(Date.now() + MINUTOS_HOLD * 60 * 1000).toISOString();

  const { data: puedeIntentar } = await supabase.rpc("registrar_intento_reserva", {
    p_ip: ip,
    p_max_intentos: MAX_INTENTOS_POR_VENTANA,
    p_ventana_minutos: VENTANA_INTENTOS_MINUTOS,
  });

  if (puedeIntentar === false) {
    return {
      id: null,
      expiraEn: null,
      cuentas: SIN_CUENTAS,
      error:
        "Hiciste demasiados intentos de reserva en poco tiempo. Esperá unos minutos e intentá de nuevo.",
    };
  }

  // Libera holds vencidos de esta fecha (de este rancho) antes de intentar tomarla.
  await supabase
    .from("reservas")
    .delete()
    .eq("rancho_id", ranchoId)
    .eq("fecha", fecha)
    .eq("estado", "temporal")
    .lt("expira_en", nowIso);

  // Elegir otro día de este mismo negocio reemplaza el bloqueo anterior
  // en vez de sumar uno. El cliente ya libera el suyo al cambiar de
  // fecha, pero si la pestaña se cerró de golpe (o se recargó) el hold
  // viejo sigue vivo hasta 10 minutos, y sin esto la persona se topaba
  // con "ya tenés una fecha reservada" por su propio hold huérfano.
  const { data: propios } = await supabase
    .from("reservas")
    .select("id")
    .eq("estado", "temporal")
    .eq("creado_por_ip", ip)
    .eq("rancho_id", ranchoId)
    .gt("expira_en", nowIso);

  for (const propio of propios ?? []) {
    await supabase.rpc("liberar_hold_temporal", { p_id: propio.id, p_ip: ip });
  }

  // Tope de fechas tomadas al mismo tiempo por la misma conexión —
  // evita que se "acaparen" fechas de varios negocios a la vez.
  const { count: activosPorIp } = await supabase
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("estado", "temporal")
    .eq("creado_por_ip", ip)
    .gt("expira_en", nowIso);

  if ((activosPorIp ?? 0) >= MAX_HOLDS_ACTIVOS_POR_IP) {
    return {
      id: null,
      expiraEn: null,
      cuentas: SIN_CUENTAS,
      error:
        "Tenés fechas bloqueadas en otros lugares. Completá esas reservas o esperá a que se liberen antes de elegir otra.",
    };
  }

  const { data, error } = await supabase
    .from("reservas")
    .insert({
      fecha,
      estado: "temporal",
      expira_en: expiraEn,
      origen: "web",
      rancho_id: ranchoId,
      creado_por_ip: ip,
    })
    .select("id, expira_en")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        id: null,
        expiraEn: null,
        cuentas: SIN_CUENTAS,
        error:
          "Justo ahora otra persona reservó temporalmente esta fecha. Esperá unos minutos o elegí otro día.",
      };
    }
    return { id: null, expiraEn: null, cuentas: SIN_CUENTAS, error: error.message };
  }
  return {
    id: data.id as string,
    expiraEn: data.expira_en as string,
    cuentas: await cuentasPromesa,
    error: null,
  };
}

export async function cancelarReservaTemporal(id: string) {
  const supabase = await createClient();
  const ip = await obtenerIp();
  // Se libera por RPC porque la política de borrado solo permite
  // eliminar holds ya vencidos — un `delete` directo sobre un hold
  // todavía activo no borraba nada y la fecha quedaba tomada los
  // 10 minutos completos aunque la persona se hubiera ido a otra.
  // La función comprueba que el hold lo haya creado esta misma
  // conexión, así nadie puede soltar el de otra persona.
  await supabase.rpc("liberar_hold_temporal", { p_id: id, p_ip: ip });
}

export type CompletarReservaInput = {
  nombre: string;
  correo: string;
  whatsapp: string;
  cedula: string;
  tipo_evento: string;
  invitados: number;
  /** Las horas contratadas (solo modalidad "hora"): una CANTIDAD que
   *  elige quien reserva, no un precio. El servidor recalcula el monto
   *  multiplicándolas por la tarifa que tiene la base. */
  horas: number;
  /** Los ids de los servicios adicionales que marcó. También es una
   *  selección del cliente; el precio de cada servicio lo pone la base. */
  servicios_ids: string[];
  horario_bloque: HorarioBloque | null;
  /** Los tres montos de abajo viajan para que el cliente muestre lo
   *  mismo que verá en su reserva, pero el servidor NO les cree: los
   *  recalcula contra los precios de la base (ver recalcularMontosReserva)
   *  y guarda los suyos. «El precio del pedido lo pone la base, no
   *  TypeScript». */
  monto_total: number;
  deposito_monto: number;
  metodo_pago: "sinpe" | "transferencia";
  deposito_comprobante_url: string;
  terminos_aceptados: boolean;
  /** Aceptación aparte de los términos: que el evento no es de los que
   *  el negocio no alquila (serenatas, menores, fiestas clandestinas). */
  aviso_prohibiciones_aceptado: boolean;
  notas: string | null;
  codigo_descuento: string | null;
  descuento_monto: number;
};

const CEDULA_REGEX = /^[0-9-]{7,14}$/;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_REGEX = /^[0-9+\s-]{8,16}$/;

type ClienteServidor = Awaited<ReturnType<typeof createClient>>;

type MontosCalculados = {
  montoTotal: number;
  depositoMonto: number;
  descuentoMonto: number;
  /** El código en MAYÚSCULAS solo si validó contra la base; null si no
   *  se mandó o no sirve. Solo este se guarda y se canjea — nunca el
   *  crudo que mandó el cliente. */
  codigoValidado: string | null;
};

/**
 * Rehace el precio de la reserva LEYÉNDOLO DE LA BASE, nunca del
 * navegador. (Regla del repo: «el precio del pedido lo pone la base, no
 * TypeScript».)
 *
 * Antes `monto_total`, `deposito_monto` y `descuento_monto` viajaban ya
 * armados desde el cliente y se guardaban tal cual: quien le escribiera
 * directo a esta acción podía reservar por ₡0, o inflar el descuento y
 * con eso encoger la comisión que Bookea devenga (que se calcula sobre
 * el monto). Acá se corre el MISMO cálculo que enseña la ficha pública
 * —los mismos módulos, calcularBaseLugar y promoAplicableDelDia, para no
 * divergir de lo que la persona vio— pero con las tarifas del negocio y
 * la validación real del código. Del cliente solo se creen las
 * CANTIDADES que eligió (invitados, horas, cuáles servicios); los
 * precios salen todos de la base.
 *
 * Devuelve un error legible si el lugar no tiene precio calculable para
 * lo elegido (el mismo caso en que la ficha muestra "consultar" y no
 * deja enviar) o si el grupo excede la capacidad.
 */
async function recalcularMontosReserva(
  supabase: ClienteServidor,
  ranchoId: string,
  fecha: string,
  input: CompletarReservaInput,
): Promise<
  { montos: MontosCalculados; error: null } | { montos: null; error: string }
> {
  const [ranchoRes, tiersRes, svcRes, promoRes] = await Promise.all([
    supabase
      .from("ranchos")
      .select(
        "modalidad_precio_lugar, precio_hora_lugar, precio_fijo_lugar, precio_hora_diciembre, precio_fijo_diciembre, precio_por_persona, tarifa_diciembre_por_persona, deposito_reserva, capacidad_max",
      )
      .eq("id", ranchoId)
      .maybeSingle(),
    // `*` y no columnas por nombre: `temporada` (0099) puede no existir
    // todavía en la base y pedirla explícita rompería la consulta entera
    // —igual que en la ficha (rancho-portal). Sin la columna, todo cae a
    // 'normal'.
    supabase
      .from("precio_tiers")
      .select("*")
      .eq("rancho_id", ranchoId)
      .order("min_invitados", { ascending: true }),
    supabase
      .from("servicios_adicionales")
      .select("id, nombre, precio, requisito_max_invitados")
      .eq("rancho_id", ranchoId)
      .eq("activo", true),
    supabase
      .from("promociones_dia")
      .select("*")
      .eq("rancho_id", ranchoId)
      .eq("activo", true),
  ]);

  const rancho = ranchoRes.data;
  if (!rancho) {
    return { montos: null, error: "No se encontró el lugar de esta reserva." };
  }

  // Capacidad: se revalida acá (el tope del formulario es solo del
  // navegador) con el mismo mensaje de siempre.
  const capacidadMax = rancho.capacidad_max as number | null;
  if (capacidadMax && input.invitados > capacidadMax) {
    return {
      montos: null,
      error: `Este lugar recibe hasta ${capacidadMax} personas — no se puede reservar para más.`,
    };
  }

  // Diciembre y día de la semana salen de la FECHA del hold, no de nada
  // que mande el cliente. El día se arma con componentes locales, no con
  // new Date("YYYY-MM-DD") (que interpreta UTC y corre el día de la
  // semana) — exactamente como en booking-calendar.
  const esDiciembre = fecha.slice(5, 7) === "12";
  const [anio, mes, diaMes] = fecha.split("-").map(Number);
  const diaSemana = new Date(anio, mes - 1, diaMes).getDay();

  // Los rangos de diciembre son filas de la misma tabla marcadas con
  // `temporada` (mismo criterio que la ficha).
  const filasTiers = (tiersRes.data ?? []) as (PrecioTier & {
    temporada?: unknown;
  })[];
  const esDeDiciembre = (f: { temporada?: unknown }) =>
    typeof f.temporada === "string" && f.temporada === "diciembre";
  const soloRango = ({
    min_invitados,
    max_invitados,
    precio,
  }: PrecioTier): PrecioTier => ({ min_invitados, max_invitados, precio });
  const tiers = filasTiers.filter((f) => !esDeDiciembre(f)).map(soloRango);
  const tiersDiciembre = filasTiers.filter(esDeDiciembre).map(soloRango);

  const promociones = (promoRes.data ?? []) as PromocionDia[];
  const promoAplicable = promoAplicableDelDia(
    promociones,
    diaSemana,
    input.invitados,
    { esDiciembre },
  );

  // El precio base del alquiler: misma cascada y mismos datos que la
  // ficha, pero salidos de la base.
  const tierBase = calcularBaseLugar({
    modalidad: (rancho.modalidad_precio_lugar ??
      "rango_personas") as ModalidadPrecio,
    esDiciembre,
    porPersona: parsearPrecioPorPersona(rancho.precio_por_persona),
    diaSemana,
    invitados: input.invitados || null,
    rangos: tiers,
    rangosDiciembre: tiersDiciembre,
    tarifaDiciembrePorPersona:
      (rancho.tarifa_diciembre_por_persona as number | null) ?? 0,
    horas: input.horas || null,
    precioHora: (rancho.precio_hora_lugar as number | null) ?? null,
    precioHoraDiciembre: (rancho.precio_hora_diciembre as number | null) ?? null,
    precioFijo: (rancho.precio_fijo_lugar as number | null) ?? null,
    precioFijoDiciembre: (rancho.precio_fijo_diciembre as number | null) ?? null,
    promoPrecioFijo:
      promoAplicable?.tipo === "precio_fijo" ? promoAplicable.precio_fijo : null,
  });

  if (tierBase === null) {
    // La ficha muestra "consultar" y no deja enviar en este caso; el
    // servidor tampoco puede inventar un número, así que rechaza en vez
    // de guardar un ₡0.
    return {
      montos: null,
      error:
        "No se pudo calcular el precio de esta reserva. Revisá la fecha, la cantidad de invitados u horas, o consultá con el negocio.",
    };
  }

  // Servicios adicionales: solo los que el cliente marcó Y que siguen
  // activos en la base, con la MISMA regla de elegibilidad por invitados
  // que la ficha. El precio de cada uno sale de la base, no del cliente.
  const seleccionados = new Set(input.servicios_ids ?? []);
  const servicios = (svcRes.data ?? []) as ServicioAdicional[];
  const addonsTotal = servicios.reduce((acc, s) => {
    if (!seleccionados.has(s.id)) return acc;
    const elegible =
      !s.requisito_max_invitados || input.invitados <= s.requisito_max_invitados;
    return acc + (elegible ? s.precio : 0);
  }, 0);

  const cotizacionTotal = tierBase + addonsTotal;

  // Promo automática por día: si es de tipo precio_fijo, su efecto ya
  // quedó dentro de tierBase, así que acá no se resta de nuevo.
  const descuentoPromoMonto =
    !promoAplicable || promoAplicable.tipo === "precio_fijo"
      ? 0
      : Math.round(
          cotizacionTotal * ((promoAplicable.porcentaje_descuento ?? 0) / 100),
        );
  const totalConPromo = cotizacionTotal - descuentoPromoMonto;

  // Código de descuento: se VALIDA contra la base con verificar (que no
  // gasta un uso — el canje se hace después, recién si la reserva se
  // guarda). Nunca se confía en el descuento_monto que mandó el cliente.
  let descuentoCodigoMonto = 0;
  let codigoValidado: string | null = null;
  const codigoCrudo = input.codigo_descuento?.trim();
  if (codigoCrudo) {
    const { data: filas } = await supabase.rpc("verificar_codigo_descuento", {
      p_rancho_id: ranchoId,
      p_codigo: codigoCrudo,
    });
    const fila = (filas as { tipo: string; valor: number }[] | null)?.[0];
    if (fila) {
      codigoValidado = codigoCrudo.toUpperCase();
      descuentoCodigoMonto =
        fila.tipo === "porcentaje"
          ? Math.round(totalConPromo * (fila.valor / 100))
          : Math.min(fila.valor, totalConPromo);
    }
  }

  const montoTotal = Math.max(0, totalConPromo - descuentoCodigoMonto);
  const descuentoMonto = descuentoPromoMonto + descuentoCodigoMonto;
  const depositoMonto = (rancho.deposito_reserva as number | null) ?? 25000;

  return {
    montos: { montoTotal, depositoMonto, descuentoMonto, codigoValidado },
    error: null,
  };
}

export async function completarReservaTemporal(
  id: string,
  input: CompletarReservaInput,
) {
  if (!CEDULA_REGEX.test(input.cedula.trim())) {
    return { error: "El número de cédula no es válido." };
  }
  if (!CORREO_REGEX.test(input.correo.trim())) {
    return { error: "El correo electrónico no es válido." };
  }
  if (!WHATSAPP_REGEX.test(input.whatsapp.trim())) {
    return { error: "El número de WhatsApp no es válido." };
  }
  if (!input.aviso_prohibiciones_aceptado) {
    return { error: "Tenés que confirmar el aviso sobre el tipo de evento." };
  }

  const supabase = await createClient();

  // Necesitamos la FECHA del hold (además del rancho) para recalcular el
  // precio: diciembre y el día de la semana salen de ahí, jamás del
  // cliente. Si el hold ya no existe (se venció o se completó), se corta
  // acá con el mismo aviso que daría la RPC.
  const { data: hold } = await supabase
    .from("reservas")
    .select("rancho_id, fecha")
    .eq("id", id)
    .maybeSingle();
  if (!hold?.rancho_id || !hold?.fecha) {
    return {
      error:
        "Esta reserva ya no está disponible (se venció el tiempo o ya se completó). Elegí la fecha de nuevo.",
    };
  }

  // El dinero se rehace en el servidor con los precios de la base: lo que
  // el cliente haya mandado en monto_total/deposito_monto/descuento_monto
  // se IGNORA a propósito. La capacidad también se revalida acá adentro.
  const { montos, error: errorMontos } = await recalcularMontosReserva(
    supabase,
    hold.rancho_id as string,
    hold.fecha as string,
    input,
  );
  if (errorMontos || !montos) {
    return {
      error: errorMontos ?? "No se pudo calcular el precio de la reserva.",
    };
  }

  // El método de pago se valida server-side: el tipo lo garantiza en la
  // web, pero quien le escriba directo a la acción podría mandar
  // cualquier cosa.
  if (input.metodo_pago !== "sinpe" && input.metodo_pago !== "transferencia") {
    return { error: "Elegí un método de pago válido." };
  }

  // No se bloquea la fecha sin comprobante del depósito. Antes esta
  // exigencia vivía SOLO en el navegador (el botón gris hasta subir la
  // foto), así que una llamada directa podía pasar el hold a 'pendiente'
  // —y ocupar el día— sin depositar nada ni adjuntar prueba. Si el
  // negocio pide depósito (deposito_reserva > 0, el caso por defecto), el
  // comprobante es obligatorio.
  if (montos.depositoMonto > 0 && !input.deposito_comprobante_url?.trim()) {
    return {
      error:
        "Para dejar la fecha reservada tenés que subir el comprobante del depósito.",
    };
  }

  // Aceptar los términos también se exige acá, no solo en el botón del
  // formulario.
  if (!input.terminos_aceptados) {
    return {
      error: "Tenés que aceptar los términos y condiciones para reservar.",
    };
  }

  // Este paso pasa por una función security definer en vez de un
  // update directo: un visitante anónimo completando su propia
  // reserva es justo el caso donde la política de RLS es más
  // delicada de mantener bien en todos los proyectos, y es el mismo
  // patrón que ya usan liberar_hold_temporal y redimir_codigo_descuento
  // para esta misma fricción. La función solo escribe si la fila
  // sigue en 'temporal', así que no sirve para tocar una reserva ya
  // confirmada o rechazada.
  const { data: ranchoId, error } = await supabase.rpc(
    "completar_reserva_temporal",
    {
      p_id: id,
      p_nombre: input.nombre,
      p_correo: input.correo,
      p_whatsapp: input.whatsapp,
      p_cedula: input.cedula,
      p_tipo_evento: input.tipo_evento,
      p_invitados: input.invitados,
      p_horario_bloque: input.horario_bloque,
      // Los tres montos salen del recálculo del servidor, NO del cliente.
      p_monto_total: montos.montoTotal,
      p_deposito_monto: montos.depositoMonto,
      p_metodo_pago: input.metodo_pago,
      p_deposito_comprobante_url: input.deposito_comprobante_url,
      p_terminos_aceptados: input.terminos_aceptados,
      p_aviso_prohibiciones_aceptado: input.aviso_prohibiciones_aceptado,
      p_notas: input.notas,
      // Solo se guarda el código si validó de verdad (nunca el crudo).
      p_codigo_descuento: montos.codigoValidado,
      p_descuento_monto: montos.descuentoMonto,
    },
  );

  if (error) return { error: error.message };
  if (!ranchoId) {
    return {
      error:
        "Esta reserva ya no está disponible (se venció el tiempo o ya se completó). Elegí la fecha de nuevo.",
    };
  }

  // Recién ahora se GASTA un uso del código (la reserva ya quedó
  // guardada): así un canje no se pierde si el hold se había vencido, y
  // solo se canjea el código que ya validamos server-side —el mismo con
  // el que se calculó el descuento—, nunca el crudo que mandó el cliente.
  if (montos.codigoValidado) {
    await supabase.rpc("redimir_codigo_descuento", {
      p_rancho_id: ranchoId,
      p_codigo: montos.codigoValidado,
    });
  }

  // Quien reserva sin sesión iniciada queda con cuenta creada en
  // silencio (sin contraseña, como el resto del sitio): si después
  // quiere entrar, le mandamos el código de acceso a este mismo correo
  // y ya ve esta reserva en "Mis reservas".
  const correoLimpio = input.correo.trim().toLowerCase();
  const { data: yaTieneCuenta } = await supabase.rpc("existe_cuenta", {
    p_email: correoLimpio,
  });
  if (!yaTieneCuenta) {
    const admin = createAdminClient();
    if (admin) {
      const { data: cuentaCreada, error: errorCuenta } = await admin.auth.admin.createUser({
        email: correoLimpio,
        email_confirm: true,
        user_metadata: { nombre: input.nombre, rol: "cliente" },
      });
      if (!errorCuenta && cuentaCreada.user) {
        // Con el cliente admin a propósito: el visitante es anónimo y
        // la RLS de reservas (solo dueño/admin editan) haría que este
        // update afecte 0 filas sin error — la cuenta quedaría creada
        // pero jamás vinculada a su reserva.
        await admin
          .from("reservas")
          .update({ cliente_id: cuentaCreada.user.id })
          .eq("id", id);
      }
    }
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/mi-negocio", "layout");

  // Los dos correos (confirmación al cliente + aviso al dueño) salen
  // del mismo helper que usa la app móvil, para no tener la lógica de
  // "a quién se le avisa" duplicada en dos lados. Los montos y los
  // invitados que van en el correo los lee de la reserva ya guardada.
  // Nunca lanza: el correo es un plus, no un requisito — si Resend
  // falla o todavía no está configurado, la reserva ya quedó guardada.
  await notificarReservaCompletada(id);

  return { error: null };
}
