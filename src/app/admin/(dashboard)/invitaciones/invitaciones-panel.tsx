"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_PREGUNTAS, type PreguntaInvitacion } from "@/lib/invitaciones-preguntas";
import { SITIO_URL, urlQr } from "@/lib/qr";
import {
  archivarAlbum,
  archivarInvitacion,
  quitarDelCatalogo,
  asignarCliente,
  crearAlbum,
  guardarInvitacion,
  type DatosInvitacion,
} from "./actions";

/** El álbum de fotos de una invitación, para la columna del panel. */
export type AlbumAdmin = {
  id: string;
  slug: string;
  estado: string;
  fotos: number;
};

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
  /** Preguntas configurables del RSVP (0068; vacío si no hay o no corrió). */
  preguntas: PreguntaInvitacion[];
  album: AlbumAdmin | null;
};

/** Una pregunta como se edita en el formulario (opciones en un solo texto). */
type PreguntaForm = {
  etiqueta: string;
  tipo: "opciones" | "texto";
  /** Separadas por coma: "No, Vegetariano/a, Vegano/a". */
  opciones: string;
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
  preguntas: PreguntaForm[];
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
  preguntas: [],
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
    preguntas: i.preguntas.map((p) => ({
      etiqueta: p.etiqueta,
      tipo: p.tipo,
      opciones: (p.opciones ?? []).join(", "),
    })),
  };
}

