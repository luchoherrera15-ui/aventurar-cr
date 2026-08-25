import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  SUBCATEGORIAS,
  type Categoria,
} from "@/app/mi-negocio/types";
import { CATEGORIA_CITA_LABEL } from "@/app/citas/tipos";
import { CATEGORIA_HOSPEDAJE_LABEL } from "@/app/booking/tipos";
import { DIRECTORIO } from "@/lib/carriles-home";
import { urlDirectorio } from "@/lib/url-directorio";
import type { VerticalNegocio } from "@/lib/categorias-vertical";

/**
 * ============================================================
 * LAS CINCO PUERTAS — la taxonomía de navegación de Bookea
 * ============================================================
 *
 * Citas · Eventos · Hospedaje · Experiencias · Servicios.
 *
 * ── UNA PUERTA NO ES UNA VERTICAL ────────────────────────────────
 *
 * Es la decisión de arquitectura que sostiene todo lo demás. La base
 * tiene CUATRO verticales y ninguna otra (CHECK de la 0076: `eventos`,
 * `citas`, `hospedajes`, `restaurantes`). Una PUERTA, en cambio, es una
 * LENTE: agrupa destinos reales de una o de varias verticales y el
 * visitante nunca se entera de la costura.
 *
 *   · «Servicios» junta rubros de `citas` (mascotas, automotriz,
 *     tatuajes) con la ferretería del evento que vive en `eventos`
 *     (transporte, seguridad, baños portátiles, plantas eléctricas).
 *   · «Experiencias» hoy tiene UN destino real: los hospedajes de
 *     categoría `experiencia`.
 *
 * Por eso acá no se inventa ni una vertical ni una categoría: **cada
 * entrada declara contra qué valor REAL de `ranchos` filtra**, o dice
 * con todas las letras que todavía no filtra nada.
 *
 * ── LOS TRES ESTADOS DE UNA ENTRADA, Y POR QUÉ SON TRES ──────────
 *
 *   "real"        el valor existe en `ranchos` Y el directorio destino
 *                 lee ese parámetro y filtra. Tiene href.
 *   "sin-filtro"  el valor existe en `ranchos` (lo autoriza el CHECK de
 *                 la 0188) pero el directorio destino todavía NO lee ese
 *                 parámetro: el enlace mostraría la lista entera sin
 *                 filtrar. NO tiene href y no se dibuja.
 *   "sin-base"    el valor no existe en ninguna parte. NO tiene href y
 *                 no se dibuja.
 *
 * El estado del medio es el que evita el peor error posible acá: un
 * enlace que promete «Mascotas» y entrega el directorio completo de
 * Citas. La entrada queda escrita —para que se vea qué falta y cuánto
 * cuesta— pero no se le da href, así que no hay forma de dibujarla por
 * accidente.
 *
 * ── QUÉ SE DIBUJA: LO QUE TIENE NEGOCIOS, Y NADA MÁS ─────────────
 *
 * Decisión del dueño (ago 2026): la taxonomía se escribe ENTERA acá,
 * pero el menú se arma contra un CONTEO REAL (`@/lib/censo-rubros`).
 * Una entrada sin negocios no se lista. Así el menú crece solo a medida
 * que entran negocios, sin tocar una línea de código, y nunca hay un
 * enlace que lleve a una lista vacía.
 *
 * ⚠️ MÓDULO NEUTRO. Sin `"use client"`, sin JSX, sin `next/headers` y
 * sin Supabase: lo van a importar a la vez el mega menú (cliente), el
 * cajón móvil (cliente) y los paneles y el sitemap (servidor). Exportar
 * valores desde un módulo `"use client"` rompe el build EN SILENCIO —
 * ya pasó dos veces en este repo (Finanzas y el panel de IA), y es el
 * mismo motivo por el que `grupos-categorias.tsx` vive fuera de
 * `nav-categorias.tsx`.
 *
 * ⚠️ Y SIN ÍCONOS. Un `ReactNode` se construye con JSX y un archivo
 * `.ts` no admite JSX. Los íconos se resuelven aparte, en el componente
 * que dibuja; acá viajan solo ids y textos.
 *
 * ── DE DÓNDE SALE CADA LISTA ─────────────────────────────────────
 *
 * Los 62 rubros de Eventos NO están copiados: se derivan de
 * `SUBCATEGORIAS` (@/app/mi-negocio/types), que es la misma lista que
 * valida el alta del negocio y contra la que el CHECK de la base está
 * escrito. Si mañana alguien agrega un rubro allá, aparece acá solo. Los
 * de Hospedaje salen de `CATEGORIA_HOSPEDAJE_LABEL` y los de Citas de
 * `CATEGORIA_CITA_LABEL`, por el mismo motivo.
 *
 * Las únicas listas escritas a mano son las de segundo nivel de Citas
 * (que hoy no existen en el código, solo en el CHECK de la 0188) y las
 * de los rubros que todavía no existen en ninguna parte. Las dos están
 * marcadas y ninguna se dibuja.
 */

