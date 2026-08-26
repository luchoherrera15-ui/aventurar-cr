import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { IconChatBubble } from "@/components/icons";
import BusinessGallery from "./business-gallery";
import BusinessHeader from "./business-header";
import BusinessBadges from "./business-badges";
import ProfileNavigation from "./profile-navigation";
import PerfilInteractivo from "./perfil-interactivo";
import LocationSection from "./location-section";
import BusinessInfoSection from "./business-info-section";
import { DetallesServicioSeccion } from "./detalles-seccion";
import TarjetaReservaSticky from "./tarjeta-reserva-sticky";
import { createAdminClient } from "@/lib/supabase/admin";
import TarjetaLealtad from "./tarjeta-lealtad";
import { hoyISOCR } from "@/lib/fechas";
import {
  CATEGORIA_CITA_LABEL,
  horarioDeDetalles,
  normalizarCategoriaCita,
} from "../tipos";
import { cargarAgendaPro } from "../agenda-pro";
import { linkGoogleMaps, type RanchoItem } from "@/app/mi-negocio/types";
import {
  COLUMNAS_CITAS,
  COLUMNAS_CITAS_JOVENES,
  pedirFila,
  type RanchoPublico,
} from "@/lib/ranchos-publicos";
import ProveedorActual from "@/components/proveedor-actual";
import BotonConsultar from "@/components/boton-consultar";
import VisitasPagina from "@/components/visitas-pagina";
import {
  datosEstructuradosNegocio,
  jsonLdSeguro,
  metadataNegocio,
  type NegocioSeo,
} from "@/lib/seo-negocio";
import {
  armarBadges,
  armarFotosGaleria,
  distribucionDeResenas,
  estadoAperturaDe,
} from "./perfil-datos";
import type { ProfesionalPerfil, ResenaPerfil, ResumenResenas, SeccionPerfil } from "./perfil-tipos";
import { serviciosPorMiembro } from "@/lib/agenda/servicios-por-miembro";

type Miembro = {
  id: string;
  nombre: string;
  rol: string | null;
  foto_url: string | null;
};

/** Fila cruda de `resenas`, con el servicio y el profesional resueltos
 *  vía el embed a `reservas`/`reserva_items` (ver comentario más abajo). */
type ResenaFila = {
  id: string;
  calificacion: number;
  comentario: string | null;
  created_at: string;
  cliente_id: string;
  reservas: { miembro_id: string | null; reserva_items: { nombre: string }[] } | null;
};

type NegocioCitas = RanchoPublico & { vertical: string };

/**
 * El negocio, UNA sola vez por visita.
 *
 * `generateMetadata` y la página corren por separado: sin `cache()`
 * esto serían dos consultas bloqueantes (o cuatro, contando el
 * reintento por id) para leer la misma fila. `cache()` de React
 * deduplica por render — mismo patrón que /a/[slug] y /[slug].
 *
 * Por slug (la URL bonita) y si no, por id — para negocios recién
 * creados que aún no tienen slug.
 *
 * Lista explícita y no `select("*")`: con `*` esta consulta traía
 * `sinpe_numero` y `sinpe_titular`, y de acá pasaban a `agendaProps`,
 * que va a tres componentes `"use client"` — o sea que el SINPE del
 * negocio quedaba escrito en el HTML público de su ficha (ver el
 * comentario grande de @/lib/ranchos-publicos).
 */
const cargarNegocio = cache(async (slug: string): Promise<NegocioCitas | null> => {
  const supabase = await createClient();
  const buscarPor = (campo: "slug" | "id", valor: string) => (columnas: string) =>
    supabase
      .from("ranchos")
      .select(columnas)
      .eq(campo, valor)
      .eq("vertical", "citas")
      .eq("estado", "aprobado")
      .maybeSingle();

  let data = await pedirFila(buscarPor("slug", slug), COLUMNAS_CITAS, COLUMNAS_CITAS_JOVENES);
  if (!data && /^[0-9a-f-]{36}$/.test(slug)) {
    data = await pedirFila(buscarPor("id", slug), COLUMNAS_CITAS, COLUMNAS_CITAS_JOVENES);
  }
  return (data as unknown as NegocioCitas | null) ?? null;
});

