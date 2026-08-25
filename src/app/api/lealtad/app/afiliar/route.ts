import {
  abrirPuertaApp,
  errorApp,
  jsonApp,
  responderPreflight,
} from "@/lib/lealtad/app-movil/puerta";
import { afiliarCore } from "@/lib/lealtad/operar-core";

/**
 * AFILIAR A UN CLIENTE NUEVO DESDE LA CAJA.
 *
 * Es para GENTE NUEVA EN BOOKEA ENTERAMENTE. Si el correo o el WhatsApp
 * ya es de alguien, el núcleo lo rechaza y manda a buscarlo con
 * `/api/lealtad/app/clientes`: colgarle una membresía de este negocio a
 * la identidad de un tercero que nunca puso un pie acá no se deshace.
 *
 * ── ⛔ ACÁ NO SALE NADA QUE HUELA A PAGO ────────────────────────────
 *
 * Este es el endpoint donde más cuesta cumplirlo, porque el alta es
 * justamente donde el paquete se llena. El tope SÍ se hace cumplir —vive
 * en `afiliarCore`, y sacarlo de ahí convertiría este endpoint en la
 * puerta de atrás del cupo que la web cobra— pero el motivo que viaja al
 * teléfono NO menciona planes ni precios: el núcleo devuelve
 * `codigo: "cupo_agotado"` y `errorApp` lo reescribe. Regla 3.1.1 de
 * Apple, vigilada por `app-movil/sin-cobros.test.ts`.
 *
 * ── SIN `intentoId`, Y A PROPÓSITO ──────────────────────────────────
 *
 * A diferencia de `/acreditar` y `/canjear`, acá la idempotencia no la
 * pone una llave nuestra: la ponen los índices únicos de `personas`
 * sobre correo y teléfono (0138). Un doble toque manda los mismos datos,
 * la segunda alta encuentra el contacto ya tomado y rebota con el mismo
 * mensaje que si fuera de otra persona. No se crea una segunda ficha.
 *
 * ── EXIGE `acreditar` Y NO UN PERMISO NUEVO ─────────────────────────
 *
 * Es el permiso de quien atiende la caja, que es quien tiene a la
 * persona enfrente para preguntarle el nombre.
 */

export const OPTIONS = responderPreflight;

type Cuerpo = {
  ranchoId?: unknown;
  programaId?: unknown;
  nombre?: unknown;
  whatsapp?: unknown;
  correo?: unknown;
  aceptaPromos?: unknown;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export async function POST(req: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await req.json()) as Cuerpo;
  } catch {
    return jsonApp({ ok: false, motivo: "Cuerpo inválido." }, 400);
  }

  const ranchoId = texto(cuerpo.ranchoId);
  const programaId = texto(cuerpo.programaId);
  if (!programaId) {
    return jsonApp({ ok: false, motivo: "Falta la tarjeta a la que se afilia." }, 400);
  }

  const puerta = await abrirPuertaApp(req, { ranchoId, permiso: "acreditar", escribe: true });
  if (!puerta.ok) return puerta.respuesta;

  const resultado = await afiliarCore({
    db: puerta.db,
    ranchoId,
    quien: { usuarioId: puerta.usuarioId, permisos: puerta.permisos },
    programaId,
    // El nombre, el correo y el WhatsApp NO se validan acá: los revisa
    // `revisarAlta` adentro del núcleo, que es el mismo que corre la
    // web. Una segunda validación escrita en este archivo es cómo se
    // llega a que el teléfono acepte un número que el panel rechaza.
    //
    // `aceptaPromos` es un sí explícito: cualquier cosa que no sea
    // `true` se guarda como «no acepto», y eso también queda anotado —
    // lo que hay que poder demostrar es que se preguntó.
    datos: {
      nombre: texto(cuerpo.nombre),
      whatsapp: texto(cuerpo.whatsapp),
      correo: texto(cuerpo.correo),
      aceptaPromos: cuerpo.aceptaPromos === true,
    },
  });

  if (!resultado.ok) return errorApp(resultado);

  return jsonApp(resultado, 201);
}
