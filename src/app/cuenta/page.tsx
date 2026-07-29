import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import { IconChatBubble, IconChevronRight, IconHeart, IconPlus, IconStore } from "@/components/icons";
import FormularioAuth from "./formulario-auth";
import ReservasTabs, { type ReservaCliente, type ResenaPropia } from "./reservas-tabs";
import { cerrarSesionCuenta } from "./actions";
import { normalizarCategoria, type Rancho } from "../mi-rancho/types";
import { hoyISOCR } from "@/lib/fechas";

/** Lo mínimo de cada publicación para listarla en la cuenta. */
type NegocioResumen = {
  id: string;
  nombre: string;
  slug: string | null;
  foto_url: string | null;
  categoria: string;
  vertical: string | null;
  estado: string;
};

const VERTICAL_LABEL: Record<string, string> = {
  eventos: "Eventos",
  citas: "Citas",
  hospedajes: "Hospedajes",
};

// El estado de cada publicación como un punto de color, sin texto:
// verde = aprobada, naranja = en revisión, rojo = rechazada.
const ESTADO_PUNTO: Record<string, string> = {
  aprobado: "bg-aventurea-green",
  pendiente: "bg-aventurea-orange",
  rechazado: "bg-red-500",
};
const ESTADO_NEGOCIO_LABEL: Record<string, string> = {
  aprobado: "Publicación aprobada",
  pendiente: "Publicación en revisión",
  rechazado: "Publicación rechazada",
};