/* ═══════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════ */

/**
 * A dónde apunta una entrada del menú.
 *
 * Es una unión discriminada y no un objeto con banderas a propósito: la
 * única forma de obtener un href es tener un destino `"real"`, así que
 * el compilador impide que una entrada sin respaldo termine dibujada
 * como enlace.
 */
export type Destino =
  | {
      respaldo: "real";
      /** La vertical tal cual la guarda `ranchos.vertical`. */
      vertical: VerticalNegocio;
      /** El valor exacto de `ranchos.categoria` contra el que filtra. */
      categoria?: string;
      /**
       * El valor exacto de `ranchos.subcategoria`. Solo `/eventos` lo
       * lee (ver `LEE_SUBCATEGORIA`), así que en un destino `"real"`
       * solo puede aparecer con `vertical: "eventos"`.
       */
      subcategoria?: string;
    }
  | {
      /** El valor está en la base, pero el directorio destino no lo lee. */
      respaldo: "sin-filtro";
      vertical: VerticalNegocio;
      categoria?: string;
      subcategoria?: string;
      /** Qué falta, en una línea. Obligatorio: si no se puede explicar, no va. */
      motivo: string;
    }
  | {
      /** No existe en la base. Ni categoría, ni subcategoría, ni columna. */
      respaldo: "sin-base";
      motivo: string;
    };

/** Una hoja del menú: un rubro con su destino declarado. */
export type EntradaNav = {
  /** Único dentro de la puerta. Sirve de `key` y de clave de analítica. */
  id: string;
  label: string;
  destino: Destino;
};

/**
 * Una columna temática del panel. El agrupamiento es lo que hace que el
 * mega menú se entienda —y lo que un lector de pantalla anuncia como
 * «Belleza, lista de 8 elementos» en vez de 79 enlaces sueltos—, así
 * que el título no es decorativo.
 */
export type ColumnaNav = {
  id: string;
  titulo: string;
  entradas: EntradaNav[];
  /** El «Ver todo» de la columna, cuando existe un destino que la abarca entera. */
  verTodo?: Destino;
};

export type PuertaId = "citas" | "eventos" | "hospedaje" | "experiencias" | "servicios";

export type Puerta = {
  id: PuertaId;
  label: string;
  /**
   * La ruta propia de la puerta: a dónde lleva su botón y su «Ver
   * todo». Las cinco existen (`/experiencias` y `/servicios` se crearon
   * junto con este archivo), así que ninguna puerta es un callejón sin
   * salida ni un 404.
   */
  ruta: string;
  columnas: ColumnaNav[];
  /**
   * El pie del panel. Con el directorio todavía chico, cada rubro vacío
   * es una oportunidad de captar oferta y no una decepción.
   */
  ctaOferta: { texto: string; href: string };
};

/* ═══════════════════════════════════════════════════════════════════
   EL CONTRATO DE PARÁMETROS — qué lee cada directorio
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Qué directorio lee `?subcategoria=`. Verificado archivo por archivo:
 *
 *   /eventos       ✅ `directorio.tsx` lo levanta de la URL y filtra.
 *   /citas         ❌ su `searchParams` solo declara categoria/q/pais/provincia.
 *   /hospedajes    ❌ su firma es literalmente `{ categoria?: … }`.
 *   /restaurantes  ❌ ídem.
 *
 * Emitir un parámetro que el destino no lee es exactamente el enlace
 * que miente: la URL dice que hay un filtro y la pantalla muestra todo.
 */
