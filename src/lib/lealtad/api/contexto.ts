import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashDeSecreto, huellaDeIp, llaveDeCabecera, pepperDeLlaves } from "./llaves";
import { pepperDeBytea } from "./ref";
import { ipPermitida, tieneScope } from "./aislamiento";
import {
  LIMITES,
  cabecerasDeLimite,
  limiteEfectivo,
  segundosParaReinicio,
  type AmbitoLimite,
  type ReglaLimite,
} from "./limites";
import { MENSAJE_CREDENCIAL, errorApi, okApi } from "./errores";
import { camposProhibidos } from "./respuestas";

/**
 * LA PUERTA DE LA API DE LEALTAD.
 *
 * Toda ruta de `/api/lealtad/v1` empieza llamando a `abrirContexto` y
 * termina llamando a `cerrar`. Entre las dos no hay excepciones: si una
 * ruta pudiera saltarse esto, todo lo demás de este directorio sería
 * decoración.
 *
 * ------------------------------------------------------------------
 * EL ORDEN DE VERIFICACIÓN, Y POR QUÉ ES ESE
 * ------------------------------------------------------------------
 *  1. Parsear el `Bearer`. Formato inválido → 401 genérico, sin tocar
 *     la base: basura no merece una consulta.
 *  2. Pre-chequeo del contador de fallos por huella de IP, MIRANDO sin
 *     contar (si mirara contando, cada petición buena gastaría el
 *     presupuesto de fallos).
 *  3. UN SOLO RPC `api_lealtad_autenticar`: autentica, valida estado,
 *     vencimiento y programa, y toma el rate limit general. Un round
 *     trip, porque del otro lado hay un cliente esperando en la caja.
 *  4. Cualquier fallo de credencial → el MISMO 401, mismo cuerpo, sin
 *     distinguir. Responder distinto convierte al endpoint en un
 *     oráculo (wallet/servicio.ts:52-56).
 *  5. Scope. Acá sí se es específico: ya probó ser quien dice.
 *  6. Lista blanca de IP si la declaró, y los buckets que falten.
 *  7. (En la ruta) cuerpo ≤ 4 KB, tipos exactos, validación a mano.
 *  8. (En la ruta) resolver el identificador y EXIGIR que el miembro
 *     sea de esta tarjeta y de este negocio — ver ./aislamiento.ts.
 *
 * ------------------------------------------------------------------
 * FALLA CERRADO, SIEMPRE
 * ------------------------------------------------------------------
 * Sin pepper, sin llave de servicio o con el contador caído, la
 * respuesta es 503 y la operación NO se ejecuta. Nunca "pasá igual".
 * Es tolerable en una caja porque `referencia` es obligatoria: el POS
 * reintenta y el reintento es idempotente.
 *
 * ------------------------------------------------------------------
 * NUNCA SE LOGUEA EL PEDIDO
 * ------------------------------------------------------------------
 * Regla de código, sin excepción: esta capa no hace
 * `console.log(pedido)` ni serializa el request dentro de un error. La
 * cabecera `Authorization` viaja ahí adentro.
 */

type Db = NonNullable<ReturnType<typeof createAdminClient>>;

export type ContextoApi = {
  requestId: string;
  inicioMs: number;
  db: Db;
  metodo: string;
  /** El PATRÓN de la ruta (`/saldo`), nunca la URL con sus parámetros. */
  ruta: string;

  llaveId: string;
  kid: string;
  autorizacionId: string;
  desarrolladorId: string;
  desarrollador: string;
  ranchoId: string;
  programaId: string;
  entorno: string;
  scopes: string[];
  mostrarIniciales: boolean;
  /** La sal del seudónimo de ESTA autorización. */
  pepperRef: Buffer;
  ipHmac: string | null;
  cabecerasLimite: Record<string, string>;
};

export type Apertura =
  | { ok: true; ctx: ContextoApi }
  | { ok: false; respuesta: NextResponse; registrado: true };

