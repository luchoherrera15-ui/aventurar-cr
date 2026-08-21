import Link from "next/link";

/**
 * ELEGIR PARA CUÁL TARJETA SE IMPRIME EL PÓSTER.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * Esta pantalla imprimía siempre la tarjeta principal del negocio. Con
 * dos tarjetas activas, la segunda no tenía cómo repartirse: no había
 * cartel que imprimir para ella, y el QR de acá seguía llevando a la
 * primera. El dueño lo pidió textual: «poder hacer pósters para cada
 * una independiente y que cada una tenga su función».
 *
 * ------------------------------------------------------------------
 * SERVIDOR, Y SIN FLECHAS DE TECLADO
 * ------------------------------------------------------------------
 * Son enlaces y nada más, así que no hace falta `"use client"`. El
 * selector de ESTILO sí es de cliente porque tiene cinco opciones fijas
 * que se comparan de un vistazo con las flechas; acá son una, dos o
 * seis tarjetas con nombre propio, y el Tab de siempre alcanza.
 *
 * Como el de estilo, la elección va EN LA URL: el link que el dueño le
 * manda al encargado imprime la misma tarjeta que él está viendo.
 *
 * No se dibuja con una sola tarjeta: un selector de un solo elemento no
 * es una elección, es ruido arriba de la hoja.
 */

export type TarjetaImprimible = {
  id: string;
  nombre: string;
  /** Su color de fondo, para reconocerla de un vistazo. */
  color: string | null;
  /** El link público al que va a apuntar su QR. */
  url: string | null;
  /**
   * true = es la tarjeta ORIGINAL, la que sirve el link corto del
   * negocio y por lo tanto la que está en el póster YA IMPRESO. Se
   * marca porque reimprimir esa hoja es reemplazar la de la pared, y
   * reimprimir cualquier otra es agregar un cartel nuevo.
   */
  esLaDelQrImpreso: boolean;
  /** false = pausada, en borrador, vencida o archivada. */
  emitiendo: boolean;
};

export default function SelectorTarjeta({
  ruta,
  estilo,
  tarjetas,
  actualId,
}: {
  /** La misma página, sin query. */
  ruta: string;
  /** El estilo elegido, que no se pierde al cambiar de tarjeta. */
  estilo: string;
  tarjetas: TarjetaImprimible[];
  actualId: string | null;
}) {
  if (tarjetas.length < 2) return null;

  return (
    <nav aria-label="Tarjeta del póster" className="poster-estilos no-imprimir">
      <p className="poster-estilos-titulo">Para cuál tarjeta</p>
      <ul className="poster-estilos-lista">
        {tarjetas.map((t) => {
          const elegida = t.id === actualId;
          return (
            <li key={t.id}>
              <Link
                href={`${ruta}?estilo=${encodeURIComponent(estilo)}&programa=${t.id}`}
                scroll={false}
                aria-current={elegida ? "page" : undefined}
                className={`poster-estilo${elegida ? " es-elegido" : ""}`}
              >
                <span
                  aria-hidden
                  style={{
                    display: "block",
                    height: 8,
                    borderRadius: 999,
                    background: t.color ?? "rgba(255,255,255,0.25)",
                  }}
                />
                <span className="poster-estilo-nombre">{t.nombre}</span>
                <span className="poster-estilo-nota">
                  {/* Tres datos y ningún adorno: si emite, si es la del
                      cartel que ya está pegado, y a qué link lleva su
                      QR. Es lo que hay que saber ANTES de gastar papel. */}
                  {t.emitiendo ? "Repartiendo" : "No está repartiendo"}
                  {t.esLaDelQrImpreso ? " · la del QR que ya imprimiste" : ""}
                </span>
                {t.url && <span className="poster-estilo-nota">{t.url}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
