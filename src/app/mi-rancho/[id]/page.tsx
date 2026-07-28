import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CATALOGO_LABEL,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  normalizarCategoria,
} from "../types";
import type {
  CodigoDescuento,
  PrecioTier,
  PromocionDia,
  Rancho,
  RanchoItem,
  ServicioAdicional,
} from "../types";
import CatalogoPanel from "./catalogo-panel";
import { resumenFinanciero, type Gasto, type ReservaFinanzas } from "@/lib/finanzas";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";
import Tabs, { type Tab } from "./tabs";
import DashboardMetricas from "./dashboard-metricas";
import { calcularMetricas } from "./metricas";
import EditarRanchoForm from "./editar/editar-form";
import PreciosForm from "@/components/precios-form";
import DescuentosForm from "@/components/descuentos-form";
import TerminosForm from "@/components/terminos-form";
import HorariosForm from "@/components/horarios-form";
import CuentasPagoForm from "@/components/cuentas-pago-form";
import ReservasTable from "@/app/admin/(dashboard)/eventos/reservas-table";
import FinanzasPanel from "./finanzas/finanzas-panel";
import {
  guardarPreciosPropio,
  guardarCodigosPropio,
  guardarPromocionesPropio,
  guardarTerminosPropio,
  guardarHorariosPropio,
  guardarCuentasPagoPropio,
} from "./precios/actions";
import {
  agregarGasto,
  borrarGasto,
  marcarDepositoRecibido,
  registrarPagoFinal,
  revertirPagoFinal,
} from "./finanzas/actions";

