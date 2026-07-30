"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archivarInvitacion, guardarInvitacion, type DatosInvitacion } from "./actions";

/** Una invitación con su cliente y el resumen de confirmaciones. */
export type InvitacionAdmin = {
  id: string;
  slug: string;
  titulo: string;
  anfitriones: string | null;
  mensaje: string | null;
  fecha_evento: string;
  hora: string | null;
  lugar_nombre: string | null;
  direccion: string | null;
  maps_url: string | null;
  portada_url: string | null;
  html_personalizado: string | null;
  tema: string;
  estado: string;
  clienteCorreo: string | null;
  confirmadosSi: number;
  confirmadosNo: number;
  /** Personas que sí van, contando a cada invitado + sus acompañantes. */
  totalPersonas: number;
};

type Formulario = {
  slug: string;
  titulo: string;
  anfitriones: string;
  mensaje: string;
  fechaEvento: string;
  hora: string;
  lugarNombre: string;
  direccion: string;
  mapsUrl: string;
  portadaUrl: string;
  htmlPersonalizado: string;
  estado: "borrador" | "activa";
  clienteCorreo: string;
};

const FORM_VACIO: Formulario = {
  slug: "",
  titulo: "",
  anfitriones: "",
  mensaje: "",
  fechaEvento: "",
  hora: "",
  lugarNombre: "",
  direccion: "",
  mapsUrl: "",
  portadaUrl: "",
  htmlPersonalizado: "",
  estado: "activa",
  clienteCorreo: "",
};

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

const ESTADO_CHIP: Record<string, string> = {
  activa: "bg-aventurea-green-light text-aventurea-green",
  borrador: "bg-aventurea-cream-2 text-aventurea-ink-soft",
  archivada: "bg-zinc-200 text-zinc-500",
};

function deFila(i: InvitacionAdmin): Formulario {
  return {
    slug: i.slug,
    titulo: i.titulo,
    anfitriones: i.anfitriones ?? "",
    mensaje: i.mensaje ?? "",
    fechaEvento: i.fecha_evento,
    hora: i.hora ?? "",
    lugarNombre: i.lugar_nombre ?? "",
    direccion: i.direccion ?? "",
    mapsUrl: i.maps_url ?? "",
    portadaUrl: i.portada_url ?? "",
    htmlPersonalizado: i.html_personalizado ?? "",
    estado: i.estado === "borrador" ? "borrador" : "activa",
    clienteCorreo: i.clienteCorreo ?? "",
  };
}

/**
 * El panel de invitaciones digitales: la lista con cada link, su
 * cliente y el pulso de confirmaciones, más el formulario de crear /
 * editar. Las escrituras van por acciones de servidor con la llave de
 * servicio — acá solo viaja el formulario.
 */
