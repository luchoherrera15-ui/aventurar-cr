import { PaseWallet } from "./pase-wallet";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * "TU PROGRAMA VIVE DONDE TUS CLIENTES YA ESTÁN" — Apple Wallet y
 * Google Wallet, lado a lado.
 *
 * Antes esto era una barra angosta de compatibilidad ("Apple Wallet ·
 * Google Wallet · Código QR") entre el hero y la franja de industrias.
 * Servía como confirmación rápida, pero no explicaba nada — el pedido
 * fue una sección propia. Reusa `PaseWallet` (pase-wallet.tsx), que ya
 * calca los detalles reales de un pase (troquel, campos, código): las
 * dos tarjetas de acá NO son ilustraciones nuevas, son el mismo
 * componente que arma el resto del sitio, con `marca="apple"` y
 * `marca="google"`.
 */

const PUNTOS: { icono: NombreIcono; texto: string }[] = [
  { icono: "movil", texto: "Sin descargar otra app: se agrega con un toque al Wallet que ya tienen." },
  { icono: "listo", texto: "Siempre a mano, junto a la tarjeta del banco y el pase de abordar." },
  { icono: "repetir", texto: "El progreso se actualiza solo en cada visita — nadie tiene que abrir nada." },
  { icono: "campana", texto: "Tus avisos les llegan a la pantalla de bloqueo, sin pedir el número." },
];

/** Siete de diez, la misma cifra de ejemplo del resto de la página. */
function SellosDemo() {
  return (
    <div className="mt-2.5 grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="h-[9px] rounded-full"
          style={{ background: "currentColor", opacity: i < 7 ? 1 : 0.22 }}
        />
      ))}
    </div>
  );
}

export default function SeccionWallets() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
      <div>
        <ul className="flex flex-col gap-5">
          {PUNTOS.map((p) => (
            <li key={p.texto} className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
              >
                <Icono nombre={p.icono} className="h-4 w-4" />
              </span>
              <p className="mt-1 text-[14px] leading-relaxed text-aventurea-ink-soft">{p.texto}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
        <div className="w-full max-w-[240px] rotate-[-3deg] text-[color:#ffffff]">
          <PaseWallet
            marca="apple"
            negocio="Café Aurora"
            etiquetaCampo="Sellos"
            valorCampo="7/10"
            colorFondo="#fbfcff"
          >
            <SellosDemo />
          </PaseWallet>
          <p className="mt-3 text-center text-[12px] font-bold text-aventurea-ink-soft">Apple Wallet</p>
        </div>
        <div className="w-full max-w-[240px] rotate-[3deg] text-[color:#14151a]">
          <PaseWallet
            marca="google"
            negocio="Café Aurora"
            etiquetaCampo="Sellos"
            valorCampo="7/10"
            colorFondo="#fbfcff"
          >
            <SellosDemo />
          </PaseWallet>
          <p className="mt-3 text-center text-[12px] font-bold text-aventurea-ink-soft">Google Wallet</p>
        </div>
      </div>
    </div>
  );
}
