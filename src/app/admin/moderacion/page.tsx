import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioActual } from "@/lib/auth";
import { cerrarSesionPublica } from "@/components/sesion-publica-actions";
import {
  comisionMensualUSD,
  casilleroDePlan,
  CONTEO_VACIO,
  type ConteoPlanes,
} from "@/lib/lealtad/comision-moderador";

/**
 * ════════════════════════════════════════════════════════════════════
 *  PANEL DEL MODERADOR (vendedor de referidos) — /admin/moderacion
 * ════════════════════════════════════════════════════════════════════
 *
 * El moderador es un usuario registrado al que un admin le dio el rol.
 * Entra por /admin con su cuenta; el proxy lo trae SOLO acá.
 *
 * Cuánto gana: comisión RECURRENTE por mes, según el PAQUETE de cada
 * negocio activo que trajo (regla en lib/lealtad/comision-moderador):
 * Starter en grupos de 3 ($1 suelto / $6 en trío), Impulso $10 c/u. En
 * dólares. El plan de cada negocio sale de `ranchos.plan_lealtad`.
 *
 * Se lee con el service role (agentes_lealtad tiene RLS sin políticas,
 * 0219), pero acotado al usuario logueado: cada quien ve solo lo suyo.
 */

export const metadata: Metadata = {
  title: "Panel de moderación",
  robots: { index: false, follow: false },
};

