"use client";

import { useEffect, useState, useTransition } from "react";
import {
  enviarCampanaConPlantilla,
  previsualizarCampana,
  type ResultadoCampana,
} from "./actions";
import {
  PLANTILLAS_CAMPANA,
  type EdicionCampana,
  type PlantillaCampana,
} from "@/lib/correo/plantillas-campana";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL COMPOSITOR DE CAMPAÑAS CON PLANTILLA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): poder mandar «un mensaje ya hecho, algo
 * profesional que enganche», con el mockup de los pases adentro.
 *
 * El compositor viejo —asunto, título y un textarea— sigue existiendo al
 * lado, en la otra pestaña: para un aviso puntual escribir tres campos
 * es más rápido que editar una plantilla. Lo que no servía era usarlo
 * para VENDER: cada campaña había que redactarla de cero y salía sin
 * una sola imagen del producto.
 *
 * ── LA VISTA PREVIA NO ES UN LUJO ───────────────────────────────────
 *
 * Hasta ahora el panel mandaba A CIEGAS: un `window.confirm` con el
 * número de destinatarios y afuera. Nadie veía el correo antes de que
 * saliera, y una campaña no se puede deshacer.
 *
 * Se pinta dentro de un `<iframe srcDoc>` y NO inyectando el HTML en la
 * página. Dos motivos: el correo trae su propio `<html>` y `<body>` con
 * estilos que pisarían los del panel, y el iframe lo aísla igual que lo
 * hace el cliente de correo — que es justo lo que se quiere comprobar.
 *
 * El HTML lo arma el SERVIDOR (`previsualizarCampana`), no este
 * componente: `layoutBento` sale de `@/lib/email`, que arrastra el
 * cliente de Resend con su API key. Importarlo acá lo metería en el
 * bundle del navegador.
 */

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

/** El estado editable arranca como una copia de la plantilla elegida. */
function edicionDe(p: PlantillaCampana): EdicionCampana {
  return {
    titulo: p.titulo,
    intro: p.intro,
    destacado: p.destacado ?? "",
    cuerpo: [...p.cuerpo],
    conMockup: p.conMockup,
  };
}

