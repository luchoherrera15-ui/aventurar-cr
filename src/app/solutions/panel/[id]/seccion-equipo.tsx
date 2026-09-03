"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ROTULO_CAMPO } from "@/components/panel/sistema";
import { TOPES, type ColaboradorSolutions, type RolColaborador } from "@/lib/solutions/tipos";
import { invitarColaboradorSolutions, quitarColaboradorSolutions } from "./actions";

/** EQUIPO — quién más entra al panel. Se invita por correo. */
export default function SeccionEquipo({ negocioId, colaboradores, esDueno }: { negocioId: string; colaboradores: ColaboradorSolutions[]; esDueno: boolean }) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<RolColaborador>("equipo");
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [ocupado, arrancar] = useTransition();

  const invitar = () => {
    setMsg(null);
    arrancar(async () => {
      const r = await invitarColaboradorSolutions(negocioId, correo, rol);
      if (!r.ok) setMsg({ tono: "alerta", texto: r.motivo });
      else { setMsg({ tono: "exito", texto: "Listo. Cuando entre a Bookea con ese correo, ya va a ver este negocio." }); setCorreo(""); router.refresh(); }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card eyebrow="Quién entra" titulo="Tu equipo" accion={<PildoraEstado estado="neutro">{colaboradores.length} de {TOPES.colaboradores}</PildoraEstado>}>
        <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
          <strong>Equipo</strong> ve las comandas y marca platos agotados — para meseros y cocina. <strong>Admin</strong> edita
          todo, como vos.
        </p>
        {colaboradores.length > 0 && (
          <ul className="mt-3 flex flex-col divide-y divide-aventurea-line">
            {colaboradores.map((c) => (
              <li key={c.correo} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-aventurea-ink">{c.correo}</p>
                  <p className="text-[12px] text-aventurea-ink-soft">{c.rol === "admin" ? "Admin" : "Equipo"} · {c.usuario_id ? "Ya entró" : "Invitación pendiente"}</p>
                </div>
                {esDueno && (
                  <button type="button" disabled={ocupado} onClick={() => { if (confirm(`¿Quitar a ${c.correo}?`)) arrancar(async () => { await quitarColaboradorSolutions(negocioId, c.correo); router.refresh(); }); }} className={BOTON_PANEL}>
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {colaboradores.length < TOPES.colaboradores && (
          <form className="mt-4 grid gap-3 border-t border-aventurea-line pt-4 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); invitar(); }}>
            <div>
              <label htmlFor="correo-colab" className={ROTULO_CAMPO}>Correo</label>
              <input id="correo-colab" type="email" required value={correo} placeholder="mesero@gmail.com" onChange={(e) => setCorreo(e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
            </div>
            <div>
              <label htmlFor="rol-colab" className={ROTULO_CAMPO}>Rol</label>
              <select id="rol-colab" value={rol} onChange={(e) => setRol(e.target.value as RolColaborador)} className={`mt-1.5 ${CAMPO_PANEL}`}>
                <option value="equipo">Equipo</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" disabled={ocupado || !correo.trim()} className={BOTON_PANEL_PRIMARIO}>{ocupado ? "Invitando…" : "Invitar"}</button>
          </form>
        )}
        {msg && <p className={`mt-3 text-[13px] font-bold ${msg.tono === "exito" ? "text-green-700" : "text-red-700"}`}>{msg.texto}</p>}
      </Card>
    </div>
  );
}
