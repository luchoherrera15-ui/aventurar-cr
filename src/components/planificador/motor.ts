import type { Rancho } from "@/app/mi-negocio/types";
import type { Calificacion } from "@/components/rancho-card";
import { fmtFechaCorta } from "@/lib/fechas";
import { normalizarTexto } from "@/lib/busqueda";
import {
  SERVICIO_POR_ID,
  TIPO_EVENTO_LABEL,
  type CandidatoServicio,
  type EstiloId,
  type GrupoResultados,
  type RespuestasPlanificador,
  type ResultadosPlanificador,
  type ServicioDef,
} from "./tipos";

/**
 * MOTOR DEL COTIZADOR GUIADO
 * ==========================
 *
 * Matching 100% determinista sobre los datos REALES de la plataforma:
 * los ranchos aprobados de la vertical eventos, sus calificaciones
 * (vista `calificaciones_rancho`) y sus fechas confirmadas
 * (`disponibilidad_rancho`). Nada se inventa: si un dato no existe
 * (sin precio, sin reseñas), simplemente no aporta puntos.
 *
 * ► PUNTO DE ENCHUFE PARA UN LLM (futuro):
 *   `generarPlan()` es una función pura (respuestas + datos → plan).
 *   Cuando se quiera hacer "IA de verdad", este es el único lugar a
 *   tocar: se le pasa al modelo las mismas `respuestas` y el catálogo
 *   `datos.ranchos` como contexto, y se le pide que ranquee/redacte —
 *   manteniendo el contrato de salida `ResultadosPlanificador` para
 *   que la UI no cambie. Mientras tanto, esta heurística da resultados
 *   correctos y explicables sin costo por consulta.
 *
 * ► HEURÍSTICA DE PRESUPUESTO (documentada a pedido):
 *   El salón/lugar es el gasto grande de un evento: se le asigna ~40%
 *   del presupuesto total. El 60% restante se reparte en partes
 *   iguales entre los demás servicios pedidos. Si solo se pidió el
 *   salón, se lleva el 100%. Si no se pidió salón, el total se
 *   reparte parejo entre los servicios. El `precio_desde` de cada
 *   negocio se compara contra esa porción: dentro del presupuesto
 *   suma, hasta un 30% por encima suma poco, más caro resta — pero
 *   NUNCA excluye, porque "desde" es solo un punto de partida.
 */

const MAX_POR_SERVICIO = 4;

/** Cuota del presupuesto total que se estima para el salón/lugar. */
const CUOTA_SALON = 0.4;

// Palabras que delatan cada estilo en la descripción o amenidades de
// un negocio. Filtro SUAVE: matchear suma puntos, no matchear no
// descarta (muchos negocios describen poco).
const KEYWORDS_ESTILO: Record<EstiloId, string[]> = {
  elegante: ["elegante", "elegancia", "sofistic", "premium", "exclusiv", "formal"],
  moderno: ["moderno", "moderna", "contemporane", "urbano", "industrial"],
  campestre: ["campestre", "finca", "rancho", "montan", "natur", "verde", "jardin", "rustic", "aire libre"],
  playa: ["playa", "mar", "costa", "arena", "tropical", "guanacaste"],
  minimalista: ["minimalista", "sencillo", "simple", "sobrio"],
  lujoso: ["lujo", "lujos", "premium", "exclusiv", "vip", "alta gama"],
  familiar: ["familiar", "familia", "ninos", "infantil", "piscina", "juegos"],
  otro: [],
};

type DatosPlataforma = {
  /** Ranchos aprobados de la vertical eventos (los del directorio). */
  ranchos: Rancho[];
  /** Fechas ya confirmadas por rancho (`disponibilidad_rancho`). */
  fechasOcupadas: { rancho_id: string; fecha: string }[];
  /** Vista `calificaciones_rancho`. */
  calificaciones: Calificacion[];
};

/**
 * Arma el plan completo: por cada servicio pedido, los mejores
 * candidatos reales de la plataforma, más el resumen de arriba.
 */
