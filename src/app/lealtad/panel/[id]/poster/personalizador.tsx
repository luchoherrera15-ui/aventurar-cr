"use client";

import { useState, useTransition } from "react";
import {
  ESTILOS,
  ESTILOS_PLANTILLA,
  TOPES_POSTER,
  contenidoDelPoster,
  esEstiloPlantilla,
  validarConfigPoster,
  variablesDePoster,
  type ConfigPoster,
} from "@/lib/lealtad/plantillas-poster";
import HojaPoster, { type DatosHoja } from "./hoja-poster";
import { guardarPosterConfig } from "./poster-actions";

/**
 * EL PÓSTER QUE EL DUEÑO ESCRIBE.
 *
 * El formulario al costado y la hoja al lado, actualizándose con cada
 * tecla. Sin previsualización en vivo esto sería «escribí, guardá,
 * imprimí, mirá, volvé»: cuatro pasos para descubrir que el título no
 * entraba. Acá se ve mientras se escribe, que es cuando todavía es
 * barato cambiarlo.
 *
 * El estado vive acá y NO en la URL —al revés que el estilo elegido—
 * porque son doce campos que cambian en cada tecla: en la URL sería
 * una entrada de historial por letra y un `router.replace` por
 * pulsación. Lo que se guarda, se guarda en la base.
 *
 * El formulario entero lleva `no-imprimir`: al papel va la hoja, nunca
 * los controles.
 */

