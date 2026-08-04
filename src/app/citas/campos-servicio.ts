import type { Campo, GrupoCampos } from "@/app/mi-negocio/campos-servicio";
import type { CategoriaCita } from "./tipos";

/**
 * Campos propios de cada categoría de Citas, mismo patrón que
 * mi-negocio/campos-servicio.ts (Eventos): se guardan todos en la
 * columna `detalles` (jsonb) de `ranchos`.
 *
 * A diferencia de Eventos, acá NO se pide tarifa ni duración — eso vive
 * en el catálogo de servicios del negocio (tabla `rancho_items`, pestaña
 * Catálogo). Los campos "Qué hacés" son solo para que el cliente
 * encuentre el negocio en el buscador por lo que ofrece.
 */

const AYUDA_SERVICIOS =
  "Esto es para que te encuentren en el buscador. El precio y la duración de cada servicio se cargan aparte, en la pestaña Catálogo.";

export const CAMPOS_POR_CATEGORIA_CITA: Partial<Record<CategoriaCita, GrupoCampos[]>> = {
  unas: [
    {
      titulo: "Servicios que ofrecés",
      campos: [
        {
          id: "servicios",
          label: "Qué hacés",
          tipo: "multi",
          ayuda: AYUDA_SERVICIOS,
          opciones: [
            { id: "manicure_clasico", label: "Manicure clásico" },
            { id: "manicure_gel", label: "Manicure en gel" },
            { id: "unas_acrilicas", label: "Uñas acrílicas" },
            { id: "unas_esculpidas", label: "Uñas esculpidas" },
            { id: "pedicure", label: "Pedicure" },
            { id: "nail_art", label: "Nail art" },
            { id: "retiro_unas", label: "Retiro de uñas" },
          ],
        },
        { id: "atiende_ninos", label: "Atendés niñas o niños", tipo: "booleano" },
      ],
    },
  ],

  barberia: [
    {
      titulo: "Servicios que ofrecés",
      campos: [
        {
          id: "servicios",
          label: "Qué hacés",
          tipo: "multi",
          ayuda: AYUDA_SERVICIOS,
          opciones: [
            { id: "corte_clasico", label: "Corte clásico" },
            { id: "corte_maquina", label: "Corte a máquina" },
            { id: "diseno_barba", label: "Diseño de barba/línea" },
            { id: "arreglo_barba", label: "Arreglo de barba" },
            { id: "afeitado_navaja", label: "Afeitado con navaja" },
            { id: "corte_infantil", label: "Corte infantil" },
          ],
        },
        { id: "walk_ins", label: "Atendés sin cita (walk-ins)", tipo: "booleano" },
      ],
    },
  ],

  belleza: [
    {
      titulo: "Servicios que ofrecés",
      campos: [
        {
          id: "servicios",
          label: "Qué hacés",
          tipo: "multi",
          ayuda: AYUDA_SERVICIOS,
          opciones: [
            { id: "corte", label: "Corte" },
            { id: "peinado", label: "Peinado" },
            { id: "color_tinte", label: "Color/tinte" },
            { id: "alisado_keratina", label: "Alisado/keratina" },
            { id: "maquillaje", label: "Maquillaje" },
            { id: "peinado_novias_eventos", label: "Peinado para novias o eventos" },
          ],
        },
        // Si esto está en true, el formulario padre (editar-form.tsx)
        // muestra también el grupo COBERTURA de mi-negocio/campos-servicio.ts
        // (zonas, costo de traslado) — la condicional vive ahí, no acá.
        { id: "servicio_domicilio", label: "Servicio a domicilio", tipo: "booleano" },
      ],
    },
  ],

  spa: [
    {
      titulo: "Servicios que ofrecés",
      campos: [
        {
          id: "servicios",
          label: "Qué hacés",
          tipo: "multi",
          ayuda: AYUDA_SERVICIOS,
          opciones: [
            { id: "masajes", label: "Masajes" },
            { id: "faciales", label: "Faciales" },
            { id: "exfoliacion_corporal", label: "Exfoliación corporal" },
            { id: "sauna", label: "Sauna" },
            { id: "aromaterapia", label: "Aromaterapia" },
            { id: "paquetes_pareja", label: "Paquetes en pareja" },
          ],
        },
        { id: "tiene_sauna_jacuzzi", label: "Tenés sauna o jacuzzi", tipo: "booleano" },
      ],
    },
  ],

  consultorio: [
    {
      titulo: "Tu servicio",
      campos: [
        {
          id: "especialidad",
          label: "Especialidad o profesión",
          tipo: "texto",
          placeholder: "Ej. Dermatología, Nutrición, Psicología",
        },
        {
          id: "numero_colegiado",
          label: "Número de colegiado o registro profesional",
          tipo: "texto",
        },
        { id: "consulta_virtual", label: "Ofrecés consulta virtual", tipo: "booleano" },
        {
          id: "requiere_orden_medica",
          label: "Requiere orden médica o referencia",
          tipo: "booleano",
        },
      ],
    },
  ],

  otros: [
    {
      titulo: "Tu servicio",
      campos: [
        {
          id: "que_incluye",
          label: "Qué incluye el servicio",
          tipo: "textarea",
        },
        {
          id: "cita_previa_obligatoria",
          label: "¿La cita previa es obligatoria?",
          tipo: "booleano",
        },
      ],
    },
  ],
};

/** Todos los ids de campo válidos de una categoría, para validar al guardar. */
export function camposDeCategoriaCita(categoria: CategoriaCita): Campo[] {
  return (CAMPOS_POR_CATEGORIA_CITA[categoria] ?? []).flatMap((g) => g.campos);
}
