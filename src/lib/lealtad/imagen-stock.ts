import { ICONOS_SELLO, type IconoSello } from "./iconos-sello";

/**
 * LAS CINCO IMÁGENES POR DEFECTO del paso de apariencia en `/lealtad`.
 *
 * El pedido del dueño fue «unas 5 imágenes por defecto para colocar en
 * el card». El resto del sitio evita fotos genéricas puestas como si
 * fueran del negocio real —es la misma razón que `negocios-destacados.tsx`
 * y `grilla-categorias.tsx` ya documentan—, así que acá no hay fotos de
 * stock: son CINCO ÍCONOS del juego que ya existe
 * (`src/lib/lealtad/iconos-sello.ts`) sobre un disco del color que la
 * persona ya eligió. No es una foto inventada de "tu negocio": es un
 * marcador honesto mientras no hay logo real.
 *
 * Por eso mismo esta elección NUNCA viaja como `logoUrl` al servidor: no
 * hay archivo que subir, así que no hay nada que `esUrlDeNuestroStorage`
 * pueda validar. Es puramente una ayuda visual para la vista previa del
 * paso de apariencia — la tarjeta se crea sin logo (el comportamiento de
 * siempre: "sin logo, la tarjeta escribe el nombre del negocio") hasta
 * que el dueño suba uno de verdad desde su panel.
 */
export const IMAGENES_STOCK: readonly { id: string; icono: IconoSello; nombre: string }[] = [
  { id: "cafe", icono: "cafe", nombre: "Café" },
  { id: "tijera", icono: "tijera", nombre: "Barbería" },
  { id: "unas", icono: "unas", nombre: "Uñas" },
  { id: "comida", icono: "comida", nombre: "Comida" },
  { id: "estrella", icono: "estrella", nombre: "General" },
];

export function esImagenStock(valor: unknown): valor is string {
  return typeof valor === "string" && IMAGENES_STOCK.some((i) => i.id === valor);
}

function iconoDeStock(id: string): IconoSello | null {
  return IMAGENES_STOCK.find((i) => i.id === id)?.icono ?? null;
}

/**
 * El ícono de stock, dibujado como un `data:` URI — para que la vista
 * previa del pase (que espera una URL en `logoUrl`) lo pueda mostrar
 * igual que mostraría un logo real, sin que exista ningún archivo.
 *
 * Es lógica pura: mismos trazos que ya usa `iconos-sello.ts` para todo
 * lo demás (el creador, la vista previa, `strip.png` del lado del
 * servidor), no un dibujo nuevo.
 */
export function dataUriImagenStock(id: string, colorFondo: string): string | null {
  const icono = iconoDeStock(id);
  if (!icono) return null;
  const trazos = ICONOS_SELLO[icono].trazos
    .map((d) => `<path d="${d}"/>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="12" fill="${colorFondo}"/>` +
    `<g fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.2,3.2) scale(0.73)">${trazos}</g>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
