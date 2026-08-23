import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * LOS CUATRO PILARES — contra qué compite Bookea Lealtad, con el disco
 * de ícono convertido en una mini-maqueta que reacciona al pasar el
 * mouse (pedido del dueño, ago 2026: "¿esos íconos podemos hacer como
 * mockups interactivos?").
 *
 * Cada uno es una capacidad que el producto TIENE hoy, no una promesa:
 * el pase en Wallet nativo, el refresco silencioso del pase, los
 * anuncios push (con ubicaciones en los paquetes que las incluyen) y la
 * identidad por persona detrás de cada sello. El `contraste` es la
 * mitad que hace el trabajo: sin él cada card es una característica
 * suelta; con él, cada card es una razón para dejar el cartón.
 *
 * Puramente decorativo: pasar el mouse no revela información nueva, la
 * tarjeta ya dice todo con el texto quieto. Por eso no hace falta un
 * gesto equivalente para el teléfono (regla de motion del sistema: el
 * hover que SÍ hace falta duplicar es el que esconde contenido, y acá
 * no esconde nada) — es azúcar, y `motion-reduce:` la apaga entera para
 * quien pidió menos movimiento, sin que la tarjeta pierda una letra.
 */

const PILARES: {
  icono: NombreIcono;
  titulo: string;
  texto: string;
  contraste: string;
}[] = [
  {
    icono: "movil",
    titulo: "No se pierde ni se moja",
    texto:
      "La tarjeta vive en la billetera del teléfono, al lado de la del banco y del pase de abordar. El cliente la trae encima siempre, sin acordarse de nada.",
    contraste: "El cartón se arruga, se moja y termina en la guantera.",
  },
  {
    icono: "repetir",
    titulo: "Se actualiza sola",
    texto:
      "Escaneás su código y el conteo cambia en su teléfono en el momento. No tiene que abrir una app, ni refrescar, ni pedirte que le cuentes cuántos lleva.",
    contraste: "En papel, el saldo solo existe cuando alguien lo busca.",
  },
  {
    icono: "campana",
    titulo: "Le podés escribir",
    texto:
      "Un anuncio tuyo le aparece en la pantalla de bloqueo. Y con los paquetes que traen ubicaciones, le aparece justo cuando pasa cerca de tu local.",
    contraste: "Una tarjeta de cartón no avisa nada, nunca.",
  },
  {
    icono: "clientes",
    titulo: "Sabés quién vuelve",
    texto:
      "Cada sello queda con nombre. Tu panel te dice quiénes son los de siempre, quiénes hace rato no aparecen y quién está por llegar a su premio.",
    contraste: "Con sellos de hule no sabés ni cuántas tarjetas repartiste.",
  },
];

/** La transición que comparten las cuatro mini-maquetas: los tokens del
 *  sistema (200ms, `--ease-bookea`), nunca los valores de fábrica de
 *  Tailwind. */
const TRANSICION = {
  transitionDuration: "var(--duracion-micro)",
  transitionTimingFunction: "var(--ease-bookea)",
};

/** El disco base, común a las cuatro — lo que cambia es lo que se le
 *  agrega encima al pasar el mouse. */
function DiscoIcono({
  icono,
  children,
}: {
  icono: NombreIcono;
  children?: React.ReactNode;
}) {
  return (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center">
      <span
        className="grid h-10 w-10 place-items-center rounded-xl transition-colors group-hover:bg-[color:var(--accion)] group-hover:text-white"
        style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)", ...TRANSICION }}
      >
        <Icono
          nombre={icono}
          className="h-[18px] w-[18px] motion-reduce:!transition-none"
        />
      </span>
      {children}
    </span>
  );
}

/** El check de confirmación que comparten «No se pierde ni se moja»
 *  (pegado al teléfono, como si el pase acabara de guardarse solo) y
 *  «Sabés quién vuelve» (como si ese cliente ya estuviera identificado
 *  en el panel) — misma idea de fondo, "esto ya quedó resuelto solo",
 *  contada con el ícono que le toca a cada uno. */
function MockupCheckBadge({ icono }: { icono: NombreIcono }) {
  return (
    <DiscoIcono icono={icono}>
      <span
        aria-hidden
        className="absolute -bottom-1 -right-1 grid h-[18px] w-[18px] scale-50 place-items-center rounded-full text-white opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none"
        style={{ background: "var(--accion)", boxShadow: "0 0 0 2px #fff", ...TRANSICION }}
      >
        <Icono nombre="listo" className="h-2.5 w-2.5" />
      </span>
    </DiscoIcono>
  );
}

/** «Se actualiza sola»: el ícono de repetir gira una vuelta entera, la
 *  misma metáfora que un botón de refrescar. */
function MockupSeActualiza() {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors group-hover:bg-[color:var(--accion)] group-hover:text-white"
      style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)", ...TRANSICION }}
    >
      <Icono
        nombre="repetir"
        className="h-[18px] w-[18px] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[360deg] motion-reduce:transition-none motion-reduce:group-hover:rotate-0"
      />
    </span>
  );
}

/** «Le podés escribir»: un punto de aviso aparece sobre la campana,
 *  como la notificación que el texto de al lado describe. */
function MockupLePodesEscribir() {
  return (
    <DiscoIcono icono="campana">
      <span
        aria-hidden
        className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 scale-50 rounded-full opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none"
        style={{ background: "var(--orange)", boxShadow: "0 0 0 2px #fff", ...TRANSICION }}
      />
    </DiscoIcono>
  );
}

const MOCKUPS: Record<string, () => React.ReactNode> = {
  movil: () => <MockupCheckBadge icono="movil" />,
  repetir: MockupSeActualiza,
  campana: MockupLePodesEscribir,
  clientes: () => <MockupCheckBadge icono="clientes" />,
};

export default function PilaresInteractivos() {
  return (
    <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PILARES.map((pilar, i) => {
        const Mockup = MOCKUPS[pilar.icono];
        return (
          <div
            key={pilar.titulo}
            data-reveal
            className="group flex flex-col rounded-2xl border border-aventurea-line bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accion)]/40 hover:shadow-[0_8px_24px_-16px_rgba(22,41,94,0.35)]"
            style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
          >
            <div className="flex items-center justify-between">
              {Mockup ? <Mockup /> : <DiscoIcono icono={pilar.icono} />}
              <span className="rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-bold leading-tight text-aventurea-navy">
              {pilar.titulo}
            </h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-aventurea-ink-soft">
              {pilar.texto}
            </p>
            <p className="mt-3.5 border-t border-aventurea-line pt-3 text-[11.5px] font-semibold text-aventurea-ink-soft/75">
              <span aria-hidden className="mr-1.5 text-red-400">
                ✕
              </span>
              {pilar.contraste}
            </p>
          </div>
        );
      })}
    </div>
  );
}
