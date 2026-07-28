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
