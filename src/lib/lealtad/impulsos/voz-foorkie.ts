import { definicionDeActivador, definicionDeCanal, type DefinicionActivador, type DefinicionCanal } from "./catalogo";
import type { IdActivador, IdCanal } from "./tipos";

/**
 * LA VOZ DE FOORKIE.
 *
 * Los impulsos automáticos los maneja el dueño desde dos paneles: el de Bookea (el motor) y el de Foorkie
 * Lealtad (donde un restaurante de Foorkie nunca ve la palabra «Bookea»: para él, Bookea es el motor que no
 * se ve). El catálogo, las validaciones y los motivos están escritos en la voz de Bookea; este módulo dice
 * qué textos cambian cuando quien mira es un restaurante de Foorkie.
 *
 * Módulo PURO, sin servidor. Reglas:
 *
 *   · El valor por defecto es `"bookea"` y con él NADA cambia: cada función devuelve lo mismo que sin la voz
 *     (el panel de Bookea no se entera de que esto existe).
 *   · Los reemplazos van POR ID (por activador, canal, motivo), nunca con una expresión regular sobre el
 *     texto: un cambio en el catálogo no puede dejar un «Bookea» colado ni romper una frase por azar.
 *   · Lo que no figura acá se muestra igual en las dos voces. La prueba `voz-foorkie.test.ts` recorre todo
 *     lo que sale a Foorkie y falla si alguna frase nombra a Bookea.
 */

export type Voz = "bookea" | "foorkie";

// ═══════════════════════════════════════════════════════════════════
//  ACTIVADORES
// ═══════════════════════════════════════════════════════════════════

type CambiosDeActivador = Partial<Pick<DefinicionActivador, "nota" | "noDisponible">>;

const ACTIVADORES_FOORKIE: Partial<Record<IdActivador, CambiosDeActivador>> = {
  pase_apple: {
    nota: "Confirmado: el iPhone avisa cuando se guarda el pase. Se dispara una sola vez por cliente.",
  },
  cumpleanos: {
    noDisponible:
      "El saludo de cumpleaños se arma en Clientes → Campaña de cumpleaños de Foorkie Lealtad (por correo, con su regalo).",
  },
  vencimiento_proximo: {
    noDisponible:
      "Foorkie Lealtad ya avisa solo antes de que venzan los sellos o el saldo (Reglas de la tarjeta → Vencimiento). " +
      "Se deja ahí para no mandarle dos veces el mismo mensaje.",
  },
  nivel_alcanzado: {
    noDisponible: "Las tarjetas de Foorkie Lealtad no tienen niveles de cliente, así que no hay un nivel que alcanzar.",
  },
};

/** El activador tal como lo ve quien mira con esa voz. Con `"bookea"` devuelve el mismo objeto. */
export function activadorEnVoz(def: DefinicionActivador, voz: Voz = "bookea"): DefinicionActivador {
  if (voz === "bookea") return def;
  const cambios = ACTIVADORES_FOORKIE[def.id];
  return cambios ? { ...def, ...cambios } : def;
}

export function definicionDeActivadorEnVoz(id: string, voz: Voz = "bookea"): DefinicionActivador | null {
  const def = definicionDeActivador(id);
  return def ? activadorEnVoz(def, voz) : null;
}

// ═══════════════════════════════════════════════════════════════════
//  CANALES
// ═══════════════════════════════════════════════════════════════════

type CambiosDeCanal = {
  disponible?: boolean;
  falta?: string;
  /** Reemplaza la lista entera. */
  limites?: readonly string[];
  /** Reemplaza solo esas posiciones de la lista (el resto queda como está). */
  limitesPorPosicion?: Readonly<Record<number, string>>;
};

const FALTA_CORREO_FOORKIE =
  "Los correos de los impulsos todavía no salen desde Foorkie Lealtad. " +
  "Por ahora usá el Wallet; el saludo de cumpleaños por correo ya existe en Clientes.";

