import { createHash, randomBytes } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { personasActivasDe } from "@/lib/lealtad/cupo";
import {
  resolverIdentidad,
  type FuenteDeIdentidad,
  type IdentidadCliente,
} from "@/lib/lealtad/identidad-miembro";

/**
 * EL ALTA DE DOS CAMPOS — WhatsApp y correo, y ya.
 *
 * ------------------------------------------------------------------
 * QUÉ PASABA ANTES
 * ------------------------------------------------------------------
 * El cliente parado en la barbería escaneaba el póster y la página le
 * pedía iniciar sesión en Bookea: escribir el correo, SALIR de la
 * página a buscar un código de 6 dígitos en su buzón, volver, tipear el
 * código, tipear el nombre, y recién ahí aparecía el botón del pase.
 * Cinco pantallas y un salto a otra app para llevarse una tarjeta de
 * sellos.
 *
 * La 0138 se escribió para eliminar exactamente esa fricción —trae
 * `alta_persona_por_qr`, que resuelve identidad, deduplicación y
 * consentimiento en UNA transacción— y nadie la llamaba. Este archivo
 * es el llamador que faltaba.
 *
 * ------------------------------------------------------------------
 * LA PERSONA ES GLOBAL, EL PERMISO ES POR NEGOCIO
 * ------------------------------------------------------------------
 * Si la señora ya se afilió en la barbería y hoy escanea el QR de la
 * soda, NO se crea una persona nueva: `resolver_persona` la encuentra
 * por su correo o su teléfono y lo que se crea es el VÍNCULO con la
 * soda (`personas_negocio`). La soda ve a "sus" personas y nada más; el
 * historial de la barbería no se cruza. Ese es todo el modelo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ TODO ESTO CORRE EN EL SERVIDOR
 * ------------------------------------------------------------------
 * `alta_persona_por_qr` y `resolver_persona` están concedidas SOLO a
 * `service_role` (0138:2145 y 0138:961), y a propósito: un RPC de
 * creación de identidad abierto al navegador es a la vez un oráculo
 * para enumerar correos ajenos y una fábrica infinita de filas. Todo lo
 * que toca la base acá recibe el cliente admin de quien llama, que solo
 * existe en el servidor.
 *
 * ------------------------------------------------------------------
 * EL TOPE DEL PAQUETE NO SE SALTA POR ESTA PUERTA
 * ------------------------------------------------------------------
 * `cupo.ts:45-56` dejó escrito el aviso: el día que se conecte el alta
 * por QR, ese llamador tiene que pasar por `personasActivasDe()` ANTES
 * del RPC, o el tope que se cobra se salta entero por la puerta del
 * mostrador. `altaPorQr` lo hace, y con el mismo criterio que las dos
 * puertas de Wallet: se frena la afiliación NUEVA, nunca a alguien que
 * ya es miembro (si no, el cliente 200 de un paquete lleno no podría
 * ni volver a abrir su propia tarjeta).
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// ── 1. Normalización: el MISMO criterio que la base ──────────────────
//
// Estas dos funciones son el espejo en TypeScript de
// `normalizar_correo` y `normalizar_telefono` (0138:93 y 0138:110). Se
// duplican a propósito y con esta nota: la base es la que manda —es la
// que sostiene los índices únicos de deduplicación— y acá se repiten
// solo para poder DECIRLE A LA PERSONA que se equivocó ANTES de mandar
// el formulario. Si alguna vez cambia el criterio, se cambia en los dos
// lados o la pantalla acepta lo que la base va a tirar.

/** Correo en minúsculas y sin espacios, o null si no es un correo. */
export function normalizarCorreo(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").trim().toLowerCase();
  if (limpio === "") return null;
  // `position('@') > 1` en SQL: tiene que haber algo ANTES del arroba.
  if (limpio.indexOf("@") < 1) return null;
  if (/\s/.test(limpio)) return null;
  return limpio;
}

/**
 * Los últimos 8 dígitos del teléfono, o null.
 *
 * El formato local viene de mil maneras ("8888-8888", "+506 8888 8888",
 * "506 8888 8888", "(506) 8888 8888") y el número nacional siempre son
 * 8 dígitos: quedarse con los últimos 8 hace que todas esas formas
 * resuelvan a LA MISMA persona. Menos de 8 dígitos no es un teléfono,
 * es un dedazo.
 */