export default async function CuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-aventurea-cream">
        <SiteHeader breadcrumb="Tu cuenta" />
        <section className="mx-auto max-w-[720px] px-6 py-14">
          <FormularioAuth />
        </section>
      </div>
    );
  }

  const [
    { data: perfil },
    { data: reservasData },
    { data: favoritosData },
    { data: negociosData },
    { data: resenasData },
  ] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    supabase
      .from("reservas")
      .select("id, fecha, estado, monto_total, horario_bloque, rancho_id, ranchos(nombre, foto_url, categoria, slug)")
      .eq("cliente_id", user.id)
      .in("estado", ["pendiente", "confirmada", "rechazada"])
      .order("fecha", { ascending: false }),
    supabase
      .from("favoritos")
      .select("ranchos(*)")
      .eq("cliente_id", user.id),
    supabase
      .from("ranchos")
      .select("id, nombre, slug, foto_url, categoria, vertical, estado")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("resenas")
      .select("reserva_id, calificacion, comentario")
      .eq("cliente_id", user.id),
  ]);

  const reservas = (reservasData ?? []) as unknown as ReservaCliente[];
  const resenasPropias = (resenasData ?? []) as ResenaPropia[];
  const resenasPorReserva: Record<string, ResenaPropia> = Object.fromEntries(
    resenasPropias.map((r) => [r.reserva_id, r]),
  );

  // Los números del perfil: reservas hechas, reseñas dejadas y
  // favoritos — y si publica servicios, cuántas veces lo han
  // contratado y su calificación promedio ponderada.
  const negocios = (negociosData ?? []) as NegocioResumen[];
  const negocioIds = negocios.map((n) => n.id);
  let vecesContratado = 0;
  let calificacionProveedor: number | null = null;
  if (negocioIds.length > 0) {
    const [{ count: contratadoCount }, { data: califs }] = await Promise.all([
      supabase
        .from("reservas")
        .select("id", { count: "exact", head: true })
        .in("rancho_id", negocioIds)
        .eq("estado", "confirmada"),
      supabase
        .from("calificaciones_rancho")
        .select("promedio, total")
        .in("rancho_id", negocioIds),
    ]);
    vecesContratado = contratadoCount ?? 0;
    const filas = (califs ?? []) as { promedio: number; total: number }[];
    const totalResenas = filas.reduce((acc, c) => acc + c.total, 0);
    calificacionProveedor =
      totalResenas > 0
        ? filas.reduce((acc, c) => acc + c.promedio * c.total, 0) / totalResenas
        : null;
  }
  const reservasHechas = reservas.filter((r) => r.estado !== "rechazada").length;
  const hoy = hoyISOCR();
  const activas = reservas.filter((r) => r.estado !== "rechazada" && r.fecha >= hoy);
  const historial = reservas.filter((r) => r.estado === "rechazada" || r.fecha < hoy);

  const favoritos = ((favoritosData ?? []) as unknown as { ranchos: Rancho | null }[])
    .map((f) => f.ranchos)
    .filter((r): r is Rancho => r !== null)
    .map((r) => ({ ...r, categoria: normalizarCategoria(r.categoria) }));

  const favoritoIds = favoritos.map((r) => r.id);
  const { data: calificacionesData } =
    favoritoIds.length > 0
      ? await supabase
          .from("calificaciones_rancho")
          .select("rancho_id, promedio, total")
          .in("rancho_id", favoritoIds)
      : { data: [] as Calificacion[] };
  const calificaciones = new Map<string, Calificacion>(
    ((calificacionesData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );

  const tieneNegocio = negocios.length > 0;
  const inicial = (perfil?.nombre || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Tu cuenta" />

      <section className="mx-auto max-w-[720px] px-6 py-8">
        {/* Identidad en una sola tarjeta horizontal: avatar con el aro
            naranja, nombre + correo + rol a la izquierda y los números
            a la derecha (abajo en móvil). Compacta a propósito. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4 shadow-[0_10px_30px_-18px_rgba(16,26,44,0.35)] sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-aventurea-orange bg-aventurea-navy text-[22px] font-extrabold text-white">
              {inicial}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15.5px] font-extrabold text-aventurea-ink">
                  {perfil?.nombre || "Tu cuenta"}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                    tieneNegocio
                      ? "bg-aventurea-orange/10 text-aventurea-orange"
                      : "bg-aventurea-navy/10 text-aventurea-navy"
                  }`}
                >
                  {tieneNegocio ? "Proveedor" : "Cliente"}
                </span>
              </div>
              <p className="truncate text-[12.5px] font-medium text-aventurea-ink-soft">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center border-t border-aventurea-line pt-3 sm:min-w-[220px] sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <Stat valor={String(reservasHechas)} etiqueta={reservasHechas === 1 ? "reserva" : "reservas"} />
            <span className="h-7 w-px bg-aventurea-line" />
            <Stat
              valor={String(resenasPropias.length)}
              etiqueta={resenasPropias.length === 1 ? "reseña" : "reseñas"}
            />
            <span className="h-7 w-px bg-aventurea-line" />
            <Stat
              valor={String(favoritos.length)}
              etiqueta={favoritos.length === 1 ? "favorito" : "favoritos"}
            />
          </div>
        </div>

        {/* Accesos en dos tarjetas compactas, como en la app. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <TarjetaAcceso
            href="/mensajes"
            icono={<IconChatBubble className="h-5 w-5" />}
            titulo="Mensajes"
            detalle="Tus conversaciones"
          />
          {tieneNegocio ? (
            <TarjetaAcceso
              href="/mi-rancho"
              icono={<IconStore className="h-5 w-5" />}
              titulo="Panel de proveedor"
              detalle="Servicios y reservas"
              acento
            />
          ) : (
            <TarjetaAcceso
              href="/mi-rancho/nuevo"
              icono={<IconPlus className="h-5 w-5" />}
              titulo="Publicar mi negocio"
              detalle="Gratis en Bookea"
              acento
            />
          )}
        </div>

        {/* Sus publicaciones reales, una fila por negocio, con el link a
            la página pública y al panel de administración de cada una. */}
        {tieneNegocio && (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-[15px] font-bold text-aventurea-ink">Tus negocios</h2>
              <p className="text-[12px] font-semibold text-aventurea-ink-soft">
                {vecesContratado} {vecesContratado === 1 ? "contratación" : "contrataciones"}
                {calificacionProveedor !== null && ` · ★ ${calificacionProveedor.toFixed(1)}`}
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
              {negocios.map((n) => {
                const vertical = VERTICAL_LABEL[n.vertical ?? "eventos"] ?? "Eventos";
                const verPagina = n.slug
                  ? n.vertical === "citas"
                    ? `/citas/${n.slug}`
                    : `/${n.slug}`
                  : `/eventos/${n.id}`;
                return (
                  <div
                    key={n.id}
                    className="flex items-center gap-3 border-b border-aventurea-line px-4 py-3 last:border-none"
                  >
                    <div
                      className="h-10 w-10 shrink-0 rounded-lg bg-aventurea-cream-2 bg-cover bg-center"
                      style={n.foto_url ? { backgroundImage: `url(${n.foto_url})` } : undefined}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-aventurea-ink">{n.nombre}</p>
                      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-aventurea-ink-soft">
                        {vertical}
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${ESTADO_PUNTO[n.estado] ?? "bg-zinc-300"}`}
                          title={ESTADO_NEGOCIO_LABEL[n.estado] ?? n.estado}
                        />
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3.5">
                      <Link
                        href={verPagina}
                        className="text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy"
                      >
                        Ver página
                      </Link>
                      <Link
                        href={`/mi-rancho/${n.id}`}
                        className="text-[12px] font-bold text-aventurea-navy hover:underline"
                      >
                        Administrar
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ReservasTabs activas={activas} historial={historial} resenas={resenasPorReserva} hoy={hoy} />

        {/* Los favoritos plegados: están para volver a ellos, no para
            ocupar media página todos los días. */}
        {favoritos.length > 0 && (
          <details className="group mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-[14.5px] font-bold text-aventurea-ink">
                <IconHeart className="h-4 w-4 text-aventurea-orange" />
                Tus favoritos
                <span className="text-[12.5px] font-semibold text-aventurea-ink-soft">
                  ({favoritos.length})
                </span>
              </span>
              <IconChevronRight className="h-4 w-4 text-aventurea-ink-soft transition-transform group-open:rotate-90" />
            </summary>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 border-t border-aventurea-line p-4 sm:grid-cols-3">
              {favoritos.map((r, i) => (
                <RanchoCard
                  key={r.id}
                  rancho={r}
                  index={i}
                  calificacion={calificaciones.get(r.id) ?? null}
                  proximaLibre={undefined}
                  favoritoInicial
                  sesionActiva
                />
              ))}
            </div>
          </details>
        )}

        <form action={cerrarSesionCuenta} className="mt-8 text-center">
          <button type="submit" className="text-[13.5px] font-bold text-red-600 hover:underline">
            Cerrar sesión
          </button>
        </form>
      </section>
    </div>
  );
}

/** Un número del perfil con su etiqueta, en una fila de tercios. */
function Stat({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-[19px] font-extrabold leading-tight text-aventurea-ink">{valor}</p>
      <p className="text-[11px] font-semibold text-aventurea-ink-soft">{etiqueta}</p>
    </div>
  );
}

/** Un acceso del perfil como tarjeta con ícono en burbuja. */
function TarjetaAcceso({
  href,
  icono,
  titulo,
  detalle,
  acento,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  /** true = la burbuja va en naranja (la acción principal). */
  acento?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 transition-colors hover:border-aventurea-navy"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          acento ? "bg-aventurea-orange/10 text-aventurea-orange" : "bg-aventurea-navy/10 text-aventurea-navy"
        }`}
      >
        {icono}
      </span>
      <p className="mt-2 text-[14px] font-extrabold text-aventurea-ink">{titulo}</p>
      <p className="truncate text-[11.5px] font-medium text-aventurea-ink-soft">{detalle}</p>
    </Link>
  );
}
