import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import {
  IconCalendarLine,
  IconChatBubble,
  IconHeart,
  IconMail,
  IconPlus,
  IconStore,
} from "@/components/icons";
import FormularioAuth from "./formulario-auth";
import { cerrarSesionCuenta } from "./actions";
import { hoyISOCR } from "@/lib/fechas";

/** Lo mínimo de cada publicación para el resumen del tablero. */
type NegocioResumen = { id: string; estado: string };

/**
 * Desde cuándo contar "lo nuevo" de una card: la marca de su cookie
 * (la última vez que la abrieron) o, si nunca, la última semana.
 */
function desdeISO(marcaCookie: string | undefined): string {
  const v = Number(marcaCookie);
  const ms = Number.isFinite(v) && v > 0 ? v : Date.now() - 7 * 86400_000;
  return new Date(ms).toISOString();
}

/**
 * El perfil como tablero de tarjetas: identidad arriba y una card por
 * sección (mensajes, panel de proveedor, invitaciones, reservas,
 * favoritos). Cada card con movimientos desde la última visita enseña
 * su "+N"; abrirla lo pone en cero (la marca vive en la cookie
 * `visto_{seccion}` que estampa /cuenta/ir/{seccion}). Los detalles
 * viven en las páginas de cada sección — acá solo el resumen.
 */
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
    { count: favoritosCount },
    { data: negociosData },
    { count: resenasCount },
    { data: invitacionesData },
  ] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    supabase
      .from("reservas")
      .select("id, fecha, estado")
      .eq("cliente_id", user.id)
      .in("estado", [
        "pendiente",
        "confirmada",
        "rechazada",
        "cumplida",
        "no_asistio",
        "cancelada",
      ]),
    supabase
      .from("favoritos")
      .select("rancho_id", { count: "exact", head: true })
      .eq("cliente_id", user.id),
    supabase.from("ranchos").select("id, estado").eq("owner_id", user.id),
    supabase
      .from("resenas")
      .select("reserva_id", { count: "exact", head: true })
      .eq("cliente_id", user.id),
    supabase.from("invitaciones").select("id").eq("cliente_id", user.id),
  ]);

  const reservas = (reservasData ?? []) as { id: string; fecha: string; estado: string }[];
  const negocios = (negociosData ?? []) as NegocioResumen[];
  const invitacionIds = ((invitacionesData ?? []) as { id: string }[]).map((i) => i.id);
  const tieneNegocio = negocios.length > 0;

  const hoy = hoyISOCR();
  // Mismo criterio que /cuenta/reservas: los estados finales van al
  // historial aunque la fecha sea hoy.
  const FINALES = new Set(["rechazada", "cumplida", "no_asistio", "cancelada"]);
  const reservasHechas = reservas.filter(
    (r) => r.estado !== "rechazada" && r.estado !== "cancelada",
  ).length;
  const activas = reservas.filter((r) => !FINALES.has(r.estado) && r.fecha >= hoy).length;
  const historial = reservas.length - activas;

  const cookieStore = await cookies();
  const visto = (seccion: string) => desdeISO(cookieStore.get(`visto_${seccion}`)?.value);

  // Los "+N" de cada card, en paralelo: mensajes de otros en mis hilos,
  // reservas que entraron a mis negocios y confirmaciones de invitados.
  const negocioIds = negocios.map((n) => n.id);
  const { data: convsData } = await supabase
    .from("conversaciones")
    .select("id")
    .or(`cliente_id.eq.${user.id},proveedor_id.eq.${user.id}`);
  const convIds = ((convsData ?? []) as { id: string }[]).map((c) => c.id);

  const [mensajesRes, reservasNegocioRes, rsvpRes, contratadoRes] = await Promise.all([
    convIds.length > 0
      ? supabase
          .from("mensajes")
          .select("id", { count: "exact", head: true })
          .in("conversacion_id", convIds)
          .neq("autor_id", user.id)
          .gt("created_at", visto("mensajes"))
      : Promise.resolve({ count: 0 }),
    negocioIds.length > 0
      ? supabase
          .from("reservas")
          .select("id", { count: "exact", head: true })
          .in("rancho_id", negocioIds)
          // Solo movimientos reales: sin holds temporales del carrito
          // ni bloqueos que puso el propio dueño.
          .in("estado", ["pendiente", "confirmada", "cumplida", "no_asistio", "cancelada"])
          .gt("created_at", visto("proveedor"))
      : Promise.resolve({ count: 0 }),
    invitacionIds.length > 0
      ? supabase
          .from("invitacion_rsvp")
          .select("invitacion_id, asistira, acompanantes, created_at")
          .in("invitacion_id", invitacionIds)
      : Promise.resolve({ data: [] }),
    negocioIds.length > 0
      ? supabase
          .from("reservas")
          .select("id", { count: "exact", head: true })
          .in("rancho_id", negocioIds)
          .eq("estado", "confirmada")
      : Promise.resolve({ count: 0 }),
  ]);

  const nuevosMensajes = mensajesRes.count ?? 0;
  const reservasNuevasNegocio = reservasNegocioRes.count ?? 0;
  const vecesContratado = contratadoRes.count ?? 0;

  const rsvps = ((rsvpRes.data ?? []) as {
    invitacion_id: string;
    asistira: boolean;
    acompanantes: number;
    created_at: string;
  }[]);
  const desdeInvitaciones = visto("invitaciones");
  const confirmacionesNuevas = rsvps.filter((r) => r.created_at > desdeInvitaciones).length;
  const personasConfirmadas = rsvps
    .filter((r) => r.asistira)
    .reduce((acc, r) => acc + 1 + (r.acompanantes ?? 0), 0);

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
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-[10.5px] font-bold ${
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
              valor={String(resenasCount ?? 0)}
              etiqueta={(resenasCount ?? 0) === 1 ? "reseña" : "reseñas"}
            />
            <span className="h-7 w-px bg-aventurea-line" />
            <Stat
              valor={String(favoritosCount ?? 0)}
              etiqueta={(favoritosCount ?? 0) === 1 ? "favorito" : "favoritos"}
            />
          </div>
        </div>

        {/* El tablero: una card por sección, cada una con su "+N" de
            movimientos nuevos. Nada de listas largas acá — cada card
            lleva a su propia página. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <TarjetaAcceso
            href="/cuenta/ir/mensajes"
            icono={<IconChatBubble className="h-5 w-5" />}
            titulo="Mensajes"
            detalle="Tus conversaciones"
            badge={nuevosMensajes}
          />
          {tieneNegocio ? (
            <TarjetaAcceso
              href="/cuenta/ir/proveedor"
              icono={<IconStore className="h-5 w-5" />}
              titulo="Panel de proveedor"
              detalle={`${negocios.length} ${negocios.length === 1 ? "negocio" : "negocios"} · ${vecesContratado} ${
                vecesContratado === 1 ? "contratación" : "contrataciones"
              }`}
              badge={reservasNuevasNegocio}
              acento
            />
          ) : (
            <TarjetaAcceso
              href="/mi-negocio/nuevo"
              icono={<IconPlus className="h-5 w-5" />}
              titulo="Publicar mi negocio"
              detalle="Gratis en Bookea"
              acento
            />
          )}
          <TarjetaAcceso
            href="/cuenta/ir/invitaciones"
            icono={<IconMail className="h-5 w-5" />}
            titulo="Invitaciones y álbumes"
            detalle={
              invitacionIds.length > 0
                ? `${invitacionIds.length} ${invitacionIds.length === 1 ? "evento" : "eventos"} · ${personasConfirmadas} ${
                    personasConfirmadas === 1 ? "persona confirmada" : "personas confirmadas"
                  }`
                : "Tus eventos, confirmados y fotos"
            }
            badge={confirmacionesNuevas}
          />
          <TarjetaAcceso
            href="/cuenta/reservas"
            icono={<IconCalendarLine className="h-5 w-5" />}
            titulo="Tus reservas"
            detalle={`${activas} ${activas === 1 ? "activa" : "activas"} · ${historial} en historial`}
          />
          <TarjetaAcceso
            href="/cuenta/favoritos"
            icono={<IconHeart className="h-5 w-5" />}
            titulo="Tus favoritos"
            detalle={`${favoritosCount ?? 0} ${(favoritosCount ?? 0) === 1 ? "guardado" : "guardados"}`}
          />
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

/** Un número del perfil con su etiqueta, en una fila de tercios. */
function Stat({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-[19px] font-extrabold leading-tight text-aventurea-ink">{valor}</p>
      <p className="text-[11px] font-semibold text-aventurea-ink-soft">{etiqueta}</p>
    </div>
  );
}

/** Un acceso del perfil como tarjeta con ícono en burbuja y su "+N". */
function TarjetaAcceso({
  href,
  icono,
  titulo,
  detalle,
  badge,
  acento,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  /** Movimientos nuevos desde la última visita; 0 = sin pastilla. */
  badge?: number;
  /** true = la burbuja va en naranja (la acción principal). */
  acento?: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 transition-colors hover:border-aventurea-navy"
    >
      {badge != null && badge > 0 && (
        <span className="absolute right-3 top-3 rounded-lg bg-aventurea-orange px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white">
          +{badge > 99 ? "99" : badge}
        </span>
      )}
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