const CANALES_FOORKIE: Partial<Record<IdCanal, CambiosDeCanal>> = {
  wallet: {
    limitesPorPosicion: {
      2: "Apple Wallet: el mensaje individual se muestra en el reverso del pase, en una sola línea.",
    },
  },
  correo: {
    // Desde Foorkie el correo no sale: se muestra apagado con el porqué (los avisos por correo de Foorkie
    // Lealtad los arma Foorkie con su propia campaña, no los impulsos).
    disponible: false,
    falta: FALTA_CORREO_FOORKIE,
    limites: ["Cuando esté disponible, solo se enviará a quien aceptó recibir correos de este negocio."],
  },
  sms: {
    falta: "No hay un proveedor de SMS integrado (por ejemplo Twilio) ni el permiso de los clientes para este canal.",
  },
  whatsapp: {
    falta:
      "No hay integración con la API de WhatsApp Business (cuenta verificada, número y plantillas aprobadas por Meta). " +
      "Los enlaces wa.me abren un chat a mano, no envían mensajes.",
  },
  push_web: {
    falta: "Las notificaciones en el navegador todavía no están disponibles: no hay service worker ni claves VAPID.",
  },
};

/** El canal tal como lo ve quien mira con esa voz. Con `"bookea"` devuelve el mismo objeto. */
export function canalEnVoz(def: DefinicionCanal, voz: Voz = "bookea"): DefinicionCanal {
  if (voz === "bookea") return def;
  const c = CANALES_FOORKIE[def.id];
  if (!c) return def;
  const limites = c.limites ?? (c.limitesPorPosicion ? def.limites.map((l, i) => c.limitesPorPosicion?.[i] ?? l) : def.limites);
  return {
    ...def,
    ...(c.disponible !== undefined ? { disponible: c.disponible } : {}),
    ...(c.falta !== undefined ? { falta: c.falta } : {}),
    limites,
  };
}

export function definicionDeCanalEnVoz(id: string, voz: Voz = "bookea"): DefinicionCanal | null {
  const def = definicionDeCanal(id);
  return def ? canalEnVoz(def, voz) : null;
}

// ═══════════════════════════════════════════════════════════════════
//  MOTIVOS DE LAS TAREAS
// ═══════════════════════════════════════════════════════════════════

/** Los códigos de motivo cuyo texto cambia en la voz de Foorkie (los demás se leen igual). */
export const MOTIVOS_FOORKIE: Readonly<Record<string, string>> = {
  sin_canal_individual: "Solo tiene Apple Wallet y no se pudo avisar a su iPhone.",
  correo_lo_manda_foorkie: "Los correos de los impulsos todavía no salen desde Foorkie Lealtad.",
};

// ═══════════════════════════════════════════════════════════════════
//  MENSAJES DE LA VALIDACIÓN Y DEL SERVICIO
// ═══════════════════════════════════════════════════════════════════

export const TEXTOS = {
  bookea: {
    sinRecompensa: "Esta tarjeta todavía no tiene una recompensa activa. Creala primero en Recompensas.",
    correoDeFoorkie: "Las tarjetas de Foorkie no envían correos desde acá: los manda Foorkie. Usá el Wallet.",
    reemplazaCorreo:
      "Mientras este impulso esté activo, reemplaza al correo automático que Bookea ya manda en ese mismo momento: tus clientes recibirán este y no los dos.",
    sinMigracion:
      "Falta correr la migración 0254 en Supabase: todavía no existen las tablas de los impulsos automáticos.",
  },
  foorkie: {
    sinRecompensa: "Esta tarjeta todavía no tiene una recompensa activa. Creala primero en Premios.",
    correoDeFoorkie: "Los correos de los impulsos todavía no salen desde Foorkie Lealtad. Usá el Wallet.",
    reemplazaCorreo:
      "Mientras este impulso esté activo, reemplaza al correo automático que ya sale en ese mismo momento: tus clientes recibirán este y no los dos.",
    sinMigracion:
      "Los impulsos automáticos todavía no están disponibles: falta terminar su instalación en el servidor (migración 0254).",
  },
} as const satisfies Record<Voz, Record<string, string>>;

export function textosDe(voz: Voz = "bookea") {
  return TEXTOS[voz];
}
