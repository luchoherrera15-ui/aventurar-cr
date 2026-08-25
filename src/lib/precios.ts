import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsearPrecioPorPersona } from "@/lib/precio-lugar";
import type {
  GuardarPreciosInput,
  RangoPrecioInput,
  TemporadaPrecio,
} from "@/app/mi-negocio/types";

/** Fila tal como se inserta en `precio_tiers`. */
type FilaTier = RangoPrecioInput & { rancho_id: string; temporada?: TemporadaPrecio };

const AVISO_MIGRACION_PENDIENTE =
  "Guardamos el resto de tus precios, pero los de diciembre no: a la base todavía le falta la migración 0099 (supabase/migrations/0099_precios_diciembre.sql). Corrala y volvé a guardar.";

const AVISO_MIGRACION_0103 =
  "Guardamos el resto de tus precios, pero la modalidad Por persona no: a la base todavía le falta la migración 0103 (supabase/migrations/0103_precio_por_persona.sql). Corrala y volvé a guardar.";

/**
 * ¿El error es "esa columna no existe"? Pasa cuando la base todavía no
 * tiene corrida la migración 0099: el código ya manda los campos de
 * diciembre pero las columnas no están.
 *
 * Vienen por dos caminos distintos y hay que reconocer los dos: el
 * 42703 de Postgres ("column ... does not exist") y el PGRST204 de
 * PostgREST, que ni siquiera llega a la base ("Could not find the
 * 'temporada' column ... in the schema cache"). Primero se mira el
 * texto, que dice de QUÉ columna se queja; el código queda de respaldo.
 */
