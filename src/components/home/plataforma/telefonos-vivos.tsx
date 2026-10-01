"use client";

import type { ReactNode } from "react";
import Telefono from "@/components/telefono";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import { configPorDefecto } from "@/lib/lealtad/tipos-tarjeta";
import { Escenas } from "./piezas";
import { useSecuencia } from "./use-secuencia";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS TELÉFONOS DEL HOME, FUNCIONANDO — no posando
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «cada mockup debería estar
 * interactuando, funcionando… ~20 segundos recreando la función de
 * cada cosa… Algo profesional.»
 *
 * Cada teléfono es un GUION que se reproduce solo y rebobina, con la
 * maquinaria ya auditada del repo:
 *
 *   · `useSecuencia`  — pasos con esperas, loop, IntersectionObserver
 *                       (no corre fuera de pantalla) y
 *                       `prefers-reduced-motion` (muestra el final,
 *                       quieto — por eso la ÚLTIMA escena de cada
 *                       guion es siempre la del remate del negocio).
 *   · `<Escenas>`     — sub-pantallas que se cruzan en fundido con
 *                       alto fijo: la tarjeta nunca salta.
 *   · `.anim-entra` / `.anim-pop` — entradas cortas, con su bloque de
 *                       reduced-motion en globals.css.
 *
 * Los dos loops duran DISTINTO a propósito (≈15/16 s): si duraran
 * igual, la fila entraría en fase y se leería mecánica.
 *
 * ── LA REGLA DE SIEMPRE ─────────────────────────────────────────────
 * Solo se recrea lo que el producto hace: el pase se actualiza solo vía
 * Wallet y la reserva entra sin aprobación. Nombres, montos y horas son
 * datos de muestra dentro de pantallas — no cifras de rendimiento.
 *
 * ── FRONTERA "use client" ───────────────────────────────────────────
 * Este módulo exporta SOLO componentes (los teléfonos). Nada de
 * helpers exportados: esa mezcla ya rompió el build dos veces (ver la
 * memoria del repo sobre la frontera cliente↔servidor).
 */

/* Los colores del CONTENIDO demo (la app dibujada dentro del teléfono),
   los mismos que ya usaban los mockups estáticos de esta fila. No son
   UI del sitio: son la paleta del negocio de mentira. */
const AZUL = "#2447BF";
const TINTA = "#0F172A";

