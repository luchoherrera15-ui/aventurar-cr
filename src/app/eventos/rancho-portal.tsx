import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BookingCalendar from "./booking-calendar";
import ReservaModal from "./reserva-modal";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteHeader from "@/components/site-header";
import { IconCheck, IconPin, IconStar, IconUsers } from "@/components/icons";
import {
  CATALOGO_LABEL,
  CATEGORIA_LABEL,
  SUBCATEGORIA_LABEL,
  UNIDAD_PRECIO_LABEL,
  duracionHoras,
  enConfiguracion,
  etiquetaHorario,
  linkGoogleMaps,
  linkWaze,
  resumenDias,
  terminosPorDefecto,
  type Categoria,
  type PromocionDia,
  type Rancho,
  type RanchoItem,
} from "@/app/mi-negocio/types";
import type {
  DiaDisponibilidad,
  PrecioTier,
  ServicioAdicional,
} from "./tipos-lugar";
import { disponibilidadServicio, type CupoDia } from "@/lib/disponibilidad";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import {
  AmenidadesSeccion,
  CierreSeccion,
  DetallesSeccion,
  GaleriaHero,
  PresentacionSeccion,
  ResumenSeccion,
  type Resena,
} from "./[id]/portal-secciones";
import ReservaServicio from "./[id]/reserva-servicio";
import MenuServicio from "./[id]/menu-servicio";
import ProveedorActual from "@/components/proveedor-actual";
import SiteFooter from "@/components/site-footer";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

