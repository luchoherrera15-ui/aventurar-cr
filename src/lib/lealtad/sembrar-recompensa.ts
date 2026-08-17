import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { ConfigBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import { recompensaInicial } from "@/lib/lealtad/mostrador";
import { hoyISOCR } from "@/lib/fechas";

/**
 * LA RECOMPENSA CON LA QUE NACE LA TARJETA — los OCHO tipos, no tres.
 *
 * La meta de un pase («5 de 10») sale de la recompensa activa más
 * barata (0121) y NO de una columna propia. Y el botón de canje del
 * mostrador tampoco se puede dibujar sin una fila en `recompensas`:
 * `meta` llega null y no hay nada que ofrecer.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTABA ROTO
 * ------------------------------------------------------------------
 * Acá vivía un `metaDe(beneficio); if (meta === null) return;`. `metaDe`
 * solo responde para sellos, puntos y gift card, así que las tarjetas
 * de CUPÓN, DESCUENTO, MEMBRESÍA, EVENTO y CASHBACK —cinco de los
 * ocho— nacían sin nada canjeable. Escanear un cupón de un solo uso le
 * acreditaba 1 punto, cada vez, y la pantalla decía «¡Sello sumado!».
 *
 * Qué significa canjear en cada tipo se decide en un solo lugar
 * (`recompensaInicial`, src/lib/lealtad/mostrador.ts) y está probado
 * caso por caso; acá solo se guarda lo que esa función resuelve.
 *
 * Si falla, la tarjeta igual quedó creada: el dueño puede agregar la
 * recompensa a mano desde Recompensas, o tocar «Configurar el
 * beneficio» en el mostrador. Perder el programa entero por esto sería
 * peor.
 *
 * Vive en la lib y no en las actions del panel porque la llaman DOS
 * altas: `crearTarjeta` (segunda tarjeta en adelante) y el asistente de
 * /lealtad/nuevo (la primera). Es código exclusivo de servidor —escribe
 * con el cliente admin— y el `import "server-only"` de arriba lo hace
 * cumplir.
 */
export async function sembrarRecompensa(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  programaId: string,
  beneficio: ConfigBeneficio,
) {
  const receta = recompensaInicial(beneficio);
  if (!receta) return;

  // La vigencia de una membresía se cuenta desde HOY en hora de Costa
  // Rica: con UTC, una tarjeta creada a las 7 de la noche nacería
  // vigente desde mañana.
  const vence =
    receta.vigenciaMeses === null ? null : sumarMesesISO(hoyISOCR(), receta.vigenciaMeses);

  const fila: Record<string, unknown> = {
    programa_id: programaId,
    nombre: receta.nombre,
    costo_puntos: receta.costo,
    activo: true,
    tipo: receta.tipo,
    valor: receta.valor,
    instrucciones: receta.instrucciones,
    limite_por_cliente: receta.limitePorCliente,
    stock_total: receta.stockTotal,
    vigencia_hasta: vence,
  };

  const { error } = await db.from("recompensas").insert(fila);
  if (!error) return;

  // Las columnas ricas son de la 0125. Sin ella, la recompensa entra
  // igual con lo que la base sí sabe guardar: mejor una tarjeta
  // canjeable sin instrucciones que una que no se puede canjear.
  console.warn("[lealtad] recompensa con detalle rechazada, se reintenta simple:", error.message);
  await db.from("recompensas").insert({
    programa_id: programaId,
    nombre: receta.nombre,
    costo_puntos: receta.costo,
    activo: true,
  });
}

/** Suma meses a un "YYYY-MM-DD" sin pasar por zonas horarias. */
function sumarMesesISO(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  // Día 0 del mes siguiente = último día del mes destino: así el 31 de
  // enero + 1 mes da el 28/29 de febrero y no el 3 de marzo.
  const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo)))
    .toISOString()
    .slice(0, 10);
}