/** Lo que necesita el presentador de metadata, sacado de la fila pública. */
function paraCompartir(negocio: NegocioCitas, slug: string): NegocioSeo {
  const categoria = normalizarCategoriaCita(negocio.categoria);
  return {
    nombre: negocio.nombre,
    ruta: `/citas/${negocio.slug ?? slug}`,
    categoriaLabel: CATEGORIA_CITA_LABEL[categoria] ?? null,
    descripcion: negocio.descripcion ?? null,
    provincia: negocio.provincia ?? null,
    canton: negocio.canton ?? null,
    direccionExacta: negocio.direccion_exacta ?? null,
    latitud: negocio.latitud ?? null,
    longitud: negocio.longitud ?? null,
    fotos: [negocio.foto_url, ...(negocio.fotos ?? [])].filter(
      (f): f is string => typeof f === "string" && f.trim().length > 0,
    ),
    // Un negocio de citas no publica "precio desde" en la ficha: su
    // precio vive en cada servicio del catálogo. No se inventa uno.
    precioDesde: null,
    unidadPrecio: null,
    telefono: null,
    redes: [],
  };
}

/**
 * Sin esto, la ficha de una barbería se compartía por WhatsApp sin foto
 * y con el título genérico del sitio.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const negocio = await cargarNegocio(slug);
  if (!negocio) return {};
  return metadataNegocio(paraCompartir(negocio, slug));
}

/**
 * La mini-página de un negocio de citas — su "sitio" dentro de Bookea
 * (bookea.lat/citas/unaskathy): galería, servicios con precio y
 * duración, equipo con fotos y reseñas propias, portafolio de
 * trabajos, reseñas con distribución por nota, horario y ubicación.
 * Todo desemboca en el flujo de reserva, sin salir de acá — el panel
 * sticky de la derecha en escritorio y la barra fija + hoja inferior
 * en móvil.
 */