export default function InvitacionesPanel({
  invitaciones,
}: {
  invitaciones: InvitacionAdmin[];
}) {
  const router = useRouter();
  // null = lista; "nueva" = creando; un id = editando esa invitación.
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrirNueva() {
    setForm(FORM_VACIO);
    setError(null);
    setAbierta("nueva");
  }

  function abrirEdicion(i: InvitacionAdmin) {
    setForm(deFila(i));
    setError(null);
    setAbierta(i.id);
  }

  function cerrar() {
    setAbierta(null);
    setError(null);
  }

  function campo<K extends keyof Formulario>(k: K, v: Formulario[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function guardar() {
    const id = abierta === "nueva" ? null : abierta;
    const datos: DatosInvitacion = {
      slug: form.slug,
      titulo: form.titulo,
      anfitriones: form.anfitriones || null,
      mensaje: form.mensaje || null,
      fechaEvento: form.fechaEvento,
      hora: form.hora || null,
      lugarNombre: form.lugarNombre || null,
      direccion: form.direccion || null,
      mapsUrl: form.mapsUrl || null,
      portadaUrl: form.portadaUrl || null,
      htmlPersonalizado: form.htmlPersonalizado || null,
      tema: "clasico",
      estado: form.estado,
      clienteCorreo: form.clienteCorreo || null,
    };
    startTransition(async () => {
      const res = await guardarInvitacion(id, datos);
      if (res.error) {
        setError(res.error);
        return;
      }
      cerrar();
      router.refresh();
    });
  }

  function archivar(i: InvitacionAdmin) {
    startTransition(async () => {
      const res = await archivarInvitacion(i.id, i.estado !== "archivada");
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function copiarLink(slug: string) {
    const url = `${window.location.origin}/i/${slug}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiada(slug);
      setTimeout(() => setCopiada(null), 1600);
    });
  }

  return (
    <div>
      {error && abierta === null && (
        <p className="mb-4 rounded-xl bg-red-50 p-3.5 text-[13px] text-red-700">{error}</p>
      )}

      {/* ---------- Formulario de crear / editar ---------- */}
      {abierta !== null ? (
        <div className="rounded-2xl border border-aventurea-line bg-white p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-bold text-aventurea-ink">
              {abierta === "nueva" ? "Nueva invitación" : "Editar invitación"}
            </h2>
            <button
              type="button"
              onClick={cerrar}
              className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
            >
              ← Volver a la lista
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Título *</label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => campo("titulo", e.target.value)}
                placeholder="La boda de Sofía & Andrés"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Slug del link (bookea.lat/i/…)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => campo("slug", e.target.value)}
                placeholder="Vacío = se genera del título"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Correo del cliente</label>
              <input
                type="email"
                value={form.clienteCorreo}
                onChange={(e) => campo("clienteCorreo", e.target.value)}
                placeholder="cliente@correo.com (debe tener cuenta)"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Anfitriones</label>
              <input
                type="text"
                value={form.anfitriones}
                onChange={(e) => campo("anfitriones", e.target.value)}
                placeholder="Familias Jiménez y Vargas"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fecha del evento *</label>
              <input
                type="date"
                value={form.fechaEvento}
                onChange={(e) => campo("fechaEvento", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="text"
                value={form.hora}
                onChange={(e) => campo("hora", e.target.value)}
                placeholder="4:00 p. m."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Nombre del lugar</label>
              <input
                type="text"
                value={form.lugarNombre}
                onChange={(e) => campo("lugarNombre", e.target.value)}
                placeholder="Hacienda Los Sueños"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => campo("direccion", e.target.value)}
                placeholder="San Rafael de Escazú, 800 m oeste de…"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Link de Google Maps (opcional)</label>
              <input
                type="url"
                value={form.mapsUrl}
                onChange={(e) => campo("mapsUrl", e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Foto de portada (URL, opcional)</label>
              <input
                type="url"
                value={form.portadaUrl}
                onChange={(e) => campo("portadaUrl", e.target.value)}
                placeholder="https://…/portada.jpg"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Mensaje de la invitación</label>
              <textarea
                rows={3}
                value={form.mensaje}
                onChange={(e) => campo("mensaje", e.target.value)}
                placeholder="Nos hace muchísima ilusión celebrar este día con vos…"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>
                HTML personalizado (opcional — reemplaza la plantilla; el bloque de
                confirmación se agrega solo)
              </label>
              <textarea
                rows={6}
                value={form.htmlPersonalizado}
                onChange={(e) => campo("htmlPersonalizado", e.target.value)}
                placeholder="<div>…diseño a la medida…</div>"
                className={`${inputCls} font-mono text-[12.5px]`}
              />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select
                value={form.estado}
                onChange={(e) => campo("estado", e.target.value as "borrador" | "activa")}
                className={inputCls}
              >
                <option value="activa">Activa (link público)</option>
                <option value="borrador">Borrador (aún no visible)</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3.5 text-[13px] text-red-700">{error}</p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={guardar}
              className="rounded-xl bg-aventurea-navy px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
            >
              {pending ? "Guardando…" : abierta === "nueva" ? "Crear invitación" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={cerrar}
              className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={abrirNueva}
              className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
            >
              ＋ Nueva invitación
            </button>
          </div>

          {/* ---------- La lista ---------- */}
          {invitaciones.length === 0 ? (
            <p className="rounded-2xl border border-aventurea-line bg-white p-8 text-center text-[13.5px] text-aventurea-ink-soft">
              Todavía no hay invitaciones — creá la primera con el botón de arriba.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-white">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="border-b border-aventurea-line text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    <th className="px-5 py-3">Invitación</th>
                    <th className="px-5 py-3">Link</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Confirmaciones</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.map((i) => (
                    <tr key={i.id} className="border-b border-aventurea-line last:border-none">
                      <td className="px-5 py-3.5">
                        <p className="text-[13.5px] font-bold text-aventurea-ink">{i.titulo}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/i/${i.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12.5px] font-semibold text-aventurea-navy hover:underline"
                          >
                            /i/{i.slug}
                          </a>
                          <button
                            type="button"
                            onClick={() => copiarLink(i.slug)}
                            className="rounded-md border border-aventurea-line px-2 py-0.5 text-[11px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                          >
                            {copiada === i.slug ? "¡Copiado!" : "Copiar"}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] text-aventurea-ink-soft">
                        {i.clienteCorreo ?? <span className="text-zinc-400">Sin asignar</span>}
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] tabular-nums text-aventurea-ink">
                        {i.fecha_evento}
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] text-aventurea-ink">
                        <span className="font-bold text-aventurea-green">{i.confirmadosSi} sí</span>
                        {" · "}
                        <span className="text-aventurea-ink-soft">{i.confirmadosNo} no</span>
                        {" · "}
                        <span className="font-semibold">
                          {i.totalPersonas} persona{i.totalPersonas === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase ${ESTADO_CHIP[i.estado] ?? "bg-aventurea-cream-2 text-aventurea-ink-soft"}`}
                        >
                          {i.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => abrirEdicion(i)}
                            className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => archivar(i)}
                            className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink disabled:opacity-50"
                          >
                            {i.estado === "archivada" ? "Reactivar" : "Archivar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
