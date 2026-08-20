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
import { Card, GrillaTablero, PildoraEstado } from "@/components/panel/piezas";
import {
  BAJADA_PANTALLA,
  BOTON_PANEL_PRIMARIO,
  CUERPO,
  CUERPO_SUAVE,
  DETALLE,
  DISCO_ACENTO,
  ENLACE_CARD,
  EYEBROW,
  EYEBROW_NEUTRO,
  GAP_METRICAS,
  GAP_TABLERO,
  RADIO_CARD,
  RADIO_TILE,
  ROTULO_CIFRA,
  SUPERFICIE_PANEL,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
import { TIPOS_TARJETA, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { fechaLargaCR } from "@/lib/fechas";
import EditarPerfil from "./editar-perfil";

/**
 * EL PERFIL — V3: la MISMA anatomía que los paneles de negocio.
 *
 * ------------------------------------------------------------------
 * QUÉ CAMBIÓ Y POR QUÉ
 * ------------------------------------------------------------------
 * La V2 salió de su propio mockup y quedó como una tercera forma de
 * hacer paneles en Bookea: /mi-negocio con su rail, /lealtad con el
 * suyo y /cuenta con un `aside` de 280px, cada uno con su tarjeta, su
 * kicker y su tipografía. Ahora las tres pantallas componen las mismas
 * piezas (`@/components/panel`), que son la anatomía de
 * `referencia/bookeapaneles.html`: lienzo gris, tarjeta blanca con
 * borde y elevación, encabezado con kicker + título + acción a la
 * derecha, métricas con disco de ícono.
 *
 * NINGÚN DATO CAMBIÓ. Los props son exactamente los mismos, los
 * cálculos viven donde vivían (page.tsx) y no se agregó una sola cifra
 * que no estuviera ya calculada.
 *
 * ------------------------------------------------------------------
 * LOS TRES PARES DE COLOR QUE ESTABAN MAL, CON SU NÚMERO
 * ------------------------------------------------------------------
 * 1. El kicker de la fecha y el «5/10» de lealtad usaban
 *    `text-aventurea-orange` (#ee7420) SOBRE FONDO CLARO: 2,94:1, por
 *    debajo hasta del 3:1 de texto grande. Pasan a `--orange-fuerte`
 *    (#a83f00), que es el naranja que sí se lee sobre claro: 6,22:1
 *    sobre blanco y 5,76:1 sobre el lienzo gris. El naranja del logo
 *    se queda donde SÍ funciona: sobre el navy de la tarjeta de
 *    «próxima experiencia» (4,65:1).
 * 2. El contador del menú era blanco sobre `aventurea-orange`: 3,44:1
 *    en letra de 10px, o sea reprobado. Pasa a letra `#a83f00` sobre
 *    `orange-light` #fdeee1 → 5,42:1, y de paso el contador deja de
 *    competir con el ítem activo, que es el otro elemento blanco.
 * 3. «Cerrar sesión» en `red-600` daba 4,47:1 sobre el lienzo gris
 *    nuevo. `red-700` da 5,98:1 — mismo rojo de la familia, un paso
 *    más oscuro.
 *
 * Y los alfas del rail (`text-white/75`, `bg-white/15`, `border-white/15`)
 * se van a tokens sólidos: `text-aventurea-rail` #9fb0cf da 6,33:1
 * sobre el navy del fondo del rail y 4,93:1 sobre el extremo claro de
 * su degradé, medido una sola vez en vez de variar con lo que haya
 * detrás.
 *
 * ------------------------------------------------------------------
 * LO QUE SE SACÓ
 * ------------------------------------------------------------------
 * El orbe naranja que sangraba por la esquina de «Mi lealtad»: es
 * exactamente el `.metric:after` de la maqueta, el adorno que ya se
 * había sacado de las tarjetas de número del panel por pasar por
 * detrás del dato. El porqué largo está en `tarjeta-dato.ts`.
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
  /** El id del único negocio con lealtad activa, o null si son 0 o 2+. */
  lealtadNegocioUnico: string | null;
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
  lealtadNegocioUnico,
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

  // A DÓNDE LLEVA «PROGRAMA DE LEALTAD» — un solo lugar, dos usos.
  // Sin programa activo: la landing de ventas. Con un solo negocio que
  // lo tenga: directo a SU panel — el clic extra de elegir en una lista
  // de un solo elemento no le sirve a nadie. Con 2+, al listado, que es
  // donde de verdad hace falta elegir.
  const hrefLealtad = !lealtadActiva
    ? "/lealtad"
    : lealtadNegocioUnico
      ? `/cuenta/ir/lealtad?negocio=${lealtadNegocioUnico}`
      : "/cuenta/ir/lealtad";

  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-7">
      <div className={`grid ${GAP_TABLERO} lg:grid-cols-[252px_1fr] lg:items-start lg:gap-8`}>
        {/* ── El rail: los MISMOS 252px que el panel de negocio ─────
            Era 280. Los tres paneles del producto miden ahora lo mismo,
            que es lo que hace que pasar de uno a otro no se sienta un
            salto — y es el ancho de la maqueta. */}
        <aside aria-label="Perfil y navegación" className="lg:sticky lg:top-[84px]">
          <div
            className={`${RADIO_CARD} bg-aventurea-rail-fondo p-3 text-white shadow-elevado`}
          >
            {/* LA CABECERA DE CUENTA (`.business` de la maqueta): una
                superficie propia dentro del rail, no una fila con un
                borde debajo. */}
            <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.07] p-2.5">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[14px] font-extrabold text-aventurea-navy"
              >
                {inicialesAvatar}
              </span>
              <div className="min-w-0 flex-1">
                {/* NO es un encabezado: en el orden del documento, el
                    sidebar va ANTES que el <h1> de la página (que vive
                    en el contenido, a la derecha) — un h2 acá dejaría un
                    heading suelto por delante del h1, otra vez el mismo
                    tipo de salto que ya se corrigió una vez. Es un dato
                    de identidad, no el título de una sección. */}
                <p className="truncate text-[13.5px] font-extrabold text-white">{nombre}</p>
                <p className="mt-0.5 truncate text-[11px] text-aventurea-rail">{correo}</p>
              </div>
            </div>

            <p className={`mt-4 ${RAIL_GRUPO}`}>
              {modoNegocio ? "Tu negocio" : "Tu cuenta"}
            </p>
            <nav aria-label="Secciones de cuenta" className="grid gap-0.5">
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
                    Mis tarjetas de fidelidad
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
                  <ItemNavOscuro href={hrefLealtad} icono={<IconStar className="h-[16px] w-[16px]" />}>
                    Programa de lealtad
                  </ItemNavOscuro>
                </>
              )}
            </nav>

            {/* EL PIE DEL RAIL (`.sidebar-bottom` de la maqueta). El rol
                se mudó acá desde la cabecera: no es identidad, es qué
                puede hacer esta cuenta, o sea de la misma familia que
                «Modo Negocio», que está justo al lado. */}
            <div className="mt-4 border-t border-white/15 pt-3">
              <p className={RAIL_GRUPO}>Ajustes</p>
              <div className="grid gap-0.5">
                <EditarPerfil nombreActual={nombreCrudo} telefonoActual={telefono} variante="oscuro" />
                {tieneNegocio && (
                  <button
                    type="button"
                    onClick={toggleModo}
                    className={`${RAIL_ITEM} text-aventurea-rail hover:bg-white/10 hover:text-white`}
                  >
                    <span aria-hidden="true">
                      <IconStore className="h-[14px] w-[14px]" />
                    </span>
                    {modoNegocio ? "Volver a mi perfil" : "Modo Negocio"}
                  </button>
                )}
              </div>
              <p className="mt-3 px-3 text-[11px] text-aventurea-rail">
                Entrás como{" "}
                <strong className="font-bold text-white">
                  {tieneNegocio ? "proveedor" : "cliente"}
                </strong>
                .
              </p>
            </div>
          </div>
        </aside>

        {/* ── Contenido ──────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* EL TITULAR (`.heading`): kicker + h1 + bajada a la
              izquierda, acción a la derecha. */}
          <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className={EYEBROW}>{fechaHoy}</p>
              <h1 className={`mt-2 ${TITULO_PANTALLA} sm:text-[38px]`}>
                {modoNegocio ? "Tu negocio, en un panel a la altura." : "Todo listo para tu próxima experiencia."}
              </h1>
              <p className={`mt-2.5 max-w-[480px] ${BAJADA_PANTALLA}`}>
                {modoNegocio
                  ? "Disponibilidad, solicitudes, clientes y rendimiento de tu espacio, en un panel pensado para el día a día."
                  : "Reservas, invitaciones y beneficios reunidos en tu cuenta Bookea."}
              </p>
            </div>
            {!modoNegocio && (
              <Link href="/eventos" className={BOTON_PANEL_PRIMARIO}>
                <span aria-hidden="true">
                  <IconCompass className="h-[14px] w-[14px]" />
                </span>
                Explorar
              </Link>
            )}
          </section>

          <div className={`flex flex-col ${GAP_TABLERO}`}>
            {!modoNegocio ? (
              <>
                <SeccionActividad
                  eyebrow="Últimos movimientos"
                  titulo="Tu actividad"
                  filas={[
                    {
                      href: "/cuenta/ir/invitaciones",
                      icono: <IconFrame className="h-[17px] w-[17px]" />,
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
                      icono: <IconCalendarLine className="h-[17px] w-[17px]" />,
                      titulo: "Tus reservas",
                      detalle: `${activas} activas, ${historial} historial${
                        resenasCount > 0 ? ` · ${resenasCount} reseña${resenasCount === 1 ? "" : "s"}` : ""
                      }`,
                      numero: activas,
                    },
                    {
                      href: "/cuenta/ir/favoritos",
                      icono: <IconHeart className="h-[17px] w-[17px]" />,
                      titulo: "Tus favoritos",
                      detalle: favoritosCount === 1 ? "1 favorito" : `${favoritosCount} favoritos`,
                      numero: favoritosCount,
                    },
                  ]}
                />

                <GrillaTablero>
                  <ProximaExperienciaCard proxima={proximaExperiencia} />
                  <MiLealtadResumen count={misLealtadesCount} principal={lealtadPrincipal} />
                </GrillaTablero>
              </>
            ) : (
              <SeccionActividad
                eyebrow="Tu operación"
                titulo="Tu negocio"
                filas={[
                  {
                    href: "/cuenta/ir/proveedor",
                    icono: <IconStore className="h-[17px] w-[17px]" />,
                    titulo: "Panel de proveedor",
                    detalle: `${negociosLength} publicación${negociosLength !== 1 ? "es" : ""}`,
                    numero: negociosLength,
                    badge: reservasNuevasNegocio,
                  },
                  {
                    href: "/cuenta/ir/finanzas",
                    icono: <IconChartBars className="h-[17px] w-[17px]" />,
                    titulo: "Finanzas",
                    detalle: `${vecesContratado} reservas confirmadas`,
                    numero: vecesContratado,
                  },
                  {
                    href: hrefLealtad,
                    icono: <IconStar className="h-[17px] w-[17px]" />,
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
          </div>

          <footer className="mt-6 flex items-center justify-between gap-4 border-t border-aventurea-line pt-5 text-[11px] text-aventurea-ink-soft">
            <span>Bookea · Cuenta protegida</span>
            <form action={cerrarSesion}>
              {/* red-700 y no red-600: sobre el lienzo gris del panel el
                  600 daba 4,47:1 y este da 5,98:1. */}
              <button type="submit" className="font-bold text-red-700 hover:underline">
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

/* La piel del rail. Se escribe acá y no se importa de
   `panel/sistema.ts` porque ese `RAIL_ITEM` reserva 3px de borde
   izquierdo para la barrita del acento del tipo de negocio — /cuenta
   no tiene tipo de negocio, así que esos 3px serían un margen sin
   significado. Lo demás (alto 38, radio 12, 13px/bold) es idéntico. */
const RAIL_ITEM =
  "flex min-h-[38px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-bold transition-colors";

const RAIL_GRUPO =
  "mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-rail";

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
      {/* El contador: letra #a83f00 sobre #fdeee1 = 5,42:1. Era blanco
          sobre el naranja del logo (3,44:1) en letra de 10px. */}
      {badge != null && badge > 0 && (
        <span className="rounded-lg bg-aventurea-orange-light px-1.5 py-0.5 text-[10.5px] font-extrabold tabular-nums text-bookea-naranja-fuerte">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  );
  if (actual) {
    return (
      <div aria-current="page" className={`${RAIL_ITEM} bg-white text-aventurea-navy`}>
        {contenido}
      </div>
    );
  }
  return (
    <Link
      href={href ?? "#"}
      className={`${RAIL_ITEM} text-aventurea-rail hover:bg-white/10 hover:text-white`}
    >
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

/**
 * «Tu actividad» / «Tu negocio»: la fila de MÉTRICAS del panel, con la
 * anatomía de la `.metric` de la maqueta —disco de ícono arriba, rótulo
 * en versalitas, la cifra grande y el detalle debajo— y cada una
 * enlazada a su sección.
 *
 * No usa el `Metrica` compartido porque acá la tarjeta entera es un
 * enlace y lleva un contador de novedades en la esquina; lo que sí
 * comparte es cada decisión visual (superficie, disco, escala), que
 * sale del sistema y no de esta pantalla.
 */
function SeccionActividad({
  eyebrow,
  titulo,
  filas,
}: {
  eyebrow: string;
  titulo: string;
  filas: FilaActividad[];
}) {
  return (
    <section aria-labelledby="actividad-titulo">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className={`mb-1.5 ${EYEBROW_NEUTRO}`}>{eyebrow}</p>
          <h2 id="actividad-titulo" className="titulo text-[18px] tracking-[-0.02em] text-aventurea-navy">
            {titulo}
          </h2>
        </div>
        <span className={DETALLE}>Vista general</span>
      </div>

      <div className={`grid ${GAP_METRICAS} sm:grid-cols-3`}>
        {filas.map((f) => (
          <Link
            key={f.titulo}
            href={f.href}
            className={`group flex min-w-0 flex-col ${SUPERFICIE_PANEL} ${RADIO_TILE} p-4 transition-colors hover:border-aventurea-navy`}
          >
            <span className="flex items-center justify-between gap-2">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={DISCO_ACENTO}
              >
                {f.icono}
              </span>
              {f.badge != null && f.badge > 0 && (
                <PildoraEstado estado="info">+{f.badge > 99 ? "99" : f.badge}</PildoraEstado>
              )}
            </span>

            <span className={`mt-3 truncate ${ROTULO_CIFRA}`}>{f.titulo}</span>
            {f.numero != null && (
              <span className="mt-1.5 text-[22px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-aventurea-ink">
                {f.numero}
              </span>
            )}
            <span className={`mt-1.5 line-clamp-2 ${DETALLE}`}>{f.detalle}</span>
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
      className={`relative flex min-h-[240px] flex-col justify-end overflow-hidden ${RADIO_CARD} border border-aventurea-line p-6 shadow-elevado sm:p-7`}
      style={{
        backgroundImage: proxima?.fotoUrl
          ? `linear-gradient(120deg, rgba(22,41,94,.94) 0%, rgba(22,41,94,.74) 45%, rgba(22,41,94,.4) 100%), url(${proxima.fotoUrl})`
          : "linear-gradient(155deg, var(--color-aventurea-navy-2, #22397c), var(--color-aventurea-navy, #16295e))",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Acá el naranja del LOGO sí se puede: sobre el navy de la
          tarjeta da 4,65:1. Es el único lugar de la pantalla con fondo
          oscuro, y por eso el único donde sobrevive. */}
      <p className="mb-2.5 text-[11px] font-extrabold uppercase leading-none tracking-[0.14em] text-aventurea-orange">
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
              className="mt-5 inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-extrabold text-aventurea-navy transition-colors hover:bg-white/90"
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
          <p className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-white/75">
            Descubrí espacios, citas y hospedajes seleccionados para convertir cualquier plan en algo
            memorable.
          </p>
          <Link
            href="/eventos"
            className="mt-5 inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-extrabold text-aventurea-navy transition-colors hover:bg-white/90"
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
    /* SIN el orbe naranja que sangraba por la esquina: es el
       `.metric:after` de la maqueta, y pasaba justo por detrás del
       «5/10» — un adorno tapando el único dato de la tarjeta. Ya se
       había sacado de las métricas del panel por lo mismo. */
    <Card
      eyebrow="Beneficios"
      titulo="Mi lealtad"
      accion={<TotalLealtad count={count} principal={principal} />}
      className="flex flex-col"
    >
      <div className="flex-1">
        {count === 0 && (
          <p className={CUERPO}>
            Tus sellos y puntos van a aparecer acá cuando te afiliés al programa de lealtad de un negocio.
          </p>
        )}
        {count === 1 && principal && <ProgresoLealtad principal={principal} />}
        {count > 1 && (
          <p className={CUERPO}>
            Tenés {count} tarjetas activas — mirá el sello y el progreso de cada una.
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-aventurea-line pt-4">
        <p className={`truncate ${CUERPO_SUAVE}`}>
          {count === 1 && principal
            ? principal.negocioNombre
            : count === 0
              ? "Sin tarjetas todavía"
              : "Varios negocios"}
        </p>
        <Link href="/cuenta/lealtad" className={`inline-flex items-center gap-1 ${ENLACE_CARD}`}>
          Ver tarjeta
          <span aria-hidden="true">
            <IconChevronRight className="h-[12px] w-[12px]" />
          </span>
        </Link>
      </div>
    </Card>
  );
}

/** El número grande de la esquina: "5/10" para una sola tarjeta de sellos, el conteo para el resto. */
function TotalLealtad({ count, principal }: { count: number; principal: LealtadPrincipal }) {
  if (count === 0) return null;
  if (count === 1 && principal && principal.tipo === "sellos" && principal.meta) {
    return (
      /* `--orange-fuerte` y no el naranja del logo: sobre blanco, el del
         logo da 2,94:1 y esto es el DATO de la tarjeta. 6,22:1. */
      <strong className="shrink-0 text-[22px] font-extrabold tracking-[-0.04em] tabular-nums text-bookea-naranja-fuerte">
        {Math.min(principal.saldo, principal.meta)}/{principal.meta}
      </strong>
    );
  }
  return (
    <div className="shrink-0 text-right">
      <strong className="block text-[20px] font-extrabold tabular-nums text-aventurea-navy">
        {count}
      </strong>
      <span className={DETALLE}>{count === 1 ? "tarjeta" : "tarjetas"}</span>
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
          /* El sello lleno se queda en el naranja del logo: es un
             ELEMENTO GRÁFICO (3:1 contra blanco = 3,44:1 ✓), no texto, y
             la palomita blanca encima solo tiene que distinguirse de la
             forma, que ya la da el relleno. Es además el único lugar de
             la cuenta donde el naranja de marca aparece como relleno, y
             por eso significa algo. */
          <span
            key={i}
            aria-hidden
            className={`grid aspect-square place-items-center rounded-[9px] border ${
              i < llenos
                ? "border-aventurea-orange bg-aventurea-orange text-white"
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
        <p className="text-[24px] font-extrabold tracking-[-0.04em] tabular-nums text-aventurea-ink">
          {saldo.toLocaleString("es-CR")}{" "}
          <span className="text-[13px] font-bold text-aventurea-ink-soft">{UNIDAD_SALDO[tipo]}</span>
        </p>
        {/* 6px, como la `.progress` de la maqueta escalada al panel. */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-aventurea-cream-2">
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
      <p className="text-[24px] font-extrabold tracking-[-0.04em] tabular-nums text-aventurea-ink">
        {saldo.toLocaleString("es-CR")}{" "}
        <span className="text-[13px] font-bold text-aventurea-ink-soft">{UNIDAD_SALDO[tipo]}</span>
      </p>
    );
  }

  return <p className={CUERPO}>Tenés un beneficio activo en esta tarjeta.</p>;
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
    /* El `.insight` de la maqueta: el bloque navy con degradé que cierra
       el tablero. Antes era una franja casi blanca con una barrita de
       dos colores al costado, o sea que la única invitación de la
       pantalla se leía como una nota al pie. */
    <section
      className={`relative flex flex-col items-start gap-4 overflow-hidden ${RADIO_CARD} bg-aventurea-rail-fondo p-5 text-white shadow-elevado sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6`}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase leading-none tracking-[0.14em] text-aventurea-orange">
          Bookea para negocios
        </p>
        <h2 className="titulo mt-2 text-[17px] tracking-[-0.02em] text-white sm:text-[19px]">
          {tieneNegocio ? "¿También ofrecés espacios o servicios?" : "Publicá tu espacio."}
        </h2>
        {/* Sólido y no `white/70`: #9fb0cf sobre el navy da 6,33:1 y no
            cambia según el punto del degradé sobre el que caiga. */}
        <p className="mt-1.5 max-w-[480px] text-[12.5px] leading-relaxed text-aventurea-rail">
          {tieneNegocio
            ? "Cambiá al panel profesional para administrar agenda, clientes, cobros y disponibilidad."
            : "Sumá tu lugar, tus citas o tu servicio al directorio y empezá a recibir reservas instantáneas."}
        </p>
      </div>
      {tieneNegocio ? (
        <button
          type="button"
          onClick={onPasarAModoNegocio}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-extrabold text-aventurea-navy transition-colors hover:bg-white/90"
        >
          Ir a modo negocio
          <span aria-hidden="true">
            <IconChevronRight className="h-[13px] w-[13px]" />
          </span>
        </button>
      ) : (
        <Link
          href="/publicar"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-extrabold text-aventurea-navy transition-colors hover:bg-white/90"
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