function esColumnaInexistente(
  error: { code?: string; message?: string },
  columna: string,
): boolean {
  const mensaje = (error.message ?? "").toLowerCase();
  if (
    mensaje.includes(columna) &&
    (mensaje.includes("does not exist") || mensaje.includes("could not find"))
  ) {
    return true;
  }
  return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Revisa una lista de rangos ANTES de tocar la base.
 *
 * Importa el orden: guardar es borrar todo y volver a insertar, sin
 * transacción. Si el insert reventara por un dato inválido, el lugar
 * quedaría publicado sin ningún precio. Devuelve el mensaje del primer
 * problema, o null si está todo bien.
 */
function validarRangos(rangos: RangoPrecioInput[], etiqueta: string): string | null {
  for (const r of rangos) {
    const numeros = [r.min_invitados, r.max_invitados, r.precio];
    if (numeros.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
      return `Revisá ${etiqueta}: hay una casilla vacía o con algo que no es un número.`;
    }
    if (r.min_invitados < 0 || r.max_invitados < 0) {
      return `Revisá ${etiqueta}: la cantidad de invitados no puede ser negativa.`;
    }
    if (r.max_invitados < r.min_invitados) {
      return `Revisá ${etiqueta}: el rango que va de ${r.min_invitados} a ${r.max_invitados} está al revés — el "hasta" no puede ser menor que el "desde".`;
    }
    if (r.precio < 0) {
      return `Revisá ${etiqueta}: el precio no puede ser negativo.`;
    }
  }
  return null;
}

/** Un monto suelto (depósito, precio por hora, etc.) sirve o no. */
function montoInvalido(monto: number | null): boolean {
  if (monto === null) return false;
  return typeof monto !== "number" || !Number.isFinite(monto) || monto < 0;
}

/**
 * Reemplaza los rangos de precio y servicios adicionales de UN rancho
 * (nunca de todos), y guarda su depósito fijo, sus precios de diciembre
 * y la modalidad de cobro. Las políticas de seguridad ya impiden tocar
 * el rancho de otra persona; esto solo agrega mensajes de error
 * legibles.
 *
 * Los rangos normales y los de diciembre viven en la MISMA tabla,
 * separados por `temporada` (0099), así que se borran y se reinsertan
 * juntos: dos borrados distintos abrirían una ventana en la que el
 * lugar tendría media lista de precios.
 */
export async function guardarPreciosRancho(
  ranchoId: string,
  input: GuardarPreciosInput,
) {
  const {
    tiers,
    tiersDiciembre,
    servicios,
    tarifaDiciembre,
    depositoReserva,
    modalidadPrecio,
    precioHora,
    precioFijo,
    precioHoraDiciembre,
    precioFijoDiciembre,
    precioPorPersona = null,
  } = input;

  // --- Todo se valida ANTES del primer borrado ---
  const errorRangos =
    validarRangos(tiers, "los rangos de invitados") ??
    validarRangos(tiersDiciembre, "los rangos de diciembre");
  if (errorRangos) return { error: errorRangos };

  if (
    montoInvalido(depositoReserva) ||
    montoInvalido(tarifaDiciembre) ||
    montoInvalido(precioHora) ||
    montoInvalido(precioFijo) ||
    montoInvalido(precioHoraDiciembre) ||
    montoInvalido(precioFijoDiciembre)
  ) {
    return { error: "Revisá los montos: ninguno puede quedar vacío ni en negativo." };
  }

  for (const s of servicios) {
    if (typeof s.precio !== "number" || !Number.isFinite(s.precio) || s.precio < 0) {
      return { error: `Revisá el precio del servicio "${s.nombre || "sin nombre"}".` };
    }
  }

  // La config "por persona" se revalida acá con el MISMO parser que usa
  // el cálculo (cruzó la red: no se confía en lo que armó el cliente).
  // Con otra modalidad activa queda en null — igual que precio_hora o
  // precio_fijo, la modalidad que no se usa se limpia.
  const esPorPersona = modalidadPrecio === "por_persona";
  const ppValidado = esPorPersona ? parsearPrecioPorPersona(precioPorPersona) : null;
  if (esPorPersona && !ppValidado) {
    return {
      error:
        "Revisá la modalidad Por persona: todos los montos (los de diciembre también) van con números mayores a cero.",
    };
  }
  if (esPorPersona && ppValidado && ppValidado.dicTramos.length === 0) {
    return {
      error: "Agregá al menos un ancla a la tarifa deslizante de diciembre.",
    };
  }
  // Lo que el parser no puede saber solo: dos escalones que terminan en
  // el mismo número dejan un tramo muerto (el segundo nunca se cobra), y
  // un tope por debajo del último escalón deja la tarifa por persona sin
  // uso. El parser ya los devolvió ordenados, así que alcanza con mirar
  // cada uno contra el anterior.
  if (esPorPersona && ppValidado) {
    const { escalones, maxPersonas } = ppValidado;
    for (let i = 1; i < escalones.length; i++) {
      if (escalones[i].hasta === escalones[i - 1].hasta) {
        return {
          error: `Revisá los escalones: dos terminan en ${escalones[i].hasta} invitados. Cada uno tiene que cubrir un tramo distinto.`,
        };
      }
    }
    const ultimo = escalones[escalones.length - 1].hasta;
    if (maxPersonas && maxPersonas <= ultimo) {
      return {
        error: `Revisá el tope de personas (${maxPersonas}): tiene que ser mayor que el último escalón (${ultimo}).`,
      };
    }
  }

  const supabase = await createClient();

  // Se prende si la base todavía no tiene la 0099: el guardado sigue,
  // pero al final se avisa que diciembre quedó sin guardar.
  let faltaMigracion = false;

  const { error: errorTiers1 } = await supabase
    .from("precio_tiers")
    .delete()
    .eq("rancho_id", ranchoId);
  if (errorTiers1) return { error: errorTiers1.message };

  const filasNormales: FilaTier[] = tiers.map((t) => ({ ...t, rancho_id: ranchoId }));
  const filas: FilaTier[] = [
    ...filasNormales.map((t) => ({ ...t, temporada: "normal" as const })),
    ...tiersDiciembre.map((t) => ({
      ...t,
      rancho_id: ranchoId,
      temporada: "diciembre" as const,
    })),
  ];

  if (filas.length > 0) {
    const { error } = await supabase.from("precio_tiers").insert(filas);
    if (error) {
      if (!esColumnaInexistente(error, "temporada")) return { error: error.message };
      // Base sin la 0099: los rangos de diciembre no tienen dónde
      // guardarse todavía, pero los de siempre no se pueden perder —
      // acaban de borrarse.
      faltaMigracion = true;
      if (filasNormales.length > 0) {
        const { error: errorReintento } = await supabase
          .from("precio_tiers")
          .insert(filasNormales);
        if (errorReintento) return { error: errorReintento.message };
      }
    }
  }

  const { error: errorSvc1 } = await supabase
    .from("servicios_adicionales")
    .delete()
    .eq("rancho_id", ranchoId);
  if (errorSvc1) return { error: errorSvc1.message };

  if (servicios.length > 0) {
    const { error } = await supabase
      .from("servicios_adicionales")
      .insert(servicios.map((s) => ({ ...s, rancho_id: ranchoId })));
    if (error) return { error: error.message };
  }

  // --- La modalidad "por persona" va en su propio update (0103) ---
  // El jsonb se escribe ANTES que la modalidad: si la columna no existe
  // es que la 0103 no corrió, y en esa base el check viejo de
  // modalidad_precio_lugar tampoco conoce 'por_persona' — escribirla
  // reventaría el update entero del rancho. Detectada la falta, la
  // modalidad no se toca (queda la que la base ya tiene), lo demás se
  // guarda y al final se avisa. Con otra modalidad activa el jsonb no
  // se borra: la modalidad manda al cotizar, así que una config vieja
  // guardada no cobra nada — y el dueño puede volver sin reescribirla.
  let faltaMigracion0103 = false;
  if (esPorPersona) {
    const { error: errorPorPersona } = await supabase
      .from("ranchos")
      .update({ precio_por_persona: ppValidado })
      .eq("id", ranchoId);
    if (errorPorPersona) {
      if (!esColumnaInexistente(errorPorPersona, "precio_por_persona")) {
        return { error: errorPorPersona.message };
      }
      faltaMigracion0103 = true;
    }
  }

  const camposRancho = {
    tarifa_diciembre_por_persona: tarifaDiciembre,
    deposito_reserva: depositoReserva,
    precio_hora_lugar: precioHora,
    precio_fijo_lugar: precioFijo,
    // Sin la 0103, 'por_persona' no pasa el check de la base.
    ...(faltaMigracion0103 ? {} : { modalidad_precio_lugar: modalidadPrecio }),
  };
  const camposDiciembre = {
    precio_hora_diciembre: precioHoraDiciembre,
    precio_fijo_diciembre: precioFijoDiciembre,
  };

  const { error: errorRancho } = await supabase
    .from("ranchos")
    .update(faltaMigracion ? camposRancho : { ...camposRancho, ...camposDiciembre })
    .eq("id", ranchoId);
  if (errorRancho) {
    if (!esColumnaInexistente(errorRancho, "diciembre")) {
      return { error: errorRancho.message };
    }
    faltaMigracion = true;
    const { error: errorReintento } = await supabase
      .from("ranchos")
      .update(camposRancho)
      .eq("id", ranchoId);
    if (errorReintento) return { error: errorReintento.message };
  }

  revalidatePath("/admin/eventos/precios");
  revalidatePath("/mi-negocio", "layout");
  revalidatePath("/");

  if (faltaMigracion0103) return { error: AVISO_MIGRACION_0103 };
  if (faltaMigracion) return { error: AVISO_MIGRACION_PENDIENTE };
  return { error: null };
}
