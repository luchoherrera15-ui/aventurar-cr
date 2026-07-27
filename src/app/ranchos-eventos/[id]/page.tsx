import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingCalendar from "@/app/eventos-salon/booking-calendar";
import { IconCheck, IconPin, IconUsers } from "@/components/icons";
import {
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  SUBCATEGORIA_LABEL,
  linkGoogleMaps,
  linkWaze,
  normalizarCategoria,
  type PromocionDia,
  type Rancho,
} from "../../mi-rancho/types";
import type {
  DiaDisponibilidad,
  PrecioTier,
  ServicioAdicional,
} from "@/app/eventos-salon/types";
import { NOMBRE_RANCHO_AVENTUREA } from "../constants";
import {
  AmenidadesSeccion,
  ContactoSeccion,
  DetallesSeccion,
  GaleriaSeccion,
  PresentacionSeccion,
  ResumenSeccion,
} from "./portal-secciones";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default async function RanchoPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .eq("estado", "aprobado")
    .maybeSingle();

  if (!data) notFound();

  // Se normaliza la categoría al leer: una fila que todavía no pasó por
  // la migración de taxonomía sigue mostrándose bien.
  const rancho = {
    ...(data as Rancho),
    categoria: normalizarCategoria((data as Rancho).categoria),
  };

  if (rancho.nombre === NOMBRE_RANCHO_AVENTUREA) {
    redirect("/eventos-salon");
  }

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

  // Manda la que el dueño eligió. Si no eligió ninguna, buscamos una
  // distinta a la portada para no repetir la misma imagen dos veces
  // seguidas, y si tampoco hay galería se queda con el degradado.
  const fotoPresentacion =
    rancho.foto_presentacion ??
    fotos.find((f) => f !== rancho.foto_url) ??
    (esLugar ? rancho.foto_url : null);

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
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/ranchos-eventos" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-white">
              A
            </span>
            <span className="text-base font-bold text-aventurea-ink">AVENTUREA CR</span>
          </Link>
          <Link
            href="/ranchos-eventos"
            className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange"
          >
            ← Ver todos los espacios
          </Link>
        </div>
      </header>

      {esLugar ? (
        /* Los lugares abren con el calendario: reservar es lo primero. */
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
      ) : (
        /* Los servicios móviles no tienen calendario: abren con su portada. */
        <section className="relative flex h-[300px] items-end overflow-hidden sm:h-[400px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={
              rancho.foto_url
                ? { backgroundImage: `url(${rancho.foto_url})` }
                : { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
            }
          />
          {!rancho.foto_url && (
            <span className="absolute inset-0 flex items-center justify-center opacity-25 [&_svg]:h-20 [&_svg]:w-20">
              {CATEGORIA_ICONO[rancho.categoria]}
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

          <div className="relative mx-auto w-full max-w-[1080px] px-7 pb-8">
            <div className="mb-2.5 flex flex-wrap gap-2">
              {rancho.provincia && (
                <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink">
                  {rancho.provincia}
                </span>
              )}
              <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white/90">
                {CATEGORIA_LABEL[rancho.categoria]}
              </span>
            </div>
            <h1 className="text-[28px] font-bold text-white drop-shadow-sm sm:text-[36px]">
              {rancho.nombre}
            </h1>
            {rancho.descripcion && (
              <p className="mt-2 max-w-[60ch] text-[14px] text-white/80">
                {rancho.descripcion}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Pedir cotización
                </a>
              )}
              <a
                href="#contacto"
                className="rounded-xl border border-white/40 px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-white/10"
              >
                Ver contacto
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Los datos y lo que incluye van antes de la foto grande: dos
          bloques oscuros seguidos se leían como una sola imagen. */}
      <ResumenSeccion datos={datosPresentacion} />

      {esLugar ? (
        <AmenidadesSeccion amenidades={amenidades} />
      ) : (
        <DetallesSeccion
          categoria={rancho.categoria}
          detalles={rancho.detalles ?? {}}
        />
      )}

      <PresentacionSeccion
        foto={fotoPresentacion}
        categoria={rancho.categoria}
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
          AVENTUREA CR — Costa Rica ·{" "}
          <Link href="/ranchos-eventos" className="font-bold text-aventurea-orange">
            Ver todos los espacios
          </Link>
        </p>
      </footer>
    </div>
  );
}
