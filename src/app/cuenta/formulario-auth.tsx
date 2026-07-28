"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  iniciarSesionCuenta,
  registrarCuenta,
  type CuentaAuthState,
} from "./actions";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function FormularioAuth() {
  const [modo, setModo] = useState<"login" | "registro">("login");
  const accion = modo === "login" ? iniciarSesionCuenta : registrarCuenta;
  const [state, formAction, pending] = useActionState<CuentaAuthState, FormData>(
    accion,
    undefined,
  );

  if (state?.needsConfirmation) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
        <p className="text-sm font-bold text-aventurea-navy">¡Cuenta creada!</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
          Te enviamos un correo de confirmación. Hacé clic en el enlace y
          después iniciá sesión acá con tu correo y contraseña.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
      <h1 className="text-xl font-bold text-aventurea-ink">
        {modo === "login" ? "Iniciá sesión" : "Creá tu cuenta"}
      </h1>
      <p className="mt-1.5 text-sm text-aventurea-ink-soft">
        {modo === "login"
          ? "Entrá para ver tus reservas y tus favoritos."
          : "Registrarte es opcional — igual podés reservar sin cuenta."}
      </p>

      <form key={modo} action={formAction} className="mt-5.5 flex flex-col gap-3.5">
        {modo === "registro" && (
          <div>
            <label className={labelCls}>Tu nombre</label>
            <input type="text" name="nombre" placeholder="Nombre completo" className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls}>Correo</label>
          <input
            type="email"
            name="email"
            required
            placeholder="tucorreo@ejemplo.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Contraseña</label>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            placeholder="••••••••"
            className={inputCls}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 flex h-11 items-center justify-center rounded-xl bg-aventurea-navy text-sm font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-60"
        >
          {pending ? "Un momento..." : modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-4 text-center text-[12.5px] text-zinc-500">
        {modo === "login" ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
        <button
          type="button"
          onClick={() => setModo(modo === "login" ? "registro" : "login")}
          className="font-bold text-aventurea-navy underline"
        >
          {modo === "login" ? "Registrate" : "Iniciá sesión"}
        </button>
      </p>

      <p className="mt-3 text-center text-[12px] text-zinc-400">
        ¿Tenés un negocio para eventos?{" "}
        <Link href="/mi-rancho/login" className="font-bold text-aventurea-ink-soft underline">
          Entrá como proveedor
        </Link>
      </p>
    </div>
  );
}
