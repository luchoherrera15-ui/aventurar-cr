import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BookingCalendar from "@/app/eventos-salon/booking-calendar";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteHeader from "@/components/site-header";
import { IconCheck, IconPin, IconStar, IconUsers } from "@/components/icons";
import {
  CATALOGO_LABEL,
  CATEGORIA_LABEL,
  SUBCATEGORIA_LABEL,
  UNIDAD_PRECIO_LABEL,
  duracionHoras,
  etiquetaHorario,
  linkGoogleMaps,
  linkWaze,
  terminosPorDefecto,
  type PromocionDia,
  type Rancho,
  type RanchoItem,
} from "@/app/mi-rancho/types";
import type {
  DiaDisponibilidad,
  PrecioTier,
  ServicioAdicional,
} from "@/app/eventos-salon/types";
import { disponibilidadServicio, type CupoDia } from "@/lib/disponibilidad";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import {
  AmenidadesSeccion,
  ContactoSeccion,
  DetallesSeccion,
  GaleriaHero,
  MapaSeccion,
  PresentacionSeccion,
  ResenasSeccion,
  ResumenSeccion,
  type Resena,
} from "./[id]/portal-secciones";
import ReservaServicio from "./[id]/reserva-servicio";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

/**
 * El portal público de un rancho/servicio: el mismo contenido se
 * muestra tanto en /ranchos-eventos/[id] (enlace legado) como en
 * /[slug] (la URL corta, ej. bookea.lat/rancholastorres). Cada ruta
 * se encarga de buscar la fila en `ranchos` a su manera (por id o por
 * slug) y le pasa acá el resultado ya normalizado.
 */
