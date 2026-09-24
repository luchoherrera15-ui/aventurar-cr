import { describe, expect, it } from "vitest";
import { limpiarSlugEscrito, sugerirSlug, veredictoSlug } from "./slug";
import { validarCelebracion } from "./validar-celebracion";

describe("sugerirSlug", () => {
  it("quita tildes, baja a minúsculas y vuelve «&» en «y»", () => {
    expect(sugerirSlug("La boda de Sofía & Andrés")).toBe("la-boda-de-sofia-y-andres");
    expect(sugerirSlug("XV años de Valeria")).toBe("xv-anos-de-valeria");
    expect(sugerirSlug("Mateo cumple 5!!!")).toBe("mateo-cumple-5");
  });
  it("no deja guiones dobles ni en las puntas y respeta el largo", () => {
    expect(sugerirSlug("  --Fiesta   de   fin de año--  ")).toBe("fiesta-de-fin-de-ano");
    const largo = sugerirSlug("a".repeat(30) + " " + "b".repeat(50));
    expect(largo.length).toBeLessThanOrEqual(60);
    expect(largo.endsWith("-")).toBe(false);
  });
  it("devuelve vacío cuando el nombre no da para un slug", () => {
    expect(sugerirSlug("🎉🎉")).toBe("");
    expect(sugerirSlug("ab")).toBe("");
  });
  it("nunca sugiere una ruta del sistema", () => {
    expect(sugerirSlug("App")).toBe("app-1");
    expect(sugerirSlug("Admin")).toBe("admin-1");
  });
});

describe("limpiarSlugEscrito", () => {
  it("normaliza mientras la persona escribe sin recortar guiones finales", () => {
    expect(limpiarSlugEscrito("Boda Sofía-")).toBe("boda-sofia-");
    expect(limpiarSlugEscrito("año nuevo")).toBe("ano-nuevo");
  });
});

describe("veredictoSlug", () => {
  it("explica cada rechazo", () => {
    expect(veredictoSlug("ab")).toEqual({ ok: false, motivo: "Tiene que tener al menos 3 caracteres." });
    expect(veredictoSlug("-boda")).toEqual({ ok: false, motivo: "No puede empezar ni terminar con guion." });
    expect(veredictoSlug("Boda")).toEqual({ ok: false, motivo: "Solo minúsculas, números y guiones." });
    expect(veredictoSlug("app")).toEqual({ ok: false, motivo: "Esa dirección está reservada. Probá con otra." });
    expect(veredictoSlug("sofia-y-andres")).toEqual({ ok: true });
  });
});

describe("validarCelebracion", () => {
  const base = {
    tipo: "boda",
    nombre: "Sofía & Andrés",
    slug: "sofia-y-andres",
    fecha: "2026-12-12",
    hora: "16:00",
    lugarNombre: "Hacienda Los Sueños",
    direccion: "Escazú",
    mapsUrl: "https://maps.app.goo.gl/x",
  };
  it("acepta una celebración completa y recorta espacios", () => {
    const r = validarCelebracion({ ...base, nombre: "  Sofía & Andrés  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.nombre).toBe("Sofía & Andrés");
  });
  it("acepta sin fecha, hora ni lugar (se completan después)", () => {
    const r = validarCelebracion({ tipo: "cumpleanos", nombre: "Mateo", slug: "mateo-cumple-5" });
    expect(r.ok).toBe(true);
  });
  it("junta todos los errores de una vez", () => {
    const r = validarCelebracion({ tipo: "otra-cosa", nombre: "M", slug: "app", fecha: "12/12/2026", hora: "25:00", mapsUrl: "maps.google.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(["fecha", "hora", "mapsUrl", "nombre", "slug", "tipo"]);
    }
  });
});

describe("traducirErrorDeBase", () => {
  it("una función o tabla ausente se explica como migración pendiente, aunque el texto diga p_direccion", async () => {
    const { traducirErrorDeBase } = await import("./errores-base");
    const r = traducirErrorDeBase(
      "Could not find the function public.celebrar_crear_celebracion(p_direccion, p_fecha) in the schema cache",
    );
    expect(r.errores).toBeUndefined();
    expect(r.mensaje).toMatch(/migración 0242/);
  });
  it("los mensajes de la base para la persona van al campo del slug", async () => {
    const { traducirErrorDeBase } = await import("./errores-base");
    expect(traducirErrorDeBase("Esa dirección está reservada. Probá con otra.")).toEqual({
      errores: { slug: "Esa dirección está reservada. Probá con otra." },
    });
    expect(traducirErrorDeBase("duplicate key value violates unique constraint", "23505").errores?.slug).toMatch(/tomada/);
  });
});
