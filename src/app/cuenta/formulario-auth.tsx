"use client";

import { useState } from "react";
import Link from "next/link";
import FormularioCodigoAcceso from "@/components/formulario-codigo-acceso";
import { createClient } from "@/lib/supabase/client";

// El botón de Google vive detrás de una bandera: hasta que el dueño
// configure el proveedor en Supabase (Authentication → Providers →
// Google), mostrarlo solo produciría un error al click. Mejor ausente
// que roto. Para activarlo: NEXT_PUBLIC_AUTH_GOOGLE=1.
const GOOGLE_HABILITADO = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

export default function FormularioAuth({
  destino = "/cuenta",
  titulo = "Entrá con tu correo",
  intro = "Para ver tus reservas, favoritos y mensajes en un solo lugar. Escribí tu correo: si ya tenés cuenta entrás directo, y si es tu primera vez te la creamos ahí mismo — solo hace falta tu nombre.",
}: {
  /** A dónde vuelve la persona después de entrar (ruta interna). */
  destino?: string;
  titulo?: string;
  intro?: string;
} = {}) {
  const [pendienteGoogle, setPendienteGoogle] = useState(false);
  const [errorGoogle, setErrorGoogle] = useState<string | null>(null);

  async function entrarConGoogle() {
    setErrorGoogle(null);
    setPendienteGoogle(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
      },
    });
    // Si todo sale bien el navegador se va a Google y este código ya no
    // corre — solo se llega acá cuando algo falló antes de redirigir.
    if (error) {
      setPendienteGoogle(false);
      setErrorGoogle("No se pudo conectar con Google: " + error.message);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
      <h1 className="text-xl font-bold text-aventurea-ink">{titulo}</h1>
      <p className="mt-1.5 text-sm text-aventurea-ink-soft">{intro}</p>

      {/* Si el correo es nuevo, la cuenta nace como cliente — nunca como
          dueño de negocio (eso lo decide el alta en /publicar). El
          nombre solo se pide cuando el correo resulta ser nuevo. */}
      <FormularioCodigoAcceso
        destino={destino}
        acento="navy"
        crearCuenta
        pedirNombreSiNuevo
        datosNuevos={{ rol: "cliente" }}
      />

      {GOOGLE_HABILITADO && (
        <>
          <div className="mt-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-aventurea-line" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              o
            </span>
            <span className="h-px flex-1 bg-aventurea-line" />
          </div>

          <button
            type="button"
            onClick={entrarConGoogle}
            disabled={pendienteGoogle}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-aventurea-line bg-white text-sm font-bold text-aventurea-ink transition-colors hover:bg-aventurea-cream-2 disabled:opacity-60"
          >
            {/* Logo oficial de Google en sus cuatro colores */}
            <svg viewBox="0 0 48 48" className="h-4.5 w-4.5 shrink-0" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            {pendienteGoogle ? "Conectando con Google..." : "Continuar con Google"}
          </button>

          {errorGoogle && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {errorGoogle}
            </p>
          )}
        </>
      )}

      <p className="mt-3 text-center text-[12px] text-zinc-400">
        ¿Tenés un negocio para eventos?{" "}
        <Link href="/mi-rancho/login" className="font-bold text-aventurea-ink-soft underline">
          Entrá como proveedor
        </Link>
      </p>
    </div>
  );
}
