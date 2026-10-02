import { describe, expect, it } from "vitest";
import { tintaSobre } from "@/lib/colores-imagen";
import { ICONOS_SELLO } from "@/lib/lealtad/iconos-sello";
import { marcaDelPase } from "@/lib/plataforma/foorkie-marca";
import { paradasDelFondo } from "@/lib/wallet/fondo-tira";
import { nombreParaLogo } from "@/lib/wallet/imagenes";
import { CONFIG_CLASICA, configDesdeJson, layoutDeLaTira } from "@/lib/wallet/layout-tira";
import { camposSegunModo, tarjetaDesdeFila } from "@/lib/wallet/tarjeta";
import { inicialDeGoogle, nombreDelLogo, soloHttps, vistaParaFoorkie } from "./foorkie-vista";

/**
 * La vista del pase que viaja a Foorkie (`foorkie-vista.ts`). Lo que se
 * fija: cada pieza es la que sale de la función del generador —no una
 * copia que se pueda quedar vieja— y nada de lo que viaja apunta a una
 * imagen que el pase no usa.
 */

const LOGO = "https://x.supabase.co/storage/v1/object/public/comprobantes/logos-negocio/logo.png";
const BANDA = "https://x.supabase.co/storage/v1/object/public/comprobantes/logos-negocio/banda.jpg";
const PROPIO = "https://x.supabase.co/storage/v1/object/public/comprobantes/iconos/matcha.png";
const META = { nombre: "Bebida gratis", costo_puntos: 10 };

const sellos = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "p1",
  rancho_id: "r1",
  modo: "sellos",
  estado: "activo",
  activo: true,
  pase_color_fondo: "#38571a",
  pase_color_sello: "#929292",
  beneficio: { tipo: "sellos", requeridos: 10, recompensa: "Bebida gratis", inicial: 0, repetible: true },
  ...extra,
});

