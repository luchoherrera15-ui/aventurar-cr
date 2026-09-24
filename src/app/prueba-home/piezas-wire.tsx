import type { ReactNode } from "react";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL LENGUAJE DE LOS WIREFRAMES — cinco piezas y nada más
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «dame 20 diseños de cómo podríamos
 * hacer el home para ver cuál decidimos, pensá como un verdadero
 * diseñador de sitios web».
 *
 * Un diseñador no entrega 20 páginas terminadas: entrega 20 MINIATURAS
 * para que el cliente descarte 17 en dos minutos, y recién ahí dibuja
 * las tres que quedaron. Esto es esa primera tanda.
 *
 * ── POR QUÉ SON GRISES Y NO TIENEN TEXTO DE VERDAD ──────────────────
 *
 * Porque lo que se está eligiendo es la ESTRUCTURA, no el contenido. Si
 * cada miniatura llevara su titular y sus fotos, la decisión se la
 * llevaría la foto más linda y no la composición — que es justamente lo
 * que hay que comparar. Al quitar el color y la letra, lo único que
 * queda para juzgar es dónde está cada cosa y qué tan grande es.
 *
 * Las cinco piezas alcanzan para dibujar cualquier home:
 *
 *   `L`       un renglón de texto (grueso = titular)
 *   `Caja`    un bloque: una tarjeta, un mockup, una foto
 *   `Tel`     la silueta de un teléfono
 *   `Barra`   la barra de navegación
 *   `Lienzo`  el marco de la pantalla, claro u oscuro
 *
 * `acento` marca lo que el ojo tiene que ver primero. En cada wireframe
 * hay UNA sola cosa acentuada: si hay dos, el diseño no tiene jerarquía
 * y eso es exactamente lo que la miniatura debería delatar.
 */

/** Un renglón de texto. `fuerte` = titular. */
export function L({
  w = "100%",
  h = 5,
  fuerte = false,
  claro = false,
}: {
  w?: string;
  h?: number;
  fuerte?: boolean;
  claro?: boolean;
}) {
  return (
    <div
      style={{ width: w, height: h }}
      className={`rounded-full ${
        claro
          ? fuerte
            ? "bg-white"
            : "bg-white/40"
          : fuerte
            ? "bg-[color:var(--tinta)]"
            : "bg-[color:var(--tinta-tenue)]"
      }`}
    />
  );
}

/** Un bloque: una tarjeta, un mockup, una foto. */
export function Caja({
  h,
  className = "",
  acento = false,
  oscuro = false,
  children,
}: {
  h?: number;
  className?: string;
  acento?: boolean;
  oscuro?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      style={h ? { height: h } : undefined}
      className={`overflow-hidden rounded-[4px] ${
        acento
          ? "bg-[color:var(--acento-suave)] ring-1 ring-[color:var(--acento)]"
          : oscuro
            ? "bg-[color:var(--tinta)]"
            : "bg-[color:var(--superficie-2)]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** La silueta de un teléfono. */
export function Tel({
  h = 64,
  w = 30,
  acento = false,
  className = "",
}: {
  h?: number;
  w?: number;
  acento?: boolean;
  className?: string;
}) {
  return (
    <div
      style={{ height: h, width: w }}
      className={`shrink-0 rounded-[5px] border ${
        acento
          ? "border-[color:var(--acento)] bg-[color:var(--acento-suave)]"
          : "border-[color:var(--tinta-tenue)] bg-white"
      } ${className}`}
    >
      <div className="mx-auto mt-1 h-[2px] w-[8px] rounded-full bg-[color:var(--tinta-tenue)]" />
    </div>
  );
}

/** La barra de navegación. */
export function Barra({ claro = false }: { claro?: boolean }) {
  return (
    <div
      className={`mb-2.5 flex items-center justify-between border-b pb-2 ${
        claro ? "border-white/20" : "border-[color:var(--linea)]"
      }`}
    >
      <L w="22px" h={6} fuerte claro={claro} />
      <div className="flex gap-1.5">
        <L w="14px" h={4} claro={claro} />
        <L w="14px" h={4} claro={claro} />
        <L w="14px" h={4} claro={claro} />
      </div>
      <L w="18px" h={7} fuerte claro={claro} />
    </div>
  );
}

/**
 * El marco de la miniatura.
 *
 * Alto FIJO: 20 pantallas de distinto alto no se pueden comparar de un
 * vistazo, que es lo único que esta página tiene que permitir. El que
 * pide más scroll lo dice en su ficha, no estirándose.
 */
export function Lienzo({
  children,
  oscuro = false,
}: {
  children: ReactNode;
  oscuro?: boolean;
}) {
  return (
    <div
      className={`h-[196px] overflow-hidden rounded-[8px] border p-3 ${
        oscuro
          ? "border-[color:var(--tinta)] bg-[color:var(--tinta)]"
          : "border-[color:var(--linea)] bg-white"
      }`}
    >
      {children}
    </div>
  );
}

/** El bloque de titular + bajada + botón, centrado. */
export function TituloCentrado({
  ancho = "66%",
  claro = false,
  boton = true,
}: {
  ancho?: string;
  claro?: boolean;
  boton?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <L w={ancho} h={9} fuerte claro={claro} />
      <L w="48%" h={9} fuerte claro={claro} />
      <div className="mt-1 flex flex-col items-center gap-1">
        <L w="54%" h={4} claro={claro} />
        <L w="40%" h={4} claro={claro} />
      </div>
      {boton ? (
        <div className="mt-1.5 flex gap-1.5">
          <L w="34px" h={10} fuerte claro={claro} />
          <L w="34px" h={10} claro={claro} />
        </div>
      ) : null}
    </div>
  );
}

/** El bloque de titular alineado a la izquierda. */
export function TituloIzquierda({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <L w="88%" h={9} fuerte claro={claro} />
      <L w="64%" h={9} fuerte claro={claro} />
      <div className="mt-1 flex flex-col gap-1">
        <L w="92%" h={4} claro={claro} />
        <L w="70%" h={4} claro={claro} />
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <L w="34px" h={10} fuerte claro={claro} />
        <L w="28px" h={10} claro={claro} />
      </div>
    </div>
  );
}
