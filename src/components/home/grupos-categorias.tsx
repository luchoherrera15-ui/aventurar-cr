import type { ReactElement, ReactNode } from "react";
import {
  CATEGORIAS,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
} from "@/app/mi-negocio/types";
import { CATEGORIAS_CITAS, CATEGORIA_CITA_LABEL } from "@/app/citas/tipos";
import { CATEGORIA_CITA_ICONO } from "@/app/citas/iconos";
import {
  CATEGORIAS_HOSPEDAJES,
  CATEGORIA_HOSPEDAJE_LABEL,
  type CategoriaHospedaje,
} from "@/app/booking/tipos";
import {
  CATEGORIAS_RESTAURANTES,
  CATEGORIA_RESTAURANTE_LABEL,
} from "@/app/restaurantes/tipos";
import { CATEGORIA_RESTAURANTE_ICONO } from "@/app/restaurantes/iconos";
import { NOMBRE_VERTICAL } from "@/lib/carriles-home";
import {
  IconBell,
  IconCompass,
  IconHome,
  IconHouse,
  IconPalmera,
  IconRancho,
  IconSparkles,
  IconTijeras,
  IconUtensils,
} from "@/components/icons";

/**
 * ============================================================
 * LAS CUATRO VERTICALES Y SUS RUBROS — la taxonomía de la portada
 * ============================================================
 *
 * Un solo lugar del que salen los cuatro grupos que la portada muestra
 * de dos maneras distintas:
 *
 *   · `NavCategorias`  — la fila compacta de íconos de arriba, con su
 *                        flechita y su panel desplegable.
 *   · `ExplorarRubros` — la franja de abajo, con TODOS los rubros a la
 *                        vista como tiles clickeables.
 *
 * Antes esto vivía adentro de `nav-categorias.tsx`, que es un módulo
 * `"use client"`. Importar un valor desde un módulo cliente hacia un
 * componente de servidor rompe el build EN SILENCIO (ya pasó dos veces
 * en este repo: Finanzas e IA), así que la lista se mudó acá.
 *
 * ⚠️ ESTE ARCHIVO ES NEUTRO. Tiene JSX —los íconos son elementos— pero
 * NO lleva `"use client"`, no importa `next/headers` ni Supabase, y no
 * usa estado ni efectos. Por eso lo pueden leer los dos lados.
 *
 * ── DE DÓNDE SALE CADA RUBRO ─────────────────────────────────────
 *
 * ⚠️ REGLA DURA: acá NO se inventa taxonomía. Cada lista es EXACTAMENTE
 * la que ya vive en el código y que la columna `ranchos.categoria`
 * acepta para esa vertical — las mismas cuatro listas que
 * `@/lib/categorias-vertical` usa para validar el alta y el editor del
 * negocio. Si mañana se agrega un rubro allá, aparece acá solo; si se
 * quita, desaparece. No hay una quinta copia que mantener.
 *
 *   Eventos       → CATEGORIAS              · @/app/mi-negocio/types
 *   Salud y bell. → CATEGORIAS_CITAS        · @/app/citas/tipos
 *   Hospedajes    → CATEGORIAS_HOSPEDAJES   · @/app/booking/tipos
 *   Restaurantes  → CATEGORIAS_RESTAURANTES · @/app/restaurantes/tipos
 *
 * Los nombres de las cuatro verticales salen de `NOMBRE_VERTICAL`
 * (@/lib/carriles-home), el mismo mapa que titula los rieles de más
 * abajo: si el encabezado del riel dijera «Salud y belleza» y el ícono
 * de arriba dijera «Citas», serían dos secciones distintas para el
 * visitante.
 *
 * Los íconos vienen del mismo lado en tres de los cuatro casos
 * (CATEGORIA_ICONO, CATEGORIA_CITA_ICONO, CATEGORIA_RESTAURANTE_ICONO).
 * Hospedajes es el único que no tenía mapa de íconos en ningún lado, y
 * el suyo se declara acá abajo (`ICONO_HOSPEDAJE`).
 *
 * ── LOS CUATRO DESTINOS FILTRAN DE VERDAD ────────────────────────
 *
 * Un link que no lleva a nada es peor que no tener el link. Los cuatro
 * directorios leen `?categoria=` y filtran:
 *
 *   /eventos?categoria=…       directorio.tsx arranca su pestaña con
 *                              `searchParams.get("categoria")`
 *   /citas?categoria=…         page.tsx lo valida contra CATEGORIAS_CITAS
 *   /restaurantes?categoria=…  page.tsx, idéntico patrón
 *   /hospedajes?categoria=…    también, desde ago 2026
 */

