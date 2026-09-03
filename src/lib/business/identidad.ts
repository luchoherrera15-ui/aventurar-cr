/**
 * BOOKEA BUSINESS — la IDENTIDAD de cada tipo de negocio.
 *
 * `modulos.ts` decide QUÉ SECCIONES ve el dueño. Este archivo decide
 * CÓMO SE VE Y CÓMO SE HABLA esa pantalla: de qué color es el panel, con
 * qué ícono se presenta el negocio y —lo más importante— cómo le dice a
 * las dos cosas que aparecen en cada título del sistema: la persona que
 * atiende y la visita que le agenda.
 *
 * Una barbería no tiene "pacientes" y un consultorio no tiene "clientas".
 * Hoy las dos ven la misma pantalla con las mismas palabras, y eso hace
 * que el panel se sienta prestado en vez de propio. El arreglo NO es
 * escribir dos paneles: es que el panel lea su vocabulario de acá.
 *
 * Lo que este archivo NO hace, a propósito:
 *
 *   · No inventa métricas. Acá solo hay copy y color; los números los
 *     calcula quien los tenga (`widgets.ts` + las métricas del panel).
 *   · No decide módulos. Eso ya lo hace `modulos.ts` y no se duplica.
 *   · No repite la palabra de la agenda. `palabraReserva` (widgets.ts)
 *     ya la resuelve para todo el sistema; acá SOLO se declara cuando el
 *     tipo la refina —un gimnasio agenda "sesiones", una academia
 *     "clases"—, y cuando no se declara se hereda. Así las dos fuentes no
 *     pueden contradecirse: hay una sola, y esta la matiza.
 *
 * Módulo NEUTRAL (sin "use client" y sin JSX): lo leen la página del
 * panel en el servidor y los componentes en el navegador. Por eso el
 * ícono viaja como el NOMBRE del componente de `src/components/icons.tsx`
 * y no como el componente: quien pinta hace
 *
 *     import * as Iconos from "@/components/icons";
 *     const Icono = Iconos[identidad.icono];
 *
 * y TypeScript verifica el nombre porque `IconoIdentidad` es una unión
 * cerrada de nombres que existen de verdad (lo fija identidad.test.ts).
 */

import { esTipoNegocio, type TipoNegocioId } from "./modulos";
import { palabraReserva } from "./widgets";

// ------------------------------------------------------------
// Contraste — la regla, antes que los colores
// ------------------------------------------------------------

/**
 * Ratio de contraste WCAG 2.1 entre dos colores hex.
 *
 * Está acá y no en un util suelto porque el catálogo de abajo no se
 * puede revisar "a ojo": un acento bonito que no llega a AA es un acento
 * que alguien no va a poder leer. La prueba mide TODOS los pares con
 * esta función, así que el archivo se defiende solo.
 *
 * Lanza si el color no es hex — es una herramienta de tokens declarados,
 * no de valores que vengan de la base. Ninguna ruta de render la llama.
 */
export function ratioContraste(colorA: string, colorB: string): number {
  const l1 = luminancia(colorA);
  const l2 = luminancia(colorB);
  const claro = Math.max(l1, l2);
  const oscuro = Math.min(l1, l2);
  return (claro + 0.05) / (oscuro + 0.05);
}

