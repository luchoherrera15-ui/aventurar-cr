"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import VistaPase from "@/components/lealtad/vista-pase";
import {
  configPorDefecto,
  TIPOS_TARJETA,
  TIPOS_TARJETA_LISTA,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { PALETAS, coloresDePaleta } from "@/lib/lealtad/paletas";
import { tiposDelPlan, planQueDesbloquea } from "@/lib/lealtad/planes";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * EL CONFIGURADOR EN VIVO del hero de /lealtad.
 *
 * Reusa VistaPase y PlantillasColor —los MISMOS componentes del
 * creador real—, así que el pase que se ve acá es exactamente el que
 * se arma después. El selector de tipo NO reusa `SelectorTipo` (el del
 * creador real, con candados de plan): acá los ocho van SIEMPRE
 * clickeables — es una vitrina para explorar, no el punto donde se
 * hace cumplir el paquete. El paquete se decide recién en el botón
 * final ("Continuar con {tipo}" cuando el elegido no es gratis) y lo
 * vuelve a comprobar el servidor —esta pantalla no autoriza nada.
 *
 * El botón guarda lo elegido en sessionStorage bajo la MISMA llave que
 * ya lee el asistente (`bookea-lealtad-wizard:nuevo`, ver
 * wizard-alta.tsx) y manda a /lealtad/nuevo, que arranca ya con esos
 * datos puestos.
 *
 * La imagen que se sube acá es SOLO para la vista previa (FileReader,
 * nunca toca Supabase Storage): quien mira el landing todavía no tiene
 * cuenta, y `SubirImagen` (el que usa el asistente real) exige sesión.
 * Pedirle que suba un archivo de verdad acá terminaría en "se cerró tu
 * sesión" para una sesión que nunca existió. Por eso esa imagen NO
 * viaja en el sessionStorage: en el asistente la sube de nuevo, ya con
 * cuenta y de forma real.
 */

const METAS = [5, 6, 8, 10, 12];
const CLAVE_SESION = "bookea-lealtad-wizard:nuevo";
const MAX_MB_PREVIEW = 5;

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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const tiposGratis = tiposDelPlan("prueba");
  const esGratis = tiposGratis.includes(tipo);
  const planQueAbre = planQueDesbloquea(tipo);
  const planDestino = esGratis ? "prueba" : (planQueAbre?.id ?? "arranque");

  function elegirTipo(t: TipoTarjeta) {
    setTipo(t);
    setBeneficio(beneficioInicial(t));
  }

  function elegirImagen(archivo: File | undefined) {
    setErrorLogo(null);
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      setErrorLogo("Eso no es una imagen.");
      return;
    }
    if (archivo.size > MAX_MB_PREVIEW * 1024 * 1024) {
      setErrorLogo(`Muy pesada — probá con una de menos de ${MAX_MB_PREVIEW} MB.`);
      return;
    }
    const lector = new FileReader();
    lector.onload = () => setLogoPreview(typeof lector.result === "string" ? lector.result : null);
    lector.onerror = () => setErrorLogo("No se pudo leer la imagen. Probá con otra.");
    lector.readAsDataURL(archivo);
  }

  function comenzar() {
    try {
      sessionStorage.setItem(
        CLAVE_SESION,
        // logoUrl queda afuera a propósito: la vista previa es local
        // (FileReader), nunca se sube — no hay cuenta todavía.
        JSON.stringify({ nombreNegocio, modo: tipo, beneficio, colorFondo, colorSello }),
      );
    } catch {
      /* sin sessionStorage el asistente igual arranca, solo sin este adelanto */
    }
    iniciar(() => router.push(`/lealtad/nuevo?plan=${planDestino}`));
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white shadow-[0_30px_70px_-28px_rgba(4,10,24,0.55)]">
      <div
        className="flex items-center justify-between gap-2 px-4 py-2"
        style={{ background: "linear-gradient(90deg,#0a1226,#16295e)" }}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white/85">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#20ae74", boxShadow: "0 0 0 3px rgba(32,174,116,.18)" }}
          />
          Configurador en vivo
        </span>
        <span className="hidden text-[9.5px] font-bold text-white/50 sm:inline">
          Probalo sin crear cuenta
        </span>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr]">
        {/* ============== PANEL DE CONFIGURACIÓN ============== */}
        <div className="border-b border-bookea-linea p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                Nombre del negocio
              </span>
              <input
                value={nombreNegocio}
                onChange={(e) => setNombreNegocio(e.target.value.slice(0, 28))}
                maxLength={28}
                placeholder="Tu negocio"
                className="w-full rounded-lg border border-bookea-linea bg-white px-2.5 py-1.5 text-[12px] font-medium text-bookea-tinta outline-none focus:border-bookea-azul"
              />
            </label>

            <div>
              <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                Imagen del negocio
              </span>
              <label className="presionable flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-bookea-linea bg-white px-2.5 py-1.5 text-[11px] font-bold text-bookea-gris hover:border-bookea-azul">
                {logoPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- vista previa local, no se sube a ningún lado */
                  <img src={logoPreview} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
                ) : (
                  <span aria-hidden>🖼</span>
                )}
                <span className="truncate">{logoPreview ? "Cambiar imagen" : "Opcional"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    elegirImagen(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          {errorLogo && <p className="mb-2 text-[10.5px] font-bold text-red-600">{errorLogo}</p>}

          <div className="mb-3">
            <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
              Tipo de tarjeta
            </span>
            <div role="radiogroup" aria-label="Tipo de tarjeta" className="grid grid-cols-4 gap-1.5">
              {TIPOS_TARJETA_LISTA.map((t) => {
                const elegido = t.id === tipo;
                const gratis = tiposGratis.includes(t.id);
                const abre = !gratis ? planQueDesbloquea(t.id) : null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    onClick={() => elegirTipo(t.id)}
                    className={`presionable relative flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center ${
                      elegido
                        ? "border-bookea-azul bg-bookea-azul-suave"
                        : "border-bookea-linea bg-white hover:border-bookea-azul/40"
                    }`}
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-lg"
                      style={{
                        background: elegido ? "var(--navy)" : "var(--navy-suave)",
                        color: elegido ? "#fff" : "var(--navy)",
                      }}
                    >
                      <Icono nombre={t.icono as NombreIcono} className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[9.5px] font-extrabold leading-tight text-bookea-tinta">
                      {t.nombre}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-[1px] text-[6.5px] font-extrabold uppercase tracking-wide ${
                        gratis ? "bg-emerald-50 text-emerald-700" : "bg-[#fff0e8] text-[#a9451c]"
                      }`}
                    >
                      {gratis ? "Gratis" : abre?.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {beneficio.tipo === "sellos" && (
            <div className="mb-3 grid grid-cols-[1fr_70px] gap-2">
              <label className="block">
                <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
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
                  className="w-full rounded-lg border border-bookea-linea bg-white px-2.5 py-1.5 text-[12px] font-medium text-bookea-tinta outline-none focus:border-bookea-azul"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                  Meta
                </span>
                <select
                  value={beneficio.requeridos}
                  onChange={(e) =>
                    setBeneficio((b) => (b.tipo === "sellos" ? { ...b, requeridos: Number(e.target.value) } : b))
                  }
                  className="w-full rounded-lg border border-bookea-linea bg-white px-1.5 py-1.5 text-[12px] font-bold text-bookea-tinta outline-none focus:border-bookea-azul"
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

          <div className="mb-3">
            <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
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
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#f0c3ad] bg-[#fff4ee] p-2">
              <span aria-hidden className="shrink-0 text-[12px]" style={{ color: "#d8541d" }}>
                ◆
              </span>
              <p className="text-[10.5px] leading-snug text-[#7a371b]">
                <strong className="font-extrabold">Plan {planQueAbre.nombre}. </strong>
                Se guarda igual — lo confirmás en el siguiente paso.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={comenzar}
            disabled={ocupado}
            className="presionable w-full rounded-full py-2.5 text-[13px] font-extrabold disabled:opacity-60"
            style={{ background: "var(--orange)", color: "#0a1226" }}
          >
            {esGratis ? "Comenzar mi programa gratis →" : `Continuar con ${TIPOS_TARJETA[tipo].nombre} →`}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-bookea-gris">
            No publicamos nada sin tu confirmación.
          </p>
        </div>

        {/* ============== VISTA PREVIA, DENTRO DEL TELÉFONO ============== */}
        {/* El marco lo dibuja VistaPase (`marco="telefono"`): así las
            pestañas Apple/Google y el aviso quedan FUERA del teléfono,
            que es donde corresponde — son controles nuestros, no algo
            que se vea en la pantalla del cliente. */}
        <div
          className="flex items-center justify-center px-4 py-5"
          style={{ background: "linear-gradient(155deg,#dceaf5,#f1d5c8)" }}
        >
          <VistaPase
            datos={{
              negocioNombre: nombreNegocio,
              modo: tipo,
              beneficio,
              colorFondo,
              colorSello,
              logoUrl: logoPreview,
            }}
            superficie="clara"
            marco="telefono"
          />
        </div>
      </div>
    </div>
  );
}
