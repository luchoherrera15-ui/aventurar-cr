import Link from "next/link";
import { toString as qrATexto } from "qrcode";
import { Card } from "@/components/panel/piezas";
import { CUERPO_SUAVE, ESTADO_AVISO, RADIO_TILE, ROTULO_CIFRA } from "@/components/panel/sistema";
import CopiarLink from "./copiar-link";

/**
 * El link y el QR con los que el negocio reparte sus tarjetas. Es la
 * respuesta a "¿y cómo la consiguen mis clientes?".
 *
 * ------------------------------------------------------------------
 * ANTES ERA UN LINK POR NEGOCIO, Y ESE ERA EL BUG
 * ------------------------------------------------------------------
 * Esta card mostraba UN QR: el de `/tarjeta/<negocio>`. Con dos
 * tarjetas, la segunda no se podía repartir por ningún lado — y peor:
 * cuál de las dos entregaba ese único link podía cambiar solo al crear
 * la segunda, o sea que el QR YA IMPRESO del mostrador cambiaba de
 * destino sin que nadie lo tocara.
 *
 * Ahora se listan TODAS, cada una con su link y su QR:
 *
 *   · la ORIGINAL conserva el link corto del negocio, que es el que
 *     está impreso y pegado en la caja. Va primera y marcada, para que
 *     se entienda que ese cartel sigue sirviendo y no hay que cambiarlo;
 *   · las demás llevan `/tarjeta/<negocio>/<llave>` (`llave-tarjeta.ts`),
 *     que se lee perfecto en un póster.
 *
 * El QR se genera EN EL SERVIDOR como SVG puro: nada de canvas ni de
 * librerías en el navegador, y se puede imprimir a cualquier tamaño
 * sin pixelarse.
 */
const SITIO = "https://www.bookea.lat";

export type TarjetaCompartible = {
  id: string;
  nombre: string;
  /** El camino después del slug del negocio. "" = el link corto. */
  sufijo: string;
  /** true = es la que sirve el link corto, o sea la del QR ya impreso. */
  esLaDelQrImpreso: boolean;
  /** false = pausada, en borrador, vencida o archivada. */
  emitiendo: boolean;
};

export default async function CompartirTarjeta({
  slug,
  ranchoId,
  tarjetas,
}: {
  slug: string | null;
  ranchoId: string;
  /** Ya ordenadas: la original primero. */
  tarjetas: TarjetaCompartible[];
}) {
  if (!slug) return null;

  // margin 2 y nivel M: legible impreso chico en un mostrador con
  // brillo — el caso real, no el ideal.
  const conQr = await Promise.all(
    tarjetas.map(async (t) => {
      const url = `${SITIO}/tarjeta/${slug}${t.sufijo}`;
      return {
        ...t,
        url,
        svg: await qrATexto(url, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 2,
          color: { dark: "#0a1226", light: "#ffffff" },
        }),
      };
    }),
  );

  return (
    <Card eyebrow="Para el mostrador" titulo="Compartí tus tarjetas" nivel="h3">
      <p className={CUERPO_SUAVE}>
        Cada tarjeta tiene su propio link y su propio QR: imprimí el póster de la
        que quieras repartir, o mandá su link por WhatsApp. Al abrirlo, tu cliente
        agrega esa tarjeta a su Wallet y queda afiliado solo.
      </p>

      {conQr.length === 0 && (
        <p className={`mt-3 ${CUERPO_SUAVE}`}>
          Todavía no tenés ninguna tarjeta creada.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-4">
        {conQr.map((t) => (
          <li
            key={t.id}
            className={`${RADIO_TILE} border border-aventurea-line bg-aventurea-surface p-4`}
          >
            <div className="flex flex-wrap items-center gap-5">
              <div
                className="qr-claro h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-aventurea-line bg-white [&_svg]:h-full [&_svg]:w-full"
                // El SVG viene de la librería `qrcode` con datos
                // generados por nosotros (la URL de arriba), no de
                // entrada del usuario.
                dangerouslySetInnerHTML={{ __html: t.svg }}
              />
              <div className="min-w-0 flex-1">
                <p className={ROTULO_CIFRA}>{t.nombre}</p>

                {/* El aviso que evita un error caro: reimprimir el
                    cartel de la ORIGINAL no cambia nada —su link es el
                    de siempre— y el de cualquier otra es un cartel
                    nuevo. Sin decirlo, el dueño no tiene cómo saber
                    cuál de los QR es el que ya está en la pared. */}
                {t.esLaDelQrImpreso && (
                  <p className="mt-1 text-[11.5px] font-bold text-aventurea-ink-soft">
                    Este es el QR que ya tenés impreso — su link no cambió y no
                    hay que reemplazarlo.
                  </p>
                )}

                {!t.emitiendo && (
                  <p
                    className={`mt-2 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}
                  >
                    Esta tarjeta no está repartiendo pases: su link le va a decir
                    a tu cliente que está en pausa. Activala antes de imprimirla.
                  </p>
                )}

                <p className="mt-2 break-all rounded-lg bg-aventurea-cream-2 px-3 py-2 font-mono text-[12.5px] text-aventurea-ink">
                  {t.url}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <CopiarLink url={t.url} etiqueta={t.nombre} />
                  <Link
                    href={`/lealtad/panel/${ranchoId}/poster?programa=${t.id}`}
                    className="text-[12.5px] font-bold text-aventurea-navy underline"
                  >
                    Imprimir su póster →
                  </Link>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12.5px] font-bold text-aventurea-navy underline"
                  >
                    Verla como tu cliente →
                  </a>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
