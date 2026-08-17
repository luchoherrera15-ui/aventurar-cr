"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SCOPES_ENTREGA_1 } from "@/lib/lealtad/api/acuerdo";
import {
  autorizarDeveloper,
  emitirLlaveApi,
  revocarAutorizacionApi,
  revocarLlaveApi,
  romperCorrelacionApi,
  type LlaveNueva,
} from "./developers-actions";

/**
 * LA PANTALLA DONDE EL NEGOCIO DECIDE.
 *
 * Dos cosas la gobiernan, y las dos son deliberadas:
 *
 * 1. LA PANTALLA DE CONSENTIMIENTO PONE PRIMERO EL «NO VA A PODER».
 *    El vendedor del POS le va a decir al dueño «dele Autorizar» y el
 *    dueño le va a dar. Ese clic apurado no se arregla con más letra —
 *    se arregla haciendo que lo máximo que concede sean sellos y
 *    saldos seudónimos. Aun así, lo que NO se concede va arriba y en
 *    rojo, porque es la parte que le importa a la señora cuyos datos
 *    están en juego.
 *
 * 2. EL BOTÓN DE DESCONECTAR ESTÁ AL LADO DEL DE CONECTAR. El control
 *    que no se ve, no se ejerce.
 *
 * El secreto de la llave se muestra UNA vez, acá, en el momento de
 * crearla. No pasa por Bookea, ni por un correo, ni por un ticket.
 */

const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";
const TINTE = "rgba(157,180,255,.14)";
const BORDE = "rgba(157,180,255,.45)";

export type TarjetaElegible = { id: string; nombre: string; tieneTopeDiario: boolean };
export type DeveloperAdmitido = {
  id: string;
  nombre: string;
  sistema: string;
  sitio: string | null;
  dominioVerificado: boolean;
};
export type LlaveEnPantalla = {
  id: string;
  kid: string;
  sufijo: string;
  estado: string;
  etiqueta: string | null;
  expiraEn: string;
  ultimaUsada: string | null;
};
export type ConexionApi = {
  id: string;
  desarrollador: string;
  tarjeta: string;
  scopes: string[];
  estado: string;
  mostrarIniciales: boolean;
  autorizadaEn: string;
  llaves: LlaveEnPantalla[];
};
export type ActividadApi = {
  id: string;
  kid: string;
  llamada: string;
  estado: number;
  error: string | null;
  puntos: number | null;
  cuando: string;
};

const NO_VA_A_PODER = [
  "Ver el correo, el teléfono ni las notas de tus clientes",
  "Ver la lista de tus clientes, ni buscarlos por ningún dato",
  "Canjear un premio ni revertir un movimiento",
  "Cambiar las reglas de tu programa",
  "Ver tus otros negocios ni tus otras tarjetas",
  "Ver tu agenda, tus finanzas ni tus cobros",
];

const SI_VA_A_PODER = [
  "Darle sellos o puntos a un cliente al cobrarle",
  "Consultar el saldo de una tarjeta que le presenten",
];

