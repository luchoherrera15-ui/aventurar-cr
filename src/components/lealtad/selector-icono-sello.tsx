"use client";

import { useState } from "react";
import {
  ICONOS_SELLO_LISTA,
  SELLO_PROPIO,
  type SelloElegido,
} from "@/lib/lealtad/iconos-sello";
import { contraste } from "@/lib/invitaciones/paleta";
import type { AnalisisImagen } from "@/lib/comprimir-imagen";
import SubirImagen from "@/components/subir-imagen";
import { Icono, SelloConIcono, SelloConImagen } from "@/app/lealtad/panel/[id]/iconos";

/**
 * QUÉ DIBUJO LLEVA CADA SELLO.
 *
 * Hasta la 0145 el sello era siempre el LOGO del negocio metido en un
 * círculo, y eso falla justo con quien más usa una tarjeta de sellos:
 * la soda que no tiene logo, la barbería cuyo logo es el nombre escrito
 * —ilegible a 30 píxeles—, y sobre todo la marca de logo BLANCO, que
 * sobre el círculo blanco del sello desaparece entera.
 *
 * Doce iconos, ni uno más. La lista corta se mira de un vistazo; con
 * cincuenta, elegir se vuelve una tarea y la gente la saltea.
 *
 * La primera opción es «Mi logo», y no está de adorno: es lo que hace
 * TODO lo emitido hasta hoy, así que tiene que estar a la vista y ser
 * la de arranque. Nadie que ya tenía su tarjeta funcionando se
 * encuentra con que le cambiamos el sello.
 *
 * ------------------------------------------------------------------
 * Y «MI ÍCONO» (0174)
 * ------------------------------------------------------------------
 * Los doce cubren los rubros comunes y dejan afuera al resto: la
 * veterinaria con su perro dibujado, la óptica, la lavandería, la marca
 * que ya tiene su símbolo. Para esos hay una opción más, que abre la
 * subida de un archivo propio — el MISMO componente con el que se sube
 * el logo, no una segunda forma de subir imágenes.
 *
 * La opción solo aparece si quien monta el selector pasa `alSubirIcono`.
 * El asistente de alta pública (/lealtad/nuevo) NO lo pasa: ahí todavía
 * no hay sesión con la que subir a nuestro bucket, y una opción que al
 * tocarla falla es peor que una opción que no está.
 *
 * Se usa en el creador y en el editor del diseño. Una sola pantalla de
 * elección, no dos: dos copias se separan en cuanto alguien agrega el
 * icono trece en una.
 */

/**
 * WCAG pide 3:1 para un elemento gráfico. El ícono propio se dibuja
 * sobre el círculo BLANCO del sello (así lo hace `selloRedondo` desde
 * que el sello era el logo), así que el contraste se mide contra blanco
 * y no contra el color del acento.
 *
 * Se AVISA y no se bloquea: puede ser un ícono con borde oscuro y
 * relleno claro, cuyo promedio miente. Prohibirlo por una cuenta que a
 * veces se equivoca sería peor que dejar decidir al que está mirando su
 * propia tarjeta en la vista previa de al lado.
 */
const CONTRASTE_GRAFICO = 3;

