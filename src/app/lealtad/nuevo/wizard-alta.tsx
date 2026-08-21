"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { subirImagenAlAlta } from "@/lib/lealtad/subida-alta";
import { solicitarAltaConPlan } from "./actions";
import { iniciarPagoDelPaquete } from "@/app/lealtad/planes/pago-actions";
import type { DatosPago } from "@/app/lealtad/planes/formulario-solicitud";
import { crearTarjeta, type BorradorTarjeta } from "@/app/lealtad/panel/[id]/crear-actions";
import {
  configPorDefecto,
  leerBeneficio,
  validarBeneficio,
  TIPOS_TARJETA,
  esTipoTarjeta,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { coloresDePaleta, paletaDeLosColores, PALETAS } from "@/lib/lealtad/paletas";
import { esIconoSello, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { planIncluyeTipo } from "@/lib/lealtad/planes";
import {
  ETIQUETAS_RUBRO,
  RUBROS,
  esRubro,
  presetsDe,
  regaliasDe,
  type PresetRubro,
  type Rubro,
} from "@/lib/lealtad/presets-rubro";
import SelectorTipo from "@/components/lealtad/selector-tipo";
import PasoBeneficio from "@/components/lealtad/paso-beneficio";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import CampoColor from "@/components/campo-color";
import SubirImagen from "@/components/subir-imagen";

/**
 * EL ASISTENTE DE LA PRIMERA TARJETA, en cinco pasos.
 *
 *   1. Nombre   2. Tu negocio y tu tarjeta   3. El beneficio
 *   4. Apariencia   5. Revisar y publicar
 *
 * Es el MISMO lenguaje del creador del panel (/lealtad/panel/[id]/crear):
 * los componentes compartidos viven en src/components/lealtad y los dos
 * asistentes los importan de ahí. Este arma la PRIMERA tarjeta; el del
 * panel, de la segunda en adelante.
 *
 * ------------------------------------------------------------------
 * DOS MODOS, UNA PANTALLA
 * ------------------------------------------------------------------
 * · MODO COMPLETO (sin `rancho`): crea negocio + tarjeta. Al publicar
 *   llama `solicitarAltaConPlan` — con plan sin costo se crea todo al
 *   instante; con plan de pago la solicitud viaja con su depósito, como
 *   siempre (nada del flujo de solicitudes se elimina).
 * · MODO SOLO-TARJETA (`rancho` presente): el negocio ya existe (por
 *   ejemplo, recién pagado por Stripe). El paso 1 pide el nombre de la
 *   TARJETA y al publicar se llama `crearTarjeta` tal cual.
 *
 * ------------------------------------------------------------------
 * EL ESTADO NO SE PIERDE
 * ------------------------------------------------------------------
 * Los pasos quedan montados y se esconden con `hidden` (volver atrás no
 * borra nada), y el estado entero se respalda en sessionStorage: un F5
 * a mitad del asistente no manda a empezar de cero.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTE ARCHIVO NO DECIDE
 * ------------------------------------------------------------------
 * La validación del beneficio es `validarBeneficio()` —la misma del
 * servidor— y los candados por paquete los pinta `SelectorTipo` con el
 * catálogo real. Acá se avisa temprano; autoriza el servidor.
 */

export type PlanElegido = {
  id: string;
  nombre: string;
  /** Ya formateado por `precioDe()`. null = a convenir. */
  precio: string | null;
  esGratis: boolean;
  /** El precio va en dólares pero el SINPE se hace en colones. */
  enDolares: boolean;
};

export type RanchoWizard = {
  id: string;
  nombre: string;
  slug: string | null;
  /** `plan_lealtad` del negocio, leído en el servidor. */
  plan: string | null;
  /** El paquete ya no deja crear más tarjetas: pantalla de upsell. */
  tarjetasLlenas: boolean;
};

// "prellenado": llega desde configurador-lealtad.tsx (Modo 3 del
// configurador sin cuenta, vía `tarjeta-formulario.tsx`) con
// tipo/beneficio/apariencia YA resueltos
// — antes este wizard los volvía a pedir desde cero (mismo formulario
// de PasoBeneficio, mismos selectores de color), el "proceso
// redundante al pagar" que se reportó. Salta directo a "revisar".
type Camino = "creador" | "personalizado" | "prellenado";

type Pantalla = "nombre" | "negocio" | "beneficio" | "apariencia" | "descripcion" | "revisar";

/** El estado que se respalda en sessionStorage (todo serializable). */
type EstadoWizard = {
  paso: number;
  camino: Camino;
  /** En modo solo-tarjeta es el nombre de la TARJETA. */
  nombreNegocio: string;
  tipoNegocio: Rubro | null;
  detalleOtro: string;
  modo: TipoTarjeta | null;
  beneficio: ConfigBeneficio | null;
  colorFondo: string;
  colorSello: string;
  iconoSello: IconoSello | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  telefono: string;
  descripcion: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const METAS = [5, 6, 8, 10, 12];

const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris";
const chip = (activo: boolean) =>
  `presionable rounded-xl border px-3.5 py-2 text-[12.5px] font-bold ${
    activo
      ? "border-bookea-azul bg-bookea-azul-suave text-bookea-tinta"
      : "border-bookea-linea bg-white text-bookea-gris"
  }`;

function estadoInicial(): EstadoWizard {
  const base = coloresDePaleta(PALETAS.sellos);
  return {
    paso: 0,
    camino: "creador",
    nombreNegocio: "",
    tipoNegocio: null,
    detalleOtro: "",
    // Arranca en sellos —igual que el creador del panel—: el tipo es
    // requerido, y «sellos» es el que TODO paquete incluye.
    modo: "sellos",
    beneficio: configPorDefecto("sellos"),
    colorFondo: base.fondo,
    colorSello: base.sello,
    iconoSello: null,
    logoUrl: null,
    bannerUrl: null,
    telefono: "",
    descripcion: "",
  };
}

/**
 * Lo que vuelve de sessionStorage no se cree tal cual: se sanea campo
 * por campo. Un valor viejo o manipulado se descarta al default, nunca
 * rompe el asistente ni salta un candado (el servidor revalida igual).
 */
function sanearGuardado(crudo: unknown, plan: string | null, topePasos: number): EstadoWizard {
  const limpio = estadoInicial();
  if (!crudo || typeof crudo !== "object") return limpio;
  const c = crudo as Record<string, unknown>;

  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  limpio.nombreNegocio = texto(c.nombreNegocio, 80);
  limpio.detalleOtro = texto(c.detalleOtro, 80);
  limpio.telefono = texto(c.telefono, 30);
  limpio.descripcion = texto(c.descripcion, 500);
  if (c.camino === "personalizado") limpio.camino = "personalizado";
  if (c.camino === "prellenado") limpio.camino = "prellenado";
  if (esRubro(c.tipoNegocio)) limpio.tipoNegocio = c.tipoNegocio;
  // El camino "prellenado" nace de `publicarAlta()`/`irAlPlanPago()` en
  // configurador-lealtad.tsx, que no tiene paso de rubro (mismo
  // criterio que ya usa ese archivo) — se fuerza "citas" sin importar
  // qué haya en el respaldo.
  if (limpio.camino === "prellenado") limpio.tipoNegocio = "citas";

  // El tipo se restaura SOLO si el paquete actual lo incluye: volver de
  // un F5 con un tipo bloqueado dejaría el candado saltado en silencio.
  if (
    typeof c.modo === "string" &&
    esTipoTarjeta(c.modo) &&
    planIncluyeTipo(plan, c.modo)
  ) {
    limpio.modo = c.modo;
    limpio.beneficio = leerBeneficio(c.beneficio, c.modo) ?? configPorDefecto(c.modo);
  }
  if (typeof c.colorFondo === "string" && HEX.test(c.colorFondo)) limpio.colorFondo = c.colorFondo;
  if (typeof c.colorSello === "string" && HEX.test(c.colorSello)) limpio.colorSello = c.colorSello;
  if (esIconoSello(c.iconoSello)) limpio.iconoSello = c.iconoSello;
  if (typeof c.logoUrl === "string" && c.logoUrl) limpio.logoUrl = c.logoUrl;
  if (typeof c.bannerUrl === "string" && c.bannerUrl) limpio.bannerUrl = c.bannerUrl;
  if (typeof c.paso === "number" && Number.isInteger(c.paso)) {
    limpio.paso = Math.min(Math.max(0, c.paso), topePasos - 1);
  }
  // Forzado al final, después del saneo genérico de arriba: "prellenado"
  // tiene una sola pantalla ("revisar"), así que cualquier `paso`
  // restaurado de otro camino no tiene a dónde apuntar.
  if (limpio.camino === "prellenado") limpio.paso = 0;
  return limpio;
}

type Exito =
  | { tipo: "instantaneo"; ranchoId: string; slug: string | null }
  | { tipo: "tarjeta"; ranchoId: string; slug: string | null }
  | { tipo: "solicitud"; personalizado: boolean };

export default function WizardAlta({
  plan,
  pago,
  rancho = null,
}: {
  /** El paquete elegido (?plan=), ya validado con `esPlanOfrecido`. */
  plan: PlanElegido;
  pago: DatosPago;
  /** Presente = modo solo-tarjeta: el negocio ya existe. */
  rancho?: RanchoWizard | null;
}) {
  const soloTarjeta = rancho !== null;
  const planActual = soloTarjeta ? rancho.plan : plan.id;
  const clave = `bookea-lealtad-wizard:${rancho?.id ?? "nuevo"}`;

  const [estado, setEstado] = useState<EstadoWizard>(estadoInicial);
  const [restaurado, setRestaurado] = useState(false);

  const [verPase, setVerPase] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  // Lo que NO se respalda: el depósito y las subidas en curso son de
  // esta sesión y de nadie más.
  const [metodo, setMetodo] = useState<"sinpe" | "transferencia">("sinpe");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [errorComprobante, setErrorComprobante] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState("");
  const [subiendoBanda, setSubiendoBanda] = useState(false);
  const [errorBanda, setErrorBanda] = useState("");

  const pantallas: Pantalla[] =
    estado.camino === "creador"
      ? ["nombre", "negocio", "beneficio", "apariencia", "revisar"]
      : estado.camino === "prellenado"
        ? ["revisar"]
        : ["nombre", "negocio", "descripcion", "revisar"];
  const paso = Math.min(estado.paso, pantallas.length - 1);
  const pantalla = pantallas[paso];

  // ── Respaldo en sessionStorage ──────────────────────────────────
  // Se restaura DESPUÉS de montar (no en el init del estado): el primer
  // render tiene que coincidir con el del servidor o React reclama.
  useEffect(() => {
    try {
      const crudo = sessionStorage.getItem(clave);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata desde sessionStorage (sistema externo) una sola vez por carga; leerlo en el primer render desincronizaría servidor y cliente
      if (crudo) setEstado(sanearGuardado(JSON.parse(crudo), planActual, 5));
    } catch {
      /* storage bloqueado o JSON roto: se arranca de cero, sin drama */
    }
    setRestaurado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);
  useEffect(() => {
    if (!restaurado) return;
    try {
      sessionStorage.setItem(clave, JSON.stringify(estado));
    } catch {
      /* sin espacio o bloqueado: el asistente sigue, solo sin respaldo */
    }
  }, [estado, clave, restaurado]);

  const patch = (p: Partial<EstadoWizard>) => setEstado((e) => ({ ...e, ...p }));

  function avanzar() {
    patch({ paso: Math.min(paso + 1, pantallas.length - 1) });
  }
  function atras() {
    patch({ paso: Math.max(0, paso - 1) });
  }

  // Cambiar de tipo REEMPLAZA la config (mismo criterio que el creador
  // del panel): los campos de una gift card no significan nada en una
  // de sellos. Y los colores siguen al tipo solo si todavía son los de
  // una plantilla — lo afinado a mano no se pisa.
  function elegirModo(nuevo: TipoTarjeta) {
    setEstado((e) => {
      const sigueEnPlantilla = paletaDeLosColores(e.colorFondo, e.colorSello) !== null;
      const c = sigueEnPlantilla ? coloresDePaleta(PALETAS[nuevo]) : null;
      return {
        ...e,
        modo: nuevo,
        beneficio: configPorDefecto(nuevo),
        colorFondo: c?.fondo ?? e.colorFondo,
        colorSello: c?.sello ?? e.colorSello,
      };
    });
    setError(null);
  }

  function aplicarPreset(p: PresetRubro) {
    patch({
      colorFondo: p.paleta.fondo,
      colorSello: p.paleta.sello,
      // El icono solo tiene dónde vivir en una tarjeta de sellos.
      iconoSello: estado.modo === "sellos" ? p.icono : estado.iconoSello,
    });
  }

  // ── Validación en línea (el servidor revalida todo) ─────────────
  const nombre = estado.nombreNegocio.trim();
  const rubroListo =
    estado.tipoNegocio !== null &&
    (estado.tipoNegocio !== "otro" || estado.detalleOtro.trim() !== "");
  const motivoBeneficio = estado.beneficio
    ? validarBeneficio(estado.beneficio)
    : "Elegí el tipo de tarjeta.";

  const requierePago = !soloTarjeta && !plan.esGratis;
  const telefonoListo = soloTarjeta || estado.telefono.trim().length > 0;
  const contenidoListo =
    estado.camino === "personalizado"
      ? estado.descripcion.trim().length >= 5
      : motivoBeneficio === null;
  const puedePublicar =
    !ocupado &&
    !subiendoComprobante &&
    nombre.length > 0 &&
    contenidoListo &&
    telefonoListo &&
    (!requierePago || comprobanteUrl !== "");

  const puedeAvanzar: Record<Pantalla, boolean> = {
    nombre: nombre.length > 0 && nombre.length <= 80,
    negocio:
      estado.camino === "personalizado"
        ? rubroListo
        : estado.modo !== null && (soloTarjeta || rubroListo),
    beneficio: motivoBeneficio === null,
    apariencia: !subiendoLogo && !subiendoBanda,
    descripcion: estado.descripcion.trim().length >= 5,
    revisar: puedePublicar,
  };

  // ── Subidas del MODO COMPLETO: bucket `comprobantes`, como hoy ──
  // (En modo solo-tarjeta sube `SubirImagen` a `ranchos-fotos`, que es
  // el bucket que `crearTarjeta` exige.) `subirImagenAlAlta` vive en
  // src/lib/lealtad/subida-alta.ts para que el configurador fusionado
  // de /lealtad suba el logo por el MISMO camino — ver el comentario
  // largo sobre `logos-negocio/` y la política 0148 en ese archivo.
  async function subirLogo(archivo: File) {
    setErrorLogo("");
    if (archivo.size > 8 * 1024 * 1024) {
      setErrorLogo("El archivo pesa más de 8 MB — probá con una versión más liviana.");
      return;
    }
    setSubiendoLogo(true);
    const url = await subirImagenAlAlta(archivo, "logo");
    if (url) patch({ logoUrl: url });
    else setErrorLogo("No pudimos subir el logo. Intentá de nuevo.");
    setSubiendoLogo(false);
  }

  async function subirBanda(archivo: File) {
    setErrorBanda("");
    if (archivo.size > 8 * 1024 * 1024) {
      setErrorBanda("El archivo pesa más de 8 MB — probá con una versión más liviana.");
      return;
    }
    setSubiendoBanda(true);
    const url = await subirImagenAlAlta(archivo, "banda");
    if (url) patch({ bannerUrl: url });
    else setErrorBanda("No pudimos subir la banda. Intentá de nuevo.");
    setSubiendoBanda(false);
  }

  async function subirComprobante(archivo: File) {
    setErrorComprobante("");
    if (archivo.size > 8 * 1024 * 1024) {
      setErrorComprobante("El archivo pesa más de 8 MB — mandá una captura más liviana.");
      return;
    }
    setSubiendoComprobante(true);
    const supabase = createClient();
    const liviano = await comprimirImagen(archivo);
    const ext = liviano.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `solicitudes-lealtad/alta-${Date.now()}.${ext}`;
    const { error: e } = await supabase.storage.from("comprobantes").upload(path, liviano);
    if (e) {
      setErrorComprobante("No pudimos subir el comprobante. Intentá de nuevo.");
      setSubiendoComprobante(false);
      return;
    }
    const { data } = supabase.storage.from("comprobantes").getPublicUrl(path);
    setComprobanteUrl(data?.publicUrl ?? "");
    setSubiendoComprobante(false);
  }

  // ── Publicar: UNA sola creación, al final ───────────────────────
  function publicar() {
    setError(null);

    // MODO SOLO-TARJETA: el negocio existe; se llama `crearTarjeta`
    // tal cual, sin reglas avanzadas (la 0136 no va en el onboarding).
    if (soloTarjeta) {
      const b = estado.beneficio;
      const m = estado.modo;
      if (!b || !m) return;
      const borrador: BorradorTarjeta = {
        ranchoId: rancho.id,
        nombre,
        tipo: m,
        beneficio: b,
        colorFondo: estado.colorFondo,
        colorSello: estado.colorSello,
        iconoSello: m === "sellos" ? estado.iconoSello : null,
        // El ícono propio (0174) no se ofrece en el alta: subir un
        // archivo pide una sesión que en esta pantalla puede no existir
        // todavía. Se agrega después, desde el editor de la tarjeta.
        iconoUrl: "",
        logoUrl: estado.logoUrl ?? "",
        bannerUrl: estado.bannerUrl ?? "",
        reglas: {
          desde: "",
          desdePrimerSello: false,
          hasta: "",
          usoUnico: false,
          maxPorCliente: null,
          maxGlobal: null,
          dias: [],
          horaDesde: "",
          horaHasta: "",
        },
        // El vencimiento de sellos (0180) tampoco va en el onboarding,
        // por lo mismo que las reglas de la 0136: la tarjeta nace sin
        // que nada se venza, y el dueño la enciende después desde el
        // editor si la quiere. Encender de fábrica una regla que le
        // quita sellos a la gente sería lo contrario de un buen
        // arranque.
        sellosVencenMeses: null,
      };
      iniciar(async () => {
        const res = await crearTarjeta(borrador);
        if (res.ok) {
          limpiarRespaldo();
          setExito({ tipo: "tarjeta", ranchoId: rancho.id, slug: rancho.slug });
        } else setError(res.motivo);
      });
      return;
    }

    // MODO COMPLETO: la solicitud de alta de siempre, con la tarjeta
    // armada viajando entera. Los campos «legado» (paseColor, regalia,
    // metaSellos) se siguen mandando derivados del beneficio para que
    // la acción actual y la extendida entiendan lo mismo.
    const b = estado.beneficio;
    const esPersonalizado = estado.camino === "personalizado";
    if (!esPersonalizado && (!b || !estado.modo)) return;

    const datos = {
      nombreNegocio: nombre,
      tipo: estado.tipoNegocio ?? "otro",
      detalleOtro: estado.detalleOtro,
      plan: plan.id,
      metodoPago: metodo,
      comprobanteUrl,
      telefono: estado.telefono,
      personalizado: esPersonalizado,
      descripcion: estado.descripcion,
      paseColor: estado.colorFondo,
      paseLogoUrl: estado.logoUrl ?? "",
      regalia: b ? regaliaDelBeneficio(b) : "",
      metaSellos: b ? metaDelBeneficio(b) : 10,
      // Lo que el asistente nuevo arma de más: la tarjeta completa.
      // La acción extendida la consume; la de hoy la ignora sin romper.
      tarjeta:
        esPersonalizado || !b || !estado.modo
          ? null
          : {
              modo: estado.modo,
              beneficio: b,
              colorFondo: estado.colorFondo,
              colorSello: estado.colorSello,
              iconoSello: estado.modo === "sellos" ? estado.iconoSello : null,
              logoUrl: estado.logoUrl,
              bannerUrl: estado.bannerUrl,
            },
    };
    iniciar(async () => {
      const res = await solicitarAltaConPlan(datos);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      limpiarRespaldo();
      if (res.creado) {
        setExito({ tipo: "instantaneo", ranchoId: res.creado.ranchoId, slug: res.creado.slug });
      } else {
        setExito({ tipo: "solicitud", personalizado: esPersonalizado });
      }
    });
  }

  function limpiarRespaldo() {
    try {
      sessionStorage.removeItem(clave);
    } catch {
      /* sin storage no hay nada que limpiar */
    }
  }

  // ── La vista previa se alimenta del estado ──────────────────────
  const datosVista: DatosVista = {
    negocioNombre: soloTarjeta ? rancho.nombre : nombre || "Tu negocio",
    modo: estado.modo ?? "sellos",
    beneficio: estado.beneficio ?? configPorDefecto("sellos"),
    colorFondo: estado.colorFondo,
    colorSello: estado.colorSello,
    iconoSello: estado.modo === "sellos" ? estado.iconoSello : null,
    logoUrl: estado.logoUrl,
    bannerUrl: estado.bannerUrl,
  };

  // ── Tope de tarjetas alcanzado (solo modo tarjeta): upsell ──────
  if (soloTarjeta && rancho.tarjetasLlenas) {
    return (
      <div className="entra-suave mx-auto max-w-[560px] rounded-3xl border border-bookea-linea bg-white p-8 text-center">
        <h2 className="titulo text-[22px] text-bookea-tinta">Llegaste al tope de tarjetas</h2>
        <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-bookea-gris">
          Tu paquete actual ya tiene todas sus tarjetas en uso. Archivá una desde tu panel
          para liberar el cupo, o subí de paquete para tener más.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/lealtad/planes?negocio=${rancho.id}`}
            className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold"
            style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
          >
            Ver paquetes →
          </a>
          <a
            href={`/lealtad/panel/${rancho.id}`}
            className="presionable rounded-xl border border-bookea-linea px-5 py-2.5 text-[13px] font-bold text-bookea-gris"
          >
            Volver a mi panel
          </a>
        </div>
      </div>
    );
  }

  // ── Pantallas de éxito ──────────────────────────────────────────
  if (exito && (exito.tipo === "instantaneo" || exito.tipo === "tarjeta")) {
    return (
      <div className="entra-suave mx-auto max-w-[560px] rounded-3xl border border-bookea-linea bg-white p-8 text-center">
        <h2 className="titulo text-[22px] text-bookea-tinta">¡Tu tarjeta está lista! 🎉</h2>
        <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-bookea-gris">
          <strong className="text-bookea-tinta">{nombre}</strong>{" "}
          {exito.tipo === "instantaneo"
            ? "quedó creado con su tarjeta funcionando. Compartí el QR de tu panel y tus clientes ya pueden agregarla al teléfono."
            : "quedó publicada. Compartí el QR de tu panel y tus clientes ya pueden agregarla al teléfono."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/lealtad/panel/${exito.ranchoId}`}
            className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold"
            style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
          >
            Ir a mi panel →
          </a>
          {exito.slug && (
            <a
              href={`/tarjeta/${exito.slug}`}
              className="presionable rounded-xl border border-bookea-linea px-5 py-2.5 text-[13px] font-bold text-bookea-gris"
            >
              Ver mi tarjeta como cliente
            </a>
          )}
        </div>
      </div>
    );
  }

  if (exito?.tipo === "solicitud") {
    return (
      <div className="entra-suave mx-auto max-w-[560px] rounded-3xl border border-bookea-linea bg-white p-8 text-center">
        <h2 className="titulo text-[20px] text-bookea-tinta">
          {exito.personalizado ? "¡Pedido en espera!" : "¡Solicitud enviada!"}
        </h2>
        <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-bookea-gris">
          {exito.personalizado ? (
            <>
              Tu diseño personalizado para{" "}
              <strong className="text-bookea-tinta">{nombre}</strong> quedó en manos del
              equipo: lo armamos con vos y te contactamos al correo.
            </>
          ) : (
            <>
              Recibimos los datos de <strong className="text-bookea-tinta">{nombre}</strong>.
              Si Bookea acepta la solicitud, tu negocio y tu tarjeta quedan creados TAL CUAL
              la armaste — te avisamos al correo.
            </>
          )}
        </p>
      </div>
    );
  }

  const regalias = regaliasDe(estado.tipoNegocio);
  const presets = presetsDe(estado.tipoNegocio);
  // Narrado a mano: dentro del JSX anidado TypeScript pierde el
  // estrechamiento de `estado.beneficio.tipo === "sellos"`.
  const beneficioSellos = estado.beneficio?.tipo === "sellos" ? estado.beneficio : null;

  const titulos: Record<Pantalla, { titulo: string; bajada: string }> = {
    nombre: soloTarjeta
      ? { titulo: "¿Cómo se llama tu tarjeta?", bajada: "Así la van a ver tus clientes en el panel." }
      : { titulo: "¿Cómo se llama tu negocio?", bajada: "Con eso alcanza para arrancar." },
    negocio: soloTarjeta
      ? { titulo: "Tu tarjeta", bajada: "Qué clase de programa vas a armar." }
      : { titulo: "Tu negocio y tu tarjeta", bajada: "Qué es tu negocio y qué clase de tarjeta querés." },
    beneficio: { titulo: "El beneficio", bajada: "Qué se gana y cómo." },
    apariencia: { titulo: "Apariencia", bajada: "Cómo se ve en el teléfono de tu cliente. Todo es opcional." },
    descripcion: { titulo: "Contanos cómo la soñás", bajada: "El equipo de Bookea la diseña con vos." },
    revisar: { titulo: "Revisar y publicar", bajada: "Una última mirada antes de publicar." },
  };

  return (
    <div className="entra-suave lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
      <div className="min-w-0">
        {/* ── Progreso ─────────────────────────────────────────── */}
        <ol className="flex gap-1.5" aria-label="Pasos del asistente">
          {pantallas.map((p, i) => (
            <li key={p} className="flex-1">
              <span
                className="block h-1.5 rounded-full transition-colors duration-300"
                style={{ background: i <= paso ? "var(--accion)" : "var(--line)" }}
              />
              <span className="sr-only">
                {titulos[p].titulo}
                {i === paso ? " (paso actual)" : i < paso ? " (completado)" : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[10.5px] font-bold uppercase tracking-wide text-bookea-gris">
          Paso {paso + 1} de {pantallas.length}
          {estado.camino === "personalizado" && " · diseño personalizado"}
        </p>
        <h2 className="titulo mt-1 text-[22px] text-bookea-tinta">{titulos[pantalla].titulo}</h2>
        <p className="mt-1 text-[13.5px] text-bookea-gris">{titulos[pantalla].bajada}</p>

        {/* Enter avanza: los pasos viven dentro de un form. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pantalla === "revisar") {
              if (puedePublicar) publicar();
            } else if (puedeAvanzar[pantalla]) avanzar();
          }}
        >
          <div className="pasos mt-5">
            {/* ── Paso 1: el nombre ─────────────────────────────── */}
            <section
              className="paso"
              data-estado={pantalla === "nombre" ? "activo" : "saliendo"}
              hidden={pantalla !== "nombre"}
            >
              <label className={etiqueta} htmlFor="w-nombre">
                {soloTarjeta ? "Nombre de la tarjeta" : "Nombre del negocio"}
              </label>
              <input
                id="w-nombre"
                autoFocus
                value={estado.nombreNegocio}
                onChange={(e) => patch({ nombreNegocio: e.target.value })}
                maxLength={80}
                placeholder={soloTarjeta ? `Tarjeta de ${rancho.nombre}` : "Café La Esquina"}
                className={campo}
              />
            </section>

            {/* ── Paso 2: rubro + tipo de tarjeta ───────────────── */}
            <section
              className="paso"
              data-estado={pantalla === "negocio" ? "activo" : "saliendo"}
              hidden={pantalla !== "negocio"}
            >
              <div className="space-y-5">
                <div>
                  <span className={etiqueta}>
                    ¿Qué tipo de negocio es?
                    {soloTarjeta && " (opcional, para sugerirte estilos)"}
                  </span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Tipo de negocio">
                    {RUBROS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={estado.tipoNegocio === r}
                        onClick={() => patch({ tipoNegocio: r })}
                        className={chip(estado.tipoNegocio === r)}
                      >
                        {ETIQUETAS_RUBRO[r]}
                      </button>
                    ))}
                  </div>
                  {estado.tipoNegocio === "otro" && (
                    <div className="mt-3">
                      <label className={etiqueta} htmlFor="w-otro">
                        ¿Qué negocio es?
                      </label>
                      <input
                        id="w-otro"
                        value={estado.detalleOtro}
                        onChange={(e) => patch({ detalleOtro: e.target.value })}
                        maxLength={80}
                        placeholder="Ferretería, academia de baile, veterinaria…"
                        className={campo}
                      />
                    </div>
                  )}
                </div>

                {estado.camino === "creador" && (
                  <div>
                    <span className={etiqueta}>¿Qué clase de tarjeta querés?</span>
                    {/* Con los candados por paquete VISIBLES: los tipos
                        que el plan no trae se ven bloqueados con el
                        paquete que los abre. */}
                    <SelectorTipo
                      valor={estado.modo ?? "sellos"}
                      alElegir={elegirModo}
                      plan={planActual}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* ── Paso 3: el beneficio ──────────────────────────── */}
            <section
              className="paso"
              data-estado={pantalla === "beneficio" ? "activo" : "saliendo"}
              hidden={pantalla !== "beneficio"}
            >
              {estado.beneficio && (
                <div className="space-y-4">
                  {beneficioSellos && (
                    <>
                      <div>
                        <span className={etiqueta}>Regalías que funcionan en tu rubro</span>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Regalías sugeridas">
                          {regalias.map((r) => (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={beneficioSellos.recompensa === r}
                              onClick={() =>
                                patch({ beneficio: { ...beneficioSellos, recompensa: r } })
                              }
                              className={chip(beneficioSellos.recompensa === r)}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className={etiqueta}>¿Cuántos sellos cuesta ganarla?</span>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Sellos para la regalía">
                          {METAS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={beneficioSellos.requeridos === m}
                              onClick={() =>
                                patch({ beneficio: { ...beneficioSellos, requeridos: m } })
                              }
                              className={`presionable h-11 w-11 rounded-xl border text-[14px] font-extrabold ${
                                beneficioSellos.requeridos === m
                                  ? "border-bookea-azul bg-bookea-azul-suave text-bookea-tinta"
                                  : "border-bookea-linea bg-white text-bookea-gris"
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                          10 es el clásico; 5–6 premia rápido y engancha antes. Abajo lo podés
                          afinar a mano.
                        </p>
                      </div>
                    </>
                  )}
                  <PasoBeneficio
                    config={estado.beneficio}
                    alCambiar={(c) => patch({ beneficio: c })}
                  />
                  {motivoBeneficio && (
                    <p
                      role="status"
                      className="rounded-xl bg-bookea-azul-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-azul"
                    >
                      {motivoBeneficio}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* ── Paso 4: apariencia (todo opcional) ────────────── */}
            <section
              className="paso"
              data-estado={pantalla === "apariencia" ? "activo" : "saliendo"}
              hidden={pantalla !== "apariencia"}
            >
              <div className="space-y-4">
                {presets.length > 0 && (
                  <div>
                    <span className={etiqueta}>Estilos para tu rubro</span>
                    <div
                      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                      role="group"
                      aria-label="Estilos sugeridos"
                    >
                      {presets.map((p) => {
                        const puesto =
                          estado.colorFondo.toLowerCase() === p.paleta.fondo.toLowerCase() &&
                          estado.colorSello.toLowerCase() === p.paleta.sello.toLowerCase() &&
                          (estado.modo !== "sellos" || estado.iconoSello === p.icono);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={puesto}
                            onClick={() => aplicarPreset(p)}
                            className={`presionable overflow-hidden rounded-xl border text-left ${
                              puesto
                                ? "border-bookea-azul ring-2 ring-bookea-azul"
                                : "border-bookea-linea"
                            }`}
                          >
                            <span
                              aria-hidden
                              className="flex h-11 items-center gap-1.5 px-3"
                              style={{ background: p.paleta.fondo }}
                            >
                              <span
                                className="h-4 w-4 shrink-0 rounded-full"
                                style={{ background: p.paleta.sello }}
                              />
                            </span>
                            <span className="block truncate px-2.5 py-2 text-[11.5px] font-bold text-bookea-tinta">
                              {p.nombre}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                      Un toque y la tarjeta toma la paleta y el sello del estilo. Abajo lo
                      afinás como quieras.
                    </p>
                  </div>
                )}

                <div>
                  <span className={etiqueta}>Plantillas</span>
                  <PlantillasColor
                    colorFondo={estado.colorFondo}
                    colorSello={estado.colorSello}
                    alElegir={({ fondo, sello }) => patch({ colorFondo: fondo, colorSello: sello })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <CampoColor
                    id="w-fondo"
                    etiqueta="Color de fondo"
                    valor={estado.colorFondo}
                    alCambiar={(v) => patch({ colorFondo: v })}
                  />
                  <CampoColor
                    id="w-sello"
                    etiqueta="Color del acento"
                    valor={estado.colorSello}
                    alCambiar={(v) => patch({ colorSello: v })}
                  />
                </div>

                {estado.modo === "sellos" && (
                  <div>
                    <span className={etiqueta}>Icono del sello</span>
                    <SelectorIconoSello
                      valor={estado.iconoSello}
                      // Sin `alSubirIcono` el selector no ofrece «Mi
                      // ícono», así que acá solo pueden llegar los doce.
                      // El filtro es el que lo hace cierto para el
                      // compilador, no una defensa contra nada.
                      alElegir={(i) => patch({ iconoSello: esIconoSello(i) ? i : null })}
                      colorFondo={estado.colorFondo}
                      colorSello={estado.colorSello}
                    />
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                      Se llena cuando el cliente gana el sello. Con «Mi logo» va tu logo
                      adentro del círculo.
                    </p>
                  </div>
                )}

                {soloTarjeta ? (
                  <>
                    {/* El negocio existe: las imágenes van al bucket que
                        `crearTarjeta` exige (`ranchos-fotos`). */}
                    <div>
                      <SubirImagen
                        etiqueta="Logo del negocio"
                        valor={estado.logoUrl ?? ""}
                        alCambiar={(v) => patch({ logoUrl: v || null })}
                        destino="logo"
                        carpeta="lealtad/logos"
                      />
                      <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                        Sin logo, la tarjeta escribe el nombre del negocio.
                      </p>
                    </div>
                    <div>
                      <SubirImagen
                        etiqueta="Banda de la tarjeta (opcional)"
                        valor={estado.bannerUrl ?? ""}
                        alCambiar={(v) => patch({ bannerUrl: v || null })}
                        destino="banner"
                        carpeta="lealtad/bandas"
                      />
                      <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                        La franja de arriba del pase. Una foto de tu local o de lo que vendés.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* El negocio todavía NO existe: se sube al bucket
                        `comprobantes`, que es el que el alta valida. */}
                    <SubidaAlta
                      etiquetaCampo="Logo del negocio (opcional)"
                      ayuda="Va arriba de la tarjeta y dentro de cada sello. Sin logo, la tarjeta escribe el nombre de tu negocio."
                      url={estado.logoUrl}
                      subiendo={subiendoLogo}
                      error={errorLogo}
                      alElegir={subirLogo}
                      alQuitar={() => patch({ logoUrl: null })}
                    />
                    <SubidaAlta
                      etiquetaCampo="Banda de la tarjeta (opcional)"
                      ayuda="La franja de arriba del pase. Una foto de tu local o de lo que vendés."
                      url={estado.bannerUrl}
                      subiendo={subiendoBanda}
                      error={errorBanda}
                      alElegir={subirBanda}
                      alQuitar={() => patch({ bannerUrl: null })}
                    />
                  </>
                )}
              </div>
            </section>

            {/* ── Personalizado: la descripción ─────────────────── */}
            <section
              className="paso"
              data-estado={pantalla === "descripcion" ? "activo" : "saliendo"}
              hidden={pantalla !== "descripcion"}
            >
              <label className={etiqueta} htmlFor="w-desc">
                Tu tarjeta soñada
              </label>
              <textarea
                id="w-desc"
                value={estado.descripcion}
                onChange={(e) => patch({ descripcion: e.target.value })}
                rows={4}
                maxLength={500}
                placeholder="Colores de mi marca, mi logo, dos niveles de premios, texto en inglés…"
                className={campo}
              />
              <p className="mt-2 text-[12px] leading-relaxed text-bookea-gris">
                El equipo de Bookea diseña la tarjeta contigo — este pedido queda en espera
                hasta que lo veamos juntos.{" "}
                <button
                  type="button"
                  onClick={() => patch({ camino: "creador", paso: 2 })}
                  className="font-bold text-bookea-tinta underline"
                >
                  ← Mejor uso el creador
                </button>
              </p>
            </section>

            {/* ── Paso 5: revisar y publicar ────────────────────── */}
            <section
              className="paso"
              data-estado={pantalla === "revisar" ? "activo" : "saliendo"}
              hidden={pantalla !== "revisar"}
            >
              <div className="space-y-4">
                <Resumen
                  estado={estado}
                  soloTarjeta={soloTarjeta}
                  negocioNombre={soloTarjeta ? rancho.nombre : nombre}
                  planNombre={soloTarjeta ? null : plan.nombre}
                  planPrecio={soloTarjeta ? null : plan.precio}
                  motivo={estado.camino === "creador" ? motivoBeneficio : null}
                />

                {!soloTarjeta && (
                  <div>
                    <label className={etiqueta} htmlFor="w-tel">
                      Teléfono (para coordinar)
                    </label>
                    <input
                      id="w-tel"
                      value={estado.telefono}
                      onChange={(e) => patch({ telefono: e.target.value })}
                      placeholder="8888 8888"
                      maxLength={30}
                      className={campo}
                    />
                  </div>
                )}

                {requierePago && (
                  <BloquePago
                    plan={plan}
                    pago={pago}
                    nombreNegocio={nombre}
                    metodo={metodo}
                    alCambiarMetodo={setMetodo}
                    comprobanteUrl={comprobanteUrl}
                    alQuitarComprobante={() => setComprobanteUrl("")}
                    subiendo={subiendoComprobante}
                    error={errorComprobante}
                    alElegir={subirComprobante}
                  />
                )}

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-700"
                  >
                    {error}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* ── La salida al diseño a mano ─────────────────────── */}
          {estado.camino === "creador" && (
            <p className="mt-5 text-[12px] text-bookea-gris">
              ¿Lo querés más personalizado (niveles, otro estilo)?{" "}
              {soloTarjeta ? (
                <a
                  href={`/lealtad/planes?negocio=${rancho.id}`}
                  className="font-bold text-bookea-tinta underline"
                >
                  Quiero algo personalizado
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => patch({ camino: "personalizado", paso: 2 })}
                  className="font-bold text-bookea-tinta underline"
                >
                  Quiero algo personalizado
                </button>
              )}
            </p>
          )}

          {/* ── Barra de navegación ────────────────────────────── */}
          <div
            className="sticky bottom-0 mt-6 flex items-center gap-2 rounded-b-2xl border-t border-bookea-linea px-1 py-3.5"
            style={{ background: "var(--hoja)" }}
          >
            <button
              type="button"
              onClick={atras}
              disabled={paso === 0}
              className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-gris disabled:opacity-40"
            >
              Atrás
            </button>
            {estado.camino === "creador" && (
              <button
                type="button"
                onClick={() => setVerPase(true)}
                className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-gris lg:hidden"
              >
                Ver tarjeta
              </button>
            )}
            <span className="flex-1" />
            {pantalla !== "revisar" ? (
              <button
                type="submit"
                disabled={!puedeAvanzar[pantalla]}
                className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
                style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={!puedePublicar}
                className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
                style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
              >
                {ocupado
                  ? soloTarjeta || plan.esGratis
                    ? "Publicando…"
                    : "Enviando…"
                  : estado.camino === "personalizado"
                    ? "Enviar mi pedido"
                    : soloTarjeta
                      ? "Publicar tarjeta"
                      : plan.esGratis
                        ? "Crear mi tarjeta YA →"
                        : "Enviar la solicitud"}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Vista previa: pegada en escritorio ───────────────────── */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          {estado.camino === "personalizado" ? (
            <MarcadorPersonalizado nombre={nombre} />
          ) : (
            <VistaPase datos={datosVista} superficie="clara" />
          )}
        </div>
      </aside>

      {/* En móvil se abre desde la barra (mismo patrón del creador). */}
      {verPase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la tarjeta"
        >
          <div className="w-full max-w-[340px]">
            <VistaPase datos={datosVista} />
            <button
              type="button"
              onClick={() => setVerPase(false)}
              className="presionable mt-4 w-full rounded-xl bg-white py-3 text-[13px] font-bold text-bookea-tinta"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────

/** El camino personalizado no tiene tarjeta que previsualizar. */
function MarcadorPersonalizado({ nombre }: { nombre: string }) {
  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center rounded-3xl border border-dashed border-bookea-linea bg-white p-6 text-center">
      <span className="text-[26px]">✨</span>
      <p className="mt-2 text-[13.5px] font-extrabold text-bookea-tinta">
        {nombre.trim() || "Tu negocio"}
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-bookea-gris">
        Diseño personalizado — el equipo la arma contigo.
      </p>
    </div>
  );
}

/**
 * Subida del MODO COMPLETO: directa al bucket `comprobantes`, que es el
 * que el alta valida (el negocio aún no existe, así que no hay carpeta
 * de rancho a donde subir).
 */
function SubidaAlta({
  etiquetaCampo,
  ayuda,
  url,
  subiendo,
  error,
  alElegir,
  alQuitar,
}: {
  etiquetaCampo: string;
  ayuda: string;
  url: string | null;
  subiendo: boolean;
  error: string;
  alElegir: (archivo: File) => void;
  alQuitar: () => void;
}) {
  return (
    <div>
      <span className={etiqueta}>{etiquetaCampo}</span>
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL de
              nuestro storage; acá es una miniatura. */}
          <img
            src={url}
            alt=""
            className="h-16 w-16 rounded-xl border border-bookea-linea object-cover"
          />
          <button
            type="button"
            onClick={alQuitar}
            className="text-[12.5px] font-bold text-bookea-gris underline"
          >
            Quitarla
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="image/*"
          disabled={subiendo}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) alElegir(f);
          }}
          className="block w-full text-[12.5px] text-bookea-gris file:mr-3 file:rounded-[10px] file:border-0 file:bg-bookea-azul-suave file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-bookea-tinta"
        />
      )}
      {subiendo && <p className="mt-1 text-[12px] text-bookea-gris">Subiendo…</p>}
      {error && <p className="mt-1 text-[12.5px] font-bold text-red-700">{error}</p>}
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">{ayuda}</p>
    </div>
  );
}

/** El resumen de solo lectura, con el patrón del creador del panel. */
function Resumen({
  estado,
  soloTarjeta,
  negocioNombre,
  planNombre,
  planPrecio,
  motivo,
}: {
  estado: EstadoWizard;
  soloTarjeta: boolean;
  negocioNombre: string;
  planNombre: string | null;
  planPrecio: string | null;
  motivo: string | null;
}) {
  const lineas: [string, ReactNode][] = [];

  if (soloTarjeta) {
    lineas.push(["Negocio", negocioNombre]);
    lineas.push(["Tarjeta", estado.nombreNegocio.trim() || "— falta"]);
  } else {
    lineas.push(["Negocio", negocioNombre || "— falta"]);
    lineas.push([
      "Rubro",
      estado.tipoNegocio
        ? estado.tipoNegocio === "otro" && estado.detalleOtro.trim()
          ? estado.detalleOtro.trim()
          : ETIQUETAS_RUBRO[estado.tipoNegocio]
        : "— falta",
    ]);
  }

  if (estado.camino === "personalizado") {
    lineas.push(["Diseño", "Personalizado — lo arma el equipo"]);
    lineas.push(["Tu pedido", estado.descripcion.trim() || "— falta"]);
  } else {
    lineas.push(["Tipo", estado.modo ? TIPOS_TARJETA[estado.modo].nombre : "— falta"]);
    lineas.push([
      "Beneficio",
      estado.beneficio ? resumenDelBeneficio(estado.beneficio) : "— falta",
    ]);
    lineas.push([
      "Colores",
      <span key="c" className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-4 w-4 rounded-full border border-bookea-linea"
          style={{ background: estado.colorFondo }}
        />
        <span
          aria-hidden
          className="inline-block h-4 w-4 rounded-full border border-bookea-linea"
          style={{ background: estado.colorSello }}
        />
      </span>,
    ]);
    lineas.push(["Logo", estado.logoUrl ? "Subido" : "Sin logo (va tu nombre)"]);
    if (estado.bannerUrl) lineas.push(["Banda", "Subida"]);
  }

  if (planNombre) {
    lineas.push([
      "Paquete",
      planPrecio === null ? `${planNombre} · a convenir` : `${planNombre} · ${planPrecio}`,
    ]);
  }

  return (
    <div className="rounded-3xl border border-bookea-linea bg-white p-5">
      <dl className="divide-y divide-bookea-linea">
        {lineas.map(([k, v]) => (
          <div
            key={k}
            className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="text-[12px] font-bold uppercase tracking-wide text-bookea-gris">{k}</dt>
            <dd className="text-[13.5px] font-bold text-bookea-tinta">{v}</dd>
          </div>
        ))}
      </dl>
      {motivo && (
        <p className="mt-4 rounded-xl bg-bookea-azul-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-azul">
          Falta algo en el beneficio: {motivo}
        </p>
      )}
    </div>
  );
}

/**
 * El depósito de los paquetes de pago — el flujo de solicitudes de
 * siempre, sin tocar: SINPE o transferencia + captura del comprobante.
 */
function BloquePago({
  plan,
  pago,
  nombreNegocio,
  metodo,
  alCambiarMetodo,
  comprobanteUrl,
  alQuitarComprobante,
  subiendo,
  error,
  alElegir,
}: {
  plan: PlanElegido;
  pago: DatosPago;
  nombreNegocio: string;
  metodo: "sinpe" | "transferencia";
  alCambiarMetodo: (m: "sinpe" | "transferencia") => void;
  comprobanteUrl: string;
  alQuitarComprobante: () => void;
  subiendo: boolean;
  error: string;
  alElegir: (archivo: File) => void;
}) {
  // ── La elección de CÓMO pagar (pedido del dueño, ago 2026) ───────
  // Antes esta caja solo ofrecía SINPE/transferencia y el pago con
  // tarjeta (Stripe, que /lealtad/planes ya tiene funcionando con
  // `iniciarPagoDelPaquete`) no aparecía por ningún lado. Ahora hay
  // dos botones y cada uno abre SU proceso. Un plan "a convenir"
  // (precio null) no pasa por Stripe: va directo al depósito.
  const [eleccion, setEleccion] = useState<"tarjeta" | "deposito" | null>(
    plan.precio === null ? "deposito" : null,
  );
  const [pagando, setPagando] = useState(false);
  const [errorTarjeta, setErrorTarjeta] = useState("");

  async function pagarConTarjeta() {
    setPagando(true);
    setErrorTarjeta("");
    // Igual que /lealtad/planes: el negocio NO existe todavía — la
    // solicitud se crea en el servidor y el negocio lo crea el webhook
    // cuando Stripe confirma. `window.location.assign` porque Checkout
    // es un sitio ajeno.
    const r = await iniciarPagoDelPaquete({
      plan: plan.id,
      periodo: "mensual",
      ranchoId: "",
      nombreNegocio: nombreNegocio.trim(),
    });
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    setErrorTarjeta(r.motivo);
    setPagando(false);
  }

  return (
    <div className="rounded-3xl border border-bookea-linea bg-white p-5">
      <p className="text-[13.5px] font-extrabold text-bookea-tinta">
        {plan.precio === null
          ? "Coordinemos tu paquete"
          : `Pagá tu paquete (${plan.precio} el primer mes)`}
      </p>

      {plan.precio !== null && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={eleccion === "tarjeta"}
            onClick={() => setEleccion("tarjeta")}
            className={`presionable rounded-2xl border-2 px-4 py-3.5 text-left transition-colors ${
              eleccion === "tarjeta"
                ? "border-bookea-azul bg-bookea-azul-suave"
                : "border-bookea-linea bg-white hover:border-bookea-azul/50"
            }`}
          >
            <span className="block text-[13.5px] font-extrabold text-bookea-tinta">
              💳 Pagar con tarjeta o Apple Pay
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-bookea-gris">
              Visa, Mastercard, Amex, Apple Pay o Google Pay — se activa solo al confirmarse.
            </span>
          </button>
          <button
            type="button"
            aria-pressed={eleccion === "deposito"}
            onClick={() => setEleccion("deposito")}
            className={`presionable rounded-2xl border-2 px-4 py-3.5 text-left transition-colors ${
              eleccion === "deposito"
                ? "border-bookea-azul bg-bookea-azul-suave"
                : "border-bookea-linea bg-white hover:border-bookea-azul/50"
            }`}
          >
            <span className="block text-[13.5px] font-extrabold text-bookea-tinta">
              🏦 Pagar por transferencia o SINPE
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-bookea-gris">
              Depositás, adjuntás el comprobante y Bookea lo confirma.
            </span>
          </button>
        </div>
      )}

      {eleccion === "tarjeta" && (
        <div className="mt-3 rounded-2xl border border-bookea-linea bg-bookea-fondo p-4">
          <p className="text-[12.5px] leading-relaxed text-bookea-gris">
            Te llevamos al pago seguro de Stripe — 100&nbsp;% cifrado, sin guardar tu tarjeta
            en Bookea. Al confirmarse el cobro, tu programa se crea solo y te llega el acceso
            al correo.
          </p>
          <button
            type="button"
            disabled={pagando}
            onClick={() => void pagarConTarjeta()}
            className="presionable mt-3 w-full rounded-full px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-60 sm:w-auto"
            style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
          >
            {pagando ? "Abriendo el pago seguro…" : `Pagar ${plan.precio} →`}
          </button>
          {errorTarjeta && (
            <p role="alert" className="mt-2 text-[12.5px] font-bold text-red-700">
              {errorTarjeta}
            </p>
          )}
        </div>
      )}

      {eleccion === "deposito" && (
      <>
      {/* El precio está en dólares y el SINPE se hace en colones:
          decirlo antes evita el depósito por el monto equivocado. */}
      {plan.enDolares && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] leading-snug text-amber-800">
          El SINPE se hace en colones: escribinos y te confirmamos el monto exacto al tipo
          de cambio del día.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="flex gap-1.5">
            {(["sinpe", "transferencia"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metodo === m}
                onClick={() => alCambiarMetodo(m)}
                className={`presionable rounded-full px-3 py-1.5 text-[12px] font-bold ${
                  metodo === m
                    ? "bg-bookea-azul text-white"
                    : "bg-bookea-azul-suave text-bookea-gris"
                }`}
              >
                {m === "sinpe" ? "SINPE Móvil" : "Transferencia"}
              </button>
            ))}
          </div>
          {metodo === "sinpe" ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-bookea-gris">
              SINPE Móvil al <strong className="text-bookea-tinta">{pago.sinpe.numero}</strong>{" "}
              a nombre de <strong className="text-bookea-tinta">{pago.sinpe.titular}</strong>.
              En el detalle poné «{nombreNegocio.trim() || "tu negocio"}».
            </p>
          ) : pago.banco.cuenta ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-bookea-gris">
              {pago.banco.nombre} · cuenta{" "}
              <strong className="text-bookea-tinta">{pago.banco.cuenta}</strong> a nombre de{" "}
              <strong className="text-bookea-tinta">{pago.banco.titular}</strong>.
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] leading-relaxed text-bookea-gris">
              Escribinos y te pasamos la cuenta — o usá SINPE Móvil al{" "}
              <strong className="text-bookea-tinta">{pago.sinpe.numero}</strong>, que es
              inmediato.
            </p>
          )}
        </div>

        <div className="sm:border-l sm:border-bookea-linea sm:pl-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
            Adjuntá la captura del depósito
          </p>
          {comprobanteUrl ? (
            <p className="mt-1.5 text-[12.5px] font-bold text-emerald-700">
              ✓ Comprobante adjunto.{" "}
              <button
                type="button"
                onClick={alQuitarComprobante}
                className="font-bold text-bookea-gris underline"
              >
                Cambiarlo
              </button>
            </p>
          ) : (
            <input
              type="file"
              accept="image/*"
              disabled={subiendo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) alElegir(f);
              }}
              className="mt-1.5 block w-full text-[12.5px] text-bookea-gris file:mr-3 file:rounded-[10px] file:border-0 file:bg-bookea-azul-suave file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-bookea-tinta"
            />
          )}
          {subiendo && <p className="mt-1 text-[12px] text-bookea-gris">Subiendo…</p>}
          {error && <p className="mt-1 text-[12.5px] font-bold text-red-700">{error}</p>}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// ── Derivaciones para los campos «legado» del alta ─────────────────
// La acción de hoy guarda regalía + meta de sellos; la extendida lee la
// tarjeta entera. Se derivan del beneficio para que las dos entiendan
// lo mismo, con el MISMO resumen que pinta el creador del panel.

function resumenDelBeneficio(b: ConfigBeneficio): string {
  switch (b.tipo) {
    case "sellos":
      return `${b.requeridos} sellos → ${b.recompensa || "…"}`;
    case "puntos":
      return `${b.porVisita} por visita · ${b.porMoneda} por colón`;
    case "cupon":
    case "descuento":
      return b.beneficio.forma === "porcentaje"
        ? `${b.beneficio.valor}% de descuento`
        : b.beneficio.forma === "monto"
          ? `₡${b.beneficio.valor.toLocaleString("es-CR")} de descuento`
          : `${b.beneficio.que || "…"} gratis`;
    case "membresia":
      return `${b.nivel || "…"} · ${b.vigenciaMeses} meses`;
    case "giftcard":
      return `${b.moneda === "USD" ? "$" : "₡"}${b.valor.toLocaleString("es-CR")}`;
    case "evento":
      return `${b.fecha || "…"} ${b.hora} · ${b.ubicacion || "…"}`;
    case "cashback":
      return `${b.porcentaje}% de vuelta`;
  }
}

function regaliaDelBeneficio(b: ConfigBeneficio): string {
  if (b.tipo === "sellos") return b.recompensa;
  return resumenDelBeneficio(b).slice(0, 120);
}

function metaDelBeneficio(b: ConfigBeneficio): number {
  if (b.tipo === "sellos") return b.requeridos;
  // Acotado a 1–100: la acción valida `metaSellos` con el rango de los
  // SELLOS aun cuando acá es solo el marcador legado de una tarjeta de
  // puntos — un mínimo de canje de 500 puntos no puede tumbar el envío.
  if (b.tipo === "puntos") return Math.min(100, Math.max(1, b.minimoCanje));
  return 10;
}
