import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioActual } from "@/lib/auth";
import { cerrarSesionPublica } from "@/components/sesion-publica-actions";

/**
 * ════════════════════════════════════════════════════════════════════
 *  PANEL DEL MODERADOR (vendedor de referidos) — /admin/moderacion
 * ════════════════════════════════════════════════════════════════════
 *
 * El moderador es un usuario normal al que un admin le dio el rol
 * `moderador` (ver /admin/moderadores). Entra por /admin con su cuenta;
 * el proxy lo trae SOLO acá. Esta pantalla NO vive bajo el route group
 * (dashboard), así que no hereda el riel del admin: es un panel propio,
 * solo de moderación.
 *
 * Qué muestra: su código de 4 dígitos (el que reparte), cuántos negocios
 * inscribió, cuántos siguen activos, y cuánto gana POR MES — comisión
 * RECURRENTE: por cada negocio activo que trajo, gana su comisión cada
 * mes que ese negocio siga activo. La tabla mensual acumula eso.
 *
 * Todo se lee con el service role (agentes_lealtad tiene RLS sin
 * políticas, 0219), PERO acotado por el usuario logueado: un moderador
 * solo ve SU fila y SUS negocios.
 */

export const metadata: Metadata = {
  title: "Panel de moderación",
  robots: { index: false, follow: false },
};

