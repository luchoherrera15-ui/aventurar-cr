import { supabase } from "./supabase";

/**
 * ════════════════════════════════════════════════════════════════════
 *  BOOKEA LEALTAD DENTRO DEL APP
 * ════════════════════════════════════════════════════════════════════
 *
 * Hasta ahora el app NO administraba lealtad: la pantalla `lealtad.tsx`
 * explicaba el producto y abría el panel de la web en un navegador.
 * Pedido del dueño (26 ago 2026): que en el panel de negocios haya un
 * botón «Pases de fidelidad» —solo para las cuentas que tengan uno— y
 * que adentro se pueda escanear, mandar avisos y ver los datos, con la
 * misma información que la web pero hecho para el teléfono.
 *
 * ── EL BACKEND YA ESTABA, Y ESO CAMBIA EL TAMAÑO DEL TRABAJO ────────
 *
 * No hay que inventar ninguna regla: `src/app/api/lealtad/app/*` ya
 * expone panel, acreditar, canjear, afiliar y clientes, todos apoyados
 * en `operar-core` — el MISMO código que corre el mostrador de la web.
 * Este módulo es el cliente HTTP de esa capa, nada más.
 *
 * ── LA IDENTIDAD VA EN EL BEARER, NUNCA EN UNA COOKIE ───────────────
 *
 * `abrirPuertaApp` (del lado del servidor) lee el token de la cabecera
 * `Authorization` y NUNCA se cae a la cookie. Tiene que ser así: en el
 * teléfono no hay cookies, y una puerta que aceptara las dos podría
 * confundir la sesión del navegador embebido con la del app.
 */

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * ⚠️ EL ÁPEX NO SIRVE, Y NO ES UN DETALLE.
 *
 * `bookea.lat` responde 308 hacia `www`. Un POST que cae en un 308
 * puede perder el cuerpo o el método según el cliente, y las cabeceras
 * de autorización se descartan al cruzar de host. Este repo ya se quemó
 * con esto: los pases de Wallet salieron mudos durante semanas porque
 * `NEXT_PUBLIC_SITE_URL` apuntaba al ápex (ver `SITIO_URL` en
 * src/lib/wallet/generar.ts).
 *
 * Se corrige acá, gane quien gane la variable de entorno.
 */
const BASE = SITIO_URL.replace(/^https:\/\/bookea\.lat(?=\/|$)/, "https://www.bookea.lat");

export type RespuestaApp<T> = { ok: true; datos: T } | { ok: false; motivo: string };

/**
 * Una llamada a la capa del app, con la sesión del usuario.
 *
 * Devuelve un resultado en vez de lanzar: esto se usa en el mostrador,
 * con un cliente enfrente, y una excepción sin atrapar deja la pantalla
 * en blanco en el peor momento posible.
 */
async function pedir<T>(
  ruta: string,
  opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {},
): Promise<RespuestaApp<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, motivo: "Sesión vencida. Entrá de nuevo." };

  try {
    const r = await fetch(`${BASE}/api/lealtad/app/${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opciones.cuerpo ? { "Content-Type": "application/json" } : {}),
      },
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    });

    const cuerpo = (await r.json().catch(() => null)) as
      | ({ ok?: boolean; motivo?: string } & Record<string, unknown>)
      | null;

    if (!r.ok || cuerpo?.ok === false) {
      return { ok: false, motivo: cuerpo?.motivo ?? `No se pudo completar (${r.status}).` };
    }
    return { ok: true, datos: cuerpo as T };
  } catch {
    // Sin red, o el sitio caído. En una caja eso pasa seguido.
    return { ok: false, motivo: "Sin conexión. Probá de nuevo en un momento." };
  }
}

/**
 * ¿ESTE NEGOCIO TIENE PASES DE FIDELIDAD?
 *
 * Decide si el botón se dibuja en el panel. Va por una consulta directa
 * y no por `/app/panel`: es una pregunta de sí o no que se hace al
 * abrir la pantalla, y traer el panel entero para decidir si mostrar un
 * botón sería pagar el viaje caro por el dato barato.
 *
 * La política «El dueño administra su programa» (0060) deja que el
 * dueño lea la fila con la llave anónima, así que no hace falta pasar
 * por el servidor.
 *
 * Ante la duda devuelve `false`: es mejor no ofrecer un botón que
 * ofrecer uno que lleva a una pantalla vacía.
 */
export async function tienePasesDeFidelidad(negocioId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", negocioId)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/** Lo que la pantalla necesita, en un solo viaje (ver el endpoint). */
export type PanelLealtad = Record<string, unknown>;

export function cargarPanelLealtad(negocioId: string) {
  return pedir<PanelLealtad>(`panel?ranchoId=${encodeURIComponent(negocioId)}`);
}

/**
 * LO QUE DEVUELVE ACREDITAR.
 *
 * ⚠️ `ok: true` SIGNIFICA «LA OPERACIÓN SE RESOLVIÓ», NO «SE SUMÓ».
 *
 * Cuando `yaEstaba` viene en true no entró nada: esa lectura ya se
 * había acreditado antes. La pantalla TIENE que decir cosas distintas
 * en los dos casos. El aviso está escrito en `operar-core.ts` porque ya
 * pasó: el dueño escaneó de más, vio «¡Sello sumado!» cada vez, el
 * saldo no se movía, y reportó que el sistema no entregaba los sellos.
 */
export type SelloAcreditado = {
  cliente: string;
  /** Lo que ENTRÓ en esta operación. 0 cuando `yaEstaba`. */
  puntos: number;
  saldo: number;
  /** true = esta lectura ya había entrado. NO se sumó nada. */
  yaEstaba: boolean;
  /** Para ofrecer el canje sin volver a escanear. */
  miembroId: string;
  /** El programa de la tarjeta LEÍDA, no el principal del negocio. */
  programaId: string;
  tipo: string;
};

/**
 * EL `intentoId` NO ES OPCIONAL, Y ES LO QUE SALVA EL SELLO.
 *
 * El endpoint responde 400 sin tocar la base si falta. Eso es a
 * propósito: es lo que hace que reintentar con mala señal sea seguro —
 * el segundo envío con el MISMO id no acredita dos veces. Por eso se
 * genera UNA vez por operación y se reusa en los reintentos, en vez de
 * generarlo adentro de esta función.
 *
 * `programaId` NO se manda: el endpoint resuelve solo cuál es la
 * tarjeta a partir del serial o del miembro, y de hecho devuelve cuál
 * fue. Pedirlo acá obligaría a quien llama a averiguar un dato que el
 * servidor ya sabe mejor.
 */
export function acreditarSello(datos: {
  negocioId: string;
  intentoId: string;
  /** El `serial_number` que venía en el QR. */
  serial?: string;
  /** O el miembro, cuando se buscó a mano. */
  miembroId?: string;
  /** Monto de la compra, en los tipos que lo piden. */
  monto?: number;
}) {
  return pedir<SelloAcreditado>("acreditar", {
    metodo: "POST",
    cuerpo: {
      ranchoId: datos.negocioId,
      intentoId: datos.intentoId,
      serial: datos.serial,
      miembroId: datos.miembroId,
      monto: datos.monto,
    },
  });
}
export function canjearPremio(datos: {
  negocioId: string;
  miembroId: string;
  recompensaId: string;
  intentoId: string;
}) {
  return pedir<{ saldo: number; recompensa: string }>("canjear", {
    metodo: "POST",
    cuerpo: {
      ranchoId: datos.negocioId,
      miembroId: datos.miembroId,
      recompensaId: datos.recompensaId,
      intentoId: datos.intentoId,
    },
  });
}
