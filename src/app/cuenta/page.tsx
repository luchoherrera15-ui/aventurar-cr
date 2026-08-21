import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SiteHeader from "@/components/site-header";
import FormularioAuth from "./formulario-auth";
import FondoAcceso from "./fondo-acceso";
import { cerrarSesionCuenta } from "./actions";
import { hoyISOCR } from "@/lib/fechas";
import { iniciales } from "@/lib/iniciales";
import { categoriaLabel } from "@/lib/categorias-vertical";
import { consultarSaldo } from "@/lib/lealtad/motor";
import { tipoDe, metaDe, leerBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import { LIENZO_PANEL } from "@/components/panel/sistema";
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
  //
  // `volver=food:{slug}`: mismo mecanismo, para quien venía reservando
  // en FOOD.BOOKEA y tuvo que loguearse a mitad de camino — sin esto
  // caía en el tablero genérico y perdía la franja/cantidad de personas
  // que ya había elegido en /food/restaurante/{slug}.
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;
  const destinoLealtad = volver === "lealtad" ? "/lealtad/entrar" : null;
  const destinoFood = volver?.startsWith("food:")
    ? `/food/restaurante/${volver.slice("food:".length)}`
    : null;
  const destino = destinoLealtad ?? destinoFood;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      /* La pantalla de acceso se queda en BLANCO: no es un panel, es una
         sola tarjeta centrada sobre el marco animado, y el gris del
         lienzo detrás de ese marco lo ensuciaría. El lienzo gris empieza
         cuando hay sesión y hay panel. */
      <div className="min-h-screen bg-aventurea-cream">
        {/* El header del sitio, tal cual — la maqueta dibujaba uno propio
            (marca + "Publicá tu espacio" + menú) que es exactamente lo
            que SiteHeader ya hace, y encima con el estado real de la
            sesión. Duplicarlo solo habría creado un segundo header que
            mantener. */}
        <SiteHeader breadcrumb="Tu cuenta" />

        {/* `isolate` + `overflow-hidden`: el marco animado se recorta acá
            adentro y su apilado no se escapa al header sticky.
            La altura descuenta los 64px (h-16) del header para que la
            tarjeta quede centrada en lo que de verdad queda de pantalla. */}
        <main className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
          <FondoAcceso />

          <div className="relative z-10 w-full max-w-sm">
            {/*
             * EL TEXTO SIMBÓLICO que pidió el dueño para cuando "Entrá
             * acá" (en /lealtad, el CTA de "¿Ya tenés el programa?") abre
             * esta pantalla en una pestaña nueva — "arriba del panel que
             * se abre" es literal: es lo primero que se ve acá.
             *
             * Gateado a `destinoLealtad` (o sea, a `?volver=lealtad`) y
             * no a toda la pantalla: /cuenta también es el login del
             * resto del sitio (reservas, favoritos, invitaciones), y ese
             * público no viene pensando en su programa de lealtad.
             *
             * El texto elegido — "Tu mejor herramienta para que los
             * clientes vuelvan" — parte de la sugerencia del dueño ("tu
             * mejor forma de atraer clientes") pero la ajusta al público
             * real de ESTE link: dice "¿Ya tenés el programa? Entrá
             * acá", o sea que es gente que YA armó su tarjeta y vuelve a
             * administrarla — no alguien decidiendo si probar Lealtad
             * por primera vez. "Atraer" es la promesa de antes de
             * empezar; "que vuelvan" es la de después, que es la que
             * describe la lealtad en sí (y hace eco del propio H1 de
             * /lealtad: "Hacé que cada visita se convierta en la
             * próxima") — sin repetir esa misma frase.
             */}
            {destinoLealtad && (
              <p className="mb-4 text-center text-[13px] font-bold uppercase tracking-[0.08em] text-aventurea-navy/70">
                Tu mejor herramienta para que los clientes vuelvan
              </p>
            )}

            {/* El filo bicolor de la maqueta, superpuesto al borde
                superior de la tarjeta. Va acá afuera y no dentro de
                FormularioAuth: es adorno de ESTA pantalla, y el mismo
                formulario se reusa en /lealtad y en el flujo de dueños,
                donde no pinta nada. */}
            {/* El recorte lo hace un contenedor del ALTO DE LA TARJETA,
                no la franja. Con `h-1.5` (6 px) y `rounded-t-2xl` (14 px)
                el navegador achica los radios —la suma no cabe en 6 px de
                lado— y la franja terminaba con esquinas de 6 px sobre una
                tarjeta de 14: quedaban dos pestañitas de color pintadas
                fuera de la curva. Con `inset-0` el contenedor mide lo
                mismo que la tarjeta, no hay nada que achicar, y la franja
                se recorta contra la curva de verdad. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl"
            >
              <span className="flex h-1.5">
                <span className="w-[74%] bg-aventurea-navy" />
                <span className="flex-1 bg-aventurea-orange" />
              </span>
            </span>

            {/* El mismo FormularioAuth de siempre: código al correo, alta
                con nombre si el correo es nuevo, y los botones sociales
                detrás de sus banderas (si no hay ninguna encendida,
                tampoco se pinta el divisor). Acá solo cambian el título
                y la bajada. */}
            <FormularioAuth
              destino={destino ?? undefined}
              titulo={destinoLealtad ? "Entrá a tu programa de lealtad" : "Entrá a Bookea"}
              intro={
                destinoLealtad
                  ? "Con el correo de tu negocio. Si ya tenés cuenta entrás directo; si es tu primera vez, te la creamos ahí mismo."
                  : "Tus reservas, favoritos y beneficios en un solo lugar."
              }
            />
          </div>
        </main>
      </div>
    );
  }

  // Ya tenía sesión (venía de un click en "Entrar" en /lealtad estando
  // logueado, de un "Iniciá sesión" en FOOD.BOOKEA, o de una guarda
  // interna del panel): directo al destino, sin mostrarle primero el
  // tablero de cliente.
  if (destino) redirect(destino);

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
  // Si ninguno lo tiene, la tarjeta igual aparece pero invitando a
  // contratarlo — es lo que hace que alguien se entere de que existe.
  //
  // CON UNO SOLO, LA TARJETA CAE DIRECTO EN SU PANEL — no en el
  // listado «Mis negocios». Antes se mandaba siempre al listado
  // («con uno alcanza: la tarjeta lleva al listado y ahí se elige
  // cuál»), pero eso obliga a un clic extra siempre que la respuesta
  // es obvia: la mayoría de las cuentas administran un solo negocio.
  // El listado sigue existiendo para cuando de verdad hay que elegir
  // (2+ negocios con lealtad), así que no se pierde nada.
  let lealtadActiva = false;
  let lealtadNegocioUnico: string | null = null;
  if (tieneNegocio) {
    const { data: conLealtad } = await supabase
      .from("addons_negocio")
      .select("rancho_id")
      .in(
        "rancho_id",
        negocios.map((n) => n.id),
      )
      .eq("addon", "lealtad")
      .eq("activo", true);
    const idsConLealtad = (conLealtad ?? []).map((r) => (r as { rancho_id: string }).rancho_id);
    lealtadActiva = idsConLealtad.length > 0;
    lealtadNegocioUnico = idsConLealtad.length === 1 ? idsConLealtad[0] : null;
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
    /* EL LIENZO DEL PANEL. Era `bg-aventurea-cream`, que es blanco: una
       tarjeta blanca sobre un lienzo blanco es 1:1, y por eso el tablero
       se veía plano. Con `--grey` la separación es 1,08:1 — la misma que
       usa la maqueta (1,07:1)—, y la terminan de resolver el borde y la
       sombra de cada tarjeta. */
    <div className={`min-h-screen ${LIENZO_PANEL}`}>
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
        lealtadNegocioUnico={lealtadNegocioUnico}
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

