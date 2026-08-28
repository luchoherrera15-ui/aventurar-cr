"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { verificarSoyAdmin } from "./administrar-actions";

/**
 * EL MODAL DE "ADMINISTRAR COMO EL DUEÑO", desde admin.
 *
 * Mismo overlay que ya usan "Ver pase" y "Auditoría" al lado de este
 * archivo — no un modal nuevo. Un admin YA tiene acceso completo a
 * `/lealtad/panel/[id]` de cualquier negocio con solo navegar ahí
 * (`verificarAccesoRancho` en `src/lib/auth.ts` deja pasar a cualquier
 * admin) — este modal no construye ningún permiso nuevo, solo agrega
 * una re-confirmación de "sudo" antes de entrar a operar la cuenta de
 * otro negocio: un código de un solo uso a la CASILLA DEL PROPIO ADMIN,
 * reusando el mismo mecanismo de OTP que ya manda todos los logins del
 * sitio (ver `formulario-codigo-acceso.tsx`).
 *
 * El correo nunca sale de un input: se trae de la sesión del servidor
 * (`verificarSoyAdmin`), así que no hay forma de pedir un código para
 * el correo de otra persona.
 */
export default function AdministrarModal({
  ranchoId,
  nombre,
  onCerrar,
}: {
  ranchoId: string;
  nombre: string;
  onCerrar: () => void;
}) {
  const [estado, setEstado] = useState<
    | { tipo: "comprobando" }
    | { tipo: "sin_permiso" }
    | { tipo: "confirmar"; correo: string }
    | { tipo: "codigo"; correo: string }
  >({ tipo: "comprobando" });
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  useEffect(() => {
    let vivo = true;
    verificarSoyAdmin().then((res) => {
      if (!vivo) return;
      if (!res.ok || !res.correo) setEstado({ tipo: "sin_permiso" });
      else setEstado({ tipo: "confirmar", correo: res.correo });
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function enviarCodigo(correo: string, esReenvio = false) {
    setError(null);
    setPendiente(true);
    const supabase = createClient();
    // shouldCreateUser: false — esta cuenta ya existe (es el propio
    // admin logueado); si por lo que sea no la encuentra, no hay que
    // crear una nueva de la nada.
    const { error } = await supabase.auth.signInWithOtp({
      email: correo,
      options: { shouldCreateUser: false },
    });
    setPendiente(false);

    if (error) {
      if (error.status === 429) {
        setError("Ya te mandamos un código hace poco — esperá un minuto y probá de nuevo.");
      } else {
        setError("No se pudo enviar el código: " + error.message);
      }
      return;
    }
    setCodigo("");
    setEstado({ tipo: "codigo", correo });
    if (esReenvio) setReenviado(true);
  }

  async function verificarCodigo(e: React.FormEvent, correo: string) {
    e.preventDefault();
    setError(null);
    const codigoLimpio = codigo.trim();
    if (codigoLimpio.length < 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }

    setPendiente(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: correo,
      token: codigoLimpio,
      type: "email",
    });

    if (error || !data.user) {
      setPendiente(false);
      setError(
        "Ese código no sirve o ya venció. Revisá que sea el del último correo, o pedí uno nuevo.",
      );
      return;
    }

    // Navegación completa (no push): el panel de lealtad se abre con la
    // cookie de sesión recién confirmada.
    window.location.href = `/lealtad/panel/${ranchoId}`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCerrar}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-aventurea-surface p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Administrar como el dueño
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-aventurea-ink">{nombre}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          {estado.tipo === "comprobando" && (
            <p className="text-center text-[12.5px] text-aventurea-ink-soft">
              Comprobando tu acceso…
            </p>
          )}

          {estado.tipo === "sin_permiso" && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
              No se pudo confirmar que tu cuenta sea de administrador.
            </p>
          )}

          {estado.tipo === "confirmar" && (
            <>
              <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
                Vas a entrar al panel de Lealtad de{" "}
                <strong className="text-aventurea-ink">{nombre}</strong> como si fueras el dueño.
                Para confirmar que sos vos, te mandamos un código de 6 dígitos a tu correo:{" "}
                <strong className="text-aventurea-ink">{estado.correo}</strong>.
              </p>

              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={pendiente}
                onClick={() => enviarCodigo(estado.correo)}
                className="presionable mt-4 w-full rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {pendiente ? "Enviando…" : "Enviarme el código"}
              </button>
            </>
          )}

          {estado.tipo === "codigo" && (
            <form
              onSubmit={(e) => verificarCodigo(e, estado.correo)}
              className="flex flex-col gap-3"
            >
              <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
                Te mandamos un código de 6 dígitos a{" "}
                <strong className="text-aventurea-ink">{estado.correo}</strong>. Puede tardar un
                momento — revisá spam si no aparece.
              </p>
              <div>
                <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full rounded-[10px] border border-aventurea-line bg-white px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] text-aventurea-ink"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>
              )}
              {reenviado && !error && (
                <p className="rounded-lg bg-aventurea-green/10 px-3 py-2 text-[12.5px] font-bold text-aventurea-green">
                  ✓ Código reenviado — revisá tu correo.
                </p>
              )}

              <button
                type="submit"
                disabled={pendiente}
                className="presionable rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {pendiente ? "Verificando…" : "Entrar al panel"}
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => enviarCodigo(estado.correo, true)}
                className="text-center text-[12.5px] font-bold text-aventurea-navy underline"
              >
                Reenviar código
              </button>
            </form>
          )}
        </div>

        {estado.tipo !== "codigo" && (
          <button
            type="button"
            onClick={onCerrar}
            className="presionable mt-5 w-full rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[13px] font-bold text-aventurea-navy"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
