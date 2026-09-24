import { describe, expect, it } from "vitest";
import { normalizarDocumento, ratioContraste } from "../invitacion/esquema";
import { CATEGORIAS_PLANTILLA, TIPOS_CELEBRACION } from "../marca";
import { POR_ESTILO, generarPlantillas, plantillasDeTipo } from "./generador";
import { PALETAS } from "./paletas";

describe("paletas", () => {
  it("cada paleta lee bien: tinta sobre fondo ≥ 4,5 y suave sobre fondo ≥ 3", () => {
    for (const [tipo, paletas] of Object.entries(PALETAS)) {
      expect(paletas.length, tipo).toBe(8);
      for (const p of paletas) {
        expect(ratioContraste(p.tinta, p.fondo), `${tipo} · ${p.nombre} tinta/fondo`).toBeGreaterThanOrEqual(4.5);
        expect(ratioContraste(p.suave, p.fondo), `${tipo} · ${p.nombre} suave/fondo`).toBeGreaterThanOrEqual(3);
        expect(ratioContraste(p.tinta, p.superficie), `${tipo} · ${p.nombre} tinta/superficie`).toBeGreaterThanOrEqual(3);
        expect(ratioContraste(p.tintaEscena, p.escena), `${tipo} · ${p.nombre} tintaEscena/escena`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("generarPlantillas", () => {
  const todas = generarPlantillas();

  it("cada estilo que un tipo ofrece tiene exactamente 20 diseños, y los slugs son únicos", () => {
    // El filtro del catálogo cruza tipo × estilo: si una combinación se
    // ofrece y está vacía, la persona ve «no hay diseños» (pasó el 22 sep
    // 2026). Lo que se ofrece, tiene sus veinte.
    for (const t of TIPOS_CELEBRACION) {
      const ps = plantillasDeTipo(t.id);
      const porCategoria = new Map<string, number>();
      for (const x of ps) porCategoria.set(x.categoria_id, (porCategoria.get(x.categoria_id) ?? 0) + 1);
      expect(porCategoria.size, `${t.id} estilos`).toBeGreaterThanOrEqual(7);
      for (const [cat, n] of porCategoria) expect(n, `${t.id} · ${cat}`).toBe(POR_ESTILO);
      expect(ps.length, t.id).toBe(porCategoria.size * POR_ESTILO);
    }
    expect(new Set(todas.map((p) => p.slug)).size).toBe(todas.length);
    expect(todas.length).toBeGreaterThanOrEqual(11 * 7 * POR_ESTILO);
  });

  it("los estilos del catálogo existen todos y cada uno lo usa más de un tipo", () => {
    const porCategoria = new Map<string, Set<string>>();
    for (const x of todas) {
      const s = porCategoria.get(x.categoria_id) ?? new Set<string>();
      s.add(x.tipos_evento[0]);
      porCategoria.set(x.categoria_id, s);
    }
    for (const c of CATEGORIAS_PLANTILLA) {
      expect(porCategoria.has(c.id), `${c.id} sin diseños`).toBe(true);
      expect(porCategoria.get(c.id)!.size, `${c.id} tipos`).toBeGreaterThanOrEqual(2);
    }
  });

  it("dentro de un tipo no hay dos plantillas con la misma combinación de estilo", () => {
    for (const t of TIPOS_CELEBRACION) {
      const firmas = plantillasDeTipo(t.id).map(
        (p) => `${p.estilos.heroe}|${p.estilos.paleta.fondo}|${p.estilos.fuenteTitulo}|${p.estilos.fuenteTexto}|${p.estilos.decoracion}|${p.estilos.ornamento}|${p.estilos.textura}`,
      );
      expect(new Set(firmas).size, t.id).toBe(firmas.length);
    }
  });

  it("cada tipo usa las seis portadas, sus ocho paletas y muchos motivos", () => {
    for (const t of TIPOS_CELEBRACION) {
      const ps = plantillasDeTipo(t.id);
      expect(new Set(ps.map((p) => p.estilos.heroe)).size, `${t.id} héroes`).toBe(6);
      expect(new Set(ps.map((p) => p.estilos.paleta.fondo)).size, `${t.id} paletas`).toBe(8);
      expect(new Set(ps.map((p) => p.estilos.decoracion)).size, `${t.id} motivos`).toBeGreaterThanOrEqual(8);
    }
  });

  it("las familias se notan: en cada tipo hay al menos 4 ornamentos, 4 texturas y 3 ritmos distintos", () => {
    for (const t of TIPOS_CELEBRACION) {
      const ps = plantillasDeTipo(t.id);
      expect(new Set(ps.map((p) => p.estilos.ornamento)).size, `${t.id} ornamentos`).toBeGreaterThanOrEqual(4);
      expect(new Set(ps.map((p) => p.estilos.apertura)).size, `${t.id} aperturas`).toBeGreaterThanOrEqual(2);
      expect(new Set(ps.map((p) => p.estilos.textura)).size, `${t.id} texturas`).toBeGreaterThanOrEqual(4);
      expect(new Set(ps.map((p) => p.estilos.ritmo)).size, `${t.id} ritmos`).toBeGreaterThanOrEqual(2);
    }
  });

  it("un documento guardado antes de las escenas se normaliza sin cambiar de aspecto", () => {
    const viejo = normalizarDocumento({
      estilo: { paleta: { fondo: "#0b1e45", tinta: "#ffffff", acento: "#e2c391", suave: "#a9b6d3", superficie: "#142b5c" }, heroe: "clasico" },
      secciones: [{ id: "hero", tipo: "hero", datos: { titulo: "Sofía & Andrés" } }, { id: "rsvp", tipo: "rsvp", datos: {} }],
    });
    expect(viejo.estilo.paleta.escena).toBe("#142b5c");
    expect(viejo.estilo.paleta.tintaEscena).toBe("#ffffff");
    expect(viejo.estilo.ritmo).toBe("uniforme");
    expect(viejo.estilo.transicion).toBe("recta");
    expect(viejo.estilo.particulas).toBe("ninguna");
    expect(viejo.secciones[1].diseno).toEqual({ tono: "auto", fondoUrl: "", alineacion: "centro", tamano: "normal", ornamento: true, fondoVivo: "auto" });
    expect(viejo.estilo.fondoVivo).toBe("ninguno");
  });

  it("es determinista", () => {
    expect(JSON.stringify(generarPlantillas())).toBe(JSON.stringify(todas));
  });

  it("cada esquema es un documento válido con portada primero y sobrevive a normalizar", () => {
    for (const p of todas) {
      expect(p.esquema.secciones[0].tipo).toBe("hero");
      const n = normalizarDocumento(JSON.parse(JSON.stringify(p.esquema)));
      expect(n.secciones.length).toBe(p.esquema.secciones.length);
      expect(n.estilo).toEqual(p.estilos);
    }
  });

  it("todo el catálogo es gratis (publicar es lo que se cobra); una de cada cuatro lleva el rótulo premium", () => {
    expect(todas.every((p) => p.costo_creditos === 0)).toBe(true);
    // Una de cada cinco (la cuarta portada de cada familia) lleva el rótulo.
    expect(todas.filter((p) => p.nivel === "premium").length).toBe(todas.length / 5);
  });

  it("las once categorías del catálogo quedan con al menos 60 diseños cada una", () => {
    const c = new Map<string, number>();
    for (const p of todas) c.set(p.categoria_id, (c.get(p.categoria_id) ?? 0) + 1);
    expect(c.size).toBe(11);
    // «infantil» es el más de nicho (cumpleaños, baby shower, bautizo y otro): 80.
    for (const [cat, n] of c) expect(n, cat).toBeGreaterThanOrEqual(60);
  });
});

describe("normalizarDocumento", () => {
  it("rechaza colores, fuentes y tipos raros y siempre deja una portada", () => {
    const d = normalizarDocumento({
      estilo: { paleta: { fondo: "red", tinta: "#FFFFFF" }, fuenteTitulo: "comic", heroe: "raro" },
      secciones: [
        { tipo: "rsvp", datos: { titulo: "<b>x</b>", whatsapp: "8888" } },
        { tipo: "inventado" },
        { tipo: "galeria", datos: { fotos: ["http://inseguro", "https://ok.example/a.jpg", 5] } },
      ],
    });
    expect(d.estilo.paleta.fondo).toBe("#f7f2ea");
    expect(d.estilo.paleta.tinta).toBe("#ffffff");
    expect(d.estilo.fuenteTitulo).toBe("playfair");
    expect(d.estilo.heroe).toBe("clasico");
    expect(d.secciones[0].tipo).toBe("hero");
    expect(d.secciones.map((s) => s.tipo)).toEqual(["hero", "rsvp", "galeria"]);
    const galeria = d.secciones[2];
    if (galeria.tipo === "galeria") expect(galeria.datos.fotos).toEqual(["https://ok.example/a.jpg"]);
  });
});
