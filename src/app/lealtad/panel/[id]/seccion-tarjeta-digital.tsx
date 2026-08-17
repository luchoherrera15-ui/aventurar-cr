"use client";

import { useEffect, useState } from "react";
import SubirImagen from "@/components/subir-imagen";
import CampoColor from "@/components/campo-color";
import { contraste } from "@/lib/invitaciones/paleta";
import {
  configPorDefecto,
  leerBeneficio,
  tipoDe,
  type ConfigBeneficio,
} from "@/lib/lealtad/tipos-tarjeta";
import { TITULO_CARD } from "@/components/panel/sistema";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import {
  AvisoError,
  AvisoGuardado,
  BarraGuardar,
  NotaCercania,
  usePrograma,
} from "./programa-contexto";
import { contextoDeLaTarjeta, type ProgramaFila, type RecompensaFila } from "./pases-actions";
import VistaPase from "@/components/lealtad/vista-pase";

/**
 * EL DISEÑO DE LA TARJETA que el cliente guarda en el teléfono.
 *
 * ------------------------------------------------------------------
 * QUÉ REEMPLAZA, Y POR QUÉ HABÍA QUE REEMPLAZARLO
 * ------------------------------------------------------------------
 * Antes acá había tres cosas: dos ruedas de color, un campo que pedía
 * «Logo del negocio (URL https)» y una maqueta dibujada a mano. Las
 * tres estaban mal:
 *
 *   · La URL le trasladaba al dueño de una barbería un problema que no
 *     es suyo —subir el archivo a algún lado, encontrar el link
 *     DIRECTO, comprobar que sea https—. Ahora se arrastra el archivo
 *     y listo, con el mismo <SubirImagen> del creador.
 *
 *   · Dos ruedas de color sueltas producen tarjetas ilegibles: nadie
 *     que atiende un local tiene por qué saber elegir dos colores que
 *     combinen. Por eso primero se ofrecen temas ya armados, y las
 *     ruedas quedan para el que sabe lo que quiere.
 *
 *   · La maqueta a mano era una SEGUNDA versión del pase, y dos
 *     maquetas de lo mismo se separan en cuanto alguien toca una. Se
 *     borró: acá se dibuja <VistaPase>, la misma que usa el creador y
 *     la que arma los textos con `camposSegunModo()` — la función que
 *     también genera el pass.json real.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA PANTALLA NO DECIDE
 * ------------------------------------------------------------------
 * Nada. Los colores, el formato del código, el largo del reverso y
 * sobre todo que las imágenes sean de NUESTRO storage se vuelven a
 * comprobar en `guardarPrograma` (pases-actions.ts). Acá se valida para
 * avisar temprano; una petición armada a mano no pasa por este archivo.
 */

// ── Las plantillas ────────────────────────────────────────────────
//
// Acá había una lista PROPIA de ocho temas, escrita a mano. O sea que
// el módulo tenía tres juegos de colores: los de la página pública, los
// de esta pantalla y los que el creador no ofrecía. Tres listas que
// nadie podía mantener iguales, y el dueño lo notaba: elegía un color
// en un lado y no lo encontraba en el otro.
//
// Ahora las ocho salen de `src/lib/lealtad/paletas.ts`, las MISMAS que
// muestra la landing y las mismas que ofrece el creador. Todas con
// fondo oscuro, y eso no es gusto: Apple pinta el texto del pase de
// blanco fijo (`foregroundColor: rgb(255,255,255)` en
// construirPassJson), así que un fondo claro no es una tarjeta fea, es
// una tarjeta que no se lee.

/** WCAG AA para texto normal. Debajo de esto el pase no se lee. */
const CONTRASTE_TEXTO = 4.5;
/**
 * Los sellos son formas macizas y grandes, no texto: el 3:1 de WCAG
 * para gráficos es más de lo que hace falta y dispararía la alarma en
 * combinaciones que se ven bien. Un aviso que se equivoca seguido es
 * un aviso que nadie lee.
 */
const CONTRASTE_SELLO = 2.2;

const tituloCls = TITULO_CARD;
const ayudaCls = "mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft";

/**
 * La sección completa, tal como la monta el panel del negocio.
 *
 * El nombre y la firma —sin props— son los mismos que tenía el editor
 * viejo: la página la sigue montando igual.
 */
export default function SeccionTarjeta() {
  return (
    <div className="space-y-5">
      <AvisoError />
      <AvisoGuardado />
      <BloqueDiseno />
      <BarraGuardar />
      <NotaCercania />
    </div>
  );
}

/**
 * El editor y su vista previa, sin los avisos ni el botón de guardar.
 *
 * Va aparte porque la página de administración de Bookea
 * (/admin/lealtad/[id]) arma UNA sola pantalla con todos los bloques y
 * un único «Guardar» al pie: si este componente trajera el suyo, esa
 * pantalla terminaría con dos.
 */
