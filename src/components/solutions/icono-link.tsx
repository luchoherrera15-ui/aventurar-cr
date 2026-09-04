import {
  IconCalendarLine,
  IconCloche,
  IconEnlace,
  IconFacebook,
  IconGlobe,
  IconInstagram,
  IconMail,
  IconPin,
  IconStore,
  IconTelefono,
  IconTiktok,
  IconWhatsapp,
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
