import type { ComponentType } from "react";
import {
  IconChartBars,
  IconClipboard,
  IconCloche,
  IconEnlace,
  IconGear,
  IconHome,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { fmtMoneda } from "@/lib/monedas";
import { Encabezado, Escenario, Marco, NotaDemo, Seccion } from "./piezas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  UN PANEL — el escritorio del negocio, con su menú a la izquierda
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «que tengamos un menú tipo CRM, que a
 * la izquierda tengamos las opciones: pedidos y ahí ver las comandas,
 * métricas, los mejores clientes, que todo esté sincronizado… es
 * unificar el producto».
 *
 * Esta sección enseña ESA idea: una pantalla de escritorio —no un
 * teléfono— con el menú lateral y las comandas entrando. Es la única
 * sección del home que muestra el lado del DUEÑO; todas las demás
 * muestran lo que ve su cliente.
 *
 * ── QUÉ SE DIBUJA Y QUÉ NO ──────────────────────────────────────────
 * El menú dibujado lleva lo que el panel REAL tiene hoy
 * (`/solutions/panel/[id]` + Lealtad): Inicio, Pedidos, Mi página,
 * Menú, Lealtad, Clientes, Estadísticas y Ajustes. «Clientes» y
 * «Estadísticas» existen del lado de Lealtad (miembros y
 * estadisticas-lealtad); la cáscara ÚNICA que los junte con la agenda
 * es la fase 2 de `docs/bookea-producto.md` §7 — cuando exista, este
 * mockup ni se entera, porque ya dice lo mismo.
 *
 * Los números de la demo son datos de muestra y la nota al pie lo dice,
 * como en todas las demos del home.
 */

type Item = { nombre: string; Icono: ComponentType<{ className?: string }>; activo?: boolean };

const MENU: Item[] = [
  { nombre: "Inicio", Icono: IconHome },
  { nombre: "Pedidos", Icono: IconClipboard, activo: true },
  { nombre: "Mi página", Icono: IconEnlace },
  { nombre: "Menú", Icono: IconCloche },
  { nombre: "Lealtad", Icono: IconWallet },
  { nombre: "Clientes", Icono: IconUsers },
  { nombre: "Estadísticas", Icono: IconChartBars },
  { nombre: "Ajustes", Icono: IconGear },
];

const COMANDAS = [
  {
    codigo: "B-214",
    detalle: "2× Casado con pollo · 1× Fresco de cas",
    cliente: "María J. · exprés",
    total: fmtMoneda(9400, "CRC"),
    estado: "Nuevo",
    tono: "bg-[color:var(--acento)] text-white",
  },
  {
    codigo: "B-213",
    detalle: "1× Chifrijo · sin cebolla",
    cliente: "Mesa 4",
    total: fmtMoneda(4500, "CRC"),
    estado: "En cocina",
    tono: "bg-[color:var(--superficie-2)] text-[color:var(--tinta)]",
  },
  {
    codigo: "B-212",
    detalle: "3× Café chorreado · 2× Prestiño",
    cliente: "Carlos S. · recoger",
    total: fmtMoneda(6100, "CRC"),
    estado: "Listo",
    tono: "bg-[color:var(--ok-suave)] text-[color:var(--ok)]",
  },
] as const;

export default function UnPanel() {
  return (
    <Seccion id="panel">
      <Encabezado rotulo="Tu panel" titulo="Un panel. Todo sincronizado.">
        El que escanea tu QR, pide y suma sellos es un solo cliente en tu
        sistema — no tres chats sueltos.
      </Encabezado>

      <Escenario ancho="amplio">
        <Marco>
          <div className="flex">
            {/* ── El menú lateral: la idea entera de la sección ──── */}
            <aside className="hidden w-[190px] shrink-0 border-r border-[color:var(--linea)] bg-[color:var(--papel)] px-3 py-4 sm:block">
              <p className="px-2 text-[13px] font-extrabold text-[color:var(--tinta)]">
                Soda La Esquina
              </p>
              <p className="px-2 text-[10.5px] text-[color:var(--tinta-tenue)]">
                bookea.lat/s/la-esquina
              </p>
              <ul className="mt-4 space-y-0.5">
                {MENU.map(({ nombre, Icono, activo }) => (
                  <li
                    key={nombre}
                    className={`flex items-center gap-2.5 rounded-[10px] px-2 py-[7px] text-[12.5px] font-bold ${
                      activo
                        ? "bg-[color:var(--superficie-2)] text-[color:var(--tinta)]"
                        : "text-[color:var(--tinta-suave)]"
                    }`}
                  >
                    <Icono className="h-[15px] w-[15px]" />
                    {nombre}
                    {nombre === "Pedidos" && (
                      <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--acento)] px-1 text-[10px] font-extrabold text-white">
                        2
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </aside>

            {/* ── Las comandas entrando ──────────────────────────── */}
            <div className="min-w-0 flex-1 bg-[color:var(--superficie)] p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-extrabold text-[color:var(--tinta)]">
                  Pedidos de hoy
                </p>
                <p className="text-[11.5px] text-[color:var(--tinta-suave)]">
                  martes, 2:40 p. m.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {[
                  ["14", "pedidos"],
                  [fmtMoneda(86200, "CRC"), "vendido"],
                  ["6", "clientes que vuelven"],
                ].map(([n, r]) => (
                  <div
                    key={r}
                    className="rounded-[12px] border border-[color:var(--linea)] bg-[color:var(--papel)] px-3 py-2.5"
                  >
                    <p className="text-[16px] font-extrabold leading-none text-[color:var(--tinta)] sm:text-[18px]">
                      {n}
                    </p>
                    <p className="mt-1 truncate text-[10.5px] text-[color:var(--tinta-suave)]">
                      {r}
                    </p>
                  </div>
                ))}
              </div>

              <ul className="mt-3 space-y-2">
                {COMANDAS.map((c) => (
                  <li
                    key={c.codigo}
                    className="flex items-center gap-3 rounded-[12px] border border-[color:var(--linea)] bg-[color:var(--papel)] px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-extrabold text-[color:var(--tinta)]">
                        {c.codigo} · {c.detalle}
                      </p>
                      <p className="truncate text-[11px] text-[color:var(--tinta-suave)]">
                        {c.cliente}
                      </p>
                    </div>
                    <p className="text-[12.5px] font-extrabold text-[color:var(--tinta)]">
                      {c.total}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${c.tono}`}
                    >
                      {c.estado}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Marco>
        <NotaDemo>
          Ejemplo con datos de muestra. El pedido queda acá y además te
          llega al teléfono, ya escrito y ordenado.
        </NotaDemo>
      </Escenario>
    </Seccion>
  );
}
