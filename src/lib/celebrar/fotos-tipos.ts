import type { TipoCelebracionId } from "./marca";

/**
 * La foto de cada tipo de celebración en la portada. Solo Unsplash con
 * licencia gratuita, y solo ids verificados a mano contra el CDN
 * (`images.unsplash.com/photo-<id>`) el 21 sep 2026 — un id inventado
 * da 404 y deja la tarjeta en blanco sin que ninguna prueba lo atrape.
 * El ancho, el recorte y la calidad los decide `next/image`; acá va la
 * foto original.
 */
export const FOTO_TIPO: Record<Exclude<TipoCelebracionId, "otro">, { url: string; alt: string }> = {
  boda: { url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc", alt: "Pareja de recién casados con globos entre sus invitados" },
  cumpleanos: { url: "https://images.unsplash.com/photo-1464349153735-7db50ed83c84", alt: "Queque de cumpleaños con velas encendidas" },
  xv: { url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8", alt: "Quinceañera con vestido rojo largo" },
  baby_shower: { url: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9", alt: "Pies de un bebé recién nacido sobre una manta blanca" },
  bautizo: { url: "https://images.unsplash.com/photo-1438032005730-c779502df39b", alt: "Interior de una iglesia con vitrales" },
  graduacion: { url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f", alt: "Graduados lanzando sus birretes al aire" },
  aniversario: { url: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2", alt: "Manos formando un corazón frente al atardecer" },
  despedida: { url: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf", alt: "Amigos brindando con copas" },
  fiesta: { url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30", alt: "Confeti cayendo sobre una fiesta de noche" },
  corporativo: { url: "https://images.unsplash.com/photo-1511578314322-379afb476865", alt: "Salón de conferencias con mesas y pantallas" },
};