export default async function RanchoPortal({ rancho }: { rancho: Rancho }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El dueño (o un admin ayudándolo) ve un acceso directo a modificar
  // esta misma publicación, sin tener que buscarla en "Mis publicaciones".
  let puedeModificar = false;
  if (user) {
    if (user.id === rancho.owner_id) {
      puedeModificar = true;
    } else {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .maybeSingle();
      puedeModificar = perfil?.rol === "admin";
    }
  }

  const esLugar = rancho.categoria === "lugares";
  // Un negocio editado antes desde el móvil puede tener la portada
  // repetida dentro de fotos — de acá para adelante ya no debería pasar,
  // pero esto cubre lo que ya quedó guardado así.
  const fotos = Array.from(new Set(rancho.fotos ?? []));
  const amenidades = rancho.amenidades ?? [];
  const precio = fmtColones(rancho.precio_desde);
  // La consulta previa vive en el chat de la plataforma — cero WhatsApp.
  const chatHref = `/mensajes/consulta/${rancho.id}`;
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");
  // Los botones de "Cómo llegar" usan las coordenadas si el dueño las
  // cargó; si no, mandan la dirección escrita como búsqueda.
  const direccionBusqueda = [
    rancho.nombre,
    rancho.direccion_exacta,
    rancho.canton,
    rancho.provincia,
    "Costa Rica",
  ]
    .filter(Boolean)
    .join(", ");
  const googleMaps = linkGoogleMaps(rancho.latitud, rancho.longitud, direccionBusqueda);
  const waze = linkWaze(rancho.latitud, rancho.longitud, direccionBusqueda);
  const capacidad =
    rancho.capacidad_min || rancho.capacidad_max
      ? `${rancho.capacidad_min ?? "?"}–${rancho.capacidad_max ?? "?"} personas`
      : "A consultar";

  // La foto grande del hero es la que el dueño eligió como presentación,
  // o si no la de portada; el resto de la galería la completa, sin
  // repetir la misma foto dos veces.
  const fotoDestacada = rancho.foto_presentacion ?? rancho.foto_url;
  const fotosHero = fotoDestacada
    ? [fotoDestacada, ...fotos.filter((f) => f !== fotoDestacada)]
    : fotos;

  const datosPresentacion = esLugar
    ? [
        {
          icono: <IconUsers />,
          titulo: "Capacidad",
          detalle: capacidad,
        },
        {
          icono: <IconCheck />,
          titulo: amenidades.length > 0 ? `${amenidades.length} amenidades` : "Amenidades",
          detalle: amenidades.length > 0 ? "Ver la lista completa abajo" : "A consultar",
        },
        {
          icono: <IconPin />,
          titulo: rancho.provincia ?? "Costa Rica",
          detalle: rancho.canton ?? "Consultá cómo llegar",
        },
      ]
    : [
        {
          icono: <IconCheck />,
          titulo: CATEGORIA_LABEL[rancho.categoria],
          detalle: "Servicio para tu evento",
        },
        {
          icono: <IconUsers />,
          titulo: precio ? `Desde ${precio}` : "Precio a consultar",
          detalle: "Escribinos para cotizar",
        },
        {
          icono: <IconPin />,
          titulo: rancho.provincia ?? "Costa Rica",
          detalle: rancho.canton ?? "Consultá cobertura",
        },
      ];

  // Datos del calendario de Lugares (su flujo propio, intacto).
  let disponibilidad: Record<string, DiaDisponibilidad> = {};
  let tiers: PrecioTier[] = [];
  let servicios: ServicioAdicional[] = [];
  let promociones: PromocionDia[] = [];

  // El catálogo (menú/paquetes) de los servicios: es lo que el cliente
  // elige al armar su reserva. La disponibilidad dice qué días ya
  // están llenos y cuánto queda de cada paquete por fecha.
  let itemsCatalogo: RanchoItem[] = [];
  let disponibilidadServicioPorDia: Record<string, CupoDia> = {};
  if (!esLugar) {
    const hoy = hoyISOCR();
    const [itemsRes, dispServicio] = await Promise.all([
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", rancho.id)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
      disponibilidadServicio(supabase, rancho.id, hoy, sumarDiasISO(hoy, 365)),
    ]);
    itemsCatalogo = (itemsRes.data ?? []) as RanchoItem[];
    disponibilidadServicioPorDia = dispServicio;
  }
  const anticipacionDias = Number(rancho.detalles?.anticipacion_dias) || 0;
  const etiquetaCatalogo = CATALOGO_LABEL[rancho.categoria];

  // Calificación y reseñas reales (solo de reservas confirmadas).
  const [{ data: califData }, { data: resenasData }] = await Promise.all([
    supabase
      .from("calificaciones_rancho")
      .select("promedio, total")
      .eq("rancho_id", rancho.id)
      .maybeSingle(),
    supabase
      .from("resenas")
      .select("id, calificacion, comentario, created_at")
      .eq("rancho_id", rancho.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const calificacion = califData as { promedio: number; total: number } | null;
  const resenas = (resenasData ?? []) as Resena[];

  if (esLugar) {
    await supabase
      .from("reservas")
      .delete()
      .eq("rancho_id", rancho.id)
      .eq("estado", "temporal")
      .lt("expira_en", new Date().toISOString());

    const [dispRes, tiersRes, svcRes, promoRes] = await Promise.all([
      supabase
        .from("disponibilidad_rancho")
        .select("fecha, estado")
        .eq("rancho_id", rancho.id),
      supabase
        .from("precio_tiers")
        .select("min_invitados, max_invitados, precio")
        .eq("rancho_id", rancho.id)
        .order("min_invitados", { ascending: true }),
      supabase
        .from("servicios_adicionales")
        .select("id, nombre, precio, requisito_max_invitados")
        .eq("rancho_id", rancho.id)
        .eq("activo", true),
      supabase
        .from("promociones_dia")
        .select("*")
        .eq("rancho_id", rancho.id)
        .eq("activo", true),
    ]);

    const acc: Record<string, DiaDisponibilidad> = {};
    (dispRes.data ?? []).forEach((r) => {
      const dia = acc[r.fecha] ?? {
        confirmada: false,
        pendientes: 0,
        temporales: 0,
      };
      if (r.estado === "confirmada") dia.confirmada = true;
      else if (r.estado === "temporal") dia.temporales += 1;
      else dia.pendientes += 1;
      acc[r.fecha] = dia;
    });
    disponibilidad = acc;
    tiers = (tiersRes.data ?? []) as PrecioTier[];
    servicios = (svcRes.data ?? []) as ServicioAdicional[];
    promociones = (promoRes.data ?? []) as PromocionDia[];
  }

  return (
    <div className={`min-h-screen bg-aventurea-cream ${esLugar ? "pb-16 lg:pb-0" : ""}`}>
      <RevealOnScroll />
      <SiteHeader
        breadcrumb={rancho.nombre}
        ancho="max-w-[1080px]"
        extra={
          <div className="flex items-center gap-4">
            {puedeModificar && (
              <Link
                href={`/mi-rancho/${rancho.id}`}
                className="rounded-lg bg-aventurea-navy px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2"
              >
                Modificar tu página
              </Link>
            )}
            <Link
              href="/ranchos-eventos"
              className="hidden text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy sm:block"
            >
              ← Ver todos los espacios
            </Link>
          </div>
        }
      />

      {/* Galería arriba de todo — nada de foto oscurecida con texto
          encima; el nombre y la ubicación van debajo, en texto plano. */}
      <GaleriaHero fotos={fotosHero} categoria={rancho.categoria} nombre={rancho.nombre} />

      <div className="mx-auto max-w-[1080px] px-7 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-aventurea-navy">
              {rancho.subcategoria
                ? SUBCATEGORIA_LABEL[rancho.subcategoria]
                : CATEGORIA_LABEL[rancho.categoria]}
            </p>
            <h1 className="titulo mt-1 text-[26px] text-aventurea-ink sm:text-[32px]">
              {rancho.nombre}
            </h1>
            {/* La línea de confianza, como en Airbnb: ★ nota · reseñas ·
                capacidad · ubicación — todo de un vistazo. */}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-aventurea-ink-soft">
              {calificacion && (
                <>
                  <span className="flex items-center gap-1 font-bold text-aventurea-ink">
                    <IconStar className="h-3.5 w-3.5" />
                    {calificacion.promedio.toFixed(2).replace(".", ",")}
                  </span>
                  <span>
                    · {calificacion.total} reseña{calificacion.total === 1 ? "" : "s"}
                  </span>
                </>
              )}
              {esLugar && (rancho.capacidad_min || rancho.capacidad_max) && (
                <span className="flex items-center gap-1">
                  {calificacion && "·"} <IconUsers className="h-3.5 w-3.5" />
                  {rancho.capacidad_min ?? "?"}–{rancho.capacidad_max ?? "?"} personas
                </span>
              )}
              {ubicacion && (
                <span className="flex items-center gap-1">
                  {(calificacion || (esLugar && (rancho.capacidad_min || rancho.capacidad_max))) &&
                    "·"}{" "}
                  <IconPin className="h-3.5 w-3.5 shrink-0" />
                  {ubicacion}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {/* Todo pasa por la reserva y el chat de la plataforma —
                el botón de WhatsApp se quitó a propósito. */}
            <a
              href="#reservar"
              className="inline-flex items-center gap-2 rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
            >
              {esLugar ? "Reservar mi fecha" : "Reservar fecha"}
            </a>
            <a
              href={chatHref}
              className="rounded-xl border border-aventurea-line px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              Consultar antes de reservar
            </a>
          </div>
        </div>
        {!esLugar && rancho.descripcion && (
          <p className="mt-3 max-w-[70ch] text-[14px] text-aventurea-ink-soft">
            {rancho.descripcion}
          </p>
        )}
      </div>

      {esLugar && (
        /* El patrón Airbnb: contenido a la izquierda, tarjeta de reserva
           fija a la derecha que acompaña el scroll. En celular la tarjeta
           se vuelve una barra fija abajo. */
        <div className="mx-auto max-w-[1080px] px-7 pb-4 pt-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
            <div className="min-w-0">
              {(rancho.descripcion_larga || rancho.descripcion) && (
                <div>
                  <h2 className="text-[19px] font-bold text-aventurea-ink">
                    Sobre este lugar
                  </h2>
                  <p className="mt-2.5 whitespace-pre-line text-[14.5px] leading-relaxed text-aventurea-ink-soft">
                    {rancho.descripcion_larga || rancho.descripcion}
                  </p>
                </div>
              )}

              {(rancho.horarios_bloques ?? []).length > 0 && (
                <div className="mt-8">
                  <h2 className="text-[19px] font-bold text-aventurea-ink">
                    Horarios de alquiler
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(rancho.horarios_bloques ?? []).map((h) => {
                      const horas = duracionHoras(h.desde, h.hasta);
                      return (
                        <span
                          key={h.id}
                          className="rounded-lg border border-aventurea-line bg-aventurea-surface px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink"
                        >
                          {etiquetaHorario(h)}
                          {horas !== null && (
                            <span className="font-normal text-aventurea-ink-soft">
                              {" "}
                              · {horas} h
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <h2 className="text-[19px] font-bold text-aventurea-ink">
                  Lo que debés saber
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {(rancho.terminos && rancho.terminos.length > 0
                    ? rancho.terminos
                    : terminosPorDefecto(
                        rancho.deposito_reserva ?? 25000,
                        rancho.monto_minimo ?? null,
                      )
                  ).map((t, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft"
                    >
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aventurea-navy/10 text-aventurea-navy">
                        <IconCheck className="h-2.5 w-2.5" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Tarjeta de reserva sticky (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-aventurea-line bg-aventurea-surface p-6 shadow-[0_6px_20px_rgba(16,26,44,0.08)]">
                <p className="text-[13px] text-aventurea-ink-soft">Desde</p>
                <p className="text-[26px] font-bold leading-tight text-aventurea-ink">
                  {precio ?? "A consultar"}
                  {precio && (
                    <span className="text-[14px] font-normal text-aventurea-ink-soft">
                      {" "}
                      {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}
                    </span>
                  )}
                </p>

                <div className="mt-4 flex flex-col gap-2 border-t border-aventurea-line pt-4 text-[13px] text-aventurea-ink-soft">
                  {(rancho.capacidad_min || rancho.capacidad_max) && (
                    <p className="flex items-center gap-2">
                      <IconUsers className="h-3.5 w-3.5 shrink-0" />
                      {rancho.capacidad_min ?? "?"}–{rancho.capacidad_max ?? "?"} personas
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <IconCheck className="h-3.5 w-3.5 shrink-0" />
                    Depósito para reservar:{" "}
                    <strong className="text-aventurea-ink">
                      {fmtColones(rancho.deposito_reserva ?? 25000)}
                    </strong>
                  </p>
                  <p className="flex items-center gap-2">
                    <IconCheck className="h-3.5 w-3.5 shrink-0" />
                    Confirmación del dueño en el día
                  </p>
                </div>

                <a
                  href="#reservar"
                  className="mt-5 flex h-12 items-center justify-center rounded-xl bg-aventurea-navy text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
                >
                  Ver fechas disponibles
                </a>
                <p className="mt-2.5 text-center text-[11.5px] text-zinc-500">
                  Todavía no se te cobra nada — elegís la fecha primero.
                </p>
                <a
                  href={chatHref}
                  className="mt-3 block border-t border-aventurea-line pt-3 text-center text-[12.5px] font-bold text-aventurea-navy hover:underline"
                >
                  ¿Tenés dudas? Preguntá por el chat
                </a>
              </div>
            </aside>
          </div>
        </div>
      )}

      {esLugar && (
        <BookingCalendar
          ranchoId={rancho.id}
          nombreRancho={rancho.nombre}
          disponibilidad={disponibilidad}
          tiers={tiers}
          servicios={servicios}
          tarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
          depositoReserva={rancho.deposito_reserva ?? 25000}
          modalidadPrecio={rancho.modalidad_precio_lugar}
          precioHora={rancho.precio_hora_lugar}
          precioFijo={rancho.precio_fijo_lugar}
          promociones={promociones}
          terminos={rancho.terminos ?? []}
          montoMinimo={rancho.monto_minimo ?? null}
          horarios={rancho.horarios_bloques ?? []}
          capacidadMax={rancho.capacidad_max}
          compacto
          sinpeNumero={rancho.sinpe_numero}
          sinpeTitular={rancho.sinpe_titular}
          cuentaBanco={rancho.cuenta_banco}
          cuentaNumero={rancho.cuenta_numero}
          cuentaTitular={rancho.cuenta_titular}
          cuentaTipo={rancho.cuenta_tipo}
          descripcion={rancho.descripcion}
        />
      )}

      {/* Barra fija de reserva en celular — siempre a un toque. */}
      {esLugar && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-aventurea-line bg-aventurea-surface px-5 py-3 shadow-[0_-4px_16px_rgba(16,26,44,0.08)] lg:hidden">
          <div>
            <p className="text-[11px] text-aventurea-ink-soft">Desde</p>
            <p className="text-[16px] font-bold leading-tight text-aventurea-ink">
              {precio ?? "A consultar"}
              {precio && (
                <span className="text-[11.5px] font-normal text-aventurea-ink-soft">
                  {" "}
                  {UNIDAD_PRECIO_LABEL[rancho.unidad_precio]}
                </span>
              )}
            </p>
          </div>
          <a
            href="#reservar"
            className="flex h-11 items-center justify-center rounded-xl bg-aventurea-navy px-6 text-[13.5px] font-bold text-white"
          >
            Ver fechas
          </a>
        </div>
      )}

      {/* Los datos y lo que incluye van antes de la foto grande: dos
          bloques oscuros seguidos se leían como una sola imagen. */}
      {!esLugar && <ResumenSeccion datos={datosPresentacion} />}

      {!esLugar && (
        <section id="reservar" className="border-t border-aventurea-line bg-aventurea-cream-2/40 py-14">
          <div className="mx-auto max-w-[680px] px-7">
            <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-5 before:bg-aventurea-navy">
              Reservá con {rancho.nombre}
            </p>
            <h2 className="titulo mt-2 text-[24px] text-aventurea-ink">
              Elegí tu fecha y armá tu reserva
            </h2>
            <p className="mt-1.5 text-[13.5px] text-aventurea-ink-soft">
              {itemsCatalogo.length > 0
                ? `Elegí la fecha, armá tu reserva con el ${etiquetaCatalogo.toLowerCase()} y pagá el depósito — queda en aprobación del proveedor, sin tener que chatear.`
                : "Elegí la fecha y contanos qué necesitás — tu reserva queda en aprobación del proveedor."}
            </p>

            <div className="mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 sm:p-6">
              {user ? (
                <ReservaServicio
                  ranchoId={rancho.id}
                  items={itemsCatalogo}
                  anticipacionDias={anticipacionDias}
                  etiquetaCatalogo={etiquetaCatalogo}
                  detalles={rancho.detalles ?? null}
                  depositoReserva={rancho.deposito_reserva ?? 0}
                  sinpeNumero={rancho.sinpe_numero}
                  sinpeTitular={rancho.sinpe_titular}
                  cuentaBanco={rancho.cuenta_banco}
                  cuentaNumero={rancho.cuenta_numero}
                  cuentaTitular={rancho.cuenta_titular}
                  cuentaTipo={rancho.cuenta_tipo}
                  disponibilidad={disponibilidadServicioPorDia}
                  eventosPorDia={rancho.eventos_por_dia ?? null}
                />
              ) : (
                <div>
                  {/* El menú se ve sin sesión — solo reservar la pide. */}
                  {itemsCatalogo.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        {etiquetaCatalogo} de {rancho.nombre}
                      </p>
                      <div className="overflow-hidden rounded-xl border border-aventurea-line">
                        {itemsCatalogo.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-baseline justify-between gap-3 border-b border-aventurea-line px-4 py-2.5 last:border-none"
                          >
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-bold text-aventurea-ink">
                                {item.nombre}
                              </p>
                              {item.descripcion && (
                                <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
                                  {item.descripcion}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 text-[13px] font-bold text-aventurea-navy">
                              {item.precio !== null
                                ? `₡${Number(item.precio).toLocaleString("es-CR")}${item.unidad ? ` ${item.unidad}` : ""}`
                                : "A cotizar"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-[13.5px] text-aventurea-ink-soft">
                      Iniciá sesión para reservar tu fecha y chatear con el proveedor.
                    </p>
                    <Link
                      href="/cuenta"
                      className="mt-3 inline-flex items-center justify-center rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
                    >
                      Iniciar sesión
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-[12.5px]">
              <a href={chatHref} className="font-bold text-aventurea-navy hover:underline">
                ¿Tenés dudas antes de reservar? Preguntá por el chat
              </a>
            </p>
          </div>
        </section>
      )}

      {esLugar ? (
        <AmenidadesSeccion amenidades={amenidades} />
      ) : (
        <DetallesSeccion
          categoria={rancho.categoria}
          detalles={rancho.detalles ?? {}}
        />
      )}

      <ResenasSeccion
        resenas={resenas}
        promedio={calificacion?.promedio ?? null}
        total={calificacion?.total ?? resenas.length}
      />

      {/* Para Lugares, el nombre y la descripción ya viven arriba en la
          columna "Sobre este lugar" — repetirlos acá era ruido. */}
      {!esLugar && (
        <PresentacionSeccion
          eyebrow={
            rancho.subcategoria
              ? SUBCATEGORIA_LABEL[rancho.subcategoria]
              : CATEGORIA_LABEL[rancho.categoria]
          }
          titulo={rancho.nombre}
          texto={rancho.descripcion_larga || rancho.descripcion}
        />
      )}

      {/* El mapa es de los lugares físicos; los servicios se trasladan
          al evento y su zona ya se ve en el encabezado. */}
      {esLugar && (
        <MapaSeccion
          nombre={rancho.nombre}
          ubicacion={ubicacion}
          latitud={rancho.latitud}
          longitud={rancho.longitud}
          googleMaps={googleMaps}
          waze={waze}
        />
      )}

      <ContactoSeccion
        nombre={rancho.nombre}
        chatHref={chatHref}
        instagram={rancho.instagram}
        facebook={rancho.facebook}
        tiktok={rancho.tiktok}
        sitioWeb={rancho.sitio_web}
        ubicacion={ubicacion}
        // Para lugares, los botones de cómo llegar ya viven en la
        // sección del mapa de arriba — repetirlos acá era ruido.
        googleMaps={esLugar ? null : googleMaps}
        waze={esLugar ? null : waze}
      />

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          BOOKEA — Costa Rica ·{" "}
          <Link href="/ranchos-eventos" className="font-bold text-aventurea-orange">
            Ver todos los espacios
          </Link>
        </p>
      </footer>
    </div>
  );
}