export default function DevelopersLealtad({
  ranchoId,
  tarjetas,
  admitidos,
  conexiones,
  actividad,
  falta,
}: {
  ranchoId: string;
  tarjetas: TarjetaElegible[];
  admitidos: DeveloperAdmitido[];
  conexiones: ConexionApi[];
  actividad: ActividadApi[];
  falta: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [llaveNueva, setLlaveNueva] = useState<LlaveNueva | null>(null);
  const [error, setError] = useState("");
  const [ocupado, iniciar] = useTransition();

  if (falta) {
    return (
      <p className="rounded-2xl border border-dashed p-6 text-center text-[13.5px] text-white/60"
        style={{ borderColor: BORDE }}>
        {falta}
      </p>
    );
  }

  const activas = conexiones.filter((c) => c.estado === "activa");

  const correr = (accion: () => Promise<{ ok: boolean; motivo?: string }>) => {
    setError("");
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.motivo ?? "No se pudo.");
    });
  };

  return (
    <div className="space-y-5">
      {/* Lo que la llave nueva es, mostrado una sola vez. */}
      {llaveNueva && (
        <SecretoUnaVez llave={llaveNueva} alCerrar={() => setLlaveNueva(null)} />
      )}

      {error && (
        <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-[13px] font-bold text-red-200">
          {error}
        </p>
      )}

      {/* ── Las conexiones activas ─────────────────────────────── */}
      {activas.length === 0 ? (
        <div className="rounded-2xl border p-5" style={{ background: TINTE, borderColor: BORDE }}>
          <p className="text-[14px] font-extrabold text-white">
            Nadie está conectado a tu programa.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Si usás un punto de venta que quiere sumar los sellos al cobrar, lo conectás desde
            acá. Tu sistema tiene que estar aprobado antes por Bookea — se pide en{" "}
            <Link href="/lealtad/developers" className="font-bold text-white underline">
              /lealtad/developers
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activas.map((c) => (
            <Conexion
              key={c.id}
              conexion={c}
              ocupado={ocupado}
              alRotar={(etiqueta) =>
                correr(async () => {
                  const r = await emitirLlaveApi({
                    ranchoId,
                    autorizacionId: c.id,
                    etiqueta,
                  });
                  if (r.ok) setLlaveNueva(r.datos);
                  return r;
                })
              }
              alRevocarLlave={(llaveId) =>
                correr(() => revocarLlaveApi({ ranchoId, llaveId, motivo: "Revocada desde el panel" }))
              }
              alDesconectar={() =>
                correr(() =>
                  revocarAutorizacionApi({
                    ranchoId,
                    autorizacionId: c.id,
                    motivo: "Desconectado desde el panel",
                  }),
                )
              }
              alRomperCorrelacion={() =>
                correr(() => romperCorrelacionApi({ ranchoId, autorizacionId: c.id }))
              }
            />
          ))}
        </div>
      )}

      {/* ── Conectar a alguien ─────────────────────────────────── */}
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={admitidos.length === 0 || tarjetas.length === 0}
          className="presionable w-full rounded-xl px-5 py-3.5 text-[14px] font-extrabold disabled:opacity-50"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {admitidos.length === 0
            ? "Todavía no hay sistemas aprobados por Bookea"
            : "Conectar un sistema"}
        </button>
      ) : (
        <FormularioAutorizar
          tarjetas={tarjetas}
          admitidos={admitidos}
          ocupado={ocupado}
          alCancelar={() => setAbierto(false)}
          alAutorizar={(datos) =>
            correr(async () => {
              const r = await autorizarDeveloper({ ranchoId, ...datos });
              if (r.ok) {
                setLlaveNueva(r.datos);
                setAbierto(false);
              }
              return r;
            })
          }
        />
      )}

      {/* ── Actividad ──────────────────────────────────────────── */}
      {actividad.length > 0 && (
        <div>
          <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
            Últimas llamadas a tu API
          </h3>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: BORDE }}>
            {actividad.map((a, i) => (
              <div
                key={a.id}
                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 ${
                  i === 0 ? "" : "border-t"
                }`}
                style={{ borderColor: BORDE, background: TINTE }}
              >
                <span className="font-mono text-[12px] text-white/85">{a.llamada}</span>
                <span className="text-[11.5px] text-white/50">
                  {a.kid} · {a.cuando}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    background: a.estado < 400 ? "rgba(157,180,255,.25)" : "rgba(248,113,113,.2)",
                    color: a.estado < 400 ? "#dbe5ff" : "#fecaca",
                  }}
                >
                  {a.estado}
                  {a.error ? ` ${a.error}` : ""}
                  {a.puntos ? ` · +${a.puntos}` : ""}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-white/40">
            Queda escrito qué se llamó y con qué resultado — nunca la llave, ni el contenido de la
            petición, ni un dato de tus clientes. El detalle se guarda 90 días.
          </p>
        </div>
      )}
    </div>
  );
}

function SecretoUnaVez({ llave, alCerrar }: { llave: LlaveNueva; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rounded-2xl border-2 p-5" style={{ borderColor: "#f39200", background: TINTE }}>
      <p className="text-[14.5px] font-extrabold text-white">
        Esta es la llave. Es la única vez que la vas a ver.
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/65">
        Guardala en el servidor de tu sistema, nunca en una app ni en un navegador. No la
        guardamos en ningún lado en texto plano: si se pierde, se rota y listo.
      </p>
      <code className="mt-3 block break-all rounded-xl bg-black/40 px-3.5 py-3 font-mono text-[12.5px] text-white">
        {llave.completa}
      </code>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(llave.completa).then(() => setCopiado(true));
          }}
          className="presionable rounded-xl px-4 py-2.5 text-[12.5px] font-extrabold"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {copiado ? "Copiada" : "Copiar"}
        </button>
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-xl border px-4 py-2.5 text-[12.5px] font-bold text-white/80"
          style={{ borderColor: BORDE }}
        >
          Ya la guardé
        </button>
      </div>
      <p className="mt-2.5 text-[11.5px] text-white/45">
        Vence el {llave.expiraEn ? new Date(llave.expiraEn).toLocaleDateString("es-CR") : "—"} ·
        termina en …{llave.sufijo}
      </p>
    </div>
  );
}

function Conexion({
  conexion,
  ocupado,
  alRotar,
  alRevocarLlave,
  alDesconectar,
  alRomperCorrelacion,
}: {
  conexion: ConexionApi;
  ocupado: boolean;
  alRotar: (etiqueta: string) => void;
  alRevocarLlave: (llaveId: string) => void;
  alDesconectar: () => void;
  alRomperCorrelacion: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const vivas = conexion.llaves.filter((l) => l.estado !== "revocada");

  return (
    <div className="rounded-2xl border p-5" style={{ background: TINTE, borderColor: BORDE }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold text-white">{conexion.desarrollador}</p>
          <p className="mt-0.5 text-[12.5px] text-white/55">
            En «{conexion.tarjeta}» · desde el {conexion.autorizadaEn}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {conexion.scopes.map((s) => (
            <span
              key={s}
              className="rounded-full px-2.5 py-1 font-mono text-[11px] font-bold"
              style={{ background: "rgba(157,180,255,.22)", color: "#dbe5ff" }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {vivas.length > 0 && (
        <div className="mt-4 space-y-2">
          {vivas.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5"
              style={{ borderColor: BORDE }}
            >
              <span className="font-mono text-[12px] text-white/85">
                blk_live_{l.kid}.…{l.sufijo}
              </span>
              <span className="text-[11.5px] text-white/50">
                {l.estado === "en_gracia" ? "en gracia · " : ""}
                vence {l.expiraEn}
                {l.ultimaUsada ? ` · usada ${l.ultimaUsada}` : " · sin usar"}
              </span>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => alRevocarLlave(l.id)}
                className="rounded-lg border border-red-400/40 px-3 py-1.5 text-[11.5px] font-bold text-red-200 disabled:opacity-50"
              >
                Revocar esta llave
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado || vivas.length >= 2}
          onClick={() => alRotar("Rotación")}
          className="rounded-xl border px-3.5 py-2 text-[12px] font-bold text-white/85 disabled:opacity-40"
          style={{ borderColor: BORDE }}
          title={vivas.length >= 2 ? "Ya hay dos llaves vivas: revocá una primero." : undefined}
        >
          Emitir una llave nueva
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={alRomperCorrelacion}
          className="rounded-xl border px-3.5 py-2 text-[12px] font-bold text-white/85 disabled:opacity-50"
          style={{ borderColor: BORDE }}
          title="Cambia el seudónimo de todos tus clientes para este sistema. Lo que se haya llevado alguien deja de servir."
        >
          Romper la correlación
        </button>
        {confirmando ? (
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={alDesconectar}
              className="rounded-xl bg-red-500/90 px-3.5 py-2 text-[12px] font-extrabold text-white disabled:opacity-50"
            >
              Sí, desconectar ahora
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-[12px] font-bold text-white/60"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-xl border border-red-400/40 px-3.5 py-2 text-[12px] font-bold text-red-200"
          >
            Desconectar
          </button>
        )}
      </div>
      <p className="mt-2.5 text-[11.5px] text-white/40">
        Desconectar apaga todas sus llaves en la siguiente petición — en menos de un segundo, sin
        esperar a que se venza ningún caché.
      </p>
    </div>
  );
}

function FormularioAutorizar({
  tarjetas,
  admitidos,
  ocupado,
  alCancelar,
  alAutorizar,
}: {
  tarjetas: TarjetaElegible[];
  admitidos: DeveloperAdmitido[];
  ocupado: boolean;
  alCancelar: () => void;
  alAutorizar: (datos: {
    programaId: string;
    desarrolladorId: string;
    scopes: string[];
    mostrarIniciales: boolean;
    etiqueta: string;
  }) => void;
}) {
  const [desarrolladorId, setDesarrolladorId] = useState(admitidos[0]?.id ?? "");
  const [programaId, setProgramaId] = useState(tarjetas[0]?.id ?? "");
  const [scopes, setScopes] = useState<string[]>(["catalogo", "saldo"]);
  const [mostrarIniciales, setMostrarIniciales] = useState(true);
  const [etiqueta, setEtiqueta] = useState("Caja principal");

  const tarjeta = tarjetas.find((t) => t.id === programaId);
  const pideAcreditar = scopes.includes("acreditar");
  const frenado = pideAcreditar && tarjeta && !tarjeta.tieneTopeDiario;

  const elegido = admitidos.find((d) => d.id === desarrolladorId);

  return (
    <div className="rounded-2xl border p-5" style={{ background: TINTE, borderColor: BORDE }}>
      <p className="text-[15px] font-extrabold text-white">
        {elegido?.nombre ?? "Este sistema"} quiere conectarse a tu programa de lealtad
      </p>

      {/* Primero lo que NO va a poder. Ver el encabezado del archivo. */}
      <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-red-200">
          No va a poder
        </p>
        <ul className="mt-2 space-y-1.5">
          {NO_VA_A_PODER.map((t) => (
            <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-white/80">
              <span aria-hidden className="shrink-0 font-bold text-red-300">
                ✕
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-xl border p-4" style={{ borderColor: BORDE }}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">Sí va a poder</p>
        <ul className="mt-2 space-y-1.5">
          {SI_VA_A_PODER.map((t) => (
            <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-white/80">
              <span aria-hidden className="shrink-0 font-bold" style={{ color: "#9db4ff" }}>
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-3">
        <Etiqueta texto="Qué sistema">
          <select
            className={selectClase}
            value={desarrolladorId}
            onChange={(e) => setDesarrolladorId(e.target.value)}
          >
            {admitidos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
                {d.dominioVerificado ? " · dominio verificado" : ""}
              </option>
            ))}
          </select>
        </Etiqueta>

        <Etiqueta texto="A cuál de tus tarjetas">
          <select
            className={selectClase}
            value={programaId}
            onChange={(e) => setProgramaId(e.target.value)}
          >
            {tarjetas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Etiqueta>

        <Etiqueta texto="Qué le dejás hacer">
          <div className="space-y-2">
            {SCOPES_ENTREGA_1.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5"
                style={{ borderColor: BORDE }}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={scopes.includes(s.id)}
                  onChange={() =>
                    setScopes((p) =>
                      p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id],
                    )
                  }
                />
                <span>
                  <span className="block text-[13px] font-extrabold text-white">{s.nombre}</span>
                  <span className="block text-[12px] text-white/55">{s.detalle}</span>
                </span>
              </label>
            ))}
          </div>
        </Etiqueta>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5"
          style={{ borderColor: BORDE }}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={mostrarIniciales}
            onChange={(e) => setMostrarIniciales(e.target.checked)}
          />
          <span>
            <span className="block text-[13px] font-extrabold text-white">
              Mostrarle las iniciales del cliente («M.R.»)
            </span>
            <span className="block text-[12px] text-white/55">
              Para que el cajero no le selle la tarjeta al cliente equivocado. Nunca el nombre
              completo.
            </span>
          </span>
        </label>

        <Etiqueta texto="Nombre de la llave (para que la reconozcas después)">
          <input
            className={selectClase}
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
          />
        </Etiqueta>
      </div>

      {frenado && (
        <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-100">
          Para dejar que alguien sume sellos por API, esta tarjeta necesita un{" "}
          <strong>tope diario por cliente</strong>. Sin ese tope, una llave filtrada imprime
          premios. Configuralo en las reglas de la tarjeta y volvé.
        </p>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-white/55">
        Lo desconectás cuando quieras desde acá mismo. Para cambiarle los permisos hay que
        desconectarlo y volverlo a conectar — así nadie se los amplía sin que vos digas que sí de
        nuevo.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado || Boolean(frenado) || !desarrolladorId || !programaId}
          onClick={() =>
            alAutorizar({ programaId, desarrolladorId, scopes, mostrarIniciales, etiqueta })
          }
          className="presionable rounded-xl px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-50"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {ocupado ? "Autorizando…" : "Autorizar y generar la llave"}
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="rounded-xl border px-5 py-3 text-[13.5px] font-bold text-white/80"
          style={{ borderColor: BORDE }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

const selectClase =
  "w-full rounded-xl border border-white/25 bg-black/20 px-3.5 py-2.5 text-[13.5px] text-white outline-none focus:border-white/50";

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-white/50">
        {texto}
      </span>
      {children}
    </label>
  );
}
