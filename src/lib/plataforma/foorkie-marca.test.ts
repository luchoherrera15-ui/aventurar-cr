import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  elegirLocalDeFoorkie,
  localDeFoorkieDeLaTarjeta,
  losCorreosLosMandaFoorkie,
  MARCA_BOOKEA,
  marcaDeLaTarjeta,
  marcaDelPase,
  slugDeFoorkie,
  type FilaLocalDeFoorkie,
} from "./foorkie-marca";

const RANCHO = "11111111-1111-4111-8111-111111111111";
const OTRO_RANCHO = "22222222-2222-4222-8222-222222222222";
const PROGRAMA = "33333333-3333-4333-8333-333333333333";

describe("marcaDelPase — qué firma lleva el pase", () => {
  it("sin local de Foorkie es EXACTAMENTE lo de siempre (los negocios de Bookea no cambian)", () => {
    expect(marcaDelPase(null)).toBe(MARCA_BOOKEA);
    expect(MARCA_BOOKEA.firma).toEqual({ key: "bookea", label: "Powered by", value: "Bookea.lat" });
    expect(MARCA_BOOKEA.altText).toBe("Powered by Bookea.lat");
    expect(MARCA_BOOKEA.links).toEqual([]);
    expect(MARCA_BOOKEA.encabezadoMensaje).toBe("Bookea");
  });

  it("una tarjeta de Foorkie firma «Powered by Foorkie» y dice «Foorkie Lealtad» bajo el QR", () => {
    const m = marcaDelPase({ slug: "pura-matcha" });
    expect(m.marca).toBe("foorkie");
    expect(m.firma).toEqual({ key: "foorkie", label: "Powered by", value: "Foorkie" });
    expect(m.altText).toBe("Foorkie Lealtad");
    expect(m.encabezadoMensaje).toBe("Foorkie");
  });

  it("sus links llevan a Foorkie, y ninguno a Bookea", () => {
    const m = marcaDelPase({ slug: "pura-matcha" });
    expect(Object.fromEntries(m.links.map((l) => [l.id, l.url]))).toEqual({
      unirse: "https://www.foorkie.app/lealtad/pura-matcha",
      cuenta: "https://www.foorkie.tech/cuenta",
      soporte: "https://www.foorkie.tech/soporte",
      terminos: "https://www.foorkie.tech/terminos",
      privacidad: "https://www.foorkie.tech/privacidad",
    });
    expect(JSON.stringify(m)).not.toMatch(/bookea/i);
    // Lo que se toca en Apple es la dirección corta: se ve adónde lleva.
    expect(m.links.find((l) => l.id === "unirse")?.texto).toBe("foorkie.app/lealtad/pura-matcha");
  });

  it("sin slug no hay página para unirse: ese renglón no sale, los demás sí", () => {
    const m = marcaDelPase({ slug: null });
    expect(m.marca).toBe("foorkie");
    expect(m.links.map((l) => l.id)).toEqual(["cuenta", "soporte", "terminos", "privacidad"]);
  });
});

describe("slugDeFoorkie — lo que va dentro de un link del pase", () => {
  it("acepta la forma de `foorkie_slugify`", () => {
    expect(slugDeFoorkie("pura-matcha")).toBe("pura-matcha");
    expect(slugDeFoorkie("donde-george-2")).toBe("donde-george-2");
  });

  it("rechaza lo que no tenga esa forma", () => {
    for (const malo of ["", "Pura Matcha", "../admin", "a?b=c", "-pura", "pura/matcha", "<a>", 42, null]) {
      expect(slugDeFoorkie(malo)).toBeNull();
    }
  });
});

