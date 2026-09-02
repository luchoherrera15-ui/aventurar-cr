/**
 * BOOKEA BUSINESS — DE QUÉ SE ARMA EL MENÚ DEL PANEL, Y A DÓNDE LLEVA
 * CADA ÍTEM.
 *
 * `modulos.ts` dice QUÉ MÓDULOS usa un tipo de negocio. `identidad.ts`
 * dice CÓMO SE LLAMAN sus cosas. Faltaba la tercera pregunta, que es la
 * que convierte esas dos listas en un menú de verdad: **¿qué pantalla
 * abre cada módulo?**
 *
 * Hasta ahora esa respuesta estaba escrita a mano dentro de
 * `mi-negocio/[id]/page.tsx` como cuatro pestañas fijas (Inicio · Citas ·
 * Finanzas · Configuración), así que daba igual que el tipo declarara
 * once módulos: el dueño veía cuatro. Acá se arma el menú COMPLETO —
 * lo que ya se puede abrir y lo que todavía no— en una función pura que
 * se puede probar sin montar la pantalla.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LA REGLA DURA: NINGÚN ÍTEM PUEDE LLEVAR A UN 404.
 *
 * Un módulo produce un enlace SOLO si existe la pantalla que lo abre
 * PARA ESTE NEGOCIO. Y eso son dos condiciones distintas, no una:
 *
 *   1. Que el módulo tenga pantalla en general. Lo dice
 *      `definicionModulo(id).disponible`, y `resolverModulos` ya deja
 *      afuera del conjunto activo todo lo que no la tenga.
 *   2. Que la pantalla exista PARA ESTE NEGOCIO. Un lugar de eventos
 *      tiene el módulo `clientes` encendido, pero la única lista de
 *      clientes que existe hoy vive dentro de la agenda de citas
 *      (`/mi-negocio/[id]/citas`), que un lugar no tiene. Enlazarlo
 *      sería mandarlo a una pantalla que no es la suya.
 *
 * Lo que no pasa las dos se muestra IGUAL —el dueño tiene que ver qué
 * trae su tipo de negocio— pero apagado y sin enlace: `destino` queda en
 * `{ clase: "proximamente" }` y quien pinta no tiene de dónde sacar un
 * href aunque quiera. Es la misma idea que ya aplica `resolverModulos`,
 * un escalón más abajo.
 *
 * Las rutas que existen de verdad hoy, y son las únicas que se emiten:
 *
 *   /mi-negocio/[id]              el panel, con ?tab= y ?seccion=
 *   /mi-negocio/[id]/citas        la agenda del día (y sus secciones)
 *   /mi-negocio/[id]/promos       las promos que salen en la app
 *
 * Módulo NEUTRAL (sin "use client" y sin JSX): lo lee la página del
 * panel en el servidor y también el menú en el navegador.
 */

import {
  GRUPOS,
  MODULOS,
  definicionModulo,
  modulosProximamente,
  type GrupoId,
  type ModuloId,
  type TipoNegocioId,
} from "./modulos";
import type { Vocabulario } from "./identidad";

// ------------------------------------------------------------
// El destino
// ------------------------------------------------------------

/**
 * A dónde lleva un ítem. Son tres casos y no dos porque "abre otra
 * sección de esta misma pantalla" no es lo mismo que "navega a otra
 * ruta": la primera se resuelve en el cliente sin recargar (y por eso
 * conserva los formularios a medio llenar), la segunda es un `<Link>`.
 */
export type DestinoMenu =
  /** Otra pestaña del mismo panel (`?tab=`), sin salir de la pantalla. */
  | { clase: "seccion"; tab: string }
  /** Una ruta de verdad. Siempre una de las dos de arriba. */
  | { clase: "ruta"; href: string }
  /** El tipo lo declara, pero no hay pantalla. Se pinta apagado. */
  | { clase: "proximamente" };

export type ItemMenu = {
  /** El id del módulo, o `inicio`/`config`, que son del caparazón. */
  id: string;
  /** `null` en los dos ítems que no salen de un módulo. */
  modulo: ModuloId | null;
  /** Ya con el vocabulario del tipo aplicado: "Pacientes", "Sesiones". */
  label: string;
  /** Para qué sirve, en una línea — lo usan las tarjetas de acceso. */
  resumen: string;
  grupo: GrupoId;
  destino: DestinoMenu;
};

