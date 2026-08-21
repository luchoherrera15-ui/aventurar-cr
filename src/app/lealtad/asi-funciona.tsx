import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * "ASÍ FUNCIONA" — timeline editorial, no cuatro cards idénticas.
 *
 * El pedido explícito del rediseño fue "preferir una composición
 * editorial/visual antes que cuatro cards idénticas": la versión previa
 * era exactamente eso (tres <li> con el mismo borde, la misma sombra, el
 * mismo layout). Acá el número es el protagonista —una cifra fantasma
 * detrás del ícono, como en una revista— y los pasos pares se corren
 * hacia abajo en desktop (`lg:mt-16`) para que la fila se lea como un
 * recorrido con ritmo y no como una grilla.
 *
 * Server Component: la única animación es el reveal-on-scroll de
 * siempre (`data-reveal`), que ya cubre RevealOnScroll — no hace falta
 * JS propio.
 */

const PASOS: { icono: NombreIcono; titulo: string; texto: string; detalle: string }[] = [
  {
    icono: "tarjeta",
    titulo: "Armás tu tarjeta",
    texto:
      "Elegís el tipo (sellos, puntos, cupón…), ponés tus colores y tu logo, y decidís qué se gana. La vas viendo en el teléfono mientras la armás.",
    detalle: "Cinco pasos · sin diseñador",
  },
  {
    icono: "qr",
    titulo: "La compartís",
    texto:
      "Imprimís el póster para tu mostrador o mandás el link por WhatsApp. Quien lo abre agrega la tarjeta a su Wallet y queda afiliado solo.",
    detalle: "QR y link · sin app que instalar",
  },
  {
    icono: "escanear",
    titulo: "Sellás cada visita",
    texto:
      "En cada visita escaneás su código desde el panel. El sello entra y la tarjeta se actualiza sola en su teléfono.",
    detalle: "Un escaneo · el saldo lo lleva el sistema",
  },
  {
    icono: "regalo",
    titulo: "Vuelve por su recompensa",
    texto:
      "Cuando le falta uno o completa la meta, le llega un aviso solo — nadie en tu negocio tiene que acordarse de escribirle. Cobra el premio y la tarjeta arranca otra vuelta.",
    detalle: "Automático · sin que nadie esté pendiente",
  },
];

export default function AsiFunciona() {
  return (
    <ol className="relative mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-5">
      {/* La línea de fondo, solo en desktop: no conecta puntos como el
          recorrido del mostrador (esa es OTRA metáfora, la de una
          visita puntual) — acá es apenas un trazo que sugiere que los
          cuatro pasos son un solo camino. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-[58px] hidden h-px lg:block"
        style={{ background: "rgba(6,38,83,.1)" }}
      />

      {PASOS.map((p, i) => (
        <li
          key={p.titulo}
          data-reveal
          style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
          className={i % 2 === 1 ? "lg:mt-16" : ""}
        >
          <div className="relative">
            {/* La cifra fantasma: el número es lo primero que el ojo
                agarra, y por eso va grande y detrás — no adentro de un
                disco chiquito como una card genérica. */}
            <span
              aria-hidden
              className="titulo pointer-events-none absolute -top-3 left-0 text-[72px] leading-none text-aventurea-navy/[0.07] sm:text-[84px]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className="relative grid h-11 w-11 place-items-center rounded-2xl"
              style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
            >
              <Icono nombre={p.icono} className="h-5 w-5" />
            </span>
          </div>
          <h3 className="relative mt-4 text-[16.5px] font-extrabold leading-tight text-aventurea-navy">
            {p.titulo}
          </h3>
          <p className="relative mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
            {p.texto}
          </p>
          <p className="relative mt-3 text-[12px] font-bold text-[color:var(--accion)]">
            {p.detalle}
          </p>
        </li>
      ))}
    </ol>
  );
}
