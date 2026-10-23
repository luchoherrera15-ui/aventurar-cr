import { describe, expect, it } from "vitest";
import { crearCanales, type DependenciasDeCanales } from "./canales";
import { escaparHtml, htmlCorreoImpulso } from "./correo-html";
import type { EntradaDeEnvio } from "./motor";
import type { ContextoCliente, Impulso, InfoPrograma, Tarea } from "./tipos";

const INFO: InfoPrograma = {
  programaId: "prog-1",
  ranchoId: "rancho-1",
  nombrePrograma: "Tarjeta de sellos",
  nombreNegocio: "Café del Parque",
  modo: "sellos",
  zona: "America/Costa_Rica",
  opera: true,
  esFoorkie: false,
  meta: 5,
  recompensa: "Café gratis",
  cuentaId: "cuenta-1",
};

function entrada(extra: { info?: Partial<InfoPrograma>; ctx?: Partial<ContextoCliente>; titulo?: string; cuerpo?: string } = {}) {
  const orden: string[] = [];
  const e: EntradaDeEnvio = {
    tarea: { id: "tarea-1", miembro_id: "miembro-1" } as Tarea,
    impulso: { id: "imp-1" } as Impulso,
    info: { ...INFO, ...extra.info },
    ctx: {
      nombre: "María",
      nombreNegocio: "Café del Parque",
      nombrePrograma: "Tarjeta de sellos",
      modo: "sellos",
      saldo: 4,
      meta: 5,
      recompensa: "Café gratis",
      visitas: 4,
      canjes: 0,
      ultimaActividad: null,
      diasSinActividad: null,
      antiguedadDias: 10,
      plataformas: ["google"],
      ...extra.ctx,
    },
    titulo: extra.titulo ?? "¡Te falta 1!",
    cuerpo: extra.cuerpo ?? "Vas 4 de 5.",
    marcarInicio: async () => {
      orden.push("marcarInicio");
    },
  };
  return { e, orden };
}

function dependencias(orden: string[], sobre: Partial<DependenciasDeCanales> = {}): { dep: DependenciasDeCanales; llamadas: string[] } {
  const llamadas: string[] = [];
  const marca = (n: string) => {
    llamadas.push(n);
    orden.push(n);
  };
  const dep: DependenciasDeCanales = {
    escribirMensajeApple: async () => (marca("escribirMensajeApple"), true),
    avisarPase: async () => (marca("avisarPase"), { apple: { hay: true as const, dispositivos: 1, enviados: 1, caducados: 0 } }),
    avisarGoogle: async () => (marca("avisarGoogle"), { ok: true as const, tipo: "TEXT_AND_NOTIFY" as const }),
    hayProveedorDeCorreo: () => true,
    enviarCorreo: async () => (marca("enviarCorreo"), { enviado: true, id: "re_123" }),
    enlacesDeBaja: () => ({ pagina: "https://bookea.lat/baja?x=1", oneClick: "https://bookea.lat/api/correo/baja?x=1" }),
    correoDelMiembro: async () => "ana@correo.com",
    personaAceptaCorreo: async () => true,
    correoBloqueado: async () => false,
    ...sobre,
  };
  return { dep, llamadas };
}

