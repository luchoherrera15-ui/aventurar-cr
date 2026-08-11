import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  manejarConfirmar,
  manejarSesion,
  manejarSesionAnonima,
  type ClienteRpc,
  type DependenciasServicio,
  type ErrorRpc,
} from "./servicio";
import { hashDeToken } from "./capacidad";
import type { Autenticacion } from "./autenticacion";

// ------------------------------------------------------------
// Andamiaje
//
// Todo lo que sale del proceso está simulado. Si algún día un cambio
// hace que una de estas funciones salga de verdad a la red, el test
// falla con "sin doble para X" en vez de colgarse o —peor— tocar una
// cuenta real.
// ------------------------------------------------------------

const ORIGEN = "https://bookea.lat";

const ENTORNO = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SITE_URL: ORIGEN,
  VISITAS_SALT: "sal-de-prueba",
  TURNSTILE_SECRET_KEY: "no-se-usa-porque-turnstile-esta-simulado",
} as unknown as NodeJS.ProcessEnv;

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_ASSET = "33333333-3333-4333-8333-333333333333";
const UUID_USUARIO = "44444444-4444-4444-8444-444444444444";

type Respuesta = { data?: unknown; error?: ErrorRpc | null };

/**
 * Un doble de Supabase que solo entiende `rpc`.
 *
 * Cada función se declara con su respuesta —o con una cola de
 * respuestas, para probar la segunda llamada— y se registra todo lo que
 * se le pidió, que es lo que permite afirmar cosas como "no se llamó a
 * finalizar_cloudflare".
 */
function clienteFalso(guion: Record<string, Respuesta | Respuesta[]>) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const colas = new Map<string, Respuesta[]>();
  for (const [k, v] of Object.entries(guion)) colas.set(k, Array.isArray(v) ? [...v] : [v]);

  const cliente: ClienteRpc = {
    async rpc(nombre, args = {}) {
      llamadas.push({ fn: nombre, args });
      const cola = colas.get(nombre);
      if (!cola || cola.length === 0) {
        throw new Error(`sin doble para ${nombre}`);
      }
      const r = cola.length === 1 ? cola[0] : cola.shift()!;
      return { data: r.data ?? null, error: r.error ?? null };
    },
  };
  return {
    cliente,
    llamadas,
    hubo: (fn: string) => llamadas.some((l) => l.fn === fn),
    args: (fn: string) => llamadas.find((l) => l.fn === fn)?.args,
    veces: (fn: string) => llamadas.filter((l) => l.fn === fn).length,
  };
}

/** Una fila de `returns table (...)`, tal como la manda PostgREST. */
const fila = (o: Record<string, unknown>): Respuesta => ({ data: [o] });

const autenticado = (
  usuarioId = UUID_USUARIO,
  via: "bearer" | "cookie" = "cookie",
): DependenciasServicio["autenticar"] =>
  async () =>
    ({
      ok: true,
      actor: { usuarioId, supabase: usuarioClienteActual, via },
    }) as unknown as Autenticacion;

const rechazado = (
  http: 401 | 403 | 503,
): DependenciasServicio["autenticar"] =>
  async () => ({ ok: false, motivo: "sin-credencial", http, mensaje: "no" }) as Autenticacion;

/** El cliente que `autenticado()` entrega como si fuera el del usuario. */
let usuarioClienteActual: ClienteRpc;

// ---- Dobles de R2 y Cloudflare ----

const okR2 = <T,>(valor: T) => ({ ok: true as const, valor });
const errR2 = (codigo: string, mensaje = "detalle interno") => ({
  ok: false as const,
  error: { codigo, mensaje },
});

type Deps = DependenciasServicio;

/** El escenario feliz: nada existe todavía, todo firma, todo verifica. */
function depsBase(extra: Partial<Deps> = {}): Deps {
  return {
    entorno: ENTORNO,
    registrar: () => {},
    existeObjeto: (async () => okR2(false)) as Deps["existeObjeto"],
    borrarObjeto: (async (p: { clave: string }) => okR2({ clave: p.clave })) as Deps["borrarObjeto"],
    firmarSubida: (async (p: { clave: string; mime: string }) =>
      okR2({
        url: "https://r2.example/objeto?X-Amz-Signature=FIRMA_SECRETA",
        clave: p.clave,
        cabeceras: { "Content-Type": p.mime, "If-None-Match": "*" },
        expiraEnSegundos: 1800,
      })) as Deps["firmarSubida"],
    firmarDescarga: (async () =>
      okR2({
        url: "https://r2.example/descarga?X-Amz-Signature=FIRMA_SECRETA",
        expiraEnSegundos: 300,
        nombreArchivo: "original.jpg",
      })) as Deps["firmarDescarga"],
    verificarMetadatos: (async () =>
      okR2({
        metadatos: { clave: "k", bytes: 1000, mime: "image/jpeg", etag: null, modificadoEn: null },
        comprobado: ["existe", "bytes", "content-type-declarado"],
        sinComprobar: ["contenido-real", "magic-bytes", "checksum-sha256"],
      })) as Deps["verificarMetadatos"],
    analizarFirma: (async () =>
      okR2({
        veredicto: "compatible",
        bloqueaSello: false,
        mimeDeclarado: "image/jpeg",
        mimeDetectado: "image/jpeg",
        extensionDetectada: "jpg",
        bytesLeidos: 1024,
        motivo: "La firma coincide con image/jpeg.",
        equivalencia: null,
        mejorEsfuerzo: false,
      })) as Deps["analizarFirma"],
    importarImagen: (async () =>
      okR2({
        id: "cf-imagen-1",
        subidaEn: "2026-08-10T00:00:00Z",
        requiereFirma: true,
        variantes: [],
      })) as Deps["importarImagen"],
    borrarImagen: (async () => okR2({ id: "cf-imagen-1" })) as Deps["borrarImagen"],
    verificarTurnstile: (async () => ({ ok: true, via: "verificado" })) as Deps["verificarTurnstile"],
    nuevoToken: () => "TOKEN-EN-CLARO-DE-PRUEBA",
    buscarAlbumActivo: async (slug: string) => (slug === "boda-ana" ? UUID_A : null),
    ...extra,
  };
}

