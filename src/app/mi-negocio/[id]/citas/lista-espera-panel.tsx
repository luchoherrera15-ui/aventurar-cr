"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtFechaCorta, hoyISOCR } from "@/lib/fechas";
import type { Vocabulario } from "@/lib/business/identidad";
import { Card, CardVacia, ContextoFila, PildoraEstado } from "@/components/panel/piezas";
import { DETALLE, ESTADO_AVISO, RADIO_CARD } from "@/components/panel/sistema";
import { ACCIONES_FILA, BOTON_FILA_PELIGRO, FilaFicha, LISTA_FICHAS } from "../fila-ficha";

/**
 * La lista de espera del negocio (0095): quién quiere entrar cuando un
 * día está lleno. Cuando el dueño cancela o mueve una cita, el sistema
 * avisa solo a los apuntados de ese día ("reserva quien confirme
 * primero"); acá el dueño la ve y la depura. Lee y borra directo con
 * su sesión (la RLS limita todo a su negocio).
 *
 * ── LA FORMA ───────────────────────────────────────────────────────
 * Una tarjeta del panel con la fila de ficha de siempre: la fecha en la
 * columna de contexto, la barrita del estado (gris el que espera, azul
 * el que ya recibió el aviso) y «Quitar» a la derecha. Antes era una
 * tabla suelta donde la única señal de «a este ya le avisamos» era una
 * pastilla `bg-aventurea-navy/10`, o sea un alfa haciendo de estado.
 */

type Espera = {
  id: string;
  fecha: string;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  notas: string | null;
  avisado_en: string | null;
  created_at: string;
  rancho_items: { nombre: string } | null;
  equipo_rancho: { nombre: string } | null;
};

export default function ListaEsperaPanel({
  ranchoId,
  vocabulario,
}: {
  ranchoId: string;
  vocabulario: Vocabulario;
}) {
  const { persona, visita } = vocabulario;
  const [filas, setFilas] = useState<Espera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Contador de recarga: quitar una fila vuelve a disparar el efecto.
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    const supabase = createClient();
    supabase
      .from("lista_espera")
      .select(
        "id, fecha, nombre, correo, telefono, notas, avisado_en, created_at, rancho_items(nombre), equipo_rancho(nombre)",
      )
      .eq("rancho_id", ranchoId)
      .gte("fecha", hoyISOCR())
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data, error: errorCarga }) => {
        if (!vigente) return;
        if (errorCarga) {
          // Migración 0095 sin correr: la sección se explica sola.
          setError(
            /lista_espera|schema cache|does not exist/i.test(errorCarga.message)
              ? "migracion"
              : errorCarga.message,
          );
          setFilas([]);
          return;
        }
        setFilas((data ?? []) as unknown as Espera[]);
      });
    return () => {
      vigente = false;
    };
  }, [ranchoId, recarga]);

  function quitar(id: string) {
    startTransition(async () => {
      const supabase = createClient();
      const { error: errorBorrado } = await supabase
        .from("lista_espera")
        .delete()
        .eq("id", id)
        .eq("rancho_id", ranchoId);
      if (errorBorrado) {
        setError(errorBorrado.message);
        return;
      }
      setRecarga((n) => n + 1);
    });
  }

  if (error === "migracion") {
    return (
      <div className={`${RADIO_CARD} p-4 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
        <strong>Falta la migración 0095.</strong> Corré{" "}
        <code className="rounded bg-aventurea-surface px-1.5 py-0.5 font-mono text-[12px]">
          supabase/migrations/0095_citas_fase2.sql
        </code>{" "}
        en el SQL Editor de Supabase para activar la lista de espera.
      </div>
    );
  }

  const avisados = (filas ?? []).filter((f) => f.avisado_en).length;

  return (
    <Card
      eyebrow="Cola del día"
      titulo="Quién está esperando"
      accion={
        filas && filas.length > 0 ? (
          <span className={DETALLE}>
            {filas.length} apuntado{filas.length === 1 ? "" : "s"}
            {avisados > 0 ? ` · ${avisados} ya avisado${avisados === 1 ? "" : "s"}` : ""}
          </span>
        ) : undefined
      }
    >
      {error && error !== "migracion" && (
        <p className={`mb-3.5 rounded-xl p-3 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
          {error}
        </p>
      )}

      {filas === null ? (
        <p className={DETALLE}>Cargando...</p>
      ) : filas.length === 0 ? (
        <CardVacia>
          Nadie está esperando espacio por ahora. Cuando un día tuyo se llene, el{" "}
          {persona.singular} puede apuntarse desde tu página — y si cancelás o movés una{" "}
          {visita.singular} de ese día, se le avisa solo.
        </CardVacia>
      ) : (
        <div className={LISTA_FICHAS}>
          {filas.map((f, idx) => (
            <FilaFicha
              key={f.id}
              separador={idx < filas.length - 1}
              // Gris el que sigue esperando, azul el que ya recibió el
              // aviso de que se liberó un espacio: son dos momentos
              // distintos de la misma cola, no un error ni un logro.
              marca={f.avisado_en ? "info" : "neutro"}
              medio={
                <div className="w-[74px] shrink-0">
                  <ContextoFila fuerte={fmtFechaCorta(f.fecha)} />
                </div>
              }
              titulo={
                <>
                  <span className="break-words">
                    {f.nombre ?? f.correo ?? persona.Singular}
                  </span>
                  {f.avisado_en && <PildoraEstado estado="info">Ya avisado</PildoraEstado>}
                </>
              }
              detalle={
                <>
                  <span className="break-words">
                    {f.rancho_items?.nombre ?? "Cualquier servicio"}
                    {f.equipo_rancho?.nombre ? ` · con ${f.equipo_rancho.nombre}` : ""}
                  </span>
                  {(f.correo || f.telefono) && (
                    <span className="break-words">
                      {f.correo ?? ""}
                      {f.correo && f.telefono ? " · " : ""}
                      {f.telefono ?? ""}
                    </span>
                  )}
                  {f.notas && <span className="break-words">{f.notas}</span>}
                </>
              }
              acciones={
                <div className={ACCIONES_FILA}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => quitar(f.id)}
                    className={BOTON_FILA_PELIGRO}
                  >
                    Quitar
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </Card>
  );
}
