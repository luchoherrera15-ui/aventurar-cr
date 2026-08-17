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
import { IconClock, IconMail, IconUsers, IconWarning } from "@/components/icons";
import { Card, CardVacia, Metrica, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  DETALLE,
  ESTADO_AVISO,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import { ACCIONES_FILA, BOTON_FILA, FilaFicha, LISTA_FICHAS } from "../fila-ficha";

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
 *
 * ── LA FORMA ───────────────────────────────────────────────────────
 * Tres tarjetas del panel, en el orden en que se usa la pantalla:
 * los NÚMEROS (cuántos son, cuántos fallan, cuántos se enfriaron), el
 * CORREO (a quién le escribo) y la LISTA (a quién busco). Antes eran
 * tres cuadritos, una barra de botones y una tabla suelta, todo del
 * mismo peso visual y sin decir dónde empieza cada cosa.
 *
 * Los dos números que avisan algo —los que fallan, los que no vienen—
 * ya no pintan su tarjeta entera de rojo o de celeste: llevan una
 * píldora del sistema. Un cuadro rojo entero le grita al dueño cada
 * vez que abre la pantalla, y "3 clientes fallaron" no es un error del
 * sistema: es información que se atiende cuando se puede.
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
      <Card eyebrow="Tu gente" titulo={persona.Plural}>
        <CardVacia>
          Tus {persona.plural} van a aparecer acá solos, con su historial de{" "}
          {visita.plural}, cuando entren las primeras.
        </CardVacia>
      </Card>
    );
  }

  const conCorreo = correosDe(clientes);
  const correosInactivos = correosDe(inactivos);
  const correosReincidentes = correosDe(reincidentes);

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── Los números ──────────────────────────────────────────────
          Ni cifras nuevas ni comparativos inventados: son los mismos
          tres conteos de antes, derivados de la lista que ya llega. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metrica
          rotulo={persona.Plural}
          valor={String(clientes.length)}
          detalle={`${conCorreo.length} con correo`}
          icono={<IconUsers />}
        />
        <Metrica
          rotulo="Faltan seguido"
          valor={String(reincidentes.length)}
          detalle="2 faltas seguidas o más"
          icono={<IconWarning />}
          tendencia={
            reincidentes.length > 0 ? (
              <PildoraEstado estado="alerta">Atender</PildoraEstado>
            ) : undefined
          }
        />
        <Metrica
          // Rótulo corto y el umbral en el detalle: en 390px la métrica
          // mide ~155px y `Sin venir hace 45+ días` se cortaba a la
          // mitad — un rótulo truncado no dice nada.
          rotulo="Sin venir"
          valor={String(inactivos.length)}
          detalle={`Hace ${DIAS_INACTIVO}+ días`}
          icono={<IconClock />}
          tendencia={
            inactivos.length > 0 ? (
              <PildoraEstado estado="aviso">Seguimiento</PildoraEstado>
            ) : undefined
          }
        />
      </div>

      {/* ── El correo ────────────────────────────────────────────── */}
      <Card
        eyebrow={promociones ? "Re-enganche" : "Contacto"}
        titulo={promociones ? "Escribirles una promoción" : "Escribirles un mensaje"}
        accion={
          <span className={DETALLE}>
            {conCorreo.length} de {clientes.length} tienen correo
          </span>
        }
      >
        {reincidentes.length > 0 && (
          <p
            className={`mb-3.5 rounded-xl p-3.5 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}
          >
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
            {reincidentes.length > 3 ? ` y ${reincidentes.length - 3} más` : ""} faltaron a
            sus últimas 2 {visita.plural} (o más).{" "}
            {promociones
              ? "Una promoción a tiempo suele recuperarlos."
              : "Un mensaje a tiempo suele ayudar."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => abrirCampanaSegmento("todos", conCorreo)}
            disabled={conCorreo.length === 0}
            className={BOTON_FILA}
          >
            <IconMail /> A todos ({conCorreo.length})
          </button>
          <button
            type="button"
            onClick={() => abrirCampanaSegmento("inactivos", correosInactivos)}
            disabled={correosInactivos.length === 0}
            className={BOTON_FILA}
          >
            A los inactivos ({correosInactivos.length})
          </button>
          <button
            type="button"
            onClick={() => abrirCampanaSegmento("no_show", correosReincidentes)}
            disabled={correosReincidentes.length === 0}
            className={BOTON_FILA}
          >
            A los que faltan ({correosReincidentes.length})
          </button>
        </div>

        {/* El formulario abre DENTRO de la tarjeta del correo, sobre la
            superficie hundida: es un escalón del mismo bloque, no una
            tarjeta nueva que empuja la lista hacia abajo. */}
        {destino && (
          <div className={`mt-3.5 flex flex-col gap-3 rounded-2xl p-4 ${SUPERFICIE_HUNDIDA}`}>
            <p className="text-[14px] font-extrabold leading-tight text-aventurea-navy">
              {destino.tipo === "cliente"
                ? `${promociones ? "Promoción" : "Mensaje"} para ${
                    destino.cliente.nombre ?? destino.cliente.correo
                  }`
                : `Correo a ${destino.correos.length} ${
                    destino.correos.length === 1 ? persona.singular : persona.plural
                  }`}
            </p>
            <p className={DETALLE}>
              Sale con el nombre de {nombreNegocio} a través de Bookea, con link de baja
              incluido. No se le repite al que ya le escribiste hace poco ni al que se dio
              de baja.
            </p>
            <div>
              <label className={`mb-1.5 block ${ROTULO_CAMPO}`}>Asunto</label>
              <input
                type="text"
                value={asunto}
                maxLength={150}
                onChange={(e) => setAsunto(e.target.value)}
                className={CAMPO_PANEL}
              />
            </div>
            <div>
              <label className={`mb-1.5 block ${ROTULO_CAMPO}`}>Mensaje</label>
              <textarea
                value={mensaje}
                maxLength={5000}
                rows={6}
                onChange={(e) => setMensaje(e.target.value)}
                className={`${CAMPO_PANEL} resize-y`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !asunto.trim() || !mensaje.trim()}
                onClick={enviar}
                className={BOTON_PANEL_PRIMARIO}
              >
                {pending ? "Enviando..." : "Enviar"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDestino(null)}
                className={BOTON_PANEL}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {resultado && (
          <p
            role="status"
            className={`mt-3.5 rounded-xl p-3.5 text-[13px] leading-relaxed ${
              resultado.error ? ESTADO_AVISO.alerta : ESTADO_AVISO.exito
            }`}
          >
            {resultado.error ? (
              resultado.error
            ) : (
              <>
                Se enviaron {resultado.enviados} correo
                {resultado.enviados === 1 ? "" : "s"}.
                {resultado.excluidos > 0 &&
                  ` ${resultado.excluidos} quedaron fuera (dados de baja o correo rebotado).`}
                {resultado.omitidosRecientes > 0 &&
                  ` ${resultado.omitidosRecientes} ya recibieron un correo tuyo hace poco.`}
                {resultado.fallidos > 0 && ` ${resultado.fallidos} fallaron.`}
              </>
            )}
          </p>
        )}
      </Card>

      {/* ── La lista ─────────────────────────────────────────────── */}
      <Card
        eyebrow="Tu gente"
        titulo={persona.Plural}
        accion={
          <span className={DETALLE}>
            {visibles.length === clientes.length
              ? `${clientes.length} en total`
              : `${visibles.length} de ${clientes.length}`}
          </span>
        }
      >
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              // El filtro activo se pinta con el acento del tipo de
              // negocio, no con el navy fijo de antes. `sobreSolido`
              // sobre `solido` es ≥5,18:1 en los ocho acentos del
              // catálogo (medido en identidad.test.ts).
              style={
                filtro === f
                  ? {
                      backgroundColor: "var(--acento-solido)",
                      borderColor: "var(--acento-solido)",
                      color: "var(--acento-sobre)",
                    }
                  : undefined
              }
              className={
                filtro === f
                  ? "inline-flex h-8 shrink-0 items-center rounded-lg border px-2.5 text-[12px] font-bold"
                  : BOTON_FILA
              }
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
            className={`min-w-[200px] flex-1 ${CAMPO_PANEL}`}
          />
        </div>

        {visibles.length === 0 ? (
          <CardVacia>Ningún {persona.singular} calza con ese filtro.</CardVacia>
        ) : (
          <div className={LISTA_FICHAS}>
            {visibles.slice(0, 100).map((c, idx, lista) => {
              // La barrita dice de un vistazo en qué estado está la
              // ficha, con la MISMA escala que las píldoras de arriba:
              // el que falla manda sobre el que no viene, y el que ya
              // tiene su próxima cita agendada se marca en verde.
              const marca = esReincidente(c)
                ? "alerta"
                : esInactivo(c)
                  ? "aviso"
                  : c.proximaCita
                    ? "exito"
                    : "neutro";
              return (
                <FilaFicha
                  key={c.clave}
                  marca={marca}
                  separador={idx < lista.length - 1 || visibles.length > 100}
                  medio={
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                      style={{
                        backgroundColor: "var(--acento-solido)",
                        color: "var(--acento-sobre)",
                      }}
                    >
                      {(c.nombre ?? c.correo ?? "?").trim().charAt(0).toUpperCase()}
                    </span>
                  }
                  titulo={
                    <>
                      <span className="break-words">
                        {c.nombre ?? c.correo ?? c.whatsapp ?? persona.Singular}
                      </span>
                      {esReincidente(c) && (
                        <PildoraEstado estado="alerta">
                          Faltó a sus últimas {c.fallosSeguidos}
                        </PildoraEstado>
                      )}
                      {esInactivo(c) && (
                        <PildoraEstado estado="aviso">
                          {c.diasSinVenir} días sin venir
                        </PildoraEstado>
                      )}
                    </>
                  }
                  detalle={
                    <>
                      <span>
                        {c.cumplidas} {c.cumplidas === 1 ? visita.singular : visita.plural}
                        {c.noAsistio > 0 &&
                          ` · ${c.noAsistio} no-show${c.noAsistio === 1 ? "" : "s"}`}
                        {c.gastoTotal > 0 && ` · ${fmtColones(c.gastoTotal)}`}
                        {c.ultimaVisita && ` · última: ${fmtFechaCorta(c.ultimaVisita)}`}
                        {c.proximaCita && (
                          <span className="font-bold text-aventurea-green">
                            {" "}
                            · próxima: {fmtFechaCorta(c.proximaCita)}
                          </span>
                        )}
                      </span>
                      {(c.correo || c.whatsapp) && (
                        <span className="break-words">
                          {c.correo ?? ""}
                          {c.correo && c.whatsapp ? " · " : ""}
                          {c.whatsapp ?? ""}
                        </span>
                      )}
                    </>
                  }
                  acciones={
                    c.correo ? (
                      <div className={ACCIONES_FILA}>
                        <button
                          type="button"
                          onClick={() => abrirPromoCliente(c)}
                          className={BOTON_FILA}
                        >
                          {promociones ? "Mandar promo" : "Escribirle"}
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              );
            })}
            {visibles.length > 100 && (
              <p className={`px-3.5 py-3 sm:px-4 ${DETALLE}`}>
                Se muestran los primeros 100 — usá la búsqueda para encontrar al resto.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