function peticion(cuerpo: unknown, opciones: { origen?: string | null; metodo?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const origen = opciones.origen === undefined ? ORIGEN : opciones.origen;
  if (origen) headers.origin = origen;
  return new Request("https://bookea.lat/api/media/sesion", {
    method: opciones.metodo ?? "POST",
    headers,
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

async function leer(res: Response) {
  const texto = await res.text();
  return { status: res.status, texto, cuerpo: JSON.parse(texto) as Record<string, unknown> };
}

const CUERPO_SESION = {
  solicitud_id: UUID_B,
  entity_type: "rancho",
  entity_id: UUID_A,
  mime: "image/jpeg",
  bytes: 1000,
  nombre: "foto.jpg",
};

const CUERPO_ALBUM = {
  tipo: "album",
  album_slug: "boda-ana",
  turnstile: "tok",
  solicitud_id: UUID_B,
  mime: "image/jpeg",
  bytes: 1000,
  nombre: "foto.jpg",
};

beforeEach(() => {
  usuarioClienteActual = clienteFalso({}).cliente;
});

// ============================================================
// 1. /api/media/sesion — autenticado
// ============================================================

describe("sesion: validación del cuerpo", () => {
  it("un cuerpo de más de 8 KiB se rechaza con 413", async () => {
    const gordo = JSON.stringify({ ...CUERPO_SESION, relleno: "x".repeat(9000) });
    const res = await manejarSesion(peticion(gordo), depsBase());
    const r = await leer(res);
    expect(r.status).toBe(413);
    expect(r.cuerpo.codigo).toBe("cuerpo-muy-grande");
  });

  it("un JSON roto o un arreglo dan 400", async () => {
    for (const cuerpo of ["{no es json", "[1,2,3]", '"texto"']) {
      const res = await manejarSesion(peticion(cuerpo), depsBase());
      expect((await leer(res)).status, cuerpo).toBe(400);
    }
  });

  it("faltando o mal formado cualquier campo obligatorio → 400", async () => {
    const casos: Record<string, unknown>[] = [
      { ...CUERPO_SESION, solicitud_id: "no-es-uuid" },
      { ...CUERPO_SESION, entity_id: 42 },
      { ...CUERPO_SESION, nombre: "" },
      { ...CUERPO_SESION, bytes: "1000" },
      { ...CUERPO_SESION, bytes: 0 },
      { ...CUERPO_SESION, bytes: 1.5 },
      { ...CUERPO_SESION, mime: undefined },
      { ...CUERPO_SESION, reemplaza_asset_id: "basura" },
    ];
    for (const c of casos) {
      const res = await manejarSesion(peticion(c), depsBase());
      expect((await leer(res)).status, JSON.stringify(c).slice(0, 60)).toBe(400);
    }
  });

  it("un archivo de más de 10 MiB es 413, no 400", async () => {
    const res = await manejarSesion(
      peticion({ ...CUERPO_SESION, bytes: 10 * 1024 * 1024 + 1 }),
      depsBase(),
    );
    const r = await leer(res);
    expect(r.status).toBe(413);
    expect(r.cuerpo.codigo).toBe("archivo-muy-grande");
  });

  it("una entidad que existe pero no está habilitada es 422, no 400", async () => {
    const res = await manejarSesion(
      peticion({ ...CUERPO_SESION, entity_type: "invitacion" }),
      depsBase(),
    );
    const r = await leer(res);
    expect(r.status).toBe(422);
    expect(r.cuerpo.codigo).toBe("fuera-de-alcance");
  });

  it("un MIME que el sistema no conoce es 400", async () => {
    const res = await manejarSesion(
      peticion({ ...CUERPO_SESION, mime: "application/x-msdownload" }),
      depsBase(),
    );
    expect((await leer(res)).status).toBe(400);
  });

  it("un video (conocido pero no habilitado) es 422", async () => {
    const res = await manejarSesion(peticion({ ...CUERPO_SESION, mime: "video/mp4" }), depsBase());
    expect((await leer(res)).status).toBe(422);
  });

  it("la validación ocurre ANTES de autenticar: no se toca Supabase", async () => {
    const autenticar = vi.fn(autenticado());
    await manejarSesion(peticion({ mal: true }), depsBase({ autenticar }));
    expect(autenticar).not.toHaveBeenCalled();
  });
});

describe("sesion: autenticación", () => {
  it("sin credencial → 401", async () => {
    const res = await manejarSesion(
      peticion(CUERPO_SESION),
      depsBase({ autenticar: rechazado(401) }),
    );
    const r = await leer(res);
    expect(r.status).toBe(401);
    expect(r.cuerpo.codigo).toBe("sin-sesion");
  });

  it("origen no permitido → 403", async () => {
    const res = await manejarSesion(
      peticion(CUERPO_SESION),
      depsBase({ autenticar: rechazado(403) }),
    );
    expect((await leer(res)).status).toBe(403);
  });

  it("sin configuración de orígenes en producción → 503", async () => {
    const res = await manejarSesion(
      peticion(CUERPO_SESION),
      depsBase({ autenticar: rechazado(503) }),
    );
    expect((await leer(res)).status).toBe(503);
  });

  it("funciona igual por cookie que por bearer", async () => {
    for (const via of ["cookie", "bearer"] as const) {
      const usuario = clienteFalso({
        media_reservar: fila({
          codigo: "creada",
          asset_id: UUID_ASSET,
          posicion: 0,
          estado: "pendiente",
          reserva_expira_en: "2026-08-10T01:00:00Z",
        }),
      });
      usuarioClienteActual = usuario.cliente;
      const admin = clienteFalso({
        media_datos_para_clave: fila({
          propietario_id: UUID_USUARIO,
          entity_type: "rancho",
          entity_id: UUID_A,
          mime: "image/jpeg",
          estado: "pendiente",
          solo_r2: false,
        }),
        media_preparar_subida: fila({ codigo: "asignada", estado: "subiendo" }),
      });
      const res = await manejarSesion(
        peticion(CUERPO_SESION),
        depsBase({ autenticar: autenticado(UUID_USUARIO, via), admin: () => admin.cliente }),
      );
      expect((await leer(res)).status, via).toBe(201);
    }
  });

  it("la reserva usa el cliente DEL USUARIO, no el de service_role", async () => {
    // `media_reservar` lee `auth.uid()` adentro: con service_role sería
    // null y la función abortaría. Es la única llamada que no va por el
    // admin, y por eso se comprueba explícitamente.
    const usuario = clienteFalso({
      media_reservar: fila({ codigo: "creada", asset_id: UUID_ASSET, posicion: 0 }),
    });
    usuarioClienteActual = usuario.cliente;
    const admin = clienteFalso({
      media_datos_para_clave: fila({
        propietario_id: UUID_USUARIO,
        entity_type: "rancho",
        entity_id: UUID_A,
        mime: "image/jpeg",
        estado: "pendiente",
      }),
      media_preparar_subida: fila({ codigo: "asignada" }),
    });
    await manejarSesion(
      peticion(CUERPO_SESION),
      depsBase({ autenticar: autenticado(), admin: () => admin.cliente }),
    );
    expect(usuario.hubo("media_reservar")).toBe(true);
    expect(admin.hubo("media_reservar")).toBe(false);
  });
});

describe("sesion: respuestas de media_reservar", () => {
  const conReserva = (respuesta: Respuesta, extraAdmin: Record<string, Respuesta> = {}) => {
    const usuario = clienteFalso({ media_reservar: respuesta });
    usuarioClienteActual = usuario.cliente;
    const admin = clienteFalso({
      media_datos_para_clave: fila({
        propietario_id: UUID_USUARIO,
        entity_type: "rancho",
        entity_id: UUID_A,
        mime: "image/jpeg",
        estado: "pendiente",
      }),
      media_preparar_subida: fila({ codigo: "asignada" }),
      ...extraAdmin,
    });
    return { usuario, admin, deps: depsBase({ autenticar: autenticado(), admin: () => admin.cliente }) };
  };

  it("creada → 201 con la URL firmada y las cabeceras que el navegador puede poner", async () => {
    const { deps } = conReserva(
      fila({ codigo: "creada", asset_id: UUID_ASSET, posicion: 3, reserva_expira_en: "X" }),
    );
    const res = await manejarSesion(peticion(CUERPO_SESION), deps);
    const r = await leer(res);
    expect(r.status).toBe(201);
    expect(r.cuerpo.asset_id).toBe(UUID_ASSET);
    expect(r.cuerpo.posicion).toBe(3);

    const subida = r.cuerpo.subida as Record<string, unknown>;
    expect(subida.metodo).toBe("PUT");
    const cabeceras = subida.cabeceras as Record<string, string>;
    expect(cabeceras["If-None-Match"]).toBe("*");
    expect(cabeceras["Content-Type"]).toBe("image/jpeg");
    // `Content-Length` es una *forbidden header name*: pedirla sería
    // pedirle al frontend algo que `fetch` ignora.
    expect(Object.keys(cabeceras)).not.toContain("Content-Length");
    expect(Object.keys(cabeceras).map((k) => k.toLowerCase())).not.toContain("content-length");
  });

  it("reutilizada → 200, no 201", async () => {
    const { deps } = conReserva(fila({ codigo: "reutilizada", asset_id: UUID_ASSET, posicion: 0 }));
    const res = await manejarSesion(peticion(CUERPO_SESION), deps);
    expect((await leer(res)).status).toBe(200);
  });

  it("conflicto_solicitud → 409", async () => {
    const { deps } = conReserva(fila({ codigo: "conflicto_solicitud", asset_id: UUID_ASSET }));
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));
    expect(r.status).toBe(409);
    expect(r.cuerpo.codigo).toBe("conflicto-solicitud");
  });

  it("cupo_agotado → 409", async () => {
    const { deps } = conReserva(fila({ codigo: "cupo_agotado" }));
    expect((await leer(await manejarSesion(peticion(CUERPO_SESION), deps))).status).toBe(409);
  });

  it("demasiadas_reservas → 429", async () => {
    const { deps } = conReserva(fila({ codigo: "demasiadas_reservas" }));
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));
    expect(r.status).toBe(429);
    expect(r.cuerpo.codigo).toBe("demasiadas-reservas");
  });

  it("reemplazo_en_curso → 409", async () => {
    const { deps } = conReserva(fila({ codigo: "reemplazo_en_curso" }));
    expect((await leer(await manejarSesion(peticion(CUERPO_SESION), deps))).status).toBe(409);
  });

  it("un asset AJENO: la base tira 42501 y sale 403 sin decir si existe", async () => {
    const { deps } = conReserva({ error: { code: "42501", message: "no se administra esa entidad" } });
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));
    expect(r.status).toBe(403);
    expect(r.cuerpo.mensaje).toBe("No encontramos eso o no es tuyo.");
  });

  it("una entidad inexistente (23503 del trigger) → 404", async () => {
    const { deps } = conReserva({ error: { code: "23503", message: "no existe" } });
    expect((await leer(await manejarSesion(peticion(CUERPO_SESION), deps))).status).toBe(404);
  });
});

