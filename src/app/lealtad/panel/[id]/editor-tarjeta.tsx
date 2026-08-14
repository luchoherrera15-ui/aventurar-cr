"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  configPorDefecto,
  metaDe,
  TIPOS_TARJETA,
  tipoDe,
  validarBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { avisoDeMeta, puedeCambiarTipo, puedeEditarse, type SituacionTarjeta } from "@/lib/lealtad/editable";
import { Icono, type NombreIcono } from "./iconos";
import SelectorTipo from "./selector-tipo";
import PasoBeneficio from "./paso-beneficio";
import PasoReglas, { resumenDeReglas, type Reglas } from "./paso-reglas";
import EditorRecompensas from "./editor-recompensas";
import VistaPase from "./vista-pase";
import { BloqueEstado } from "./pases-panel";
import { BloqueDiseno } from "./seccion-tarjeta-digital";
import { AvisoError, AvisoGuardado, BarraGuardar, NotaCercania, usePrograma } from "./programa-contexto";
import AyudaDeDiseno from "./ayuda-diseno";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";
import { guardarBeneficio } from "./pases-actions";

/**
 * EL EDITOR DE UNA TARJETA QUE YA EXISTE.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ES UNA PANTALLA POR TARJETA Y NO UNA SECCIÓN DEL PANEL
 * ------------------------------------------------------------------
 * Las secciones «Recompensas» y «Tarjeta digital» del panel cuelgan de
 * la tarjeta PRINCIPAL —la que `elegirPrograma` decide que manda— y
 * desde la 0134 un negocio puede tener varias. O sea que con dos
 * tarjetas, tocar la B llevaba a editar la A: los enlaces de la lista
 * apuntaban todos a la misma ancla y no existía ninguna ruta que dijera
 * QUÉ tarjeta se estaba editando.
 *
 * Acá el id viaja en la URL. La pantalla edita esa, y ninguna otra.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTE ARCHIVO NO DECIDE
 * ------------------------------------------------------------------
 * Nada. El candado del tipo, el veredicto de si la tarjeta se puede
 * editar y el tope del paquete se vuelven a comprobar en
 * `guardarBeneficio` con las mismas funciones puras
 * (src/lib/lealtad/editable.ts). Acá se pintan para que el dueño lo
 * sepa ANTES de escribir, no para autorizar: una petición armada a mano
 * no pasa por este archivo.
 */

type Pestana = "beneficio" | "diseno" | "recompensas" | "estado";

const PESTANAS: { id: Pestana; etiqueta: string; icono: NombreIcono }[] = [
  { id: "beneficio", etiqueta: "Qué se gana", icono: "recompensas" },
  { id: "diseno", etiqueta: "Cómo se ve", icono: "tarjeta" },
  { id: "recompensas", etiqueta: "Regalías", icono: "listo" },
  { id: "estado", etiqueta: "Estado", icono: "inicio" },
];

const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris";

