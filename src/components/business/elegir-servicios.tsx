import Link from "next/link";
import { PRODUCTOS, hayProductosPagos, type Producto } from "@/lib/productos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  ELEGÍ QUÉ ACTIVAR — las cuatro cards del arranque
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «la gente se registra, ingresa, y ahí
 * va a tener por cards o por segmentos qué servicios quiere agregar. La
 * idea es cobrar por esto, pero al principio todo va a ser gratis para
 * poder entrar».
 *
 * ── LAS DOS DECISIONES QUE TIENE ADENTRO ────────────────────────────
 *
 * **1. No inventa nada.** Los cuatro productos salen de
 * `src/lib/productos.ts`, el mismo archivo que pinta las cuatro
 * tarjetas del home. El texto que ve alguien antes de registrarse y el
 * que ve después es literalmente el mismo string.
 *
 * **2. «Activar» no activa acá.** Cada botón lleva a la pantalla que YA
 * sabe dar de alta ese producto (`/solutions/crear`, `/lealtad/nuevo`,
 * `/publicar`). Escribir el alta de nuevo en esta pantalla sería
 * duplicar tres formularios que ya existen y funcionan —y en el caso de
 * Lealtad, meterle mano a un producto que está en producción con
 * clientes reales—. Esta pantalla es la PUERTA, no el trámite.
 *
 * Por eso es un componente de servidor sin estado: cuatro tarjetas y
 * cuatro enlaces. Cuando exista el estado real de «qué tiene prendido
 * este negocio» (`solutions_addons` ya lo guarda para la página), se le
 * pasa por props y las tarjetas cambian de «Activar» a «Ya lo tenés».
 * Ese prop está previsto abajo y hoy llega vacío.
 */

/** Qué tiene ya prendido el negocio. Vacío = todavía no tiene nada. */
export type ServiciosActivos = Partial<Record<Producto["id"], boolean>>;

function Tarjeta({ p, activo }: { p: Producto; activo: boolean }) {
  const enObra = p.estado === "en-obra";

  return (
    <div className="group flex flex-col rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--papel)] p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[19px] font-extrabold text-[color:var(--tinta)]">
          {p.nombre}
        </h3>
        {activo ? (
          <span className="shrink-0 rounded-full bg-[color:var(--ok-suave)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--ok)]">
            Activo
          </span>
        ) : enObra ? (
          // Se enseña, pero no se promete: la integración de Meta
          // todavía no está aprobada. Decirlo acá es más barato que
          // que alguien lo active y no pase nada.
          <span className="shrink-0 rounded-full bg-[color:var(--aviso-suave)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--aviso)]">
            Muy pronto
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[color:var(--acento-suave)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--acento)]">
            Gratis
          </span>
        )}
      </div>

      <p className="mt-2 text-[14.5px] leading-snug text-[color:var(--tinta-suave)]">
        {p.promesa}
      </p>

      <ul className="mt-4 space-y-2">
        {p.incluye.map((linea) => (
          <li key={linea} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[9px] font-extrabold text-[color:var(--ok)]"
            >
              ✓
            </span>
            <span className="text-[13px] leading-snug text-[color:var(--tinta-suave)]">
              {linea}
            </span>
          </li>
        ))}
      </ul>

      {/* `mt-auto`: las listas miden parejo hoy, pero el día que una
          crezca los cuatro botones tienen que seguir alineados. */}
      <div className="mt-auto pt-6">
        {activo ? (
          <Link
            href={p.activar}
            className="flex w-full items-center justify-center rounded-[12px] border border-[color:var(--linea)] bg-[color:var(--superficie)] px-4 py-2.5 text-[13.5px] font-extrabold text-[color:var(--tinta)] transition-colors hover:border-[color:var(--tinta)]"
          >
            Administrar
          </Link>
        ) : enObra ? (
          // Decir «Activar» arriba de un rótulo que dice «Muy pronto»
          // es prometer un botón que no hace nada: el código de las
          // automatizaciones está listo, pero la app de Meta todavía no
          // existe y el DM no saldría. Hasta entonces la acción honesta
          // es anotarse, y `/ayuda` es el hilo que ya existe para eso.
          <Link
            href="/ayuda"
            className="flex w-full items-center justify-center rounded-[12px] border border-[color:var(--linea)] bg-[color:var(--superficie)] px-4 py-2.5 text-[13.5px] font-extrabold text-[color:var(--tinta)] transition-colors hover:border-[color:var(--tinta)]"
          >
            Avisame cuando esté
          </Link>
        ) : (
          <Link
            href={p.activar}
            className="flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-[color:var(--tinta)] px-4 py-2.5 text-[13.5px] font-extrabold text-white transition-colors hover:bg-[color:var(--acento)]"
          >
            Activar
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ElegirServicios({
  activos = {},
}: {
  activos?: ServiciosActivos;
}) {
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        {PRODUCTOS.map((p) => (
          <Tarjeta key={p.id} p={p} activo={activos[p.id] === true} />
        ))}
      </div>

      {/* Mientras no haya nada que cobrar, la pantalla lo dice en vez de
          dejar un silencio que la gente lee como «después me cobran». */}
      {hayProductosPagos() ? null : (
        <p className="mt-6 text-center text-[13.5px] text-[color:var(--tinta-suave)]">
          Todo gratis mientras estamos arrancando. Activá lo que quieras y
          apagá lo que no te sirva.
        </p>
      )}
    </div>
  );
}
