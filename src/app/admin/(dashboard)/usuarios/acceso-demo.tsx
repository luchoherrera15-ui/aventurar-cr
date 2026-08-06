"use client";

import { useState, useTransition } from "react";
import { generarCodigoDemo } from "./actions";

/**
 * Acceso rápido a las cuentas demo: sus buzones (*.demo@bookea.lat) no
 * existen, así que el código de login que manda el sitio no llega
 * nunca. Este panelito genera el código válido del momento para que un
 * admin pueda entrar a probar como si fuera ese negocio.
 *
 * El orden importa (y la UI lo dice): primero tocar "Enviarme el
 * código" en la página de login — cada código nuevo invalida el
 * anterior, así que este se genera de último.
 */
const CUENTAS_DEMO = [
  { email: "citas.demo@bookea.lat", nota: "Dueña de los 3 negocios demo de Citas" },
  { email: "negocios.demo@bookea.lat", nota: "Dueña de los 10 negocios demo de Eventos" },
];

export default function AccesoDemo() {
  const [abierto, setAbierto] = useState(false);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function generar(email: string) {
    setError(null);
    setGenerando(email);
    startTransition(async () => {
      const res = await generarCodigoDemo(email);
      setGenerando(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      setCodigos((prev) => ({ ...prev, [email]: res.codigo! }));
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-aventurea-line bg-white">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="text-[14px] font-bold text-aventurea-ink">
            Acceso a cuentas demo
          </p>
          <p className="text-[12.5px] text-aventurea-ink-soft">
            Generá el código de login de una cuenta *.demo@bookea.lat — su
            correo no existe, así que el código del sitio nunca llega.
          </p>
        </div>
        <span className="shrink-0 text-[13px] font-bold text-aventurea-navy">
          {abierto ? "Cerrar" : "Abrir"}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-aventurea-line px-5 py-4">
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            <li>
              Abrí <strong>bookea.lat/cuenta</strong> (o /mi-negocio/login) en una
              ventana de <strong>incógnito</strong>, poné el correo demo y tocá{" "}
              <em>Enviarme el código</em>.
            </li>
            <li>
              Volvé acá y tocá <strong>Generar código</strong> — tiene que ser
              DESPUÉS del paso 1: cada código nuevo invalida el anterior.
            </li>
            <li>Escribí los 6 dígitos en la página y listo.</li>
          </ol>

          <div className="flex flex-col gap-2.5">
            {CUENTAS_DEMO.map(({ email, nota }) => (
              <div
                key={email}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] font-bold text-aventurea-ink">
                    {email}
                  </p>
                  <p className="text-[11.5px] text-aventurea-ink-soft">{nota}</p>
                </div>
                {codigos[email] && (
                  <span className="rounded-lg bg-aventurea-navy px-3.5 py-1.5 font-mono text-[17px] font-extrabold tracking-[0.25em] text-white">
                    {codigos[email]}
                  </span>
                )}
                <button
                  type="button"
                  disabled={generando === email}
                  onClick={() => generar(email)}
                  className="shrink-0 rounded-xl border border-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white disabled:opacity-50"
                >
                  {generando === email
                    ? "Generando..."
                    : codigos[email]
                      ? "Generar otro"
                      : "Generar código"}
                </button>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