describe("vistaParaFoorkie: sellos", () => {
  it("sin logo ni dibujo: los colores del pass.json, los textos del pase y la grilla del generador", () => {
    const v = vistaParaFoorkie({ fila: sellos(), negocio: "Pura Prueba", saldo: 3, meta: META, pausada: false });
    expect(v.version).toBe(1);
    expect(v.modo).toBe("sellos");
    // foregroundColor = tintaSobre(fondo); labelColor = el color del sello.
    expect(v.colores).toEqual({ fondo: "#38571a", tinta: tintaSobre("#38571a"), etiqueta: "#929292", sello: "#929292" });
    expect(v.logo).toBeNull();
    const { config, beneficio } = tarjetaDesdeFila(sellos());
    expect(v.textos).toEqual(camposSegunModo({ negocioNombre: "Pura Prueba", saldo: 3, meta: META, config, beneficio }));
    expect(v.textos.encabezado).toEqual({ label: "SELLOS", value: "3/10" });
    if (v.tira.tipo !== "sellos") throw new Error("tenía que ser una tira de sellos");
    expect(v.tira.total).toBe(10);
    expect(v.tira.logrados).toBe(3);
    expect(v.tira.diseno).toEqual(CONFIG_CLASICA);
    expect(v.tira.degradado).toBeNull();
    const l = layoutDeLaTira(10, CONFIG_CLASICA);
    expect(v.tira.layout).toEqual({ ancho: 375, alto: 123, diametro: l.diametro, posiciones: l.posiciones });
    // Sin logo, el sello es el disco liso del color del sello.
    expect(v.tira.sello).toEqual({ clase: "logo" });
    expect(v.tira.imagen).toBeNull();
    expect(v.tira.banda).toBeNull();
    expect(v.tira.velo).toBe(0.42);
    // Android: el número grande es el saldo y la etiqueta la del objeto.
    expect(v.google).toEqual({ logo: null, inicial: "P", saldo: { etiqueta: "Sellos", valor: "3" }, banda: null });
    // Sin marca: lo que dice el pase de Bookea bajo el QR.
    expect(v.marca).toBe("bookea");
    expect(v.pie).toBe("Powered by Bookea.lat");
  });

  it("con logo y sin dibujo: el LOGO va adentro de cada sello (como `imagenDentroDelSello`)", () => {
    const v = vistaParaFoorkie({ fila: sellos({ pase_logo_url: LOGO }), negocio: "Pura", saldo: 0, meta: META, pausada: false });
    expect(v.logo).toBe(LOGO);
    expect(v.google.logo).toBe(LOGO);
    if (v.tira.tipo !== "sellos") throw new Error("tira");
    expect(v.tira.sello).toEqual({ clase: "logo" });
    expect(v.tira.imagen).toBe(LOGO);
  });

  it("con uno de los doce dibujos: viajan sus trazos y no va imagen adentro aunque haya logo", () => {
    const v = vistaParaFoorkie({
      fila: sellos({ pase_logo_url: LOGO, pase_sello_icono: "cafe" }),
      negocio: "Pura",
      saldo: 0,
      meta: META,
      pausada: false,
    });
    if (v.tira.tipo !== "sellos") throw new Error("tira");
    expect(v.tira.sello).toEqual({ clase: "icono", icono: "cafe", trazos: [...ICONOS_SELLO.cafe.trazos] });
    expect(v.tira.imagen).toBeNull();
  });

  it("con el ícono propio: va ESE archivo adentro de cada sello", () => {
    const v = vistaParaFoorkie({
      fila: sellos({ pase_logo_url: LOGO, pase_sello_icono: "propio", pase_sello_icono_url: PROPIO }),
      negocio: "Pura",
      saldo: 0,
      meta: META,
      pausada: false,
    });
    if (v.tira.tipo !== "sellos") throw new Error("tira");
    expect(v.tira.sello).toEqual({ clase: "propio", url: PROPIO });
    expect(v.tira.imagen).toBe(PROPIO);
  });

  it("la geometría propia (0212) y el degradado: las mismas funciones que sharp", () => {
    const diseno = {
      filas: 1,
      escalaSello: 1.3,
      alineacionH: "izquierda",
      alineacionV: "abajo",
      margenY: 0.12,
      fondo: { forma: "cascada", acento: "#6B3A18", acento2: "#A8742E" },
    };
    const v = vistaParaFoorkie({
      fila: sellos({ pase_diseno: diseno, pase_banner_url: BANDA }),
      negocio: "Pura",
      saldo: 4,
      meta: { nombre: "Postre", costo_puntos: 8 },
      pausada: false,
    });
    if (v.tira.tipo !== "sellos") throw new Error("tira");
    const config = configDesdeJson(diseno);
    expect(v.tira.diseno).toEqual(config);
    expect(v.tira.degradado).toEqual(paradasDelFondo(config.fondo, "#38571a"));
    const l = layoutDeLaTira(8, config);
    expect(v.tira.layout.posiciones).toEqual(l.posiciones);
    expect(v.tira.layout.diametro).toBe(l.diametro);
    // La foto viaja (la decide `tiraDelPase`), pero con degradado el dibujo no la pinta.
    expect(v.tira.banda).toBe(BANDA);
    expect(v.google.banda).toBe(BANDA);
  });

  it("sin fila en `recompensas`: el texto sale del beneficio pero la franja no lleva sellos (igual que el pase)", () => {
    const sinBanda = vistaParaFoorkie({ fila: sellos(), negocio: "Pura", saldo: 0, meta: null, pausada: false });
    expect(sinBanda.textos.encabezado).toEqual({ label: "SELLOS", value: "0/10" });
    expect(sinBanda.tira).toEqual({ tipo: "ninguna" });
    const conBanda = vistaParaFoorkie({ fila: sellos({ pase_banner_url: BANDA }), negocio: "Pura", saldo: 0, meta: null, pausada: false });
    expect(conBanda.tira).toEqual({ tipo: "banda", banda: BANDA });
  });

  it("en pausa: el renglón de estado es el aviso de la pausa", () => {
    const v = vistaParaFoorkie({ fila: sellos(), negocio: "Pura", saldo: 3, meta: META, pausada: true });
    expect(v.pausada).toBe(true);
    expect(v.textos.detalle.label).toBe("EN PAUSA");
    // El número de Android no cambia con la pausa (va como módulo aparte).
    expect(v.google.saldo).toEqual({ etiqueta: "Sellos", valor: "3" });
  });
});

