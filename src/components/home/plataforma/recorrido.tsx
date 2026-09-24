import type { ComponentType } from "react";
import {
  IconCalendarLine,
  IconChartBars,
  IconCloche,
  IconEnlace,
  IconMail,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { Encabezado, Seccion } from "./piezas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  QUÉ ES BOOKEA — el recorrido, en sus dos lados
 * ════════════════════════════════════════════════════════════════════
 *
 * ── LO QUE HABÍA ACÁ Y POR QUÉ NO SERVÍA ────────────────────────────
 *
 * Siete pastillas en una fila con flechas entre medio. Se veía mal por
 * tres razones, y ninguna se arreglaba con estilo:
 *
 *   1. Siete no entran en una línea. El `flex-wrap` bajaba «Métricas»
 *      sola a un segundo renglón, huérfana y centrada.
 *   2. La flecha del último quedaba apuntando al vacío.
 *   3. Y lo de fondo: una fila de siete etiquetas iguales dice «acá hay
 *      siete cosas», que es una lista, no una idea.
 *
 * ── LO QUE DICE AHORA ───────────────────────────────────────────────
 *
 * El recorrido tiene DOS LADOS, y esa es la idea que vale:
 *
 *      LO QUE VE TU CLIENTE  →  lo que hace en tu negocio
 *               ↓  (cada interacción queda registrada)
 *      LO QUE VES VOS        →  lo que hacés con eso
 *
 * Partirlo en dos no es una decisión de maquetación: es el argumento.
 * Explica de dónde sale la información del panel —de lo que el cliente
 * ya hizo, no de cargarla a mano— y es la respuesta a «¿y esto qué
 * hace?» en una sola mirada.
 *
 * Cada pieza tiene su sección con su mockup más abajo. Esto es el
 * índice, no el contenido.
 */

type Pieza = { nombre: string; Icono: ComponentType<{ className?: string }> };

/** Lo que pasa del lado del cliente, en el orden en que pasa. */
const CARA_PUBLICA: Pieza[] = [
  { nombre: "Tu página", Icono: IconEnlace },
  { nombre: "Reservas", Icono: IconCalendarLine },
  { nombre: "Pedidos", Icono: IconCloche },
];

/** Lo que Bookea te deja hacer con eso. */
const TU_OPERACION: Pieza[] = [
  { nombre: "Clientes", Icono: IconUsers },
  { nombre: "Lealtad", Icono: IconWallet },
  { nombre: "Marketing", Icono: IconMail },
  { nombre: "Métricas", Icono: IconChartBars },
];

/** Un bloque del recorrido: su rótulo y sus piezas. */
function Lado({
  rotulo,
  descripcion,
  piezas,
  tono,
}: {
  rotulo: string;
  descripcion: string;
  piezas: Pieza[];
  /** `azul` = el lado del cliente; `tinta` = el lado del dueño. */
  tono: "azul" | "tinta";
}) {
  const azul = tono === "azul";
  return (
    <div className="overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-white">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[color:var(--linea)] px-6 py-4">
        <p
          className={`text-[11.5px] font-extrabold uppercase tracking-[0.14em] ${
            azul ? "text-[color:var(--acento)]" : "text-[color:var(--tinta)]"
          }`}
        >
          {rotulo}
        </p>
        <p className="text-[13.5px] text-[color:var(--tinta-suave)]">{descripcion}</p>
      </div>

      {/* `gap-px` sobre el color de la línea: las celdas quedan
          separadas por una raya fina sin ponerle borde a cada una.

          ⚠️ Las columnas SIGUEN A LA CANTIDAD de piezas. Con tres
          ítems en una grilla de cuatro, la cuarta celda queda vacía y
          el fondo gris del truco de las líneas asoma como un hueco
          sucio — es el mismo defecto que ya había aparecido en la
          grilla de siete pasos. */}
      <div
        className={`grid gap-px bg-[color:var(--linea)] ${
          piezas.length === 3
            ? // Tres: van a tres columnas desde `sm` y nunca sobra una
              // celda. En dos columnas el tercero quedaría solo abajo.
              "sm:grid-cols-3"
            : // Cuatro: dos filas llenas en `sm`, una sola en `lg`.
              "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {piezas.map(({ nombre, Icono }) => (
          <div
            key={nombre}
            className="flex items-center gap-3 bg-white px-5 py-4"
          >
            <span
              aria-hidden
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                azul
                  ? "bg-[color:var(--acento-suave)] text-[color:var(--acento)]"
                  : "bg-[color:var(--superficie)] text-[color:var(--tinta)]"
              }`}
            >
              <Icono className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[15px] font-extrabold text-[color:var(--tinta)]">
              {nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Recorrido() {
  return (
    <Seccion id="recorrido">
      <Encabezado rotulo="Cómo funciona" titulo="Todo pasa en un solo lugar.">
        Tu negocio se muestra, tus clientes reservan y Bookea se acuerda de
        cada uno para que vuelvan.
      </Encabezado>

      <div className="mx-auto mt-12 w-full max-w-[860px] sm:mt-14">
        <Lado
          tono="azul"
          rotulo="Lo que ve tu cliente"
          descripcion="Su lado de la historia"
          piezas={CARA_PUBLICA}
        />

        {/* EL PUENTE. Es la frase que explica por qué las dos mitades
            son un solo producto: el panel se llena con lo que el
            cliente ya hizo, no con lo que vos cargues a mano. */}
        <div className="flex flex-col items-center py-1">
          <span aria-hidden className="h-5 w-px bg-[color:var(--linea)]" />
          <span className="rounded-full bg-[color:var(--superficie)] px-4 py-1.5 text-[12.5px] font-semibold text-[color:var(--tinta-suave)]">
            Cada interacción queda registrada
          </span>
          <span aria-hidden className="h-5 w-px bg-[color:var(--linea)]" />
        </div>

        <Lado
          tono="tinta"
          rotulo="Lo que ves vos"
          descripcion="Y lo que hacés con eso"
          piezas={TU_OPERACION}
        />
      </div>
    </Seccion>
  );
}
