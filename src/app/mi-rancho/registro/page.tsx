"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registrarDueno, type RegistroState } from "./actions";

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState<RegistroState, FormData>(
    registrarDueno,
    undefined,
  );

  return (
    <main className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden p-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(240,120,42,0.10),transparent)]" />
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-aventurea-orange opacity-[0.07] blur-[100px]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-aventurea-line bg-white p-9 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Marketplace de ranchos
        </p>
        <h1 className="mt-2.5 text-xl font-bold text-aventurea-orange-dark">
          Creá tu cuenta
        </h1>
        <p className="mt-1.5 text-sm text-aventurea-ink-soft">
          Registrate para publicar tu salón o rancho de eventos en Aventurea
          CR, sin importar en qué parte de Costa Rica esté.
        </p>

        {state?.needsConfirmation ? (
          <div className="mt-6 rounded-xl border border-aventurea-green/30 bg-aventurea-green/10 p-4">
            <p className="text-sm font-bold text-aventurea-green">
              ¡Cuenta creada!
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
              Te enviamos un correo de confirmación. Hacé click en el link y
              después{" "}
              <Link
                href="/mi-rancho/login"
                className="font-bold text-aventurea-orange underline"
              >
                iniciá sesión acá
              </Link>{" "}
              para completar los datos de tu rancho.
            </p>
          </div>
        ) : (
          <>
            <form action={formAction} className="mt-5.5 flex flex-col gap-3.5">
              <div>
                <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Tu nombre
                </label>
                <input
                  type="text"
                  name="nombre"
                  required
                  placeholder="Nombre completo"
                  className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Correo
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500"
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
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500"
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
                className="mt-1 flex h-11 items-center justify-center rounded-full bg-aventurea-orange text-sm font-bold text-white transition-colors hover:bg-aventurea-orange-dark disabled:opacity-60"
              >
                {pending ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>

            <p className="mt-4 text-center text-[12.5px] text-zinc-500">
              ¿Ya tenés cuenta?{" "}
              <Link
                href="/mi-rancho/login"
                className="font-bold text-aventurea-orange underline"
              >
                Iniciá sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