export default function Personalizador({
  ranchoId,
  programaId,
  tipo,
  inicial,
  colores,
  datos,
  puedeGuardar,
  avisoBase,
}: {
  ranchoId: string;
  /** null = todavía no hay programa creado; se puede probar, no guardar. */
  programaId: string | null;
  tipo: string | null;
  inicial: ConfigPoster;
  /** Los colores del PASE. El póster puede tener otros. */
  colores: { fondo: string; acento: string };
  datos: DatosHoja;
  puedeGuardar: boolean;
  /** Lo que ya se sabe que va a fallar al guardar (0132 sin pegar). */
  avisoBase: string | null;
}) {
  const [config, setConfig] = useState<ConfigPoster>(inicial);
  const [guardando, empezar] = useTransition();
  const [estado, setEstado] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const problema = validarConfigPoster(config);
  const contenido = contenidoDelPoster("personalizado", tipo, config);
  const variables = variablesDePoster(colores, config);

  function cambiar(parche: Partial<ConfigPoster>) {
    setConfig((previo) => ({ ...previo, ...parche }));
    // El «guardado» de hace un minuto deja de ser cierto en cuanto se
    // toca una tecla: dejarlo puesto es decirle al dueño que lo que ve
    // en pantalla es lo que está en la base.
    setEstado(null);
  }

  function cambiarPaso(indice: number, texto: string) {
    const pasos: [string, string, string] = [config.pasos[0], config.pasos[1], config.pasos[2]];
    pasos[indice] = texto;
    cambiar({ pasos });
  }

  function guardar() {
    if (problema) {
      setEstado({ tono: "error", texto: problema });
      return;
    }
    if (!programaId) {
      setEstado({ tono: "error", texto: "Todavía no hay una tarjeta creada para guardarle el póster." });
      return;
    }
    empezar(async () => {
      const r = await guardarPosterConfig(ranchoId, programaId, config);
      setEstado(
        r.ok
          ? { tono: "ok", texto: "Guardado. El póster queda así para todo el que lo imprima." }
          : { tono: "error", texto: r.motivo },
      );
    });
  }

  return (
    <div className="poster-taller">
      <form className="poster-editor no-imprimir" onSubmit={(e) => e.preventDefault()}>
        <p className="poster-editor-titulo">Tu póster</p>

        <label className="poster-campo">
          <span className="poster-etiqueta">Arranca del diseño</span>
          <select
            className="poster-control"
            value={config.base}
            // Con el guard y no con un `as`: el valor sale del DOM, y el
            // día que alguien lo cambie desde las herramientas del
            // navegador el `as` habría dejado pasar un layout que no
            // existe hasta reventar en `ESTILOS[base]`.
            onChange={(e) => {
              if (esEstiloPlantilla(e.target.value)) cambiar({ base: e.target.value });
            }}
          >
            {ESTILOS_PLANTILLA.map((id) => (
              <option key={id} value={id}>
                {ESTILOS[id].nombre}
              </option>
            ))}
          </select>
          <span className="poster-ayuda">{ESTILOS[config.base].seNota}</span>
        </label>

        <label className="poster-campo">
          <span className="poster-etiqueta">
            Título
            <b className="poster-cuenta">
              {config.titulo.length}/{TOPES_POSTER.titulo}
            </b>
          </span>
          {/* Textarea y no input: el título se parte en dos líneas y el
              corte lo decide quien escribe, no el ancho de la caja. */}
          <textarea
            className="poster-control"
            rows={2}
            value={config.titulo}
            onChange={(e) => cambiar({ titulo: e.target.value })}
          />
          <span className="poster-ayuda">Enter para partirlo en dos líneas. Máximo dos.</span>
        </label>

        <label className="poster-campo">
          <span className="poster-etiqueta">
            Línea bajo el QR
            <b className="poster-cuenta">
              {config.invitacion.length}/{TOPES_POSTER.invitacion}
            </b>
          </span>
          <input
            className="poster-control"
            value={config.invitacion}
            onChange={(e) => cambiar({ invitacion: e.target.value })}
          />
        </label>

        <fieldset className="poster-grupo">
          <legend className="poster-etiqueta">Los tres pasos</legend>
          {config.pasos.map((paso, i) => (
            <input
              key={i}
              className="poster-control"
              value={paso}
              aria-label={`Paso ${i + 1}`}
              onChange={(e) => cambiarPaso(i, e.target.value)}
            />
          ))}
        </fieldset>

        <fieldset className="poster-grupo">
          <legend className="poster-etiqueta">Qué se muestra</legend>
          <label className="poster-check">
            <input
              type="checkbox"
              checked={config.mostrarPasos}
              onChange={(e) => cambiar({ mostrarPasos: e.target.checked })}
            />
            Los tres pasos
          </label>
          <label className="poster-check">
            <input
              type="checkbox"
              checked={config.mostrarPremio}
              onChange={(e) => cambiar({ mostrarPremio: e.target.checked })}
            />
            El bloque del premio
          </label>
          <label className="poster-check">
            <input
              type="checkbox"
              checked={config.mostrarPie}
              onChange={(e) => cambiar({ mostrarPie: e.target.checked })}
            />
            El pie de «sin apps que instalar»
          </label>
        </fieldset>

        <fieldset className="poster-grupo">
          <legend className="poster-etiqueta">Colores del papel</legend>
          <label className="poster-color">
            <input
              type="color"
              value={config.colorFondo}
              onChange={(e) => cambiar({ colorFondo: e.target.value })}
            />
            Fondo
          </label>
          <label className="poster-color">
            <input
              type="color"
              value={config.colorAcento}
              onChange={(e) => cambiar({ colorAcento: e.target.value })}
            />
            Acento
          </label>
          <span className="poster-ayuda">
            Son los del póster, no los de la tarjeta: el papel y la pantalla no se
            leen igual. La tinta del texto se ajusta sola para que se lea.
          </span>
        </fieldset>

        {puedeGuardar ? (
          <button
            type="button"
            className="poster-guardar"
            onClick={guardar}
            disabled={guardando || problema !== null}
          >
            {guardando ? "Guardando…" : "Guardar mi póster"}
          </button>
        ) : (
          <p className="poster-ayuda">
            Podés probar el diseño e imprimirlo. Guardarlo para todos lo hace el
            dueño del negocio.
          </p>
        )}

        {problema && <p className="poster-estado es-error">{problema}</p>}
        {!problema && avisoBase && <p className="poster-estado es-error">{avisoBase}</p>}
        {estado && (
          <p className={`poster-estado ${estado.tono === "ok" ? "es-ok" : "es-error"}`} role="status">
            {estado.texto}
          </p>
        )}
      </form>

      <HojaPoster
        estilo="personalizado"
        layout={config.base}
        contenido={contenido}
        variables={variables}
        datos={datos}
      />
    </div>
  );
}
