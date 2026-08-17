"use client";

/**
 * Quién más administra este negocio.
 *
 * Solo lo ve el DUEÑO. Un colaborador no puede invitar a otros —si
 * pudiera, el permiso se propagaría solo y el dueño perdería el control
 * de quién entra—, así que tampoco tiene sentido mostrarle el
 * formulario: la base lo rechazaría igual y sería una puerta que no
 * abre.
 *
 * ── LA FORMA ───────────────────────────────────────────────────────
 * Dos tarjetas del panel: DAR acceso y QUIÉNES lo tienen. Antes era una
 * sola caja que abría con un `<h2>` repitiendo, palabra por palabra, el
 * título de la sección plegable que la contiene ("Quién administra este
 * negocio") — así que el dueño leía dos veces lo mismo antes de llegar
 * al formulario. El encabezado de la sección se conserva intacto; lo
 * que se fue es la repetición.
 */

import { useState, useTransition } from "react";
import { Card, CardVacia } from "@/components/panel/piezas";
import {
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  DETALLE,
  ESTADO_AVISO,
} from "@/components/panel/sistema";
import {
  ACCIONES_FILA,
  BOTON_FILA_PELIGRO,
  FilaFicha,
  LISTA_FICHAS,
} from "./fila-ficha";
import { agregarColaborador, quitarColaborador } from "./colaboradores-actions";

export type Colaborador = {
  usuario_id: string;
  email: string;
  nombre: string;
  creado_en: string;
};

export default function ColaboradoresPanel({
  ranchoId,
  colaboradores,
}: {
  ranchoId: string;
  colaboradores: Colaborador[];
}) {
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function invitar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    iniciar(async () => {
      const r = await agregarColaborador(ranchoId, correo);
      setAviso({ ok: r.ok, texto: r.mensaje });
      if (r.ok) setCorreo("");
    });
  }

  function quitar(usuarioId: string, email: string) {
    if (!confirm(`¿Quitarle el acceso a ${email}? Deja de ver este negocio de inmediato.`)) {
      return;
    }
    setAviso(null);
    iniciar(async () => {
      const r = await quitarColaborador(ranchoId, usuarioId);
      setAviso({ ok: r.ok, texto: r.mensaje });
    });
  }

  return (
    <>
      <Card
        eyebrow="Accesos"
        titulo="Dar acceso a alguien de tu equipo"
        accion={<span className={DETALLE}>Necesita cuenta en Bookea</span>}
      >
        <p className={`max-w-[62ch] leading-relaxed ${DETALLE}`}>
          Va a poder editar el negocio, el catálogo, la agenda, las reservas y los gastos — lo
          mismo que vos. No va a poder invitar a nadie más, ni borrar el negocio, ni ver tus
          documentos de verificación.
        </p>

        <form onSubmit={invitar} className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="correo-colab" className="sr-only">
            Correo de la persona
          </label>
          <input
            id="correo-colab"
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="correo@ejemplo.com"
            disabled={pendiente}
            className={`min-w-[200px] flex-1 disabled:opacity-60 ${CAMPO_PANEL}`}
          />
          <button
            type="submit"
            disabled={pendiente || correo.trim().length === 0}
            className={BOTON_PANEL_PRIMARIO}
          >
            {pendiente ? "Agregando…" : "Dar acceso"}
          </button>
        </form>

        <p className={`mt-2 ${DETALLE}`}>
          La persona ya tiene que tener una cuenta en Bookea con ese correo.
        </p>

        {aviso && (
          <p
            role="status"
            className={`mt-3 rounded-xl px-4 py-2.5 text-[13px] leading-relaxed ${
              aviso.ok ? ESTADO_AVISO.exito : ESTADO_AVISO.aviso
            }`}
          >
            {aviso.texto}
          </p>
        )}
      </Card>

      <Card
        eyebrow="Con acceso hoy"
        titulo="Quiénes entran a tu panel"
        accion={
          <span className={DETALLE}>
            {colaboradores.length === 0
              ? "Solo vos"
              : `Vos y ${colaboradores.length} más`}
          </span>
        }
      >
        {colaboradores.length === 0 ? (
          <CardVacia>Por ahora solo vos administrás este negocio.</CardVacia>
        ) : (
          <div className={LISTA_FICHAS}>
            {colaboradores.map((c, i) => (
              <FilaFicha
                key={c.usuario_id}
                separador={i < colaboradores.length - 1}
                marca="exito"
                medio={
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                    style={{
                      backgroundColor: "var(--acento-solido)",
                      color: "var(--acento-sobre)",
                    }}
                  >
                    {(c.nombre || c.email).trim().charAt(0).toUpperCase()}
                  </span>
                }
                titulo={<span className="break-words">{c.nombre || c.email}</span>}
                detalle={c.nombre ? <span className="break-words">{c.email}</span> : undefined}
                acciones={
                  <div className={ACCIONES_FILA}>
                    <button
                      type="button"
                      onClick={() => quitar(c.usuario_id, c.email)}
                      disabled={pendiente}
                      className={BOTON_FILA_PELIGRO}
                    >
                      Quitar acceso
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
