"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconCompass, IconFiltro, IconSearch } from "@/components/icons";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import RielProveedores from "@/components/riel-proveedores";
import { fechaISO, fmtFechaCorta, proximaFechaLibre } from "@/lib/fechas";
import {
  CATEGORIAS,
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

const POR_PAGINA = 14;
// Como pidió el dueño: máximo 12 tarjetas por categoría en la portada
// — para ver más está el "Ver todo" de cada riel.
const POR_RIEL = 12;
const DIAS_A_MOSTRAR = 60;
const DIAS_SEMANA_CORTO = ["D", "L", "M", "M", "J", "V", "S"];


type FechaOcupada = { rancho_id: string; fecha: string };

export default function Directorio({
  ranchos,
  fechasOcupadas,
  calificaciones,
  favoritosIniciales,
  sesionActiva,
}: {
  ranchos: Rancho[];
  fechasOcupadas: FechaOcupada[];
  calificaciones: Calificacion[];
  favoritosIniciales: string[];
  sesionActiva: boolean;
}) {
  const calificacionPorRancho = useMemo(() => {
    const acc = new Map<string, Calificacion>();
    calificaciones.forEach((c) => acc.set(c.rancho_id, c));
    return acc;
  }, [calificaciones]);

  const favoritosIds = useMemo(() => new Set(favoritosIniciales), [favoritosIniciales]);
  const searchParams = useSearchParams();
  // Así los rieles del home pueden linkear "ver todo" a una categoría o
  // zona ya filtrada (?categoria=lugares&provincia=Alajuela) en vez de
  // mandar siempre al directorio completo sin contexto.
  const [tab, setTab] = useState<Categoria | "todos">(() => {
    const inicial = searchParams.get("categoria");
    return inicial && (CATEGORIAS as readonly string[]).includes(inicial)
      ? (inicial as Categoria)
      : "todos";
  });
  const [subcategoria, setSubcategoria] = useState(() => searchParams.get("subcategoria") ?? "");
  const [texto, setTexto] = useState("");
  const [provincia, setProvincia] = useState(() => searchParams.get("provincia") ?? "");
  const [canton, setCanton] = useState(() => searchParams.get("canton") ?? "");
  const [fecha, setFecha] = useState("");
  const [invitados, setInvitados] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [pagina, setPagina] = useState(1);
  const [menuAbierto, setMenuAbierto] = useState<
    Categoria | "donde" | "cuando" | "personas" | "filtros" | null
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

  // Solo "lugares" reserva por fecha en línea — el resto (catering, DJ,
  // decoración...) se contrata por WhatsApp y no tiene calendario, así
  // que "Cuándo" no los excluye nunca, sea cual sea la fecha elegida.
  const ocupadosPorFecha = useMemo(() => {
    const acc = new Map<string, Set<string>>();
    fechasOcupadas.forEach((f) => {
      if (!acc.has(f.fecha)) acc.set(f.fecha, new Set());
      acc.get(f.fecha)!.add(f.rancho_id);
    });
    return acc;
  }, [fechasOcupadas]);

  // De cara al selector de "Cuándo": un día se deshabilita solo si TODOS
  // los lugares que coinciden con el resto de filtros ya están confirmados
  // ese día — no si falta uno solo por confirmar.
  const lugaresRelevantes = useMemo(
    () =>
      ranchos.filter(
        (r) =>
          r.categoria === "lugares" &&
          (tab === "todos" || tab === "lugares") &&
          (!subcategoria || r.subcategoria === subcategoria) &&
          (!provincia || r.provincia === provincia) &&
          (!canton || r.canton === canton),
      ),
    [ranchos, tab, subcategoria, provincia, canton],
  );

  const fechasSinDisponibilidad = useMemo(() => {
    if (lugaresRelevantes.length === 0) return new Set<string>();
    const sinCupo = new Set<string>();
    ocupadosPorFecha.forEach((idsOcupados, fechaIso) => {
      if (lugaresRelevantes.every((r) => idsOcupados.has(r.id))) {
        sinCupo.add(fechaIso);
      }
    });
    return sinCupo;
  }, [lugaresRelevantes, ocupadosPorFecha]);

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
      if (fecha && r.categoria === "lugares" && ocupadosPorFecha.get(fecha)?.has(r.id)) {
        return false;
      }
      if (invitadosNum && (r.capacidad_max ?? 0) < invitadosNum) return false;
      if (precioMaxNum && (r.precio_desde ?? 0) > precioMaxNum) return false;
      return true;
    });
  }, [
    ranchos,
    tab,
    subcategoria,
    texto,
    provincia,
    canton,
    fecha,
    ocupadosPorFecha,
    invitadosNum,
    precioMaxNum,
  ]);

  const hayAlgo =
    tab !== "todos" ||
    !!subcategoria ||
    !!texto ||
    !!provincia ||
    !!canton ||
    !!fecha ||
    !!invitados ||
    !!precioMax;

  // Sin ningún filtro, la portada se arma como rieles horizontales por
  // categoría (en el orden de la barra de arriba), de hasta 12 cada uno.
  // Apenas se filtra algo, vuelve la grilla plana con paginación.
  const rieles = useMemo(() => {
    if (hayAlgo) return [];
    return CATEGORIAS.map((cat) => ({
      cat,
      items: ranchos.filter((r) => r.categoria === cat).slice(0, POR_RIEL),
    })).filter((g) => g.items.length > 0);
  }, [ranchos, hayAlgo]);

  const proximasLibres = useMemo(() => {
    const acc = new Map<string, string | null>();
    ranchos.forEach((r) => {
      if (r.categoria === "lugares") {
        acc.set(r.id, proximaFechaLibre(r.id, ocupadosPorFecha));
      }
    });
    return acc;
  }, [ranchos, ocupadosPorFecha]);

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
    setFecha("");
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

  // Solo "lugares" reserva por fecha en línea — para el resto, "Cuándo"
  // no aplica: el buscador de arriba cambia esa casilla por una de texto
  // libre ("¿Qué necesitás?"), y por eso el buscador de nombre de abajo
  // (que haría lo mismo) se oculta para no repetirse.
  const mostrarCuando = tab === "todos" || tab === "lugares";

  const categoriaAbierta =
    typeof menuAbierto === "string" &&
    (CATEGORIAS as readonly string[]).includes(menuAbierto)
      ? (menuAbierto as Categoria)
      : null;

  return (
    <div>
      <RevealOnScroll />

      {/* Buscador + categorías en un bloque sticky: el título scrollea,
          pero la búsqueda queda siempre a mano bajo el header — patrón
          Airbnb. El fondo con blur evita que las cards se lean debajo. */}
      <div className="sticky top-14 z-30 -mx-6 bg-aventurea-cream/95 px-6 pt-3 backdrop-blur-sm lg:-mx-10 lg:px-10">
      {/* Buscador segmentado: Dónde · Cuándo · Personas (Lugares/Todos) o
          Dónde · ¿Qué necesitás? · Personas para el resto de categorías,
          que no reservan por fecha en línea. */}
      <div className="relative z-30 mx-auto mb-4 flex w-full max-w-[720px] items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-full border border-aventurea-line bg-aventurea-surface shadow-sm transition-shadow hover:shadow-md">
          <SegmentoBusqueda
            label="Dónde"
            valor={canton || provincia || "Todo Costa Rica"}
            activo={menuAbierto === "donde"}
            onClick={() => setMenuAbierto((p) => (p === "donde" ? null : "donde"))}
          />
          {mostrarCuando ? (
            <SegmentoBusqueda
              borde
              label="Cuándo"
              valor={fecha ? fmtFechaCorta(fecha) : "Agregá la fecha"}
              activo={menuAbierto === "cuando"}
              onClick={() => setMenuAbierto((p) => (p === "cuando" ? null : "cuando"))}
            />
          ) : (
            <SegmentoTexto
              label="¿Qué necesitás?"
              placeholder="Ej. catering, DJ, decoración..."
              value={texto}
              onChange={(v) => {
                setTexto(v);
                setPagina(1);
              }}
            />
          )}
          <SegmentoBusqueda
            borde
            className="hidden sm:flex"
            label="Personas"
            valor={invitados || "¿Cuántas?"}
            activo={menuAbierto === "personas"}
            onClick={() => setMenuAbierto((p) => (p === "personas" ? null : "personas"))}
          />
          <button
            type="button"
            onClick={soltarMenu}
            aria-label="Buscar"
            className="m-1.5 flex w-11 shrink-0 items-center justify-center rounded-full bg-aventurea-orange text-white hover:bg-aventurea-orange-dark"
          >
            <IconSearch className="h-[17px] w-[17px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((prev) => (prev === "filtros" ? null : "filtros"))}
          aria-label="Más filtros"
          className={`flex w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
            precioMax || menuAbierto === "filtros"
              ? "border-aventurea-navy text-aventurea-navy"
              : "border-aventurea-line text-aventurea-ink hover:border-aventurea-navy"
          }`}
        >
          <IconFiltro className="h-4 w-4" />
        </button>

        {(menuAbierto === "donde" ||
          menuAbierto === "cuando" ||
          menuAbierto === "personas") && (
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={soltarMenu}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute left-0 right-0 top-full z-20 mx-auto mt-2 rounded-[16px] border border-aventurea-line bg-aventurea-surface p-4 shadow-xl">
              {menuAbierto === "donde" && (
                <div>
                  <h4 className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Provincia
                  </h4>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
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
                      <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
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
              )}

              {menuAbierto === "cuando" && (
                <SelectorFecha
                  fecha={fecha}
                  deshabilitadas={fechasSinDisponibilidad}
                  hayLugares={lugaresRelevantes.length > 0}
                  onElegir={(iso) => {
                    setFecha(iso);
                    setPagina(1);
                    soltarMenu();
                  }}
                />
              )}

              {menuAbierto === "personas" && (
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
              )}
            </div>
          </>
        )}
      </div>

      {/* Barra de categorías: ícono + label. Sin nada fijo a la derecha
          que la tape — el degradado de la punta es la única pista de
          que sigue scrolleando (antes "Filtros" hacía de tapón visual y
          escondía Organización/Decoración/Otros servicios). */}
      <div className="relative z-20 border-b border-aventurea-line">
        <div className="flex gap-6 overflow-x-auto lg:justify-center lg:gap-8">
          <CategoriaTab
            label="Todos"
            icono={<IconCompass className="h-full w-full" />}
            activo={tab === "todos" && !subcategoria}
            onClick={() => elegirCategoria("todos")}
          />
          {CATEGORIAS.map((cat) => (
            <CategoriaTab
              key={cat}
              label={CATEGORIA_LABEL[cat]}
              icono={CATEGORIA_ICONO[cat]}
              activo={tab === cat}
              onClick={() => setMenuAbierto((prev) => (prev === cat ? null : cat))}
            />
          ))}
          {/* Relleno para que el degradado nunca tape la última pestaña. */}
          <div className="w-2 shrink-0" aria-hidden />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-aventurea-cream to-transparent"
        />
      </div>
      </div>{/* fin del bloque sticky */}

      <div className="mt-4" />

      {(menuAbierto === "filtros" || categoriaAbierta) && (
        <div className="relative z-20 mb-4">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={soltarMenu}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="relative z-20 rounded-[16px] border border-aventurea-line bg-aventurea-surface p-4 shadow-xl">
            {menuAbierto === "filtros" ? (
              <div className="max-w-xs">
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
            ) : categoriaAbierta ? (
              <>
                <button
                  type="button"
                  onClick={() => elegirCategoria(categoriaAbierta)}
                  className="mb-2 text-[12px] font-bold text-aventurea-navy hover:underline"
                >
                  Ver todo en {CATEGORIA_LABEL[categoriaAbierta]} (
                  {conteoPorCategoria[categoriaAbierta] ?? 0}) →
                </button>
                <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                  {SUBCATEGORIAS[categoriaAbierta].map((s) => (
                    <FilterRow
                      key={s.id}
                      label={s.label}
                      count={conteoPorSubcategoria[s.id] ?? 0}
                      active={subcategoria === s.id}
                      onClick={() => elegirSubcategoria(categoriaAbierta, s.id)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Búsqueda por nombre — complementa al buscador de arriba, que es
          por ubicación/fecha/capacidad. En el resto de categorías esa
          misma casilla de texto ya vive arriba ("¿Qué necesitás?"), así
          que acá abajo no se repite. */}
      {mostrarCuando && (
        <div className="relative mb-4">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aventurea-ink-soft">
            <IconSearch className="h-[15px] w-[15px]" />
          </span>
          <input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscá un proveedor por nombre..."
            className="w-full rounded-[12px] border border-transparent bg-aventurea-cream-2 py-3 pl-11 pr-3 text-[14px] text-aventurea-ink placeholder:text-zinc-500 focus:border-aventurea-navy/40 focus:outline-none"
          />
        </div>
      )}

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
          {fecha && (
            <Chip label={fmtFechaCorta(fecha)} onQuitar={() => setFecha("")} />
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
      ) : !hayAlgo ? (
        <div className="divide-y divide-aventurea-line">
          {rieles.map((g) => (
            <RielProveedores
              key={g.cat}
              titulo={`${CATEGORIA_LABEL[g.cat]} para tu evento`}
              items={g.items}
              onVerTodo={() => {
                elegirCategoria(g.cat);
                subirAlInicio();
              }}
              calificaciones={calificacionPorRancho}
              proximasLibres={proximasLibres}
              favoritosIds={favoritosIds}
              sesionActiva={sesionActiva}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
            {visibles.map((r, i) => (
              <RanchoCard
                key={r.id}
                rancho={r}
                index={i}
                calificacion={calificacionPorRancho.get(r.id) ?? null}
                proximaLibre={
                  r.categoria === "lugares"
                    ? proximaFechaLibre(r.id, ocupadosPorFecha)
                    : undefined
                }
                favoritoInicial={favoritosIds.has(r.id)}
                sesionActiva={sesionActiva}
              />
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
            Bookea y llegá a más clientes en todo el país.
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

function SegmentoBusqueda({
  label,
  valor,
  activo,
  borde,
  className = "",
  onClick,
}: {
  label: string;
  valor: string;
  activo: boolean;
  borde?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 flex-col px-4 py-2.5 text-left transition-colors sm:px-5 ${
        borde ? "border-l border-aventurea-line" : ""
      } ${activo ? "bg-aventurea-cream-2" : "hover:bg-aventurea-cream-2/60"} ${className}`}
    >
      <span className="text-[11px] font-bold text-aventurea-ink">{label}</span>
      <span className="truncate text-[13px] text-aventurea-ink-soft">{valor}</span>
    </button>
  );
}

/** Como SegmentoBusqueda, pero editable ahí mismo — sin popover, porque
 *  es texto libre y no una lista para elegir. */
function SegmentoTexto({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center border-l border-aventurea-line px-4 py-2.5 sm:px-5">
      <label className="text-[11px] font-bold text-aventurea-ink">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="truncate bg-transparent text-[13px] text-aventurea-ink placeholder:text-aventurea-ink-soft focus:outline-none"
      />
    </div>
  );
}

function CategoriaTab({
  label,
  icono,
  activo,
  onClick,
}: {
  label: string;
  icono: React.ReactNode;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 flex-col items-center gap-1.5 whitespace-nowrap border-b-[2.5px] pb-2.5 pt-3 transition-colors ${
        activo
          ? "border-aventurea-ink text-aventurea-ink"
          : "border-transparent text-aventurea-ink-soft hover:text-aventurea-ink"
      }`}
    >
      <span className={`h-[25px] w-[25px] ${activo ? "" : "opacity-70"}`}>{icono}</span>
      <span className="text-[12.5px] font-bold">{label}</span>
    </button>
  );
}

function SelectorFecha({
  fecha,
  deshabilitadas,
  hayLugares,
  onElegir,
}: {
  fecha: string;
  deshabilitadas: Set<string>;
  hayLugares: boolean;
  onElegir: (iso: string) => void;
}) {
  const dias = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Array.from({ length: DIAS_A_MOSTRAR }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  return (
    <div>
      <h4 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        Elegí una fecha
      </h4>
      <p className="mb-3 px-1 text-[12px] text-aventurea-ink-soft">
        {hayLugares
          ? "Solo afecta a Lugares — los demás servicios no bloquean fechas: reservás la tuya en la página de cada uno."
          : "No hay lugares con calendario en línea para esta búsqueda todavía."}
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {dias.map((d) => {
          const iso = fechaISO(d);
          const bloqueada = deshabilitadas.has(iso);
          const elegida = fecha === iso;
          return (
            <button
              key={iso}
              type="button"
              disabled={bloqueada}
              onClick={() => onElegir(iso)}
              className={`flex flex-col items-center rounded-lg py-1.5 text-center transition-colors ${
                elegida
                  ? "bg-aventurea-navy text-white"
                  : bloqueada
                    ? "cursor-not-allowed text-zinc-300 line-through"
                    : "text-aventurea-ink hover:bg-aventurea-cream-2"
              }`}
            >
              <span className="text-[9px] font-bold uppercase">
                {DIAS_SEMANA_CORTO[d.getDay()]}
              </span>
              <span className="text-[13px] font-bold">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
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

