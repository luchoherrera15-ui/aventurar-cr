"use client";

import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorTipoExplorable from "@/components/lealtad/selector-tipo-explorable";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import { configPorDefecto, TIPOS_TARJETA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { planQueDesbloquea, tiposDelPlan } from "@/lib/lealtad/planes";

/**
 * MODO 1 — el «menú manipulable» que pidió el dueño mirando Passtastic.
 *
 * Reemplaza al viejo paso «negocio» de los puntitos. La diferencia no es
 * cosmética: ahí había un campo de nombre del negocio, acá NO — el
 * dueño lo dijo textual («no pongas para que la gente ponga el
 * nombre»). Solo tres cosas: paletas de color, los ocho tipos, un
 * botón. El nombre se muda a la sección «Tu negocio» del editor
 * completo (Modo 3), no desaparece.
 *
 * Por lo mismo, la vista previa de acá es genérica a propósito
 * («Tu negocio» fijo, sin campo que lo cambie) — es una vitrina para
 * decidir tipo y color, no el armado fino.
 */
export default function MenuInicialLealtad({
  modo,
  colorFondo,
  colorSello,
  alElegirTipo,
  alElegirColores,
  alContinuar,
}: {
  modo: TipoTarjeta;
  colorFondo: string;
  colorSello: string;
  alElegirTipo: (t: TipoTarjeta) => void;
  alElegirColores: (c: { fondo: string; sello: string }) => void;
  alContinuar: () => void;
}) {
  const gratis = tiposDelPlan("prueba").includes(modo);
  const planQueAbre = !gratis ? planQueDesbloquea(modo) : null;

  const datosVista: DatosVista = {
    negocioNombre: "Tu negocio",
    modo,
    beneficio: configPorDefecto(modo),
    colorFondo,
    colorSello,
    logoUrl: null,
    iconoSello: null,
  };

  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr]">
      {/* ============== PALETAS + TIPOS + BOTÓN ============== */}
      <div className="border-b border-bookea-linea p-4 lg:border-b-0 lg:border-r lg:p-5">
        <h2 className="titulo text-[18px] text-bookea-tinta">Armá tu tarjeta</h2>
        <p className="mt-0.5 text-[12px] text-bookea-gris">
          Elegí un color y un tipo — lo demás lo afinás en el siguiente paso.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
              Color de la tarjeta
            </span>
            <PlantillasColor colorFondo={colorFondo} colorSello={colorSello} alElegir={alElegirColores} />
          </div>

          <div>
            <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
              Tipo de tarjeta
            </span>
            <SelectorTipoExplorable valor={modo} alElegir={alElegirTipo} />
          </div>
        </div>

        <div className="mt-5">
          {planQueAbre && (
            <p className="mb-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] leading-snug text-amber-800">
              <strong className="font-extrabold">
                Las tarjetas de {TIPOS_TARJETA[modo].nombre.toLowerCase()} vienen con el paquete{" "}
                {planQueAbre.nombre}.
              </strong>{" "}
              Podés armarla igual — es gratis, y en el siguiente paso ves los paquetes.
            </p>
          )}
          <button
            type="button"
            onClick={alContinuar}
            className="presionable w-full rounded-full px-5 py-3 text-[13.5px] font-extrabold"
            style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
          >
            {gratis ? "¡Creá tu pase gratis! →" : "Seguí armando tu tarjeta →"}
          </button>
        </div>
      </div>

      {/* ============== VISTA PREVIA ============== */}
      <div
        className="flex items-center justify-center px-4 py-5"
        style={{ background: "linear-gradient(155deg,#dceaf5,var(--accion-suave))" }}
      >
        <VistaPase datos={datosVista} superficie="clara" marco="telefono" />
      </div>
    </div>
  );
}
