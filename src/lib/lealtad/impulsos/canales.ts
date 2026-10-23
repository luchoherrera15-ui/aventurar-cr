import type { SupabaseClient } from "@supabase/supabase-js";
import { enlacesBaja } from "@/lib/correo/baja";
import { htmlCorreoImpulso } from "./correo-html";
import type { CanalesDeEnvio, EntradaDeEnvio, ResultadoDeEnvio } from "./motor";
import type { InfoPrograma } from "./tipos";

/**
 * LOS DOS CANALES QUE DE VERDAD EXISTEN: el Wallet y el correo.
 *
 * Cada uno decide primero si CORRESPONDE mandar (hay a dónde, hay permiso) y recién después habla con el
 * proveedor. Y lo que el proveedor contesta se cuenta como lo que es:
 *
 *   «enviado»  = el proveedor ACEPTÓ el mensaje (Resend lo recibió, APNs lo aceptó, Google lo agregó al
 *                pase). Ningún canal confirma que el cliente lo VIO: por eso no existe «entregado» todavía.
 *   «omitido»  = se decidió no mandar, con su motivo. No es un error.
 *   «fallo»    = el proveedor no lo aceptó. Si es transitorio, el motor reintenta.
 *
 * Todo lo que toca el exterior entra por `DependenciasDeCanales`, para probar cada decisión sin Apple, sin
 * Google y sin Resend.
 */

export type DiagnosticoApple =
  | { hay: false }
  | { hay: true; dispositivos: number; enviados: number; caducados: number; motivo?: string };

export type DependenciasDeCanales = {
  /** Deja el texto como «Último mensaje» del pase de Apple. false = no se pudo guardar. */
  escribirMensajeApple(miembroId: string, texto: string): Promise<boolean>;
  /** Avisa a los teléfonos con el pase de Apple y refresca el de Google, DEVOLVIENDO lo que contestaron. */
  avisarPase(miembroId: string): Promise<{ apple: DiagnosticoApple }>;
  avisarGoogle(
    miembroId: string,
    aviso: { evento: "impulso"; texto: string; encabezado: string },
  ): Promise<{ ok: true; tipo: "TEXT_AND_NOTIFY" | "TEXT" | null } | { ok: false; motivo: string }>;

  hayProveedorDeCorreo(): boolean;
  enviarCorreo(c: { to: string; subject: string; html: string; bajaOneClickUrl?: string; idempotencyKey?: string }): Promise<{ enviado: boolean; id?: string }>;
  enlacesDeBaja(correo: string, ranchoId: string): { pagina: string; oneClick: string } | null;
  correoDelMiembro(miembroId: string): Promise<string | null>;
  /** `persona_acepta(..., 'correo', cuenta, rancho)`: el permiso explícito del cliente con ESTE negocio. */
  personaAceptaCorreo(miembroId: string, info: InfoPrograma): Promise<boolean>;
  /** La baja por el enlace del correo (tabla antigua) y los rebotes. Ver «las dos tablas de consentimiento». */
  correoBloqueado(correo: string, ranchoId: string): Promise<boolean>;
};

const omitido = (motivo: string, detalle: string): ResultadoDeEnvio => ({ tipo: "omitido", motivo, detalle });

