import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR, fmtFechaCorta, sumarDiasISO } from "@/lib/fechas";
import { fmtColones } from "@/lib/finanzas";
import { horarioDeDetalles } from "@/app/citas/tipos";
import { agruparClientes, esInactivo, type ReservaCliente } from "@/lib/crm-citas";
import { cargarContextoNegocio } from "@/lib/business/contexto";
import { definicionTipo, usaAgendaPorHoras } from "@/lib/business/modulos";
import {
  identidadDe,
  variablesAcento,
  type Termino,
  type Vocabulario,
} from "@/lib/business/identidad";
import SeccionPlegable from "@/components/seccion-plegable";
import { IconChevronLeft } from "@/components/icons";
import { Card, CardVacia, FilaPanel, Metrica, PildoraEstado } from "@/components/panel/piezas";
import {
  ESTADO_AVISO,
  GAP_TABLERO,
  RADIO_CARD,
  RADIO_PILDORA,
  type EstadoPanel,
} from "@/components/panel/sistema";
import EncabezadoCitas from "./encabezado-citas";
import { metricasDelDia } from "./metricas-dia";
import MembresiasPanel from "./membresias-panel";
import type { MembresiaFila, PlanFila } from "./membresias-actions";
import type { ConsumoMembresia } from "@/lib/membresias";
import AgendaCitas, { type CitaDia } from "./agenda-citas";
import ClientesPanel from "./clientes-panel";
import ReportesCitas from "./reportes-citas";
import ListaEsperaPanel from "./lista-espera-panel";
import type { BloqueoAgenda, MiembroEquipo, RangoHorarioMiembro } from "./actions";

type Giftcard = {
  id: string;
  codigo: string;
  monto: number;
  saldo: number;
  comprador_nombre: string | null;
  beneficiario_nombre: string | null;
  estado: "activa" | "canjeada" | "vencida";
  created_at: string;
  vence_en: string | null;
};

/**
 * Las campañas de correo (enviarCampanaNegocio) se despachan como
 * server action de ESTA ruta: 200 destinatarios en lotes con pausa
 * necesitan más que el timeout por defecto de una función serverless
 * (paridad con /api/citas/campanas, que declara lo mismo).
 */
export const maxDuration = 300;

/**
 * Las giftcards, mapeadas a los estados semánticos del panel (los
 * mismos cinco de `components/panel/sistema`, con su contraste ya
 * medido) en vez de a tres colores propios:
 *   activa   → éxito, hay saldo vivo
 *   canjeada → neutro, se usó entera: no pasó nada malo, ya no hace nada
 *   vencida  → aviso, el ámbar de "esto se te fue de las manos"
 * El rojo queda para lo que de verdad es un error (una carga que falló),
 * no para una fecha que pasó.
 */
const GIFTCARD_ESTADO: Record<Giftcard["estado"], { label: string; estado: EstadoPanel }> = {
  activa: { label: "Activa", estado: "exito" },
  canjeada: { label: "Canjeada", estado: "neutro" },
  vencida: { label: "Vencida", estado: "aviso" },
};

/**
 * La pantalla de CITAS — solo la operación del día (pedido del dueño:
 * una sola pantalla donde las citas de la web entran solas y se
 * agenda, mueve o cancela todo). La agenda por colaborador va directa,
 * sin pestañas internas; lo que acompaña la operación (clientes,
 * reportes, lista de espera, giftcards) queda debajo en secciones
 * plegables CERRADAS. La configuración del negocio (equipo, horario
 * semanal, bloqueos, depósito, productos) vive en la pestaña
 * Configuración de /mi-negocio/[id].
 */