export default function EditorTarjeta({
  ranchoId,
  programaId,
  negocioNombre,
  plan,
  situacion,
  nombreInicial,
  beneficioInicial,
  reglasIniciales,
  metaActual,
  ayudaInicial = null,
}: {
  ranchoId: string;
  programaId: string;
  negocioNombre: string;
  plan: string | null;
  situacion: SituacionTarjeta;
  nombreInicial: string;
  beneficioInicial: ConfigBeneficio;
  reglasIniciales: Reglas;
  /**
   * La meta que la tarjeta promete HOY. En sellos sale de la recompensa
   * activa más barata —que es de donde la saca el pase real— y no del
   * jsonb, así que el aviso de «vas a mover la meta» compara contra lo
   * que el cliente ve en el teléfono.
   */
  metaActual: number | null;
  /** El hilo de ayuda con el equipo, si ya hay uno abierto (0149). */
  ayudaInicial?: HiloAyuda | null;
}) {
  const [pestana, setPestana] = useState<Pestana>("beneficio");
  const { borrador } = usePrograma();

  const editable = puedeEditarse(situacion);

  return (
    <div className="space-y-5">
      {!editable.puede && (
        <p
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[13px] font-bold leading-relaxed text-amber-900"
        >
          {editable.motivo}
        </p>
      )}

      {/* ── Pestañas ─────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Qué de la tarjeta querés cambiar"
      >
        {PESTANAS.map((p) => {
          const puesta = pestana === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={puesta}
              onClick={() => setPestana(p.id)}
              className={`presionable flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-bold ${
                puesta
                  ? "border-bookea-azul bg-bookea-azul text-white"
                  : "border-bookea-linea bg-white text-bookea-gris"
              }`}
            >
              <Icono nombre={p.icono} className="h-4 w-4" />
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      <AvisoError />
      <AvisoGuardado />

      {pestana === "beneficio" && (
        <PanelBeneficio
          ranchoId={ranchoId}
          programaId={programaId}
          negocioNombre={negocioNombre}
          plan={plan}
          situacion={situacion}
          bloqueada={!editable.puede}
          nombreInicial={nombreInicial}
          beneficioInicial={beneficioInicial}
          reglasIniciales={reglasIniciales}
          metaActual={metaActual}
        />
      )}

      {pestana === "diseno" && (
        <div className="space-y-5">
          <BloqueDiseno />
          <BarraGuardar />
          <NotaCercania />
        </div>
      )}

      {pestana === "recompensas" && <EditorRecompensas />}

      {pestana === "estado" && (
        <div className="space-y-4">
          <BloqueEstado />
          <p className="rounded-2xl border border-bookea-linea bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-bookea-gris">
            Archivar libera el cupo de tarjetas de tu paquete al instante. Los clientes que
            ya tienen esta tarjeta no pierden nada: su saldo y su historial quedan tal cual,
            pero deja de emitir pases nuevos.
          </p>
          <Link
            href={`/lealtad/panel/${ranchoId}#programas`}
            className="inline-block text-[12.5px] font-bold text-bookea-azul underline"
          >
            ← Volver a mis tarjetas
          </Link>
        </div>
      )}

      {/* ── La salida cuando no le gusta cómo quedó ────────────────
          Fuera de las pestañas a propósito: se ve desde las cuatro. El
          dueño que no está conforme con su tarjeta no llega ahí por un
          camino en particular, y una puerta que solo existe en una
          pestaña es una puerta que no está.

          Lo visual sale del BORRADOR compartido y no de la fila
          guardada: si acaba de mover los colores y todavía no guardó,
          lo que no le gusta es lo que está viendo. */}
      <AyudaDeDiseno
        ranchoId={ranchoId}
        programaId={programaId}
        hiloInicial={ayudaInicial}
        tipo={tipoDe(borrador.modo)}
        colorFondo={borrador.colorFondo}
        colorSello={borrador.colorSello}
        iconoSello={borrador.iconoSello}
        tieneLogo={borrador.logoUrl.trim().length > 0}
        tieneBanda={borrador.bannerUrl.trim().length > 0}
      />
    </div>
  );
}

// ── «Qué se gana»: tipo, beneficio y reglas ────────────────────────

