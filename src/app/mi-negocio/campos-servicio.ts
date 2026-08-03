import { PROVINCIAS, type Categoria } from "./types";

/**
 * Campos propios de cada tipo de servicio.
 *
 * Hacer un formulario distinto por cada uno de los 54 rubros sería
 * inmanejable, así que los campos se definen por categoría general y se
 * guardan todos en una sola columna `detalles` (jsonb). Agregar un campo
 * nuevo es tocar este archivo, sin migración.
 *
 * Los lugares no están acá: ya tienen capacidad, amenidades y el
 * calendario de reservas, que cubren lo suyo.
 */

export type CampoTipo = "texto" | "textarea" | "numero" | "booleano" | "opciones" | "multi";

export type Campo = {
  id: string;
  label: string;
  tipo: CampoTipo;
  ayuda?: string;
  placeholder?: string;
  sufijo?: string;
  opciones?: { id: string; label: string }[];
};

export type GrupoCampos = { titulo: string; campos: Campo[] };

const MODALIDAD = (opciones: string[][]): Campo => ({
  id: "modalidad_cobro",
  label: "¿Cómo cobrás?",
  tipo: "opciones",
  opciones: opciones.map(([id, label]) => ({ id, label })),
  ayuda:
    "Con la modalidad y su tarifa configuradas, el cliente ve su total estimado al momento de reservar.",
});

// Las tarifas que alimentan la cotización en tiempo real del formulario
// de reserva (src/lib/cotizador-servicio.ts). Cada categoría incluye
// solo las que casan con sus modalidades de cobro.
const TARIFA_PERSONA: Campo = {
  id: "tarifa_persona",
  label: "Tarifa por persona",
  tipo: "numero",
  sufijo: "₡",
  ayuda: "Si cobrás por persona: lo que vale tu servicio por cada invitado.",
};
const TARIFA_HORA: Campo = {
  id: "tarifa_hora",
  label: "Tarifa por hora",
  tipo: "numero",
  sufijo: "₡",
  ayuda: "Si cobrás por hora: el precio de cada hora de servicio.",
};
const HORAS_MINIMAS: Campo = {
  id: "horas_minimas",
  label: "Mínimo de horas",
  tipo: "numero",
  sufijo: "horas",
  ayuda: "Si cobrás por hora: lo mínimo que aceptás por contratación.",
};
const TARIFA_EVENTO: Campo = {
  id: "tarifa_evento",
  label: "Tarifa por evento o paquete",
  tipo: "numero",
  sufijo: "₡",
  ayuda: "Si cobrás una tarifa fija: lo que vale el servicio completo.",
};
const HORA_EXTRA: Campo = {
  id: "hora_extra",
  label: "Precio de la hora extra",
  tipo: "numero",
  sufijo: "₡",
  ayuda: "Lo que cobrás por cada hora adicional después de las incluidas.",
};
const TARIFA_DIA: Campo = {
  id: "tarifa_dia",
  label: "Tarifa por día",
  tipo: "numero",
  sufijo: "₡",
  ayuda: "Si cobrás por día de alquiler: el precio de cada día.",
};

// Todo servicio que se mueve al evento necesita decir hasta dónde llega,
// cuánto cobra por ir y con cuánta anticipación hay que reservarlo.
const COBERTURA: GrupoCampos = {
  titulo: "Cobertura y logística",
  campos: [
    {
      id: "zonas",
      label: "¿En qué provincias das servicio?",
      tipo: "multi",
      opciones: PROVINCIAS.map((p) => ({ id: p, label: p })),
    },
    {
      id: "costo_traslado",
      label: "Costo de traslado",
      tipo: "numero",
      sufijo: "₡",
      ayuda: "Dejalo vacío si el traslado va incluido o si depende de la zona.",
    },
    {
      id: "anticipacion_dias",
      label: "Anticipación mínima",
      tipo: "numero",
      sufijo: "días",
      ayuda: "Con cuántos días de aviso necesitás que te reserven.",
    },
  ],
};

