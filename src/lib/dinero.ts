/**
 * BOOKEA — cómo se escribe la plata, en un solo lugar.
 *
 * Bookea factura en colones pero le paga en dólares a sus proveedores
 * (Anthropic, Cloudflare, Supabase). Todo panel que muestre un costo
 * termina necesitando lo mismo: dólares con los decimales justos,
 * colones redondeados, y las dos juntas.
 *
 * Esto vivía dentro de `src/lib/ia/modelos.ts` porque el panel de IA fue
 * el primero que lo necesitó. Cuando el panel de almacenamiento pidió lo
 * mismo, copiarlo habría dejado dos formatos de colón conviviendo en el
 * mismo /admin — que es exactamente el tipo de diferencia que nadie nota
 * hasta que un número se ve distinto en dos pantallas y hay que
 * averiguar cuál miente.
 *
 * `ia/modelos.ts` reexporta desde acá, así que ningún llamador cambió.
 *
 * Módulo puro: sin red, sin base, sin `process.env`.
 */

/**
 * Dólares con los decimales que hagan falta.
 *
 * Los montos chicos llevan cuatro: un costo de $0,0003 al mes redondeado
 * a dos decimales es "$0,00", que le dice a quien mira que no cuesta
 * nada. Cuesta poco, que no es lo mismo — y sumado sobre doscientos
 * álbumes deja de ser poco.
 */
export function formatearUSD(usd: number): string {
  if (!Number.isFinite(usd)) return "$0.00";
  const abs = Math.abs(usd);
  const decimales = abs > 0 && abs < 0.01 ? 4 : 2;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/**
 * Colones sin decimales: nadie cobra céntimos de colón.
 *
 * El separador de miles lo pone `es-CR`, que usa espacio y no coma. Se
 * deja el formato local a propósito aunque no sea el que uno escribiría
 * a mano: es el mismo que ya muestra el resto de la plataforma.
 */
export function formatearCRC(crc: number): string {
  if (!Number.isFinite(crc)) return "₡0";
  return `₡${Math.round(crc).toLocaleString("es-CR")}`;
}

/** "$0.0412 · ₡21" — el gasto siempre se muestra en las dos monedas. */
export function formatearAmbas(usd: number, tipoCambio: number): string {
  return `${formatearUSD(usd)} · ${formatearCRC(usd * tipoCambio)}`;
}

/**
 * Bytes en la unidad que se lee de un vistazo.
 *
 * Base 1024 y no 1000: es lo que muestran el sistema operativo y el
 * panel de Supabase, y tener dos cifras distintas para el mismo archivo
 * en dos pantallas de la misma plataforma no ayuda a nadie.
 */
export function formatearBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
  const valor = bytes / 1024 ** i;
  return `${valor.toFixed(i === 0 ? 0 : valor >= 100 ? 0 : 1)} ${unidades[i]}`;
}
