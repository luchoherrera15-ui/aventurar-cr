"use client";

import { useEffect, useState, useTransition } from "react";
import MenuInicialLealtad from "./menu-inicial-lealtad";
import PanelPaquetesLealtad from "./panel-paquetes-lealtad";
import TarjetaFormulario, { type ValorFormulario } from "./tarjeta-formulario";
import { REGLAS_VACIAS } from "./panel/[id]/paso-reglas";
import { solicitarAltaConPlan } from "./nuevo/actions";
import {
  configPorDefecto,
  esTipoTarjeta,
  leerBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { esPlanOfrecido, planQueDesbloquea, tiposDelPlan, type PlanId } from "@/lib/lealtad/planes";
import { PALETAS, coloresDePaleta, paletaDeLosColores } from "@/lib/lealtad/paletas";
import { esIconoSello, SELLO_PROPIO, type SelloElegido } from "@/lib/lealtad/iconos-sello";
import { esPlantillaIcono } from "@/lib/lealtad/plantillas-icono";
import { PLANTILLAS_FRANJA } from "@/lib/lealtad/plantillas-franjas";
import { CONFIG_CLASICA, configDesdeJson, type ConfigTira } from "@/lib/wallet/layout-tira";

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
  /**
   * El paquete que se tocó en Modo 2 (`PanelPaquetesLealtad`) — puro
   * cosmético para el aviso ámbar de «Revisar y crear» en Modo 3. NUNCA
   * decide qué plan hace falta de verdad: eso lo sigue derivando
   * `editor-tarjeta-completo.tsx` 100% de `modo` (el TIPO de tarjeta),
   * porque el servidor revalida el paquete contra el tipo elegido, no
   * contra este campo. Si el dueño elige "Impulso" acá y después arma
   * (Sección 1) un tipo que solo trae Prueba, `planElegido` se queda
   * desactualizado a propósito — no hay drama, es solo un texto.
   */
  planElegido: PlanId | null;
  beneficio: ConfigBeneficio;
  colorFondo: string;
  colorSello: string;
  /** Puede ser 'propio' (0174) — y entonces `iconoUrl` viene con él. */
  iconoSello: SelloElegido | null;
  /** El archivo del sello «Mi ícono» — SOLO una subida real (requiere
   *  sesión, igual que logoUrl/bannerUrl). */
  iconoUrl: string | null;

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
  /** El logo del AVISO de Wallet (0208). SOLO una subida real. */
  notificacionLogoUrl: string | null;

  /**
   * Dónde y de qué tamaño van los sellos en la tira (0212).
   *
   * A diferencia de `imagenStockId`/`franjaBancoId`, esto NO es solo
   * preview: viaja al servidor con el alta y se guarda en la columna.
   */
  diseno: ConfigTira;

  telefono: string;

  /**
   * El código del moderador/agente que refirió el alta (0219). Se
   * captura en el PRIMER paso (los paquetes, pedido del dueño 30 ago
   * 2026): quien llega de la mano de un «reseller» trae el código
   * antes de armar nada. Viaja con `solicitarAltaConPlan`, que lo
   * valida contra `agentes_lealtad` y amarra el negocio al agente.
   */
  codigoReferido: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Exportada para `zona-configurador.tsx`: la zona desplegable necesita
 *  saber si hay un borrador con vista avanzada para abrirse sola tras
 *  la recarga del alta de cuenta. */
export const CLAVE_SESION = "bookea-lealtad-wizard:nuevo";

function estadoInicial(planInicial?: PlanId | null): EstadoLealtad {
  const base = coloresDePaleta(PALETAS.sellos);
  return {
    // (0163) Arranca en "paquetes", no en "menu": el tipo de tarjeta se
    // volvía a preguntar en la Sección 1 del editor ("Tu negocio"), así
    // que el paso de Menú era la misma pregunta dos veces antes de
    // llegar a algo nuevo. "menu" sigue existiendo — un "volver" desde
    // Paquetes puede seguir cayendo ahí — solo dejó de ser la entrada
    // por defecto. Con "sellos" (gratis) como `modo` por defecto, los
    // paquetes se muestran contextualizados a la opción gratuita; si
    // en el editor se elige un tipo que pide más, el aviso ámbar de
    // plan pago ya existente se enciende solo.
    vista: "paquetes",
    nombreNegocio: "",
    modo: "sellos",
    // Trae el plan que la persona ya había elegido en /lealtad/planes
    // (era el `?plan=` que antes leía /lealtad/nuevo). Solo cosmético
    // acá también — ver el comentario del campo, arriba.
    planElegido: planInicial ?? null,
    beneficio: configPorDefecto("sellos"),
    colorFondo: base.fondo,
    colorSello: base.sello,
    iconoSello: null,
    iconoUrl: null,
    imagenModo: "ninguna",
    imagenStockId: null,
    logoUrl: null,
    franjaModo: "ninguna",
    franjaBancoId: null,
    bannerUrl: null,
    notificacionLogoUrl: null,
    diseno: CONFIG_CLASICA,
    telefono: "",
    codigoReferido: "",
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
  // Mismo tope y mayúscula que escribe el input del panel de paquetes.
  if (typeof c.codigoReferido === "string") {
    limpio.codigoReferido = c.codigoReferido.slice(0, 24).toUpperCase();
  }
  if (typeof c.modo === "string" && esTipoTarjeta(c.modo)) {
    limpio.modo = c.modo;
    limpio.beneficio = leerBeneficio(c.beneficio, c.modo) ?? configPorDefecto(c.modo);
  }
  // Un borrador viejo (de antes de esta captura) simplemente no tenía
  // este campo — `typeof !== "string"` cae al default `null` sin
  // romper nada, mismo criterio que el resto de este saneo.
  if (typeof c.planElegido === "string" && esPlanOfrecido(c.planElegido)) {
    limpio.planElegido = c.planElegido;
  }
  if (typeof c.colorFondo === "string" && HEX.test(c.colorFondo)) limpio.colorFondo = c.colorFondo;
  if (typeof c.colorSello === "string" && HEX.test(c.colorSello)) limpio.colorSello = c.colorSello;
  // El ícono propio solo sobrevive el saneo si su archivo vino con él —
  // 'propio' suelto no dibuja nada (mismo criterio que la 0174).
  if (typeof c.iconoUrl === "string" && c.iconoUrl) limpio.iconoUrl = c.iconoUrl;
  if (esIconoSello(c.iconoSello)) limpio.iconoSello = c.iconoSello;
  else if (c.iconoSello === SELLO_PROPIO && limpio.iconoUrl) limpio.iconoSello = SELLO_PROPIO;

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

  // La geometría de la tira (0212). `configDesdeJson` sanea campo por
  // campo, así que un borrador viejo —que ni tenía el campo— cae al
  // layout clásico sin ningún chequeo extra acá.
  if (typeof c.notificacionLogoUrl === "string" && c.notificacionLogoUrl) {
    limpio.notificacionLogoUrl = c.notificacionLogoUrl;
  }
  limpio.diseno = configDesdeJson(c.diseno);

  return limpio;
}

type ExitoAlta = { ranchoId: string; slug: string | null };

export default function ConfiguradorLealtad({
  haySesion,
  planInicial,
}: {
  haySesion: boolean;
  /** El paquete que ya se eligió antes de llegar acá (ej. desde
   *  /lealtad/planes). `null`/ausente = arranca sin ninguno marcado. */
  planInicial?: PlanId | null;
}) {
  const [estado, setEstado] = useState<EstadoLealtad>(() => estadoInicial(planInicial));
  const [restaurado, setRestaurado] = useState(false);
  const [exito, setExito] = useState<ExitoAlta | null>(null);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

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

  /**
   * EL PUENTE HACIA `TarjetaFormulario` (Modo 3, "un solo panel" — el
   * dueño lo pidió también para el panel autenticado; ver el comentario
   * grande de `tarjeta-formulario.tsx`).
   *
   * `EstadoLealtad` y `ValorFormulario` casi coinciden, pero no son el
   * mismo tipo: acá los campos se llaman `nombreNegocio`/`modo` (nacieron
   * así antes de que existiera el panel autenticado) y allá `nombre`/
   * `tipo` (para calzar con crear/editar, que nunca tuvieron el prefijo
   * "Negocio"). Y `reglas`/`vencenMeses`/`iconoUrl` son campos que SOLO
   * usan crear/editar — el alta pública se queda liviana a propósito
   * (ver el comentario grande de `tarjeta-formulario.tsx`), así que acá
   * van fijos al valor vacío y `alCambiarPublico` los descarta si algún
   * día alguien los toca por error: este flujo nunca los muestra en
   * pantalla, pero declararlos explícitos evita que un cambio futuro los
   * escriba en `EstadoLealtad` sin querer.
   */
  const valorPublico: ValorFormulario = {
    nombre: estado.nombreNegocio,
    tipo: estado.modo,
    beneficio: estado.beneficio,
    colorFondo: estado.colorFondo,
    colorSello: estado.colorSello,
    iconoSello: estado.iconoSello,
    iconoUrl: estado.iconoUrl ?? "",
    logoUrl: estado.logoUrl ?? "",
    bannerUrl: estado.bannerUrl ?? "",
    // El logo del AVISO (0208) SÍ se ofrece en el alta pública desde
    // ago 2026, en cuanto hay sesión — igual que el ícono propio.
    notificacionLogoUrl: estado.notificacionLogoUrl ?? "",
    reglas: REGLAS_VACIAS,
    vencenMeses: null,
    telefono: estado.telefono,
    // Viaja en el valor —y no solo en `EstadoLealtad`— porque
    // `irAlPlanPago` respalda este objeto tal cual antes de mandar a
    // /lealtad/nuevo: sin el campo acá, el camino pago perdía el
    // código escrito (y con él, la comisión del moderador).
    codigoReferido: estado.codigoReferido,
    imagenModo: estado.imagenModo,
    imagenStockId: estado.imagenStockId,
    franjaModo: estado.franjaModo,
    franjaBancoId: estado.franjaBancoId,
    diseno: estado.diseno,
    planElegido: estado.planElegido,
  };

  function alCambiarPublico(p: Partial<ValorFormulario>) {
    const cambios: Partial<EstadoLealtad> = {};
    if (p.nombre !== undefined) cambios.nombreNegocio = p.nombre;
    if (p.tipo !== undefined) cambios.modo = p.tipo;
    if (p.beneficio !== undefined) cambios.beneficio = p.beneficio;
    if (p.colorFondo !== undefined) cambios.colorFondo = p.colorFondo;
    if (p.colorSello !== undefined) cambios.colorSello = p.colorSello;
    // Desde ago 2026 'propio' SÍ se acepta acá: el formulario ofrece
    // «Mi ícono» cuando hay sesión (el archivo sube de verdad), así que
    // `EstadoLealtad` lo guarda junto con su `iconoUrl`.
    if (p.iconoSello !== undefined) cambios.iconoSello = p.iconoSello;
    if (p.iconoUrl !== undefined) cambios.iconoUrl = p.iconoUrl || null;
    if (p.logoUrl !== undefined) cambios.logoUrl = p.logoUrl;
    if (p.bannerUrl !== undefined) cambios.bannerUrl = p.bannerUrl;
    if (p.telefono !== undefined) cambios.telefono = p.telefono;
    if (p.codigoReferido !== undefined) cambios.codigoReferido = p.codigoReferido;
    if (p.imagenModo !== undefined) cambios.imagenModo = p.imagenModo;
    if (p.imagenStockId !== undefined) cambios.imagenStockId = p.imagenStockId;
    if (p.franjaModo !== undefined) cambios.franjaModo = p.franjaModo;
    if (p.franjaBancoId !== undefined) cambios.franjaBancoId = p.franjaBancoId;
    if (p.diseno !== undefined) cambios.diseno = p.diseno;
    if (p.notificacionLogoUrl !== undefined) {
      cambios.notificacionLogoUrl = p.notificacionLogoUrl || null;
    }
    if (p.planElegido !== undefined) cambios.planElegido = p.planElegido;
    patch(cambios);
  }

  /**
   * EL GUARDADO DEL ALTA PÚBLICA — se queda acá, no en
   * `tarjeta-formulario.tsx`: es la MISMA lógica que ya tenía
   * `editor-tarjeta-completo.tsx` (solo trasladada), y no se reescribe
   * porque ya funciona en producción. `solicitarAltaConPlan` crea el
   * negocio, la tarjeta y el addon juntos — nada que ver con
   * `crearTarjeta` (crear-actions.ts) o `guardarBeneficio`
   * (pases-actions.ts), que operan sobre un negocio que YA existe.
   */
  function publicarAlta() {
    setErrorAlta(null);
    const b = estado.beneficio;
    const esGratis = tiposDelPlan("prueba").includes(estado.modo);
    const planQueAbre = planQueDesbloquea(estado.modo);
    const planDestino = esGratis ? "prueba" : (planQueAbre?.id ?? "arranque");
    const datos = {
      nombreNegocio: estado.nombreNegocio.trim(),
      // Sin paso de rubro en este flujo: "citas" es el vertical más
      // común de Lealtad y evita el único campo que
      // `solicitarAltaConPlan` exige cuando el tipo es "otro".
      tipo: "citas",
      detalleOtro: "",
      plan: planDestino,
      metodoPago: "sinpe",
      comprobanteUrl: "",
      telefono: estado.telefono,
      // El servidor lo normaliza y valida contra `agentes_lealtad`;
      // un typo frena el alta con aviso en vez de guardarse mudo.
      codigoReferido: estado.codigoReferido,
      personalizado: false,
      descripcion: "",
      paseColor: estado.colorFondo,
      paseLogoUrl: estado.imagenModo === "propia" ? (estado.logoUrl ?? "") : "",
      regalia: b.tipo === "sellos" ? b.recompensa || "Tu regalía" : "Tu regalía",
      metaSellos: b.tipo === "sellos" ? b.requeridos : 10,
      tarjeta: {
        modo: estado.modo,
        beneficio: b,
        colorFondo: estado.colorFondo,
        colorSello: estado.colorSello,
        iconoSello: estado.modo === "sellos" ? estado.iconoSello : null,
        iconoUrl: estado.modo === "sellos" ? estado.iconoUrl : null,
        logoUrl: estado.imagenModo === "propia" ? estado.logoUrl : null,
        // NUNCA cuando franjaModo === "banco": esa ruta es de public/,
        // no de nuestro Storage.
        bannerUrl: estado.franjaModo === "propia" ? estado.bannerUrl : null,
        // La geometría de la tira (0212). El servidor la sanea y solo
        // escribe la columna si difiere del layout de siempre.
        diseno: estado.diseno,
        notificacionLogoUrl: estado.notificacionLogoUrl,
      },
    };
    iniciarGuardado(async () => {
      const res = await solicitarAltaConPlan(datos);
      if (!res.ok) {
        setErrorAlta(res.motivo);
        return;
      }
      try {
        sessionStorage.removeItem(CLAVE_SESION);
      } catch {
        /* sin storage no hay nada que limpiar */
      }
      if (res.creado) setExito({ ranchoId: res.creado.ranchoId, slug: res.creado.slug });
    });
  }

  // ── Modo 3: `TarjetaFormulario` rompe el chrome `overflow-hidden` de
  // los otros dos modos a propósito — un ancestro con `overflow-hidden`
  // le quita a `position: sticky` dónde pegarse, y el pase fijo de la
  // columna derecha necesita ese espacio.
  if (estado.vista === "editor") {
    return (
      <div
        id="configurador-lealtad"
        className="scroll-mt-20 rounded-3xl border border-[#e6eaf3] bg-white p-5 shadow-[0_28px_70px_-30px_rgba(16,38,88,0.35)] sm:p-8"
      >
        {exito ? (
          <PantallaExito ranchoId={exito.ranchoId} slug={exito.slug} nombre={estado.nombreNegocio.trim()} />
        ) : (
          <TarjetaFormulario
            modo="publico"
            negocioNombre=""
            haySesion={haySesion}
            valor={valorPublico}
            alCambiar={alCambiarPublico}
            alVolver={() => patch({ vista: "paquetes" })}
            guardando={guardando}
            error={errorAlta}
            onGuardar={publicarAlta}
          />
        )}
      </div>
    );
  }

  return (
    <div
      id="configurador-lealtad"
      className="scroll-mt-20 overflow-hidden rounded-[22px] border border-[#e6eaf3] bg-white shadow-[0_28px_70px_-30px_rgba(16,38,88,0.35)]"
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
          codigoReferido={estado.codigoReferido}
          alCambiarReferido={(codigo) => patch({ codigoReferido: codigo })}
          alSeguir={(planId) => patch({ planElegido: planId, vista: "editor" })}
        />
      )}
    </div>
  );
}

