"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";

/**
 * GEO-PUSH — las ubicaciones del negocio para el pase de Apple (0196).
 *
 * El dueño registra puntos (lat/lng + mensaje) y el pase los lleva en
 * `locations`: el iPhone muestra el mensaje en la pantalla bloqueada
 * cuando el cliente pasa cerca (radio ~100 m — lo fija iOS, no
 * nosotros). Google Wallet no tiene un equivalente igual y no se
 * inventa: la pantalla lo dice tal cual.
 *
 * Gestión propia del negocio (esDueno/esAdmin) y no del checklist de
 * colaboradores: dónde queda el negocio y qué promete al pasar cerca
 * es identidad de la marca, no tarea de mostrador — mismo criterio que
 * `puedeDisenar` en page.tsx y que marketing-actions.ts.
 *
 * DOS TOPES, y los dos se exigen acá (además del trigger de la 0196):
 *   · el del PAQUETE (`LimitesPlan.ubicaciones`: 1/1/3/10);
 *   · el de APPLE: 10 por pase, techo duro venga el paquete que venga.
 *
 * CÓMO LLEGA EL CAMBIO A LOS PASES YA INSTALADOS: por el mismo camino
 * que una edición de la tarjeta (0150). `avisarCambioDeDiseno` marca
 * los pases del programa y `entregarApple` escribe
 * `pases_wallet.actualizado_en` ANTES del push — que es exactamente lo
 * que `passesUpdatedSince` compara — así que el iPhone vuelve a pedir
 * el pase y `generarPaseDeLealtad` ya lo arma con las `locations`
 * nuevas. No se toca ese mecanismo: solo se lo llama.
 */

/** El techo de Apple: un .pkpass acepta 10 ubicaciones como máximo. */
const TOPE_APPLE = 10;
/** Mismos topes que los CHECK de la 0196 — el mensaje es el
 *  `relevantText` de la pantalla bloqueada (120, como el promocional). */
const TOPE_NOMBRE = 80;
const TOPE_MENSAJE = 120;

export type UbicacionFila = {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  mensaje: string;
};

export type DatosUbicacion = {
  nombre: string;
  latitud: number;
  longitud: number;
  mensaje: string;
};

type Resultado<T> = { ok: true; datos: T } | { ok: false; motivo: string };

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** El mismo guard que marketing-actions.ts: dueño del negocio o Bookea. */
async function accesoDeNegocio(ranchoId: string) {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) return { ok: false as const, motivo: "Iniciá sesión de nuevo." };
  if (!acceso.esDueno && !acceso.esAdmin) {
    return { ok: false as const, motivo: "Esto lo maneja el dueño del negocio." };
  }
  return { ok: true as const, motivo: "" };
}

/** El plan efectivo, mismo patrón que `planDelNegocio` en marketing-actions.ts. */
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
 * ¿La base está diciendo que la TABLA no existe? (La 0196 se aplica
 * aparte.) Mismo criterio que `faltaLaTabla` en errores-base.ts, con
 * el nombre de ESTA tabla para no confundir un «no existe» ajeno.
 */
