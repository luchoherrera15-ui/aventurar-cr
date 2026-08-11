/**
 * BOOKEA MEDIA — subir un archivo desde el navegador.
 *
 * Esta es la pieza que faltaba: los endpoints estaban hechos y probados,
 * pero ninguna pantalla sabía hablarles.
 *
 * NO es server-only y no toca `process.env`: corre en el navegador.
 *
 * ── LOS TRES PASOS, Y POR QUÉ SON TRES ───────────────────────────────
 *
 *   1. /api/media/sesion    reserva el lugar y devuelve una URL firmada
 *   2. PUT a R2             el archivo va DIRECTO, sin pasar por Vercel
 *   3. /api/media/confirmar el servidor verifica y recién ahí sella
 *
 * El paso 2 no pasa por nuestro servidor a propósito: Vercel corta el
 * cuerpo de un request cerca de 4,5 MB y los originales pasan de eso.
 *
 * ── LO QUE HAY QUE MANDAR EXACTO ─────────────────────────────────────
 *
 * Las cabeceras del PUT vienen del servidor y se mandan TAL CUAL. Van
 * dentro de la firma: cambiar una, o agregar otra, invalida la URL. En
 * particular `If-None-Match: *`, que es lo que hace que la subida sea de
 * escritura única — un segundo PUT contra la misma clave devuelve 412 en
 * vez de pisar un archivo ya verificado.
 *
 * `Content-Length` NO se manda: es una *forbidden header name*, el
 * navegador la ignora si se intenta poner y la manda sola con el tamaño
 * real. Por eso el servidor tampoco la incluye.
 */

export type ProgresoSubida = { subidos: number; total: number; porcentaje: number };

export type ResultadoSubida =
  | { ok: true; assetId: string; url: string | null; reutilizada: boolean }
  | { ok: false; mensaje: string; codigo: string };

export type EntidadSubida = {
  tipo: "rancho" | "rancho_item" | "equipo";
  id: string;
};

export type OpcionesSubida = {
  archivo: File;
  entidad: EntidadSubida;
  /** Para cambiar una foto existente sin que la galería se quede vacía. */
  reemplazaAssetId?: string | null;
  onProgreso?: (p: ProgresoSubida) => void;
  senal?: AbortSignal;
};

export type DependenciasSubida = {
  fetch?: typeof fetch;
  /** El PUT va por XHR para poder informar progreso; inyectable en tests. */
  subirABucket?: (params: {
    url: string;
    cabeceras: Record<string, string>;
    archivo: File;
    onProgreso?: (p: ProgresoSubida) => void;
    senal?: AbortSignal;
  }) => Promise<{ ok: true } | { ok: false; estado: number }>;
  nuevaSolicitud?: () => string;
};

const fallo = (codigo: string, mensaje: string): ResultadoSubida => ({ ok: false, codigo, mensaje });

/**
 * El PUT con progreso.
 *
 * `fetch` no informa progreso de SUBIDA (solo de bajada), y para una foto
 * de varios megas en una conexión de celular una barra que no se mueve
 * es indistinguible de una app colgada. XHR sí lo informa.
 */
function subirPorXhr(params: {
  url: string;
  cabeceras: Record<string, string>;
  archivo: File;
  onProgreso?: (p: ProgresoSubida) => void;
  senal?: AbortSignal;
}): Promise<{ ok: true } | { ok: false; estado: number }> {
  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", params.url, true);

    for (const [k, v] of Object.entries(params.cabeceras)) {
      xhr.setRequestHeader(k, v);
    }

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !params.onProgreso) return;
      params.onProgreso({
        subidos: e.loaded,
        total: e.total,
        porcentaje: Math.round((e.loaded / e.total) * 100),
      });
    };

    xhr.onload = () =>
      resolver(
        xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, estado: xhr.status },
      );
    // Un fallo de red no trae estado: 0 lo distingue de una respuesta.
    xhr.onerror = () => resolver({ ok: false, estado: 0 });
    xhr.onabort = () => resolver({ ok: false, estado: 0 });

    if (params.senal) {
      params.senal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(params.archivo);
  });
}

/** Lee el `codigo`/`mensaje` que devuelven los endpoints. */
async function leerError(r: Response): Promise<{ codigo: string; mensaje: string }> {
  try {
    const cuerpo = (await r.json()) as { codigo?: string; mensaje?: string };
    return {
      codigo: cuerpo.codigo ?? `http-${r.status}`,
      mensaje: cuerpo.mensaje ?? "No se pudo subir el archivo.",
    };
  } catch {
    return { codigo: `http-${r.status}`, mensaje: "No se pudo subir el archivo." };
  }
}