const LEE_SUBCATEGORIA: Record<VerticalNegocio, boolean> = {
  eventos: true,
  citas: false,
  hospedajes: false,
  restaurantes: false,
};

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

/**
 * La URL del directorio ya filtrado, o `null` si esa entrada todavía no
 * lleva a ninguna parte.
 *
 * Es el ÚNICO lugar del menú donde se arma una URL de directorio, y
 * delega en `urlDirectorio` para no tener un segundo criterio sobre el
 * orden de los parámetros ni sobre la regla de `?pais=cr`.
 */
export function hrefDeDestino(destino: Destino): string | null {
  if (destino.respaldo !== "real") return null;
  const ruta = DIRECTORIO[destino.vertical];
  if (!ruta) return null;
  // Red de seguridad sobre el contrato de arriba: si alguien agrega una
  // subcategoría a una vertical que no la lee, el enlace no se emite en
  // vez de emitirse mintiendo.
  if (destino.subcategoria && !LEE_SUBCATEGORIA[destino.vertical]) return null;
  return urlDirectorio(ruta, {
    categoria: destino.categoria,
    subcategoria: destino.subcategoria,
  });
}

/**
 * La clave con la que se le pregunta al censo cuántos negocios hay
 * detrás de un destino. Es `vertical|categoria|subcategoria` con los
 * huecos vacíos, y vale también para los destinos `"sin-filtro"`: el
 * valor existe en la base aunque el directorio todavía no lo lea, así
 * que el censo sí lo puede contar.
 */
export function claveDeDestino(destino: Destino): string | null {
  if (destino.respaldo === "sin-base") return null;
  return `${destino.vertical}|${destino.categoria ?? ""}|${destino.subcategoria ?? ""}`;
}

/**
 * Los destinos de una puerta que apuntan a datos que existen en
 * `ranchos` — los `"real"` y los `"sin-filtro"`.
 *
 * Lo usan `/experiencias` y `/servicios`, que son LENTES: arman su
 * propia consulta a partir de estos destinos, así que pueden mostrar
 * negocios de rubros que su directorio de origen todavía no sabe
 * filtrar. Es la misma razón por la que esos destinos siguen escritos
 * acá en vez de borrarse.
 */
export function destinosConDatos(
  puerta: Puerta,
): Extract<Destino, { vertical: VerticalNegocio }>[] {
  return puerta.columnas
    .flatMap((c) => [...c.entradas.map((e) => e.destino), ...(c.verTodo ? [c.verTodo] : [])])
    .filter(
      (d): d is Extract<Destino, { vertical: VerticalNegocio }> =>
        d.respaldo !== "sin-base",
    );
}

/* ═══════════════════════════════════════════════════════════════════
   EVENTOS — 62 rubros que YA filtran, derivados de la lista fuente
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Una columna de Eventos a partir de una de sus seis categorías. Cero
 * taxonomía escrita a mano: los ids y los labels salen de
 * `SUBCATEGORIAS`, que es lo que valida el alta del negocio.
 */
function columnaDeEventos(categoria: Categoria): ColumnaNav {
  return {
    id: `eventos-${categoria}`,
    titulo: CATEGORIA_LABEL[categoria],
    verTodo: { respaldo: "real", vertical: "eventos", categoria },
    entradas: SUBCATEGORIAS[categoria].map((s) => ({
      id: `eventos-${s.id}`,
      label: s.label,
      destino: {
        respaldo: "real",
        vertical: "eventos",
        // La categoría viaja junto con la subcategoría aunque el filtro
        // de /eventos funcione solo con la segunda: así la pestaña de
        // arriba del directorio también queda marcada y la persona ve
        // dónde está parada, en vez de aterrizar en «Todos» con una
        // lista recortada sin explicación.
        categoria,
        subcategoria: s.id,
      },
    })),
  };
}

