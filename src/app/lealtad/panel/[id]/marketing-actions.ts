"use server";

import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { probarAvisoDePase, type DiagnosticoAviso } from "@/lib/wallet/servicio";
import { enviarMensajePromocional } from "@/lib/wallet/mensaje-promocional";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import {
  estadoCupoNotificaciones,
  inicioProximoMesEnCR,
  liberarCupoNotificacion,
  reservarCupoNotificacion,
} from "@/lib/lealtad/cupo-notificaciones";
import type { EstadoLimite } from "@/lib/lealtad/planes";

/**
 * MARKETING — la lista de pases con quién los tiene, y el botón para
 * probar el aviso de verdad.
 *
 * Nace del reporte del dueño: "la plataforma dice 4 sellos, el teléfono
 * muestra 2". El código de aviso (servicio.ts, apns.ts) ya se revisó a
 * mano contra ese mismo pase y es idéntico al que se probó por fuera —
 * lo que faltaba era una forma de disparar ese MISMO camino real desde
 * la plataforma y ver la respuesta de Apple/Google en el momento, sin
 * tener que escribir un script cada vez.
 *
 * Gestión propia del negocio (esDueno/esAdmin) y no del checklist de
 * colaboradores: mandarle un aviso a un cliente real es una acción del
 * negocio, no una tarea de mostrador — mismo criterio que `puedeDisenar`
 * en page.tsx.
 */

type Plataforma = "apple" | "google";

export type PaseMarketing = {
  plataforma: Plataforma;
  saldoCache: number;
  actualizadoEn: string | null;
  /**
   * SOLO tiene sentido para Apple: ¿el teléfono ya vino a buscar el
   * último cambio (0151)? `null` en Google, A PROPÓSITO — Google no
   * tiene ningún mecanismo que nos avise cuando un teléfono real mira
   * o descarga el pase. Un PATCH exitoso a la API de Google solo dice
   * "el objeto en los servidores de Google quedó al día"; no dice que
   * exista un teléfono que lo tenga instalado. Antes esto ponía
   * `true` siempre para Google, que era mentira: el panel decía
   * "confirmado" de un pase que puede no estar en ningún lado.
   */
  confirmadoEnTelefono: boolean | null;
};

export type FilaMarketing = {
  miembroId: string;
  nombre: string;
  pases: PaseMarketing[];
};

type Resultado<T> = { ok: true; datos: T } | { ok: false; motivo: string };

async function accesoDeNegocio(ranchoId: string) {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) return { ok: false as const, motivo: "Iniciá sesión de nuevo." };
  if (!acceso.esDueno && !acceso.esAdmin) {
    return { ok: false as const, motivo: "Esto lo maneja el dueño del negocio." };
  }
  return { ok: true as const, motivo: "" };
}

