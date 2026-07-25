"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(255,255,255,0.06),transparent)]" />
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-aventurea-orange opacity-[0.07] blur-[100px]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-9 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Acceso privado
        </p>
        <h2 className="mt-2.5 text-xl font-bold text-white">
          Panel Administrativo
        </h2>
        <p className="mt-1.5 text-sm text-zinc-400">
          Gestiona las reservas de Aventurea CR.
        </p>

        <form action={formAction} className="mt-5.5 flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-zinc-400">
              Correo
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="tucorreo@aventureacr.com"
              className="w-full rounded-[10px] border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-zinc-400">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full rounded-[10px] border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-950/40 px-3 py-2 text-[13px] text-red-400">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 flex h-11 items-center justify-center rounded-full bg-aventurea-orange text-sm font-bold text-white transition-colors hover:bg-aventurea-orange-dark disabled:opacity-60"
          >
            {pending ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-4 rounded-[10px] bg-zinc-800 p-3 text-[11.5px] leading-relaxed text-zinc-400">
          Este acceso es solo para el equipo de Aventurea CR. Si todavía no
          tenés una cuenta, pedile a quien administra el proyecto que te cree
          una desde Supabase.
        </p>
      </div>
    </main>
  );
}
