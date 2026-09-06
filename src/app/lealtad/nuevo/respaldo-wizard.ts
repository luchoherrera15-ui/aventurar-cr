import {
  configPorDefecto,
  esTipoTarjeta,
  leerBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { coloresDePaleta, PALETAS } from "@/lib/lealtad/paletas";
import { esIconoSello, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { CONFIG_CLASICA, configDesdeJson, type ConfigTira } from "@/lib/wallet/layout-tira";
import { planIncluyeTipo } from "@/lib/lealtad/planes";
import { esRubro, type Rubro } from "@/lib/lealtad/presets-rubro";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL RESPALDO DEL ASISTENTE DE ALTA — lo puro, fuera del componente
 * ════════════════════════════════════════════════════════════════════
 *
 * Vivía adentro de `wizard-alta.tsx` («use client»). Se mudó acá el
 * 6 sep 2026, el día que se encontró que un alta con SINPE se perdía
 * por un desajuste de una llave en `sanearGuardado` — y que no había
 * ninguna prueba que lo hubiera atrapado, porque una función adentro
 * de un componente de cliente no se puede probar sin montar React.
 *
 * Módulo NEUTRAL a propósito: sin "use client", sin React, sin Next.
 * Todo lo que importa es catálogo y saneo (tipos de tarjeta, paletas,
 * geometría de la tira, paquetes). Lo prueba `respaldo-wizard.test.ts`.
 */

// "prellenado": llega desde configurador-lealtad.tsx (Modo 3 del
// configurador sin cuenta, vía `tarjeta-formulario.tsx`) con
// tipo/beneficio/apariencia YA resueltos
// — antes este wizard los volvía a pedir desde cero (mismo formulario
// de PasoBeneficio, mismos selectores de color), el "proceso
// redundante al pagar" que se reportó. Salta directo a "revisar".
export type Camino = "creador" | "personalizado" | "prellenado";

/** El estado que se respalda en sessionStorage (todo serializable). */
export type EstadoWizard = {
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
  /**
   * Dónde van los sellos en la tira (0212).
   *
   * Este asistente NO tiene controles para tocarlo, y aun así lo guarda:
   * cuando el configurador público manda a pagar, deja su borrador en
   * sessionStorage y esta pantalla lo levanta. Sin el campo, elegir
   * «sellos abajo» y después pagar devolvía los sellos al centro.
   */
  diseno: ConfigTira;
  telefono: string;
  descripcion: string;
  /** El código del agente de ventas que atendió el alta (opcional). */
  codigoReferido: string;
  /**
   * MODO ADMIN: a quién le queda el pase.
   *
   * Van en el estado —y no en un `useState` suelto— para que el
   * respaldo en sessionStorage los conserve: un admin que arma una
   * tarjeta larga y recarga sin querer no tiene por qué volver a
   * escribir el correo del cliente.
   *
   * En el alta pública quedan vacíos y nadie los mira.
   */
  correoAdmin: string;
  nombrePersona: string;
};

export const HEX = /^#[0-9a-fA-F]{6}$/;

export function estadoInicial(): EstadoWizard {
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
    diseno: CONFIG_CLASICA,
    telefono: "",
    descripcion: "",
    correoAdmin: "",
    nombrePersona: "",
    codigoReferido: "",
  };
}

/**
 * Lo que vuelve de sessionStorage no se cree tal cual: se sanea campo
 * por campo. Un valor viejo o manipulado se descarta al default, nunca
 * rompe el asistente ni salta un candado (el servidor revalida igual).
 */
export function sanearGuardado(crudo: unknown, plan: string | null, topePasos: number): EstadoWizard {
  const limpio = estadoInicial();
  if (!crudo || typeof crudo !== "object") return limpio;
  const c = crudo as Record<string, unknown>;

  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  // El camino "prellenado" (irAlPlanPago() en tarjeta-formulario.tsx)
  // guarda el nombre bajo la clave `nombre` (el campo se llama así en
  // `ValorFormulario`, compartido con el creador y el editor) — nunca
  // escribió `nombreNegocio`. Sin este respaldo, "Revisar" llegaba con
  // el nombre vacío, "Enviar"/"Pagar" bloqueados, y ninguna pantalla
  // donde escribirlo: "Revisar" es la ÚNICA pantalla de este camino
  // (ver `pantallas` en wizard-alta.tsx), así que no hay a dónde "volver".
  limpio.nombreNegocio = texto(c.nombreNegocio ?? c.nombre, 80);
  limpio.detalleOtro = texto(c.detalleOtro, 80);
  limpio.telefono = texto(c.telefono, 30);
  limpio.codigoReferido = texto(c.codigoReferido, 24);
  limpio.descripcion = texto(c.descripcion, 500);
  if (c.camino === "personalizado") limpio.camino = "personalizado";
  if (c.camino === "prellenado") limpio.camino = "prellenado";
  if (esRubro(c.tipoNegocio)) limpio.tipoNegocio = c.tipoNegocio;
  // El camino "prellenado" nace de `publicarAlta()`/`irAlPlanPago()` en
  // configurador-lealtad.tsx, que no tiene paso de rubro (mismo
  // criterio que ya usa ese archivo) — se fuerza "citas" sin importar
  // qué haya en el respaldo.
  if (limpio.camino === "prellenado") limpio.tipoNegocio = "citas";

  // ⚠️ `c.modo ?? c.tipo` — LOS DOS NOMBRES, Y NO ES REDUNDANCIA.
  //
  // Este asistente guarda el tipo como `modo`. Pero el camino
  // "prellenado" NO lo escribe este asistente: lo escribe
  // `irAlPlanPago()` (tarjeta-formulario.tsx) con la forma de
  // `ValorFormulario`, donde el tipo se llama `tipo` — exactamente el
  // mismo desajuste que `nombre`/`nombreNegocio` de arriba.
  //
  // Leyendo solo `modo`, un borrador del configurador llegaba acá sin
  // tipo: `modo` quedaba en el «sellos» de `estadoInicial()` y el
  // beneficio en `configPorDefecto("sellos")`, con la regalía VACÍA.
  // `validarBeneficio` la rechazaba, `puedePublicar` daba false, y como
  // "prellenado" tiene una sola pantalla y el motivo no se mostraba, la
  // persona veía el botón «Enviar la solicitud» apagado sin explicación
  // ni forma de arreglarlo. Así se perdió el alta con SINPE del 6 sep
  // 2026 (comprobante subido dos veces, ninguna solicitud en la base) —
  // y, mirando el storage, ninguna alta de pago había entrado NUNCA
  // por este camino.
  //
  // El tipo se restaura SOLO si el paquete actual lo incluye: volver de
  // un F5 con un tipo bloqueado dejaría el candado saltado en silencio.
  const modoCrudo = c.modo ?? c.tipo;
  if (
    typeof modoCrudo === "string" &&
    esTipoTarjeta(modoCrudo) &&
    planIncluyeTipo(plan, modoCrudo)
  ) {
    limpio.modo = modoCrudo;
    limpio.beneficio = leerBeneficio(c.beneficio, modoCrudo) ?? configPorDefecto(modoCrudo);
  }
  if (typeof c.colorFondo === "string" && HEX.test(c.colorFondo)) limpio.colorFondo = c.colorFondo;
  if (typeof c.colorSello === "string" && HEX.test(c.colorSello)) limpio.colorSello = c.colorSello;
  if (esIconoSello(c.iconoSello)) limpio.iconoSello = c.iconoSello;
  if (typeof c.logoUrl === "string" && c.logoUrl) limpio.logoUrl = c.logoUrl;
  if (typeof c.bannerUrl === "string" && c.bannerUrl) limpio.bannerUrl = c.bannerUrl;
  // La geometría de la tira (0212) llega por el camino "prellenado":
  // `configDesdeJson` la sanea campo por campo, así que un respaldo
  // viejo —que ni tenía la clave— cae al layout clásico solo.
  limpio.diseno = configDesdeJson(c.diseno);
  if (typeof c.paso === "number" && Number.isInteger(c.paso)) {
    limpio.paso = Math.min(Math.max(0, c.paso), topePasos - 1);
  }
  // Forzado al final, después del saneo genérico de arriba: "prellenado"
  // tiene una sola pantalla ("revisar"), así que cualquier `paso`
  // restaurado de otro camino no tiene a dónde apuntar.
  if (limpio.camino === "prellenado") limpio.paso = 0;
  return limpio;
}
