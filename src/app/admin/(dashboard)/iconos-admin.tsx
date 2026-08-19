/**
 * Los íconos del panel admin, en un solo lugar.
 *
 * Vivían sueltos al final de la portada (`page.tsx`), que era el
 * único que los usaba. Ahora los usan la barra lateral Y el tablero,
 * así que se mudan acá enteros —el mismo dibujo, línea por línea— y
 * se exponen por nombre para que `secciones-admin.ts` pueda decir
 * cuál va en cada fila sin importar JSX.
 *
 * Son de LÍNEA, nunca emojis: el panel admin es sobrio.
 */

export function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a7.5 7.5 0 0 1-11.4 6.4L4 20l1.3-4.8A7.5 7.5 0 1 1 21 12Z"
      />
      <path strokeLinecap="round" d="M8.5 11h7M8.5 14h4.5" />
    </svg>
  );
}

export function IconSobre() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7.5 9 6 9-6" />
    </svg>
  );
}

export function IconNegocio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10v9a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5 4.6 4.7a1 1 0 0 1 .95-.7h12.9a1 1 0 0 1 .95.7L21 9.5a2.6 2.6 0 0 1-5.2.6 2.6 2.6 0 0 1-5.2 0 2.6 2.6 0 0 1-5.2 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.8 20v-4.6h4.4V20" />
    </svg>
  );
}

export function IconLupa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path strokeLinecap="round" d="m15.5 15.5 5 5" />
      <path strokeLinecap="round" d="M8 11.5h5M8 8.8h5M8 14.2h3" />
    </svg>
  );
}

export function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function IconIA() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path
        strokeLinecap="round"
        d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"
      />
    </svg>
  );
}

export function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="9" cy="8" r="3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 5.2a3.5 3.5 0 0 1 0 5.6M17.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  );
}

export function IconReserva() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z"
      />
      <path strokeLinecap="round" d="M15 5v2.5M15 10.5v3M15 16.5V19" />
    </svg>
  );
}

export function IconCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconComplemento() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path strokeLinecap="round" d="M17.5 14v7M14 17.5h7" />
    </svg>
  );
}

export function IconCampana() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 2 15 22l-4-9-9-4 20-7Z"
      />
    </svg>
  );
}

export function IconEtiqueta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h7.6a2 2 0 0 1 1.4.6l8.4 8.4a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0L3.6 12A2 2 0 0 1 3 10.6V3Z"
      />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  );
}

export function IconAlmacen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5V18.5c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}

export function IconLibro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v14H5.5A1.5 1.5 0 0 0 4 19.5V5.5Z"
      />
      <path strokeLinecap="round" d="M19 18v2H5.5A1.5 1.5 0 0 1 4 18.5M8 8h7M8 11.5h7" />
    </svg>
  );
}

/** El tablero: un medidor con su aguja. */
export function IconTablero() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" d="M4 17a8 8 0 1 1 16 0" />
      <path strokeLinecap="round" d="M12 17 16 10" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Developers de la API: una llave.
 *
 * Antes Developers y Complementos dibujaban el MISMO ícono (las cuatro
 * cajas), y en una barra lateral vertical dos filas con el mismo dibujo
 * se leen como la misma cosa.
 */
export function IconLlave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="8" cy="14" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m11 11 8-8 3 3-2 2-2-2-2 2" />
    </svg>
  );
}

/**
 * El mapa de nombre → dibujo.
 *
 * `secciones-admin.ts` guarda el NOMBRE y no el componente, para poder
 * ser un módulo neutro que importen tanto el servidor como el cliente.
 * Acá se resuelve.
 */
export const ICONOS_ADMIN: Record<string, () => React.ReactElement> = {
  tablero: IconTablero,
  negocio: IconNegocio,
  reserva: IconReserva,
  calendario: IconCalendario,
  etiqueta: IconEtiqueta,
  sobre: IconSobre,
  complemento: IconComplemento,
  campana: IconCampana,
  chart: IconChart,
  libro: IconLibro,
  lupa: IconLupa,
  users: IconUsers,
  chat: IconChat,
  llave: IconLlave,
  ia: IconIA,
  almacen: IconAlmacen,
};
