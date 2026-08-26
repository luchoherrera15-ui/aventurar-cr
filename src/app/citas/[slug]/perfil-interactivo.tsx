"use client";

import { useState } from "react";
import type { HorarioSemana } from "../tipos";
import ReservarCita, {
  ReservarCitaModal,
  type DatosAgendaPro,
  type ResumenNegocio,
} from "./reservar/reservar-cita";
import ServicesSection from "./services-section";
import TeamSection from "./team-section";
import PortfolioGallery from "./portfolio-gallery";
import ReviewsSummary from "./reviews-summary";
import ReviewsList from "./reviews-list";
import MobileBookingBar from "./mobile-booking-bar";
import BookingBottomSheet from "./booking-bottom-sheet";
import type {
  FotoPortfolio,
  ProfesionalPerfil,
  ResenaPerfil,
  ResumenResenas,
  ServicioPerfil,
} from "./perfil-tipos";

type Miembro = { id: string; nombre: string; rol: string | null; foto_url: string | null };

type AgendaBase = {
  ranchoId: string;
  rutaBase: string;
  nombreNegocio: string;
  items: ServicioPerfil[];
  ordenSecciones?: string[];
  equipo: Miembro[];
  horario: HorarioSemana | null;
  agendaPro: DatosAgendaPro;
  sesionActiva: boolean;
  nombreInicial: string;
  resumen: ResumenNegocio;
};

/**
 * EL PEGAMENTO INTERACTIVO del perfil rediseñado.
 *
 * page.tsx es un server component: no puede sostener el estado de
 * "qué servicio/profesional se eligió" que Servicios, Equipo y las dos
 * formas de reservar (el modal de siempre + la hoja inferior de móvil)
 * necesitan compartir. Esta es la ÚNICA pieza que sí lo hace — todo lo
 * que no necesita ese estado compartido (galería, encabezado,
 * ubicación...) se sigue renderizando directo desde la página.
 *
 * El motor de reservas (ReservarCita/ReservarCitaModal) no se toca: se
 * monta DOS veces, exactamente como hoy hace la página con
 * AgendaNegocio + EquipoNegocio + TarjetaReservaSticky por separado —
 * una vez como el modal de siempre (todo click de "Reservar"/"Ver
 * disponibilidad" en Servicios y Equipo) y otra vez, sin servicio
 * preelegido, dentro de la hoja inferior que abre la barra fija de
 * móvil.
 */
export default function PerfilInteractivo({
  agenda,
  profesionales,
  resumenResenas,
  resenas,
  fotosPortfolio,
}: {
  agenda: AgendaBase;
  profesionales: ProfesionalPerfil[];
  resumenResenas: ResumenResenas;
  resenas: ResenaPerfil[];
  fotosPortfolio: FotoPortfolio[];
}) {
  const [abierta, setAbierta] = useState(false);
  const [servicioElegido, setServicioElegido] = useState<string | null>(null);
  const [miembroElegido, setMiembroElegido] = useState<string | null>(null);
  const [sheetAbierta, setSheetAbierta] = useState(false);

  function onReservar(servicioId: string | null, miembroId: string | null) {
    setServicioElegido(servicioId);
    setMiembroElegido(miembroId);
    setAbierta(true);
  }

  return (
    <>
      <ServicesSection
        items={agenda.items}
        ordenSecciones={agenda.ordenSecciones}
        onReservar={onReservar}
      />

      {profesionales.length > 0 && (
        <div id="equipo" className="scroll-mt-24">
          {/* Las reseñas COMPLETAS bajan acá: la ficha de cada
              profesional en móvil filtra las suyas por id. No se
              filtran antes porque la sección ya recibe al equipo entero
              y hacerlo una vez por persona en el servidor sería el
              mismo recorrido, repetido. */}
          <TeamSection
            equipo={profesionales}
            resenas={resenas}
            onReservar={onReservar}
          />
        </div>
      )}

      {fotosPortfolio.length > 0 && (
        <div id="portfolio" className="scroll-mt-24">
          <PortfolioGallery fotos={fotosPortfolio} />
        </div>
      )}

      <div id="resenas" className="mt-9 scroll-mt-24">
        <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">
          Reseñas
        </h2>
        <div className="mt-3">
          <ReviewsSummary resumen={resumenResenas} />
        </div>
        {resenas.length > 0 && (
          <div className="mt-5">
            <ReviewsList resenas={resenas} />
          </div>
        )}
      </div>

      <ReservarCitaModal
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        ranchoId={agenda.ranchoId}
        rutaBase={agenda.rutaBase}
        nombreNegocio={agenda.nombreNegocio}
        items={agenda.items}
        ordenSecciones={agenda.ordenSecciones}
        equipo={agenda.equipo}
        horario={agenda.horario}
        {...agenda.agendaPro}
        sesionActiva={agenda.sesionActiva}
        nombreInicial={agenda.nombreInicial}
        servicioInicial={servicioElegido}
        miembroInicial={miembroElegido}
        resumen={agenda.resumen}
      />

      {/* ---------- Móvil: barra fija + hoja inferior ----------
          Entrada adicional, no un reemplazo: los botones "Reservar" de
          arriba siguen abriendo el modal de siempre (ya sirve bien en
          móvil, es lo que usa hoy toda la página). Esto es la puerta
          rápida y siempre a mano que pide el diseño — sin servicio
          preelegido, porque nace de la barra, no de una tarjeta. */}
      <MobileBookingBar servicios={agenda.items} onAbrir={() => setSheetAbierta(true)} />
      <BookingBottomSheet
        abierto={sheetAbierta}
        onCerrar={() => setSheetAbierta(false)}
        titulo="Reservar"
      >
        <ReservarCita
          ranchoId={agenda.ranchoId}
          rutaBase={agenda.rutaBase}
          nombreNegocio={agenda.nombreNegocio}
          items={agenda.items}
          ordenSecciones={agenda.ordenSecciones}
          equipo={agenda.equipo}
          horario={agenda.horario}
          {...agenda.agendaPro}
          sesionActiva={agenda.sesionActiva}
          nombreInicial={agenda.nombreInicial}
          servicioInicial={null}
          resumen={agenda.resumen}
          onVolverServicios={() => setSheetAbierta(false)}
        />
      </BookingBottomSheet>
    </>
  );
}
