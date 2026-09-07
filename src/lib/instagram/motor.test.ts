import { describe, expect, it } from "vitest";
import { LIMITE_ENVIOS_HORA, MAX_INTENTOS, procesarComentario, type AutomatizacionMotor, type CuentaMotor, type DepsMotor, type RegistroEvento } from "./motor";
import type { ComentarioWebhook } from "./webhook";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.UTC(2026, 8, 7, 15, 0, 0);

const CUENTA: CuentaMotor = {
  id: "cta-1",
  negocioId: "neg-1",
  igUserId: "17841400000000001",
  activa: true,
  estado: "conectada",
  tokenVenceEn: new Date(AHORA + 30 * DIA).toISOString(),
  token: "TOKEN",
};

const AUTO: AutomatizacionMotor = {
  id: "auto-1",
  activa: true,
  mediaId: "media-1",
  disparador: "palabra",
  modo: "palabra",
  palabras: ["precio", "costo"],
  mensajePrivado: "¡Hola! 👋 Acá tenés los precios:",
  enlace: "https://linksy.lat/cafe-aroma",
  respuestaPublica: false,
  mensajePublico: null,
};

const COMENTARIO: ComentarioWebhook = {
  cuentaIgId: CUENTA.igUserId,
  comentarioId: "com-1",
  texto: "¿Cuál es el PRECIO?",
  deId: "cliente-9",
  deUsername: "ana",
  mediaId: "media-1",
  mediaTipo: "FEED",
  parentId: null,
  tiempo: 1725700000,
};

/** Dependencias fingidas que graban todo lo que el motor les pide. */
function fingidas(overrides: Partial<DepsMotor> = {}) {
  const registros: RegistroEvento[] = [];
  const marcas: { eventoId: string; cambios: unknown }[] = [];
  const cuentas: { cuentaId: string; estado: string; nota: string }[] = [];
  const dms: { comentarioId: string; texto: string }[] = [];
  const publicas: { comentarioId: string; texto: string }[] = [];
  let n = 0;
  const deps: DepsMotor = {
    buscarCuenta: async () => CUENTA,
    automatizaciones: async () => [AUTO],
    registrar: async (r) => {
      registros.push(r);
      return { estado: "nuevo", eventoId: `ev-${++n}`, intentos: 1 };
    },
    enviosUltimaHora: async () => 0,
    enviarPrivada: async (_c, comentarioId, texto) => {
      dms.push({ comentarioId, texto });
      return { ok: true, mensajeId: "m-1" };
    },
    responderPublico: async (_c, comentarioId, texto) => {
      publicas.push({ comentarioId, texto });
      return { ok: true, id: "r-1" };
    },
    marcar: async (eventoId, cambios) => {
      marcas.push({ eventoId, cambios });
    },
    marcarCuenta: async (cuentaId, estado, nota) => {
      cuentas.push({ cuentaId, estado, nota });
    },
    ahora: () => AHORA,
    ...overrides,
  };
  return { deps, registros, marcas, cuentas, dms, publicas };
}

