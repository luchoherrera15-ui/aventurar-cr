"use client";

import { useMemo, useState, useTransition } from "react";
import { fmtColones } from "@/lib/finanzas";
import { fmtFechaCorta } from "@/lib/fechas";
import {
  DIAS_INACTIVO,
  esInactivo,
  esReincidente,
  type ClienteCRM,
  type SegmentoCampana,
} from "@/lib/crm-citas";
import { enviarCampanaNegocio } from "./campanas-actions";
import type { ResultadoCampanaNegocio } from "@/lib/campanas/citas";
import type { Vocabulario } from "@/lib/business/identidad";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

type Filtro = "todos" | "no_show" | "inactivos";

const FILTRO_LABEL: Record<Filtro, string> = {
  todos: "Todos",
  no_show: "Faltan seguido",
  inactivos: "Inactivos",
};

type Destino =
  | { tipo: "cliente"; cliente: ClienteCRM }
  | { tipo: "segmento"; segmento: SegmentoCampana; correos: string[] };

/**
 * El CRM del negocio de citas: quién viene, quién dejó de venir y
 * quién está fallando — con el botón para escribirle una promoción
 * de re-enganche ahí mismo. La ficha se deriva de las reservas (lib
 * crm-citas); los envíos pasan por consentimiento y frenos en el
 * servidor (campanas-actions).
 *
 * `vocabulario` llega del tipo de negocio (lib/business/identidad): en
 * un consultorio esta misma lista es de PACIENTES y sus CONSULTAS, y en
 * un gimnasio de MIEMBROS y sus SESIONES. El color va por
 * `var(--acento…)`, que la página deja puesto en el contenedor.
 */
