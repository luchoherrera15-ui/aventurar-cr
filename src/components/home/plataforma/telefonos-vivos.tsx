"use client";

import type { ReactNode } from "react";
import Telefono from "@/components/solutions/telefono";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import { configPorDefecto } from "@/lib/lealtad/tipos-tarjeta";
import { IconInstagram } from "@/components/icons";
import { fmtMoneda } from "@/lib/monedas";
import { Escenas } from "./piezas";
import { useSecuencia } from "./use-secuencia";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS CUATRO TELÉFONOS DEL HOME, FUNCIONANDO — no posando
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «cada mockup debería estar
 * interactuando, funcionando… ~20 segundos recreando la función de
 * cada cosa. Por ejemplo pedidos: alguien entra, ve el link hub, entra
 * al menú, pide, y luego se ve que el mensaje llega a la plataforma y
 * por WhatsApp. Algo profesional.»
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
 * Los cuatro loops duran DISTINTO a propósito (≈18/15/15/16 s): si
 * duraran igual, la fila entraría en fase y se leería mecánica.
 *
 * ── LA REGLA DE SIEMPRE ─────────────────────────────────────────────
 * Solo se recrea lo que el producto hace: el pedido queda en el panel
 * Y le llega al negocio por WhatsApp ya escrito (pero el CLIENTE nunca
 * ve esa palabra al pedir); el pase se actualiza solo vía Wallet; la
 * automatización es SOLO Instagram; la reserva entra sin aprobación.
 * Nombres, montos y horas son datos de muestra dentro de pantallas —
 * no cifras de rendimiento.
 *
 * ── FRONTERA "use client" ───────────────────────────────────────────
 * Este módulo exporta SOLO componentes (los cuatro teléfonos). Nada de
 * helpers exportados: esa mezcla ya rompió el build dos veces (ver la
 * memoria del repo sobre la frontera cliente↔servidor).
 */

/* Los colores del CONTENIDO demo (la app dibujada dentro del teléfono),
   los mismos que ya usaban los mockups estáticos de esta fila. No son
   UI del sitio: son la paleta del negocio de mentira. */
const AZUL = "#2447BF";
const TINTA = "#0F172A";
const VERDE_HUB = "linear-gradient(135deg,#1f3d2b 0%,#4a7c59 55%,#8fb996 100%)";

