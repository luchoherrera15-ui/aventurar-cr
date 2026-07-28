"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-aventurea-cream p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(240,120,42,0.10),transparent)]" />
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-aventurea-orange opacity-[0.07] blur-[100px]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Acceso privado
        </p>
        <h2 className="mt-2.5 text-xl font-bold text-aventurea-ink">
          Panel Administrativo
        </h2>
        <p className="mt-1.5 text-sm text-aventurea-ink-soft">
          Gestiona las reservas de Bookear CR.
        </p>

        <form action={formAction} className="mt-5.5 flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Correo
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="tucorreo@bookeacr.com"
              className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:zinc-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:zinc-500"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 flex h-11 items-center justify-center rounded-xl bg-aventurea-orange text-sm font-bold text-white transition-colors hover:bg-aventurea-orange-dark disabled:opacity-60"
          >
            {pending ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-4 rounded-[10px] bg-aventurea-cream-2 p-3 text-[11.5px] leading-relaxed text-aventurea-ink-soft">
          Este acceso es solo para el equipo de Bookear CR. Si todavía no
          tenés una cuenta, pedile a quien administra el proyecto que te cree
          una desde Supabase.
        </p>
      </div>
    </main>
  );
}