/**
 * «Otros servicios» de Eventos NO es una columna de Eventos.
 *
 * Transporte, seguridad, baños portátiles y plantas eléctricas son la
 * ferretería del evento: nadie los busca dentro de «Eventos», los busca
 * cuando piensa «servicios». Se cuelgan enteros de la puerta SERVICIOS,
 * que sin ellos no tendría un solo destino que filtre de verdad.
 *
 * Y así ninguna entrada aparece dos veces: dos rutas al mismo href
 * rompen el menú (y la prueba de este archivo).
 */
const CATEGORIA_FERRETERIA_EVENTO: Categoria = "otros";

/* ═══════════════════════════════════════════════════════════════════
   CITAS — segundo nivel escrito a mano (la 0188 lo autoriza, el
   código todavía no lo conoce)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Una entrada de segundo nivel de Citas.
 *
 * Los 34 valores de este bloque están en el CHECK
 * `ranchos_subcategoria_check` de la migración 0188 —o sea que la base
 * los acepta hoy— pero `/citas` todavía no lee `?subcategoria=`. Hasta
 * que lo lea, el enlace mostraría el directorio entero sin filtrar, así
 * que quedan en `"sin-filtro"`: escritos, contables por el censo,
 * usables por `/servicios`, y no dibujables.
 *
 * Encenderlos es un cambio acotado y ya identificado: que `/citas`
 * valide `?subcategoria=` contra esta lista. NO se toca
 * `usaSubcategoria()` para eso — esa función es el interruptor del
 * FORMULARIO DE ALTA, y ampliarla a `citas` rompe la pantalla de editar
 * de todo negocio de esa vertical.
 */
function subcategoriaDeCitas(
  categoria: string,
  id: string,
  label: string,
): EntradaNav {
  return {
    id: `citas-${id}`,
    label,
    destino: {
      respaldo: "sin-filtro",
      vertical: "citas",
      categoria,
      subcategoria: id,
      motivo: "La 0188 autoriza el valor; /citas todavía no lee ?subcategoria=.",
    },
  };
}

/**
 * Una categoría de Citas que la 0188 autoriza pero que
 * `CATEGORIAS_CITAS` (@/app/citas/tipos) todavía no conoce.
 *
 * `/citas` valida `?categoria=` contra esa lista de seis y lo que no
 * matchea cae en `undefined`: el enlace mostraría la lista completa. Son
 * tres —`mascotas`, `automotriz`, `tatuajes`— y cablearlas pide tocar
 * cinco mapas `Record<CategoriaCita, …>` (dos de ellos en la app móvil)
 * o el build no compila. Hasta entonces: `"sin-filtro"`.
 */
function categoriaDeCitasSinCablear(id: string, label: string): EntradaNav {
  return {
    // `citas-cat-…`, igual que las categorías ya cableadas de arriba. El
    // prefijo no es cosmético: `tatuajes` es a la vez una categoría y
    // una subcategoría de la 0188, y sin distinguirlas las dos entradas
    // compartirían id (lo cazó la prueba de este archivo).
    id: `citas-cat-${id}`,
    label,
    destino: {
      respaldo: "sin-filtro",
      vertical: "citas",
      categoria: id,
      motivo:
        "La 0188 autoriza la categoría; CATEGORIAS_CITAS todavía no la incluye y /citas la ignora.",
    },
  };
}

/** Un rubro que el dueño pidió y que no existe en ninguna parte. */
function sinBase(id: string, label: string, motivo: string): EntradaNav {
  return { id, label, destino: { respaldo: "sin-base", motivo } };
}

/* ═══════════════════════════════════════════════════════════════════
   LAS CINCO PUERTAS
   ═══════════════════════════════════════════════════════════════════ */

const CTA_PUBLICAR = { texto: "Publicá tu negocio", href: "/publicar" };

/**
 * ⚠️ El label de la puerta de Citas dice «Citas» y no «Salud y belleza»
 * (`NOMBRE_VERTICAL.citas`, que es como se titulan los rieles de la
 * portada y el directorio). Es una divergencia a propósito y pedida: en
 * el header las cinco puertas son Citas · Eventos · Hospedaje ·
 * Experiencias · Servicios, y «Salud y belleza» no es el nombre de una
 * puerta que también contiene mascotas y automotriz. Si el dueño quiere
 * unificarlo, se cambia acá y en `NOMBRE_VERTICAL`, no en un tercer lado.
 */
