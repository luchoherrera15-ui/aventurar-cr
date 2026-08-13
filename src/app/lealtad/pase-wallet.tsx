import Image from "next/image";

/**
 * El pase, de verdad — no una tarjeta genérica con un logo. Calca los
 * detalles que hacen reconocible un pase de Apple Wallet o Google
 * Wallet a simple vista: las esquinas bien redondeadas de una tarjeta
 * física, la fila de campos (etiqueta chiquita arriba, valor abajo,
 * como en el pase real), el corte perforado con sus dos muescas — el
 * mismo troquel de un boleto de cine — separando el cuerpo del código
 * de barras, y el código en sí abajo, sobre fondo blanco como en
 * cualquier pase que se escanea en caja.
 *
 * Puramente presentacional: quien lo use pone su propio contenido en
 * la franja central (`children` — acá va la grilla de sellos animada)
 * y decide con qué texto llenar los campos. El corte perforado usa
 * `colorFondo` para simular el troquel: dos círculos del color de lo
 * que hay DETRÁS de la tarjeta (la pantalla del teléfono), no del
 * fondo de la página.
 */

const QR_FILAS = [
  [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1],
  [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1],
  [1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1],
  [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1],
  [1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0],
];

/** El QR del pie del pase — decorativo, no escaneable de verdad. */
export function QrDecorativo({ tamano = 74 }: { tamano?: number }) {
  return (
    <div
      className="grid shrink-0"
      style={{
        width: tamano,
        height: tamano,
        gridTemplateColumns: `repeat(${QR_FILAS[0].length}, 1fr)`,
        gridTemplateRows: `repeat(${QR_FILAS.length}, 1fr)`,
      }}
    >
      {QR_FILAS.flatMap((fila, y) =>
        fila.map((on, x) => (
          <span key={`${y}-${x}`} style={{ background: on ? "#14151a" : "transparent" }} />
        )),
      )}
    </div>
  );
}

