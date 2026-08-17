import { iniciales } from "@/lib/iniciales";

/**
 * LO QUE LA API DEVUELVE — y, sobre todo, lo que NO.
 *
 * Estos serializadores son la única puerta por la que sale un JSON de
 * la API de Lealtad. Se escriben campo por campo, a mano, y JAMÁS
 * derramando una fila de la base con `...fila`: el día que alguien
 * agregue una columna `telefono` a `miembros`, un spread la publicaría
 * sin que nadie lo decida.
 *
 * ------------------------------------------------------------------
 * EL PRINCIPIO QUE MANDA
 * ------------------------------------------------------------------
 * La API no devuelve un dato personal directo. Nunca, en ninguna
 * versión, con ningún scope. `clientes_negocio.notas`,
 * `personas.telefono`, `personas.correo`, `personas.ip_alta`,
 * `personas.user_agent_alta`, `perfiles.nombre` y
 * `pases_wallet.auth_token` no están detrás de un permiso: NO EXISTEN
 * en ningún serializador de este archivo.
 *
 * La gente cuyos datos están en juego no es usuaria de Bookea. Le dio
 * su nombre y su teléfono a la barbería de la esquina. En Costa Rica
 * eso cae bajo la Ley 8968 y una filtración acá es responsabilidad del
 * negocio Y de Bookea. Este repo ya filtró SINPE y cuenta bancaria dos
 * veces por un `select("*")` (src/lib/ranchos-publicos.ts:36-52).
 *
 * ------------------------------------------------------------------
 * LA ÚNICA EXCEPCIÓN, Y POR QUÉ ES UNA EXCEPCIÓN Y NO UNA GRIETA
 * ------------------------------------------------------------------
 * `iniciales` ("M.R.") es el único campo derivado de un nombre. Su
 * función es que el cajero no selle la tarjeta equivocada — o sea que
 * protege al cliente, no al integrador. Aun así es decisión del dueño
 * (`autorizaciones_api.mostrar_iniciales`) y se puede apagar.
 * `nombre`, `nombre_corto` y `nombre_pila` NO: dos letras no
 * reidentifican a nadie, un nombre de pila en un pueblo sí.
 */

/** Los nombres de campo que NUNCA pueden aparecer en una respuesta. */
export const CAMPOS_PROHIBIDOS = [
  "nombre",
  "nombre_corto",
  "nombre_pila",
  "apellidos",
  "telefono",
  "celular",
  "correo",
  "email",
  "cedula",
  "direccion",
  "notas",
  "etiquetas",
  "ip",
  "ip_alta",
  "user_agent",
  "user_agent_alta",
  "auth_token",
  "authtoken",
  "token",
  "secreto",
  "secreto_hash",
  "pepper",
  "pepper_ref",
  "miembro_id",
  "cliente_id",
  "usuario_id",
  "owner_id",
  "rancho_id",
  "serial_number",
  "fecha_nacimiento",
  "cumpleanos",
] as const;

/**
 * Recorre un objeto ya serializado y devuelve los campos prohibidos que
 * encuentre, en cualquier nivel.
 *
 * No es paranoia decorativa: es el candado que hace que agregar un
 * campo nuevo a una respuesta sea una decisión CONSCIENTE. Un
 * serializador que empiece a devolver `telefono` rompe el test antes de
 * llegar a producción, y en producción rompe la respuesta antes de
 * llegar al integrador.
 *
 * `nombre` está en la lista aunque `/yo` devuelva el nombre del
 * PROGRAMA y el del NEGOCIO, que no son datos personales: por eso ese
 * serializador los llama `programa` y `negocio`, no `nombre`. Prefiero
 * un campo con un nombre un poco más largo que una lista de excepciones
 * que se va llenando hasta no filtrar nada.
 */
export function camposProhibidos(valor: unknown, ruta = ""): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) => camposProhibidos(v, `${ruta}[${i}]`));
  }
  if (typeof valor !== "object" || valor === null) return [];

  const hallazgos: string[] = [];
  for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
    const aqui = ruta ? `${ruta}.${clave}` : clave;
    if ((CAMPOS_PROHIBIDOS as readonly string[]).includes(clave.toLowerCase())) {
      hallazgos.push(aqui);
    }
    hallazgos.push(...camposProhibidos(contenido, aqui));
  }
  return hallazgos;
}

/**
 * Ids opacos y con prefijo: se leen de un log sin adivinar de qué son.
 *
 * Queda un solo prefijo vivo (`mv`, el movimiento del ledger). `pg` (el
 * programa) y `rw` (la recompensa) se fueron con `/programa` y
 * `/recompensas`; el tipo se recorta con ellos para que nadie los
 * reintroduzca sin pensar.
 */
export function idPublico(prefijo: "mv", uuid: string): string {
  return `${prefijo}_${uuid.replaceAll("-", "")}`;
}

/**
 * Las dos letras. `iniciales()` ya vive en lib y la usan los avatares
 * de los dos lados de la frontera; acá se reusa en vez de escribir una
 * segunda versión que se desincronice.
 */
export function inicialesPublicas(nombre: string | null, mostrar: boolean): string | null {
  if (!mostrar) return null;
  const letras = iniciales((nombre ?? "").trim());
  if (!letras) return null;
  return letras.split("").join(".") + ".";
}

// ── /saldo ───────────────────────────────────────────────────────────

