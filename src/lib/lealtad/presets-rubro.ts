import { PALETAS, coloresDePaleta, type Paleta } from "./paletas";
import type { IconoSello } from "./iconos-sello";

/**
 * LOS PRESETS POR RUBRO del asistente de primera tarjeta.
 *
 * ------------------------------------------------------------------
 * QUÉ SON Y QUÉ NO SON
 * ------------------------------------------------------------------
 * Cuando el dueño dice «soy una barbería», el paso de apariencia le
 * ofrece dos o tres estilos ya armados —paleta + icono del sello— y el
 * paso del beneficio le sugiere regalías escritas en el idioma de su
 * rubro («Corte gratis», no «Recompensa №1»). Son ATAJOS, no candados:
 * todo lo que un preset pone se puede cambiar a mano en el mismo paso.
 *
 * Viven en código y no en la base a propósito (mismo criterio que
 * `planes.ts`): son producto, iguales para todos, y una tabla editable
 * sugeriría que se pueden personalizar por cuenta.
 *
 * ------------------------------------------------------------------
 * NINGÚN HEXADECIMAL NUEVO
 * ------------------------------------------------------------------
 * Las paletas se toman de `paletas.ts` vía `coloresDePaleta`, que es
 * de donde también leen la landing y el creador del panel. Si este
 * archivo trajera sus propios hexes habría una tercera copia de los
 * colores — y tres copias se separan igual que dos.
 *
 * ------------------------------------------------------------------
 * LAS LLAVES SON LOS TIPOS DE NEGOCIO REALES
 * ------------------------------------------------------------------
 * `Rubro` espeja los cinco valores que `solicitarAltaConPlan` acepta
 * (`TIPOS` en src/app/lealtad/nuevo/actions.ts): citas, restaurantes,
 * eventos, hospedajes y otro. La granularidad fina (barbería, uñas,
 * café…) va DENTRO de cada rubro como lista de presets.
 */

export const RUBROS = ["citas", "restaurantes", "eventos", "hospedajes", "otro"] as const;
export type Rubro = (typeof RUBROS)[number];

/** Cómo se le dice a cada rubro en los chips del asistente. */
export const ETIQUETAS_RUBRO: Record<Rubro, string> = {
  citas: "Citas y servicios",
  restaurantes: "Restaurante o café",
  eventos: "Eventos",
  hospedajes: "Hospedaje",
  otro: "Otro",
};

export function esRubro(valor: unknown): valor is Rubro {
  return typeof valor === "string" && (RUBROS as readonly string[]).includes(valor);
}

/** Tres o cuatro regalías, ni más ni menos: se miran de un vistazo. */
type Regalias = readonly [string, string, string] | readonly [string, string, string, string];

export type PresetRubro = {
  /** Estable: identifica el preset aunque cambie el nombre visible. */
  id: string;
  /** Cómo se llama en la galería del paso de apariencia. */
  nombre: string;
  /** Los dos colores que la tarjeta guarda (de `paletas.ts`, no propios). */
  paleta: { fondo: string; sello: string };
  /** El dibujo sugerido para el sello (solo aplica en tarjetas de sellos). */
  icono: IconoSello;
  /** Regalías rápidas para el paso del beneficio, en español del rubro. */
  regalias: Regalias;
};

const de = (p: Paleta) => coloresDePaleta(p);

