/**
 * ═══════════════════════════════════════════════════════════════════
 *  QUIÉN ES EL MIEMBRO — de dónde sale el nombre, el correo y el tel
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── EL BUG QUE ESTE MÓDULO CIERRA ───────────────────────────────────
 *
 * La sección Clientes del panel decía «Cliente» en todas las fichas. No
 * porque faltaran los datos: porque los buscaba donde ya no están.
 *
 * Hasta la 0138 la identidad de un miembro era su CUENTA de Bookea
 * (`miembros.cliente_id` → `perfiles.nombre`). La 0138 movió la raíz a
 * `personas` —correo y teléfono como llave, la cuenta como
 * enriquecimiento opcional— y desde entonces `cliente_id` es NULL para
 * todo el que se afilió escaneando el póster, que es la mayoría. El
 * panel seguía preguntándole a `perfiles`, no encontraba fila, y caía al
 * literal «Cliente».
 *
 * Caso real de producción: la persona tenía nombre «Melissa», correo y
 * WhatsApp guardados en `personas`, cero filas en `perfiles`, y la
 * pantalla mostraba «Cliente».
 *
 * ── DE DÓNDE SALE CADA DATO, Y EN QUÉ ORDEN ─────────────────────────
 *
 * Se resuelve CAMPO POR CAMPO, no «la primera tabla que tenga algo»:
 * una persona puede tener el nombre en un lado y el teléfono en otro, y
 * elegir una tabla entera tiraría la mitad de lo que sí se sabe.
 *
 *   1. `personas` — la identidad raíz (0138). Manda porque es la única
 *      que la plataforma garantiza: `miembros.persona_id` es `not null`
 *      y el RPC del alta la escribe siempre.
 *
 *   2. `clientes_negocio` — la ficha de CRM de ESTE negocio (0109).
 *      Aporta de verdad y por eso está: `resolver_persona` «enriquece
 *      pero no pisa» (0138:905), así que un dato que llega DESPUÉS del
 *      alta —el dueño teclea el nombre de la señora que solo dejó el
 *      teléfono— se queda en la ficha del negocio y nunca sube a
 *      `personas`. Sin este escalón ese nombre no se vería nunca.
 *
 *   3. `perfiles` — el respaldo LEGADO. Sigue acá y no se borra por dos
 *      casos: las membresías anteriores a la 0138, cuyo nombre puede
 *      vivir solo ahí, y las bases donde la 0138 todavía no se pegó (el
 *      dueño las corre a mano, y hay ventanas de código nuevo con base
 *      vieja). El día que ninguna de las dos exista, este escalón se
 *      puede sacar sin tocar nada más.
 *
 * ── LO QUE NO ENTRA ACÁ: `clientes_negocio.notas` ───────────────────
 *
 * A propósito y con nombre y apellido. La 0138 lo deja escrito
 * (0138:281): son notas libres del dueño y «con tipos de negocio como
 * consultorio pueden traer datos de salud». Este módulo ni siquiera
 * recibe el campo, para que no se pueda pintar por descuido — quien lo
 * quiera en pantalla que lo pida y que sea una decisión, no un `select`
 * que se estiró.
 *
 * ── FUNCIONES PURAS ─────────────────────────────────────────────────
 *
 * Nada de esto toca la base: recibe las tres filas ya leídas y decide.
 * Así se prueba entero sin Supabase, que es donde vive el riesgo real
 * (el orden de precedencia y el caso sin datos).
 */

/** Una fila cualquiera de las tres que pueden saber quién es alguien. */
export type FuenteDeIdentidad = {
  nombre?: string | null;
  correo?: string | null;
  telefono?: string | null;
} | null;

/** Lo que se sabe de la persona, ya resuelto. `null` = nadie lo dio. */
export type IdentidadCliente = {
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
};

/** Vacío no es un dato: «   » y «» son lo mismo que no haber contestado. */
function limpio(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  return v === "" ? null : v;
}

/**
 * El primer valor de verdad, en orden de confianza. `coalesce` a mano
 * porque en JavaScript `??` no salta el string vacío, y un `nombre: ""`
 * guardado por una importación vieja taparía el nombre bueno de la
 * fuente siguiente.
 */
function primero(...valores: (string | null | undefined)[]): string | null {
  for (const v of valores) {
    const l = limpio(v);
    if (l !== null) return l;
  }
  return null;
}

/**
 * Quién es esta persona, juntando las tres fuentes.
 *
 * El orden está arriba. Se aplica por campo: si `personas` tiene el
 * correo pero el nombre lo tiene solo la ficha del negocio, salen los
 * dos.
 */
