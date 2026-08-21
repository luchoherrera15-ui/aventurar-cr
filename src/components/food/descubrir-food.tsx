"use client";

import { useMemo, useState } from "react";
import { hoyISOCR } from "@/lib/fechas";
import { normalizarBusquedaFood, type TarjetaFood } from "@/lib/food/tarjetas";
import RestauranteCard from "@/components/food/restaurante-card";
import Revelar from "@/components/revelar";
import { IconSearch } from "@/components/icons";

/**
 * DESCUBRIR — la pantalla de búsqueda/filtro dedicada que pidió el
 * dueño, separada del Home (/food): acá la persona ya sabe que quiere
 * explorar y comparar, así que el buscador y los chips van PRIMERO, no
 * escondidos debajo de un hero de marketing.
 *
 * Mismo criterio de honestidad que DirectorioFood (food/directorio-food.tsx):
 * todo lo que se puede filtrar es un dato REAL de `TarjetaFood`. "Hoy"/
 * "Mañana"/"Esta semana" comparan contra `fechasConOferta` (franjas de
 * verdad); no hay chip de "cerca de mí" con distancia en km porque
 * food_locations no tiene coordenadas — hay, en cambio, el mismo campo
 * de texto libre de ubicación que ya usaba el buscador del Home.
 */
type Orden = "descuento" | "nombre" | "nuevos";

const CHIPS_FECHA = [
  { id: "hoy" as const, label: "Hoy" },
  { id: "manana" as const, label: "Mañana" },
  { id: "semana" as const, label: "Esta semana" },
];

function fechaISO(offsetDias: number): string {
  const [y, m, d] = hoyISOCR().split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + offsetDias);
  return fecha.toISOString().slice(0, 10);
}

export default function DescubrirFood({
  negocios,
  favoritosIds,
  logueado,
}: {
  negocios: TarjetaFood[];
  /** ids ya marcados como favorito de quien mira — Set vacío si no hay sesión. */
  favoritosIds: Set<string>;
  logueado: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [soloDescuento, setSoloDescuento] = useState(false);
  const [fechaChip, setFechaChip] = useState<"hoy" | "manana" | "semana" | null>(null);
  const [orden, setOrden] = useState<Orden>("descuento");

  const hoy = hoyISOCR();
  const manana = useMemo(() => fechaISO(1), []);
  const finDeSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => fechaISO(i)), []);

  const filtrados = useMemo(() => {
    let lista = negocios;

    if (texto) {
      const aguja = normalizarBusquedaFood(texto);
      lista = lista.filter((n) =>
        normalizarBusquedaFood([n.nombre, n.descripcion ?? "", ...n.platos].join(" ")).includes(aguja),
      );
    }
    if (ubicacion) {
      const aguja = normalizarBusquedaFood(ubicacion);
      lista = lista.filter((n) => n.ubicacion && normalizarBusquedaFood(n.ubicacion).includes(aguja));
    }
    if (soloDescuento) {
      lista = lista.filter((n) => n.descuentoPorcentaje > 0);
    }
    if (fechaChip === "hoy") {
      lista = lista.filter((n) => n.fechasConOferta.includes(hoy));
    } else if (fechaChip === "manana") {
      lista = lista.filter((n) => n.fechasConOferta.includes(manana));
    } else if (fechaChip === "semana") {
      lista = lista.filter((n) => n.fechasConOferta.some((f) => finDeSemana.includes(f)));
    }

    const ordenada = [...lista];
    if (orden === "descuento") {
      ordenada.sort((a, b) => b.descuentoPorcentaje - a.descuentoPorcentaje);
    } else if (orden === "nombre") {
      ordenada.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    } else {
      ordenada.sort((a, b) => (b.esNuevo ? 1 : 0) - (a.esNuevo ? 1 : 0));
    }
    return ordenada;
  }, [negocios, texto, ubicacion, soloDescuento, fechaChip, orden, hoy, manana, finDeSemana]);

  const hayFiltros = texto !== "" || ubicacion !== "" || soloDescuento || fechaChip !== null;

  function limpiar() {
    setTexto("");
    setUbicacion("");
    setSoloDescuento(false);
    setFechaChip(null);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-6 sm:px-6">
      {/* ── El buscador, arriba y primero ──────────────────────────── */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="flex flex-1 items-center gap-2.5 rounded-2xl border border-aventurea-line bg-white px-4 py-3">
          <IconSearch className="h-4 w-4 shrink-0 text-aventurea-ink-soft" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Restaurante, comida o zona"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-aventurea-ink outline-none placeholder:text-zinc-400"
          />
        </label>
        <input
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          placeholder="Ubicación (ej. Escazú)"
          autoComplete="off"
          className="rounded-2xl border border-aventurea-line bg-white px-4 py-3 text-[14px] text-aventurea-ink outline-none placeholder:text-zinc-400 sm:w-[220px]"
        />
      </div>

      {/* ── Chips de filtro rápido ──────────────────────────────────── */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={soloDescuento}
          onClick={() => setSoloDescuento((v) => !v)}
          className={`presionable rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
            soloDescuento
              ? "border-transparent bg-aventurea-orange text-white"
              : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-orange/50"
          }`}
        >
          Con descuento
        </button>
        {CHIPS_FECHA.map((c) => {
          const activo = fechaChip === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={activo}
              onClick={() => setFechaChip(activo ? null : c.id)}
              className={`presionable rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                activo
                  ? "border-transparent bg-aventurea-navy text-white"
                  : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy/50"
              }`}
            >
              {c.label}
            </button>
          );
        })}

        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="ml-auto rounded-full border border-aventurea-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink outline-none"
        >
          <option value="descuento">Mayor descuento</option>
          <option value="nombre">Nombre (A-Z)</option>
          <option value="nuevos">Más nuevos</option>
        </select>

        {hayFiltros && (
          <button
            type="button"
            onClick={limpiar}
            className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      <p className="mt-4 text-[13px] font-bold text-aventurea-ink-soft">
        {filtrados.length} {filtrados.length === 1 ? "restaurante" : "restaurantes"}
      </p>

      {/* ── Resultados ──────────────────────────────────────────────── */}
      {filtrados.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-aventurea-line bg-white p-10 text-center shadow-plano">
          <p className="text-[15px] font-extrabold text-aventurea-ink">
            No encontramos restaurantes con esos filtros
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
            Probá con otra palabra, otra ubicación o quitá los filtros.
          </p>
          {hayFiltros && (
            <button type="button" onClick={limpiar} className="btn-contorno presionable mt-6">
              Ver todos los restaurantes
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((t, i) => (
            <Revelar key={t.id} indice={i}>
              <RestauranteCard
                tarjeta={t}
                prioridad={i < 3}
                favoritoInicial={favoritosIds.has(t.id)}
                logueado={logueado}
              />
            </Revelar>
          ))}
        </div>
      )}
    </div>
  );
}
