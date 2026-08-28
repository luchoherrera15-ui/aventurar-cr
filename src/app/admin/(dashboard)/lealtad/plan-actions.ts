"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esPlan, esPlanSinCosto } from "@/lib/lealtad/planes";
import { esConceptoPlan, motivoObligatorio, MOTIVO_MAX } from "@/lib/lealtad/regalias";
import { finDePrueba } from "@/lib/lealtad/prueba";
import { crearNegocioDesdeSolicitud } from "@/lib/lealtad/alta-desde-solicitud";
import { abrirHiloDeAyudaDesdeAlta } from "@/lib/lealtad/ayuda-hilo";
import { aplicarPlanDeLealtad, planGuardadoDe } from "@/lib/lealtad/aplicar-plan";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Deja la fila de bitácora del movimiento (0173).
 *
 * Devuelve un AVISO en vez de un error cuando la tabla todavía no
 * existe: el plan ya se cambió y no se puede deshacer por una migración
 * pendiente, pero tampoco se puede callar que ese cambio quedó sin
 * rastro. La pantalla lo muestra.
 */
async function registrarMovimiento(
  admin: Admin,
  fila: {
    ranchoId: string;
    cuentaId: string | null;
    planAntes: string | null;
    planDespues: string | null;
    concepto: string;
    motivo: string | null;
    cortesiaHasta: string | null;
    autorId: string | null;
  },
): Promise<{ aviso?: string }> {
  const { error } = await admin.from("historial_plan_lealtad").insert({
    rancho_id: fila.ranchoId,
    cuenta_id: fila.cuentaId,
    plan_antes: fila.planAntes,
    plan_despues: fila.planDespues,
    concepto: fila.concepto,
    motivo: fila.motivo,
    cortesia_hasta: fila.cortesiaHasta,
    autor_id: fila.autorId,
  });

  if (!error) return {};

  return {
    aviso:
      "El plan quedó guardado, pero NO se pudo dejar el registro de quién lo cambió: " +
      error.message +
      ". Si dice que la tabla no existe, falta correr 0173_regalias_y_rastro_del_plan.sql.",
  };
}

/**
 * Asignar el plan de la plataforma de lealtad a un negocio (0124/0134).
 *
 * Va con la llave de servicio y sesión de admin por la misma razón que
 * los complementos: el plan define qué puede hacer el negocio y cuántos
 * miembros le caben. Si el dueño pudiera escribirlo se subiría solo de
 * plan, que es exactamente lo que `addons_negocio` evita desde la 0077.
 *
 * `ranchos` SÍ tiene política de escritura para su dueño —edita su
 * publicación— así que acá no alcanza con la RLS: la puerta la cierra
 * el `requireAdmin` de abajo.
 *
 * ------------------------------------------------------------------
 * EL `concepto` ES OBLIGATORIO, Y NO ES BUROCRACIA
 * ------------------------------------------------------------------
 * Es lo único que separa la plata del regalo. Sin él, la fila que queda
 * en la base no dice si a este negocio se le VENDIÓ «Impulso» o si se
 * le REGALÓ, y cualquier auditoría de ingresos tendría que suponer que
 * todo lo que tiene plan asignado pagó por él — o sea, contar como
 * facturado lo que se dio gratis. Por eso se pide acá, en el servidor,
 * y no se deduce de nada.
 */
