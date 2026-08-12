"use client";

import { useState, useTransition } from "react";
import {
  ETIQUETAS_PERMISO,
  permisosDeFila,
  type PermisoLealtad,
  type PermisosLealtad,
} from "@/lib/lealtad/permisos";
import { actualizarRolDelEquipo, invitarAlEquipo, quitarDelEquipo } from "./equipo-actions";

/**
 * La pestaña Equipo: el dueño decide con un checklist quién puede dar
 * sellos, canjear, revertir y ver la auditoría.
 *
 * Cada cambio se guarda al momento (sin botón "Guardar" aparte): un
 * permiso es algo que se quita YA, no algo que queda pendiente en un
 * formulario abierto.
 */

export type MiembroEquipo = {
  usuario_id: string;
  email: string;
  nombre: string;
  rol: string;
  permisos: PermisosLealtad;
};

const ORDEN_PERMISOS: PermisoLealtad[] = ["acreditar", "canjear", "revertir", "auditoria"];

export default function EquipoLealtad({
  ranchoId,
  equipo,
}: {
  ranchoId: string;
  equipo: MiembroEquipo[];
}) {
  const [filas, setFilas] = useState(equipo);
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function invitar() {
    iniciar(async () => {
      const res = await invitarAlEquipo(ranchoId, correo);
      setAviso(res.ok ? (res.codigo ?? "Listo.") : res.motivo);
      if (res.ok) setCorreo("");
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-aventurea-line bg-white p-4">
        <p className="text-[13px] font-bold text-aventurea-ink">Sumar a alguien del equipo</p>
        <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
          Entra como <strong>empleado</strong>: puede dar sellos y canjear. Lo demás se lo das
          vos abajo, casilla por casilla.
        </p>
        <div className="mt-2.5 flex gap-2">
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="correo@delempleado.com"
            className="flex-1 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={invitar}
            disabled={ocupado || !correo.trim()}
            className="shrink-0 rounded-[10px] bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
          >
            Invitar
          </button>
        </div>
        {aviso && <p className="mt-2 text-[12.5px] font-bold text-aventurea-ink">{aviso}</p>}
      </div>

      {filas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-5 text-center text-[13px] text-aventurea-ink-soft">
          Todavía trabajás en solitario. Cuando sumés a alguien, acá le marcás qué puede hacer.
        </p>
      ) : (
        filas.map((f) => (
          <FilaEquipo
            key={f.usuario_id}
            ranchoId={ranchoId}
            miembro={f}
            alQuitar={() =>
              setFilas((prev) => prev.filter((x) => x.usuario_id !== f.usuario_id))
            }
          />
        ))
      )}
    </div>
  );
}

function FilaEquipo({
  ranchoId,
  miembro,
  alQuitar,
}: {
  ranchoId: string;
  miembro: MiembroEquipo;
  alQuitar: () => void;
}) {
  const [rol, setRol] = useState(miembro.rol === "administrador" ? "administrador" : "empleado");
  const [permisos, setPermisos] = useState<PermisosLealtad>(miembro.permisos);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function guardar(rolNuevo: "administrador" | "empleado", permisosNuevos: PermisosLealtad) {
    iniciar(async () => {
      const res = await actualizarRolDelEquipo(ranchoId, miembro.usuario_id, rolNuevo, permisosNuevos);
      setError(res.ok ? null : res.motivo);
    });
  }

  function cambiarRol(nuevo: "administrador" | "empleado") {
    setRol(nuevo);
    // Al bajar a empleado no se hereda "todo": arranca del checklist
    // que ya tenía guardado — bajar de rol es RESTRINGIR.
    guardar(nuevo, permisos);
  }

  function alternar(p: PermisoLealtad) {
    const nuevos = { ...permisos, [p]: !permisos[p] };
    setPermisos(nuevos);
    guardar("empleado", nuevos);
  }

  function quitar() {
    if (!confirm(`¿Quitar a ${miembro.nombre || miembro.email} del equipo?`)) return;
    iniciar(async () => {
      const res = await quitarDelEquipo(ranchoId, miembro.usuario_id);
      if (res.ok) alQuitar();
      else setError(res.motivo);
    });
  }

  const efectivos = rol === "administrador" ? permisosDeFila("administrador", null) : permisos;

  return (
    <div className="rounded-2xl border border-aventurea-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-aventurea-ink">
            {miembro.nombre || "Sin nombre"}
          </p>
          <p className="truncate text-[12px] text-aventurea-ink-soft">{miembro.email}</p>
        </div>
        <div className="flex gap-1">
          {(["empleado", "administrador"] as const).map((r) => (
            <button
              key={r}
              type="button"
              disabled={ocupado}
              onClick={() => cambiarRol(r)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                rol === r
                  ? "bg-aventurea-navy text-white"
                  : "bg-aventurea-cream-2 text-aventurea-ink-soft"
              }`}
            >
              {r === "empleado" ? "Empleado" : "Administrador"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={quitar}
          disabled={ocupado}
          className="text-[12px] font-bold text-red-700 underline"
        >
          Quitar
        </button>
      </div>

      {rol === "administrador" ? (
        <p className="mt-2.5 text-[12.5px] text-aventurea-ink-soft">
          Puede operar todo el módulo de lealtad: dar, canjear, revertir y ver la auditoría.
        </p>
      ) : (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {ORDEN_PERMISOS.map((p) => (
            <label
              key={p}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-aventurea-line px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={efectivos[p]}
                disabled={ocupado}
                onChange={() => alternar(p)}
                className="mt-0.5 h-4 w-4 accent-aventurea-navy"
              />
              <span>
                <span className="block text-[12.5px] font-bold text-aventurea-ink">
                  {ETIQUETAS_PERMISO[p].titulo}
                </span>
                <span className="block text-[11.5px] leading-snug text-aventurea-ink-soft">
                  {ETIQUETAS_PERMISO[p].detalle}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-[12.5px] font-bold text-red-700">{error}</p>}
    </div>
  );
}