export type DatosSaldo = {
  ref: string;
  nombre: string | null;
  mostrarIniciales: boolean;
  meta: number | null;
  saldo: number;
  requestId: string;
};

/**
 * LA RESPUESTA MÁS DELICADA DE LA API, RECORTADA A LO PROMETIDO.
 *
 * ------------------------------------------------------------------
 * LO QUE EL DUEÑO LEYÓ AL AUTORIZAR EL SCOPE `saldo`
 * ------------------------------------------------------------------
 * «Consultar la tarjeta que le presenten — Saldo, meta y dos letras del
 * nombre.» (acuerdo.ts, SCOPES_ENTREGA_1). Eso es exactamente lo que sale y
 * nada más: `saldo`, `meta` (con sus dos derivados aritméticos `faltan`
 * y `premio_listo`), `iniciales` y el `ref` con el que se opera.
 *
 * ------------------------------------------------------------------
 * LO QUE SE FUE, Y POR QUÉ NO VUELVE
 * ------------------------------------------------------------------
 * · `programa` (con sus `reglas`: compra mínima, topes, puntos por
 *   colón) y `recompensas_alcanzables` (el catálogo completo, con
 *   `sku`). Viajaban acá SIN pedir el scope `catalogo` que los protegía
 *   en `/programa` y `/recompensas`, o sea que un dueño que desmarcó
 *   «Ver el programa y sus recompensas» se los entregaba lo mismo con
 *   la primera tarjeta que le presentaran. El arreglo terminó siendo
 *   más simple que el candado: la API se acotó al caso de uso del pase,
 *   los dos endpoints se borraron y el scope dejó de existir. Un
 *   permiso menos que hacer cumplir en dos lugares es mejor que un
 *   permiso bien hecho cumplir.
 * · `estado` (activa/pausada/cancelada de la MEMBRESÍA). La pantalla no
 *   lo nombra en ningún lado, y era un oráculo: con una base de `ref`
 *   robada al integrador se leía quién se dio de baja del programa de
 *   la barbería. Las canceladas ya no contestan (datos.ts) y las
 *   pausadas no anuncian que lo están.
 * · `sellado_hoy`. Era el único campo derivado del LIBRO MAYOR de una
 *   persona, y tampoco está en lo que el dueño leyó. Su función
 *   operativa —que no se selle dos veces— ya la cumple el tope diario
 *   del programa, que `api_lealtad_autorizar` (0176) EXIGE configurado
 *   antes de conceder `acreditar`, y que devuelve 422 con el motivo
 *   textual para que el cajero se lo lea al cliente.
 *
 * `meta` SÍ sale aunque se derive del catálogo (es el `costo_puntos` de
 * la recompensa más barata): es un número suelto, es literalmente lo
 * que la pantalla nombra, y sin él «faltan 3 para el premio» —el 90 %
 * de lo que el cajero le dice al cliente— sería imposible.
 *
 * Y no se arregla «nombrándolos en la pantalla»: las autorizaciones ya
 * concedidas se firmaron contra el texto de hoy. Ampliar el texto no
 * le vuelve a preguntar a nadie.
 */
export function serializarSaldo(datos: DatosSaldo) {
  const { meta, saldo } = datos;
  return {
    ref: datos.ref,
    iniciales: inicialesPublicas(datos.nombre, datos.mostrarIniciales),
    saldo,
    meta,
    faltan: meta === null ? null : Math.max(0, meta - saldo),
    premio_listo: meta !== null && saldo >= meta,
    request_id: datos.requestId,
  };
}

// ── /acreditaciones ──────────────────────────────────────────────────

export type DatosAcreditacion = {
  id: string;
  otorgado: boolean;
  duplicada: boolean;
  puntosOtorgados: number;
  saldoAnterior: number;
  saldoPosterior: number;
  meta: number | null;
  motivo: string;
  creadoEn: string;
  requestId: string;
};

/**
 * La respuesta de una acreditación: CERO datos personales, ni uno.
 *
 * Ni el `ref` vuelve — el POS ya lo tiene, y no repetirlo es un lugar
 * menos donde queda escrito en los logs del integrador.
 */
export function serializarAcreditacion(datos: DatosAcreditacion) {
  const { meta, saldoPosterior } = datos;
  return {
    id: idPublico("mv", datos.id),
    otorgado: datos.otorgado,
    duplicada: datos.duplicada,
    puntos_otorgados: datos.puntosOtorgados,
    saldo_anterior: datos.saldoAnterior,
    saldo_posterior: saldoPosterior,
    meta,
    faltan: meta === null ? null : Math.max(0, meta - saldoPosterior),
    alcanzo_meta: meta !== null && saldoPosterior >= meta,
    motivo: datos.motivo,
    creado_en: datos.creadoEn,
    request_id: datos.requestId,
  };
}

// ── /yo ──────────────────────────────────────────────────────────────

export function serializarYo(datos: {
  desarrollador: string;
  entorno: string;
  scopes: string[];
  negocio: string;
  programa: string;
  expiraEn: string;
  requestId: string;
}) {
  return {
    // Quién SOY yo (el integrador) y a qué me dejaron entrar. Nada de
    // esto es de un tercero: es la propia credencial mirándose al
    // espejo.
    aplicacion: datos.desarrollador,
    entorno: datos.entorno,
    scopes: datos.scopes,
    negocio: datos.negocio,
    programa: datos.programa,
    llave_expira_en: datos.expiraEn,
    request_id: datos.requestId,
  };
}
