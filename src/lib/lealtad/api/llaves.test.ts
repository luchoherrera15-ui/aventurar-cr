import { describe, expect, it } from "vitest";
import {
  generarKid,
  generarLlave,
  generarSecreto,
  hashDeSecreto,
  hashesIguales,
  huellaDeIp,
  llaveDeCabecera,
  partirLlave,
  pepperDeLlaves,
} from "./llaves";

/**
 * Lo que se prueba acá es que una llave sea imposible de adivinar y que
 * lo guardado no sirva para entrar. Todo lo demás de la API descansa en
 * estas dos propiedades.
 */

const PEPPER = "un-pepper-de-prueba-de-mas-de-32-caracteres";

describe("generarKid", () => {
  it("tiene 12 caracteres del alfabeto que la base acepta", () => {
    for (let i = 0; i < 200; i++) {
      expect(generarKid()).toMatch(/^[a-z0-9]{12}$/);
    }
  });

  it("no repite", () => {
    const vistos = new Set(Array.from({ length: 500 }, () => generarKid()));
    expect(vistos.size).toBe(500);
  });

  it("no tiene sesgo groseramente visible en el primer carácter", () => {
    // `byte % 36` sin descartar la cola incompleta hace que las 4
    // primeras letras salgan ~14 % más seguido. Con 36 000 muestras,
    // cada carácter debería aparecer ~1000 veces; se acepta ±35 %, que
    // deja pasar el ruido y no el sesgo.
    const cuenta = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      for (const c of generarKid()) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
    expect(cuenta.size).toBe(36);
    for (const n of cuenta.values()) {
      expect(n).toBeGreaterThan(650);
      expect(n).toBeLessThan(1350);
    }
  });
});

describe("generarSecreto", () => {
  it("son 32 bytes en base64url (43 caracteres)", () => {
    const s = generarSecreto();
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(s, "base64url")).toHaveLength(32);
  });

  it("no repite ni se parece entre corridas", () => {
    const vistos = new Set(Array.from({ length: 500 }, () => generarSecreto()));
    expect(vistos.size).toBe(500);
  });
});

describe("generarLlave", () => {
  it("arma el formato completo y expone solo los últimos 4", () => {
    const llave = generarLlave("live");
    expect(llave.completa).toBe(`blk_live_${llave.kid}.${llave.secreto}`);
    expect(llave.sufijoVisible).toBe(llave.secreto.slice(-4));
    expect(llave.sufijoVisible).toHaveLength(4);
  });

  it("distingue el sandbox de producción en el propio texto", () => {
    expect(generarLlave("test").completa.startsWith("blk_test_")).toBe(true);
    expect(generarLlave("live").completa.startsWith("blk_live_")).toBe(true);
  });

  it("una llave recién generada se puede volver a partir", () => {
    const llave = generarLlave("live");
    expect(partirLlave(llave.completa)).toEqual({
      entorno: "live",
      kid: llave.kid,
      secreto: llave.secreto,
    });
  });
});

describe("partirLlave — todo lo de afuera es hostil", () => {
  const buena = generarLlave("live");

  it("acepta la buena, con espacios alrededor", () => {
    expect(partirLlave(`  ${buena.completa}  `)?.kid).toBe(buena.kid);
  });

  it.each([
    ["vacío", ""],
    ["nulo", null],
    ["indefinido", undefined],
    ["sin prefijo", `${buena.kid}.${buena.secreto}`],
    ["prefijo inventado", `blk_prod_${buena.kid}.${buena.secreto}`],
    ["sin punto", `blk_live_${buena.kid}${buena.secreto}`],
    ["kid corto", `blk_live_abc.${buena.secreto}`],
    ["kid con mayúsculas", `blk_live_ABCDEFGHIJKL.${buena.secreto}`],
    ["secreto corto", "blk_live_abcdefghijkl.abc"],
    ["secreto con caracteres raros", `blk_live_${buena.kid}.aaaa$$$$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`],
    ["kilométrica", `blk_live_${buena.kid}.${"a".repeat(500)}`],
  ])("rechaza: %s", (_caso, valor) => {
    expect(partirLlave(valor as string | null | undefined)).toBeNull();
  });

  it("un objeto o un número no es una llave", () => {
    expect(partirLlave(1234 as unknown as string)).toBeNull();
    expect(partirLlave({} as unknown as string)).toBeNull();
  });
});

