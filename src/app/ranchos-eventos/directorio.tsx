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
  const [provincia, setProvincia] = useState("");
  const [invitados, setInvitados] = useState("");
  const [precioMax, setPrecioMax] = useState("");

  const invitadosNum = parseInt(invitados) || 0;
  const precioMaxNum = parseInt(precioMax) || 0;

  const filtrados = useMemo(() => {
    return ranchos.filter((r) => {
      if (provincia && r.provincia !== provincia) return false;
      if (invitadosNum && (r.capacidad_max ?? 0) < invitadosNum) return false;
      if (precioMaxNum && (r.precio_desde ?? 0) > precioMaxNum) return false;
      return true;
    });
  }, [ranchos, provincia, invitadosNum, precioMaxNum]);

  const hayFiltros = !!(provincia || invitados || precioMax);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-[16px] border border-aventurea-line bg-white p-4.5">
        <div>
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Provincia
          </label>
          <select
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
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
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Cantidad de invitados
          </label>
          <input
            type="number"
            min={1}
            value={invitados}
            onChange={(e) => setInvitados(e.target.value)}
            placeholder="Ej. 50"
            className="w-[140px] rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Precio máximo (₡)
          </label>
          <input
            type="number"
            min={0}
            value={precioMax}
            onChange={(e) => setPrecioMax(e.target.value)}
            placeholder="Ej. 150000"
            className="w-[160px] rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
          />
        </div>
        {hayFiltros && (
          <button
            onClick={() => {
              setProvincia("");
              setInvitados("");
              setPrecioMax("");
            }}
            className="rounded-full border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-[16px] border border-aventurea-line bg-white p-10 text-center">
          <p className="text-[14px] font-bold text-aventurea-ink">
            No hay ranchos que coincidan con esos filtros.
          </p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] text-aventurea-ink-soft">
            Probá con otra provincia, menos invitados o un presupuesto mayor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((r) => (
            <RanchoCard key={r.id} rancho={r} />
          ))}
        </div>
      )}

      <div className="mt-9 rounded-[16px] border border-aventurea-orange/25 bg-aventurea-orange/5 p-6 text-center">
        <h3 className="text-[15px] font-bold text-aventurea-ink">
          ¿Tenés un salón o rancho para eventos?
        </h3>
        <p className="mx-auto mt-1.5 max-w-[46ch] text-[13px] text-aventurea-ink-soft">
          Publicalo gratis en Aventurea CR y llegá a más clientes en todo el
          país.
        </p>
        <Link
          href="/mi-rancho/registro"
          className="mt-4 inline-flex rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
        >
          Publicar mi espacio
        </Link>
      </div>
    </div>
  );
}

function RanchoCard({ rancho }: { rancho: Rancho }) {
  const esAventurea = rancho.nombre === NOMBRE_RANCHO_AVENTUREA;
  const href = esAventurea ? "/eventos-salon" : `/ranchos-eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-aventurea-line bg-white shadow-sm transition-colors hover:border-aventurea-orange/40"
    >
      <div className="relative flex h-[130px] items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
        <span className="text-4xl opacity-25">🏡</span>
        {rancho.provincia && (
          <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white/80">
            {rancho.provincia}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4.5">
        <h3 className="text-[15px] font-bold text-aventurea-ink">{rancho.nombre}</h3>
        {rancho.canton && (
          <p className="mt-0.5 text-[12px] text-zinc-500">{rancho.canton}</p>
        )}
        {rancho.descripcion && (
          <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            {rancho.descripcion}
          </p>
        )}

        <div className="mt-3.5 flex items-center justify-between border-t border-aventurea-line pt-3.5">
          <span className="text-[11.5px] text-aventurea-ink-soft">
            {rancho.capacidad_min || rancho.capacidad_max
              ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas`
              : "Capacidad a consultar"}
          </span>
          <span className="text-[13px] font-bold text-aventurea-orange">
            {precio ? `Desde ${precio}` : "Precio a consultar"}
          </span>
        </div>

        <span
          className={`mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-bold transition-colors ${
            esAventurea
              ? "bg-aventurea-orange text-white group-hover:bg-aventurea-orange-dark"
              : "border border-aventurea-line text-aventurea-ink group-hover:border-aventurea-orange group-hover:text-aventurea-orange"
          }`}
        >
          {esAventurea ? "¡Reservar ahora!" : "Ver más"}
          <span aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}
