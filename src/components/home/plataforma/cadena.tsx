import type { ComponentType } from "react";
import {
  IconCloche,
  IconClipboard,
  IconEnlace,
  IconWallet,
} from "@/components/icons";
import { Encabezado, Seccion } from "./piezas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA CADENA — cómo se conecta todo, en cuatro pasos
 * ════════════════════════════════════════════════════════════════════
 *
 * Es la §6 de `docs/bookea-producto.md` dibujada: el negocio crea su
 * presencia → sus clientes interactúan → Bookea registra esa
 * interacción → el cliente vuelve. La tesis del producto, no una lista
 * de funciones — por eso los pasos van NUMERADOS y encadenados con una
 * línea, y no como cuatro tarjetas sueltas que se leerían como cuatro
 * productos más.
 *
 * Reemplaza al viejo `recorrido.tsx` (dos lados, siete pastillas) en
 * el papel de «índice de la página»: cuatro pasos se recorren de una
 * mirada, siete pastillas se estudian.
 *
 * ── LA REGLA DE SIEMPRE ─────────────────────────────────────────────
 * Cada paso existe: la página (`/s/`), pedidos y reservas (comandas y
 * agenda), el panel, y Lealtad. Acá no se promete nada que no esté.
 */

type Paso = {
  titulo: string;
  detalle: string;
  Icono: ComponentType<{ className?: string }>;
};

const PASOS: Paso[] = [
  {
    titulo: "Creás tu página",
    detalle: "Tu menú, tus links y tu QR, listos en minutos.",
    Icono: IconEnlace,
  },
  {
    titulo: "Tus clientes piden o reservan",
    detalle: "Desde el QR de la mesa o desde tu link.",
    Icono: IconCloche,
  },
  {
    titulo: "Todo entra a tu panel",
    detalle: "Cada pedido y cada reserva quedan registrados.",
    Icono: IconClipboard,
  },
  {
    titulo: "Y vuelven",
    detalle: "Suman sellos y se llevan su recompensa.",
    Icono: IconWallet,
  },
];

export default function Cadena() {
  return (
    <Seccion id="como-funciona">
      <Encabezado rotulo="Cómo funciona" titulo="Una cosa lleva a la otra.">
        No son cuatro herramientas sueltas: cada paso alimenta al
        siguiente.
      </Encabezado>

      <ol className="mx-auto mt-12 grid max-w-[1020px] gap-8 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
        {PASOS.map(({ titulo, detalle, Icono }, i) => (
          <li key={titulo} className="relative flex flex-col items-center px-4 text-center">
            {/* La línea que encadena, solo entre pasos y solo cuando
                caben los cuatro en una fila: en dos columnas uniría
                pasos que no son consecutivos. */}
            {i < PASOS.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[calc(50%+34px)] top-[26px] hidden h-px w-[calc(100%-68px)] bg-[color:var(--linea)] lg:block"
              />
            )}
            <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[color:var(--linea)] bg-[color:var(--superficie)]">
              <Icono className="h-6 w-6 text-[color:var(--tinta)]" />
              <span className="absolute -right-1 -top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[color:var(--acento)] text-[11.5px] font-extrabold text-white">
                {i + 1}
              </span>
            </span>
            <p className="mt-4 text-[16px] font-extrabold leading-snug text-[color:var(--tinta)]">
              {titulo}
            </p>
            <p className="mt-1.5 max-w-[24ch] text-[13.5px] leading-snug text-[color:var(--tinta-suave)]">
              {detalle}
            </p>
          </li>
        ))}
      </ol>
    </Seccion>
  );
}
