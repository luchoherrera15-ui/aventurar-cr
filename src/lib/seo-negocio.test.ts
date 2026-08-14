import { describe, expect, it } from "vitest";
import {
  datosEstructuradosNegocio,
  descripcionNegocio,
  jsonLdSeguro,
  metadataNegocio,
  type NegocioSeo,
} from "./seo-negocio";

const negocio = (extra: Partial<NegocioSeo> = {}): NegocioSeo => ({
  nombre: "Rancho Las Torres",
  ruta: "/rancholastorres",
  categoriaLabel: "Lugares",
  descripcion: "Rancho con piscina y salón techado para 200 personas.",
  provincia: "Alajuela",
  canton: "Atenas",
  direccionExacta: "300 m sur de la iglesia",
  latitud: 9.9787,
  longitud: -84.3819,
  fotos: ["https://cdn.bookea.lat/portada.jpg", "https://cdn.bookea.lat/2.jpg"],
  precioDesde: 150000,
  unidadPrecio: "por evento",
  telefono: "88887777",
  redes: ["https://instagram.com/rancholastorres", null, "@sinurl", ""],
  ...extra,
});

describe("lo que se ve al compartir por WhatsApp", () => {
  it("lleva la foto del negocio — que es todo el punto", () => {
    const m = metadataNegocio(negocio());
    expect(m.openGraph?.images).toEqual([
      { url: "https://cdn.bookea.lat/portada.jpg", alt: "Rancho Las Torres" },
      { url: "https://cdn.bookea.lat/2.jpg", alt: "Rancho Las Torres" },
    ]);
  });

  it("el título es el negocio y dónde queda, no el del sitio", () => {
    expect(metadataNegocio(negocio()).title).toBe("Rancho Las Torres — Atenas, Alajuela");
    expect(metadataNegocio(negocio({ canton: null, provincia: null })).title).toBe(
      "Rancho Las Torres",
    );
  });

  it("la cabecera de provincia no se dice dos veces", () => {
    expect(metadataNegocio(negocio({ canton: "Alajuela" })).title).toBe(
      "Rancho Las Torres — Alajuela",
    );
  });

  it("una foto repetida no ocupa dos lugares del preview", () => {
    const m = metadataNegocio(
      negocio({ fotos: ["https://cdn.bookea.lat/a.jpg", "https://cdn.bookea.lat/a.jpg", ""] }),
    );
    expect(m.openGraph?.images).toEqual([
      { url: "https://cdn.bookea.lat/a.jpg", alt: "Rancho Las Torres" },
    ]);
  });

  it("sin fotos no promete una tarjeta con imagen", () => {
    const m = metadataNegocio(negocio({ fotos: [] }));
    expect(m.openGraph?.images).toBeUndefined();
    // `Metadata["twitter"]` es una unión y no todas sus ramas declaran
    // `card`; se lee por la forma, sin `any`.
    const twitter = m.twitter as { card?: string; images?: unknown } | null | undefined;
    expect(twitter?.card).toBe("summary");
    expect(twitter?.images).toBeUndefined();
  });

  it("canoniza a la dirección oficial del sitio", () => {
    expect(metadataNegocio(negocio()).alternates?.canonical).toBe(
      "https://www.bookea.lat/rancholastorres",
    );
  });

  it("sin descripción propia se arma una con lo que sí se sabe", () => {
    // El separador de miles lo pone `toLocaleString("es-CR")` (un
    // espacio duro), así que se arma igual en vez de clavarlo a mano.
    expect(descripcionNegocio(negocio({ descripcion: null }))).toBe(
      `Lugares en Atenas, Alajuela. Desde ₡${(150000).toLocaleString("es-CR")} por evento. ` +
        "Mirá fotos, precios y disponibilidad, y reservá en Bookea.",
    );
  });

  it("una descripción larguísima no se manda entera al preview", () => {
    const d = descripcionNegocio(negocio({ descripcion: "a".repeat(400) }));
    expect(d.length).toBeLessThanOrEqual(200);
    expect(d.endsWith("…")).toBe(true);
  });
});

describe("datos estructurados", () => {
  it("llevan dirección y rango de precio", () => {
    const d = datosEstructuradosNegocio(negocio());
    expect(d["@type"]).toBe("LocalBusiness");
    expect(d.address).toEqual({
      "@type": "PostalAddress",
      addressCountry: "CR",
      streetAddress: "300 m sur de la iglesia",
      addressLocality: "Atenas",
      addressRegion: "Alajuela",
    });
    expect(d.priceRange).toBe(`Desde ₡${(150000).toLocaleString("es-CR")} por evento`);
    expect(d.geo).toEqual({ "@type": "GeoCoordinates", latitude: 9.9787, longitude: -84.3819 });
  });

  it("una dirección vacía no sale a medias", () => {
    const d = datosEstructuradosNegocio(
      negocio({ direccionExacta: null, canton: null, provincia: null }),
    );
    expect(d.address).toBeUndefined();
  });

  it("`sameAs` solo acepta URLs — el arroba suelto no es un perfil", () => {
    expect(datosEstructuradosNegocio(negocio()).sameAs).toEqual([
      "https://instagram.com/rancholastorres",
    ]);
    expect(datosEstructuradosNegocio(negocio({ redes: ["@solotexto"] })).sameAs).toBeUndefined();
  });
});

describe("jsonLdSeguro", () => {
  it("una descripción con etiquetas no puede cerrar el <script>", () => {
    const salida = jsonLdSeguro(
      datosEstructuradosNegocio(
        negocio({ descripcion: '</script><img src=x onerror="alert(1)">' }),
      ),
    );
    expect(salida).not.toContain("</script>");
    expect(salida).not.toContain("<img");
    // Y sigue siendo el mismo JSON: el escape es de transporte.
    expect((JSON.parse(salida) as { description: string }).description).toBe(
      '</script><img src=x onerror="alert(1)">',
    );
  });
});
