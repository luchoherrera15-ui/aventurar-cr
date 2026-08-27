import Link from "next/link";

/**
 * EL BOTÓN «¡Creá tu tarjeta de fidelidad gratis!».
 *
 * ── AGO 2026: VUELVE A SER UN LINK, NO UN DISPARADOR ───────────────
 * Durante una pasada este botón revelaba el configurador embebido a
 * mitad de la landing (`RevelarConfigurador`). Pedido del dueño: que
 * abra la pantalla propia `/lealtad/crear`, en blanco, aparte de la
 * landing. Armar la tarjeta es una tarea con principio y fin y
 * merece su pantalla: en la landing quedaba compitiendo con nueve
 * secciones de marketing, y la persona que ya decidió crear su pase
 * no necesita que le sigan vendiendo el producto mientras lo arma.
 *
 * Al dejar de ser un `onClick` vuelve a ser un componente de
 * SERVIDOR: un `<Link>` de verdad, que se puede abrir en otra
 * pestaña, copiar, indexar y precargar. Un `<button>` con
 * `router.push` no hace ninguna de esas cuatro cosas.
 *
 * `variante`: "primario" es el navy sólido del hero; "oscuro" es el
 * mismo botón sobre la franja navy del cierre (ahí el azul de acción
 * desaparece — usa el par claro, igual que el resto de la landing).
 */
export default function BotonCrearPase({
  variante = "primario",
  grande = false,
  children,
}: {
  variante?: "primario" | "oscuro";
  /** El del hero (0163: pedido del dueño, "hazlo más grande"). */
  grande?: boolean;
  children: React.ReactNode;
}) {
  const estilo =
    variante === "primario"
      ? {
          background: "#0a1226",
          color: "#ffffff",
          boxShadow: "0 6px 16px -10px rgba(10,18,38,.45)",
        }
      : {
          background: "var(--accion-claro)",
          color: "var(--accion-claro-tinta)",
        };

  return (
    <Link
      href="/lealtad/crear"
      /* `grupo-gratis`: el hover que agranda la palabra se dispara
         desde ACÁ, desde el botón entero. Ver `globals.css`.

         ⚠️ SIN `overflow-hidden` NI `hover:scale`. La palabra tiene
         que poder desbordar la caja del botón, y cualquiera de las dos
         cosas la volvería a meter adentro. */
      className={`grupo-gratis presionable inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 ${
        grande ? "px-8 py-4.5 text-[17px] sm:text-[18px]" : "px-6 py-3.5 text-[14px]"
      }`}
      style={estilo}
    >
      {children}
    </Link>
  );
}
