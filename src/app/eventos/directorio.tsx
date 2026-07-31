"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  IconCompass,
  IconFiltro,
  IconMail,
  IconSearch,
  IconSparkles,
} from "@/components/icons";
import { type Calificacion } from "@/components/rancho-card";
import RanchoCardGrande from "@/components/rancho-card-grande";
import RielProveedores from "@/components/riel-proveedores";
import { fechaISO, fmtFechaCorta, hoyISOCR, proximaFechaLibre } from "@/lib/fechas";
import { interpretarBusqueda, normalizarTexto } from "@/lib/busqueda";
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
  resenaPorRancho,
  favoritosIniciales,
  sesionActiva,
}: {
  ranchos: Rancho[];
  fechasOcupadas: FechaOcupada[];
  calificaciones: Calificacion[];
  /** rancho_id → el comentario de reseña más reciente, para citarlo. */
  resenaPorRancho: Record<string, string>;
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
  const [menuAbierto, setMenuAbierto] = useState<"filtros" | "acciones" | null>(null);

  const invitadosNum = parseInt(invitados) || 0;
  const precioMaxNum = parseInt(precioMax) || 0;

  // La lupa única entiende fechas: "3 de agosto", "03/08", "este
  // viernes"... La fecha escrita manda sobre la elegida en filtros.
  const hoy = useMemo(() => hoyISOCR(), []);
  const interpretada = useMemo(() => interpretarBusqueda(texto, hoy), [texto, hoy]);
  const fechaActiva = interpretada.fecha ?? (fecha || null);

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
    const q = interpretada.texto;
    return ranchos.filter((r) => {
      if (tab !== "todos" && r.categoria !== tab) return false;
      if (subcategoria && r.subcategoria !== subcategoria) return false;
      if (
        q &&
        !normalizarTexto(
          `${r.nombre} ${r.provincia ?? ""} ${r.canton ?? ""} ${r.descripcion ?? ""}`,
        ).includes(q)
      ) {
        return false;
      }
      if (provincia && r.provincia !== provincia) return false;
      if (canton && r.canton !== canton) return false;
      if (
        fechaActiva &&
        r.categoria === "lugares" &&
        ocupadosPorFecha.get(fechaActiva)?.has(r.id)
      ) {
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
    interpretada.texto,
    provincia,
    canton,
    fechaActiva,
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
    !!fechaActiva ||
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

  const refAcciones = useRef<HTMLDivElement>(null);

  // Cierre del menú de acciones con Escape y con clic fuera. El overlay
  // del propio menú no alcanza para el clic fuera: el backdrop-blur del
  // bloque sticky confina cualquier `fixed` interno a la barra, así que
  // el clic sobre el resto de la página se detecta acá, a nivel de
  // documento.
  useEffect(() => {
    if (menuAbierto !== "acciones") return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAbierto(null);
    };
    const alTocarFuera = (e: PointerEvent) => {
      if (refAcciones.current && !refAcciones.current.contains(e.target as Node)) {
        setMenuAbierto(null);
      }
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("pointerdown", alTocarFuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("pointerdown", alTocarFuera);
    };
  }, [menuAbierto]);

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

  // Solo "lugares" reserva por fecha en línea — en las demás categorías
  // el calendario del panel de filtros no aplica y no se muestra.
  const mostrarCuando = tab === "todos" || tab === "lugares";

  return (
    <div>
      <RevealOnScroll />

      {/* Buscador + categorías en un bloque sticky: el título scrollea,
          pero la búsqueda queda siempre a mano bajo el header — patrón
          Airbnb. El fondo con blur evita que las cards se lean debajo. */}
      {/* El bloque sticky va a sangre completa (de borde a borde de la
          pantalla, no solo del contenedor): antes su fondo terminaba
          donde terminaba el contenedor y se veía como una franja
          cortada sobre el degradado. */}
      <div className="sticky top-14 z-30 mx-[calc(50%-50vw)] bg-aventurea-cream-2/90 px-[calc(50vw-50%+1.5rem)] pt-3 backdrop-blur-sm lg:px-[calc(50vw-50%+2.5rem)]">
      {/* La lupa única: se escribe lo que se busca — un nombre, una
          zona o una fecha ("3 de agosto", "este viernes") — y el resto
          de filtros vive en el botón de al lado. Reemplaza al buscador
          segmentado tipo píldora, que no resolvía nada. */}
      <div className="relative z-30 mx-auto mb-4 flex w-full max-w-[720px] items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-aventurea-ink-soft">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPagina(1);
            }}
            placeholder='Buscá por nombre, zona o fecha — ej. "catering" o "3 de agosto"'
            className="h-12 w-full rounded-xl border border-aventurea-line bg-aventurea-surface pl-11 pr-4 text-[14px] text-aventurea-ink shadow-sm transition-shadow placeholder:text-zinc-500 hover:shadow-md focus:border-aventurea-navy/50 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((prev) => (prev === "filtros" ? null : "filtros"))}
          aria-label="Más filtros"
          className={`flex w-12 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            provincia || canton || invitados || precioMax || fechaActiva || menuAbierto === "filtros"
              ? "border-aventurea-navy text-aventurea-navy"
              : "border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy"
          }`}
        >
          <IconFiltro className="h-4 w-4" />
        </button>

        {/* Las acciones que antes eran chips en la barra de categorías
            (Boki, Publicá tu negocio, Lealtad) la desbordaban y en
            Windows aparecía un scrollbar horizontal enorme — ahora
            viven en este menú compacto al lado del botón de filtros. */}
        <div ref={refAcciones} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuAbierto((prev) => (prev === "acciones" ? null : "acciones"))}
            aria-label="Más opciones"
            aria-expanded={menuAbierto === "acciones"}
            className={`flex h-full w-12 items-center justify-center rounded-xl border transition-colors ${
              menuAbierto === "acciones"
                ? "border-aventurea-navy bg-aventurea-navy text-white"
                : "border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy"
            }`}
          >
            <IconSparkles className="h-4 w-4" />
          </button>

          {menuAbierto === "acciones" && (
            <>
              {/* Cubre la barra sticky (el backdrop-blur lo confina a
                  ella); el clic fuera en el resto de la página lo
                  resuelve el listener de pointerdown del componente. */}
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={soltarMenu}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 top-full z-20 mt-2 min-w-[230px] overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-xl">
                <a
                  href="#boki"
                  onClick={soltarMenu}
                  className="block px-4 py-3 text-[13.5px] font-bold text-aventurea-navy hover:bg-aventurea-cream-2"
                >
                  ✦ Asistente Boki
                </a>
                <Link
                  href="/publicar"
                  onClick={soltarMenu}
                  className="block px-4 py-3 text-[13.5px] font-bold text-aventurea-ink hover:bg-aventurea-cream-2"
                >
                  Publicá tu negocio
                </Link>
                <Link
                  href="/lealtad"
                  onClick={soltarMenu}
                  className="block px-4 py-3 text-[13.5px] font-bold text-aventurea-ink hover:bg-aventurea-cream-2"
                >
                  Lealtad
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Barra de navegación de dos niveles. Nivel 1: las categorías —
          un clic entra DIRECTO a la categoría y muestra sus tarjetas.
          Nivel 2 (adentro de una categoría): la misma barra muta a las
          subcategorías de esa categoría, con un botón de volver — el
          panel intermedio de subcategorías ya no hace falta. */}
      <div className="relative z-20 border-b border-aventurea-line">
        {tab === "todos" ? (
          <div className="flex gap-2.5 overflow-x-auto py-2.5 lg:justify-center">
            <CategoriaTab
              label="Todos"
              icono={<IconCompass className="h-full w-full" />}
              activo={!subcategoria}
              onClick={() => elegirCategoria("todos")}
            />
            {CATEGORIAS.map((cat) => (
              <CategoriaTab
                key={cat}
                label={CATEGORIA_LABEL[cat]}
                icono={CATEGORIA_ICONO[cat]}
                activo={false}
                onClick={() => elegirCategoria(cat)}
              />
            ))}
            {/* Invitaciones digitales no es un filtro: es el producto
                propio de Bookea, con su propia landing de venta. */}
            {/* En azul a propósito: es el producto propio de Bookea y
                debe distinguirse de los filtros naranjas de categoría. */}
            <Link
              href="/invitaciones"
              className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-aventurea-navy/40 bg-aventurea-blue-light pl-1.5 pr-4 text-aventurea-navy transition-colors hover:border-aventurea-navy hover:bg-aventurea-navy hover:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-navy text-white">
                <IconMail className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[13px] font-bold">Invitaciones Digitales</span>
            </Link>
            {/* Las acciones (Boki, Publicá tu negocio, Lealtad) ya no
                van acá: desbordaban la barra — viven en el menú del
                botón de IconSparkles junto al buscador. */}
            {/* Relleno para que el degradado nunca tape la última pestaña. */}
            <div className="w-2 shrink-0" aria-hidden />
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pb-2.5 pt-2.5 lg:justify-center">
            <button
              type="button"
              onClick={() => elegirCategoria("todos")}
              aria-label="Volver a todas las categorías"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-aventurea-line bg-aventurea-surface px-3.5 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
            >
              ← Volver
            </button>
            <span className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-bold text-aventurea-ink">
              <span className="h-[18px] w-[18px] text-aventurea-orange [&_svg]:h-full [&_svg]:w-full">
                {CATEGORIA_ICONO[tab]}
              </span>
              {CATEGORIA_LABEL[tab]}
            </span>
            <span aria-hidden className="h-5 w-px shrink-0 bg-aventurea-line" />
            <SubcategoriaPill
              label={`Todo (${conteoPorCategoria[tab] ?? 0})`}
              activo={!subcategoria}
              onClick={() => {
                setSubcategoria("");
                setPagina(1);
              }}
            />
            {SUBCATEGORIAS[tab]
              .filter((s) => (conteoPorSubcategoria[s.id] ?? 0) > 0)
              .map((s) => (
                <SubcategoriaPill
                  key={s.id}
                  label={`${s.label} (${conteoPorSubcategoria[s.id]})`}
                  activo={subcategoria === s.id}
                  onClick={() => elegirSubcategoria(tab, s.id)}
                />
              ))}
            <div className="w-2 shrink-0" aria-hidden />
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-aventurea-cream-2 to-transparent"
        />
      </div>
      </div>{/* fin del bloque sticky */}

      {/* Aire entre la línea de las categorías y los encabezados de
          los rieles (con sus flechas) — antes quedaban pegados. */}
      <div className="mt-8" />

      {/* El panel de filtros junta lo que antes estaba repartido en la
          píldora: la zona, la fecha, los invitados y el precio. */}
      {menuAbierto === "filtros" && (
        <div className="relative z-20 mb-4">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={soltarMenu}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="relative z-20 max-h-[70vh] overflow-y-auto rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 shadow-xl">
            <div className="grid gap-6 md:grid-cols-2">
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
                          onClick={() => elegirCanton(ct)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
              </div>

              {mostrarCuando && (
                <SelectorFecha
                  fecha={fechaActiva ?? ""}
                  deshabilitadas={fechasSinDisponibilidad}
                  hayLugares={lugaresRelevantes.length > 0}
                  onElegir={(iso) => {
                    setFecha(iso);
                    // Si la fecha venía escrita en la lupa, se limpia de
                    // ahí para que no queden dos fechas peleando.
                    if (interpretada.fecha) setTexto(interpretada.texto);
                    setPagina(1);
                  }}
                />
              )}
            </div>
          </div>
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
          {fechaActiva && (
            <Chip
              label={`Libre el ${fmtFechaCorta(fechaActiva)}`}
              onQuitar={() => {
                // Si la fecha venía escrita en la lupa, también se borra
                // de ahí — si no, el chip renacería al instante.
                if (interpretada.fecha) setTexto(interpretada.texto);
                setFecha("");
              }}
            />
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
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-10 text-center">
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
          {/* Tarjetas grandes en la vista filtrada: collage de fotos,
              reseña citada y botón con color — el detalle que la grilla
              compacta del home no da. Tres columnas máximo para que se
              aprecien. */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map((r, i) => (
              <RanchoCardGrande
                key={r.id}
                rancho={r}
                index={i}
                calificacion={calificacionPorRancho.get(r.id) ?? null}
                resena={resenaPorRancho[r.id] ?? null}
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
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-aventurea-orange/25 bg-aventurea-orange/5 px-6 py-5">
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
          href="/mi-rancho/nuevo"
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

/** Pastilla de subcategoría del nivel 2 de la barra de navegación. */
function SubcategoriaPill({
  label,
  activo,
  onClick,
}: {
  label: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`h-9 shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-ink"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Chip de categoría con el ícono en su burbuja naranja — reemplaza a
 * las pestañas de subrayado con ícono encima, que se veían genéricas
 * (y demasiado parecidas a Airbnb).
 */
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
      className={`flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border pl-1.5 pr-4 transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px] ${
          activo ? "bg-white/15 text-white" : "bg-aventurea-orange/10 text-aventurea-orange"
        }`}
      >
        {icono}
      </span>
      <span className="text-[13px] font-bold">{label}</span>
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
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-aventurea-orange/10 py-1 pl-3 pr-1.5 text-[12px] font-bold text-aventurea-orange">
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

