import { toString as qrATexto } from "qrcode";

/**
 * Las dos piezas que se repiten en los cuatro boxes de /demo: el
 * TELÉFONO con el pase adentro y el QR con el que ese pase se instala
 * de verdad en un iPhone o un Android.
 *
 * Server components puros (nada de "use client"): el QR se dibuja en el
 * servidor como SVG con la librería `qrcode` que ya usa el panel
 * (`panel/[id]/compartir-tarjeta.tsx`) — sin canvas, sin JavaScript en
 * el navegador y sin pixelarse a ningún tamaño.
 */

/**
 * EL TELÉFONO. Dibujado —no es una foto— con el mismo lenguaje que
 * `src/app/lealtad/mockup-hero-pase.tsx`: marco en degradado, isla
 * dinámica, barra de estado, encabezado de Wallet y el botón de
 * agregar al pie.
 *
 * Dos diferencias a propósito con el del hero: es un poco más ancho
 * (320px contra 300) para que los pases de 300px entren sin recortarse,
 * y NO lleva altura fija — los cuatro pases miden distinto y una altura
 * fija le cortaría la tira de sellos a alguno.
 */
export function TelefonoConPase({
  children,
  etiqueta,
}: {
  children: React.ReactNode;
  /** Para lectores de pantalla: de quién es la tarjeta que se ve. */
  etiqueta: string;
}) {
  return (
    <div
      className="relative mx-auto w-[300px] rounded-[46px] p-[10px] sm:w-[320px]"
      style={{
        background: "linear-gradient(145deg,#131a2b,#414a60 50%,#0b0f19)",
        boxShadow: "0 50px 90px -30px rgba(0,0,0,.85), 0 10px 28px rgba(0,0,0,.45)",
      }}
      role="img"
      aria-label={`Teléfono mostrando la tarjeta de ${etiqueta} dentro de la app Wallet`}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-[16px] z-[8] h-[26px] w-[100px] -translate-x-1/2 rounded-[18px] bg-[#05070d]"
      />
      <div aria-hidden className="relative overflow-hidden rounded-[38px] bg-[#f7f8fb] pb-5">
        <div className="flex justify-between px-5 pt-4 text-[11px] font-bold text-[#0d1733]">
          <span>9:41</span>
          <span>● ◒ ▰</span>
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <span className="text-[22px] font-extrabold text-[#0d1733]">Wallet</span>
          <span className="text-[19px] text-[#0d1733]/60">⊕</span>
        </div>

        {/* El pase, tal cual, con el ancho que le deja el teléfono. */}
        <div className="px-3">{children}</div>

        <div className="mx-4 mt-4 rounded-xl border border-[#e6e8ee] bg-white py-2.5 text-center text-[11px] font-bold text-[#0d1733]">
           Agregar a Apple Wallet
        </div>
        <span className="mx-auto mt-4 block h-[5px] w-[110px] rounded-full bg-[#0d1733]/25" />
      </div>
    </div>
  );
}

/**
 * EL QR QUE DE VERDAD INSTALA LA TARJETA.
 *
 * `real` decide qué se promete, y es lo único que decide: cuando el
 * programa demo está sembrado y emitiendo, el QR abre /tarjeta/{slug}
 * —la MISMA puerta que usa un cliente en el mostrador de un negocio de
 * verdad— y el teléfono se lleva el pase. Cuando no lo está, el QR
 * lleva a /lealtad/crear y el texto lo dice con todas las letras. Lo
 * que nunca hay es un QR muerto.
 *
 * El link va además como enlace de texto: quien lea esto en la misma
 * pantalla donde estaría la cámara no tiene cómo escanearse a sí mismo,
 * y quien navegue por teclado tampoco.
 */
export async function QrInstalacion({
  url,
  real,
  negocio,
  acento,
}: {
  url: string;
  /** true = el QR abre la tarjeta sembrada; false = es de ejemplo. */
  real: boolean;
  negocio: string;
  acento: string;
}) {
  // Nivel M y margen 2: legible impreso chico y con brillo — el mismo
  // ajuste que el QR del mostrador (compartir-tarjeta.tsx).
  const svg = await qrATexto(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#0a1226", light: "#ffffff" },
  });

  return (
    <div
      className="mx-auto flex w-[300px] items-center gap-4 rounded-2xl border p-3 sm:w-[320px]"
      style={{
        borderColor: `${acento}33`,
        background: "rgba(255,255,255,.04)",
      }}
    >
      <div
        className="qr-claro h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
        role="img"
        aria-label={
          real
            ? `Código QR: al escanearlo se abre la tarjeta de ${negocio} para agregarla al Wallet`
            : `Código QR: al escanearlo se abre el creador de tarjetas de Bookea Lealtad`
        }
        // El SVG lo genera la librería `qrcode` a partir de una URL que
        // armamos nosotros, nunca de texto que escriba alguien.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0">
        <p className="text-[12.5px] font-extrabold leading-tight text-white">
          {real ? "Escaneá y llevátela al teléfono" : "Pase de ejemplo"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-white/60">
          {real
            ? "Apple Wallet o Google Wallet. No hay app que instalar."
            : "Esta tarjeta todavía no está publicada: el QR abre el creador de Bookea Lealtad."}
        </p>
        <a
          href={url}
          className="mt-1.5 inline-block break-all text-[10.5px] font-bold underline decoration-dotted underline-offset-2"
          style={{ color: acento }}
        >
          {url.replace(/^https:\/\//, "")}
        </a>
      </div>
    </div>
  );
}
