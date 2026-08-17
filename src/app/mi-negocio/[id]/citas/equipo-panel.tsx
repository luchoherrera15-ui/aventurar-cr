"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { IconCamera, IconChevronDown } from "@/components/icons";
import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  DETALLE,
  ESTADO_AVISO,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import {
  ACCIONES_FILA,
  BOTON_FILA,
  BOTON_FILA_ICONO,
  BOTON_FILA_PELIGRO,
  FilaFicha,
  LISTA_FICHAS,
} from "../fila-ficha";
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

/** El avatar de una persona del equipo: su foto o su inicial.
 *
 *  La inicial va sobre el ACENTO del tipo de negocio, no sobre el navy
 *  fijo: es la misma cara que ya tienen los avatares del CRM, y así una
 *  barbería y un consultorio no se ven igual. `sobreSolido` sobre
 *  `solido` ≥5,18:1 en los ocho acentos del catálogo. */
function Avatar({ miembro }: { miembro: { nombre: string; foto_url: string | null } }) {
  if (miembro.foto_url) {
    return (
      <Image
        src={miembro.foto_url}
        alt=""
        width={48}
        height={48}
        className="h-11 w-11 shrink-0 rounded-full border border-aventurea-line object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[17px] font-bold"
      style={{ backgroundColor: "var(--acento-solido)", color: "var(--acento-sobre)" }}
    >
      {miembro.nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * El equipo del negocio de citas: quiénes atienden. Es lo que el
 * cliente elige al reservar ("con Kathy", "con cualquiera") y lo que
 * se muestra con foto en la página pública. Mismo patrón de CRUD que
 * el catálogo del panel.
 *
 * ── LA FORMA ───────────────────────────────────────────────────────
 * Dos tarjetas del panel: la LISTA de quiénes atienden y, aparte, el
 * ALTA. Antes eran dos bloques con el mismo peso y sin encabezado, así
 * que el formulario de agregar se leía como una ficha más de la lista.
 *
 * Una ficha pausada ya no baja su opacidad: lleva su píldora «Pausado»
 * y la barrita gris del estado neutro. Bajarle la opacidad a la fila
 * entera le bajaba el contraste al nombre, al rol y a los seis botones
 * —justo los que hay que apretar para volver a activarla— por debajo
 * de AA.
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
        <label className={`mb-1.5 block ${ROTULO_CAMPO}`}>Nombre</label>
        <input
          type="text"
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          placeholder="Ej. Kathy"
          className={CAMPO_PANEL}
        />
      </div>
      <div>
        <label className={`mb-1.5 block ${ROTULO_CAMPO}`}>Rol (opcional)</label>
        <input
          type="text"
          value={borrador.rol}
          onChange={(e) => setBorrador({ ...borrador, rol: e.target.value })}
          placeholder="Ej. Estilista, Barbero, Manicurista"
          className={CAMPO_PANEL}
        />
      </div>

      <div>
        <label className={`mb-1.5 block ${ROTULO_CAMPO}`}>Qué es</label>
        {/* Un recurso físico (0061) también se agenda: la camilla del
            spa o el sillón de tatuar son "alguien" con quien reservar. */}
        <select
          value={borrador.tipo}
          onChange={(e) =>
            setBorrador({ ...borrador, tipo: e.target.value as Borrador["tipo"] })
          }
          className={CAMPO_PANEL}
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
        <label className={`mb-1.5 block ${ROTULO_CAMPO}`}>Foto (opcional)</label>
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
          <label className={`cursor-pointer ${BOTON_PANEL}`}>
            <IconCamera />
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

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onGuardar}
          disabled={pending || subiendoFoto || !borrador.nombre.trim()}
          className={BOTON_PANEL_PRIMARIO}
        >
          {pending ? "Guardando..." : textoBoton}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} disabled={pending} className={BOTON_PANEL}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );

  const activos = equipo.filter((m) => m.activo).length;

  return (
    <>
      {error && (
        <p role="alert" className={`rounded-xl p-3.5 text-[13px] ${ESTADO_AVISO.alerta}`}>
          {error}
        </p>
      )}

      <Card
        eyebrow="Quiénes atienden"
        titulo="Tu equipo"
        accion={
          equipo.length > 0 ? (
            <span className={DETALLE}>
              {activos} activo{activos === 1 ? "" : "s"} de {equipo.length}
            </span>
          ) : undefined
        }
      >
        {equipo.length === 0 ? (
          <CardVacia>
            Todavía no agregaste a nadie. Si trabajás con más personas, agregalas acá: el
            cliente va a poder elegir <strong>con quién</strong> atenderse al reservar. Si
            atendés solo vos, podés dejarlo vacío — las citas se toman contra el horario del
            negocio.
          </CardVacia>
        ) : (
          <div className={LISTA_FICHAS}>
            {equipo.map((miembro, idx) => {
              const ultima = idx === equipo.length - 1;
              if (editando === miembro.id) {
                return (
                  <div
                    key={miembro.id}
                    className={`p-3.5 sm:p-4 ${ultima ? "" : "border-b border-aventurea-line"}`}
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
                );
              }
              return (
                <div key={miembro.id}>
                  <FilaFicha
                    separador={!ultima && configurando !== miembro.id}
                    marca={miembro.activo ? "exito" : "neutro"}
                    medio={<Avatar miembro={miembro} />}
                    titulo={
                      <>
                        <span className="break-words">{miembro.nombre}</span>
                        {miembro.tipo && miembro.tipo !== "profesional" && (
                          <PildoraEstado estado="info">
                            {miembro.tipo === "espacio" ? "Espacio" : "Equipo"}
                          </PildoraEstado>
                        )}
                        {!miembro.activo && (
                          <PildoraEstado estado="neutro">Pausado</PildoraEstado>
                        )}
                      </>
                    }
                    detalle={
                      miembro.rol || (horarios[miembro.id]?.length ?? 0) > 0 ? (
                        <span>
                          {miembro.rol}
                          {miembro.rol && (horarios[miembro.id]?.length ?? 0) > 0 ? " · " : ""}
                          {(horarios[miembro.id]?.length ?? 0) > 0 ? "horario propio" : ""}
                        </span>
                      ) : undefined
                    }
                    acciones={
                      <div className={ACCIONES_FILA}>
                        <button
                          type="button"
                          disabled={pending}
                          aria-expanded={configurando === miembro.id}
                          onClick={() =>
                            setConfigurando(configurando === miembro.id ? null : miembro.id)
                          }
                          // El único botón que "queda apretado" del
                          // racimo: se pinta con el acento sólido, que
                          // es el mismo lenguaje del filtro activo del
                          // CRM. Nada de alfas para marcar el estado.
                          style={
                            configurando === miembro.id
                              ? {
                                  backgroundColor: "var(--acento-solido)",
                                  borderColor: "var(--acento-solido)",
                                  color: "var(--acento-sobre)",
                                }
                              : undefined
                          }
                          className={
                            configurando === miembro.id
                              ? "inline-flex h-8 shrink-0 items-center rounded-lg border px-2.5 text-[12px] font-bold"
                              : BOTON_FILA
                          }
                        >
                          Horario y servicios
                        </button>
                        <button
                          type="button"
                          disabled={pending || idx === 0}
                          onClick={() => mover(miembro, -1)}
                          aria-label={`Subir a ${miembro.nombre}`}
                          className={BOTON_FILA_ICONO}
                        >
                          <IconChevronDown className="h-3.5 w-3.5 rotate-180" />
                        </button>
                        <button
                          type="button"
                          disabled={pending || idx === equipo.length - 1}
                          onClick={() => mover(miembro, 1)}
                          aria-label={`Bajar a ${miembro.nombre}`}
                          className={BOTON_FILA_ICONO}
                        >
                          <IconChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setEditando(miembro.id);
                            setBorrador(deMiembro(miembro));
                          }}
                          className={BOTON_FILA}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => alternarActivo(miembro)}
                          className={BOTON_FILA}
                        >
                          {miembro.activo ? "Pausar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => borrar(miembro)}
                          className={BOTON_FILA_PELIGRO}
                        >
                          Quitar
                        </button>
                      </div>
                    }
                  />
                  {configurando === miembro.id && (
                    <div
                      className={`px-3.5 pb-3.5 sm:px-4 sm:pb-4 ${
                        ultima ? "" : "border-b border-aventurea-line"
                      }`}
                    >
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
              );
            })}
          </div>
        )}
      </Card>

      {editando === null && (
        <Card eyebrow="Alta" titulo="Agregar a alguien del equipo">
          <div className={`rounded-2xl p-3.5 sm:p-4 ${SUPERFICIE_HUNDIDA}`}>
            {formulario(guardarNuevo, "Agregar")}
          </div>
        </Card>
      )}
    </>
  );
}