const dolares = (n: number) => "$" + n.toLocaleString("es-CR");

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function anioMesCR(iso: string): { y: number; m: number } {
  const d = new Date(new Date(iso).getTime() - 6 * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}
const claveMes = (y: number, m: number) => y * 12 + m;

const ETIQUETA_PLAN: Record<keyof ConteoPlanes, string> = {
  arranque: "Starter",
  impulso: "Impulso",
  ilimitado: "Ilimitado",
  prueba: "Prueba (gratis)",
  otros: "Otros",
};

export default async function PanelModeracionPage() {
  const admin = createAdminClient();
  const user = await usuarioActual();

  if (!admin) {
    return <Marco><p className="text-[15px] font-bold text-red-600">Falta configurar SUPABASE_SERVICE_ROLE_KEY.</p></Marco>;
  }
  if (!user) {
    return <Marco><p className="text-[15px] font-bold text-aventurea-ink">Entrá con tu cuenta para ver tu panel.</p></Marco>;
  }

  const { data: agente } = await admin
    .from("agentes_lealtad")
    .select("id, nombre, codigo, activo")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!agente) {
    return (
      <Marco>
        <p className="text-[15px] font-bold text-aventurea-ink">Tu cuenta todavía no es moderador.</p>
        <p className="mt-2 text-[13.5px] text-aventurea-ink-soft">
          Pedile a un administrador de Bookea que te asigne el rol de moderador.
        </p>
      </Marco>
    );
  }

  // Negocios que trajo y ya fueron aprobados, con su plan actual.
  const { data: filas } = await admin
    .from("solicitudes_lealtad")
    .select("rancho_id, estado, atendida_en, created_at, ranchos(nombre, plan_lealtad)")
    .eq("agente_id", agente.id);

  type Fila = {
    rancho_id: string | null;
    estado: string;
    atendida_en: string | null;
    created_at: string;
    ranchos: { nombre: string | null; plan_lealtad: string | null } | null;
  };
  const aprobados = ((filas ?? []) as unknown as Fila[]).filter(
    (f) => f.estado === "atendida" && f.rancho_id,
  );

  // Conteo actual por plan + comisión de este mes.
  const conteoActual: ConteoPlanes = { ...CONTEO_VACIO };
  const negocios = aprobados.map((f) => {
    const casillero = casilleroDePlan(f.ranchos?.plan_lealtad);
    conteoActual[casillero] += 1;
    return {
      nombre: f.ranchos?.nombre ?? "Negocio",
      plan: casillero,
      inicio: anioMesCR(f.atendida_en ?? f.created_at),
      desde: f.atendida_en ?? f.created_at,
    };
  });
  const gananciaEsteMes = comisionMensualUSD(conteoActual);

  // Serie mensual (recurrente): para cada mes, se cuentan los negocios
  // activos hasta ese mes por plan y se aplica la regla. Nota: usa el
  // plan ACTUAL de cada negocio para todos los meses (sin historial de
  // cambios de plan) — suficiente para el tablero.
  const ahora = anioMesCR(new Date().toISOString());
  const claveAhora = claveMes(ahora.y, ahora.m);
  const primera = negocios.length
    ? Math.min(...negocios.map((n) => claveMes(n.inicio.y, n.inicio.m)))
    : claveAhora;

  const meses: { etiqueta: string; total: number; conteo: ConteoPlanes }[] = [];
  for (let k = primera; k <= claveAhora; k++) {
    const y = Math.floor(k / 12);
    const m = k % 12;
    const conteo: ConteoPlanes = { ...CONTEO_VACIO };
    for (const n of negocios) {
      if (claveMes(n.inicio.y, n.inicio.m) <= k) conteo[n.plan] += 1;
    }
    meses.push({ etiqueta: `${NOMBRE_MES[m]} ${y}`, total: comisionMensualUSD(conteo), conteo });
  }
  meses.reverse();
  const totalAcumulado = meses.reduce((s, x) => s + x.total, 0);

  return (
    <Marco>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--accion)]">
            Panel de moderación
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold text-aventurea-navy">{agente.nombre}</h1>
          {!agente.activo && (
            <p className="mt-1 text-[13px] font-bold text-red-600">
              Tu cuenta de moderador está pausada — hablá con Bookea.
            </p>
          )}
        </div>
        <form action={cerrarSesionPublica}>
          <button type="submit" className="rounded-full border border-aventurea-line px-4 py-2 text-[13px] font-bold text-aventurea-ink-soft transition hover:bg-aventurea-sky-light">
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Código de referido. */}
      <div className="mt-6 rounded-3xl bg-aventurea-navy p-6 text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/60">Tu código de referido</p>
        <p className="mt-1 text-[52px] font-extrabold tabular-nums leading-none tracking-[0.12em]">{agente.codigo}</p>
        <p className="mt-2 text-[13px] text-white/70">
          Cada negocio que se da de alta con este código en{" "}
          <span className="font-bold text-white">bookea.lat/lealtad/nuevo</span> queda a tu nombre.
        </p>
      </div>

      {/* Cifras. */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Cifra etiqueta="Negocios activos" valor={String(negocios.length)} />
        <Cifra etiqueta="Starter · Impulso" valor={`${conteoActual.arranque} · ${conteoActual.impulso}`} />
        <Cifra etiqueta="Ganás este mes" valor={dolares(gananciaEsteMes)} acento />
        <Cifra etiqueta="Total acumulado" valor={dolares(totalAcumulado)} />
      </div>

      {/* Cómo se calcula. */}
      <div className="mt-4 rounded-2xl border border-aventurea-line bg-aventurea-surface px-4 py-3 text-[12.5px] text-aventurea-ink-soft">
        <span className="font-bold text-aventurea-ink">Cómo se calcula:</span>{" "}
        Starter se paga en grupos de 3 — $1 cada uno suelto, y $6 cada uno al
        completar un trío. Impulso: $10 por negocio, por mes. Se cobra mientras
        el negocio siga activo.
      </div>

      {/* Tabla mensual. */}
      <div className="mt-8">
        <h2 className="text-[15px] font-extrabold text-aventurea-navy">Cuánto ganás por mes</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-aventurea-line">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-aventurea-sky-light text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
              <tr>
                <th className="px-4 py-2.5">Mes</th>
                <th className="px-4 py-2.5 text-right">Starter</th>
                <th className="px-4 py-2.5 text-right">Impulso</th>
                <th className="px-4 py-2.5 text-right">Ganado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aventurea-line">
              {meses.map((m) => (
                <tr key={m.etiqueta} className="bg-white">
                  <td className="px-4 py-2.5 font-semibold capitalize text-aventurea-ink">{m.etiqueta}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-aventurea-ink">{m.conteo.arranque}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-aventurea-ink">{m.conteo.impulso}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-aventurea-navy">{dolares(m.total)}</td>
                </tr>
              ))}
              {meses.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-aventurea-ink-soft">Todavía no inscribiste negocios con tu código.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de negocios. */}
      {negocios.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[15px] font-extrabold text-aventurea-navy">Tus negocios</h2>
          <div className="mt-3 flex flex-col gap-2">
            {negocios.map((n, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-aventurea-line bg-white px-4 py-2.5">
                <span className="font-bold text-aventurea-ink">{n.nombre}</span>
                <span className="flex items-center gap-3 text-[12px] text-aventurea-ink-soft">
                  <span className="rounded-md bg-aventurea-sky-light px-2 py-0.5 font-bold text-aventurea-navy">
                    {ETIQUETA_PLAN[n.plan]}
                  </span>
                  desde {new Date(n.desde).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-aventurea-surface px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[820px] rounded-3xl border border-aventurea-line bg-white p-6 shadow-[0_30px_80px_-40px_rgba(16,38,88,0.3)] sm:p-9">
        {children}
      </div>
    </main>
  );
}

function Cifra({ etiqueta, valor, acento = false }: { etiqueta: string; valor: string; acento?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${acento ? "border-transparent bg-aventurea-navy text-white" : "border-aventurea-line bg-aventurea-surface"}`}>
      <p className={`text-[10.5px] font-bold uppercase tracking-wide ${acento ? "text-white/60" : "text-aventurea-ink-soft"}`}>{etiqueta}</p>
      <p className={`mt-1 text-[22px] font-extrabold tabular-nums ${acento ? "text-white" : "text-aventurea-navy"}`}>{valor}</p>
    </div>
  );
}