/**
 * El portal público de un rancho/servicio: el mismo contenido se
 * muestra tanto en /eventos/[id] (enlace legado) como en
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

  // En configuración: el dueño todavía la está armando y no quiere que
  // le entren reservas a medias. La página no se abre para nadie más —
  // él sí la ve, para poder revisar cómo va quedando.
  if (enConfiguracion(rancho.detalles) && !puedeModificar) {
    return (
      <div className="min-h-screen bg-aventurea-cream-2">
        <SiteHeader breadcrumb={rancho.nombre} ancho="max-w-[1080px]" />
        <div className="mx-auto flex min-h-[62vh] max-w-[560px] flex-col items-center justify-center px-7 text-center">
          <span className="rounded-lg bg-aventurea-navy px-3.5 py-1.5 text-[11.5px] font-extrabold uppercase tracking-wide text-white">
            En configuración
          </span>
          <h1 className="titulo mt-5 text-[28px] text-aventurea-ink sm:text-[34px]">
            {rancho.nombre} está terminando de armar su página
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            Todavía no está disponible para reservar. Apenas su equipo
            termine de configurarla, vas a poder ver sus fotos, sus precios
            y agendar tu fecha desde acá.
          </p>
          <Link
            href="/eventos"
            className="mt-7 inline-flex items-center justify-center rounded-xl bg-aventurea-navy px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Ver otros espacios
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  // Esta página solo se renderiza para negocios de la vertical Eventos
  // (/eventos/[id] y /[slug] la resuelven así antes de llamar acá) — el
  // cast es seguro.
  const categoriaEventos = rancho.categoria as Categoria;
  const esLugar = categoriaEventos === "lugares";
  // Un negocio editado antes desde el móvil puede tener la portada
  // repetida dentro de fotos — de acá para adelante ya no debería pasar,
  // pero esto cubre lo que ya quedó guardado así.
  const fotos = Array.from(new Set(rancho.fotos ?? []));
  const amenidades = rancho.amenidades ?? [];
  const precio = fmtColones(rancho.precio_desde);
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
          titulo: CATEGORIA_LABEL[categoriaEventos],
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
  let tiersDiciembre: PrecioTier[] = [];
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
  const etiquetaCatalogo = CATALOGO_LABEL[categoriaEventos];

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
      // A propósito `*` y no la lista de columnas: `temporada` (0099)
      // puede no existir todavía en la base y pedirla por nombre haría
      // fallar la consulta entera, dejando la página sin precios. Se
      // lee abajo con typeof — sin la columna, todo queda en 'normal'.
      supabase
        .from("precio_tiers")
        .select("*")
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
    // Los rangos de diciembre son filas de la misma tabla, marcadas con
    // `temporada` (0099). Si la migración todavía no corrió, ninguna
    // fila la trae y el lugar sigue cotizando como siempre.
    const filasTiers = (tiersRes.data ?? []) as (PrecioTier & {
      temporada?: unknown;
    })[];
    const esDeDiciembre = (fila: { temporada?: unknown }) =>
      typeof fila.temporada === "string" && fila.temporada === "diciembre";
    const soloRango = ({ min_invitados, max_invitados, precio }: PrecioTier): PrecioTier => ({
      min_invitados,
      max_invitados,
      precio,
    });
    tiers = filasTiers.filter((f) => !esDeDiciembre(f)).map(soloRango);
    tiersDiciembre = filasTiers.filter(esDeDiciembre).map(soloRango);
    servicios = (svcRes.data ?? []) as ServicioAdicional[];
    promociones = ((promoRes.data ?? []) as PromocionDia[]).map((p) => ({
      ...p,
      dias_semana: Array.isArray(p.dias_semana) ? p.dias_semana : JSON.parse(p.dias_semana || "[]"),
    }));
  }

  return (
    <div
      className={`min-h-screen bg-aventurea-cream-2 ${esLugar ? "pb-16 lg:pb-0" : ""}`}
    >
      <RevealOnScroll />
      {/* La burbuja de chat flotante pasa a abrir el chat con ESTE
          proveedor mientras se está en su página. Solo se le oculta al
          DUEÑO de esta publicación — nadie se manda una consulta a sí
          mismo. Colgarlo de `puedeModificar` (como estaba antes) la
          dejaba invisible para un admin en CUALQUIER negocio ajeno, el
          mismo bug que ya se había corregido acá abajo para el avisito
          de invitaciones. */}
      {user?.id !== rancho.owner_id && (
        <ProveedorActual ranchoId={rancho.id} nombre={rancho.nombre} />
      )}
      {/* El avisito flotante de invitaciones digitales queda APAGADO
          hasta nuevo aviso (decisión de producto). El componente sigue
          existiendo; para reactivarlo, volver a montarlo acá con la
          condición de siempre (no mostrárselo al dueño de la
          publicación: él no viene a reservarse a sí mismo). */}
      {/* Header liviano a propósito: logo + nombre, el botón de dueño
          si aplica, y el menú. "Publicá tu espacio" y "Ver todos los
          espacios" viven en el menú — acá solo estorbaban. */}
      <SiteHeader
        breadcrumb={rancho.nombre}
        ancho="max-w-[1080px]"
        conPublicar={false}
        extra={
          puedeModificar ? (
            <Link
              href={`/mi-negocio/${rancho.id}`}
              className="rounded-lg bg-aventurea-navy px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2"
            >
              Modificar tu página
            </Link>
          ) : undefined
        }
      />

      {/* Galería arriba de todo — nada de foto oscurecida con texto
          encima; el nombre y la ubicación van debajo, en texto plano. */}
      <GaleriaHero fotos={fotosHero} categoria={categoriaEventos} nombre={rancho.nombre} />

      <div className="mx-auto max-w-[1080px] px-7 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-aventurea-navy">
              {rancho.subcategoria
                ? SUBCATEGORIA_LABEL[rancho.subcategoria]
                : CATEGORIA_LABEL[categoriaEventos]}
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
            {/* Las consultas van por la burbuja de chat flotante —
                acá solo queda el camino directo a reservar. */}
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
                  <TituloSeccion kicker="El espacio">Sobre este lugar</TituloSeccion>
                  <p className="mt-2.5 whitespace-pre-line text-[14.5px] leading-relaxed text-aventurea-ink-soft">
                    {rancho.descripcion_larga || rancho.descripcion}
                  </p>
                </div>
              )}

              {(rancho.horarios_bloques ?? []).length > 0 && (
                <div className="mt-8">
                  <TituloSeccion kicker="Horarios">Horarios de alquiler</TituloSeccion>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(rancho.horarios_bloques ?? []).map((h) => {
                      const horas = duracionHoras(h.desde, h.hasta);
                      const dias = resumenDias(h.dias_semana);
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
                          {dias && (
                            <span className="font-normal text-aventurea-ink-soft">
                              {" "}
                              · {dias}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <TituloSeccion kicker="Condiciones">Lo que debés saber</TituloSeccion>
                <ul className="mt-3 flex flex-col gap-2.5 rounded-2xl bg-aventurea-blue-light/60 p-5">
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

              {/* Adentro de la columna: así la tarjeta de precio
                  sticky acompaña el scroll también por las amenidades. */}
              <AmenidadesSeccion amenidades={amenidades} enColumna />
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
                {/* Las consultas van por la burbuja de chat flotante y
                    la tarjeta de Contacto abajo — acá no se repite. */}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* El calendario ya no ocupa la página: vive en un modal grande
          que se abre desde cualquier enlace a #reservar. */}
      {esLugar && (
        <ReservaModal nombreRancho={rancho.nombre}>
        <BookingCalendar
          ranchoId={rancho.id}
          nombreRancho={rancho.nombre}
          disponibilidad={disponibilidad}
          tiers={tiers}
          tiersDiciembre={tiersDiciembre}
          servicios={servicios}
          tarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
          depositoReserva={rancho.deposito_reserva ?? 25000}
          modalidadPrecio={rancho.modalidad_precio_lugar}
          precioHora={rancho.precio_hora_lugar}
          precioFijo={rancho.precio_fijo_lugar}
          precioHoraDiciembre={rancho.precio_hora_diciembre ?? null}
          precioFijoDiciembre={rancho.precio_fijo_diciembre ?? null}
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
        </ReservaModal>
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

      {/* El menú manda: la página de un servicio se lee como su carta,
          con fotos y precios. La agenda ya no vive acá — se abre en su
          propia hoja con el botón de abajo (o el de arriba, o la barra
          del celular: los tres apuntan a #reservar). */}
      {!esLugar && (
        <MenuServicio
          items={itemsCatalogo}
          etiqueta={etiquetaCatalogo}
          nombreRancho={rancho.nombre}
        />
      )}

      {!esLugar && (
        <section className="border-t border-aventurea-line bg-aventurea-cream-2/40 py-14">
          <div className="mx-auto max-w-[680px] px-7 text-center">
            <p className="flex items-center justify-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              Reservá con {rancho.nombre}
            </p>
            <h2 className="titulo mt-2 text-[26px] text-aventurea-ink sm:text-[30px]">
              ¿Listo para tu evento?
            </h2>
            <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              {itemsCatalogo.length > 0
                ? `Elegí la fecha, armá tu pedido con el ${etiquetaCatalogo.toLowerCase()} y pagá el depósito — queda en aprobación del proveedor, sin tener que chatear.`
                : "Elegí la fecha y contanos qué necesitás — tu reserva queda en aprobación del proveedor."}
            </p>
            <a
              href="#reservar"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-aventurea-sky px-8 py-3.5 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-sky-dark"
            >
              ¡Reservar tu espacio!
            </a>
          </div>
        </section>
      )}

      {/* La agenda, en su hoja aparte — se abre con cualquier enlace a
          #reservar y se cierra sin perder la página. */}
      {!esLugar && (
        <ReservaModal nombreRancho={rancho.nombre}>
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
              montoMinimo={rancho.monto_minimo ?? null}
              categoria={rancho.categoria}
            />
          ) : (
            <div className="p-2 text-center">
              <h3 className="titulo text-[20px] text-aventurea-ink">
                Iniciá sesión para reservar
              </h3>
              <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                Tu reserva queda ligada a tu cuenta: ahí ves el estado, el chat
                con {rancho.nombre} y tu historial.
              </p>
              <Link
                href="/cuenta"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
              >
                Iniciar sesión
              </Link>
            </div>
          )}
        </ReservaModal>
      )}

      {!esLugar && (
        <DetallesSeccion
          categoria={categoriaEventos}
          detalles={rancho.detalles ?? {}}
        />
      )}

      {/* Para Lugares, el nombre y la descripción ya viven arriba en la
          columna "Sobre este lugar" — repetirlos acá era ruido. */}
      {!esLugar && (
        <PresentacionSeccion
          eyebrow={
            rancho.subcategoria
              ? SUBCATEGORIA_LABEL[rancho.subcategoria]
              : CATEGORIA_LABEL[categoriaEventos]
          }
          titulo={rancho.nombre}
          texto={rancho.descripcion_larga || rancho.descripcion}
        />
      )}

      {/* Reseñas, ubicación y contacto en una sola banda: una foto de
          la galería de fondo y las tres tarjetas de vidrio encima. */}
      <CierreSeccion
        fotoFondo={fotosHero[1] ?? fotosHero[0] ?? null}
        nombre={rancho.nombre}
        resenas={resenas}
        promedio={calificacion?.promedio ?? null}
        total={calificacion?.total ?? resenas.length}
        ubicacion={ubicacion}
        googleMaps={googleMaps}
        waze={waze}
        ranchoId={rancho.id}
        instagram={rancho.instagram}
        facebook={rancho.facebook}
        tiktok={rancho.tiktok}
        sitioWeb={rancho.sitio_web}
      />

      <p className="border-t border-aventurea-line py-6 text-center text-xs text-zinc-500">
        <Link href="/eventos" className="font-bold text-aventurea-orange">
          Ver todos los espacios
        </Link>
      </p>
      <SiteFooter />
    </div>
  );
}

/**
 * Encabezado de las secciones de contenido del perfil: el mismo
 * lenguaje de las secciones oscuras (kicker naranja con su rayita +
 * título en Figtree apretado), para que toda la página hable igual.
 */
function TituloSeccion({
  kicker,
  children,
}: {
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-aventurea-orange before:block before:h-px before:w-5 before:bg-aventurea-sky">
        {kicker}
      </p>
      <h2 className="titulo mt-1.5 text-[20px] text-aventurea-ink">{children}</h2>
    </>
  );
}