type Opciones = {
  /** El patrón, para la bitácora. */
  ruta: string;
  /** El scope que este endpoint exige. `null` = ninguno (solo `/yo`). */
  scope: string | null;
  /** Las escrituras tienen su propio presupuesto, más chico. */
  escritura?: boolean;
  /** Un bucket extra propio del endpoint (`saldo`). */
  bucketPropio?: AmbitoLimite;
};

/** La fila que devuelve `api_lealtad_autenticar`. */
type FilaAutenticacion = {
  ok: boolean;
  motivo: string | null;
  llave_id: string | null;
  autorizacion_id: string | null;
  desarrollador_id: string | null;
  desarrollador: string | null;
  rancho_id: string | null;
  programa_id: string | null;
  entorno: string | null;
  scopes: string[] | null;
  mostrar_iniciales: boolean | null;
  pepper_ref: string | null;
  ips_permitidas: string[] | null;
  limite_min: number | null;
  limite_hora: number | null;
  permitido: boolean;
  conteo: number;
};

/**
 * La IP del que llama, tal como la ve Vercel.
 *
 * Se toma el PRIMER valor de `x-forwarded-for` (el cliente original) y
 * se le corta el largo: una cabecera de 4 KB de "IPs" es una forma
 * barata de llenarnos una tabla. Nunca se guarda en claro — de acá sale
 * directo a `huellaDeIp`.
 */
function ipDelPedido(pedido: Request): string | null {
  const cabecera = pedido.headers.get("x-forwarded-for") ?? pedido.headers.get("x-real-ip") ?? "";
  const primera = cabecera.split(",")[0]?.trim() ?? "";
  return primera && primera.length <= 45 ? primera : null;
}

/** Todo lo que se necesita para dejar una fila en la bitácora. */
type Registro = {
  requestId: string;
  ctx: Partial<ContextoApi> & { requestId: string; metodo: string; ruta: string };
  estadoHttp: number;
  codigoError?: string | null;
  miembroId?: string | null;
  puntosDelta?: number | null;
  referencia?: string | null;
  inicioMs: number;
  userAgent: string | null;
};

/**
 * UNA fila por llamada, exitosa o no, después de responder.
 *
 * Va en `after()` para no hacer esperar al mostrador por una escritura
 * de auditoría, y con `try/catch` mudo: si la bitácora falla, la caja
 * no se cae. (La fila perdida se nota igual, porque el agregado diario
 * y el contador de rate limit no cuadran.)
 */
export function registrar(db: Db | null, datos: Registro): void {
  if (!db) return;
  const fila = {
    request_id: datos.requestId,
    autorizacion_id: datos.ctx.autorizacionId ?? null,
    llave_id: datos.ctx.llaveId ?? null,
    kid: datos.ctx.kid ?? null,
    rancho_id: datos.ctx.ranchoId ?? null,
    metodo: datos.ctx.metodo,
    ruta_patron: datos.ctx.ruta,
    miembro_id: datos.miembroId ?? null,
    estado_http: datos.estadoHttp,
    codigo_error: datos.codigoError ?? null,
    puntos_delta: datos.puntosDelta ?? null,
    referencia: datos.referencia ?? null,
    duracion_ms: Math.min(600000, Math.max(0, Date.now() - datos.inicioMs)),
    ip_hmac: datos.ctx.ipHmac ?? null,
    user_agent: datos.userAgent ? datos.userAgent.slice(0, 120) : null,
  };
  after(async () => {
    try {
      await db.from("bitacora_api_lealtad").insert(fila);
    } catch {
      // Muda a propósito: ver el comentario de arriba.
    }
  });
}

/** Cierra la llamada: registra y devuelve la respuesta tal cual. */
export function cerrar(
  ctx: ContextoApi,
  respuesta: NextResponse,
  extra: {
    codigoError?: string | null;
    miembroId?: string | null;
    puntosDelta?: number | null;
    referencia?: string | null;
    userAgent?: string | null;
  } = {},
): NextResponse {
  registrar(ctx.db, {
    requestId: ctx.requestId,
    ctx,
    estadoHttp: respuesta.status,
    codigoError: extra.codigoError ?? null,
    miembroId: extra.miembroId ?? null,
    puntosDelta: extra.puntosDelta ?? null,
    referencia: extra.referencia ?? null,
    inicioMs: ctx.inicioMs,
    userAgent: extra.userAgent ?? null,
  });
  return respuesta;
}

