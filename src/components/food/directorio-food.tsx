"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { hoyISOCR } from "@/lib/fechas";
import { normalizarBusquedaFood, type TarjetaFood } from "@/lib/food/tarjetas";
import RestauranteCard from "@/components/food/restaurante-card";
import Revelar from "@/components/revelar";
import {
  IconCalendarLine,
  IconClock,
  IconPin,
  IconSearch,
  IconTagLine,
  IconUsers,
} from "@/components/icons";

/**
 * El catálogo de tipos de comida — alimenta las dos secciones visuales
 * del mockup del dueño ("¿Qué te apetece?" en círculos y "Explorá por
 * tipo de comida" en tiles). Cada entrada es un ATAJO DE BÚSQUEDA
 * honesto: tocarlo busca `consulta` contra nombre, descripción y platos
 * reales del menú (ver `pasaBusqueda`) — no existe una columna "tipo de
 * cocina" en la base y no la inventamos. Las fotos viven en
 * public/food-demo (las cat-*.jpg se bajaron de Unsplash, licencia
 * libre, sin contenido Unsplash+).
 */
const TIPOS_COMIDA: { label: string; archivo: string; consulta: string }[] = [
  { label: "Hamburguesas", archivo: "hamburguesa.jpg", consulta: "hamburguesa" },
  { label: "Pizza", archivo: "cat-pizza.jpg", consulta: "pizza" },
  { label: "Sushi", archivo: "sushi.jpg", consulta: "sushi" },
  { label: "Carnes", archivo: "carne.jpg", consulta: "carne" },
  { label: "Pollo", archivo: "cat-pollo.jpg", consulta: "pollo" },
  { label: "Mexicana", archivo: "cat-mexicana.jpg", consulta: "mexican" },
  { label: "Italiana", archivo: "pasta.jpg", consulta: "italian" },
  { label: "Asiática", archivo: "cat-asiatica.jpg", consulta: "asiatic" },
  { label: "Café", archivo: "cat-cafe.jpg", consulta: "café" },
  { label: "Postres", archivo: "cat-postres.jpg", consulta: "postre" },
];

type Busqueda = { texto: string; ubicacion: string; fecha: string };
const BUSQUEDA_VACIA: Busqueda = { texto: "", ubicacion: "", fecha: "" };

/**
 * El buscador es un filtro CLIENTE sobre los datos que YA trajo el
 * servidor — no hay en FOOD.BOOKEA un endpoint que busque por
 * ubicación+fecha a lo largo de todo el directorio (`food_franjas` es
 * por franja, no una consulta transversal). Mismo criterio de honestidad
 * que el buscador de la portada: en vez de simular una búsqueda que no
 * existe, esto filtra de verdad lo que hay en pantalla.
 *
 * - "¿Qué buscás?" busca contra el nombre, la descripción Y los platos
 *   del menú — así "sushi" encuentra un restaurante aunque no exista
 *   una columna de tipo de cocina.
 * - "Ubicación" busca contra la dirección real (`food_locations.direccion`,
 *   texto libre) — no hay geocodificación, así que es coincidencia de
 *   texto, no un radio en kilómetros.
 * - "Fecha" solo deja pasar negocios con alguna franja activa ESE día.
 * - "Personas" NO filtra: la capacidad vive por franja, no por negocio.
 *   El campo está porque el dueño lo pidió en su mockup (mismo criterio
 *   que las categorías decorativas que pidió antes) y el número se
 *   elige de verdad al reservar en la ficha.
 */
function pasaBusqueda(t: TarjetaFood, b: Busqueda): boolean {
  if (b.texto) {
    const aguja = normalizarBusquedaFood(b.texto);
    const pajar = normalizarBusquedaFood(
      [t.nombre, t.descripcion ?? "", ...t.platos].join(" "),
    );
    if (!pajar.includes(aguja)) return false;
  }
  if (b.ubicacion) {
    const aguja = normalizarBusquedaFood(b.ubicacion);
    if (!t.ubicacion || !normalizarBusquedaFood(t.ubicacion).includes(aguja)) return false;
  }
  if (b.fecha && !t.fechasConOferta.includes(b.fecha)) return false;
  return true;
}