export async function asignarPlanLealtad({
  ranchoId,
  plan,
  concepto,
  motivo,
  cortesiaHasta,
}: {
  ranchoId: string;
  /** null = quitarle el plan. OJO: quitarlo NO lo apaga, lo deja sin topes. */
  plan: string | null;
  /** 'venta' | 'cortesia' | 'correccion' | 'baja' (0173). */
  concepto: string;
  /** Por qué. Obligatorio cuando es una regalía. */
  motivo?: string | null;
  /** ISO. Solo para regalías: hasta cuándo. null/ausente = indefinida. */
  cortesiaHasta?: string | null;
}): Promise<{ error?: string; aviso?: string }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  // ACÁ SÍ VA `esPlan` (todos, retirados incluidos) Y NO `esPlanOfrecido`.
  //
  // Las puertas del cliente —/lealtad/nuevo y /lealtad/planes— validan
  // contra los OFRECIDOS: nadie puede ELEGIRSE un paquete retirado y
  // llevarse un plan sin topes. Esta es otra cosa: es la mesa de
  // control de Bookea, detrás de `requireAdmin`, y es el único lugar
  // donde se puede corregir a mano la fila de un negocio que YA tiene
  // un paquete retirado — si acá solo entraran los vigentes, arreglar
  // un dato de esas cuentas obligaría a degradarlas, que es justo lo
  // que la separación ofrecidos/retirados existe para impedir.
  //
  // Hoy el catálogo no arrastra ningún retirado (se borraron los ocho
  // en la 0179, después de comprobar que la base no tenía una sola fila
  // con ellos), así que las dos listas coinciden y esta distinción no
  // cambia nada EN LA PRÁCTICA. Se queda escrita porque el día que se
  // retire un paquete vuelve a ser la diferencia entre poder corregir
  // una fila y tener que degradar al negocio para tocarla.
  //
  // La validación es CONTRA EL CATÁLOGO y en el servidor: el navegador
  // manda lo que quiera, y un valor fuera del CHECK de la base hace
  // fallar el update entero.
  if (plan !== null && !esPlan(plan)) return { error: "Ese plan no existe." };

  if (!esConceptoPlan(concepto)) {
    return { error: "Hay que decir si esto es una venta, una regalía, una corrección o una baja." };
  }

  const nota = (motivo ?? "").trim().slice(0, MOTIVO_MAX);
  if (motivoObligatorio(concepto) && !nota) {
    return {
      error:
        "Una regalía sin motivo no se puede guardar: escribí por qué se le da gratis. Dentro de tres meses nadie va a poder explicar esta fila.",
    };
  }

  // La fecha de la regalía se valida acá y no se cree lo que llegue: un
  // texto cualquiera en un `timestamptz` hace fallar el insert de la
  // bitácora DESPUÉS de haber cambiado el plan.
  let hasta: string | null = null;
  if (concepto === "cortesia" && cortesiaHasta) {
    const d = new Date(cortesiaHasta);
    if (Number.isNaN(d.getTime())) return { error: "Esa fecha de fin de la regalía no es válida." };
    hasta = d.toISOString();
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // El «antes», leído ANTES de escribir: es la mitad del registro.
  //
  // Y es el plan EFECTIVO, no `ranchos.plan_lealtad` a secas. Con la
  // lectura vieja, un negocio con cuenta —donde el paquete que manda
  // vive en `cuentas.plan`— dejaba filas de bitácora diciendo «antes:
  // sin plan» cuando venía operando con uno. Una bitácora que se
  // equivoca en el antes es peor que no tener bitácora: se lee como si
  // fuera un dato.
  const antes = await planGuardadoDe(admin, ranchoId);

  const aplicado = await aplicarPlanDeLealtad(admin, { ranchoId, cuentaId: antes.cuentaId, plan });
  if (!aplicado.ok) return { error: aplicado.motivo };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { aviso } = await registrarMovimiento(admin, {
    ranchoId,
    cuentaId: aplicado.cuentaId,
    planAntes: antes.plan,
    planDespues: plan,
    concepto,
    motivo: nota || null,
    cortesiaHasta: hasta,
    autorId: user?.id ?? null,
  });

  revalidatePath("/admin/complementos");
  // El panel de lealtad del negocio cambia con el plan.
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return aviso ? { aviso } : {};
}

