/**
 * La cotización en tiempo real de un servicio (todo lo que no es
 * Lugares — esos tienen su propio calendario con rangos de precio).
 *
 * El proveedor configura en su panel CÓMO cobra (por persona, por
 * hora, por evento, por día...) y sus tarifas; con eso el formulario
 * de reserva calcula el total al momento, según lo que el cliente
 * elija. La misma lógica corre en el navegador (para mostrar el
 * estimado en vivo) y en el servidor (que recalcula con los datos de
 * la base — nunca le cree el total al navegador).
 */

export type ModalidadCobro =
  | "por_persona"
  | "por_hora"
  | "por_evento"
  | "por_dia"
  | "por_paquete"
  | "por_unidad";

export type ConfigCobro = {
  modalidad: ModalidadCobro | null;
  tarifaPersona: number | null;
  tarifaHora: number | null;
  tarifaEvento: number | null;
  tarifaDia: number | null;
  /** ₡ por cada hora adicional después de las incluidas (por_evento). */
  horaExtra: number | null;
  /** Horas que incluye la tarifa por evento. */
  horasIncluidas: number | null;
  minimoPersonas: number | null;
  horasMinimas: number | null;
  costoTraslado: number | null;
};

/** Lo que el cliente eligió en el formulario de reserva. */
export type SeleccionServicio = {
  invitados?: number | null;
  horas?: number | null;
  dias?: number | null;
  horasExtra?: number | null;
};

export type LineaCotizacion = { etiqueta: string; monto: number };

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function leerConfigCobro(
  detalles: Record<string, unknown> | null | undefined,
): ConfigCobro {
  const d = detalles ?? {};
  const modalidadRaw = String(d.modalidad_cobro ?? "");
  const modalidades: ModalidadCobro[] = [
    "por_persona",
    "por_hora",
    "por_evento",
    "por_dia",
    "por_paquete",
    "por_unidad",
  ];
  return {
    modalidad: modalidades.includes(modalidadRaw as ModalidadCobro)
      ? (modalidadRaw as ModalidadCobro)
      : null,
    tarifaPersona: num(d.tarifa_persona),
    tarifaHora: num(d.tarifa_hora),
    tarifaEvento: num(d.tarifa_evento),
    tarifaDia: num(d.tarifa_dia),
    horaExtra: num(d.hora_extra),
    horasIncluidas: num(d.duracion_horas),
    minimoPersonas: num(d.minimo_personas),
    horasMinimas: num(d.horas_minimas),
    costoTraslado: num(d.costo_traslado),
  };
}

const fmt = (n: number) => "₡" + Math.round(n).toLocaleString("es-CR");

/**
 * Las líneas del estimado según la modalidad configurada. Devuelve
 * lista vacía si el proveedor no configuró tarifas (el pedido queda
 * "a cotizar por chat", como siempre fue).
 */
export function cotizarServicio(
  config: ConfigCobro,
  sel: SeleccionServicio,
): LineaCotizacion[] {
  const lineas: LineaCotizacion[] = [];

  if (config.modalidad === "por_persona" && config.tarifaPersona) {
    const personas = Math.max(sel.invitados ?? 0, 0);
    if (personas > 0) {
      const cobradas = Math.max(personas, config.minimoPersonas ?? 0);
      lineas.push({
        etiqueta:
          `${fmt(config.tarifaPersona)} × ${cobradas} persona${cobradas === 1 ? "" : "s"}` +
          (cobradas > personas ? ` (mínimo del proveedor)` : ""),
        monto: config.tarifaPersona * cobradas,
      });
    }
  }

  if (config.modalidad === "por_hora" && config.tarifaHora) {
    const horas = Math.max(sel.horas ?? 0, 0);
    if (horas > 0) {
      const cobradas = Math.max(horas, config.horasMinimas ?? 0);
      lineas.push({
        etiqueta:
          `${fmt(config.tarifaHora)} × ${cobradas} hora${cobradas === 1 ? "" : "s"}` +
          (cobradas > horas ? ` (mínimo del proveedor)` : ""),
        monto: config.tarifaHora * cobradas,
      });
    }
  }

  if (
    (config.modalidad === "por_evento" || config.modalidad === "por_paquete") &&
    config.tarifaEvento
  ) {
    lineas.push({
      etiqueta:
        config.modalidad === "por_paquete"
          ? "Paquete base"
          : "Tarifa por evento" +
            (config.horasIncluidas
              ? ` (incluye ${config.horasIncluidas} hora${config.horasIncluidas === 1 ? "" : "s"})`
              : ""),
      monto: config.tarifaEvento,
    });
    const extra = Math.max(sel.horasExtra ?? 0, 0);
    if (extra > 0 && config.horaExtra) {
      lineas.push({
        etiqueta: `${fmt(config.horaExtra)} × ${extra} hora${extra === 1 ? "" : "s"} extra`,
        monto: config.horaExtra * extra,
      });
    }
  }

  if (config.modalidad === "por_dia" && config.tarifaDia) {
    const dias = Math.max(sel.dias ?? 0, 0);
    if (dias > 0) {
      lineas.push({
        etiqueta: `${fmt(config.tarifaDia)} × ${dias} día${dias === 1 ? "" : "s"} de alquiler`,
        monto: config.tarifaDia * dias,
      });
    }
  }

  // El traslado se suma solo cuando ya hay algo cotizado: solo, sin
  // servicio, no informa nada.
  if (lineas.length > 0 && config.costoTraslado) {
    lineas.push({ etiqueta: "Traslado", monto: config.costoTraslado });
  }

  return lineas;
}

export function totalCotizacion(lineas: LineaCotizacion[]): number {
  return lineas.reduce((s, l) => s + l.monto, 0);
}