describe("sesion: la clave de R2 y el write-once", () => {
  const armar = (extra: Partial<Deps> = {}, adminExtra: Record<string, Respuesta> = {}) => {
    const usuario = clienteFalso({
      media_reservar: fila({ codigo: "creada", asset_id: UUID_ASSET, posicion: 0 }),
    });
    usuarioClienteActual = usuario.cliente;
    const admin = clienteFalso({
      media_datos_para_clave: fila({
        propietario_id: UUID_USUARIO,
        entity_type: "rancho",
        entity_id: UUID_A,
        mime: "image/jpeg",
        estado: "pendiente",
      }),
      media_preparar_subida: fila({ codigo: "asignada" }),
      ...adminExtra,
    });
    return {
      admin,
      deps: depsBase({ autenticar: autenticado(), admin: () => admin.cliente, ...extra }),
    };
  };

  it("la clave la deriva el SERVIDOR y nunca vuelve al cliente", async () => {
    const { admin, deps } = armar();
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));

    const clave = admin.args("media_preparar_subida")?.p_r2_key as string;
    expect(clave).toBe(`originals/${UUID_USUARIO}/rancho/${UUID_A}/${UUID_ASSET}/foto.jpg`);
    // La clave es un dato interno: no aparece en la respuesta.
    expect(r.texto).not.toContain("originals/");
  });

  it("usa el propietario DERIVADO, no el actor (caso admin sobre un negocio ajeno)", async () => {
    const { admin, deps } = armar(
      {},
      {
        media_datos_para_clave: fila({
          propietario_id: "99999999-9999-4999-8999-999999999999",
          entity_type: "rancho",
          entity_id: UUID_A,
          mime: "image/jpeg",
          estado: "pendiente",
        }),
      },
    );
    await manejarSesion(peticion(CUERPO_SESION), deps);
    const clave = admin.args("media_preparar_subida")?.p_r2_key as string;
    expect(clave).toContain("/99999999-9999-4999-8999-999999999999/");
    expect(clave).not.toContain(UUID_USUARIO);
  });

  it("la extensión la manda el MIME, no el nombre", async () => {
    const { admin, deps } = armar();
    await manejarSesion(
      peticion({ ...CUERPO_SESION, mime: "image/png", nombre: "mentira.jpg" }),
      deps,
    );
    expect(admin.args("media_preparar_subida")?.p_r2_key as string).toMatch(/\/mentira\.png$/);
  });

  it("si el objeto YA existe, no se vuelve a firmar: 409", async () => {
    const { admin, deps } = armar({
      existeObjeto: (async () => okR2(true)) as Deps["existeObjeto"],
    });
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));
    expect(r.status).toBe(409);
    expect(r.cuerpo.codigo).toBe("objeto-existente");
    expect(admin.hubo("media_preparar_subida")).toBe(false);
  });

  it("en un reintento desde `error` se borra el objeto y se COMPRUEBA que se fue", async () => {
    let consultas = 0;
    const borrar = vi.fn(async () => okR2({ clave: "k" }));
    const { admin, deps } = armar(
      {
        existeObjeto: (async () => okR2(++consultas === 1)) as Deps["existeObjeto"],
        borrarObjeto: borrar as Deps["borrarObjeto"],
      },
      {
        media_datos_para_clave: fila({
          propietario_id: UUID_USUARIO,
          entity_type: "rancho",
          entity_id: UUID_A,
          mime: "image/jpeg",
          estado: "error",
        }),
        media_preparar_subida: fila({ codigo: "reintentada" }),
      },
    );
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));
    expect(r.status).toBe(201);
    expect(borrar).toHaveBeenCalledOnce();
    // Se vuelve a preguntar: un borrado que "no falló" no es un objeto
    // ausente, y `p_objeto_previo_ausente` solo puede ser true si se vio.
    expect(consultas).toBe(2);
    expect(admin.args("media_preparar_subida")?.p_objeto_previo_ausente).toBe(true);
  });

  it("si el objeto previo NO se pudo borrar, no se firma nada", async () => {
    const { admin, deps } = armar(
      { existeObjeto: (async () => okR2(true)) as Deps["existeObjeto"] },
      {
        media_datos_para_clave: fila({
          propietario_id: UUID_USUARIO,
          entity_type: "rancho",
          entity_id: UUID_A,
          mime: "image/jpeg",
          estado: "error",
        }),
      },
    );
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));
    expect(r.status).toBe(409);
    expect(admin.hubo("media_preparar_subida")).toBe(false);
  });

  it("limpieza_en_curso → 409", async () => {
    const { deps } = armar({}, { media_preparar_subida: fila({ codigo: "limpieza_en_curso" }) });
    expect((await leer(await manejarSesion(peticion(CUERPO_SESION), deps))).status).toBe(409);
  });

  it("R2 sin configurar → 503, no 500", async () => {
    const { deps } = armar({
      existeObjeto: (async () => errR2("config-incompleta", "Faltan variables de R2")) as Deps["existeObjeto"],
    });
    const r = await leer(await manejarSesion(peticion(CUERPO_SESION), deps));
    expect(r.status).toBe(503);
  });

  it("R2 caído → 502", async () => {
    const { deps } = armar({
      existeObjeto: (async () => errR2("fallo-proveedor")) as Deps["existeObjeto"],
    });
    expect((await leer(await manejarSesion(peticion(CUERPO_SESION), deps))).status).toBe(502);
  });

  it("sin service_role → 503", async () => {
    const usuario = clienteFalso({});
    usuarioClienteActual = usuario.cliente;
    const res = await manejarSesion(
      peticion(CUERPO_SESION),
      depsBase({ autenticar: autenticado(), admin: () => null }),
    );
    expect((await leer(res)).status).toBe(503);
  });
});

