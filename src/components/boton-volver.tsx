"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronLeft } from "@/components/icons";

/**
 * VOLVER — un paso atrás de verdad, no un salto al inicio.
 *
 * Acá había un `<Link href="/">` que decía «Volver al inicio». El texto
 * era honesto pero el comportamiento estaba mal para lo que la gente
 * espera de una flecha: quien entró a `/mi-negocio` desde su panel, o
 * desde un correo, o desde la ficha de su propio negocio, tocaba
 * «volver» y aterrizaba en la portada del marketplace — lejísimos de
 * donde estaba.
 *
 * ── EL RESPALDO NO ES OPCIONAL ──────────────────────────────────────
 *
 * `router.back()` no hace NADA cuando no hay historial: alguien que
 * abrió el link en una pestaña nueva, o que llegó pegando la URL, se
 * queda tocando un botón muerto sin ninguna señal de que pasó algo.
 *
 * Por eso se mira `window.history.length` antes. Es una aproximación
 * —el navegador no dice de dónde viene cada entrada— pero distingue el
 * caso que importa: una pestaña recién abierta tiene una sola entrada.
 * Ahí se navega a `destino` en vez de no hacer nada.
 *
 * ══════════════════════════════════════════════════════════════════
 *  AHORA ES UNA TARJETA, NO UN TEXTO (dueño, 3 sep 2026)
 * ══════════════════════════════════════════════════════════════════
 *
 * «Todos esos botones que dicen volver que están en texto, poné cards
 * y hacelos más profesionales, con iconos también».
 *
 * Antes cada pantalla escribía su propio «← Volver a …»: un `<Link>`
 * con una flecha de texto, tamaño y color elegidos a ojo, distintos en
 * cada lugar. Tres problemas de una vez:
 *
 *   · no se leía como un control — parecía una nota al pie;
 *   · el área tocable era la del texto, muy por debajo de los 44 px
 *     que necesita un dedo;
 *   · la «flecha» era el carácter «←», que cada sistema dibuja con su
 *     propia fuente y termina desalineado del texto.
 *
 * Ahora es una superficie con borde, su ícono de verdad y el alto
 * mínimo del estándar táctil. Sigue siendo NEUTRA a propósito: volver
 * nunca es la acción principal de una pantalla, así que se nota al
 * buscarla y no compite con lo que la persona vino a hacer.
 *
 * ── LOS TRES MODOS ────────────────────────────────────────────────
 * Sin nada  → un paso atrás en el historial (el comportamiento
 *             original, con su respaldo a `destino`).
 * `href`    → navegación explícita, cuando el destino es conocido y no
 *             se quiere depender del historial.
 * `onClick` → para un asistente que retrocede sin cambiar de URL.
 *
 * El texto entra por `children` o por `etiqueta`; se conservan las dos
 * formas porque las pantallas viejas usan `etiqueta`.
 */
export default function BotonVolver({
  destino = "/",
  etiqueta = "Volver",
  href,
  onClick,
  children,
  className = "",
}: {
  /** A dónde ir cuando no hay historial que deshacer. */
  destino?: string;
  etiqueta?: string;
  /** Navegación explícita: gana sobre el historial. */
  href?: string;
  /** Retroceso dentro de la misma pantalla (asistentes). */
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  const clases =
    "presionable inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-bookea-linea bg-white px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft shadow-plano transition-colors hover:border-bookea-azul/40 hover:text-aventurea-ink " +
    className;

  const contenido = (
    <>
      <IconChevronLeft className="h-4 w-4 shrink-0" />
      {children ?? etiqueta}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={clases}>
        {contenido}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={
        onClick ??
        (() => {
          if (typeof window !== "undefined" && window.history.length > 1) router.back();
          else router.push(destino);
        })
      }
      className={clases}
    >
      {contenido}
    </button>
  );
}
