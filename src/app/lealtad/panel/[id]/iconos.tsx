import type { CSSProperties, ReactNode } from "react";
import { ICONOS_SELLO, type IconoSello } from "@/lib/lealtad/iconos-sello";

/**
 * El juego de iconos del panel de lealtad — dibujados a mano, sin
 * librería.
 *
 * Son 20 trazos: meter `lucide-react` por esto sumaría un paquete
 * entero al bundle del panel para pintar rectángulos y círculos. Todos
 * comparten viewBox 24 y `currentColor`, así que heredan el color del
 * contenedor y sirven igual sobre navy que sobre blanco.
 *
 * El módulo NO lleva "use client" a propósito: solo exporta
 * componentes puros, así lo puede importar tanto el shell (cliente)
 * como el tablero de Inicio (servidor).
 */

export type NombreIcono =
  // ── Menú lateral ──
  | "inicio"
  | "clientes"
  | "actividad"
  | "metricas"
  | "equipo"
  | "negocio"
  | "recompensas"
  | "tarjeta"
  | "poster"
  | "plan"
  | "perfil"
  | "configuracion"
  // ── El recorrido del cliente y las acciones del equipo ──
  | "qr"
  | "afiliar"
  | "movil"
  | "regalo"
  | "escanear"
  | "sumar"
  | "listo"
  // ── Los ocho tipos de tarjeta (0135) ──
  // Los ids coinciden con `TipoTarjeta` de src/lib/lealtad/tipos-tarjeta.ts
  // a propósito: así el creador pinta `<Icono nombre={tipo.icono} />` sin
  // una tabla de traducción que alguien tenga que mantener al día.
  | "sellos"
  | "puntos"
  | "cupon"
  | "descuento"
  | "membresia"
  | "giftcard"
  | "evento"
  | "cashback"
  // ── Capacidades, para explicar qué hace cada tipo ──
  | "reloj"
  | "candado"
  | "campana"
  | "repetir"
  | "tope"
  | "moneda"
  | "ubicacion"
  | "estrella"
  | "porcentaje"
  | "personas"
  // ── Chrome ──
  | "menu"
  | "cerrar"
  | "sol"
  | "luna"
  | "camara"
  | "atras"
  | "adelante"
  | "mas";

/**
 * Los trazos de un icono de sello, como nodos de React.
 *
 * El dibujo NO vive acá: vive en `src/lib/lealtad/iconos-sello.ts`,
 * porque el mismo icono lo tiene que pintar sharp adentro de
 * `strip.png` — y un dibujo escrito dos veces se separa igual que un
 * color escrito dos veces. Acá solo se convierte el `d` en `<path>`.
 */
function trazosDelSello(nombre: IconoSello): ReactNode {
  return (
    <>
      {ICONOS_SELLO[nombre].trazos.map((d) => (
        <path key={d} d={d} />
      ))}
    </>
  );
}

