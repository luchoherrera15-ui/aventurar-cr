import type { SupabaseClient } from "@supabase/supabase-js";
import { accesoLealtadDeLaPeticion } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITES } from "@/lib/lealtad/api/limites";
import type { PermisoLealtad, PermisosLealtad } from "@/lib/lealtad/permisos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PUERTA DE LA APP MÓVIL — todo lo que hay que comprobar, una vez
 * ════════════════════════════════════════════════════════════════════
 *
 * Cada endpoint de `/api/lealtad/app/**` empieza acá y no puede saltarse
 * ni un paso. La razón de que sea UNA función y no un checklist copiado
 * en cada ruta está viva en producción:
 * `src/app/api/citas/[id]/asistencia/route.ts` es una ruta bearer que
 * escribe el ledger de lealtad, y reimplementó la autorización a mano —
 * se quedó en el reparto binario de la 0116, sin el checklist de la
 * 0127. Por esa puerta, un colaborador con `acreditar: false` acredita.
 *
 * ── EL PERMISO ES PARÁMETRO OBLIGATORIO, Y ESO ES EL DISEÑO ─────────
 *
 * `abrirPuertaApp` no compila sin decirle QUÉ permiso exige. No hay
 * forma de agregar un endpoint y «olvidarse» de la línea del permiso,
 * porque la línea no existe: es un argumento del tipo.
 *
 * ── LOS DOS PORTONES QUE NINGÚN SERVER ACTION TIENE ─────────────────
 *
 * El add-on activo y la aprobación del negocio se comprueban HOY en
 * `page.tsx`, no en los server actions — `grep tiene_addon` sobre
 * `escaner-actions.ts` y `lealtad-operar-actions.ts` da cero. Eso
 * funciona mientras la única entrada sea una página que ya los revisó.
 * Un endpoint HTTP es una entrada NUEVA: sin replicarlos acá, la app
 * sería la puerta de atrás al cobro del complemento — un negocio con
 * Lealtad vencido seguiría sellando para siempre.
 *
 * ── BEARER Y NADA MÁS ───────────────────────────────────────────────
 *
 * Sin `Authorization` se responde 401 y NUNCA se mira la cookie.
 * Aceptar «bearer o cookie» con `Access-Control-Allow-Origin: *` es la
 * receta del CSRF: un formulario de cualquier sitio le acreditaría
 * sellos al negocio usando la sesión abierta del dueño en su navegador.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  // NUNCA `Access-Control-Allow-Credentials`: estas rutas no leen
  // cookies, y permitirlas sería exactamente el agujero de arriba.
} as const;