function PanelBeneficio({
  ranchoId,
  programaId,
  negocioNombre,
  plan,
  situacion,
  bloqueada,
  nombreInicial,
  beneficioInicial,
  reglasIniciales,
  metaActual,
}: {
  ranchoId: string;
  programaId: string;
  negocioNombre: string;
  plan: string | null;
  situacion: SituacionTarjeta;
  bloqueada: boolean;
  nombreInicial: string;
  beneficioInicial: ConfigBeneficio;
  reglasIniciales: Reglas;
  metaActual: number | null;
}) {
  const { borrador, sincronizarPrograma } = usePrograma();

  const [nombre, setNombre] = useState(nombreInicial);
  const [tipo, setTipo] = useState<TipoTarjeta>(situacion.tipo);
  const [beneficio, setBeneficio] = useState<ConfigBeneficio>(beneficioInicial);
  const [reglas, setReglas] = useState<Reglas>(reglasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [guardando, guardar] = useTransition();

  const cambio = puedeCambiarTipo(situacion);
  const motivoBeneficio = validarBeneficio(beneficio);

  const aviso = useMemo(
    () =>
      avisoDeMeta({
        miembros: situacion.miembros,
        anterior: metaActual,
        nueva: metaDe(beneficio),
        tipo,
      }),
    [situacion.miembros, metaActual, beneficio, tipo],
  );

  const resumen = resumenDeReglas(reglas);

  // Cambiar de tipo REEMPLAZA la config: los campos de una gift card no
  // significan nada en una tarjeta de sellos, y arrastrarlos dejaría
  // basura invisible en el jsonb. Es la misma regla del creador.
  function elegirTipo(nuevo: TipoTarjeta) {
    setTipo(nuevo);
    setBeneficio(configPorDefecto(nuevo));
    setError(null);
    setListo(false);
  }

  function aplicar() {
    setError(null);
    setListo(false);
    guardar(async () => {
      const res = await guardarBeneficio(ranchoId, programaId, {
        nombre: nombre.trim(),
        tipo,
        beneficio,
        reglas,
      });
      if (res.error) setError(res.error);
      else if (res.programa) {
        // El borrador compartido tiene que enterarse: si no, el próximo
        // «Guardar» de la pestaña del diseño mandaría el nombre y el
        // modo viejos y revertiría esto sin que nadie lo pida.
        sincronizarPrograma(res.programa, res.recompensas);
        setListo(true);
      }
    });
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-5">
        {/* ── Nombre y tipo ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-bookea-linea bg-white p-5">
          <div>
            <label className={etiqueta} htmlFor="e-nombre">
              Nombre de la tarjeta
            </label>
            <input
              id="e-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={bloqueada}
              maxLength={80}
              className={campo}
            />
            <p className="mt-1.5 text-[11.5px] text-bookea-gris">
              Es el nombre con el que la ves vos en el panel. En el pase, el cliente lee el
              nombre del negocio.
            </p>
          </div>

          <div className="mt-5">
            <span className={etiqueta}>Tipo de tarjeta</span>
            {cambio.puede && !bloqueada ? (
              <>
                <SelectorTipo valor={tipo} alElegir={elegirTipo} plan={plan} />
                <p className="mt-2 text-[11.5px] leading-relaxed text-bookea-gris">
                  Todavía no hay nadie adentro, así que el tipo se puede cambiar. Apenas se
                  afilie el primer cliente queda fijo — su saldo pasaría a significar otra
                  cosa.
                </p>
              </>
            ) : (
              <TipoCerrado tipo={tipo} motivo={cambio.puede ? null : cambio.motivo} />
            )}
          </div>
        </div>

        {/* ── El beneficio ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-bookea-linea bg-white p-5">
          <h3 className="text-[15px] font-bold text-bookea-tinta">Qué se gana</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-bookea-gris">
            {TIPOS_TARJETA[tipo].descripcion}
          </p>
          <div className="mt-4">
            <PasoBeneficio config={beneficio} alCambiar={setBeneficio} />
          </div>
          {motivoBeneficio && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-bookea-naranja-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-naranja-fuerte"
            >
              {motivoBeneficio}
            </p>
          )}
          {aviso && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] font-bold leading-relaxed text-amber-800"
            >
              {aviso}
            </p>
          )}
        </div>

        {/* ── Las reglas ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-bookea-linea bg-white p-5">
          <h3 className="text-[15px] font-bold text-bookea-tinta">Cuándo vale</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-bookea-gris">
            Hoy: <strong>{resumen.vigencia}</strong> · {resumen.cuando} · {resumen.canjes}.
          </p>
          <div className="mt-4">
            <PasoReglas reglas={reglas} alCambiar={setReglas} />
          </div>
        </div>

        {/* ── Guardar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={aplicar}
            disabled={bloqueada || guardando || motivoBeneficio !== null || !nombre.trim()}
            className="presionable rounded-xl bg-bookea-tinta px-5 py-3 text-[13px] font-extrabold text-white disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar lo que se gana"}
          </button>
          {listo && (
            <p role="status" className="text-[12.5px] font-bold text-aventurea-green">
              Guardado. Las tarjetas que ya están en teléfonos ajenos cambian la próxima vez
              que el teléfono las actualice.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* ── Vista previa ────────────────────────────────────────── */}
      <aside className="mt-5 lg:mt-0 lg:sticky lg:top-24">
        <VistaPase
          datos={{
            negocioNombre,
            modo: tipo,
            beneficio,
            colorFondo: borrador.colorFondo,
            colorSello: borrador.colorSello,
            iconoSello: borrador.iconoSello,
            logoUrl: borrador.logoUrl || null,
            bannerUrl: borrador.bannerUrl || null,
          }}
        />
      </aside>
    </div>
  );
}

/**
 * El tipo cuando NO se puede cambiar.
 *
 * Se pinta como un dato, no como un selector apagado. Ocho tarjetas
 * deshabilitadas se leen como «esto está roto»; una sola con su nombre
 * y el motivo al lado se lee como lo que es: una decisión ya tomada.
 */
function TipoCerrado({ tipo, motivo }: { tipo: TipoTarjeta; motivo: string | null }) {
  const def = TIPOS_TARJETA[tipo];
  return (
    <div className="rounded-2xl border border-bookea-linea bg-bookea-azul-suave/40 p-4">
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: "var(--navy)" }}
        >
          <Icono nombre={def.icono as NombreIcono} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-extrabold text-bookea-tinta">{def.nombre}</span>
          <span className="block text-[11.5px] text-bookea-gris">{def.descripcion}</span>
        </span>
      </div>
      {motivo && (
        <p className="mt-3 rounded-xl bg-white px-3.5 py-2.5 text-[12px] font-bold leading-relaxed text-bookea-gris">
          {motivo}
        </p>
      )}
    </div>
  );
}
