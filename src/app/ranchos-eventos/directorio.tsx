"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PROVINCIAS } from "../mi-rancho/types";
import type { Rancho } from "../mi-rancho/types";
import { NOMBRE_RANCHO_AVENTUREA } from "./constants";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default function Directorio({ ranchos }: { ranchos: Rancho[] }) {
  const [texto, setTexto] = useState("");
  const [provincia, setProvincia] = useState("");
  const [invitados, setInvitados] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [abierto, setAbierto] = useState(false);

  const invitadosNum = parseInt(invitados) || 0;
  const precioMaxNum = parseInt(precioMax) || 0;

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return ranchos.filter((r) => {
      if (
        q &&
        !`${r.nombre} ${r.provincia ?? ""} ${r.canton ?? ""} ${r.descripcion ?? ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (provincia && r.provincia !== provincia) return false;
      if (invitadosNum && (r.capacidad_max ?? 0) < invitadosNum) return false;
      if (precioMaxNum && (r.precio_desde ?? 0) > precioMaxNum) return false;
      return true;
    });
  }, [ranchos, texto, provincia, invitadosNum, precioMaxNum]);

  const filtrosActivos = [provincia, invitados, precioMax].filter(Boolean).length;
  const hayAlgo = filtrosActivos > 0 || !!texto;

  function limpiar() {
    setTexto("");
    setProvincia("");
    setInvitados("");
    setPrecioMax("");
  }

  return (
    <div>
      {/* Invitación a publicar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-aventurea-orange/25 bg-aventurea-orange/5 px-6 py-5">
        <div>
          <h2 className="text-[15px] font-bold text-aventurea-ink">
            ¿Tenés un salón o rancho para eventos?
          </h2>
          <p className="mt-1 text-[13px] text-aventurea-ink-soft">
            Publicalo gratis en Aventurea CR y llegá a más clientes en todo el
            país.
          </p>
        </div>
        <Link
          href="/mi-rancho/registro"
          className="rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
        >
          Publicar mi espacio
        </Link>
      </div>

      {/* Buscador */}
      <div className="sticky top-[61px] z-40 -mx-4 mt-7 bg-aventurea-cream/95 px-4 py-3 backdrop-blur-sm">
        <div className="rounded-[16px] border border-aventurea-line bg-white p-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aventurea-ink-soft">
                <IconLupa />
              </span>
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscá por nombre, provincia o cantón..."
                className="w-full rounded-[12px] border border-transparent bg-aventurea-cream-2 py-3 pl-11 pr-3 text-[14px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-orange/40 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              aria-expanded={abierto}
              className={`flex items-center gap-2 rounded-[12px] px-4 py-3 text-[13.5px] font-bold transition-colors ${
                abierto || filtrosActivos > 0
                  ? "bg-aventurea-orange text-white"
                  : "border border-aventurea-line text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
              }`}
            >
              Filtros
              {filtrosActivos > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-[11px]">
                  {filtrosActivos}
                </span>
              )}
              <span
                className={`transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
                aria-hidden
              >
                ▾
              </span>
            </button>
          </div>

          {abierto && (
            <div className="mt-2.5 grid grid-cols-1 gap-3 border-t border-aventurea-line px-1 pb-1 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelCls}>Provincia</label>
                <select
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Todas</option>
                  {PROVINCIAS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Cantidad de invitados</label>
                <input
                  type="number"
                  min={1}
                  value={invitados}
                  onChange={(e) => setInvitados(e.target.value)}
                  placeholder="Ej. 50"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Precio máximo (₡)</label>
                <input
                  type="number"
                  min={0}
                  value={precioMax}
                  onChange={(e) => setPrecioMax(e.target.value)}
                  placeholder="Ej. 150000"
                  className={inputCls}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={limpiar}
                  disabled={!hayAlgo}
                  className="w-full rounded-[10px] border border-aventurea-line py-2.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-40"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 mt-4 text-[12.5px] text-aventurea-ink-soft">
        {filtrados.length} espacio{filtrados.length === 1 ? "" : "s"}{" "}
        {hayAlgo ? "coinciden con tu búsqueda" : "disponibles"}
      </p>

      {filtrados.length === 0 ? (
        <div className="rounded-[16px] border border-aventurea-line bg-white p-10 text-center">
          <p className="text-[14px] font-bold text-aventurea-ink">
            No encontramos espacios con esa búsqueda.
          </p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] text-aventurea-ink-soft">
            Probá con otra provincia, menos invitados o un presupuesto mayor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((r) => (
            <RanchoCard key={r.id} rancho={r} />
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

function IconLupa() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function RanchoCard({ rancho }: { rancho: Rancho }) {
  const esAventurea = rancho.nombre === NOMBRE_RANCHO_AVENTUREA;
  const href = esAventurea ? "/eventos-salon" : `/ranchos-eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-aventurea-line bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-aventurea-orange/40 hover:shadow-md"
    >
      <div className="relative flex h-[130px] items-center justify-center overflow-hidden bg-gradient-to-br from-aventurea-cream-2 to-aventurea-line">
        <span className="text-4xl opacity-40">🏡</span>
        {rancho.provincia && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink">
            {rancho.provincia}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4.5">
        <h3 className="text-[15px] font-bold text-aventurea-ink">
          {rancho.nombre}
        </h3>
        {rancho.canton && (
          <p className="mt-0.5 text-[12px] text-zinc-500">{rancho.canton}</p>
        )}
        {rancho.descripcion && (
          <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            {rancho.descripcion}
          </p>
        )}

        <div className="mt-auto">
          <div className="mt-3.5 flex items-center justify-between border-t border-aventurea-line pt-3.5">
            <span className="text-[11.5px] text-aventurea-ink-soft">
              {rancho.capacidad_min || rancho.capacidad_max
                ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas`
                : "Capacidad a consultar"}
            </span>
            <span className="text-[13px] font-bold text-aventurea-orange">
              {precio ? `Desde ${precio}` : "A consultar"}
            </span>
          </div>

          <span
            className={`mt-3.5 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-bold transition-colors ${
              esAventurea
                ? "bg-aventurea-orange text-white group-hover:bg-aventurea-orange-dark"
                : "border border-aventurea-line text-aventurea-ink group-hover:border-aventurea-orange group-hover:text-aventurea-orange"
            }`}
          >
            {esAventurea ? "¡Reservar ahora!" : "Ver más"}
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
