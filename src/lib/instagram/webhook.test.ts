import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { extraerComentarios, responderVerificacion, verificarFirmaMeta } from "./webhook";

const SECRETO = "app-secret";
const firmar = (cuerpo: string, secreto = SECRETO) => "sha256=" + createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex");

/** Un aviso de comentario con la forma que documenta Meta. */
const AVISO = {
  object: "instagram",
  entry: [
    {
      id: "17841400000000001",
      time: 1725700000,
      changes: [
        {
          field: "comments",
          value: {
            id: "17900000000000001",
            text: "¿Cuál es el PRECIO?",
            from: { id: "5550001", username: "ana.cliente" },
            media: { id: "18000000000000001", media_product_type: "FEED" },
          },
        },
      ],
    },
  ],
};

describe("la verificación del webhook (GET)", () => {
  it("devuelve el challenge cuando el token coincide", () => {
    const p = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "mi-token", "hub.challenge": "123456" });
    expect(responderVerificacion(p, "mi-token")).toEqual({ ok: true, challenge: "123456" });
  });
  it("rechaza token distinto, modo distinto o sin challenge", () => {
    expect(responderVerificacion(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "1" }), "mi-token").ok).toBe(false);
    expect(responderVerificacion(new URLSearchParams({ "hub.mode": "unsubscribe", "hub.verify_token": "mi-token", "hub.challenge": "1" }), "mi-token").ok).toBe(false);
    expect(responderVerificacion(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "mi-token" }), "mi-token").ok).toBe(false);
    // Sin token configurado nunca verifica: un webhook «abierto» no existe.
    expect(responderVerificacion(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), "").ok).toBe(false);
  });
});

describe("la firma X-Hub-Signature-256", () => {
  const cuerpo = JSON.stringify(AVISO);
  it("acepta la firma correcta", () => {
    expect(verificarFirmaMeta(cuerpo, firmar(cuerpo), SECRETO)).toBe(true);
  });
  it("rechaza firma de otro secreto, cuerpo alterado, cabecera ausente o malformada", () => {
    expect(verificarFirmaMeta(cuerpo, firmar(cuerpo, "otro"), SECRETO)).toBe(false);
    expect(verificarFirmaMeta(cuerpo + " ", firmar(cuerpo), SECRETO)).toBe(false);
    expect(verificarFirmaMeta(cuerpo, null, SECRETO)).toBe(false);
    expect(verificarFirmaMeta(cuerpo, "sha1=abc", SECRETO)).toBe(false);
    expect(verificarFirmaMeta(cuerpo, "sha256=zz", SECRETO)).toBe(false);
  });
});

describe("extraerComentarios", () => {
  it("lee el aviso documentado por Meta, plano", () => {
    expect(extraerComentarios(AVISO)).toEqual([
      {
        cuentaIgId: "17841400000000001",
        comentarioId: "17900000000000001",
        texto: "¿Cuál es el PRECIO?",
        deId: "5550001",
        deUsername: "ana.cliente",
        mediaId: "18000000000000001",
        mediaTipo: "FEED",
        parentId: null,
        tiempo: 1725700000,
      },
    ]);
  });
  it("una respuesta a otro comentario trae parent_id", () => {
    const valor = { ...AVISO.entry[0].changes[0].value, parent_id: "17900000000000000" };
    const aviso = { object: "instagram", entry: [{ id: AVISO.entry[0].id, time: 1, changes: [{ field: "comments", value: valor }] }] };
    expect(extraerComentarios(aviso)[0].parentId).toBe("17900000000000000");
  });
  it("ignora otros campos y otros objetos, y tolera ids numéricos", () => {
    expect(extraerComentarios({ object: "instagram", entry: [{ id: 1, changes: [{ field: "mentions", value: { id: "x" } }] }] })).toEqual([]);
    expect(extraerComentarios({ object: "page", entry: [] })).toEqual([]);
    const conNumeros = { object: "instagram", entry: [{ id: 17841400000000001, changes: [{ field: "comments", value: { id: 17900000000000001, text: "hola" } }] }] };
    const c = extraerComentarios(conNumeros)[0];
    expect(c.cuentaIgId).toBe("17841400000000000");
    expect(c.texto).toBe("hola");
    expect(c.mediaId).toBeNull();
  });
  it("basura: lista vacía, sin lanzar", () => {
    expect(extraerComentarios(null)).toEqual([]);
    expect(extraerComentarios("texto")).toEqual([]);
    expect(extraerComentarios({ object: "instagram", entry: "no" })).toEqual([]);
    expect(extraerComentarios({ object: "instagram", entry: [null, 1, { id: "x" }] })).toEqual([]);
  });
});
