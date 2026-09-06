"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { ACCION, ACCION_TINTA, BOTON_ACCION } from "../sistema-lealtad";
import { canjearRecompensa } from "./lealtad-operar-actions";

/**
 * LISTOS PARA SU RECOMPENSA — el cuadro del tablero.
 *
 * Pedido del dueño (6 sep 2026): «un box en el dashboard que almacene
 * las personas que ya tienen los 10 sellos, para poder darles la
 * recompensa y que se les reinicie».
 *
 * ── DÓNDE SE ENTREGABA ANTES ────────────────────────────────────────
 * En tres lugares, siempre de a uno: en el escáner (al leer un pase con
 * la tarjeta llena aparece «Entregar: <premio>»), en el mostrador
 * (buscando al cliente por nombre) y en la ficha de Clientes. Lo que
 * faltaba era la LISTA: quién ya completó y todavía no cobró, de un
 * vistazo y sin buscar a nadie.
 *
 * ── LA MISMA ACCIÓN, NO UNA NUEVA ──────────────────────────────────
 * El botón llama a `canjearRecompensa`, el mismo RPC bajo lock que usan
 * el escáner y el mostrador: revalida las reglas de la tarjeta, escribe
 * el canje en el ledger (`canjeado`, que es lo que «reinicia» el saldo:
 * 10 − 10 = 0) y dispara la actualización del pase en el teléfono. No
 * hay una segunda forma de entregar un premio que pueda despegarse de
 * la primera.
 *
 * ── QUÉ PASA CON EL SALDO ──────────────────────────────────────────
 * Se descuenta el COSTO de la recompensa, no se pone en cero a mano.
 * Quien llegó con 12 sellos porque el negocio le dio dos de más se
 * queda con 2: son suyos. Es la regla del ledger desde la 0060 y no se
 * cambia acá.
 */

export type ListoParaRecompensa = {
  miembroId: string;
  nombre: string;
  contacto: string[];
  saldo: number;
};

type Resultado = { tono: "bien" | "mal"; texto: string };

export default function ListosRecompensa({
  ranchoId,
  listos,
  meta,
  recompensa,
  unidad,
  verbo,
  puedeCanjear,
}: {
  ranchoId: string;
  /** Quienes ya llegaron a la meta y no han canjeado. */
  listos: ListoParaRecompensa[];
  /** La meta de la tarjeta (10 sellos, 500 puntos…). */
  meta: number;
  /** La recompensa activa de la tarjeta. */
  recompensa: { id: string; nombre: string };
  /** «sellos», «puntos»… en plural, para «10 de 10 sellos». */
  unidad: string;
  /** «Entregar», «Canjear»…, según el tipo de tarjeta. */
  verbo: string;
  /** El rol de quien mira puede o no entregar premios. */
  puedeCanjear: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  /**
   * Los que ya cobraron en ESTA visita. Al refrescar, el servidor los
   * saca de `listos` (ya no llegan a la meta) y la fila desaparecería
   * con su aviso adentro: quien tocó el botón no vería «Entregado». Se
   * guardan acá para que la fila se quede, en gris, hasta que la
   * persona cambie de pantalla.
   */
  const [entregados, setEntregados] = useState<ListoParaRecompensa[]>([]);
  const [, arrancar] = useTransition();

  const entregar = (m: ListoParaRecompensa) => {
    setOcupado(m.miembroId);
    canjearRecompensa(ranchoId, m.miembroId, recompensa.id)
      .then((res) => {
        setResultados((p) => ({
          ...p,
          [m.miembroId]: res.ok
            ? {
                tono: "bien",
                texto: `Entregado: ${res.recompensa}. Su tarjeta arrancó de nuevo${res.saldo > 0 ? ` con ${res.saldo} ${unidad}` : ""}.${res.instrucciones ? ` ${res.instrucciones}` : ""}`,
              }
            : { tono: "mal", texto: res.motivo },
        }));
        if (res.ok) {
          setEntregados((p) => (p.some((e) => e.miembroId === m.miembroId) ? p : [...p, m]));
          // Refresca el tablero (los números del ledger, el pase).
          arrancar(() => router.refresh());
        }
      })
      .catch(() =>
        setResultados((p) => ({ ...p, [m.miembroId]: { tono: "mal", texto: "No se pudo entregar. Probá de nuevo." } })),
      )
      .finally(() => setOcupado(null));
  };

  // Las filas: lo que manda el servidor más los que cobraron recién.
  const filas = [...listos, ...entregados.filter((e) => !listos.some((l) => l.miembroId === e.miembroId))];
  const pendientes = filas.filter((m) => resultados[m.miembroId]?.tono !== "bien");

  return (
    <Card
      eyebrow="Tarjetas completas"
      titulo="Listos para su recompensa"
      accion={
        <PildoraEstado estado={pendientes.length > 0 ? "aviso" : "neutro"}>
          {pendientes.length === 0 ? "Nadie pendiente" : pendientes.length === 1 ? "1 cliente" : `${pendientes.length} clientes`}
        </PildoraEstado>
      }
    >
      {filas.length === 0 ? (
        <p className="text-[13px] leading-snug text-aventurea-ink-soft">
          Cuando un cliente llegue a {meta} {unidad}, aparece acá con un botón para darle{" "}
          <strong className="font-bold text-aventurea-ink">{recompensa.nombre}</strong> y que su tarjeta arranque de
          nuevo. También podés hacerlo desde el escáner o buscándolo en el mostrador.
        </p>
      ) : (
        <>
          <p className="text-[13px] leading-snug text-aventurea-ink-soft">
            Ya completaron su tarjeta y todavía no cobraron. Un toque entrega{" "}
            <strong className="font-bold text-aventurea-ink">{recompensa.nombre}</strong>, lo anota en el historial y
            reinicia la tarjeta; el pase del teléfono se actualiza solo.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-aventurea-line">
            {filas.map((m) => {
              const r = resultados[m.miembroId];
              const entregado = r?.tono === "bien";
              return (
                <li key={m.miembroId} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-aventurea-ink">{m.nombre}</span>
                    {m.contacto.length > 0 && (
                      <span className="block truncate text-[12px] text-aventurea-ink-soft">{m.contacto.join(" · ")}</span>
                    )}
                    <span className={`mt-0.5 block text-[12.5px] font-bold ${entregado ? "text-aventurea-ink-soft" : "text-green-700"}`}>
                      {entregado ? "Entregado" : `${m.saldo} de ${meta} ${unidad}`}
                    </span>
                    {r && (
                      <span className={`mt-1 block text-[12.5px] leading-snug ${r.tono === "bien" ? "text-green-700" : "text-red-700"}`}>
                        {r.texto}
                      </span>
                    )}
                  </span>
                  {!entregado && (
                    <button
                      type="button"
                      onClick={() => entregar(m)}
                      disabled={!puedeCanjear || ocupado !== null}
                      title={puedeCanjear ? undefined : "Tu rol no puede entregar premios: pedíselo al dueño."}
                      className={BOTON_ACCION}
                      /* El par azul claro / tinta del módulo, como los demás
                         botones de acción del panel: la clase sola no trae
                         color y sobre el navy quedaba invisible. */
                      style={{ background: ACCION, color: ACCION_TINTA }}
                    >
                      {ocupado === m.miembroId ? "Entregando…" : `${verbo} y reiniciar`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {!puedeCanjear && (
            <p className="mt-2 text-[12px] text-aventurea-ink-soft">Tu rol no puede entregar premios. Pedíselo al dueño.</p>
          )}
        </>
      )}
    </Card>
  );
}