function faltaLaTablaUbicaciones(mensaje: string): boolean {
  if (!mensaje.includes("lealtad_ubicaciones")) return false;
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

const AVISO_SIN_TABLA =
  "Las ubicaciones todavía no están disponibles en tu panel — el equipo de Bookea las está habilitando.";

/** La lista, en el orden en que se registraron (el mismo que lleva el pase). */
async function listarDe(db: Admin, ranchoId: string): Promise<Resultado<UbicacionFila[]>> {
  const { data, error } = await db
    .from("lealtad_ubicaciones")
    .select("id, nombre, latitud, longitud, mensaje")
    .eq("rancho_id", ranchoId)
    .order("created_at", { ascending: true });
  if (error) {
    if (faltaLaTablaUbicaciones(error.message)) return { ok: false, motivo: AVISO_SIN_TABLA };
    return { ok: false, motivo: "No se pudo leer la lista: " + error.message };
  }
  const filas = ((data ?? []) as Record<string, unknown>[]).map(
    (u): UbicacionFila => ({
      id: String(u.id),
      nombre: typeof u.nombre === "string" ? u.nombre : "",
      latitud: Number(u.latitud),
      longitud: Number(u.longitud),
      mensaje: typeof u.mensaje === "string" ? u.mensaje : "",
    }),
  );
  return { ok: true, datos: filas };
}

/**
 * Qué está mal en lo que llegó del navegador, o null si nada.
 * Los rangos son los mismos CHECK de la 0196: validar acá es para que
 * el mensaje sea claro, no para reemplazar a la base.
 */
function motivoInvalido(datos: DatosUbicacion): string | null {
  if (!datos.nombre.trim()) return "Ponele un nombre a la ubicación (ej. «Local de Escazú»).";
  if (datos.nombre.trim().length > TOPE_NOMBRE) {
    return `El nombre no puede pasar de ${TOPE_NOMBRE} caracteres.`;
  }
  if (!Number.isFinite(datos.latitud) || datos.latitud < -90 || datos.latitud > 90) {
    return "La latitud tiene que ser un número entre -90 y 90 (ej. 9.9333).";
  }
  if (!Number.isFinite(datos.longitud) || datos.longitud < -180 || datos.longitud > 180) {
    return "La longitud tiene que ser un número entre -180 y 180 (ej. -84.0833).";
  }
  if (!datos.mensaje.trim()) return "Escribí el mensaje que va a ver tu cliente al pasar cerca.";
  if (datos.mensaje.trim().length > TOPE_MENSAJE) {
    return `El mensaje no puede pasar de ${TOPE_MENSAJE} caracteres.`;
  }
  return null;
}

/**
 * Avisa a los pases YA instalados del negocio que hay que refrescarse,
 * por el mismo camino que una edición de la tarjeta (ver la cabecera).
 * Va por `after()` como en pases-actions.ts: el dueño está esperando
 * «Guardado», y esto es una llamada de red por pase. Por NEGOCIO y no
 * por programa porque las ubicaciones son del rancho: se avisa a cada
 * tarjeta que tenga pases afuera.
 */
function avisarPasesDelNegocio(ranchoId: string): void {
  after(async () => {
    const db = createAdminClient();
    if (!db) return;
    const { data } = await db.from("programa_lealtad").select("id").eq("rancho_id", ranchoId);
    for (const fila of (data ?? []) as { id: string }[]) {
      await avisarCambioDeDiseno(fila.id);
    }
  });
}

/** La lista para pintar la sección. */
export async function listarUbicaciones(ranchoId: string): Promise<Resultado<UbicacionFila[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  return listarDe(db, ranchoId);
}

/**
 * Alta de una ubicación. Exige dueño, valida los datos, y hace cumplir
 * los DOS topes (paquete y Apple) ANTES de insertar — la 0196 los
 * vuelve a remachar en la base, pero el mensaje claro sale de acá.
 */
export async function agregarUbicacion(
  ranchoId: string,
  datos: DatosUbicacion,
): Promise<Resultado<UbicacionFila[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const invalido = motivoInvalido(datos);
  if (invalido) return { ok: false, motivo: invalido };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const actuales = await listarDe(db, ranchoId);
  if (!actuales.ok) return actuales;

  // ── Los dos topes ─────────────────────────────────────────────────
  // El del paquete sale del catálogo (planes.ts). Sin plan conocido no
  // hay tope declarado —la doctrina de `estadoDelLimite`— y manda solo
  // el techo de Apple. `Math.min` porque ningún paquete puede prometer
  // más de lo que un .pkpass acepta.
  const plan = await planDelNegocio(db, ranchoId);
  const def = definicionDe(plan);
  const topePlan = def?.limites.ubicaciones ?? null;
  const tope = Math.min(topePlan ?? TOPE_APPLE, TOPE_APPLE);

  if (actuales.datos.length >= tope) {
    if (tope >= TOPE_APPLE) {
      return {
        ok: false,
        motivo:
          "Apple Wallet acepta 10 ubicaciones por pase como máximo — eliminá una para agregar otra.",
      };
    }
    return {
      ok: false,
      motivo:
        `Tu paquete${def ? ` (${def.nombre})` : ""} incluye ${tope} ` +
        `${tope === 1 ? "ubicación" : "ubicaciones"} con Geo-Push. ` +
        "Para registrar más, subí de paquete desde «Plan y facturación».",
    };
  }

  const { error } = await db.from("lealtad_ubicaciones").insert({
    rancho_id: ranchoId,
    nombre: datos.nombre.trim(),
    latitud: datos.latitud,
    longitud: datos.longitud,
    mensaje: datos.mensaje.trim(),
  });
  if (error) {
    if (faltaLaTablaUbicaciones(error.message)) return { ok: false, motivo: AVISO_SIN_TABLA };
    return { ok: false, motivo: "No se pudo guardar la ubicación: " + error.message };
  }

  avisarPasesDelNegocio(ranchoId);
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return listarDe(db, ranchoId);
}

/**
 * Baja de una ubicación. `ubicacionId` llega del navegador: antes de
 * borrar se comprueba que sea de ESTE negocio — sin eso, un id ajeno
 * borraría la ubicación de otro (mismo patrón que enviarAvisoDePrueba).
 */
export async function eliminarUbicacion(
  ranchoId: string,
  ubicacionId: string,
): Promise<Resultado<UbicacionFila[]>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: fila, error: errorFila } = await db
    .from("lealtad_ubicaciones")
    .select("rancho_id")
    .eq("id", ubicacionId)
    .maybeSingle();
  if (errorFila && faltaLaTablaUbicaciones(errorFila.message)) {
    return { ok: false, motivo: AVISO_SIN_TABLA };
  }
  if (!fila || fila.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa ubicación no es de este negocio." };
  }

  const { error } = await db.from("lealtad_ubicaciones").delete().eq("id", ubicacionId);
  if (error) return { ok: false, motivo: "No se pudo eliminar: " + error.message };

  avisarPasesDelNegocio(ranchoId);
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return listarDe(db, ranchoId);
}
