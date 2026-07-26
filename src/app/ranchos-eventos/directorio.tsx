"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CATEGORIAS,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  PROVINCIAS,
  type Categoria,
} from "../mi-rancho/types";
import type { Rancho } from "../mi-rancho/types";
import { NOMBRE_RANCHO_AVENTUREA } from "./constants";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default function Directorio({ ranchos }: { ranchos: Rancho[] }) {
  const [tab, setTab] = useState<Categoria | "todos">("todos");
  const [texto, setTexto] = useState("");
  const [provincia, setProvincia] = useState("");
  const [invitados, setInvitados] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [abierto, setAbierto] = useState(false);

  const invitadosNum = parseInt(invitados) || 0;
  const precioMaxNum = parseInt(precioMax) || 0;

  const conteoPorCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    ranchos.forEach((r) => {
      acc[r.categoria] = (acc[r.categoria] ?? 0) + 1;
    });
    return acc;
  }, [ranchos]);

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return ranchos.filter((r) => {
      if (tab !== "todos" && r.categoria !== tab) return false;
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
  }, [ranchos, tab, texto, provincia, invitadosNum, precioMaxNum]);

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
      {/* Tabs de categoría */}
      <div className="-mx-6 mb-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:px-0">
        <TabButton
          activo={tab === "todos"}
          onClick={() => setTab("todos")}
          label={`Todos (${ranchos.length})`}
          icono="✨"
        />
        {CATEGORIAS.map((c) => (
          <TabButton
            key={c}
            activo={tab === c}
            onClick={() => setTab(c)}
            label={`${CATEGORIA_LABEL[c]} (${conteoPorCategoria[c] ?? 0})`}
            icono={CATEGORIA_ICONO[c]}
          />
        ))}
      </div>

      <p className="mb-4 text-[12.5px] text-aventurea-ink-soft">
        {filtrados.length} espacio{filtrados.length === 1 ? "" : "s"}{" "}
        {hayAlgo ? "coinciden con tu búsqueda" : "disponibles"}
      </p>

      {filtrados.length === 0 ? (
        <div className="rounded-[16px] border border-aventurea-line bg-white p-10 text-center">
          <p className="text-[14px] font-bold text-aventurea-ink">
            No encontramos espacios con esa búsqueda.
          </p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] text-aventurea-ink-soft">
            Probá con otra categoría, otra provincia o un presupuesto mayor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((r) => (
            <RanchoCard key={r.id} rancho={r} />
          ))}
        </div>
      )}

      {/* Buscador y filtros */}
      <div className="mt-10 rounded-[16px] border border-aventurea-line bg-white p-2.5 shadow-sm">
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

      {/* Invitación a publicar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-aventurea-orange/25 bg-aventurea-orange/5 px-6 py-5">
        <div>
          <h2 className="text-[15px] font-bold text-aventurea-ink">
            ¿Tenés un negocio para eventos?
          </h2>
          <p className="mt-1 text-[13px] text-aventurea-ink-soft">
            Salones, mobiliario, DJs, animación y más — publicalo gratis en
            Aventurea CR y llegá a más clientes en todo el país.
          </p>
        </div>
        <Link
          href="/mi-rancho/registro"
          className="rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
        >
          Publicar mi espacio
        </Link>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

function TabButton({
  activo,
  onClick,
  label,
  icono,
}: {
  activo: boolean;
  onClick: () => void;
  label: string;
  icono: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors ${
        activo
          ? "bg-aventurea-orange text-white"
          : "border border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
      }`}
    >
      <span aria-hidden>{icono}</span>
      {label}
    </button>
  );
}

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
  const puedeReservar = rancho.categoria === "salon";
  const href = esAventurea
    ? "/eventos-salon"
    : puedeReservar
      ? `/ranchos-eventos/${rancho.id}/reservar`
      : `/ranchos-eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={href}
      className="group relative flex h-[300px] flex-col overflow-hidden rounded-[16px] shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={
          rancho.foto_url
            ? { backgroundImage: `url(${rancho.foto_url})` }
            : { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
        }
      />
      {!rancho.foto_url && (
        <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-25">
          {CATEGORIA_ICONO[rancho.categoria]}
        </span>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" />

      <div className="relative flex items-center justify-between p-3.5">
        {rancho.provincia && (
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink">
            {rancho.provincia}
          </span>
        )}
        <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90">
          {CATEGORIA_LABEL[rancho.categoria]}
        </span>
      </div>

      <div className="relative mt-auto flex flex-col p-4.5">
        <h3 className="text-[16px] font-bold text-white drop-shadow-sm">
          {rancho.nombre}
        </h3>
        {ubicacion && (
          <p className="mt-0.5 truncate text-[11.5px] text-white/75">{ubicacion}</p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-3">
          <span className="text-[11px] text-white/80">
            {rancho.capacidad_min || rancho.capacidad_max
              ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas`
              : "Capacidad a consultar"}
          </span>
          <span className="text-[13px] font-bold text-white">
            {precio ? `Desde ${precio}` : "A consultar"}
          </span>
        </div>

        <span
          className={`mt-3 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-bold transition-colors ${
            esAventurea || puedeReservar
              ? "bg-aventurea-orange text-white group-hover:bg-aventurea-orange-dark"
              : "bg-white/90 text-aventurea-ink group-hover:bg-white"
          }`}
        >
          {esAventurea || puedeReservar ? "¡Reservar ahora!" : "Ver más"}
          <span aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}