// ============================================================
// 2. /api/media/sesion-anonima
// ============================================================

describe("sesion anónima: álbum", () => {
  const adminAlbum = (extra: Record<string, Respuesta> = {}) =>
    clienteFalso({
      media_rate_limit_tomar: fila({ permitido: true, conteo: 1 }),
      media_emitir_capacidad: fila({ codigo: "emitida", capacidad_id: UUID_B }),
      media_reservar_con_capacidad: fila({
        codigo: "creada",
        asset_id: UUID_ASSET,
        posicion: 0,
        usos_restantes: 9,
      }),
      media_datos_para_clave: fila({
        propietario_id: UUID_USUARIO,
        entity_type: "album",
        entity_id: UUID_A,
        mime: "image/jpeg",
        estado: "pendiente",
      }),
      media_preparar_subida_cap: fila({ codigo: "asignada" }),
      ...extra,
    });

  it("emite la capacidad y devuelve el token EN CLARO una sola vez", async () => {
    const admin = adminAlbum();
    const r = await leer(
      await manejarSesionAnonima(peticion(CUERPO_ALBUM), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(201);
    expect(r.cuerpo.capacidad).toBe("TOKEN-EN-CLARO-DE-PRUEBA");
    expect(r.cuerpo.capacidad_emitida).toBe(true);
    expect(r.cuerpo.usos_restantes).toBe(9);

    // A la base solo va el hash.
    const emitir = admin.args("media_emitir_capacidad")!;
    expect(emitir.p_token_hash).toBe(hashDeToken("TOKEN-EN-CLARO-DE-PRUEBA"));
    expect(JSON.stringify(emitir)).not.toContain("TOKEN-EN-CLARO-DE-PRUEBA");
  });

  it("con una capacidad ya emitida NO vuelve a emitir ni pide Turnstile", async () => {
    const admin = adminAlbum();
    const turnstile = vi.fn(async () => ({ ok: true as const, via: "verificado" as const }));
    const r = await leer(
      await manejarSesionAnonima(
        peticion({ ...CUERPO_ALBUM, capacidad: "TOKEN-VIEJO", turnstile: undefined }),
        depsBase({ admin: () => admin.cliente, verificarTurnstile: turnstile as Deps["verificarTurnstile"] }),
      ),
    );
    expect(r.status).toBe(201);
    expect(admin.hubo("media_emitir_capacidad")).toBe(false);
    expect(turnstile).not.toHaveBeenCalled();
    expect(r.cuerpo.capacidad_emitida).toBe(false);
  });

  it("un Turnstile inválido corta antes de tocar la base → 403", async () => {
    const admin = adminAlbum();
    const r = await leer(
      await manejarSesionAnonima(
        peticion(CUERPO_ALBUM),
        depsBase({
          admin: () => admin.cliente,
          verificarTurnstile: (async () => ({
            ok: false,
            codigo: "rechazado",
            mensaje: "no",
          })) as Deps["verificarTurnstile"],
        }),
      ),
    );
    expect(r.status).toBe(403);
    expect(r.cuerpo.codigo).toBe("antiabuso");
    expect(admin.hubo("media_emitir_capacidad")).toBe(false);
    expect(admin.hubo("media_reservar_con_capacidad")).toBe(false);
  });

  it("Turnstile sin configurar en producción → 503, no un 403 confuso", async () => {
    const admin = adminAlbum();
    const r = await leer(
      await manejarSesionAnonima(
        peticion(CUERPO_ALBUM),
        depsBase({
          admin: () => admin.cliente,
          verificarTurnstile: (async () => ({
            ok: false,
            codigo: "sin-configuracion",
            mensaje: "no",
          })) as Deps["verificarTurnstile"],
        }),
      ),
    );
    expect(r.status).toBe(503);
  });

  it("sin Origin, o con uno ajeno, no entra nada", async () => {
    for (const origen of [null, "https://malicioso.example"]) {
      const admin = adminAlbum();
      const res = await manejarSesionAnonima(
        peticion(CUERPO_ALBUM, { origen }),
        depsBase({ admin: () => admin.cliente }),
      );
      const r = await leer(res);
      expect(r.status, String(origen)).toBe(403);
      expect(r.cuerpo.codigo).toBe("origen-invalido");
      expect(admin.llamadas).toHaveLength(0);
    }
  });

  it("un álbum inexistente o archivado → 404", async () => {
    const admin = adminAlbum();
    const r = await leer(
      await manejarSesionAnonima(
        peticion({ ...CUERPO_ALBUM, album_slug: "no-existe" }),
        depsBase({ admin: () => admin.cliente }),
      ),
    );
    expect(r.status).toBe(404);
  });

  it("el rate limit de emisión por IP → 429, y la IP nunca va en claro", async () => {
    const admin = adminAlbum({ media_rate_limit_tomar: fila({ permitido: false, conteo: 21 }) });
    const req = new Request("https://bookea.lat/api/media/sesion-anonima", {
      method: "POST",
      headers: { origin: ORIGEN, "x-forwarded-for": "190.10.20.30, 10.0.0.1" },
      body: JSON.stringify(CUERPO_ALBUM),
    });
    const r = await leer(await manejarSesionAnonima(req, depsBase({ admin: () => admin.cliente })));
    expect(r.status).toBe(429);
    expect(JSON.stringify(admin.llamadas)).not.toContain("190.10.20.30");
  });

  it("si el contador de rate limit falla, se CIERRA la puerta", async () => {
    const admin = adminAlbum({
      media_rate_limit_tomar: { error: { code: "XX000", message: "caído" } },
    });
    const r = await leer(
      await manejarSesionAnonima(peticion(CUERPO_ALBUM), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(429);
    expect(admin.hubo("media_reservar_con_capacidad")).toBe(false);
  });

  it("capacidad inexistente → 401; vencida → 410; agotada → 429", async () => {
    const casos = [
      ["capacidad_invalida", 401],
      ["capacidad_vencida", 410],
      ["capacidad_agotada", 429],
      ["cupo_agotado", 409],
    ] as const;
    for (const [codigo, http] of casos) {
      const admin = adminAlbum({ media_reservar_con_capacidad: fila({ codigo }) });
      const res = await manejarSesionAnonima(
        peticion({ ...CUERPO_ALBUM, capacidad: "TOKEN-VIEJO" }),
        depsBase({ admin: () => admin.cliente }),
      );
      expect((await leer(res)).status, codigo).toBe(http);
    }
  });

  it("video y audio no entran por acá aunque la capacidad valga", async () => {
    const admin = adminAlbum();
    for (const mime of ["video/mp4", "audio/mpeg"]) {
      const res = await manejarSesionAnonima(
        peticion({ ...CUERPO_ALBUM, capacidad: "T", mime }),
        depsBase({ admin: () => admin.cliente }),
      );
      expect((await leer(res)).status, mime).toBe(400);
    }
    expect(admin.hubo("media_reservar_con_capacidad")).toBe(false);
  });

  it("un archivo de más de 10 MiB → 413", async () => {
    const admin = adminAlbum();
    const res = await manejarSesionAnonima(
      peticion({ ...CUERPO_ALBUM, capacidad: "T", bytes: 10 * 1024 * 1024 + 1 }),
      depsBase({ admin: () => admin.cliente }),
    );
    expect((await leer(res)).status).toBe(413);
  });

  it("un cuerpo de más de 8 KiB → 413", async () => {
    const admin = adminAlbum();
    const res = await manejarSesionAnonima(
      peticion(JSON.stringify({ ...CUERPO_ALBUM, relleno: "x".repeat(9000) })),
      depsBase({ admin: () => admin.cliente }),
    );
    expect((await leer(res)).status).toBe(413);
  });

  it("un `tipo` desconocido no abre ningún camino", async () => {
    const admin = adminAlbum();
    for (const tipo of ["rancho", "verificacion", "", 7, null]) {
      const res = await manejarSesionAnonima(
        peticion({ ...CUERPO_ALBUM, tipo }),
        depsBase({ admin: () => admin.cliente }),
      );
      expect((await leer(res)).status, String(tipo)).toBe(400);
    }
  });

  it("una capacidad de ÁLBUM declarada como comprobante se corta", async () => {
    // La entidad la puso la capacidad, así que no hay escalada; pero la
    // respuesta hablaría de algo que no es.
    const admin = adminAlbum();
    const res = await manejarSesionAnonima(
      peticion({ tipo: "comprobante", capacidad: "T", turnstile: "tok", solicitud_id: UUID_B,
        mime: "image/jpeg", bytes: 1000, nombre: "x.jpg" }),
      depsBase({ admin: () => admin.cliente }),
    );
    expect((await leer(res)).status).toBe(403);
  });
});

describe("sesion anónima: comprobante", () => {
  const CUERPO_COMP = {
    tipo: "comprobante",
    capacidad: "TOKEN-DE-LA-RESERVA",
    turnstile: "tok",
    solicitud_id: UUID_B,
    mime: "image/jpeg",
    bytes: 1000,
    nombre: "sinpe.jpg",
  };

  const adminComp = (extra: Record<string, Respuesta> = {}) =>
    clienteFalso({
      media_rate_limit_tomar: fila({ permitido: true, conteo: 1 }),
      media_reservar_con_capacidad: fila({
        codigo: "creada",
        asset_id: UUID_ASSET,
        posicion: 0,
        usos_restantes: 0,
      }),
      media_datos_para_clave: fila({
        propietario_id: UUID_USUARIO,
        entity_type: "comprobante",
        entity_id: UUID_A,
        mime: "image/jpeg",
        estado: "pendiente",
      }),
      media_preparar_subida_cap: fila({ codigo: "asignada" }),
      ...extra,
    });

  it("sin capacidad → 401, y NUNCA se emite una acá", async () => {
    const admin = adminComp();
    const r = await leer(
      await manejarSesionAnonima(
        peticion({ ...CUERPO_COMP, capacidad: undefined }),
        depsBase({ admin: () => admin.cliente }),
      ),
    );
    expect(r.status).toBe(401);
    expect(r.cuerpo.codigo).toBe("sin-capacidad");
    expect(admin.hubo("media_emitir_capacidad")).toBe(false);
  });

  it("un uuid de reserva suelto NO autoriza nada", async () => {
    const admin = adminComp();
    const r = await leer(
      await manejarSesionAnonima(
        peticion({ ...CUERPO_COMP, capacidad: undefined, reserva_id: UUID_A }),
        depsBase({ admin: () => admin.cliente }),
      ),
    );
    expect(r.status).toBe(401);
    expect(admin.hubo("media_emitir_capacidad")).toBe(false);
    expect(admin.hubo("media_reservar_con_capacidad")).toBe(false);
  });

  it("Turnstile es obligatorio en CADA comprobante", async () => {
    const admin = adminComp();
    const turnstile = vi.fn(async () => ({ ok: true as const, via: "verificado" as const }));
    await manejarSesionAnonima(
      peticion(CUERPO_COMP),
      depsBase({ admin: () => admin.cliente, verificarTurnstile: turnstile as Deps["verificarTurnstile"] }),
    );
    expect(turnstile).toHaveBeenCalledOnce();
  });

  it("con la capacidad correcta reserva y firma", async () => {
    const admin = adminComp();
    const r = await leer(
      await manejarSesionAnonima(peticion(CUERPO_COMP), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(201);
    // La entidad NO viene del cliente: el cuerpo ni la menciona.
    expect(admin.args("media_reservar_con_capacidad")).not.toHaveProperty("p_entity_id");
    expect(admin.args("media_reservar_con_capacidad")?.p_token_hash).toBe(
      hashDeToken("TOKEN-DE-LA-RESERVA"),
    );
  });
});

// ============================================================
// 3. /api/media/confirmar
// ============================================================

const TOMADO_ALBUM = {
  codigo: "tomado",
  lease: UUID_B,
  estado: "subiendo",
  entity_type: "album",
  entity_id: UUID_A,
  visibilidad: "compartida",
  mime: "image/jpeg",
  bytes: 1000,
  r2_key: "originals/o/album/e/a/foto.jpg",
  r2_verificado_en: null,
  cf_image_id: null,
  cf_verificado_en: null,
  solo_r2: false,
};

const CUERPO_CONF = { asset_id: UUID_ASSET, capacidad: "TOKEN" };

describe("confirmar: autorización", () => {
  it("sin capacidad y sin sesión → 401", async () => {
    const r = await leer(
      await manejarConfirmar(
        peticion({ asset_id: UUID_ASSET }),
        depsBase({ autenticar: rechazado(401), admin: () => clienteFalso({}).cliente }),
      ),
    );
    expect(r.status).toBe(401);
  });

  it("una capacidad que no cubre ese asset → 403", async () => {
    const admin = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "no_cubre" }) });
    const r = await leer(
      await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(403);
  });

  it("una capacidad vencida o revocada → 410", async () => {
    const admin = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "capacidad_vencida" }) });
    const r = await leer(
      await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(410);
    expect(r.cuerpo.codigo).toBe("capacidad-vencida");
  });

  it("una capacidad inexistente → 401", async () => {
    const admin = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "capacidad_invalida" }) });
    expect(
      (await leer(await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => admin.cliente }))))
        .status,
    ).toBe(401);
  });

  it("la confirmación anónima EXIGE Origin válido", async () => {
    const admin = clienteFalso({});
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF, { origen: "https://malicioso.example" }),
        depsBase({ admin: () => admin.cliente }),
      ),
    );
    expect(r.status).toBe(403);
    expect(admin.llamadas).toHaveLength(0);
  });

  it("con capacidad usa el juego `_cap`; sin ella, el de actor", async () => {
    const cap = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "ya_listo" }) });
    await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => cap.cliente }));
    expect(cap.hubo("media_tomar_confirmacion_cap")).toBe(true);

    const actor = clienteFalso({ media_tomar_confirmacion: fila({ codigo: "ya_listo" }) });
    await manejarConfirmar(
      peticion({ asset_id: UUID_ASSET }),
      depsBase({ autenticar: autenticado(), admin: () => actor.cliente }),
    );
    expect(actor.hubo("media_tomar_confirmacion")).toBe(true);
    expect(actor.args("media_tomar_confirmacion")?.p_actor).toBe(UUID_USUARIO);
  });

  it("un asset_id que no es uuid → 400 sin tocar nada", async () => {
    const admin = clienteFalso({});
    const r = await leer(
      await manejarConfirmar(peticion({ asset_id: "x" }), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(400);
    expect(admin.llamadas).toHaveLength(0);
  });
});

