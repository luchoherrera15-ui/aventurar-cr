"use client";

import Link from "next/link";
import FormularioCodigoAcceso from "@/components/formulario-codigo-acceso";

export default function FormularioAuth() {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
      <h1 className="text-xl font-bold text-aventurea-ink">
        Entrá con tu correo
      </h1>
      <p className="mt-1.5 text-sm text-aventurea-ink-soft">
        Para ver tus reservas, favoritos y mensajes. Si no tenés cuenta, se
        crea sola con el mismo código.
      </p>

      {/* Si el correo es nuevo, la cuenta nace como cliente — nunca como
          dueño de negocio (eso lo decide el alta en /publicar). */}
      <FormularioCodigoAcceso
        destino="/cuenta"
        acento="navy"
        crearCuenta
        datosNuevos={{ rol: "cliente" }}
      />

      <p className="mt-3 text-center text-[12px] text-zinc-400">
        ¿Tenés un negocio para eventos?{" "}
        <Link href="/mi-rancho/login" className="font-bold text-aventurea-ink-soft underline">
          Entrá como proveedor
        </Link>
      </p>
    </div>
  );
}
