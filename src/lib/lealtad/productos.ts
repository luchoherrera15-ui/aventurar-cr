import { leerMontoColones } from "./mostrador";

/**
 * EL CATÁLOGO DE PRODUCTOS DEL NEGOCIO (0198) — la parte pura.
 *
 * ------------------------------------------------------------------
 * EL HUECO QUE ESTO TAPA
 * ------------------------------------------------------------------
 * La 0197 le dio a cada sello su compra: monto y producto. Pero las
 * DOS cosas se escribían a mano en cada venta — el monto tecleado y el
 * producto como texto libre. Consecuencias, las dos reales:
 *
 *   · «¿dónde configuro cuánto vale un capuchino?» no tenía respuesta,
 *     porque no había dónde;
 *   · «Capuchino», «capuchino» y «Capucchino» eran tres productos
 *     distintos en el reporte de ventas.
 *
 * Con catálogo, el dueño carga el precio UNA vez y la caja elige de una
 * lista. El monto queda editable a propósito: una venta puede llevar
 * dos cafés, y un campo que no se puede corregir obliga al empleado a
 * mentirle al sistema o a no registrar la venta.
 *
 * ------------------------------------------------------------------
 * QUÉ VIVE ACÁ Y QUÉ NO
 * ------------------------------------------------------------------
 * Solo lo que se puede probar sin base: los topes, la lectura de un
 * precio y el ranking de lo que más se vende. Las consultas viven en
 * `productos-db.ts`, y quién puede tocar el catálogo lo decide
 * `productos-actions.ts` — doctrina del módulo (ver identidades-db.ts).
 */

// ── Los topes, en un solo lugar ────────────────────────────────────
// Los mismos números que los CHECK y el trigger de la 0198. Escritos
// acá para que el mensaje al dueño sea claro ANTES de que la base
// rebote, nunca para reemplazar a la base.

/** Productos por negocio. No es un límite de paquete: es lo que hace
 *  que el desplegable del mostrador siga siendo usable en un teléfono. */
export const TOPE_PRODUCTOS = 100;

/** `char_length(nombre) between 1 and 80` en la 0198. */
export const TOPE_NOMBRE_PRODUCTO = 80;

/** El mismo techo que el monto de una compra (0197): un producto no
 *  puede valer más que la venta más grande que el sistema acepta. */
export const TOPE_PRECIO = 10_000_000;

// ── Las formas que viajan ──────────────────────────────────────────

/** Una fila del catálogo, como la ve el dueño en su panel. */
export type ProductoCatalogo = {
  id: string;
  nombre: string;
  /** Colones enteros, siempre > 0 (CHECK de la 0198). */
  precio: number;
  activo: boolean;
  orden: number;
};

/**
 * Lo que llega al MOSTRADOR: lo mínimo para llenar un desplegable.
 *
 * `activo` no viaja porque a la caja solo se le mandan los activos, y
 * `orden` tampoco porque la lista ya llega ordenada del servidor: lo
 * que no se necesita en el navegador no se manda.
 */
export type ProductoDeVenta = { id: string; nombre: string; precio: number };

// ── El nombre ──────────────────────────────────────────────────────

/**
 * El nombre, limpio. `[ \t\n\r]` y no `\s` por lo mismo que en
 * mostrador.ts: `\s` también se come el espacio fino que `es-CR` usa
 * como separador de miles.
 */
export function normalizarNombreProducto(texto: string): string {
  return texto.trim().replace(/[ \t\n\r]+/g, " ");
}

/** Qué está mal en el nombre, o null si nada. */
export function motivoNombreInvalido(texto: string): string | null {
  const nombre = normalizarNombreProducto(texto);
  if (!nombre) return "Ponele un nombre al producto (ej. «Capuchino grande»).";
  if (nombre.length > TOPE_NOMBRE_PRODUCTO) {
    return `El nombre no puede pasar de ${TOPE_NOMBRE_PRODUCTO} caracteres.`;
  }
  return null;
}

// ── El precio ──────────────────────────────────────────────────────

export type LecturaPrecio = { ok: true; precio: number } | { ok: false; motivo: string };

