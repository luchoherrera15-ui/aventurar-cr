import { toString as qrATexto } from "qrcode";

/**
 * El link y el QR con los que el negocio reparte su tarjeta. Es la
 * respuesta a "¿y cómo la consiguen mis clientes?": este QR va impreso
 * en el mostrador, el link va por WhatsApp o redes, y los dos caen en
 * /tarjeta/{slug}, donde el cliente la agrega a su Wallet.
 *
 * El QR se genera EN EL SERVIDOR como SVG puro: nada de canvas ni de
 * librerías en el navegador, y se puede imprimir a cualquier tamaño
 * sin pixelarse.
 */
const SITIO = "https://www.bookea.lat";

export default async function CompartirTarjeta({
  slug,
  programaActivo,
}: {
  slug: string | null;
  programaActivo: boolean;
}) {
  if (!slug) return null;

  const url = `${SITIO}/tarjeta/${slug}`;

  // margin 2 y nivel M: legible impreso chico en un mostrador con
  // brillo — el caso real, no el ideal.
  const svg = await qrATexto(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#0a1226", light: "#ffffff" },
  });

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Compartí tu tarjeta</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Tus clientes la consiguen acá: imprimí el QR para el mostrador o mandá el link
        por WhatsApp. Al abrirlo agregan la tarjeta a su Wallet — y quedan afiliados
        solos.
      </p>

      {!programaActivo && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-800">
          El programa no está activo: el link va a responder “no encontrado”. Escribile
          a Bookea para activarlo o reanudarlo.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div
          className="qr-claro h-36 w-36 shrink-0 overflow-hidden rounded-xl border border-aventurea-line bg-white [&_svg]:h-full [&_svg]:w-full"
          // El SVG viene de la librería `qrcode` con datos generados por
          // nosotros (la URL de arriba), no de entrada del usuario.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            El link
          </p>
          <p className="mt-1 break-all rounded-lg bg-aventurea-cream-2 px-3 py-2 font-mono text-[12.5px] text-aventurea-ink">
            {url}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[12.5px] font-bold text-aventurea-navy underline"
          >
            Ver la página como la ve tu cliente →
          </a>
        </div>
      </div>
    </div>
  );
}
