import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_A_LA_VEZ,
  subirArchivo,
  subirVarios,
  type DependenciasSubida,
} from "./cliente-subida";

const UUID = "11111111-1111-4111-8111-111111111111";
const ASSET = "22222222-2222-4222-8222-222222222222";
const ENTIDAD = { tipo: "rancho", id: UUID } as const;

function archivoFalso(nombre = "foto.jpg", tipo = "image/jpeg", bytes = 2048): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

type Respuesta = { status: number; cuerpo: unknown };

/** Un fetch guionado por ruta, que registra lo que se le mandó. */
function fetchFalso(guion: { sesion?: Respuesta; confirmar?: Respuesta; lanzar?: "sesion" | "confirmar" }) {
  const llamadas: { ruta: string; cuerpo: Record<string, unknown> }[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    const ruta = String(url);
    const cuerpo = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    llamadas.push({ ruta, cuerpo });

    const cual = ruta.includes("confirmar") ? "confirmar" : "sesion";
    if (guion.lanzar === cual) throw new TypeError("network");

    const r =
      cual === "confirmar"
        ? (guion.confirmar ?? { status: 200, cuerpo: { asset_id: ASSET, url: "https://imagedelivery.net/h/img/gallery" } })
        : (guion.sesion ?? {
            status: 201,
            cuerpo: {
              asset_id: ASSET,
              subida: {
                url: "https://r2.example/objeto?firma",
                cabeceras: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
              },
            },
          });

    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.cuerpo,
    } as unknown as Response;
  };
  return { fn: fn as unknown as typeof fetch, llamadas };
}

/** El PUT falso: registra cabeceras y devuelve el estado que se le pida. */
function bucketFalso(estado = 200) {
  const puestos: { url: string; cabeceras: Record<string, string>; nombre: string }[] = [];
  const fn = vi.fn(
    async (p: { url: string; cabeceras: Record<string, string>; archivo: File }) => {
      puestos.push({ url: p.url, cabeceras: p.cabeceras, nombre: p.archivo.name });
      return estado >= 200 && estado < 300
        ? ({ ok: true } as const)
        : ({ ok: false, estado } as const);
    },
  );
  return { fn: fn as unknown as NonNullable<DependenciasSubida["subirABucket"]>, puestos, mock: fn };
}

const deps = (o: Partial<DependenciasSubida>): DependenciasSubida => ({
  nuevaSolicitud: () => "33333333-3333-4333-8333-333333333333",
  ...o,
});

let bucket: ReturnType<typeof bucketFalso>;
beforeEach(() => {
  bucket = bucketFalso();
});

