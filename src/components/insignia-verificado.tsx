import { IconCheck } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA INSIGNIA DE NEGOCIO VERIFICADO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): «los verificados, en lugar de
 * "Nuevo", tendrán un tag que diga Verificado y una insignia verde al
 * lado, pequeña».
 *
 * ── POR QUÉ VIVE ACÁ Y NO EN CADA TARJETA ───────────────────────────
 *
 * Seis tarjetas distintas la muestran (la principal, la grande de
 * Eventos, la vitrina y el carrusel de la portada, la del planificador
 * y la tira de destacados). Copiada seis veces, la primera vez que
 * alguien ajuste el verde va a ajustar cinco. Un sello de confianza que
 * se ve distinto según la pantalla deja de leerse como un sello.
 *
 * ── EL VERDE ES EL DE ACIERTO, NO UNO NUEVO ─────────────────────────
 *
 * MEDIDO, no elegido a ojo — y la primera versión de este comentario
 * tenía el número mal, que es exactamente el riesgo de no medir:
 *
 *   emerald-500 sobre blanco ...... 2,54:1  ✗  (el que uno agarra solo)
 *   emerald-600 sobre blanco ...... 3,77:1  ✗
 *   emerald-700 sobre blanco ...... 5,48:1  ✓
 *   emerald-700 sobre emerald-50 ... 5,21:1  ✓
 *
 * AA pide 4,5:1 para texto chico, así que el texto va en `emerald-700` y
 * NO en el verde intuitivo. En un elemento cuyo único trabajo es que se
 * le crea, un texto que cuesta leer trabaja en contra.
 *
 * El punto relleno usa `emerald-600` con el ✓ blanco: 3,77:1. Ahí el
 * mínimo es 3:1, el de objetos gráficos — el ✓ es decorativo y la
 * palabra ya lleva el dato.
 *
 * ── EL ✓ ES DECORATIVO, LA PALABRA ES EL DATO ───────────────────────
 *
 * `aria-hidden` en el ícono: quien escucha ya recibe «Verificado» del
 * texto, y anunciar además «marca de verificación» sería decir lo mismo
 * dos veces. La insignia NO se apoya solo en el color — dice la
 * palabra, así que también funciona para quien no distingue el verde.
 */
export default function InsigniaVerificado({
  /** `sobreFoto` = va encima de la imagen de la tarjeta y necesita
   *  fondo propio para despegarse de lo que tenga debajo. */
  sobreFoto = false,
}: {
  sobreFoto?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald-700 " +
        (sobreFoto
          ? "bg-white/95 shadow-sm backdrop-blur"
          : "bg-emerald-50 ring-1 ring-inset ring-emerald-600/20")
      }
    >
      {/* El punto verde: es «la insignia al lado» del pedido. Va antes
          de la palabra porque es lo que se reconoce de reojo, sin leer. */}
      <span
        aria-hidden
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600"
      >
        <IconCheck className="h-2.5 w-2.5 text-white" />
      </span>
      Verificado
    </span>
  );
}