const ESTADO_LABEL: Record<Rancho["estado"], string> = {
  pendiente: "Pendiente de aprobación",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

const ESTADO_BADGE: Record<Rancho["estado"], string> = {
  pendiente: "bg-aventurea-orange/15 text-aventurea-orange",
  aprobado: "bg-aventurea-green/15 text-aventurea-green",
  rechazado: "bg-red-50 text-red-700",
};

function fmtColones(n: number | null) {
  if (n === null) return "—";
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default async function RanchoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  // Filtramos por dueño además de por id: sin esto, cualquier cuenta
  // con sesión podría abrir la publicación de otra pegando su id en la
  // URL. Las políticas de la base ya lo impiden, esto es la segunda
  // barrera.
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) notFound();

  const rancho = {
    ...(data as Rancho),
    categoria: normalizarCategoria((data as Rancho).categoria),
  };
  const esLugar = rancho.categoria === "lugares";
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");

  const [reservasRes, gastosRes, tiersRes, serviciosRes, codigosRes, promocionesRes, itemsRes] =
    await Promise.all([
      supabase
        .from("reservas")
        .select("*")
        .eq("rancho_id", rancho.id)
        .neq("estado", "temporal")
        .order("fecha", { ascending: true }),
      supabase
        .from("gastos_rancho")
        .select("id, fecha, concepto, categoria, monto, nota")
        .eq("rancho_id", rancho.id)
        .order("fecha", { ascending: false }),
      supabase
        .from("precio_tiers")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("min_invitados", { ascending: true }),
      supabase.from("servicios_adicionales").select("*").eq("rancho_id", rancho.id),
      supabase
        .from("codigos_descuento")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("promociones_dia")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", rancho.id)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  const errorFinanzas = reservasRes.error ?? gastosRes.error;
  const reservas = (reservasRes.data ?? []) as Reserva[];
  const reservasFinanzas = reservas as unknown as ReservaFinanzas[];
  const gastos = (gastosRes.data ?? []) as Gasto[];

  const metricas = calcularMetricas({ reservas: reservasFinanzas, esLugar });
  const resumen = resumenFinanciero({ reservas: reservasFinanzas, gastos });
  const pendientes = reservas.filter((r) => r.estado === "pendiente").length;

  const tabs: Tab[] = [
    {
      id: "editar",
      label: "Editar mi publicación",
      content: <EditarRanchoForm rancho={rancho} />,
    },
    {
      id: "precios",
      label: esLugar ? "Precios y descuentos" : "Códigos de descuento",
      content: (
        <div className="flex flex-col gap-9">
          {esLugar && (
            <PreciosForm
              initialTiers={(tiersRes.data ?? []) as PrecioTier[]}
              initialServicios={(serviciosRes.data ?? []) as ServicioAdicional[]}
              initialTarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
              initialDepositoReserva={rancho.deposito_reserva}
              onGuardar={guardarPreciosPropio.bind(null, rancho.id)}
            />
          )}

          {esLugar && (
            <div>
              <h2 className="mb-1 text-lg font-bold text-aventurea-ink">
                Cuentas para recibir el depósito
              </h2>
              <p className="mb-4 text-[13px] text-aventurea-ink-soft">
                El cliente ve esto en el segundo paso de la reserva, según el método de pago que
                elija.
              </p>
              <CuentasPagoForm
                initial={{
                  sinpeNumero: rancho.sinpe_numero ?? "",
                  sinpeTitular: rancho.sinpe_titular ?? "",
                  cuentaBanco: rancho.cuenta_banco ?? "",
                  cuentaNumero: rancho.cuenta_numero ?? "",
                  cuentaTitular: rancho.cuenta_titular ?? "",
                  cuentaTipo: rancho.cuenta_tipo ?? "",
                }}
                onGuardar={guardarCuentasPagoPropio.bind(null, rancho.id)}
              />
            </div>
          )}

          {esLugar && (
            <div>
              <h2 className="mb-1 text-lg font-bold text-aventurea-ink">Horarios de alquiler</h2>
              <p className="mb-4 text-[13px] text-aventurea-ink-soft">
                Vos definís en qué bloques alquilás y a qué hora entra y sale el cliente. Es lo
                que va a poder elegir al reservar.
              </p>
              <HorariosForm
                initialHorarios={rancho.horarios_bloques ?? []}
                onGuardar={guardarHorariosPropio.bind(null, rancho.id)}
              />
            </div>
          )}

          <div>
            <h2 className="mb-1 text-lg font-bold text-aventurea-ink">Descuentos y promociones</h2>
            <p className="mb-4 text-[13px] text-aventurea-ink-soft">
              Atraé más clientes con cupones y descuentos automáticos por día.
            </p>
            <DescuentosForm
              initialCodigos={(codigosRes.data ?? []) as CodigoDescuento[]}
              initialPromociones={(promocionesRes.data ?? []) as PromocionDia[]}
              onGuardarCodigos={guardarCodigosPropio.bind(null, rancho.id)}
              onGuardarPromociones={guardarPromocionesPropio.bind(null, rancho.id)}
            />
          </div>

          <div>
            <h2 className="mb-1 text-lg font-bold text-aventurea-ink">Términos y monto mínimo</h2>
            <p className="mb-4 text-[13px] text-aventurea-ink-soft">
              Las condiciones que el cliente acepta antes de contratarte. Te dejamos unas por
              defecto y las podés cambiar por las tuyas.
            </p>
            <TerminosForm
              initialTerminos={rancho.terminos ?? []}
              initialMontoMinimo={rancho.monto_minimo}
              depositoReserva={rancho.deposito_reserva}
              esLugar={esLugar}
              onGuardar={guardarTerminosPropio.bind(null, rancho.id)}
            />
          </div>
        </div>
      ),
    },
    {
      id: "finanzas",
      label: "Finanzas",
      content: (
        <div>
          {errorFinanzas && (
            <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
              <strong>Faltan las migraciones.</strong> No se pudieron leer los datos económicos:{" "}
              {errorFinanzas.message}. Corré{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
                supabase/aplicar-migraciones-pendientes.sql
              </code>{" "}
              en el SQL Editor de Supabase y volvé a entrar.
            </div>
          )}
          <FinanzasPanel
            resumen={resumen}
            gastos={gastos}
            onMarcarDeposito={marcarDepositoRecibido.bind(null, rancho.id)}
            onRegistrarPago={registrarPagoFinal.bind(null, rancho.id)}
            onRevertirPago={revertirPagoFinal.bind(null, rancho.id)}
            onAgregarGasto={agregarGasto.bind(null, rancho.id)}
            onBorrarGasto={borrarGasto.bind(null, rancho.id)}
          />
        </div>
      ),
    },
  ];

  // Antes solo Lugares tenía esta pestaña, porque solo ellos reservaban
  // por calendario. Ahora el resto de categorías también recibe
  // solicitudes de cotización reales (ver "Solicitar cotización" en su
  // página pública), así que la pestaña aplica para todos — el
  // contenido de la tabla es el mismo, solo cambia la palabra.
  // El catálogo es el corazón de la reserva en línea de los servicios:
  // lo que el proveedor carga acá es lo que el cliente elige al armar
  // su pedido en la página pública. Lugares no lo necesita — ya tiene
  // su propio sistema de precios y servicios adicionales.
  if (!esLugar) {
    const etiquetaCatalogo = CATALOGO_LABEL[rancho.categoria];
    tabs.splice(1, 0, {
      id: "catalogo",
      label: etiquetaCatalogo,
      content: (
        <div>
          {itemsRes.error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
              <strong>Faltan las migraciones.</strong> No se pudo leer tu{" "}
              {etiquetaCatalogo.toLowerCase()}: {itemsRes.error.message}. Corré{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
                supabase/aplicar-migraciones-pendientes.sql
              </code>{" "}
              en el SQL Editor de Supabase y volvé a entrar.
            </div>
          ) : (
            <>
              <p className="mb-5 text-[13.5px] text-aventurea-ink-soft">
                Lo que cargués acá aparece en tu página pública, y el cliente lo
                elige al reservar una fecha — con cantidades y total estimado.
              </p>
              <CatalogoPanel
                ranchoId={rancho.id}
                initialItems={(itemsRes.data ?? []) as RanchoItem[]}
                etiqueta={etiquetaCatalogo}
              />
            </>
          )}
        </div>
      ),
    });
  }

  tabs.splice(1, 0, {
    id: "reservas",
    label: esLugar ? "Reservas" : "Solicitudes",
    content: (
      <div>
        <p className="mb-5 text-[13.5px] text-aventurea-ink-soft">
          {pendientes} en aprobación · {reservas.length} en total.
        </p>
        {reservas.length === 0 && (
          <p className="mb-5 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
            {esLugar
              ? "Todavía no tenés reservas."
              : "Todavía no te llegó ninguna solicitud de cotización — aparecen acá apenas alguien te escriba desde tu página pública."}
          </p>
        )}
        <ReservasTable initialReservas={reservas} mostrarMensajes />
      </div>
    ),
  });

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-12">
      <Link
        href="/mi-rancho"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Todas tus publicaciones
      </Link>

      <div className="mt-4 overflow-hidden rounded-[18px] border border-aventurea-line bg-aventurea-surface">
        <div
          className="relative flex h-[130px] items-center justify-center bg-cover bg-center"
          style={
            rancho.foto_url
              ? { backgroundImage: `url(${rancho.foto_url})` }
              : { backgroundImage: CATEGORIA_GRADIENTE[rancho.categoria] }
          }
        >
          {!rancho.foto_url && (
            <span className="opacity-30 [&_svg]:h-12 [&_svg]:w-12">
              {CATEGORIA_ICONO[rancho.categoria]}
            </span>
          )}
          <span
            className={`absolute right-4 top-4 inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-bold ${ESTADO_BADGE[rancho.estado]}`}
          >
            {ESTADO_LABEL[rancho.estado]}
          </span>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-aventurea-ink">{rancho.nombre}</h1>
              <span className="text-[12px] font-bold uppercase tracking-wide text-aventurea-navy">
                {CATEGORIA_LABEL[rancho.categoria]}
              </span>
              {ubicacion && <p className="mt-1 text-[12.5px] text-zinc-500">{ubicacion}</p>}
            </div>
            {rancho.estado === "aprobado" && (
              <Link
                href={rancho.slug ? `/${rancho.slug}` : `/ranchos-eventos/${rancho.id}`}
                className="shrink-0 rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy"
              >
                Ver mi página pública →
              </Link>
            )}
          </div>

          {rancho.estado === "pendiente" && (
            <p className="mt-3 rounded-[10px] bg-aventurea-orange/10 p-3 text-[13px] leading-relaxed text-aventurea-orange">
              Bookear CR está revisando tu publicación. Te avisamos apenas quede publicada en el
              directorio.
            </p>
          )}
          {rancho.estado === "rechazado" && (
            <p className="mt-3 rounded-[10px] bg-red-50 p-3 text-[13px] leading-relaxed text-red-700">
              Tu publicación no fue aprobada todavía. Escribinos si querés más información.
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-aventurea-cream-2 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Provincia
              </div>
              <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
                {rancho.provincia ?? "—"}
              </div>
            </div>
            <div className="rounded-xl bg-aventurea-cream-2 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Capacidad
              </div>
              <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
                {rancho.capacidad_min ?? "—"}–{rancho.capacidad_max ?? "—"}
              </div>
            </div>
            <div className="rounded-xl bg-aventurea-cream-2 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Precio desde
              </div>
              <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
                {fmtColones(rancho.precio_desde)}
              </div>
            </div>
            <div className="rounded-xl bg-aventurea-cream-2 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                WhatsApp
              </div>
              <div className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
                {rancho.contacto_whatsapp ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-[15px] font-bold text-aventurea-ink">Cómo te está yendo</h2>
        <DashboardMetricas metricas={metricas} esLugar={esLugar} />
      </div>

      <div className="mt-8">
        <Tabs tabs={tabs} defaultTab="editar" />
      </div>
    </main>
  );
}