/**
 * Lee el precio que el dueño tecleó.
 *
 * Se apoya en `leerMontoColones` (mostrador.ts) para no tener DOS
 * formas de leer un colón en el mismo módulo: la coma decimal, los
 * céntimos y el techo ya están decididos ahí, y decididos con el
 * mensaje que hay que darle a alguien que está escribiendo plata.
 *
 * Lo que agrega es la regla propia del catálogo: un precio EXISTE y es
 * mayor que cero. Vacío devuelve error en vez de `null` —a diferencia
 * del monto de una compra, que sí puede no estar— porque un producto
 * sin precio no sirve para lo único que el catálogo hace: rellenar el
 * monto en la caja.
 */
export function leerPrecioColones(texto: string): LecturaPrecio {
  const lectura = leerMontoColones(texto);
  if (!lectura.ok) return { ok: false, motivo: lectura.motivo };
  if (lectura.monto === null) {
    return { ok: false, motivo: "Escribí el precio en colones. Ejemplo: 2500." };
  }
  if (lectura.monto <= 0) {
    return {
      ok: false,
      motivo:
        "El precio tiene que ser mayor que ₡0. Lo que se regala se configura en «Recompensas».",
    };
  }
  return { ok: true, precio: lectura.monto };
}

/** ¿Este precio pasa los CHECK de la 0198? (Para lo que ya es número.) */
export function precioValido(precio: number): boolean {
  return Number.isInteger(precio) && precio > 0 && precio <= TOPE_PRECIO;
}

// ── Lo que más se vende (puro, probado sin base) ───────────────────

/** Una venta registrada, con lo poco que hace falta para el ranking. */
export type VentaDeProducto = {
  /** El nombre GUARDADO en la venta (0197): la foto del momento. */
  producto: string | null;
  /** Colones. null = compra sin monto (no suma plata, sí suma venta). */
  monto: number | null;
};

export type ProductoVendido = {
  nombre: string;
  /**
   * Cuántas VENTAS registraron este producto.
   *
   * No se llama «unidades» a propósito: el monto es editable, así que
   * una venta puede llevar dos cafés y esto seguiría contando 1.
   * Decirle «unidades» sería inventarle precisión a un dato que el
   * sistema no tiene.
   */
  ventas: number;
  /** Suma de los montos de esas ventas. */
  total: number;
};

/**
 * El top de productos por PLATA VENDIDA.
 *
 * Se agrupa por el nombre guardado en la venta y no por `producto_id`:
 * así entran también las ventas anteriores al catálogo (producto
 * tecleado a mano) y las de un producto que ya se retiró del menú — que
 * son plata que el negocio hizo igual. Sin distinguir mayúsculas,
 * porque «Capuchino» y «capuchino» son el mismo café; el nombre que se
 * muestra es el de la venta más reciente que lo nombró.
 *
 * Devuelve LISTA VACÍA cuando ninguna venta trae producto: quien pinte
 * esto tiene que decir que no hay datos, no dibujar un ranking de nada.
 */
export function topProductosVendidos(
  ventas: VentaDeProducto[],
  tope = 5,
): ProductoVendido[] {
  const porNombre = new Map<string, ProductoVendido>();

  for (const v of ventas) {
    const nombre = normalizarNombreProducto(v.producto ?? "");
    if (!nombre) continue;

    const llave = nombre.toLowerCase();
    const previo = porNombre.get(llave);
    const monto = typeof v.monto === "number" && Number.isFinite(v.monto) ? v.monto : 0;

    if (previo) {
      previo.ventas += 1;
      previo.total += monto;
    } else {
      // El primero que se ve manda el nombre visible. Quien llama pasa
      // las filas de la más nueva a la más vieja (así las trae el
      // panel), así que ese primero es el nombre más reciente.
      porNombre.set(llave, { nombre, ventas: 1, total: monto });
    }
  }

  return [...porNombre.values()]
    .sort((a, b) => b.total - a.total || b.ventas - a.ventas || a.nombre.localeCompare(b.nombre, "es-CR"))
    .slice(0, Math.max(0, tope));
}
