"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconSparkles } from "@/components/icons";
import {
  CATEGORIAS,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  PROVINCIAS,
  TIPOS_LUGAR,
  TIPO_LUGAR_LABEL,
  type Categoria,
  type TipoLugar,
} from "../mi-rancho/types";
import type { Rancho } from "../mi-rancho/types";
import { NOMBRE_RANCHO_AVENTUREA } from "./constants";

const POR_PAGINA = 8;

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default function Directorio({ ranchos }: { ranchos: Rancho[] }) {
  const [tab, setTab] = useState<Categoria | "todos">("todos");
  const [texto, setTexto] = useState("");
  const [provincia, setProvincia] = useState("");
  const [tipoLugar, setTipoLugar] = useState<TipoLugar | "">("");
  const [invitados, setInvitados] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [pagina, setPagina] = useState(1);

  const invitadosNum = parseInt(invitados) || 0;
  const precioMaxNum = parseInt(precioMax) || 0;
  const muestraLugares = tab === "todos" || tab === "salon";

  // Los conteos de provincia y de tipo de lugar se calculan sobre el
  // conjunto ya filtrado por categoría, para que reaccionen al cambiar
  // de pestaña pero no se auto-filtren por sí mismos.
  const ranchosPorTab = useMemo(
    () => ranchos.filter((r) => tab === "todos" || r.categoria === tab),
    [ranchos, tab],
  );

  const conteoPorProvincia = useMemo(() => {
    const acc: Record<string, number> = {};
    ranchosPorTab.forEach((r) => {
      if (r.provincia) acc[r.provincia] = (acc[r.provincia] ?? 0) + 1;
    });
    return acc;
  }, [ranchosPorTab]);

  const conteoPorTipoLugar = useMemo(() => {
    const acc: Record<string, number> = {};
    ranchos
      .filter((r) => r.categoria === "salon")
      .forEach((r) => {
        if (r.tipo_lugar) acc[r.tipo_lugar] = (acc[r.tipo_lugar] ?? 0) + 1;
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
      if (tipoLugar && r.tipo_lugar !== tipoLugar) return false;
      if (invitadosNum && (r.capacidad_max ?? 0) < invitadosNum) return false;
      if (precioMaxNum && (r.precio_desde ?? 0) > precioMaxNum) return false;
      return true;
    });
  }, [ranchos, tab, texto, provincia, tipoLugar, invitadosNum, precioMaxNum]);

  const filtrosActivos = [provincia, tipoLugar, invitados, precioMax].filter(
    Boolean,
  ).length;
  const hayAlgo = filtrosActivos > 0 || !!texto || tab !== "todos";

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA,
  );

  function limpiar() {
    setTab("todos");
    setTexto("");
    setProvincia("");
    setTipoLugar("");
    setInvitados("");
    setPrecioMax("");
    setPagina(1);
  }

  function elegirCategoria(c: Categoria | "todos") {
    setTab(c);
    if (c !== "salon" && c !== "todos") setTipoLugar("");
    setPagina(1);
  }

  function elegirTipoLugar(t: TipoLugar) {
    setTab("salon");
    setTipoLugar((prev) => (prev === t ? "" : t));
    setPagina(1);
  }

  function elegirProvincia(p: string) {
    setProvincia((prev) => (prev === p ? "" : p));
    setPagina(1);
  }

  function onCambiarTexto(v: string) {
    setTexto(v);
    setPagina(1);
  }

  function onCambiarInvitados(v: string) {
    setInvitados(v);
    setPagina(1);
  }

  function onCambiarPrecioMax(v: string) {
    setPrecioMax(v);
    setPagina(1);
  }

  // Piezas reutilizadas tal cual en la barra de escritorio (arriba de las
  // cards) y en el panel de mobile (debajo de las cards, cerca del pie).
  const seccionProvincia = (
    <FilterSection title="Provincia">
      {PROVINCIAS.map((p) => (
        <FilterRow
          key={p}
          label={p}
          count={conteoPorProvincia[p] ?? 0}
          active={provincia === p}
          onClick={() => elegirProvincia(p)}
        />
      ))}
    </FilterSection>
  );

  const seccionLugares = muestraLugares ? (
    <FilterSection title="Lugares">
      {TIPOS_LUGAR.map((t) => (
        <FilterRow
          key={t}
          label={TIPO_LUGAR_LABEL[t]}
          count={conteoPorTipoLugar[t] ?? 0}
          active={tipoLugar === t}
          onClick={() => elegirTipoLugar(t)}
        />
      ))}
    </FilterSection>
  ) : null;

  const seccionMasFiltros = (
    <FilterSection title="Más filtros">
      <div className="flex flex-col gap-3 px-2.5 pt-1">
        <div>
          <label className={labelCls}>Cantidad de invitados</label>
          <input
            type="number"
            min={1}
            value={invitados}
            onChange={(e) => onCambiarInvitados(e.target.value)}
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
            onChange={(e) => onCambiarPrecioMax(e.target.value)}
            placeholder="Ej. 150000"
            className={inputCls}
          />
        </div>
        {hayAlgo && (
          <button
            type="button"
            onClick={limpiar}
            className="mt-1 w-full rounded-[10px] border border-aventurea-line py-2.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </FilterSection>
  );

  return (
    <div>
      {/* Categorías: fila horizontal — scrollea en mobile, se acomoda en escritorio */}
      <div className="-mx-6 mb-4 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        <CategoriaPill
          icono={<IconSparkles />}
          label="Todos"
          active={tab === "todos"}
          onClick={() => elegirCategoria("todos")}
        />
        {CATEGORIAS.map((c) => (
          <CategoriaPill
            key={c}
            icono={CATEGORIA_ICONO[c]}
            label={CATEGORIA_LABEL[c]}
            active={tab === c}
            onClick={() => elegirCategoria(c)}
          />
        ))}
      </div>

      {/* Buscador, siempre visible */}
      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aventurea-ink-soft">
          <IconLupa />
        </span>
        <input
          type="search"
          value={texto}
          onChange={(e) => onCambiarTexto(e.target.value)}
          placeholder="Buscá por nombre, provincia o cantón..."
          className="w-full rounded-[12px] border border-transparent bg-aventurea-cream-2 py-3 pl-11 pr-3 text-[14px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-orange/40 focus:outline-none"
        />
      </div>

      <p className="mb-4 text-[12.5px] text-aventurea-ink-soft">
        {filtrados.length} espacio{filtrados.length === 1 ? "" : "s"}{" "}
        {hayAlgo ? "coinciden con tu búsqueda" : "disponibles"}
      </p>

      {filtrados.length === 0 ? (
        <div className="rounded-[16px] border border-aventurea-line bg-aventurea-surface p-10 text-center">
          <p className="text-[14px] font-bold text-aventurea-ink">
            No encontramos espacios con esa búsqueda.
          </p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] text-aventurea-ink-soft">
            Probá con otra categoría, otra provincia o un presupuesto mayor.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibles.map((r) => (
              <RanchoCard key={r.id} rancho={r} />
            ))}
          </div>

          {totalPaginas > 1 && (
            <Paginacion
              pagina={paginaSegura}
              total={totalPaginas}
              onCambiar={setPagina}
            />
          )}
        </>
      )}

      {/* Resto de los filtros (provincia, lugares, más filtros), debajo de
          las cards y cerca del pie de página — en escritorio se acomodan
          en columnas, en mobile se apilan. */}
      <div className="mt-10">
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Más formas de filtrar
        </p>
        <div className="rounded-[16px] border border-aventurea-line bg-aventurea-surface p-4 shadow-sm">
          <div className="lg:grid lg:grid-cols-3 lg:gap-6">
            {seccionProvincia}
            {seccionLugares}
            {seccionMasFiltros}
          </div>
        </div>
      </div>

      {/* Invitación a publicar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-aventurea-orange/25 bg-aventurea-orange/5 px-6 py-5">
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
          className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
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

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-aventurea-line pb-4 last:border-none last:pb-0 lg:border-none lg:pb-0">
      <h3 className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {title}
      </h3>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        active
          ? "bg-aventurea-orange/10 font-bold text-aventurea-orange"
          : "text-aventurea-ink hover:bg-aventurea-cream-2"
      }`}
    >
      <span>{label}</span>
      <span className="ml-2 shrink-0 tabular-nums text-[11.5px] text-aventurea-ink-soft">
        {count}
      </span>
    </button>
  );
}

function CategoriaPill({
  icono,
  label,
  active,
  onClick,
}: {
  icono: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
        active
          ? "bg-aventurea-orange text-white"
          : "border border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft"
      }`}
    >
      <span aria-hidden className="[&_svg]:h-3.5 [&_svg]:w-3.5">
        {icono}
      </span>
      {label}
    </button>
  );
}

function Paginacion({
  pagina,
  total,
  onCambiar,
}: {
  pagina: number;
  total: number;
  onCambiar: (p: number) => void;
}) {
  const paginas = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={pagina === 1}
        onClick={() => onCambiar(pagina - 1)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-30"
        aria-label="Página anterior"
      >
        ‹
      </button>
      {paginas.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onCambiar(p)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold transition-colors ${
            p === pagina
              ? "bg-aventurea-orange text-white"
              : "border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={pagina === total}
        onClick={() => onCambiar(pagina + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-30"
        aria-label="Página siguiente"
      >
        ›
      </button>
    </div>
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
  const href = esAventurea ? "/eventos-salon" : `/ranchos-eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");
  const etiqueta = rancho.tipo_lugar
    ? TIPO_LUGAR_LABEL[rancho.tipo_lugar]
    : CATEGORIA_LABEL[rancho.categoria];

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
        <span className="absolute inset-0 flex items-center justify-center opacity-25 [&_svg]:h-16 [&_svg]:w-16">
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
          {etiqueta}
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
          className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12.5px] font-bold transition-colors ${
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