export const PUERTAS: Puerta[] = [
  {
    id: "citas",
    label: "Citas",
    ruta: "/citas",
    ctaOferta: CTA_PUBLICAR,
    columnas: [
      {
        id: "citas-belleza",
        titulo: "Belleza",
        entradas: [
          {
            id: "citas-cat-belleza",
            label: CATEGORIA_CITA_LABEL.belleza,
            destino: { respaldo: "real", vertical: "citas", categoria: "belleza" },
          },
          {
            id: "citas-cat-unas",
            label: CATEGORIA_CITA_LABEL.unas,
            destino: { respaldo: "real", vertical: "citas", categoria: "unas" },
          },
          {
            id: "citas-cat-barberia",
            label: CATEGORIA_CITA_LABEL.barberia,
            destino: { respaldo: "real", vertical: "citas", categoria: "barberia" },
          },
          subcategoriaDeCitas("belleza", "salon_belleza", "Salón de belleza"),
          subcategoriaDeCitas("belleza", "peinados", "Cabello y peinados"),
          subcategoriaDeCitas("belleza", "maquillaje", "Maquillaje"),
          subcategoriaDeCitas("belleza", "cejas_pestanas", "Cejas y pestañas"),
          subcategoriaDeCitas("belleza", "depilacion", "Depilación"),
          subcategoriaDeCitas("belleza", "tratamientos_faciales", "Tratamientos faciales"),
          subcategoriaDeCitas("unas", "manicure", "Manicure"),
          subcategoriaDeCitas("unas", "pedicure", "Pedicure"),
          subcategoriaDeCitas("unas", "unas_acrilicas", "Uñas acrílicas"),
          subcategoriaDeCitas("barberia", "corte_caballero", "Corte caballero"),
          subcategoriaDeCitas("barberia", "afeitado_barba", "Afeitado y barba"),
        ],
      },
      {
        id: "citas-bienestar",
        titulo: "Bienestar",
        // Sin «Ver todo»: la primera entrada de la columna YA es la
        // categoría completa. Dos enlaces al mismo sitio con dos nombres
        // distintos es cómo se despegan las taxonomías.
        entradas: [
          {
            id: "citas-cat-spa",
            label: CATEGORIA_CITA_LABEL.spa,
            destino: { respaldo: "real", vertical: "citas", categoria: "spa" },
          },
          subcategoriaDeCitas("spa", "masajes", "Masajes"),
          subcategoriaDeCitas("spa", "spa_dia", "Spa de día"),
          subcategoriaDeCitas("spa", "sauna_jacuzzi", "Sauna y jacuzzi"),
        ],
      },
      {
        id: "citas-salud",
        titulo: "Salud",
        // Ídem: «Consultorios» ya es la entrada que abarca la columna.
        entradas: [
          {
            id: "citas-cat-consultorio",
            label: CATEGORIA_CITA_LABEL.consultorio,
            destino: { respaldo: "real", vertical: "citas", categoria: "consultorio" },
          },
          subcategoriaDeCitas("consultorio", "medicina_general", "Medicina general"),
          subcategoriaDeCitas("consultorio", "odontologia", "Odontología"),
          subcategoriaDeCitas("consultorio", "ortodoncia", "Ortodoncia"),
          subcategoriaDeCitas("consultorio", "dermatologia", "Dermatología"),
          subcategoriaDeCitas("consultorio", "psicologia", "Psicología"),
          subcategoriaDeCitas("consultorio", "nutricion", "Nutrición"),
          subcategoriaDeCitas("consultorio", "fisioterapia", "Fisioterapia"),
          subcategoriaDeCitas("consultorio", "quiropractica", "Quiropráctica"),
          subcategoriaDeCitas("consultorio", "oftalmologia", "Oftalmología"),
          subcategoriaDeCitas("consultorio", "pediatria", "Pediatría"),
          subcategoriaDeCitas("consultorio", "ginecologia", "Ginecología"),
          subcategoriaDeCitas("consultorio", "laboratorio_clinico", "Laboratorio clínico"),
        ],
      },
      {
        /**
         * El agujero más citado del pedido. Gimnasio, entrenador, yoga y
         * pilates existen en el repo SOLO como `TipoNegocioId` —el tipo
         * de operación del panel—, que no filtra ningún directorio. Para
         * que sean rubros de verdad hace falta migración del CHECK más
         * los cinco mapas de código más la app móvil.
         */
        id: "citas-entrenamiento",
        titulo: "Entrenamiento",
        entradas: [
          sinBase(
            "citas-fitness",
            "Gimnasios",
            "`gimnasio` solo existe como TipoNegocioId; no es categoría de `ranchos`.",
          ),
          sinBase(
            "citas-entrenador",
            "Entrenadores personales",
            "`entrenador` solo existe como TipoNegocioId.",
          ),
          sinBase(
            "citas-yoga",
            "Yoga y pilates",
            "`yoga`/`pilates` solo existen como TipoNegocioId.",
          ),
        ],
      },
    ],
  },

  {
    id: "eventos",
    label: "Eventos",
    ruta: "/eventos",
    ctaOferta: CTA_PUBLICAR,
    columnas: [
      ...CATEGORIAS.filter((c) => c !== CATEGORIA_FERRETERIA_EVENTO).map(columnaDeEventos),
      {
        /**
         * NO FALTA UN VALOR: FALTA UNA COLUMNA.
         *
         * «Bodas», «XV años», «Graduaciones» no son categorías de
         * negocio sino OCASIONES, y no hay columna, ni CHECK, ni filtro
         * en ninguna vertical. Lo más cercano es `wedding_planner`, que
         * son planners y no «todo para bodas»: usarlo como si fuera
         * «Bodas» sería exactamente el enlace que miente.
         *
         * Queda escrito acá porque es la brecha más cara del pedido y
         * porque el día que se decida cuesta una migración con columna
         * nueva (`ocasiones text[]`) + filtro en cada directorio + alta
         * en el formulario + paridad móvil.
         */
        id: "eventos-ocasion",
        titulo: "Por ocasión",
        entradas: [
          sinBase("eventos-bodas", "Bodas", "No hay eje de ocasión en `ranchos`."),
          sinBase("eventos-cumpleanos", "Cumpleaños", "No hay eje de ocasión en `ranchos`."),
          sinBase("eventos-xv", "XV años", "No hay eje de ocasión en `ranchos`."),
          sinBase("eventos-graduaciones", "Graduaciones", "No hay eje de ocasión en `ranchos`."),
          sinBase("eventos-baby-shower", "Baby showers", "No hay eje de ocasión en `ranchos`."),
          sinBase("eventos-despedidas", "Despedidas", "No hay eje de ocasión en `ranchos`."),
          sinBase("eventos-corporativos", "Eventos corporativos", "No hay eje de ocasión en `ranchos`."),
        ],
      },
    ],
  },

  {
    id: "hospedaje",
    label: "Hospedaje",
    ruta: "/hospedajes",
    ctaOferta: { texto: "Publicá tu hospedaje", href: "/mi-negocio/nuevo/hospedajes" },
    columnas: [
      {
        id: "hospedaje-casas",
        titulo: "Casas y villas",
        entradas: [
          {
            id: "hospedaje-casa",
            label: CATEGORIA_HOSPEDAJE_LABEL.casa,
            destino: { respaldo: "real", vertical: "hospedajes", categoria: "casa" },
          },
          {
            id: "hospedaje-villa",
            label: CATEGORIA_HOSPEDAJE_LABEL.villa,
            destino: { respaldo: "real", vertical: "hospedajes", categoria: "villa" },
          },
          {
            id: "hospedaje-apartamento",
            label: CATEGORIA_HOSPEDAJE_LABEL.apartamento,
            destino: { respaldo: "real", vertical: "hospedajes", categoria: "apartamento" },
          },
        ],
      },
      {
        id: "hospedaje-hoteles",
        titulo: "Hoteles y cabañas",
        entradas: [
          {
            // «Cabinas» del pedido es ESTE destino, no otro: una sola
            // entrada. Duplicarla daría dos enlaces al mismo sitio con
            // dos nombres, que es cómo se despegan las taxonomías.
            id: "hospedaje-cabana",
            label: CATEGORIA_HOSPEDAJE_LABEL.cabana,
            destino: { respaldo: "real", vertical: "hospedajes", categoria: "cabana" },
          },
          {
            id: "hospedaje-hotel",
            label: CATEGORIA_HOSPEDAJE_LABEL.hotel,
            destino: { respaldo: "real", vertical: "hospedajes", categoria: "hotel" },
          },
        ],
      },
      {
        id: "hospedaje-mas-tipos",
        titulo: "Más tipos",
        entradas: [
          sinBase("hospedaje-resort", "Resorts", "No está en `ranchos_categoria_check`."),
          sinBase("hospedaje-glamping", "Glamping", "No está en `ranchos_categoria_check`."),
          sinBase("hospedaje-lodge", "Lodges", "No está en `ranchos_categoria_check`."),
          sinBase("hospedaje-hostal", "Hostales", "No está en `ranchos_categoria_check`."),
          sinBase("hospedaje-bungalow", "Bungalows", "No está en `ranchos_categoria_check`."),
          sinBase(
            "hospedaje-pet-friendly",
            "Pet friendly",
            "Es AMENIDAD (`mascotas` en AMENIDADES), no categoría, y ningún directorio filtra por amenidad.",
          ),
          sinBase(
            "hospedaje-romantico",
            "Escapadas románticas",
            "Sería una amenidad o una ocasión; no existe ninguna de las dos.",
          ),
          sinBase(
            "hospedaje-familiar",
            "Para toda la familia",
            "Sería una amenidad o una ocasión; no existe ninguna de las dos.",
          ),
        ],
      },
    ],
  },

  {
    /**
     * La puerta más vacía, y la que más honestidad pide.
     *
     * `experiencias` NO es una vertical: el CHECK de la 0076 acepta
     * `eventos | citas | hospedajes | restaurantes` y nada más. Lo único
     * real en toda la plataforma es el hospedaje de categoría
     * `experiencia`. Los 17 rubros de tours y aventura que se pidieron
     * no existen: pedirían migrar los DOS CHECKs, dar de alta la
     * vertical en el formulario del dueño y replicarla entera en la app
     * móvil.
     *
     * Hasta entonces `/experiencias` es una LENTE sobre ese único
     * destino, con su vacío convertido en captación de oferta.
     */
    id: "experiencias",
    label: "Experiencias",
    ruta: "/experiencias",
    ctaOferta: { texto: "Publicá tu experiencia", href: "/publicar" },
    columnas: [
      {
        id: "experiencias-con-hospedaje",
        titulo: "Con hospedaje",
        entradas: [
          {
            id: "experiencias-hospedaje",
            label: "Experiencias con hospedaje",
            destino: { respaldo: "real", vertical: "hospedajes", categoria: "experiencia" },
          },
        ],
      },
      {
        id: "experiencias-aventura",
        titulo: "Aventura",
        entradas: [
          sinBase("experiencias-tours", "Tours", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-rafting", "Rafting", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-canopy", "Canopy", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-surf", "Surf", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-buceo", "Buceo y snorkeling", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-kayak", "Kayak", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-pesca", "Pesca", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-atv", "ATV y cuadraciclos", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-cabalgatas", "Cabalgatas", "La vertical `experiencias` no existe (CHECK 0076)."),
        ],
      },
      {
        id: "experiencias-naturaleza",
        titulo: "Naturaleza",
        entradas: [
          sinBase("experiencias-senderismo", "Senderismo", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-playa", "Playa", "La vertical `experiencias` no existe (CHECK 0076)."),
          sinBase("experiencias-naturaleza", "Naturaleza y vida silvestre", "La vertical `experiencias` no existe (CHECK 0076)."),
        ],
      },
      {
        id: "experiencias-momentos",
        titulo: "Momentos",
        entradas: [
          sinBase("experiencias-romanticas", "Románticas", "Sería un eje de ocasión; no existe."),
          sinBase("experiencias-familiares", "Familiares", "Sería un eje de ocasión; no existe."),
          sinBase("experiencias-privadas", "Privadas", "Sería un eje de ocasión; no existe."),
        ],
      },
    ],
  },

  {
    /**
     * La puerta que demuestra que una puerta es una lente: junta rubros
     * de DOS verticales distintas y el visitante no ve la costura.
     *
     * ⚠️ «Otros servicios» a secas NO se dibuja como entrada: el id
     * `otros` existe en tres verticales con tres nombres distintos
     * («Otros servicios», «Otros», «Otros sabores»). Una entrada
     * ambigua es peor que ninguna.
     */
    id: "servicios",
    label: "Servicios",
    ruta: "/servicios",
    ctaOferta: CTA_PUBLICAR,
    columnas: [
      {
        id: "servicios-evento",
        titulo: "Para tu evento",
        verTodo: {
          respaldo: "real",
          vertical: "eventos",
          categoria: CATEGORIA_FERRETERIA_EVENTO,
        },
        entradas: SUBCATEGORIAS[CATEGORIA_FERRETERIA_EVENTO].filter(
          // «Otro servicio» es el cajón de sastre del formulario de
          // alta: como nombre de rubro en un menú no le dice nada a
          // nadie. El negocio que esté ahí igual aparece bajo el «Ver
          // todo» de la columna.
          (s) => s.id !== "otro",
        ).map((s) => ({
          id: `servicios-${s.id}`,
          label: s.label,
          destino: {
            respaldo: "real",
            vertical: "eventos",
            categoria: CATEGORIA_FERRETERIA_EVENTO,
            subcategoria: s.id,
          } as const,
        })),
      },
      {
        id: "servicios-mascotas",
        titulo: "Tu mascota",
        entradas: [
          categoriaDeCitasSinCablear("mascotas", "Mascotas"),
          subcategoriaDeCitas("mascotas", "grooming", "Peluquería canina"),
          subcategoriaDeCitas("mascotas", "veterinaria", "Veterinaria"),
        ],
      },
      {
        id: "servicios-vehiculo",
        titulo: "Tu vehículo",
        entradas: [
          categoriaDeCitasSinCablear("automotriz", "Automotriz"),
          subcategoriaDeCitas("automotriz", "lavacar", "Lavacar"),
          subcategoriaDeCitas("automotriz", "polarizado", "Polarizado"),
          subcategoriaDeCitas("automotriz", "detallado_auto", "Detallado de autos"),
          subcategoriaDeCitas("automotriz", "mecanica", "Mecánica"),
        ],
      },
      {
        id: "servicios-cuidado",
        titulo: "Cuidado personal",
        entradas: [
          categoriaDeCitasSinCablear("tatuajes", "Tatuajes"),
          subcategoriaDeCitas("tatuajes", "tatuajes", "Estudios de tatuaje"),
          subcategoriaDeCitas("tatuajes", "perforaciones", "Perforaciones"),
        ],
      },
      {
        id: "servicios-hogar",
        titulo: "Hogar y oficios",
        entradas: [
          sinBase("servicios-limpieza", "Limpieza", "No está en `ranchos_categoria_check`."),
          sinBase("servicios-reparaciones", "Reparaciones", "No está en `ranchos_categoria_check`."),
          sinBase("servicios-jardineria", "Jardinería", "No está en `ranchos_categoria_check`."),
          sinBase("servicios-tecnologia", "Tecnología", "No está en `ranchos_categoria_check`."),
          sinBase(
            "servicios-profesionales",
            "Profesionales",
            "`profesional` existe como TipoNegocioId, que no filtra ningún directorio.",
          ),
          sinBase(
            "servicios-transporte-general",
            "Transporte y mudanzas",
            "Solo existe `transporte` PARA EVENTOS; el transporte general no está en la base.",
          ),
        ],
      },
    ],
  },
];

/** La puerta con ese id, o `undefined`. */
export function puertaPorId(id: string): Puerta | undefined {
  return PUERTAS.find((p) => p.id === id);
}
