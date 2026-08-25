// Set de iconos de línea compartido — reemplaza los emojis que se usaban
// como marcador visual rápido (🗑️ ⚠️ 🏷️ 🕐 📅 ⏳ ⏱ 🔓 ✨ 🏡 🪑 🎧 🎉 🎈 🖼️ 📷 ✎)
// para que el sitio se vea consistente en cualquier plataforma/fuente.
type IconProps = { className?: string };

const base = "h-[1em] w-[1em]";

export function IconTrash({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7m-8 0 .8 12.2A2 2 0 0 0 9.8 21h4.4a2 2 0 0 0 2-1.8L17 7" />
      <path strokeLinecap="round" d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconWarning({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 21.5 20H2.5L12 3.5Z" />
      <path strokeLinecap="round" d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTagLine({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12V4h8l9 9-8 8-9-9Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

export function IconBag({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20.5L6 8Z" />
      <path strokeLinecap="round" d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

export function IconClock({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconCalendarLine({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconHome({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z"
      />
    </svg>
  );
}

export function IconHourglass({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 3h12M6 21h12M6 3c0 4.5 3 6.5 6 9 3-2.5 6-4.5 6-9M6 21c0-4.5 3-6.5 6-9 3 2.5 6 4.5 6 9"
      />
    </svg>
  );
}

export function IconStopwatch({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <circle cx="12" cy="13" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4l2.5 2M9 2h6" />
    </svg>
  );
}

export function IconUnlock({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

export function IconSparkles({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className={className}>
      <path strokeLinejoin="round" d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
    </svg>
  );
}

export function IconHouse({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 11 12 4l8 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function IconChair({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3M8 20l.6-6M16 20l-.6-6M6 8h12" />
    </svg>
  );
}

export function IconHeadphones({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </svg>
  );
}

export function IconCelebrate({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 19 12-12 2 2L7 21l-2-2Z" />
      <circle cx="17" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="21" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="3" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBalloon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3a5 5 0 0 1 2 9.6c-.3 1.1-.2 2-.7 2.9-.3.6-1 .5-1.3 0-.5-.9-.4-1.8-.7-2.9A5 5 0 0 1 12 3Z"
      />
      <path strokeLinecap="round" d="M12 15.5v2M11 19.5h2" />
    </svg>
  );
}

export function IconFrame({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 17 4.5-5 3 3.5L16 11l4 6" />
    </svg>
  );
}

export function IconCamera({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8a1 1 0 0 1 1-1h2.2l1-1.6A1 1 0 0 1 9 5h6a1 1 0 0 1 .8.4L16.8 7H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z"
      />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconEdit({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" />
    </svg>
  );
}

export function IconUtensils({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v6a2.5 2.5 0 0 0 5 0V3M7.5 11.5V21" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 3c-1.7 1.3-2.5 3.4-2.5 5.8 0 1.7.6 2.9 2.5 3.2V21" />
    </svg>
  );
}

export function IconClipboard({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <path strokeLinecap="round" d="M9 11h6M9 15h4" />
    </svg>
  );
}

export function IconCheck({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconPin({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function IconUsers({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path strokeLinecap="round" d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
    </svg>
  );
}

export function IconWhatsapp({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.1 4c-.2 0-.5 0-.7.4-.2.4-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.3 3.8 2.1.8 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.1-.3 0-.4.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4-.1-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4Z" />
    </svg>
  );
}

export function IconInstagram({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFacebook({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3 0-1.28-.1-2.42-.1-2.4 0-4.05 1.47-4.05 4.16V9.9H7.5V13h2.73v8h3.27Z" />
    </svg>
  );
}

export function IconTiktok({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16.5 3c.35 1.9 1.5 3.3 3.5 3.6v2.6c-1.35.1-2.6-.25-3.85-1V15c0 4.35-4.3 6.9-7.85 4.85C6.1 18.55 5.4 14.9 7.4 12.6c1.1-1.25 2.6-1.85 4.3-1.7v2.7c-.5-.1-1-.1-1.5.1-1.15.4-1.8 1.55-1.5 2.7.3 1.15 1.45 1.9 2.65 1.65 1.1-.2 1.85-1.2 1.85-2.4V3h3.3Z" />
    </svg>
  );
}

export function IconWaze({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.6c4.7 0 8.5 3.3 8.5 7.5 0 1-.2 1.9-.6 2.8.6.3 1 .9 1 1.6 0 1-.8 1.8-1.8 1.8-.5 0-.9-.2-1.2-.5-1.2.9-2.7 1.6-4.3 1.9a2 2 0 0 1-3.9 0 2 2 0 0 1-3.9-.3c-1.9-1-3.3-2.6-3.9-4.4-.2-.6.2-1.2.8-1.3.6-.2 1.2.2 1.3.8.5 1.5 1.8 2.8 3.5 3.5.3-.5.9-.9 1.6-.9.8 0 1.5.5 1.8 1.2h.4c3.6 0 6.6-2.4 6.6-5.4S15.6 4.5 12 4.5c-3.2 0-5.9 1.9-6.5 4.4-.1.6-.7 1-1.3.8-.6-.1-1-.7-.8-1.3C4.2 5.1 7.8 2.6 12 2.6Zm-2.4 5.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Zm4.8 0a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  );
}

export function IconGlobe({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18M12 3c2.4 2.4 3.5 5.6 3.5 9s-1.1 6.6-3.5 9c-2.4-2.4-3.5-5.6-3.5-9S9.6 5.4 12 3Z" />
    </svg>
  );
}

export function IconPlus({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" d="M12 4.5v15M4.5 12h15" />
    </svg>
  );
}

export function IconChevronLeft({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5.5 8 12l7 6.5" />
    </svg>
  );
}

export function IconChevronRight({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5.5 16 12l-7 6.5" />
    </svg>
  );
}

export function IconPlay({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function IconPause({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" d="M8 5.5v13M16 5.5v13" />
    </svg>
  );
}

export function IconChevronDown({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9 12 16l6.5-7" />
    </svg>
  );
}

export function IconMenu({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" d="M3 6.5h18M3 12h18M3 17.5h18" />
    </svg>
  );
}

export function IconUserCircle({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5Z" />
    </svg>
  );
}

export function IconSearch({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className={className}>
      <circle cx="10.5" cy="10.5" r="7" />
      <path strokeLinecap="round" d="M16 16l5 5" />
    </svg>
  );
}

export function IconFiltro({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={className}>
      <path strokeLinecap="round" d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  );
}

export function IconHeart({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="#ffffff" strokeWidth={2} className={className}>
      <path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6C20.5 15 12 20.5 12 20.5Z" />
    </svg>
  );
}

export function IconStar({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l3 6.6 7 .7-5.2 4.7 1.5 6.9L12 17.4 5.7 20.9l1.5-6.9L2 9.3l7-.7z" />
    </svg>
  );
}

export function IconCompass({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 9.5-2 5-3-1.5 2-5 3 1.5Z" />
    </svg>
  );
}

// --- Íconos de categoría ---------------------------------------------
// Dibujos propios con más carácter que los genéricos que había antes
// (casa, tenedor, clipboard...): un rancho de verdad, la campana de
// catering, la bola disco. Son la cara de la barra de navegación.

/** Lugares: el rancho de techo alto con sus columnas. */
export function IconRancho({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 10.5 12 3l9.5 7.5" />
      <path strokeLinecap="round" d="M5.5 13.5h13" />
      <path strokeLinecap="round" d="M6.5 13.5V20M17.5 13.5V20M12 13.5V20" />
      <path strokeLinecap="round" d="M3.5 20.5h17" />
    </svg>
  );
}

/** Alimentación: la campana de catering sobre su bandeja. */
export function IconCloche({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 16a7.5 7.5 0 0 1 15 0" />
      <path strokeLinecap="round" d="M2.5 16.5h19M12 8.5V7" />
      <circle cx="12" cy="5.5" r="1.2" />
      <path strokeLinecap="round" d="M5.5 20h13" />
    </svg>
  );
}

/** Animación: la bola disco con su brillo. */
export function IconDisco({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" d="M12 2.5V5" />
      <circle cx="12" cy="12.5" r="7" />
      <path strokeLinecap="round" d="M5.5 10.3h13M5.5 14.7h13" />
      <path d="M9.6 6c-1.5 4.2-1.5 8.8 0 13M14.4 6c1.5 4.2 1.5 8.8 0 13" />
      <circle cx="4" cy="4.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="6" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Organización: el calendario con el evento ya resuelto. */
export function IconPlannerCheck({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 15.3 2.4 2.4 4.6-4.9" />
    </svg>
  );
}

/** Decoración: los dos globos amarrados. */
export function IconBalloons({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <ellipse cx="15.5" cy="8.5" rx="3.4" ry="4" />
      <path strokeLinecap="round" d="M15.5 12.5c.6 2.6-.7 4.2-.2 6.5" />
      <ellipse cx="8.3" cy="7.5" rx="3.9" ry="4.6" />
      <path strokeLinecap="round" d="M8.3 12.1c-.6 3 .9 4.7.3 7.9" />
      <path strokeLinecap="round" d="M7.5 12.3h1.6" />
    </svg>
  );
}

/** Otros servicios: la varita que resuelve lo que no tiene categoría. */
export function IconWand({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 20.5 11.2-11.2 1.7 1.7L5.2 22.2l-1.7-1.7Z" />
      <path strokeLinecap="round" d="M17.5 3v3.4M15.8 4.7h3.4" />
      <circle cx="20.8" cy="10.3" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="3.8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconImagePlus({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 17 4.5-5 3 3.5L19 11l-3 6" />
      <path strokeLinecap="round" d="M17 9.5v7M13.5 13h7" />
    </svg>
  );
}

export function IconVideoPlus({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2l2-2h4l2 2h2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v4M10 15h4" />
    </svg>
  );
}

export function IconX({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" />
    </svg>
  );
}

export function IconStore({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4h16l1.5 4.5a3 3 0 0 1-2.9 3 3 3 0 0 1-3-2.5 3.1 3.1 0 0 1-3.1 2.5 3.1 3.1 0 0 1-3-2.5 3 3 0 0 1-3 2.5 3 3 0 0 1-3-3L4 4Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5V20h14v-7.5M10 20v-4.5h4V20" />
    </svg>
  );
}

export function IconMail({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function IconChartBars({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" d="M4 20.5h16" />
      <path strokeLinecap="round" d="M7 20v-6M12 20V8M17 20v-9.5" />
    </svg>
  );
}

export function IconChatBubble({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12c0 4.1-4 7.4-9 7.4-1 0-2-.13-2.9-.38L4 20.5l1.2-3.1C3.85 16 3 14.1 3 12c0-4.1 4-7.4 9-7.4s9 3.3 9 7.4Z"
      />
      <path strokeLinecap="round" d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  );
}

/* ---------- Categorías de Citas ------------------------------------
   Íconos propios por rubro, en la misma línea que los de Eventos
   (IconRancho, IconCloche, IconDisco...): la barra de categorías de
   cada vertical se lee igual en todo el sitio. */

/** Belleza: tijeras de salón. */
export function IconTijeras({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <circle cx="6.5" cy="18" r="2.6" />
      <circle cx="17.5" cy="18" r="2.6" />
      <path strokeLinecap="round" d="M8.4 16.1 18.5 3.5M15.6 16.1 5.5 3.5" />
    </svg>
  );
}

/** Barbería: el poste rayado de la puerta. */
export function IconPosteBarbero({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <rect x="8" y="6" width="8" height="12" rx="4" />
      <path strokeLinecap="round" d="M8.4 10.5 15.6 8M8.4 14.5 15.6 12" />
      <path strokeLinecap="round" d="M7 4.5h10M7 19.5h10M12 19.5V22" />
    </svg>
  );
}

/** Uñas: el frasco de esmalte con su pincel. */
export function IconEsmalte({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M7.5 11h9v8.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V11Z" />
      <path strokeLinecap="round" d="M7.5 14.5h9" />
      <path strokeLinejoin="round" d="M9.8 11V8.2a1 1 0 0 1 1-1h2.4a1 1 0 0 1 1 1V11" />
      <path strokeLinecap="round" d="M12 7.2V3.5" />
    </svg>
  );
}

/** Spa y bienestar: la flor de loto. */
export function IconLoto({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5c-2.6 0-4.8-1.7-5.7-4.2 1.9-1.1 4-1 5.7.4 1.7-1.4 3.8-1.5 5.7-.4-.9 2.5-3.1 4.2-5.7 4.2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5c-1.9-2-2.4-4.9-1.2-7.4.5-1 1.2-1.9 1.2-1.9s.7.9 1.2 1.9c1.2 2.5.7 5.4-1.2 7.4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.3 15.3c-1.4-.6-2.4-1.9-2.6-3.4 1.6-.6 3.2-.2 4.3 1M17.7 15.3c1.4-.6 2.4-1.9 2.6-3.4-1.6-.6-3.2-.2-4.3 1" />
    </svg>
  );
}

/** Consultorios: el estetoscopio. */
export function IconEstetoscopio({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" d="M6 3v4.5a4 4 0 0 0 8 0V3" />
      <path strokeLinecap="round" d="M4.5 3H6M12.5 3H14" />
      <path strokeLinecap="round" d="M10 11.5v2.2a4.8 4.8 0 0 0 9.6 0v-1" />
      <circle cx="19.6" cy="10.5" r="2.1" />
    </svg>
  );
}

/* ---------- Categorías de Restaurantes ------------------------------
   Un dibujo por tipo de comida. Se buscó que ninguno se confunda con
   otro a 18px, que es el tamaño al que viven en la barra: la olla, la
   caja china y el cuenco coreano se distinguen por su silueta, no por
   el detalle. */

/** Comida típica y sodas: la olla humeante. */
export function IconOlla({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M4.5 10h15v5.5a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4V10Z" />
      <path strokeLinecap="round" d="M3 10h18M2.5 12.5h2M19.5 12.5h2" />
      <path strokeLinecap="round" d="M9.5 7.5c0-1.2 1-1.4 1-2.5M14 7.5c0-1.2 1-1.4 1-2.5" />
    </svg>
  );
}

/** Carnes y parrilla. */
export function IconParrilla({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M3.5 8.5h17l-1.6 5.2a4 4 0 0 1-3.8 2.8H8.9a4 4 0 0 1-3.8-2.8L3.5 8.5Z" />
      <path strokeLinecap="round" d="M8 11.5h8" />
      <path strokeLinecap="round" d="m8.5 16.5-1.5 4M15.5 16.5l1.5 4" />
      <path strokeLinecap="round" d="M9.5 5.5c0-1 .8-1.2.8-2.2M14.2 5.5c0-1 .8-1.2.8-2.2" />
    </svg>
  );
}

/** Mariscos: el pez. */
export function IconPez({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12c2.3-3.5 5.4-5.2 9.2-5.2S18.6 8.5 20.2 12c-1.6 3.5-4.7 5.2-8.5 5.2S4.8 15.5 2.5 12Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.2 12c-.2-1.7.3-3.1 1.4-4.1M20.2 12c-.2 1.7.3 3.1 1.4 4.1" />
      <circle cx="7.6" cy="10.9" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Pastas e italiana: el plato de fideos con el tenedor. */
export function IconPasta({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 13.5h13a6.5 6.5 0 0 1-6.5 6.2h0a6.5 6.5 0 0 1-6.5-6.2Z" />
      <path strokeLinecap="round" d="M4.2 11c1.4-1.6 3-2.4 4.8-2.4s3.5.8 4.8 2.4" />
      <path strokeLinecap="round" d="M6 8.6C7.1 6.9 8.4 6 10 6" />
      <path strokeLinecap="round" d="M20 3.5v8.2a2 2 0 0 1-2 2M20 3.5v5.2" />
    </svg>
  );
}

/** Pizzas: la porción. */
export function IconPizza({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.2 21 20a1 1 0 0 1-1.2 1.4C17.4 20.6 14.8 20.2 12 20.2s-5.4.4-7.8 1.2A1 1 0 0 1 3 20L12 3.2Z" />
      <path strokeLinecap="round" d="M6.2 15.5c3.8-1 7.8-1 11.6 0" />
      <circle cx="10.6" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="16.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Hamburguesas. */
export function IconHamburguesa({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9.5c0-3 3.8-5 8.5-5s8.5 2 8.5 5H3.5Z" />
      <path strokeLinecap="round" d="M3.5 12.8h17" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 16c0 2.2-3.8 3.5-8.5 3.5S3.5 18.2 3.5 16h17Z" />
    </svg>
  );
}

/** Comida china: la caja para llevar. */
export function IconCajaComida({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M5.5 8.5h13l-1.3 10.2a1.5 1.5 0 0 1-1.5 1.3H8.3a1.5 1.5 0 0 1-1.5-1.3L5.5 8.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 8.5 3-4.5h9l3 4.5" />
      <path strokeLinecap="round" d="M12 8.5v11.5" />
    </svg>
  );
}

/** Japonesa y sushi: el nigiri. */
export function IconSushi({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <rect x="3.5" y="12.5" width="17" height="6" rx="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.6 12.5c1.5-2.6 4.2-4.2 7.4-4.2s5.9 1.6 7.4 4.2" />
      <path strokeLinecap="round" d="M9.5 12.8v5.4M14.5 12.8v5.4" />
    </svg>
  );
}

/** Comida coreana: el cuenco con los palillos apoyados. */
export function IconCuencoPalillos({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12.5h14a7 7 0 0 1-7 7h0a7 7 0 0 1-7-7Z" />
      <path strokeLinecap="round" d="M2 21.5h15" />
      <path strokeLinecap="round" d="M13.5 10.8 21.5 3M16.4 12.4 21.5 7.2" />
    </svg>
  );
}

/** Comida mexicana: el taco. */
export function IconTaco({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 17.5a9.5 9.5 0 0 1 19 0 1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 15.2c1.6-1.4 3.4-2.1 5.5-2.1s3.9.7 5.5 2.1" />
      <path strokeLinecap="round" d="M9 12.4c.8-1.7 2-2.6 3-2.6s2.2.9 3 2.6" />
    </svg>
  );
}

/** Comida peruana: el limón del ceviche. */
export function IconLimon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Mediterránea y árabe: la rama de olivo. */
export function IconOliva({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" d="M4 21c1.5-6.5 6-11 13.5-13.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 3.5c0 2.6-1.6 4.6-4.2 4.9-.4-2.7 1.4-4.6 4.2-4.9Z" />
      <circle cx="9.5" cy="14" r="2.1" />
      <circle cx="14.6" cy="9.6" r="2.1" />
    </svg>
  );
}

/** Vegetariana y saludable: la hoja. */
export function IconPalmera({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" d="M11.3 21c.3-4.8 1-8.7 2.7-12.3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 8.7C12.5 6.2 10 5 7.1 5.7c1.6 1.9 3.9 2.9 6.9 3Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 8.7c-.4-2.9 1-5.1 3.7-6.2-.1 2.5-1.3 4.6-3.7 6.2Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 8.7c2.7-1.4 5.4-1.2 7.6.8-2.4 1-5 .8-7.6-.8Z"
      />
      <path strokeLinecap="round" d="M4.5 21h13" />
    </svg>
  );
}

export function IconHoja({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 4c0 8-4.6 12.5-11 12.5H5.5C5.5 9 11 4 20 4Z" />
      <path strokeLinecap="round" d="M3.5 20.5c1.6-3.4 4.4-6.2 8.5-8.5" />
    </svg>
  );
}

/** Cafeterías y brunch: la taza con vapor. */
export function IconCafe({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M4 10h13v4.5a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 14.5V10Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 11.5h1.8a2.6 2.6 0 0 1 0 5.2H17" />
      <path strokeLinecap="round" d="M3 21.5h15" />
      <path strokeLinecap="round" d="M8 6.8c0-1.1 1-1.3 1-2.3M12.5 6.8c0-1.1 1-1.3 1-2.3" />
    </svg>
  );
}

/** Jugos y frescos: el vaso alto con su pajilla y una rodaja. */
export function IconJugo({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M6.5 7h11l-1.1 12.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8L6.5 7Z" />
      <path strokeLinecap="round" d="M7 11.5h10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 7 16 2.8" />
      <circle cx="9.2" cy="4.6" r="1.9" />
    </svg>
  );
}

/** Panadería: el pan con sus tres cortes. */
export function IconPan({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path
        strokeLinejoin="round"
        d="M4.2 12.4c0-3.3 3.5-5.6 7.8-5.6s7.8 2.3 7.8 5.6c0 .9-.7 1.6-1.6 1.6h-.6v2.6a2.6 2.6 0 0 1-2.6 2.6H9a2.6 2.6 0 0 1-2.6-2.6V14h-.6a1.6 1.6 0 0 1-1.6-1.6Z"
      />
      <path strokeLinecap="round" d="M9.4 10.2 8.2 12.1M12.4 10.2l-1.2 1.9M15.4 10.2l-1.2 1.9" />
    </svg>
  );
}

/** Postres y heladerías: el cono. */
export function IconHelado({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10.5h10L12.9 20a1 1 0 0 1-1.8 0L7 10.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 10.5a5.5 5.5 0 0 1 11 0" />
      <path strokeLinecap="round" d="M8.4 14.2h7.2" />
    </svg>
  );
}

/** Bares y cervecerías: la jarra. */
export function IconJarraCerveza({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M5 8h10v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19V8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5h2.8a1.7 1.7 0 0 1 1.7 1.7v3.1a1.7 1.7 0 0 1-1.7 1.7H15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8c0-2 2.2-3.5 5-3.5S15 6 15 8" />
      <path strokeLinecap="round" d="M8.5 11.5v6M11.5 11.5v6" />
    </svg>
  );
}

/** Cocina de autor: el gorro de chef. */
export function IconGorroChef({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path strokeLinejoin="round" d="M6.5 14.5c-2.2-.5-3.8-2.3-3.8-4.5 0-2.6 2.2-4.7 4.9-4.7.5 0 1 .07 1.5.2C9.8 3.8 11.3 3 13 3c2.7 0 4.9 2.1 4.9 4.7v.1c1.9.5 3.4 2.2 3.4 4.2 0 1.2-.5 2.3-1.4 3.1" />
      <path strokeLinejoin="round" d="M6.5 14.5h13v4.2a1.8 1.8 0 0 1-1.8 1.8H8.3a1.8 1.8 0 0 1-1.8-1.8v-4.2Z" />
      <path strokeLinecap="round" d="M6.5 17.5h13" />
    </svg>
  );
}

/** Notificaciones: la campana. */
export function IconBell({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 10a6 6 0 1 1 12 0c0 3.4 1 5.2 1.8 6.2.3.4 0 1-.5 1H4.7c-.5 0-.8-.6-.5-1C5 15.2 6 13.4 6 10Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 19.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

/** Configuración: engranaje simple. */
export function IconGear({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"
      />
    </svg>
  );
}

/** Ayuda: signo de pregunta en círculo. */
export function IconAyuda({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.6 9.2a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.4" />
      <circle cx="12" cy="16.8" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Cerrar sesión: puerta con flecha hacia afuera. */
export function IconSalir({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.5a2 2 0 0 0 2-2v-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 12h10m0 0-3-3m3 3-3 3" />
    </svg>
  );
}

/** Pases de lealtad: la tarjeta de Wallet con su sello marcado. */
export function IconWallet({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.4" />
      <path strokeLinecap="round" d="M2.5 10h19" />
      <circle cx="16.5" cy="14.3" r="1.7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.7 14.3.6.6 1-1.2" />
    </svg>
  );
}