export default function ClientesPanel({
  ranchoId,
  nombreNegocio,
  clientes,
  vocabulario,
  promociones,
}: {
  ranchoId: string;
  nombreNegocio: string;
  clientes: ClienteCRM[];
  vocabulario: Vocabulario;
  /**
   * ¿Este negocio le habla a su gente en tono comercial?
   *
   * En salud, no: escribirle a un paciente una "promoción" para que
   * vuelva es exactamente lo que Bookea no debe empujar (la misma razón
   * por la que `consultorio` no declara el módulo de marketing). El
   * correo sigue existiendo —un consultorio necesita poder escribirle a
   * su gente— pero se llama por su nombre: un mensaje.
   */
  promociones: boolean;
}) {
  const { persona, visita } = vocabulario;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [destino, setDestino] = useState<Destino | null>(null);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] = useState<ResultadoCampanaNegocio | null>(null);
  const [pending, startTransition] = useTransition();

  const reincidentes = clientes.filter(esReincidente);
  const inactivos = clientes.filter((c) => esInactivo(c));

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let lista = clientes;
    if (filtro === "no_show") lista = reincidentes;
    if (filtro === "inactivos") lista = inactivos;
    if (!q) return lista;
    return lista.filter(
      (c) =>
        (c.nombre ?? "").toLowerCase().includes(q) ||
        (c.correo ?? "").toLowerCase().includes(q) ||
        (c.whatsapp ?? "").includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derivados de clientes
  }, [busqueda, filtro, clientes]);

  function abrirPromoCliente(cliente: ClienteCRM) {
    setResultado(null);
    setDestino({ tipo: "cliente", cliente });
    setAsunto(
      promociones
        ? `Te extrañamos en ${nombreNegocio} — tu próxima ${visita.singular} te espera`
        : `Un mensaje de ${nombreNegocio}`,
    );
    setMensaje(
      promociones
        ? `Hola ${cliente.nombre?.split(" ")[0] ?? ""}:\n\nHace tiempo no te vemos por ${nombreNegocio} y queremos que volvás. Escribinos o reservá en línea y te guardamos el espacio.\n\n¡Te esperamos!`
        : `Hola ${cliente.nombre?.split(" ")[0] ?? ""}:\n\nHace un tiempo que no coordinamos una ${visita.singular} en ${nombreNegocio}. Si querés agendar, escribinos o reservá en línea.\n`,
    );
  }

  function abrirCampanaSegmento(segmento: SegmentoCampana, correos: string[]) {
    setResultado(null);
    setDestino({ tipo: "segmento", segmento, correos });
    setAsunto(
      !promociones
        ? `Un mensaje de ${nombreNegocio}`
        : segmento === "inactivos"
          ? `Te extrañamos en ${nombreNegocio}`
          : `Novedades de ${nombreNegocio}`,
    );
    setMensaje(
      !promociones
        ? `Hola:\n\nTe escribimos de ${nombreNegocio}. Si querés agendar una ${visita.singular}, respondé este correo o reservá en línea.\n`
        : segmento === "inactivos"
          ? `Hola:\n\nHace tiempo no te vemos por ${nombreNegocio}. Reservá tu próxima ${visita.singular} en línea — te esperamos.\n`
          : `Hola:\n\nEn ${nombreNegocio} tenemos novedades para vos. Reservá tu próxima ${visita.singular} en línea.\n`,
    );
  }

  function enviar() {
    if (!destino) return;
    setResultado(null);
    startTransition(async () => {
      const res = await enviarCampanaNegocio(ranchoId, {
        tipo:
          destino.tipo === "cliente" || destino.segmento !== "todos"
            ? "reenganche"
            : "campana",
        segmento:
          destino.tipo === "cliente"
            ? "manual"
            : destino.segmento === "todos"
              ? "todos"
              : destino.segmento,
        asunto,
        mensaje,
        correos:
          destino.tipo === "cliente" ? [destino.cliente.correo ?? ""] : destino.correos,
      });
      setResultado(res);
      if (!res.error) setDestino(null);
    });
  }

  const correosDe = (lista: ClienteCRM[]) => [
    ...new Set(lista.filter((c) => c.correo).map((c) => c.correo as string)),
  ];

  if (clientes.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
        Tus {persona.plural} van a aparecer acá solos, con su historial de{" "}
        {visita.plural}, cuando entren las primeras.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen + alertas */}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[140px] flex-1 rounded-2xl border border-aventurea-line bg-white px-5 py-3.5 sm:flex-none">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            {persona.Plural}
          </p>
          <p className="text-[18px] font-extrabold text-aventurea-ink">{clientes.length}</p>
        </div>
        <div
          className={`min-w-[140px] flex-1 rounded-2xl border px-5 py-3.5 sm:flex-none ${
            reincidentes.length > 0 ? "border-red-300 bg-red-50" : "border-aventurea-line bg-white"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Faltan seguido
          </p>
          <p
            className={`text-[18px] font-extrabold ${
              reincidentes.length > 0 ? "text-red-700" : "text-aventurea-ink"
            }`}
          >
            {reincidentes.length}
          </p>
        </div>
        <div
          className={`min-w-[140px] flex-1 rounded-2xl border px-5 py-3.5 sm:flex-none ${
            inactivos.length > 0
              ? "border-aventurea-sky/50 bg-aventurea-sky-light"
              : "border-aventurea-line bg-white"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Sin venir hace {DIAS_INACTIVO}+ días
          </p>
          <p className="text-[18px] font-extrabold text-aventurea-ink">{inactivos.length}</p>
        </div>
      </div>

      {reincidentes.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-[13px] text-aventurea-ink">
          ⚠{" "}
          <strong>
            {reincidentes.length === 1
              ? `Un ${persona.singular} te está fallando`
              : `${reincidentes.length} ${persona.plural} te están fallando`}
            :
          </strong>{" "}
          {reincidentes
            .slice(0, 3)
            .map((c) => c.nombre ?? "sin nombre")
            .join(", ")}
          {reincidentes.length > 3 ? ` y ${reincidentes.length - 3} más` : ""} faltaron a sus
          últimas 2 {visita.plural} (o más).{" "}
          {promociones
            ? "Una promoción a tiempo suele recuperarlos."
            : "Un mensaje a tiempo suele ayudar."}
        </div>
      )}

      {/* Campañas por segmento */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-bold text-aventurea-ink-soft">
          Escribirles por correo:
        </span>
        <button
          type="button"
          onClick={() => abrirCampanaSegmento("todos", correosDe(clientes))}
          disabled={correosDe(clientes).length === 0}
          className="rounded-lg border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-sky disabled:opacity-40"
        >
          A todos ({correosDe(clientes).length})
        </button>
        <button
          type="button"
          onClick={() => abrirCampanaSegmento("inactivos", correosDe(inactivos))}
          disabled={correosDe(inactivos).length === 0}
          className="rounded-lg border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-sky disabled:opacity-40"
        >
          A los inactivos ({correosDe(inactivos).length})
        </button>
        <button
          type="button"
          onClick={() => abrirCampanaSegmento("no_show", correosDe(reincidentes))}
          disabled={correosDe(reincidentes).length === 0}
          className="rounded-lg border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink hover:border-aventurea-sky disabled:opacity-40"
        >
          A los que faltan ({correosDe(reincidentes).length})
        </button>
      </div>

      {/* El formulario de la campaña */}
      {destino && (
        <div className="flex flex-col gap-3 rounded-2xl border border-aventurea-navy/30 bg-aventurea-surface p-5">
          <h3 className="text-[15px] font-bold text-aventurea-ink">
            {destino.tipo === "cliente"
              ? `${promociones ? "Promoción" : "Mensaje"} para ${
                  destino.cliente.nombre ?? destino.cliente.correo
                }`
              : `Correo a ${destino.correos.length} ${
                  destino.correos.length === 1 ? persona.singular : persona.plural
                }`}
          </h3>
          <p className="text-[12.5px] text-aventurea-ink-soft">
            Sale con el nombre de {nombreNegocio} a través de Bookea, con link
            de baja incluido. No se le repite al que ya le escribiste hace poco
            ni al que se dio de baja.
          </p>
          <div>
            <label className={labelCls}>Asunto</label>
            <input
              type="text"
              value={asunto}
              maxLength={150}
              onChange={(e) => setAsunto(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Mensaje</label>
            <textarea
              value={mensaje}
              maxLength={5000}
              rows={6}
              onChange={(e) => setMensaje(e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !asunto.trim() || !mensaje.trim()}
              onClick={enviar}
              className="rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
            >
              {pending ? "Enviando..." : "Enviar"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDestino(null)}
              className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-sky hover:text-aventurea-orange"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div
          className={`rounded-xl p-3.5 text-[13px] ${
            resultado.error ? "bg-red-50 text-red-700" : "bg-aventurea-green/10 text-aventurea-green"
          }`}
        >
          {resultado.error ? (
            resultado.error
          ) : (
            <>
              ✓ Se enviaron {resultado.enviados} correo{resultado.enviados === 1 ? "" : "s"}.
              {resultado.excluidos > 0 &&
                ` ${resultado.excluidos} quedaron fuera (dados de baja o correo rebotado).`}
              {resultado.omitidosRecientes > 0 &&
                ` ${resultado.omitidosRecientes} ya recibieron un correo tuyo hace poco.`}
              {resultado.fallidos > 0 && ` ${resultado.fallidos} fallaron.`}
            </>
          )}
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            // El filtro activo se pinta con el acento del tipo de
            // negocio, no con el navy fijo de antes.
            style={
              filtro === f
                ? {
                    backgroundColor: "var(--acento-solido)",
                    borderColor: "var(--acento-solido)",
                    color: "var(--acento-sobre)",
                  }
                : undefined
            }
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
              filtro === f
                ? ""
                : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-sky"
            }`}
          >
            {FILTRO_LABEL[f]}
            {f === "no_show" && reincidentes.length > 0 ? ` (${reincidentes.length})` : ""}
            {f === "inactivos" && inactivos.length > 0 ? ` (${inactivos.length})` : ""}
          </button>
        ))}
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo o teléfono"
          aria-label={`Buscar ${persona.singular}`}
          className="min-w-[220px] flex-1 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
        />
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
          Ningún {persona.singular} calza con ese filtro.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {visibles.slice(0, 100).map((c) => (
            <div
              key={c.clave}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-aventurea-line px-4 py-3 last:border-none"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                style={{
                  backgroundColor: "var(--acento-solido)",
                  color: "var(--acento-sobre)",
                }}
              >
                {(c.nombre ?? c.correo ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13.5px] font-bold text-aventurea-ink">
                  {c.nombre ?? c.correo ?? c.whatsapp ?? persona.Singular}
                  {esReincidente(c) && (
                    <span className="ml-2 whitespace-nowrap rounded-lg bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-700">
                      Faltó a sus últimas {c.fallosSeguidos}
                    </span>
                  )}
                  {esInactivo(c) && (
                    <span className="ml-2 whitespace-nowrap rounded-lg bg-aventurea-sky/15 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-orange">
                      {c.diasSinVenir} días sin venir
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
                  {c.cumplidas} {c.cumplidas === 1 ? visita.singular : visita.plural}
                  {c.noAsistio > 0 && ` · ${c.noAsistio} no-show${c.noAsistio === 1 ? "" : "s"}`}
                  {c.gastoTotal > 0 && ` · ${fmtColones(c.gastoTotal)}`}
                  {c.ultimaVisita && ` · última: ${fmtFechaCorta(c.ultimaVisita)}`}
                  {c.proximaCita && (
                    <span className="font-bold text-aventurea-green">
                      {" "}
                      · próxima: {fmtFechaCorta(c.proximaCita)}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 break-words text-[11.5px] text-zinc-500">
                  {c.correo ?? ""}
                  {c.correo && c.whatsapp ? " · " : ""}
                  {c.whatsapp ?? ""}
                </p>
              </div>
              {c.correo && (
                <button
                  type="button"
                  onClick={() => abrirPromoCliente(c)}
                  className="h-[30px] shrink-0 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-3 text-xs font-bold text-aventurea-navy hover:border-aventurea-sky hover:text-aventurea-orange"
                >
                  {promociones ? "Mandar promo" : "Escribirle"}
                </button>
              )}
            </div>
          ))}
          {visibles.length > 100 && (
            <p className="px-4 py-3 text-[12.5px] text-aventurea-ink-soft">
              Se muestran los primeros 100 — usá la búsqueda para encontrar al resto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