/**
 * Aprobar un negocio nuevo para el mundo de lealtad (0129): hasta este
 * clic, el negocio está EN HOLD — sin panel y sin poder solicitar plan.
 * Va con la llave de servicio porque el trigger
 * `ranchos_proteger_aprobacion_lealtad` rechaza a cualquier sesión que
 * no sea admin; el `requireAdmin` de acá pone el mensaje decente antes.
 */
export async function aprobarNegocioLealtad({
  ranchoId,
}: {
  ranchoId: string;
}): Promise<{ error?: string }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await admin
    .from("ranchos")
    .update({
      lealtad_aprobado_en: new Date().toISOString(),
      lealtad_aprobado_por: user?.id ?? null,
    })
    .eq("id", ranchoId);

  if (error) {
    if (error.message.includes("lealtad_aprobado")) {
      return { error: "Falta correr la migración 0129 en Supabase." };
    }
    return { error: "No se pudo aprobar: " + error.message };
  }

  revalidatePath("/admin/complementos");
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath("/lealtad/panel");
  return {};
}

/**
 * Atender una solicitud de plan (0126) con UN botón: aprobar asigna el
 * plan pedido, enciende el complemento `lealtad` y marca la solicitud —
 * las tres cosas que antes había que acordarse de hacer por separado.
 * Rechazar solo marca (y el negocio vuelve a poder solicitar).
 *
 * Queda QUIÉN la atendió y cuándo: la misma regla de la auditoría del
 * ledger — un registro sin autor es un rumor.
 */