/** Los tres puntitos del «escribiendo…». */
function Escribiendo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex w-fit items-center gap-1 rounded-[10px] px-2.5 py-2 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 animate-pulse rounded-full bg-[#667781]"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

/** Una pantalla de teléfono: fondo blanco y aire para la barra de estado. */
function Pantalla({ children, fondo = "#fff" }: { children: ReactNode; fondo?: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden pt-[26px]" style={{ background: fondo }}>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   1 · TU PÁGINA — del QR de la mesa al pedido en el panel y el WhatsApp
   ════════════════════════════════════════════════════════════════════

   E1  el link hub (el cliente entró por el link del negocio)
   E2  el menú: elige, personaliza, la barra suma, envía (recoger)
   E3  el negocio: la comanda cae al panel y el mensaje llega armado

   ⚠️ El pedido de la demo es PARA RECOGER a propósito: el producto
   manda por WhatsApp los pedidos To go/Exprés; los de mesa caen SOLO
   al panel (textoDelPedido excluye "mesa" por tipo).

   El cliente jamás lee «WhatsApp»; esa palabra existe solo en la
   pantalla del NEGOCIO — que es el canal real de entrega. */

const PEDIDO = {
  matcha: 3200,
  extra: 600,
  cheesecake: 2800,
};
/** ⚠️ El total aparece en la barra, la comanda y el mensaje: UNA fuente. */
const TOTAL_PEDIDO = PEDIDO.matcha + PEDIDO.extra + PEDIDO.cheesecake; // ₡6.600
/** El MISMO formato que el producto (fmtMoneda, es-CR): la demo no
    puede enseñar un separador de miles que /s/ nunca pinta. */
const CRC = (n: number) => fmtMoneda(n, "CRC");

export function VivoPagina() {
  const { caja, visibles, corriendo } = useSecuencia({
    pasos: 11,
    esperas: [400, 1800, 1100, 1200, 1000, 1200, 1000, 1200, 1600, 2200, 800],
    pausaFinal: 3600,
  });

  const tap = visibles >= 2;
  const matcha = visibles >= 4;
  const extra = visibles >= 5;
  const cheese = visibles >= 6;
  // La barra aparece con el PRIMER item y va sumando, como el producto
  // real: dos platos elegidos con un pie que dice "vacio" era un estado
  // imposible en camara.
  const barra = visibles >= 4;
  const enviado = visibles >= 8;
  const comanda = visibles >= 9;
  const escribiendoWa = visibles >= 10;
  const burbujaWa = visibles >= 11;
  const escena = visibles >= 9 ? 2 : visibles >= 3 ? 1 : 0;

  const cantidad = (matcha ? 1 : 0) + (cheese ? 1 : 0);
  const monto = (matcha ? PEDIDO.matcha : 0) + (extra ? PEDIDO.extra : 0) + (cheese ? PEDIDO.cheesecake : 0);

  const escenaHub = (
    <Pantalla>
      {/* Siempre montado: durante el hueco del rebobinado la escena 0
          ya se ve (como en las otras tres demos), sin telefono blanco. */}
      {(
        <div className="flex h-full flex-col">
          <div className="relative h-[52px] shrink-0 rounded-b-[14px]" style={{ background: VERDE_HUB }}>
          </div>
          <div className="flex flex-col items-center px-3 pt-2 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold text-white ring-2 ring-white" style={{ backgroundColor: AZUL }}>
              C
            </span>
            <p className="mt-1 text-[11px] font-extrabold" style={{ color: TINTA }}>
              Casa Matcha
            </p>
            <p className="text-[6.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: AZUL }}>
              Cafetería · Escazú
            </p>
            <div className="mt-3 flex w-full flex-col gap-1.5">
              {["Pedir", "Reservar", "Contacto"].map((b) => {
                const esPedir = b === "Pedir";
                const elegido = tap && esPedir;
                const apagado = tap && !esPedir;
                return (
                  <span
                    key={b}
                    className={`rounded-[8px] py-2 text-[9px] font-extrabold transition-all duration-300 ease-[var(--ease-bookea)] ${elegido ? "anim-pop text-white" : ""}`}
                    style={{
                      background: elegido ? AZUL : "#F4F6FB",
                      color: elegido ? "#fff" : TINTA,
                      opacity: apagado ? 0.35 : 1,
                      boxShadow: elegido ? `0 0 0 2px #fff, 0 0 0 3.5px ${AZUL}` : undefined,
                    }}
                  >
                    {b}
                  </span>
                );
              })}
            </div>
            {/* El hub real es SOLO links (9 sep 2026): nada de platos
                con precio aca — eso vive en la pagina del menu. */}
            <div className="mt-3 w-full space-y-1 opacity-60">
              {["Plan de lealtad", "Cómo llegar"].map((n) => (
                <div key={n} className="flex items-center justify-between rounded-[8px] bg-[#F8FAFC] px-2 py-1.5">
                  <span className="text-[8px] font-extrabold" style={{ color: TINTA }}>
                    {n}
                  </span>
                  <span aria-hidden className="text-[8px] text-[#94a3b8]">›</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[7px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">
              bookea.lat/s/casa-matcha
            </p>
          </div>
        </div>
      )}
    </Pantalla>
  );

  const filaPlato = (nombre: string, precio: number, elegido: boolean, apagado: boolean, hijo?: ReactNode) => (
    <div className={`transition-opacity duration-300 ease-[var(--ease-bookea)] ${apagado ? "opacity-40" : ""}`}>
      <div
        className="flex items-center gap-2 rounded-[9px] px-2 py-1.5 transition-all duration-300 ease-[var(--ease-bookea)]"
        style={{ background: elegido ? "#EEF2FE" : "#F8FAFC", boxShadow: elegido ? `inset 0 0 0 1px ${AZUL}` : undefined }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[9px] font-extrabold" style={{ color: TINTA }}>
            {nombre}
          </span>
          <span className="block text-[8px] font-bold" style={{ color: AZUL }}>
            {CRC(precio)}
          </span>
        </span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold transition-all duration-300 ease-[var(--ease-bookea)] ${elegido ? "anim-pop text-white" : ""}`}
          style={{ background: elegido ? AZUL : "#E2E8F0", color: elegido ? "#fff" : TINTA }}
        >
          {elegido ? "1" : "+"}
        </span>
      </div>
      {hijo}
    </div>
  );

  const escenaMenu = (
    <Pantalla>
      <div className="flex items-center justify-between px-3 pb-1.5">
        <span className="text-[10px] font-extrabold" style={{ color: TINTA }}>
          El menú
        </span>
        <span className="rounded-full px-1.5 py-0.5 text-[7px] font-extrabold text-white" style={{ background: AZUL }}>
          Para recoger
        </span>
      </div>
      <div className="flex-1 space-y-1.5 px-3">
        {filaPlato(
          "Matcha latte",
          PEDIDO.matcha,
          matcha,
          false,
          extra ? (
            <p className="anim-entra ml-2 mt-1 w-fit rounded-full bg-[#EEF2FE] px-2 py-0.5 text-[7.5px] font-bold" style={{ color: AZUL }}>
              ✓ Leche de almendras +{CRC(PEDIDO.extra)}
            </p>
          ) : null,
        )}
        {filaPlato("Cheesecake", PEDIDO.cheesecake, cheese, matcha && !cheese)}
        {filaPlato("Galleta", 1400, false, matcha)}
      </div>
      <div className="p-2.5">
        {barra ? (
          <div
            className="anim-entra flex items-center justify-between rounded-[9px] px-2.5 py-2 transition-colors duration-300 ease-[var(--ease-bookea)]"
            style={{ background: enviado ? "#16a34a" : AZUL }}
          >
            <span className="text-[8.5px] font-extrabold text-white">
              {enviado ? "✓ Pedido enviado — para recoger" : `Ver pedido · ${cantidad}`}
            </span>
            {!enviado ? <span className="text-[8.5px] font-extrabold text-white">{CRC(monto)}</span> : null}
          </div>
        ) : (
          <div className="rounded-[9px] bg-[#F1F5F9] px-2.5 py-2 text-center text-[8px] font-bold text-[#94a3b8]">
            Tu pedido está vacío
          </div>
        )}
      </div>
    </Pantalla>
  );

  const escenaNegocio = (
    <Pantalla fondo="#F6F6F4">
      <div className="flex items-center justify-between px-3 pb-1.5">
        <span className="text-[10px] font-extrabold" style={{ color: TINTA }}>
          Casa Matcha · Comandas
        </span>
        <span className="text-[7.5px] font-bold text-[#64748b]">Hoy</span>
      </div>
      <div className="flex-1 space-y-1.5 px-3">
        <div className="rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-1.5 opacity-40">
          <p className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
            Mesa 2 · pagada
          </p>
        </div>
        {comanda ? (
          <div className="anim-entra rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-extrabold" style={{ color: TINTA }}>
                María J. · recoger · ahora
              </p>
              <span className={`rounded-full px-1.5 py-0.5 text-[6.5px] font-extrabold uppercase text-white ${corriendo ? "animate-pulse" : ""}`} style={{ background: AZUL }}>
                Nueva
              </span>
            </div>
            <p className="mt-1 text-[8px] text-[#475569]">1× Matcha latte — almendras</p>
            <p className="text-[8px] text-[#475569]">1× Cheesecake</p>
            <p className="mt-0.5 text-[8.5px] font-extrabold" style={{ color: TINTA }}>
              Total {CRC(TOTAL_PEDIDO)}
            </p>
          </div>
        ) : null}
        {escribiendoWa ? (
          <div className="anim-entra">
            <p className="mb-1 text-[7px] font-extrabold uppercase tracking-[0.1em] text-[#64748b]">
              Y en tu WhatsApp, ya escrito
            </p>
            {burbujaWa ? (
              /* Burbuja ENTRANTE (blanca, sin doble check): el mensaje lo
                 manda el CLIENTE desde su wa.me; el negocio lo recibe. */
              <div className="anim-entra rounded-[9px] rounded-tl-[3px] border border-[#E2E8F0] bg-white px-2.5 py-2">
                <p className="text-[8px] font-extrabold text-[#111B21]">Pedido · para recoger</p>
                <p className="text-[8px] text-[#111B21]">María J. · 8871-0000</p>
                <p className="text-[8px] text-[#111B21]">1× Matcha latte · almendras</p>
                <p className="text-[8px] text-[#111B21]">1× Cheesecake</p>
                <p className="text-[8px] font-extrabold text-[#111B21]">Total: {CRC(TOTAL_PEDIDO)}</p>
                <p className="mt-0.5 text-right text-[7px] text-[#667781]">11:42</p>
              </div>
            ) : corriendo ? (
              <Escribiendo className="border border-[#E2E8F0] bg-white" />
            ) : null}
          </div>
        ) : null}
      </div>
    </Pantalla>
  );

  return (
    <div ref={caja}>
      <Telefono ancho={200} tinta={TINTA}>
        <Escenas alto={410} activa={escena} escenas={[escenaHub, escenaMenu, escenaNegocio]} />
      </Telefono>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   2 · PASES DE LEALTAD — el pase real sumando sellos, y el tablero
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
       escenario, como los otros tres teléfonos en su tarjeta. */
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
   3 · AUTOMATIZACIONES — el comentario, el DM y el registro en tu panel
   ════════════════════════════════════════════════════════════════════

   E1  la publicación: comentan la palabra clave, se contesta en público
   E2  el privado de María: el DM con el link (burbuja NEUTRA — es
       Instagram, no WhatsApp: no se insinúa un canal que no existe)
   E3  el panel del negocio: la regla activa y el registro del envío */

export function VivoInstagram() {
  const { caja, visibles, corriendo } = useSecuencia({
    pasos: 9,
    esperas: [400, 1500, 1500, 900, 1900, 900, 2300, 1300, 1400],
    pausaFinal: 2800,
  });

  const comentario = visibles >= 2;
  const puntitos = visibles >= 3;
  const publica = visibles >= 4;
  const dm = visibles >= 6;
  const registro = visibles >= 8;
  const remate = visibles >= 9;
  const escena = visibles >= 7 ? 2 : visibles >= 5 ? 1 : 0;

  const cabecera = (titulo: string, bajada: string) => (
    <div className="flex items-center gap-1.5 border-b border-[#E2E8F0] px-2.5 py-2">
      <IconInstagram className="h-3.5 w-3.5 shrink-0 text-[#C13584]" />
      <span className="min-w-0">
        <span className="block truncate text-[9px] font-extrabold" style={{ color: TINTA }}>
          {titulo}
        </span>
        <span className="block truncate text-[7px] text-[#64748b]">{bajada}</span>
      </span>
    </div>
  );

  const escenaPost = (
    <Pantalla>
      {cabecera("casamatcha", "Tu publicación")}
      <div className="mx-2.5 mt-2 h-[118px] shrink-0 rounded-[8px] bg-[#F1F5F9]" />
      <p className="px-2.5 pt-1.5 text-[7.5px] text-[#475569]">
        <span className="font-extrabold" style={{ color: TINTA }}>casamatcha</span> Nuevos postres de temporada
      </p>
      <div className="space-y-1.5 px-2.5 py-2">
        <p className="text-[7px] font-extrabold uppercase tracking-[0.1em] text-[#64748b]">Comentarios</p>
        {comentario ? (
          <div className="anim-entra rounded-[8px] bg-[#F8FAFC] px-2 py-1.5">
            <p className="text-[8.5px]" style={{ color: TINTA }}>
              <span className="font-extrabold">maria.j</span> ¿Aún hay?{" "}
              <span className="font-extrabold" style={{ color: AZUL }}>
                MENÚ
              </span>
            </p>
          </div>
        ) : null}
        {publica ? (
          <div className="anim-entra ml-3 border-l-2 border-[#E2E8F0] pl-2">
            <div className="rounded-[8px] bg-[#F8FAFC] px-2 py-1.5">
              <p className="text-[8.5px]" style={{ color: TINTA }}>
                <span className="font-extrabold">casamatcha</span> ¡Hola María! Te lo mandamos por privado
              </p>
            </div>
            <p className="mt-0.5 text-[6.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
              Respuesta automática
            </p>
          </div>
        ) : puntitos && corriendo ? (
          <Escribiendo className="ml-3 bg-[#F1F5F9]" />
        ) : null}
      </div>
    </Pantalla>
  );

  const escenaDm = (
    <Pantalla>
      {cabecera("maria.j", "Mensajes directos")}
      <div className="flex flex-1 flex-col justify-end px-2.5 pb-2.5">
        {dm ? (
          <div className="anim-entra ml-auto max-w-[92%] rounded-[10px] rounded-tr-[3px] bg-[#EEF2FE] px-2.5 py-2">
            <p className="text-[8.5px] leading-snug" style={{ color: TINTA }}>
              ¡Hola! Acá está nuestro menú y podés pedir:
            </p>
            <p className="text-[8.5px] font-bold" style={{ color: AZUL }}>
              bookea.lat/s/casa-matcha
            </p>
            <p className="mt-0.5 text-right text-[7px] text-[#94a3b8]">Visto · 11:58</p>
          </div>
        ) : visibles >= 5 && corriendo ? (
          /* Solo cuando SU escena esta a la vista y la secuencia corre:
             un pulse infinito dentro de una capa a opacity 0 es trabajo
             de compositor que nadie ve. */
          <Escribiendo className="ml-auto bg-[#F1F5F9]" />
        ) : null}
      </div>
    </Pantalla>
  );

  const escenaPanel = (
    <Pantalla fondo="#F6F6F4">
      <div className="px-3 pb-1.5">
        <p className="text-[10px] font-extrabold" style={{ color: TINTA }}>
          Automatización · Instagram
        </p>
      </div>
      <div className="space-y-1.5 px-3">
        <div className="rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] font-extrabold" style={{ color: TINTA }}>
              Palabra clave: MENÚ
            </span>
            {/* El interruptor: prendido, como la regla real. */}
            <span className="flex h-3.5 w-6 items-center rounded-full bg-[#16a34a] px-0.5">
              <span className="ml-auto h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          </div>
          <p className="mt-0.5 text-[7.5px] text-[#475569]">Contestar en público + mandar el link por DM</p>
        </div>
        {registro ? (
          <div className="anim-entra flex items-center gap-1.5 rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#16a34a] ${corriendo ? "animate-pulse" : ""}`} />
            <span className="min-w-0 flex-1 truncate text-[8px]" style={{ color: TINTA }}>
              <span className="font-extrabold">maria.j</span> — público + DM · ahora
            </span>
          </div>
        ) : null}
        {remate ? (
          <p className="anim-entra pt-1 text-center text-[8.5px] font-extrabold" style={{ color: TINTA }}>
            Vos: sin tocar el teléfono
          </p>
        ) : null}
      </div>
    </Pantalla>
  );

  return (
    <div ref={caja}>
      <Telefono ancho={200} tinta={TINTA}>
        <Escenas alto={410} activa={escena} escenas={[escenaPost, escenaDm, escenaPanel]} />
      </Telefono>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   4 · RESERVAS — buscar, reservar al instante y la agenda del negocio
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
