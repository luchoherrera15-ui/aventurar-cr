"use client";

import { useMemo, useState, useTransition } from "react";
import { enviarCampana, type ResultadoCampana } from "./actions";

export type PerfilCampana = {
  id: string;
  email: string;
  nombre: string | null;
  rol: "admin" | "dueno_rancho" | "cliente";
};

const ROLES = [
  { key: "todos", label: "Todos" },
  { key: "cliente", label: "Clientes" },
  { key: "dueno_rancho", label: "Proveedores" },
] as const;

type RolFiltro = (typeof ROLES)[number]["key"];

const ROL_LABEL: Record<PerfilCampana["rol"], string> = {
  admin: "Admin",
  dueno_rancho: "Proveedor",
  cliente: "Cliente",
};

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function CampanasPanel({
  perfiles,
}: {
  perfiles: PerfilCampana[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [rolFiltro, setRolFiltro] = useState<RolFiltro>("todos");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const [asunto, setAsunto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCampana | null>(null);
  const [enviando, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return perfiles.filter((p) => {
      if (rolFiltro !== "todos" && p.rol !== rolFiltro) return false;
      if (!texto) return true;
      return (
        (p.nombre ?? "").toLowerCase().includes(texto) ||
        p.email.toLowerCase().includes(texto)
      );
    });
  }, [perfiles, busqueda, rolFiltro]);

  const todosFiltradosMarcados =
    filtrados.length > 0 && filtrados.every((p) => seleccionados.has(p.id));

  function toggleUno(id: string) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function toggleTodosFiltrados() {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (todosFiltradosMarcados) {
        filtrados.forEach((p) => siguiente.delete(p.id));
      } else {
        filtrados.forEach((p) => siguiente.add(p.id));
      }
      return siguiente;
    });
  }

  const totalSeleccionados = seleccionados.size;

  function onEnviar() {
    setError(null);
    setResultado(null);

    if (totalSeleccionados === 0) {
      setError("Marcá al menos una persona en la tabla.");
      return;
    }
    if (!asunto.trim() || !titulo.trim() || !mensaje.trim()) {
      setError("Completá el asunto, el título y el mensaje.");
      return;
    }

    const ok = window.confirm(
      `¿Enviar la campaña a ${totalSeleccionados} persona${totalSeleccionados === 1 ? "" : "s"}? Esto no se puede deshacer.`,
    );
    if (!ok) return;

    const correos = perfiles
      .filter((p) => seleccionados.has(p.id))
      .map((p) => p.email);
    const cta =
      ctaLabel.trim() && ctaUrl.trim()
        ? { label: ctaLabel.trim(), href: ctaUrl.trim() }
        : undefined;

    startTransition(async () => {
      const res = await enviarCampana(correos, asunto, titulo, mensaje, cta);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResultado(res);
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
      {/* Destinatarios */}
      <section>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Destinatarios
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4.5 shadow-sm">
          <div className="min-w-[220px] flex-1">
            <label className={labelCls}>Buscar</label>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o correo"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Rol</label>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRolFiltro(r.key)}
                  className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                    rolFiltro === r.key
                      ? "bg-aventurea-ink text-white"
                      : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-aventurea-ink">
            <input
              type="checkbox"
              checked={todosFiltradosMarcados}
              onChange={toggleTodosFiltrados}
              className="h-4 w-4 accent-[#16295e]"
            />
            Seleccionar todos (los filtrados)
          </label>
          <span className="text-[12px] tabular-nums text-aventurea-ink-soft">
            {filtrados.length} cuenta{filtrados.length === 1 ? "" : "s"} en la
            lista · <strong className="text-aventurea-navy">{totalSeleccionados}</strong>{" "}
            seleccionada{totalSeleccionados === 1 ? "" : "s"}
          </span>
        </div>

        <div className="max-h-[520px] overflow-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-aventurea-cream-2">
                <th className="w-10 border-b border-aventurea-line px-4 py-3.5" />
                {["Nombre", "Correo", "Rol"].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-aventurea-line px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-[13.5px] text-zinc-500"
                  >
                    Ninguna cuenta coincide con la búsqueda.
                  </td>
                </tr>
              )}
              {filtrados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => toggleUno(p.id)}
                  className={`cursor-pointer border-b border-aventurea-line last:border-none ${
                    seleccionados.has(p.id)
                      ? "bg-aventurea-navy/[0.06]"
                      : "hover:bg-aventurea-cream-2/40"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(p.id)}
                      onChange={() => toggleUno(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-[#16295e]"
                    />
                  </td>
                  <td className="px-4 py-3 text-[13.5px] font-bold text-aventurea-ink">
                    {p.nombre?.trim() || "Sin nombre"}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-aventurea-ink-soft">
                    {p.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-lg bg-aventurea-cream-2 px-2.5 py-1 text-[11px] font-bold text-aventurea-ink-soft">
                      {ROL_LABEL[p.rol] ?? p.rol}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Compositor */}
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Compositor
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Armar el correo
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Sale con la plantilla de la marca: el título va grande en la
          tarjeta navy y el mensaje en la tarjeta blanca.
        </p>

        <div className="mt-4 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej. Novedades de Bookea este mes"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Título grande</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Estrenamos la vertical de citas"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Mensaje</label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={7}
              placeholder="Contales la novedad. Los saltos de línea se respetan en el correo."
              className={`${inputCls} resize-y leading-relaxed`}
            />
          </div>

          <div className="rounded-xl border border-dashed border-aventurea-line bg-aventurea-cream-2/50 p-3.5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-navy">
              Botón (opcional)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Etiqueta</label>
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Ej. Ver los negocios"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>URL</label>
                <input
                  type="url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://bookea.lat/..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-[10px] bg-red-50 p-3 text-[13px] text-red-700">
              {error}
            </p>
          )}

          {resultado && (
            <p className="rounded-[10px] bg-aventurea-navy p-3.5 text-[13px] font-bold text-white">
              Campaña enviada: {resultado.enviados} enviado
              {resultado.enviados === 1 ? "" : "s"} · {resultado.fallidos}{" "}
              fallido{resultado.fallidos === 1 ? "" : "s"}
              {(resultado.excluidos ?? 0) > 0
                ? ` · ${resultado.excluidos} fuera por baja o rebote`
                : ""}
              .
            </p>
          )}

          <button
            type="button"
            disabled={enviando}
            onClick={onEnviar}
            className="h-[44px] rounded-xl bg-aventurea-navy px-6 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
          >
            {enviando
              ? `Enviando a ${totalSeleccionados} persona${totalSeleccionados === 1 ? "" : "s"}…`
              : `Enviar campaña a ${totalSeleccionados} persona${totalSeleccionados === 1 ? "" : "s"}`}
          </button>
          {enviando && (
            <p className="text-[12px] text-aventurea-ink-soft">
              Enviando por lotes para no saturar el servicio de correo — no
              cierres esta pestaña.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
