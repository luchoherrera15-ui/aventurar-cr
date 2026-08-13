"use client";

import dynamic from "next/dynamic";

/**
 * MODO MOSTRADOR: la pantalla que se le deja al empleado en la caja.
 *
 * Es el escáner y nada más — sin menú de configuración a un clic de
 * distancia. El teléfono que anda dando vueltas en el mostrador no
 * debería tener a mano el botón de archivar el programa.
 *
 * El shell lo monta SOLO cuando se enciende el interruptor: así la
 * cámara y `jsqr` no se cargan en cada visita al panel.
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
}: {
  ranchoId: string;
  pideMonto: boolean;
  recompensa: { id: string; nombre: string; costo: number } | null;
}) {
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
      <div className="mt-4">
        <EscanerPanel ranchoId={ranchoId} pideMonto={pideMonto} recompensa={recompensa} />
      </div>
    </div>
  );
}
