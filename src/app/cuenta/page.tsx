import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import FormularioAuth from "./formulario-auth";
import { cerrarSesionCuenta } from "./actions";
import { hoyISOCR } from "@/lib/fechas";
import TableroModos from "./tablero-modos";

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
    { count: misLealtadesCount },
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
    // Programas de OTROS negocios donde es cliente afiliado — la
    // tarjeta "Mi lealtad", el respaldo web del pase.
    supabase
      .from("miembros")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", user.id)
      .eq("estado", "activa"),
  ]);

  const reservas = (reservasData ?? []) as { id: string; fecha: string; estado: string }[];
  const propios = (negociosData ?? []) as NegocioResumen[];

  // Los negocios donde alguien la sumó como colaboradora (0116) cuentan
  // igual que los propios para esta pantalla: si no, quien administra el
  // negocio de otro entra a /cuenta y ve la vista de cliente, sin puerta
  // al panel. Era lo que pasaba justo después de darle el acceso.
  //
  // Si la 0116 todavía no corrió, la consulta falla y queda solo lo
  // propio: el mismo comportamiento que había antes.
  const { data: colabData } = await supabase
    .from("rancho_colaboradores")
    .select("rancho_id")
    .eq("usuario_id", user.id);

  const idsColaborados = (colabData ?? [])
    .map((c) => (c as { rancho_id: string }).rancho_id)
    .filter((rid) => !propios.some((n) => n.id === rid));

  let colaborados: NegocioResumen[] = [];
  if (idsColaborados.length > 0) {
    const { data: extra } = await supabase
      .from("ranchos")
      .select("id, estado")
      .in("id", idsColaborados);
    colaborados = (extra ?? []) as NegocioResumen[];
  }

  const negocios = [...propios, ...colaborados];
  const invitacionIds = ((invitacionesData ?? []) as { id: string }[]).map((i) => i.id);
  const tieneNegocio = negocios.length > 0;

  // ¿Alguno de sus negocios tiene el programa de lealtad contratado?
  // Con uno alcanza: la tarjeta lleva al listado y ahí se elige cuál.
  // Si ninguno lo tiene, la tarjeta igual aparece pero invitando a
  // contratarlo — es lo que hace que alguien se entere de que existe.
  let lealtadActiva = false;
  if (tieneNegocio) {
    const { data: conLealtad } = await supabase
      .from("addons_negocio")
      .select("rancho_id")
      .in(
        "rancho_id",
        negocios.map((n) => n.id),
      )
      .eq("addon", "lealtad")
      .eq("activo", true)
      .limit(1);
    lealtadActiva = (conLealtad ?? []).length > 0;
  }

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

  // Los "+N" de cada card, en paralelo: reservas que entraron a mis
  // negocios y confirmaciones de invitados.
  const negocioIds = negocios.map((n) => n.id);

  const [reservasNegocioRes, rsvpRes, contratadoRes] = await Promise.all([
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
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-aventurea-sky bg-aventurea-navy text-[22px] font-extrabold text-white">
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
                      ? "bg-aventurea-sky/10 text-aventurea-orange"
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

        {/* El tablero con toggle de modo */}
        <TableroModos
          tieneNegocio={tieneNegocio}
          reservasNuevasNegocio={reservasNuevasNegocio}
          vecesContratado={vecesContratado}
          negociosLength={negocios.length}
          lealtadActiva={lealtadActiva}
          confirmacionesNuevas={confirmacionesNuevas}
          invitacionIds={invitacionIds}
          personasConfirmadas={personasConfirmadas}
          activas={activas}
          historial={historial}
          favoritosCount={favoritosCount ?? 0}
          misLealtadesCount={misLealtadesCount ?? 0}
        />

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

