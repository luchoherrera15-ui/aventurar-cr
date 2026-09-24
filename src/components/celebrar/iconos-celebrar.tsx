/**
 * Íconos de línea del panel de CELEBRAR: un solo trazo (1.6), sin
 * relleno, heredan el color del texto. Son los del menú y nada más —
 * si el producto necesita más, van acá, no inline en cada pantalla.
 */

type Props = { className?: string };

function Base({ children, className = "h-5 w-5" }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconoInicio = (p: Props) => (
  <Base {...p}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10.5V19h12v-8.5" />
  </Base>
);

export const IconoCelebraciones = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2.5" />
  </Base>
);

export const IconoCrear = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconoPlantillas = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M4 10h16M10 10v10" />
  </Base>
);

export const IconoCreditos = (p: Props) => (
  <Base {...p}>
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
    <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </Base>
);

export const IconoAlbumes = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2.5" />
    <path d="m4 16 4.5-4.5 3.5 3.5 2.5-2.5L20 17" />
    <circle cx="15.5" cy="9.5" r="1.3" />
  </Base>
);

export const IconoVideos = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="6" width="12" height="12" rx="2.5" />
    <path d="m16 10 4-2v8l-4-2" />
  </Base>
);

export const IconoInvitados = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19" />
    <circle cx="16.5" cy="10" r="2.3" />
    <path d="M16.5 14.5c2.1 0 3.6 1.2 4 3.5" />
  </Base>
);

export const IconoRsvp = (p: Props) => (
  <Base {...p}>
    <path d="M4 7.5 12 13l8-5.5" />
    <rect x="4" y="5.5" width="16" height="13" rx="2.5" />
  </Base>
);

export const IconoConfiguracion = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" />
  </Base>
);

export const IconoSalir = (p: Props) => (
  <Base {...p}>
    <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
    <path d="m14 8 4 4-4 4M18 12H9" />
  </Base>
);

/* ── Íconos de las ocasiones (portada y asistente) ─────────────── */

export const IconoBoda = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="13" r="5" />
    <circle cx="15" cy="13" r="5" />
    <path d="m12 4 1.5 2.5h-3z" />
  </Base>
);

export const IconoCumple = (p: Props) => (
  <Base {...p}>
    <path d="M5 20h14v-6a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3z" />
    <path d="M5 16c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0" />
    <path d="M12 11V8M12 4v1.5" />
    <path d="M10.5 6.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5S12.8 8 12 8s-1.5-.7-1.5-1.5z" />
  </Base>
);

export const IconoXv = (p: Props) => (
  <Base {...p}>
    <path d="M4 17h16l-1.5-9-4 3.5L12 6l-2.5 5.5-4-3.5z" />
    <path d="M6 20h12" />
  </Base>
);

export const IconoBaby = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="13" r="6" />
    <path d="M12 7V4.5M9.5 4.5h5" />
    <circle cx="10" cy="12.5" r=".6" fill="currentColor" />
    <circle cx="14" cy="12.5" r=".6" fill="currentColor" />
    <path d="M10 15.5c1 .8 3 .8 4 0" />
  </Base>
);

export const IconoBautizo = (p: Props) => (
  <Base {...p}>
    <path d="M12 3.5c-3.5 4.5-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-2.5-6.5-6-11z" />
    <path d="M9.5 15.5a2.5 2.5 0 0 0 2.5 2.5" />
  </Base>
);

export const IconoGraduacion = (p: Props) => (
  <Base {...p}>
    <path d="m2.5 9.5 9.5-4 9.5 4-9.5 4z" />
    <path d="M6.5 11.5v4.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.5" />
    <path d="M21.5 9.5v5" />
  </Base>
);

export const IconoAniversario = (p: Props) => (
  <Base {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
  </Base>
);

export const IconoDespedida = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 12.5 20.5 5l-3.5 15-4.5-6.5z" />
    <path d="m12.5 13.5 8-8.5" />
  </Base>
);

export const IconoFiesta = (p: Props) => (
  <Base {...p}>
    <path d="M7 4h10l-1 6a4 4 0 0 1-8 0z" />
    <path d="M12 14v5M9 19h6" />
    <path d="M17 6.5c1.5 0 2.5-1 2.5-2.5M7 6.5C5.5 6.5 4.5 5.5 4.5 4" />
  </Base>
);

export const IconoCorporativo = (p: Props) => (
  <Base {...p}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" />
  </Base>
);

export const IconoOtro = (p: Props) => (
  <Base {...p}>
    <path d="m12 4 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.3l5-.7z" />
  </Base>
);

/* ── Íconos de las funciones ───────────────────────────────────── */

export const IconoInvitacion = (p: Props) => (
  <Base {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m3.5 8 8.5 5.5L20.5 8" />
  </Base>
);

export const IconoConfirmacion = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8 12.5 2.6 2.6L16.5 9" />
  </Base>
);

export const IconoFirma = (p: Props) => (
  <Base {...p}>
    <path d="M4 19c4-1 5-4 7-9s3-6 5-6 2 2 0 5-6 8-8 8 3-2 4 0 3 1 4 0" />
  </Base>
);

export const IconoRegalo = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="9.5" width="16" height="10.5" rx="2" />
    <path d="M4 13.5h16M12 9.5v10.5" />
    <path d="M12 9.5c-3 0-4.5-1.5-4.5-3A1.8 1.8 0 0 1 9.5 4.7C11 4.7 12 7 12 9.5zm0 0c3 0 4.5-1.5 4.5-3a1.8 1.8 0 0 0-2-1.8C13 4.7 12 7 12 9.5z" />
  </Base>
);

export const IconoQr = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
    <path d="M13.5 13.5h3v3h-3zM18 13.5h2M20 16v4h-4M16.5 20v-1.5" />
  </Base>
);

export const IconoEditor = (p: Props) => (
  <Base {...p}>
    <path d="m4 20 4-1L19.5 7.5a2.1 2.1 0 0 0-3-3L5 16z" />
    <path d="m14 6.5 3.5 3.5" />
  </Base>
);

export const IconoCompartir = (p: Props) => (
  <Base {...p}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="17.5" cy="6" r="2.5" />
    <circle cx="17.5" cy="18" r="2.5" />
    <path d="m8.3 10.8 6.9-3.6M8.3 13.2l6.9 3.6" />
  </Base>
);

export const IconoRecuerdos = (p: Props) => (
  <Base {...p}>
    <path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v14L12 16.5 4.5 20V6A1.5 1.5 0 0 1 6 4.5z" />
  </Base>
);