export function PaseWallet({
  marca,
  negocio,
  etiquetaCampo,
  valorCampo,
  children,
  colorFondo = "#0a1226",
  serial = "BK · 7734 2201",
  foto,
}: {
  /** "apple" imita el pase oscuro y sobrio de Apple Wallet; "google"
   *  el cuerpo claro con banda de color de Google Wallet. */
  marca: "apple" | "google";
  negocio: string;
  etiquetaCampo: string;
  valorCampo: React.ReactNode;
  children: React.ReactNode;
  /** El color de lo que hay detrás del pase (la pantalla del
   *  teléfono), para que el corte perforado se vea como un troquel
   *  real y no como dos círculos pegados encima. */
  colorFondo?: string;
  serial?: string;
  /**
   * La banda del negocio. Es el `strip` de Apple Wallet y el
   * `heroImage` de Google: existe en el pase de verdad, así que
   * ponerla acá no es adorno de maqueta — es el pase completo.
   *
   * Opcional: sin foto, el pase queda como estaba.
   */
  foto?: string;
}) {
  const esApple = marca === "apple";
  return (
    <div
      className="relative overflow-hidden rounded-[26px]"
      style={{
        background: esApple
          ? "linear-gradient(165deg, #1c2d63 0%, #0e1638 62%, #070c1f 100%)"
          : "#f4f1ea",
        boxShadow: esApple
          ? "0 26px 46px -22px rgba(0,0,0,.75), inset 0 0 0 1px rgba(255,255,255,.08)"
          : "0 26px 46px -22px rgba(0,0,0,.5), inset 0 0 0 1px rgba(20,21,26,.06)",
      }}
    >
      {/* Encabezado: logo + tipo de pase, como la barra superior de
          cualquier pase abierto en Wallet. */}
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10.5px] font-extrabold"
            style={{
              background: esApple ? "#ee7420" : "#ffffff",
              color: esApple ? "#ffffff" : "#ee7420",
              boxShadow: esApple ? undefined : "inset 0 0 0 1.5px #ee7420",
            }}
          >
            B
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-[0.16em]"
            style={{ color: esApple ? "rgba(255,255,255,.55)" : "rgba(20,21,26,.5)" }}
          >
            {esApple ? "Apple Wallet" : "Google Wallet"}
          </span>
        </div>
        <span
          className="text-[8.5px] font-bold uppercase tracking-[0.14em]"
          style={{ color: esApple ? "rgba(255,255,255,.4)" : "rgba(20,21,26,.4)" }}
        >
          Tarjeta de sellos
        </span>
      </div>

      {/* ── La banda del negocio ────────────────────────────────────
          Va DEBAJO del encabezado y ENCIMA de los campos, que es donde
          Apple pone el `strip`. Sobria a propósito: 62px, medio
          desaturada y con un degradado que la funde con el cuerpo del
          pase. Una foto a todo color acá compite con el saldo, que es
          el único dato que el cliente viene a mirar. */}
      {foto && (
        <div className="relative mt-3 h-[62px] w-full overflow-hidden">
          <Image
            src={foto}
            alt=""
            fill
            sizes="320px"
            className="object-cover"
            style={{ filter: esApple ? "saturate(.75) brightness(.62)" : "saturate(.85)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: esApple
                ? "linear-gradient(to bottom, rgba(14,22,56,.35) 0%, rgba(14,22,56,.55) 55%, #0e1638 100%)"
                : "linear-gradient(to bottom, rgba(244,241,234,0) 40%, #f4f1ea 100%)",
            }}
          />
        </div>
      )}

      {/* Fila de campos, igual que un pase real: etiqueta chiquita
          arriba, valor grande abajo. */}
      <div className={`${foto ? "mt-2" : "mt-3"} flex items-end justify-between px-4`}>
        <div>
          <p
            className="text-[8px] font-bold uppercase tracking-[0.14em]"
            style={{ color: esApple ? "rgba(255,255,255,.4)" : "rgba(20,21,26,.42)" }}
          >
            Negocio
          </p>
          <p
            className="mt-0.5 text-[14px] font-extrabold leading-none"
            style={{ color: esApple ? "#ffffff" : "#14151a" }}
          >
            {negocio}
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[8px] font-bold uppercase tracking-[0.14em]"
            style={{ color: esApple ? "rgba(255,255,255,.4)" : "rgba(20,21,26,.42)" }}
          >
            {etiquetaCampo}
          </p>
          <p
            className="mt-0.5 text-[14px] font-extrabold leading-none"
            style={{ color: "#ee7420" }}
          >
            {valorCampo}
          </p>
        </div>
      </div>

      {/* La franja central: acá cae la grilla de sellos que le pase
          quien use el componente. */}
      <div className="mt-3.5 px-4">{children}</div>

      {/* El corte perforado — el troquel de boleto que separa el
          cuerpo del pase de su código. */}
      <div className="relative mt-4 h-0">
        <span
          className="absolute -left-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full"
          style={{ background: colorFondo }}
        />
        <span
          className="absolute -right-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full"
          style={{ background: colorFondo }}
        />
        <div
          className="mx-[18px] border-t border-dashed"
          style={{ borderColor: esApple ? "rgba(255,255,255,.22)" : "rgba(20,21,26,.16)" }}
        />
      </div>

      {/* El código, como en cualquier pase que se escanea en caja. */}
      <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-4">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl bg-white p-2"
          style={{ boxShadow: "0 6px 16px -8px rgba(0,0,0,.4)" }}
        >
          <QrDecorativo tamano={58} />
        </div>
        <div className="min-w-0 text-right">
          <p
            className="font-mono text-[10px] font-bold tracking-wider"
            style={{ color: esApple ? "rgba(255,255,255,.55)" : "rgba(20,21,26,.5)" }}
          >
            {serial}
          </p>
          <p
            className="mt-1 text-[8.5px] leading-snug"
            style={{ color: esApple ? "rgba(255,255,255,.35)" : "rgba(20,21,26,.35)" }}
          >
            Mostrá este código
            <br />
            para sumar o canjear
          </p>
        </div>
      </div>
    </div>
  );
}