export function generarPlan(
  respuestas: RespuestasPlanificador,
  datos: DatosPlataforma,
): ResultadosPlanificador {
  // Si el usuario saltó la pantalla de servicios, se cotiza lo
  // esencial de cualquier evento: lugar, comida y decoración.
  const idsPedidos = respuestas.servicios.length > 0
    ? respuestas.servicios
    : ["salon", "catering", "decoracion"];

  const servicios = idsPedidos
    .map((id) => SERVICIO_POR_ID[id])
    .filter((s): s is ServicioDef => !!s);

  const calificacionPorRancho = new Map<string, Calificacion>();
  for (const c of datos.calificaciones) calificacionPorRancho.set(c.rancho_id, c);

  // Solo interesa la fecha del evento: qué lugares ya están confirmados
  // ese día (los servicios móviles no bloquean fechas).
  const ocupadosEseDia = new Set<string>();
  if (respuestas.fecha) {
    for (const f of datos.fechasOcupadas) {
      if (f.fecha === respuestas.fecha) ocupadosEseDia.add(f.rancho_id);
    }
  }

  const presupuestoPorServicio = repartirPresupuesto(respuestas.presupuesto, servicios);

  const grupos: GrupoResultados[] = servicios.map((servicio) => ({
    servicio,
    candidatos: rankearServicio(
      servicio,
      respuestas,
      datos.ranchos,
      ocupadosEseDia,
      calificacionPorRancho,
      presupuestoPorServicio.get(servicio.id) ?? null,
    ),
  }));

  return {
    resumen: armarResumen(respuestas),
    grupos,
    vacio: grupos.every((g) => g.candidatos.length === 0),
  };
}

/** Ver la heurística de presupuesto documentada arriba. */
function repartirPresupuesto(
  presupuesto: number | null,
  servicios: ServicioDef[],
): Map<string, number> {
  const porServicio = new Map<string, number>();
  if (!presupuesto || presupuesto <= 0 || servicios.length === 0) return porServicio;

  const hayLugar = servicios.some((s) => s.esLugar);
  const otros = servicios.filter((s) => !s.esLugar);

  const cuotaLugar = hayLugar ? (otros.length > 0 ? presupuesto * CUOTA_SALON : presupuesto) : 0;
  const restante = presupuesto - cuotaLugar;
  const cuotaOtro = otros.length > 0 ? restante / otros.length : 0;

  for (const s of servicios) {
    porServicio.set(s.id, Math.round(s.esLugar ? cuotaLugar : cuotaOtro));
  }
  return porServicio;
}

/**
 * Puntúa y ordena los candidatos de UN servicio. Criterios (en orden
 * de peso): rubro correcto, zona, capacidad, fecha libre, precio
 * dentro de la porción de presupuesto, calificación real, estilo y
 * preferencias como filtro suave, y el empujón de "destacado".
 */
