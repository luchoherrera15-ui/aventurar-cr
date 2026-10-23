import { describe, expect, it } from "vitest";
import { ACTIVADORES, CANALES } from "./catalogo";
import { MOTIVOS, textoDeMotivo } from "./motivos";
import { PLANTILLAS } from "./preconfigurados";
import { motivoDePlantilla } from "./servicio";
import { normalizarEntrada, validarImpulso } from "./validacion";
import { activadorEnVoz, canalEnVoz, definicionDeActivadorEnVoz, definicionDeCanalEnVoz, MOTIVOS_FOORKIE, TEXTOS, textosDe } from "./voz-foorkie";

/**
 * La voz de Foorkie: a un restaurante de Foorkie NUNCA se le muestra «Bookea», y el panel de Bookea no cambia.
 *
 * Dos garantías, las dos con barrido (no con unos ejemplos): con la voz por defecto todo es idéntico a antes, y con
 * la de Foorkie ninguna frase que salga nombra a Bookea.
 */

const NOMBRA_A_BOOKEA = /bookea/i;
const MODOS = ["sellos", "puntos", "cashback"] as const;

describe("con la voz por defecto todo queda idéntico", () => {
  it("el activador y el canal son el MISMO objeto del catálogo", () => {
    for (const a of ACTIVADORES) {
      expect(activadorEnVoz(a)).toBe(a);
      expect(activadorEnVoz(a, "bookea")).toBe(a);
    }
    for (const c of CANALES) {
      expect(canalEnVoz(c)).toBe(c);
      expect(canalEnVoz(c, "bookea")).toBe(c);
    }
  });

  it("los motivos salen igual, y un código desconocido se muestra tal cual", () => {
    for (const [codigo, texto] of Object.entries(MOTIVOS)) {
      expect(textoDeMotivo(codigo)).toBe(texto);
      expect(textoDeMotivo(codigo, "bookea")).toBe(texto);
    }
    expect(textoDeMotivo("algo_nuevo")).toBe("algo_nuevo");
    expect(textoDeMotivo("algo_nuevo", "foorkie")).toBe("algo_nuevo");
    expect(textoDeMotivo(null, "foorkie")).toBe("");
  });

  it("la validación da el mismo resultado sin voz que con «bookea», en toda la batería", () => {
    for (const modo of MODOS) {
      for (const tieneRecompensa of [true, false]) {
        for (const esFoorkie of [true, false]) {
          for (const a of ACTIVADORES) {
            for (const c of CANALES) {
              const entrada = normalizarEntrada({
                nombre: "Prueba",
                activador: a.id,
                canal: c.id,
                titulo: "Hola {{nombre_cliente}}",
                cuerpo: "Te falta {{puntos_faltantes}} para {{nombre_recompensa}}",
              });
              const ctx = { modo, esFoorkie, tieneRecompensa, hoy: "2026-10-21" };
              expect(validarImpulso(entrada, { ...ctx, voz: "bookea" })).toEqual(validarImpulso(entrada, ctx));
            }
          }
        }
      }
    }
  });

  it("el panel de Bookea sigue diciendo lo que decía", () => {
    expect(TEXTOS.bookea.sinRecompensa).toBe("Esta tarjeta todavía no tiene una recompensa activa. Creala primero en Recompensas.");
    expect(TEXTOS.bookea.correoDeFoorkie).toBe("Las tarjetas de Foorkie no envían correos desde acá: los manda Foorkie. Usá el Wallet.");
    expect(definicionDeActivadorEnVoz("pase_apple")?.nota).toMatch(/avisa a Bookea/);
    expect(definicionDeCanalEnVoz("push_web")?.falta).toMatch(/^Bookea no tiene/);
  });
});