/**
 * Los rubros de Hospedajes: el único mapa de íconos que no existía.
 *
 * `Record<CategoriaHospedaje, …>` y no un objeto suelto: si alguien
 * agrega un tipo de hospedaje en `@/app/booking/tipos` sin darle ícono
 * acá, NO COMPILA — en vez de dejar un hueco en el panel.
 */
const ICONO_HOSPEDAJE: Record<CategoriaHospedaje, ReactElement> = {
  casa: <IconHouse />,
  villa: <IconPalmera />,
  hotel: <IconBell />,
  cabana: <IconRancho />,
  apartamento: <IconHome />,
  experiencia: <IconCompass />,
};

export type Rubro = { id: string; label: string; icono: ReactNode };

export type Grupo = {
  /** La vertical tal cual la guarda `ranchos.vertical`. */
  id: string;
  /** Lo que se lee en el ícono y en el encabezado. */
  label: string;
  Icono: (p: { className?: string }) => ReactElement;
  /** El directorio de la vertical: también es el «Ver todo» del panel. */
  base: string;
  verTodo: string;
  rubros: Rubro[];
  /** Restaurantes trae 18 rubros: en una sola columna no se lee. */
  dosColumnas?: boolean;
};

export const GRUPOS: Grupo[] = [
  {
    id: "eventos",
    label: NOMBRE_VERTICAL.eventos,
    Icono: IconSparkles,
    base: "/eventos",
    verTodo: `Ver todo en ${NOMBRE_VERTICAL.eventos}`,
    rubros: CATEGORIAS.map((c) => ({
      id: c,
      label: CATEGORIA_LABEL[c],
      icono: CATEGORIA_ICONO[c],
    })),
  },
  {
    id: "citas",
    label: NOMBRE_VERTICAL.citas,
    Icono: IconTijeras,
    base: "/citas",
    verTodo: `Ver todo en ${NOMBRE_VERTICAL.citas}`,
    rubros: CATEGORIAS_CITAS.map((c) => ({
      id: c,
      label: CATEGORIA_CITA_LABEL[c],
      icono: CATEGORIA_CITA_ICONO[c],
    })),
  },
  {
    id: "hospedajes",
    label: NOMBRE_VERTICAL.hospedajes,
    Icono: IconHouse,
    base: "/hospedajes",
    verTodo: `Ver todo en ${NOMBRE_VERTICAL.hospedajes}`,
    rubros: CATEGORIAS_HOSPEDAJES.map((c) => ({
      id: c,
      label: CATEGORIA_HOSPEDAJE_LABEL[c],
      icono: ICONO_HOSPEDAJE[c],
    })),
  },
  {
    id: "restaurantes",
    label: NOMBRE_VERTICAL.restaurantes,
    Icono: IconUtensils,
    base: "/restaurantes",
    verTodo: `Ver todo en ${NOMBRE_VERTICAL.restaurantes}`,
    dosColumnas: true,
    rubros: CATEGORIAS_RESTAURANTES.map((c) => ({
      id: c,
      label: CATEGORIA_RESTAURANTE_LABEL[c],
      icono: CATEGORIA_RESTAURANTE_ICONO[c],
    })),
  },
];