describe("confirmar: idempotencia y estados", () => {
  it("ya_listo → 200 y NO se vuelve a importar a Cloudflare", async () => {
    const admin = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "ya_listo" }) });
    const importar = vi.fn();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({ admin: () => admin.cliente, importarImagen: importar as unknown as Deps["importarImagen"] }),
      ),
    );
    expect(r.status).toBe(200);
    expect(r.cuerpo.ya_estaba).toBe(true);
    expect(importar).not.toHaveBeenCalled();
  });

  it("otra confirmación en curso → 409", async () => {
    const admin = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "en_curso" }) });
    const r = await leer(
      await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(409);
  });

  it("una limpieza en curso → 409", async () => {
    const admin = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "limpieza_en_curso" }) });
    expect(
      (await leer(await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => admin.cliente }))))
        .status,
    ).toBe(409);
  });

  it("la reserva vencida → 410", async () => {
    const admin = clienteFalso({ media_tomar_confirmacion_cap: fila({ codigo: "reserva_vencida" }) });
    const r = await leer(
      await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => admin.cliente })),
    );
    expect(r.status).toBe(410);
    expect(r.cuerpo.codigo).toBe("reserva-vencida");
  });

  it("un asset que no viene de este flujo → 409", async () => {
    const admin = clienteFalso({
      media_tomar_confirmacion_cap: fila({ codigo: "no_confirmable", estado: "listo" }),
    });
    expect(
      (await leer(await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => admin.cliente }))))
        .status,
    ).toBe(409);
  });
});