const TRAZOS: Record<NombreIcono, ReactNode> = {
  inicio: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  clientes: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  actividad: (
    <>
      <path d="M3.05 11a9 9 0 1 1 .5 4" />
      <path d="M3 3v5h5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  metricas: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-5 3 3 5-7" />
    </>
  ),
  equipo: (
    <>
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </>
  ),
  negocio: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-4.5L19 8v13" />
      <path d="M10 21v-5.5h4V21" />
      <path d="M9 11h.01M15 11h.01" />
    </>
  ),
  recompensas: trazosDelSello("regalo"),
  tarjeta: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2.6" />
      <path d="M2 10h20" />
      <path d="M6 14.5h4" />
    </>
  ),
  poster: (
    <>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="7" rx="2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  plan: (
    <>
      <path d="M5 3h14v18l-2.5-1.8L14 21l-2-1.8L10 21l-2.5-1.8L5 21z" />
      <path d="M9 8.5h6" />
      <path d="M9 12.5h6" />
    </>
  ),
  // «Deslizadores», no engranaje: el diente-a-diente de un gear de
  // verdad no entra en el mismo lenguaje de 2-4 trazos que el resto del
  // juego (rects/paths/circles simples). Tres barras con su perilla es
  // el mismo glifo que ya lee cualquiera como «ajustes».
  configuracion: (
    <>
      <path d="M4 6h8" />
      <path d="M16 6h4" />
      <circle cx="13" cy="6" r="2" />
      <path d="M4 12h2" />
      <path d="M10 12h10" />
      <circle cx="7" cy="12" r="2" />
      <path d="M4 18h11" />
      <path d="M19 18h1" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3.5v3.5H14z" />
      <path d="M20.5 14H21v.5M14 20.5v.5h.5M20.5 20.5H21V21h-.5" />
    </>
  ),
  afiliar: (
    <>
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </>
  ),
  movil: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.6" />
      <path d="M10.5 18.5h3" />
      <path d="M9 7.5h6" />
      <path d="M9 11h4" />
    </>
  ),
  regalo: trazosDelSello("regalo"),
  escanear: (
    <>
      <path d="M3 7.5V5.5A2.5 2.5 0 0 1 5.5 3h2" />
      <path d="M16.5 3h2A2.5 2.5 0 0 1 21 5.5v2" />
      <path d="M21 16.5v2a2.5 2.5 0 0 1-2.5 2.5h-2" />
      <path d="M7.5 21h-2A2.5 2.5 0 0 1 3 18.5v-2" />
      <path d="M3 12h18" />
    </>
  ),
  sumar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.2v7.6M8.2 12h7.6" />
    </>
  ),
  listo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.3 12.4 2.6 2.6 4.8-5.4" />
    </>
  ),
  // ── Los ocho tipos ──────────────────────────────────────────────
  sellos: (
    <>
      <circle cx="7" cy="7.5" r="3" />
      <circle cx="16.5" cy="7.5" r="3" />
      <circle cx="7" cy="16.5" r="3" />
      <circle cx="16.5" cy="16.5" r="3" strokeDasharray="2.2 2.2" />
    </>
  ),
  puntos: (
    <>
      <path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8 6.6 19.7l1-6.1L3.2 9.3l6.1-.9z" />
    </>
  ),
  cupon: (
    <>
      <path d="M3 8.5V6a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6v2.5a2.4 2.4 0 0 0 0 7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-2.5a2.4 2.4 0 0 0 0-7Z" />
      <path d="M14 8.5v7" strokeDasharray="2 2" />
    </>
  ),
  descuento: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.6 15.4 6.8-6.8" />
      <circle cx="9.3" cy="9.3" r="1.3" />
      <circle cx="14.7" cy="14.7" r="1.3" />
    </>
  ),
  membresia: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.6" />
      <circle cx="8.5" cy="11" r="2.3" />
      <path d="M5 16.2c.8-1.7 2-2.5 3.5-2.5s2.7.8 3.5 2.5" />
      <path d="M15 10h4M15 13.5h4" />
    </>
  ),
  giftcard: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.4" />
      <path d="M2.5 10h19" />
      <path d="M12 5.5v13" />
      <path d="M12 5.5S9.8 2 8.2 3.1 9.4 5.5 12 5.5Zm0 0s2.2-3.5 3.8-2.4S14.6 5.5 12 5.5Z" />
    </>
  ),
  evento: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.6" />
      <path d="M16 3v4M8 3v4M3 10h18" />
      <path d="m9.6 15.2 1.7 1.7 3.3-3.4" />
    </>
  ),
  cashback: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.2A3.4 3.4 0 0 0 12.4 8h-.6a2.3 2.3 0 0 0 0 4.6h.4a2.3 2.3 0 0 1 0 4.6h-.6A3.4 3.4 0 0 1 9 16" />
      <path d="M12 6v1.9M12 16.1V18" />
    </>
  ),

  // ── Capacidades ────────────────────────────────────────────────
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.9" />
    </>
  ),
  candado: (
    <>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.4" />
      <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
      <circle cx="12" cy="15.6" r="1.2" />
    </>
  ),
  campana: (
    <>
      <path d="M18 8.8a6 6 0 1 0-12 0c0 5.1-2 6.6-2 6.6h16s-2-1.5-2-6.6" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </>
  ),
  repetir: (
    <>
      <path d="M3 11.5a7 7 0 0 1 11.9-5L18 9" />
      <path d="M18 4.5V9h-4.5" />
      <path d="M21 12.5a7 7 0 0 1-11.9 5L6 15" />
      <path d="M6 19.5V15h4.5" />
    </>
  ),
  tope: (
    <>
      <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />
      <path d="M2.5 8h19" strokeDasharray="3 2.4" />
    </>
  ),
  moneda: (
    <>
      <ellipse cx="12" cy="6.6" rx="8" ry="3.2" />
      <path d="M4 6.6v10.8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6.6" />
      <path d="M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  estrella: trazosDelSello("estrella"),
  porcentaje: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2.6" />
      <circle cx="16.5" cy="16.5" r="2.6" />
    </>
  ),
  personas: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20v-1.2A5 5 0 0 1 7.5 14h3a5 5 0 0 1 5 4.8V20" />
      <path d="M16 5.2a3.4 3.4 0 0 1 0 6.6" />
      <path d="M18 14.3a5 5 0 0 1 3.5 4.5V20" />
    </>
  ),

  menu: (
    <>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </>
  ),
  atras: (
    <>
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </>
  ),
  adelante: (
    <>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </>
  ),
  mas: (
    <>
      <path d="M12 5.5v13M5.5 12h13" />
    </>
  ),
  cerrar: (
    <>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  luna: (
    <>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </>
  ),
  camara: (
    <>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
};

export function Icono({
  nombre,
  className = "h-[18px] w-[18px]",
}: {
  nombre: NombreIcono;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

/** El dibujo suelto de un icono de sello, sin el círculo. */
export function IconoDeSello({
  nombre,
  className = "h-[18px] w-[18px]",
  style,
}: {
  nombre: IconoSello;
  className?: string;
  /** Para los tamaños que salen de una cuenta y no de una clase. */
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {trazosDelSello(nombre)}
    </svg>
  );
}

/**
 * UN SELLO, tal como se ve en el pase: el círculo con el icono adentro.
 *
 * LLENO el que ya se ganó, CONTORNO el que falta — que es lo que se lee
 * de un vistazo en el teléfono, sin contar. Es la misma decisión que
 * toma `dibujarTiraDeSellos` del lado del servidor; acá se dibuja con
 * CSS porque es una maqueta, pero el resultado tiene que coincidir o la
 * vista previa promete un pase distinto del que llega.
 *
 * Sin icono no se usa este componente: ahí el sello sigue siendo el
 * círculo macizo de siempre, con el logo del negocio adentro.
 */
export function SelloConIcono({
  icono,
  encendido,
  colorFondo,
  colorSello,
  lado,
}: {
  icono: IconoSello;
  encendido: boolean;
  /** El fondo del pase: es lo que se ve a través del icono en el sello lleno. */
  colorFondo: string;
  /** El acento: el color del sello. */
  colorSello: string;
  /** Diámetro en píxeles. */
  lado: number;
}) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full transition-colors"
      style={{
        height: lado,
        width: lado,
        background: encendido ? colorSello : "transparent",
        border: encendido ? undefined : `${Math.max(1, lado * 0.055)}px solid ${colorSello}`,
        color: encendido ? colorFondo : colorSello,
      }}
    >
      <IconoDeSello
        nombre={icono}
        className=""
        style={{ height: lado * 0.58, width: lado * 0.58 }}
      />
    </span>
  );
}

/**
 * UN SELLO CON EL ÍCONO PROPIO DEL NEGOCIO (0174).
 *
 * Copia lo que hace `selloRedondo` del lado del servidor —que es el
 * camino que ya funciona en teléfonos de verdad desde que el sello era
 * el logo—: círculo BLANCO, la imagen adentro al 90% (el sello ES el
 * dibujo, no un ícono chico flotando), y el que falta oscurecido y
 * desaturado en vez de en contorno o más transparente.
 *
 * Los dos estados salen de ahí y no de una idea nueva: el aro vacío se
 * puede dibujar con un trazo, pero una imagen rasterizada no se puede
 * «vaciar» sin inventarle un recorte. Y una tarjeta donde la mitad de
 * los sellos se dibuja de una forma y la otra mitad de otra se lee como
 * si estuviera rota.
 *
 * El «apagado» ya NO es alfa 26% sobre el círculo entero (esa técnica
 * hacía el dibujo más TRANSPARENTE, no más oscuro, y se veía peor sobre
 * tarjetas claras). Ahora es `grayscale(0.75) brightness(0.45)` sobre la
 * imagen misma —el equivalente perceptual de `.modulate({ saturation:
 * 0.25, brightness: 0.45 })` que aplica `sharp` del lado del servidor—,
 * con el fondo blanco del círculo intacto en los dos estados.
 *
 * El fondo es BLANCO y no el color del acento por la misma razón que en
 * el servidor: es el fondo neutro que deja ver un ícono de cualquier
 * color. El precio —un ícono blanco desaparece— se avisa en el selector
 * antes de guardar, midiendo el contraste contra este mismo blanco.
 */
export function SelloConImagen({
  url,
  encendido,
  lado,
}: {
  url: string;
  encendido: boolean;
  /** Diámetro en píxeles. */
  lado: number;
}) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white"
      style={{ height: lado, width: lado }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen
          recién subida por el negocio; acá es una maqueta. */}
      <img
        src={url}
        alt=""
        style={{
          height: lado * 0.9,
          width: lado * 0.9,
          objectFit: "contain",
          // El sello que falta no se «aclara» (eso era la técnica vieja,
          // alfa 26% sobre el círculo entero: hacía el dibujo más
          // TRANSPARENTE, no más oscuro). Acá se oscurece/desatura el
          // dibujo de verdad —mismo criterio que `.modulate()` en el
          // servidor (imagenes.ts)— y el fondo blanco del círculo se
          // deja intacto en los dos estados, así que un sello apagado
          // sigue siendo más visible que uno transparente sobre una
          // tarjeta clara.
          filter: encendido ? "none" : "grayscale(0.75) brightness(0.45)",
        }}
      />
    </span>
  );
}
