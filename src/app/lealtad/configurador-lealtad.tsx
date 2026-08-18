"use client";

import { useEffect, useState } from "react";
import MenuInicialLealtad from "./menu-inicial-lealtad";
import PanelPaquetesLealtad from "./panel-paquetes-lealtad";
import EditorTarjetaCompleto from "./editor-tarjeta-completo";
import {
  configPorDefecto,
  esTipoTarjeta,
  leerBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { PALETAS, coloresDePaleta, paletaDeLosColores } from "@/lib/lealtad/paletas";
import { esIconoSello, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { esPlantillaIcono } from "@/lib/lealtad/plantillas-icono";
import { PLANTILLAS_FRANJA } from "@/lib/lealtad/plantillas-franjas";

/**
 * EL ORQUESTADOR de `/lealtad` — pivote del 2026-08-18.
 *
 * ------------------------------------------------------------------
 * DE PUNTITOS A TRES MODOS: LA HISTORIA CORTA
 * ------------------------------------------------------------------
 * Hasta ayer este archivo era un asistente de 4-5 pasos con puntitos
 * arriba y "Siguiente" avanzando —negocio, premio, apariencia,
 * (cuenta), revisar—, construido para fusionar el configurador en vivo
 * del hero con `/lealtad/nuevo`. Ese trabajo YA CUMPLIÓ SU PROPÓSITO Y
 * SE SUPERA ACÁ: el dueño lo miró en producción con una captura de
 * Passtastic al lado y pidió otra forma entera, no un ajuste.
 *
 * Los puntitos desaparecen. En su lugar hay TRES MODOS bien distintos,
 * uno por vez, elegidos por `estado.vista`:
 *
 *   1. "menu"     → `MenuInicialLealtad` — SOLO paletas de color, los
 *                    ocho tipos y un botón. SIN nombre del negocio (el
 *                    dueño fue textual: «no pongas para que la gente
 *                    ponga el nombre»). Es vitrina, no formulario.
 *   2. "paquetes" → `PanelPaquetesLealtad` — los cuatro paquetes,
 *                    contextualizados a lo que la persona ya eligió,
 *                    de solo lectura. Se muestra SIEMPRE al avanzar del
 *                    menú, sea el tipo gratis o pago.
 *   3. "editor"   → `EditorTarjetaCompleto` — la pantalla larga estilo
 *                    Passtastic: secciones numeradas que scrollean a la
 *                    izquierda, el pase FIJO (`sticky`) a la derecha.
 *                    Acá vive el nombre del negocio (se mudó, no
 *                    desapareció), la cuenta, y el alta de verdad.
 *
 * Este archivo NO comparte layout entre los tres —a diferencia del
 * patrón de puntitos, que mantenía los pasos montados con el mismo
 * chrome— porque los tres modos son visualmente distintos: Menú y
 * Paquetes viven dentro de una tarjeta `overflow-hidden` (ninguno de
 * los dos necesita `sticky`); el Editor la rompe a propósito, porque
 * `overflow-hidden` en un ancestro mata `position: sticky` y el pase
 * fijo no tendría dónde pegarse.
 *
 * ------------------------------------------------------------------
 * EL RESPALDO EN sessionStorage SIGUE VIVIENDO ACÁ
 * ------------------------------------------------------------------
 * Misma llave que usaba el puente viejo hacia `/lealtad/nuevo`
 * (`CLAVE_SESION`), ahora serializando `EstadoLealtad` completo —
 * INCLUIDA `vista`—: cuando `FormularioAuth` (dentro del Editor, Sección
 * "Tu cuenta") hace su recarga de página entera, se vuelve exactamente a
 * `vista: "editor"` con todo lo demás intacto, no al menú.
 *
 * ------------------------------------------------------------------
 * QUÉ SE RESCATA DEL ASISTENTE VIEJO (nada se reinventa)
 * ------------------------------------------------------------------
 * Los ocho tipos, `PlantillasColor`, el paso de premio/apariencia, la
 * cuenta embebida, el revisar+crear y el aviso ámbar de plan pago SIGUEN
 * SIENDO VÁLIDOS — solo que ya no viven detrás de puntitos: están
 * repartidos entre `MenuInicialLealtad` (tipo+color), `PanelPaquetesLealtad`
 * (los paquetes) y `EditorTarjetaCompleto` (todo lo demás).
 */

export type Vista = "menu" | "paquetes" | "editor";

export type EstadoLealtad = {
  vista: Vista;
  nombreNegocio: string;
  modo: TipoTarjeta;
  beneficio: ConfigBeneficio;
  colorFondo: string;
  colorSello: string;
  iconoSello: IconoSello | null;

  /** "Imagen del negocio" — el sucesor de imagen-stock.ts, ahora 20-30. */
  imagenModo: "ninguna" | "stock" | "propia";
  /** Un id de PLANTILLAS_ICONO — SOLO preview, nunca viaja al servidor. */
  imagenStockId: string | null;
  /** SOLO una subida real (requiere sesión). */
  logoUrl: string | null;

  /** Franja (banner superior del pase). */
  franjaModo: "ninguna" | "banco" | "propia";
  /** Un id de PLANTILLAS_FRANJA — SOLO preview, NUNCA viaja al servidor. */
  franjaBancoId: string | null;
  /** SOLO una subida real (requiere sesión). */
  bannerUrl: string | null;

  telefono: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const CLAVE_SESION = "bookea-lealtad-wizard:nuevo";

function estadoInicial(): EstadoLealtad {
  const base = coloresDePaleta(PALETAS.sellos);
  return {
    vista: "menu",
    nombreNegocio: "",
    modo: "sellos",
    beneficio: configPorDefecto("sellos"),
    colorFondo: base.fondo,
    colorSello: base.sello,
    iconoSello: null,
    imagenModo: "ninguna",
    imagenStockId: null,
    logoUrl: null,
    franjaModo: "ninguna",
    franjaBancoId: null,
    bannerUrl: null,
    telefono: "",
  };
}

/** Una franja del banco de `plantillas-franjas.ts`, y no cualquier string. */
function esFranjaBanco(valor: unknown): valor is string {
  return typeof valor === "string" && PLANTILLAS_FRANJA.some((f) => f.id === valor);
}

/** Igual criterio que `wizard-alta.tsx`: nunca se cree el borrador tal
 *  cual — un valor viejo o manipulado se descarta al default. */
function sanearGuardado(crudo: unknown): EstadoLealtad {
  const limpio = estadoInicial();
  if (!crudo || typeof crudo !== "object") return limpio;
  const c = crudo as Record<string, unknown>;

  if (c.vista === "menu" || c.vista === "paquetes" || c.vista === "editor") {
    limpio.vista = c.vista;
  }
  if (typeof c.nombreNegocio === "string") limpio.nombreNegocio = c.nombreNegocio.slice(0, 80);
  if (typeof c.telefono === "string") limpio.telefono = c.telefono.slice(0, 30);
  if (typeof c.modo === "string" && esTipoTarjeta(c.modo)) {
    limpio.modo = c.modo;
    limpio.beneficio = leerBeneficio(c.beneficio, c.modo) ?? configPorDefecto(c.modo);
  }
  if (typeof c.colorFondo === "string" && HEX.test(c.colorFondo)) limpio.colorFondo = c.colorFondo;
  if (typeof c.colorSello === "string" && HEX.test(c.colorSello)) limpio.colorSello = c.colorSello;
  if (esIconoSello(c.iconoSello)) limpio.iconoSello = c.iconoSello;

  if (c.imagenModo === "stock" && esPlantillaIcono(c.imagenStockId)) {
    limpio.imagenModo = "stock";
    limpio.imagenStockId = c.imagenStockId;
  } else if (c.imagenModo === "propia" && typeof c.logoUrl === "string" && c.logoUrl) {
    limpio.imagenModo = "propia";
    limpio.logoUrl = c.logoUrl;
  }

  if (c.franjaModo === "banco" && esFranjaBanco(c.franjaBancoId)) {
    limpio.franjaModo = "banco";
    limpio.franjaBancoId = c.franjaBancoId;
  } else if (c.franjaModo === "propia" && typeof c.bannerUrl === "string" && c.bannerUrl) {
    limpio.franjaModo = "propia";
    limpio.bannerUrl = c.bannerUrl;
  }

  return limpio;
}

export default function ConfiguradorLealtad({ haySesion }: { haySesion: boolean }) {
  const [estado, setEstado] = useState<EstadoLealtad>(estadoInicial);
  const [restaurado, setRestaurado] = useState(false);

  useEffect(() => {
    try {
      const crudo = sessionStorage.getItem(CLAVE_SESION);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata desde sessionStorage una sola vez por carga
      if (crudo) setEstado(sanearGuardado(JSON.parse(crudo)));
    } catch {
      /* storage bloqueado o JSON roto: se arranca de cero */
    }
    setRestaurado(true);
  }, []);
  useEffect(() => {
    if (!restaurado) return;
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(estado));
    } catch {
      /* sin espacio o bloqueado: el asistente sigue, solo sin respaldo */
    }
  }, [estado, restaurado]);

  const patch = (p: Partial<EstadoLealtad>) => setEstado((e) => ({ ...e, ...p }));

  /**
   * Misma función de siempre (antes vivía a mitad del archivo, líneas
   * 237-249 del asistente de puntitos): la usa TANTO `MenuInicialLealtad`
   * como la Sección 1 del Editor —una sola implementación para que
   * cambiar de tipo se comporte igual en los dos lugares—. Sigue la
   * paleta del tipo nuevo solo si los colores actuales siguen siendo de
   * plantilla (si la persona ya afinó un color a mano, no se lo pisa).
   */
  function elegirTipo(t: TipoTarjeta) {
    setEstado((e) => {
      const sigueEnPlantilla = paletaDeLosColores(e.colorFondo, e.colorSello) !== null;
      const c = sigueEnPlantilla ? coloresDePaleta(PALETAS[t]) : null;
      return {
        ...e,
        modo: t,
        beneficio: configPorDefecto(t),
        colorFondo: c?.fondo ?? e.colorFondo,
        colorSello: c?.sello ?? e.colorSello,
      };
    });
  }

  // ── Modo 3: el editor completo rompe el chrome `overflow-hidden` de
  // los otros dos modos a propósito — un ancestro con `overflow-hidden`
  // le quita a `position: sticky` dónde pegarse, y el pase fijo de la
  // columna derecha necesita ese espacio.
  if (estado.vista === "editor") {
    return (
      <div
        id="configurador-lealtad"
        className="scroll-mt-20 rounded-3xl border border-white/10 bg-white p-5 shadow-[0_30px_70px_-28px_rgba(4,10,24,0.55)] sm:p-8"
      >
        <EditorTarjetaCompleto
          estado={estado}
          alCambiar={patch}
          alElegirTipo={elegirTipo}
          haySesion={haySesion}
          alVolver={() => patch({ vista: "paquetes" })}
        />
      </div>
    );
  }

  return (
    <div
      id="configurador-lealtad"
      className="scroll-mt-20 overflow-hidden rounded-[22px] border border-white/10 bg-white shadow-[0_30px_70px_-28px_rgba(4,10,24,0.55)]"
    >
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ background: "linear-gradient(90deg,#0a1226,#16295e)" }}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white/85">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#20ae74", boxShadow: "0 0 0 3px rgba(32,174,116,.18)" }}
          />
          Armá tu tarjeta acá mismo
        </span>
      </div>

      {estado.vista === "menu" ? (
        <MenuInicialLealtad
          modo={estado.modo}
          colorFondo={estado.colorFondo}
          colorSello={estado.colorSello}
          alElegirTipo={elegirTipo}
          alElegirColores={(c) => patch({ colorFondo: c.fondo, colorSello: c.sello })}
          alContinuar={() => patch({ vista: "paquetes" })}
        />
      ) : (
        <PanelPaquetesLealtad
          tipoElegido={estado.modo}
          alSeguir={() => patch({ vista: "editor" })}
        />
      )}
    </div>
  );
}
