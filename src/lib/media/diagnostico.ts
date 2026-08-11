/**
 * BOOKEA MEDIA — ¿está de verdad configurado Cloudflare?
 *
 * ⚠️ Server-only: toca credenciales.
 *
 * ── POR QUÉ EXISTE ESTO ──────────────────────────────────────────────
 *
 * Antes de mandar 12 pantallas a subir contra R2 hay que poder
 * responder "¿funciona?" sin subir una foto de verdad. Y sobre todo hay
 * que comprobar la CORS del bucket, que es el único error de esta
 * migración que NO se ve hasta que un usuario real intenta subir: sin
 * `if-none-match` en `AllowedHeaders`, el navegador no manda la
 * cabecera, la firma no valida y la subida falla — con el código
 * perfecto y todas las pruebas en verde. Ninguna prueba automática lo
 * puede detectar porque es configuración de la cuenta, no código.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────
 *
 * No devuelve NUNCA el valor de una credencial. Solo dice si está, y si
 * el proveedor contestó. Un diagnóstico que imprime la llave para
 * "ayudar a depurar" es una llave publicada en un log.
 *
 * Tampoco escribe nada: ni sube, ni borra, ni crea. Todas las
 * comprobaciones son de lectura.
 */

import "server-only";

import { GetBucketCorsCommand, HeadObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { configuracionCF } from "./cloudflare-images";
import { configuracionR2, prepararClienteR2 } from "./r2";
import { origenesPermitidos } from "./autenticacion";
import { turnstileConfigurado } from "./turnstile";

/** La cabecera sin la cual toda subida falla. */
const CABECERA_CRITICA = "if-none-match";

export type Chequeo = {
  /** Qué se miró, en palabras de quien lo va a leer. */
  que: string;
  estado: "ok" | "falla" | "aviso";
  /** Qué hacer si no está bien. Nunca trae valores de credenciales. */
  detalle: string;
};

export type DependenciasDiagnostico = {
  entorno?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  /** Inyectable para probar sin red. */
  clienteR2?: S3Client;
};

const ok = (que: string, detalle = ""): Chequeo => ({ que, estado: "ok", detalle });
const falla = (que: string, detalle: string): Chequeo => ({ que, estado: "falla", detalle });
const aviso = (que: string, detalle: string): Chequeo => ({ que, estado: "aviso", detalle });

// ------------------------------------------------------------
// R2
// ------------------------------------------------------------

async function revisarR2(deps: DependenciasDiagnostico): Promise<Chequeo[]> {
  const entorno = deps.entorno ?? process.env;
  const config = configuracionR2(entorno);

  if (!config.ok) {
    // El mensaje de `configuracionR2` nombra las variables que faltan,
    // nunca sus valores.
    return [falla("R2 · variables", config.error.mensaje)];
  }

  const listo = prepararClienteR2({ entorno, cliente: deps.clienteR2 });
  if (!listo.ok) return [falla("R2 · cliente", listo.error.mensaje)];

  const salida: Chequeo[] = [ok("R2 · variables", "Las cinco están puestas.")];

  // ── Credenciales y bucket ──
  //
  // Un HEAD sobre una clave que no existe es la prueba más barata: si
  // las credenciales o el bucket estuvieran mal, el error sería de
  // permisos o de bucket inexistente, no un 404 limpio.
  try {
    await listo.valor.cliente.send(
      new HeadObjectCommand({
        Bucket: listo.valor.config.bucket,
        Key: `diagnostico/no-existe-${"0".repeat(8)}`,
      }),
    );
    salida.push(ok("R2 · credenciales", "El bucket responde."));
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "?";
    const http =
      typeof e === "object" && e !== null && "$metadata" in e
        ? (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;

    if (nombre === "NotFound" || http === 404) {
      // Es lo esperado: llegamos, nos autenticaron, el objeto no está.
      salida.push(ok("R2 · credenciales", "El bucket responde y autentica."));
    } else if (http === 403) {
      salida.push(
        falla(
          "R2 · credenciales",
          "R2 rechazó la autenticación (403). Revisá el Access Key, el Secret y que el token tenga permiso sobre este bucket.",
        ),
      );
    } else {
      salida.push(
        falla("R2 · credenciales", `R2 respondió un error inesperado (${nombre}${http ? `, HTTP ${http}` : ""}).`),
      );
    }
  }

  // ── LA CORS, que es lo que rompe en silencio ──
  try {
    const cors = await listo.valor.cliente.send(
      new GetBucketCorsCommand({ Bucket: listo.valor.config.bucket }),
    );
    const reglas = cors.CORSRules ?? [];

    if (reglas.length === 0) {
      salida.push(falla("R2 · CORS", "El bucket no tiene ninguna regla de CORS: el navegador no va a poder subir."));
    } else {
      const cabeceras = reglas
        .flatMap((r) => r.AllowedHeaders ?? [])
        .map((h) => h.toLowerCase());
      const admiteTodo = cabeceras.includes("*");
      const admiteCritica = admiteTodo || cabeceras.includes(CABECERA_CRITICA);

      salida.push(
        admiteCritica
          ? ok("R2 · CORS · if-none-match", "Permitida. La escritura única va a funcionar.")
          : falla(
              "R2 · CORS · if-none-match",
              "FALTA en AllowedHeaders. Sin esto TODAS las subidas fallan aunque el resto esté bien. Agregala en Settings → CORS Policy del bucket.",
            ),
      );

      const metodos = reglas.flatMap((r) => r.AllowedMethods ?? []).map((m) => m.toUpperCase());
      salida.push(
        metodos.includes("PUT")
          ? ok("R2 · CORS · PUT", "Permitido.")
          : falla("R2 · CORS · PUT", "FALTA en AllowedMethods: el navegador no puede subir."),
      );

      // Los orígenes de la app tienen que estar en la lista del bucket.
      const permitidos = reglas.flatMap((r) => r.AllowedOrigins ?? []);
      const faltantes = origenesPermitidos(entorno).filter(
        (o) => !permitidos.includes("*") && !permitidos.includes(o),
      );
      salida.push(
        faltantes.length === 0
          ? ok("R2 · CORS · orígenes", "Los de la app están en la lista del bucket.")
          : aviso(
              "R2 · CORS · orígenes",
              `Estos no están en la CORS del bucket: ${faltantes.join(", ")}. Desde ahí no se va a poder subir.`,
            ),
      );
    }
  } catch {
    salida.push(
      aviso(
        "R2 · CORS",
        "No se pudo leer la configuración de CORS. El token de R2 puede no tener permiso para leerla; revisala a mano en el panel.",
      ),
    );
  }

  return salida;
}

// ------------------------------------------------------------
// Cloudflare Images
// ------------------------------------------------------------

async function revisarImages(deps: DependenciasDiagnostico): Promise<Chequeo[]> {
  const entorno = deps.entorno ?? process.env;
  const config = configuracionCF(entorno);
  if (!config.ok) return [falla("Cloudflare Images · variables", config.error.mensaje)];

  const salida: Chequeo[] = [ok("Cloudflare Images · variables", "Las cinco están puestas.")];

  // Se pide la lista de variantes: prueba el token y de paso deja ver si
  // las cuatro que el código pide existen de verdad en la cuenta.
  const hacerFetch = deps.fetch ?? fetch;
  try {
    const r = await hacerFetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.valor.accountId}/images/v1/variants`,
      {
        headers: { Authorization: `Bearer ${config.valor.apiToken}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const cuerpo: unknown = await r.json();

    if (!r.ok || (cuerpo as { success?: boolean })?.success !== true) {
      salida.push(
        falla(
          "Cloudflare Images · token",
          `Cloudflare rechazó la consulta (HTTP ${r.status}). Revisá que el token tenga permiso "Cloudflare Images: Edit".`,
        ),
      );
      return salida;
    }

    salida.push(ok("Cloudflare Images · token", "Autentica correctamente."));

    // `variants` viene como objeto con las variantes por clave.
    const result = (cuerpo as { result?: { variants?: Record<string, unknown> } }).result;
    const existentes = Object.keys(result?.variants ?? {});
    const faltantes = ["thumb", "card", "gallery", "hero"].filter((v) => !existentes.includes(v));

    salida.push(
      faltantes.length === 0
        ? ok("Cloudflare Images · variantes", "Las cuatro existen: thumb, card, gallery, hero.")
        : falla(
            "Cloudflare Images · variantes",
            `Faltan estas variantes: ${faltantes.join(", ")}. Los nombres tienen que ser exactos.`,
          ),
    );
  } catch {
    salida.push(falla("Cloudflare Images · token", "No se pudo hablar con la API de Cloudflare."));
  }

  return salida;
}

// ------------------------------------------------------------
// El resto
// ------------------------------------------------------------

function revisarEntorno(deps: DependenciasDiagnostico): Chequeo[] {
  const entorno = deps.entorno ?? process.env;
  const salida: Chequeo[] = [];

  salida.push(
    turnstileConfigurado(entorno)
      ? ok("Turnstile · secret", "Puesta. Las subidas anónimas están protegidas.")
      : falla(
          "Turnstile · secret",
          "Falta TURNSTILE_SECRET_KEY. En producción las subidas de álbumes y comprobantes se van a RECHAZAR.",
        ),
  );

  salida.push(
    entorno.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
      ? ok("Turnstile · site key", "Puesta.")
      : falla("Turnstile · site key", "Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY: el widget no se va a poder dibujar."),
  );

  const origenes = origenesPermitidos(entorno);
  salida.push(
    origenes.length > 0
      ? ok("Orígenes permitidos", origenes.join(", "))
      : falla("Orígenes permitidos", "Ninguno configurado: en producción la API va a responder 503."),
  );

  const sal = (entorno.MEDIA_IP_SALT ?? entorno.VISITAS_SALT ?? "").trim();
  salida.push(
    sal
      ? ok("Sal para el HMAC de IP", "Puesta.")
      : aviso(
          "Sal para el HMAC de IP",
          "Sin MEDIA_IP_SALT ni VISITAS_SALT no se puede limitar por IP. Se sigue limitando por capacidad, pero es más flojo.",
        ),
  );

  return salida;
}

// ------------------------------------------------------------

export type Diagnostico = {
  listo: boolean;
  chequeos: Chequeo[];
  fallas: number;
  avisos: number;
};

/** Corre todo. Nunca lanza: cada bloque reporta su propio problema. */
export async function diagnosticarMedia(
  deps: DependenciasDiagnostico = {},
): Promise<Diagnostico> {
  const [r2, images] = await Promise.all([revisarR2(deps), revisarImages(deps)]);
  const chequeos = [...r2, ...images, ...revisarEntorno(deps)];
  const fallas = chequeos.filter((c) => c.estado === "falla").length;
  return {
    listo: fallas === 0,
    chequeos,
    fallas,
    avisos: chequeos.filter((c) => c.estado === "aviso").length,
  };
}
