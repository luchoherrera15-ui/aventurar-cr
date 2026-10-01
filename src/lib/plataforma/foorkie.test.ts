import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canalDelMovimiento, ETIQUETA_CANAL } from "@/lib/lealtad/canal-del-sello";
import { firmaValida } from "./foorkie";

const SECRETO = "secreto-de-prueba";
const firmar = (cuerpo: string, t: number, secreto = SECRETO) =>
  `t=${t},v1=${createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex")}`;

describe("la puerta de Foorkie — firma", () => {
  const cuerpo = JSON.stringify({ pedido_id: "x", monto: 5000 });
  const ahora = 1_800_000_000_000;

  it("acepta una firma de Foorkie reciente", () => {
    expect(firmaValida(cuerpo, firmar(cuerpo, ahora), SECRETO, ahora)).toBe(true);
    expect(firmaValida(cuerpo, firmar(cuerpo, ahora - 60_000), SECRETO, ahora)).toBe(true);
  });

  it("rechaza un cuerpo tocado, otro secreto, una firma vieja o sin cabecera", () => {
    expect(firmaValida(cuerpo.replace("5000", "50000"), firmar(cuerpo, ahora), SECRETO, ahora)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo, ahora, "otro"), SECRETO, ahora)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo, ahora - 6 * 60_000), SECRETO, ahora)).toBe(false);
    expect(firmaValida(cuerpo, null, SECRETO, ahora)).toBe(false);
    expect(firmaValida(cuerpo, "t=1,v1=zz", SECRETO, ahora)).toBe(false);
  });

  it("lo que suma un pedido de Foorkie se lee «Foorkie» en las estadísticas", () => {
    const canal = canalDelMovimiento({ referencia: "foorkie:3446968d-7e1c-4e4a-aae1-89dd7fa1d6cd", usuarioId: "dueno" });
    expect(canal).toBe("foorkie");
    expect(ETIQUETA_CANAL[canal]).toBe("Foorkie");
  });
});