/**
 * La ÚNICA salida feliz de la API, con el candado puesto.
 *
 * Antes de mandar nada se recorre el cuerpo buscando campos personales
 * (`camposProhibidos`). Si aparece uno —porque alguien agregó una
 * columna, cambió un serializador o pegó un objeto de la base sin
 * mirar— la respuesta se convierte en 503 y queda un `console.error`
 * ruidoso. Cuesta un recorrido de un objeto de veinte campos.
 *
 * Un campo que falta se agrega mañana; un campo personal que se filtró
 * ya se filtró.
 */
export function responder(
  ctx: ContextoApi,
  cuerpo: unknown,
  estado = 200,
  extra: {
    miembroId?: string | null;
    puntosDelta?: number | null;
    referencia?: string | null;
    userAgent?: string | null;
  } = {},
): NextResponse {
  const fugas = camposProhibidos(cuerpo);
  if (fugas.length) {
    console.error(
      `[api-lealtad] SE FRENÓ UNA RESPUESTA: campos personales en ${ctx.ruta}: ${fugas.join(", ")}`,
    );
    return cerrar(
      ctx,
      errorApi("degradado", "La API está temporalmente fuera de servicio.", ctx.requestId),
      { ...extra, codigoError: "fuga_frenada" },
    );
  }
  return cerrar(ctx, okApi(cuerpo, ctx.requestId, estado, ctx.cabecerasLimite), extra);
}

