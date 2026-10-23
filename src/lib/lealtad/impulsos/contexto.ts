import { nombreDePila } from "./mensaje";
import type { ContextoCliente, InfoPrograma } from "./tipos";
import { diasEntreFechas, partesLocales } from "./zona-horaria";

/**
 * QUÉ SE SABE DE UN CLIENTE, calculado desde su ledger.
 *
 * Módulo PURO: recibe las filas ya leídas y devuelve el resumen. Va aparte del repositorio porque son
 * las reglas que deciden a quién se le escribe, y no tienen por qué probarse con una base de datos.
 *
 * Las mismas reglas que usa el panel de Clientes (`clientes-datos.ts`, `tablero.ts`): el saldo es la
 * suma de TODO el ledger; las visitas y la última actividad cuentan solo lo que el cliente hizo.
 */

export type FilaLedger = {
  id: string;
  tipo: string;
  puntos: number;
  referencia: string | null;
  created_at: string;
  reversion_de: string | null;
};

export type ResumenLedger = {
  saldo: number;
  visitas: number;
  canjes: number;
  /** AAAA-MM-DD en la zona del negocio; null = nunca vino. */
  ultimaActividad: string | null;
};

const PREFIJO_BIENVENIDA = "bienvenida:";

export function resumirLedger(filas: readonly FilaLedger[], zona: string): ResumenLedger {
  // Una reversión anula la fila a la que apunta: ni la fila ni la reversión son «algo que hizo el cliente».
  const anuladas = new Set(filas.map((f) => f.reversion_de).filter((id): id is string => !!id));

  let saldo = 0;
  let visitas = 0;
  let canjes = 0;
  let ultima: number | null = null;

  for (const f of filas) {
    saldo += Number.isFinite(f.puntos) ? f.puntos : 0;
    if (f.reversion_de || anuladas.has(f.id)) continue;
    const esBienvenida = typeof f.referencia === "string" && f.referencia.startsWith(PREFIJO_BIENVENIDA);
    if (f.tipo === "ganado" && !esBienvenida) visitas++;
    else if (f.tipo === "canjeado") canjes++;
    else continue;
    const t = Date.parse(f.created_at);
    if (Number.isFinite(t) && (ultima === null || t > ultima)) ultima = t;
  }

  return {
    saldo,
    visitas,
    canjes,
    ultimaActividad: ultima === null ? null : partesLocales(ultima, zona).fecha,
  };
}

export type DatosDelMiembro = {
  nombreCompleto: string | null;
  creadoEn: string;
  plataformas: readonly string[];
};

/** Arma el contexto que usan las condiciones y el mensaje. `ahora` es el instante en que se decide. */
export function armarContextoCliente(
  info: InfoPrograma,
  miembro: DatosDelMiembro,
  ledger: ResumenLedger,
  ahora: Date,
): ContextoCliente {
  const hoy = partesLocales(ahora, info.zona).fecha;
  const alta = partesLocales(Date.parse(miembro.creadoEn), info.zona).fecha;
  return {
    nombre: nombreDePila(miembro.nombreCompleto),
    nombreNegocio: info.nombreNegocio,
    nombrePrograma: info.nombrePrograma,
    modo: info.modo,
    saldo: ledger.saldo,
    meta: info.meta,
    recompensa: info.recompensa,
    visitas: ledger.visitas,
    canjes: ledger.canjes,
    ultimaActividad: ledger.ultimaActividad,
    diasSinActividad: ledger.ultimaActividad ? Math.max(0, diasEntreFechas(ledger.ultimaActividad, hoy)) : null,
    antiguedadDias: Math.max(0, diasEntreFechas(alta, hoy)),
    plataformas: miembro.plataformas.filter((p): p is "apple" | "google" => p === "apple" || p === "google"),
  };
}
