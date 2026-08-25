import { layoutBento } from "@/lib/email";
import { mockupPaseHtml, PASE_DE_MUESTRA } from "./mockup-pase";
import { urlSitio } from "@/lib/sitio";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS CAMPAÑAS YA REDACTADAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): «es para enviar como un mensaje ya
 * hecho, algo PROFESIONAL QUE ENGANCHE, que ofrezcamos. Ejemplo:
 * ¡COMENZÁ A PREMIAR TUS CLIENTES PARA QUE VUELVAN Y TE PREFIERAN!»
 *
 * Hasta ahora `/admin/campanas` mandaba un asunto y un textarea pelado:
 * cada campaña se escribía de cero, en una caja de texto, sin ver cómo
 * iba a quedar. Estas plantillas son el mensaje entero ya armado —
 * titular, cuerpo, llamado a la acción y el mockup del pase—, listo
 * para mandar o para editar antes de mandar.
 *
 * ── EL TEXTO SE PUEDE EDITAR; LA ESTRUCTURA NO ─────────────────────
 *
 * A propósito. Quien manda la campaña cambia el titular y el cuerpo si
 * quiere, pero no puede romper el HTML del correo: el maquetado sale de
 * `layoutBento`, que es el mismo que usa todo el sitio y el único que se
 * probó contra Gmail, Outlook y la app del teléfono.
 *
 * ── NADA DE CIFRAS INVENTADAS ───────────────────────────────────────
 *
 * Ninguna plantilla dice «los negocios con Bookea venden un 30 % más».
 * No tenemos ese dato y presentarlo sería mentir. Lo que sí se puede
 * afirmar está verificado contra el producto: que la tarjeta vive en
 * Apple Wallet y Google Wallet, que no hay app que instalar, que el
 * paquete de prueba es gratis y no pide tarjeta (ver PLANES en
 * src/lib/lealtad/planes.ts) y que armarla lleva unos minutos.
 */

export type PlantillaCampana = {
  /** Estable: es lo que guarda el panel para recordar la elección. */
  id: string;
  /** Cómo se llama en el selector del panel. */
  nombre: string;
  /** Para qué sirve, en una línea. */
  paraQuien: string;
  /** El asunto que llega al buzón. */
  asunto: string;
  /** El rótulo chico de arriba de todo. */
  kicker: string;
  /** El titular grande. */
  titulo: string;
  /** La bajada, debajo del titular, sobre el navy. */
  intro: string;
  /** El mensaje clave, sobre la tarjeta naranja. Opcional. */
  destacado?: string;
  /**
   * Los párrafos del cuerpo. Van como texto plano y se convierten a
   * HTML acá: quien edita la campaña no tiene que saber HTML, y así no
   * puede pegar etiquetas que rompan el correo.
   */
  cuerpo: string[];
  /** El botón. */
  cta: { href: string; label: string };
  /** Si el correo lleva el mockup del pase. */
  conMockup: boolean;
};

const CTA_LEALTAD = {
  href: urlSitio("/lealtad"),
  label: "Ver cómo funciona",
} as const;