describe("procesarComentario — el camino feliz", () => {
  it("13. coincide → un DM con mensaje y enlace, y el evento queda como enviado", async () => {
    const f = fingidas();
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r.accion).toBe("enviado");
    expect(f.dms).toEqual([{ comentarioId: "com-1", texto: "¡Hola! 👋 Acá tenés los precios:\n\nhttps://linksy.lat/cafe-aroma" }]);
    expect(f.registros.at(-1)).toMatchObject({ automatizacionId: "auto-1", palabra: "precio", resultado: "pendiente" });
    expect(f.marcas[0].cambios).toMatchObject({ resultado: "enviado", dm_enviado: true, dm_mensaje_id: "m-1" });
    expect(f.publicas).toEqual([]);
  });

  it("14. con respuesta pública activada, además responde en el post", async () => {
    const f = fingidas({ automatizaciones: async () => [{ ...AUTO, respuestaPublica: true, mensajePublico: "¡Te escribimos por DM! 👋" }] });
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r.accion).toBe("enviado");
    expect(f.publicas).toEqual([{ comentarioId: "com-1", texto: "¡Te escribimos por DM! 👋" }]);
    expect(f.marcas[0].cambios).toMatchObject({ dm_enviado: true, publica_enviada: true, publica_comentario_id: "r-1" });
  });

  it("si la pública falla, el DM ya salió: sigue siendo enviado, con el error anotado", async () => {
    const f = fingidas({
      automatizaciones: async () => [{ ...AUTO, respuestaPublica: true, mensajePublico: "x" }],
      responderPublico: async () => ({ ok: false, error: { codigo: "no_procesable", mensaje: "no", transitorio: false } }),
    });
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r.accion).toBe("enviado");
    const cambios = f.marcas[0].cambios as Record<string, unknown>;
    expect(cambios).toMatchObject({ resultado: "enviado", dm_enviado: true, error_codigo: "no_procesable" });
    expect(cambios.publica_enviada).toBeUndefined();
  });

  it("«cualquier comentario» dispara sin palabras", async () => {
    const f = fingidas({ automatizaciones: async () => [{ ...AUTO, disparador: "cualquier_comentario", palabras: [] }] });
    expect((await procesarComentario({ ...COMENTARIO, texto: "😍😍" }, f.deps)).accion).toBe("enviado");
  });
});

describe("procesarComentario — lo que NO debe mandar nada", () => {
  it("17. una cuenta de Instagram que no es nuestra: ignorado", async () => {
    const f = fingidas({ buscarCuenta: async () => null });
    expect(await procesarComentario(COMENTARIO, f.deps)).toEqual({ accion: "ignorado", motivo: "cuenta_desconocida" });
    expect(f.dms).toEqual([]);
    expect(f.registros).toEqual([]);
  });

  it("una cuenta desconectada o inactiva: ignorado", async () => {
    const f = fingidas({ buscarCuenta: async () => ({ ...CUENTA, estado: "desconectada" }) });
    expect((await procesarComentario(COMENTARIO, f.deps)).accion).toBe("ignorado");
    const g = fingidas({ buscarCuenta: async () => ({ ...CUENTA, activa: false }) });
    expect((await procesarComentario(COMENTARIO, g.deps)).accion).toBe("ignorado");
  });

  it("el comentario del propio negocio en su post: ignorado", async () => {
    const f = fingidas();
    expect((await procesarComentario({ ...COMENTARIO, deId: CUENTA.igUserId }, f.deps)).motivo).toBe("comentario_propio");
    expect(f.dms).toEqual([]);
  });

  it("16. un medio que no tiene automatización: sin coincidencia, anotado sin automatización", async () => {
    const f = fingidas();
    const r = await procesarComentario({ ...COMENTARIO, mediaId: "otro-post" }, f.deps);
    expect(r.accion).toBe("sin_coincidencia");
    expect(f.registros).toEqual([expect.objectContaining({ automatizacionId: null, resultado: "sin_coincidencia" })]);
    expect(f.dms).toEqual([]);
  });

  it("15. una automatización desactivada no responde", async () => {
    const f = fingidas({ automatizaciones: async () => [{ ...AUTO, activa: false }] });
    expect((await procesarComentario(COMENTARIO, f.deps)).accion).toBe("sin_coincidencia");
    expect(f.dms).toEqual([]);
  });

  it("5–7. sin palabra clave no hay DM (y la comparación es sin mayúsculas ni acentos)", async () => {
    const f = fingidas();
    expect((await procesarComentario({ ...COMENTARIO, texto: "qué precioso lugar" }, f.deps)).accion).toBe("sin_coincidencia");
    const g = fingidas({ automatizaciones: async () => [{ ...AUTO, palabras: ["MENÚ"] }] });
    expect((await procesarComentario({ ...COMENTARIO, texto: "me pasan el menu?" }, g.deps)).accion).toBe("enviado");
  });

  it("8–9. el mismo comentario dos veces (webhook reenviado): la segunda es duplicado y no manda", async () => {
    let veces = 0;
    const f = fingidas({
      registrar: async () => {
        veces += 1;
        return veces === 1 ? { estado: "nuevo", eventoId: "ev-1", intentos: 1 } : { estado: "duplicado", eventoId: "ev-1", intentos: 1 };
      },
    });
    expect((await procesarComentario(COMENTARIO, f.deps)).accion).toBe("enviado");
    expect((await procesarComentario(COMENTARIO, f.deps)).accion).toBe("duplicado");
    expect(f.dms).toHaveLength(1);
  });

  it("dos automatizaciones del mismo medio: responde la primera, la otra queda omitida", async () => {
    const f = fingidas({ automatizaciones: async () => [AUTO, { ...AUTO, id: "auto-2", palabras: ["precio"] }] });
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r.automatizacionId).toBe("auto-1");
    expect(f.dms).toHaveLength(1);
    expect(f.registros.find((x) => x.automatizacionId === "auto-2")?.resultado).toBe("omitido");
  });
});

