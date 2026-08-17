import { describe, expect, it } from "vitest";
import { CODIGOS_FALLO_PASE } from "@/lib/wallet/identidad";
import { ESTADOS_VISIBLES } from "@/lib/lealtad/programas";
import {
  avisoDeFalloDelPase,
  avisoDeSlugDesconocido,
  avisoDeTarjetaQueNoEmite,
} from "./problemas";

/**
 * Lo que estas pruebas cuidan no es el copy palabra por palabra: es que
 * NINGÚN camino se quede sin pantalla. El bug original era exactamente
 * ese —seis situaciones distintas cayendo en el mismo `notFound()`, y
 * cualquier fallo del pase saliendo como JSON— así que el contrato es
 * "para cada estado y para cada código hay algo escrito para una
 * persona".
 */

const ESTADOS = [...ESTADOS_VISIBLES, "sin_tarjeta"] as const;

describe("avisoDeTarjetaQueNoEmite — cada estado dice qué pasó", () => {
  it("cubre los seis estados visibles y el negocio sin tarjeta", () => {
    for (const estado of ESTADOS) {
      const aviso = avisoDeTarjetaQueNoEmite(estado, "Silence Barber");
      expect(aviso.titulo.length, estado).toBeGreaterThan(5);
      expect(aviso.texto.length, estado).toBeGreaterThan(30);
    }
  });

  it("no hay dos estados que se lean igual: era todo el problema", () => {
    const titulos = ESTADOS.map((e) => avisoDeTarjetaQueNoEmite(e, "X").titulo);
    // 'activo' no debería llegar acá (una tarjeta activa sí emite), pero
    // si llega cae en el genérico y no rompe nada.
    const distintos = new Set(titulos.filter((t) => !t.includes("todavía no tiene tarjeta")));
    expect(distintos.size).toBeGreaterThanOrEqual(5);
  });

  it("nombra al negocio, para que se sepa que el QR era el correcto", () => {
    expect(avisoDeTarjetaQueNoEmite("pausado", "Soda La Esquina").texto).toContain(
      "Soda La Esquina",
    );
  });

  it("una tarjeta pausada no asusta: los sellos siguen ahí", () => {
    const aviso = avisoDeTarjetaQueNoEmite("pausado", "Silence Barber");
    expect(aviso.texto).toContain("sellos");
    expect(aviso.tono).toBe("espera");
  });

  it("sin nombre de negocio el texto igual se lee", () => {
    expect(avisoDeTarjetaQueNoEmite("vencido", "  ").titulo.length).toBeGreaterThan(5);
    expect(avisoDeTarjetaQueNoEmite("vencido", "  ").texto).toContain("Este negocio");
  });
});

describe("avisoDeSlugDesconocido — el QR mal impreso se distingue", () => {
  it("le dice qué hacer: avisarle a quien atiende", () => {
    const aviso = avisoDeSlugDesconocido();
    expect(aviso.tono).toBe("qr");
    expect(aviso.texto).toContain("póster");
  });
});

describe("avisoDeFalloDelPase — ningún código sale como JSON", () => {
  it("los nueve códigos tienen pantalla", () => {
    for (const codigo of CODIGOS_FALLO_PASE) {
      const aviso = avisoDeFalloDelPase(codigo, "Silence Barber");
      expect(aviso.titulo.length, codigo).toBeGreaterThan(5);
      expect(aviso.texto.length, codigo).toBeGreaterThan(30);
      // Nada de jerga: ni identificadores internos ni códigos HTTP.
      const pantalla = `${aviso.titulo} ${aviso.texto}`;
      expect(pantalla, codigo).not.toMatch(/[a-z]+_[a-z]+/);
      expect(pantalla, codigo).not.toMatch(/error 4\d\d|\bnull\b|undefined|409|500/i);
    }
  });

  it("el cliente 201 no cree que hizo algo mal", () => {
    const aviso = avisoDeFalloDelPase("lleno", "Silence Barber");
    expect(aviso.texto).toContain("Silence Barber");
    expect(aviso.texto).toContain("No es algo que hayas hecho vos");
  });

  it("cuando la culpa es de Bookea, lo dice", () => {
    expect(avisoDeFalloDelPase("sin_credenciales", "X").tono).toBe("nuestro");
    expect(avisoDeFalloDelPase("sin_credenciales", "X").texto).toContain("Bookea");
    expect(avisoDeFalloDelPase("sin_conexion", "X").tono).toBe("nuestro");
    expect(avisoDeFalloDelPase("error", "X").tono).toBe("nuestro");
  });

  it("«no sé quién sos» manda al formulario, no a un login", () => {
    const aviso = avisoDeFalloDelPase("sin_identidad", "X");
    // Los tres datos del mínimo, nombrados: es el mismo aviso que ve
    // quien tiene el alta a medias (sin nombre, sin vínculo o sin
    // consentimiento), y el formulario de abajo resuelve los tres.
    expect(aviso.texto).toContain("nombre");
    expect(aviso.texto).toContain("WhatsApp");
    expect(aviso.texto).toContain("correo");
    // Y no lo manda a iniciar sesión, que es lo que hacía esta pantalla
    // antes de la 0138.
    expect(aviso.texto).not.toContain("código");
  });

  it("los dos que reusan otra pantalla no se pierden por el camino", () => {
    // `sin_programa` es la misma pantalla que "este negocio no armó su
    // tarjeta": nombra al negocio en el título.
    expect(avisoDeFalloDelPase("sin_programa", "Soda").titulo).toContain("Soda");
    expect(avisoDeFalloDelPase("negocio_desconocido", "Soda").tono).toBe("qr");
  });
});
