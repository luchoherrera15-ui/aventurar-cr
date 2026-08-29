"use client";

import { useState, useTransition } from "react";
import { urlInvitacion, urlQr } from "@/lib/qr";
import { generarVersionImpresa } from "./actions";

export type TamanoPapel = "carta" | "a4";

/** El lado del QR en la hoja. 22 mm es lo mínimo que un teléfono lee
 *  de un vistazo, a un brazo de distancia, sin acercarse a la tarjeta. */
const LADO_QR_MM = 22;

const PAPEL: Record<TamanoPapel, { css: string; etiqueta: string; medidas: string }> = {
  carta: { css: "letter", etiqueta: "Carta", medidas: "21.6 × 27.9 cm" },
  a4: { css: "A4", etiqueta: "A4", medidas: "21 × 29.7 cm" },
};

/**
 * La invitación lista para papel.
 *
 * Lo que se muestra acá es `html_impresion` (0084): una pieza propia de
 * UNA hoja, hermana del diseño digital pero compuesta aparte — no el
 * mismo HTML reformateado, que salía en cinco hojas mal cortadas.
 *
 * Encima de esa hoja va lo único que agrega esta pantalla: el QR con el
 * link de la invitación. Es el puente de vuelta a lo digital — quien
 * recibe la tarjeta puede confirmar asistencia, abrir el mapa y ver la
 * cuenta regresiva, que en papel no existen. Se puede quitar, porque
 * hay diseños donde el cliente no lo quiere.
 *
 * El tamaño se cambia con `@page size`, que es lo que lee el diálogo de
 * impresión para elegir la hoja.
 */