const BENEFICIOS = [
  {
    Icono: IconTagLine,
    titulo: "Ahorrá",
    texto: "Encontrá descuentos reales según el horario — el % viaja congelado en tu reserva.",
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

export default function DirectorioFood({
  negocios,
  modo,
  favoritosIds = new Set(),
  logueado = false,
}: {
  negocios: TarjetaFood[];
  modo: "real" | "demo";
  /** ids ya marcados como favorito de quien mira. Vacío en /food/demo
   *  (los favoritos reales, 0201, no aplican a negocios de mentira). */
  favoritosIds?: Set<string>;
  logueado?: boolean;
}) {
  const idBase = useId();
  const [borrador, setBorrador] = useState<Busqueda>(BUSQUEDA_VACIA);
  const [aplicada, setAplicada] = useState<Busqueda>(BUSQUEDA_VACIA);
  const [personas, setPersonas] = useState(2);

  const hoy = hoyISOCR();
  const hrefPublicar = modo === "demo" ? "/food/negocio/nuevo" : "/food/negocio";

  const filtrados = useMemo(
    () => negocios.filter((n) => pasaBusqueda(n, aplicada)),
    [negocios, aplicada],
  );

  const hayFiltrosActivos =
    aplicada.texto !== "" || aplicada.ubicacion !== "" || aplicada.fecha !== "";

  // Las mejores franjas próximas de TODO el directorio (top 5 por %,
  // pintadas en orden de hora) — alimenta "Elegí tu horario y ahorrá".
  // Son las mismas `franjasProximas` reales que ya pinta cada card,
  // nunca un horario inventado.
  const mejoresFranjas = useMemo(() => {
    const top = negocios
      .flatMap((n) =>
        n.franjasProximas
          .filter((f) => f.descuento > 0)
          .map((f) => ({
            ...f,
            nombre: n.nombre,
            slug: n.slug,
            etiqueta: n.franjasProximasEtiqueta,
          })),
      )
      .sort((a, b) => b.descuento - a.descuento)
      .slice(0, 5);
    const mejor = top.reduce((max, f) => Math.max(max, f.descuento), 0);
    return top
      .sort((a, b) => a.horaOrden.localeCompare(b.horaOrden))
      .map((f) => ({ ...f, esLaMejor: f.descuento === mejor }));
  }, [negocios]);

  function limpiarFiltros() {
    setBorrador(BUSQUEDA_VACIA);
    setAplicada(BUSQUEDA_VACIA);
  }

  function buscarTipo(consulta: string) {
    const activa = aplicada.texto === consulta;
    const b = { ...BUSQUEDA_VACIA, texto: activa ? "" : consulta };
    setBorrador(b);
    setAplicada(b);
    document.getElementById("ofertas")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* ── Hero full-bleed ──────────────────────────────────────────
          Foto gastronómica de fondo con velo oscuro, título con "hoy"
          en naranja y el buscador flotante encima — el mockup del
          dueño, ago 2026. Rectángulo de esquina suave, NUNCA una
          píldora (regla de marca). */}
      <section className="relative overflow-hidden bg-[#0b0b0e]">
        {/* El platillo sobre fondo negro fundido a la derecha + brillo
            naranja — el hero oscuro premium del mockup del dueño
            (ago 2026), mismo tratamiento que la demo. */}
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
            <span className="h-1.5 w-1.5 rounded-full bg-aventurea-orange" />
            {modo === "demo" ? "Vista de ejemplo de FOOD.BOOKEA" : "Marketplace gastronómico"}
          </p>
          <h1 className="titulo mt-4 max-w-[13ch] text-[34px] uppercase leading-[1.04] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
            Descubrí dónde comer <span className="text-aventurea-orange">hoy</span>
          </h1>
          <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-white/85 sm:text-[16px]">
            Reservá restaurantes, encontrá descuentos y elegí el horario
            que más te conviene.
          </p>

          {/* ── Buscador flotante ─────────────────────────────────── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAplicada(borrador);
              document
                .getElementById("ofertas")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-9 grid grid-cols-1 gap-2 rounded-3xl bg-white p-2.5 shadow-flotante sm:grid-cols-2 sm:gap-0 lg:grid-cols-[1.1fr_1.2fr_0.8fr_0.9fr_auto]"
          >
            <CampoBuscador id={`${idBase}-ubicacion`} label="Ubicación" icono={<IconPin className="h-4 w-4" />}>
              <input
                id={`${idBase}-ubicacion`}
                type="text"
                value={borrador.ubicacion}
                onChange={(e) => setBorrador((b) => ({ ...b, ubicacion: e.target.value }))}
                placeholder="Ej. Escazú, San José..."
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none placeholder:text-zinc-400"
              />
            </CampoBuscador>

            <CampoBuscador
              id={`${idBase}-texto`}
              label="¿Qué buscás?"
              icono={<IconSearch className="h-4 w-4" />}
              className="border-t sm:border-l sm:border-t-0"
            >
              <input
                id={`${idBase}-texto`}
                type="text"
                value={borrador.texto}
                onChange={(e) => setBorrador((b) => ({ ...b, texto: e.target.value }))}
                placeholder="Restaurante, comida o zona"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none placeholder:text-zinc-400"
              />
            </CampoBuscador>

            <CampoBuscador
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
            </CampoBuscador>

            <CampoBuscador
              id={`${idBase}-fecha`}
              label="Fecha"
              icono={<IconCalendarLine className="h-4 w-4" />}
              className="border-t sm:border-l"
            >
              <input
                id={`${idBase}-fecha`}
                type="date"
                min={hoy}
                value={borrador.fecha}
                onChange={(e) => setBorrador((b) => ({ ...b, fecha: e.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none"
              />
            </CampoBuscador>

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
          {aplicada.texto !== "" && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="shrink-0 text-[13px] font-bold text-aventurea-orange hover:underline"
            >
              Ver todo
            </button>
          )}
        </div>
        <div className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-5 sm:px-0 lg:justify-between">
          {TIPOS_COMIDA.map((t) => {
            const activa = aplicada.texto === t.consulta;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => buscarTipo(t.consulta)}
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
                    src={`/food-demo/${t.archivo}`}
                    alt=""
                    fill
                    sizes="84px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </span>
                <span
                  className={`text-[12px] font-bold ${
                    activa ? "text-aventurea-orange-dark" : "text-aventurea-ink"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Ofertas cerca de vos ───────────────────────────────────── */}
      <section id="ofertas" className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="titulo text-[22px] uppercase tracking-tight text-aventurea-navy sm:text-[26px]">
              <span aria-hidden>🔥</span>{" "}
              {modo === "demo" ? "Restaurantes de ejemplo" : "Ofertas cerca de vos"}
            </h2>
            <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
              Aprovechá descuentos especiales en restaurantes de tu zona.
            </p>
          </div>
          {negocios.length > 0 && (
            <p className="shrink-0 text-[13px] font-bold text-aventurea-ink-soft">
              {filtrados.length} {filtrados.length === 1 ? "restaurante" : "restaurantes"}
            </p>
          )}
        </div>

        {negocios.length === 0 ? (
          <EmptyStatePremium modo={modo} hrefPublicar={hrefPublicar} />
        ) : filtrados.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-aventurea-line bg-white p-10 text-center shadow-plano">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              No encontramos restaurantes con esos filtros
            </p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Probá con otra palabra, otra ubicación o quitá los filtros.
            </p>
            {hayFiltrosActivos && (
              <button type="button" onClick={limpiarFiltros} className="btn-contorno presionable mt-6">
                Ver todos los restaurantes
              </button>
            )}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((t, i) => (
              <Revelar key={t.id} indice={i}>
                <RestauranteCard
                  tarjeta={t}
                  prioridad={i < 3}
                  favoritoInicial={modo === "real" ? favoritosIds.has(t.id) : undefined}
                  logueado={logueado}
                />
              </Revelar>
            ))}
          </div>
        )}
      </section>

      {/* ── Elegí tu horario y ahorrá ──────────────────────────────
          EL concepto central del producto (el descuento es de la
          FRANJA, no del plato) con franjas reales del directorio en
          orden de hora; la de mayor % se pinta naranja. Si ninguna
          franja próxima tiene descuento, la sección desaparece —
          nunca horarios de utilería. */}
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
                  key={`${f.slug}-${f.horaOrden}`}
                  href={`/food/restaurante/${f.slug}`}
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
                  <span className={`text-[10.5px] font-extrabold uppercase tracking-wide ${f.esLaMejor ? "text-white/80" : "text-aventurea-ink-soft"}`}>
                    {f.etiqueta}
                  </span>
                  <span className="text-[20px] font-extrabold leading-none">{f.hora}</span>
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

      {/* ── Restaurantes populares ─────────────────────────────────
          Solo aparece cuando el catálogo tiene suficientes negocios
          para que no sea un espejo de "Ofertas cerca de vos" — con
          pocos restaurantes repetir los mismos en dos secciones hace
          ver el directorio más chico, no más grande. */}
      {negocios.length >= 4 && (
        <section id="restaurantes" className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="titulo text-[22px] uppercase tracking-tight text-aventurea-navy sm:text-[26px]">
            <span aria-hidden>⭐</span> Restaurantes populares
          </h2>
          <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {negocios.slice(0, 4).map((n) => (
              <Link
                key={n.id}
                href={`/food/restaurante/${n.slug}`}
                className="presionable group relative block h-[160px] w-[240px] shrink-0 overflow-hidden rounded-2xl bg-aventurea-navy lg:w-auto"
              >
                {n.fotoUrl && (
                  <Image
                    src={n.fotoUrl}
                    alt={n.nombre}
                    fill
                    sizes="(max-width: 1024px) 240px, 300px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                  <p className="truncate text-[14px] font-extrabold">{n.nombre}</p>
                  {n.ubicacion && <p className="truncate text-[11.5px] text-white/80">{n.ubicacion}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Explorá por tipo de comida ─────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-12">
        <h2 className="titulo text-[22px] uppercase tracking-tight text-aventurea-navy sm:text-[26px]">
          Explorá por tipo de comida
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {TIPOS_COMIDA.slice(0, 8).map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => buscarTipo(t.consulta)}
              className="presionable group relative block h-[110px] overflow-hidden rounded-2xl bg-aventurea-navy text-left sm:h-[130px]"
            >
              <Image
                src={`/food-demo/${t.archivo}`}
                alt=""
                fill
                sizes="(max-width: 640px) 45vw, 160px"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute bottom-2.5 left-3 text-[13px] font-extrabold text-white">
                {t.label}
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
    </>
  );
}

function CampoBuscador({
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

/**
 * El estado vacío premium (0 restaurantes en el catálogo, no un
 * filtro sin resultados — ese es el bloque de arriba). Reemplaza a la
 * caja punteada "Todavía no hay restaurantes publicados": una foto
 * gastronómica real (del set curado en public/food-demo, no un banco
 * externo nuevo) en vez de un ícono gris, para que la pantalla se lea
 * como "estamos preparando algo" y no como un error del sistema.
 */
function EmptyStatePremium({
  modo,
  hrefPublicar,
}: {
  modo: "real" | "demo";
  hrefPublicar: string;
}) {
  return (
    <div className="mt-8 overflow-hidden rounded-4xl border border-aventurea-line bg-white shadow-elevado">
      <div className="grid lg:grid-cols-2 lg:items-stretch">
        <div className="relative h-[220px] lg:h-auto lg:min-h-[320px]">
          <Image
            src="/food-demo/chef.jpg"
            alt="Chef preparando un plato"
            fill
            sizes="(max-width: 1024px) 100vw, 560px"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center gap-3 p-8 sm:p-10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange-dark">
            FOOD.BOOKEA
          </p>
          <h3 className="titulo text-[24px] text-aventurea-navy sm:text-[28px]">
            Estamos preparando la selección
          </h3>
          <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            {modo === "demo"
              ? "Todavía no sembramos restaurantes de ejemplo — volvé pronto."
              : "Muy pronto vas a encontrar restaurantes con ofertas especiales y horarios exclusivos en FOOD.BOOKEA."}
          </p>
          <Link href={hrefPublicar} className="btn-naranja presionable mt-2 w-fit">
            Publicá tu restaurante
          </Link>
        </div>
      </div>
    </div>
  );
}