describe("vistaParaFoorkie: cashback, cupón y lo que no viaja", () => {
  const cashback = (extra: Record<string, unknown> = {}) => ({
    id: "p2",
    rancho_id: "r2",
    modo: "cashback",
    estado: "activo",
    activo: true,
    beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null },
    pase_color_fondo: "#1B2A6B",
    pase_color_sello: "#FCB700",
    ...extra,
  });

  it("cashback con banda: la foto ES la franja; Android muestra el saldo y la banda", () => {
    const v = vistaParaFoorkie({
      fila: cashback({ pase_logo_url: LOGO, pase_banner_url: BANDA }),
      negocio: "Donde Prueba",
      saldo: 1250,
      meta: { nombre: "₡1 000 de tu cashback", costo_puntos: 1000 },
      pausada: false,
      marca: marcaDelPase({ slug: "coyol" }),
    });
    expect(v.tira).toEqual({ tipo: "banda", banda: BANDA });
    expect(v.textos.encabezado.label).toBe("SALDO");
    expect(v.textos.regalia).toEqual({ label: "CANJEÁ POR", value: "₡1 000 de tu cashback" });
    expect(v.google).toEqual({ logo: LOGO, inicial: "D", saldo: { etiqueta: "Saldo", valor: "1250" }, banda: BANDA });
    // Con la marca de Foorkie: lo que dice bajo el QR.
    expect(v.marca).toBe("foorkie");
    expect(v.pie).toBe("Foorkie Lealtad");
  });

  it("sin banda no hay franja", () => {
    expect(vistaParaFoorkie({ fila: cashback(), negocio: "D", saldo: 0, meta: null, pausada: false }).tira).toEqual({ tipo: "ninguna" });
  });

  it("un cupón no acumula: Android muestra el beneficio, no un 0", () => {
    const v = vistaParaFoorkie({
      fila: { id: "p3", rancho_id: "r3", modo: "cupon", beneficio: { tipo: "cupon", beneficio: { forma: "porcentaje", valor: 30 }, compraMinima: 0, descuentoMaximo: null, usosPorCliente: 1 } },
      negocio: "Cupón",
      saldo: 0,
      meta: null,
      pausada: false,
    });
    expect(v.google.saldo).toEqual({ etiqueta: "Cupón", valor: "30% OFF" });
  });

  it("sobre un fondo claro la tinta deja de ser blanca (la misma regla del pass.json)", () => {
    const v = vistaParaFoorkie({ fila: cashback({ pase_color_fondo: "#F5F0E6" }), negocio: "D", saldo: 0, meta: null, pausada: false });
    expect(v.colores.tinta).toBe(tintaSobre("#F5F0E6"));
    expect(v.colores.tinta).not.toBe("#ffffff");
  });

  it("sin colores guardados: los de fábrica, como el pase", () => {
    const v = vistaParaFoorkie({ fila: { id: "p", modo: "cashback" }, negocio: "D", saldo: 0, meta: null, pausada: false });
    expect(v.colores).toMatchObject({ fondo: "#002472", sello: "#F39200", etiqueta: "#F39200" });
  });

  it("solo imágenes https: lo demás no viaja", () => {
    const v = vistaParaFoorkie({
      fila: cashback({ pase_logo_url: "http://x.com/logo.png", pase_banner_url: "javascript:alert(1)" }),
      negocio: "D",
      saldo: 0,
      meta: null,
      pausada: false,
    });
    expect(v.logo).toBeNull();
    expect(v.tira).toEqual({ tipo: "ninguna" });
    expect(v.google.banda).toBeNull();
    expect(soloHttps(" https://a.b/c.png ")).toBe("https://a.b/c.png");
    expect(soloHttps('https://a.b/"><script>')).toBeNull();
    expect(soloHttps(null)).toBeNull();
  });

  it("es JSON puro: viaja y vuelve igual", () => {
    const v = vistaParaFoorkie({
      fila: sellos({ pase_logo_url: LOGO, pase_sello_icono: "estrella" }),
      negocio: "Pura",
      saldo: 2,
      meta: META,
      pausada: false,
    });
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });
});

describe("las copias chicas dicen lo mismo que el original", () => {
  it("el nombre del logo es el de `nombreParaLogo`", () => {
    for (const n of ["El PADRINO DETAILING CAR.🚘", "🌿 Pura   Matcha", "Café ☕️ de la casa", "Soda 👨‍🍳 Doña Ana", "Donde George"]) {
      expect(nombreDelLogo(n)).toBe(nombreParaLogo(n));
    }
  });

  it("la inicial de Google es la primera letra en mayúscula (o «B» sin nombre)", () => {
    expect(inicialDeGoogle("pura matcha")).toBe("P");
    expect(inicialDeGoogle("  ")).toBe("B");
    expect(inicialDeGoogle("🌿 Pura")).toBe("🌿");
  });
});
