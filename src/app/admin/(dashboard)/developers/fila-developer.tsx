"use client";

import { useState, useTransition } from "react";
import {
  aprobarDeveloper,
  panicoDeveloper,
  rechazarDeveloper,
  verificarDominioDeveloper,
} from "./actions";

/**
 * Una solicitud de developer, con todo lo que hace falta para decidir
 * y nada más.
 *
 * El orden no es casual: primero QUÉ PIDE y PARA QUÉ (que es lo que se
 * juzga), después la identidad, y al final los botones. Un panel que
 * pone «Aprobar» arriba se aprueba sin leer.
 */

export type SolicitudDeveloper = {
  id: string;
  razon_social: string;
  cedula: string;
  correo_tecnico: string;
  correo_seguridad: string;
  sitio_web: string | null;
  sistema: string;
  uso_declarado: string;
  datos_que_almacena: string;
  scopes_solicitados: string[] | null;
  justificacion: Record<string, string> | null;
  ips_permitidas: string[] | null;
  dominio_verificado_en: string | null;
  acuerdo_version: string;
  acuerdo_hash: string;
  acuerdo_aceptado_en: string;
  estado: string;
  motivo_rechazo: string | null;
  solicitante_id: string;
  creada: string;
};

const COLOR_ESTADO: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-900",
  aprobado: "bg-emerald-100 text-emerald-900",
  rechazado: "bg-zinc-200 text-zinc-700",
  suspendido: "bg-red-100 text-red-900",
};

/** El permiso que abre la puerta a escribir se marca en rojo. */
const SCOPE_DELICADO = new Set(["acreditar", "canjear", "revertir"]);

export default function FilaDeveloper({
  solicitud,
  conexionesActivas,
}: {
  solicitud: SolicitudDeveloper;
  conexionesActivas: number;
}) {
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();

  const correr = (accion: () => Promise<{ ok: boolean; motivo?: string }>, exito: string) => {
    setError("");
    setMensaje("");
    iniciar(async () => {
      const r = await accion();
      if (r.ok) setMensaje(exito);
      else setError(r.motivo ?? "No se pudo.");
    });
  };

  const dominioDelCorreo = solicitud.correo_tecnico.split("@")[1] ?? "";
  const correoGratuito = /gmail|hotmail|outlook|yahoo|icloud|proton/i.test(dominioDelCorreo);

  return (
    <article className="rounded-2xl border border-aventurea-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-aventurea-ink">{solicitud.razon_social}</h3>
          <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
            {solicitud.sistema} · pedida el {solicitud.creada}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${
            COLOR_ESTADO[solicitud.estado] ?? "bg-zinc-100 text-zinc-700"
          }`}
        >
          {solicitud.estado}
          {conexionesActivas > 0 ? ` · ${conexionesActivas} negocio(s) conectado(s)` : ""}
        </span>
      </div>

      {/* Lo que pide, primero. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(solicitud.scopes_solicitados ?? []).map((s) => (
          <span
            key={s}
            className={`rounded-full px-2.5 py-1 font-mono text-[11.5px] font-bold ${
              SCOPE_DELICADO.has(s) ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {s}
            {SCOPE_DELICADO.has(s) ? " · escribe" : ""}
          </span>
        ))}
      </div>

      <Bloque titulo="Para qué dice que la va a usar">{solicitud.uso_declarado}</Bloque>
      <Bloque titulo="Qué guarda de su lado">{solicitud.datos_que_almacena}</Bloque>

      {solicitud.justificacion && Object.keys(solicitud.justificacion).length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Por qué pide cada permiso
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {Object.entries(solicitud.justificacion).map(([scope, texto]) => (
              <li key={scope} className="text-[13px] leading-relaxed text-aventurea-ink">
                <code className="font-mono text-[12px] font-bold">{scope}</code> — {texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* La identidad, y las señales que ayudan a dudar. */}
      <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
        <Dato etiqueta="Cédula" valor={solicitud.cedula} />
        <Dato etiqueta="Sitio" valor={solicitud.sitio_web ?? "—"} />
        <Dato
          etiqueta="Correo técnico"
          valor={solicitud.correo_tecnico}
          alerta={correoGratuito ? "correo gratuito, no de dominio propio" : null}
        />
        <Dato etiqueta="Correo de seguridad" valor={solicitud.correo_seguridad} />
        <Dato
          etiqueta="Dominio verificado"
          valor={solicitud.dominio_verificado_en ? "sí" : "no"}
          alerta={solicitud.dominio_verificado_en ? null : "sin probar control del dominio"}
        />
        <Dato
          etiqueta="IPs declaradas"
          valor={(solicitud.ips_permitidas ?? []).join(", ") || "ninguna (no se filtra por IP)"}
        />
        <Dato
          etiqueta="Acuerdo"
          valor={`v${solicitud.acuerdo_version} · ${solicitud.acuerdo_hash.slice(0, 12)}…`}
        />
      </dl>

      {solicitud.motivo_rechazo && (
        <p className="mt-3 rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[12.5px] text-zinc-700">
          Motivo del rechazo: {solicitud.motivo_rechazo}
        </p>
      )}

      {mensaje && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-bold text-emerald-800">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-800">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {solicitud.sitio_web && !solicitud.dominio_verificado_en && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              correr(() => verificarDominioDeveloper(solicitud.id), "Dominio verificado.")
            }
            className="rounded-xl border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink disabled:opacity-50"
            title={`Busca ${solicitud.sitio_web}/.well-known/bookea-developer.txt con el id adentro`}
          >
            Verificar dominio
          </button>
        )}

        {solicitud.estado === "pendiente" && (
          <>
            <input
              className="min-w-[220px] flex-1 rounded-xl border border-aventurea-line px-3.5 py-2 text-[13px] outline-none"
              placeholder="Nota o motivo (obligatorio para rechazar)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                correr(
                  () => aprobarDeveloper(solicitud.id, motivo),
                  "Aprobado. Todavía no tiene ninguna llave: eso lo decide cada negocio.",
                )
              }
              className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              Aprobar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => correr(() => rechazarDeveloper(solicitud.id, motivo), "Rechazada.")}
              className="rounded-xl border border-red-300 px-4 py-2 text-[12.5px] font-bold text-red-700 disabled:opacity-50"
            >
              Rechazar
            </button>
          </>
        )}

        {(solicitud.estado === "aprobado" || conexionesActivas > 0) && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              if (
                !window.confirm(
                  `PÁNICO: se apagan TODAS las llaves de ${solicitud.razon_social} en TODOS los negocios, ahora. ¿Seguro?`,
                )
              ) {
                return;
              }
              correr(
                () => panicoDeveloper(solicitud.id, motivo || "Pánico desde el panel de Bookea"),
                "Todas sus llaves quedaron apagadas y el developer, suspendido.",
              );
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            title="Para cuando la llave apareció en un repositorio público"
          >
            Pánico: apagar todo
          </button>
        )}
      </div>
    </article>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-aventurea-ink">
        {children}
      </p>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  alerta?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-x-2 border-b border-aventurea-line/60 py-1.5">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {etiqueta}
      </dt>
      <dd className="text-aventurea-ink">
        {valor}
        {alerta && <span className="ml-1.5 text-[11.5px] font-bold text-amber-700">⚠ {alerta}</span>}
      </dd>
    </div>
  );
}
