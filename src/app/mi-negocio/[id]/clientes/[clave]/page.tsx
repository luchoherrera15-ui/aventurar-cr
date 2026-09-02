import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtFechaCorta, hoyISOCR } from "@/lib/fechas";
import { fmtColones } from "@/lib/finanzas";
import { agruparClientes, type ReservaCliente } from "@/lib/crm-citas";
import {
  corteVip,
  NOMBRE_SEGMENTO,
  ritmoDeVisitaDias,
  segmentoDe,
} from "@/lib/crm-segmentos";
import { claveDeUrl } from "@/lib/crm-clave-url";
import { IconChevronLeft } from "@/components/icons";
import { Card, CardVacia, Metrica, PildoraEstado } from "@/components/panel/piezas";
import { DETALLE, GAP_TABLERO, RADIO_PILDORA, type EstadoPanel } from "@/components/panel/sistema";
import FichaNotas from "./ficha-notas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA FICHA 360° DEL CLIENTE — /mi-negocio/[id]/clientes/[clave]
 * ════════════════════════════════════════════════════════════════════
 *
 * El corazón de la transformación CRM (1 sep 2026). Antes, entender a
 * un cliente obligaba a cruzar tres pantallas de memoria: la agenda
 * para ver si viene, la tabla de clientes para el gasto, y el panel de
 * lealtad para los sellos. Esta ficha junta TODO en una vista:
 *
 *   quién es · cuánto ha venido y gastado · a qué ritmo · qué tiene
 *   reservado · su tarjeta de lealtad · el historial completo · y lo
 *   que el negocio sabe de él (notas y etiquetas, 0228).
 *
 * ------------------------------------------------------------------
 * EL PUENTE CON LEALTAD ES DE SOLO LECTURA, Y ES A PROPÓSITO
 * ------------------------------------------------------------------
 * La identidad de lealtad (personas, 0138) tiene dueño y reglas
 * propias, y los usuarios existentes NO SE TOCAN. Acá no se crea, no
 * se fusiona y no se escribe nada de lealtad: se CRUZA el contacto del
 * cliente contra `personas_negocio` DE ESTE negocio y, si hay vínculo,
 * se muestran su tarjeta y su saldo. Dos sistemas, una vista — sin
 * duplicar a nadie.
 */

/** Los últimos N renglones del historial que se pintan. */
const TOPE_HISTORIAL = 40;

