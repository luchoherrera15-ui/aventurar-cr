import {
  IconCalendarLine,
  IconCloche,
  IconEnlace,
  IconFacebook,
  IconGlobe,
  IconInstagram,
  IconLinkedin,
  IconMail,
  IconPin,
  IconPinterest,
  IconSpotify,
  IconStore,
  IconTelefono,
  IconTelegram,
  IconTiktok,
  IconWhatsapp,
  IconXSocial,
  IconYoutube,
} from "@/components/icons";
import type { IconoLink } from "@/lib/solutions/tipos";

/**
 * EL DIBUJO DE CADA PUERTA.
 *
 * Antes acá iba un emoji (🔗 📸 💬 …). Se cambió el 4 sep 2026 a pedido
 * del dueño —«iconos profesionales, más minimalistas»— y con razón: el
 * propio `components/icons.tsx` abre diciendo que EXISTE para reemplazar
 * emojis, «para que el sitio se vea consistente en cualquier plataforma
 * o fuente». Un emoji lo dibuja el sistema operativo: el mismo 🔗 se ve
 * plano en Windows, azul en Android y de otro color en iPhone, y en la
 * página de un negocio eso es su marca cambiando según el teléfono de
 * quien la abre.
 *
 * Estos son trazos de 1,7 px en `currentColor`, así que heredan el color
 * del tema y quedan iguales en todas partes.
 */

const MAPA: Record<IconoLink, (p: { className?: string }) => React.ReactElement> = {
  link: IconEnlace,
  instagram: IconInstagram,
  facebook: IconFacebook,
  tiktok: IconTiktok,
  whatsapp: IconWhatsapp,
  telefono: IconTelefono,
  mapa: IconPin,
  reservar: IconCalendarLine,
  web: IconGlobe,
  correo: IconMail,
  youtube: IconYoutube,
  tienda: IconStore,
  menu: IconCloche,
  x: IconXSocial,
  linkedin: IconLinkedin,
  spotify: IconSpotify,
  telegram: IconTelegram,
  pinterest: IconPinterest,
};

export default function IconoLinkSVG({
  icono,
  className,
}: {
  icono: IconoLink | "menu";
  className?: string;
}) {
  const Dibujo = MAPA[icono as IconoLink] ?? IconEnlace;
  return <Dibujo className={className} />;
}

/**
 * Adivina el ícono por la dirección: pegar instagram.com/… y que el
 * botón ya salga con su logo, sin buscarlo en un <select>. Es lo que
 * hace Linktree y lo que el dueño mostró como referencia (6 sep 2026).
 */
export function iconoPorUrl(url: string): IconoLink | null {
  const u = (url ?? "").trim().toLowerCase();
  if (!u) return null;
  if (u.startsWith("tel:")) return "telefono";
  if (u.startsWith("mailto:")) return "correo";
  const pares: [string, IconoLink][] = [
    ["instagram.com", "instagram"],
    ["facebook.com", "facebook"],
    ["fb.com", "facebook"],
    ["tiktok.com", "tiktok"],
    ["wa.me", "whatsapp"],
    ["whatsapp.com", "whatsapp"],
    ["youtube.com", "youtube"],
    ["youtu.be", "youtube"],
    ["maps.google", "mapa"],
    ["goo.gl/maps", "mapa"],
    ["maps.app.goo.gl", "mapa"],
    ["waze.com", "mapa"],
    ["x.com", "x"],
    ["twitter.com", "x"],
    ["linkedin.com", "linkedin"],
    ["spotify.com", "spotify"],
    ["t.me", "telegram"],
    ["telegram.me", "telegram"],
    ["pinterest.com", "pinterest"],
    ["pin.it", "pinterest"],
  ];
  for (const [host, icono] of pares) if (u.includes(host)) return icono;
  return null;
}
