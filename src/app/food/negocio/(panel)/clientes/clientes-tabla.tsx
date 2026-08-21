"use client";

import { useMemo, useState } from "react";
import { NotaEstimacion } from "@/components/food/panel";
import { IconSearch } from "@/components/icons";
import { ESTADO_MARCA, ESTADO_PILDORA } from "@/components/panel/sistema";
import { formatearCRC } from "@/lib/dinero";
import { fechaCorta } from "@/lib/food/tipos";
import type { ClienteDemo } from "@/lib/food/panel-demo";

/**
 * LA TABLA DE CLIENTES — componente cliente porque la búsqueda y el
 * orden son estado de interacción puro. Los datos llegan por props
 * desde la página (Server Component): panel-demo.ts solo se importa en
 * servidor; acá entra únicamente el TIPO ClienteDemo, que sí es válido
 * cruzando la frontera.
 *
 * La tabla tiene jerarquía a propósito (nombre en fuerte, números
 * tabulares a la derecha, píldora de tipo): la regla del panel prohíbe
 * tablas planas. En pantallas angostas scrollea horizontal DENTRO de
 * su contenedor — el ancho mínimo garantiza que las columnas no se
 * aplasten y la página nunca scrollea de lado.
 *
 * La píldora nuevo/recurrente usa los pares info/éxito del sistema de
 * paneles (ESTADO_PILDORA) en vez de inventar colores: "recurrente" es
 * la noticia buena (volvió) y por eso lleva el verde; "nuevo" es
 * informativo. No se agregan estados a InsigniaEstado porque ese
 * diccionario es del CICLO de una reserva/promo, y el tipo de cliente
 * es otra dimensión.
 */

type CampoOrden = "nombre" | "visitas" | "ultimaVisita" | "totalEstimado";

/**
 * Búsqueda sin tildes: "jose" encuentra a "José Pablo Vargas". NFD
 * separa la letra de su tilde y el rango U+0300–U+036F (diacríticos
 * combinantes) la borra.
 */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function comparar(a: ClienteDemo, b: ClienteDemo, campo: CampoOrden): number {
  switch (campo) {
    case "nombre":
      return a.nombre.localeCompare(b.nombre, "es");
    case "visitas":
      return a.visitas - b.visitas;
    // La fecha es "YYYY-MM-DD": el orden lexicográfico ES el cronológico.
    case "ultimaVisita":
      return a.ultimaVisita.localeCompare(b.ultimaVisita);
    case "totalEstimado":
      return a.totalEstimado - b.totalEstimado;
  }
}

const PILDORA_TIPO: Record<ClienteDemo["tipo"], { clases: string; punto: string; texto: string }> =
  {
    nuevo: { clases: ESTADO_PILDORA.info, punto: ESTADO_MARCA.info, texto: "Nuevo" },
    recurrente: { clases: ESTADO_PILDORA.exito, punto: ESTADO_MARCA.exito, texto: "Recurrente" },
  };