describe("llaveDeCabecera", () => {
  const llave = generarLlave("live");
  const con = (valor: string | null) => ({
    headers: { get: (n: string) => (n.toLowerCase() === "authorization" ? valor : null) },
  });

  it("lee el esquema Bearer, sin importar mayúsculas", () => {
    expect(llaveDeCabecera(con(`Bearer ${llave.completa}`))?.kid).toBe(llave.kid);
    expect(llaveDeCabecera(con(`bearer ${llave.completa}`))?.kid).toBe(llave.kid);
  });

  it("no acepta otro esquema ni la llave pelada", () => {
    expect(llaveDeCabecera(con(llave.completa))).toBeNull();
    expect(llaveDeCabecera(con(`Basic ${llave.completa}`))).toBeNull();
    expect(llaveDeCabecera(con(`ApplePass ${llave.completa}`))).toBeNull();
    expect(llaveDeCabecera(con(null))).toBeNull();
  });
});

describe("hashDeSecreto — lo que SÍ se guarda", () => {
  it("da 64 hex, el formato que el `check` de la base exige", () => {
    expect(hashDeSecreto(generarSecreto(), PEPPER)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinístico: el mismo secreto da el mismo hash", () => {
    const s = generarSecreto();
    expect(hashDeSecreto(s, PEPPER)).toBe(hashDeSecreto(s, PEPPER));
  });

  it("NO contiene el secreto", () => {
    const s = generarSecreto();
    expect(hashDeSecreto(s, PEPPER)).not.toContain(s);
    expect(hashDeSecreto(s, PEPPER)).not.toContain(s.slice(0, 8));
  });

  it("con otro pepper da otro hash — un volcado de la tabla no sirve", () => {
    const s = generarSecreto();
    expect(hashDeSecreto(s, PEPPER)).not.toBe(hashDeSecreto(s, PEPPER + "x"));
  });

  it("dos secretos distintos no colisionan", () => {
    const hashes = new Set(Array.from({ length: 300 }, () => hashDeSecreto(generarSecreto(), PEPPER)));
    expect(hashes.size).toBe(300);
  });
});

describe("hashesIguales", () => {
  it("compara bien, iguales y distintos", () => {
    const a = hashDeSecreto("uno", PEPPER);
    expect(hashesIguales(a, a)).toBe(true);
    expect(hashesIguales(a, hashDeSecreto("dos", PEPPER))).toBe(false);
  });

  it("tolera largos distintos sin reventar", () => {
    // `timingSafeEqual` tira si los buffers no miden lo mismo: el
    // camino de largo distinto tiene que devolver false, no una
    // excepción que se convertiría en un 500.
    expect(hashesIguales("abc", "abcdef")).toBe(false);
    expect(hashesIguales("", "x")).toBe(false);
  });
});

describe("pepperDeLlaves — falla CERRADO", () => {
  it("sin variable configurada, no hay pepper", () => {
    const antes = process.env.LEALTAD_API_PEPPER;
    delete process.env.LEALTAD_API_PEPPER;
    expect(pepperDeLlaves()).toBeNull();
    if (antes !== undefined) process.env.LEALTAD_API_PEPPER = antes;
  });

  it("un pepper cortito tampoco cuenta", () => {
    const antes = process.env.LEALTAD_API_PEPPER;
    process.env.LEALTAD_API_PEPPER = "corto";
    expect(pepperDeLlaves()).toBeNull();
    if (antes === undefined) delete process.env.LEALTAD_API_PEPPER;
    else process.env.LEALTAD_API_PEPPER = antes;
  });

  it("con uno de largo suficiente, lo devuelve sin espacios", () => {
    const antes = process.env.LEALTAD_API_PEPPER;
    process.env.LEALTAD_API_PEPPER = `  ${PEPPER}  `;
    expect(pepperDeLlaves()).toBe(PEPPER);
    if (antes === undefined) delete process.env.LEALTAD_API_PEPPER;
    else process.env.LEALTAD_API_PEPPER = antes;
  });
});

describe("huellaDeIp — la IP no se guarda en claro", () => {
  it("es un hash de 64 hex que no contiene la IP", () => {
    const huella = huellaDeIp("190.10.1.1", PEPPER);
    expect(huella).toMatch(/^[0-9a-f]{64}$/);
    expect(huella).not.toContain("190");
  });

  it("la misma IP da la misma huella (por eso se puede contar)", () => {
    expect(huellaDeIp("190.10.1.1", PEPPER)).toBe(huellaDeIp("190.10.1.1", PEPPER));
  });

  it("IPs distintas dan huellas distintas", () => {
    expect(huellaDeIp("190.10.1.1", PEPPER)).not.toBe(huellaDeIp("190.10.1.2", PEPPER));
  });

  it("sin IP, no hay huella que inventar", () => {
    expect(huellaDeIp(null, PEPPER)).toBeNull();
    expect(huellaDeIp("   ", PEPPER)).toBeNull();
  });
});
