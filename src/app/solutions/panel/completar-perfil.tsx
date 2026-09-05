"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ROTULO_CAMPO } from "@/components/panel/sistema";
import { completarPerfilSolutions } from "./perfil-actions";

/**
 * EL PRIMER INGRESO — nombre y teléfono, antes de ver el panel.
 *
 * Pedido del dueño (5 sep 2026): «cuando entren por primera vez, igual
 * se les pide el nombre y el número de teléfono». Se muestra EN LUGAR
 * del panel mientras falte alguno de los dos; al guardar, el panel
 * aparece con todo lo que Bookea ya le dejó listo.
 *
 * Una pantalla sola y blanca a propósito, sin rail ni pestañas: es un
 * paso con principio y fin, y lo único que hay que hacer acá es
 * llenar dos campos.
 */
export default function CompletarPerfil({
  correo,
  nombreInicial,
  negocio,
}: {
  correo: string;
  nombreInicial: string;
  /** El negocio que lo está esperando, si Bookea se lo dejó listo. */
  negocio?: string | null;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, arrancar] = useTransition();

  const guardar = () => {
    setError(null);
    arrancar(async () => {
      const r = await completarPerfilSolutions({ nombre, whatsapp });
      if (!r.ok) return setError(r.motivo);
      router.refresh();
    });
  };

  return (
    <main className="min-h-svh bg-[#f7f9fc]">
      <section className="mx-auto w-[min(520px,92vw)] py-14">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accion)" }}>
          Bookea Solutions
        </p>
        <h1 className="titulo mt-2 text-[clamp(26px,4vw,36px)] leading-tight text-aventurea-navy">
          {negocio ? `${negocio} ya está listo.` : "Ya casi."} Contanos quién sos.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
          Entraste como <strong className="text-aventurea-navy">{correo}</strong>. Necesitamos tu nombre y un teléfono
          para poder contactarte; después entrás directo a tu panel.
        </p>

        <form
          className="mt-6 grid gap-4 rounded-[18px] border border-aventurea-line bg-white p-6 shadow-plano"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <div>
            <label htmlFor="pf-nombre" className={ROTULO_CAMPO}>
              Tu nombre
            </label>
            <input
              id="pf-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              autoComplete="name"
              placeholder="Nombre y apellido"
              className={`mt-1.5 ${CAMPO_PANEL}`}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="pf-whatsapp" className={ROTULO_CAMPO}>
              Tu teléfono (WhatsApp)
            </label>
            <input
              id="pf-whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              maxLength={20}
              autoComplete="tel"
              placeholder="88887777"
              className={`mt-1.5 ${CAMPO_PANEL}`}
            />
          </div>
          {error && <p className="text-[13px] font-bold text-red-700">{error}</p>}
          <button type="submit" disabled={ocupado} className={BOTON_PANEL_PRIMARIO}>
            {ocupado ? "Guardando…" : "Entrar a mi panel →"}
          </button>
        </form>
      </section>
    </main>
  );
}
