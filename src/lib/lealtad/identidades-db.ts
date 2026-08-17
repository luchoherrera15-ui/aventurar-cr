import type { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverIdentidad,
  type IdentidadCliente,
} from "@/lib/lealtad/identidad-miembro";

/**
 * LAS TRES CONSULTAS QUE CONTESTAN «¿QUIÉN ES ESTE MIEMBRO?».
 *
 * La decisión de precedencia vive en `identidad-miembro.ts` y es pura;
 * acá está solo el ir a buscarla. Están separadas a propósito: lo que
 * hay que poder probar sin base es el ORDEN, no el `select`.
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE ──────────────────────────────────────
 * La misma resolución estaba escrita DOS veces en el panel
 * (`datos-lealtad.ts` y `lealtad-secciones.tsx`), con el mismo bug en
 * las dos: preguntarle a `perfiles` por `cliente_id`. Arreglar una y no
 * la otra habría dejado la sección Clientes con nombres y la Actividad
 * con «Cliente», que es peor que el bug parejo. Una copia, un arreglo.
 *
 * ── CORRE CON LA LLAVE DE SERVICIO ───────────────────────────────────
 * Igual que el resto del módulo (0060): el dueño ve a su gente a través
 * de estas pantallas. Y ojo con `personas`: su RLS es por VÍNCULO
 * (`personas_negocio`, 0138:474), y hay membresías cuyo vínculo nunca se
 * creó —las del camino roto que documenta `personas.ts`—; con la llave
 * del negocio esas fichas volverían a desaparecer.
 *
 * ── `notas` NO SE PIDE ───────────────────────────────────────────────
 * `clientes_negocio` tiene `notas`, y la 0138 avisa que en un
 * consultorio pueden ser datos de salud. No está en el `select`: lo que
 * no se trae no se puede filtrar por error a una pantalla.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Lo mínimo que hay que saber de un miembro para poder identificarlo. */
export type MiembroIdentificable = {
  id: string;
  cliente_id?: string | null;
  persona_id?: string | null;
};

type FilaContacto = {
  nombre?: string | null;
  correo?: string | null;
  telefono?: string | null;
};

/**
 * `miembros` con lo que hace falta para resolver identidad.
 *
 * El `select` se intenta CON `persona_id` y, si la base todavía no tiene
 * la 0138, se reintenta sin él: nombrar una columna que no existe hace
 * fallar la consulta entera y dejaría la sección Clientes vacía en vez
 * de degradada. Es el mismo criterio de `buscarMiembroDelPase`.
 */
export async function miembrosConIdentidad(
  db: Admin,
  filtro: { programaId?: string; programaIds?: string[]; ids?: string[] },
): Promise<{ id: string; cliente_id: string | null; persona_id: string | null; estado: string; created_at: string }[]> {
  const aplicar = (columnas: string) => {
    const q = db.from("miembros").select(columnas);
    if (filtro.ids) return q.in("id", filtro.ids);
    return filtro.programaIds
      ? q.in("programa_id", filtro.programaIds)
      : q.eq("programa_id", filtro.programaId ?? "");
  };

  const conPersona = await aplicar("id, cliente_id, persona_id, estado, created_at");
  const datos = conPersona.error
    ? (await aplicar("id, cliente_id, estado, created_at")).data
    : conPersona.data;

  return ((datos ?? []) as unknown as {
    id: string;
    cliente_id: string | null;
    persona_id?: string | null;
    estado: string;
    created_at: string;
  }[]).map((m) => ({ ...m, persona_id: m.persona_id ?? null }));
}

/**
 * miembroId → quién es, con las tres fuentes ya cruzadas.
 *
 * `ranchoId` es opcional porque la ficha de CRM lo es: sin negocio
 * resuelto (o sin la 0109 pegada) se contesta igual con `personas` y
 * `perfiles`, que es lo que la plataforma sí garantiza.
 */
export async function identidadesDeMiembros(
  db: Admin,
  miembros: MiembroIdentificable[],
  ranchoId?: string | null,
): Promise<Map<string, IdentidadCliente>> {
  const personaIds = [
    ...new Set(miembros.map((m) => m.persona_id).filter((v): v is string => !!v)),
  ];
  const clienteIds = [
    ...new Set(miembros.map((m) => m.cliente_id).filter((v): v is string => !!v)),
  ];

  const [personas, fichas, perfiles] = await Promise.all([
    personaIds.length
      ? db.from("personas").select("id, nombre, correo, telefono").in("id", personaIds)
      : Promise.resolve({ data: [], error: null }),
    // `notas` jamás. Ver la cabecera.
    personaIds.length && ranchoId
      ? db
          .from("clientes_negocio")
          .select("persona_id, nombre, correo, telefono")
          .eq("rancho_id", ranchoId)
          .in("persona_id", personaIds)
      : Promise.resolve({ data: [], error: null }),
    clienteIds.length
      ? db.from("perfiles").select("id, nombre").in("id", clienteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const porPersona = new Map<string, FilaContacto>(
    ((personas.data ?? []) as ({ id: string } & FilaContacto)[]).map((p) => [p.id, p]),
  );
  const porFicha = new Map<string, FilaContacto>(
    ((fichas.data ?? []) as ({ persona_id: string | null } & FilaContacto)[])
      .filter((f): f is { persona_id: string } & FilaContacto => !!f.persona_id)
      .map((f) => [f.persona_id, f]),
  );
  const porPerfil = new Map<string, FilaContacto>(
    ((perfiles.data ?? []) as ({ id: string } & FilaContacto)[]).map((p) => [p.id, p]),
  );

  return new Map(
    miembros.map((m) => [
      m.id,
      resolverIdentidad({
        persona: m.persona_id ? (porPersona.get(m.persona_id) ?? null) : null,
        ficha: m.persona_id ? (porFicha.get(m.persona_id) ?? null) : null,
        perfil: m.cliente_id ? (porPerfil.get(m.cliente_id) ?? null) : null,
      }),
    ]),
  );
}
