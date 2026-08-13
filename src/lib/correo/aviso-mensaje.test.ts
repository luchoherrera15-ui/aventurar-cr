import { describe, expect, it } from "vitest";
import { PREFIJO_ASISTENTE } from "@/lib/asistente-prefijo";
import {
  asuntoMensajeNuevo,
  decidirCorreoMensaje,
  esMomentoDeAvisar,
  resumenParaAsunto,
  VENTANA_SILENCIO_MINUTOS,
  type DatosRitmo,
} from "./aviso-mensaje";

const CLIENTE = "11111111-1111-1111-1111-111111111111";
const PROVEEDOR = "22222222-2222-2222-2222-222222222222";

/** "2026-03-21T15:00:00Z" + N minutos. */
const BASE = Date.parse("2026-03-21T15:00:00.000Z");
function enMinutos(n: number): string {
  return new Date(BASE + n * 60000).toISOString();
}

function ritmo(extra: Partial<DatosRitmo> = {}): DatosRitmo {
  return {
    autorId: CLIENTE,
    receptorId: PROVEEDOR,
    texto: "Hola, ¿tenés campo el sábado?",
    creadoEn: enMinutos(0),
    previoCreadoEn: null,
    ...extra,
  };
}

describe("esMomentoDeAvisar", () => {
  it("avisa por el primer mensaje de un hilo — la consulta nueva", () => {
    expect(esMomentoDeAvisar(ritmo())).toEqual({ avisar: true });
  });

  it("NO avisa si la conversación está viva (mensaje seguido)", () => {
    const d = ritmo({ creadoEn: enMinutos(3), previoCreadoEn: enMinutos(0) });
    expect(esMomentoDeAvisar(d)).toEqual({
      avisar: false,
      motivo: "conversacion-viva",
    });
  });

  it("NO avisa aunque el cliente mande diez mensajes seguidos", () => {
    // El caso que convierte un aviso útil en spam: la persona escribe
    // la consulta en cinco pedacitos, uno por minuto.
    for (let i = 1; i <= 10; i++) {
      const d = ritmo({ creadoEn: enMinutos(i), previoCreadoEn: enMinutos(i - 1) });
      expect(esMomentoDeAvisar(d).avisar).toBe(false);
    }
  });

  it("vuelve a avisar cuando el hilo revive después de la ventana", () => {
    const d = ritmo({
      creadoEn: enMinutos(VENTANA_SILENCIO_MINUTOS),
      previoCreadoEn: enMinutos(0),
    });
    expect(esMomentoDeAvisar(d)).toEqual({ avisar: true });
  });

  it("un minuto ANTES de la ventana todavía no avisa", () => {
    const d = ritmo({
      creadoEn: enMinutos(VENTANA_SILENCIO_MINUTOS - 1),
      previoCreadoEn: enMinutos(0),
    });
    expect(esMomentoDeAvisar(d).avisar).toBe(false);
  });

  it("NO avisa por una respuesta del asistente de IA", () => {
    // El asistente escribe EN NOMBRE del negocio y contesta al toque:
    // un correo por cada respuesta suya sería un robot mandándole
    // correos al cliente cada vez que escribe.
    const d = ritmo({
      autorId: PROVEEDOR,
      receptorId: CLIENTE,
      texto: `${PREFIJO_ASISTENTE}¡Claro! Ese sábado tenemos campo.`,
    });
    expect(esMomentoDeAvisar(d)).toEqual({
      avisar: false,
      motivo: "mensaje-automatico",
    });
  });

  it("NO avisa si el autor es el propio receptor", () => {
    const d = ritmo({ autorId: PROVEEDOR, receptorId: PROVEEDOR });
    expect(esMomentoDeAvisar(d)).toEqual({ avisar: false, motivo: "mismo-autor" });
  });

  it("avisa igual si la fecha anterior es ilegible (mejor de más que perder la consulta)", () => {
    const d = ritmo({ previoCreadoEn: "no-es-una-fecha" });
    expect(esMomentoDeAvisar(d)).toEqual({ avisar: true });
  });

  it("avisa al PROVEEDOR de la primera consulta y no al que escribió", () => {
    // La dirección la decide quien llama (receptor = el otro), pero acá
    // se deja clavado que un mensaje del cliente avisa hacia afuera.
    const d = ritmo({ autorId: CLIENTE, receptorId: PROVEEDOR });
    expect(esMomentoDeAvisar(d).avisar).toBe(true);
    const alReves = ritmo({ autorId: PROVEEDOR, receptorId: CLIENTE });
    expect(esMomentoDeAvisar(alReves).avisar).toBe(true);
  });
});