export type ParametrosMenu = {
  ranchoId: string;
  tipo: TipoNegocioId;
  /** Los módulos ACTIVOS, tal como los devuelve `resolverModulos`. */
  modulos: ReadonlySet<ModuloId>;
  vocabulario: Vocabulario;
  /**
   * ¿Este negocio tiene la pantalla de agenda del día? Es
   * `usaAgendaPorHoras(vertical, categoria)` — la misma pregunta que ya
   * decide en el panel si existe `/mi-negocio/[id]/citas`. Un lugar de
   * eventos alquila la fecha entera y no la tiene.
   */
  agendaPorHoras: boolean;
  /**
   * La vertical Citas guarda su catálogo DENTRO de Configuración ("Mis
   * productos"); las demás lo tienen como pestaña propia. No es un
   * detalle de estilo: cambia el destino del módulo `servicios`.
   */
  esVerticalCitas: boolean;
  /** Cómo se llama el catálogo acá ("Catálogo", "Menú", "Paquetes"…). */
  etiquetaCatalogo: string;
};

// ------------------------------------------------------------
// El mapa módulo → pantalla
// ------------------------------------------------------------

const PROXIMAMENTE: DestinoMenu = { clase: "proximamente" };

/**
 * Qué abre un módulo ACTIVO en este negocio. Devuelve `null` cuando el
 * módulo no merece ítem propio (hoy solo `agenda` sin pantalla del día:
 * su calendario del mes ES el cuerpo de Inicio, y repetirlo daría dos
 * ítems que llevan al mismo lugar).
 */
function resolverModulo(
  modulo: ModuloId,
  p: ParametrosMenu,
): { label: string; destino: DestinoMenu } | null {
  const panel = `/mi-negocio/${p.ranchoId}`;
  const { visita, persona } = p.vocabulario;

  switch (modulo) {
    case "agenda":
      if (!p.agendaPorHoras) return null;
      return {
        // En Citas la pantalla ES "las citas / las consultas / las
        // sesiones"; en Eventos, un proveedor la llama por lo que hace
        // (agendar el día), porque su palabra —"reservas"— ya nombra
        // otra cosa en su panel.
        label: p.esVerticalCitas ? visita.Plural : "Agenda del día",
        destino: { clase: "ruta", href: `${panel}/citas` },
      };

    case "clientes":
      // El módulo de verdad (transformación CRM, 1 sep 2026): cartera
      // segmentada + ficha 360° en /clientes. Ya no es el ancla dentro
      // de la agenda, y ya no depende de la agenda por horas: el
      // cliente de un evento también es un cliente, así que TODO
      // negocio con el módulo activo tiene su cartera.
      return {
        label: persona.Plural,
        destino: { clase: "ruta", href: `${panel}/clientes` },
      };

    case "servicios":
      return p.esVerticalCitas
        ? {
            label: "Servicios",
            destino: { clase: "ruta", href: `${panel}?tab=config&seccion=productos` },
          }
        : { label: p.etiquetaCatalogo, destino: { clase: "seccion", tab: "catalogo" } };

    case "equipo":
      // Las secciones de equipo, horario y bloqueos solo se montan en
      // Configuración cuando el negocio agenda por horas. Enlazarlas
      // desde un restaurante llevaría a una pestaña sin esa sección.
      return {
        label: "Equipo",
        destino: p.agendaPorHoras
          ? { clase: "ruta", href: `${panel}?tab=config&seccion=equipo` }
          : PROXIMAMENTE,
      };

    case "pagos":
      return { label: "Finanzas", destino: { clase: "seccion", tab: "finanzas" } };

    case "reportes":
      // "Cómo va el negocio" es una sección de la pantalla de citas.
      return {
        label: "Reportes",
        destino: p.agendaPorHoras
          ? { clase: "ruta", href: `${panel}/citas#reportes` }
          : PROXIMAMENTE,
      };

    default:
      // Ningún otro módulo tiene pantalla todavía. No hace falta
      // enumerarlos: `resolverModulos` ya borra del conjunto activo todo
      // lo que tenga `disponible: false`, así que si alguno llega hasta
      // acá es porque se acaba de marcar disponible sin darle destino —
      // y entonces "próximamente" es exactamente la verdad.
      return { label: definicionModulo(modulo).nombre, destino: PROXIMAMENTE };
  }
}