export const CAMPOS_POR_CATEGORIA: Partial<Record<Categoria, GrupoCampos[]>> = {
  alimentacion: [
    {
      titulo: "Tu servicio",
      campos: [
        MODALIDAD([
          ["por_persona", "Por persona"],
          ["por_evento", "Por evento"],
          ["por_unidad", "Por unidad"],
        ]),
        TARIFA_PERSONA,
        TARIFA_EVENTO,
        {
          id: "minimo_personas",
          label: "Mínimo de personas",
          tipo: "numero",
          sufijo: "personas",
        },
        {
          id: "especialidades",
          label: "Tus especialidades",
          tipo: "texto",
          placeholder: "Ej. comida típica, parrilla, bocas, repostería",
        },
      ],
    },
    {
      titulo: "¿Qué incluye?",
      campos: [
        { id: "incluye_personal", label: "Personal de servicio", tipo: "booleano" },
        { id: "incluye_vajilla", label: "Vajilla y cristalería", tipo: "booleano" },
        { id: "incluye_mobiliario", label: "Mesas y mantelería", tipo: "booleano" },
        { id: "incluye_montaje", label: "Montaje y desmontaje", tipo: "booleano" },
        { id: "hace_degustacion", label: "Degustación previa", tipo: "booleano" },
      ],
    },
    {
      titulo: "Opciones dietéticas",
      campos: [
        {
          id: "dietas",
          label: "¿Qué opciones manejás?",
          tipo: "multi",
          opciones: [
            { id: "vegetariano", label: "Vegetariano" },
            { id: "vegano", label: "Vegano" },
            { id: "sin_gluten", label: "Sin gluten" },
            { id: "sin_lactosa", label: "Sin lactosa" },
            { id: "sin_azucar", label: "Sin azúcar" },
          ],
        },
      ],
    },
    COBERTURA,
  ],

  animacion: [
    {
      titulo: "Tu servicio",
      campos: [
        MODALIDAD([
          ["por_hora", "Por hora"],
          ["por_evento", "Por evento"],
          ["por_paquete", "Por paquete"],
        ]),
        TARIFA_HORA,
        HORAS_MINIMAS,
        TARIFA_EVENTO,
        {
          id: "duracion_horas",
          label: "Horas incluidas",
          tipo: "numero",
          sufijo: "horas",
          ayuda: "Las horas que cubre tu tarifa por evento o paquete.",
        },
        HORA_EXTRA,
        {
          id: "integrantes",
          label: "Cantidad de integrantes",
          tipo: "numero",
          ayuda: "Para grupos, mariachis o equipos de animación.",
        },
        {
          id: "repertorio",
          label: "Géneros o repertorio",
          tipo: "texto",
          placeholder: "Ej. cumbia, salsa, rock en español, música de plancha",
        },
        {
          id: "edades",
          label: "Edades recomendadas",
          tipo: "texto",
          placeholder: "Ej. de 3 a 10 años",
          ayuda: "Sobre todo si trabajás fiestas infantiles.",
        },
      ],
    },
    {
      titulo: "Equipo que llevás",
      campos: [
        {
          id: "equipo",
          label: "Marcá lo que va incluido",
          tipo: "multi",
          opciones: [
            { id: "sonido", label: "Sonido" },
            { id: "luces", label: "Luces" },
            { id: "microfonos", label: "Micrófonos" },
            { id: "cabina", label: "Cabina de DJ" },
            { id: "pantalla", label: "Pantalla" },
            { id: "proyector", label: "Proyector" },
            { id: "maquina_humo", label: "Máquina de humo" },
            { id: "tarima", label: "Tarima" },
            { id: "karaoke", label: "Karaoke" },
            { id: "inflables", label: "Inflables" },
          ],
        },
      ],
    },
    {
      titulo: "Requisitos del lugar",
      campos: [
        {
          id: "requiere_electricidad",
          label: "Necesita toma eléctrica",
          tipo: "booleano",
        },
        {
          id: "requiere_techo",
          label: "Necesita área techada",
          tipo: "booleano",
        },
        {
          id: "espacio_minimo",
          label: "Espacio mínimo que necesitás",
          tipo: "texto",
          placeholder: "Ej. 3x3 metros para la cabina",
        },
        {
          id: "demo_url",
          label: "Link a un video o demo",
          tipo: "texto",
          placeholder: "YouTube, Instagram, Drive...",
          ayuda: "Es lo que más ayuda a que te contraten.",
        },
      ],
    },
    COBERTURA,
  ],

  organizacion: [
    {
      titulo: "Tu servicio",
      campos: [
        MODALIDAD([
          ["por_evento", "Por evento"],
          ["por_hora", "Por hora"],
          ["por_paquete", "Por paquete"],
          ["por_unidad", "Por unidad"],
        ]),
        TARIFA_EVENTO,
        TARIFA_HORA,
        HORAS_MINIMAS,
        {
          id: "horas_cobertura",
          label: "Horas de cobertura",
          tipo: "numero",
          sufijo: "horas",
          ayuda: "Para fotógrafos, edecanes o producción.",
        },
        {
          id: "minimo_pedido",
          label: "Pedido mínimo",
          tipo: "numero",
          sufijo: "unidades",
          ayuda: "Para invitaciones, artículos de fiesta o promocionales.",
        },
        {
          id: "tiempo_entrega_dias",
          label: "Tiempo de entrega",
          tipo: "numero",
          sufijo: "días",
        },
      ],
    },
    {
      titulo: "Cómo trabajás",
      campos: [
        { id: "diseno_personalizado", label: "Diseño personalizado", tipo: "booleano" },
        { id: "muestra_previa", label: "Muestra o prueba antes", tipo: "booleano" },
        { id: "incluye_edicion", label: "Incluye edición o postproducción", tipo: "booleano" },
        { id: "entrega_digital", label: "Entrega digital del material", tipo: "booleano" },
      ],
    },
    {
      titulo: "Tu trabajo",
      campos: [
        {
          id: "portafolio_url",
          label: "Link a tu portafolio",
          tipo: "texto",
          placeholder: "Instagram, Behance, Drive...",
        },
      ],
    },
    COBERTURA,
  ],

  decoracion: [
    {
      titulo: "Tu servicio",
      campos: [
        {
          id: "modalidad",
          label: "¿Alquilás o vendés?",
          tipo: "opciones",
          opciones: [
            { id: "alquiler", label: "Alquiler" },
            { id: "venta", label: "Venta" },
            { id: "ambos", label: "Alquiler y venta" },
          ],
        },
        MODALIDAD([
          ["por_evento", "Por evento"],
          ["por_dia", "Por día"],
          ["por_unidad", "Por unidad"],
        ]),
        TARIFA_DIA,
        TARIFA_EVENTO,
        {
          id: "inventario",
          label: "Qué tenés disponible y cuánto",
          tipo: "textarea",
          placeholder:
            "Ej. 200 sillas plásticas blancas, 20 mesas redondas de 8 puestos, 6 toldos de 3x3...",
          ayuda: "Es lo primero que pregunta el cliente. Sé específico con las cantidades.",
        },
        {
          id: "minimo_pedido",
          label: "Pedido mínimo",
          tipo: "numero",
          sufijo: "unidades",
        },
      ],
    },
    {
      titulo: "Montaje y garantía",
      campos: [
        { id: "incluye_montaje", label: "Montaje incluido", tipo: "booleano" },
        { id: "incluye_desmontaje", label: "Desmontaje incluido", tipo: "booleano" },
        {
          id: "deposito_garantia",
          label: "Depósito de garantía",
          tipo: "numero",
          sufijo: "₡",
          ayuda: "Lo que cobrás por adelantado y devolvés si todo vuelve bien.",
        },
        {
          id: "tiempo_alquiler",
          label: "Tiempo de alquiler",
          tipo: "texto",
          placeholder: "Ej. 24 horas, o de viernes a domingo",
        },
      ],
    },
    COBERTURA,
  ],

  otros: [
    {
      titulo: "Tu servicio",
      campos: [
        MODALIDAD([
          ["por_evento", "Por evento"],
          ["por_hora", "Por hora"],
          ["por_dia", "Por día"],
          ["por_unidad", "Por unidad"],
        ]),
        TARIFA_EVENTO,
        TARIFA_HORA,
        HORAS_MINIMAS,
        TARIFA_DIA,
        {
          id: "que_incluye",
          label: "Qué incluye el servicio",
          tipo: "textarea",
          placeholder: "Contá exactamente qué recibe el cliente por lo que paga.",
        },
        {
          id: "capacidad_cantidad",
          label: "Capacidad o cantidad disponible",
          tipo: "texto",
          placeholder: "Ej. buseta para 18 personas, 4 baños portátiles",
        },
      ],
    },
    COBERTURA,
  ],
};

/** Todos los ids de campo válidos de una categoría, para validar al guardar. */
export function camposDeCategoria(categoria: Categoria): Campo[] {
  return (CAMPOS_POR_CATEGORIA[categoria] ?? []).flatMap((g) => g.campos);
}

export type DetallesServicio = Record<string, string | number | boolean | string[]>;

/** Texto listo para mostrar en el portal público. */
export function formatearValor(campo: Campo, valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (campo.tipo === "booleano") return valor ? "Sí" : null;

  if (campo.tipo === "multi") {
    if (!Array.isArray(valor) || valor.length === 0) return null;
    return valor
      .map((v) => campo.opciones?.find((o) => o.id === v)?.label ?? String(v))
      .join(", ");
  }

  if (campo.tipo === "opciones") {
    return campo.opciones?.find((o) => o.id === valor)?.label ?? String(valor);
  }

  if (campo.tipo === "numero") {
    const n = Number(valor);
    if (!Number.isFinite(n)) return null;
    if (campo.sufijo === "₡") return "₡" + n.toLocaleString("es-CR");
    return campo.sufijo ? `${n.toLocaleString("es-CR")} ${campo.sufijo}` : String(n);
  }

  return String(valor);
}
