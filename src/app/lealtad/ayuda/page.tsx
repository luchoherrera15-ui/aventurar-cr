import type { Metadata } from "next";
import NavLealtad from "../nav-lealtad";
import ExperienciaCinematografica from "./experiencia-cinematografica";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /lealtad/ayuda — LA EXPERIENCIA CINEMATOGRÁFICA DE BOOKEA LEALTAD
 * ════════════════════════════════════════════════════════════════════
 *
 * Cuarta vida de esta página. El encargo del dueño (29 ago 2026): una
 * landing PREMIUM, cinematográfica e inmersiva tipo marca automotriz de
 * alta gama (McLaren de referencia), con identidad propia de Bookea —
 * NO una landing de SaaS llena de cards. Negro profundo, tipografía
 * enorme, mucho espacio negativo, el azul de Bookea como único acento,
 * y una historia que se recorre con el scroll:
 *
 *   PROBLEMA → CREAR → QR → CLIENTE → VISITA → SELLOS → RECOMPENSA →
 *   DATOS → RETENCIÓN → BOOKEA
 *
 * El usuario tiene que entender en 10 segundos: «Bookea convierte
 * clientes ocasionales en frecuentes con un programa de lealtad
 * digital». CTA principal: CREAR MI PLAN DE LEALTAD.
 *
 * ── DÓNDE VIVE EL CÓMO ──────────────────────────────────────────────
 *
 * Toda la experiencia (motor de scroll, secciones, animaciones) está en
 * `experiencia-cinematografica.tsx`, con su sistema visual en
 * `cinematica.css`. Las pantallas del teléfono se reusan de
 * `historia-lealtad.tsx` (la vida anterior). El motor caliente escribe
 * un solo dato por scroll y transforms; el resto lo decide el CSS —
 * scroll nativo, GPU-friendly, sin librerías de animación ni WebGL,
 * por el requisito de rendimiento del encargo.
 *
 * ── LA REGLA DE SIEMPRE ─────────────────────────────────────────────
 *
 * No se presumen cifras de Bookea: «Mi Café», María Rodríguez y los
 * 1.284 clientes son utilería de la demo, y el tablero de datos lo dice
 * con su pastilla de «ejemplo ilustrativo».
 */

export const metadata: Metadata = {
  title: "Programa de Lealtad",
  description:
    "Bookea convierte clientes ocasionales en clientes frecuentes con un programa de lealtad digital. Creá el tuyo: tarjeta en Apple y Google Wallet, registro por QR, sellos y recompensas.",
  openGraph: {
    title: "Bookea Lealtad — Hacé que tus clientes vuelvan",
    description:
      "Creá tu programa de lealtad digital, conectá con tus clientes y convertí cada visita en una nueva oportunidad de venta.",
    type: "website",
  },
};

export default function AyudaLealtadPage() {
  return (
    // El nav de Lealtad va sobre el negro: el propio nav es claro y
    // flota; la experiencia trae su fondo. min-h-screen negro para que
    // no se cuele el blanco del layout durante la hidratación.
    <div className="min-h-screen bg-[#05070e]">
      <NavLealtad />
      <ExperienciaCinematografica />
    </div>
  );
}