export function BloqueDiseno() {
  const { ranchoId, programa, borrador, cambiar, meta } = usePrograma();

  // El nombre del NEGOCIO no está en el contexto (que lleva el programa
  // y sus recompensas), y el pase escribe ese nombre y no el de la
  // tarjeta. Lo mismo el número de pases ya emitidos. Se preguntan una
  // vez, al montar.
  const [negocioNombre, setNegocioNombre] = useState("");
  const [emitidos, setEmitidos] = useState(0);
  const programaId = programa?.id ?? null;

  useEffect(() => {
    let vivo = true;
    void contextoDeLaTarjeta(ranchoId, programaId).then((r) => {
      if (!vivo) return;
      setNegocioNombre(r.negocioNombre);
      setEmitidos(r.pasesEmitidos);
    });
    return () => {
      vivo = false;
    };
  }, [ranchoId, programaId]);

  const contrasteTexto = contraste(borrador.colorFondo, "#ffffff");
  const contrasteSello = contraste(borrador.colorSello, borrador.colorFondo);
  const esSellos = tipoDe(borrador.modo) === "sellos";

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-5">
        {/* ── Colores ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
          <h3 className={tituloCls}>Colores</h3>
          <p className={ayudaCls}>
            Elegí una plantilla y ya está — todas se leen bien en el teléfono, y son las
            mismas que ves en la página. Si tenés los colores de tu marca, cambialos abajo.
          </p>

          <div className="mt-4">
            <PlantillasColor
              colorFondo={borrador.colorFondo}
              colorSello={borrador.colorSello}
              alElegir={({ fondo, sello }) => cambiar({ colorFondo: fondo, colorSello: sello })}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CampoColor
              id="t-fondo"
              etiqueta="Color de fondo"
              valor={borrador.colorFondo}
              alCambiar={(v) => cambiar({ colorFondo: v })}
            />
            <CampoColor
              id="t-acento"
              etiqueta={esSellos ? "Color del sello" : "Color del acento"}
              valor={borrador.colorSello}
              alCambiar={(v) => cambiar({ colorSello: v })}
            />
          </div>

          {/* El contraste no es un detalle de diseñador: el texto del
              pase es blanco fijo en Apple, así que un fondo claro deja
              la tarjeta sin leerse y el negocio lo descubre cuando un
              cliente le muestra el teléfono en el mostrador. */}
          {contrasteTexto < CONTRASTE_TEXTO && (
            <p
              role="status"
              className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-amber-800"
            >
              Con ese fondo tan claro el texto de la tarjeta —que siempre es blanco— casi
              no se lee. Probá un tono más oscuro o elegí uno de los temas de arriba.
            </p>
          )}
          {contrasteSello < CONTRASTE_SELLO && (
            <p
              role="status"
              className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-amber-800"
            >
              {esSellos
                ? "El color del sello se confunde con el fondo: los sellos van a verse todos iguales, ganados y por ganar."
                : "El acento se confunde con el fondo y no se va a notar."}
            </p>
          )}
        </div>

        {/* ── El icono del sello (0145) ─────────────────────────────
            Solo en sellos: es el único tipo con círculos que llenar.
            Va acá, junto a los colores, porque es la misma decisión —
            cómo se ve el sello— y no otra pantalla. */}
        {esSellos && (
          <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
            <h3 className={tituloCls}>Icono del sello</h3>
            <p className={ayudaCls}>
              Qué se dibuja adentro de cada círculo. Se llena cuando el cliente gana el
              sello y queda en contorno el que le falta — así se ve cuánto le queda de un
              vistazo, sin contar.
            </p>
            <div className="mt-4">
              <SelectorIconoSello
                valor={borrador.iconoSello}
                alElegir={(icono) => cambiar({ iconoSello: icono })}
                colorFondo={borrador.colorFondo}
                colorSello={borrador.colorSello}
                iconoUrl={borrador.iconoUrl || null}
                alSubirIcono={(url) => cambiar({ iconoUrl: url })}
              />
            </div>
            <p className={ayudaCls}>
              Con «Mi logo» va tu logo adentro del círculo, como hasta ahora. Si tu logo es
              blanco o tiene el nombre escrito, un icono se ve mucho mejor a ese tamaño. Y si
              tu marca tiene su propio símbolo, «Mi ícono» lo sube — con las mismas
              precauciones: se dibuja del tamaño de una moneda.
            </p>
          </div>
        )}

        {/* ── Imágenes ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
          <h3 className={tituloCls}>Tus imágenes</h3>
          <div className="mt-4 space-y-4">
            <div>
              <SubirImagen
                etiqueta="Logo del negocio"
                valor={borrador.logoUrl}
                alCambiar={(url) => cambiar({ logoUrl: url })}
                destino="logo"
                carpeta="lealtad/logos"
              />
              <p className={ayudaCls}>
                Va arriba a la izquierda y dentro de cada sello. Sin logo, la tarjeta
                escribe el nombre del negocio.
              </p>
            </div>
            <div>
              <SubirImagen
                etiqueta="Banda de la tarjeta (opcional)"
                valor={borrador.bannerUrl}
                alCambiar={(url) => cambiar({ bannerUrl: url })}
                destino="banner"
                carpeta="lealtad/bandas"
              />
              <p className={ayudaCls}>
                La franja de arriba del pase: una foto de tu local o de lo que vendés.
              </p>
            </div>
          </div>
        </div>

        {/* ── ACÁ VIVÍA «QUÉ MUESTRA EL PASE», Y ERA DECORACIÓN ─────
            Cuatro controles —código QR/barras, texto del reverso,
            mostrar saldo, mostrar progreso— se guardaban en sus cuatro
            columnas de la 0132 y NINGÚN generador los leía. Ni el
            `pass.json` de Apple ni el objeto de Google los miran: el
            pase salía siempre con QR, con el reverso que arma Bookea y
            con los dos campos a la vista, dijera lo que dijera el panel.

            El más caro era el del código: el texto de ayuda advertía
            «con código de barras vas a necesitar la lectora de tu caja»
            — un negocio que eligiera barras podía salir a comprar una
            lectora por una consecuencia que no existía, porque el pase
            seguía trayendo el QR.

            Se sacan en vez de dejarse marcados: un control apagado con
            una nota igual invita a tocarlo. Los valores YA guardados no
            se pierden ni se pisan —el borrador los sigue mandando tal
            como estaban— así que el día que los generadores los lean,
            el control vuelve y encuentra lo que el dueño había elegido.

            Lo que falta cablear, para quien lo tome: `pase_codigo_formato`
            en `construirPassJson` (barcode.format) y en el objeto de
            Google; `pase_texto_reverso` en `textoDeAyuda`; y
            `pase_mostrar_saldo` / `pase_mostrar_progreso` en
            `camposSegunModo` y en `tiraDeLaFila`. Todo eso vive en
            src/lib/wallet/, que no es territorio de este cambio. */}

        {/* Cambiar el diseño no toca solo a las tarjetas nuevas: las
            que ya están instaladas se redibujan cuando el teléfono las
            actualiza. Decirlo antes de guardar es la diferencia entre
            un cambio de marca y una sorpresa en el mostrador. */}
        {emitidos > 0 && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] font-bold leading-relaxed text-amber-800">
            Ya hay {emitidos} {emitidos === 1 ? "tarjeta" : "tarjetas"} en teléfonos de
            clientes. Al guardar, {emitidos === 1 ? "esa tarjeta cambia" : "esas tarjetas cambian"}{" "}
            de aspecto la próxima vez que el teléfono las actualice.
          </p>
        )}
      </div>

      {/* ── La vista previa ──────────────────────────────────────
          Primero en móvil (se ve el cambio sin buscarlo) y pegada al
          costado en escritorio. */}
      <aside className="order-first lg:order-none lg:sticky lg:top-24">
        <VistaPase
          datos={{
            negocioNombre: negocioNombre || borrador.nombre,
            modo: borrador.modo,
            beneficio: beneficioDeLaVista(programa, borrador.modo, meta),
            colorFondo: borrador.colorFondo,
            colorSello: borrador.colorSello,
            iconoSello: borrador.iconoSello,
            iconoUrl: borrador.iconoUrl || null,
            logoUrl: borrador.logoUrl || null,
            bannerUrl: borrador.bannerUrl || null,
          }}
        />
      </aside>
    </div>
  );
}

/**
 * El beneficio con el que la vista previa dibuja la tarjeta.
 *
 * Sale del jsonb `beneficio` (0135) del programa. Si la migración no
 * corrió, o el programa es viejo, se cae a la config por defecto del
 * tipo: la vista previa se dibuja genérica —feo pero cierto— en vez de
 * quedar en blanco. Es el mismo criterio de `leerBeneficio`.
 *
 * En sellos manda la RECOMPENSA y no el jsonb, y no es capricho: el
 * pase real saca la meta de la recompensa activa más barata
 * (`metaDeSellos` en wallet/tarjeta.ts). Si acá se dibujaran los 10
 * sellos del jsonb mientras la recompensa cuesta 8, la vista previa
 * prometería una tarjeta que el teléfono nunca va a mostrar.
 */
function beneficioDeLaVista(
  programa: ProgramaFila | null,
  modo: string | null,
  meta: RecompensaFila | null,
): ConfigBeneficio {
  const tipo = tipoDe(modo);
  const base = leerBeneficio(programa?.beneficio, tipo) ?? configPorDefecto(tipo);
  if (base.tipo === "sellos" && meta) {
    return { ...base, requeridos: meta.costo_puntos, recompensa: meta.nombre };
  }
  return base;
}
