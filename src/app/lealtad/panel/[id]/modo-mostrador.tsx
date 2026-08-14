"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { sembrarBeneficioFaltante } from "./crear-actions";
import { BuscarYAtender, type PermisosMostrador } from "./atencion-manual";

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
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <p className="text-[13px] font-bold text-aventurea-ink-soft">Preparando el escáner…</p>
    </div>
  ),
});

export default function ModoMostrador({
  ranchoId,
  pideMonto,
  recompensa,
  tipo = null,
  permisos = { acreditar: true, canjear: true, revertir: false },
}: {
  ranchoId: string;
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
}) {
  const tipoTarjeta = tipoDe(tipo);

  return (
    <div
      className="rounded-3xl border p-4 sm:p-6"
      style={{ background: "rgba(255,255,255,.035)", borderColor: "rgba(255,255,255,.09)" }}
    >
      <h2 className="text-[18px] font-extrabold text-white">Escaneá la tarjeta del cliente</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-white/55">
        Pedile que abra su tarjeta en el Wallet y apuntá la cámara al código.
        {recompensa
          ? ` Si ya llegó a ${recompensa.costo}, acá mismo podés entregarle su ${recompensa.nombre.toLowerCase()}.`
          : ""}
      </p>

      {!recompensa && <SinBeneficio ranchoId={ranchoId} />}

      <div className="mt-4">
        <EscanerPanel ranchoId={ranchoId} pideMonto={pideMonto} recompensa={recompensa} />
      </div>

      <div className="mt-4">
        <BuscarYAtender
          ranchoId={ranchoId}
          tipo={tipoTarjeta}
          meta={recompensa?.costo ?? null}
          recompensa={recompensa}
          permisos={permisos}
          pideMonto={pideMonto}
        />
      </div>
    </div>
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
      className="mt-3 rounded-2xl border px-4 py-3"
      style={{ background: "rgba(238,116,32,.10)", borderColor: "rgba(238,116,32,.45)" }}
    >
      <p className="text-[13px] font-bold text-white">
        Esta tarjeta todavía no tiene nada que entregar
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
        Se puede escanear y sumar, pero el botón de entregar el beneficio no aparece hasta que
        el premio esté configurado.
      </p>
      {estado !== "listo" && (
        <button
          type="button"
          onClick={configurar}
          disabled={estado === "trabajando"}
          className="mt-2.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-40"
          style={{ background: "#ee7420" }}
        >
          {estado === "trabajando" ? "Configurando…" : "Configurarlo con el beneficio de la tarjeta"}
        </button>
      )}
      {mensaje && (
        <p
          className={`mt-2 text-[12.5px] font-bold ${
            estado === "error" ? "text-red-300" : "text-white"
          }`}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
