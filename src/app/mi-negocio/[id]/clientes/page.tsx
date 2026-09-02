import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import { agruparClientes, type ReservaCliente } from "@/lib/crm-citas";
import { conteoPorSegmento, segmentarCartera } from "@/lib/crm-segmentos";
import { IconChevronLeft } from "@/components/icons";
import CarteraClientes, { type FilaCartera } from "./cartera-clientes";
import { claveAUrl } from "@/lib/crm-clave-url";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /mi-negocio/[id]/clientes — EL MÓDULO DE CLIENTES DEL CRM
 * ════════════════════════════════════════════════════════════════════
 *
 * Parte de la transformación CRM (1 sep 2026). Hasta hoy «Clientes»
 * era un ancla dentro de la página de Citas (`/citas#clientes`): una
 * tabla con tres filtros, sin ficha individual, sin notas y sin
 * relación con lealtad. Un negocio no puede operar su cartera desde un
 * ancla.
 *
 * Esta página es el módulo de verdad:
 *
 *   · la cartera entera, SEGMENTADA (en riesgo, inactivos, VIP,
 *     frecuentes, nuevos) — la lógica vive en `crm-segmentos.ts`,
 *     pura y con tests;
 *   · buscador por nombre y contacto;
 *   · cada fila abre la FICHA 360° (`./[clave]`), que es donde vive
 *     el resto de la historia.
 *
 * ------------------------------------------------------------------
 * LA CARTERA SE SIGUE DERIVANDO (decisión D-3)
 * ------------------------------------------------------------------
 * No hay tabla de clientes: la ficha sale de las reservas con
 * `agruparClientes()`, igual que siempre. Lo único guardado es lo que
 * no se puede derivar — notas y etiquetas (`fichas_cliente`, 0228).
 *
 * A diferencia del ancla vieja, acá entran TODAS las reservas, con
 * hora y sin hora: el cliente de un evento también es un cliente. Para
 * un negocio de eventos esta pantalla es la primera vez que su cartera
 * existe como algo mirable.
 */

export default async function ClientesPage({
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

  // Mismo patrón de acceso que el resto del panel: la lectura va con la
  // llave de servicio y el control real es el chequeo de owner/admin.
  const admin = createAdminClient() ?? supabase;
  const { data: rancho } = await admin
    .from("ranchos")
    .select("id, nombre, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  if (rancho.owner_id !== user.id && perfil?.rol !== "admin") notFound();

  const hoy = hoyISOCR();

  // ── La materia prima: TODAS las reservas del negocio ──────────────
  // Sin el filtro de `hora_inicio` que usa la página de Citas: el
  // cliente de un evento (reserva sin hora) también es un cliente.
  const [{ data: reservas }, { data: fichas }] = await Promise.all([
    admin
      .from("reservas")
      .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
      .eq("rancho_id", id)
      .order("fecha", { ascending: false })
      .limit(4000),
    admin.from("fichas_cliente").select("clave, etiquetas").eq("rancho_id", id),
  ]);

  const cartera = agruparClientes((reservas ?? []) as ReservaCliente[], hoy);
  const segmentados = segmentarCartera(cartera, hoy);
  const conteo = conteoPorSegmento(segmentados);
  const etiquetasPorClave = new Map(
    (fichas ?? []).map((f) => [f.clave as string, (f.etiquetas as string[]) ?? []]),
  );

  const filas: FilaCartera[] = segmentados.map(({ cliente, segmento }) => ({
    clave: cliente.clave,
    claveUrl: claveAUrl(cliente.clave),
    nombre: cliente.nombre,
    correo: cliente.correo,
    whatsapp: cliente.whatsapp,
    segmento,
    cumplidas: cliente.cumplidas,
    ultimaVisita: cliente.ultimaVisita,
    proximaCita: cliente.proximaCita,
    gastoTotal: cliente.gastoTotal,
    diasSinVenir: cliente.diasSinVenir,
    etiquetas: etiquetasPorClave.get(cliente.clave) ?? [],
  }));

  return (
    <main className="min-h-svh bg-aventurea-cream-2 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1080px]">
        <Link
          href={`/mi-negocio/${id}`}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-aventurea-ink-soft hover:underline"
        >
          <IconChevronLeft className="h-4 w-4" /> {rancho.nombre as string}
        </Link>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold text-aventurea-navy">Clientes</h1>
            <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Tu cartera completa, derivada de las reservas. Tocá un cliente para ver su
              ficha entera: historial, gasto, lealtad y tus notas.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <CarteraClientes negocioId={id} filas={filas} conteo={conteo} />
        </div>
      </div>
    </main>
  );
}