describe("elegirLocalDeFoorkie — quién pone la marca si varios comparten la tarjeta", () => {
  const fila = (f: FilaLocalDeFoorkie): FilaLocalDeFoorkie => ({
    activo: true,
    estado_publicacion: "aprobado",
    bookea_rancho_id: RANCHO,
    ...f,
  });

  it("el primero publicado y activo, aunque haya uno más viejo sin publicar", () => {
    const local = elegirLocalDeFoorkie(
      [
        fila({ slug: "sucursal-nueva", created_at: "2026-09-20T10:00:00Z" }),
        fila({ slug: "sin-publicar", created_at: "2026-09-01T10:00:00Z", estado_publicacion: "pendiente" }),
        fila({ slug: "oculta", created_at: "2026-09-02T10:00:00Z", activo: false }),
        fila({ slug: "la-primera", created_at: "2026-09-10T10:00:00Z" }),
      ],
      RANCHO,
    );
    expect(local).toEqual({ slug: "la-primera" });
  });

  it("si ninguno está publicado y activo, el primero (el más viejo)", () => {
    const local = elegirLocalDeFoorkie([
      fila({ slug: "segunda", created_at: "2026-09-10T10:00:00Z", estado_publicacion: "pendiente" }),
      fila({ slug: "primera", created_at: "2026-09-01T10:00:00Z", activo: false }),
    ]);
    expect(local).toEqual({ slug: "primera" });
  });

  it("una fila sin fecha no le gana el primer puesto a una con fecha", () => {
    const local = elegirLocalDeFoorkie([
      fila({ slug: "sin-fecha", created_at: null, estado_publicacion: "pendiente" }),
      fila({ slug: "con-fecha", created_at: "2026-09-01T10:00:00Z", estado_publicacion: "pendiente" }),
    ]);
    expect(local).toEqual({ slug: "con-fecha" });
  });

  it("descarta la fila que vincula esta tarjeta con OTRO negocio de Bookea", () => {
    expect(elegirLocalDeFoorkie([fila({ slug: "ajena", bookea_rancho_id: OTRO_RANCHO })], RANCHO)).toBeNull();
    // Sin negocio anotado todavía, vale.
    expect(elegirLocalDeFoorkie([fila({ slug: "vieja", bookea_rancho_id: null })], RANCHO)).toEqual({ slug: "vieja" });
  });

  it("sin filas no es de Foorkie; un slug raro deja el local sin link para unirse", () => {
    expect(elegirLocalDeFoorkie([])).toBeNull();
    expect(elegirLocalDeFoorkie([fila({ slug: "No Vale" })])).toEqual({ slug: null });
  });
});

/**
 * Una base de mentira para `foorkie_restaurantes` que APLICA los filtros
 * `eq` de la consulta: si la guardia se olvidara de pedir la marca, la
 * fila sin marca (Pura Matcha) llegaría y la prueba se pondría roja.
 */
