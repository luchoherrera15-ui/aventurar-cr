import { CATEGORIAS_CITAS, type CategoriaCita } from "./tipos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL SEGUNDO NIVEL DE CITAS — lo que la 0188 autorizó y nadie usaba
 * ════════════════════════════════════════════════════════════════════
 *
 * La migración 0188 amplió el CHECK de `ranchos.subcategoria` con 34
 * valores nuevos para la vertical de Citas: «peinados», «manicure»,
 * «corte_caballero», «fisioterapia»… La base los acepta desde entonces.
 *
 * Lo que faltaba era el otro lado: NINGÚN archivo de TypeScript los
 * conocía. `grep SUBCATEGORIAS_CITAS` sobre el repo entero daba cero, y
 * `/citas` ni siquiera declaraba `subcategoria` en sus `searchParams`.
 * O sea que un negocio podía guardar «manicure» y el directorio no
 * tenía forma de filtrarlo.
 *
 * ── POR QUÉ SE ESCRIBE AHORA ────────────────────────────────────────
 *
 * La portada abre las subcategorías al pasar el mouse por un rubro. Sin
 * esta lista, esos enlaces tendrían que apuntar a
 * `/citas?categoria=belleza` a secas — y entonces tocar «Peinados»
 * mostraría TODO Belleza. Eso no es una lista vacía, que sería honesta:
 * es una lista EQUIVOCADA, que es peor, porque la persona cree que está
 * viendo peinados.
 *
 * ── LOS IDS SON LOS DE LA BASE, LETRA POR LETRA ─────────────────────
 *
 * Salen del CHECK de la 0188 y no se pueden «mejorar» acá: un id que no
 * coincida es un filtro que nunca encuentra nada. `subcategorias-citas.test.ts`
 * los compara contra el `.sql` de verdad, en las dos direcciones.
 *
 * ── LO QUE NO ESTÁ ACÁ, Y POR QUÉ ───────────────────────────────────
 *
 * La 0188 también autoriza `tatuajes`, `perforaciones`, `lavacar`,
 * `polarizado`, `detallado_auto`, `mecanica`, `grooming` y
 * `veterinaria`. No entran en este mapa porque sus CATEGORÍAS padre
 * —tatuajes, automotriz, mascotas— todavía no existen en
 * `CATEGORIAS_CITAS`: colgarlas de «otros» las escondería, y crear las
 * categorías es un cambio que toca cinco mapas `Record<CategoriaCita,…>`
 * más dos archivos de la app móvil. Queda anotado, no hecho.
 */
export const SUBCATEGORIAS_CITAS: Record<CategoriaCita, { id: string; label: string }[]> = {
  belleza: [
    { id: "salon_belleza", label: "Salón de belleza" },
    { id: "peinados", label: "Peinados" },
    { id: "maquillaje", label: "Maquillaje" },
    { id: "cejas_pestanas", label: "Cejas y pestañas" },
    { id: "depilacion", label: "Depilación" },
    { id: "tratamientos_faciales", label: "Tratamientos faciales" },
  ],
  unas: [
    { id: "manicure", label: "Manicura" },
    { id: "pedicure", label: "Pedicura" },
    { id: "unas_acrilicas", label: "Uñas acrílicas" },
  ],
  barberia: [
    { id: "corte_caballero", label: "Corte de caballero" },
    { id: "afeitado_barba", label: "Afeitado y barba" },
  ],
  spa: [
    { id: "masajes", label: "Masajes" },
    { id: "spa_dia", label: "Spa de día" },
    { id: "sauna_jacuzzi", label: "Sauna y jacuzzi" },
  ],
  consultorio: [
    { id: "medicina_general", label: "Medicina general" },
    { id: "odontologia", label: "Odontología" },
    { id: "ortodoncia", label: "Ortodoncia" },
    { id: "dermatologia", label: "Dermatología" },
    { id: "psicologia", label: "Psicología" },
    { id: "nutricion", label: "Nutrición" },
    { id: "fisioterapia", label: "Fisioterapia" },
    { id: "oftalmologia", label: "Oftalmología" },
    { id: "pediatria", label: "Pediatría" },
    { id: "ginecologia", label: "Ginecología" },
    { id: "quiropractica", label: "Quiropráctica" },
    { id: "laboratorio_clinico", label: "Laboratorio clínico" },
  ],
  // «Otros» no se desglosa a propósito: es el cajón de lo que no encaja
  // en los cinco de arriba, y darle subcategorías sería inventar una
  // taxonomía sobre algo que existe justamente para no tenerla.
  otros: [],
};

/** Todos los ids del segundo nivel de Citas, planos. */
export const SUBCATEGORIAS_CITAS_TODAS: readonly string[] = CATEGORIAS_CITAS.flatMap(
  (c) => SUBCATEGORIAS_CITAS[c].map((s) => s.id),
);

/**
 * ¿Este valor es una subcategoría real de Citas?
 *
 * Lo pregunta `/citas` antes de filtrar: un `?subcategoria=` inventado
 * se IGNORA en vez de vaciar la pantalla. Es el mismo criterio que ya
 * aplica esa página con `?provincia=Miami`.
 */
export function esSubcategoriaCita(valor: string | null | undefined): boolean {
  return !!valor && SUBCATEGORIAS_CITAS_TODAS.includes(valor);
}

/** A qué rubro pertenece una subcategoría. `null` si no es de Citas. */
export function categoriaDeSubcategoriaCita(valor: string): CategoriaCita | null {
  for (const c of CATEGORIAS_CITAS) {
    if (SUBCATEGORIAS_CITAS[c].some((s) => s.id === valor)) return c;
  }
  return null;
}

export const SUBCATEGORIA_CITA_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS_CITAS.flatMap((c) => SUBCATEGORIAS_CITAS[c].map((s) => [s.id, s.label])),
);
