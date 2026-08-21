"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { Card } from "@/components/panel/piezas";
import { BAJADA_PANTALLA, ESTADO_AVISO, RADIO_CARD, RADIO_TILE } from "@/components/panel/sistema";
import { ACCION, ACCION_BORDE, ACCION_TINTA, ACCION_TINTE, BOTON_ACCION } from "../sistema-lealtad";
import { sembrarBeneficioFaltante } from "./crear-actions";
import { BuscarYAtender, type PermisosMostrador } from "./atencion-manual";
import type { ProductoDeVenta } from "@/lib/lealtad/productos";

/**
 * MODO MOSTRADOR: la pantalla que se le deja al empleado en la caja.
 *
 * Es el escáner y nada más — sin menú de configuración a un clic de
 * distancia. El teléfono que anda dando vueltas en el mostrador no
 * debería tener a mano el botón de archivar el programa. (Quien esconde
 * el menú es `shell-lealtad.tsx`; acá va lo que sí se puede hacer.)
 *
 * El shell lo monta SOLO cuando se enciende el interruptor: así la
 * cámara y `jsqr` no se cargan en cada visita al panel.
 *
 * DOS COSAS SE PUEDEN HACER ACÁ, NO UNA:
 *   · escanear la tarjeta, que es el camino normal;
 *   · buscar al cliente por nombre, que es el camino del teléfono
 *     descargado y del que no tiene smartphone. Antes ese cliente no se
 *     podía atender de ninguna forma.
 */
const EscanerPanel = dynamic(() => import("./escaner-panel"), {
  ssr: false,
  loading: () => (
    <div className={`${RADIO_CARD} border border-aventurea-line bg-aventurea-surface p-5`}>
      <p className="text-[13px] font-bold text-aventurea-ink-soft">Preparando el escáner…</p>
    </div>
  ),
});

export default function ModoMostrador({
  ranchoId,
  programaId,
  pideMonto,
  recompensa,
  tipo = null,
  permisos = { acreditar: true, canjear: true, revertir: false },
  productos = [],
}: {
  ranchoId: string;
  /** El programa que se opera en esta caja — lo necesita el alta de
   *  cliente nuevo dentro de `BuscarYAtender` (ver ese archivo). */
  programaId: string;
  pideMonto: boolean;
  recompensa: { id: string; nombre: string; costo: number } | null;
  /**
   * El tipo de la tarjeta principal. Opcional: sin él, el mostrador
   * habla en «puntos», que es a donde cae `tipoDe(null)` en todo el
   * módulo. El escáner NO lo necesita —el tipo le llega adentro del
   * resultado del escaneo— pero la búsqueda por nombre sí, para no
   * decirle «puntos» a los sellos de una tarjeta de sellos.
   */
  tipo?: string | null;
  /**
   * Qué puede hacer quien mira. Por defecto se ofrece todo: el
   * mostrador solo se monta si ya tiene permiso de acreditar, y cada
   * server action VUELVE a comprobar el permiso antes de tocar nada —
   * esconder un botón es cortesía, no la autorización.
   */
  permisos?: PermisosMostrador;
  /**
   * El catálogo ACTIVO del negocio (0198): con él, en la caja se elige
   * qué se vendió y el monto se llena solo. Vacío —o sin la migración
   * aplicada— el mostrador queda exactamente como estaba: monto a mano.
   */
  productos?: ProductoDeVenta[];
}) {
  const tipoTarjeta = tipoDe(tipo);

  return (
    /* La tarjeta del sistema con su encabezado: en la caja, esta es la
       única pantalla que se ve, así que tiene que decir sin leer que es
       LA pantalla de atender — kicker, título y nada más compitiendo. */
    <Card eyebrow="En la caja" titulo="Escaneá la tarjeta del cliente">
      <p className={BAJADA_PANTALLA}>
        Pedile que abra su tarjeta en el Wallet y apuntá la cámara al código.
        {recompensa
          ? ` Si ya llegó a ${recompensa.costo}, acá mismo podés entregarle su ${recompensa.nombre.toLowerCase()}.`
          : ""}
      </p>

      {!recompensa && <SinBeneficio ranchoId={ranchoId} />}

      <div className="mt-4">
        <EscanerPanel
          ranchoId={ranchoId}
          pideMonto={pideMonto}
          recompensa={recompensa}
          productos={productos}
        />
      </div>

      <div className="mt-4">
        <BuscarYAtender
          ranchoId={ranchoId}
          programaId={programaId}
          tipo={tipoTarjeta}
          meta={recompensa?.costo ?? null}
          recompensa={recompensa}
          permisos={permisos}
          pideMonto={pideMonto}
          productos={productos}
        />
      </div>
    </Card>
  );
}

/**
 * LA TARJETA QUE NO TIENE NADA QUE ENTREGAR.
 *
 * Cinco de los ocho tipos —cupón, descuento, membresía, evento y
 * cashback— nacían sin fila en `recompensas` porque el sembrado solo
 * cubría los tres que tienen «meta». Sin esa fila, el botón de canje no
 * se puede ni dibujar: escanear el cupón sumaba un punto y decía «sello
 * sumado», y el beneficio que el negocio prometió no se entregaba nunca.
 *
 * El sembrado ya está arreglado para las tarjetas NUEVAS. Las que ya
 * existen se arreglan acá, que es el lugar donde el problema se nota:
 * el empleado busca el botón de entregar y no está.
 */
function SinBeneficio({ ranchoId }: { ranchoId: string }) {
  const [estado, setEstado] = useState<"quieto" | "trabajando" | "listo" | "error">("quieto");
  const [mensaje, setMensaje] = useState<string | null>(null);

  function configurar() {
    setEstado("trabajando");
    setMensaje(null);
    sembrarBeneficioFaltante(ranchoId)
      .then((res) => {
        if (res.ok) {
          setEstado("listo");
          setMensaje(`Listo: ya se puede entregar «${res.nombre}». Recargá para verlo.`);
        } else {
          setEstado("error");
          setMensaje(res.motivo);
        }
      })
      .catch(() => {
        setEstado("error");
        setMensaje("No se pudo. Probá desde Recompensas.");
      });
  }

  return (
    <div
      className={`mt-3 ${RADIO_TILE} border px-4 py-3`}
      style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
    >
      <p className="text-[13px] font-extrabold leading-tight text-aventurea-ink">
        Esta tarjeta todavía no tiene nada que entregar
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Se puede escanear y sumar, pero el botón de entregar el beneficio no aparece hasta que
        el premio esté configurado.
      </p>
      {estado !== "listo" && (
        <button
          type="button"
          onClick={configurar}
          disabled={estado === "trabajando"}
          className={`${BOTON_ACCION} mt-3`}
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {estado === "trabajando" ? "Configurando…" : "Configurarlo con el beneficio de la tarjeta"}
        </button>
      )}
      {/* El error usa el estado `alerta` del sistema. `text-red-300`
          era un rojo suelto que ninguna otra pantalla del panel conocía
          — y el rojo de un error tiene que verse igual en las nueve. */}
      {mensaje && (
        <p
          className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12.5px] font-bold ${
            estado === "error" ? ESTADO_AVISO.alerta : ESTADO_AVISO.exito
          }`}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
