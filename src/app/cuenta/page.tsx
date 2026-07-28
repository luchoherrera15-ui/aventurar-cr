import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import FormularioAuth from "./formulario-auth";
import ResenaForm from "./resena-form";
import { cerrarSesionCuenta } from "./actions";
import { CATEGORIA_LABEL, normalizarCategoria, type Rancho } from "../mi-rancho/types";
import { hoyISOCR } from "@/lib/fechas";

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En revisión",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
};
const ESTADO_CLASE: Record<string, string> = {
  pendiente: "bg-aventurea-orange/10 text-aventurea-ink",
  confirmada: "bg-aventurea-green/10 text-aventurea-green",
  rechazada: "bg-red-100 text-red-700",
};

type ReservaCliente = {
  id: string;
  fecha: string;
  estado: string;
  monto_total: number | null;
  horario_bloque: string | null;
  rancho_id: string | null;
  ranchos: { nombre: string; foto_url: string | null; categoria: string; slug: string | null } | null;
};

type ResenaPropia = {
  reserva_id: string;
  calificacion: number;
  comentario: string | null;
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
    supabase.from("ranchos").select("id").eq("owner_id", user.id),
    supabase
      .from("resenas")
      .select("reserva_id, calificacion, comentario")
      .eq("cliente_id", user.id),
  ]);

  const reservas = (reservasData ?? []) as unknown as ReservaCliente[];
  const resenasPropias = new Map<string, ResenaPropia>(
    ((resenasData ?? []) as ResenaPropia[]).map((r) => [r.reserva_id, r]),
  );

  // Los números del perfil: reservas hechas, reseñas dejadas y
  // favoritos — y si publica servicios, cuántas veces lo han
  // contratado y su calificación promedio ponderada.
  const negocioIds = (negociosData ?? []).map((n) => n.id as string);
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

  const tieneNegocio = negocioIds.length > 0;
  const inicial = (perfil?.nombre || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Tu cuenta" />

      <section className="mx-auto max-w-[720px] px-6 py-10">
        {/* Tarjeta de identidad estilo Airbnb: el avatar grande a la
            izquierda y la columna de números a la derecha. */}
        <div className="flex items-stretch gap-6 rounded-3xl bg-aventurea-navy px-7 py-6 text-white shadow-[0_16px_40px_-16px_rgba(16,26,44,0.5)]">
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-aventurea-orange text-[34px] font-extrabold">
              {inicial}
            </span>
            <p className="mt-1 max-w-full truncate text-[17px] font-extrabold">
              {perfil?.nombre || "Tu cuenta"}
            </p>
            <p className="text-[12.5px] font-semibold text-white/70">
              {tieneNegocio ? "Proveedor" : "Cliente"}
            </p>
          </div>
          <div className="flex w-[46%] flex-col justify-center gap-2.5">
            <div>
              <p className="text-[19px] font-extrabold leading-tight">{reservasHechas}</p>
              <p className="text-[11px] font-semibold text-white/70">
                {reservasHechas === 1 ? "reserva" : "reservas"}
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div>
              <p className="text-[19px] font-extrabold leading-tight">{resenasPropias.size}</p>
              <p className="text-[11px] font-semibold text-white/70">
                {resenasPropias.size === 1 ? "reseña" : "reseñas"}
              </p>
            </div>
            <div className="h-px bg-white/20" />
            <div>
              <p className="text-[19px] font-extrabold leading-tight">{favoritos.length}</p>
              <p className="text-[11px] font-semibold text-white/70">
                {favoritos.length === 1 ? "favorito" : "favoritos"}
              </p>
            </div>
          </div>
        </div>

        {tieneNegocio && (
          <div className="mt-4 rounded-2xl border border-aventurea-line bg-aventurea-surface px-6 py-4">
            <p className="text-[13.5px] font-extrabold text-aventurea-ink">Tu negocio en números</p>
            <div className="mt-2.5 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[19px] font-extrabold text-aventurea-ink">{negocioIds.length}</p>
                <p className="text-[11px] font-semibold text-aventurea-ink-soft">
                  {negocioIds.length === 1 ? "publicación" : "publicaciones"}
                </p>
              </div>
              <div>
                <p className="text-[19px] font-extrabold text-aventurea-ink">{vecesContratado}</p>
                <p className="text-[11px] font-semibold text-aventurea-ink-soft">
                  {vecesContratado === 1 ? "vez contratado" : "veces contratado"}
                </p>
              </div>
              <div>
                <p className="text-[19px] font-extrabold text-aventurea-ink">
                  {calificacionProveedor !== null ? `★ ${calificacionProveedor.toFixed(1)}` : "—"}
                </p>
                <p className="text-[11px] font-semibold text-aventurea-ink-soft">calificación</p>
              </div>
            </div>
          </div>
        )}

        <Link
          href="/mensajes"
          className="mt-4 flex items-center justify-between rounded-2xl border border-aventurea-line bg-aventurea-surface px-6 py-4 transition-colors hover:border-aventurea-navy"
        >
          <div>
            <p className="text-[14.5px] font-bold text-aventurea-ink">Mensajes</p>
            <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
              Tus conversaciones de reservas y cotizaciones.
            </p>
          </div>
          <span aria-hidden className="text-aventurea-navy">→</span>
        </Link>

        {tieneNegocio ? (
          <Link
            href="/mi-rancho"
            className="mt-4 flex items-center justify-between rounded-2xl border border-aventurea-line bg-aventurea-surface px-6 py-4 transition-colors hover:border-aventurea-navy"
          >
            <div>
              <p className="text-[14.5px] font-bold text-aventurea-ink">Panel de proveedor</p>
              <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                Administrá tus servicios, precios y reservas.
              </p>
            </div>
            <span aria-hidden className="text-aventurea-navy">→</span>
          </Link>
        ) : (
          <Link
            href="/mi-rancho/nuevo"
            className="mt-4 flex items-center justify-between rounded-2xl border border-aventurea-line bg-aventurea-surface px-6 py-4 transition-colors hover:border-aventurea-navy"
          >
            <div>
              <p className="text-[14.5px] font-bold text-aventurea-ink">
                ¿Ofrecés un servicio para eventos?
              </p>
              <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                Publicá tu negocio gratis en Bookea.
              </p>
            </div>
            <span aria-hidden className="text-aventurea-navy">→</span>
          </Link>
        )}

        <Seccion titulo="Reservas activas" vacio="Todavía no tenés reservas en curso.">
          {activas.map((r) => (
            <TarjetaReserva key={r.id} reserva={r} />
          ))}
        </Seccion>

        <Seccion titulo="Historial" vacio="Acá vas a ver tus reservas pasadas.">
          {historial.map((r) => (
            <TarjetaReserva
              key={r.id}
              reserva={r}
              atenuada
              resena={resenasPropias.get(r.id) ?? null}
            />
          ))}
        </Seccion>

        <div className="mt-8">
          <h2 className="mb-3 text-[15px] font-bold text-aventurea-ink">Tus favoritos</h2>
          {favoritos.length === 0 ? (
            <p className="rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4 text-[13px] text-aventurea-ink-soft">
              Todavía no guardaste ningún favorito — tocá el corazón en cualquier tarjeta del
              directorio.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
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
          )}
        </div>

        <form action={cerrarSesionCuenta} className="mt-8 text-center">
          <button type="submit" className="text-[13.5px] font-bold text-red-600 hover:underline">
            Cerrar sesión
          </button>
        </form>
      </section>
    </div>
  );
}