describe("confirmar: verificación del original", () => {
  const admin = (extra: Record<string, Respuesta> = {}) =>
    clienteFalso({
      media_tomar_confirmacion_cap: fila(TOMADO_ALBUM),
      media_registrar_r2_cap: fila({ codigo: "registrada", estado: "parcial_r2" }),
      media_finalizar_cloudflare_cap: fila({ codigo: "finalizada", estado: "listo" }),
      media_soltar_lease_cap: fila({ codigo: "soltado" }),
      media_rechazar_confirmacion_cap: fila({ codigo: "rechazada", estado: "error" }),
      media_liberar_confirmacion_cap: fila({ codigo: "liberada" }),
      ...extra,
    });

  it("un JPEG válido recorre R2 → Cloudflare y termina en listo", async () => {
    const a = admin();
    const r = await leer(
      await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => a.cliente })),
    );
    expect(r.status).toBe(200);
    expect(r.cuerpo.estado).toBe("listo");
    expect(r.cuerpo.destino).toBe("r2+cloudflare");
    // El ORDEN importa: el sello de R2 va antes de tocar Cloudflare.
    const orden = a.llamadas.map((l) => l.fn);
    expect(orden.indexOf("media_registrar_r2_cap")).toBeLessThan(
      orden.indexOf("media_finalizar_cloudflare_cap"),
    );
  });

  it("el objeto todavía no llegó → 409 y el lease se DEVUELVE en el acto", async () => {
    const a = admin();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          verificarMetadatos: (async () => errR2("no-existe")) as Deps["verificarMetadatos"],
        }),
      ),
    );
    expect(r.status).toBe(409);
    expect(r.cuerpo.codigo).toBe("subida-incompleta");
    // Sin esto, un reintento tendría que esperar los 10 min del lease.
    expect(a.hubo("media_soltar_lease_cap")).toBe(true);
    expect(a.hubo("media_rechazar_confirmacion_cap")).toBe(false);
  });

  it("el tamaño no coincide → 422, se borra de R2 y se registra el rechazo", async () => {
    const a = admin();
    const borrar = vi.fn(async () => okR2({ clave: "k" }));
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          borrarObjeto: borrar as Deps["borrarObjeto"],
          verificarMetadatos: (async () => errR2("tamano-distinto")) as Deps["verificarMetadatos"],
        }),
      ),
    );
    expect(r.status).toBe(422);
    expect(r.cuerpo.codigo).toBe("metadatos-distintos");
    expect(borrar).toHaveBeenCalledOnce();
    expect(a.args("media_rechazar_confirmacion_cap")?.p_detalle).toContain("r2=borrado");
  });

  it("el MIME no coincide → 422", async () => {
    const a = admin();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          verificarMetadatos: (async () => errR2("mime-distinto")) as Deps["verificarMetadatos"],
        }),
      ),
    );
    expect(r.status).toBe(422);
  });

  it("la FIRMA real no corresponde → 422 y no se sella nada", async () => {
    const a = admin();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          analizarFirma: (async () =>
            okR2({
              veredicto: "incompatible",
              bloqueaSello: true,
              mimeDeclarado: "image/jpeg",
              mimeDetectado: "application/x-msdownload",
              extensionDetectada: "exe",
              bytesLeidos: 1024,
              motivo: "Se declaró image/jpeg y la firma es application/x-msdownload.",
              equivalencia: null,
              mejorEsfuerzo: false,
            })) as Deps["analizarFirma"],
        }),
      ),
    );
    expect(r.status).toBe(422);
    expect(r.cuerpo.codigo).toBe("firma-incompatible");
    expect(a.hubo("media_registrar_r2_cap")).toBe(false);
    expect(a.hubo("media_finalizar_cloudflare_cap")).toBe(false);
    expect(a.hubo("media_rechazar_confirmacion_cap")).toBe(true);
  });

  it("un veredicto `inconcluso` o `desconocido` tampoco pasa", async () => {
    for (const veredicto of ["inconcluso", "desconocido"] as const) {
      const a = admin();
      const res = await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          analizarFirma: (async () =>
            okR2({
              veredicto,
              bloqueaSello: true,
              mimeDeclarado: "image/jpeg",
              mimeDetectado: null,
              extensionDetectada: null,
              bytesLeidos: 10,
              motivo: "no se reconoció",
              equivalencia: null,
              mejorEsfuerzo: false,
            })) as Deps["analizarFirma"],
        }),
      );
      expect((await leer(res)).status, veredicto).toBe(422);
    }
  });

  it("si no se pudo borrar el objeto, se anota `sin-borrar` y se conserva la clave", async () => {
    const a = admin();
    await manejarConfirmar(
      peticion(CUERPO_CONF),
      depsBase({
        admin: () => a.cliente,
        borrarObjeto: (async () => errR2("fallo-proveedor")) as Deps["borrarObjeto"],
        verificarMetadatos: (async () => errR2("tamano-distinto")) as Deps["verificarMetadatos"],
      }),
    );
    // `media_rechazar_confirmacion` nunca borra `r2_key`: es lo único
    // con lo que el worker puede reintentar el borrado.
    expect(a.args("media_rechazar_confirmacion_cap")?.p_detalle).toContain("r2=sin-borrar");
  });
});