// ------------------------------------------------------------
// El menú
// ------------------------------------------------------------

const ORDEN_GRUPO = new Map<string, number>(GRUPOS.map((g, i) => [g, i]));
const ORDEN_MODULO = new Map<string, number>(MODULOS.map((m, i) => [m.id, i]));

/** Grupo primero (el orden de `GRUPOS`), módulo después (el de `MODULOS`). */
function peso(item: ItemMenu): number {
  const grupo = ORDEN_GRUPO.get(item.grupo) ?? GRUPOS.length;
  // Inicio abre su grupo y Configuración cierra el suyo; los dos son del
  // caparazón, así que no tienen lugar en el orden de los módulos.
  const dentro =
    item.id === "inicio" ? -1 : item.id === "config" ? MODULOS.length : (ORDEN_MODULO.get(item.id) ?? MODULOS.length);
  return grupo * 1000 + dentro;
}

/**
 * El menú completo de un negocio: Inicio, sus módulos activos (cada uno
 * con su destino real), los que su tipo declara pero todavía no existen
 * —apagados— y Configuración.
 *
 * El orden no se elige acá: sale de `GRUPOS` y del orden de `MODULOS`,
 * para que agregar un módulo nuevo lo ponga solo donde corresponde.
 */
/** La raíz del panel de este negocio. */
function panelDe(p: ParametrosMenu): string {
  return `/mi-negocio/${p.ranchoId}`;
}

export function itemsMenuNegocio(p: ParametrosMenu): ItemMenu[] {
  const items: ItemMenu[] = [
    {
      id: "inicio",
      modulo: null,
      label: "Inicio",
      resumen: "Cómo va el día, lo que espera respuesta y el acceso a todo lo demás.",
      grupo: "agenda",
      destino: { clase: "seccion", tab: "inicio" },
    },
  ];

  for (const def of MODULOS) {
    if (!p.modulos.has(def.id)) continue;
    const resuelto = resolverModulo(def.id, p);
    if (!resuelto) continue;
    items.push({
      id: def.id,
      modulo: def.id,
      label: resuelto.label,
      resumen: def.resumen,
      grupo: def.grupo,
      destino: resuelto.destino,
    });
  }

  // Lo que el tipo declara y todavía no existe. Va al menú a propósito:
  // es lo que hace que un consultorio se vea como un consultorio y no
  // como una barbería con otro color. Nunca lleva a ningún lado.
  for (const id of modulosProximamente(p.tipo)) {
    const def = definicionModulo(id);
    items.push({
      id,
      modulo: id,
      label: def.nombre,
      resumen: def.resumen,
      grupo: def.grupo,
      destino: PROXIMAMENTE,
    });
  }

  // ── PROMOS ────────────────────────────────────────────────────────
  // `modulo: null`, igual que Inicio y Configuración, y a propósito:
  // los módulos se prenden y apagan según el TIPO de negocio, y
  // anunciar una promo lo puede hacer cualquiera —un rancho, una
  // barbería, un restaurante—. Atarla a un módulo dejaría a la mitad
  // de los negocios sin poder publicar.
  //
  // Va en "crecimiento" porque es de conseguir clientes, no de
  // atenderlos: vive al lado de Marketing, no de la agenda.
  items.push({
    id: "promos",
    modulo: null,
    label: "Promos",
    resumen: "Lo que estás ofreciendo, para que salga en la app.",
    grupo: "crecimiento",
    destino: { clase: "ruta", href: `${panelDe(p)}/promos` },
  });

  items.push({
    id: "config",
    modulo: null,
    label: "Configuración",
    resumen: "Tu perfil, tus precios, tu horario y qué módulos usás.",
    grupo: "config",
    destino: { clase: "seccion", tab: "config" },
  });

  return items.sort((a, b) => peso(a) - peso(b));
}

/** Los que de verdad se pueden abrir — para las tarjetas de acceso. */
export function itemsAbiertos(items: ItemMenu[]): ItemMenu[] {
  return items.filter((i) => i.destino.clase !== "proximamente");
}
