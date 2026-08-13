"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import type { PermisosLealtad } from "@/lib/lealtad/permisos";

/**
 * El equipo del programa: invitar, ajustar rol y checklist, quitar.
 *
 * TODA ESCRITURA va con la sesión del usuario, nunca con la llave de
 * servicio: la base ya sabe quién puede qué (invitar y quitar son del
 * dueño desde la 0116; ajustar rol, desde la 0127, con grant SOLO sobre
 * las columnas rol y permisos_lealtad). El guard de acá corta antes
 * para dar un mensaje decente, pero aunque no existiera, la RLS rechaza
 * igual.
 *
 * La única lectura con llave de servicio es la del PLAN, y es a
 * propósito: el paquete es dato de producto —vive en `cuentas.plan` /
 * `ranchos.plan_lealtad`, no en la fila de nadie— y leerlo con la
 * sesión dependería de que la RLS de `cuentas` (0134) esté corrida. Un
 * tope que se cae cuando falta una migración no es un tope.
 */

type Resultado = { ok: true; codigo?: string } | { ok: false; motivo: string };

async function guardDueno(ranchoId: string) {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.esDueno && !acceso.esAdmin) {
    return { acceso, error: "El equipo lo maneja el dueño del negocio." };
  }
  return { acceso, error: null };
}

/**
 * EL TOPE DE GENTE DEL EQUIPO, HECHO CUMPLIR (0142).
 *
 * `limites.administradores` estuvo declarado y sin exigir desde la
 * 0133: el paquete decía 1 / 3 / 10 y `invitarAlEquipo` invitaba sin
 * mirar nada. Ahora el reparto lo VENDE como escalón, así que tenía que
 * ser real — prometer un tope que no existe es justo lo que este módulo
 * se pasó una etapa limpiando.
 *
 * El tope INCLUYE AL DUEÑO: por eso se cuenta `colaboradores + 1`. La
 * Prueba va en 1, o sea el dueño solo, y esa es la lectura correcta de
 * «equipo: 1» en la grilla de paquetes.
 *
 * Devuelve el motivo si ya no entra nadie más, o null si hay lugar.
 * Nunca bloquea por no poder averiguar: sin llave de servicio o sin
 * plan conocido, deja pasar. Cerrarle el equipo a un negocio por un
 * problema nuestro de configuración sería peor que un colaborador de
 * más.
 */
async function equipoLleno(ranchoId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: rancho } = await admin
    .from("ranchos")
    .select("plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  const { data: cuenta } = await admin
    .from("cuentas")
    .select("id")
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  const { plan } = await contextoDeCuenta(
    admin,
    cuenta?.id ? { cuenta_id: cuenta.id as string } : {},
    { planRancho: (rancho?.plan_lealtad as string | null) ?? null },
  );

  const tope = definicionDe(plan)?.limites.administradores ?? null;
  if (tope === null) return null;

  const { count } = await admin
    .from("rancho_colaboradores")
    .select("*", { count: "exact", head: true })
    .eq("rancho_id", ranchoId);

  // +1 por el dueño, que no está en `rancho_colaboradores`.
  if ((count ?? 0) + 1 < tope) return null;

  return tope === 1
    ? "Tu paquete es para vos solo. Subí de paquete para sumar gente al mostrador."
    : `Tu paquete permite ${tope} personas en el equipo, contándote a vos. Quitá a alguien o subí de paquete.`;
}

const MENSAJES: Record<string, string> = {
  sin_cuenta: "Ese correo no tiene cuenta en Bookea — que se registre primero.",
  ya_es_dueno: "Ese correo es el dueño del negocio.",
  ya_estaba: "Esa persona ya es parte del equipo.",
  agregado: "Listo: ya es parte del equipo.",
};

export async function invitarAlEquipo(ranchoId: string, email: string): Promise<Resultado> {
  const { acceso, error } = await guardDueno(ranchoId);
  if (error) return { ok: false, motivo: error };

  const limpio = email.trim().toLowerCase();
  if (!limpio.includes("@")) return { ok: false, motivo: "Ese correo no parece un correo." };

  const lleno = await equipoLleno(ranchoId);
  if (lleno) return { ok: false, motivo: lleno };

  const { data, error: eRpc } = await acceso.supabase.rpc("agregar_colaborador", {
    p_rancho: ranchoId,
    p_email: limpio,
  });
  if (eRpc) return { ok: false, motivo: "No se pudo invitar: " + eRpc.message };

  const codigo = (data as { codigo: string }[] | null)?.[0]?.codigo ?? "agregado";
  if (codigo === "sin_cuenta" || codigo === "ya_es_dueno") {
    return { ok: false, motivo: MENSAJES[codigo] };
  }

  // La UI promete "entra como empleado", pero eso lo cumple la 0127.
  // Si todavía no corrió, el invitado entra con el alcance binario de
  // la 0116 (todo) — mejor decirlo que descubrirlo.
  const { error: eRol } = await acceso.supabase
    .from("rancho_colaboradores")
    .select("rol")
    .eq("rancho_id", ranchoId)
    .limit(1)
    .maybeSingle();

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  if (eRol) {
    return {
      ok: true,
      codigo:
        "Quedó en el equipo — pero falta la migración 0127, así que por ahora puede TODO (no solo lo del checklist).",
    };
  }
  return { ok: true, codigo: MENSAJES[codigo] ?? MENSAJES.agregado };
}

export async function actualizarRolDelEquipo(
  ranchoId: string,
  usuarioId: string,
  rol: "administrador" | "empleado",
  permisos: PermisosLealtad,
): Promise<Resultado> {
  const { acceso, error } = await guardDueno(ranchoId);
  if (error) return { ok: false, motivo: error };

  if (rol !== "administrador" && rol !== "empleado") {
    return { ok: false, motivo: "Ese rol no existe." };
  }

  // Solo llaves conocidas y solo booleanos: el jsonb que se guarda es
  // exactamente el checklist, venga lo que venga del navegador.
  const limpio = {
    acreditar: permisos.acreditar === true,
    canjear: permisos.canjear === true,
    revertir: permisos.revertir === true,
    auditoria: permisos.auditoria === true,
  };

  const { data, error: eUpd } = await acceso.supabase
    .from("rancho_colaboradores")
    .update({ rol, permisos_lealtad: limpio })
    .eq("rancho_id", ranchoId)
    .eq("usuario_id", usuarioId)
    .select("usuario_id")
    .maybeSingle();

  if (eUpd) {
    if (/rol|permisos_lealtad/.test(eUpd.message) && /column|schema/i.test(eUpd.message)) {
      return { ok: false, motivo: "Falta correr la migración 0127 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo guardar: " + eUpd.message };
  }
  if (!data) return { ok: false, motivo: "Esa persona ya no está en el equipo." };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}

export async function quitarDelEquipo(ranchoId: string, usuarioId: string): Promise<Resultado> {
  const { acceso, error } = await guardDueno(ranchoId);
  if (error) return { ok: false, motivo: error };

  const { error: eDel } = await acceso.supabase
    .from("rancho_colaboradores")
    .delete()
    .eq("rancho_id", ranchoId)
    .eq("usuario_id", usuarioId);

  if (eDel) return { ok: false, motivo: "No se pudo quitar: " + eDel.message };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}
