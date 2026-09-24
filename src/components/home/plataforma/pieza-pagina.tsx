import Telefono from "@/components/solutions/telefono";
import VistaPagina, { type DatosPagina } from "@/components/solutions/vista-pagina";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL LINK APP DEL HOME — el producto, adentro de un teléfono de verdad
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «trabajá más los mockups, hacelos más
 * profesionales, como si realmente estuviéramos viendo el producto». Y
 * después, con take.app en pantalla: «mirá los reales que se ven estos
 * mockups de los teléfonos, quiero que los nuestros se vean así».
 *
 * Las dos cosas juntas dan este archivo:
 *
 *   · Adentro va `<VistaPagina>`, el MISMO componente que pinta
 *     `/s/<slug>` para un cliente real y la previa del panel. No un
 *     dibujo, no una captura: el producto. Si mañana cambia, esto
 *     cambia con él.
 *   · Va dentro de un `<Telefono>` GRANDE, pensado para que la
 *     `<Ventana>` de la tarjeta lo recorte por arriba y por abajo. Ese
 *     recorte es lo que permite que mida 280 px en vez de 145 y que su
 *     contenido se lea (ver el porqué largo en `piezas.tsx`).
 *
 * ── LA FOTO ES REAL ─────────────────────────────────────────────────
 *
 * La portada usa una de las escenas propias que ya viven en Cloudflare
 * Images, las mismas de la página de producto. No es foto de banco.
 *
 * ── LO QUE FALTA, DICHO ─────────────────────────────────────────────
 *
 * El negocio de la muestra no existe, así que no lleva WhatsApp: un
 * número inventado en un mockup es una promesa que alguien va a
 * marcar. El día que un cliente preste su página de verdad, este
 * archivo se reduce a leer su slug.
 */

const PORTADA =
  "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-restaurante/gallery";

/**
 * Una cafetería de especialidad. El verde matcha y la crema no son
 * decorativos: son el `colorAcento` y el `colorFondo` que el dueño
 * elige en su panel, así que enseñarlos ES enseñar que se personaliza.
 */
export const PAGINA_DEMO: DatosPagina = {
  nombre: "Casa Matcha",
  bajada: "Cafetería de especialidad · Escazú",
  logoUrl: null,
  fotoPortadaUrl: PORTADA,
  whatsapp: null,
  direccion: "Plaza Itskatzú, Escazú",
  colorFondo: "#f7f4ec",
  colorAcento: "#2f6b4f",
  tema: "crema",
  estiloLinks: "lista",
  redondeo: "redondo",
  fuente: "sistema",
  estiloPortada: "completa",
  efecto: "elevado",
  links: [
    { id: "pedir", etiqueta: "Pedir para llevar", url: "#", icono: "link" },
    { id: "reservar", etiqueta: "Reservar mesa", url: "#", icono: "link" },
    { id: "sellos", etiqueta: "Mi tarjeta de sellos", url: "#", icono: "link" },
    { id: "ig", etiqueta: "@casamatcha", url: "#", icono: "instagram" },
    { id: "mapa", etiqueta: "Cómo llegar", url: "#", icono: "link" },
  ],
  seccionesMenu: ["Cafés de especialidad", "Matcha", "Repostería"],
  hayMenu: true,
  aceptaPedidos: true,
  mesa: null,
  rubro: "cafeteria",
  moneda: "CRC",
  pais: "CR",
};

/**
 * La página adentro del teléfono, a proporción real.
 *
 * Probé una versión con el teléfono alargado para que la tarjeta lo
 * recortara —la técnica de take.app— y el dueño la descartó: «no
 * necesariamente que salga cortado». Lo que buscaba era otra cosa, que
 * se vea como la aplicación DE VERDAD. Eso no lo da el encuadre, lo da
 * el contenido — y acá el contenido es el componente de producción.
 *
 * `barraEstado` prendida: la hora y la señal arriba son lo que hace
 * que una pantalla se lea como un teléfono de alguien y no como una
 * ilustración de un teléfono.
 */
export default function PiezaPagina({
  ancho = 280,
  className = "",
}: {
  ancho?: number;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-fit ${className}`}>
      <Telefono ancho={ancho} tinta="#0F172A">
        <div className="h-full w-full overflow-hidden bg-white">
          <VistaPagina
            datos={PAGINA_DEMO}
            inerte
            nivelTitulo="p"
            credito="Hecho con Bookea"
          />
        </div>
      </Telefono>
    </div>
  );
}
