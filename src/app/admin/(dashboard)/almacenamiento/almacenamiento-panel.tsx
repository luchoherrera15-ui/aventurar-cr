"use client";

import { useMemo, useState } from "react";

export type FilaBucket = { bucket: string; archivos: number; bytes: number };
export type FilaUsuario = {
  usuario_id: string;
  email: string | null;
  nombre: string | null;
  archivos: number;
  bytes: number;
  bytes_sin_usar: number;
};
export type FilaInvitacion = {
  invitacion_id: string;
  titulo: string | null;
  slug: string | null;
  estado: string | null;
  cliente: string | null;
  creada: string | null;
  archivos: number;
  bytes: number;
};
export type FilaArchivo = {
  bucket: string;
  ruta: string;
  bytes: number;
  tipo: string | null;
  creado: string | null;
};

const TABS = [
  { id: "resumen", label: "Resumen", hint: "Cuánto pesa todo y dónde" },
  { id: "usuarios", label: "Por usuario", hint: "Quién guarda más megas" },
  { id: "invitaciones", label: "Por invitación", hint: "Cuál invitación pesa" },
  { id: "archivos", label: "Archivos pesados", hint: "Los más grandes, uno a uno" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/** 1234567 → "1,2 MB". Base 1024, como la cuenta de Supabase. */
export function pesoBonito(bytes: number): string {
  if (!bytes) return "0 B";
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(unidades.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const valor = bytes / Math.pow(1024, i);
  return `${valor.toFixed(valor >= 100 || i === 0 ? 0 : 1).replace(".", ",")} ${unidades[i]}`;
}

function Barra({ parte, total }: { parte: number; total: number }) {
  const pct = total > 0 ? Math.round((parte / total) * 100) : 0;
  return (
    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-aventurea-cream-2">
      <span
        className="block h-full rounded-full bg-aventurea-navy"
        style={{ width: `${Math.max(pct, parte > 0 ? 2 : 0)}%` }}
      />
    </span>
  );
}

const thCls =
  "px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function AlmacenamientoPanel({
  buckets,
  usuarios,
  invitaciones,
  archivos,
}: {
  buckets: FilaBucket[];
  usuarios: FilaUsuario[];
  invitaciones: FilaInvitacion[];
  archivos: FilaArchivo[];
}) {
  const [activa, setActiva] = useState<Tab>("resumen");

  const total = useMemo(
    () => buckets.reduce((s, b) => s + b.bytes, 0),
    [buckets],
  );
  const totalArchivos = useMemo(
    () => buckets.reduce((s, b) => s + b.archivos, 0),
    [buckets],
  );
  const sinUsar = useMemo(
    () => usuarios.reduce((s, u) => s + u.bytes_sin_usar, 0),
    [usuarios],
  );
  const enInvitaciones = useMemo(
    () => invitaciones.reduce((s, i) => s + i.bytes, 0),
    [invitaciones],
  );

  /**
   * Lo que el total tiene de más frente a la suma por cuenta: archivos
   * sin dueño en storage y sin invitación que los reclame. Se dice en
   * voz alta para que la tabla no parezca que miente.
   */
  const sinDueno = useMemo(
    () => Math.max(0, total - usuarios.reduce((s, u) => s + u.bytes, 0)),
    [total, usuarios],
  );

  const maxUsuario = Math.max(1, ...usuarios.map((u) => u.bytes));
  const maxInvitacion = Math.max(1, ...invitaciones.map((i) => i.bytes));

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de almacenamiento"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-1.5 shadow-sm"
      >
        {TABS.map((t) => {
          const sel = activa === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setActiva(t.id)}
              className={`basis-full rounded-xl px-4 py-2.5 text-left transition-colors sm:flex-1 sm:basis-0 ${
                sel
                  ? "bg-aventurea-navy text-white"
                  : "text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
              }`}
            >
              <span className="block text-[13.5px] font-bold">{t.label}</span>
              <span
                className={`mt-0.5 hidden text-[11.5px] sm:block ${
                  sel ? "text-white/70" : "text-aventurea-ink-soft"
                }`}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Resumen -------------------------------------------------- */}
      <div className={`mt-6 ${activa === "resumen" ? "" : "hidden"}`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-aventurea-navy p-5 text-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">
              Guardado en total
            </p>
            <p className="mt-2 text-2xl font-bold leading-tight tabular-nums">
              {pesoBonito(total)}
            </p>
            <p className="mt-2 text-[11.5px] text-white/70">
              {totalArchivos.toLocaleString("es-CR")} archivos
            </p>
          </div>
          <Tarjeta
            titulo="Invitaciones"
            valor={pesoBonito(enInvitaciones)}
            pie={`${invitaciones.length} con archivos · ${
              total > 0 ? Math.round((enInvitaciones / total) * 100) : 0
            }% del total`}
          />
          <Tarjeta
            titulo="Subidas sin usar"
            valor={pesoBonito(sinUsar)}
            pie={
              sinUsar > 0
                ? "Archivos que alguien subió y nunca se generaron"
                : "Nada colgando"
            }
            alerta={sinUsar > 50 * 1024 * 1024}
          />
          <Tarjeta
            titulo="Cuentas con archivos"
            valor={usuarios.length.toLocaleString("es-CR")}
            pie={
              usuarios[0]
                ? `El que más pesa: ${pesoBonito(usuarios[0].bytes)}`
                : "Todavía nadie subió nada"
            }
          />
        </div>

        <p className="mt-7 flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Por bucket
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-aventurea-cream-2/60">
              <tr>
                <th className={thCls}>Bucket</th>
                <th className={`${thCls} text-right`}>Archivos</th>
                <th className={`${thCls} text-right`}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 && <SinDatos colSpan={3} />}
              {buckets.map((b) => (
                <tr
                  key={b.bucket}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-4 py-3 font-bold text-aventurea-ink">{b.bucket}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-aventurea-ink-soft">
                    {b.archivos.toLocaleString("es-CR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold tabular-nums text-aventurea-ink">
                      {pesoBonito(b.bytes)}
                    </span>
                    <Barra parte={b.bytes} total={total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por usuario ---------------------------------------------- */}
      <div className={`mt-6 ${activa === "usuarios" ? "" : "hidden"}`}>
        {sinDueno > 0 && (
          <p className="mb-3 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[12.5px] text-aventurea-ink-soft">
            <strong className="text-aventurea-ink">{pesoBonito(sinDueno)}</strong> del
            total no tiene dueño identificable (archivos viejos subidos antes de que
            Storage guardara quién los mandaba); cuentan en el total pero no en esta
            tabla.
          </p>
        )}
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-aventurea-cream-2/60">
              <tr>
                <th className={thCls}>Cuenta</th>
                <th className={`${thCls} text-right`}>Archivos</th>
                <th className={`${thCls} text-right`}>Sin usar</th>
                <th className={`${thCls} text-right`}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && <SinDatos colSpan={4} />}
              {usuarios.map((u) => (
                <tr
                  key={u.usuario_id}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="px-4 py-3">
                    <span className="block font-bold text-aventurea-ink">
                      {u.nombre || u.email || "Cuenta sin nombre"}
                    </span>
                    {u.nombre && u.email && (
                      <span className="block text-[11.5px] text-aventurea-ink-soft">
                        {u.email}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-aventurea-ink-soft">
                    {u.archivos.toLocaleString("es-CR")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {u.bytes_sin_usar > 0 ? (
                      <span className="font-bold text-amber-700">
                        {pesoBonito(u.bytes_sin_usar)}
                      </span>
                    ) : (
                      <span className="text-aventurea-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold tabular-nums text-aventurea-ink">
                      {pesoBonito(u.bytes)}
                    </span>
                    <Barra parte={u.bytes} total={maxUsuario} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por invitación ------------------------------------------- */}
      <div className={`mt-6 ${activa === "invitaciones" ? "" : "hidden"}`}>
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-aventurea-cream-2/60">
              <tr>
                <th className={thCls}>Invitación</th>
                <th className={thCls}>Cliente</th>
                <th className={thCls}>Estado</th>
                <th className={`${thCls} text-right`}>Archivos</th>
                <th className={`${thCls} text-right`}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {invitaciones.length === 0 && <SinDatos colSpan={5} />}
              {invitaciones.map((i) => (
                <tr
                  key={i.invitacion_id}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="max-w-[280px] px-4 py-3">
                    <span className="block truncate font-bold text-aventurea-ink">
                      {i.titulo || "Sin título"}
                    </span>
                    {i.slug && (
                      <a
                        href={`/invitacion/${i.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-[11.5px] text-aventurea-navy hover:underline"
                      >
                        /{i.slug}
                      </a>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-aventurea-ink-soft">
                    {i.cliente || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-lg bg-aventurea-cream-2 px-2.5 py-1 text-[11px] font-bold capitalize text-aventurea-ink-soft">
                      {i.estado || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-aventurea-ink-soft">
                    {i.archivos}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold tabular-nums text-aventurea-ink">
                      {pesoBonito(i.bytes)}
                    </span>
                    <Barra parte={i.bytes} total={maxInvitacion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archivos pesados ----------------------------------------- */}
      <div className={`mt-6 ${activa === "archivos" ? "" : "hidden"}`}>
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-aventurea-cream-2/60">
              <tr>
                <th className={thCls}>Archivo</th>
                <th className={thCls}>Bucket</th>
                <th className={thCls}>Tipo</th>
                <th className={thCls}>Subido</th>
                <th className={`${thCls} text-right`}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {archivos.length === 0 && <SinDatos colSpan={5} />}
              {archivos.map((a) => (
                <tr
                  key={`${a.bucket}/${a.ruta}`}
                  className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
                >
                  <td className="max-w-[420px] truncate px-4 py-3 font-semibold text-aventurea-ink">
                    {a.ruta}
                  </td>
                  <td className="px-4 py-3 text-aventurea-ink-soft">{a.bucket}</td>
                  <td className="px-4 py-3 text-aventurea-ink-soft">{a.tipo || "—"}</td>
                  <td className="px-4 py-3 text-aventurea-ink-soft">
                    {a.creado ? a.creado.slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-aventurea-ink">
                    {pesoBonito(a.bytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  valor,
  pie,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  pie: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p
        className={`mt-2 text-2xl font-bold leading-tight tabular-nums ${
          alerta ? "text-amber-700" : "text-aventurea-ink"
        }`}
      >
        {valor}
      </p>
      <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">{pie}</p>
    </div>
  );
}

function SinDatos({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-8 text-center text-[13px] text-aventurea-ink-soft"
      >
        Todavía no hay nada guardado por acá.
      </td>
    </tr>
  );
}
