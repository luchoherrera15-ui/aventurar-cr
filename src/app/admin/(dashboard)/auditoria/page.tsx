import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { aFecha, claveFecha, sumarDias } from "@/lib/finanzas";
import {
  esTablaCobrosInexistente,
  MIGRACION_LIBRO,
  type CobroPlataforma,
} from "@/lib/libro-cobros";
import type { CobroNegocio } from "@/lib/cobro-plataforma";
import {
  construirAuditoria,
  type ReservaAuditoria,
} from "@/lib/auditoria-dinero";
import { perteneceASeccion, SECCION_LABEL, type SeccionAdmin } from "../vertical";
import { seccionActiva } from "../vertical-server";
import AuditoriaPanel from "./auditoria-panel";

/**
 * AUDITORÍA — el recorrido del dinero, reserva por reserva.
 *
 * Es la vista del dueño de BOOKEA, no la del dueño de un local: junta en
 * una sola pantalla lo que hoy vive repartido entre `reservas` (el
 * adelanto y el saldo del negocio) y `cobros_plataforma` (la comisión
 * que Bookea le cobra al negocio), y busca los agujeros entre las dos.
 *
 * ── SEGURIDAD ────────────────────────────────────────────────────────
 * Tres puertas: proxy.ts corta /admin sin sesión admin, el layout de
 * (dashboard) vuelve a exigir `requireAdmin()`, y esta página lo pide
 * una tercera vez antes de leer nada. No es paranoia gratis: acá se
 * juntan la plata de todos los negocios y sus tarifas, que son datos
 * que ni los dueños de los locales ven.
 *
 * ── QUÉ NO SE MANDA AL NAVEGADOR ─────────────────────────────────────
 * La consulta trae la reserva entera (`select("*")`, que es lo único
 * que tolera una base sin todas las migraciones corridas) pero al panel
 * solo viaja lo que la auditoría necesita. Cédula, correo, WhatsApp, IP
 * y la ruta del comprobante en storage se quedan en el servidor: del
 * comprobante solo cruza un sí/no.
 */

/** Tope de reservas por consulta. Si se llena, la pantalla lo dice. */
const TOPE = 300;

const PERIODOS = [
  { key: "90", label: "Últimos 90 días", dias: 90 },
  { key: "365", label: "Últimos 12 meses", dias: 365 },
  { key: "todo", label: "Todo", dias: null },
] as const;

type ClavePeriodo = (typeof PERIODOS)[number]["key"];

function esPeriodo(v: string | undefined): v is ClavePeriodo {
  return v === "90" || v === "365" || v === "todo";
}

/** La reserva tal como sale de la base, con lo opcional marcado como tal. */
type ReservaCruda = {
  id: string;
  rancho_id: string | null;
  fecha: string;
  nombre: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  estado: string;
  monto_total: number | null;
  monto_cobrado_final: number | null;
  deposito_monto: number | null;
  deposito_validado: boolean | null;
  deposito_pagado_en: string | null;
  evento_pagado: boolean | null;
  saldo_pagado_en: string | null;
  metodo_pago: string | null;
  deposito_comprobante_url: string | null;
  created_at: string;
  /** 0097: puede faltar si la migración no corrió. */
  adelanto_devuelto?: boolean | null;
};

