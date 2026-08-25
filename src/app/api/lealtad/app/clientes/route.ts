import {
  abrirPuertaApp,
  errorApp,
  jsonApp,
  responderPreflight,
} from "@/lib/lealtad/app-movil/puerta";
import { buscarClientesCore } from "@/lib/lealtad/operar-core";

/**
 * BUSCAR AL CLIENTE QUE LLEGÓ SIN LA TARJETA.
 *
 * Es la mitad que le faltaba a `/acreditar`: ese endpoint ya sabe
 * sellarle a un `miembroId`, pero el teléfono no tenía de dónde sacar
 * ese id sin escanear un QR. El cliente con el teléfono descargado, sin
 * smartphone, o con la tarjeta todavía sin agregar al Wallet se atiende
 * por acá.
 *
 * ── ES LA MISMA BÚSQUEDA QUE LA WEB, NO UNA PARECIDA ────────────────
 *
 * El filtro por tenencia, la resolución de identidad (`personas` y no
 * `perfiles` — ver el bug del póster en `operar-core.ts`), la
 * comparación SIN TILDES y el tope de resultados viven todos en
 * `buscarClientesCore`. Dos copias habrían sido dos respuestas
 * distintas a «¿a quién encuentra la caja?», y una de las dos se
 * arreglaría sin la otra.
 *
 * ── EL TOPE LO PONE EL SERVIDOR ─────────────────────────────────────
 *
 * 20 resultados, fijos en el núcleo. No hay parámetro `limite`: dejarlo
 * negociar al cliente convierte un buscador en una descarga de la
 * libreta de clientes del negocio, y esta respuesta lleva correos y
 * teléfonos de gente real.
 *
 * ── EXIGE `acreditar` ───────────────────────────────────────────────
 *
 * Quien no puede dar sellos tampoco necesita la lista de clientes del
 * negocio en su teléfono. El núcleo lo vuelve a comprobar: la puerta
 * decide quién entra, el núcleo decide qué puede hacer una vez adentro.
 */

export const OPTIONS = responderPreflight;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ranchoId = (url.searchParams.get("ranchoId") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();

  // El mínimo de dos letras se comprueba ANTES de abrir la puerta: una
  // pantalla que busca mientras se teclea dispararía una petición por
  // cada letra, y las dos primeras nunca iban a devolver nada útil.
  // Gastarlas contra el rate limit del cajero sería cobrarle el tecleo.
  if (q.length < 2) {
    return jsonApp({ ok: false, motivo: "Escribí al menos dos letras del nombre." }, 400);
  }

  const puerta = await abrirPuertaApp(req, { ranchoId, permiso: "acreditar", escribe: false });
  if (!puerta.ok) return puerta.respuesta;

  const resultado = await buscarClientesCore({
    db: puerta.db,
    ranchoId,
    quien: { usuarioId: puerta.usuarioId, permisos: puerta.permisos },
    texto: q,
  });

  if (!resultado.ok) return errorApp(resultado);

  return jsonApp(resultado);
}
