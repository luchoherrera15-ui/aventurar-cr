import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import { IconChatBubble, IconChevronRight, IconPlus, IconStore } from "@/components/icons";
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
        {/* Identidad: tarjeta clara centrada con el aro naranja en el
            avatar y los números debajo — el mismo diseño del perfil de
            la app, sin el bloque navy pesado de antes. */}
        <div className="flex flex-col items-center rounded-3xl border border-aventurea-line bg-aventurea-surface px-6 py-7 text-center shadow-[0_10px_30px_-18px_rgba(16,26,44,0.35)]">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-aventurea-orange bg-aventurea-navy text-[32px] font-extrabold text-white">
            {inicial}
          </span>
          <p className="mt-3 max-w-full truncate text-[18px] font-extrabold text-aventurea-ink">
            {perfil?.nombre || "Tu cuenta"}
          </p>
          <p className="max-w-full truncate text-[12.5px] font-medium text-aventurea-ink-soft">
            {user.email}
          </p>
          <span
            className={`mt-2 rounded-full px-3 py-1 text-[11.5px] font-bold ${
              tieneNegocio
                ? "bg-aventurea-orange/10 text-aventurea-orange"
                : "bg-aventurea-navy/10 text-aventurea-navy"
            }`}
          >
            {tieneNegocio ? "Proveedor" : "Cliente"}
          </span>

          <div className="mt-4 flex w-full items-center border-t border-aventurea-line pt-4">
            <Stat valor={String(reservasHechas)} etiqueta={reservasHechas === 1 ? "reserva" : "reservas"} />
            <span className="h-7 w-px bg-aventurea-line" />
            <Stat
              valor={String(resenasPropias.size)}
              etiqueta={resenasPropias.size === 1 ? "reseña" : "reseñas"}
            />
            <span className="h-7 w-px bg-aventurea-line" />
            <Stat
              valor={String(favoritos.length)}
              etiqueta={favoritos.length === 1 ? "favorito" : "favoritos"}
            />
          </div>
        </div>

        {/* El negocio en una sola tarjeta clickeable con sus números. */}
        {tieneNegocio && (
          <Link
            href="/mi-rancho"
            className="mt-4 block rounded-2xl border border-aventurea-line bg-aventurea-surface px-6 py-4 transition-colors hover:border-aventurea-navy"
          >
            <div className="flex items-center justify-between">
              <p className="text-[14.5px] font-extrabold text-aventurea-ink">Tu negocio</p>
              <IconChevronRight className="h-4 w-4 text-aventurea-ink-soft" />
            </div>
            <div className="mt-3 flex items-center border-t border-aventurea-line pt-3">
              <Stat
                valor={String(negocioIds.length)}
                etiqueta={negocioIds.length === 1 ? "publicación" : "publicaciones"}
              />
              <span className="h-7 w-px bg-aventurea-line" />
              <Stat
                valor={String(vecesContratado)}
                etiqueta={vecesContratado === 1 ? "contratación" : "contrataciones"}
              />
              <span className="h-7 w-px bg-aventurea-line" />
              <Stat
                valor={calificacionProveedor !== null ? `★ ${calificacionProveedor.toFixed(1)}` : "—"}
                etiqueta="calificación"
              />
            </div>
          </Link>
        )}

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

        <Seccion titulo="Reservas activas" vacio="Todavía no tenés reservas en curso.">
          {activas.map((r) => (
            <TarjetaReserva key={r.id} reserva={r} />
          ))}
        </Seccion>

        {/* El historial plegado: está para consultarlo, no para ocupar
            media página todos los días. */}
        {historial.length > 0 && (
          <details className="group mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="text-[14.5px] font-bold text-aventurea-ink">
                Historial
                <span className="ml-2 text-[12.5px] font-semibold text-aventurea-ink-soft">
                  {historial.length} {historial.length === 1 ? "reserva pasada" : "reservas pasadas"}
                </span>
              </span>
              <IconChevronRight className="h-4 w-4 text-aventurea-ink-soft transition-transform group-open:rotate-90" />
            </summary>
            <div className="flex flex-col gap-2.5 border-t border-aventurea-line p-4">
              {historial.map((r) => (
                <TarjetaReserva
                  key={r.id}
                  reserva={r}
                  atenuada
                  resena={resenasPropias.get(r.id) ?? null}
                  permitirResena={r.fecha < hoy}
                />
              ))}
            </div>
          </details>
        )}

        {favoritos.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-[15px] font-bold text-aventurea-ink">Tus favoritos</h2>
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
          </div>
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
  permitirResena,
}: {
  reserva: ReservaCliente;
  atenuada?: boolean;
  resena?: ResenaPropia | null;
  permitirResena?: boolean;
}) {
  const href = reserva.ranchos?.slug ? `/${reserva.ranchos.slug}` : null;
  // La reseña se habilita solo desde el día después del evento (la
  // política de la base también lo exige — esto evita el botón muerto).
  const puedeResenar =
    !!permitirResena && reserva.estado === "confirmada" && !!reserva.rancho_id;

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