export default function CompositorPlantilla({
  correosSeleccionados,
  onEnviado,
}: {
  correosSeleccionados: string[];
  onEnviado: (r: ResultadoCampana) => void;
}) {
  const [plantillaId, setPlantillaId] = useState(PLANTILLAS_CAMPANA[0].id);
  const plantilla =
    PLANTILLAS_CAMPANA.find((p) => p.id === plantillaId) ?? PLANTILLAS_CAMPANA[0];

  const [asunto, setAsunto] = useState(plantilla.asunto);
  const [edicion, setEdicion] = useState<EdicionCampana>(() => edicionDe(plantilla));
  const [vista, setVista] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  /** Cambiar de plantilla reemplaza el borrador entero, a propósito:
   *  mezclar el titular de una con el cuerpo de otra produce un correo
   *  que no dice nada coherente. */
  function elegir(id: string) {
    const p = PLANTILLAS_CAMPANA.find((x) => x.id === id);
    if (!p) return;
    setPlantillaId(id);
    setAsunto(p.asunto);
    setEdicion(edicionDe(p));
    setError(null);
  }

  /**
   * La vista previa se pide al servidor cada vez que cambia algo, con
   * medio segundo de espera.
   *
   * El `setTimeout` NO es decorativo: sin él, cada tecla del titular
   * dispara una server action. Escribir una frase de 40 caracteres son
   * 40 viajes al servidor, y las respuestas pueden volver desordenadas
   * — la vista previa terminaría mostrando un texto viejo.
   *
   * `cancelado` cubre el mismo problema desde el otro lado: si la
   * plantilla cambia mientras una respuesta está en vuelo, esa
   * respuesta ya no corresponde a lo que hay en pantalla y se descarta.
   */
  useEffect(() => {
    let cancelado = false;
    const t = setTimeout(async () => {
      const res = await previsualizarCampana(plantillaId, edicion);
      if (cancelado) return;
      if (res.error) setError(res.error);
      else setVista(res.html);
    }, 500);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [plantillaId, edicion]);

  function cambiarCuerpo(texto: string) {
    // Un párrafo por línea no vacía: es la forma más simple de editar
    // varios párrafos sin pedirle HTML a nadie.
    setEdicion((e) => ({ ...e, cuerpo: texto.split(/\n{2,}|\n/) }));
  }

  function enviar() {
    setError(null);
    if (correosSeleccionados.length === 0) {
      setError("Elegí al menos un destinatario.");
      return;
    }
    if (!asunto.trim() || !edicion.titulo.trim()) {
      setError("Completá el asunto y el título.");
      return;
    }

    const cuantos = correosSeleccionados.length;
    const ok = window.confirm(
      `¿Enviar «${asunto.trim()}» a ${cuantos} persona${cuantos === 1 ? "" : "s"}? Esto no se puede deshacer.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const res = await enviarCampanaConPlantilla(
        correosSeleccionados,
        plantillaId,
        asunto,
        edicion,
      );
      if (res.error) setError(res.error);
      else onEnviado(res);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Elegir la plantilla ─────────────────────────────────── */}
      <div>
        <p className={labelCls}>Mensaje</p>
        <div className="flex flex-col gap-2">
          {PLANTILLAS_CAMPANA.map((p) => {
            const activa = p.id === plantillaId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => elegir(p.id)}
                aria-pressed={activa}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  activa
                    ? "border-aventurea-navy bg-aventurea-navy/[0.05]"
                    : "border-aventurea-line bg-aventurea-cream-2/40 hover:border-aventurea-navy/40"
                }`}
              >
                <span className="block text-[13.5px] font-bold text-aventurea-ink">
                  {p.nombre}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-aventurea-ink-soft">
                  {p.paraQuien}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>Asunto</label>
        <input
          type="text"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Título grande</label>
        <input
          type="text"
          value={edicion.titulo}
          onChange={(e) => setEdicion((x) => ({ ...x, titulo: e.target.value }))}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Bajada</label>
        <textarea
          value={edicion.intro}
          onChange={(e) => setEdicion((x) => ({ ...x, intro: e.target.value }))}
          rows={2}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      </div>

      <div>
        <label className={labelCls}>Destacado naranja (opcional)</label>
        <textarea
          value={edicion.destacado ?? ""}
          onChange={(e) => setEdicion((x) => ({ ...x, destacado: e.target.value }))}
          rows={2}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      </div>

      <div>
        <label className={labelCls}>Cuerpo — un párrafo por línea</label>
        <textarea
          value={edicion.cuerpo.join("\n\n")}
          onChange={(e) => cambiarCuerpo(e.target.value)}
          rows={7}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-dashed border-aventurea-line bg-aventurea-cream-2/50 p-3.5">
        <input
          type="checkbox"
          checked={edicion.conMockup}
          onChange={(e) =>
            setEdicion((x) => ({ ...x, conMockup: e.target.checked }))
          }
          className="mt-0.5 h-4 w-4 accent-[#16295e]"
        />
        <span>
          <span className="block text-[13px] font-bold text-aventurea-ink">
            Mostrar el pase de lealtad
          </span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-aventurea-ink-soft">
            Va dibujado con tablas y no como imagen: Outlook y Gmail bloquean
            las imágenes por defecto, y así el pase se ve siempre.
          </span>
        </span>
      </label>

      {/* ── La vista previa ─────────────────────────────────────── */}
      <div>
        <p className={labelCls}>Vista previa</p>
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-[#f6f6f6]">
          {vista ? (
            <iframe
              // `sandbox` sin `allow-same-origin` ni `allow-scripts`: es
              // un correo, no una página. Sin esto el iframe podría
              // navegar la pestaña del panel desde su propio contenido.
              sandbox=""
              srcDoc={vista}
              title="Vista previa del correo"
              className="block h-[560px] w-full border-0"
            />
          ) : (
            <p className="p-8 text-center text-[13px] text-aventurea-ink-soft">
              Armando la vista previa…
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3.5 text-[13px] text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="rounded-xl bg-aventurea-navy px-5 py-3 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {enviando
          ? "Enviando…"
          : `Enviar a ${correosSeleccionados.length} persona${correosSeleccionados.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
