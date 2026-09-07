"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChartBars, IconEnlace, IconInstagram, IconMenu, IconStore, IconUsers, IconX } from "@/components/icons";
import { urlBookea } from "@/lib/solutions/dominios";

/**
 * EL NAV DE LINKSY, CON EL MENÚ «PRODUCTOS» DE LINKTREE.
 *
 * Pedido del dueño (7 sep 2026), con linktr.ee abierto al lado: «el
 * menú superior adaptado a nosotros; que ofrezcamos los mismos servicios
 * y además los planes de lealtad».
 *
 * Cinco categorías, las de Linktree, con NUESTRO catálogo adentro. La
 * regla es una: cada ítem lleva a algo que existe hoy —una sección de
 * la landing, el panel, Lealtad— o va marcado «Pronto» y no es un
 * enlace. Un menú que promete con links a la nada es lo que Linktree
 * no hace y nosotros tampoco.
 *
 * Los enlaces al mundo con sesión (panel, planes, ayuda) son ABSOLUTOS
 * a bookea.lat (`urlBookea`): en linksy.lat serían un slug inexistente.
 */

type Item = { titulo: string; pie: string; href?: string; pronto?: boolean };
type Categoria = { id: string; titulo: string; Icono: (p: { className?: string }) => ReactNode; items: Item[] };

const CATEGORIAS: Categoria[] = [
  {
    id: "pagina",
    titulo: "Tu página y herramientas",
    Icono: IconEnlace,
    items: [
      { titulo: "Página de enlaces", pie: "linksy.lat/tu-negocio, 100 % a tu gusto", href: "/linksy#disenos" },
      { titulo: "Menú o catálogo digital", pie: "Fotos, precios en tu moneda, hasta seis idiomas", href: "/linksy#vender" },
      { titulo: "Código QR", pie: "Uno para la puerta, la mesa o tu tarjeta", href: "/linksy#dominio" },
      { titulo: "Tu propio dominio", pie: "tunegocio.com apuntando a tu página", href: "/linksy#dominio" },
      { titulo: "Acortador de links", pie: "Links cortos con seguimiento", pronto: true },
    ],
  },
  {
    id: "redes",
    titulo: "Tus redes sociales",
    Icono: IconInstagram,
    items: [
      { titulo: "Instagram Auto Reply", pie: "Comentan una palabra y reciben tu DM, solo", href: "/linksy#instagram" },
      { titulo: "Programar publicaciones", pie: "Planificá y publicá sin estar encima", pronto: true },
      { titulo: "Textos con IA", pie: "Ideas y captions para tus posts", pronto: true },
      { titulo: "Generador de hashtags", pie: "Los que rinden en tu rubro", pronto: true },
    ],
  },
  {
    id: "clientes",
    titulo: "Crecé con tus clientes",
    Icono: IconUsers,
    items: [
      { titulo: "Tarjeta de lealtad", pie: "Sellos o puntos en Apple y Google Wallet", href: "/linksy#lealtad" },
      { titulo: "Correos automáticos", pie: "En los hitos: primer sello, penúltimo, meta", href: urlBookea("/lealtad") },
      { titulo: "Campañas", pie: "Promos a tus clientes de lealtad", href: urlBookea("/lealtad") },
      { titulo: "Fichas de clientes", pie: "Quién volvió, quién no, cuándo", href: urlBookea("/lealtad") },
    ],
  },
  {
    id: "vender",
    titulo: "Vendé",
    Icono: IconStore,
    items: [
      { titulo: "Pedidos por WhatsApp", pie: "Mesa con QR, para recoger o envío. 0 % comisión", href: "/linksy#vender" },
      { titulo: "Vitrina en tu página", pie: "Productos con foto y precio adentro del link", href: "/linksy#vender" },
      { titulo: "Reservas en Bookea", pie: "Publicá tu servicio en el marketplace", href: urlBookea("/publicar") },
      { titulo: "Cobro con tarjeta", pie: "Pagos en línea desde tu página", pronto: true },
      { titulo: "Cursos y productos digitales", pie: "Vendé lo que sabés", pronto: true },
    ],
  },
  {
    id: "medir",
    titulo: "Medí resultados",
    Icono: IconChartBars,
    items: [
      { titulo: "Estadísticas de Instagram", pie: "Comentarios, DMs, tasa de respuesta", href: "/linksy#instagram" },
      { titulo: "Visitas y clics de tu página", pie: "Qué enlace toca la gente", pronto: true },
    ],
  },
];

