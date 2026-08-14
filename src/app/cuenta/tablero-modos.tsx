"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconCalendarLine,
  IconChartBars,
  IconCheck,
  IconChevronRight,
  IconCompass,
  IconFrame,
  IconHeart,
  IconHome,
  IconStar,
  IconStore,
} from "@/components/icons";
import { TIPOS_TARJETA, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { fechaLargaCR } from "@/lib/fechas";
import EditarPerfil from "./editar-perfil";

/**
 * EL PERFIL, REDISEÑADO — V2 (referencia: referencia/"cuenta bookea
 * nueva.html", que reemplaza al mockup anterior como punto de partida
 * de la migración visual del resto del sitio).
 *
 * Mismo dato de siempre, otra vez solo un cambio de presentación: el
 * sidebar pasa de "aside plano" a una tarjeta navy sólida, "Tu
 * actividad" pasa de fila a grilla de tarjetas, y "próxima experiencia"
 * + "mi lealtad" quedan lado a lado en vez de apiladas. Nada de esto
 * toca page.tsx — los props son los mismos.
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

// `timeZone` explícito: sin él, el formato usa la hora del servidor
// (UTC en Vercel) — entre medianoche y las 6 a.m. UTC (6 p.m.–medianoche
// hora CR, sin horario de verano) el widget diría "mañana" en vez de
// "hoy" para alguien en Costa Rica.
const HOY = new Intl.DateTimeFormat("es-CR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Costa_Rica",
});

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

  // Un solo lugar donde formatearla (evita el "Invalid Date" si esto se
  // renderiza fuera de hora del build) — puramente informativo, no
  // decide nada.
  const fechaHoy = capitalizar(HOY.format(new Date()));

  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start lg:gap-10">
        {/* ── Sidebar: tarjeta navy con identidad + navegación ────── */}
        <aside aria-label="Perfil y navegación" className="lg:sticky lg:top-[84px]">
          <div className="rounded-[22px] bg-gradient-to-br from-aventurea-navy-2 to-aventurea-navy p-5 text-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-white/15 pb-5">
              <span
                aria-hidden="true"
                className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-white text-[16px] font-extrabold text-aventurea-navy shadow-lg"
              >
                {inicialesAvatar}
              </span>
              <div className="min-w-0 pt-0.5">
                {/* NO es un encabezado: en el orden del documento, el
                    sidebar va ANTES que el <h1> de la página (que vive
                    en el contenido, a la derecha) — un h2 acá dejaría un
                    heading suelto por delante del h1, otra vez el mismo
                    tipo de salto que ya se corrigió una vez. Es un dato
                    de identidad, no el título de una sección. */}
                <p className="truncate text-[14.5px] font-extrabold text-white">{nombre}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-white/65">{correo}</p>
                <span className="mt-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-white">
                  {tieneNegocio ? "Proveedor" : "Cliente"}
                </span>
              </div>
            </div>

            <nav aria-label="Secciones de cuenta" className="grid gap-1 border-b border-white/15 py-4">
              {!modoNegocio ? (
                <>
                  <ItemNavOscuro actual icono={<IconHome className="h-[16px] w-[16px]" />}>
                    Resumen
                  </ItemNavOscuro>
                  <ItemNavOscuro
                    href="/cuenta/ir/invitaciones"
                    icono={<IconFrame className="h-[16px] w-[16px]" />}
                    badge={confirmacionesNuevas}
                  >
                    Invitaciones
                  </ItemNavOscuro>
                  <ItemNavOscuro href="/cuenta/ir/reservas" icono={<IconCalendarLine className="h-[16px] w-[16px]" />}>
                    Reservas
                  </ItemNavOscuro>
                  <ItemNavOscuro href="/cuenta/ir/favoritos" icono={<IconHeart className="h-[16px] w-[16px]" />}>
                    Favoritos
                  </ItemNavOscuro>
                  <ItemNavOscuro href="/cuenta/lealtad" icono={<IconStar className="h-[16px] w-[16px]" />}>
                    Mi lealtad
                  </ItemNavOscuro>
                </>
              ) : (
                <>
                  <ItemNavOscuro actual icono={<IconHome className="h-[16px] w-[16px]" />}>
                    Resumen
                  </ItemNavOscuro>
                  <ItemNavOscuro
                    href="/cuenta/ir/proveedor"
                    icono={<IconStore className="h-[16px] w-[16px]" />}
                    badge={reservasNuevasNegocio}
                  >
                    Panel de proveedor
                  </ItemNavOscuro>
                  <ItemNavOscuro href="/cuenta/ir/finanzas" icono={<IconChartBars className="h-[16px] w-[16px]" />}>
                    Finanzas
                  </ItemNavOscuro>
                  <ItemNavOscuro
                    href={lealtadActiva ? "/cuenta/ir/lealtad" : "/lealtad"}
                    icono={<IconStar className="h-[16px] w-[16px]" />}
                  >
                    Programa de lealtad
                  </ItemNavOscuro>
                </>
              )}
            </nav>

            <div className="grid gap-1 pt-4">
              <EditarPerfil nombreActual={nombreCrudo} telefonoActual={telefono} variante="oscuro" />
              {tieneNegocio && (
                <button
                  type="button"
                  onClick={toggleModo}
                  className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span aria-hidden="true">
                    <IconStore className="h-[14px] w-[14px]" />
                  </span>
                  {modoNegocio ? "Volver a mi perfil" : "Modo Negocio"}
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── Contenido ──────────────────────────────────────────── */}
        <div className="min-w-0">
          <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-orange">
                {fechaHoy}
              </p>
              <h1 className="titulo text-[32px] leading-[0.98] text-aventurea-navy sm:text-[44px]">
                {modoNegocio ? "Tu negocio, en un panel a la altura." : "Todo listo para tu próxima experiencia."}
              </h1>
              <p className="mt-2.5 max-w-[480px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                {modoNegocio
                  ? "Disponibilidad, solicitudes, clientes y rendimiento de tu espacio, en un panel pensado para el día a día."
                  : "Reservas, invitaciones y beneficios reunidos en tu cuenta Bookea."}
              </p>
            </div>
            {!modoNegocio && (
              <Link
                href="/eventos"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-aventurea-navy-2"
              >
                <span aria-hidden="true">
                  <IconCompass className="h-[14px] w-[14px]" />
                </span>
                Explorar
              </Link>
            )}
          </section>

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

              <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.6fr_0.85fr]">
                <ProximaExperienciaCard proxima={proximaExperiencia} />
                <MiLealtadResumen count={misLealtadesCount} principal={lealtadPrincipal} />
              </div>
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

          <BannerNegocio
            visible={!modoNegocio}
            tieneNegocio={tieneNegocio}
            onPasarAModoNegocio={toggleModo}
          />

          <footer className="mt-6 flex items-center justify-between gap-4 border-t border-aventurea-line pt-5 text-[11px] text-aventurea-ink-soft">
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

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Un ítem del nav sobre la tarjeta navy: el actual queda como píldora blanca. */
function ItemNavOscuro({
  href,
  icono,
  actual,
  badge,
  children,
}: {
  href?: string;
  icono: React.ReactNode;
  actual?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  const contenido = (
    <>
      <span aria-hidden="true">{icono}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-aventurea-orange px-2 py-0.5 text-[10px] font-extrabold tabular-nums text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  );
  const clases = "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition-colors";
  if (actual) {
    return (
      <div aria-current="page" className={`${clases} bg-white text-aventurea-navy shadow-lg`}>
        {contenido}
      </div>
    );
  }
  return (
    <Link href={href ?? "#"} className={`${clases} text-white/75 hover:bg-white/10 hover:text-white`}>
      {contenido}
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

/** "Tu actividad" / "Tu negocio": grilla de tarjetas, una fila horizontal en celular. */
function SeccionActividad({ titulo, filas }: { titulo: string; filas: FilaActividad[] }) {
  return (
    <section aria-labelledby="actividad-titulo" className="mb-3.5">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 id="actividad-titulo" className="titulo text-[18px] text-aventurea-navy">
          {titulo}
        </h2>
        <span className="text-[11.5px] text-aventurea-ink-soft">Vista general</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {filas.map((f) => (
          <Link
            key={f.titulo}
            href={f.href}
            className="group relative flex items-start gap-3.5 overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 shadow-[0_10px_28px_-20px_rgba(22,41,94,0.5)] transition-shadow hover:shadow-[0_14px_32px_-16px_rgba(22,41,94,0.35)] sm:block sm:p-5"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-7 -right-5 hidden h-24 w-24 rounded-full bg-aventurea-sky/10 sm:block"
            />

            <span className="relative z-10 flex w-full items-center gap-3.5 sm:mb-5 sm:items-start sm:justify-between sm:gap-0">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aventurea-sky/10 text-aventurea-sky"
              >
                {f.icono}
              </span>
              {f.numero != null && (
                <strong className="hidden text-[26px] font-extrabold tracking-tight text-aventurea-navy sm:block">
                  {String(f.numero).padStart(2, "0")}
                </strong>
              )}
              {f.badge != null && f.badge > 0 && (
                <span className="ml-auto shrink-0 rounded-lg bg-aventurea-sky px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-white sm:ml-0 sm:absolute sm:right-5 sm:top-5">
                  +{f.badge > 99 ? "99" : f.badge}
                </span>
              )}
            </span>

            <span className="relative z-10 min-w-0 flex-1 sm:block">
              <span className="flex items-center justify-between gap-2 sm:block">
                <span className="truncate text-[14px] font-extrabold text-aventurea-ink sm:text-[15px]">
                  {f.titulo}
                </span>
                {f.numero != null && (
                  <strong className="shrink-0 text-[16px] font-extrabold text-aventurea-navy sm:hidden">
                    {f.numero}
                  </strong>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] font-medium text-aventurea-ink-soft sm:mt-1">
                {f.detalle}
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
    <div
      aria-labelledby="proxima-titulo"
      className="relative flex min-h-[240px] flex-col justify-end overflow-hidden rounded-3xl border border-aventurea-line p-6 sm:p-7"
      style={{
        backgroundImage: proxima?.fotoUrl
          ? `linear-gradient(120deg, rgba(22,41,94,.94) 0%, rgba(22,41,94,.74) 45%, rgba(22,41,94,.4) 100%), url(${proxima.fotoUrl})`
          : "linear-gradient(155deg, var(--color-aventurea-navy-2, #22397c), var(--color-aventurea-navy, #16295e))",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-orange">
        Tu próxima experiencia
      </p>

      {proxima ? (
        <>
          <h2 id="proxima-titulo" className="titulo max-w-[440px] text-[22px] text-white sm:text-[27px]">
            {proxima.negocioNombre}
          </h2>
          {proxima.categoriaTexto && (
            <p className="mt-1.5 text-[13px] font-semibold text-white/75">{proxima.categoriaTexto}</p>
          )}
          <p className="mt-3 text-[14px] font-bold text-white">{fechaLargaCR(proxima.fecha)}</p>
          {proxima.slug && (
            <Link
              href={`/${proxima.slug}`}
              className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-extrabold text-aventurea-navy transition-colors hover:bg-white/90"
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
          <h2 id="proxima-titulo" className="titulo max-w-[440px] text-[21px] text-white sm:text-[25px]">
            Todavía no hay nada en el calendario.
          </h2>
          <p className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-white/70">
            Descubrí espacios, citas y hospedajes seleccionados para convertir cualquier plan en algo
            memorable.
          </p>
          <Link
            href="/eventos"
            className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-extrabold text-aventurea-navy transition-colors hover:bg-white/90"
          >
            Explorar Bookea
            <span aria-hidden="true">
              <IconChevronRight className="h-[13px] w-[13px]" />
            </span>
          </Link>
        </>
      )}
    </div>
  );
}

/** Cuántos círculos como máximo antes de que la grilla de sellos deje de tener sentido visual. */
const TOPE_SELLOS_VISUALES = 20;

/** "Mi lealtad": 0/1/varias tarjetas, cada caso con su propio resumen honesto. */
function MiLealtadResumen({ count, principal }: { count: number; principal: LealtadPrincipal }) {
  return (
    <div
      aria-labelledby="lealtad-titulo"
      className="relative flex flex-col overflow-hidden rounded-3xl border border-aventurea-orange/25 bg-aventurea-surface p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-aventurea-orange/10"
      />

      <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-aventurea-ink-soft">
            Beneficios
          </p>
          <h2 id="lealtad-titulo" className="titulo text-[18px] text-aventurea-navy">
            Mi lealtad
          </h2>
        </div>
        <TotalLealtad count={count} principal={principal} />
      </div>

      <div className="relative z-10 flex-1">
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
      </div>

      <div className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t border-aventurea-line pt-4">
        <p className="truncate text-[11.5px] text-aventurea-ink-soft">
          {count === 1 && principal
            ? principal.negocioNombre
            : count === 0
              ? "Sin tarjetas todavía"
              : "Varios negocios"}
        </p>
        <Link
          href="/cuenta/lealtad"
          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-aventurea-navy hover:underline"
        >
          Ver tarjeta
          <span aria-hidden="true">
            <IconChevronRight className="h-[12px] w-[12px]" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/** El número grande de la esquina: "5/10" para una sola tarjeta de sellos, el conteo para el resto. */
function TotalLealtad({ count, principal }: { count: number; principal: LealtadPrincipal }) {
  if (count === 0) return null;
  if (count === 1 && principal && principal.tipo === "sellos" && principal.meta) {
    return (
      <strong className="shrink-0 text-[22px] font-extrabold tracking-tight text-aventurea-orange">
        {Math.min(principal.saldo, principal.meta)}/{principal.meta}
      </strong>
    );
  }
  return (
    <div className="shrink-0 text-right">
      <strong className="block text-[20px] font-extrabold text-aventurea-navy">{count}</strong>
      <span className="text-[10.5px] text-aventurea-ink-soft">{count === 1 ? "tarjeta" : "tarjetas"}</span>
    </div>
  );
}

/** El progreso real de la única tarjeta: sellos con cuadritos, lo demás con número y barra. */
function ProgresoLealtad({ principal }: { principal: NonNullable<LealtadPrincipal> }) {
  const { tipo, saldo, meta } = principal;

  if (tipo === "sellos" && meta && meta > 0 && meta <= TOPE_SELLOS_VISUALES) {
    const llenos = Math.min(saldo, meta);
    return (
      <div
        className="grid gap-2"
        // `auto-fill` con un piso de 26px: en vez de encoger los N
        // cuadritos hasta cualquier tamaño para que quepan en una sola
        // fila (ilegible en un celular angosto con meta cerca de 20),
        // la grilla arma menos columnas y pasa a la fila de abajo.
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(26px, 1fr))" }}
        aria-label={`Progreso de sellos: ${llenos} de ${meta}`}
      >
        {Array.from({ length: meta }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={`grid aspect-square place-items-center rounded-[9px] border ${
              i < llenos
                ? "border-aventurea-orange bg-aventurea-orange text-white shadow-[0_6px_14px_-6px_rgba(238,116,32,0.6)]"
                : "border-aventurea-line bg-aventurea-cream-2 text-transparent"
            }`}
          >
            <IconCheck className="h-[13px] w-[13px]" />
          </span>
        ))}
      </div>
    );
  }

  // Tipos que acumulan pero no como sellos (puntos, cashback, gift card,
  // o una meta de sellos demasiado grande para dibujar cuadritos).
  if (meta && meta > 0) {
    const pct = Math.max(0, Math.min(100, Math.round((saldo / meta) * 100)));
    return (
      <div>
        <p className="text-[24px] font-extrabold tabular-nums text-aventurea-ink">
          {saldo.toLocaleString("es-CR")}{" "}
          <span className="text-[13px] font-bold text-aventurea-ink-soft">{UNIDAD_SALDO[tipo]}</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-aventurea-cream-2">
          <div className="h-full rounded-full bg-aventurea-orange" style={{ width: `${pct}%` }} />
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
      <p className="text-[24px] font-extrabold tabular-nums text-aventurea-ink">
        {saldo.toLocaleString("es-CR")}{" "}
        <span className="text-[13px] font-bold text-aventurea-ink-soft">{UNIDAD_SALDO[tipo]}</span>
      </p>
    );
  }

  return <p className="text-[13px] text-aventurea-ink-soft">Tenés un beneficio activo en esta tarjeta.</p>;
}

/** El banner de cierre: invita a pasar a modo negocio, o a publicar un espacio si todavía no tiene ninguno. Oculto en modo negocio. */
function BannerNegocio({
  visible,
  tieneNegocio,
  onPasarAModoNegocio,
}: {
  visible: boolean;
  tieneNegocio: boolean;
  onPasarAModoNegocio: () => void;
}) {
  if (!visible) return null;
  return (
    <section className="relative mt-3.5 flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-aventurea-line bg-gradient-to-r from-aventurea-sky/10 to-aventurea-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-aventurea-orange to-aventurea-sky"
      />
      <div className="pl-2">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-ink-soft">
          Bookea para negocios
        </p>
        <h2 className="titulo text-[17px] text-aventurea-navy sm:text-[19px]">
          {tieneNegocio ? "¿También ofrecés espacios o servicios?" : "Publicá tu espacio."}
        </h2>
        <p className="mt-1 max-w-[480px] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          {tieneNegocio
            ? "Cambiá al panel profesional para administrar agenda, clientes, cobros y disponibilidad."
            : "Sumá tu lugar, tus citas o tu servicio al directorio y empezá a recibir reservas instantáneas."}
        </p>
      </div>
      {tieneNegocio ? (
        <button
          type="button"
          onClick={onPasarAModoNegocio}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-aventurea-navy-2"
        >
          Ir a modo negocio
          <span aria-hidden="true">
            <IconChevronRight className="h-[13px] w-[13px]" />
          </span>
        </button>
      ) : (
        <Link
          href="/publicar"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-aventurea-navy-2"
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
