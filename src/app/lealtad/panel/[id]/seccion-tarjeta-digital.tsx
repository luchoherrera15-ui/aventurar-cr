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
import { Interruptor } from "./paso-beneficio";
import {
  AvisoError,
  AvisoGuardado,
  BarraGuardar,
  NotaCercania,
  usePrograma,
} from "./programa-contexto";
import {
  contextoDeLaTarjeta,
  type FormatoCodigo,
  type ProgramaFila,
  type RecompensaFila,
} from "./pases-actions";
import VistaPase from "./vista-pase";

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

// ── Temas ─────────────────────────────────────────────────────────
//
// Los ocho tienen fondo OSCURO a propósito: Apple pinta el texto del
// pase de blanco fijo (`foregroundColor: rgb(255,255,255)` en
// construirPassJson), así que un fondo claro no es cuestión de gusto —
// es una tarjeta que no se lee. Un tema es un toque y no se equivoca;
// las ruedas de abajo son para el que ya tiene su marca definida.
const TEMAS: { nombre: string; fondo: string; acento: string }[] = [
  { nombre: "Navy Bookea", fondo: "#062653", acento: "#ff6a00" },
  { nombre: "Grafito", fondo: "#14161a", acento: "#f2c230" },
  { nombre: "Café tostado", fondo: "#3b2317", acento: "#d9a05b" },
  { nombre: "Selva", fondo: "#0f3d2e", acento: "#46d39a" },
  { nombre: "Vino", fondo: "#5a1220", acento: "#e8b4b8" },
  { nombre: "Mar", fondo: "#073b4c", acento: "#06d6a0" },
  { nombre: "Noche violeta", fondo: "#2e1065", acento: "#c4b5fd" },
  { nombre: "Terracota", fondo: "#7a2e12", acento: "#f4a261" },
];

/** WCAG AA para texto normal. Debajo de esto el pase no se lee. */
const CONTRASTE_TEXTO = 4.5;
/**
 * Los sellos son formas macizas y grandes, no texto: el 3:1 de WCAG
 * para gráficos es más de lo que hace falta y dispararía la alarma en
 * combinaciones que se ven bien. Un aviso que se equivoca seguido es
 * un aviso que nadie lee.
 */
const CONTRASTE_SELLO = 2.2;

const FORMATOS: { id: FormatoCodigo; label: string }[] = [
  { id: "qr", label: "Código QR" },
  { id: "code128", label: "Código de barras" },
];

const MAX_REVERSO = 500;

const tituloCls = "text-[15px] font-bold text-aventurea-ink";
const ayudaCls = "mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft";
const etiquetaCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris";

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
            Elegí un tema y ya está — todos se leen bien en el teléfono. Si tenés los
            colores de tu marca, cambialos abajo.
          </p>

          <div
            className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label="Temas de color"
          >
            {TEMAS.map((t) => {
              const puesto =
                borrador.colorFondo.toLowerCase() === t.fondo &&
                borrador.colorSello.toLowerCase() === t.acento;
              return (
                <button
                  key={t.nombre}
                  type="button"
                  aria-pressed={puesto}
                  onClick={() => cambiar({ colorFondo: t.fondo, colorSello: t.acento })}
                  className={`presionable overflow-hidden rounded-xl border text-left ${
                    puesto ? "border-aventurea-navy" : "border-aventurea-line"
                  }`}
                >
                  <span
                    aria-hidden
                    className="flex h-11 items-center gap-1.5 px-3"
                    style={{ background: t.fondo }}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ background: t.acento }}
                    />
                    <span className="h-1.5 w-8 rounded-full bg-white/70" />
                  </span>
                  <span className="block px-3 py-2 text-[11.5px] font-bold text-aventurea-ink">
                    {t.nombre}
                  </span>
                </button>
              );
            })}
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

        {/* ── Qué muestra el pase (0132) ───────────────────────── */}
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
          <h3 className={tituloCls}>Qué muestra el pase</h3>
          <p className={ayudaCls}>
            Lo que el cliente ve al abrir la tarjeta, y lo que lee el mostrador al
            escanearla.
          </p>

          <div className="mt-4 space-y-3">
            <Interruptor
              id="t-saldo"
              titulo="Mostrar el saldo"
              detalle="El número grande de arriba: «5/10», «₡3.400», «340 puntos»."
              activo={borrador.mostrarSaldo}
              alCambiar={(v) => cambiar({ mostrarSaldo: v })}
            />
            <Interruptor
              id="t-progreso"
              titulo="Mostrar el progreso"
              detalle="La tira de sellos y el «te faltan 3 para tu regalía»."
              activo={borrador.mostrarProgreso}
              alCambiar={(v) => cambiar({ mostrarProgreso: v })}
            />
          </div>

          <div className="mt-4">
            <span className={etiquetaCls} id="t-formato-label">
              Código de la tarjeta
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="t-formato-label">
              {FORMATOS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={borrador.codigoFormato === f.id}
                  onClick={() => cambiar({ codigoFormato: f.id })}
                  className={`presionable rounded-xl border px-3.5 py-2 text-[12.5px] font-bold ${
                    borrador.codigoFormato === f.id
                      ? "border-aventurea-navy bg-aventurea-navy text-white"
                      : "border-aventurea-line bg-white text-aventurea-ink-soft"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* El escáner del panel lee QR (jsQR). Elegir barras no
                está mal —hay cajas con lectora— pero deja al mostrador
                acreditando a mano, y eso se avisa ANTES, no después. */}
            <p className={ayudaCls}>
              {borrador.codigoFormato === "qr"
                ? "El QR es el que lee el escáner de Bookea desde el celular."
                : "Ojo: el escáner de Bookea lee QR. Con código de barras vas a necesitar la lectora de tu caja, o acreditar a mano."}
            </p>
          </div>

          <div className="mt-4">
            <label className={etiquetaCls} htmlFor="t-reverso">
              Texto del reverso (opcional)
            </label>
            <textarea
              id="t-reverso"
              value={borrador.textoReverso}
              onChange={(e) => cambiar({ textoReverso: e.target.value })}
              maxLength={MAX_REVERSO}
              rows={3}
              placeholder="Ej. Válida en nuestro local de Escazú. Presentala antes de pagar."
              className="w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] leading-relaxed text-bookea-tinta placeholder:text-bookea-gris/70"
            />
            <p className={ayudaCls}>
              Se ve al dar vuelta la tarjeta, que es donde el cliente busca cuando duda.
              Vacío = lo escribe Bookea según tu tipo de tarjeta.{" "}
              <span className="whitespace-nowrap">
                {borrador.textoReverso.length}/{MAX_REVERSO}
              </span>
            </p>
          </div>
        </div>

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