describe("canal Wallet", () => {
  it("sin la tarjeta en el Wallet no hay a dónde mandar", async () => {
    const { e, orden } = entrada({ ctx: { plataformas: [] } });
    const { dep, llamadas } = dependencias(orden);
    const r = await crearCanales(dep).wallet(e);
    expect(r).toMatchObject({ tipo: "omitido", motivo: "sin_pase" });
    expect(llamadas).toEqual([]);
    expect(orden).not.toContain("marcarInicio");
  });

  it("solo Apple en una tarjeta propia de Bookea: no se puede avisar a un solo cliente y se dice", async () => {
    const { e, orden } = entrada({ ctx: { plataformas: ["apple"] } });
    const { dep, llamadas } = dependencias(orden);
    const r = await crearCanales(dep).wallet(e);
    expect(r).toMatchObject({ tipo: "omitido", motivo: "sin_canal_individual" });
    expect(llamadas).toEqual([]);
  });

  it("Apple en una tarjeta de Foorkie: guarda el mensaje, avisa y cuenta lo que APNs aceptó", async () => {
    const { e, orden } = entrada({ info: { esFoorkie: true }, ctx: { plataformas: ["apple"] } });
    const { dep, llamadas } = dependencias(orden);
    const r = await crearCanales(dep).wallet(e);
    expect(r).toMatchObject({ tipo: "enviado" });
    expect(llamadas).toEqual(["escribirMensajeApple", "avisarPase"]);
    expect(orden[0]).toBe("marcarInicio"); // el punto sin retorno va ANTES de hablar con el proveedor
  });

  it("el pase de Apple sin ningún teléfono registrado NO cuenta como enviado", async () => {
    const { e, orden } = entrada({ info: { esFoorkie: true }, ctx: { plataformas: ["apple"] } });
    const { dep } = dependencias(orden, {
      avisarPase: async () => ({ apple: { hay: true, dispositivos: 0, enviados: 0, caducados: 0 } }),
    });
    const r = await crearCanales(dep).wallet(e);
    expect(r).toMatchObject({ tipo: "omitido", motivo: "sin_pase" });
  });

  it("APNs que rechaza es un fallo, no un envío", async () => {
    const { e, orden } = entrada({ info: { esFoorkie: true }, ctx: { plataformas: ["apple"] } });
    const { dep } = dependencias(orden, {
      avisarPase: async () => ({ apple: { hay: true, dispositivos: 1, enviados: 0, caducados: 0, motivo: "APNs respondió 403" } }),
    });
    const r = await crearCanales(dep).wallet(e);
    expect(r).toMatchObject({ tipo: "fallo", motivo: "error_proveedor", permanente: false });
    expect((r as { detalle: string }).detalle).toContain("403");
  });

  it("Google: el mensaje lleva el título como encabezado y el texto como cuerpo", async () => {
    const { e, orden } = entrada({ ctx: { plataformas: ["google"] } });
    let recibido: unknown;
    const { dep, llamadas } = dependencias(orden, {
      avisarGoogle: async (_m, aviso) => ((recibido = aviso), { ok: true as const, tipo: "TEXT_AND_NOTIFY" as const }),
    });
    const r = await crearCanales(dep).wallet(e);
    expect(r.tipo).toBe("enviado");
    expect(recibido).toEqual({ evento: "impulso", texto: "Vas 4 de 5.", encabezado: "¡Te falta 1!" });
    expect(llamadas).not.toContain("avisarPase"); // no se toca Apple si no hay iPhone
  });

  it("Google pasado el tope diario entra igual, pero se cuenta como sin sonido", async () => {
    const { e, orden } = entrada();
    const { dep } = dependencias(orden, { avisarGoogle: async () => ({ ok: true as const, tipo: "TEXT" as const }) });
    const r = await crearCanales(dep).wallet(e);
    expect(r).toMatchObject({ tipo: "enviado" });
    expect((r as { detalle: string }).detalle).toMatch(/sin sonido/);
  });

  it("Google sin la tarjeta guardada no cuenta como enviado", async () => {
    const { e, orden } = entrada();
    const { dep } = dependencias(orden, { avisarGoogle: async () => ({ ok: true as const, tipo: null }) });
    expect(await crearCanales(dep).wallet(e)).toMatchObject({ tipo: "omitido", motivo: "sin_pase" });
  });

  it("Google que falla se reintenta", async () => {
    const { e, orden } = entrada();
    const { dep } = dependencias(orden, { avisarGoogle: async () => ({ ok: false as const, motivo: "Google respondió 500" }) });
    expect(await crearCanales(dep).wallet(e)).toMatchObject({ tipo: "fallo", permanente: false });
  });

  it("si una plataforma lo aceptó y la otra falló, se da por enviado (reintentar duplicaría en la que sí lo recibió)", async () => {
    const { e, orden } = entrada({ info: { esFoorkie: true }, ctx: { plataformas: ["apple", "google"] } });
    const { dep } = dependencias(orden, { avisarGoogle: async () => ({ ok: false as const, motivo: "Google respondió 500" }) });
    const r = await crearCanales(dep).wallet(e);
    expect(r.tipo).toBe("enviado");
    expect((r as { detalle: string }).detalle).toMatch(/Apple: aviso aceptado/);
    expect((r as { detalle: string }).detalle).toMatch(/Google respondió 500/);
  });
});

