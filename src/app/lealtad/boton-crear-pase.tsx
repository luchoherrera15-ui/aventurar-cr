import Link from "next/link";

/**
 * EL BOTÓN «¡Creá tu pase de lealtad!» — desde ago 2026 lleva a la
 * PANTALLA DEDICADA `/lealtad/crear` (pedido del dueño), en vez de
 * desplegar el configurador a mitad de la landing como hacía antes.
 *
 * Con eso deja de necesitar estado: es un `<Link>` de servidor, no un
 * client component con un CustomEvent — armar la tarjeta es una tarea
 * con su propia pantalla, no una sección que se abre.
 *
 * `variante`: "primario" es el gradiente azul del hero; "oscuro" es el
 * mismo botón sobre la franja navy del cierre (ahí el azul de acción
 * desaparece — usa el par claro, igual que el resto de la landing).
 */
export default function BotonCrearPase({
  variante = "primario",
  children,
}: {
  variante?: "primario" | "oscuro";
  children: React.ReactNode;
}) {
  const estilo =
    variante === "primario"
      ? {
          background: "linear-gradient(135deg,#0b3168,#0f4c9e 55%,#3672c9)",
          color: "#ffffff",
          boxShadow: "0 14px 34px rgba(15,60,130,.28)",
        }
      : {
          background: "var(--accion-claro)",
          color: "var(--accion-claro-tinta)",
        };

  return (
    <Link
      href="/lealtad/crear"
      className="presionable inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[15px] font-extrabold transition-transform hover:-translate-y-0.5"
      style={estilo}
    >
      {children}
    </Link>
  );
}
