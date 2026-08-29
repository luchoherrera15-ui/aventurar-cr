import { createAdminClient } from "@/lib/supabase/admin";
import PromoverModeradorForm from "./promover-moderador-form";
import { actualizarComision, alternarActivo } from "./actions";

/**
 * /admin/moderadores — el admin da (y saca) el rol de moderador y ve
 * el rendimiento de cada uno. El moderador es un usuario registrado;
 * acá se lo promueve, se le fija la comisión y se lo pausa. La pantalla
 * del propio moderador es /admin/moderacion.
 */

export const metadata = { title: "Moderadores" };

const colones = (n: number) => "₡" + Math.round(n).toLocaleString("es-CR");

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
    .select("id, nombre, codigo, activo, comision_mensual, usuario_id, created_at")
    .not("usuario_id", "is", null)
    .order("created_at", { ascending: false });

  const filas = agentes ?? [];

  // Correos (de perfiles) y conteo de negocios aprobados por agente.
  const idsUsuario = filas.map((a) => a.usuario_id).filter(Boolean) as string[];
  const idsAgente = filas.map((a) => a.id) as string[];

  const [{ data: perfiles }, { data: solicitudes }] = await Promise.all([
    idsUsuario.length
      ? admin.from("perfiles").select("id, email").in("id", idsUsuario)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
    idsAgente.length
      ? admin
          .from("solicitudes_lealtad")
          .select("agente_id, estado")
          .in("agente_id", idsAgente)
      : Promise.resolve({ data: [] as { agente_id: string; estado: string }[] }),
  ]);

  const correoDe = new Map(
    (perfiles ?? []).map((p) => [p.id as string, (p.email as string | null) ?? ""]),
  );
  const inscritosDe = new Map<string, number>();
  for (const s of (solicitudes ?? []) as { agente_id: string; estado: string }[]) {
    if (s.estado === "atendida") {
      inscritosDe.set(s.agente_id, (inscritosDe.get(s.agente_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <h1 className="text-[24px] font-extrabold text-aventurea-navy">Moderadores</h1>
      <p className="mt-1 text-[14px] text-aventurea-ink-soft">
        Vendedores con código de referido. Cada negocio que se da de alta con
        su código de 4 dígitos queda a su nombre; ellos ven su panel en{" "}
        <span className="font-bold">/admin/moderacion</span>.
      </p>

      <div className="mt-6">
        <PromoverModeradorForm />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead className="border-b border-aventurea-line text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
            <tr>
              <th className="px-3 py-2.5">Moderador</th>
              <th className="px-3 py-2.5">Código</th>
              <th className="px-3 py-2.5 text-right">Inscritos</th>
              <th className="px-3 py-2.5">Comisión ₡/mes</th>
              <th className="px-3 py-2.5 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-aventurea-line">
            {filas.map((a) => (
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
                <td className="px-3 py-3 text-right font-bold tabular-nums text-aventurea-navy">
                  {inscritosDe.get(a.id) ?? 0}
                </td>
                <td className="px-3 py-3">
                  <form action={actualizarComision} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={a.id} />
                    <input
                      type="number"
                      name="comision"
                      min={0}
                      step={500}
                      defaultValue={Number(a.comision_mensual) || 0}
                      className="w-24 rounded-lg border border-aventurea-line bg-white px-2 py-1 text-[13px] tabular-nums"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-aventurea-line px-2.5 py-1 text-[12px] font-bold text-aventurea-ink-soft hover:bg-aventurea-sky-light"
                    >
                      Guardar
                    </button>
                  </form>
                  <p className="mt-1 text-[11px] text-aventurea-ink-soft">
                    ≈ {colones((Number(a.comision_mensual) || 0) * (inscritosDe.get(a.id) ?? 0))} / mes
                  </p>
                </td>
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
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-aventurea-ink-soft">
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
