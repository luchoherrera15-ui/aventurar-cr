import type { createAdminClient } from "@/lib/supabase/admin";
import { faltaLaColumnaProductoId } from "./productos-db";

/**
 * EL EVENTO COMERCIAL detrás de cada sello (0197).
 *
 * «El sello no es el dato principal; la compra que lo genera sí.»
 * El ledger (transacciones_puntos) guarda el EFECTO — +1 sello — y
 * esta tabla guarda la CAUSA: cuánto se gastó, en qué, y qué otorgó.
 * Wallet y QR son interfaces; esto es lo que el backend conserva.
 *
 * ------------------------------------------------------------------
 * POR QUÉ REGISTRAR NUNCA PUEDE FRENAR EL SELLO
 * ------------------------------------------------------------------
 * La 0197 la pega el equipo de Bookea cuando puede, y el mostrador
 * atiende gente HOY. Por eso `registrarTransaccionComercial` degrada
 * en silencio si la tabla no existe (el mismo patrón del resto del
 * panel: errores-base.ts, vencer-sellos.ts) y NUNCA lanza: un cliente
 * con su café pagado no puede quedarse sin sello porque una tabla de
 * métricas no está.
 *
 * La parte pura (el resumen de impacto) vive acá también, separada de
 * la consulta, para poderse probar sin base — doctrina del módulo.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type CompraARegistrar = {
  ranchoId: string;
  programaId: string;
  miembroId: string;
  /** Colones enteros; null = compra sin monto (el flujo de siempre). */
  monto: number | null;
  /** Producto o concepto, en palabras del negocio. null = no lo dieron. */
  producto: string | null;
  /**
   * El producto del CATÁLOGO que se vendió (0198). null = venta a mano
   * (o catálogo todavía sin aplicar), que es el camino de siempre.
   *
   * Lo resuelve el SERVIDOR contra el negocio antes de llegar acá: un
   * id ajeno no puede enlazar la venta al producto de otro local.
   */
  productoId?: string | null;
  /** Sellos que ESTE evento otorgó (0 si no otorgó — p. ej. no llegó al monto). */
  sellosOtorgados: number;
  /** Puntos/colones acreditados en tipos que no son sellos. */
  puntosOtorgados: number | null;
  /** La misma llave de idempotencia que entró al ledger. */
  referencia: string | null;
  /** Quién estaba en el mostrador. */
  registradoPor: string | null;
};

