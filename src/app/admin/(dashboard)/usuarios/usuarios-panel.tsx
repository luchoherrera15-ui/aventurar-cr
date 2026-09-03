"use client";

import { useActionState, useState, useTransition } from "react";
import {
  cambiarEmail,
  cambiarPassword,
  cambiarRol,
  crearUsuario,
  type NuevoUsuarioState,
} from "./actions";
import { categoriaLabel } from "@/lib/categorias-vertical";

export type PerfilRow = {
  id: string;
  email: string | null;
  nombre: string | null;
  /** El WhatsApp de la metadata de auth — null si nunca lo dio. */
  whatsapp: string | null;
  rol: "admin" | "dueno_rancho" | "cliente";
  created_at: string;
  negocios: { nombre: string; categoria: string; vertical: string | null }[];
};

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

type Edicion = { perfil: PerfilRow; campo: "email" | "password" };

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

  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [edicionError, setEdicionError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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

  function abrirEdicion(perfil: PerfilRow, campo: Edicion["campo"]) {
    setEdicion({ perfil, campo });
    setValor(campo === "email" ? (perfil.email ?? "") : "");
    setEdicionError(null);
    setAviso(null);
  }

  function cerrarEdicion() {
    setEdicion(null);
    setValor("");
    setEdicionError(null);
    setGuardando(false);
  }

  async function guardarEdicion() {
    if (!edicion) return;
    setGuardando(true);
    setEdicionError(null);

    const { perfil, campo } = edicion;
    const res =
      campo === "email"
        ? await cambiarEmail(perfil.id, valor)
        : await cambiarPassword(perfil.id, valor);

    setGuardando(false);

    if (res?.error) {
      setEdicionError(res.error);
      return;
    }

    if (campo === "email") {
      const limpio = valor.trim().toLowerCase();
      setPerfiles((prev) =>
        prev.map((p) => (p.id === perfil.id ? { ...p, email: limpio } : p)),
      );
      setAviso(`Correo actualizado a ${limpio}.`);
    } else {
      setAviso(
        `Contraseña cambiada para ${perfil.email ?? "la cuenta"}. Pasásela para que entre y la cambie.`,
      );
    }
    cerrarEdicion();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
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
          <p className="mt-4 rounded-[10px] bg-aventurea-sky/10 p-3 text-[12.5px] leading-relaxed text-aventurea-orange">
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
              className="h-[42px] rounded-xl bg-aventurea-sky px-5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
            >
              {pending ? "Creando..." : "Crear cuenta"}
            </button>
          </form>
        )}

        {state?.error && (
          <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">
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
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {rolError}
        </p>
      )}
      {aviso && (
        <p className="rounded-xl bg-aventurea-green/10 p-3 text-[13px] font-bold text-aventurea-green">
          ✓ {aviso}
        </p>
      )}
      {!puedeCrearCuentas && (
        <p className="rounded-xl bg-aventurea-sky/10 p-3 text-[12.5px] leading-relaxed text-aventurea-orange">
          Para cambiar correos y contraseñas también hace falta la variable{" "}
          <strong>SUPABASE_SERVICE_ROLE_KEY</strong>.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-aventurea-cream-2/60">
              {["Correo", "Nombre", "WhatsApp", "Negocio", "Rol", "Acciones"].map((h) => (
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
                <td colSpan={6} className="px-4 py-10 text-center text-[13.5px] text-zinc-500">
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
                <td className="whitespace-nowrap px-4 py-3.5 text-[13px]">
                  {p.whatsapp ? (
                    /* Link directo al chat: el número se registró como
                       WhatsApp, así que se abre como WhatsApp. Solo
                       dígitos en el wa.me; +506 si vino pelado (8
                       dígitos locales). */
                    <a
                      href={`https://wa.me/${(() => {
                        const d = p.whatsapp.replace(/\D/g, "");
                        return d.length === 8 ? `506${d}` : d;
                      })()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-aventurea-navy tabular-nums hover:underline"
                    >
                      {p.whatsapp}
                    </a>
                  ) : (
                    <span className="text-aventurea-ink-soft">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {p.negocios.length === 0
                    ? "—"
                    : p.negocios.map((n, i) => (
                        <span key={i} className="block whitespace-nowrap">
                          {n.nombre} · {categoriaLabel(n.vertical ?? "eventos", n.categoria)}
                        </span>
                      ))}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      p.rol === "admin"
                        ? "bg-aventurea-navy text-white"
                        : "bg-aventurea-cream-2 text-aventurea-ink-soft"
                    }`}
                  >
                    {p.rol === "admin"
                      ? "Administrador"
                      : p.rol === "dueno_rancho"
                        ? "Proveedor"
                        : "Cliente"}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      disabled={!puedeCrearCuentas}
                      onClick={() => abrirEdicion(p, "email")}
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange disabled:opacity-40"
                    >
                      Cambiar correo
                    </button>
                    <button
                      disabled={!puedeCrearCuentas}
                      onClick={() => abrirEdicion(p, "password")}
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange disabled:opacity-40"
                    >
                      Cambiar contraseña
                    </button>
                    {p.id === miId ? (
                      <span className="self-center text-[11.5px] text-zinc-500">
                        No podés cambiarte el rol
                      </span>
                    ) : (
                      <button
                        disabled={rolPending}
                        onClick={() => toggleRol(p.id, p.rol)}
                        className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange disabled:opacity-50"
                      >
                        {p.rol === "admin" ? "Quitar admin" : "Hacer admin"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5">
          <div className="w-full max-w-md rounded-2xl border border-aventurea-line bg-aventurea-surface p-6 shadow-xl">
            <h3 className="text-[16px] font-bold text-aventurea-ink">
              {edicion.campo === "email"
                ? "Cambiar el correo de acceso"
                : "Cambiar la contraseña"}
            </h3>
            <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
              Cuenta de{" "}
              <strong>
                {edicion.perfil.nombre ?? edicion.perfil.email ?? "esta cuenta"}
              </strong>
              {edicion.perfil.negocios.length > 0
                ? ` — ${edicion.perfil.negocios.map((n) => n.nombre).join(", ")}`
                : ""}
              .
            </p>

            <div className="mt-4">
              <label className={labelCls}>
                {edicion.campo === "email" ? "Correo nuevo" : "Contraseña nueva"}
              </label>
              <input
                type={edicion.campo === "email" ? "email" : "text"}
                value={valor}
                autoFocus
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") guardarEdicion();
                  if (e.key === "Escape") cerrarEdicion();
                }}
                placeholder={
                  edicion.campo === "email"
                    ? "dueno@ejemplo.com"
                    : "Mínimo 6 caracteres"
                }
                className={inputCls}
              />
              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                {edicion.campo === "email"
                  ? "El correo nuevo queda verificado al instante: la persona entra con él sin tener que confirmar nada."
                  : "Se cambia de una. Pasásela por un medio seguro y pedile que la cambie al entrar."}
              </p>
            </div>

            {edicionError && (
              <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">
                {edicionError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarEdicion}
                disabled={guardando}
                className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-sky hover:text-aventurea-orange disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarEdicion}
                disabled={guardando || !valor.trim()}
                className="rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
