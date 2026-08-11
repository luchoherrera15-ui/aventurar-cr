import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PRECIOS_LISTA,
  VARIABLE_DE_PRECIO,
  ahorro,
  costoCloudflare,
  costoSupabase,
  formatearBytes,
  formatearCRC,
  formatearUSD,
  precios,
  preciosAjustados,
} from "./precios";
import {
  auditar,
  comparar,
  progresoAlbumes,
  repartirEntregas,
  type FilaUso,
} from "./auditoria";
import { consumoCloudflare, type DependenciasAnalytics } from "./analytics-cloudflare";

const GB = 1024 ** 3;
const P = precios({} as NodeJS.ProcessEnv);

// ============================================================
// precios.ts
// ============================================================

describe("precios: configuración", () => {
  it("sin entorno usa los de lista", () => {
    expect(P.r2AlmacenamientoGbMes).toBe(0.015);
    expect(P.tipoCambio).toBe(520);
    expect(preciosAjustados({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("cada precio se puede pisar por su variable", () => {
    const e = { PRECIO_R2_GB_MES: "0.02", TIPO_CAMBIO_USD: "540" } as unknown as NodeJS.ProcessEnv;
    expect(precios(e).r2AlmacenamientoGbMes).toBe(0.02);
    expect(precios(e).tipoCambio).toBe(540);
    expect(preciosAjustados(e)).toContain("r2AlmacenamientoGbMes");
  });

  it("hay una variable declarada para CADA precio", () => {
    for (const clave of Object.keys(PRECIOS_LISTA)) {
      expect(VARIABLE_DE_PRECIO[clave as keyof typeof PRECIOS_LISTA], clave).toBeTruthy();
    }
  });

  it("el egress de R2 es CERO, y es un valor y no un olvido", () => {
    expect(PRECIOS_LISTA.r2EgressGb).toBe(0);
    // Un cero explícito no puede ser reemplazado por el de lista vía
    // falsy: hay que poder configurar cero.
    const e = { PRECIO_SUPABASE_EGRESS_GB: "0" } as unknown as NodeJS.ProcessEnv;
    expect(precios(e).supabaseEgressGb).toBe(0);
  });

  it("un valor basura o negativo se ignora en vez de propagarse", () => {
    for (const v of ["abc", "-1", "", "   "]) {
      const e = { PRECIO_R2_GB_MES: v } as unknown as NodeJS.ProcessEnv;
      expect(precios(e).r2AlmacenamientoGbMes, v).toBe(0.015);
    }
  });

  it("un tipo de cambio de cero no convierte la factura en ₡0", () => {
    const e = { TIPO_CAMBIO_USD: "0" } as unknown as NodeJS.ProcessEnv;
    expect(precios(e).tipoCambio).toBe(520);
  });
});

describe("precios: el cálculo", () => {
  it("R2: 100 GB guardados cuestan lo que dice la lista", () => {
    const c = costoCloudflare({ bytes: 100 * GB, imagenes: 0, entregas: 0 }, P);
    expect(c.almacenamientoUSD).toBeCloseTo(1.5, 6);
    expect(c.entregaUSD).toBe(0);
  });

  it("Cloudflare Images cobra por IMAGEN, no por giga", () => {
    const c = costoCloudflare({ bytes: 0, imagenes: 100_000, entregas: 200_000 }, P);
    expect(c.almacenamientoUSD).toBeCloseTo(5, 6);
    expect(c.entregaUSD).toBeCloseTo(2, 6);
  });

  it("el total y los colones cierran", () => {
    const c = costoCloudflare({ bytes: 100 * GB, imagenes: 100_000, entregas: 0 }, P);
    expect(c.totalUSD).toBeCloseTo(6.5, 6);
    expect(c.totalCRC).toBeCloseTo(6.5 * 520, 4);
  });

  it("Supabase cobra el egress y ahí está toda la diferencia", () => {
    const uso = { bytes: 100 * GB, bytesServidos: 330 * GB };
    const s = costoSupabase(uso, P);
    expect(s.entregaUSD).toBeCloseTo(330 * 0.09, 6);
    // Servir 330 GB en Supabase cuesta ~29,7 USD; en R2, cero.
    expect(s.entregaUSD).toBeGreaterThan(s.almacenamientoUSD * 10);
  });

  it("sin uso, el costo es cero limpio", () => {
    expect(costoCloudflare({ bytes: 0, imagenes: 0, entregas: 0 }, P).totalUSD).toBe(0);
    expect(costoSupabase({ bytes: 0, bytesServidos: 0 }, P).totalUSD).toBe(0);
  });

  it("el ahorro separa lo que viene del egreso de lo que viene del disco", () => {
    const s = costoSupabase({ bytes: 100 * GB, bytesServidos: 330 * GB }, P);
    const c = costoCloudflare({ bytes: 100 * GB, imagenes: 50_000, entregas: 500_000 }, P);
    const a = ahorro(s, c, P);
    expect(a.usd).toBeCloseTo(s.totalUSD - c.totalUSD, 6);
    expect(a.crc).toBeCloseTo(a.usd * 520, 4);
    // Casi todo el ahorro sale de la entrega, no del almacenamiento.
    expect(a.porEntregaUSD).toBeGreaterThan(a.porAlmacenamientoUSD);
  });
});

describe("precios: presentación", () => {
  it("los bytes se leen de un vistazo", () => {
    expect(formatearBytes(0)).toBe("0 B");
    expect(formatearBytes(999)).toBe("999 B");
    expect(formatearBytes(1024)).toBe("1.0 KB");
    // 118,5 redondea a 119: por encima de 100 no se muestran decimales.
    expect(formatearBytes(118.5 * 1024 * 1024)).toBe("119 MB");
    expect(formatearBytes(5 * GB)).toBe("5.0 GB");
  });

  it("un costo chiquito NO se redondea a $0.00", () => {
    // "$0.00" le diría a quien mira que no cuesta nada. Cuesta poco, que
    // no es lo mismo, y sumado sobre 200 álbumes deja de ser poco.
    expect(formatearUSD(0.0003)).toBe("$0.0003");
    expect(formatearUSD(12.345)).toBe("$12.35");
    expect(formatearUSD(0)).toBe("$0.00");
  });

  it("los colones usan el separador de es-CR, igual que el panel de IA", () => {
    // es-CR separa miles con espacio, no con coma. Se respeta el formato
    // local que ya muestra el resto de la plataforma.
    expect(formatearCRC(1234.6)).toBe(`₡${(1235).toLocaleString("es-CR")}`);
    expect(formatearCRC(0)).toBe("₡0");
  });

  it("el formato es EL MISMO que usa el panel de IA (una sola implementación)", async () => {
    const ia = await import("@/lib/ia/modelos");
    expect(ia.formatearCRC(1234.6)).toBe(formatearCRC(1234.6));
    expect(ia.formatearUSD(0.0003)).toBe(formatearUSD(0.0003));
  });

  it("nada revienta con NaN o infinito", () => {
    expect(formatearBytes(NaN)).toBe("0 B");
    expect(formatearUSD(NaN)).toBe("$0.00");
    expect(formatearCRC(Infinity)).toBe("₡0");
  });
});

// ============================================================
// auditoria.ts — el reparto
// ============================================================

const fila = (o: Partial<FilaUso> & { entityId: string }): FilaUso => ({
  entityType: "album",
  nombre: "X",
  archivos: 10,
  bytes: 10_000_000,
  imagenesCf: 10,
  visitas30d: null,
  ...o,
});

describe("reparto de entregas", () => {
  it("sin total de Cloudflare no se inventa nada", () => {
    const r = repartirEntregas([fila({ entityId: "a" })], null);
    expect(r.get("a")).toEqual({ entregas: null, base: "sin-datos" });
  });

  it("sin datos de tráfico reparte proporcional a las imágenes guardadas", () => {
    const r = repartirEntregas(
      [
        fila({ entityId: "a", imagenesCf: 30 }),
        fila({ entityId: "b", imagenesCf: 10 }),
      ],
      1000,
    );
    expect(r.get("a")?.entregas).toBe(750);
    expect(r.get("b")?.entregas).toBe(250);
    expect(r.get("a")?.base).toBe("proporcional");
  });

  it("el reparto SUMA el total real, no lo inventa ni lo pierde", () => {
    const filas = [
      fila({ entityId: "a", imagenesCf: 7 }),
      fila({ entityId: "b", imagenesCf: 11 }),
      fila({ entityId: "c", imagenesCf: 3 }),
    ];
    const r = repartirEntregas(filas, 10_000);
    const suma = filas.reduce((s, f) => s + (r.get(f.entityId)?.entregas ?? 0), 0);
    // Con redondeo por fila, la suma no puede desviarse más que las filas.
    expect(Math.abs(suma - 10_000)).toBeLessThanOrEqual(filas.length);
  });

  it("con tráfico medido, el que tiene más visitas se lleva más", () => {
    const r = repartirEntregas(
      [
        fila({ entityId: "mucho", entityType: "rancho", imagenesCf: 10, visitas30d: 200 }),
        fila({ entityId: "poco", entityType: "rancho", imagenesCf: 10, visitas30d: 50 }),
      ],
      1000,
    );
    expect(r.get("mucho")!.entregas!).toBeGreaterThan(r.get("poco")!.entregas!);
    expect(r.get("mucho")?.base).toBe("trafico-medido");
  });

  it("el factor de tráfico está CENTRADO EN 1: mezclar medidas y no medidas no cambia la escala", () => {
    // Una fila sin contador pesa como si tuviera tráfico promedio. Si el
    // factor no estuviera normalizado, agregar un rancho con 500 visitas
    // aplastaría a todos los álbumes por un cambio de unidades y no por
    // lo que realmente pasa.
    const conMedidas = repartirEntregas(
      [
        fila({ entityId: "album", imagenesCf: 10, visitas30d: null }),
        fila({ entityId: "r1", entityType: "rancho", imagenesCf: 10, visitas30d: 100 }),
        fila({ entityId: "r2", entityType: "rancho", imagenesCf: 10, visitas30d: 100 }),
      ],
      3000,
    );
    // Los dos ranchos tienen exactamente el promedio → factor 1 → todos
    // pesan igual, y el álbum se lleva su tercio.
    expect(conMedidas.get("album")?.entregas).toBe(1000);
    expect(conMedidas.get("r1")?.entregas).toBe(1000);
  });

  it("una entidad sin imágenes en Cloudflare no recibe entregas", () => {
    const r = repartirEntregas(
      [fila({ entityId: "a", imagenesCf: 0 }), fila({ entityId: "b", imagenesCf: 10 })],
      1000,
    );
    expect(r.get("a")?.entregas).toBe(0);
    expect(r.get("b")?.entregas).toBe(1000);
  });

  it("visitas en CERO no es lo mismo que visitas sin medir", () => {
    // Un rancho medido con 0 visitas debe pesar MENOS que un álbum sin
    // contador, que se asume promedio.
    const r = repartirEntregas(
      [
        fila({ entityId: "medido-cero", entityType: "rancho", imagenesCf: 10, visitas30d: 0 }),
        fila({ entityId: "sin-medir", imagenesCf: 10, visitas30d: null }),
        fila({ entityId: "medido-alto", entityType: "rancho", imagenesCf: 10, visitas30d: 100 }),
      ],
      1000,
    );
    expect(r.get("medido-cero")!.entregas!).toBeLessThan(r.get("sin-medir")!.entregas!);
  });

  it("una lista vacía no rompe", () => {
    expect(repartirEntregas([], 1000).size).toBe(0);
  });
});

describe("auditar", () => {
  it("ordena por costo: lo caro arriba", () => {
    const r = auditar(
      [
        fila({ entityId: "chico", imagenesCf: 1, bytes: 1000 }),
        fila({ entityId: "grande", imagenesCf: 500, bytes: 5 * GB }),
      ],
      10_000,
      P,
    );
    expect(r[0].entityId).toBe("grande");
  });

  it("cada fila dice en qué se apoya su número de entregas", () => {
    const r = auditar(
      [fila({ entityId: "a", entityType: "rancho", visitas30d: 10, imagenesCf: 5 })],
      1000,
      P,
    );
    expect(r[0].baseDelReparto).toBe("trafico-medido");
    expect(r[0].costo.entregaUSD).toBeGreaterThan(0);
  });

  it("sin analítica, el costo de entrega es cero y se dice por qué", () => {
    const r = auditar([fila({ entityId: "a" })], null, P);
    expect(r[0].entregasEstimadas).toBeNull();
    expect(r[0].baseDelReparto).toBe("sin-datos");
    // El almacenamiento sí se cobra: eso lo sabemos exacto.
    expect(r[0].costo.almacenamientoUSD).toBeGreaterThan(0);
    expect(r[0].costo.entregaUSD).toBe(0);
  });
});

describe("comparación Supabase vs Cloudflare", () => {
  it("con el caso medido (330 GB servidos) el ahorro es casi todo egreso", () => {
    const c = comparar(
      { bytes: 100 * GB, bytesServidosSupabase: 330 * GB, imagenes: 5000, entregas: 100_000 },
      P,
    );
    expect(c.ahorroUSD).toBeGreaterThan(0);
    expect(c.ahorroPorEgresoUSD / c.ahorroUSD).toBeGreaterThan(0.8);
    expect(c.ahorroCRC).toBeCloseTo(c.ahorroUSD * 520, 4);
  });

  it("sin uso no hay ahorro ni división por cero", () => {
    const c = comparar({ bytes: 0, bytesServidosSupabase: 0, imagenes: 0, entregas: 0 }, P);
    expect(c.ahorroUSD).toBe(0);
    expect(c.ahorroPorcentaje).toBe(0);
  });
});

describe("progreso de la migración", () => {
  it("distingue lo sin tocar de lo que quedó a medias", () => {
    const p = progresoAlbumes([
      { albumId: "a", titulo: "A", slug: "a", archivos: 10, bytes: 1000, migradas: 0 },
      { albumId: "b", titulo: "B", slug: "b", archivos: 10, bytes: 2000, migradas: 4 },
      { albumId: "c", titulo: "C", slug: "c", archivos: 10, bytes: 3000, migradas: 10 },
    ]);
    expect(p.albumesSinTocar).toBe(1);
    expect(p.albumesAMedias).toBe(1);
    expect(p.archivosMigrados).toBe(14);
    expect(p.porcentaje).toBeCloseTo(46.67, 1);
    expect(p.bytesLegacy).toBe(6000);
  });

  it("`migradas` por encima de `archivos` no infla el porcentaje sobre 100", () => {
    // Puede pasar de verdad: un álbum con fotos ya borradas del bucket
    // pero todavía registradas.
    const p = progresoAlbumes([
      { albumId: "a", titulo: "A", slug: "a", archivos: 5, bytes: 100, migradas: 50 },
    ]);
    expect(p.porcentaje).toBe(100);
  });

  it("sin álbumes no divide por cero", () => {
    expect(progresoAlbumes([]).porcentaje).toBe(0);
  });
});

// ============================================================
// analytics-cloudflare.ts
// ============================================================

const ENTORNO_CF = {
  CLOUDFLARE_ACCOUNT_ID: "cuenta-x",
  CLOUDFLARE_ANALYTICS_API_TOKEN: "token-secreto-de-analitica",
} as unknown as NodeJS.ProcessEnv;

function fetchGuion(respuestas: unknown[]) {
  const llamadas: { url: string; body: string; auth: string }[] = [];
  let i = 0;
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    llamadas.push({
      url: String(url),
      body: String(init?.body ?? ""),
      auth: headers.Authorization ?? "",
    });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    if (r instanceof Error) throw r;
    return { ok: true, status: 200, json: async () => r } as unknown as Response;
  };
  return { fn: fn as unknown as typeof fetch, llamadas };
}

const deps = (o: Partial<DependenciasAnalytics>): DependenciasAnalytics => ({
  entorno: ENTORNO_CF,
  ahora: new Date("2026-08-10T12:00:00Z"),
  ...o,
});

describe("analítica de Cloudflare", () => {
  it("sin token o sin cuenta avisa, y NO sale a la red", async () => {
    const { fn, llamadas } = fetchGuion([{}]);
    const r = await consumoCloudflare(deps({ entorno: {} as NodeJS.ProcessEnv, fetch: fn }));
    expect(r.disponible).toBe(false);
    if (!r.disponible) expect(r.motivo).toContain("Analytics:Read");
    expect(llamadas).toHaveLength(0);
  });

  it("trae los tres renglones y manda el token en la cabecera", async () => {
    const { fn, llamadas } = fetchGuion([
      { data: { viewer: { accounts: [{ imagesRequestsAdaptiveGroups: [{ sum: { requests: 12345 } }] }] } } },
      { data: { viewer: { accounts: [{ r2OperationsAdaptiveGroups: [
        { sum: { requests: 100 }, dimensions: { actionType: "GetObject" } },
        { sum: { requests: 50 }, dimensions: { actionType: "HeadObject" } },
      ] }] } } },
      { data: { viewer: { accounts: [{ r2StorageAdaptiveGroups: [{ max: { payloadSize: 987654321, objectCount: 4200 } }] }] } } },
    ]);
    const r = await consumoCloudflare(deps({ fetch: fn }));
    expect(r.disponible).toBe(true);
    if (!r.disponible) return;
    expect(r.consumo.imagenesEntregadas).toBe(12345);
    // Las operaciones vienen agrupadas por dimensión: se suman.
    expect(r.consumo.operacionesLecturaR2).toBe(150);
    expect(r.consumo.bytesR2).toBe(987654321);
    expect(r.consumo.objetosR2).toBe(4200);
    expect(r.parcial).toEqual([]);
    expect(llamadas[0].auth).toBe("Bearer token-secreto-de-analitica");
  });

  it("la ventana es de 30 días y va en la consulta", async () => {
    const { fn, llamadas } = fetchGuion([{ data: {} }]);
    const r = await consumoCloudflare(deps({ fetch: fn }));
    if (r.disponible) {
      expect(r.consumo.hasta).toBe("2026-08-10");
      expect(r.consumo.desde).toBe("2026-07-11");
    }
    expect(llamadas[0].body).toContain("2026-07-11");
  });

  it("un renglón que falla NO se lleva puestos a los otros", async () => {
    const { fn } = fetchGuion([
      { errors: [{ message: "unknown field imagesRequestsAdaptiveGroups" }] },
      { data: { viewer: { accounts: [{ r2OperationsAdaptiveGroups: [{ sum: { requests: 7 } }] }] } } },
      { data: { viewer: { accounts: [{ r2StorageAdaptiveGroups: [{ max: { payloadSize: 100, objectCount: 2 } }] }] } } },
    ]);
    const r = await consumoCloudflare(deps({ fetch: fn }));
    expect(r.disponible).toBe(true);
    if (!r.disponible) return;
    expect(r.consumo.imagenesEntregadas).toBeNull();
    expect(r.consumo.operacionesLecturaR2).toBe(7);
    expect(r.parcial[0]).toContain("imágenes entregadas");
  });

  it("un timeout o una caída de red degradan, no rompen", async () => {
    const e = new Error("t") as Error & { name: string };
    e.name = "TimeoutError";
    const { fn } = fetchGuion([e, e, e]);
    const r = await consumoCloudflare(deps({ fetch: fn }));
    expect(r.disponible).toBe(true);
    if (!r.disponible) return;
    expect(r.consumo.imagenesEntregadas).toBeNull();
    expect(r.parcial).toHaveLength(3);
  });

  it("GraphQL responde 200 con `errors`: no alcanza con mirar el HTTP", async () => {
    const { fn } = fetchGuion([{ errors: [{ message: "no autorizado" }] }]);
    const r = await consumoCloudflare(deps({ fetch: fn }));
    if (r.disponible) expect(r.parcial.length).toBeGreaterThan(0);
  });

  it("el token NUNCA aparece en el motivo ni en los renglones que fallan", async () => {
    const { fn } = fetchGuion([{ errors: [{ message: "bad token token-secreto-de-analitica" }] }]);
    const r = await consumoCloudflare(deps({ fetch: fn }));
    const texto = JSON.stringify(r);
    expect(texto).not.toContain("token-secreto-de-analitica");
  });
});
