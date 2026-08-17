import { describe, expect, it } from "vitest";
import { PAIS_POR_DEFECTO } from "./paises";
import {
  COOKIE_PAIS,
  EDAD_COOKIE_PAIS,
  cookieDePais,
  paisDetectado,
  paisElegido,
  paisInicialDelBuscador,
} from "./pais-preferido";

/**
 * LO QUE ESTAS PRUEBAS PROTEGEN.
 *
 * La detección por IP falla en silencio: si `paisDetectado` dejara de
 * reconocer "PA", el buscador simplemente abriría en Costa Rica —igual
 * que antes— y nadie se enteraría hasta que un panameño se quejara. No
 * hay pantalla roja que avise. De ahí que las tres reglas (mayúsculas,
 * país ajeno, cabecera ausente) estén fijadas una por una.
 */

describe("la cabecera de Vercel", () => {
  it("reconoce el ISO en mayúscula, que es como viene", () => {
    // `x-vercel-ip-country` manda "PA", nunca "pa". El catálogo, al
    // revés, solo acepta minúscula (es lo que va a la URL).
    expect(paisDetectado("PA")).toBe("pa");
    expect(paisDetectado("GT")).toBe("gt");
  });

  it("tolera espacios y minúsculas", () => {
    expect(paisDetectado(" cr ")).toBe("cr");
  });

  it("devuelve null en un país que Bookea todavía no atiende", () => {
    // Estados Unidos es el caso más frecuente de todos: es de donde
    // rastrea Google y por donde sale mucho tráfico centroamericano.
    expect(paisDetectado("US")).toBeNull();
    expect(paisDetectado("ES")).toBeNull();
  });

  it("devuelve null con el centinela de Vercel y con la cabecera ausente", () => {
    // "XX" es lo que manda Vercel cuando no puede ubicar la IP (Tor,
    // algunas VPN); `null`/`undefined` es el caso de `next dev`.
    expect(paisDetectado("XX")).toBeNull();
    expect(paisDetectado(null)).toBeNull();
    expect(paisDetectado(undefined)).toBeNull();
    expect(paisDetectado("")).toBeNull();
  });
});

describe("la precedencia del país inicial", () => {
  it("sin cookie y sin cabecera, abre en Costa Rica", () => {
    // El caso de `next dev` y el de cualquier hosting que no sea
    // Vercel. Nunca puede quedar el `<select>` en blanco.
    expect(paisInicialDelBuscador({})).toBe(PAIS_POR_DEFECTO);
    expect(paisInicialDelBuscador({ elegido: null, detectado: null })).toBe("cr");
  });

  it("sin cookie, manda la IP", () => {
    expect(paisInicialDelBuscador({ detectado: "PA" })).toBe("pa");
  });

  it("una IP de un país ajeno cae en Costa Rica, el mercado principal", () => {
    expect(paisInicialDelBuscador({ detectado: "US" })).toBe("cr");
  });

  it("LA ELECCIÓN A MANO LE GANA A LA IP", () => {
    // La regla que sostiene todo lo demás: la detección se equivoca
    // seguido acá (tráfico ruteado por Miami, VPN), así que quien ya
    // corrigió el país una vez no lo vuelve a corregir nunca.
    expect(paisInicialDelBuscador({ elegido: "gt", detectado: "CR" })).toBe("gt");
    // Y también gana cuando la persona eligió justo Costa Rica estando
    // en Panamá: es una elección tan válida como cualquier otra.
    expect(paisInicialDelBuscador({ elegido: "cr", detectado: "PA" })).toBe("cr");
  });

  it("una cookie corrupta o de un país retirado se ignora y se vuelve a detectar", () => {
    expect(paisInicialDelBuscador({ elegido: "zz", detectado: "PA" })).toBe("pa");
    expect(paisInicialDelBuscador({ elegido: "🇨🇷", detectado: "PA" })).toBe("pa");
  });

  it("la cookie tampoco acepta mayúscula: el código canónico es minúscula", () => {
    // Es la misma severidad de `esPais`. Se normaliza antes de guardar
    // (`cookieDePais`), así que una cookie en mayúscula solo puede
    // venir de afuera.
    expect(paisElegido("PA")).toBe("pa");
  });
});

describe("la cookie que recuerda la elección", () => {
  it("lleva el nombre, el país, la ruta del sitio entero y un año de vida", () => {
    const linea = cookieDePais("pa", true);
    expect(linea).toContain(`${COOKIE_PAIS}=pa`);
    expect(linea).toContain("path=/");
    expect(linea).toContain(`max-age=${EDAD_COOKIE_PAIS}`);
    expect(linea).toContain("samesite=lax");
  });

  it("solo pone `secure` en https", () => {
    // Sobre `http://192.168.x.x:3000` —cómo se prueba el sitio desde un
    // teléfono real— el navegador descarta una cookie `Secure` sin
    // avisar, y la preferencia nunca se guardaría.
    expect(cookieDePais("pa", true)).toContain("secure");
    expect(cookieDePais("pa", false)).not.toContain("secure");
  });

  it("nunca escribe un país que después se vaya a descartar al leer", () => {
    expect(cookieDePais("basura", true)).toContain(`${COOKIE_PAIS}=cr`);
    expect(cookieDePais(null, true)).toContain(`${COOKIE_PAIS}=cr`);
  });

  it("lo que escribe se puede volver a leer", () => {
    // El viaje redondo: si `cookieDePais` y `paisElegido` se
    // desincronizan, la preferencia se guarda y no se respeta — el
    // fallo más silencioso posible.
    for (const pais of ["cr", "pa", "mx", "co", "ni", "gt", "sv", "hn"]) {
      const valor = cookieDePais(pais, true).split(";")[0].split("=")[1];
      expect(paisElegido(valor)).toBe(pais);
    }
  });
});