export default async function CitasConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

  // Con la llave de servicio: el control de acceso real es el chequeo
  // de `owner_id`/admin de acá abajo (con `notFound()` si no pasa), no
  // esta lectura — que solo necesita poder pedir `*` sin lista de
  // columnas a mano (desde la 0155, `authenticated` no tiene permiso
  // de tabla completa sobre `ranchos`).
  const { data: rancho } = await (createAdminClient() ?? supabase)
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  // Mismo control de acceso que el panel: el dueño siempre, y un admin
  // que entra a ayudar en nombre del proveedor.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (rancho.owner_id !== user.id && perfil?.rol !== "admin") notFound();

  // Esta pantalla es la agenda del día de TODO negocio que agende por
  // horas — la vertical de Citas y los proveedores de eventos, que
  // trabajan igual (un DJ toca a las 3 p.m. y a las 9 p.m.). Un LUGAR
  // no entra: su fecha se alquila entera y su agenda es el calendario
  // por día del panel.
  if (!usaAgendaPorHoras(rancho.vertical, rancho.categoria)) {
    redirect(`/mi-negocio/${id}`);
  }

  const hoy = hoyISOCR();
  const zona = rancho.zona_horaria || "America/Costa_Rica";
  const [
    equipoRes,
    citasRes,
    bloqueosRes,
    serviciosRes,
    horariosRes,
    crmRes,
    giftcardsRes,
    planesRes,
    membresiasRes,
    consumosRes,
    negocio,
  ] = await Promise.all([
    supabase
      .from("equipo_rancho")
      .select("*")
      .eq("rancho_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    // La agenda de hoy: la primera carga sale del servidor y el cambio
    // de fecha se consulta desde el navegador (RLS limita al dueño).
    // Mismos campos que el refetch del cliente (agenda-citas.tsx,
    // CAMPOS_CITA) — si difieren, la agenda de HOY se ve distinta (sin
    // cobro/contacto) hasta que el dueño cambie de fecha una vez.
    supabase
      .from("reservas")
      .select(
        "id, hora_inicio, duracion_minutos, miembro_id, nombre, tipo_evento, estado, correo, whatsapp, contacto, notas, monto_total, origen, evento_pagado, monto_cobrado_final",
      )
      .eq("rancho_id", id)
      .eq("fecha", hoy)
      .not("hora_inicio", "is", null)
      .neq("estado", "temporal")
      .order("hora_inicio", { ascending: true }),
    // Bloqueos vigentes y futuros (los vencidos hace más de un día ya
    // no le sirven a nadie).
    supabase
      .from("bloqueos_agenda")
      .select("id, rancho_id, miembro_id, inicio, fin, motivo")
      .eq("rancho_id", id)
      .gte("fin", `${sumarDiasISO(hoy, -1)}T00:00:00-06:00`)
      .order("inicio", { ascending: true }),
    // Los servicios de cita del catálogo (para walk-ins y asignación).
    supabase
      .from("rancho_items")
      .select("id, nombre, duracion_minutos, precio, activo")
      .eq("rancho_id", id)
      .not("duracion_minutos", "is", null)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    // Horario propio por miembro (0061): la agenda lo necesita para
    // pintar la franja real de cada colaborador (herencia + día libre).
    supabase
      .from("horarios_recurso")
      .select("miembro_id, dow, abre, cierra, equipo_rancho!inner(rancho_id)")
      .eq("equipo_rancho.rancho_id", id),
    // La materia prima del CRM: las citas del negocio (con hora). La
    // ficha se deriva acá y no se guarda en ninguna tabla (D-3).
    supabase
      .from("reservas")
      .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
      .eq("rancho_id", id)
      .not("hora_inicio", "is", null)
      .order("fecha", { ascending: false })
      .limit(3000),
    // Las ventas de giftcards (RLS: solo el dueño o un admin las ven).
    supabase
      .from("giftcards")
      .select(
        "id, codigo, monto, saldo, comprador_nombre, beneficiario_nombre, estado, created_at, vence_en",
      )
      .eq("rancho_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    // Membresías y bonos (0120). Las tres van juntas porque el panel
    // deriva el saldo de los consumos: con los planes solos no puede
    // pintar nada útil. Si la migración no se pegó, las tres traen
    // error y el panel muestra su aviso en vez de romperse.
    supabase
      .from("planes_membresia")
      .select("*")
      .eq("rancho_id", id)
      .order("orden", { ascending: true }),
    supabase
      .from("membresias")
      .select("*")
      .eq("rancho_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("consumos_membresia")
      .select("membresia_id, cantidad, membresias!inner(rancho_id)")
      .eq("membresias.rancho_id", id),
    // BOOKEA BUSINESS: qué módulos usa este negocio. Lo que acompaña la
    // operación (clientes, reportes) se muestra solo si los tiene
    // encendidos; sin la 0108 corrida resuelve los defaults de su tipo,
    // o sea todo como estaba.
    cargarContextoNegocio(supabase, {
      id,
      vertical: rancho.vertical,
      categoria: rancho.categoria,
      tipo_negocio: (rancho as { tipo_negocio?: string | null }).tipo_negocio ?? null,
    }),
  ]);

  const equipo = (equipoRes.data ?? []) as MiembroEquipo[];
  const citasHoy = (citasRes.data ?? []) as CitaDia[];
  const bloqueos = (bloqueosRes.data ?? []) as BloqueoAgenda[];
  const horario = horarioDeDetalles(rancho.detalles);
  const errorCarga = equipoRes.error ?? citasRes.error;

  const servicios = (serviciosRes.data ?? []).map((s) => ({
    id: s.id as string,
    nombre: s.nombre as string,
    duracionMinutos: (s.duracion_minutos as number | null) ?? null,
    precio: s.precio === null ? null : Number(s.precio),
  }));

  const horariosPorMiembro: Record<string, RangoHorarioMiembro[]> = {};
  for (const h of (horariosRes.data ?? []) as unknown as {
    miembro_id: string;
    dow: number;
    abre: string;
    cierra: string;
  }[]) {
    (horariosPorMiembro[h.miembro_id] ??= []).push({
      dow: h.dow,
      abre: String(h.abre).slice(0, 5),
      cierra: String(h.cierra).slice(0, 5),
    });
  }

  const clientes = agruparClientes((crmRes.data ?? []) as ReservaCliente[], hoy);
  const clientesInactivos = clientes.filter((c) => esInactivo(c)).length;

  // QUIÉN ES ESTE NEGOCIO. `negocio.tipo` ya viene resuelto (el
  // tipo_negocio guardado, o el derivado de su categoría) y de ahí
  // salen el color, el ícono y las palabras de toda la pantalla. Nada
  // de esto se decide acá: el catálogo es lib/business/identidad.
  const identidad = identidadDe(negocio.tipo);
  const definicion = definicionTipo(negocio.tipo);

  // La palabra de la vertical Citas, la misma que `palabraReserva` le da
  // a TODOS sus tipos. Hace falta escrita acá por un caso concreto: el
  // negocio de Citas que todavía no eligió tipo cae en el neutro, y el
  // neutro habla de RESERVAS. Sin esto, elegir el tipo podría EMPEORAR
  // el vocabulario de una pantalla que siempre dijo "citas"; con esto,
  // elegirlo solo puede afinarlo (a "consultas", a "sesiones"…).
  const CITA: Termino = { singular: "cita", plural: "citas", Singular: "Cita", Plural: "Citas" };

  // La misma pantalla, un vocabulario por tipo: una barbería agenda
  // CITAS, un consultorio CONSULTAS, un gimnasio SESIONES y un
  // proveedor de eventos RESERVAS (nadie llama "cita" a tocar en una
  // boda). El TÍTULO sigue decidiéndose por la vertical: en Eventos
  // esta pantalla es la agenda del día del negocio entero, no una lista
  // de reservas.
  const esVerticalCitas = rancho.vertical === "citas";
  const tieneTipo = negocio.tipo !== "otro";
  const vocabulario: Vocabulario =
    esVerticalCitas && !tieneTipo
      ? { ...identidad.vocabulario, visita: CITA }
      : identidad.vocabulario;
  const { persona, visita } = vocabulario;
  const tituloAgenda = esVerticalCitas ? visita.Plural : "Agenda del día";
  const loQueEntra = visita.plural;

  // Los números del día. Todos salen de lo que ya se cargó arriba: las
  // citas de hoy, el equipo, el horario del negocio, el horario propio
  // de cada quien y los bloqueos. Lo que no se puede calcular no se
  // pinta (ver metricas-dia.ts).
  const metricas = metricasDelDia({
    fecha: hoy,
    zona,
    citas: citasHoy,
    equipo,
    horario,
    horariosPorMiembro,
    bloqueos,
  });

  // QUÉ SECCIONES VE ESTE TIPO. Lo que el tipo DECLARA (aunque el
  // módulo todavía no tenga pantalla propia) alcanza para saber si esta
  // sección es parte de su operación: un spa vende paquetes y
  // membresías, una barbería no.
  const declara = new Set<string>(definicion.modulos);
  const planes = (planesRes.data ?? []) as PlanFila[];
  const membresias = (membresiasRes.data ?? []) as MembresiaFila[];
  // Con dos escapatorias que importan: si el negocio YA tiene planes o
  // membresías creadas, la sección se muestra igual —esconderle a
  // alguien los datos que ya cargó sería peor que ofrecerle de más—; y
  // si todavía no eligió tipo, tampoco le quitamos nada: de un negocio
  // que no sabemos qué es no se asume que algo no le sirve.
  const muestraMembresias =
    !tieneTipo ||
    declara.has("membresias") ||
    declara.has("paquetes") ||
    planes.length > 0 ||
    membresias.length > 0;
  // "Paquetes y bonos" para quien vende visitas prepagadas pero no
  // planes con período (salón, uñas); "Membresías" para el resto.
  const tituloMembresias =
    !declara.has("membresias") && declara.has("paquetes")
      ? "Paquetes y bonos"
      : "Membresías y bonos";

  // Si la tabla aún no existe (migración 0059 sin correr) se muestra
  // el aviso dentro de su sección, sin tumbar el resto del panel.
  const giftcards = (giftcardsRes.data ?? []) as Giftcard[];
  const giftcardsSinTabla = !!giftcardsRes.error;
  // Regalar una consulta médica no es un producto que Bookea deba
  // empujar: en salud la sección no aparece — salvo que el negocio ya
  // haya vendido giftcards, y entonces necesita poder verlas.
  const muestraGiftcards = definicion.familia !== "salud" || giftcards.length > 0;
  // Y por la misma razón, en salud el CRM no habla de "promociones":
  // escribirle a un paciente para que vuelva es un mensaje, no una
  // campaña. Es lo mismo que dice el catálogo al no darle el módulo de
  // marketing a `consultorio`.
  const tonoComercial = definicion.familia !== "salud";
  const giftVendido = giftcards.reduce((s, g) => s + Number(g.monto), 0);
  const giftPorCanjear = giftcards
    .filter((g) => g.estado === "activa")
    .reduce((s, g) => s + Number(g.saldo), 0);

  return (
    // El acento del tipo entra UNA sola vez, acá: todo lo de adentro
    // —incluidos los componentes de cliente— lo lee como var(--acento…),
    // así ninguna pantalla necesita saber de qué color es un spa.
    /* El lienzo GRIS lo pone el layout de /mi-negocio; acá va el mismo
       ancho de trabajo y el mismo padding que el contenido del panel
       (1560px de tope de legibilidad, px-4 → lg:px-8), para que salir
       del panel a la agenda no se sienta como salir del producto.
       Esta pantalla todavía NO cuelga del rail del panel: es un
       `page.tsx` propio, y meterla adentro de `PanelSidebar` es un
       cambio de navegación, no de piel. */
    <main
      className="mx-auto w-full max-w-[1560px] px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pt-8"
      style={variablesAcento(identidad) as CSSProperties}
    >
      <Link
        href={`/mi-negocio/${rancho.id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy"
      >
        <IconChevronLeft className="h-3.5 w-3.5" />
        Volver al panel de {rancho.nombre}
      </Link>

      <div className="mt-5">
        <EncabezadoCitas
          identidad={identidad}
          tipoLabel={tieneTipo ? definicion.label : null}
          hrefConfig={`/mi-negocio/${rancho.id}?tab=config`}
          nombreNegocio={rancho.nombre}
          fecha={hoy}
          titulo={tituloAgenda}
          metricas={metricas}
          muestraPagos={negocio.modulos.has("pagos")}
          personas={
            negocio.modulos.has("clientes")
              ? { total: clientes.length, inactivos: clientesInactivos }
              : null
          }
          descripcion={
            <>
              Las {loQueEntra} de tu página entran solas acá. Agendá a mano lo que
              te entre por teléfono, movélas, cancelálas y marcá quién vino — todo
              desde esta pantalla. El equipo, horarios y demás se configuran en{" "}
              <Link
                href={`/mi-negocio/${rancho.id}?tab=config`}
                className="font-bold text-aventurea-navy underline"
              >
                Configuración
              </Link>
              .
            </>
          }
        />
      </div>

      {errorCarga && (
        <div
          className={`mt-6 ${RADIO_CARD} p-4 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}
        >
          <strong>Faltan las migraciones.</strong> No se pudo leer la
          configuración de citas: {errorCarga.message}. Corré{" "}
          <code className="rounded bg-aventurea-surface px-1.5 py-0.5 font-mono text-[12px]">
            supabase/aplicar-migraciones-pendientes.sql
          </code>{" "}
          en el SQL Editor de Supabase y volvé a entrar.
        </div>
      )}

      <div className={`mt-6 flex flex-col ${GAP_TABLERO}`}>
        {/* La agenda va DIRECTA — sin pestañas internas ni títulos de
            sección (pedido del dueño): esta pantalla ES la agenda. */}
        <AgendaCitas
          ranchoId={rancho.id}
          zona={zona}
          equipo={equipo.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            tipo: m.tipo ?? "profesional",
            activo: m.activo,
            fotoUrl: m.foto_url,
          }))}
          servicios={servicios}
          horario={horario}
          horariosPorMiembro={horariosPorMiembro}
          initialFecha={hoy}
          initialCitas={citasHoy}
          initialBloqueos={bloqueos}
          vocabulario={vocabulario}
        />

        {/* Lo que acompaña la operación, plegado y cerrado: se abre
            cuando hace falta, sin agrandar la pantalla. */}
        {negocio.modulos.has("clientes") && (
          <SeccionPlegable
            marco={false}
            id="clientes"
            titulo={persona.Plural}
            descripcion={
              tonoComercial
                ? "Quién viene, quién dejó de venir y quién te está fallando — con la promoción de re-enganche a un clic."
                : "Quién viene, quién dejó de venir y quién te está fallando — con el correo para escribirle a un clic."
            }
            resumen={clientes.length > 0 ? `${clientes.length}` : undefined}
          >
            <ClientesPanel
              ranchoId={rancho.id}
              nombreNegocio={rancho.nombre}
              clientes={clientes}
              vocabulario={vocabulario}
              promociones={tonoComercial}
            />
          </SeccionPlegable>
        )}

        {negocio.modulos.has("reportes") && (
          <SeccionPlegable
            marco={false}
            // El ancla a la que apunta el ítem "Reportes" del menú del
            // panel (ver lib/business/menu.ts). Sin `id` ese ítem no
            // tendría a dónde llevar y se pintaría como "próximamente".
            id="reportes"
            titulo="Cómo va el negocio"
            descripcion={`${visita.Plural}, asistencia, ingresos, quién atiende más y a qué horas — derivado de tu agenda real.`}
          >
            <ReportesCitas
              ranchoId={rancho.id}
              equipo={equipo.map((m) => ({ id: m.id, nombre: m.nombre }))}
              vocabulario={vocabulario}
            />
          </SeccionPlegable>
        )}

        {muestraMembresias && (
          <SeccionPlegable
            marco={false}
            titulo={tituloMembresias}
            descripcion={`Lo que el ${persona.singular} paga por adelantado: un plan con período, o un bono de ${visita.plural} que se van gastando.`}
          >
            <MembresiasPanel
              ranchoId={rancho.id}
              hoy={hoy}
              planesIniciales={planes}
              membresiasIniciales={membresias}
              consumosIniciales={(consumosRes.data ?? []) as ConsumoMembresia[]}
              faltaMigracion={!!planesRes.error}
            />
          </SeccionPlegable>
        )}

        <SeccionPlegable
          marco={false}
          titulo="Lista de espera"
          descripcion={`Cuando un día está lleno, el ${persona.singular} deja su nombre; si se libera un espacio, se le avisa solo.`}
        >
          <ListaEsperaPanel ranchoId={rancho.id} vocabulario={vocabulario} />
        </SeccionPlegable>

        {muestraGiftcards && (
          <SeccionPlegable
            marco={false}
            titulo="Giftcards"
            descripcion="Las giftcards vendidas de tu negocio: quién la compró, para quién es y cuánto saldo queda."
            resumen={giftcards.length > 0 ? `${giftcards.length} vendidas` : undefined}
          >
            {giftcardsSinTabla ? (
              <div
                className={`${RADIO_CARD} p-4 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}
              >
                <strong>Falta la migración de giftcards.</strong> Corré{" "}
                <code className="rounded bg-aventurea-surface px-1.5 py-0.5 font-mono text-[12px]">
                  supabase/migrations/0059_giftcards.sql
                </code>{" "}
                en el SQL Editor de Supabase y volvé a entrar.
              </div>
            ) : giftcards.length === 0 ? (
              <CardVacia>Todavía no hay giftcards vendidas.</CardVacia>
            ) : (
              <>
                {/* Los tres números salen de las mismas giftcards que se
                    listan abajo — nada que no tenga tabla detrás. */}
                <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <Metrica rotulo="Vendido" valor={fmtColones(giftVendido)} />
                  <Metrica rotulo="Por canjear" valor={fmtColones(giftPorCanjear)} />
                  <Metrica
                    rotulo="Activas"
                    valor={String(giftcards.filter((g) => g.estado === "activa").length)}
                  />
                </div>

                {/* La fila canónica del panel: contexto (la fecha de
                    venta), la barrita del estado, quién la compró y el
                    monto con su píldora a la derecha. */}
                <Card sinPadding className="px-4 sm:px-5">
                  {giftcards.map((g, i) => (
                    <FilaPanel
                      key={g.id}
                      separador={i < giftcards.length - 1}
                      marca={GIFTCARD_ESTADO[g.estado].estado}
                      titulo={
                        <span className="flex flex-wrap items-center gap-2">
                          <code
                            className={`${RADIO_PILDORA} bg-aventurea-cream-2 px-2 py-0.5 font-mono text-[12px] font-bold text-aventurea-ink`}
                          >
                            {g.codigo}
                          </code>
                          <span className="min-w-0 truncate">
                            {g.comprador_nombre ?? "Compra directa"}
                            {g.beneficiario_nombre ? ` → para ${g.beneficiario_nombre}` : ""}
                          </span>
                        </span>
                      }
                      detalle={
                        <>
                          {fmtFechaCorta(g.created_at.slice(0, 10))}
                          {g.vence_en ? ` · vence ${fmtFechaCorta(g.vence_en)}` : ""}
                          {g.estado === "activa" && Number(g.saldo) !== Number(g.monto)
                            ? ` · saldo ${fmtColones(Number(g.saldo))}`
                            : ""}
                        </>
                      }
                      derecha={
                        <div className="flex shrink-0 items-center gap-2.5">
                          <span className="text-[13.5px] font-extrabold tabular-nums text-aventurea-ink">
                            {fmtColones(Number(g.monto))}
                          </span>
                          <PildoraEstado estado={GIFTCARD_ESTADO[g.estado].estado} colapsa>
                            {GIFTCARD_ESTADO[g.estado].label}
                          </PildoraEstado>
                        </div>
                      }
                    />
                  ))}
                </Card>
              </>
            )}
          </SeccionPlegable>
        )}
      </div>
    </main>
  );
}