const ENLACES_TOP: { label: string; href: string }[] = [
  { label: "Plantillas", href: "/linksy#disenos" },
  { label: "Planes de lealtad", href: urlBookea("/lealtad/planes") },
  { label: "Ayuda", href: urlBookea("/ayuda") },
];

function Pronto() {
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--linksy-amarillo)", color: "var(--linksy-amarillo-tinta)" }}>
      Pronto
    </span>
  );
}

function ItemMenu({ item, alElegir }: { item: Item; alElegir: () => void }) {
  const cuerpo = (
    <>
      <span className="titulo flex items-center gap-2 text-[16px] font-extrabold" style={{ color: "var(--linksy-tinta)" }}>
        {item.titulo}
        {item.pronto && <Pronto />}
      </span>
      <span className="block text-[13.5px] font-semibold" style={{ color: "var(--linksy-tinta-suave)" }}>
        {item.pie}
      </span>
    </>
  );
  if (item.pronto || !item.href) {
    return <div className="rounded-xl px-3 py-2.5 opacity-80">{cuerpo}</div>;
  }
  return (
    <a href={item.href} onClick={alElegir} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--superficie-2,rgba(0,0,0,.05))]" style={{ background: "transparent" }}>
      {cuerpo}
    </a>
  );
}

/** La tarjeta «destacado» del menú: lo que ningún linktree tiene. */
function Destacado() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--linksy-tinta-suave)" }}>
        Destacado
      </p>
      <div className="overflow-hidden rounded-[20px] p-4" style={{ background: "var(--linksy-lila)", color: "var(--linksy-lila-tinta)" }}>
        <div className="rounded-xl bg-white/80 px-3 py-2 text-[12.5px] font-bold" style={{ color: "var(--linksy-tinta)" }}>
          💬 ana.cliente: «¿PRECIO?»
        </div>
        <div className="mt-2 ml-6 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--linksy-carbon)", color: "var(--linksy-carbon-tinta)" }}>
          ✉️ ¡Hola! Acá tenés los precios: linksy.lat/cafe-aroma
        </div>
      </div>
      <p className="titulo text-[17px] font-extrabold" style={{ color: "var(--linksy-tinta)" }}>
        Instagram Auto Reply
      </p>
      <p className="text-[13.5px] font-semibold" style={{ color: "var(--linksy-tinta-suave)" }}>
        Comentan una palabra clave en tu post y reciben tu enlace por DM, al instante. Con la API oficial de Instagram.
      </p>
    </div>
  );
}