/** Trocea el `.in(...)`: 300 uuids en una sola URL la revientan. */
function enTandas<T>(items: T[], tamano: number): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) {
    tandas.push(items.slice(i, i + tamano));
  }
  return tandas;
}

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { ok } = await requireAdmin();
  if (!ok) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        No tenés permiso para ver esto.
      </p>
    );
  }

  const { periodo: periodoParam } = await searchParams;
  const periodo: ClavePeriodo = esPeriodo(periodoParam) ? periodoParam : "365";
  const dias = PERIODOS.find((p) => p.key === periodo)?.dias ?? null;

  const supabase = await createClient();
  const seccion = await seccionActiva();

  // "Hoy" en hora de Costa Rica: si el servidor corre en UTC, después de
  // las 6 p. m. de acá ya sería mañana y los "eventos que ya pasaron"
  // se correrían un día solos.
  const hoyIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const desdeIso = dias === null ? null : claveFecha(sumarDias(aFecha(hoyIso), -dias));

  // `select("*")`: nombrar las columnas rompería la pantalla entera en
  // una base donde falte una migración (adelanto_devuelto es de la
  // 0097). Nada de lo extra sale de este archivo.
  let consulta = supabase
    .from("reservas")
    .select("*")
    .neq("estado", "temporal")
    .order("fecha", { ascending: false })
    .limit(TOPE + 1);
  if (desdeIso) consulta = consulta.gte("fecha", desdeIso);

  const [reservasRes, ranchosRes, configRes] = await Promise.all([
    consulta,
    supabase.from("ranchos").select("id, nombre, vertical").order("nombre"),
    supabase
      .from("configuracion_plataforma")
      .select("comision_por_persona")
      .single(),
  ]);

  if (reservasRes.error) {
    return (
      <div>
        <Encabezado seccion={seccion} periodo={periodo} />
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las reservas: {reservasRes.error.message}
        </p>
      </div>
    );
  }

  const todosLosRanchos = (ranchosRes.data ?? []) as {
    id: string;
    nombre: string;
    vertical: string | null;
  }[];
  const verticalPorRancho = new Map(todosLosRanchos.map((r) => [r.id, r.vertical]));
  const nombrePorRancho: Record<string, string> = Object.fromEntries(
    todosLosRanchos.map((r) => [r.id, r.nombre]),
  );

  const crudas = (reservasRes.data ?? []) as ReservaCruda[];
  const recortadas = crudas.length > TOPE;
  const deLaSeccion = crudas
    .slice(0, TOPE)
    .filter((r) =>
      perteneceASeccion(r.rancho_id ? verticalPorRancho.get(r.rancho_id) : null, seccion),
    );

  // Acá se decide qué cruza al navegador: solo la plata y lo que la
  // identifica. Del comprobante, un booleano.
  const reservas: ReservaAuditoria[] = deLaSeccion.map((r) => ({
    id: r.id,
    rancho_id: r.rancho_id,
    fecha: r.fecha,
    nombre: r.nombre,
    tipo_evento: r.tipo_evento,
    invitados: r.invitados,
    estado: r.estado as ReservaAuditoria["estado"],
    monto_total: r.monto_total,
    monto_cobrado_final: r.monto_cobrado_final,
    deposito_monto: r.deposito_monto,
    deposito_validado: !!r.deposito_validado,
    deposito_pagado_en: r.deposito_pagado_en,
    evento_pagado: !!r.evento_pagado,
    saldo_pagado_en: r.saldo_pagado_en,
    adelanto_devuelto: !!r.adelanto_devuelto,
    metodo_pago: r.metodo_pago,
    tiene_comprobante: !!r.deposito_comprobante_url,
    created_at: r.created_at,
  }));

  // --- El libro de cobros de esas reservas, en tandas ---
  const ids = reservas.map((r) => r.id);
  const cobros: CobroPlataforma[] = [];
  let faltaLibro = false;
  let errorLibro: string | null = null;

  for (const tanda of enTandas(ids, 100)) {
    const { data, error } = await supabase
      .from("cobros_plataforma")
      .select(
        "id, reserva_id, rancho_id, concepto, personas, tarifa, modelo, monto, estado, semana, cliente, fecha_evento, devengado_en, pagado_en, notas",
      )
      .in("reserva_id", tanda);
    if (error) {
      if (esTablaCobrosInexistente(error)) faltaLibro = true;
      else errorLibro = error.message;
      break;
    }
    cobros.push(...((data ?? []) as CobroPlataforma[]));
  }

  // Sin libro no hay auditoría posible: TODAS las reservas parecerían
  // "sin cobro de plataforma". Mejor decir qué falta que llenar la
  // pantalla de hallazgos falsos.
  if (faltaLibro) {
    return (
      <div>
        <Encabezado seccion={seccion} periodo={periodo} />
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
            Falta correr una migración
          </p>
          <h2 className="mt-1 text-[17px] font-bold text-amber-900">
            Sin el libro de cobros no se puede auditar
          </h2>
          <p className="mt-2 max-w-[74ch] text-[13.5px] leading-relaxed text-amber-900">
            La mitad de esta pantalla compara lo que pasó en la reserva contra
            lo que quedó anotado en <code>cobros_plataforma</code>. Como esa
            tabla todavía no existe, cada reserva aparecería como «evento
            pasado sin cobro» — trescientos hallazgos falsos. Para que la
            auditoría tenga sentido hay que pegar antes este archivo en el SQL
            Editor de Supabase:
          </p>
          <p className="mt-3 overflow-x-auto rounded-lg bg-amber-100 px-3 py-2 font-mono text-[12.5px] text-amber-900">
            {MIGRACION_LIBRO}
          </p>
        </section>
      </div>
    );
  }

  // --- Tarifas propias por negocio (0098): RLS sin policies, service key ---
  let cobrosNegocio: CobroNegocio[] = [];
  let tarifasDesconocidas = true;
  const adminDb = createAdminClient();
  if (adminDb) {
    const { data, error } = await adminDb
      .from("cobro_negocio")
      .select("rancho_id, modelo, valor, notas");
    if (error) {
      console.error("[admin-auditoria] No se pudo leer cobro_negocio:", error.message);
    } else {
      cobrosNegocio = (data ?? []) as CobroNegocio[];
      tarifasDesconocidas = false;
    }
  }

  const filas = construirAuditoria({
    reservas,
    cobros,
    nombrePorRancho,
    cobrosNegocio,
    comisionGlobal: Number(configRes.data?.comision_por_persona ?? 0),
    hoyIso,
  });

  return (
    <div>
      <Encabezado seccion={seccion} periodo={periodo} />

      {errorLibro && (
        <p className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudo leer todo el libro de cobros ({errorLibro}), así que lo de
          abajo está incompleto: no lo tomes como bueno hasta resolverlo.
        </p>
      )}

      <AuditoriaPanel
        filas={filas}
        recortadas={recortadas}
        tope={TOPE}
        tarifasDesconocidas={tarifasDesconocidas}
      />
    </div>
  );
}

function Encabezado({
  seccion,
  periodo,
}: {
  seccion: SeccionAdmin;
  periodo: ClavePeriodo;
}) {
  return (
    <div className="mb-6">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Panel Admin · {SECCION_LABEL[seccion]}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        Auditoría del dinero
      </h1>
      <p className="mt-1 max-w-[80ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        El recorrido completo de cada reserva: cuándo nació, cuánto se pactó de
        adelanto, cuándo se comprobó el depósito, qué entró a la caja del
        negocio, qué falta cobrar, y qué comisión devengó y cobró Bookea. Los
        problemas van arriba; los totales son siempre la suma de las reservas
        que se están viendo.
      </p>

      <nav className="mt-4 flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/auditoria?periodo=${p.key}`}
            aria-current={periodo === p.key ? "page" : undefined}
            className={`rounded-lg border px-3.5 py-1.5 text-[12.5px] font-bold ${
              periodo === p.key
                ? "border-aventurea-navy bg-aventurea-navy text-white"
                : "border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-[12px] text-aventurea-ink-soft">
        El periodo filtra por <strong>fecha del evento</strong>, y la sección
        del header filtra por vertical del negocio.
      </p>
    </div>
  );
}