describe("el camino feliz", () => {
  it("reserva, sube y confirma, y devuelve la URL lista para guardar", async () => {
    const { fn, llamadas } = fetchFalso({});
    const r = await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assetId).toBe(ASSET);
    expect(r.url).toBe("https://imagedelivery.net/h/img/gallery");

    // Los tres pasos, en orden.
    expect(llamadas[0].ruta).toContain("/api/media/sesion");
    expect(bucket.puestos).toHaveLength(1);
    expect(llamadas[1].ruta).toContain("/api/media/confirmar");
  });

  it("manda al PUT las cabeceras del servidor TAL CUAL", async () => {
    const { fn } = fetchFalso({});
    await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );

    const cab = bucket.puestos[0].cabeceras;
    expect(cab["If-None-Match"]).toBe("*");
    expect(cab["Content-Type"]).toBe("image/jpeg");
    // `Content-Length` es una forbidden header name: si se mandara, el
    // navegador la ignoraría y ademas no esta en la firma.
    expect(Object.keys(cab).map((k) => k.toLowerCase())).not.toContain("content-length");
  });

  it("describe el archivo con lo que el archivo dice, no con lo que uno supone", async () => {
    const { fn, llamadas } = fetchFalso({});
    await subirArchivo(
      { archivo: archivoFalso("mi retrato.PNG", "image/png", 4096), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(llamadas[0].cuerpo).toMatchObject({
      mime: "image/png",
      bytes: 4096,
      nombre: "mi retrato.PNG",
      entity_type: "rancho",
      entity_id: UUID,
    });
  });

  it("el mismo solicitud_id viaja una sola vez y se reutiliza", async () => {
    const { fn, llamadas } = fetchFalso({});
    await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(llamadas[0].cuerpo.solicitud_id).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("un reemplazo manda el asset que viene a sustituir", async () => {
    const { fn, llamadas } = fetchFalso({});
    await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD, reemplazaAssetId: ASSET },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(llamadas[0].cuerpo.reemplaza_asset_id).toBe(ASSET);
  });

  it("una confirmación idempotente se informa como reutilizada", async () => {
    const { fn } = fetchFalso({
      confirmar: { status: 200, cuerpo: { asset_id: ASSET, url: null, ya_estaba: true } },
    });
    const r = await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(r.ok && r.reutilizada).toBe(true);
  });
});

describe("cuando algo sale mal", () => {
  it("un 412 del bucket se traduce a que esa subida ya se usó", async () => {
    const { fn } = fetchFalso({});
    const b = bucketFalso(412);
    const r = await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: b.fn }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("ya-usada");
  });

  it("si el PUT falla NO se confirma nada", async () => {
    const { fn, llamadas } = fetchFalso({});
    const b = bucketFalso(500);
    await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: b.fn }),
    );
    expect(llamadas.some((l) => l.ruta.includes("confirmar"))).toBe(false);
  });

  it("el mensaje del servidor llega al usuario tal como lo escribió el servidor", async () => {
    const { fn } = fetchFalso({
      sesion: { status: 409, cuerpo: { codigo: "cupo-agotado", mensaje: "Ya no queda lugar para más archivos acá." } },
    });
    const r = await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("cupo-agotado");
    expect(r.mensaje).toBe("Ya no queda lugar para más archivos acá.");
  });

  it("si la sesión falla, no se sube nada al bucket", async () => {
    const { fn } = fetchFalso({ sesion: { status: 422, cuerpo: { codigo: "fuera-de-alcance", mensaje: "x" } } });
    await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(bucket.mock).not.toHaveBeenCalled();
  });

  it("sin red se dice que es la conexión, no un error del servidor", async () => {
    const { fn } = fetchFalso({ lanzar: "sesion" });
    const r = await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("sin-red");
  });

  it("si el archivo subió pero no se pudo confirmar, se dice exactamente eso", async () => {
    const { fn } = fetchFalso({ lanzar: "confirmar" });
    const r = await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.mensaje).toContain("subió pero no se pudo confirmar");
  });

  it("una respuesta que no es JSON no rompe el flujo", async () => {
    const fn = (async () =>
      ({ ok: false, status: 502, json: async () => { throw new Error("no json"); } }) as unknown as Response) as unknown as typeof fetch;
    const r = await subirArchivo(
      { archivo: archivoFalso(), entidad: ENTIDAD },
      deps({ fetch: fn, subirABucket: bucket.fn }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("http-502");
  });
});

describe("varias fotos", () => {
  it("van de a tres y no todas juntas", async () => {
    const { fn } = fetchFalso({});
    const b = bucketFalso();
    const archivos = Array.from({ length: 7 }, (_, i) => archivoFalso(`f${i}.jpg`));

    const r = await subirVarios(archivos, ENTIDAD, {}, deps({ fetch: fn, subirABucket: b.fn }));

    expect(r).toHaveLength(7);
    expect(r.every((x) => x.ok)).toBe(true);
    expect(MAX_A_LA_VEZ).toBe(3);
  });

  it("informa el avance por tanda", async () => {
    const { fn } = fetchFalso({});
    const b = bucketFalso();
    const avances: number[] = [];
    await subirVarios(
      Array.from({ length: 5 }, (_, i) => archivoFalso(`f${i}.jpg`)),
      ENTIDAD,
      { onProgresoTotal: (hechos) => avances.push(hechos) },
      deps({ fetch: fn, subirABucket: b.fn }),
    );
    expect(avances).toEqual([3, 5]);
  });

  it("una foto que falla no tumba a las demás", async () => {
    let n = 0;
    const fn = (async (url: string | URL) => {
      const ruta = String(url);
      if (ruta.includes("sesion")) {
        n += 1;
        // La segunda pide un formato no admitido.
        if (n === 2) {
          return { ok: false, status: 422, json: async () => ({ codigo: "fuera-de-alcance", mensaje: "no" }) } as unknown as Response;
        }
        return {
          ok: true,
          status: 201,
          json: async () => ({
            asset_id: ASSET,
            subida: { url: "https://r2/x", cabeceras: { "If-None-Match": "*" } },
          }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ asset_id: ASSET, url: "https://u" }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const r = await subirVarios(
      [archivoFalso("a.jpg"), archivoFalso("b.jpg"), archivoFalso("c.jpg")],
      ENTIDAD,
      {},
      deps({ fetch: fn, subirABucket: bucketFalso().fn }),
    );
    expect(r.filter((x) => x.ok)).toHaveLength(2);
    expect(r.filter((x) => !x.ok)).toHaveLength(1);
  });
});