describe("procesarComentario — tokens, errores y límites", () => {
  it("11. token vencido: error, la cuenta pasa a «reconectar» y no se llama a Meta", async () => {
    const f = fingidas({ buscarCuenta: async () => ({ ...CUENTA, tokenVenceEn: new Date(AHORA - 1).toISOString() }) });
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r).toMatchObject({ accion: "error", motivo: "token_vencido", transitorio: false });
    expect(f.dms).toEqual([]);
    expect(f.cuentas).toEqual([{ cuentaId: "cta-1", estado: "reconectar", nota: expect.any(String) }]);
    expect(f.marcas[0].cambios).toMatchObject({ resultado: "error", error_codigo: "token_vencido" });
  });

  it("un token que no se pudo descifrar cuenta como vencido", async () => {
    const f = fingidas({ buscarCuenta: async () => ({ ...CUENTA, token: null }) });
    expect((await procesarComentario(COMENTARIO, f.deps)).motivo).toBe("token_vencido");
  });

  it("12. Meta responde 190 al mandar: error permanente y cuenta a reconectar", async () => {
    const f = fingidas({ enviarPrivada: async () => ({ ok: false, error: { codigo: "token_vencido", mensaje: "expired", transitorio: false } }) });
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r).toMatchObject({ accion: "error", transitorio: false });
    expect(f.cuentas[0].estado).toBe("reconectar");
  });

  it("12. Meta limita (rate limit): error transitorio, para que el webhook pida reenvío", async () => {
    const f = fingidas({ enviarPrivada: async () => ({ ok: false, error: { codigo: "rate_limit", mensaje: "too many", transitorio: true } }) });
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r).toMatchObject({ accion: "error", motivo: "rate_limit", transitorio: true });
    expect(f.cuentas).toEqual([]);
  });

  it("un reintento de Meta vuelve a intentar hasta MAX_INTENTOS, y después se rinde", async () => {
    const f = fingidas({ registrar: async () => ({ estado: "reintento", eventoId: "ev-1", intentos: 2 }) });
    expect((await procesarComentario(COMENTARIO, f.deps)).accion).toBe("enviado");
    const g = fingidas({ registrar: async () => ({ estado: "reintento", eventoId: "ev-1", intentos: MAX_INTENTOS + 1 }) });
    expect((await procesarComentario(COMENTARIO, g.deps)).accion).toBe("duplicado");
    expect(g.dms).toEqual([]);
  });

  it("el freno local: al llegar al límite por hora no se manda y queda anotado", async () => {
    const f = fingidas({ enviosUltimaHora: async () => LIMITE_ENVIOS_HORA });
    const r = await procesarComentario(COMENTARIO, f.deps);
    expect(r.accion).toBe("limite");
    expect(f.dms).toEqual([]);
    expect(f.marcas[0].cambios).toMatchObject({ resultado: "limite", error_codigo: "rate_limit" });
  });
});