/** Una pantalla de teléfono: fondo blanco y aire para la barra de estado. */
function Pantalla({ children, fondo = "#fff" }: { children: ReactNode; fondo?: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden pt-[26px]" style={{ background: fondo }}>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   1 · PASES DE LEALTAD — el pase real sumando sellos, y el tablero
   ════════════════════════════════════════════════════════════════════

   E1  el pase de verdad (VistaPase, SIN tocarlo: solo cambia la prop
       `saldoEjemplo` 8→9→10) con el escaneo y la notificación encima
   E2  el tablero del negocio: «Listos para su recompensa»

   ⚠️ ZONA PROTEGIDA: `vista-pase.tsx` está en producción con clientes
   reales. Acá solo se le pasan props; el anillo del escaneo, el toast
   y la notificación son capas SUPERPUESTAS dibujadas afuera. */

const BASE_PASE = configPorDefecto("sellos");
const BENEFICIO: DatosVista["beneficio"] =
  BASE_PASE.tipo === "sellos" ? { ...BASE_PASE, recompensa: "Un café gratis" } : BASE_PASE;

export function VivoLealtad() {
  const { caja, visibles, corriendo } = useSecuencia({
    pasos: 8,
    esperas: [400, 2000, 1100, 1500, 1000, 1100, 2400, 1800],
    pausaFinal: 3000,
  });

  const escaneo1 = visibles === 2;
  const escaneo2 = visibles === 4;
  const saldo = visibles >= 5 ? 10 : visibles >= 3 ? 9 : 8;
  const notificacion = visibles >= 6;
  const entregado = visibles >= 8;
  const escena = visibles >= 7 ? 1 : 0;

  const escenaPase = (
    /* `items-end`: el conjunto del pase se apoya en el piso del
       escenario, como el teléfono de Reservas en su tarjeta. */
    <div className="relative flex h-full w-full items-end justify-center">
      <VistaPase
        datos={{
          negocioNombre: "Café Aroma",
          modo: "sellos",
          beneficio: BENEFICIO,
          colorFondo: "#1d1410",
          colorSello: "#e0a34a",
          logoUrl: null,
          iconoSello: "cafe",
          saldoEjemplo: saldo,
        }}
        superficie="clara"
        marco="telefono"
        anchoTelefono={208}
      />

      {/* El toast del sello nuevo, sobre la parte alta del pase. */}
      {(escaneo1 || escaneo2) && (
        <span className="anim-entra absolute left-1/2 top-[104px] z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[8.5px] font-extrabold shadow-[0_4px_14px_rgba(6,12,26,0.25)]" style={{ color: TINTA }}>
          {escaneo1 ? "En caja: te escanean el pase" : "Otra visita, otro sello"}
        </span>
      )}

      {/* El anillo del escáner, latiendo sobre la zona del QR. */}
      {(escaneo1 || escaneo2) && corriendo && (
        <span aria-hidden className="absolute bottom-[72px] left-1/2 z-10 -ml-[26px] h-[52px] w-[52px]">
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-[#e0a34a]" />
          <span className="absolute inset-[14px] rounded-full border-2 border-[#e0a34a]" />
        </span>
      )}

      {/* La notificación estilo Wallet cuando la tarjeta se completa. */}
      {notificacion && (
        <div className="anim-entra absolute inset-x-0 top-[64px] z-10 rounded-[12px] bg-white/95 px-2.5 py-2 shadow-[0_10px_24px_rgba(6,12,26,0.28)]">
          <p className="text-[8px] font-extrabold" style={{ color: TINTA }}>
            Café Aroma
          </p>
          <p className="text-[8px] text-[#475569]">¡Tarjeta completa! Canjeá: Un café gratis</p>
        </div>
      )}
    </div>
  );

  const escenaTablero = (
    <div className="flex h-full items-center justify-center px-2">
      <div className="w-full max-w-[230px] rounded-[14px] border border-[color:var(--linea)] bg-white p-3 shadow-[0_10px_30px_rgba(6,12,26,0.10)]">
        <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-[#64748b]">
          Panel de Lealtad · Café Aroma
        </p>
        <p className="mt-0.5 text-[11px] font-extrabold" style={{ color: TINTA }}>
          Listos para su recompensa
        </p>

        <div className="mt-2.5 rounded-[10px] border border-[#E2E8F0] px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-extrabold" style={{ color: TINTA }}>
              María J.
            </span>
            <span className="rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[7px] font-extrabold text-[#92400E]">
              10/10 · en la meta
            </span>
          </div>
          <p className="text-[8px] text-[#475569]">Un café gratis</p>
          <span
            className={`mt-1.5 block rounded-[8px] py-1.5 text-center text-[8.5px] font-extrabold transition-colors duration-300 ease-[var(--ease-bookea)] ${entregado ? "anim-pop" : ""}`}
            style={{ background: entregado ? "#DCFCE7" : TINTA, color: entregado ? "#166534" : "#fff" }}
          >
            {entregado ? "✓ Entregado — el pase vuelve a 0" : "Entregar y reiniciar"}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between rounded-[10px] border border-[#E2E8F0] px-2.5 py-2 opacity-45">
          <span className="text-[9.5px] font-extrabold" style={{ color: TINTA }}>
            Carlos M.
          </span>
          <span className="text-[8px] text-[#475569]">7/10</span>
        </div>
      </div>
    </div>
  );

  return (
    /* ⚠️ Ancho EXPLÍCITO: dentro del flex de la tarjeta, un contenedor
       cuyo único contenido es absoluto colapsa a 0 px y aplasta el pase
       (pasó en la primera pasada: la notificación salía como una tira
       vertical). 216 px: el marco de VistaPase a 208 —su PISO documentado; mas chico, el pase se sale por abajo— mas su aire. */
    <div ref={caja} className="w-[216px]">
      <Escenas alto={528} activa={escena} escenas={[escenaPase, escenaTablero]} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   2 · RESERVAS — buscar, reservar al instante y la agenda del negocio
   ════════════════════════════════════════════════════════════════════

   E1  la clienta busca «uñas» en el directorio y elige Glow Nails
   E2  la ficha: servicio ya elegido, la hora, y el «Reservado ✓»
   E3  la agenda del negocio: la cita entra sola, marcada «Nueva» */

export function VivoMarketplace() {
  const { caja, visibles, corriendo } = useSecuencia({
    pasos: 10,
    esperas: [400, 1400, 700, 800, 1200, 1300, 1100, 1600, 1000, 1500],
    pausaFinal: 3000,
  });

  const texto = visibles >= 3 ? "uñas" : visibles >= 2 ? "uñ" : "";
  const filtrado = visibles >= 4;
  const hora = visibles >= 6;
  const reservado = visibles >= 7;
  const cita = visibles >= 9;
  const badge = visibles >= 10;
  const escena = visibles >= 8 ? 2 : visibles >= 5 ? 1 : 0;

  const escenaBusqueda = (
    <Pantalla>
      <div className="px-2.5">
        <p className="text-[10.5px] font-extrabold" style={{ color: TINTA }}>
          ¿Qué querés reservar?
        </p>
        <div className="mt-1.5 flex items-center rounded-full border border-[#E2E8F0] px-2.5 py-1.5">
          {texto ? (
            <span className="text-[8.5px] font-bold" style={{ color: TINTA }}>
              {texto}
            </span>
          ) : (
            <span className="text-[8px] text-[#94a3b8]">Uñas, barbería, spa…</span>
          )}
          {corriendo && !filtrado ? <span className="ml-0.5 h-2.5 w-px animate-pulse bg-[#0F172A]" /> : null}
        </div>
      </div>
      <div className="mt-2 space-y-1.5 px-2.5">
        <div
          className="overflow-hidden rounded-[9px] border transition-all duration-300 ease-[var(--ease-bookea)]"
          style={{
            borderColor: filtrado ? AZUL : "#E2E8F0",
            boxShadow: filtrado ? `0 0 0 1px ${AZUL}` : undefined,
          }}
        >
          <div className="h-9 bg-[#F1F5F9]" />
          <div className="px-2 py-1.5">
            <p className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
              Glow Nails
            </p>
            <p className="text-[7.5px] text-[#64748b]">Uñas · Heredia</p>
          </div>
        </div>
        <div className={`overflow-hidden rounded-[9px] border border-[#E2E8F0] transition-opacity duration-300 ease-[var(--ease-bookea)] ${filtrado ? "opacity-0" : ""}`}>
          <div className="h-9 bg-[#F1F5F9]" />
          <div className="px-2 py-1.5">
            <p className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
              Silence Barber
            </p>
            <p className="text-[7.5px] text-[#64748b]">Barbería · San José</p>
          </div>
        </div>
        <div className={`overflow-hidden rounded-[9px] border border-[#E2E8F0] transition-opacity duration-300 ease-[var(--ease-bookea)] ${filtrado ? "opacity-45" : ""}`}>
          <div className="h-9 bg-[#F1F5F9]" />
          <div className="px-2 py-1.5">
            <p className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
              Nail Room
            </p>
            <p className="text-[7.5px] text-[#64748b]">Uñas · San José</p>
          </div>
        </div>
      </div>
    </Pantalla>
  );

  const escenaReserva = (
    <Pantalla>
      <div className="px-2.5">
        <p className="text-[10.5px] font-extrabold" style={{ color: TINTA }}>
          Glow Nails
        </p>
        <p className="text-[7.5px] text-[#64748b]">Uñas · Heredia</p>
      </div>
      <div className="mt-2 space-y-1.5 px-2.5">
        <div className="rounded-[9px] bg-[#EEF2FE] px-2.5 py-2" style={{ boxShadow: `inset 0 0 0 1px ${AZUL}` }}>
          <p className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
            Uñas acrílicas
          </p>
          <p className="text-[7.5px] text-[#475569]">60 min · ₡12.000</p>
        </div>
        {hora ? (
          <div className="anim-entra flex gap-1">
            {["2:00", "3:00", "4:30"].map((h) => (
              <span
                key={h}
                className="flex-1 rounded-[7px] py-1.5 text-center text-[8.5px] font-extrabold transition-all duration-300 ease-[var(--ease-bookea)]"
                style={{
                  background: h === "3:00" ? AZUL : "#F1F5F9",
                  color: h === "3:00" ? "#fff" : "#94a3b8",
                }}
              >
                {h}
              </span>
            ))}
          </div>
        ) : null}
        {reservado ? (
          <div className="anim-entra flex items-center gap-1.5 rounded-[9px] bg-[#DCFCE7] px-2.5 py-2">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-[8px] font-extrabold text-white">
              ✓
            </span>
            <span className="text-[8px] font-extrabold text-[#166534]">
              Reservado al instante — sin aprobación
            </span>
          </div>
        ) : null}
      </div>
    </Pantalla>
  );

  const escenaAgenda = (
    <Pantalla fondo="#F6F6F4">
      <div className="px-3 pb-1.5">
        <p className="text-[10px] font-extrabold" style={{ color: TINTA }}>
          Agenda — Glow Nails
        </p>
        <p className="text-[7.5px] text-[#64748b]">Viernes</p>
      </div>
      <ul className="space-y-1.5 px-3">
        <li className="rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-1.5 opacity-45">
          <p className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
            10:00 · Ana S. — Manicure
          </p>
        </li>
        {cita ? (
          <li className="anim-entra flex items-center gap-2 rounded-[9px] border bg-white px-2.5 py-2" style={{ borderColor: AZUL }}>
            <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: AZUL }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[8.5px] font-extrabold" style={{ color: TINTA }}>
                3:00 · Laura P. — Uñas acrílicas
              </span>
              <span className="block text-[7.5px] text-[#64748b]">Te encontró en Bookea</span>
            </span>
            {badge ? (
              <span className={`anim-pop shrink-0 rounded-full px-1.5 py-0.5 text-[6.5px] font-extrabold uppercase text-white ${corriendo ? "animate-pulse" : ""}`} style={{ background: AZUL }}>
                Nueva
              </span>
            ) : null}
          </li>
        ) : null}
        <li className="rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-1.5 opacity-45">
          <p className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
            5:00 · Sofía R. — Uñas gel
          </p>
        </li>
      </ul>
    </Pantalla>
  );

  return (
    <div ref={caja}>
      <Telefono ancho={200} tinta={TINTA}>
        <Escenas alto={410} activa={escena} escenas={[escenaBusqueda, escenaReserva, escenaAgenda]} />
      </Telefono>
    </div>
  );
}