export default async function NegocioCitasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // La sesión y el negocio, juntos: antes `auth.getUser()` esperaba sola
  // antes de que arrancara siquiera la consulta del negocio. No depende
  // una de la otra. La del negocio es la MISMA que ya pidió
  // `generateMetadata` — `cargarNegocio` está cacheada, así que si esa
  // ya volvió, acá no hay viaje.
  const [sesion, negocio] = await Promise.all([
    supabase.auth.getUser(),
    cargarNegocio(slug),
  ]);
  const user = sesion.data.user;

  if (!negocio) notFound();

  // Los contadores del negocio, las reseñas con su servicio/profesional
  // resuelto y los favoritos salen con la service key: la política de
  // `reservas`/`reserva_items` solo deja ver las propias, y acá se
  // exponen únicamente números agregados y nombres — nunca datos de
  // contacto de nadie.
  const admin = createAdminClient();

  /* Todo lo que falta, en UNA tanda.
   *
   * `cargarAgendaPro` y el conteo de citas estaban después, cada uno
   * esperando su turno, aunque los dos solo necesitan `negocio.id` —
   * que ya se sabía en la consulta de arriba. Eran dos idas y vueltas
   * a Supabase (~55 ms cada una, medidas) puestas en fila por nada.
   * /citas/demo-nails-studio-cr devolvía el documento a los 420 ms;
   * esto le saca dos de sus cuatro tandas. */
  const [
    { data: itemsData },
    { data: seccionesData },
    { data: equipoData },
    { data: califData },
    { data: perfil },
    agendaPro,
  ] = await Promise.all([
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", negocio.id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      // El orden de las secciones (0119). Sin la migración esto viene
      // con error y las secciones salen como vengan los servicios.
      supabase
        .from("categorias_negocio")
        .select("nombre")
        .eq("rancho_id", negocio.id)
        .order("orden", { ascending: true }),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, rol, foto_url")
        .eq("rancho_id", negocio.id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("calificaciones_rancho")
        .select("promedio, total")
        .eq("rancho_id", negocio.id)
        .maybeSingle(),
      user
        ? supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      cargarAgendaPro(supabase, negocio.id),
    ]);

  /* Segunda tanda: todo lo que necesita la service key, en paralelo
   * entre sí (son tablas y consultas independientes).
   *
   * Las reseñas van con el embed a `reservas`/`reserva_items` para
   * saber CON QUÉ servicio y CON QUIÉN se atendió cada una — sin eso,
   * ReviewsList no tiene "Balayage · con Laura" que mostrar. El nombre
   * del servicio sale de `reserva_items.nombre`, guardado al momento
   * de reservar: no hace falta unirlo con el catálogo actual, así que
   * una reseña sigue siendo legible aunque el servicio se haya
   * renombrado o borrado después.
   *
   * Tope de 200: exacto para prácticamente cualquier negocio real hoy.
   * Si algún día un negocio pasa las 200 reseñas, la distribución por
   * estrella (que sale de este mismo lote) empieza a ser una
   * aproximación sobre las más recientes en vez del total exacto — el
   * promedio grande no, ese sale de `calificaciones_rancho`, que sí
   * cuenta la población completa. */
  const [{ data: filasCitas }, { data: resenasCrudas }, { data: favData }] = await Promise.all([
    admin
      ? admin
          .from("reservas")
          .select("cliente_id, correo, fecha, miembro_id")
          .eq("rancho_id", negocio.id)
          .eq("estado", "confirmada")
          .not("hora_inicio", "is", null)
      : Promise.resolve({ data: null }),
    admin
      ? admin
          .from("resenas")
          .select("id, calificacion, comentario, created_at, cliente_id, reservas(miembro_id, reserva_items(nombre))")
          .eq("rancho_id", negocio.id)
          .order("created_at", { ascending: false })
          .limit(200)
      : // Sin llave de servicio: se pierde el servicio/profesional de
        // cada reseña (esa parte necesita leer `reservas`, restringida
        // a quien la hizo), pero las reseñas en sí siguen siendo
        // públicas — mejor mostrarlas sin atribución que no mostrarlas.
        supabase
          .from("resenas")
          .select("id, calificacion, comentario, created_at, cliente_id")
          .eq("rancho_id", negocio.id)
          .order("created_at", { ascending: false })
          .limit(200),
    user && admin
      ? admin
          .from("favoritos")
          .select("rancho_id")
          .eq("cliente_id", user.id)
          .eq("rancho_id", negocio.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Quién escribió cada reseña. Consulta aparte porque depende de los
  // `cliente_id` recién leídos — mismo patrón de dos pasos que ya usa
  // `quienEscribe` en la ayuda de diseño de Lealtad.
  const clienteIds = [...new Set(((resenasCrudas ?? []) as { cliente_id: string }[]).map((r) => r.cliente_id))];
  const { data: perfilesReviewers } =
    clienteIds.length > 0 && admin
      ? await admin.from("perfiles").select("id, nombre").in("id", clienteIds)
      : { data: null };

  /* ¿Este negocio tiene programa de lealtad activo?
   *
   * Con la llave de servicio y `select *`: el programa no le da lectura
   * al público (0060), y las columnas nuevas (0134-0136) pueden no
   * existir todavía — una lista explícita fallaría entera.
   *
   * Va aparte de las tandas de arriba a propósito: si `admin` no está
   * configurado, esto queda en null y la página sigue igual. La tarjeta
   * de lealtad es un extra; no puede tumbar la ficha del negocio. */
  const { data: programaLealtad } = admin
    ? await admin
        .from("programa_lealtad")
        .select("*")
        .eq("rancho_id", negocio.id)
        .eq("activo", true)
        .maybeSingle()
    : { data: null };

  const { data: recompensaLealtad } = admin && programaLealtad
    ? await admin
        .from("recompensas")
        .select("nombre, costo_puntos")
        .eq("programa_id", programaLealtad.id as string)
        .eq("activo", true)
        .order("costo_puntos", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const items = (itemsData ?? []) as (RanchoItem & {
    duracion_minutos: number | null;
    buffer_min: number | null;
  })[];
  const equipo = (equipoData ?? []) as Miembro[];
  const calif = califData as { promedio: number; total: number } | null;
  const horario = horarioDeDetalles(negocio.detalles);
  const categoria = normalizarCategoriaCita(negocio.categoria);
  const ubicacion = [negocio.canton, negocio.provincia].filter(Boolean).join(", ");
  const rutaBase = `/citas/${negocio.slug ?? negocio.id}`;
  const zonaHoraria = negocio.zona_horaria ?? "America/Costa_Rica";

  // Los números agregados de arriba, ya contados (la consulta viajó en
  // la tanda anterior).
  let citasPorMiembro: Record<string, number> = {};
  {
    const hoy = hoyISOCR();
    const filas = (filasCitas ?? []) as {
      cliente_id: string | null;
      correo: string | null;
      fecha: string;
      miembro_id: string | null;
    }[];
    const atendidas = filas.filter((f) => f.fecha < hoy);
    const porMiembro: Record<string, number> = {};
    for (const f of atendidas) {
      if (f.miembro_id) porMiembro[f.miembro_id] = (porMiembro[f.miembro_id] ?? 0) + 1;
    }
    citasPorMiembro = porMiembro;
  }

  // Reseñas con quién las escribió, sobre qué servicio y con quién se
  // atendió — la forma que pide ReviewsList/ReviewsSummary.
  const nombrePerfil = new Map(
    ((perfilesReviewers ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Cliente de Bookea",
    ]),
  );
  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));
  const resenasCrudasTipadas = (resenasCrudas ?? []) as unknown as ResenaFila[];
  const resenasPerfil: ResenaPerfil[] = resenasCrudasTipadas.map((r) => {
    const miembroId = r.reservas?.miembro_id ?? null;
    return {
      id: r.id,
      calificacion: r.calificacion,
      comentario: r.comentario,
      fecha: r.created_at,
      clienteNombre: nombrePerfil.get(r.cliente_id) ?? "Cliente de Bookea",
      servicioNombre: r.reservas?.reserva_items?.[0]?.nombre ?? null,
      profesionalNombre: miembroId ? (nombreMiembro.get(miembroId) ?? null) : null,
      // Se conserva el id, no solo el nombre: la ficha del profesional
      // filtra por acá. Ver el comentario en `perfil-tipos.ts`.
      profesionalId: miembroId,
      reservaVerificada: true,
    };
  });
  const resumenResenas: ResumenResenas = {
    promedio: calif?.promedio ?? null,
    total: calif?.total ?? 0,
    distribucion: distribucionDeResenas(resenasCrudasTipadas.map((r) => r.calificacion)),
  };

  // El equipo, con su propia nota (de sus reseñas atribuidas) y sus
  // servicios principales (de qué le asignó el dueño en servicios↔recurso).
  /**
   * Qué hace cada persona del equipo.
   *
   * La regla y su trampa viven en `serviciosPorMiembro`, con pruebas
   * al lado: `servicios_recurso` es una lista de RESTRICCIONES, no de
   * capacidades — sin filas, todo el equipo hace todo. Acá se leía al
   * revés y la ficha mostraba equipos enteros sin un solo servicio.
   */
  const porMiembro = serviciosPorMiembro(
    items.map((i) => ({ id: i.id, nombre: i.nombre })),
    equipo.map((m) => m.id),
    agendaPro.serviciosRecurso ?? [],
  );

  const calificacionesPorMiembro = new Map<string, number[]>();
  for (const r of resenasCrudasTipadas) {
    const miembroId = r.reservas?.miembro_id;
    if (!miembroId) continue;
    const lista = calificacionesPorMiembro.get(miembroId) ?? [];
    lista.push(r.calificacion);
    calificacionesPorMiembro.set(miembroId, lista);
  }
  const profesionales: ProfesionalPerfil[] = equipo.map((m) => {
    const calificaciones = calificacionesPorMiembro.get(m.id) ?? [];
    return {
      id: m.id,
      nombre: m.nombre,
      rol: m.rol,
      foto_url: m.foto_url,
      promedio:
        calificaciones.length > 0
          ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length
          : null,
      totalResenas: calificaciones.length,
      serviciosPrincipales: (porMiembro.get(m.id) ?? []).slice(0, 4),
      citasAtendidas: citasPorMiembro[m.id] ?? 0,
    };
  });

  const badges = armarBadges(negocio.amenidades ?? []);
  const fotosGaleria = armarFotosGaleria(negocio.foto_url, negocio.fotos, negocio.nombre);
  // El portafolio, HOY, son las mismas fotos del negocio menos la de
  // portada (esa ya lidera la galería de arriba — repetirla ahí abajo
  // sería la misma foto dos veces en la misma pantalla). Con una sola
  // foto en total, no hay nada distinto que mostrar como portafolio:
  // PortfolioGallery recibe [] y la sección entera desaparece, tal
  // como pide el dueño del producto para "sin portafolio".
  const fotosPortfolio = fotosGaleria.length > 1
    ? fotosGaleria.slice(1).map((f) => ({ ...f, servicioNombre: null, profesionalNombre: null }))
    : [];
  const estadoApertura = estadoAperturaDe(horario, zonaHoraria);
  const favoritoInicial = favData !== null;

  const secciones: SeccionPerfil[] = [
    "servicios",
    ...(profesionales.length > 0 ? (["equipo"] as const) : []),
    ...(fotosPortfolio.length > 0 ? (["portfolio"] as const) : []),
    "resenas",
    "informacion",
  ];

  // Un solo paquete de props para el panel sticky y el bloque
  // interactivo (servicios, equipo, la reserva de móvil).
  const agendaProps = {
    ranchoId: negocio.id,
    rutaBase,
    nombreNegocio: negocio.nombre,
    items,
    ordenSecciones: ((seccionesData ?? []) as { nombre: string }[]).map((s) => s.nombre),
    equipo,
    horario,
    agendaPro: {
      zonaHoraria,
      ...agendaPro,
      // Depósito para asegurar la cita (0095). Con la base sin migrar
      // queda undefined → sin depósito, el flujo de siempre.
      //
      // La cuenta SINPE ya NO viaja acá: estas props se serializan en
      // el HTML público. Las instrucciones del depósito se muestran
      // después de agendar, con lo que devuelve `crearCita` — o sea
      // solo a quien tiene la cita hecha en este negocio.
      deposito: (() => {
        const bruto = (negocio as Record<string, unknown>).deposito_citas;
        return typeof bruto === "number" || typeof bruto === "string" ? Number(bruto) : null;
      })(),
    },
    sesionActiva: !!user,
    nombreInicial: perfil?.nombre ?? "",
    resumen: {
      fotoUrl: negocio.foto_url,
      promedio: calif?.promedio ?? null,
      totalResenas: calif?.total ?? null,
      ubicacion: ubicacion || null,
    },
  };
  const comoLlegar = linkGoogleMaps(
    negocio.latitud,
    negocio.longitud,
    [negocio.nombre, negocio.direccion_exacta, negocio.canton, negocio.provincia, "Costa Rica"]
      .filter(Boolean)
      .join(", "),
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(175deg,#ffffff_0%,#f5f8fd_38%,#e9f0fb_100%)] pb-[84px] lg:pb-0">
      {/* Datos estructurados del negocio: dirección y demás, para que
          Google no muestre la ficha como texto pelado. Sale de la MISMA
          fila ya leída — cero consultas extra. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdSeguro(datosEstructuradosNegocio(paraCompartir(negocio, slug))),
        }}
      />
      {/* La burbuja de chat flotante solo tiene sentido acá si quien
          mira no es el dueño — nadie se manda una consulta a sí mismo. */}
      {negocio.owner_id !== user?.id && (
        <ProveedorActual ranchoId={negocio.id} nombre={negocio.nombre} />
      )}
      <SiteHeader breadcrumb="Citas y Reservas" />

      <section className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/citas" className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy">
          ← Todos los negocios
        </Link>

        {/* Prueba social real: "12 personas visitaron este sitio hoy".
            Con pocas visitas no se muestra nada — un número bajo vende
            menos que ningún número. */}
        <VisitasPagina ranchoId={negocio.id} className="mt-3" />

        {/* ---------- Galería ---------- */}
        <div className="mt-4">
          <BusinessGallery fotos={fotosGaleria} nombreNegocio={negocio.nombre} />
        </div>

        {/* ---------- Encabezado ---------- */}
        <div className="mt-5">
          <BusinessHeader
            nombre={negocio.nombre}
            categoriaLabel={CATEGORIA_CITA_LABEL[categoria]}
            promedio={calif?.promedio ?? null}
            totalResenas={calif?.total ?? 0}
            ubicacion={ubicacion || null}
            distanciaKm={null}
            estadoApertura={estadoApertura}
            ranchoId={negocio.id}
            favoritoInicial={favoritoInicial}
            sesionActiva={!!user}
            descripcion={negocio.descripcion}
          />
        </div>

        {badges.length > 0 && (
          <div className="mt-4">
            <BusinessBadges badges={badges} />
          </div>
        )}

        {negocio.owner_id !== user?.id && (
          <div className="mt-3">
            <BotonConsultar
              ranchoId={negocio.id}
              nombre={negocio.nombre}
              className="flex w-fit items-center gap-2 rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              <IconChatBubble className="h-4 w-4 text-aventurea-navy" /> ¿Dudas? Consultar por chat
            </BotonConsultar>
          </div>
        )}

        <ProfileNavigation secciones={secciones} />

        {/* ---------- Contenido + el panel que acompaña el scroll ----------
            El horario y la dirección viven en la tarjeta sticky de la
            derecha (patrón Fresha) además de su propia sección abajo del
            todo, con el detalle completo. */}
        <div className="mt-2 grid items-start gap-8 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <PerfilInteractivo
              agenda={agendaProps}
              profesionales={profesionales}
              resumenResenas={resumenResenas}
              resenas={resenasPerfil}
              fotosPortfolio={fotosPortfolio}
            />

            {/* El programa de lealtad, si lo tiene. Va acá —después de
                los servicios, el equipo y el portafolio— porque para
                entonces la persona ya sabe qué se hace en el local;
                ofrecerle la tarjeta antes de eso es pedirle que se
                comprometa con algo que todavía no conoce. */}
            {programaLealtad && negocio.slug && (
              <TarjetaLealtad
                slug={negocio.slug}
                negocio={negocio.nombre}
                modo={(programaLealtad.modo as string | null) ?? null}
                meta={
                  recompensaLealtad
                    ? {
                        nombre: recompensaLealtad.nombre as string,
                        costo: recompensaLealtad.costo_puntos as number,
                      }
                    : null
                }
              />
            )}

            <div id="informacion" className="scroll-mt-24">
              <LocationSection
                direccion={negocio.direccion_exacta}
                ubicacion={ubicacion || null}
                comoLlegarHref={comoLlegar}
                latitud={negocio.latitud}
                longitud={negocio.longitud}
              />
              <BusinessInfoSection
                horario={horario}
                comodidades={badges}
                politicaCancelacion={null}
                zonaHoraria={zonaHoraria}
              />
              <DetallesServicioSeccion
                categoria={categoria}
                detalles={negocio.detalles ?? {}}
              />
            </div>
          </div>

          <TarjetaReservaSticky
            categoriaLabel={CATEGORIA_CITA_LABEL[categoria]}
            direccion={negocio.direccion_exacta}
            comoLlegarHref={comoLlegar}
            agenda={agendaProps}
          />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