describe("confirmar: Cloudflare", () => {
  const admin = (extra: Record<string, Respuesta> = {}) =>
    clienteFalso({
      media_tomar_confirmacion_cap: fila(TOMADO_ALBUM),
      media_registrar_r2_cap: fila({ codigo: "registrada", estado: "parcial_r2" }),
      media_finalizar_cloudflare_cap: fila({ codigo: "finalizada", estado: "listo" }),
      media_liberar_confirmacion_cap: fila({ codigo: "liberada" }),
      media_soltar_lease_cap: fila({ codigo: "soltado" }),
      media_anotar_incidencia: { data: true },
      ...extra,
    });

  it("un álbum se importa con firma obligatoria (visibilidad compartida)", async () => {
    const a = admin();
    const importar = vi.fn(async (p: { url: string; requiereFirma: boolean }) => {
      void p;
      return okR2({ id: "cf-1", subidaEn: "x", requiereFirma: true, variantes: [] });
    });
    await manejarConfirmar(
      peticion(CUERPO_CONF),
      depsBase({ admin: () => a.cliente, importarImagen: importar as unknown as Deps["importarImagen"] }),
    );
    expect(importar.mock.calls[0][0]).toMatchObject({ requiereFirma: true });
  });

  it("una foto PÚBLICA se importa sin exigir firma", async () => {
    // La decisión sale de la columna `visibilidad` de la FILA, no de una
    // tabla de constantes: si alguien reclasifica el asset, la entrega
    // cambia con él.
    const a = admin({
      media_tomar_confirmacion_cap: fila({
        ...TOMADO_ALBUM,
        entity_type: "rancho",
        visibilidad: "publica",
      }),
    });
    const importar = vi.fn(async (p: { requiereFirma: boolean }) => {
      void p;
      return okR2({ id: "cf-1", subidaEn: "x", requiereFirma: false, variantes: [] });
    });
    await manejarConfirmar(
      peticion(CUERPO_CONF),
      depsBase({ admin: () => a.cliente, importarImagen: importar as unknown as Deps["importarImagen"] }),
    );
    expect(importar.mock.calls[0][0]).toMatchObject({ requiereFirma: false });
  });

  it("una fila sin visibilidad reconocible no se procesa: 500, no una entrega abierta", async () => {
    const a = admin({
      media_tomar_confirmacion_cap: fila({ ...TOMADO_ALBUM, visibilidad: "inventada" }),
    });
    const importar = vi.fn();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({ admin: () => a.cliente, importarImagen: importar as unknown as Deps["importarImagen"] }),
      ),
    );
    expect(r.status).toBe(500);
    expect(importar).not.toHaveBeenCalled();
  });

  it("la URL que se le pasa a Cloudflare no lleva el nombre original del archivo", async () => {
    // `nombre_original` puede traer datos personales ("cedula-juan.jpg").
    const a = admin();
    const firmar = vi.fn(async (p: { nombreArchivo: string; expiraEnSegundos?: number }) => {
      void p;
      return okR2({ url: "https://r2/x", expiraEnSegundos: 300, nombreArchivo: "original.jpg" });
    });
    await manejarConfirmar(
      peticion(CUERPO_CONF),
      depsBase({ admin: () => a.cliente, firmarDescarga: firmar as unknown as Deps["firmarDescarga"] }),
    );
    expect(firmar.mock.calls[0][0]).toMatchObject({
      nombreArchivo: "original.jpg",
      expiraEnSegundos: 300,
    });
  });

  it("Cloudflare caído → 502, se conserva parcial_r2 y se LIBERA el lease", async () => {
    const a = admin();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          importarImagen: (async () => errR2("timeout")) as Deps["importarImagen"],
        }),
      ),
    );
    expect(r.status).toBe(502);
    expect(r.cuerpo.codigo).toBe("fallo-imagenes");
    // `liberar` conserva el sello de R2; `soltar` lo exigiría ausente.
    expect(a.hubo("media_liberar_confirmacion_cap")).toBe(true);
    expect(a.hubo("media_rechazar_confirmacion_cap")).toBe(false);
  });

  it("desde parcial_r2 NO se vuelve a verificar ni a subir: solo se reintenta Cloudflare", async () => {
    const a = admin({
      media_tomar_confirmacion_cap: fila({
        ...TOMADO_ALBUM,
        estado: "parcial_r2",
        r2_verificado_en: "2026-08-10T00:00:00Z",
      }),
    });
    const verificar = vi.fn();
    const analizar = vi.fn();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          verificarMetadatos: verificar as unknown as Deps["verificarMetadatos"],
          analizarFirma: analizar as unknown as Deps["analizarFirma"],
        }),
      ),
    );
    expect(r.status).toBe(200);
    expect(verificar).not.toHaveBeenCalled();
    expect(analizar).not.toHaveBeenCalled();
    // El sello ya estaba: no se vuelve a escribir.
    expect(a.hubo("media_registrar_r2_cap")).toBe(false);
    expect(a.hubo("media_finalizar_cloudflare_cap")).toBe(true);
  });

  it("Cloudflare creó la imagen y SQL falló → se BORRA la huérfana", async () => {
    const a = admin({ media_finalizar_cloudflare_cap: fila({ codigo: "lease_invalido" }) });
    const borrarImagen = vi.fn(async (p: { id: string }) => {
      void p;
      return okR2({ id: "cf-imagen-1" });
    });
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({ admin: () => a.cliente, borrarImagen: borrarImagen as unknown as Deps["borrarImagen"] }),
      ),
    );
    expect(r.status).toBe(409);
    expect(borrarImagen).toHaveBeenCalledOnce();
    expect(borrarImagen.mock.calls[0][0]).toMatchObject({ id: "cf-imagen-1" });
  });

  it("si tampoco se puede borrar, el id queda ESCRITO: nunca invisible", async () => {
    const a = admin({ media_finalizar_cloudflare_cap: fila({ codigo: "estado_no_admitido" }) });
    await manejarConfirmar(
      peticion(CUERPO_CONF),
      depsBase({
        admin: () => a.cliente,
        borrarImagen: (async () => errR2("fallo-proveedor")) as Deps["borrarImagen"],
      }),
    );
    const anotada = a.args("media_anotar_incidencia");
    expect(anotada?.p_detalle).toContain("cf-imagen-1");
    // Y NO se usa `rechazar`, que tiraría un sello de R2 perfectamente
    // válido y obligaría a resubir el archivo entero.
    expect(a.hubo("media_rechazar_confirmacion_cap")).toBe(false);
  });

  it("una confirmación repetida no duplica imágenes (reutilizada → 200)", async () => {
    const a = admin({ media_finalizar_cloudflare_cap: fila({ codigo: "reutilizada", estado: "listo" }) });
    const r = await leer(
      await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => a.cliente })),
    );
    expect(r.status).toBe(200);
  });

  it("el lease vencido a mitad de camino → 409, no un falso éxito", async () => {
    const a = admin({ media_registrar_r2_cap: fila({ codigo: "lease_invalido" }) });
    const r = await leer(
      await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => a.cliente })),
    );
    expect(r.status).toBe(409);
    expect(a.hubo("media_finalizar_cloudflare_cap")).toBe(false);
  });
});