describe("canal correo", () => {
  it("las tarjetas de Foorkie no mandan correos desde acá", async () => {
    const { e, orden } = entrada({ info: { esFoorkie: true } });
    const { dep, llamadas } = dependencias(orden);
    expect(await crearCanales(dep).correo(e)).toMatchObject({ tipo: "omitido", motivo: "correo_lo_manda_foorkie" });
    expect(llamadas).toEqual([]);
  });

  it("sin proveedor configurado falla de forma permanente (no tiene sentido reintentar)", async () => {
    const { e, orden } = entrada();
    const { dep } = dependencias(orden, { hayProveedorDeCorreo: () => false });
    expect(await crearCanales(dep).correo(e)).toMatchObject({ tipo: "fallo", motivo: "proveedor_no_configurado", permanente: true });
  });

  it("sin correo conocido, se omite", async () => {
    const { e, orden } = entrada();
    const { dep, llamadas } = dependencias(orden, { correoDelMiembro: async () => null });
    expect(await crearCanales(dep).correo(e)).toMatchObject({ tipo: "omitido", motivo: "sin_correo" });
    expect(llamadas).not.toContain("enviarCorreo");
  });

  it("sin el permiso del cliente (persona_acepta), NO se manda", async () => {
    const { e, orden } = entrada();
    const { dep, llamadas } = dependencias(orden, { personaAceptaCorreo: async () => false });
    expect(await crearCanales(dep).correo(e)).toMatchObject({ tipo: "omitido", motivo: "sin_consentimiento" });
    expect(llamadas).not.toContain("enviarCorreo");
  });

  it("quien se dio de baja por el enlace de un correo NO recibe más, aunque persona_acepta diga que sí", async () => {
    // La baja por enlace escribe solo en la tabla antigua: persona_acepta no la ve. Por eso se exigen las dos.
    const { e, orden } = entrada();
    const { dep, llamadas } = dependencias(orden, {
      personaAceptaCorreo: async () => true,
      correoBloqueado: async () => true,
    });
    const r = await crearCanales(dep).correo(e);
    expect(r).toMatchObject({ tipo: "omitido", motivo: "sin_consentimiento" });
    expect(llamadas).not.toContain("enviarCorreo");
    expect(orden).not.toContain("marcarInicio");
  });

  it("un error al consultar el permiso NO se toma como «no acepta»: sube para reintentar", async () => {
    const { e, orden } = entrada();
    const { dep } = dependencias(orden, {
      personaAceptaCorreo: async () => {
        throw new Error("consentimiento: la base no contesta");
      },
    });
    await expect(crearCanales(dep).correo(e)).rejects.toThrow(/la base no contesta/);
  });

  it("sin enlace de baja el correo no sale", async () => {
    const { e, orden } = entrada();
    const { dep, llamadas } = dependencias(orden, { enlacesDeBaja: () => null });
    expect(await crearCanales(dep).correo(e)).toMatchObject({ tipo: "fallo", motivo: "sin_enlace_de_baja", permanente: true });
    expect(llamadas).not.toContain("enviarCorreo");
  });

  it("manda con clave de idempotencia, enlace de baja y el punto sin retorno ANTES de hablar con Resend", async () => {
    const { e, orden } = entrada({ titulo: "¡Volvé!", cuerpo: "Te extrañamos.\n\nTe esperamos." });
    let recibido: Parameters<DependenciasDeCanales["enviarCorreo"]>[0] | undefined;
    const { dep } = dependencias(orden, {
      enviarCorreo: async (c) => {
        orden.push("enviarCorreo");
        recibido = c;
        return { enviado: true, id: "re_9" };
      },
    });
    const r = await crearCanales(dep).correo(e);
    expect(r).toMatchObject({ tipo: "enviado" });
    expect(orden.indexOf("marcarInicio")).toBeLessThan(orden.indexOf("enviarCorreo"));
    expect(recibido?.to).toBe("ana@correo.com");
    expect(recibido?.subject).toBe("¡Volvé!");
    expect(recibido?.idempotencyKey).toBe("impulso-tarea-1");
    expect(recibido?.bajaOneClickUrl).toBe("https://bookea.lat/api/correo/baja?x=1");
    expect(recibido?.html).toContain("https://bookea.lat/baja?x=1");
    expect(recibido?.html).toContain("Te extrañamos.");
  });

  it("si Resend no acepta el correo es un fallo que se reintenta", async () => {
    const { e, orden } = entrada();
    const { dep } = dependencias(orden, { enviarCorreo: async () => ({ enviado: false }) });
    expect(await crearCanales(dep).correo(e)).toMatchObject({ tipo: "fallo", motivo: "error_proveedor", permanente: false });
  });
});

describe("el HTML del correo", () => {
  it("escapa lo que escribe el negocio y el nombre del cliente", () => {
    const html = htmlCorreoImpulso({
      negocio: 'Café <b>"X"</b>',
      titulo: "<script>alert(1)</script>",
      cuerpo: 'Hola <img src=x onerror=alert(1)>\n\nsegundo "párrafo"',
      urlBaja: 'https://bookea.lat/baja?a=1&b="2"',
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;");
    expect(html).toContain("&amp;b=");
  });

  it("separa los párrafos y conserva los saltos de línea simples", () => {
    const html = htmlCorreoImpulso({ negocio: "N", titulo: "T", cuerpo: "uno\ndos\n\ntres", urlBaja: "https://x" });
    expect(html.match(/<p /g)?.length).toBeGreaterThanOrEqual(3); // negocio + 2 párrafos + pie
    expect(html).toContain("uno<br>dos");
  });

  it("escaparHtml", () => {
    expect(escaparHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
