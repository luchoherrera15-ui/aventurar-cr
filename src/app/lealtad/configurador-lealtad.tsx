"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SelectorTipo from "@/components/lealtad/selector-tipo";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import VistaPase from "@/components/lealtad/vista-pase";
import { configPorDefecto, TIPOS_TARJETA, type ConfigBeneficio, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { PALETAS, coloresDePaleta } from "@/lib/lealtad/paletas";
import { tiposDelPlan, planQueDesbloquea } from "@/lib/lealtad/planes";

/**
 * EL CONFIGURADOR EN VIVO del hero de /lealtad.
 *
 * Antes del rediseño, el hero solo mostraba una maqueta fija del pase
 * (MockupPase). Esto deja que quien llega pruebe los ocho tipos de
 * tarjeta, el color y el premio, y VEA el pase real cambiar — antes de
 * crear cuenta. No es una maqueta aparte: usa SelectorTipo, VistaPase y
 * PlantillasColor, los MISMOS componentes del creador de tarjetas real,
 * así que lo que se ve acá es exactamente lo que el negocio arma
 * después. Dos versiones del mismo selector se desincronizan el día
 * que alguien cambia una y no la otra.
 *
 * El botón no abre un modal de mentira: guarda lo elegido en
 * sessionStorage bajo la MISMA llave que ya lee el asistente
 * (`bookea-lealtad-wizard:nuevo`, ver wizard-alta.tsx) y manda a
 * /lealtad/nuevo — que arranca ya con el nombre, el tipo, el premio y
 * los colores puestos. Si el tipo elegido no entra en el plan Prueba,
 * el botón dice "Continuar con {tipo}" y el mismo asistente pide el
 * paquete correspondiente — no hace falta un flujo de pago aparte acá.
 */

const METAS = [5, 6, 8, 10, 12];
const CLAVE_SESION = "bookea-lealtad-wizard:nuevo";

function beneficioInicial(tipo: TipoTarjeta): ConfigBeneficio {
  const base = configPorDefecto(tipo);
  if (base.tipo === "sellos") return { ...base, recompensa: "Tu próxima bebida, gratis" };
  return base;
}

export default function ConfiguradorLealtad() {
  const router = useRouter();
  const [nombreNegocio, setNombreNegocio] = useState("Café Aroma");
  const [tipo, setTipo] = useState<TipoTarjeta>("sellos");
  const [beneficio, setBeneficio] = useState<ConfigBeneficio>(() => beneficioInicial("sellos"));
  const paletaInicial = coloresDePaleta(PALETAS.sellos);
  const [colorFondo, setColorFondo] = useState(paletaInicial.fondo);
  const [colorSello, setColorSello] = useState(paletaInicial.sello);
  const [ocupado, iniciar] = useTransition();

  const esGratis = tiposDelPlan("prueba").includes(tipo);
  const planQueAbre = planQueDesbloquea(tipo);
  const planDestino = esGratis ? "prueba" : (planQueAbre?.id ?? "arranque");

  function elegirTipo(t: TipoTarjeta) {
    setTipo(t);
    setBeneficio(beneficioInicial(t));
  }

  function comenzar() {
    try {
      sessionStorage.setItem(
        CLAVE_SESION,
        JSON.stringify({ nombreNegocio, modo: tipo, beneficio, colorFondo, colorSello }),
      );
    } catch {
      /* sin sessionStorage el asistente igual arranca, solo sin este adelanto */
    }
    iniciar(() => router.push(`/lealtad/nuevo?plan=${planDestino}`));
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_40px_90px_-30px_rgba(4,10,24,0.55)]">
      <div
        className="flex items-center justify-between gap-2 px-5 py-3"
        style={{ background: "linear-gradient(90deg,#0a1226,#16295e)" }}
      >
        <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-white/85">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#20ae74", boxShadow: "0 0 0 4px rgba(32,174,116,.18)" }}
          />
          Configurador en vivo
        </span>
        <span className="hidden text-[10.5px] font-bold text-white/50 sm:inline">
          Probalo sin crear cuenta
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        <div className="border-b border-bookea-linea p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div className="mb-5 flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold text-white"
              style={{ background: "var(--navy)" }}
            >
              1
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold text-bookea-tinta">Armá tu tarjeta</h2>
              <p className="text-[12px] text-bookea-gris">Probá los ocho tipos. La afinás con calma después.</p>
            </div>
          </div>

          <label className="mb-5 block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
              Nombre de tu negocio
            </span>
            <input
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value.slice(0, 28))}
              maxLength={28}
              placeholder="Tu negocio"
              className="w-full rounded-xl border border-bookea-linea bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-bookea-tinta outline-none focus:border-bookea-azul"
            />
          </label>

          <div className="mb-5">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
              Tipo de tarjeta
            </span>
            <SelectorTipo valor={tipo} alElegir={elegirTipo} plan="prueba" />
          </div>

          {beneficio.tipo === "sellos" && (
            <div className="mb-5 grid grid-cols-[1fr_88px] gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
                  Premio
                </span>
                <input
                  value={beneficio.recompensa}
                  onChange={(e) =>
                    setBeneficio((b) =>
                      b.tipo === "sellos" ? { ...b, recompensa: e.target.value.slice(0, 48) } : b,
                    )
                  }
                  maxLength={48}
                  placeholder="Tu próxima bebida va por nuestra cuenta"
                  className="w-full rounded-xl border border-bookea-linea bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-bookea-tinta outline-none focus:border-bookea-azul"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
                  Meta
                </span>
                <select
                  value={beneficio.requeridos}
                  onChange={(e) =>
                    setBeneficio((b) => (b.tipo === "sellos" ? { ...b, requeridos: Number(e.target.value) } : b))
                  }
                  className="w-full rounded-xl border border-bookea-linea bg-white px-2 py-2.5 text-[13.5px] font-bold text-bookea-tinta outline-none focus:border-bookea-azul"
                >
                  {METAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="mb-6">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
              Color de la tarjeta
            </span>
            <PlantillasColor
              colorFondo={colorFondo}
              colorSello={colorSello}
              alElegir={(c) => {
                setColorFondo(c.fondo);
                setColorSello(c.sello);
              }}
            />
          </div>

          {!esGratis && planQueAbre && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f0c3ad] bg-[#fff4ee] p-3">
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[13px]"
                style={{ color: "#d8541d" }}
              >
                ◆
              </span>
              <p className="text-[11.5px] leading-snug text-[#7a371b]">
                <strong className="block font-extrabold">Requiere el plan {planQueAbre.nombre}</strong>
                Tu diseño queda guardado — lo confirmás en el siguiente paso, no se publica nada todavía.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={comenzar}
            disabled={ocupado}
            className="presionable w-full rounded-full py-3.5 text-[14.5px] font-extrabold disabled:opacity-60"
            style={{ background: "var(--orange)", color: "#0a1226" }}
          >
            {esGratis ? "Comenzar mi programa gratis →" : `Continuar con ${TIPOS_TARJETA[tipo].nombre} →`}
          </button>
          <p className="mt-2.5 text-center text-[11px] text-bookea-gris">
            No publicamos nada sin tu confirmación.
          </p>
        </div>

        <div
          className="flex items-center justify-center p-6 lg:p-8"
          style={{ background: "linear-gradient(155deg,#dceaf5,#f1d5c8)" }}
        >
          <div className="w-full max-w-[300px]">
            <VistaPase
              datos={{ negocioNombre: nombreNegocio, modo: tipo, beneficio, colorFondo, colorSello, logoUrl: null }}
              superficie="clara"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