describe("confirmar: el camino R2-only", () => {
  const TOMADO_COMP = {
    ...TOMADO_ALBUM,
    entity_type: "comprobante",
    visibilidad: "privada",
    r2_key: "originals/o/comprobante/e/a/sinpe.jpg",
    solo_r2: true,
  };

  it("un comprobante termina en listo SIN pasar por Cloudflare", async () => {
    const a = clienteFalso({
      media_tomar_confirmacion_cap: fila(TOMADO_COMP),
      media_finalizar_r2_cap: fila({ codigo: "finalizada", estado: "listo" }),
    });
    const importar = vi.fn();
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({ admin: () => a.cliente, importarImagen: importar as unknown as Deps["importarImagen"] }),
      ),
    );
    expect(r.status).toBe(200);
    expect(r.cuerpo.estado).toBe("listo");
    expect(r.cuerpo.destino).toBe("r2");
    // Lo importante: una cédula o un SINPE no salen a una CDN.
    expect(importar).not.toHaveBeenCalled();
    expect(a.hubo("media_finalizar_cloudflare_cap")).toBe(false);
    expect(a.hubo("media_registrar_r2_cap")).toBe(false);
  });

  it("pero SÍ se le verifican metadatos y firma antes de sellar", async () => {
    const a = clienteFalso({
      media_tomar_confirmacion_cap: fila(TOMADO_COMP),
      media_finalizar_r2_cap: fila({ codigo: "finalizada", estado: "listo" }),
      media_rechazar_confirmacion_cap: fila({ codigo: "rechazada" }),
    });
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          analizarFirma: (async () =>
            okR2({
              veredicto: "incompatible",
              bloqueaSello: true,
              mimeDeclarado: "image/jpeg",
              mimeDetectado: "application/pdf",
              extensionDetectada: "pdf",
              bytesLeidos: 100,
              motivo: "Se declaró image/jpeg y la firma es application/pdf.",
              equivalencia: null,
              mejorEsfuerzo: false,
            })) as Deps["analizarFirma"],
        }),
      ),
    );
    expect(r.status).toBe(422);
    expect(a.hubo("media_finalizar_r2_cap")).toBe(false);
  });

  it("el lease vencido tampoco cierra un R2-only", async () => {
    const a = clienteFalso({
      media_tomar_confirmacion_cap: fila(TOMADO_COMP),
      media_finalizar_r2_cap: fila({ codigo: "lease_invalido" }),
    });
    expect(
      (await leer(await manejarConfirmar(peticion(CUERPO_CONF), depsBase({ admin: () => a.cliente }))))
        .status,
    ).toBe(409);
  });

  it("un video por el camino de actor también cierra sin Cloudflare", async () => {
    const a = clienteFalso({
      media_tomar_confirmacion: fila({
        codigo: "tomado",
        lease: UUID_B,
        estado: "subiendo",
        entity_type: "rancho",
        entity_id: UUID_A,
        visibilidad: "publica",
        mime: "video/mp4",
        bytes: 5000,
        r2_key: "originals/o/rancho/e/a/v.mp4",
        r2_verificado_en: null,
        solo_r2: true,
      }),
      media_finalizar_r2: fila({ codigo: "finalizada", estado: "listo" }),
    });
    const r = await leer(
      await manejarConfirmar(
        peticion({ asset_id: UUID_ASSET }),
        depsBase({
          autenticar: autenticado(),
          admin: () => a.cliente,
          analizarFirma: (async () =>
            okR2({
              veredicto: "compatible",
              bloqueaSello: false,
              mimeDeclarado: "video/mp4",
              mimeDetectado: "video/mp4",
              extensionDetectada: "mp4",
              bytesLeidos: 100,
              motivo: "ok",
              equivalencia: null,
              mejorEsfuerzo: false,
            })) as Deps["analizarFirma"],
        }),
      ),
    );
    expect(r.status).toBe(200);
    expect(a.args("media_finalizar_r2")?.p_actor).toBe(UUID_USUARIO);
  });
});

// ============================================================
// 4. Nada se filtra
// ============================================================

describe("las respuestas no filtran nada", () => {
  const SECRETOS = [
    "X-Amz-Signature",
    "FIRMA_SECRETA",
    "originals/",
    "r2_key",
    "service_role",
    "TURNSTILE",
    "sal-de-prueba",
    "42501",
    "media_reservar",
  ];

  const revisar = (texto: string, contexto: string) => {
    for (const s of SECRETOS) {
      expect(texto, `${contexto} filtró "${s}"`).not.toContain(s);
    }
  };

  it("ningún error de sesión trae detalle interno", async () => {
    const usuario = clienteFalso({
      media_reservar: { error: { code: "42501", message: "media_reservar: no se administra esa entidad" } },
    });
    usuarioClienteActual = usuario.cliente;
    const admin = clienteFalso({});
    const r = await leer(
      await manejarSesion(
        peticion(CUERPO_SESION),
        depsBase({ autenticar: autenticado(), admin: () => admin.cliente }),
      ),
    );
    revisar(r.texto, "sesion 403");
  });

  it("una respuesta exitosa solo trae la URL firmada, sin la clave", async () => {
    const usuario = clienteFalso({
      media_reservar: fila({ codigo: "creada", asset_id: UUID_ASSET, posicion: 0 }),
    });
    usuarioClienteActual = usuario.cliente;
    const admin = clienteFalso({
      media_datos_para_clave: fila({
        propietario_id: UUID_USUARIO,
        entity_type: "rancho",
        entity_id: UUID_A,
        mime: "image/jpeg",
        estado: "pendiente",
      }),
      media_preparar_subida: fila({ codigo: "asignada" }),
    });
    const r = await leer(
      await manejarSesion(
        peticion(CUERPO_SESION),
        depsBase({ autenticar: autenticado(), admin: () => admin.cliente }),
      ),
    );
    // La URL firmada SÍ va (es lo que se pidió), pero la clave no.
    expect(r.texto).not.toContain("originals/");
    expect(r.texto).not.toContain("r2_key");
  });

  it("el detalle de un rechazo por firma no vuelve al cliente crudo", async () => {
    const a = clienteFalso({
      media_tomar_confirmacion_cap: fila(TOMADO_ALBUM),
      media_rechazar_confirmacion_cap: fila({ codigo: "rechazada" }),
    });
    const r = await leer(
      await manejarConfirmar(
        peticion(CUERPO_CONF),
        depsBase({
          admin: () => a.cliente,
          verificarMetadatos: (async () =>
            errR2("tamano-distinto", "El objeto pesa 99 bytes y se esperaban 1000.")) as Deps["verificarMetadatos"],
        }),
      ),
    );
    expect(r.cuerpo.mensaje).toBe(
      "El archivo que llegó no coincide con el que se anunció. No se guardó.",
    );
    expect(r.texto).not.toContain("99 bytes");
  });

  it("el diagnóstico va al registro del servidor, nunca al cuerpo", async () => {
    const registros: string[] = [];
    const usuario = clienteFalso({
      media_reservar: { error: { code: "42501", message: "detalle" } },
    });
    usuarioClienteActual = usuario.cliente;
    const r = await leer(
      await manejarSesion(
        peticion(CUERPO_SESION),
        depsBase({
          autenticar: autenticado(),
          admin: () => clienteFalso({}).cliente,
          registrar: (m) => registros.push(m),
        }),
      ),
    );
    expect(registros.join(" ")).toContain("42501");
    expect(r.texto).not.toContain("42501");
  });
});

// ============================================================
// 5. Cabeceras
// ============================================================

describe("cabeceras", () => {
  it("nunca se cachea y nunca se responde con `*`", async () => {
    const res = await manejarSesion(peticion({ roto: true }), depsBase());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGEN);
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("a un origen ajeno no se le devuelven las cabeceras que lo autorizarían", async () => {
    const res = await manejarSesion(
      peticion({ roto: true }, { origen: "https://malicioso.example" }),
      depsBase(),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
