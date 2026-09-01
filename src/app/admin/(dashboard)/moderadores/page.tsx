import { createAdminClient } from "@/lib/supabase/admin";
import PromoverModeradorForm from "./promover-moderador-form";
import { alternarActivo } from "./actions";
import {
  comisionMensualUSD,
  casilleroDePlan,
  dolares,
  CONTEO_VACIO,
  type ConteoPlanes,
} from "@/lib/lealtad/comision-moderador";

/**
 * /admin/moderadores — el admin da (y saca) el rol de moderador y ve el
 * rendimiento de cada uno. La comisión sale de la tarifa por paquete
 * (lib/lealtad/comision-moderador), no se fija a mano. La pantalla
 * del propio moderador es /admin/moderacion.
 */

export const metadata = { title: "Moderadores" };

export default async function ModeradoresAdminPage() {
  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-[900px]">
        <p className="text-[15px] font-bold text-red-600">
          Falta configurar SUPABASE_SERVICE_ROLE_KEY.
        </p>
      </div>
    );
  }

  const { data: agentes } = await admin
    .from("agentes_lealtad")
    .select("id, nombre, codigo, activo, usuario_id, created_at")
    .not("usuario_id", "is", null)
    .order("created_at", { ascending: false });

  const filas = agentes ?? [];
  const idsUsuario = filas.map((a) => a.usuario_id).filter(Boolean) as string[];
  const idsAgente = filas.map((a) => a.id) as string[];

  const [{ data: perfiles }, { data: solicitudes }] = await Promise.all([
    idsUsuario.length
      ? admin.from("perfiles").select("id, email").in("id", idsUsuario)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
    idsAgente.length
      ? admin
          .from("solicitudes_lealtad")
          .select("agente_id, estado, rancho_id, ranchos(plan_lealtad)")
          .in("agente_id", idsAgente)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const correoDe = new Map(
    (perfiles ?? []).map((p) => [p.id as string, (p.email as string | null) ?? ""]),
  );

  // Conteo por plan de los negocios aprobados de cada agente.
  type SolFila = {
    agente_id: string;
    estado: string;
    rancho_id: string | null;
    ranchos: { plan_lealtad: string | null } | null;
  };
  const conteoDe = new Map<string, ConteoPlanes>();
  for (const s of (solicitudes ?? []) as unknown as SolFila[]) {
    if (s.estado !== "atendida" || !s.rancho_id) continue;
    const c = conteoDe.get(s.agente_id) ?? { ...CONTEO_VACIO };
    c[casilleroDePlan(s.ranchos?.plan_lealtad)] += 1;
    conteoDe.set(s.agente_id, c);
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <h1 className="text-[24px] font-extrabold text-aventurea-navy">Moderadores</h1>
      <p className="mt-1 text-[14px] text-aventurea-ink-soft">
        Vendedores con código de referido. La comisión sale del paquete de cada
        negocio que traen: <strong>Starter</strong> en grupos de 3 ($1 suelto ·
        $6 en trío) e <strong>Impulso</strong> $10 c/u, por mes. Ellos ven su
        panel en <span className="font-bold">/admin/moderacion</span>.
      </p>

      <div className="mt-6">
        <PromoverModeradorForm />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <thead className="border-b border-aventurea-line text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
            <tr>
              <th className="px-3 py-2.5">Moderador</th>
              <th className="px-3 py-2.5">Código</th>
              <th className="px-3 py-2.5 text-right">Starter</th>
              <th className="px-3 py-2.5 text-right">Impulso</th>
              <th className="px-3 py-2.5 text-right">Gana/mes</th>
              <th className="px-3 py-2.5 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-aventurea-line">
            {filas.map((a) => {
              const conteo = conteoDe.get(a.id) ?? CONTEO_VACIO;
              const mensual = comisionMensualUSD(conteo);
              return (
                <tr key={a.id}>
                  <td className="px-3 py-3">
                    <p className="font-bold text-aventurea-ink">{a.nombre}</p>
                    <p className="text-[12px] text-aventurea-ink-soft">
                      {correoDe.get(a.usuario_id as string) || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-aventurea-sky-light px-2 py-1 font-extrabold tabular-nums tracking-widest text-aventurea-navy">
                      {a.codigo}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-aventurea-ink">{conteo.arranque}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-aventurea-ink">{conteo.impulso}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-aventurea-navy">{dolares(mensual)}</td>
                  <td className="px-3 py-3 text-right">
                    <form action={alternarActivo}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="activar" value={a.activo ? "0" : "1"} />
                      <button
                        type="submit"
                        className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${
                          a.activo
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                      >
                        {a.activo ? "Activo · pausar" : "Pausado · activar"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-aventurea-ink-soft">
                  Todavía no hay moderadores. Dale el rol a un usuario registrado arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