/** El preflight. Lo re-exporta cada ruta como su `OPTIONS`. */
export function responderPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function jsonApp(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

/**
 * ── REGLA 3.1.1 DE APPLE, APLICADA POR CÓDIGO ───────────────────────
 *
 * El motivo real de cupo agotado dice, literal, «Tu paquete ya usó todo
 * su cupo de clientes. Escribile a Bookea para subir de plan.» Eso es un
 * llamado a contratar software por fuera de la compra dentro de la app,
 * dentro del binario de iOS — justo lo que la regla 3.1.1 sanciona.
 *
 * ⚠️ EL MAPEO ES POR CÓDIGO, NO POR SUBSTRING. Filtrar por la palabra
 * «plan» taparía mañana un motivo útil que diga «el plan de la tarjeta»
 * y dejaría pasar el siguiente upsell que se escriba con otras palabras.
 * El núcleo devuelve un `codigo` y acá se traduce ese código.
 */
const MOTIVO_PARA_MOVIL: Record<string, string> = {
  cupo_agotado:
    "Tu programa llegó a su máximo de clientes activos. Contactá a Bookea para ampliarlo.",
};

export function motivoParaMovil(codigo: string | undefined, motivo: string): string {
  return (codigo && MOTIVO_PARA_MOVIL[codigo]) ?? motivo;
}

/** Un error del núcleo, ya limpio de cualquier mención de planes. */
export function errorApp(
  resultado: { motivo: string; codigo?: string },
  status = 400,
): Response {
  return jsonApp(
    { ok: false, motivo: motivoParaMovil(resultado.codigo, resultado.motivo) },
    status,
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PuertaAbierta = {
  ok: true;
  /** Con llave de servicio: los RPC de lealtad no aceptan `authenticated`. */
  db: SupabaseClient;
  usuarioId: string;
  permisos: PermisosLealtad;
  esAdmin: boolean;
};

export type Puerta = PuertaAbierta | { ok: false; respuesta: Response };

/**
 * `"solo-entrar"` = alcanza con tener acceso al negocio.
 *
 * Lo usa el endpoint del tablero: exigirle `acreditar` dejaría afuera al
 * colaborador que solo puede canjear y al dueño que entra a mirar los
 * números. Cada bloque de la respuesta se recorta después por su propio
 * permiso.
 */
export type PermisoExigido = PermisoLealtad | "solo-entrar";

const SIN_PERMISO: Record<PermisoLealtad, string> = {
  acreditar: "No tenés permiso para dar sellos — pedíselo al dueño.",
  canjear: "No tenés permiso para canjear premios — pedíselo al dueño.",
  revertir: "No tenés permiso para revertir movimientos — pedíselo al dueño.",
  auditoria: "No tenés permiso para ver la auditoría — pedíselo al dueño.",
};

export async function abrirPuertaApp(
  req: Request,
  opciones: {
    ranchoId: string;
    /** OBLIGATORIO. Un endpoint sin permiso declarado no compila. */
    permiso: PermisoExigido;
    /** true = la operación escribe. Cambia el ámbito del rate limit. */
    escribe: boolean;
  },
): Promise<Puerta> {
  const { ranchoId, permiso, escribe } = opciones;

  // 1. El id, antes de tocar la red. Un `ranchoId` con forma rara no
  //    merece una consulta.
  if (!UUID.test(ranchoId)) {
    return { ok: false, respuesta: jsonApp({ ok: false, motivo: "Negocio inválido." }, 400) };
  }

  // 2. Quién pregunta. `null` = sin token o token que no corresponde a
  //    nadie. Nunca se cae a la cookie (ver la cabecera).
  const acceso = await accesoLealtadDeLaPeticion(req, ranchoId);
  if (!acceso) {
    return { ok: false, respuesta: jsonApp({ ok: false, motivo: "Sesión vencida." }, 401) };
  }

  // 3. ¿Tiene acceso a ESTE negocio?
  if (!acceso.ok) {
    return {
      ok: false,
      respuesta: jsonApp({ ok: false, motivo: "No tenés acceso a este negocio." }, 403),
    };
  }

  const db = createAdminClient();
  if (!db) {
    return { ok: false, respuesta: jsonApp({ ok: false, motivo: "No hay conexión." }, 503) };
  }

  // 4. EL COMPLEMENTO. `tiene_addon` es `security definer` y está
  //    granteada a `authenticated`, así que se puede preguntar con el
  //    cliente del usuario — igual que hace `page.tsx`. Y valida
  //    `vence_en > now()`, o sea que un add-on vencido queda afuera.
  const { data: tieneAddon } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: ranchoId,
    p_addon: "lealtad",
  });
  if (tieneAddon !== true) {
    return {
      ok: false,
      respuesta: jsonApp(
        { ok: false, motivo: "Este negocio no tiene el programa de lealtad activo." },
        403,
      ),
    };
  }

  // 5. LA APROBACIÓN (0129). Se lee con la llave de servicio porque
  //    desde la 0155 `authenticated` no ve la fila completa, y con la
  //    misma tolerancia que el panel: si la columna no existe todavía,
  //    no se bloquea a nadie.
  const { data: rancho } = await db.from("ranchos").select("*").eq("id", ranchoId).maybeSingle();
  if (
    rancho &&
    "lealtad_aprobado_en" in rancho &&
    rancho.lealtad_aprobado_en === null &&
    !acceso.esAdmin
  ) {
    return {
      ok: false,
      respuesta: jsonApp({ ok: false, motivo: "Tu negocio todavía está en revisión." }, 403),
    };
  }

  // 6. EL PERMISO PUNTUAL.
  if (permiso !== "solo-entrar" && !acceso.permisos[permiso]) {
    return { ok: false, respuesta: jsonApp({ ok: false, motivo: SIN_PERMISO[permiso] }, 403) };
  }

  // 7. EL LÍMITE DE PETICIONES. La clave es la persona EN ese negocio:
  //    quien atiende en dos locales tiene su presupuesto en cada uno.
  const regla = escribe ? LIMITES.appop : LIMITES.applec;
  let conteo: number | null = null;
  try {
    const { data } = await db.rpc("api_rate_limit_tomar", {
      p_ambito: regla.ambito,
      p_clave: `${acceso.usuarioId}:${ranchoId}`,
      p_limite: regla.limite,
      p_ventana_segundos: regla.ventanaSegundos,
    });
    conteo = typeof data === "number" ? data : null;
  } catch {
    conteo = null;
  }

  // FALLA CERRADO, y solo es tolerable por lo que dice `limites.ts`: el
  // `intentoId` es obligatorio en todo lo que escribe, así que el
  // reintento es idempotente y no duplica el sello. Quitar esa
  // obligatoriedad convertiría este 503 en «el sello se perdió».
  if (conteo === null) {
    return {
      ok: false,
      respuesta: jsonApp({ ok: false, motivo: "No se pudo verificar el límite." }, 503),
    };
  }
  if (conteo > regla.limite) {
    return {
      ok: false,
      respuesta: jsonApp(
        { ok: false, motivo: `Demasiadas operaciones seguidas (${regla.descripcion}).` },
        429,
      ),
    };
  }

  return {
    ok: true,
    db,
    usuarioId: acceso.usuarioId,
    permisos: acceso.permisos,
    esAdmin: acceso.esAdmin,
  };
}
