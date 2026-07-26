"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { IconPin } from "@/components/icons";
import {
  CATEGORIAS,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  CANTONES,
  PROVINCIAS,
  SUBCATEGORIAS,
  SUBCATEGORIA_LABEL,
  type Categoria,
  type Provincia,
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
  const [subcategoria, setSubcategoria] = useState("");
  const [texto, setTexto] = useState("");
  const [provincia, setProvincia] = useState("");
  const [canton, setCanton] = useState("");
  const [invitados, setInvitados] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [pagina, setPagina] = useState(1);
  const [menuAbierto, setMenuAbierto] = useState<
    Categoria | "provincia" | "filtros" | null
  >(null);

  const invitadosNum = parseInt(invitados) || 0;
  const precioMaxNum = parseInt(precioMax) || 0;

  const conteoPorCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    ranchos.forEach((r) => {
      acc[r.categoria] = (acc[r.categoria] ?? 0) + 1;
    });
    return acc;
  }, [ranchos]);

  const conteoPorSubcategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    ranchos.forEach((r) => {
      if (r.subcategoria) acc[r.subcategoria] = (acc[r.subcategoria] ?? 0) + 1;
    });
    return acc;
  }, [ranchos]);

  // El conteo por provincia se calcula sobre lo ya filtrado por categoría,
  // para que reaccione al cambiar de pestaña sin auto-filtrarse.
  const conteoPorProvincia = useMemo(() => {
    const acc: Record<string, number> = {};
    ranchos
      .filter((r) => tab === "todos" || r.categoria === tab)
      .forEach((r) => {
        if (r.provincia) acc[r.provincia] = (acc[r.provincia] ?? 0) + 1;
      });
    return acc;
  }, [ranchos, tab]);

  const conteoPorCanton = useMemo(() => {
    const acc: Record<string, number> = {};
    ranchos
      .filter((r) => !provincia || r.provincia === provincia)
      .filter((r) => tab === "todos" || r.categoria === tab)
      .forEach((r) => {
        if (r.canton) acc[r.canton] = (acc[r.canton] ?? 0) + 1;
      });
    return acc;
  }, [ranchos, provincia, tab]);

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return ranchos.filter((r) => {
      if (tab !== "todos" && r.categoria !== tab) return false;
      if (subcategoria && r.subcategoria !== subcategoria) return false;
      if (
        q &&
        !`${r.nombre} ${r.provincia ?? ""} ${r.canton ?? ""} ${r.descripcion ?? ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (provincia && r.provincia !== provincia) return false;
      if (canton && r.canton !== canton) return false;
      if (invitadosNum && (r.capacidad_max ?? 0) < invitadosNum) return false;
      if (precioMaxNum && (r.precio_desde ?? 0) > precioMaxNum) return false;
      return true;
    });
  }, [ranchos, tab, subcategoria, texto, provincia, canton, invitadosNum, precioMaxNum]);

  const hayAlgo =
    tab !== "todos" ||
    !!subcategoria ||
    !!texto ||
    !!provincia ||
    !!canton ||
    !!invitados ||
    !!precioMax;

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA,
  );

  const soltarMenu = useCallback(() => setMenuAbierto(null), []);

  function limpiar() {
    setTab("todos");
    setSubcategoria("");
    setTexto("");
    setProvincia("");
    setCanton("");
    setInvitados("");
    setPrecioMax("");
    setPagina(1);
  }

  function elegirCategoria(c: Categoria | "todos") {
    setTab(c);
    setSubcategoria("");
    setPagina(1);
    soltarMenu();
  }

  function elegirSubcategoria(c: Categoria, sub: string) {
    setTab(c);
    setSubcategoria((prev) => (prev === sub ? "" : sub));
    setPagina(1);
    soltarMenu();
  }

  function subirAlInicio() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function elegirProvincia(p: string) {
    setProvincia((prev) => (prev === p ? "" : p));
    // El cantón pertenece a una provincia: al cambiarla deja de aplicar.
    setCanton("");
    setPagina(1);
  }

  function elegirCanton(ct: string) {
    setCanton((prev) => (prev === ct ? "" : ct));
    setPagina(1);
  }

  return (
    <div>
      {/* Barra de navegación: es el filtro principal del directorio */}
      <nav className="relative z-30 mb-4">
        <div className="-mx-6 flex gap-1 overflow-x-auto border-b border-aventurea-line px-6 lg:mx-0 lg:px-0">
          <TabMenu
            label="Todos"
            activo={tab === "todos" && !subcategoria}
            abierto={false}
            conMenu={false}
            onClick={() => elegirCategoria("todos")}
          />
          {CATEGORIAS.map((cat) => (
            <TabMenu
              key={cat}
              label={CATEGORIA_LABEL[cat]}
              activo={tab === cat}
              abierto={menuAbierto === cat}
              conMenu
              onClick={() => setMenuAbierto((prev) => (prev === cat ? null : cat))}
            />
          ))}

          {/* A la derecha, los filtros transversales a cualquier categoría */}
          <span className="ml-auto flex shrink-0 gap-1 border-l border-aventurea-line pl-1">
            <TabMenu
              label={canton || provincia || "Zona"}
              activo={!!provincia || !!canton}
              abierto={menuAbierto === "provincia"}
              conMenu
              onClick={() =>
                setMenuAbierto((prev) => (prev === "provincia" ? null : "provincia"))
              }
            />
            <TabMenu
              label="Más filtros"
              activo={!!invitados || !!precioMax}
              abierto={menuAbierto === "filtros"}
              conMenu
              onClick={() =>
                setMenuAbierto((prev) => (prev === "filtros" ? null : "filtros"))
              }
            />
          </span>
        </div>

        {menuAbierto && (
          <>
            {/* Capa invisible: un clic afuera cierra el menú */}
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={soltarMenu}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-[16px] border border-aventurea-line bg-aventurea-surface p-4 shadow-xl">
              {menuAbierto === "provincia" ? (
                <div>
                  <h4 className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Provincia
                  </h4>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-4">
                    {PROVINCIAS.map((p) => (
                      <FilterRow
                        key={p}
                        label={p}
                        count={conteoPorProvincia[p] ?? 0}
                        active={provincia === p}
                        onClick={() => elegirProvincia(p)}
                      />
                    ))}
                  </div>

                  {/* Elegida la provincia, se abren sus cantones: es el
                      segundo nivel de la búsqueda por zona. */}
                  {provincia && (
                    <div className="mt-4 border-t border-aventurea-line pt-3">
                      <h4 className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        Cantones de {provincia}
                      </h4>
                      <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-4">
                        {CANTONES[provincia as Provincia].map((ct) => (
                          <FilterRow
                            key={ct}
                            label={ct}
                            count={conteoPorCanton[ct] ?? 0}
                            active={canton === ct}
                            onClick={() => {
                              elegirCanton(ct);
                              soltarMenu();
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : menuAbierto === "filtros" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Cantidad de invitados</label>
                    <input
                      type="number"
                      min={1}
                      value={invitados}
                      onChange={(e) => {
                        setInvitados(e.target.value);
                        setPagina(1);
                      }}
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
                      onChange={(e) => {
                        setPrecioMax(e.target.value);
                        setPagina(1);
                      }}
                      placeholder="Ej. 150000"
                      className={inputCls}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => elegirCategoria(menuAbierto)}
                    className="mb-2 text-[12px] font-bold text-aventurea-orange hover:underline"
                  >
                    Ver todo en {CATEGORIA_LABEL[menuAbierto]} (
                    {conteoPorCategoria[menuAbierto] ?? 0}) →
                  </button>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                    {SUBCATEGORIAS[menuAbierto].map((s) => (
                      <FilterRow
                        key={s.id}
                        label={s.label}
                        count={conteoPorSubcategoria[s.id] ?? 0}
                        active={subcategoria === s.id}
                        onClick={() => elegirSubcategoria(menuAbierto, s.id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </nav>

      {/* Buscador */}
      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aventurea-ink-soft">
          <IconLupa />
        </span>
        <input
          type="search"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setPagina(1);
          }}
          placeholder="Buscá por nombre, provincia o cantón..."
          className="w-full rounded-[12px] border border-transparent bg-aventurea-cream-2 py-3 pl-11 pr-3 text-[14px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-orange/40 focus:outline-none"
        />
      </div>

      {/* Qué está filtrado ahora mismo */}
      {hayAlgo && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {tab !== "todos" && (
            <Chip
              label={CATEGORIA_LABEL[tab]}
              onQuitar={() => elegirCategoria("todos")}
            />
          )}
          {subcategoria && (
            <Chip
              label={SUBCATEGORIA_LABEL[subcategoria] ?? subcategoria}
              onQuitar={() => {
                setSubcategoria("");
                setPagina(1);
              }}
            />
          )}
          {provincia && (
            <Chip label={provincia} onQuitar={() => elegirProvincia(provincia)} />
          )}
          {canton && (
            <Chip label={canton} onQuitar={() => elegirCanton(canton)} />
          )}
          <button
            type="button"
            onClick={limpiar}
            className="text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange"
          >
            Limpiar todo
          </button>
        </div>
      )}

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

      {/* Atajo por provincia. Las categorías ya viven en la barra de
          arriba, así que acá abajo no se repiten. */}
      <div className="mt-14 border-t border-aventurea-line pt-8">
        <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-wide text-aventurea-ink">
          Buscá por provincia
        </h2>
        <div className="flex flex-wrap gap-2">
          {PROVINCIAS.map((p) => {
            const n = conteoPorProvincia[p] ?? 0;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  elegirProvincia(p);
                  subirAlInicio();
                }}
                className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                  provincia === p
                    ? "border-aventurea-orange bg-aventurea-orange/10 text-aventurea-orange"
                    : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
                }`}
              >
                {p}
                <span className="ml-1.5 font-normal text-zinc-400">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invitación a publicar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-aventurea-orange/25 bg-aventurea-orange/5 px-6 py-5">
        <div>
          <h2 className="text-[15px] font-bold text-aventurea-ink">
            ¿Tenés un negocio para eventos?
          </h2>
          <p className="mt-1 text-[13px] text-aventurea-ink-soft">
            Lugares, comida, animación, decoración y más — publicalo gratis en
            Aventurea CR y llegá a más clientes en todo el país.
          </p>
        </div>
        <Link
          href="/publicar"
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

function TabMenu({
  label,
  activo,
  abierto,
  conMenu,
  onClick,
}: {
  label: string;
  activo: boolean;
  abierto: boolean;
  conMenu: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={conMenu ? abierto : undefined}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-[13px] font-bold uppercase tracking-wide transition-colors ${
        activo || abierto
          ? "border-aventurea-orange text-aventurea-orange"
          : "border-transparent text-aventurea-ink-soft hover:text-aventurea-orange"
      }`}
    >
      {label}
      {conMenu && (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${abierto ? "rotate-180" : ""}`}
        >
          <path
            d="m5 8 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function Chip({ label, onQuitar }: { label: string; onQuitar: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-aventurea-orange/10 py-1 pl-3 pr-1.5 text-[12px] font-bold text-aventurea-orange">
      {label}
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar filtro ${label}`}
        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-aventurea-orange hover:text-white"
      >
        ×
      </button>
    </span>
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
  const puedeReservar = rancho.categoria === "lugares";
  const href = esAventurea ? "/eventos-salon" : `/ranchos-eventos/${rancho.id}`;
  const precio = fmtColones(rancho.precio_desde);
  // Cantón y provincia alcanzan: la dirección exacta se desbordaba y
  // quedaba cortada a media palabra.
  const ubicacion = [rancho.canton, rancho.provincia].filter(Boolean).join(", ");
  const etiqueta = rancho.subcategoria
    ? (SUBCATEGORIA_LABEL[rancho.subcategoria] ?? CATEGORIA_LABEL[rancho.categoria])
    : CATEGORIA_LABEL[rancho.categoria];
  const capacidad =
    rancho.capacidad_min || rancho.capacidad_max
      ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas`
      : null;

  return (
    <Link
      href={href}
      className="group relative flex h-[340px] flex-col overflow-hidden rounded-[18px] shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,35,64,0.22)]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={
          rancho.foto_url
            ? { backgroundImage: `url(${rancho.foto_url})` }
            : { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
        }
      />
      {!rancho.foto_url && (
        <span className="absolute inset-0 flex items-center justify-center text-white/20 [&_svg]:h-16 [&_svg]:w-16">
          {CATEGORIA_ICONO[rancho.categoria]}
        </span>
      )}

      {/* Oscurecido solo abajo, donde va el texto: así la foto se ve
          limpia en la mitad de arriba en vez de quedar toda apagada. */}
      <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black/95 via-black/70 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />

      <div className="relative flex items-start justify-between gap-2 p-3.5">
        {rancho.provincia && (
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink shadow-sm">
            {rancho.provincia}
          </span>
        )}
        <span className="truncate rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {etiqueta}
        </span>
      </div>

      <div className="relative mt-auto flex flex-col p-4.5">
        <h3 className="titulo text-[19px] text-white drop-shadow-sm">
          {rancho.nombre}
        </h3>
        {ubicacion && (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/70">
            <IconPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{ubicacion}</span>
          </p>
        )}

        <div className="mt-3.5 flex items-end justify-between gap-3">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-white/55">
              {precio ? "Desde" : "Precio"}
            </div>
            <div className="titulo mt-0.5 text-[19px] text-white">
              {precio ?? "A consultar"}
            </div>
          </div>
          {capacidad && (
            <span className="pb-1 text-right text-[11.5px] leading-tight text-white/70">
              {capacidad}
            </span>
          )}
        </div>

        <span
          className={`mt-3.5 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-bold transition-colors ${
            esAventurea || puedeReservar
              ? "bg-white text-aventurea-orange-dark group-hover:bg-aventurea-orange group-hover:text-white"
              : "border border-white/35 text-white group-hover:bg-white/15"
          }`}
        >
          {esAventurea || puedeReservar ? "Reservar ahora" : "Ver más"}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