export async function abrirContexto(pedido: Request, opciones: Opciones): Promise<Apertura> {
  const requestId = randomUUID();
  const inicioMs = Date.now();
  const metodo = pedido.method.toUpperCase();
  const userAgent = pedido.headers.get("user-agent");
  const base = { requestId, metodo, ruta: opciones.ruta };

  const pepper = pepperDeLlaves();
  if (!pepper) {
    // El mismo criterio que `cron-auth.ts`: sin secreto configurado no
    // entra nadie, y el problema se ve en el log de una vez en vez de
    // quedar mudo.
    console.error(
      "[api-lealtad] LEALTAD_API_PEPPER no está configurada (o es más corta que 32 caracteres): " +
        "la API de Lealtad responde 503. Ponela en las variables de entorno del proyecto.",
    );
    return {
      ok: false,
      registrado: true,
      respuesta: errorApi(
        "degradado",
        "La API está temporalmente fuera de servicio.",
        requestId,
      ),
    };
  }

  const db = createAdminClient();
  if (!db) {
    console.error("[api-lealtad] Falta SUPABASE_SERVICE_ROLE_KEY: la API responde 503.");
    return {
      ok: false,
      registrado: true,
      respuesta: errorApi("degradado", "La API está temporalmente fuera de servicio.", requestId),
    };
  }

  const ipHmac = huellaDeIp(ipDelPedido(pedido), pepper);

  /** Suma un fallo de credencial y devuelve el 401 de siempre. */
  const fallarCredencial = async (): Promise<Apertura> => {
    if (ipHmac) {
      const regla = LIMITES.authfail;
      try {
        await db.rpc("api_rate_limit_tomar", {
          p_ambito: regla.ambito,
          p_clave: ipHmac,
          p_limite: regla.limite,
          p_ventana_segundos: regla.ventanaSegundos,
        });
      } catch {
        // Si el contador no responde, igual se rechaza: fallar cerrado.
      }
    }
    registrar(db, {
      requestId,
      ctx: { ...base, ipHmac },
      estadoHttp: 401,
      codigoError: "credencial",
      inicioMs,
      userAgent,
    });
    return {
      ok: false,
      registrado: true,
      respuesta: errorApi("credencial", MENSAJE_CREDENCIAL, requestId),
    };
  };

  // 1. El formato, antes de tocar la base.
  const llave = llaveDeCabecera(pedido);
  if (!llave) return fallarCredencial();

  // 2. ¿Esta huella de IP ya se pasó de fallos? Se MIRA, no se cuenta.
  if (ipHmac) {
    const regla = LIMITES.authfail;
    const { data: fallos, error } = await db.rpc("api_rate_limit_ver", {
      p_ambito: regla.ambito,
      p_clave: ipHmac,
      p_ventana_segundos: regla.ventanaSegundos,
    });
    if (error) {
      return {
        ok: false,
        registrado: true,
        respuesta: errorApi("degradado", "No se pudo verificar el límite de intentos.", requestId),
      };
    }
    if (typeof fallos === "number" && fallos >= regla.limite) {
      registrar(db, {
        requestId,
        ctx: { ...base, ipHmac },
        estadoHttp: 429,
        codigoError: "limite_excedido",
        inicioMs,
        userAgent,
      });
      return {
        ok: false,
        registrado: true,
        respuesta: errorApi(
          "limite_excedido",
          "Demasiados intentos fallidos desde esta dirección. Probá de nuevo en unos minutos.",
          requestId,
          { cabeceras: { "Retry-After": String(regla.ventanaSegundos) } },
        ),
      };
    }
  }

  // 3. Un solo round trip: autentica y toma el límite general.
  const reglaGeneral = LIMITES.llave;
  const { data, error } = await db.rpc("api_lealtad_autenticar", {
    p_kid: llave.kid,
    p_secreto_hash: hashDeSecreto(llave.secreto, pepper),
    p_limite_min: reglaGeneral.limite,
    p_ventana_segundos: reglaGeneral.ventanaSegundos,
  });

  if (error) {
    console.error("[api-lealtad] api_lealtad_autenticar falló:", error.message);
    return {
      ok: false,
      registrado: true,
      respuesta: errorApi("degradado", "La API está temporalmente fuera de servicio.", requestId),
    };
  }

  const fila = (Array.isArray(data) ? data[0] : data) as FilaAutenticacion | undefined;
  if (!fila) return fallarCredencial();

  // 4. Todos los motivos de credencial dan el MISMO 401. El motivo
  //    queda en la bitácora, no en la respuesta.
  if (!fila.ok) {
    if (fila.motivo === "programa_inactivo") {
      const ctxParcial = {
        ...base,
        ipHmac,
        kid: llave.kid,
        llaveId: fila.llave_id ?? undefined,
        autorizacionId: fila.autorizacion_id ?? undefined,
        ranchoId: fila.rancho_id ?? undefined,
      };
      registrar(db, {
        requestId,
        ctx: ctxParcial,
        estadoHttp: 403,
        codigoError: "programa_inactivo",
        inicioMs,
        userAgent,
      });
      return {
        ok: false,
        registrado: true,
        respuesta: errorApi(
          "programa_inactivo",
          "El programa de lealtad de este negocio no está activo en este momento.",
          requestId,
        ),
      };
    }
    return fallarCredencial();
  }

  const pepperRef = pepperDeBytea(fila.pepper_ref);
  if (
    !pepperRef ||
    !fila.llave_id ||
    !fila.autorizacion_id ||
    !fila.rancho_id ||
    !fila.programa_id
  ) {
    console.error("[api-lealtad] autenticación incompleta: falta pepper o identificadores.");
    return {
      ok: false,
      registrado: true,
      respuesta: errorApi("degradado", "La API está temporalmente fuera de servicio.", requestId),
    };
  }

  const ctx: ContextoApi = {
    requestId,
    inicioMs,
    db,
    metodo,
    ruta: opciones.ruta,
    llaveId: fila.llave_id,
    kid: llave.kid,
    autorizacionId: fila.autorizacion_id,
    desarrolladorId: fila.desarrollador_id ?? "",
    desarrollador: fila.desarrollador ?? "Aplicación",
    ranchoId: fila.rancho_id,
    programaId: fila.programa_id,
    entorno: fila.entorno ?? "live",
    scopes: fila.scopes ?? [],
    mostrarIniciales: fila.mostrar_iniciales ?? false,
    pepperRef,
    ipHmac,
    cabecerasLimite: cabecerasDeLimite(
      limiteEfectivo(reglaGeneral, fila.limite_min),
      fila.conteo,
      inicioMs,
    ),
  };

  const rechazar = (
    respuesta: NextResponse,
    codigo: string,
  ): Apertura => ({
    ok: false,
    registrado: true,
    respuesta: cerrar(ctx, respuesta, { codigoError: codigo, userAgent }),
  });

  // El límite general ya se tomó dentro del RPC.
  if (!fila.permitido) {
    return rechazar(respuestaLimite(reglaGeneral, ctx, inicioMs), "limite_excedido");
  }

  // 5. Scope.
  if (opciones.scope && !tieneScope(ctx.scopes, opciones.scope)) {
    return rechazar(
      errorApi(
        "scope_faltante",
        `Esta llave no tiene el permiso \`${opciones.scope}\`. El dueño del negocio tiene que autorizarlo desde su panel.`,
        requestId,
        { cabeceras: ctx.cabecerasLimite },
      ),
      "scope_faltante",
    );
  }

  // 6. Lista blanca de IP, si el integrador la declaró.
  if (!ipPermitida(fila.ips_permitidas, ipDelPedido(pedido))) {
    return rechazar(
      errorApi(
        "ip_no_autorizada",
        "Esta llave solo funciona desde las direcciones IP declaradas.",
        requestId,
        { cabeceras: ctx.cabecerasLimite },
      ),
      "ip_no_autorizada",
    );
  }

  // 7. Los buckets que faltan, en paralelo: el sostenido de la llave,
  //    el techo del NEGOCIO (para que tres llaves del mismo integrador
  //    no lo ahoguen por la puerta de atrás) y el del endpoint.
  const extras: { regla: ReglaLimite; clave: string }[] = [
    { regla: limiteEfectivo(LIMITES.llaveh, fila.limite_hora), clave: ctx.kid },
    { regla: LIMITES.rancho, clave: ctx.ranchoId },
  ];
  if (opciones.escritura) extras.push({ regla: LIMITES.llavew, clave: ctx.kid });
  if (opciones.bucketPropio) {
    extras.push({ regla: LIMITES[opciones.bucketPropio], clave: ctx.kid });
  }

  const tomas = await Promise.all(
    extras.map(({ regla, clave }) =>
      ctx.db
        .rpc("api_rate_limit_tomar", {
          p_ambito: regla.ambito,
          p_clave: clave,
          p_limite: regla.limite,
          p_ventana_segundos: regla.ventanaSegundos,
        })
        .then((r) => ({ regla, r })),
    ),
  );

  for (const { regla, r } of tomas) {
    if (r.error) {
      // Contador caído = 503, la operación NO se ejecuta.
      return rechazar(
        errorApi("degradado", "No se pudo verificar el límite de peticiones.", requestId),
        "degradado",
      );
    }
    const salida = (Array.isArray(r.data) ? r.data[0] : r.data) as
      | { permitido: boolean; conteo: number }
      | undefined;
    if (!salida || !salida.permitido) {
      return rechazar(respuestaLimite(regla, ctx, inicioMs, salida?.conteo ?? regla.limite), "limite_excedido");
    }
  }

  return { ok: true, ctx };
}

function respuestaLimite(
  regla: ReglaLimite,
  ctx: ContextoApi,
  ahoraMs: number,
  conteo?: number,
): NextResponse {
  const espera = segundosParaReinicio(ahoraMs, regla.ventanaSegundos);
  return errorApi(
    "limite_excedido",
    `Se pasó del límite de peticiones (${regla.descripcion}). Reintentá en ${espera} s.`,
    ctx.requestId,
    {
      cabeceras: {
        ...cabecerasDeLimite(regla, conteo ?? regla.limite, ahoraMs),
        "Retry-After": String(espera),
      },
    },
  );
}