/** Los pases vigentes del programa, con quién los tiene y si el teléfono ya confirmó el último cambio. */
export async function listarPasesDelPrograma(
  ranchoId: string,
  programaId: string,
): Promise<Resultado<FilaMarketing[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // `programaId` llega del navegador: sin este chequeo, cualquier dueño
  // con lealtad podía pedir la lista de miembros de OTRO negocio con
  // solo adivinar/leer su programaId (programa_lealtad es legible por
  // `anon`) — mismo patrón que ya cubren enviarAvisoDePrueba y
  // enviarNotificacionPromocional acá abajo, que este endpoint se había
  // quedado sin él.
  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const { data: miembrosData, error } = await db
    .from("miembros")
    .select("id, cliente_id, persona_id")
    .eq("programa_id", programaId)
    .eq("estado", "activa");
  if (error) return { ok: false, motivo: "No se pudo leer la lista: " + error.message };

  const miembros = (miembrosData ?? []) as {
    id: string;
    cliente_id: string | null;
    persona_id: string | null;
  }[];
  if (miembros.length === 0) return { ok: true, datos: [] };

  const ids = miembros.map((m) => m.id);
  const clienteIds = miembros.map((m) => m.cliente_id).filter((v): v is string => v !== null);
  const personaIds = miembros.map((m) => m.persona_id).filter((v): v is string => v !== null);

  const [{ data: pasesData }, { data: perfilesData }, { data: personasData }] = await Promise.all([
    db
      .from("pases_wallet")
      .select("miembro_id, plataforma, saldo_cache, actualizado_en, ultima_descarga_en")
      .in("miembro_id", ids)
      .eq("activo", true),
    clienteIds.length > 0
      ? db.from("perfiles").select("id, nombre").in("id", clienteIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string | null }[] }),
    personaIds.length > 0
      ? db.from("personas").select("id, nombre").in("id", personaIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string | null }[] }),
  ]);

  const nombrePerfil = new Map(
    ((perfilesData ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Cliente de Bookea",
    ]),
  );
  const nombrePersona = new Map(
    ((personasData ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Cliente de Bookea",
    ]),
  );

  type PaseFila = {
    miembro_id: string;
    plataforma: Plataforma;
    saldo_cache: number;
    actualizado_en: string | null;
    ultima_descarga_en: string | null;
  };
  const pasesPorMiembro = new Map<string, PaseFila[]>();
  for (const p of (pasesData ?? []) as PaseFila[]) {
    const lista = pasesPorMiembro.get(p.miembro_id) ?? [];
    lista.push(p);
    pasesPorMiembro.set(p.miembro_id, lista);
  }

  const filas: FilaMarketing[] = miembros
    .map((m) => {
      const nombre =
        (m.cliente_id && nombrePerfil.get(m.cliente_id)) ||
        (m.persona_id && nombrePersona.get(m.persona_id)) ||
        "Cliente de Bookea";
      const pases = (pasesPorMiembro.get(m.id) ?? []).map(
        (p): PaseMarketing => ({
          plataforma: p.plataforma,
          saldoCache: p.saldo_cache,
          actualizadoEn: p.actualizado_en,
          confirmadoEnTelefono:
            p.plataforma === "google"
              ? null // sin mecanismo posible de confirmación — ver el comentario del tipo
              : p.actualizado_en !== null &&
                p.ultima_descarga_en !== null &&
                p.ultima_descarga_en >= p.actualizado_en,
        }),
      );
      return { miembroId: m.id, nombre, pases };
    })
    .filter((f) => f.pases.length > 0); // sin pase, no hay nada que avisar

  return { ok: true, datos: filas };
}

/**
 * Dispara el aviso real, y trae la respuesta tal cual.
 *
 * `miembroId` llega del navegador: antes de tocar nada se comprueba que
 * ese cliente es de ESTE negocio — sin eso, un id ajeno mandaría un
 * aviso al pase de un cliente de otro negocio.
 */
export async function enviarAvisoDePrueba(
  ranchoId: string,
  miembroId: string,
): Promise<Resultado<DiagnosticoAviso>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: miembro } = await db
    .from("miembros")
    .select("programa_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return { ok: false, motivo: "Ese cliente no existe." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", miembro.programa_id as string)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Ese cliente no es de este negocio." };
  }

  const diagnostico = await probarAvisoDePase(miembroId);
  return { ok: true, datos: diagnostico };
}

const TOPE_MENSAJE = 120;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * El plan efectivo de un negocio, mismo patrón que ya usan
 * `equipoLleno` (equipo-actions.ts) y el chequeo de tipo de
 * `crear-actions.ts`: se lee con la llave de servicio porque el
 * paquete es dato de producto y no de la fila de nadie —depender de la
 * sesión ataría el tope a que la RLS de `cuentas` (0134) esté corrida—,
 * y `contextoDeCuenta` hace ganar a la cuenta sobre el respaldo del
 * rancho (la transición de la 0134, en dos tiempos).
 */
async function planDelNegocio(db: Admin, ranchoId: string): Promise<string | null> {
  const { data: rancho } = await db
    .from("ranchos")
    .select("plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  const { data: cuenta } = await db
    .from("cuentas")
    .select("id")
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  const { plan } = await contextoDeCuenta(
    db,
    cuenta?.id ? { cuenta_id: cuenta.id as string } : {},
    { planRancho: (rancho?.plan_lealtad as string | null) ?? null },
  );
  return plan;
}

/**
 * Cuánto cupo de notificaciones le queda al negocio este mes, para que
 * `marketing-mensaje.tsx` lo pinte y deshabilite el botón antes de
 * intentar un envío que el servidor va a rechazar de todos modos.
 *
 * Mismo chequeo de tenencia que `enviarNotificacionPromocional`: sin
 * él, un `programaId` ajeno (adivinado o leído, `programa_lealtad` es
 * legible por `anon`) filtraría cuánto cupo le queda a OTRO negocio.
 */
export async function obtenerCupoNotificaciones(
  ranchoId: string,
  programaId: string,
): Promise<Resultado<EstadoLimite>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const plan = await planDelNegocio(db, ranchoId);
  const estado = await estadoCupoNotificaciones(db, ranchoId, plan);
  return { ok: true, datos: estado };
}