function dbFalsa(respuesta: { filas?: Record<string, unknown>[]; error?: { message: string } | null; lanza?: boolean }) {
  const llamadas: { tabla: string; filtros: [string, unknown][] }[] = [];
  const db = {
    from(tabla: string) {
      const llamada = { tabla, filtros: [] as [string, unknown][] };
      llamadas.push(llamada);
      const q = {
        select: () => q,
        eq(col: string, val: unknown) {
          llamada.filtros.push([col, val]);
          return q;
        },
        limit: () => {
          if (respuesta.lanza) return Promise.reject(new Error("se cortó la red"));
          if (respuesta.error) return Promise.resolve({ data: null, error: respuesta.error });
          const filas = (respuesta.filas ?? []).filter((f) => llamada.filtros.every(([c, v]) => f[c] === v));
          return Promise.resolve({ data: filas, error: null });
        },
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, llamadas };
}

/** Un local de Foorkie con esta tarjeta, publicado; `marca` = `lealtad_por_foorkie`. */
const local = (slug: string, marca: boolean, extra: Record<string, unknown> = {}) => ({
  slug,
  activo: true,
  estado_publicacion: "aprobado",
  created_at: "2026-09-01T10:00:00Z",
  bookea_rancho_id: RANCHO,
  bookea_programa_id: PROGRAMA,
  lealtad_por_foorkie: marca,
  ...extra,
});

describe("localDeFoorkieDeLaTarjeta / marcaDeLaTarjeta — UNA lectura, con la marca explícita", () => {
  afterEach(() => vi.restoreAllMocks());

  it("CON la marca: el pase de Foorkie y Bookea no le escribe al cliente", async () => {
    const { db, llamadas } = dbFalsa({ filas: [local("donde-george", true)] });
    const marca = await marcaDeLaTarjeta(db, { programaId: PROGRAMA, ranchoId: RANCHO });
    expect(marca.marca).toBe("foorkie");
    expect(marca.encabezadoMensaje).toBe("Foorkie");
    expect(marca.links[0].url).toBe("https://www.foorkie.app/lealtad/donde-george");
    expect(await losCorreosLosMandaFoorkie(db, { programaId: PROGRAMA, ranchoId: RANCHO })).toBe(true);
    // Una consulta por pregunta, por la tarjeta Y por la marca.
    expect(llamadas[0].tabla).toBe("foorkie_restaurantes");
    expect(llamadas[0].filtros).toEqual([
      ["bookea_programa_id", PROGRAMA],
      ["lealtad_por_foorkie", true],
    ]);
  });

  it("vinculada SIN la marca (como Pura Matcha): el pase de Bookea y los correos de siempre", async () => {
    const { db } = dbFalsa({ filas: [local("pura-matcha", false)] });
    expect(await marcaDeLaTarjeta(db, { programaId: PROGRAMA, ranchoId: RANCHO })).toBe(MARCA_BOOKEA);
    expect(await losCorreosLosMandaFoorkie(db, { programaId: PROGRAMA, ranchoId: RANCHO })).toBe(false);
  });

  it("una tarjeta que ningún local de Foorkie tiene: la marca de Bookea", async () => {
    const { db } = dbFalsa({ filas: [] });
    expect(await marcaDeLaTarjeta(db, { programaId: PROGRAMA })).toBe(MARCA_BOOKEA);
    expect(await losCorreosLosMandaFoorkie(db, { programaId: PROGRAMA })).toBe(false);
  });

  it("si la consulta falla (la columna todavía no existe, la red se corta): Bookea de siempre y nunca lanza", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sinColumna = dbFalsa({
      filas: [local("donde-george", true)],
      error: { message: "column foorkie_restaurantes.lealtad_por_foorkie does not exist" },
    });
    expect(await localDeFoorkieDeLaTarjeta(sinColumna.db, { programaId: PROGRAMA })).toBeNull();
    expect(await marcaDeLaTarjeta(sinColumna.db, { programaId: PROGRAMA })).toBe(MARCA_BOOKEA);
    expect(await losCorreosLosMandaFoorkie(sinColumna.db, { programaId: PROGRAMA })).toBe(false);
    const cortada = dbFalsa({ lanza: true });
    expect(await marcaDeLaTarjeta(cortada.db, { programaId: PROGRAMA })).toBe(MARCA_BOOKEA);
    expect(await losCorreosLosMandaFoorkie(cortada.db, { programaId: PROGRAMA })).toBe(false);
  });

  it("si varias sucursales comparten la tarjeta, solo cuentan las marcadas", async () => {
    const { db } = dbFalsa({
      filas: [
        local("la-vieja-sin-marca", false, { created_at: "2026-08-01T10:00:00Z" }),
        local("la-marcada", true, { created_at: "2026-09-15T10:00:00Z" }),
      ],
    });
    expect((await marcaDeLaTarjeta(db, { programaId: PROGRAMA, ranchoId: RANCHO })).links[0].url).toBe(
      "https://www.foorkie.app/lealtad/la-marcada",
    );
  });

  it("la guardia de los correos no depende de que el local esté publicado: con la marca alcanza", async () => {
    const { db } = dbFalsa({ filas: [local("sin-publicar", true, { activo: false, estado_publicacion: "pendiente" })] });
    expect(await losCorreosLosMandaFoorkie(db, { programaId: PROGRAMA, ranchoId: RANCHO })).toBe(true);
  });

  it("sin programa no pregunta nada", async () => {
    const { db, llamadas } = dbFalsa({ filas: [] });
    expect(await localDeFoorkieDeLaTarjeta(db, { programaId: "" })).toBeNull();
    expect(llamadas).toHaveLength(0);
  });
});