/** ¿El error es «la tabla lealtad_transacciones no existe todavía»? */
export function faltaLaTablaDeTransacciones(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const codigo = (error.code ?? "").trim();
  // 42P01 = undefined_table; PGRST205 = PostgREST no la tiene en el
  // schema cache (la migración corrió hace un instante o no corrió).
  if (codigo === "42P01" || codigo === "PGRST205") return true;
  const mensaje = error.message ?? "";
  if (!/lealtad_transacciones/.test(mensaje)) return false;
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

/**
 * Escribe la fila del evento comercial. NUNCA lanza.
 *
 * · Tabla ausente (falta la 0197) → silencio: el flujo actual sigue
 *   intacto, que es la promesa.
 * · Referencia repetida (23505) → silencio: es un reintento del
 *   mostrador y la compra YA está registrada — exactamente lo que la
 *   idempotencia debe hacer.
 * · Columna `producto_id` ausente (está la 0197 pero no la 0198) → se
 *   reintenta SIN ella. Ver abajo: sin ese reintento, estrenar el
 *   catálogo apagaría el registro de ventas entero.
 * · Cualquier otra cosa → warn al log del servidor; jamás a la cara
 *   del empleado con un cliente enfrente.
 */
/** La fila de `lealtad_transacciones` tal como se escribe. */
type FilaComercial = {
  rancho_id: string;
  programa_id: string;
  miembro_id: string;
  monto: number | null;
  producto: string | null;
  /** Opcional: la columna llega con la 0198 (ver el reintento abajo). */
  producto_id?: string;
  sellos_otorgados: number;
  puntos_otorgados: number | null;
  referencia: string | null;
  registrado_por: string | null;
};

export async function registrarTransaccionComercial(
  db: Admin,
  compra: CompraARegistrar,
): Promise<void> {
  // La fila se declara con su tipo (y no como literal suelto) para que
  // `producto_id` sea una propiedad CONOCIDA en las dos variantes: con
  // dos literales distintos, el cliente de Supabase infiere la forma
  // del primero y rechaza la columna extra del segundo.
  const fila: FilaComercial = {
    rancho_id: compra.ranchoId,
    programa_id: compra.programaId,
    miembro_id: compra.miembroId,
    monto: compra.monto,
    producto: recortarProducto(compra.producto),
    sellos_otorgados: Math.max(0, Math.round(compra.sellosOtorgados)),
    puntos_otorgados: compra.puntosOtorgados,
    referencia: compra.referencia,
    registrado_por: compra.registradoPor,
  };

  try {
    const productoId = compra.productoId ?? null;
    const { error } = await db
      .from("lealtad_transacciones")
      .insert(productoId ? { ...fila, producto_id: productoId } : fila);
    if (!error) return;
    if (faltaLaTablaDeTransacciones(error) || (error.code ?? "") === "23505") return;

    // LA VENTANA ENTRE LA 0197 Y LA 0198: la tabla está, la columna no.
    // Se reintenta sin el enlace — la venta con su monto y su nombre de
    // producto vale igual, y perderla por una columna que falta sería
    // cambiar una métrica nueva por todas las viejas.
    if (productoId && faltaLaColumnaProductoId(error)) {
      const reintento = await db.from("lealtad_transacciones").insert(fila);
      if (!reintento.error || (reintento.error.code ?? "") === "23505") return;
      console.warn(
        "[lealtad] No se pudo registrar la transacción comercial:",
        reintento.error.message,
      );
      return;
    }

    console.warn("[lealtad] No se pudo registrar la transacción comercial:", error.message);
  } catch (e) {
    console.warn("[lealtad] No se pudo registrar la transacción comercial:", e);
  }
}

/** El producto, con el mismo tope que el CHECK de la 0197. */
export function recortarProducto(texto: string | null | undefined): string | null {
  const limpio = (texto ?? "").trim().replace(/[ \t\n\r]+/g, " ");
  if (!limpio) return null;
  return limpio.length <= 120 ? limpio : limpio.slice(0, 119).trimEnd() + "…";
}

// ── El resumen de impacto comercial (puro, probado sin base) ───────

export type FilaDeCompra = {
  miembroId: string;
  monto: number | null;
  sellosOtorgados: number;
  /** ISO de la base. */
  createdAt: string;
};

export type ResumenImpacto = {
  /** Suma de los montos registrados (las compras sin monto no suman). */
  ventas: number;
  /** Compras registradas, con o sin monto. */
  compras: number;
  /** Cuántas de ellas traían monto. */
  comprasConMonto: number;
  /** ventas / comprasConMonto. null = sin compras con monto. */
  ticketPromedio: number | null;
  /** Miembros con 2 o más compras registradas. */
  recurrentes: number;
  /** Sellos emitidos a través de estas compras. */
  sellosEmitidos: number;
  /**
   * Crecimiento de ventas: últimos 30 días contra los 30 anteriores.
   * null = NO se muestra — solo existe cuando LOS DOS períodos tienen
   * ventas con monto. Un «+∞%» sobre un período vacío es una métrica
   * inventada, y acá no se inventa nada.
   */
  crecimientoVentasPct: number | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

export function resumenImpacto(filas: FilaDeCompra[], ahoraMs: number): ResumenImpacto {
  const conMonto = filas.filter((f) => typeof f.monto === "number" && Number.isFinite(f.monto));
  const ventas = conMonto.reduce((s, f) => s + (f.monto as number), 0);

  const porMiembro = new Map<string, number>();
  for (const f of filas) {
    porMiembro.set(f.miembroId, (porMiembro.get(f.miembroId) ?? 0) + 1);
  }
  const recurrentes = [...porMiembro.values()].filter((n) => n >= 2).length;

  const corte30 = ahoraMs - 30 * DIA_MS;
  const corte60 = ahoraMs - 60 * DIA_MS;
  let ventas30 = 0;
  let ventasPrev = 0;
  for (const f of conMonto) {
    const t = new Date(f.createdAt).getTime();
    if (t >= corte30) ventas30 += f.monto as number;
    else if (t >= corte60) ventasPrev += f.monto as number;
  }

  return {
    ventas,
    compras: filas.length,
    comprasConMonto: conMonto.length,
    ticketPromedio: conMonto.length > 0 ? ventas / conMonto.length : null,
    recurrentes,
    sellosEmitidos: filas.reduce((s, f) => s + f.sellosOtorgados, 0),
    crecimientoVentasPct:
      ventas30 > 0 && ventasPrev > 0
        ? Math.round(((ventas30 - ventasPrev) / ventasPrev) * 100)
        : null,
  };
}