export async function atenderSolicitudLealtad({
  solicitudId,
  aprobar,
}: {
  solicitudId: string;
  aprobar: boolean;
}): Promise<{ error?: string; ranchoId?: string }> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data: solicitud } = await admin
    .from("solicitudes_lealtad")
    .select("*")
    .eq("id", solicitudId)
    .maybeSingle();
  if (!solicitud) return { error: "Esa solicitud no existe." };
  if (solicitud.estado !== "pendiente") return { error: "Esa solicitud ya se atendió." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El rancho destino: el existente (upgrade) o, en un ALTA (0130),
  // el que se CREA acá mismo — aceptar ES crear; rechazar no crea nada.
  let ranchoId = solicitud.rancho_id as string | null;

  if (aprobar) {
    if (!ranchoId) {
      // El alta la arma `crearNegocioDesdeSolicitud`, que es la MISMA
      // función que usa el webhook de Stripe cuando el cobro con tarjeta
      // entra sin negocio (src/lib/pagos/puerta-supabase.ts). Dos
      // caminos que crean negocios se desincronizan; uno solo, no.
      const alta = await crearNegocioDesdeSolicitud(admin, solicitud, {
        aprobadoPor: user?.id ?? null,
        // El plan se escribe abajo, junto con el caso del upgrade.
        plan: null,
      });
      if (!alta.ok) return { error: alta.motivo };
      ranchoId = alta.ranchoId;
    }

    // Nunca debería pasar (el alta devuelve id o falla), pero sin este
    // guardia el resto trabajaría con un negocio en null y escribiría el
    // plan en ninguna parte, en silencio.
    if (!ranchoId) return { error: "La solicitud quedó sin negocio al que asignarle el plan." };

    // Por la MISMA puerta que el desplegable y que el webhook de Stripe
    // (`aplicarPlanDeLealtad`): raíz primero, espejo después. Escribir
    // solo el rancho dejaba a un negocio con cuenta —el que alguna vez
    // pagó con tarjeta— aprobado por SINPE y operando con el paquete
    // viejo, con el comprobante ya cobrado.
    const aplicado = await aplicarPlanDeLealtad(admin, {
      ranchoId,
      plan: solicitud.plan as string,
    });
    if (!aplicado.ok) return { error: aplicado.motivo };

    // La bitácora del cobro (0173). Solo si el paquete CUESTA: un alta
    // con el paquete sin costo no es una venta que auditar, y meterla
    // como «venta» en una tabla que lee una persona sería decir que
    // pagó algo que no pagó. De ese caso ya queda registro en la
    // solicitud misma (`atendida_por` / `atendida_en`).
    if (!esPlanSinCosto(solicitud.plan as string | null)) {
      const metodo = (solicitud.metodo_pago as string | null) ?? "depósito";
      await registrarMovimiento(admin, {
        ranchoId,
        cuentaId: aplicado.cuentaId,
        planAntes: null,
        planDespues: solicitud.plan as string,
        concepto: "venta",
        // ⚠️ NO se guarda el MONTO porque no existe: `solicitudes_lealtad`
        // registra el método y el comprobante, nunca cuánto entró.
        motivo: `Solicitud aprobada desde el panel — pago por ${metodo}`,
        cortesiaHasta: null,
        autorId: user?.id ?? null,
      });
    }

    // Si el complemento existía VENCIDO, `activo: true` solo no alcanza
    // — `estadoDeAddon` lo seguiría dando por muerto. Aprobar es empezar
    // de nuevo, con fecha fresca.
    //
    // Y el vencimiento sale del PAQUETE, no de un `null` fijo: aprobar
    // una solicitud de «Prueba» a mano le daba 14 días prometidos y cero
    // días de corte, o sea el mismo agujero que tenía el alta automática
    // pero por la puerta del admin. Un paquete de pago sigue dando
    // `null` — no vence por tiempo.
    const corte = finDePrueba(solicitud.plan as string | null);
    const { error: eAddon } = await admin.from("addons_negocio").upsert(
      {
        rancho_id: ranchoId,
        addon: "lealtad",
        activo: true,
        vence_en: corte,
        activado_en: new Date().toISOString(),
        notas: corte
          ? `Solicitud aprobada (plan ${solicitud.plan}) — prueba hasta ${corte.slice(0, 10)}`
          : `Solicitud aprobada (plan ${solicitud.plan})`,
      },
      { onConflict: "rancho_id,addon" },
    );
    if (eAddon) return { error: "El plan quedó, pero el complemento no: " + eAddon.message };

    // ── «CREAR PERSONALIZADO»: QUE LA CONVERSACIÓN SIGA (0149) ──────
    // Hasta acá, aprobar un alta personalizada creaba el negocio y
    // dejaba lo que la persona había escrito enterrado en esta fila,
    // ya marcada como atendida: el equipo no tenía dónde contestarle y
    // ella no tenía dónde leer la respuesta. Ahora ese texto se
    // convierte en el primer mensaje de su hilo de ayuda con el diseño,
    // que es el mismo bloque que ve cualquier otro dueño en el creador.
    //
    // No reemplaza el camino del alta —ese sigue igual— lo continúa.
    if (solicitud.personalizado === true && ranchoId) {
      const nombre =
        ((solicitud.negocio_nombre as string | null) ?? "").trim() ||
        ((await admin.from("ranchos").select("nombre").eq("id", ranchoId).maybeSingle()).data
          ?.nombre as string | null) ||
        "";
      await abrirHiloDeAyudaDesdeAlta(admin, {
        ranchoId,
        solicitanteId: solicitud.solicitante_id as string,
        negocioNombre: nombre,
        pedido: (solicitud.mensaje as string | null) ?? "",
      });
    }
  }

  const { error: eSol } = await admin
    .from("solicitudes_lealtad")
    .update({
      estado: aprobar ? "atendida" : "rechazada",
      // El alta aprobada queda apuntando al rancho que creó: el
      // registro cierra el círculo solicitud → negocio.
      ...(aprobar && !solicitud.rancho_id && ranchoId ? { rancho_id: ranchoId } : {}),
      atendida_por: user?.id ?? null,
      atendida_en: new Date().toISOString(),
    })
    .eq("id", solicitudId);
  if (eSol) return { error: "Quedó activado pero la solicitud no se marcó: " + eSol.message };

  revalidatePath("/admin/complementos");
  if (ranchoId) revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath("/lealtad/panel");
  return { ranchoId: ranchoId ?? undefined };
}