const ESTADO_RESERVA: Record<string, { texto: string; tono: EstadoPanel }> = {
  cumplida: { texto: "Cumplida", tono: "exito" },
  confirmada: { texto: "Confirmada", tono: "info" },
  pendiente: { texto: "Pendiente", tono: "aviso" },
  no_asistio: { texto: "No llegó", tono: "alerta" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
  rechazada: { texto: "Rechazada", tono: "neutro" },
};

function normalizarTel(tel: string | null): string | null {
  const digitos = (tel ?? "").replace(/\D/g, "");
  return digitos.length >= 8 ? digitos.slice(-8) : null;
}

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string; clave: string }>;
}) {
  const { id, clave: claveParam } = await params;
  const clave = claveDeUrl(claveParam);
  if (!clave) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

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

  // ── La cartera entera, para encontrar a ESTE ─────────────────────
  // Se deriva igual que la lista (misma consulta, mismo agrupador): la
  // ficha no puede contar una historia distinta de la que cuenta la
  // tabla de la que se llegó.
  const [{ data: reservas }, { data: ficha }] = await Promise.all([
    admin
      .from("reservas")
      .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
      .eq("rancho_id", id)
      .order("fecha", { ascending: false })
      .limit(4000),
    admin
      .from("fichas_cliente")
      .select("notas, etiquetas")
      .eq("rancho_id", id)
      .eq("clave", clave)
      .maybeSingle(),
  ]);

  const cartera = agruparClientes((reservas ?? []) as ReservaCliente[], hoy);
  const cliente = cartera.find((c) => c.clave === clave);
  if (!cliente) notFound();

  const segmento = segmentoDe(cliente, hoy, corteVip(cartera));
  const ritmo = ritmoDeVisitaDias(cliente);

  // ── El puente con lealtad: SOLO LECTURA ──────────────────────────
  // El vínculo se busca por el contacto del cliente contra las
  // personas DE ESTE negocio. Si no hay, la sección lo dice y ya.
  const tel = normalizarTel(cliente.whatsapp);
  let lealtad: { saldo: number; tarjeta: string; estado: string } | null = null;
  if (cliente.correo || tel) {
    const { data: vinculos } = await admin
      .from("personas_negocio")
      .select("persona_id, correo_declarado, telefono_declarado, personas(correo, telefono)")
      .eq("rancho_id", id)
      .limit(200);

    const vinculo = (vinculos ?? []).find((v) => {
      // El join de PostgREST tipa como arreglo aunque sea 1:1.
      const p = (Array.isArray(v.personas) ? v.personas[0] : v.personas) as {
        correo: string | null;
        telefono: string | null;
      } | null;
      const correos = [v.correo_declarado, p?.correo].filter(Boolean) as string[];
      const tels = [v.telefono_declarado, p?.telefono]
        .map((t) => normalizarTel(t as string | null))
        .filter(Boolean) as string[];
      return (
        (cliente.correo !== null && correos.some((c) => c.toLowerCase() === cliente.correo)) ||
        (tel !== null && tels.includes(tel))
      );
    });

    if (vinculo) {
      const { data: miembro } = await admin
        .from("miembros")
        .select("id, estado, programa_lealtad!inner(rancho_id, nombre)")
        .eq("persona_id", vinculo.persona_id as string)
        .eq("programa_lealtad.rancho_id", id)
        .limit(1)
        .maybeSingle();
      if (miembro) {
        const { data: movs } = await admin
          .from("transacciones_puntos")
          .select("puntos")
          .eq("miembro_id", miembro.id as string);
        lealtad = {
          saldo: (movs ?? []).reduce((s, m) => s + Number(m.puntos ?? 0), 0),
          tarjeta:
            ((miembro.programa_lealtad as unknown as { nombre: string | null })?.nombre ??
              "Programa de lealtad") || "Programa de lealtad",
          estado: (miembro.estado as string) ?? "activo",
        };
      }
    }
  }

  // El historial: las reservas de ESTE cliente, más reciente primero.
  const historial = (reservas ?? [])
    .filter((r) => cliente.citaIds.includes(r.id as string))
    .slice(0, TOPE_HISTORIAL);

  const telWhatsapp = (cliente.whatsapp ?? "").replace(/\D/g, "");

  return (
    <main className="min-h-svh bg-aventurea-cream-2 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1080px]">
        <Link
          href={`/mi-negocio/${id}/clientes`}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-aventurea-ink-soft hover:underline"
        >
          <IconChevronLeft className="h-4 w-4" /> Clientes
        </Link>

        {/* ── QUIÉN ES ───────────────────────────────────────────── */}
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-extrabold text-aventurea-navy">
              {cliente.nombre ?? cliente.correo ?? cliente.whatsapp ?? "Sin nombre"}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-aventurea-ink-soft">
              <span
                className={`${RADIO_PILDORA} bg-aventurea-navy/10 px-2 py-0.5 text-[11.5px] font-bold text-aventurea-navy`}
              >
                {NOMBRE_SEGMENTO[segmento]}
              </span>
              {cliente.correo && <span>{cliente.correo}</span>}
              {cliente.whatsapp && <span>{cliente.whatsapp}</span>}
              {cliente.primeraVisita && (
                <span>cliente desde {fmtFechaCorta(cliente.primeraVisita)}</span>
              )}
            </p>
          </div>

          {/* Las dos acciones que se hacen con un cliente enfrente:
              hablarle y agendarle. */}
          <div className="flex flex-wrap gap-2">
            {telWhatsapp.length >= 8 && (
              <a
                href={`https://wa.me/${telWhatsapp.length === 8 ? "506" + telWhatsapp : telWhatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-extrabold text-white"
              >
                WhatsApp
              </a>
            )}
            {cliente.correo && (
              <a
                href={`mailto:${cliente.correo}`}
                className="rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[13px] font-bold text-aventurea-ink"
              >
                Correo
              </a>
            )}
            <Link
              href={`/mi-negocio/${id}/citas`}
              className="rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[13px] font-bold text-aventurea-ink"
            >
              Agendarle
            </Link>
          </div>
        </div>

        {/* ── LOS NÚMEROS ────────────────────────────────────────── */}
        <div className={`mt-5 grid grid-cols-2 ${GAP_TABLERO} lg:grid-cols-4`}>
          <Metrica rotulo="Visitas cumplidas" valor={String(cliente.cumplidas)} />
          <Metrica
            rotulo="Gasto acumulado"
            valor={cliente.gastoTotal > 0 ? fmtColones(cliente.gastoTotal) : "—"}
          />
          <Metrica
            rotulo="Viene cada"
            valor={ritmo !== null ? `${ritmo} días` : "—"}
          />
          <Metrica
            rotulo="No llegó"
            valor={`${cliente.noAsistio} ${cliente.noAsistio === 1 ? "vez" : "veces"}`}
          />
        </div>

        <div className={`mt-4 grid ${GAP_TABLERO} lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]`}>
          {/* ── EL HISTORIAL ─────────────────────────────────────── */}
          <Card titulo="Historial">
            {historial.length === 0 ? (
              <CardVacia>Sin reservas todavía.</CardVacia>
            ) : (
              <ul className="divide-y divide-aventurea-line/70">
                {historial.map((r) => {
                  const estado =
                    ESTADO_RESERVA[r.estado as string] ?? {
                      texto: r.estado as string,
                      tono: "neutro" as EstadoPanel,
                    };
                  return (
                    <li key={r.id as string} className="flex items-center gap-3 py-2.5">
                      <span className="w-[92px] shrink-0 text-[12.5px] font-bold tabular-nums text-aventurea-ink">
                        {fmtFechaCorta(r.fecha as string)}
                      </span>
                      <span className="w-[52px] shrink-0 text-[12px] tabular-nums text-aventurea-ink-soft">
                        {(r.hora_inicio as string | null)?.slice(0, 5) ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <PildoraEstado estado={estado.tono} colapsa>
                          {estado.texto}
                        </PildoraEstado>
                      </span>
                      <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-aventurea-ink">
                        {Number(r.monto_total ?? 0) > 0 ? fmtColones(Number(r.monto_total)) : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {cliente.totalCitas > TOPE_HISTORIAL && (
              <p className={`mt-2 ${DETALLE}`}>
                Se muestran las últimas {TOPE_HISTORIAL} de {cliente.totalCitas}.
              </p>
            )}
          </Card>

          <div className={`flex flex-col ${GAP_TABLERO}`}>
            {/* ── PRÓXIMA CITA ───────────────────────────────────── */}
            <Card titulo="Próxima cita">
              {cliente.proximaCita ? (
                <p className="text-[15px] font-extrabold text-aventurea-green">
                  {fmtFechaCorta(cliente.proximaCita)}
                </p>
              ) : (
                <p className={DETALLE}>
                  Nada agendado.
                  {segmento === "en_riesgo" || segmento === "inactivo"
                    ? " Este es exactamente el cliente al que vale la pena escribirle."
                    : ""}
                </p>
              )}
            </Card>

            {/* ── LEALTAD (solo lectura) ─────────────────────────── */}
            <Card titulo="Lealtad">
              {lealtad ? (
                <div>
                  <p className="text-[13px] font-bold text-aventurea-ink">{lealtad.tarjeta}</p>
                  <p className="mt-1 text-[22px] font-extrabold tabular-nums text-aventurea-navy">
                    {lealtad.saldo}
                    <span className="ml-1 text-[12px] font-bold text-aventurea-ink-soft">
                      {lealtad.saldo === 1 ? "sello/punto" : "sellos/puntos"}
                    </span>
                  </p>
                  <p className={`mt-1 ${DETALLE}`}>
                    Su tarjeta vive en el módulo de Lealtad; acá solo se mira.
                  </p>
                </div>
              ) : (
                <p className={DETALLE}>
                  No tiene tarjeta de lealtad con tu negocio (se cruza por correo y
                  WhatsApp).
                </p>
              )}
            </Card>

            {/* ── NOTAS Y ETIQUETAS (0228) ───────────────────────── */}
            <FichaNotas
              negocioId={id}
              clave={clave}
              notasIniciales={(ficha?.notas as string | undefined) ?? ""}
              etiquetasIniciales={((ficha?.etiquetas as string[] | undefined) ?? []).slice()}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
