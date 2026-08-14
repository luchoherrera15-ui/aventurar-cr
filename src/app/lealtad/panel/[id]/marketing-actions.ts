"use server";

import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { probarAvisoDePase, type DiagnosticoAviso } from "@/lib/wallet/servicio";
import { enviarMensajePromocional } from "@/lib/wallet/mensaje-promocional";

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

/**
 * "MIÉRCOLES MATCHAS 2X1" — el mensaje real, a todos los que tienen el
 * pase. Verifica tenencia del programa igual que las de arriba, y de
 * paso corta un mensaje absurdamente largo: el campo del reverso de
 * Apple tiene un ancho fijo, y un párrafo entero ahí se corta feo.
 */
export async function enviarNotificacionPromocional(
  ranchoId: string,
  programaId: string,
  mensaje: string,
): Promise<Resultado<{ googleEnviados: number; googleFallidos: number }>> {
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

  const resultado = await enviarMensajePromocional(programaId, limpio);
  if (!resultado.ok) return { ok: false, motivo: resultado.motivo };
  return {
    ok: true,
    datos: { googleEnviados: resultado.googleEnviados, googleFallidos: resultado.googleFallidos },
  };
}
