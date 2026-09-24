import VistaPagina, { type DatosPagina } from "@/components/solutions/vista-pagina";
import { Encabezado, Escenario, NotaDemo, Seccion } from "./piezas";

/**
 * TU PÁGINA DE BOOKEA — el producto corriendo dentro del home.
 *
 * El teléfono no lleva una captura: lleva `<VistaPagina>`, el MISMO
 * componente que pinta `/s/<slug>` en vivo y la previa del panel. Una
 * captura envejece el día que el producto cambia; un render no puede
 * mentir porque ES el producto.
 *
 * `inerte` lo apaga (nada navega) y `nivelTitulo="p"` evita el segundo
 * `<h1>` en la página.
 *
 * El negocio de la muestra no existe: por eso no lleva WhatsApp real.
 * Y acá no se dice «Linksy» ni se vende «Bookea Link» como marca — es,
 * simplemente, tu página de Bookea.
 */

const DEMO: DatosPagina = {
  nombre: "Silence Barber",
  bajada: "Barbería · San José",
  logoUrl: null,
  fotoPortadaUrl: null,
  whatsapp: null,
  direccion: "Barrio Escalante, San José",
  colorFondo: "#10141c",
  colorAcento: "#e0a34a",
  tema: "noche",
  estiloLinks: "lista",
  redondeo: "suave",
  fuente: "condensada",
  estiloPortada: "card",
  efecto: "elevado",
  links: [
    { id: "reservar", etiqueta: "Reservar cita", url: "#", icono: "link" },
    { id: "servicios", etiqueta: "Servicios y precios", url: "#", icono: "link" },
    { id: "equipo", etiqueta: "Nuestro equipo", url: "#", icono: "link" },
    { id: "lealtad", etiqueta: "Mi tarjeta de sellos", url: "#", icono: "link" },
    { id: "ig", etiqueta: "Instagram", url: "#", icono: "instagram" },
  ],
  seccionesMenu: [],
  hayMenu: false,
  aceptaPedidos: false,
  mesa: null,
  rubro: "barberia",
};

export default function TuPagina() {
  return (
    <Seccion fondo="gris" id="tu-pagina">
      <Encabezado rotulo="Tu página" titulo="Tu negocio, en un solo link.">
        Lo pegás en Instagram, en WhatsApp o en el QR de tu local. Todo lo que ofrecés, junto.
      </Encabezado>

      <Escenario ancho="telefono">
        <div className="overflow-hidden rounded-[32px] border-[8px] border-[#10192e] bg-[#10192e] shadow-[0_36px_84px_-30px_rgba(20,22,26,0.28)]">
          <div className="max-h-[560px] overflow-hidden">
            <VistaPagina datos={DEMO} inerte nivelTitulo="p" credito="Hecho con Bookea" />
          </div>
        </div>
        <NotaDemo>Negocio de muestra. Se ve tal cual la ve tu cliente.</NotaDemo>
      </Escenario>
    </Seccion>
  );
}
