import { describe, expect, it } from "vitest";
import { ipPermitida, miembroAlcanzable, tieneScope } from "./aislamiento";

/**
 * ESTE ES EL PRIMER TEST QUE SE ESCRIBIÓ DE TODA LA API, y a propósito.
 *
 * `acreditar_lealtad` (0125:300-410) no comprueba a qué negocio
 * pertenece el miembro: resuelve `miembros → programa_lealtad`, valida
 * estado, vigencia, compra mínima y topes, y NUNCA compara contra un
 * `rancho_id`. Su propio grant lo dice (0125:601-606): «el acceso al
 * negocio los comprueba el servidor ANTES de invocar».
 *
 * O sea que el aislamiento multi-negocio de esta API vive entero acá.
 * Si esta función se rompe, la llave de la barbería A le suma sellos —o
 * le lee el saldo— a los clientes de la barbería B.
 */

const BARBERIA_A = "rancho-aaaa";
const BARBERIA_B = "rancho-bbbb";
const CLUB_A = "programa-aaaa";
const CLUB_B = "programa-bbbb";
const GIFT_A = "programa-gift-a";

describe("miembroAlcanzable — la única barrera entre dos negocios", () => {
  it("deja pasar al miembro de la misma tarjeta y el mismo negocio", () => {
    expect(
      miembroAlcanzable(
        { ranchoId: BARBERIA_A, programaId: CLUB_A },
        { ranchoId: BARBERIA_A, programaId: CLUB_A },
      ),
    ).toBe(true);
  });

  it("RECHAZA a un miembro de otro negocio", () => {
    expect(
      miembroAlcanzable(
        { ranchoId: BARBERIA_A, programaId: CLUB_A },
        { ranchoId: BARBERIA_B, programaId: CLUB_B },
      ),
    ).toBe(false);
  });

  it("RECHAZA otra tarjeta DEL MISMO negocio", () => {
    // Desde la 0134 un negocio puede tener varias tarjetas. La llave
    // del club de cortes no tiene por qué tocar la gift card.
    expect(
      miembroAlcanzable(
        { ranchoId: BARBERIA_A, programaId: CLUB_A },
        { ranchoId: BARBERIA_A, programaId: GIFT_A },
      ),
    ).toBe(false);
  });

  it("RECHAZA el caso mixto: mismo programa, otro negocio", () => {
    // No debería poder pasar, pero si el programa cambiara de dueño la
    // segunda comparación es la que ataja el caso grave.
    expect(
      miembroAlcanzable(
        { ranchoId: BARBERIA_A, programaId: CLUB_A },
        { ranchoId: BARBERIA_B, programaId: CLUB_A },
      ),
    ).toBe(false);
  });

  it("ante cualquier vacío o nulo, dice que NO", () => {
    const alcance = { ranchoId: BARBERIA_A, programaId: CLUB_A };
    expect(miembroAlcanzable(null, { ranchoId: BARBERIA_A, programaId: CLUB_A })).toBe(false);
    expect(miembroAlcanzable(alcance, null)).toBe(false);
    expect(miembroAlcanzable(alcance, undefined)).toBe(false);
    expect(miembroAlcanzable({ ranchoId: "", programaId: CLUB_A }, { ...alcance })).toBe(false);
    expect(miembroAlcanzable({ ranchoId: BARBERIA_A, programaId: "" }, { ...alcance })).toBe(false);
    expect(miembroAlcanzable(alcance, { ranchoId: "", programaId: CLUB_A })).toBe(false);
    expect(miembroAlcanzable(alcance, { ranchoId: BARBERIA_A, programaId: "" })).toBe(false);
  });

  it("no se conforma con que uno de los dos coincida", () => {
    // Un `||` en lugar de un `&&` sería exactamente este bug, y no se
    // vería en ninguna prueba manual con un solo negocio.
    expect(
      miembroAlcanzable(
        { ranchoId: BARBERIA_A, programaId: CLUB_A },
        { ranchoId: BARBERIA_A, programaId: CLUB_B },
      ),
    ).toBe(false);
    expect(
      miembroAlcanzable(
        { ranchoId: BARBERIA_A, programaId: CLUB_A },
        { ranchoId: BARBERIA_B, programaId: CLUB_A },
      ),
    ).toBe(false);
  });
});

describe("tieneScope", () => {
  it("solo deja pasar el permiso que está en la lista", () => {
    expect(tieneScope(["saldo"], "saldo")).toBe(true);
    expect(tieneScope(["saldo"], "acreditar")).toBe(false);
  });

  it("sin scopes no hay nada permitido", () => {
    expect(tieneScope([], "saldo")).toBe(false);
    expect(tieneScope(null, "saldo")).toBe(false);
    expect(tieneScope(undefined, "saldo")).toBe(false);
  });

  it("no confunde un prefijo con el permiso", () => {
    expect(tieneScope(["acreditar"], "acredit")).toBe(false);
    expect(tieneScope(["saldo"], "")).toBe(false);
  });

  it("un scope que ya no existe no abre nada, aunque esté en la fila", () => {
    // `catalogo` fue real hasta que se borraron `/programa` y
    // `/recompensas`. Si una fila vieja lo trajera, no hay endpoint que
    // lo pida — y esta función tampoco lo convierte en otra cosa.
    expect(tieneScope(["catalogo"], "saldo")).toBe(false);
    expect(tieneScope(["catalogo"], "acreditar")).toBe(false);
  });

  it("los scopes que todavía no existen no se cuelan por acá", () => {
    // `canjear` y `revertir` no están en la lista blanca de la base; si
    // alguien los metiera a mano, esta función igual pide que estén en
    // la autorización.
    expect(tieneScope(["saldo", "acreditar"], "canjear")).toBe(false);
    expect(tieneScope(["saldo", "acreditar"], "revertir")).toBe(false);
  });
});

describe("ipPermitida", () => {
  it("sin lista declarada, no filtra", () => {
    expect(ipPermitida(null, "190.10.1.1")).toBe(true);
    expect(ipPermitida([], "190.10.1.1")).toBe(true);
    expect(ipPermitida(undefined, null)).toBe(true);
  });

  it("con lista declarada, solo pasa lo declarado", () => {
    expect(ipPermitida(["190.10.1.1", "190.10.1.2"], "190.10.1.2")).toBe(true);
    expect(ipPermitida(["190.10.1.1"], "190.10.1.9")).toBe(false);
  });

  it("con lista declarada y sin IP conocida, dice que NO", () => {
    // Fallar cerrado: si no sabemos de dónde viene, no entra.
    expect(ipPermitida(["190.10.1.1"], null)).toBe(false);
  });
});