export default function NavLinksy() {
  const [abierto, setAbierto] = useState(false);
  const [categoria, setCategoria] = useState(0);
  const [movil, setMovil] = useState(false);
  const [movilCategoria, setMovilCategoria] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  // El cierre por mouse espera un instante: al pasar del botón al panel el
  // puntero cruza un borde y sin la demora el menú se cerraba solo.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abrir = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setAbierto(true);
  };
  const cerrarConDemora = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAbierto(false), 180);
  };
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  // Escape y clic afuera cierran los dos menús.
  useEffect(() => {
    if (!abierto && !movil) return;
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        setMovil(false);
      }
    };
    const afuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", teclado);
    document.addEventListener("mousedown", afuera);
    return () => {
      document.removeEventListener("keydown", teclado);
      document.removeEventListener("mousedown", afuera);
    };
  }, [abierto, movil]);

  const cerrarTodo = () => {
    setAbierto(false);
    setMovil(false);
  };
  const cat = CATEGORIAS[categoria];

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
      <div ref={raiz} className="relative mx-auto w-[min(1280px,100%)]">
        <nav
          className="flex h-[72px] items-center justify-between rounded-full px-5 shadow-elevado sm:px-7"
          style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}
          aria-label="Principal"
        >
          <Link href="/linksy" className="titulo text-[30px] font-extrabold tracking-tight" style={{ color: "var(--linksy-tinta)" }} onClick={cerrarTodo}>
            Linksy
          </Link>

          {/* Escritorio */}
          <div className="titulo hidden items-center gap-9 text-[18px] font-extrabold tracking-tight lg:flex">
            <button
              type="button"
              aria-expanded={abierto}
              aria-controls="menu-productos"
              onMouseEnter={abrir}
              onMouseLeave={cerrarConDemora}
              onClick={() => setAbierto((v) => !v)}
              className="flex items-center gap-1.5"
            >
              Productos
              <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden style={{ transitionDuration: "var(--duracion-micro, 200ms)" }}>
                <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {ENLACES_TOP.map((e) => (
              <a key={e.label} href={e.href} className="hover:underline underline-offset-4">
                {e.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a href={urlBookea("/linksy/login")} className="titulo presionable hidden min-h-[46px] items-center rounded-full px-6 text-[16px] font-extrabold sm:inline-flex" style={{ background: "var(--linksy-lila)", color: "var(--linksy-lila-tinta)" }}>
              Ingresar
            </a>
            <a href={urlBookea("/solutions/crear")} className="titulo presionable inline-flex min-h-[46px] items-center rounded-full px-6 text-[16px] font-extrabold" style={{ background: "var(--linksy-carbon)", color: "var(--linksy-carbon-tinta)" }}>
              Crear gratis
            </a>
            <button
              type="button"
              aria-label={movil ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={movil}
              onClick={() => setMovil((v) => !v)}
              className="presionable grid h-11 w-11 place-items-center rounded-full lg:hidden"
              style={{ background: "var(--superficie-2, #eef1f6)", color: "var(--linksy-tinta)" }}
            >
              {movil ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* El mega-menú de escritorio */}
        {abierto && (
          <div
            id="menu-productos"
            onMouseEnter={abrir}
            onMouseLeave={cerrarConDemora}
            className="absolute left-0 right-0 top-full hidden pt-2 lg:block"
          >
          <div
            className="grid grid-cols-[280px_minmax(0,1fr)_320px] gap-2 rounded-[28px] p-3 shadow-flotante"
            style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}
          >
            <ul className="flex flex-col gap-1 border-r pr-2" style={{ borderColor: "var(--superficie-2, #e4e9f1)" }} role="tablist" aria-label="Categorías">
              {CATEGORIAS.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={i === categoria}
                    onMouseEnter={() => setCategoria(i)}
                    onFocus={() => setCategoria(i)}
                    onClick={() => setCategoria(i)}
                    className="titulo flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-[16px] font-extrabold transition-colors"
                    style={{ background: i === categoria ? "var(--superficie-2, #eef1f6)" : "transparent" }}
                  >
                    <span className="flex items-center gap-2.5">
                      <c.Icono className="h-[18px] w-[18px]" />
                      {c.titulo}
                    </span>
                    <span aria-hidden style={{ color: "var(--linksy-tinta-suave)" }}>›</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-0.5 px-2 py-1">
              {cat.items.map((it) => (
                <ItemMenu key={it.titulo} item={it} alElegir={cerrarTodo} />
              ))}
            </div>
            <div className="border-l pl-4 pr-2 py-1" style={{ borderColor: "var(--superficie-2, #e4e9f1)" }}>
              <Destacado />
            </div>
          </div>
          </div>
        )}

        {/* Móvil: acordeón */}
        {movil && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-[24px] p-3 shadow-flotante lg:hidden" style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}>
            {CATEGORIAS.map((c) => {
              const abiertaC = movilCategoria === c.id;
              return (
                <div key={c.id} className="border-b last:border-b-0" style={{ borderColor: "var(--superficie-2, #e4e9f1)" }}>
                  <button type="button" aria-expanded={abiertaC} onClick={() => setMovilCategoria(abiertaC ? null : c.id)} className="titulo flex w-full items-center justify-between px-2 py-3 text-left text-[17px] font-extrabold">
                    <span className="flex items-center gap-2.5">
                      <c.Icono className="h-[18px] w-[18px]" />
                      {c.titulo}
                    </span>
                    <span aria-hidden className={`transition-transform ${abiertaC ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {abiertaC && (
                    <div className="pb-2">
                      {c.items.map((it) => (
                        <ItemMenu key={it.titulo} item={it} alElegir={cerrarTodo} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-2 flex flex-col gap-1 px-2 pt-2">
              {ENLACES_TOP.map((e) => (
                <a key={e.label} href={e.href} onClick={cerrarTodo} className="titulo py-2 text-[17px] font-extrabold">
                  {e.label}
                </a>
              ))}
              <a href={urlBookea("/linksy/login")} onClick={cerrarTodo} className="titulo presionable mt-1 inline-flex min-h-[46px] items-center justify-center rounded-full px-5 text-[16px] font-extrabold sm:hidden" style={{ background: "var(--linksy-lila)", color: "var(--linksy-lila-tinta)" }}>
                Ingresar
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
