"use client";

import { useActionState, useState, useTransition } from "react";
import { cambiarRol, crearUsuario, type NuevoUsuarioState } from "./actions";

export type PerfilRow = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: "admin" | "dueno_rancho";
  created_at: string;
  ranchoNombre: string | null;
};

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function UsuariosPanel({
  initialPerfiles,
  puedeCrearCuentas,
  miId,
}: {
  initialPerfiles: PerfilRow[];
  puedeCrearCuentas: boolean;
  miId: string | null;
}) {
  const [perfiles, setPerfiles] = useState(initialPerfiles);
  const [state, formAction, pending] = useActionState<
    NuevoUsuarioState,
    FormData
  >(crearUsuario, undefined);
  const [rolPending, startTransition] = useTransition();
  const [rolError, setRolError] = useState<string | null>(null);

  function toggleRol(id: string, rolActual: PerfilRow["rol"]) {
    const nuevo = rolActual === "admin" ? "dueno_rancho" : "admin";
    setRolError(null);
    startTransition(async () => {
      const res = await cambiarRol(id, nuevo);
      if (res?.error) {
        setRolError(res.error);
        return;
      }
      setPerfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, rol: nuevo } : p)),
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Alta manual
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Crear una cuenta
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          La cuenta queda lista para usar de inmediato (sin correo de
          confirmación). Pasale la contraseña al dueño para que entre y la
          cambie.
        </p>

        {!puedeCrearCuentas ? (
          <p className="mt-4 rounded-[10px] bg-aventurea-orange/10 p-3 text-[12.5px] leading-relaxed text-aventurea-orange">
            Para crear cuentas desde acá falta agregar la variable{" "}
            <strong>SUPABASE_SERVICE_ROLE_KEY</strong> en Vercel (Settings →
            Environment Variables). La encontrás en Supabase, en Project
            Settings → API → <em>service_role</em>.
          </p>
        ) : (
          <form
            action={formAction}
            className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-4"
          >
            <div>
              <label className={labelCls}>Nombre</label>
              <input type="text" name="nombre" placeholder="Nombre completo" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Correo</label>
              <input type="email" name="email" required placeholder="dueno@ejemplo.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contraseña</label>
              <input type="text" name="password" required minLength={6} placeholder="Mínimo 6 caracteres" className={inputCls} />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="h-[42px] rounded-full bg-aventurea-orange px-5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
            >
              {pending ? "Creando..." : "Crear cuenta"}
            </button>
          </form>
        )}

        {state?.error && (
          <p className="mt-3 rounded-lg bg-red-950/40 p-2.5 text-[13px] text-red-400">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="mt-3 rounded-lg bg-aventurea-green/10 p-2.5 text-[13px] font-bold text-aventurea-green">
            ✓ {state.ok} — recargá la página para verla en la lista.
          </p>
        )}
      </section>

      {rolError && (
        <p className="rounded-xl bg-red-950/40 p-3 text-[13px] text-red-400">
          {rolError}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-aventurea-cream-2/60">
              {["Correo", "Nombre", "Salón", "Rol", "Acciones"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-aventurea-line px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perfiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[13.5px] text-zinc-400">
                  Todavía no hay cuentas registradas.
                </td>
              </tr>
            )}
            {perfiles.map((p) => (
              <tr
                key={p.id}
                className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
              >
                <td className="px-4 py-3.5 text-[13px] font-bold text-aventurea-ink">
                  {p.email ?? "—"}
                  {p.id === miId && (
                    <span className="ml-2 text-[11px] font-bold text-aventurea-orange">
                      (vos)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {p.nombre ?? "—"}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {p.ranchoNombre ?? "—"}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      p.rol === "admin"
                        ? "bg-aventurea-navy text-white"
                        : "bg-aventurea-cream-2 text-aventurea-ink-soft"
                    }`}
                  >
                    {p.rol === "admin" ? "Administrador" : "Dueño de salón"}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {p.id === miId ? (
                    <span className="text-[12px] text-zinc-400">
                      No podés cambiar tu propio rol
                    </span>
                  ) : (
                    <button
                      disabled={rolPending}
                      onClick={() => toggleRol(p.id, p.rol)}
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-50"
                    >
                      {p.rol === "admin" ? "Quitar admin" : "Hacer admin"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