function luminancia(hex: string): number {
  const limpio = hex.trim().replace("#", "");

  if (limpio.length !== 3 && limpio.length !== 6) {
    throw new Error(`ratioContraste espera un color hex (#rgb o #rrggbb), recibió "${hex}"`);
  }

  const pares =
    limpio.length === 3
      ? limpio.split("").map((c) => c + c)
      : [limpio.slice(0, 2), limpio.slice(2, 4), limpio.slice(4, 6)];

  const canales = pares.map((par) => {
    const valor = Number.parseInt(par, 16);
    if (Number.isNaN(valor)) throw new Error(`Color hex inválido: "${hex}"`);
    // La curva sRGB de la fórmula oficial, no una aproximación.
    const s = valor / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

/**
 * Los fondos sobre los que el panel pinta de verdad. El sitio es
 * `color-scheme: only light` (globals.css lo fuerza incluso con el
 * sistema en oscuro), así que esta lista es la historia completa: no hay
 * una paleta oscura contra la cual medir también.
 *
 * `#f5f7fa` y `#f6f6f6` son los dos valores que `--grey` toma según el
 * bloque de tokens que gane; se miden los dos porque la diferencia es
 * invisible al ojo pero no al cálculo.
 */
export const FONDOS_PANEL = ["#ffffff", "#f5f7fa", "#f6f6f6"] as const;

// ------------------------------------------------------------
// Los acentos
// ------------------------------------------------------------

/**
 * Un acento son CUATRO valores, no uno, porque el color de identidad
 * cumple cuatro papeles distintos y un solo hex no puede con todos:
 * el naranja del logo es precioso de relleno e ilegible como texto.
 *
 * Todos los pares que importan pasan AA (4.5:1 para texto, 3:1 para el
 * relleno sólido contra el fondo, que es superficie y no letra). Los
 * ratios medidos están en la tabla de `ACENTOS`.
 */
export type Acento = {
  /** El acento como TEXTO, ícono o borde activo sobre fondo claro. */
  tinta: string;
  /** El acento como RELLENO: botón primario, pastilla del tipo activo. */
  solido: string;
  /** La letra que va encima de `solido`. */
  sobreSolido: string;
  /** Fondo tenue de chips y avisos; encima va `tinta`, nunca `solido`. */
  suave: string;
};

export const ACENTOS_ID = [
  "naranja",
  "violeta",
  "rosa",
  "aguamarina",
  "verde",
  "azul",
  "carmesi",
  "navy",
] as const;

export type AcentoId = (typeof ACENTOS_ID)[number];

/**
 * ════════════════════════════════════════════════════════════════════
 *  DESDE SEP 2026 EL PANEL ES BLANCO + AZULES — pedido del dueño:
 *  «no quiero que se use naranja; blancos y azules, varios azules».
 * ════════════════════════════════════════════════════════════════════
 *
 * Los IDs se quedan como NOMBRES HISTÓRICOS (los declaran 30+ tipos de
 * negocio y renombrarlos tocaría cada identidad sin cambiar nada real);
 * los VALORES son ahora una familia de ocho azules distinguibles, del
 * celeste petróleo al navy. Cada tipo conserva SU acento — solo que su
 * acento ahora es un azul.
 *
 * Ratios medidos con `ratioContraste` (mínimo tinta/fondos · tinta
 * sobre suave · letra sobre sólido · mínimo sólido/fondos):
 *
 *   naranja→océano    7.52 · 6.94 · 7.02 · 6.49
 *   violeta→cobalto   8.62 · 8.05 · 7.82 · 7.23
 *   rosa→zafiro       6.92 · 6.59 · 7.48 · 6.92
 *   aguamarina→celeste 6.32 · 5.87 · 6.83 · 6.32
 *   verde→acero       7.22 · 6.74 · 6.60 · 6.10
 *   azul (queda)      7.63 · 7.40 · 8.24 · 7.63
 *   carmesi→medianoche 11.28 · 10.26 · 10.24 · 9.48
 *   navy (queda)      13.78 · 12.78 · 12.70 · 11.75
 *
 * `azul` y `navy` siguen siendo los tokens de globals.css (`--accion`,
 * `--navy`); el resto es la familia nueva, auditada por
 * identidad.test.ts como siempre.
 */
export const ACENTOS: Record<AcentoId, Acento> = {
  naranja: { tinta: "#0a5578", solido: "#0d5f85", sobreSolido: "#ffffff", suave: "#e3eff5" },
  violeta: { tinta: "#2038b0", solido: "#2743c4", sobreSolido: "#ffffff", suave: "#eaeefc" },
  rosa: { tinta: "#2f45c8", solido: "#2f45c8", sobreSolido: "#ffffff", suave: "#edf0fd" },
  aguamarina: { tinta: "#0d5f93", solido: "#0d5f93", sobreSolido: "#ffffff", suave: "#e2f0f9" },
  verde: { tinta: "#33547a", solido: "#3a5f8a", sobreSolido: "#ffffff", suave: "#e9eff5" },
  azul: { tinta: "#0f4c9e", solido: "#0f4c9e", sobreSolido: "#ffffff", suave: "#eef3fb" },
  carmesi: { tinta: "#1c2f77", solido: "#22398f", sobreSolido: "#ffffff", suave: "#e8ebf8" },
  navy: { tinta: "#062653", solido: "#0b3168", sobreSolido: "#ffffff", suave: "#e9eef6" },
};

// ------------------------------------------------------------
// Los íconos
// ------------------------------------------------------------

/**
 * Nombres de `src/components/icons.tsx`. Es una unión cerrada a
 * propósito: si alguien escribe un nombre que no existe, no compila —
 * en vez de renderizar `undefined` y dejar un hueco en el menú.
 *
 * Hay reuso (spa y pilates comparten el loto): preferimos repetir un
 * ícono honesto antes que traer una dependencia de íconos nueva o
 * dibujar uno malo para forzar la diferencia.
 */
export const ICONOS_IDENTIDAD = [
  "IconPosteBarbero",
  "IconTijeras",
  "IconEsmalte",
  "IconLoto",
  "IconHoja",
  "IconEstetoscopio",
  "IconClipboard",
  "IconHeart",
  "IconStopwatch",
  "IconUserCircle",
  "IconPlannerCheck",
  "IconRancho",
  "IconCelebrate",
  "IconHouse",
  "IconUtensils",
  "IconStore",
] as const;

export type IconoIdentidad = (typeof ICONOS_IDENTIDAD)[number];

// ------------------------------------------------------------
// El vocabulario
// ------------------------------------------------------------

/**
 * Una palabra con sus cuatro formas listas para usar. Las mayúsculas
 * vienen resueltas porque el alternativo es que cada pantalla haga su
 * propio `charAt(0).toUpperCase()` — y en español eso se rompe con los
 * acentos si alguien improvisa (`toUpperCase` de "sesión" está bien,
 * pero `slice` mal hecho no).
 */
export type Termino = {
  singular: string;
  plural: string;
  /** Para empezar una frase o un título: "Paciente", "Sesión". */
  Singular: string;
  /** Para encabezados de sección: "Pacientes", "Sesiones". */
  Plural: string;
};

export type Vocabulario = {
  /** Quién viene: cliente, paciente, miembro, alumno, huésped… */
  persona: Termino;
  /** Qué se agenda: cita, sesión, consulta, clase, estadía… */
  visita: Termino;
};

/**
 * Los plurales se declaran a mano, nunca se derivan. El español tiene
 * demasiadas irregularidades para adivinarlos ("huésped" → "huéspedes"
 * pierde la tilde, "comensal" → "comensales" agrega sílaba) y un plural
 * mal formado en un encabezado es exactamente la clase de detalle que
 * hace que un panel se sienta hecho a las carreras.
 *
 * Sin género gramatical a propósito: no hay "clientas". Una lista de
 * personas de un salón tiene hombres también, y el masculino genérico o
 * el femenino forzado dejan a alguien afuera en cualquier dirección.
 */
type Palabra = readonly [singular: string, plural: string];

function termino([singular, plural]: Palabra): Termino {
  return {
    singular,
    plural,
    Singular: capitalizar(singular),
    Plural: capitalizar(plural),
  };
}

function capitalizar(palabra: string): string {
  return palabra.charAt(0).toUpperCase() + palabra.slice(1);
}

// ------------------------------------------------------------
// El catálogo
// ------------------------------------------------------------

/**
 * Lo que se DECLARA por tipo. Distinto de `IdentidadNegocio`, que es lo
 * que se CONSUME: acá las palabras son opcionales porque no declarar es
 * heredar, y allá ya vienen resueltas. Quien pinta usa `identidadDe`;
 * este tipo solo hace falta para recorrer el catálogo crudo.
 */
export type EntradaIdentidad = {
  acento: AcentoId;
  icono: IconoIdentidad;
  /** Una línea: qué es este negocio, en palabras del dueño. */
  descripcion: string;
  /** Quién viene. Sin declarar, "cliente / clientes". */
  persona?: Palabra;
  /**
   * Qué se agenda. Sin declarar, se hereda de `palabraReserva` — que ya
   * es la fuente del sistema entero. Declarar acá es REFINAR: se hace
   * solo cuando el tipo tiene una palabra propia de verdad.
   */
  visita?: Palabra;
};

const CLIENTE: Palabra = ["cliente", "clientes"];

/**
 * `Record<TipoNegocioId, …>` y no un array: agregar un tipo en
 * `modulos.ts` sin darle identidad acá NO COMPILA. La prueba lo verifica
 * también, pero el error a tiempo lo da el compilador.
 */
export const IDENTIDADES: Record<TipoNegocioId, EntradaIdentidad> = {
  // --- Belleza y bienestar ---
  barberia: {
    acento: "naranja",
    icono: "IconPosteBarbero",
    descripcion: "Cortes y barba por silla, con el barbero que el cliente ya conoce.",
  },
  salon_belleza: {
    acento: "violeta",
    icono: "IconTijeras",
    descripcion: "Color, corte y tratamientos: servicios largos y estilistas con agenda propia.",
  },
  unas: {
    acento: "rosa",
    icono: "IconEsmalte",
    descripcion: "Manicure y pedicure por cita, con trabajos que se repiten cada pocas semanas.",
  },
  spa: {
    acento: "aguamarina",
    icono: "IconLoto",
    descripcion: "Faciales, cabinas y paquetes de bienestar con tiempos de preparación.",
  },
  masajes: {
    acento: "aguamarina",
    icono: "IconHoja",
    descripcion: "Terapias por sesión, casi siempre con una sola persona atendiendo.",
  },

  // --- Salud y profesionales ---
  // El único par donde el vocabulario cambia de raíz: un consultorio
  // tiene pacientes y consultas, y llamarles "clientes" a los pacientes
  // es el error que hace que el panel se sienta ajeno.
  consultorio: {
    acento: "verde",
    icono: "IconEstetoscopio",
    descripcion: "Consultas por paciente, con historial y seguimiento entre una visita y otra.",
    persona: ["paciente", "pacientes"],
    visita: ["consulta", "consultas"],
  },
  // "Profesional independiente" NO es salud: abogados, contadores,
  // arquitectos. Por eso conserva cliente/cita — meterle "paciente"
  // sería el mismo error al revés.
  profesional: {
    acento: "azul",
    icono: "IconClipboard",
    descripcion: "Citas de asesoría o consultoría, con una sola persona al frente.",
  },

  // --- Fitness y estudios ---
  // Quien entrena es MIEMBRO, no cliente: no compra una vez, pertenece
  // — y esa es justo la diferencia que el panel tiene que reflejar.
  gimnasio: {
    acento: "carmesi",
    icono: "IconHeart",
    descripcion: "Membresías, clases y entrada diaria más que agenda uno a uno.",
    persona: ["miembro", "miembros"],
    visita: ["sesión", "sesiones"],
  },
  crossfit: {
    acento: "carmesi",
    icono: "IconStopwatch",
    descripcion: "Clases por cupo y hora fija, con bonos que el miembro va gastando.",
    persona: ["miembro", "miembros"],
    visita: ["sesión", "sesiones"],
  },
  pilates: {
    acento: "violeta",
    icono: "IconLoto",
    descripcion: "Clases de grupo chico donde el equipo de la sala limita el cupo.",
    persona: ["miembro", "miembros"],
    visita: ["sesión", "sesiones"],
  },
  yoga: {
    acento: "violeta",
    icono: "IconLoto",
    descripcion: "Clases abiertas con bonos y membresías, más que reservas sueltas.",
    persona: ["miembro", "miembros"],
    visita: ["sesión", "sesiones"],
  },
  entrenador: {
    acento: "carmesi",
    icono: "IconUserCircle",
    descripcion: "Sesiones uno a uno vendidas por paquete, sin recepción de por medio.",
    visita: ["sesión", "sesiones"],
  },
  academia: {
    acento: "azul",
    icono: "IconPlannerCheck",
    descripcion: "Cursos por ciclo con grupos fijos y matrícula, no citas sueltas.",
    persona: ["alumno", "alumnos"],
    visita: ["clase", "clases"],
  },

  // --- Las verticales que ya existían ---
  eventos_lugar: {
    acento: "naranja",
    icono: "IconRancho",
    descripcion: "Se alquila la fecha completa, con depósito y calendario por día.",
  },
  eventos_proveedor: {
    acento: "naranja",
    icono: "IconCelebrate",
    descripcion: "Servicios para eventos por horas: dos fiestas distintas el mismo día.",
  },
  hospedaje: {
    acento: "azul",
    icono: "IconHouse",
    descripcion: "Estadías por noche, con entrada y salida en vez de hora de cita.",
    persona: ["huésped", "huéspedes"],
  },
  restaurante: {
    acento: "naranja",
    icono: "IconUtensils",
    descripcion: "Reservas de mesa por turno, atadas a la capacidad del salón.",
    persona: ["comensal", "comensales"],
  },

  // El neutro. También es lo que devuelve `identidadDe` ante un tipo que
  // el código no conoce, para que una fila rara en la base no deje al
  // dueño con un panel sin color ni palabras.
  otro: {
    acento: "navy",
    icono: "IconStore",
    descripcion: "El panel base de Bookea, sin suposiciones sobre el rubro.",
  },
};

// ------------------------------------------------------------
// La resolución
// ------------------------------------------------------------

export type IdentidadNegocio = {
  /** El tipo que se resolvió (`"otro"` si no se reconoció el que llegó). */
  tipo: TipoNegocioId;
  /** `false` cuando se cayó al neutro: sirve para no prometer identidad. */
  reconocido: boolean;
  acentoId: AcentoId;
  acento: Acento;
  icono: IconoIdentidad;
  descripcion: string;
  vocabulario: Vocabulario;
};

/**
 * Las identidades ya armadas se guardan para devolver SIEMPRE el mismo
 * objeto: el panel las mete en dependencias de efectos y memos, y un
 * objeto nuevo en cada render vuelve inútil cualquier comparación.
 *
 * La clave lleva `reconocido` porque "otro" tiene dos versiones: la del
 * negocio que eligió "Otro" a propósito y la del tipo que no supimos leer.
 */
const cache = new Map<string, IdentidadNegocio>();

/**
 * La identidad de un tipo de negocio. SIEMPRE devuelve algo.
 *
 * Acepta `string | null | undefined` en vez de `TipoNegocioId` porque lo
 * que llega de verdad es `ranchos.tipo_negocio`, que hoy está en NULL
 * para todos los negocios de citas aprobados y mañana puede traer un
 * valor que este deploy todavía no conoce. Un panel que se cae por eso
 * sería un panel roto por una columna vacía.
 *
 * Ojo: acá NO se deriva el tipo de (vertical, categoria) — eso es trabajo
 * de `tipoNegocioEfectivo`. Lo normal es encadenarlos:
 *
 *     identidadDe(tipoNegocioEfectivo(vertical, categoria, tipo_negocio))
 *
 * así el negocio sin `tipo_negocio` igual recibe la identidad de su
 * categoría en vez del neutro.
 */
export function identidadDe(tipo: string | null | undefined): IdentidadNegocio {
  const resuelto: TipoNegocioId = typeof tipo === "string" && esTipoNegocio(tipo) ? tipo : "otro";
  const reconocido = resuelto !== "otro" || tipo === "otro";

  const clave = `${resuelto}:${reconocido}`;
  const guardada = cache.get(clave);
  if (guardada) return guardada;

  const entrada = IDENTIDADES[resuelto];
  const heredada = palabraReserva(resuelto);

  const identidad: IdentidadNegocio = {
    tipo: resuelto,
    reconocido,
    acentoId: entrada.acento,
    acento: ACENTOS[entrada.acento],
    icono: entrada.icono,
    descripcion: entrada.descripcion,
    vocabulario: {
      persona: termino(entrada.persona ?? CLIENTE),
      visita: termino(entrada.visita ?? [heredada.singular, heredada.plural]),
    },
  };

  cache.set(clave, identidad);
  return identidad;
}

/**
 * El acento como variables CSS, para pintarlo una sola vez en el
 * contenedor del panel y que todo lo de adentro lo herede:
 *
 *     <div style={variablesAcento(identidad)}> … </div>
 *     .boton { background: var(--acento-solido); color: var(--acento-sobre); }
 *
 * Devuelve un `Record<string, string>` y no `CSSProperties` para que este
 * módulo no tenga que importar tipos de React y pueda seguir corriendo
 * en el servidor sin arrastrar nada.
 */
export function variablesAcento(identidad: IdentidadNegocio): Record<string, string> {
  return {
    "--acento": identidad.acento.tinta,
    "--acento-solido": identidad.acento.solido,
    "--acento-sobre": identidad.acento.sobreSolido,
    "--acento-suave": identidad.acento.suave,
  };
}
