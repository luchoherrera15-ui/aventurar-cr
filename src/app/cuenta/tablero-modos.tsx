"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconCalendarLine,
  IconChartBars,
  IconFrame,
  IconHeart,
  IconHome,
  IconStar,
  IconStore,
  IconChevronRight,
} from "@/components/icons";
import { TIPOS_TARJETA, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { fechaLargaCR } from "@/lib/fechas";
import EditarPerfil from "./editar-perfil";

/**
 * EL PERFIL, REDISEÑADO (referencia: referencia/bookea-cuenta-premium.html).
 *
 * Es la MISMA información que tenía el tablero de cards de siempre —
 * nada de esto inventa un dato nuevo salvo "tu próxima experiencia" y
 * "mi lealtad con progreso real", que sí son nuevos y vienen resueltos
 * desde page.tsx. El cambio es de layout: identidad + navegación fijas
 * a la izquierda, contenido a la derecha, en vez de una pila de cards.
 *
 * El toggle Cliente/Negocio sigue siendo el mismo de siempre (estado en
 * localStorage, servidor pinta SIEMPRE el modo cliente primero para que
 * no haya desajuste de hidratación) — acá decide qué accesos aparecen
 * en la barra lateral Y qué contenido se pinta a la derecha.
 */

export type ProximaExperiencia = {
  id: string;
  fecha: string;
  negocioNombre: string;
  fotoUrl: string | null;
  categoriaTexto: string;
  slug: string | null;
} | null;

/**
 * Solo se arma cuando el cliente tiene EXACTAMENTE una tarjeta de
 * lealtad — con varias no cabe un solo progreso en el resumen (acá se
 * muestra nada más el conteo, con link al listado completo en
 * /cuenta/lealtad, que sí sabe dibujar cada una).
 */
export type LealtadPrincipal = {
  negocioNombre: string;
  tipo: TipoTarjeta;
  saldo: number;
  /** Meta de la tarjeta (requeridos si es sellos, mínimo de canje si es puntos...). null = no acumula o no tiene meta. */
  meta: number | null;
} | null;

interface TableroModosProps {
  nombre: string;
  /** El nombre tal cual está guardado (puede venir vacío) — para precargar el modal de editar, sin el "Tu cuenta" de respaldo de `nombre`. */
  nombreCrudo: string;
  inicialesAvatar: string;
  correo: string;
  telefono: string;
  tieneNegocio: boolean;
  resenasCount: number;
  reservasNuevasNegocio: number;
  vecesContratado: number;
  negociosLength: number;
  lealtadActiva: boolean;
  confirmacionesNuevas: number;
  invitacionIds: string[];
  personasConfirmadas: number;
  activas: number;
  historial: number;
  favoritosCount: number;
  misLealtadesCount: number;
  lealtadPrincipal: LealtadPrincipal;
  proximaExperiencia: ProximaExperiencia;
  cerrarSesion: () => Promise<void>;
}

export default function TableroModos({
  nombre,
  nombreCrudo,
  inicialesAvatar,
  correo,
  telefono,
  tieneNegocio,
  resenasCount,
  reservasNuevasNegocio,
  vecesContratado,
  negociosLength,
  lealtadActiva,
  confirmacionesNuevas,
  invitacionIds,
  personasConfirmadas,
  activas,
  historial,
  favoritosCount,
  misLealtadesCount,
  lealtadPrincipal,
  proximaExperiencia,
  cerrarSesion,
}: TableroModosProps) {
  const [modoNegocio, setModoNegocio] = useState(false);

  useEffect(() => {
    // Lectura única de una preferencia guardada en el navegador — no hay
    // forma de saberla antes de montar en el cliente (SSR no tiene
    // localStorage), así que el efecto es necesario, no evitable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModoNegocio(localStorage.getItem("cuenta_modo_negocio") === "true" && tieneNegocio);
  }, [tieneNegocio]);

  const toggleModo = () => {
    const nuevoModo = !modoNegocio;
    setModoNegocio(nuevoModo);
    localStorage.setItem("cuenta_modo_negocio", String(nuevoModo));
  };

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-[640px] pb-8 sm:pb-12">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-ink-soft">
          {modoNegocio ? "Bookea para negocios" : "Cuenta personal"}
        </p>
        <h1 className="titulo text-[30px] leading-[1.05] text-aventurea-ink sm:text-[40px]">
          {modoNegocio ? "Tu negocio, en un panel a la altura." : "Todo lo que reservás, en un solo lugar."}
        </h1>
        <p className="mt-3.5 text-[14px] leading-relaxed text-aventurea-ink-soft">
          {modoNegocio
            ? "Disponibilidad, solicitudes, clientes y rendimiento de tu espacio, desde un panel pensado para el día a día."
            : "Revisá tus próximas experiencias, invitaciones, favoritos y beneficios con una cuenta diseñada para sentirse tan simple como reservar."}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-14">
        {/* ── Aside: identidad + navegación ─────────────────────── */}
        <aside className="lg:sticky lg:top-[84px] lg:self-start">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[22px] font-extrabold text-white shadow-[inset_0_0_0_4px_rgba(255,255,255,0.12)]"
            >
              {inicialesAvatar}
            </span>
            <div className="min-w-0">
              {/* h2 y no h3: es el primer encabezado real después del h1
                  del hero — un h3 acá dejaba un salto de nivel (h1→h3)
                  que rompe la navegación por encabezados de un lector
                  de pantalla. */}
              <h2 className="truncate text-[15.5px] font-extrabold text-aventurea-ink">{nombre}</h2>
              <p className="truncate text-[12px] font-medium text-aventurea-ink-soft">{correo}</p>
              <span className="mt-1.5 inline-flex rounded-full bg-aventurea-cream-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-aventurea-ink">
                {tieneNegocio ? "Proveedor" : "Cliente"}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <EditarPerfil nombreActual={nombreCrudo} telefonoActual={telefono} />
          </div>

          <nav aria-label="Secciones de cuenta" className="mt-7 grid border-t border-aventurea-line">
            {!modoNegocio ? (
              <>
                <ItemNav actual icono={<IconHome className="h-[16px] w-[16px]" />}>
                  Resumen
                </ItemNav>
                <ItemNav href="/cuenta/ir/invitaciones" icono={<IconFrame className="h-[16px] w-[16px]" />}>
                  Invitaciones y álbumes
                </ItemNav>
                <ItemNav href="/cuenta/ir/reservas" icono={<IconCalendarLine className="h-[16px] w-[16px]" />}>
                  Tus reservas
                </ItemNav>
                <ItemNav href="/cuenta/ir/favoritos" icono={<IconHeart className="h-[16px] w-[16px]" />}>
                  Tus favoritos
                </ItemNav>
                <ItemNav href="/cuenta/lealtad" icono={<IconStar className="h-[16px] w-[16px]" />}>
                  Mi lealtad
                </ItemNav>
              </>
            ) : (
              <>
                <ItemNav actual icono={<IconHome className="h-[16px] w-[16px]" />}>
                  Resumen
                </ItemNav>
                <ItemNav href="/cuenta/ir/proveedor" icono={<IconStore className="h-[16px] w-[16px]" />}>
                  Panel de proveedor
                </ItemNav>
                <ItemNav href="/cuenta/ir/finanzas" icono={<IconChartBars className="h-[16px] w-[16px]" />}>
                  Finanzas
                </ItemNav>
                <ItemNav
                  href={lealtadActiva ? "/cuenta/ir/lealtad" : "/lealtad"}
                  icono={<IconStar className="h-[16px] w-[16px]" />}
                >
                  Programa de lealtad
                </ItemNav>
              </>
            )}
          </nav>

          {tieneNegocio && (
            <button
              type="button"
              onClick={toggleModo}
              className="mt-5 w-full rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2.5 text-center text-[12.5px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy/5"
            >
              {modoNegocio ? "Volver a mi perfil" : "Modo Negocio"}
            </button>
          )}
        </aside>

        {/* ── Contenido ──────────────────────────────────────────── */}
        <div className="min-w-0">
          {!modoNegocio ? (
            <>
              <SeccionActividad
                titulo="Tu actividad"
                filas={[
                  {
                    href: "/cuenta/ir/invitaciones",
                    icono: <IconFrame className="h-5 w-5" />,
                    titulo: "Invitaciones y álbumes",
                    detalle:
                      invitacionIds.length === 0
                        ? "Sin invitaciones"
                        : personasConfirmadas > 0
                          ? `${confirmacionesNuevas} confirmaciones nuevas · ${personasConfirmadas} personas confirmadas`
                          : `${confirmacionesNuevas} confirmaciones nuevas`,
                    numero: invitacionIds.length,
                    badge: confirmacionesNuevas,
                  },
                  {
                    href: "/cuenta/ir/reservas",
                    icono: <IconCalendarLine className="h-5 w-5" />,
                    titulo: "Tus reservas",
                    detalle: `${activas} activas, ${historial} historial${
                      resenasCount > 0 ? ` · ${resenasCount} reseña${resenasCount === 1 ? "" : "s"}` : ""
                    }`,
                    numero: activas,
                  },
                  {
                    href: "/cuenta/ir/favoritos",
                    icono: <IconHeart className="h-5 w-5" />,
                    titulo: "Tus favoritos",
                    detalle: favoritosCount === 1 ? "1 favorito" : `${favoritosCount} favoritos`,
                    numero: favoritosCount,
                  },
                ]}
              />

              <ProximaExperienciaCard proxima={proximaExperiencia} />

              <MiLealtadResumen count={misLealtadesCount} principal={lealtadPrincipal} />
            </>
          ) : (
            <SeccionActividad
              titulo="Tu negocio"
              filas={[
                {
                  href: "/cuenta/ir/proveedor",
                  icono: <IconStore className="h-5 w-5" />,
                  titulo: "Panel de proveedor",
                  detalle: `${negociosLength} publicación${negociosLength !== 1 ? "es" : ""}`,
                  numero: negociosLength,
                  badge: reservasNuevasNegocio,
                },
                {
                  href: "/cuenta/ir/finanzas",
                  icono: <IconChartBars className="h-5 w-5" />,
                  titulo: "Finanzas",
                  detalle: `${vecesContratado} reservas confirmadas`,
                  numero: vecesContratado,
                },
                {
                  href: lealtadActiva ? "/cuenta/ir/lealtad" : "/lealtad",
                  icono: <IconStar className="h-5 w-5" />,
                  titulo: "Programa de lealtad",
                  detalle: lealtadActiva
                    ? "Sellos, puntos y tarjeta en el Wallet de tus clientes"
                    : "Hacé que tus clientes vuelvan — ver cómo funciona",
                },
              ]}
            />
          )}

          {!modoNegocio && (
            <BannerNegocio tieneNegocio={tieneNegocio} onPasarAModoNegocio={toggleModo} />
          )}

          <footer className="mt-10 flex items-center justify-between gap-4 border-t border-aventurea-line pt-6 text-[11px] text-aventurea-ink-soft">
            <span>Bookea · Cuenta protegida</span>
            <form action={cerrarSesion}>
              <button type="submit" className="font-bold text-red-600 hover:underline">
                Cerrar sesión
              </button>
            </form>
          </footer>
        </div>
      </div>
    </main>
  );
}