function Seccion({
  titulo,
  vacio,
  children,
}: {
  titulo: string;
  vacio: string;
  children: React.ReactNode;
}) {
  const hayContenido = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-[15px] font-bold text-aventurea-ink">{titulo}</h2>
      {hayContenido ? (
        <div className="flex flex-col gap-2.5">{children}</div>
      ) : (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4 text-[13px] text-aventurea-ink-soft">
          {vacio}
        </p>
      )}
    </div>
  );
}

function TarjetaReserva({
  reserva,
  atenuada,
  resena,
}: {
  reserva: ReservaCliente;
  atenuada?: boolean;
  resena?: ResenaPropia | null;
}) {
  const href = reserva.ranchos?.slug ? `/${reserva.ranchos.slug}` : null;
  const puedeResenar = reserva.estado === "confirmada" && !!reserva.rancho_id;

  return (
    <div
      className={`rounded-2xl border border-aventurea-line bg-aventurea-surface p-3 ${atenuada ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-14 w-14 shrink-0 rounded-lg bg-cover bg-center bg-aventurea-cream-2"
          style={
            reserva.ranchos?.foto_url ? { backgroundImage: `url(${reserva.ranchos.foto_url})` } : undefined
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-wide text-aventurea-navy">
            {reserva.ranchos ? CATEGORIA_LABEL[normalizarCategoria(reserva.ranchos.categoria)] : ""}
          </p>
          <p className="truncate text-[14px] font-bold text-aventurea-ink">
            {reserva.ranchos?.nombre ?? "Proveedor"}
          </p>
          <p className="text-[12.5px] text-aventurea-ink-soft">
            {reserva.fecha}
            {reserva.horario_bloque ? ` · ${reserva.horario_bloque}` : ""}
          </p>
          {reserva.monto_total !== null && (
            <p className="text-[12.5px] font-bold text-aventurea-ink">{fmtColones(reserva.monto_total)}</p>
          )}
        </div>
        <span
          className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[10.5px] font-bold ${ESTADO_CLASE[reserva.estado] ?? "bg-zinc-100 text-zinc-600"}`}
        >
          {ESTADO_LABEL[reserva.estado] ?? reserva.estado}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-4 border-t border-aventurea-line pt-2.5">
        {href && (
          <Link href={href} className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy">
            Ver proveedor
          </Link>
        )}
        <Link
          href={`/mensajes/${reserva.id}`}
          className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
        >
          Mensajes
        </Link>
        {puedeResenar && (
          <ResenaForm
            reservaId={reserva.id}
            ranchoId={reserva.rancho_id!}
            nombreRancho={reserva.ranchos?.nombre ?? "el proveedor"}
            resenaExistente={resena ?? null}
          />
        )}
      </div>
    </div>
  );
}
