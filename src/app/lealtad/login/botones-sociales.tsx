"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Google y Facebook para el login de lealtad, en versión oscura.
 *
 * Mismo mecanismo que /cuenta (formulario-auth.tsx): signInWithOAuth →
 * /auth/callback?next=…, que canjea el código y aterriza en el destino.
 * Y las MISMAS banderas: cada proveedor aparece solo si está encendido
 * en el entorno, porque mostrarlo sin configurarlo en Supabase solo
 * produce un error al clic. Mejor ausente que roto.
 *
 *   NEXT_PUBLIC_AUTH_GOOGLE=1     → botón de Google
 *   NEXT_PUBLIC_AUTH_FACEBOOK=1   → botón de Facebook
 */
const GOOGLE_HABILITADO = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
const FACEBOOK_HABILITADO = process.env.NEXT_PUBLIC_AUTH_FACEBOOK === "1";

type Proveedor = "google" | "facebook";
const NOMBRE: Record<Proveedor, string> = { google: "Google", facebook: "Facebook" };

export default function BotonesSociales({ destino }: { destino: string }) {
  const [pendiente, setPendiente] = useState<Proveedor | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!GOOGLE_HABILITADO && !FACEBOOK_HABILITADO) return null;

  async function entrarCon(proveedor: Proveedor) {
    setError(null);
    setPendiente(proveedor);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: proveedor,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
      },
    });
    // Si sale bien, el navegador ya se fue al proveedor: solo se llega
    // acá cuando algo falló antes de redirigir.
    if (err) {
      setPendiente(null);
      setError(`No se pudo conectar con ${NOMBRE[proveedor]}: ${err.message}`);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">o</span>
        <span className="h-px flex-1 bg-white/15" />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
      )}

      <div className="mt-4 grid gap-2.5">
        {GOOGLE_HABILITADO && (
          <Boton
            onClick={() => entrarCon("google")}
            esperando={pendiente === "google"}
            deshabilitado={pendiente !== null}
            texto="Continuar con Google"
            icono={<LogoGoogle />}
          />
        )}
        {FACEBOOK_HABILITADO && (
          <Boton
            onClick={() => entrarCon("facebook")}
            esperando={pendiente === "facebook"}
            deshabilitado={pendiente !== null}
            texto="Continuar con Facebook"
            icono={<LogoFacebook />}
          />
        )}
      </div>
    </div>
  );
}

function Boton({
  onClick,
  esperando,
  deshabilitado,
  texto,
  icono,
}: {
  onClick: () => void;
  esperando: boolean;
  deshabilitado: boolean;
  texto: string;
  icono: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-white/20 bg-white/[0.06] px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-white/[0.12] disabled:opacity-50"
    >
      {icono}
      {esperando ? "Conectando…" : texto}
    </button>
  );
}

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function LogoFacebook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"
      />
    </svg>
  );
}
