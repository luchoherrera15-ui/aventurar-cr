"use client";

/**
 * Quién más administra este negocio.
 *
 * Solo lo ve el DUEÑO. Un colaborador no puede invitar a otros —si
 * pudiera, el permiso se propagaría solo y el dueño perdería el control
 * de quién entra—, así que tampoco tiene sentido mostrarle el
 * formulario: la base lo rechazaría igual y sería una puerta que no
 * abre.
 */

import { useState, useTransition } from "react";
import { agregarColaborador, quitarColaborador } from "./colaboradores-actions";

export type Colaborador = {
  usuario_id: string;
  email: string;
  nombre: string;
  creado_en: string;
};

export default function ColaboradoresPanel({
  ranchoId,
  colaboradores,
}: {
  ranchoId: string;
  colaboradores: Colaborador[];
}) {
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function invitar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    iniciar(async () => {
      const r = await agregarColaborador(ranchoId, correo);
      setAviso({ ok: r.ok, texto: r.mensaje });
      if (r.ok) setCorreo("");
    });
  }

  function quitar(usuarioId: string, email: string) {
    if (!confirm(`¿Quitarle el acceso a ${email}? Deja de ver este negocio de inmediato.`)) {
      return;
    }
    setAviso(null);
    iniciar(async () => {
      const r = await quitarColaborador(ranchoId, usuarioId);
      setAviso({ ok: r.ok, texto: r.mensaje });
    });
  }

  return (
    <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-6 shadow-sm">
      <h2 className="text-[17px] font-bold text-aventurea-ink">Quién administra este negocio</h2>
      <p className="mt-1 max-w-[62ch] text-[13.5px] text-aventurea-ink-soft">
        Podés darle acceso a alguien de tu equipo. Va a poder editar el negocio, el catálogo,
        la agenda, las reservas y los gastos — lo mismo que vos.
      </p>
      <p className="mt-2 max-w-[62ch] text-[12.5px] text-aventurea-ink-soft">
        No va a poder invitar a nadie más, ni borrar el negocio, ni ver tus documentos de
        verificación.
      </p>

      <form onSubmit={invitar} className="mt-5 flex flex-wrap items-center gap-2">
        <label htmlFor="correo-colab" className="sr-only">
          Correo de la persona
        </label>
        <input
          id="correo-colab"
          type="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="correo@ejemplo.com"
          disabled={pendiente}
          className="min-w-[240px] flex-1 rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[14px] text-aventurea-ink outline-none focus:border-aventurea-navy focus:ring-2 focus:ring-aventurea-navy/15 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pendiente || correo.trim().length === 0}
          className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pendiente ? "Agregando…" : "Dar acceso"}
        </button>
      </form>

      <p className="mt-2 text-[12px] text-aventurea-ink-soft">
        La persona ya tiene que tener una cuenta en Bookea con ese correo.
      </p>

      {aviso && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-4 py-2.5 text-[13.5px] ${
            aviso.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <div className="mt-6">
        {colaboradores.length === 0 ? (
          <p className="rounded-xl bg-aventurea-cream-2 px-4 py-3 text-[13.5px] text-aventurea-ink-soft">
            Por ahora solo vos administrás este negocio.
          </p>
        ) : (
          <ul className="divide-y divide-aventurea-line rounded-xl border border-aventurea-line">
            {colaboradores.map((c) => (
              <li key={c.usuario_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-aventurea-ink">
                    {c.nombre || c.email}
                  </p>
                  {c.nombre && (
                    <p className="truncate text-[12.5px] text-aventurea-ink-soft">{c.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => quitar(c.usuario_id, c.email)}
                  disabled={pendiente}
                  className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink-soft transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  Quitar acceso
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