/** Un ítem de la navegación lateral: el actual queda marcado y sin flecha. */
function ItemNav({
  href,
  icono,
  actual,
  children,
}: {
  href?: string;
  icono: React.ReactNode;
  actual?: boolean;
  children: React.ReactNode;
}) {
  const clases =
    "flex items-center gap-2.5 border-b border-aventurea-line py-3.5 text-[13px] transition-colors";
  if (actual) {
    return (
      <div aria-current="page" className={`${clases} font-bold text-aventurea-ink`}>
        <span aria-hidden="true">{icono}</span>
        {children}
      </div>
    );
  }
  return (
    <Link href={href ?? "#"} className={`${clases} text-aventurea-ink-soft hover:text-aventurea-navy`}>
      <span aria-hidden="true">{icono}</span>
      {children}
    </Link>
  );
}

type FilaActividad = {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  numero?: number;
  badge?: number;
};

/** "Tu actividad" / "Tu negocio": la lista de accesos con ícono, texto y número. */
function SeccionActividad({ titulo, filas }: { titulo: string; filas: FilaActividad[] }) {
  return (
    <section aria-labelledby="actividad-titulo">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="actividad-titulo" className="titulo text-[19px] text-aventurea-ink">
          {titulo}
        </h2>
        <span className="text-[11.5px] text-aventurea-ink-soft">Vista general</span>
      </div>

      <div className="border-t border-aventurea-line">
        {filas.map((f) => (
          <Link
            key={f.titulo}
            href={f.href}
            className="group grid grid-cols-[44px_1fr_auto] items-center gap-3.5 border-b border-aventurea-line py-4 transition-colors hover:bg-aventurea-cream-2/60 sm:gap-4"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink"
            >
              {f.icono}
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-extrabold text-aventurea-ink">{f.titulo}</span>
              <span className="mt-0.5 block truncate text-[12px] font-medium text-aventurea-ink-soft">
                {f.detalle}
              </span>
            </span>
            <span className="flex items-center gap-2.5">
              {f.badge != null && f.badge > 0 && (
                <span className="rounded-lg bg-aventurea-sky px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-white">
                  +{f.badge > 99 ? "99" : f.badge}
                </span>
              )}
              {f.numero != null && (
                <span className="text-[19px] font-extrabold tabular-nums text-aventurea-ink">
                  {String(f.numero).padStart(2, "0")}
                </span>
              )}
              <span aria-hidden="true">
                <IconChevronRight className="h-[14px] w-[14px] text-aventurea-ink-soft transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** "Tu próxima experiencia": la reserva activa más próxima, o el estado vacío que invita a explorar. */
function ProximaExperienciaCard({ proxima }: { proxima: ProximaExperiencia }) {
  return (
    <section className="mt-10" aria-labelledby="proxima-titulo">
      <div
        className="relative overflow-hidden rounded-3xl border border-aventurea-line bg-aventurea-surface p-6 sm:p-8"
        style={
          proxima?.fotoUrl
            ? {
                backgroundImage: `linear-gradient(100deg, rgba(22,41,94,.94) 0%, rgba(22,41,94,.72) 45%, rgba(22,41,94,.35) 100%), url(${proxima.fotoUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <p
          className={`mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] ${
            proxima ? "text-white/70" : "text-aventurea-ink-soft"
          }`}
        >
          Tu próxima experiencia
        </p>

        {proxima ? (
          <>
            <h2
              id="proxima-titulo"
              className="titulo max-w-[440px] text-[22px] text-white sm:text-[26px]"
            >
              {proxima.negocioNombre}
            </h2>
            <p className="mt-1.5 text-[13px] font-semibold text-white/80">{proxima.categoriaTexto}</p>
            <p className="mt-3 text-[14px] font-bold text-white">{fechaLargaCR(proxima.fecha)}</p>
            {proxima.slug && (
              <Link
                href={`/${proxima.slug}`}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-extrabold text-aventurea-navy transition-colors hover:bg-white/90"
              >
                Ver el espacio
                <span aria-hidden="true">
                  <IconChevronRight className="h-[13px] w-[13px]" />
                </span>
              </Link>
            )}
          </>
        ) : (
          <>
            <h2 id="proxima-titulo" className="titulo max-w-[440px] text-[20px] text-aventurea-ink sm:text-[24px]">
              Todavía no hay nada en el calendario.
            </h2>
            <p className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-aventurea-ink-soft">
              Descubrí espacios, citas y hospedajes seleccionados para convertir cualquier plan en algo
              memorable.
            </p>
            <Link
              href="/eventos"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              Explorar Bookea
              <span aria-hidden="true">
                <IconChevronRight className="h-[13px] w-[13px]" />
              </span>
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

/** Cuántos círculos como máximo antes de que la grilla de sellos deje de tener sentido visual. */
const TOPE_SELLOS_VISUALES = 20;

/** "Mi lealtad": 0/1/varias tarjetas, cada caso con su propio resumen honesto. */
function MiLealtadResumen({ count, principal }: { count: number; principal: LealtadPrincipal }) {
  return (
    <section className="mt-10" aria-labelledby="lealtad-titulo">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-ink-soft">
            Beneficios Bookea
          </p>
          <h2 id="lealtad-titulo" className="titulo text-[19px] text-aventurea-ink">
            Mi lealtad
          </h2>
        </div>
        {count > 0 && (
          <div className="shrink-0 text-right">
            <strong className="block text-[22px] font-extrabold text-aventurea-ink">{count}</strong>
            <span className="text-[11px] text-aventurea-ink-soft">
              {count === 1 ? "tarjeta activa" : "tarjetas activas"}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-aventurea-line bg-aventurea-surface p-6">
        {count === 0 && (
          <p className="text-[13px] text-aventurea-ink-soft">
            Tus sellos y puntos van a aparecer acá cuando te afiliés al programa de lealtad de un negocio.
          </p>
        )}

        {count === 1 && principal && <ProgresoLealtad principal={principal} />}

        {count > 1 && (
          <p className="text-[13px] text-aventurea-ink-soft">
            Tenés {count} tarjetas activas — mirá el sello y el progreso de cada una.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-aventurea-line pt-4 text-[11px] text-aventurea-ink-soft">
          <span>
            {count === 1 && principal
              ? principal.negocioNombre
              : count === 0
                ? "Sin tarjetas todavía"
                : "Varios negocios"}
          </span>
          <Link
            href="/cuenta/lealtad"
            className="inline-flex items-center gap-1 font-bold text-aventurea-navy hover:underline"
          >
            Ver mi tarjeta
            <span aria-hidden="true">
              <IconChevronRight className="h-[12px] w-[12px]" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** El progreso real de la única tarjeta: sellos con circulitos, lo demás con número y barra. */
function ProgresoLealtad({ principal }: { principal: NonNullable<LealtadPrincipal> }) {
  const { tipo, saldo, meta } = principal;

  if (tipo === "sellos" && meta && meta > 0 && meta <= TOPE_SELLOS_VISUALES) {
    const llenos = Math.min(saldo, meta);
    return (
      <div>
        <div
          className="grid gap-2"
          // `auto-fill` con un piso de 14px: en vez de encoger los N
          // círculos hasta cualquier tamaño para que quepan en una sola
          // fila (ilegible en un celular angosto con meta cerca de 20),
          // la grilla arma menos columnas y pasa a la fila de abajo.
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))" }}
          aria-label={`Progreso de sellos: ${llenos} de ${meta}`}
        >
          {Array.from({ length: meta }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={`aspect-square rounded-full border ${
                i < llenos ? "border-aventurea-navy bg-aventurea-navy" : "border-aventurea-line"
              }`}
            />
          ))}
        </div>
        <p className="mt-3.5 text-[12.5px] font-bold text-aventurea-ink-soft">
          {llenos} de {meta} sellos
        </p>
      </div>
    );
  }

  // Tipos que acumulan pero no como sellos (puntos, cashback, gift card,
  // o una meta de sellos demasiado grande para dibujar circulitos).
  if (meta && meta > 0) {
    const pct = Math.max(0, Math.min(100, Math.round((saldo / meta) * 100)));
    return (
      <div>
        <p className="text-[26px] font-extrabold tabular-nums text-aventurea-ink">
          {saldo.toLocaleString("es-CR")}{" "}
          <span className="text-[13px] font-bold text-aventurea-ink-soft">{UNIDAD_SALDO[tipo]}</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-aventurea-cream-2">
          <div className="h-full rounded-full bg-aventurea-navy" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // Solo los tipos que ACUMULAN (sellos, puntos, cashback, gift card)
  // tienen un saldo que signifique progreso. Cupón/descuento/membresía/
  // evento no acumulan — mostrador.ts acredita un "derecho de uso" de
  // +1 al escanear que el canje consume en el mismo acto (saldo neto
  // cero); si el empleado no llegó a canjear, ese +1 queda un rato en
  // el ledger y NO es progreso real. El mostrador ya esconde su propio
  // contador para estos tipos (`muestraSaldo` en mostrador.ts) — acá se
  // respeta la misma regla en vez de mostrar "1 usos" como si fuera una
  // cuenta que avanza.
  if (saldo > 0 && TIPOS_TARJETA[tipo].acumula) {
    return (
      <p className="text-[26px] font-extrabold tabular-nums text-aventurea-ink">
        {saldo.toLocaleString("es-CR")}{" "}
        <span className="text-[13px] font-bold text-aventurea-ink-soft">{UNIDAD_SALDO[tipo]}</span>
      </p>
    );
  }

  return <p className="text-[13px] text-aventurea-ink-soft">Tenés un beneficio activo en esta tarjeta.</p>;
}

/** El banner de cierre: invita a pasar a modo negocio, o a publicar un espacio si todavía no tiene ninguno. */
function BannerNegocio({
  tieneNegocio,
  onPasarAModoNegocio,
}: {
  tieneNegocio: boolean;
  onPasarAModoNegocio: () => void;
}) {
  return (
    <section className="mt-10 grid items-center gap-5 border-y border-aventurea-line py-7 sm:grid-cols-[1fr_auto] sm:gap-8">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-ink-soft">
          Bookea para negocios
        </p>
        <h2 className="titulo text-[19px] text-aventurea-ink sm:text-[22px]">
          {tieneNegocio ? "Pasá a modo negocio." : "Publicá tu espacio."}
        </h2>
        <p className="mt-1.5 max-w-[520px] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          {tieneNegocio
            ? "Administrá disponibilidad, solicitudes, clientes y rendimiento de tu espacio desde un panel especializado."
            : "Sumá tu lugar, tus citas o tu servicio al directorio y empezá a recibir reservas instantáneas."}
        </p>
      </div>
      {tieneNegocio ? (
        <button
          type="button"
          onClick={onPasarAModoNegocio}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-aventurea-navy px-4.5 py-3 text-[13px] font-extrabold text-white transition-colors hover:bg-aventurea-navy-2"
        >
          Gestionar negocio
          <span aria-hidden="true">
            <IconChevronRight className="h-[13px] w-[13px]" />
          </span>
        </button>
      ) : (
        <Link
          href="/publicar"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-aventurea-navy px-4.5 py-3 text-[13px] font-extrabold text-white transition-colors hover:bg-aventurea-navy-2"
        >
          Publicá tu espacio
          <span aria-hidden="true">
            <IconChevronRight className="h-[13px] w-[13px]" />
          </span>
        </Link>
      )}
    </section>
  );
}