/**
 * "MIÉRCOLES MATCHAS 2X1" — el mensaje real, a todos los que tienen el
 * pase. Verifica tenencia del programa igual que las de arriba, y de
 * paso corta un mensaje absurdamente largo: el campo del reverso de
 * Apple tiene un ancho fijo, y un párrafo entero ahí se corta feo.
 *
 * DESDE LA 0183, el envío tiene un tope real por mes calendario y por
 * NEGOCIO (no por tarjeta — misma lección de `clientesActivos`, ver la
 * cabecera de `cupo-notificaciones.ts`): Prueba y Starter 1, Impulso
 * 20, Ilimitado 50. El cupo se RESERVA de forma atómica (RPC con
 * advisory lock, ver `reservarCupoNotificacion`) ANTES de llamar a
 * `enviarMensajePromocional` — contar y anotar en dos pasos separados
 * por el envío entero (segundos reales) dejaba pasar dos pedidos casi
 * simultáneos por la misma ventana. Si el envío falla, la reserva se
 * libera: un intento fallido (Apple/Google caídos) no le cobra cupo a
 * un mensaje que nunca llegó a ningún lado.
 */
export async function enviarNotificacionPromocional(
  ranchoId: string,
  programaId: string,
  mensaje: string,
): Promise<
  Resultado<{
    googleEnviados: number;
    googleFallidos: number;
    apple: { avisados: number; fallidos: number } | null;
  }>
> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const limpio = mensaje.trim().slice(0, TOPE_MENSAJE);
  if (limpio.length < 3) return { ok: false, motivo: "Escribí el mensaje que querés mandar." };

  const plan = await planDelNegocio(db, ranchoId);
  const reserva = await reservarCupoNotificacion(db, ranchoId, programaId, plan);
  if (!reserva.reservado) {
    // `reserva.limite` no puede ser null acá: `reservarCupoNotificacion`
    // solo devuelve `reservado: false` cuando SÍ hay un tope numérico
    // contra el que comparó.
    const limite = reserva.limite ?? 0;
    const proxima = inicioProximoMesEnCR().toLocaleDateString("es-CR", {
      day: "numeric",
      month: "long",
    });
    const notif = limite === 1 ? "tu 1 notificación" : `tus ${limite} notificaciones`;
    const verbo = limite === 1 ? "vuelve" : "vuelven";
    return {
      ok: false,
      motivo: `Ya usaste ${notif} de este mes — ${verbo} a abrirse el ${proxima}.`,
    };
  }

  const resultado = await enviarMensajePromocional(programaId, limpio);
  if (!resultado.ok) {
    // El envío no llegó a ningún lado: se libera la reserva para no
    // cobrarle cupo a un mensaje que nunca salió.
    await liberarCupoNotificacion(db, reserva.id);
    return { ok: false, motivo: resultado.motivo };
  }

  return {
    ok: true,
    datos: {
      googleEnviados: resultado.googleEnviados,
      googleFallidos: resultado.googleFallidos,
      apple: resultado.apple,
    },
  };
}

/** El tope del mensaje de hito (0205) — el mismo que exige el CHECK de la columna. */
const TOPE_MENSAJE_HITO = 120;

/** El mensaje de hito guardado hoy, o "" si nunca se configuró uno. */
export async function obtenerMensajeHito(
  ranchoId: string,
  programaId: string,
): Promise<Resultado<string>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id, mensaje_hito")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  return { ok: true, datos: (programa.mensaje_hito as string | null) ?? "" };
}

/**
 * Guarda el mensaje de hito (0205). Vacío = apagado: de ahí en
 * adelante los tres momentos (primer sello, penúltimo, meta) no
 * mandan ningún texto propio.
 */
export async function guardarMensajeHito(
  ranchoId: string,
  programaId: string,
  mensaje: string,
): Promise<Resultado<string>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const limpio = mensaje.trim();
  if (limpio.length > TOPE_MENSAJE_HITO) {
    return { ok: false, motivo: `El mensaje no puede pasar de ${TOPE_MENSAJE_HITO} caracteres.` };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const { error } = await db
    .from("programa_lealtad")
    .update({ mensaje_hito: limpio || null })
    .eq("id", programaId);
  if (error) return { ok: false, motivo: "No se pudo guardar: " + error.message };

  return { ok: true, datos: limpio };
}