describe("decidirCorreoMensaje", () => {
  const conCorreo = { correoReceptor: "dj@correo.com", correoSuprimido: false };

  it("manda el correo cuando corresponde y hay destinatario", () => {
    expect(decidirCorreoMensaje({ ...ritmo(), ...conCorreo })).toEqual({
      avisar: true,
    });
  });

  it("NO manda si el destinatario no tiene correo (sesión anónima)", () => {
    const d = { ...ritmo(), correoReceptor: null, correoSuprimido: false };
    expect(decidirCorreoMensaje(d)).toEqual({ avisar: false, motivo: "sin-correo" });
  });

  it("NO manda a un correo mal formado", () => {
    const d = { ...ritmo(), correoReceptor: "no tiene arroba", correoSuprimido: false };
    expect(decidirCorreoMensaje(d)).toEqual({ avisar: false, motivo: "sin-correo" });
  });

  it("NO manda a un correo suprimido (rebote o queja de spam)", () => {
    const d = { ...ritmo(), correoReceptor: "rebota@correo.com", correoSuprimido: true };
    expect(decidirCorreoMensaje(d)).toEqual({
      avisar: false,
      motivo: "correo-suprimido",
    });
  });

  it("el ritmo manda por encima de todo lo demás", () => {
    const d = {
      ...ritmo({ creadoEn: enMinutos(5), previoCreadoEn: enMinutos(0) }),
      ...conCorreo,
    };
    expect(decidirCorreoMensaje(d)).toEqual({
      avisar: false,
      motivo: "conversacion-viva",
    });
  });
});

describe("resumenParaAsunto", () => {
  // Tal cual lo arma `armarPrimerMensaje` (src/app/eventos/agenda-consulta.ts).
  const PRIMER_MENSAJE =
    "Hola, quiero consultar disponibilidad para el sábado 21 de marzo de 2026 de 3:00 p. m. a 5:00 p. m.\n" +
    "Duración: 2 horas.\n" +
    "Tipo de evento: cumpleaños.\n" +
    "Todavía no hay nada reservado: te escribo para confirmar si tenés esa hora libre.";

  it("saca la fecha y la hora de arranque de la consulta de la agenda", () => {
    expect(resumenParaAsunto(PRIMER_MENSAJE)).toBe("sábado 21 de marzo, 3:00 p. m.");
  });

  it("sirve también de madrugada y con la variante a. m.", () => {
    const texto =
      "Hola, quiero consultar disponibilidad para el domingo 1 de febrero de 2026 de 9:00 a. m. a 11:00 a. m.";
    expect(resumenParaAsunto(texto)).toBe("domingo 1 de febrero, 9:00 a. m.");
  });

  it("se cae a la primera línea si el mensaje lo escribió una persona", () => {
    expect(resumenParaAsunto("¿Hacen piñatas?\nY globos?")).toBe("¿Hacen piñatas?");
  });

  it("recorta la primera línea larga", () => {
    const largo = "a".repeat(200);
    const resumen = resumenParaAsunto(largo);
    expect(resumen).not.toBeNull();
    expect((resumen as string).length).toBeLessThanOrEqual(62);
    expect(resumen).toMatch(/…$/);
  });

  it("devuelve null si no hay nada que resumir", () => {
    expect(resumenParaAsunto("   \n  \n ")).toBeNull();
  });
});

describe("asuntoMensajeNuevo", () => {
  const PRIMER_MENSAJE =
    "Hola, quiero consultar disponibilidad para el sábado 21 de marzo de 2026 de 3:00 p. m. a 5:00 p. m.";

  it("al proveedor le dice negocio, fecha y hora — se entiende sin abrirlo", () => {
    expect(
      asuntoMensajeNuevo({
        nombreNegocio: "DJ Sonido Tico",
        texto: PRIMER_MENSAJE,
        paraProveedor: true,
        esPrimerMensaje: true,
      }),
    ).toBe("Consulta nueva para DJ Sonido Tico — sábado 21 de marzo, 3:00 p. m.");
  });

  it("un hilo que revive no se anuncia como consulta nueva", () => {
    expect(
      asuntoMensajeNuevo({
        nombreNegocio: "DJ Sonido Tico",
        texto: "¿Alguna novedad?",
        paraProveedor: true,
        esPrimerMensaje: false,
      }),
    ).toBe("Mensaje nuevo para DJ Sonido Tico — ¿Alguna novedad?");
  });

  it("al cliente le dice quién le escribió, sin repetirle su propia consulta", () => {
    expect(
      asuntoMensajeNuevo({
        nombreNegocio: "DJ Sonido Tico",
        texto: PRIMER_MENSAJE,
        paraProveedor: false,
        esPrimerMensaje: false,
      }),
    ).toBe("DJ Sonido Tico te escribió por el chat");
  });

  it("aplana el nombre del negocio y el mensaje — el asunto es una cabecera", () => {
    // Sin esto, un negocio con un salto de línea en el nombre (o un
    // cliente que lo mete en su mensaje) parte la cabecera en dos.
    const asunto = asuntoMensajeNuevo({
      nombreNegocio: "DJ Tico\r\nBcc: alguien@ajeno.com",
      texto: "Hola\r\nde nuevo",
      paraProveedor: true,
      esPrimerMensaje: true,
    });
    expect(asunto).not.toMatch(/[\r\n]/);
    expect(asunto).toBe(
      "Consulta nueva para DJ Tico Bcc: alguien@ajeno.com — Hola",
    );
  });

  it("nunca pasa de 120 caracteres", () => {
    const asunto = asuntoMensajeNuevo({
      nombreNegocio: "N".repeat(90),
      texto: "x".repeat(300),
      paraProveedor: true,
      esPrimerMensaje: true,
    });
    expect(asunto.length).toBeLessThanOrEqual(120);
  });
});