export default function VistaImpresion({
  invitacionId,
  slug,
  html,
  titulo,
}: {
  invitacionId: string;
  /** Para armar el link que lleva el QR: bookea.lat/i/{slug}. */
  slug: string;
  /** La pieza de UNA hoja. null = todavía no se compuso. */
  html: string | null;
  titulo: string;
}) {
  const [tamano, setTamano] = useState<TamanoPapel>("carta");
  const [conQr, setConQr] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generando, startTransition] = useTransition();

  const link = urlInvitacion(slug);
  // Se pide bastante más grande que los 22 mm impresos: el PNG se
  // reduce al imprimir y así los módulos quedan nítidos en papel.
  const imagenQr = urlQr(link, 600);

  function componer() {
    setError(null);
    startTransition(async () => {
      const res = await generarVersionImpresa(invitacionId);
      if (res.error) setError(res.error);
    });
  }

  // Ojo con `print-color-adjust`: sin esto los navegadores descartan
  // fondos e imágenes al imprimir "para ahorrar tinta", y un diseño con
  // fondo de color saldría en blanco. Con esto se respeta el diseño.
  const estilos = `
    @page { size: ${PAPEL[tamano].css}; margin: 10mm; }

    /* El área segura de la hoja, la misma que compone el agente
       (170 mm): en pantalla se ve el ancho real del papel, no la
       ventana, así que lo que se previsualiza es lo que sale. Y es lo
       que hace que la esquina de abajo a la derecha de este contenedor
       sea de verdad la esquina de la hoja, donde se ancla el QR. */
    .hoja { position: relative; max-width: 170mm; margin: 0 auto; }

    .qr-hoja {
      position: absolute;
      right: 6mm;
      bottom: 6mm;
      width: ${LADO_QR_MM}mm;
      text-align: center;
      /* Fondo propio: el QR tiene que caer sobre blanco para que
         cualquier lector lo tome, aunque el diseño tenga color ahí. */
      background: #ffffff;
      border-radius: 2mm;
      padding: 1.5mm;
      box-shadow: 0 0 0 0.3mm rgba(0, 0, 0, 0.08);
    }
    .qr-hoja img {
      display: block;
      width: 100%;
      height: auto;
    }
    .qr-hoja span {
      display: block;
      margin-top: 1mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 5pt;
      line-height: 1.25;
      letter-spacing: 0.02em;
      color: #101a2c;
    }

    @media print {
      .no-imprimir { display: none !important; }
      html, body { background: #fff !important; }

      /* La paleta, la tipografía y los ornamentos se respetan: en papel
         tiene que reconocerse la misma invitación. Lo que se va es todo
         lo que solo existe porque hay una pantalla. */
      .hoja, .hoja * {
        animation: none !important;
        transition: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Un contador impreso miente desde que sale de la impresora. */
      .hoja [data-bookea="cuenta-regresiva"] { display: none !important; }

      /* Video, audio y botones no existen en papel; un mapa embebido
         imprime un rectángulo gris. */
      .hoja video,
      .hoja audio,
      .hoja iframe,
      .hoja button { display: none !important; }

      /* Un elemento fijo se imprime encima del contenido o se repite en
         cada hoja: en papel pasa a fluir con el resto. */
      .hoja [style*="position:fixed"],
      .hoja [style*="position: fixed"] { position: static !important; }

      /* Alturas pensadas para el viewport dejan hojas casi vacías. */
      .hoja [style*="100vh"],
      .hoja [style*="100svh"],
      .hoja [style*="100dvh"] {
        min-height: 0 !important;
        height: auto !important;
      }

      /* Que un bloque no quede partido entre dos hojas. */
      .hoja section,
      .hoja article,
      .hoja figure { break-inside: avoid; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: estilos }} />

      <div className="no-imprimir sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-surface/95 px-5 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-aventurea-ink">{titulo}</p>
            <p className="text-[12px] text-aventurea-ink-soft">
              Versión para papel — mismo estilo, sin lo que solo vive en pantalla
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Tamaño de papel"
              className="flex rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
            >
              {(Object.keys(PAPEL) as TamanoPapel[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={tamano === id}
                  onClick={() => setTamano(id)}
                  className={`rounded-lg px-4 py-1.5 text-[13px] font-bold transition-colors ${
                    tamano === id
                      ? "bg-aventurea-navy text-white"
                      : "text-aventurea-ink-soft hover:text-aventurea-ink"
                  }`}
                >
                  {PAPEL[id].etiqueta}
                  <span className="ml-1.5 hidden text-[11px] font-semibold opacity-70 sm:inline">
                    {PAPEL[id].medidas}
                  </span>
                </button>
              ))}
            </div>

            {html && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[13px] font-bold text-aventurea-ink-soft">
                <input
                  type="checkbox"
                  checked={conQr}
                  onChange={(e) => setConQr(e.target.checked)}
                  className="h-4 w-4 accent-aventurea-navy"
                />
                Incluir el QR
              </label>
            )}

            {html ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-aventurea-sky px-5 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark"
              >
                Descargar PDF
              </button>
            ) : (
              <button
                type="button"
                disabled={generando}
                onClick={componer}
                className="rounded-xl bg-aventurea-sky px-5 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark disabled:opacity-60"
              >
                {generando ? "Componiendo…" : "Componer la hoja"}
              </button>
            )}
          </div>
        </div>

        <p className="mx-auto mt-2 max-w-[1000px] text-[11.5px] leading-relaxed text-aventurea-ink-soft">
          Se abre el cuadro de impresión: elegí <strong>Guardar como PDF</strong> en
          el destino. Si tu diseño tiene fondo de color, activá{" "}
          <strong>Gráficos de fondo</strong> en las opciones para que salga igual
          que en pantalla.
          {html && (
            <>
              {" "}
              El QR de la esquina abre tu invitación en línea ({link}) para que
              quien la reciba en papel pueda confirmar su asistencia.
            </>
          )}
        </p>
      </div>

      {error && (
        <p className="no-imprimir mx-auto mt-5 max-w-[560px] rounded-xl bg-red-50 px-4 py-3 text-center text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}

      {html ? (
        <div className="hoja">
          {/* `html` viene YA SANEADO del servidor (imprimir/page.tsx →
              sanearHtmlInvitacion): sin <script>, sin on*, sin
              javascript:. El `estilos` de arriba es CSS propio y fijo. */}
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {/* El puente entre el papel y lo digital: quien recibe la
              tarjeta impresa escanea y cae en la invitación en línea,
              donde sí puede confirmar, ver el mapa y la cuenta
              regresiva. Sin esto, la hoja es un callejón sin salida. */}
          {conQr && (
            <div className="qr-hoja">
              {/* eslint-disable-next-line @next/next/no-img-element -- el
                  QR lo arma un servicio externo como PNG; next/image no
                  aporta nada y complicaría la impresión. */}
              <img src={imagenQr} alt={`Código QR de la invitación (${link})`} />
              <span>Escaneá para confirmar</span>
            </div>
          )}
        </div>
      ) : (
        <div className="no-imprimir mx-auto max-w-[560px] px-6 py-20 text-center">
          <h2 className="titulo text-[20px] text-aventurea-ink">
            Todavía no armamos tu hoja
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-aventurea-ink-soft">
            La versión de papel no es la pantalla impresa: es una pieza aparte, de
            una sola hoja, con el fondo, los colores y los motivos de tu invitación.
            Se compone una vez y queda guardada.
          </p>
          <p className="mt-2 text-[12.5px] text-aventurea-ink-soft">
            Tarda un momento. Si después cambiás el diseño digital, volvé acá y
            componela de nuevo.
          </p>
        </div>
      )}
    </>
  );
}
