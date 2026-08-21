"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { hoyISOCR } from "@/lib/fechas";
import { normalizarBusquedaFood } from "@/lib/food/tarjetas";
import {
  CATEGORIAS_DEMO,
  horaBonita,
  mejorDescuento,
  momentoDeHora,
  type CategoriaDemo,
  type RestauranteDemo,
} from "@/lib/food/demo/tipos";
import { RESTAURANTES_DEMO } from "@/lib/food/demo/datos";
import CardDemo from "@/components/food/demo/card-demo";
import FiltrosDemoPanel, {
  FILTROS_VACIOS,
  hayFiltros,
  type FiltrosDemo,
} from "@/components/food/demo/filtros-demo";
import Revelar from "@/components/revelar";
import {
  IconCalendarLine,
  IconClock,
  IconFiltro,
  IconPin,
  IconSearch,
  IconStar,
  IconTagLine,
  IconUsers,
} from "@/components/icons";

const FOTO_CATEGORIA: Record<CategoriaDemo, string> = {
  Italiana: "/food-demo/pasta.jpg",
  Sushi: "/food-demo/sushi.jpg",
  Hamburguesas: "/food-demo/hamburguesa.jpg",
  Carnes: "/food-demo/carne.jpg",
  Mexicana: "/food-demo/cat-mexicana.jpg",
  Asiática: "/food-demo/cat-asiatica.jpg",
  Mediterránea: "/food-demo/cat-mediterranea.jpg",
  Café: "/food-demo/cat-cafe.jpg",
  Internacional: "/food-demo/cat-internacional.jpg",
  Pizza: "/food-demo/cat-pizza.jpg",
};

type Orden =
  | "recomendados"
  | "descuento"
  | "rating"
  | "precio-asc"
  | "precio-desc"
  | "nuevos";

const ORDENES: { id: Orden; label: string }[] = [
  { id: "recomendados", label: "Recomendados" },
  { id: "descuento", label: "Mayor descuento" },
  { id: "rating", label: "Mejor rating" },
  { id: "precio-asc", label: "Precio: menor a mayor" },
  { id: "precio-desc", label: "Precio: mayor a menor" },
  { id: "nuevos", label: "Nuevos" },
];

const POR_PAGINA = 12;

const BENEFICIOS = [
  {
    Icono: IconTagLine,
    titulo: "Ahorrá",
    texto: "Encontrá descuentos reales según el horario — el % queda fijo en tu reserva.",
  },
  {
    Icono: IconClock,
    titulo: "Elegí",
    texto: "Elegí el horario que mejor se adapte a vos y confirmá en segundos.",
  },
  {
    Icono: IconPin,
    titulo: "Descubrí",
    texto: "Encontrá restaurantes y lugares nuevos cerca de vos.",
  },
];

function pasaBusqueda(r: RestauranteDemo, texto: string, ubicacion: string): boolean {
  if (texto) {
    const aguja = normalizarBusquedaFood(texto);
    const pajar = normalizarBusquedaFood(
      [r.nombre, r.cocina, r.categoria, r.zona, r.descripcion].join(" "),
    );
    if (!pajar.includes(aguja)) return false;
  }
  if (ubicacion) {
    const aguja = normalizarBusquedaFood(ubicacion);
    const pajar = normalizarBusquedaFood(`${r.zona} ${r.direccion}`);
    if (!pajar.includes(aguja)) return false;
  }
  return true;
}

function pasaFiltros(r: RestauranteDemo, f: FiltrosDemo): boolean {
  if (f.zona && r.zona !== f.zona) return false;
  if (f.categoria && r.categoria !== f.categoria) return false;
  if (f.descuentoMin && mejorDescuento(r) < f.descuentoMin) return false;
  if (f.ratingMin && r.rating < f.ratingMin) return false;
  if (f.precio && r.precioNivel !== f.precio) return false;
  if (f.momento && !r.promociones.some((p) => momentoDeHora(p.hora) === f.momento)) return false;
  return true;
}

