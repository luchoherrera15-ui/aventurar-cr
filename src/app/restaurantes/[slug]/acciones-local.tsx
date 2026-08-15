import BotonConsultar from "@/components/boton-consultar";
import { IconWhatsapp } from "@/components/icons";
import type { OpcionesRestaurante, TemaFicha } from "../tipos";

/**
 * Qué se puede hacer en este local: reservar mesa, pedir para recoger,
 * escribirle o llamarlo por WhatsApp. Todo desemboca en el chat de la
 * propia página (`BotonConsultar`), menos WhatsApp.
 *
 * Vive aparte porque los DOS temas de la ficha muestran exactamente
 * los mismos botones con exactamente las mismas reglas —qué aparece y
 * qué no sale de `detalles`, no del diseño—; lo único que cambia es
 * cómo se ven. Duplicar el bloque garantizaba que algún día el tema
 * nuevo se olvidara del pickup.
 */

/**
 * El vestuario de cada tema.
 *
 * Ojo con `carta`: sus botones están pensados para vivir sobre la
 * portada OSCURA de la carta, no sobre papel. Si algún día se usan
 * sobre el fondo claro, hay que darles su propio juego de clases.
 */
const ESTILOS: Record<
  TemaFicha,
  { principal: string; segundo: string; contorno: string; whatsapp: string }
> = {
  estandar: {
    principal:
      "rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2",
    segundo:
      "rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark",
    contorno:
      "rounded-xl border border-aventurea-line bg-aventurea-surface px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy",
    whatsapp:
      "flex items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-green",
  },
  carta: {
    principal:
      "rounded-sm bg-[#f7f2ea] px-7 py-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#1c1512] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a86a]",
    // Relleno también, en latón: el pickup es la acción de todos los
    // días de una cafetería y en muchos locales es la ÚNICA que sale
    // (nadie reserva mesa para un café), así que un botón de contorno
    // lo dejaría sin ningún llamado fuerte en toda la portada.
    segundo:
      "rounded-sm bg-[#d9a86a] px-7 py-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#1c1512] transition-colors hover:bg-[#e6bb85] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7f2ea]",
    contorno:
      "rounded-sm border border-[#f7f2ea]/45 px-7 py-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#f7f2ea] transition-colors hover:border-[#f7f2ea] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a86a]",
    whatsapp:
      "flex items-center gap-2 rounded-sm border border-[#f7f2ea]/45 px-7 py-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#f7f2ea] transition-colors hover:border-[#f7f2ea] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a86a]",
  },
};

export default function AccionesLocal({
  ranchoId,
  nombre,
  whatsapp,
  opciones,
  tema,
  className = "mt-5 flex flex-wrap gap-2.5",
}: {
  ranchoId: string;
  nombre: string;
  whatsapp: string | null;
  opciones: OpcionesRestaurante;
  tema: TemaFicha;
  className?: string;
}) {
  const estilo = ESTILOS[tema];

  return (
    <div className={className}>
      {opciones.aceptaReservaMesa && (
        <BotonConsultar ranchoId={ranchoId} nombre={nombre} className={estilo.principal}>
          Reservar mesa
        </BotonConsultar>
      )}
      {opciones.aceptaPickup && (
        <BotonConsultar ranchoId={ranchoId} nombre={nombre} className={estilo.segundo}>
          Pedir para recoger
        </BotonConsultar>
      )}
      <BotonConsultar ranchoId={ranchoId} nombre={nombre} className={estilo.contorno}>
        Escribirle al restaurante
      </BotonConsultar>
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className={estilo.whatsapp}
        >
          <IconWhatsapp
            className={
              tema === "carta" ? "h-4 w-4 text-[#d9a86a]" : "h-4 w-4 text-aventurea-green"
            }
          />{" "}
          WhatsApp
        </a>
      )}
    </div>
  );
}
