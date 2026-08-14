"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconEdit, IconX } from "@/components/icons";
import { actualizarPerfil } from "./actions";

/**
 * El botón "Editar perfil" + su modal, en un solo componente
 * autocontenido: guarda su propio estado de abierto/cerrado, así que
 * quien lo use (tablero-modos.tsx) no necesita levantar ese estado.
 *
 * El modal (Dialogo) se monta y se desmonta con `abierto` en vez de
 * quedar siempre en el árbol ocultándose por CSS: así el formulario
 * arranca con los valores actuales cada vez que se abre sin necesitar
 * un efecto que "resetee" estado — nace de nuevo, con su estado
 * inicial correcto desde el primer render.
 */
export default function EditarPerfil({
  nombreActual,
  telefonoActual,
  variante = "claro",
}: {
  nombreActual: string;
  telefonoActual: string;
  /** "oscuro" = el botón vive sobre la tarjeta navy del sidebar. */
  variante?: "claro" | "oscuro";
}) {
  const [abierto, setAbierto] = useState(false);
  // Para devolverle el foco a este botón al cerrar el modal — si no,
  // el navegador lo manda a <body> y quien navega con teclado pierde
  // por completo su posición en la página.
  const botonDisparador = useRef<HTMLButtonElement>(null);

  function cerrar() {
    setAbierto(false);
    botonDisparador.current?.focus();
  }

  return (
    <>
      <button
        ref={botonDisparador}
        type="button"
        onClick={() => setAbierto(true)}
        className={
          variante === "oscuro"
            ? "inline-flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            : "inline-flex items-center gap-1.5 rounded-xl border border-aventurea-line bg-aventurea-surface px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
        }
      >
        <span aria-hidden="true">
          <IconEdit className="h-[14px] w-[14px]" />
        </span>
        Editar perfil
      </button>

      {abierto && (
        <Dialogo nombreActual={nombreActual} telefonoActual={telefonoActual} onCerrar={cerrar} />
      )}
    </>
  );
}

function Dialogo({
  nombreActual,
  telefonoActual,
  onCerrar,
}: {
  nombreActual: string;
  telefonoActual: string;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(nombreActual);
  const [telefono, setTelefono] = useState(telefonoActual);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const router = useRouter();
  const primerCampo = useRef<HTMLInputElement>(null);
  const contenedor = useRef<HTMLElement>(null);

  useEffect(() => {
    primerCampo.current?.focus();
  }, []);

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCerrar();
        return;
      }
      // Atrapa el foco adentro del diálogo: sin esto, Tab/Shift+Tab se
      // escapan hacia el nav lateral y el resto del tablero que el
      // overlay solo tapa visualmente, aunque el diálogo diga
      // aria-modal="true".
      if (e.key !== "Tab" || !contenedor.current) return;
      const focosables = contenedor.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focosables.length === 0) return;
      const primero = focosables[0];
      const ultimo = focosables[focosables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const res = await actualizarPerfil(nombre, telefono);
      if (res.error) {
        setError(res.error);
        return;
      }
      onCerrar();
      router.refresh();
    });
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-aventurea-navy/40 px-4 py-16 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <section
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-perfil-titulo"
        className="w-full max-w-[440px] rounded-3xl border border-aventurea-line bg-aventurea-surface p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
              Datos personales
            </p>
            <h2 id="editar-perfil-titulo" className="mt-1 text-[19px] font-extrabold text-aventurea-ink">
              Editar perfil
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
          >
            <span aria-hidden="true">
              <IconX className="h-[18px] w-[18px]" />
            </span>
          </button>
        </div>

        <form onSubmit={guardar} className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-aventurea-ink">Nombre completo</span>
            <input
              ref={primerCampo}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              required
              className="w-full rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2.5 text-[14px] text-aventurea-ink outline-none focus:border-aventurea-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-aventurea-navy focus-visible:outline-offset-2"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-aventurea-ink">Teléfono / WhatsApp</span>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              type="tel"
              placeholder="+506 0000 0000"
              className="w-full rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2.5 text-[14px] text-aventurea-ink outline-none focus:border-aventurea-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-aventurea-navy focus-visible:outline-offset-2"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