/**
 * LA PANTALLA DE ÉXITO del alta pública — la misma que tenía
 * `editor-tarjeta-completo.tsx`, trasladada tal cual: reemplaza a
 * `TarjetaFormulario` entero (no una sección más) en cuanto
 * `solicitarAltaConPlan` confirma que el negocio y la tarjeta ya
 * existen.
 */
function PantallaExito({
  ranchoId,
  slug,
  nombre,
}: {
  ranchoId: string;
  slug: string | null;
  nombre: string;
}) {
  return (
    <div className="entra-suave mx-auto max-w-[560px] text-center">
      <h2 className="titulo text-[22px] text-bookea-tinta">¡Tu tarjeta está lista! 🎉</h2>
      <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-bookea-gris">
        <strong className="text-bookea-tinta">{nombre}</strong> quedó creado con su tarjeta funcionando. Compartí
        el QR de tu panel y tus clientes ya pueden agregarla al teléfono.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <a
          href={`/lealtad/panel/${ranchoId}`}
          className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          Ir a mi panel →
        </a>
        {slug && (
          <a
            href={`/tarjeta/${slug}`}
            className="presionable rounded-xl border border-bookea-linea px-5 py-2.5 text-[13px] font-bold text-bookea-gris"
          >
            Ver mi tarjeta como cliente
          </a>
        )}
      </div>
    </div>
  );
}