describe("los textos de Foorkie (los del contrato)", () => {
  it("activadores", () => {
    expect(definicionDeActivadorEnVoz("pase_apple", "foorkie")?.nota).toBe(
      "Confirmado: el iPhone avisa cuando se guarda el pase. Se dispara una sola vez por cliente.",
    );
    expect(definicionDeActivadorEnVoz("cumpleanos", "foorkie")?.noDisponible).toBe(
      "El saludo de cumpleaños se arma en Clientes → Campaña de cumpleaños de Foorkie Lealtad (por correo, con su regalo).",
    );
    expect(definicionDeActivadorEnVoz("vencimiento_proximo", "foorkie")?.noDisponible).toBe(
      "Foorkie Lealtad ya avisa solo antes de que venzan los sellos o el saldo (Reglas de la tarjeta → Vencimiento). " +
        "Se deja ahí para no mandarle dos veces el mismo mensaje.",
    );
    expect(definicionDeActivadorEnVoz("nivel_alcanzado", "foorkie")?.noDisponible).toBe(
      "Las tarjetas de Foorkie Lealtad no tienen niveles de cliente, así que no hay un nivel que alcanzar.",
    );
  });

  it("lo que no cambia queda como estaba", () => {
    for (const id of ["inscripcion", "pase_google", "primera_visita", "inactividad", "meta_proxima"]) {
      const original = ACTIVADORES.find((a) => a.id === id)!;
      expect(definicionDeActivadorEnVoz(id, "foorkie")).toEqual(original);
    }
    expect(definicionDeActivadorEnVoz("no_existe", "foorkie")).toBeNull();
    expect(definicionDeCanalEnVoz("no_existe", "foorkie")).toBeNull();
  });

  it("canales: el Wallet sigue disponible y solo cambia el renglón de Apple", () => {
    const original = CANALES.find((c) => c.id === "wallet")!;
    // Si alguien reordena los límites del catálogo, esta prueba avisa antes de que el reemplazo caiga en otra frase.
    expect(original.limites[2]).toMatch(/^Apple Wallet:/);
    const wallet = definicionDeCanalEnVoz("wallet", "foorkie")!;
    expect(wallet.disponible).toBe(true);
    expect(wallet.limites[2]).toBe("Apple Wallet: el mensaje individual se muestra en el reverso del pase, en una sola línea.");
    expect(wallet.limites.filter((_, i) => i !== 2)).toEqual(original.limites.filter((_, i) => i !== 2));
  });

  it("canales: el correo se muestra apagado con su porqué; SMS, WhatsApp y notificaciones web, sin nombrar a Bookea", () => {
    const correo = definicionDeCanalEnVoz("correo", "foorkie")!;
    expect(correo.disponible).toBe(false);
    expect(correo.falta).toBe(
      "Los correos de los impulsos todavía no salen desde Foorkie Lealtad. " +
        "Por ahora usá el Wallet; el saludo de cumpleaños por correo ya existe en Clientes.",
    );
    for (const id of ["sms", "whatsapp", "push_web"]) {
      const c = definicionDeCanalEnVoz(id, "foorkie")!;
      expect(c.disponible).toBe(false);
      expect(c.falta).toBeTruthy();
    }
    expect(definicionDeCanalEnVoz("sms", "foorkie")?.falta).toMatch(/^No hay un proveedor de SMS integrado/);
  });

  it("motivos", () => {
    expect(textoDeMotivo("sin_canal_individual", "foorkie")).toBe("Solo tiene Apple Wallet y no se pudo avisar a su iPhone.");
    expect(textoDeMotivo("correo_lo_manda_foorkie", "foorkie")).toBe("Los correos de los impulsos todavía no salen desde Foorkie Lealtad.");
    // Lo demás se lee igual en las dos voces.
    expect(textoDeMotivo("sin_pase", "foorkie")).toBe(MOTIVOS.sin_pase);
  });

  it("«Premios» en lugar de «Recompensas»", () => {
    expect(textosDe("foorkie").sinRecompensa).toBe("Esta tarjeta todavía no tiene una recompensa activa. Creala primero en Premios.");
  });
});