function PildoraTipo({ tipo }: { tipo: ClienteDemo["tipo"] }) {
  const p = PILDORA_TIPO[tipo];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${p.clases}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.punto}`} aria-hidden />
      {p.texto}
    </span>
  );
}

/** Encabezado ordenable: el th anuncia su estado con aria-sort. */
function Th({
  campo,
  rotulo,
  orden,
  alOrdenar,
  alinear = "izquierda",
}: {
  campo: CampoOrden;
  rotulo: string;
  orden: { campo: CampoOrden; asc: boolean };
  alOrdenar: (campo: CampoOrden) => void;
  alinear?: "izquierda" | "derecha";
}) {
  const activo = orden.campo === campo;
  return (
    <th
      scope="col"
      aria-sort={activo ? (orden.asc ? "ascending" : "descending") : undefined}
      className={`px-3 py-2 ${alinear === "derecha" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => alOrdenar(campo)}
        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
          activo ? "text-aventurea-navy" : "text-aventurea-ink-soft hover:text-aventurea-navy"
        }`}
      >
        {rotulo}
        <span aria-hidden className="text-[10px]">
          {activo ? (orden.asc ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ClientesTabla({ clientes }: { clientes: ClienteDemo[] }) {
  const [busqueda, setBusqueda] = useState("");
  // Por defecto, la última visita más reciente arriba: es la pregunta
  // que un dueño se hace primero ("¿quién vino hace poco?").
  const [orden, setOrden] = useState<{ campo: CampoOrden; asc: boolean }>({
    campo: "ultimaVisita",
    asc: false,
  });

  const ordenarPor = (campo: CampoOrden) =>
    setOrden((previo) =>
      previo.campo === campo
        ? { campo, asc: !previo.asc }
        : // Al cambiar de columna, el sentido útil: alfabético asciende,
          // los números y las fechas arrancan del más grande/reciente.
          { campo, asc: campo === "nombre" },
    );

  const filas = useMemo(() => {
    const aguja = normalizar(busqueda.trim());
    const filtradas = aguja
      ? clientes.filter((c) => normalizar(c.nombre).includes(aguja))
      : [...clientes];
    filtradas.sort((a, b) => {
      const d = comparar(a, b, orden.campo);
      const base = d !== 0 ? d : a.nombre.localeCompare(b.nombre, "es");
      return orden.asc ? base : -base;
    });
    return filtradas;
  }, [clientes, busqueda, orden]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative w-full sm:max-w-xs">
          <IconSearch
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aventurea-ink-soft"
            aria-hidden
          />
          <input
            type="search"
            value={busqueda}
            onChange={(ev) => setBusqueda(ev.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar cliente por nombre"
            className="w-full rounded-xl border border-aventurea-line bg-white py-2 pl-9 pr-3 text-[13px] text-aventurea-ink outline-none transition-colors focus:border-aventurea-navy"
          />
        </div>
        <p className="text-[12px] font-bold text-aventurea-ink-soft">
          {filas.length} de {clientes.length} con cuenta de Bookea
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="border-b border-aventurea-line">
              <Th campo="nombre" rotulo="Cliente" orden={orden} alOrdenar={ordenarPor} />
              <th
                scope="col"
                className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft"
              >
                Tipo
              </th>
              <Th
                campo="visitas"
                rotulo="Visitas"
                orden={orden}
                alOrdenar={ordenarPor}
                alinear="derecha"
              />
              <Th campo="ultimaVisita" rotulo="Última visita" orden={orden} alOrdenar={ordenarPor} />
              <Th
                campo="totalEstimado"
                rotulo="Consumo estimado"
                orden={orden}
                alOrdenar={ordenarPor}
                alinear="derecha"
              />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-[13px] text-aventurea-ink-soft"
                >
                  No encontramos clientes con ese nombre.
                </td>
              </tr>
            ) : (
              filas.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-aventurea-line transition-colors last:border-b-0 hover:bg-aventurea-cream-2"
                >
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-aventurea-cream-2 text-[12px] font-extrabold text-aventurea-navy"
                        aria-hidden
                      >
                        {c.nombre.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[13px] font-bold text-aventurea-ink">{c.nombre}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <PildoraTipo tipo={c.tipo} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-aventurea-ink">
                    {c.visitas}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-aventurea-ink-soft">
                    {fechaCorta(c.ultimaVisita)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] font-bold tabular-nums text-aventurea-ink">
                    {formatearCRC(c.totalEstimado)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Por qué la lista no suma el total del período: solo quien
          reservó con cuenta aparece con nombre. Decirlo acá evita que
          el dueño busque a los 214 y crea que la tabla está rota. */}
      <p className="text-[12px] leading-relaxed text-aventurea-ink-soft">
        La lista muestra a quienes reservaron con cuenta de Bookea; el resto entró como invitado y
        suma solo en los totales. Por privacidad se muestra únicamente el nombre y sus métricas de
        visita.
      </p>
      <NotaEstimacion />
    </div>
  );
}