/**
 * Sube un archivo y devuelve su URL pública, ya lista para guardar.
 *
 * El `solicitud_id` se genera UNA vez y se reutiliza: si algo se corta y
 * se vuelve a llamar con el mismo, el servidor devuelve el MISMO asset y
 * vuelve a firmar su misma clave en vez de crear una fila nueva y otro
 * objeto huérfano en R2.
 */
export async function subirArchivo(
  opciones: OpcionesSubida,
  deps: DependenciasSubida = {},
): Promise<ResultadoSubida> {
  const hacerFetch = deps.fetch ?? fetch;
  const alBucket = deps.subirABucket ?? subirPorXhr;
  const solicitudId = (deps.nuevaSolicitud ?? (() => crypto.randomUUID()))();

  // ---------- 1. Reservar y firmar ----------
  let sesion: Response;
  try {
    sesion = await hacerFetch("/api/media/sesion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      signal: opciones.senal,
      body: JSON.stringify({
        solicitud_id: solicitudId,
        entity_type: opciones.entidad.tipo,
        entity_id: opciones.entidad.id,
        mime: opciones.archivo.type,
        bytes: opciones.archivo.size,
        nombre: opciones.archivo.name,
        reemplaza_asset_id: opciones.reemplazaAssetId ?? null,
      }),
    });
  } catch {
    return fallo("sin-red", "No hay conexión. Revisá tu internet y probá de nuevo.");
  }

  if (!sesion.ok) {
    const e = await leerError(sesion);
    return fallo(e.codigo, e.mensaje);
  }

  const datos = (await sesion.json()) as {
    asset_id: string;
    subida: { url: string; cabeceras: Record<string, string> };
  };

  // ---------- 2. El archivo, directo a R2 ----------
  const puesto = await alBucket({
    url: datos.subida.url,
    cabeceras: datos.subida.cabeceras,
    archivo: opciones.archivo,
    onProgreso: opciones.onProgreso,
    senal: opciones.senal,
  });

  if (!puesto.ok) {
    if (puesto.estado === 412) {
      // `If-None-Match: *` hizo su trabajo: esa clave ya tiene un objeto.
      return fallo("ya-usada", "Esa subida ya se había usado. Volvé a intentar.");
    }
    if (puesto.estado === 403) {
      return fallo("permiso-vencido", "Se venció el permiso de subida. Probá de nuevo.");
    }
    return fallo("fallo-subida", "No se pudo subir el archivo. Revisá tu conexión y probá de nuevo.");
  }

  // ---------- 3. Confirmar ----------
  //
  // Recién acá el servidor comprueba el tamaño, el tipo declarado y la
  // FIRMA REAL del archivo antes de darlo por bueno. Hasta este punto lo
  // subido no se muestra en ningún lado.
  let confirmacion: Response;
  try {
    confirmacion = await hacerFetch("/api/media/confirmar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      signal: opciones.senal,
      body: JSON.stringify({ asset_id: datos.asset_id }),
    });
  } catch {
    return fallo("sin-red", "El archivo subió pero no se pudo confirmar. Probá de nuevo.");
  }

  if (!confirmacion.ok) {
    const e = await leerError(confirmacion);
    return fallo(e.codigo, e.mensaje);
  }

  const fin = (await confirmacion.json()) as {
    asset_id: string;
    url: string | null;
    ya_estaba?: boolean;
  };

  return {
    ok: true,
    assetId: fin.asset_id,
    url: fin.url ?? null,
    reutilizada: fin.ya_estaba === true,
  };
}

/**
 * Varias fotos, de a poco.
 *
 * De a `MAX_A_LA_VEZ` y no todas juntas: veinte PUT simultáneos desde un
 * celular se pisan entre sí y terminan más lento que en tandas, además
 * de disparar el límite antiabuso del servidor.
 */
export const MAX_A_LA_VEZ = 3;

export async function subirVarios(
  archivos: File[],
  entidad: EntidadSubida,
  opciones: {
    onProgresoTotal?: (hechos: number, total: number) => void;
    senal?: AbortSignal;
  } = {},
  deps: DependenciasSubida = {},
): Promise<ResultadoSubida[]> {
  const resultados: ResultadoSubida[] = [];

  for (let i = 0; i < archivos.length; i += MAX_A_LA_VEZ) {
    const tanda = archivos.slice(i, i + MAX_A_LA_VEZ);
    const hechos = await Promise.all(
      tanda.map((archivo) => subirArchivo({ archivo, entidad, senal: opciones.senal }, deps)),
    );
    resultados.push(...hechos);
    opciones.onProgresoTotal?.(resultados.length, archivos.length);

    // Si se cancela, no se sigue con la tanda siguiente.
    if (opciones.senal?.aborted) break;
  }

  return resultados;
}