const colones = (n: number) =>
  "₡" + Math.round(n).toLocaleString("es-CR");

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** El año-mes (en hora de Costa Rica, UTC-6) de una fecha ISO. */
function anioMesCR(iso: string): { y: number; m: number } {
  const d = new Date(new Date(iso).getTime() - 6 * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}
function claveMes(y: number, m: number) {
  return y * 12 + m;
}

export default async function PanelModeracionPage() {
  const admin = createAdminClient();
  const user = await usuarioActual();

  if (!admin) {
    return (
      <Marco>
        <p className="text-[15px] font-bold text-red-600">
          Falta configurar SUPABASE_SERVICE_ROLE_KEY.
        </p>
      </Marco>
    );
  }
  if (!user) {
    return (
      <Marco>
        <p className="text-[15px] font-bold text-aventurea-ink">
          Entrá con tu cuenta para ver tu panel.
        </p>
      </Marco>
    );
  }

  // El agente (moderador) de ESTE usuario.
  const { data: agente } = await admin
    .from("agentes_lealtad")
    .select("id, nombre, codigo, activo, comision_mensual")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!agente) {
    return (
      <Marco>
        <p className="text-[15px] font-bold text-aventurea-ink">
          Tu cuenta todavía no es moderador.
        </p>
        <p className="mt-2 text-[13.5px] text-aventurea-ink-soft">
          Pedile a un administrador de Bookea que te asigne el rol de
          moderador para ver tus negocios y comisiones.
        </p>
      </Marco>
    );
  }

  const comision = Number(agente.comision_mensual) || 0;

  // Los negocios que trajo y ya fueron aprobados (estado 'atendida').
  const { data: filas } = await admin
    .from("solicitudes_lealtad")
    .select("id, rancho_id, estado, atendida_en, created_at, ranchos(nombre, slug)")
    .eq("agente_id", agente.id);

  type Fila = {
    rancho_id: string | null;
    estado: string;
    atendida_en: string | null;
    created_at: string;
    ranchos: { nombre: string | null; slug: string | null } | null;
  };
  const todas = (filas ?? []) as unknown as Fila[];
  const aprobados = todas.filter((f) => f.estado === "atendida" && f.rancho_id);
  const activos = aprobados.length; // sin churn tracking: aprobado = activo

  // Serie mensual: cada negocio suma su comisión desde el mes en que se
  // aprobó, y sigue sumando cada mes (recurrente). Para el mes M:
  // activos(M) = negocios aprobados en un mes <= M.
  const inicioDe = aprobados.map((f) =>
    anioMesCR(f.atendida_en ?? f.created_at),
  );
  const ahora = anioMesCR(new Date().toISOString());
  const claveAhora = claveMes(ahora.y, ahora.m);
  const primera = inicioDe.length
    ? Math.min(...inicioDe.map((x) => claveMes(x.y, x.m)))
    : claveAhora;

  const meses: { etiqueta: string; activos: number; ganado: number }[] = [];
  for (let k = primera; k <= claveAhora; k++) {
    const y = Math.floor(k / 12);
    const m = k % 12;
    const cuantos = inicioDe.filter((x) => claveMes(x.y, x.m) <= k).length;
    meses.push({
      etiqueta: `${NOMBRE_MES[m]} ${y}`,
      activos: cuantos,
      ganado: cuantos * comision,
    });
  }
  meses.reverse(); // el mes actual arriba

  const gananciaEsteMes = activos * comision;
  const totalAcumulado = meses.reduce((s, x) => s + x.ganado, 0);

  return (
    <Marco>
      {/* Encabezado: quién sos + tu código + salir. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--accion)]">
            Panel de moderación
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold text-aventurea-navy">
            {agente.nombre}
          </h1>
          {!agente.activo && (
            <p className="mt-1 text-[13px] font-bold text-red-600">
              Tu cuenta de moderador está pausada — hablá con Bookea.
            </p>
          )}
        </div>
        <form action={cerrarSesionPublica}>
          <button
            type="submit"
            className="rounded-full border border-aventurea-line px-4 py-2 text-[13px] font-bold text-aventurea-ink-soft transition hover:bg-aventurea-sky-light"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Tu código de referido, grande. */}
      <div className="mt-6 rounded-3xl bg-aventurea-navy p-6 text-white">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/60">
          Tu código de referido
        </p>
        <p className="mt-1 text-[52px] font-extrabold tabular-nums leading-none tracking-[0.12em]">
          {agente.codigo}
        </p>
        <p className="mt-2 text-[13px] text-white/70">
          Cada negocio que se da de alta con este código en{" "}
          <span className="font-bold text-white">bookea.lat/lealtad/nuevo</span>{" "}
          queda a tu nombre.
        </p>
      </div>

      {/* Cifras. */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Cifra etiqueta="Negocios inscritos" valor={String(activos)} />
        <Cifra etiqueta="Comisión por negocio / mes" valor={colones(comision)} />
        <Cifra etiqueta="Ganás este mes" valor={colones(gananciaEsteMes)} acento />
        <Cifra etiqueta="Total acumulado" valor={colones(totalAcumulado)} />
      </div>

      {/* Tabla mensual. */}
      <div className="mt-8">
        <h2 className="text-[15px] font-extrabold text-aventurea-navy">
          Cuánto ganás por mes
        </h2>
        <p className="mt-1 text-[13px] text-aventurea-ink-soft">
          Por cada negocio activo que trajiste, tu comisión se cuenta cada mes
          que ese negocio siga activo.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-aventurea-line">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-aventurea-sky-light text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
              <tr>
                <th className="px-4 py-2.5">Mes</th>
                <th className="px-4 py-2.5 text-right">Negocios activos</th>
                <th className="px-4 py-2.5 text-right">Ganado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aventurea-line">
              {meses.map((m) => (
                <tr key={m.etiqueta} className="bg-white">
                  <td className="px-4 py-2.5 font-semibold capitalize text-aventurea-ink">
                    {m.etiqueta}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-aventurea-ink">
                    {m.activos}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-aventurea-navy">
                    {colones(m.ganado)}
                  </td>
                </tr>
              ))}
              {meses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-aventurea-ink-soft">
                    Todavía no inscribiste negocios con tu código.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de negocios. */}
      {aprobados.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[15px] font-extrabold text-aventurea-navy">
            Tus negocios
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {aprobados.map((f, i) => (
              <div
                key={f.rancho_id ?? i}
                className="flex items-center justify-between rounded-xl border border-aventurea-line bg-white px-4 py-2.5"
              >
                <span className="font-bold text-aventurea-ink">
                  {f.ranchos?.nombre ?? "Negocio"}
                </span>
                <span className="text-[12px] text-aventurea-ink-soft">
                  desde{" "}
                  {new Date(f.atendida_en ?? f.created_at).toLocaleDateString(
                    "es-CR",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
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

function Cifra({
  etiqueta,
  valor,
  acento = false,
}: {
  etiqueta: string;
  valor: string;
  acento?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        acento
          ? "border-transparent bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-surface"
      }`}
    >
      <p
        className={`text-[10.5px] font-bold uppercase tracking-wide ${
          acento ? "text-white/60" : "text-aventurea-ink-soft"
        }`}
      >
        {etiqueta}
      </p>
      <p
        className={`mt-1 text-[22px] font-extrabold tabular-nums ${
          acento ? "text-white" : "text-aventurea-navy"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
