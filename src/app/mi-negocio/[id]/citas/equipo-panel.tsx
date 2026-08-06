"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { IconCamera } from "@/components/icons";
import MiembroConfig, { type Asignacion, type ServicioCita } from "./miembro-config";
import {
  actualizarMiembroEquipo,
  crearMiembroEquipo,
  eliminarMiembroEquipo,
  reordenarEquipo,
  type MiembroEquipo,
  type MiembroInput,
  type RangoHorarioMiembro,
} from "./actions";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

// Los nombres de archivo llegan tal cual del dispositivo del dueño —
// se limpian para que la ruta en el bucket sea siempre válida.
function nombreSeguro(nombre: string) {
  return nombre.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

type Borrador = {
  nombre: string;
  rol: string;
  fotoUrl: string | null;
  tipo: "profesional" | "espacio" | "equipo";
  capacidad: string;
};

const VACIO: Borrador = { nombre: "", rol: "", fotoUrl: null, tipo: "profesional", capacidad: "" };

const TIPO_LABEL: Record<Borrador["tipo"], string> = {
  profesional: "Persona",
  espacio: "Espacio (cabina, camilla, mesa...)",
  equipo: "Equipo (máquina, sillón...)",
};

function aInput(b: Borrador, activo: boolean): MiembroInput {
  const capacidad = b.capacidad.trim() ? Number(b.capacidad) : null;
  return {
    nombre: b.nombre,
    rol: b.rol,
    fotoUrl: b.fotoUrl,
    activo,
    tipo: b.tipo,
    capacidad: Number.isFinite(capacidad) ? capacidad : null,
  };
}

function deMiembro(m: MiembroEquipo): Borrador {
  return {
    nombre: m.nombre,
    rol: m.rol ?? "",
    fotoUrl: m.foto_url,
    tipo: m.tipo ?? "profesional",
    capacidad: m.capacidad ? String(m.capacidad) : "",
  };
}

/** El avatar de una persona del equipo: su foto o su inicial. */
function Avatar({ miembro }: { miembro: { nombre: string; foto_url: string | null } }) {
  if (miembro.foto_url) {
    return (
      <Image
        src={miembro.foto_url}
        alt={miembro.nombre}
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-full border border-aventurea-line object-cover"
      />
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[18px] font-bold text-white">
      {miembro.nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * El equipo del negocio de citas: quiénes atienden. Es lo que el
 * cliente elige al reservar ("con Kathy", "con cualquiera") y lo que
 * se muestra con foto en la página pública. Mismo patrón de CRUD que
 * el catálogo del panel.
 */
export default function EquipoPanel({
  ranchoId,
  initialEquipo,
  serviciosCita = [],
  asignaciones = [],
  horarios = {},
}: {
  ranchoId: string;
  initialEquipo: MiembroEquipo[];
  /** Los servicios de cita del catálogo, para asignar quién da qué. */
  serviciosCita?: ServicioCita[];
  /** Filas de servicios_recurso del negocio completo. */
  asignaciones?: Asignacion[];
  /** Filas de horarios_recurso por miembro. */
  horarios?: Record<string, RangoHorarioMiembro[]>;
}) {
  const [equipo, setEquipo] = useState(
    [...initialEquipo].sort((a, b) => a.orden - b.orden),
  );
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [pending, startTransition] = useTransition();

  async function subirFoto(file: File) {
    setError(null);
    setSubiendoFoto(true);
    // Mismo bucket público que las fotos del negocio; el equipo va en
    // su propia carpeta para no mezclarse con la galería.
    const supabase = createClient();
    const liviana = await comprimirImagen(file);
    const path = `${ranchoId}/equipo/${Date.now()}-${nombreSeguro(liviana.name)}`;
    const { error: errorSubida } = await supabase.storage
      .from("ranchos-fotos")
      .upload(path, liviana, { upsert: true });
    setSubiendoFoto(false);
    if (errorSubida) {
      setError("No se pudo subir la foto: " + errorSubida.message);
      return;
    }
    const { data } = supabase.storage.from("ranchos-fotos").getPublicUrl(path);
    setBorrador((b) => ({ ...b, fotoUrl: data.publicUrl }));
  }

  function guardarNuevo() {
    setError(null);
    startTransition(async () => {
      const res = await crearMiembroEquipo(ranchoId, aInput(borrador, true));
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.miembro) setEquipo((prev) => [...prev, res.miembro!]);
      setBorrador(VACIO);
    });
  }

  function guardarEdicion(miembro: MiembroEquipo) {
    setError(null);
    startTransition(async () => {
      const res = await actualizarMiembroEquipo(
        ranchoId,
        miembro.id,
        aInput(borrador, miembro.activo),
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.miembro) {
        setEquipo((prev) => prev.map((m) => (m.id === miembro.id ? res.miembro! : m)));
      }
      setEditando(null);
      setBorrador(VACIO);
    });
  }

  function alternarActivo(miembro: MiembroEquipo) {
    setError(null);
    startTransition(async () => {
      const res = await actualizarMiembroEquipo(
        ranchoId,
        miembro.id,
        aInput(deMiembro(miembro), !miembro.activo),
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.miembro) {
        setEquipo((prev) => prev.map((m) => (m.id === miembro.id ? res.miembro! : m)));
      }
    });
  }

  function mover(miembro: MiembroEquipo, direccion: -1 | 1) {
    const idx = equipo.findIndex((m) => m.id === miembro.id);
    const destino = idx + direccion;
    if (idx < 0 || destino < 0 || destino >= equipo.length) return;

    const anterior = equipo;
    const nuevo = [...equipo];
    [nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]];
    setEquipo(nuevo);
    setError(null);
    startTransition(async () => {
      const res = await reordenarEquipo(
        ranchoId,
        nuevo.map((m) => m.id),
      );
      if (res.error) {
        // El orden optimista no se quedó en la base: se revierte para
        // que la pantalla no cuente una historia que no existe.
        setEquipo(anterior);
        setError(res.error);
      }
    });
  }

  function borrar(miembro: MiembroEquipo) {
    if (!confirm(`¿Quitar a "${miembro.nombre}" del equipo?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarMiembroEquipo(ranchoId, miembro.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEquipo((prev) => prev.filter((m) => m.id !== miembro.id));
    });
  }

  const formulario = (
    onGuardar: () => void,
    textoBoton: string,
    onCancelar?: () => void,
  ) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelCls}>Nombre</label>
        <input
          type="text"
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          placeholder="Ej. Kathy"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Rol (opcional)</label>
        <input
          type="text"
          value={borrador.rol}
          onChange={(e) => setBorrador({ ...borrador, rol: e.target.value })}
          placeholder="Ej. Estilista, Barbero, Manicurista"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Qué es</label>
        {/* Un recurso físico (0061) también se agenda: la camilla del
            spa o el sillón de tatuar son "alguien" con quien reservar. */}
        <select
          value={borrador.tipo}
          onChange={(e) =>
            setBorrador({ ...borrador, tipo: e.target.value as Borrador["tipo"] })
          }
          className={inputCls}
        >
          {(Object.keys(TIPO_LABEL) as Borrador["tipo"][]).map((t) => (
            <option key={t} value={t}>
              {TIPO_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      {/* La columna `capacidad` (0076) es de las mesas de restaurantes:
          el motor de citas agenda 1 cita a la vez por recurso, así que
          acá no se ofrece — prometer "4 a la vez" sería mentira. */}

      <div className="sm:col-span-2">
        <label className={labelCls}>Foto (opcional)</label>
        <div className="flex flex-wrap items-center gap-3">
          {borrador.fotoUrl && (
            <Image
              src={borrador.fotoUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border border-aventurea-line object-cover"
            />
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-sky">
            <IconCamera className="h-4 w-4" />
            {subiendoFoto
              ? "Subiendo..."
              : borrador.fotoUrl
                ? "Cambiar foto"
                : "Subir foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={subiendoFoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) subirFoto(file);
                e.target.value = "";
              }}
            />
          </label>
          {borrador.fotoUrl && (
            <button
              type="button"
              onClick={() => setBorrador({ ...borrador, fotoUrl: null })}
              className="text-[12.5px] font-bold text-red-700 underline"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onGuardar}
          disabled={pending || subiendoFoto || !borrador.nombre.trim()}
          className="rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : textoBoton}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={pending}
            className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-sky hover:text-aventurea-orange"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}

      {equipo.length === 0 && (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
          Todavía no agregaste a nadie. Si trabajás con más personas,
          agregalas acá: el cliente va a poder elegir <strong>con quién</strong>{" "}
          atenderse al reservar. Si atendés solo vos, podés dejarlo vacío — las
          citas se toman contra el horario del negocio.
        </p>
      )}

      {equipo.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {equipo.map((miembro, idx) =>
            editando === miembro.id ? (
              <div
                key={miembro.id}
                className="border-b border-aventurea-line p-4 last:border-none"
              >
                {formulario(
                  () => guardarEdicion(miembro),
                  "Guardar cambios",
                  () => {
                    setEditando(null);
                    setBorrador(VACIO);
                  },
                )}
              </div>
            ) : (
              <div
                key={miembro.id}
                className={`flex flex-wrap items-center gap-3 border-b border-aventurea-line px-4 py-3 last:border-none ${
                  miembro.activo ? "" : "opacity-50"
                }`}
              >
                <Avatar miembro={miembro} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-aventurea-ink">
                    {miembro.nombre}
                    {miembro.tipo && miembro.tipo !== "profesional" && (
                      <span className="ml-2 rounded-lg bg-aventurea-navy/10 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-navy">
                        {miembro.tipo === "espacio" ? "Espacio" : "Equipo"}
                      </span>
                    )}
                    {!miembro.activo && (
                      <span className="ml-2 rounded-lg bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-zinc-500">
                        Pausado
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                    {miembro.rol && <span>{miembro.rol}</span>}
                    {(horarios[miembro.id]?.length ?? 0) > 0 && (
                      <span className={miembro.rol ? "ml-2" : ""}>· horario propio</span>
                    )}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setConfigurando(configurando === miembro.id ? null : miembro.id)
                    }
                    className={`h-[30px] rounded-lg px-2.5 text-xs font-bold disabled:opacity-40 ${
                      configurando === miembro.id
                        ? "bg-aventurea-navy text-white"
                        : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
                    }`}
                  >
                    Horario y servicios
                  </button>
                  <button
                    type="button"
                    disabled={pending || idx === 0}
                    onClick={() => mover(miembro, -1)}
                    aria-label="Subir"
                    className="h-[30px] w-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-xs font-bold text-aventurea-ink hover:border-aventurea-sky disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending || idx === equipo.length - 1}
                    onClick={() => mover(miembro, 1)}
                    aria-label="Bajar"
                    className="h-[30px] w-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-xs font-bold text-aventurea-ink hover:border-aventurea-sky disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEditando(miembro.id);
                      setBorrador(deMiembro(miembro));
                    }}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange disabled:opacity-40"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => alternarActivo(miembro)}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange disabled:opacity-40"
                  >
                    {miembro.activo ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => borrar(miembro)}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-300 disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </div>
                {configurando === miembro.id && (
                  <div className="w-full">
                    <MiembroConfig
                      ranchoId={ranchoId}
                      miembroId={miembro.id}
                      horarioInicial={horarios[miembro.id] ?? []}
                      serviciosCita={serviciosCita}
                      asignaciones={asignaciones}
                    />
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}

      {editando === null && (
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
          <h3 className="mb-4 text-[15px] font-bold text-aventurea-ink">
            Agregar a alguien del equipo
          </h3>
          {formulario(guardarNuevo, "Agregar")}
        </div>
      )}
    </div>
  );
}
