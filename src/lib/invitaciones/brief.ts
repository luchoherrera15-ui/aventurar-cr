import { fechaLargaCR } from "@/lib/fechas";

/**
 * El brief que sale de un pedido de invitación: todos los datos que el
 * cliente llenó en el formulario, en un solo texto listo para pegarle
 * al generador de IA.
 *
 * Vive acá y no dentro del panel a propósito. Es un módulo neutral (sin
 * "use client"), así que lo puede armar tanto el servidor —si algún día
 * el panel dispara la generación directo— como el navegador cuando el
 * equipo toca "Copiar brief". Meterlo en el componente lo volvería
 * inalcanzable desde el servidor, que es justo el error que ya rompió
 * Finanzas y el panel de IA.
 *
 * El texto va en español y en prosa corta: el generador trabaja mejor
 * con un encargo escrito que con un JSON de campos sueltos.
 */

export type PedidoParaBrief = {
  paquete: string;
  tipo_evento: string;
  nombre_evento: string;
  anfitriones: string | null;
  fecha_evento: string;
  hora: string | null;
  lugar_nombre: string | null;
  lugar_direccion: string | null;
  maps_url: string | null;
  tematica: string | null;
  colores: string | null;
  cantidad_invitados: number | null;
  fecha_limite_confirmacion: string | null;
  mensaje: string | null;
  idioma: string;
  contacto_nombre: string;
  contacto_whatsapp: string | null;
};

const IDIOMA_EN_PALABRAS: Record<string, string> = {
  es: "español",
  en: "inglés",
  bilingue: "bilingüe (español e inglés)",
};

/** "2026-12-24" → "Jueves 24 de diciembre de 2026"; vacío queda vacío. */
function fecha(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return fechaLargaCR(iso);
  } catch {
    return iso;
  }
}

/** Una línea "Rótulo: valor", o nada si el valor viene vacío. */
function linea(rotulo: string, valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto ? `${rotulo}: ${texto}` : null;
}

/**
 * Deja solo las líneas que salieron con contenido. Va con predicado de
 * tipo porque `.filter(Boolean)` a secas no le quita el `null` al tipo
 * y el resto del armado deja de compilar.
 */
function llenas(lineas: (string | null)[]): string[] {
  return lineas.filter((l): l is string => l !== null);
}

/**
 * Arma el encargo completo. `nombrePaquete` viene resuelto de afuera
 * (resolverPaquete) para no atar este módulo al catálogo de precios.
 */
export function briefDelPedido(p: PedidoParaBrief, nombrePaquete?: string | null): string {
  const idioma = IDIOMA_EN_PALABRAS[p.idioma] ?? p.idioma;

  const evento = llenas([
    linea("Tipo de evento", p.tipo_evento),
    linea("Nombre del evento", p.nombre_evento),
    linea("Anfitriones", p.anfitriones),
    linea("Fecha", fecha(p.fecha_evento)),
    linea("Hora", p.hora),
    linea("Cantidad de invitados", p.cantidad_invitados),
    linea("Fecha límite para confirmar", fecha(p.fecha_limite_confirmacion)),
  ]);

  const lugar = llenas([
    linea("Lugar", p.lugar_nombre),
    linea("Dirección", p.lugar_direccion),
    linea("Google Maps", p.maps_url),
  ]);

  const estilo = llenas([
    linea("Temática", p.tematica),
    linea("Colores", p.colores),
    linea("Idioma de la invitación", idioma),
  ]);

  const partes: string[] = [
    `Diseñá una invitación digital para el siguiente evento.${
      nombrePaquete ? ` Paquete contratado: ${nombrePaquete}.` : ""
    }`,
    "",
    "EL EVENTO",
    ...evento,
  ];

  if (lugar.length) partes.push("", "EL LUGAR", ...lugar);
  if (estilo.length) partes.push("", "EL ESTILO", ...estilo);

  if (p.mensaje?.trim()) {
    partes.push("", "MENSAJE QUE PIDIÓ EL CLIENTE", p.mensaje.trim());
  }

  // El contacto va al final y rotulado como referencia: es para el
  // equipo, no para que termine impreso dentro de la invitación.
  const contacto = llenas([
    linea("Nombre", p.contacto_nombre),
    linea("WhatsApp", p.contacto_whatsapp),
  ]);
  if (contacto.length) {
    partes.push("", "CONTACTO (referencia del equipo, no va en el diseño)", ...contacto);
  }

  return partes.join("\n");
}