export function normalizarTelefonoCR(valor: string | null | undefined): string | null {
  const digitos = (valor ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return digitos.slice(-8);
}

// ── 2. Lo que se revisa antes de mandar nada ─────────────────────────

/**
 * El contacto ya normalizado. Los DOS campos pueden venir en null por
 * separado, pero nunca los dos a la vez — eso lo garantiza
 * `revisarAlta`, que es la única que construye este tipo.
 */
export type Contacto = { correo: string | null; telefono: string | null };

/** Lo mínimo que hay que dejar para llevarse una tarjeta. */
export type DatosDelAlta = { nombre: string; contacto: Contacto };

export type CampoDelAlta = "nombre" | "correo" | "whatsapp";

export type RevisionAlta =
  | ({ ok: true } & DatosDelAlta)
  | { ok: false; campo: CampoDelAlta; error: string };

/** Nombre: al menos dos letras, y no más de lo que la base acepta. */
export const LARGO_NOMBRE = { minimo: 2, maximo: 60 } as const;

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL MÍNIMO PARA AFILIARSE: NOMBRE + UN CONTACTO
 * ═══════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño, textual: «necesitamos saber quién se registra».
 * Nadie se lleva una tarjeta de forma anónima. Y el mínimo es
 * exactamente ese, ni más ni menos:
 *
 *   · EL NOMBRE PASA A SER OBLIGATORIO. Era opcional a propósito —para
 *     no sumar fricción en la caja— y el resultado fue una lista de
 *     fichas que decían «Cliente sin datos». Un sello que no se le
 *     puede atribuir a nadie no es control de nada: es un número.
 *
 *   · UN SOLO CONTACTO ALCANZA, y antes se exigían los dos. Con el
 *     WhatsApp O el correo ya se puede contactar a la persona y
 *     deduplicarla (los dos son llave única en `personas`, 0138).
 *     Exigir el segundo sube la fricción sin sumar control — y quien
 *     se sabe solo su número de memoria escribía cualquier cosa en el
 *     campo del correo, que es peor que no tenerlo.
 *
 * Se revisa acá, en la misma pantalla y ANTES de mandar nada, para que
 * un dedazo cueste corregir un campo y no el pase entero. Y se vuelve a
 * revisar en el servidor: esto es cortesía, la puerta está del otro
 * lado (`altaPorQr`).
 */
export function revisarAlta(entrada: {
  nombre?: string | null;
  correo?: string | null;
  telefono?: string | null;
}): RevisionAlta {
  const nombre = (entrada.nombre ?? "").trim().replace(/\s+/g, " ");
  if (nombre.length < LARGO_NOMBRE.minimo) {
    return {
      ok: false,
      campo: "nombre",
      error: "Escribí tu nombre — es con lo que te van a reconocer en el local.",
    };
  }
  if (nombre.length > LARGO_NOMBRE.maximo) {
    return { ok: false, campo: "nombre", error: "Ese nombre es demasiado largo." };
  }

  // Vacío ≠ inválido. Un campo en blanco es "elegí el otro canal"; uno
  // escrito a medias es un dedazo, y ahí sí hay que avisar dónde.
  const dioTelefono = (entrada.telefono ?? "").trim() !== "";
  const dioCorreo = (entrada.correo ?? "").trim() !== "";

  if (!dioTelefono && !dioCorreo) {
    return {
      ok: false,
      campo: "whatsapp",
      error: "Dejanos tu WhatsApp o tu correo — con uno de los dos alcanza.",
    };
  }

  const telefono = dioTelefono ? normalizarTelefonoCR(entrada.telefono) : null;
  if (dioTelefono && !telefono) {
    return {
      ok: false,
      campo: "whatsapp",
      error: "El WhatsApp lleva 8 números — así: 8888 8888.",
    };
  }

  const correo = dioCorreo ? normalizarCorreo(entrada.correo) : null;
  if (dioCorreo && !correo) {
    return {
      ok: false,
      campo: "correo",
      error: "Revisá el correo: se escribe nombre@algo.com.",
    };
  }
  if (correo && correo.length > 160) {
    return { ok: false, campo: "correo", error: "Ese correo es demasiado largo." };
  }

  return { ok: true, nombre, contacto: { correo, telefono } };
}

// ── 3. El consentimiento, escrito como se lee en pantalla ────────────
//
// La 0138 guarda EL TEXTO EXACTO que la persona vio (0138:551): no un
// identificador de versión que mañana apunte a otro copy. Por eso el
// texto se arma acá, en un solo lugar, y el MISMO string va a la
// pantalla y a la fila de prueba. Si se escribieran por separado, la
// prueba diría una cosa y la persona habría leído otra.

export const VERSION_CONSENTIMIENTO = "qr-v1";

/** Los canales sobre los que decide esta casilla. */
export const CANALES_CONSENTIMIENTO = ["whatsapp", "correo"] as const;

/** Lo que la persona lee al lado de la casilla, y lo que se guarda. */
export function textoConsentimientoNegocio(nombreNegocio: string): string {
  const nombre = nombreNegocio.trim() || "este negocio";
  return (
    `Sí, quiero que ${nombre} me avise por WhatsApp o correo de sus ` +
    `promociones y de los premios que voy juntando. Me puedo salir cuando quiera.`
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL CONSENTIMIENTO CUANDO LO TECLEA EL NEGOCIO
 * ═══════════════════════════════════════════════════════════════════
 *
 * Versión aparte —`mostrador-v1`, no `qr-v1`— y con su propio texto, y
 * la distinción es lo importante: el respaldo del QR prueba que LA
 * PERSONA leyó una frase en una pantalla y marcó (o no marcó) una
 * casilla. Este prueba otra cosa, más débil y honesta: que el negocio
 * le preguntó de viva voz y anotó la respuesta.
 *
 * Guardarlos con la misma versión y el mismo texto haría que dentro de
 * un año los dos se lean igual en la tabla, y no lo son. La 0138 guarda
 * el TEXTO EXACTO justamente para que esto se pueda distinguir después
 * (0138:551).
 *
 * Va con `origen = 'mostrador'`, que es uno de los valores que la 0138
 * ya tenía previstos (0138:583).
 */
export const VERSION_CONSENTIMIENTO_MOSTRADOR = "mostrador-v1";

/** Lo que se archiva cuando los datos los tomó el cajero, no la persona. */
export function textoConsentimientoMostrador(nombreNegocio: string): string {
  const nombre = nombreNegocio.trim() || "este negocio";
  return (
    `Los datos de esta persona los tomó ${nombre} en el mostrador y le ` +
    `preguntó de viva voz si quiere que le avisen por WhatsApp o correo de ` +
    `sus promociones y de los premios que va juntando. Se puede salir cuando quiera.`
  );
}

export type CuerpoConsentimientos = {
  version: string;
  canales: readonly string[];
  negocio: { acepta: boolean; texto: string };
};

/**
 * El jsonb que espera `alta_persona_por_qr`.
 *
 * Va el "no acepto" también, no solo el sí: poder demostrar que la
 * casilla se MOSTRÓ y quedó sin marcar vale tanto como poder demostrar
 * que se marcó (0138:2058).
 */
export function cuerpoDeConsentimientos({
  nombreNegocio,
  acepta,
}: {
  nombreNegocio: string;
  acepta: boolean;
}): CuerpoConsentimientos {
  return {
    version: VERSION_CONSENTIMIENTO,
    canales: CANALES_CONSENTIMIENTO,
    negocio: { acepta, texto: textoConsentimientoNegocio(nombreNegocio) },
  };
}

// ── 4. La IP, que acá es PRUEBA y no rate limiting ───────────────────
//
// La 0113 estableció que las IP se guardan como HMAC. Esa regla es para
// CONTAR; en `consentimientos_persona` la IP es la prueba de dónde se
// aceptó, y un HMAC no le sirve a nadie ante un reclamo. Por eso viaja
// en claro hasta la base — donde la columna NO se le concede a
// `authenticated` (grant por columna, 0138:631): el negocio ve que su
// cliente aceptó y qué texto; la IP la ve el servidor.

/** La IP del visitante, o null si el proxy no la dejó legible. */
export function ipDePeticion(cabeceras: Headers): string | null {
  const candidata =
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabeceras.get("x-real-ip")?.trim() ||
    "";
  return ipValida(candidata);
}

/**
 * `inet` de Postgres rechaza cualquier cosa que no sea una IP, y un
 * rechazo tiraría el alta ENTERA por un dato accesorio. Se filtra acá:
 * si no tiene forma de IP, va null.
 */
export function ipValida(valor: string): string | null {
  const v = valor.trim();
  if (v === "") return null;
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(v)) {
    return v.split(".").every((o) => Number(o) <= 255) ? v : null;
  }
  // IPv6: hexadecimal y dos puntos, con el ::1 y los mixtos incluidos.
  if (/^[0-9a-fA-F:]+(\.\d{1,3}){0,3}$/.test(v) && v.includes(":")) return v;
  return null;
}

// ── 5. La cookie que hace que no haya que volver a escribir nada ─────

/**
 * La cookie httpOnly con el token de `sesiones_persona` (0138:1677).
 *
 * Es un secreto de CONVENIENCIA, no de autoridad: sirve para volver a
 * ver la tarjeta y como prueba de "soy la misma que hizo el alta" al
 * re-escanear. Canjear nunca depende de ella.
 */
export const NOMBRE_COOKIE_PERSONA = "bookea_persona";

/** 180 días, los mismos que `sesiones_persona.expira_en` por defecto. */
export const DIAS_COOKIE_PERSONA = 180;

/** El token nunca se guarda: se guarda su sha-256, como todo secreto. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── 6. Las lecturas de identidad ─────────────────────────────────────

/**
 * La persona de una cookie, o null.
 *
 * Nunca lanza: una base sin la 0138 —o un token viejo, revocado o
 * vencido— es "no sé quién sos", no un error 500 en la cara de alguien
 * que está en la fila de la caja.
 */
export async function personaDelToken(db: Admin, token: string | null | undefined) {
  if (!token) return null;
  try {
    const { data, error } = await db.rpc("persona_de_sesion", {
      p_token_hash: hashDeToken(token),
    });
    if (error) return null;
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════
 *  UNA SESIÓN ANÓNIMA NO ES UNA CUENTA DE BOOKEA
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── EL BUG, TAL COMO PASÓ ────────────────────────────────────────────
 *
 * El chat flotante del sitio abre una sesión ANÓNIMA de Supabase para
 * poder escribirle al negocio sin registrarse (`chat-flotante.tsx:533`,
 * `mensajes/consulta/[ranchoId]/page.tsx:36`). Eso crea una fila real en
 * `auth.users`, con `email` VACÍO y sin metadata.
 *
 * Después esa misma persona abre la tarjeta del negocio. `/tarjeta/[slug]`
 * pregunta «¿ya sé quién sos?» con `!!(personaId || clienteId)` y
 * `clienteId` salía de `supabase.auth.getUser()` sin mirar si era
 * anónimo. Con la sesión del chat encima, la respuesta era SÍ:
 *
 *   · el formulario de dos campos —nombre, WhatsApp, correo— NO SE
 *     MOSTRABA. Nunca se le preguntó nada;
 *   · el botón de Wallet afiliaba directo (`/api/pases/[ranchoId]`), y
 *     el trigger de la 0138 resolvía la persona desde `auth.users`:
 *     correo vacío → null, sin `perfiles` → nombre null. Una persona sin
 *     nombre, sin correo y sin teléfono;
 *   · y peor que el nombre: sin fila en `personas_negocio` y sin
 *     `consentimientos_persona`. O sea, sin el vínculo que la 0138
 *     define como EL PERMISO del negocio para ver a esa persona, y sin
 *     el respaldo del consentimiento que exige la Ley 8968.
 *
 * Verificado en producción: dos `auth.users` con email vacío creados el
 * mismo día, dos filas de `personas` con los tres campos en null y
 * `personas_negocio` sin una sola fila para ellas. Son exactamente las
 * fichas que el dueño veía como «Cliente».
 *
 * ── EL ARREGLO ───────────────────────────────────────────────────────
 *
 * La sesión anónima deja de contar como identidad para lealtad. Quien
 * llegue con una vuelve a ver el formulario de dos campos, deja sus
 * datos, firma su consentimiento y queda con vínculo — el camino que la
 * 0138 diseñó y que esta puerta se estaba salteando.
 *
 * No se le quita nada a nadie: el chat sigue funcionando igual, y quien
 * de verdad tiene cuenta de Bookea sigue entrando sin escribir nada.
 */
export function idDeCuentaDeBookea(
  usuario: { id: string; is_anonymous?: boolean } | null | undefined,
): string | null {
  if (!usuario) return null;
  return usuario.is_anonymous ? null : usuario.id;
}

/** La persona de una cuenta de Bookea, si la 0138 ya la enlazó. */
export async function personaDeCuenta(db: Admin, clienteId: string | null | undefined) {
  if (!clienteId) return null;
  const { data } = await db
    .from("personas")
    .select("id")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  return typeof data?.id === "string" ? data.id : null;
}

// ── 6.bis  LA PUERTA: ¿esta afiliación está completa? ────────────────

/** El negocio, por sus dos raíces (0134): la cuenta y/o el rancho. */
export type NegocioDeLealtad = { ranchoId: string | null; cuentaId: string | null };

/** Qué le falta a una afiliación para ser una afiliación de verdad. */
export type FaltaDelAlta =
  /** No hay nombre, o no hay ni un canal para contactarla. */
  | "identidad"
  /** Sin fila en `personas_negocio`: el negocio no tiene permiso de verla. */
  | "vinculo"
  /** Sin fila en `consentimientos_persona`: no hay respaldo (Ley 8968). */
  | "consentimiento";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  LA COMPROBACIÓN QUE CIERRA LA PUERTA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Contesta una sola pregunta: ¿esta persona está afiliada A ESTE
 * NEGOCIO como corresponde? Y "como corresponde" son tres cosas, no una:
 *
 *   1. SE SABE QUIÉN ES — nombre y al menos un canal de contacto.
 *   2. HAY VÍNCULO — la fila de `personas_negocio`, que la 0138 define
 *      como EL PERMISO del negocio para ver a esa persona (0138:327).
 *      Sin ella el dueño no debería poder verla, así que tampoco tiene
 *      sentido entregarle una tarjeta que va a caer en esa lista.
 *   3. HAY CONSENTIMIENTO — la fila de `consentimientos_persona`, que
 *      es el respaldo que exige la Ley 8968. El "no acepto promos"
 *      TAMBIÉN cuenta: lo que hace falta probar es que la casilla se
 *      mostró, no que se marcó.
 *
 * Se llama en las tres puertas por donde alguien consigue una tarjeta
 * (la página del QR y los dos botones de Wallet), y ahí está el punto:
 * las rutas de `api/pases/**` afilian DIRECTO —`generar.ts:227` y
 * `google.ts:558` insertan en `miembros`— así que una petición armada a
 * mano se saltaba cualquier cosa del navegador. Verificado en
 * producción: 3 de 5 miembros sin vínculo y sin consentimiento, todos
 * entrados por ahí.
 *
 * ── LA IDENTIDAD SE RESUELVE COMO EN EL PANEL ───────────────────────
 * Con `resolverIdentidad`, o sea mirando también `clientes_negocio`: si
 * el mostrador ya completó la ficha a mano —el camino que se abrió para
 * regularizar a los que quedaron mal—, esa persona YA está identificada
 * y volver a frenarla en la puerta sería castigarla dos veces.
 *
 * ── NUNCA LANZA, Y ANTE LA DUDA DEJA PASAR ──────────────────────────
 * Si la base no tiene la 0138 pegada, estas tres consultas fallan. En
 * ese caso devuelve `null` (= "no falta nada"): las migraciones las
 * pega el dueño a mano y hay ventanas de código nuevo con base vieja.
 * Cerrarle la puerta a TODOS los clientes de un negocio por una tabla
 * ausente es un daño mayor que el que esto viene a evitar — y el día
 * que la 0138 esté, esta función empieza a exigir sola.
 */
export async function revisarAfiliacion(
  db: Admin,
  personaId: string,
  negocio: NegocioDeLealtad,
): Promise<{ falta: FaltaDelAlta | null; identidad: IdentidadCliente }> {
  const vacia: IdentidadCliente = { nombre: null, correo: null, telefono: null };

  const { data: persona, error: errorPersona } = await db
    .from("personas")
    .select("nombre, correo, telefono")
    .eq("id", personaId)
    .maybeSingle();
  if (errorPersona) return { falta: null, identidad: vacia };

  // `notas` jamás en el `select`: la 0138 avisa que en un consultorio
  // pueden ser datos de salud (0138:281).
  const { data: ficha } = negocio.ranchoId
    ? await db
        .from("clientes_negocio")
        .select("nombre, correo, telefono")
        .eq("rancho_id", negocio.ranchoId)
        .eq("persona_id", personaId)
        .maybeSingle()
    : { data: null };

  const identidad = resolverIdentidad({
    persona: (persona ?? null) as FuenteDeIdentidad,
    ficha: (ficha ?? null) as FuenteDeIdentidad,
  });
  if (!identidad.nombre || (!identidad.correo && !identidad.telefono)) {
    return { falta: "identidad", identidad };
  }

  const vinculo = await hayFilaDelNegocio(db, "personas_negocio", personaId, negocio);
  if (vinculo === "error") return { falta: null, identidad };
  if (vinculo === "no") return { falta: "vinculo", identidad };

  const permiso = await hayFilaDelNegocio(db, "consentimientos_persona", personaId, negocio, {
    ambito: "negocio",
  });
  if (permiso === "error") return { falta: null, identidad };
  return { falta: permiso === "no" ? "consentimiento" : null, identidad };
}

/**
 * La misma pregunta, pero partiendo de lo que trae el navegador.
 *
 * Es la forma en que la usan las tres puertas —la página del QR y los
 * dos botones de Wallet—, y está acá y no copiada tres veces por lo de
 * siempre: tres copias de una comprobación de permisos son tres
 * comportamientos distintos esperando a que alguien arregle uno solo.
 *
 * Sin persona no hay nada que revisar: falta TODO, y eso se llama
 * `identidad`. Es también lo que le pasa a quien llega con la sesión
 * anónima del chat flotante, que `idDeCuentaDeBookea` ya descartó.
 */
export async function afiliacionDeQuienPide(
  db: Admin,
  quien: { personaId?: string | null; clienteId?: string | null },
  negocio: NegocioDeLealtad,
): Promise<{
  personaId: string | null;
  falta: FaltaDelAlta | null;
  identidad: IdentidadCliente;
}> {
  const personaId = quien.personaId ?? (await personaDeCuenta(db, quien.clienteId));
  if (!personaId) {
    return {
      personaId: null,
      falta: "identidad",
      identidad: { nombre: null, correo: null, telefono: null },
    };
  }
  return { personaId, ...(await revisarAfiliacion(db, personaId, negocio)) };
}

/**
 * ¿Hay al menos una fila de esta persona PARA ESTE NEGOCIO?
 *
 * Las dos tablas cuelgan de las mismas dos raíces (`cuenta_id`,
 * `rancho_id`) y con la misma regla: al menos una, cualquiera de las
 * dos. Se pregunta con un OR y no exigiendo las dos, porque
 * `alta_persona_por_qr` escribe lo que el programa tenga (0138:2009) —
 * un programa de solo-cuenta deja `rancho_id` en null y al revés.
 *
 * Tres respuestas y no dos: "error" es que la base no pudo contestar, y
 * quien decide con esto tiene que dejar pasar, no cerrar. Confundirlo
 * con "no" convertiría una tabla ausente en un negocio entero sin
 * poder entregar tarjetas.
 */
async function hayFilaDelNegocio(
  db: Admin,
  tabla: "personas_negocio" | "consentimientos_persona",
  personaId: string,
  negocio: NegocioDeLealtad,
  extra?: { ambito: string },
): Promise<"si" | "no" | "error"> {
  const llaves = [
    negocio.cuentaId ? `cuenta_id.eq.${negocio.cuentaId}` : null,
    negocio.ranchoId ? `rancho_id.eq.${negocio.ranchoId}` : null,
  ].filter((v): v is string => v !== null);
  // Un programa sin cuenta y sin rancho no existe (0138:1948 lo rebota),
  // pero si llegara, "no sé" es la respuesta honesta.
  if (llaves.length === 0) return "error";

  let q = db.from(tabla).select("id").eq("persona_id", personaId).or(llaves.join(","));
  if (extra) q = q.eq("ambito", extra.ambito);

  const { data, error } = await q.limit(1);
  if (error) return "error";
  return (data ?? []).length > 0 ? "si" : "no";
}

/** A quién apunta HOY cada uno de los dos datos que se tecleó. */
export type DuenosDelContacto = {
  porCorreo: string | null;
  porTelefono: string | null;
  /**
   * false = la base no pudo contestar (tabla ausente, error, o dos
   * filas para el mismo dato). Quien decida permisos con esto tiene que
   * cerrar la puerta, no abrirla: "no sé de quién es" NUNCA puede
   * significar "entonces es tuyo".
   */
  confiable: boolean;
};

/**
 * De quién es cada contacto, sin crear ni tocar nada.
 *
 * Se responde CANAL POR CANAL y no "la primera que aparezca", porque de
 * esa distinción depende quién puede reclamar qué: el correo lo prueba
 * la sesión de Bookea (para entrar hubo que leer un código en ese
 * buzón) y el teléfono no lo prueba nada. Mezclarlos en un solo
 * resultado haría imposible ver la diferencia.
 *
 * Nunca se expone al navegador: decirle "ese correo existe" es un
 * oráculo de enumeración. Se usa solo para dos decisiones del servidor
 * —el cupo y la prueba de posesión— y ninguna de las dos se le cuenta
 * a nadie.
 */
export async function duenosDelContacto(
  db: Admin,
  contacto: { correo?: string | null; telefono?: string | null },
): Promise<DuenosDelContacto> {
  const correo = normalizarCorreo(contacto.correo);
  const telefono = normalizarTelefonoCR(contacto.telefono);

  const porCorreo = correo ? await unaPersona(db, "correo", correo) : { id: null, ok: true };
  const porTelefono = telefono
    ? await unaPersona(db, "telefono", telefono)
    : { id: null, ok: true };

  return {
    porCorreo: porCorreo.id,
    porTelefono: porTelefono.id,
    confiable: porCorreo.ok && porTelefono.ok,
  };
}

async function unaPersona(
  db: Admin,
  columna: string,
  valor: string,
): Promise<{ id: string | null; ok: boolean }> {
  const { data, error } = await db.from("personas").select("id").eq(columna, valor).maybeSingle();
  // `maybeSingle` también devuelve error si hubiera DOS filas con el
  // mismo dato. No debería pasar —los índices de la 0138 son únicos—
  // pero si pasa, la respuesta correcta es "no sé", no "no hay nadie".
  if (error) return { id: null, ok: false };
  return { id: typeof data?.id === "string" ? data.id : null, ok: true };
}

/**
 * QUIÉN ESTÁ PIDIENDO LA TARJETA.
 *
 * Las dos identidades que puede traer alguien parado en el mostrador, y
 * el orden importa:
 *
 *   · la COOKIE del alta por QR (`sesiones_persona`), que es la única
 *     que tiene quien nunca abrió cuenta en Bookea — la mayoría;
 *   · su CUENTA, si además inició sesión alguna vez.
 *
 * Se devuelven las dos porque el pase las usa distinto: la persona es
 * la llave de la membresía (0138) y la cuenta es la costura opcional
 * que se completa sola cuando aparece.
 *
 * No lanza nunca y no exige la 0138: sin ella `personaId` queda en null
 * y todo sigue funcionando por el camino de siempre.
 */
export async function identidadDeQuienPide(
  db: Admin,
  entrada: { token?: string | null; clienteId?: string | null },
): Promise<{ personaId: string | null; clienteId: string | null }> {
  const clienteId = entrada.clienteId ?? null;
  const personaId =
    (await personaDelToken(db, entrada.token)) ?? (await personaDeCuenta(db, clienteId));
  return { personaId, clienteId };
}

/** ¿Esta persona ya es miembro de esta tarjeta? */
export async function yaEsMiembro(db: Admin, programaId: string, personaId: string) {
  const { data, error } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId)
    .eq("persona_id", personaId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

// ── 7. Los mensajes: uno por cada cosa que puede salir mal ───────────

/**
 * Qué lee la persona cuando la base dice que no.
 *
 * Los errores de Postgres llegan en inglés o con jerga de esquema, y
 * mostrarlos crudos es lo que este trabajo vino a arreglar. Se traducen
 * por su TEXTO —los `raise` de la 0138 vienen todos con el mismo
 * errcode 22023— y lo que no se reconoce cae en un mensaje que al menos
 * dice qué hacer.
 */
export function mensajeDeFalloDeAlta(error: { message?: string; code?: string } | null): string {
  const texto = (error?.message ?? "").toLowerCase();
  const codigo = error?.code ?? "";

  // La 0138 no está pegada en esta base. Pasa de verdad: las migraciones
  // las pega el dueño a mano y hay una ventana con código nuevo y base
  // vieja. Que se lea como una alternativa y no como una falla.
  if (codigo === "PGRST202" || texto.includes("could not find the function")) {
    return "Todavía no podemos darte la tarjeta con estos dos datos. Entrá con tu correo y te la damos igual.";
  }
  if (texto.includes("bloqueada")) {
    return "Esta identidad está bloqueada. Preguntá en el local.";
  }
  if (texto.includes("no está activo") || texto.includes("no esta activo")) {
    return "La tarjeta de este negocio no está repartiendo pases ahora mismo.";
  }
  if (texto.includes("no existe")) {
    return "Esa tarjeta ya no existe. Volvé a escanear el QR del local.";
  }
  if (texto.includes("hace falta")) {
    return "Nos falta tu WhatsApp o tu correo para poder darte la tarjeta.";
  }
  if (texto.includes("consentimiento")) {
    return "No pudimos guardar tu permiso. Probá de nuevo.";
  }
  return "No pudimos crear tu tarjeta ahora mismo. Probá otra vez en un momento.";
}

// ── 8. El alta, de punta a punta ─────────────────────────────────────

export type ResultadoAlta =
  /** Persona, vínculo, consentimiento y membresía, todo listo. */
  | {
      estado: "listo";
      personaId: string;
      miembroId: string | null;
      /** true = esta membresía se creó recién (0138: `miembro_nuevo`), no un re-escaneo de quien ya era miembro — es la señal para el correo de bienvenida, que no puede salir en cada visita. */
      miembroNuevo: boolean;
      token: string;
    }
  /**
   * El contacto ya es de alguien PROTEGIDO (tiene cuenta, un contacto
   * probado, o sellos juntados) y quien pide no trae prueba. No se
   * escribió NADA. Se recupera entrando con el código, que es la prueba
   * de posesión que ya existe.
   */
  | { estado: "requiere_prueba"; canal: "correo" | "whatsapp" }
  /** El paquete del negocio está lleno: no se afilia a nadie nuevo. */
  | { estado: "lleno" }
  | { estado: "error"; mensaje: string };

export async function altaPorQr(
  db: Admin,
  {
    programa,
    ranchoId,
    planRancho,
    nombreNegocio,
    contacto,
    nombre,
    acepta,
    personaProbada,
    sesion,
    ip,
    userAgent,
  }: {
    /** La fila CRUDA de la tarjeta que emite (`select *`). */
    programa: Record<string, unknown>;
    ranchoId: string | null;
    planRancho: string | null;
    nombreNegocio: string;
    contacto: Contacto;
    /**
     * OBLIGATORIO desde el pedido del dueño («necesitamos saber quién se
     * registra»). Ya viene revisado por `revisarAlta`, pero se vuelve a
     * comprobar acá abajo: esta función es la puerta del servidor, y una
     * petición armada a mano no pasa por ninguna pantalla.
     */
    nombre: string;
    acepta: boolean;
    /**
     * La persona de la cookie de `sesiones_persona`, tal cual viene.
     * Que valga o no como prueba se decide acá abajo — nunca lo decide
     * quien llama.
     */
    personaProbada: string | null;
    /** La sesión de Bookea, si hay. Igual: acá se decide qué prueba. */
    sesion: { clienteId: string | null; correo: string | null };
    ip: string | null;
    userAgent: string | null;
  },
): Promise<ResultadoAlta> {
  const programaId = typeof programa.id === "string" ? programa.id : null;
  if (!programaId) {
    return { estado: "error", mensaje: "Esa tarjeta ya no existe. Volvé a escanear el QR." };
  }

  // ── EL MÍNIMO, REVISADO OTRA VEZ Y ACÁ ──────────────────────────
  // `revisarAlta` ya corrió en la pantalla, y no alcanza: esta función
  // es la única puerta de servidor del alta, y un `fetch` armado a mano
  // —o un formulario con el `required` borrado desde el inspector— no
  // pasa por ninguna validación del navegador. Sin esto, esconder un
  // campo obligatorio sería toda la protección que hay.
  const revision = revisarAlta({
    nombre,
    correo: contacto.correo,
    telefono: contacto.telefono,
  });
  if (!revision.ok) return { estado: "error", mensaje: revision.error };
  const nombreLimpio = revision.nombre;

  // ── QUIÉN PUEDE RECLAMAR ESTE CONTACTO ──────────────────────────
  // La parte delicada de todo esto, y va acá y no en la pantalla para
  // que exista UN solo lugar donde se decide.
  //
  // La 0138 tiene un portero (0138:1961): si el contacto ya es de
  // alguien PROTEGIDO —cuenta, contacto probado, o sellos en el
  // ledger— y quien pide no trae prueba, no se escribe nada y se
  // devuelve `requiere_prueba`. Pero ese portero se SALTA en cuanto
  // llega `p_persona_probada` o `p_cliente_id`. O sea que mandar
  // cualquiera de los dos a la ligera lo desarma entero:
  //
  //   · quien ya hizo un alta (tiene cookie) escribiría el contacto de
  //     otra persona, el portero se saltaría, y se llevaría una cookie
  //     hacia una identidad con sellos que no es suya;
  //   · quien tiene sesión escribiría el TELÉFONO de otro y
  //     `resolver_persona` le colgaría su cuenta a esa fila ajena
  //     (0138:933) — adopción de identidad, en una consulta.
  //
  // Así que las dos pruebas se validan CONTRA EL CONTACTO TECLEADO:
  const duenos = await duenosDelContacto(db, contacto);
  const correoDeLaSesion = normalizarCorreo(sesion.correo);

  // La cookie prueba algo solo si el contacto tecleado ya le pertenece
  // a esa misma persona. Es el caso honesto y frecuente: la misma
  // señora, el mismo teléfono, escaneando el QR de otro negocio.
  //
  // Y si la base no pudo contestar de quién es cada dato (`confiable`
  // en false), NINGUNA de las dos prueba nada: "no sé de quién es" no
  // puede volverse "entonces es tuyo".
  const cookieVale =
    duenos.confiable &&
    !!personaProbada &&
    [duenos.porCorreo, duenos.porTelefono].some((p) => p === personaProbada) &&
    [duenos.porCorreo, duenos.porTelefono].every((p) => p === null || p === personaProbada);
  const probada = cookieVale ? personaProbada : null;

  // La sesión prueba EL CORREO —para entrar a Bookea hubo que leer un
  // código en ese buzón— y nada más. Por eso además se exige que el
  // teléfono tecleado no sea de un tercero: sin eso, el correo propio
  // serviría de llave para adoptar la fila de otro por su número.
  const telefonoAjeno =
    !duenos.confiable ||
    (duenos.porTelefono !== null &&
      duenos.porTelefono !== duenos.porCorreo &&
      duenos.porTelefono !== personaProbada);
  //
  // `contacto.correo !== null` no es defensivo de más: desde que se
  // acepta el alta con UN solo canal, quien deja únicamente su WhatsApp
  // llega acá con el correo en null. Sin esa comprobación, un usuario
  // logueado sin correo en su sesión (`correoDeLaSesion` también null)
  // daría `null === null` y su cuenta se colgaría de una fila resuelta
  // por un teléfono que nadie probó.
  const clienteId =
    sesion.clienteId &&
    contacto.correo !== null &&
    correoDeLaSesion === contacto.correo &&
    !telefonoAjeno
      ? sesion.clienteId
      : null;

  // ── EL TOPE DEL PAQUETE, ANTES DEL RPC ──────────────────────────
  // `alta_persona_por_qr` inserta en `miembros` directo y su propio
  // comentario dice que el tope lo comprueba el servidor (0138:2111).
  // Este es ese servidor.
  const yaMiembro = await esClienteConocido(db, programaId, {
    duenos,
    personaProbada,
    clienteId: sesion.clienteId,
  });

  if (!yaMiembro) {
    const { plan, cuentaId } = await contextoDeCuenta(db, programa, { planRancho });
    const limite = definicionDe(plan)?.limites.clientesActivos;
    if (limite !== null && limite !== undefined) {
      const usadas = await personasActivasDe(db, { cuentaId, ranchoId });
      if (usadas >= limite) return { estado: "lleno" };
    }
  }

  const { data, error } = await db.rpc("alta_persona_por_qr", {
    p_programa: programaId,
    p_correo: contacto.correo,
    p_telefono: contacto.telefono,
    p_nombre: nombreLimpio,
    p_consentimientos: cuerpoDeConsentimientos({ nombreNegocio, acepta }),
    p_persona_probada: probada,
    p_cliente_id: clienteId,
    p_ip: ip,
    p_user_agent: userAgent ? userAgent.slice(0, 400) : null,
  });

  if (error) return { estado: "error", mensaje: mensajeDeFalloDeAlta(error) };

  const salida = (data ?? {}) as {
    estado?: string;
    persona_id?: string;
    miembro_id?: string | null;
    miembro_nuevo?: boolean;
    canal_sugerido?: string;
  };

  if (salida.estado === "requiere_prueba") {
    return {
      estado: "requiere_prueba",
      canal: salida.canal_sugerido === "whatsapp" ? "whatsapp" : "correo",
    };
  }

  const personaId = salida.persona_id;
  if (salida.estado !== "listo" || typeof personaId !== "string") {
    return { estado: "error", mensaje: mensajeDeFalloDeAlta(null) };
  }

  const token = await abrirSesionDePersona(db, personaId, { ip, userAgent });
  if (!token) {
    // La persona, el vínculo y la membresía YA quedaron: el alta es
    // idempotente, así que reintentar no duplica nada.
    return {
      estado: "error",
      mensaje: "Tu tarjeta quedó lista, pero este navegador no la pudo recordar. Probá otra vez.",
    };
  }

  return {
    estado: "listo",
    personaId,
    miembroId: typeof salida.miembro_id === "string" ? salida.miembro_id : null,
    miembroNuevo: salida.miembro_nuevo === true,
    token,
  };
}

/**
 * ¿Quien está escaneando ya es miembro de esta tarjeta?
 *
 * Se pregunta por los cuatro caminos que pueden identificarla: la
 * cookie de este navegador, su cuenta de Bookea, y los dueños actuales
 * del correo y del teléfono que acaba de escribir. Con que uno diga que
 * sí, NO se le cobra un asiento nuevo del paquete — si no, el cliente
 * 200 de un paquete lleno no podría ni volver a abrir su tarjeta.
 *
 * Ojo: acá se es DELIBERADAMENTE generoso y se miran también las
 * identidades que no probó, porque lo único que está en juego es el
 * conteo del cupo. Para reclamar la tarjeta, la vara es la de arriba.
 */
async function esClienteConocido(
  db: Admin,
  programaId: string,
  quien: {
    duenos: DuenosDelContacto;
    personaProbada: string | null;
    clienteId: string | null;
  },
): Promise<boolean> {
  const candidatas = [
    quien.personaProbada,
    await personaDeCuenta(db, quien.clienteId),
    quien.duenos.porCorreo,
    quien.duenos.porTelefono,
  ].filter((p): p is string => typeof p === "string" && p !== "");

  for (const persona of new Set(candidatas)) {
    if (await yaEsMiembro(db, programaId, persona)) return true;
  }
  return false;
}

/**
 * Abre la sesión de la persona en ESTE navegador y devuelve el token
 * que va en la cookie. null si la base todavía no tiene la tabla.
 */
export async function abrirSesionDePersona(
  db: Admin,
  personaId: string,
  huella: { ip: string | null; userAgent: string | null },
): Promise<string | null> {
  const token = randomBytes(32).toString("hex");
  const { error } = await db.from("sesiones_persona").insert({
    persona_id: personaId,
    token_hash: hashDeToken(token),
    ip: huella.ip,
    user_agent: huella.userAgent ? huella.userAgent.slice(0, 400) : null,
  });
  if (error) {
    console.warn("[lealtad] No se pudo abrir la sesión de la persona:", error.message);
    return null;
  }
  return token;
}