/** Del formulario a la forma jsonb: ids p1…p3 y opciones como lista. */
function preguntasParaGuardar(preguntas: PreguntaForm[]): PreguntaInvitacion[] {
  return preguntas
    .filter((p) => p.etiqueta.trim())
    .slice(0, MAX_PREGUNTAS)
    .map((p, idx) => ({
      id: `p${idx + 1}`,
      etiqueta: p.etiqueta.trim(),
      tipo: p.tipo,
      ...(p.tipo === "opciones"
        ? {
            opciones: p.opciones
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
    }));
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
      preguntas: preguntasParaGuardar(form.preguntas),
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

  function asignarClienteA(i: InvitacionAdmin) {
    // prompt() y no un modal propio: esto es el paso operativo que
    // faltaba y hacia falta hoy. El correo se valida del lado del
    // servidor contra las cuentas registradas.
    const correo = window.prompt(
      `Correo de la cuenta que va a ser dueña de "${i.titulo}".\n\n` +
        "Tiene que ser una cuenta ya registrada. Dejalo vacío para quitarle el dueño.",
      i.clienteCorreo ?? "",
    );
    if (correo === null) return;
    setError(null);
    startTransition(async () => {
      const res = await asignarCliente(i.id, correo);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function quitarDelCatalogoA(i: InvitacionAdmin) {
    setError(null);
    startTransition(async () => {
      const res = await quitarDelCatalogo(i.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function crearAlbumDe(i: InvitacionAdmin) {
    setError(null);
    startTransition(async () => {
      const res = await crearAlbum(i.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function archivarAlbumDe(album: AlbumAdmin) {
    setError(null);
    startTransition(async () => {
      const res = await archivarAlbum(album.id, album.estado !== "archivado");
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  // Edición de las preguntas del RSVP dentro del formulario.
  function preguntaCampo(idx: number, cambios: Partial<PreguntaForm>) {
    setForm((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((p, i) => (i === idx ? { ...p, ...cambios } : p)),
    }));
  }

  function agregarPregunta() {
    setForm((prev) =>
      prev.preguntas.length >= MAX_PREGUNTAS
        ? prev
        : {
            ...prev,
            preguntas: [...prev.preguntas, { etiqueta: "", tipo: "opciones", opciones: "" }],
          },
    );
  }

  function quitarPregunta(idx: number) {
    setForm((prev) => ({
      ...prev,
      preguntas: prev.preguntas.filter((_, i) => i !== idx),
    }));
  }

  /** Copia un link del sitio a partir de su ruta ("i/boda-x", "a/fotos-x"). */
  function copiarLink(ruta: string) {
    const url = `${window.location.origin}/${ruta}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiada(ruta);
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
            {/* Preguntas del RSVP: hasta 3, con respuestas cerradas
                (para poder contar "Vegetarianos: 5") o de texto libre. */}
            <div className="md:col-span-2">
              <label className={labelCls}>
                Preguntas del RSVP (máx. {MAX_PREGUNTAS} — el invitado las responde al
                confirmar)
              </label>
              <div className="grid gap-2.5">
                {form.preguntas.map((p, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 p-3 md:grid-cols-[1fr_auto_1fr_auto]"
                  >
                    <input
                      type="text"
                      value={p.etiqueta}
                      onChange={(e) => preguntaCampo(idx, { etiqueta: e.target.value })}
                      placeholder="¿Sos vegetariano/a o vegano/a?"
                      className={`${inputCls} bg-white`}
                    />
                    <select
                      value={p.tipo}
                      onChange={(e) =>
                        preguntaCampo(idx, { tipo: e.target.value as "opciones" | "texto" })
                      }
                      className={`${inputCls} bg-white md:w-[150px]`}
                    >
                      <option value="opciones">Opciones</option>
                      <option value="texto">Texto libre</option>
                    </select>
                    {p.tipo === "opciones" ? (
                      <input
                        type="text"
                        value={p.opciones}
                        onChange={(e) => preguntaCampo(idx, { opciones: e.target.value })}
                        placeholder="No, Vegetariano/a, Vegano/a (separadas por coma)"
                        className={`${inputCls} bg-white`}
                      />
                    ) : (
                      <p className="self-center text-[12px] text-aventurea-ink-soft">
                        El invitado escribe su respuesta.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => quitarPregunta(idx)}
                      className="self-center text-[12px] font-bold text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                {form.preguntas.length < MAX_PREGUNTAS && (
                  <button
                    type="button"
                    onClick={agregarPregunta}
                    className="justify-self-start rounded-[10px] border border-dashed border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                  >
                    ＋ Agregar pregunta
                  </button>
                )}
              </div>
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
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/cuenta/invitaciones-crear")}
              className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-2"
            >
              ✨ Generar con IA
            </button>
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
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="border-b border-aventurea-line text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    <th className="px-5 py-3">Invitación</th>
                    <th className="px-5 py-3">Link</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Confirmaciones</th>
                    <th className="px-5 py-3">Álbum</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.map((i) => {
                    // Constante local para que TypeScript conserve el
                    // "no es null" dentro de los onClick.
                    const album = i.album;
                    return (
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
                            onClick={() => copiarLink(`i/${i.slug}`)}
                            className="rounded-md border border-aventurea-line px-2 py-0.5 text-[11px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                          >
                            {copiada === `i/${i.slug}` ? "¡Copiado!" : "Copiar"}
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
                        {album ? (
                          <div className="flex items-start gap-2.5 text-[12px]">
                            {/* El QR chiquito a la vista; el link de al
                                lado abre el PNG de 300px para imprimir. */}
                            {/* eslint-disable-next-line @next/next/no-img-element -- QR generado por servicio externo */}
                            <img
                              src={urlQr(`${SITIO_URL}/a/${album.slug}`, 120)}
                              alt={`QR del álbum /a/${album.slug}`}
                              width={52}
                              height={52}
                              className="mt-0.5 h-[52px] w-[52px] shrink-0 rounded border border-aventurea-line bg-white p-0.5"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/a/${album.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-aventurea-navy hover:underline"
                                >
                                  /a/{album.slug}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => copiarLink(`a/${album.slug}`)}
                                  className="rounded-md border border-aventurea-line px-1.5 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                                >
                                  {copiada === `a/${album.slug}` ? "¡Copiado!" : "Copiar"}
                                </button>
                              </div>
                              <p className="mt-0.5 text-aventurea-ink-soft">
                                {album.fotos} foto{album.fotos === 1 ? "" : "s"}
                                {album.estado === "archivado" && " · archivado"}
                              </p>
                              <div className="mt-1 flex gap-2.5">
                                <a
                                  href={urlQr(`${SITIO_URL}/a/${album.slug}`)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-aventurea-navy hover:underline"
                                >
                                  QR imprimible
                                </a>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => archivarAlbumDe(album)}
                                  className="font-bold text-aventurea-ink-soft hover:text-aventurea-ink disabled:opacity-50"
                                >
                                  {album.estado === "archivado" ? "Reactivar" : "Archivar"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => crearAlbumDe(i)}
                            className="rounded-md border border-aventurea-line px-2.5 py-1 text-[11.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy disabled:opacity-50"
                          >
                            ＋ Crear álbum
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold uppercase ${ESTADO_CHIP[i.estado] ?? "bg-aventurea-cream-2 text-aventurea-ink-soft"}`}
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
                          {/* Saca la muestra del catálogo público. La
                              invitación del cliente no se toca: sigue
                              viva en su link de siempre. */}
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => asignarClienteA(i)}
                            className="text-[12.5px] font-bold text-aventurea-navy hover:underline disabled:opacity-50"
                          >
                            Asignar cliente
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => quitarDelCatalogoA(i)}
                            className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink disabled:opacity-50"
                          >
                            Quitar de ejemplos
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