function rankearServicio(
  servicio: ServicioDef,
  respuestas: RespuestasPlanificador,
  ranchos: Rancho[],
  ocupadosEseDia: Set<string>,
  calificaciones: Map<string, Calificacion>,
  presupuestoServicio: number | null,
): CandidatoServicio[] {
  const candidatos: CandidatoServicio[] = [];

  for (const rancho of ranchos) {
    // --- Rubro: ¿este negocio ofrece lo que se pidió? ---
    let puntos: number;
    if (servicio.esLugar) {
      // Cualquier lugar físico sirve como sede.
      if (rancho.categoria !== "lugares") continue;
      puntos = 30;
    } else if (rancho.subcategoria && servicio.subcategorias.includes(rancho.subcategoria)) {
      // Subcategoría exacta: el match fuerte.
      puntos = 30;
    } else if (rancho.categoria === servicio.categoria && !rancho.subcategoria) {
      // Misma categoría pero sin subcategoría declarada (fila vieja):
      // entra como candidato débil en vez de desaparecer.
      puntos = 12;
    } else {
      continue;
    }

    // --- Fecha (solo lugares: son los únicos con calendario) ---
    const esLugar = rancho.categoria === "lugares";
    if (esLugar && respuestas.fecha && ocupadosEseDia.has(rancho.id)) {
      // Confirmado ese día → no se ofrece del todo.
      continue;
    }

    // --- Capacidad (solo lugares) ---
    if (esLugar && respuestas.invitados) {
      const { capacidad_min, capacidad_max } = rancho;
      if (capacidad_max != null && capacidad_max < respuestas.invitados) {
        // No caben los invitados: fuera.
        continue;
      }
      if (
        (capacidad_min == null || capacidad_min <= respuestas.invitados) &&
        capacidad_max != null
      ) {
        puntos += 14;
      } else if (capacidad_min != null && capacidad_min > respuestas.invitados) {
        // Queda grande (mínimo de contratación por encima): baja, no sale.
        puntos -= 6;
      }
    }

    // --- Zona: provincia pesa, cantón suma ---
    if (respuestas.provincia) {
      if (rancho.provincia === respuestas.provincia) {
        puntos += 22;
        if (respuestas.canton && rancho.canton === respuestas.canton) puntos += 10;
      } else {
        // Otra provincia no se excluye (el catálogo aún es chico),
        // pero cae al fondo de la lista.
        puntos -= 18;
      }
    }

    // --- Precio "desde" vs la porción de presupuesto ---
    if (presupuestoServicio && rancho.precio_desde != null) {
      if (rancho.precio_desde <= presupuestoServicio) puntos += 18;
      else if (rancho.precio_desde <= presupuestoServicio * 1.3) puntos += 6;
      else puntos -= 12;
    }

    // --- Calificación real (si no tiene reseñas, no suma ni resta) ---
    const calificacion = calificaciones.get(rancho.id) ?? null;
    if (calificacion) {
      puntos += calificacion.promedio * 2 + Math.min(calificacion.total, 8);
    }

    // --- Estilo y preferencias: filtro SUAVE por keywords ---
    const textoNegocio = normalizarTexto(
      `${rancho.nombre} ${rancho.descripcion ?? ""} ${rancho.descripcion_larga ?? ""} ${(rancho.amenidades ?? []).join(" ")}`,
    );
    if (respuestas.estilo && respuestas.estilo !== "otro") {
      const kws = KEYWORDS_ESTILO[respuestas.estilo];
      if (kws.some((k) => textoNegocio.includes(k))) puntos += 8;
    }
    if (respuestas.preferencias.trim()) {
      const palabras = normalizarTexto(respuestas.preferencias)
        .split(/\s+/)
        .filter((p) => p.length > 3);
      let extra = 0;
      for (const p of palabras) {
        if (textoNegocio.includes(p)) extra += 3;
      }
      puntos += Math.min(extra, 9);
    }

    // Los destacados del admin ganan los desempates.
    if (rancho.destacado_orden != null) puntos += 4;

    candidatos.push({
      rancho,
      puntos,
      calificacion,
      etiquetaDisponibilidad: esLugar
        ? respuestas.fecha
          ? `Libre el ${fmtFechaCorta(respuestas.fecha)}`
          : "Reserva en línea"
        : "Consultá su agenda",
      presupuestoServicio,
    });
  }

  return candidatos.sort((a, b) => b.puntos - a.puntos).slice(0, MAX_POR_SERVICIO);
}

/** El titular de la pantalla de resultados, armado con lo respondido. */
function armarResumen(r: RespuestasPlanificador): string {
  const evento = r.tipoEvento && r.tipoEvento !== "otro"
    ? TIPO_EVENTO_LABEL[r.tipoEvento].toLowerCase()
    : "evento";
  const partes: string[] = [`Encontramos estas opciones para tu ${evento}`];
  if (r.invitados) partes.push(`de ${r.invitados} personas`);
  const zona = r.canton ?? r.provincia;
  if (zona) partes.push(`en ${zona}`);
  let resumen = partes.join(" ");
  if (r.presupuesto) {
    resumen += `, con presupuesto aproximado de ₡${r.presupuesto.toLocaleString("es-CR")}`;
  }
  return resumen + ".";
}