export const PRESETS_RUBRO: Record<Rubro, readonly PresetRubro[]> = {
  citas: [
    {
      id: "barberia",
      nombre: "Barbería",
      paleta: de(PALETAS.descuento),
      icono: "tijera",
      regalias: ["Corte gratis", "Barba gratis", "50% en tu próximo corte", "Producto gratis"],
    },
    {
      id: "unas",
      nombre: "Uñas",
      paleta: de(PALETAS.giftcard),
      icono: "unas",
      regalias: ["Manicure gratis", "Uñas gel gratis", "Diseño gratis"],
    },
    {
      id: "spa",
      nombre: "Spa",
      paleta: de(PALETAS.evento),
      icono: "flor",
      regalias: ["Masaje gratis", "Facial gratis", "30 minutos extra gratis"],
    },
    {
      id: "gimnasio",
      nombre: "Gimnasio",
      paleta: de(PALETAS.cashback),
      icono: "pesa",
      regalias: ["Una semana gratis", "Sesión personal gratis", "Batido gratis"],
    },
  ],
  restaurantes: [
    {
      id: "cafeteria",
      nombre: "Cafetería",
      paleta: de(PALETAS.sellos),
      icono: "cafe",
      regalias: ["Bebida gratis", "Café gratis", "Postre gratis", "Repostería gratis"],
    },
    {
      id: "restaurante",
      nombre: "Restaurante",
      paleta: de(PALETAS.cupon),
      icono: "comida",
      regalias: ["Plato del día gratis", "Postre gratis", "Entrada gratis"],
    },
    {
      id: "bar",
      nombre: "Bar",
      paleta: de(PALETAS.membresia),
      icono: "cerveza",
      regalias: ["Cerveza gratis", "2×1 en tu próxima visita", "Boca de la casa gratis"],
    },
  ],
  eventos: [
    {
      id: "eventos",
      nombre: "Eventos",
      paleta: de(PALETAS.evento),
      icono: "estrella",
      regalias: ["Entrada gratis", "Cortesía de bienvenida", "Descuento en tu próximo evento"],
    },
    {
      id: "salon-eventos",
      nombre: "Salón de eventos",
      paleta: de(PALETAS.membresia),
      icono: "regalo",
      regalias: ["Hora extra gratis", "Decoración de cortesía", "10% en tu próxima reserva"],
    },
  ],
  hospedajes: [
    {
      id: "hotel",
      nombre: "Hotel",
      paleta: de(PALETAS.membresia),
      icono: "corazon",
      regalias: ["Una noche gratis", "Desayuno gratis", "Salida tarde gratis"],
    },
    {
      id: "cabinas",
      nombre: "Cabinas y glamping",
      paleta: de(PALETAS.puntos),
      icono: "estrella",
      regalias: ["Fogata de cortesía", "Tour gratis", "Descuento en tu próxima estadía"],
    },
  ],
  otro: [
    {
      id: "tienda",
      nombre: "Tienda",
      paleta: de(PALETAS.puntos),
      icono: "regalo",
      regalias: ["Producto gratis", "10% de descuento", "Regalo sorpresa"],
    },
    {
      id: "mascotas",
      nombre: "Mascotas",
      paleta: de(PALETAS.sellos),
      icono: "mascota",
      regalias: ["Baño gratis", "Recorte de uñas gratis", "Premio para tu mascota"],
    },
    {
      id: "lavacar",
      nombre: "Lavacar",
      paleta: de(PALETAS.cashback),
      icono: "auto",
      regalias: ["Lavado gratis", "Aspirado gratis", "Cera de cortesía"],
    },
    {
      id: "floristeria",
      nombre: "Floristería",
      paleta: de(PALETAS.giftcard),
      icono: "flor",
      regalias: ["Flor de regalo", "Ramo pequeño gratis", "10% en tu próximo ramo"],
    },
  ],
};

/** La galería del rubro elegido. Sin rubro, la genérica («otro»). */
export function presetsDe(rubro: Rubro | null): readonly PresetRubro[] {
  return PRESETS_RUBRO[rubro ?? "otro"];
}

/**
 * Las regalías rápidas del rubro, sin repetidas y con techo: ocho chips
 * se leen; dieciséis son una tarea.
 */
export function regaliasDe(rubro: Rubro | null): readonly string[] {
  const todas = presetsDe(rubro).flatMap((p) => p.regalias);
  return [...new Set(todas)].slice(0, 8);
}
