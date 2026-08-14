import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SiteHeader from "@/components/site-header";
import FormularioAuth from "./formulario-auth";
import { cerrarSesionCuenta } from "./actions";
import { hoyISOCR } from "@/lib/fechas";
import { iniciales } from "@/lib/iniciales";
import { categoriaLabel } from "@/lib/categorias-vertical";
import { consultarSaldo } from "@/lib/lealtad/motor";
import { tipoDe, metaDe, leerBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import TableroModos, { type ProximaExperiencia, type LealtadPrincipal } from "./tablero-modos";

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
export default async function CuentaPage({
  searchParams,
}: {
  // `volver=lealtad`: quien viene de la vitrina /lealtad como dueño de
  // negocio no debería ver el tablero genérico — entra derecho a su
  // panel. `/lealtad/entrar` YA sabe resolver "cero/uno/varios negocios
  // con programa" (ver ese archivo); acá solo se reusa.
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  const destinoLealtad = volver === "lealtad" ? "/lealtad/entrar" : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-aventurea-cream">
        <SiteHeader breadcrumb="Tu cuenta" />
        <section className="mx-auto max-w-[720px] px-6 py-14">
          <FormularioAuth
            destino={destinoLealtad ?? undefined}
            {...(destinoLealtad
              ? {
                  titulo: "Entrá a tu programa de lealtad",
                  intro:
                    "Con el correo de tu negocio. Si ya tenés cuenta entrás directo; si es tu primera vez, te la creamos ahí mismo.",
                }
              : {})}
          />
        </section>
      </div>
    );
  }

  // Ya tenía sesión (venía de un click en "Entrar" en /lealtad estando
  // logueado, o de una guarda interna del panel): directo al panel, sin
  // mostrarle primero el tablero de cliente.
  if (destinoLealtad) redirect(destinoLealtad);

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
      .select("id, fecha, estado, ranchos(nombre, foto_url, categoria, slug, vertical)")
      .eq("cliente_id", user.id)
      .in("estado", [
        "pendiente",
        "confirmada",
        "rechazada",
        "cumplida",
        "no_asistio",
        "cancelada",
      ])
      .order("fecha", { ascending: true }),
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

  type RanchoResumenReserva = {
    nombre: string;
    foto_url: string | null;
    categoria: string;
    slug: string | null;
    vertical: string | null;
  };
  type ReservaResumen = { id: string; fecha: string; estado: string; ranchos: RanchoResumenReserva | null };
  const reservas = (reservasData ?? []) as unknown as ReservaResumen[];
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
  const activas = reservas.filter((r) => !FINALES.has(r.estado) && r.fecha >= hoy).length;
  const historial = reservas.length - activas;

  // "Tu próxima experiencia": la más cercana entre las activas, no una
  // consulta aparte — ya se trajeron todas con su negocio embebido.
  //
  // NO se exige que `ranchos` haya resuelto: un negocio borrado deja
  // `rancho_id` en null (ON DELETE SET NULL) pero la reserva sigue
  // activa y sigue contando en "activas" más abajo — exigir el join acá
  // la haría desaparecer de esta card sin desaparecer de ese número.
  // Mismo respaldo que ya usa reservas-tabs.tsx: "Proveedor" cuando no
  // hay nombre.
  //
  // Desempate por fecha: si dos reservas caen el mismo día, se prefiere
  // la confirmada sobre la pendiente — una reserva pendiente todavía
  // puede rechazarse, así que no es la mejor candidata a "lo próximo".
  const PRIORIDAD_ESTADO: Record<string, number> = { confirmada: 0, pendiente: 1 };
  const proximaCandidata = reservas
    .filter((r) => !FINALES.has(r.estado) && r.fecha >= hoy)
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
      return (PRIORIDAD_ESTADO[a.estado] ?? 2) - (PRIORIDAD_ESTADO[b.estado] ?? 2);
    })[0];
  const proximaExperiencia: ProximaExperiencia = proximaCandidata
    ? {
        id: proximaCandidata.id,
        fecha: proximaCandidata.fecha,
        negocioNombre: proximaCandidata.ranchos?.nombre ?? "Proveedor",
        fotoUrl: proximaCandidata.ranchos?.foto_url ?? null,
        categoriaTexto: proximaCandidata.ranchos
          ? categoriaLabel(proximaCandidata.ranchos.vertical ?? "eventos", proximaCandidata.ranchos.categoria)
          : "",
        slug: proximaCandidata.ranchos?.slug ?? null,
      }
    : null;

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

  // Crudo (puede venir vacío) para precargar el modal de edición, y por
  // separado el de mostrar (con el "Tu cuenta" de respaldo) — mezclarlos
  // en un solo string hacía que alguien que de verdad se llame "Tu
  // cuenta" viera el campo Nombre vacío al abrir "Editar perfil".
  const nombreCrudo = (perfil?.nombre || "").trim();
  const nombreVisible = nombreCrudo || "Tu cuenta";
  const inicialesAvatar = iniciales(nombreCrudo || user.email || "?");

  // El teléfono nunca vivió en `perfiles` — es metadata de auth desde
  // que existe (formulario-codigo-acceso.tsx, auth/callback/route.ts),
  // así que no hace falta ninguna consulta extra para leerlo.
  const metaUsuario = user.user_metadata as Record<string, unknown>;
  const telefono = typeof metaUsuario.whatsapp === "string" ? metaUsuario.whatsapp : "";

  // La tarjeta de lealtad de este cliente, SOLO cuando tiene exactamente
  // una — con 0 no hay nada que mostrar y con varias no cabe un solo
  // progreso (ver la nota en tablero-modos.tsx). Usa el cliente admin
  // porque el programa y el negocio son de OTRO dueño: la RLS de
  // `programa_lealtad` no deja leerlos como cliente afiliado (mismo
  // motivo por el que /cuenta/lealtad/page.tsx ya usa el admin acá).
  let lealtadPrincipal: LealtadPrincipal = null;
  if ((misLealtadesCount ?? 0) === 1) {
    const admin = createAdminClient();
    if (admin) {
      const { data: miembro } = await admin
        .from("miembros")
        .select("id, programa_id")
        .eq("cliente_id", user.id)
        .eq("estado", "activa")
        .limit(1)
        .maybeSingle();
      if (miembro) {
        const { data: programa } = await admin
          .from("programa_lealtad")
          .select("modo, rancho_id, beneficio")
          .eq("id", miembro.programa_id as string)
          .maybeSingle();
        if (programa) {
          const { data: negocio } = await admin
            .from("ranchos")
            .select("nombre")
            .eq("id", programa.rancho_id as string)
            .maybeSingle();
          const tipo = tipoDe(programa.modo as string | null);
          const beneficio = leerBeneficio(programa.beneficio, tipo);
          const saldo = (await consultarSaldo(miembro.id as string)) ?? 0;
          lealtadPrincipal = {
            negocioNombre: ((negocio?.nombre as string | null) ?? "").trim() || "Tu negocio",
            tipo,
            saldo,
            meta: beneficio ? metaDe(beneficio) : null,
          };
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Tu cuenta" />

      <TableroModos
        nombre={nombreVisible}
        nombreCrudo={nombreCrudo}
        inicialesAvatar={inicialesAvatar}
        correo={user.email ?? ""}
        telefono={telefono}
        tieneNegocio={tieneNegocio}
        resenasCount={resenasCount ?? 0}
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
        lealtadPrincipal={lealtadPrincipal}
        proximaExperiencia={proximaExperiencia}
        cerrarSesion={cerrarSesionCuenta}
      />
    </div>
  );
}