export function resolverIdentidad(fuentes: {
  /** `personas` (0138), por `miembros.persona_id`. La raíz. */
  persona?: FuenteDeIdentidad;
  /** `clientes_negocio` (0109) de ESTE negocio, por `persona_id`. */
  ficha?: FuenteDeIdentidad;
  /** `perfiles`, por `miembros.cliente_id`. Respaldo legado. */
  perfil?: FuenteDeIdentidad;
}): IdentidadCliente {
  const { persona, ficha, perfil } = fuentes;
  return {
    nombre: primero(persona?.nombre, ficha?.nombre, perfil?.nombre),
    correo: primero(persona?.correo, ficha?.correo, perfil?.correo),
    telefono: primero(persona?.telefono, ficha?.telefono, perfil?.telefono),
  };
}

// ── Cómo se pinta ───────────────────────────────────────────────────

/**
 * QUÉ SE MUESTRA CUANDO NO HAY NADA.
 *
 * «Cliente» a secas era lo que había, y es lo peor de los dos mundos:
 * no dice quién es y tampoco dice por qué no se sabe. El dueño lo leyó
 * como una falla del sistema —lo reportó como tal— cuando en la mayoría
 * de los casos era un dato que sí existía y se estaba buscando mal.
 *
 * Ahora dice lo que pasó de verdad, y sin acusar a nadie: agregar la
 * tarjeta sin dejar los datos es legítimo (el nombre es opcional en el
 * alta, y hubo un camino —ya cerrado— que ni siquiera preguntaba).
 */
export const SIN_DATOS = "Cliente sin datos";

export type FichaVisible = {
  /** El renglón grande. Nunca vacío. */
  titulo: string;
  /** true = no hay nombre; el título es un correo, un teléfono o el
   *  texto de «todavía no dio sus datos». Sirve para pintarlo distinto
   *  y para no decir «Listo, +1 sellos para melissa@gmail.com». */
  sinNombre: boolean;
  /** Los renglones chicos de abajo. Puede venir vacío. */
  contacto: string[];
};

/**
 * De lo que se sabe a lo que se lee.
 *
 * El nombre manda; si no hay, sube el correo (identifica de verdad) y
 * si tampoco, el teléfono. Lo que subió al título NO se repite abajo:
 * el mismo correo dos veces en la misma ficha se lee como un error.
 *
 * `alta` y `pase` no son decoración: son los únicos datos que existen
 * de alguien que no dejó ninguno, y son los que le permiten al dueño
 * distinguir dos fichas vacías y saber de cuándo viene cada una.
 */
export function fichaVisible(
  identidad: IdentidadCliente,
  contexto?: {
    /** ISO del `miembros.created_at`. */
    alta?: string | null;
    /** `pases_wallet.plataforma` — 'apple' | 'google'. */
    pase?: string | null;
    /** `miembros.id`, para el número corto que desempata dos vacías. */
    miembroId?: string | null;
  },
): FichaVisible {
  const { nombre, correo, telefono } = identidad;

  if (nombre) {
    return { titulo: nombre, sinNombre: false, contacto: [correo, telefono].filter(esTexto) };
  }
  if (correo) {
    return { titulo: correo, sinNombre: true, contacto: [telefono].filter(esTexto) };
  }
  if (telefono) {
    return { titulo: telefono, sinNombre: true, contacto: [] };
  }

  return {
    titulo: SIN_DATOS,
    sinNombre: true,
    contacto: [explicarVacia(contexto)],
  };
}

function esTexto(v: string | null): v is string {
  return typeof v === "string" && v !== "";
}

/** Fecha corta en hora de Costa Rica: «17 ago». */
const DIA_CR = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Costa_Rica",
});

const NOMBRE_PLATAFORMA: Record<string, string> = {
  apple: "Apple Wallet",
  google: "Google Wallet",
};

/**
 * La frase de la ficha vacía. Se arma con lo que SÍ hay para que no sea
 * un cartel genérico: cuándo se afilió, desde qué Wallet, y un número
 * corto para poder decir «el 7820» y que las dos fichas vacías del mismo
 * día no sean la misma cosa en pantalla.
 */
function explicarVacia(contexto?: {
  alta?: string | null;
  pase?: string | null;
  miembroId?: string | null;
}): string {
  const partes: string[] = ["Todavía no dejó su nombre ni su contacto"];

  const alta = limpio(contexto?.alta);
  if (alta) {
    const fecha = new Date(alta);
    if (!Number.isNaN(fecha.getTime())) partes.push(`se afilió el ${DIA_CR.format(fecha)}`);
  }

  const plataforma = NOMBRE_PLATAFORMA[(contexto?.pase ?? "").toLowerCase()];
  if (plataforma) partes.push(`tarjeta en ${plataforma}`);

  const corto = numeroCorto(contexto?.miembroId);
  if (corto) partes.push(`nº ${corto}`);

  return partes.join(" · ");
}

/**
 * Los últimos cuatro caracteres del id. No es un secreto (el id ya viaja
 * al navegador en cada botón de esta lista) y es lo mínimo que desempata
 * dos fichas sin nombre sin llenar la pantalla de un UUID.
 */
export function numeroCorto(id: string | null | undefined): string | null {
  const limpioId = (id ?? "").replace(/-/g, "");
  return limpioId.length >= 4 ? limpioId.slice(-4).toUpperCase() : null;
}
