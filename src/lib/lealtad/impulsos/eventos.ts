import { definicionDeActivador } from "./catalogo";
import type { EventoImpulso, Impulso } from "./tipos";

/**
 * QUÉ HECHO DISPARA QUÉ IMPULSO.
 *
 * Los triggers de la base solo anotan hechos crudos («el miembro X ganó un sello, su saldo pasó de 3
 * a 4»). Esta función decide, para cada impulso activo de la tarjeta, si ese hecho lo dispara. Va
 * aparte y PURA porque es la parte que más se presta a errores finos y la que más conviene probar:
 * ¿el sello de regalo de bienvenida cuenta como visita? ¿«te falta 1» se manda si el cliente ya pasó
 * ese punto? Acá se contesta, sin base de datos.
 */

export type SnapshotDelEvento = {
  modo: string;
  /** Lo que cuesta la recompensa activa más barata; null = la tarjeta no tiene. */
  meta: number | null;
  /** Visitas reales del cliente hasta ese hecho, ya contando el hecho. */
  visitasHastaElHecho: number;
};

const PREFIJO_BIENVENIDA = "bienvenida:";

function numeroDe(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** El sello de regalo que se da al unirse (`bienvenida:<miembro>`) no es una visita del cliente. */
export function esSelloDeBienvenida(evento: Pick<EventoImpulso, "datos">): boolean {
  const ref = evento.datos?.referencia;
  return typeof ref === "string" && ref.startsWith(PREFIJO_BIENVENIDA);
}

/** ¿Este hecho dispara este impulso? */
export function dispara(
  impulso: Pick<Impulso, "activador" | "activador_config" | "activado_en">,
  evento: EventoImpulso,
  snap: SnapshotDelEvento,
): boolean {
  // Nada retroactivo: un impulso que se activó después de que pasó el hecho no le escribe a lo de antes.
  if (impulso.activado_en && Date.parse(evento.ocurrido_en) < Date.parse(impulso.activado_en)) return false;

  const def = definicionDeActivador(impulso.activador);
  if (!def || !def.disponible || def.fuente !== "evento") return false;
  if (def.modos !== "todos" && !def.modos.includes(snap.modo)) return false;

  const bienvenida = esSelloDeBienvenida(evento);
  const saldoDespues = numeroDe(evento.datos?.saldo_posterior);
  const saldoAntes = numeroDe(evento.datos?.saldo_anterior);

  switch (impulso.activador) {
    case "inscripcion":
      return evento.tipo === "inscripcion";

    case "pase_apple":
      return evento.tipo === "pase_apple";

    case "canje_realizado":
      return evento.tipo === "ledger_canjeado";

    case "primera_visita":
      return evento.tipo === "ledger_ganado" && !bienvenida && snap.visitasHastaElHecho === 1;

    case "sello_registrado": {
      if (evento.tipo !== "ledger_ganado" || bienvenida) return false;
      const sellos = impulso.activador_config.sellos;
      if (!sellos || sellos.length === 0) return true;
      return saldoDespues !== null && sellos.includes(saldoDespues);
    }

    case "puntos_acumulados":
      return evento.tipo === "ledger_ganado" && !bienvenida;

    case "meta_proxima": {
      if (evento.tipo !== "ledger_ganado" || snap.meta === null || saldoDespues === null) return false;
      const faltan = impulso.activador_config.faltan ?? 1;
      return faltan >= 1 && saldoDespues === snap.meta - faltan;
    }

    case "recompensa_alcanzada": {
      if (evento.tipo !== "ledger_ganado" || snap.meta === null || saldoDespues === null) return false;
      // Cruzó la meta con este hecho. Sin el saldo anterior no se sabe si ya la había cruzado: no se arriesga.
      return saldoAntes !== null && saldoAntes < snap.meta && saldoDespues >= snap.meta;
    }

    default:
      return false;
  }
}

/** La clave que hace único «este impulso por este hecho». */
export function claveDeTarea(evento: Pick<EventoImpulso, "tipo" | "clave">): string {
  return `${evento.tipo}:${evento.clave}`;
}

/** La clave de un cliente detectado por el barrido de inactividad: una vez por «ausencia». */
export function claveDeInactividad(miembroId: string, ultimaActividad: string): string {
  return `inactivo:${miembroId}:${ultimaActividad}`;
}
