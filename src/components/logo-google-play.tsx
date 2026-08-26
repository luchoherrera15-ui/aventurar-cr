/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MARK DE GOOGLE PLAY — uno solo, y el de verdad
 * ════════════════════════════════════════════════════════════════════
 *
 * Había DOS versiones distintas del logo en el repo, y las dos mal:
 *
 *   · `home/buscador-hero.tsx` lo pintaba de UN SOLO COLOR, en el navy
 *     de Bookea. Eso no es el logo de Google Play — y recolorear el
 *     mark de otra marca a la propia es justo lo que sus guías no
 *     permiten.
 *   · `publicar/page.tsx` sí tenía cuatro caras, pero con acentos
 *     pastel de Material (`#69f0ae`, `#40c4ff`, `#ffd740`, `#ff5252`)
 *     en vez de los colores de la marca.
 *
 * Acá vive UNA vez, con los colores correctos. Sin `"use client"`: es
 * markup puro sin estado ni hooks, así que lo puede montar tanto una
 * página de servidor como un componente de cliente.
 *
 * ── DE DÓNDE SALEN LOS NÚMEROS ──────────────────────────────────────
 *
 * No están elegidos a ojo. En la caja de 24×24 el mark tiene cuatro
 * vértices:
 *
 *     A (3,6 · 2,3)    la esquina de arriba a la izquierda
 *     B (3,6 · 21,7)   la de abajo
 *     C (13,4 · 12)    el pliegue central, donde se juntan las cuatro caras
 *     R (20,7 · 12)    la punta
 *
 * El rombo amarillo arranca en x=17. El 9,9 y el 14,1 son los puntos
 * EXACTOS donde las aristas A→R y B→R cruzan esa vertical:
 *
 *     t  = (17 − 3,6) / (20,7 − 3,6) = 0,784
 *     y  = 2,3 + t · (12 − 2,3)      = 9,9      (y su espejo, 14,1)
 *
 * Por eso las cuatro caras cierran sin dejar un hueco blanco entre
 * ellas — que es exactamente lo que pasaba en el primer intento, con
 * los vértices puestos a mano.
 *
 * Se renderizó a PNG y se miró antes de subirlo. Si alguien toca estos
 * números, que vuelva a mirarlo: un logo de otra marca mal dibujado se
 * nota más que uno feo propio.
 */
export default function LogoGooglePlay({ className = "h-6 w-6 shrink-0" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      {/* La cara izquierda: del borde vertical al pliegue. */}
      <path fill="#00A0FF" d="M3.6 2.3 13.4 12 3.6 21.7Z" />
      {/* La de arriba y la de abajo, hasta donde empieza el rombo. */}
      <path fill="#00CF76" d="M3.6 2.3 17 9.9 13.4 12Z" />
      <path fill="#FF3A44" d="M3.6 21.7 17 14.1 13.4 12Z" />
      {/* La punta. */}
      <path fill="#FFBC00" d="M13.4 12 17 9.9 20.7 12 17 14.1Z" />
    </svg>
  );
}