export function crearCanales(dep: DependenciasDeCanales): CanalesDeEnvio {
  return {
    wallet: (e) => enviarPorWallet(dep, e),
    correo: (e) => enviarPorCorreo(dep, e),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  WALLET
// ═══════════════════════════════════════════════════════════════════

/**
 * El mensaje en la tarjeta que el cliente tiene en el teléfono.
 *
 *   Google Wallet  un mensaje con notificación en el objeto de ESE cliente (`addMessage`). Sirve en
 *                  cualquier tarjeta. Google deja unas pocas notificaciones por día y por tarjeta; pasado
 *                  el tope el mensaje entra igual, sin sonido (`avisarEventoGoogle` lo maneja).
 *   Apple Wallet   Apple no tiene un mensaje independiente: lo único que puede mostrar es el texto de un
 *                  campo del pase cuando cambia. Ese campo («Último mensaje») por cliente existe SOLO en las
 *                  tarjetas de Foorkie; el pase de una tarjeta propia de Bookea está congelado y no lo trae.
 *                  Por eso, en una tarjeta de Bookea, un cliente que solo tiene iPhone no es alcanzable
 *                  uno por uno, y el mensaje se omite diciéndolo (no se finge).
 *
 * En Apple el título no se muestra: la línea del reverso del pase es una sola. En Google sí (encabezado).
 *
 * El consentimiento: el Wallet no tiene un canal propio en `consentimientos_persona`. Quien guardó la
 * tarjeta en su teléfono eligió tenerla ahí, y puede quitarla (o silenciar sus avisos) cuando quiera.
 * Es una decisión de producto que se deja anotada en el informe; el motor no la inventa.
 */
async function enviarPorWallet(dep: DependenciasDeCanales, e: EntradaDeEnvio): Promise<ResultadoDeEnvio> {
  const plataformas = e.ctx.plataformas;
  if (plataformas.length === 0) return omitido("sin_pase", "El cliente no guardó la tarjeta en el Wallet.");

  const porApple = plataformas.includes("apple") && e.info.esFoorkie;
  const porGoogle = plataformas.includes("google");
  if (!porApple && !porGoogle) {
    return omitido("sin_canal_individual", "Solo tiene Apple Wallet y esta tarjeta no admite mensajes individuales en iPhone.");
  }

  // Desde acá cada paso habla con un proveedor: el motor lo anota como punto sin retorno.
  await e.marcarInicio();

  const notas: string[] = [];
  const fallos: string[] = [];
  let aceptados = 0;

  if (porApple) {
    if (!(await dep.escribirMensajeApple(e.tarea.miembro_id, e.cuerpo))) {
      fallos.push("Apple: no se pudo guardar el mensaje en el pase.");
    } else {
      const { apple } = await dep.avisarPase(e.tarea.miembro_id);
      if (apple.hay && apple.enviados > 0) {
        aceptados++;
        notas.push(`Apple: aviso aceptado por APNs (${apple.enviados}).`);
      } else if (apple.hay && apple.dispositivos === 0) {
        notas.push("Apple: el pase no está instalado en ningún teléfono.");
      } else {
        fallos.push(`Apple: ${apple.hay ? (apple.motivo ?? "APNs no aceptó el aviso.") : "no hay pase."}`);
      }
    }
  }

  if (porGoogle) {
    const g = await dep.avisarGoogle(e.tarea.miembro_id, { evento: "impulso", texto: e.cuerpo, encabezado: e.titulo });
    if (!g.ok) fallos.push(`Google: ${g.motivo}`);
    else if (g.tipo === null) notas.push("Google: la tarjeta no está guardada en Google Wallet.");
    else {
      aceptados++;
      notas.push(g.tipo === "TEXT_AND_NOTIFY" ? "Google: aceptado, con notificación." : "Google: aceptado, sin sonido (tope diario de Google).");
    }
  }

  const detalle = [...notas, ...fallos].join(" ");
  // Si ALGUNA plataforma lo aceptó, se da por enviado: reintentar mandaría un segundo mensaje a la que sí lo recibió.
  if (aceptados > 0) return { tipo: "enviado", detalle };
  if (fallos.length > 0) return { tipo: "fallo", motivo: "error_proveedor", detalle, permanente: false };
  return omitido("sin_pase", detalle || "La tarjeta no está instalada en ningún teléfono.");
}

// ═══════════════════════════════════════════════════════════════════
//  CORREO
// ═══════════════════════════════════════════════════════════════════

/**
 * Un correo con el mensaje del negocio. Solo sale si TODO esto es cierto:
 *   1. la tarjeta no es de Foorkie (los correos de esas los manda Foorkie);
 *   2. hay un proveedor configurado;
 *   3. se conoce el correo del cliente;
 *   4. el cliente aceptó recibir correos de ESTE negocio (`persona_acepta`);
 *   5. no se dio de baja por el enlace de un correo anterior ni su correo rebota.
 *
 * ── LAS DOS TABLAS DE CONSENTIMIENTO ───────────────────────────────
 * Hay dos registros y no se hablan en las dos direcciones: el alta por el QR escribe en
 * `consentimientos_persona` y copia hacia la tabla antigua `consentimientos`, pero el enlace de baja
 * de un correo escribe SOLO en la antigua. `persona_acepta` mira solo la nueva, así que sola dejaría
 * pasar a alguien que ya se dio de baja. Por eso se exigen LAS DOS (4 y 5): si cualquiera dice que no,
 * no se manda. Es más estricto que cualquiera de las dos por separado, a propósito.
 *
 * El enlace de baja va en el pie del correo y en la cabecera List-Unsubscribe; un correo de marketing
 * sin forma de darse de baja no sale.
 *
 * La clave de idempotencia es el id de la tarea: si el envío se corta y se reintenta, Resend no manda
 * el correo dos veces.
 */
async function enviarPorCorreo(dep: DependenciasDeCanales, e: EntradaDeEnvio): Promise<ResultadoDeEnvio> {
  if (e.info.esFoorkie) {
    return omitido("correo_lo_manda_foorkie", "Es una tarjeta de Foorkie: los correos los manda Foorkie.");
  }
  if (!dep.hayProveedorDeCorreo()) {
    return { tipo: "fallo", motivo: "proveedor_no_configurado", detalle: "Falta RESEND_API_KEY en el servidor.", permanente: true };
  }

  const correo = await dep.correoDelMiembro(e.tarea.miembro_id);
  if (!correo) return omitido("sin_correo", "No tenemos el correo de este cliente.");

  if (!(await dep.personaAceptaCorreo(e.tarea.miembro_id, e.info))) {
    return omitido("sin_consentimiento", "El cliente no aceptó recibir correos de este negocio.");
  }
  if (await dep.correoBloqueado(correo, e.info.ranchoId)) {
    return omitido("sin_consentimiento", "El cliente se dio de baja o su correo rebota.");
  }

  const baja = dep.enlacesDeBaja(correo, e.info.ranchoId);
  if (!baja) {
    return { tipo: "fallo", motivo: "sin_enlace_de_baja", detalle: "No se pudo armar el enlace de baja.", permanente: true };
  }

  await e.marcarInicio();
  const r = await dep.enviarCorreo({
    to: correo,
    subject: e.titulo,
    html: htmlCorreoImpulso({ negocio: e.info.nombreNegocio || "Tu negocio", titulo: e.titulo, cuerpo: e.cuerpo, urlBaja: baja.pagina }),
    bajaOneClickUrl: baja.oneClick,
    idempotencyKey: `impulso-${e.tarea.id}`,
  });
  if (!r.enviado) {
    return { tipo: "fallo", motivo: "error_proveedor", detalle: "Resend no aceptó el correo.", permanente: false };
  }
  return { tipo: "enviado", detalle: r.id ? `Aceptado por Resend (${r.id}).` : "Aceptado por Resend." };
}

// ═══════════════════════════════════════════════════════════════════
//  LAS DEPENDENCIAS DE VERDAD
// ═══════════════════════════════════════════════════════════════════

function falloRpc(donde: string, error: { message: string }): never {
  throw new Error(`${donde}: ${error.message}`);
}

/**
 * Cableado de producción. Los módulos de Apple, Google y Resend se cargan al usarlos (`import()`):
 * traen criptografía y credenciales que no hace falta cargar para correr las pruebas ni para un
 * impulso que no los usa.
 */
export function dependenciasReales(db: SupabaseClient): DependenciasDeCanales {
  return {
    async escribirMensajeApple(miembroId, texto) {
      const { escribirMensajeDelMiembro } = await import("@/lib/wallet/mensaje-del-miembro");
      return escribirMensajeDelMiembro(db, miembroId, texto);
    },

    async avisarPase(miembroId) {
      const { probarAvisoDePase } = await import("@/lib/wallet/servicio");
      const d = await probarAvisoDePase(miembroId);
      return { apple: d.apple };
    },

    async avisarGoogle(miembroId, aviso) {
      const { avisarEventoGoogle } = await import("@/lib/wallet/google");
      return avisarEventoGoogle(miembroId, aviso);
    },

    hayProveedorDeCorreo: () => Boolean(process.env.RESEND_API_KEY),

    async enviarCorreo(c) {
      const { enviarCorreo } = await import("@/lib/email");
      return enviarCorreo(c);
    },

    enlacesDeBaja: (correo, ranchoId) => enlacesBaja(correo, ranchoId),

    async correoDelMiembro(miembroId) {
      const { correoDelMiembro } = await import("@/lib/correo/sello-acreditado");
      return correoDelMiembro(db as Parameters<typeof correoDelMiembro>[0], miembroId);
    },

    async personaAceptaCorreo(miembroId, info) {
      const { data: m, error } = await db.from("miembros").select("persona_id").eq("id", miembroId).maybeSingle();
      if (error) falloRpc("consentimiento (cliente)", error);
      const personaId = (m as { persona_id?: string | null } | null)?.persona_id;
      if (!personaId) return false;
      const { data, error: errorRpc } = await db.rpc("persona_acepta", {
        p_persona: personaId,
        p_canal: "correo",
        p_cuenta: info.cuentaId,
        p_rancho: info.ranchoId,
      });
      // Un error de la base NO es un «no acepta»: se lanza y la tarea se reintenta.
      if (errorRpc) falloRpc("consentimiento", errorRpc);
      return data === true;
    },

    async correoBloqueado(correo, ranchoId) {
      const { data, error } = await db.rpc("correos_bloqueados_marketing", { p_correos: [correo], p_rancho_id: ranchoId });
      if (error) falloRpc("bajas y rebotes", error);
      return Array.isArray(data) && data.length > 0;
    },
  };
}

export function crearCanalesReales(db: SupabaseClient): CanalesDeEnvio {
  return crearCanales(dependenciasReales(db));
}