export default function SelectorIconoSello({
  valor,
  alElegir,
  colorFondo,
  colorSello,
  iconoUrl = null,
  alSubirIcono,
}: {
  valor: SelloElegido | null;
  alElegir: (icono: SelloElegido | null) => void;
  /** Los colores de la tarjeta: cada opción se muestra como se va a ver. */
  colorFondo: string;
  colorSello: string;
  /** El ícono propio ya subido (0174), si hay. */
  iconoUrl?: string | null;
  /** Sin esto no se ofrece «Mi ícono»: no habría dónde subir el archivo. */
  alSubirIcono?: (url: string) => void;
}) {
  // La caja de subida se abre al tocar «Mi ícono» y se queda abierta
  // mientras haya un archivo: es la única forma de reemplazarlo o
  // quitarlo sin ir a buscar el control a otra parte.
  const [abierta, setAbierta] = useState(false);
  const [analisis, setAnalisis] = useState<AnalisisImagen | null>(null);

  const hayPropio = !!iconoUrl;
  const claro =
    analisis?.colorPromedio !== null && analisis?.colorPromedio !== undefined
      ? contraste(analisis.colorPromedio, "#ffffff") < CONTRASTE_GRAFICO
      : false;

  return (
    <div>
      <div
        className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5"
        role="group"
        aria-label="Icono del sello"
      >
        {/* «Mi ícono» va PRIMERO (pedido del dueño, ago 2026): la
            opción de subir el propio símbolo es la que la gente busca
            al llegar acá, y con «Mi logo» adelante se leía como que
            "ahí va el logo" y no dejaba cargar nada. */}
        {alSubirIcono && (
          <Opcion
            etiqueta="Mi ícono"
            puesto={valor === SELLO_PROPIO && hayPropio}
            alElegir={() => {
              setAbierta(true);
              // Con archivo, tocarlo lo ELIGE. Sin archivo no se puede
              // elegir nada todavía: se abre la subida y ya.
              if (hayPropio) alElegir(SELLO_PROPIO);
            }}
            colorFondo={colorFondo}
          >
            {iconoUrl ? (
              <SelloConImagen url={iconoUrl} encendido lado={32} />
            ) : (
              <span
                className="grid h-8 w-8 place-items-center rounded-full border border-dashed"
                style={{ borderColor: colorSello, color: colorSello }}
              >
                <Icono nombre="mas" className="h-4 w-4" />
              </span>
            )}
          </Opcion>
        )}

        <Opcion
          etiqueta="Mi logo"
          puesto={valor === null}
          alElegir={() => alElegir(null)}
          colorFondo={colorFondo}
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-full border border-dashed"
            style={{ borderColor: colorSello, color: colorSello }}
          >
            <Icono nombre="camara" className="h-4 w-4" />
          </span>
        </Opcion>

        {ICONOS_SELLO_LISTA.map((i) => (
          <Opcion
            key={i.id}
            etiqueta={i.nombre}
            puesto={valor === i.id}
            alElegir={() => alElegir(i.id)}
            colorFondo={colorFondo}
          >
            {/* Lleno, que es como se ve el sello ya ganado: es el estado
                que el dueño quiere juzgar al elegir. */}
            <SelloConIcono
              icono={i.id}
              encendido
              colorFondo={colorFondo}
              colorSello={colorSello}
              lado={32}
            />
          </Opcion>
        ))}
      </div>

      {alSubirIcono && (abierta || hayPropio) && (
        <div className="mt-3 rounded-2xl border border-bookea-linea p-4">
          {/* EL AVISO VA ANTES DE SUBIR, no después: el que está por
              elegir una foto de su local todavía puede elegir otra cosa.
              Dicho recién cuando ya la ve puesta, el consejo llega tarde
              y suena a reproche. */}
          <p className="mb-3 text-[11.5px] leading-relaxed text-bookea-gris">
            El sello se dibuja del tamaño de una moneda y se repite una vez por visita: entra
            un símbolo simple —una silueta, una figura— y no entra una foto ni un logo con el
            nombre escrito. PNG con fondo transparente es lo que mejor queda.
          </p>

          <SubirImagen
            etiqueta="Ícono del sello"
            valor={iconoUrl ?? ""}
            destino="icono"
            carpeta="lealtad/iconos"
            alAnalizar={setAnalisis}
            alCambiar={(url) => {
              alSubirIcono(url);
              // Subir uno lo deja PUESTO: nadie sube un ícono para no
              // usarlo, y obligar a un segundo click sobre la misma
              // casilla que se acaba de llenar se lee como que no pasó
              // nada. Quitarlo devuelve el sello al logo de siempre.
              if (url) alElegir(SELLO_PROPIO);
              else if (valor === SELLO_PROPIO) alElegir(null);
            }}
          />

          {analisis?.fondoOpaco && (
            <p
              role="status"
              className="mt-2.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold leading-relaxed text-amber-800"
            >
              Tu ícono no tiene fondo transparente: adentro del círculo se va a ver un
              cuadrado pegado. Guardalo como PNG con el fondo borrado y volvé a subirlo.
            </p>
          )}

          {claro && (
            <p
              role="status"
              className="mt-2.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold leading-relaxed text-amber-800"
            >
              Tu ícono es muy claro y el círculo del sello es blanco: casi no se va a ver.
              Probá con una versión en un tono oscuro.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Una opción: la muestra sobre el fondo REAL de la tarjeta y el nombre
 * debajo. El fondo importa — un icono se juzga sobre el color donde va
 * a vivir, no sobre el blanco del formulario.
 */
function Opcion({
  etiqueta,
  puesto,
  alElegir,
  colorFondo,
  children,
}: {
  etiqueta: string;
  puesto: boolean;
  alElegir: () => void;
  colorFondo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={puesto}
      onClick={alElegir}
      title={etiqueta}
      className={`presionable overflow-hidden rounded-xl border text-center ${
        puesto ? "border-bookea-azul ring-2 ring-bookea-azul" : "border-bookea-linea"
      }`}
    >
      <span className="flex h-14 items-center justify-center" style={{ background: colorFondo }}>
        {children}
      </span>
      <span className="block truncate px-1 py-1.5 text-[10.5px] font-bold text-bookea-tinta">
        {etiqueta}
      </span>
    </button>
  );
}
