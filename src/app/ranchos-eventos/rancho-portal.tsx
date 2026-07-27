import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BookingCalendar from "@/app/eventos-salon/booking-calendar";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteHeader from "@/components/site-header";
import { IconCheck, IconPin, IconUsers, IconWhatsapp } from "@/components/icons";
import {
  CATEGORIA_LABEL,
  SUBCATEGORIA_LABEL,
  linkGoogleMaps,
  linkWaze,
  type PromocionDia,
  type Rancho,
} from "@/app/mi-rancho/types";
import type {
  DiaDisponibilidad,
  PrecioTier,
  ServicioAdicional,
} from "@/app/eventos-salon/types";
import {
  AmenidadesSeccion,
  ContactoSeccion,
  DetallesSeccion,
  GaleriaHero,
  GaleriaSeccion,
  PresentacionSeccion,
  ResumenSeccion,
} from "./[id]/portal-secciones";
import FormularioCotizacion from "./[id]/formulario-cotizacion";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

/**
 * El portal público de un rancho/servicio: el mismo contenido se
 * muestra tanto en /ranchos-eventos/[id] (enlace legado) como en
 * /[slug] (la URL corta, ej. bookearcr.com/rancholastorres). Cada ruta
 * se encarga de buscar la fila en `ranchos` a su manera (por id o por
 * slug) y le pasa acá el resultado ya normalizado.
 */
export default async function RanchoPortal({ rancho }: { rancho: Rancho }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esLugar = rancho.categoria === "lugares";
  const fotos = rancho.fotos ?? [];
  const amenidades = rancho.amenidades ?? [];
  const precio = fmtColones(rancho.precio_desde);
  const whatsappHref = rancho.contacto_whatsapp
    ? `https://wa.me/${rancho.contacto_whatsapp.replace(/[^0-9]/g, "")}`
    : null;
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

  // Datos del calendario — solo los lugares tienen reserva en línea.
  let disponibilidad: Record<string, DiaDisponibilidad> = {};
  let tiers: PrecioTier[] = [];
  let servicios: ServicioAdicional[] = [];
  let promociones: PromocionDia[] = [];

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
    <div className="min-h-screen bg-aventurea-cream">
      <RevealOnScroll />
      <SiteHeader
        breadcrumb={rancho.nombre}
        ancho="max-w-[1080px]"
        extra={
          <Link
            href="/ranchos-eventos"
            className="hidden text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy sm:block"
          >
            ← Ver todos los espacios
          </Link>
        }
      />

      {/* Galería arriba de todo — nada de foto oscurecida con texto
          encima; el nombre y la ubicación van debajo, en texto plano. */}
      <GaleriaHero fotos={fotosHero} categoria={rancho.categoria} nombre={rancho.nombre} />

      <div className="mx-auto max-w-[1080px] px-7 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-aventurea-navy">
              {CATEGORIA_LABEL[rancho.categoria]}
            </p>
            <h1 className="titulo mt-1 text-[26px] text-aventurea-ink sm:text-[32px]">
              {rancho.nombre}
            </h1>
            {ubicacion && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px] text-aventurea-ink-soft">
                <IconPin className="h-3.5 w-3.5 shrink-0" />
                {ubicacion}
              </p>
            )}
          </div>
          {!esLugar && (
            <div className="flex flex-wrap gap-2.5">
              <a
                href="#cotizacion"
                className="inline-flex items-center gap-2 rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
              >
                Solicitar cotización
              </a>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
                >
                  <IconWhatsapp className="h-4 w-4" />
                  WhatsApp directo
                </a>
              )}
              <a
                href="#contacto"
                className="rounded-xl border border-aventurea-line px-5 py-2.5 text-[13.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
              >
                Ver contacto
              </a>
            </div>
          )}
        </div>
        {!esLugar && rancho.descripcion && (
          <p className="mt-3 max-w-[70ch] text-[14px] text-aventurea-ink-soft">
            {rancho.descripcion}
          </p>
        )}
      </div>

      {esLugar && (
        /* El calendario de reserva es su propia pieza — pendiente de
           rediseño aparte (ver nota en la conversación). */
        <BookingCalendar
          ranchoId={rancho.id}
          nombreRancho={rancho.nombre}
          disponibilidad={disponibilidad}
          tiers={tiers}
          servicios={servicios}
          tarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
          depositoReserva={rancho.deposito_reserva ?? 25000}
          promociones={promociones}
          terminos={rancho.terminos ?? []}
          montoMinimo={rancho.monto_minimo ?? null}
          horarios={rancho.horarios_bloques ?? []}
          fotoFondo={rancho.foto_url}
          sinpeNumero={rancho.sinpe_numero}
          sinpeTitular={rancho.sinpe_titular}
          cuentaBanco={rancho.cuenta_banco}
          cuentaNumero={rancho.cuenta_numero}
          cuentaTitular={rancho.cuenta_titular}
          cuentaTipo={rancho.cuenta_tipo}
          descripcion={rancho.descripcion}
        />
      )}

      {/* Los datos y lo que incluye van antes de la foto grande: dos
          bloques oscuros seguidos se leían como una sola imagen. */}
      <ResumenSeccion datos={datosPresentacion} />

      {!esLugar && (
        <section id="cotizacion" className="border-t border-aventurea-line bg-aventurea-cream-2/40 py-14">
          <div className="mx-auto max-w-[640px] px-7">
            <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-5 before:bg-aventurea-navy">
              Cotizá con {rancho.nombre}
            </p>
            <h2 className="titulo mt-2 text-[24px] text-aventurea-ink">
              Contanos de tu evento
            </h2>
            <p className="mt-1.5 text-[13.5px] text-aventurea-ink-soft">
              Mandá los datos y te cotiza directo por el chat de Bookear CR — sin perder el hilo
              en WhatsApp.
            </p>

            <div className="mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 sm:p-6">
              {user ? (
                <FormularioCotizacion ranchoId={rancho.id} />
              ) : (
                <div className="text-center">
                  <p className="text-[13.5px] text-aventurea-ink-soft">
                    Iniciá sesión para solicitar una cotización y chatear con el proveedor.
                  </p>
                  <Link
                    href="/cuenta"
                    className="mt-3 inline-flex items-center justify-center rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                  >
                    Iniciar sesión
                  </Link>
                </div>
              )}
            </div>
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

      <PresentacionSeccion
        eyebrow={
          rancho.subcategoria
            ? SUBCATEGORIA_LABEL[rancho.subcategoria]
            : CATEGORIA_LABEL[rancho.categoria]
        }
        titulo={rancho.nombre}
        texto={rancho.descripcion_larga || rancho.descripcion}
      />

      <GaleriaSeccion fotos={fotos} nombre={rancho.nombre} />

      <ContactoSeccion
        nombre={rancho.nombre}
        whatsappHref={whatsappHref}
        instagram={rancho.instagram}
        facebook={rancho.facebook}
        tiktok={rancho.tiktok}
        sitioWeb={rancho.sitio_web}
        ubicacion={ubicacion}
        googleMaps={googleMaps}
        waze={waze}
      />

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          BOOKEAR CR — Costa Rica ·{" "}
          <Link href="/ranchos-eventos" className="font-bold text-aventurea-orange">
            Ver todos los espacios
          </Link>
        </p>
      </footer>
    </div>
  );
}