export const PLANTILLAS_CAMPANA: readonly PlantillaCampana[] = [
  {
    id: "premiar-clientes",
    nombre: "Empezá a premiar a tus clientes",
    paraQuien: "Negocios que todavía no tienen programa de lealtad.",
    asunto: "Tus clientes vuelven si les das una razón",
    kicker: "Bookea Lealtad",
    titulo: "¡Comenzá a premiar a tus clientes para que vuelvan y te prefieran!",
    intro:
      "Una tarjeta de sellos digital, en el teléfono de tus clientes. Sin cartón que se moje y sin ninguna app que instalar.",
    destacado:
      "Armala en unos minutos y empezá gratis: el paquete de prueba no vence ni te pide tarjeta de crédito.",
    cuerpo: [
      "Cada vez que un cliente te visita, le escaneás su código y el sello entra solo. Él lo ve al instante en su teléfono, sin abrir nada.",
      "Cuando le falta poco para el premio, le llega un aviso — nadie de tu equipo tiene que acordarse de escribirle.",
      "Y vos ves quiénes son los de siempre, quiénes hace rato no aparecen y quién está por llegar a su premio.",
    ],
    cta: CTA_LEALTAD,
    conMockup: true,
  },
  {
    id: "wallet-sin-app",
    nombre: "Vive en el Wallet, sin instalar nada",
    paraQuien: "Quien duda porque cree que sus clientes tienen que bajar una app.",
    asunto: "Tus clientes no tienen que instalar nada",
    kicker: "Apple Wallet · Google Wallet",
    titulo: "La tarjeta vive donde ya está la del banco",
    intro:
      "Se agrega a Apple Wallet o a Google Wallet, que vienen instalados en todos los teléfonos. Nadie descarga nada de más.",
    destacado:
      "Funciona igual en iPhone y en Android: es el mismo programa, no dos productos distintos.",
    cuerpo: [
      "Se comparte con un link o con un QR pegado en la caja. Quien lo abre agrega la tarjeta y queda afiliado solo.",
      "A partir de ahí la tarjeta se actualiza sola en su teléfono cada vez que le sellás una visita.",
    ],
    cta: CTA_LEALTAD,
    conMockup: true,
  },
  {
    id: "probalo-gratis",
    nombre: "Probalo gratis",
    paraQuien: "Recordatorio corto para quien ya conoce el producto.",
    asunto: "Armá tu tarjeta de lealtad gratis",
    kicker: "Sin costo para empezar",
    titulo: "Probalo con tus clientes reales, sin pagar nada",
    intro:
      "El paquete de prueba no vence y no pide tarjeta de crédito. Alcanza para armar tu tarjeta y probarla de verdad.",
    cuerpo: [
      "Elegís el tipo de tarjeta, ponés tus colores y tu logo, y decidís qué se gana. La vas viendo mientras la armás.",
      "Si te sirve, subís de paquete cuando quieras. Si no, no pasa nada.",
    ],
    cta: { href: urlSitio("/lealtad/crear"), label: "Armar mi tarjeta" },
    conMockup: true,
  },
] as const;

export function plantillaPorId(id: string): PlantillaCampana | null {
  return PLANTILLAS_CAMPANA.find((p) => p.id === id) ?? null;
}

/**
 * Lo que quien manda la campaña puede cambiar antes de enviarla.
 *
 * Es un subconjunto de `PlantillaCampana` a propósito: el `cta`, el
 * `kicker` y el maquetado NO se editan desde el panel. Un botón que
 * apunte a cualquier lado o un correo con el HTML roto son dos formas
 * de arruinar una campaña que ya salió, y ninguna se puede deshacer.
 */
export type EdicionCampana = {
  titulo: string;
  intro: string;
  destacado?: string;
  cuerpo: string[];
  conMockup: boolean;
};

/**
 * El HTML final de una campaña.
 *
 * ⚠️ `escapar` ENTRA POR PARÁMETRO y no se importa acá, y no es un
 * capricho: este módulo lo usa el panel del admin para pintar la VISTA
 * PREVIA, y `@/lib/email` arrastra el cliente de Resend. Importarlo
 * desde un componente de cliente metería el SDK entero —y su API key
 * leída de `process.env`— en el bundle del navegador.
 *
 * `layoutBento` sí viene de ahí, así que esta función corre SOLO en el
 * servidor. La vista previa la pide por una server action.
 */
export function construirCampana(
  plantilla: PlantillaCampana,
  edicion: EdicionCampana,
  escapar: (t: string) => string,
  bajaUrl?: string,
): string {
  const parrafos = edicion.cuerpo
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;">${escapar(p).replace(/\r?\n/g, "<br>")}</p>`,
    )
    .join("");

  // El mockup va DESPUÉS de los párrafos: primero se explica qué es, y
  // recién entonces se muestra. Al revés, el pase aparece sin contexto.
  const cuerpoHtml = edicion.conMockup
    ? `${parrafos}<div style="margin-top:18px;">${mockupPaseHtml(PASE_DE_MUESTRA)}</div>`
    : parrafos;

  return layoutBento({
    kicker: plantilla.kicker,
    titulo: escapar(edicion.titulo),
    introHtml: escapar(edicion.intro).replace(/\r?\n/g, "<br>"),
    naranjaHtml: edicion.destacado?.trim()
      ? escapar(edicion.destacado)
      : undefined,
    cuerpoHtml,
    cta: plantilla.cta,
    pie: "Recibiste este correo porque tenés una cuenta en Bookea.",
    bajaUrl,
  });
}