describe("a Foorkie nunca se le nombra a Bookea", () => {
  it("ni en el catálogo", () => {
    for (const a of ACTIVADORES) {
      const def = activadorEnVoz(a, "foorkie");
      expect(JSON.stringify(def)).not.toMatch(NOMBRA_A_BOOKEA);
    }
    for (const c of CANALES) {
      expect(JSON.stringify(canalEnVoz(c, "foorkie"))).not.toMatch(NOMBRA_A_BOOKEA);
    }
  });

  it("ni en uno solo de los motivos", () => {
    for (const codigo of Object.keys(MOTIVOS)) expect(textoDeMotivo(codigo, "foorkie")).not.toMatch(NOMBRA_A_BOOKEA);
    for (const texto of Object.values(MOTIVOS_FOORKIE)) expect(texto).not.toMatch(NOMBRA_A_BOOKEA);
  });

  it("ni en el motivo de una plantilla que hoy no se puede usar", () => {
    const apagadas = PLANTILLAS.filter((p) => !p.disponible);
    expect(apagadas.length).toBeGreaterThan(0);
    for (const p of apagadas) {
      expect(motivoDePlantilla(p, "foorkie")).toBeTruthy();
      expect(motivoDePlantilla(p, "foorkie")).not.toMatch(NOMBRA_A_BOOKEA);
    }
    // La de Bookea sí lo nombra (si no, esta prueba no probaría nada).
    expect(PLANTILLAS.filter((p) => !p.disponible).some((p) => NOMBRA_A_BOOKEA.test(motivoDePlantilla(p, "bookea") ?? ""))).toBe(true);
  });

  it("ni en una frase de la validación: ningún problema ni aviso, para ningún activador, canal ni tipo de tarjeta", () => {
    const textos: string[] = [];
    for (const modo of MODOS) {
      for (const tieneRecompensa of [true, false]) {
        for (const a of ACTIVADORES) {
          for (const c of CANALES) {
            const entrada = normalizarEntrada({
              nombre: "x",
              activador: a.id,
              canal: c.id,
              titulo: "{{inventada}}",
              cuerpo: "{{nombre_recompensa}} {{sellos_faltantes}} {{puntos_faltantes}}",
              condiciones: [{ campo: "nivel", op: "gte", valor: 1 }],
            });
            const r = validarImpulso(entrada, { modo, esFoorkie: true, tieneRecompensa, hoy: "2026-10-21", voz: "foorkie" });
            textos.push(...r.problemas.map((p) => p.mensaje), ...r.avisos);
          }
        }
      }
    }
    expect(textos.length).toBeGreaterThan(50);
    for (const t of textos) expect(t).not.toMatch(NOMBRA_A_BOOKEA);
    // …y el barrido sí atrapa a la voz de Bookea.
    const entrada = normalizarEntrada({ nombre: "Nivel", activador: "nivel_alcanzado", canal: "wallet", titulo: "a", cuerpo: "abc" });
    const deBookea = validarImpulso(entrada, { modo: "sellos", esFoorkie: true, tieneRecompensa: true, hoy: "2026-10-21" });
    expect(deBookea.problemas.some((p) => NOMBRA_A_BOOKEA.test(p.mensaje))).toBe(true);
  });
});

describe("la validación en la voz de Foorkie", () => {
  const entrada = (extra: Record<string, unknown>) =>
    normalizarEntrada({
      nombre: "Mi impulso",
      activador: "inscripcion",
      canal: "wallet",
      titulo: "¡Hola!",
      cuerpo: "Gracias por unirte",
      ...extra,
    });
  const ctx = { modo: "sellos", esFoorkie: true, tieneRecompensa: true, hoy: "2026-10-21", voz: "foorkie" as const };

  it("un impulso bueno pasa igual que en Bookea", () => {
    const r = validarImpulso(entrada({}), ctx);
    expect(r).toMatchObject({ problemas: [], puedeGuardar: true, puedeActivar: true });
  });

  it("el correo no se puede elegir y dice por qué, en palabras de Foorkie", () => {
    const r = validarImpulso(entrada({ canal: "correo" }), ctx);
    expect(r.puedeGuardar).toBe(false);
    expect(r.problemas).toEqual([{ campo: "canal", bloquea: "guardar", mensaje: definicionDeCanalEnVoz("correo", "foorkie")!.falta }]);
  });

  it("un activador apagado explica su porqué en la voz de Foorkie", () => {
    const r = validarImpulso(entrada({ activador: "cumpleanos" }), ctx);
    expect(r.problemas[0]).toMatchObject({ campo: "activador", mensaje: expect.stringMatching(/Campaña de cumpleaños de Foorkie Lealtad/) });
  });

  it("sin recompensa: se pide crearla en Premios, y solo bloquea activar", () => {
    const r = validarImpulso(entrada({ activador: "recompensa_alcanzada" }), { ...ctx, tieneRecompensa: false });
    expect(r.puedeGuardar).toBe(true);
    expect(r.puedeActivar).toBe(false);
    expect(r.problemas).toContainEqual({ campo: "activador", bloquea: "activar", mensaje: expect.stringMatching(/Creala primero en Premios\.$/) });
  });
});