function ordenar(lista: RestauranteDemo[], orden: Orden): RestauranteDemo[] {
  const copia = [...lista];
  switch (orden) {
    case "descuento":
      return copia.sort((a, b) => mejorDescuento(b) - mejorDescuento(a));
    case "rating":
      return copia.sort((a, b) => b.rating - a.rating || b.resenas - a.resenas);
    case "precio-asc":
      return copia.sort((a, b) => a.precioPromedio - b.precioPromedio);
    case "precio-desc":
      return copia.sort((a, b) => b.precioPromedio - a.precioPromedio);
    case "nuevos":
      return copia.sort(
        (a, b) => Number(b.esNuevo ?? false) - Number(a.esNuevo ?? false) || b.rating - a.rating,
      );
    default:
      // Recomendados: rating con un empujón por volumen de reseñas.
      return copia.sort(
        (a, b) =>
          b.rating * 10 + Math.log10(b.resenas) - (a.rating * 10 + Math.log10(a.resenas)),
      );
  }
}

export default function MarketplaceDemo() {
  const idBase = useId();
  const hoy = hoyISOCR();

  const [texto, setTexto] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [personas, setPersonas] = useState(2);
  const [fecha, setFecha] = useState("");
  const [busqueda, setBusqueda] = useState({ texto: "", ubicacion: "" });
  const [filtros, setFiltrosCrudo] = useState<FiltrosDemo>(FILTROS_VACIOS);
  const [orden, setOrden] = useState<Orden>("recomendados");
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [visibles, setVisibles] = useState(POR_PAGINA);

  function setFiltros(f: FiltrosDemo) {
    setFiltrosCrudo(f);
    setVisibles(POR_PAGINA);
  }

  const filtrados = useMemo(
    () =>
      ordenar(
        RESTAURANTES_DEMO.filter(
          (r) => pasaBusqueda(r, busqueda.texto, busqueda.ubicacion) && pasaFiltros(r, filtros),
        ),
        orden,
      ),
    [busqueda, filtros, orden],
  );

  // Las mejores franjas del set filtrado (top 5 por %, en orden de
  // hora) — la sección interactiva "Elegí tu horario y ahorrá". El
  // click lleva a la ficha con esa hora preseleccionada.
  const mejoresFranjas = useMemo(() => {
    const top = filtrados
      .flatMap((r) =>
        r.promociones.map((p) => ({ ...p, nombre: r.nombre, slug: r.slug })),
      )
      .sort((a, b) => b.descuento - a.descuento)
      .slice(0, 5);
    const mejor = top.reduce((max, f) => Math.max(max, f.descuento), 0);
    return top
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((f) => ({ ...f, esLaMejor: f.descuento === mejor }));
  }, [filtrados]);

  const populares = useMemo(
    () => ordenar(RESTAURANTES_DEMO, "rating").slice(0, 8),
    [],
  );

  function buscarCategoria(c: CategoriaDemo) {
    setFiltros({ ...filtros, categoria: filtros.categoria === c ? null : c });
    document.getElementById("ofertas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function limpiarTodo() {
    setBusqueda({ texto: "", ubicacion: "" });
    setTexto("");
    setUbicacion("");
    setFiltros(FILTROS_VACIOS);
  }

  return (
    <>
      {/* ── Hero oscuro premium (mockup del dueño, ago 2026) ───────
          Fondo casi negro con brillo naranja cálido, el platillo
          gourmet sobre fondo negro fundido a la derecha, y puntos
          decorativos — la foto es del set ya verificado (fondo negro
          puro, se integra sin costura). */}
      <section className="relative overflow-hidden bg-[#0b0b0e]">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[70%] sm:w-[55%]">
          <Image
            src="/food-demo/r/marea-nikkei-1.jpg"
            alt=""
            fill
            priority
            sizes="60vw"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg,#0b0b0e 0%,rgba(11,11,14,.6) 40%,rgba(11,11,14,.08) 75%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-28"
            style={{ background: "linear-gradient(180deg,transparent,#0b0b0e)" }}
          />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-44 right-[22%] h-[560px] w-[560px] rounded-full opacity-35 blur-[130px]"
            style={{ background: "radial-gradient(circle, rgba(238,116,32,.6), transparent 65%)" }}
          />
          <div
            className="absolute bottom-8 left-6 h-28 w-44 opacity-25"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,.4) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1280px] px-4 pb-12 pt-14 sm:px-6 sm:pb-14 sm:pt-20">
          <p className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-aventurea-orange" />
            Marketplace gastronómico
          </p>
          <h1 className="titulo mt-4 max-w-[13ch] text-[34px] uppercase leading-[1.04] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
            Descubrí dónde comer <span className="text-aventurea-orange">hoy</span>
          </h1>
          <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-white/85 sm:text-[16px]">
            Reservá restaurantes, encontrá descuentos y elegí el horario
            que más te conviene.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusqueda({ texto, ubicacion });
              setVisibles(POR_PAGINA);
              document.getElementById("ofertas")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-8 grid grid-cols-1 gap-2 rounded-3xl bg-white p-2.5 shadow-flotante sm:grid-cols-2 sm:gap-0 lg:grid-cols-[1.1fr_1.2fr_0.8fr_0.9fr_auto]"
          >
            <Campo id={`${idBase}-ubicacion`} label="Ubicación" icono={<IconPin className="h-4 w-4" />}>
              <input
                id={`${idBase}-ubicacion`}
                type="text"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej. Escazú, Heredia..."
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none placeholder:text-zinc-400"
              />
            </Campo>
            <Campo
              id={`${idBase}-texto`}
              label="¿Qué buscás?"
              icono={<IconSearch className="h-4 w-4" />}
              className="border-t sm:border-l sm:border-t-0"
            >
              <input
                id={`${idBase}-texto`}
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Restaurante, comida o zona"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none placeholder:text-zinc-400"
              />
            </Campo>
            <Campo
              id={`${idBase}-personas`}
              label="Personas"
              icono={<IconUsers className="h-4 w-4" />}
              className="border-t lg:border-l lg:border-t-0"
            >
              <select
                id={`${idBase}-personas`}
                value={personas}
                onChange={(e) => setPersonas(Number(e.target.value))}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "persona" : "personas"}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              id={`${idBase}-fecha`}
              label="Fecha"
              icono={<IconCalendarLine className="h-4 w-4" />}
              className="border-t sm:border-l"
            >
              <input
                id={`${idBase}-fecha`}
                type="date"
                min={hoy}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none"
              />
            </Campo>
            <div className="flex items-center border-t p-1 pt-2.5 sm:col-span-2 sm:border-t lg:col-span-1 lg:border-l lg:border-t-0 lg:p-1.5">
              <button type="submit" className="btn-naranja presionable h-12 w-full lg:w-auto lg:px-6">
                Buscar
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── ¿Qué te apetece? ───────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-6 sm:pt-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="titulo text-[20px] uppercase tracking-tight text-aventurea-navy sm:text-[24px]">
            ¿Qué te apetece?
          </h2>
          {filtros.categoria !== null && (
            <button
              type="button"
              onClick={() => setFiltros({ ...filtros, categoria: null })}
              className="shrink-0 text-[13px] font-bold text-aventurea-orange hover:underline"
            >
              Ver todo
            </button>
          )}
        </div>
        <div className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-5 sm:px-0 lg:justify-between">
          {CATEGORIAS_DEMO.map((c) => {
            const activa = filtros.categoria === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => buscarCategoria(c)}
                aria-pressed={activa}
                className="presionable group flex w-[84px] shrink-0 flex-col items-center gap-2.5 sm:w-[96px]"
              >
                <span
                  className={`relative block h-[72px] w-[72px] overflow-hidden rounded-full border-2 shadow-plano transition-all sm:h-[84px] sm:w-[84px] ${
                    activa
                      ? "border-aventurea-orange ring-2 ring-aventurea-orange/30"
                      : "border-white group-hover:border-aventurea-orange/50"
                  }`}
                >
                  <Image
                    src={FOTO_CATEGORIA[c]}
                    alt=""
                    fill
                    sizes="84px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </span>
                <span className={`text-[12px] font-bold ${activa ? "text-aventurea-orange-dark" : "text-aventurea-ink"}`}>
                  {c}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Ofertas + filtros ──────────────────────────────────────── */}
      <section id="ofertas" className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <h2 className="titulo text-[22px] uppercase tracking-tight text-aventurea-navy sm:text-[26px]">
              <span aria-hidden>🔥</span> Ofertas cerca de vos
            </h2>
            <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
              Aprovechá descuentos especiales en restaurantes de tu zona.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPanelAbierto(true)}
              className={`presionable flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-bold transition-colors ${
                hayFiltros(filtros)
                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                  : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
              }`}
            >
              <IconFiltro className="h-4 w-4" />
              Filtros
              {hayFiltros(filtros) && (
                <span className="rounded-full bg-aventurea-orange px-1.5 text-[11px] font-extrabold text-white">
                  {Object.values(filtros).filter((v) => v !== null).length}
                </span>
              )}
            </button>
            <label className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-3 py-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                Ordenar
              </span>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className="bg-transparent text-[13px] font-bold text-aventurea-ink outline-none"
              >
                {ORDENES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="hidden shrink-0 text-[13px] font-bold text-aventurea-ink-soft sm:block">
              {filtrados.length} {filtrados.length === 1 ? "restaurante" : "restaurantes"}
            </p>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-aventurea-line bg-white p-10 text-center shadow-plano">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              No encontramos restaurantes con esos filtros
            </p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Probá con otra palabra, otra zona o quitá algún filtro.
            </p>
            <button type="button" onClick={limpiarTodo} className="btn-contorno presionable mt-6">
              Ver todos los restaurantes
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.slice(0, visibles).map((r, i) => (
                <Revelar key={r.slug} indice={i % POR_PAGINA}>
                  <CardDemo r={r} prioridad={i < 3} />
                </Revelar>
              ))}
            </div>
            {filtrados.length > visibles && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVisibles((v) => v + POR_PAGINA)}
                  className="btn-contorno presionable"
                >
                  Mostrar más restaurantes
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Elegí tu horario y ahorrá ──────────────────────────────── */}
      {mejoresFranjas.length > 0 && (
        <section className="border-y border-aventurea-line bg-aventurea-cream-2">
          <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-12">
            <h2 className="titulo text-[22px] uppercase tracking-tight text-aventurea-navy sm:text-[26px]">
              Elegí tu horario y ahorrá
            </h2>
            <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
              Los descuentos pueden cambiar según la hora. Elegí el momento que más te convenga.
            </p>
            <div className="-mx-4 mt-7 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
              {mejoresFranjas.map((f) => (
                <Link
                  key={`${f.slug}-${f.hora}`}
                  href={`/food/demo/restaurante/${f.slug}?hora=${encodeURIComponent(f.hora)}`}
                  className={`presionable relative flex w-[150px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 pb-4 pt-5 text-center transition-all lg:w-auto ${
                    f.esLaMejor
                      ? "border-aventurea-orange bg-aventurea-orange text-white shadow-elevado"
                      : "border-aventurea-line bg-white text-aventurea-ink shadow-plano hover:border-aventurea-orange/60"
                  }`}
                >
                  {f.esLaMejor && (
                    <span className="absolute -top-2.5 rounded-full bg-aventurea-navy px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      Mejor descuento
                    </span>
                  )}
                  <span className="text-[20px] font-extrabold leading-none">{horaBonita(f.hora)}</span>
                  <span className={`text-[20px] font-extrabold leading-none ${f.esLaMejor ? "text-white" : "text-aventurea-orange"}`}>
                    −{f.descuento}%
                  </span>
                  <span className={`mt-1 w-full truncate text-[11px] font-bold ${f.esLaMejor ? "text-white/90" : "text-aventurea-ink-soft"}`}>
                    {f.nombre}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Restaurantes populares ─────────────────────────────────── */}
      <section id="restaurantes" className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12">
        <h2 className="titulo text-[22px] uppercase tracking-tight text-aventurea-navy sm:text-[26px]">
          <span aria-hidden>⭐</span> Restaurantes populares
        </h2>
        <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {populares.map((r) => (
            <Link
              key={r.slug}
              href={`/food/demo/restaurante/${r.slug}`}
              className="presionable group relative block h-[160px] w-[240px] shrink-0 overflow-hidden rounded-2xl bg-aventurea-navy lg:w-auto"
            >
              <Image
                src={r.fotoPrincipal}
                alt={r.nombre}
                fill
                sizes="(max-width: 1024px) 240px, 300px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                <p className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-extrabold">{r.nombre}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[12px] font-extrabold">
                    <IconStar className="h-3 w-3 text-amber-400" />
                    {r.rating.toFixed(1)}
                  </span>
                </p>
                <p className="truncate text-[11.5px] text-white/80">
                  {r.zona} · {r.cocina}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Explorá por tipo de comida ─────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-12">
        <h2 className="titulo text-[22px] uppercase tracking-tight text-aventurea-navy sm:text-[26px]">
          Explorá por tipo de comida
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIAS_DEMO.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => buscarCategoria(c)}
              className="presionable group relative block h-[110px] overflow-hidden rounded-2xl bg-aventurea-navy text-left sm:h-[130px]"
            >
              <Image
                src={FOTO_CATEGORIA[c]}
                alt=""
                fill
                sizes="(max-width: 640px) 45vw, 240px"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute bottom-2.5 left-3 text-[13px] font-extrabold text-white">
                {c}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── ¿Por qué FOOD.BOOKEA? ──────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 pb-14 pt-2 sm:px-6">
        <h2 className="titulo text-[20px] uppercase tracking-tight text-aventurea-navy sm:text-[24px]">
          ¿Por qué FOOD.BOOKEA?
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {BENEFICIOS.map((b, i) => (
            <Revelar key={b.titulo} indice={i}>
              <div className="flex h-full items-start gap-4 rounded-3xl border border-aventurea-line bg-aventurea-cream-2 p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-white">
                  <b.Icono className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[15px] font-extrabold text-aventurea-ink">{b.titulo}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-aventurea-ink-soft">{b.texto}</p>
                </div>
              </div>
            </Revelar>
          ))}
        </div>
      </section>

      <FiltrosDemoPanel
        abierto={panelAbierto}
        filtros={filtros}
        onCambiar={setFiltros}
        onLimpiar={() => setFiltros(FILTROS_VACIOS)}
        onCerrar={() => setPanelAbierto(false)}
        resultados={filtrados.length}
      />
    </>
  );
}

function Campo({
  id,
  label,
  icono,
  className = "",
  children,
}: {
  id: string;
  label: string;
  icono: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 border-aventurea-line px-3.5 py-2 sm:py-1.5 ${className}`}>
      <label htmlFor={id} className="block text-[10px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
        {label}
      </label>
      <div className="mt-0.5 flex items-center gap-2.5">
        {/* Chip circular naranja del mockup — el ícono deja de ser gris. */}
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-aventurea-orange-light text-aventurea-orange-dark">
          {icono}
        </span>
        {children}
      </div>
    </div>
  );
}
