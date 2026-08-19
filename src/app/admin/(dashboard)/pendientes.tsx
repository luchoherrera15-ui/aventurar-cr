import { cache } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ESTADOS_PEDIDO_ABIERTOS } from "./invitaciones/pestanas";
import { perteneceASeccion, SECCION_LABEL, type SeccionAdmin } from "./vertical";

/**
 * El tablero de pendientes: lo que espera que alguien del EQUIPO DE
 * BOOKEA haga algo, contado y con su link, arriba del hub.
 *
 * Ojo con qué entra acá, que es lo fácil de equivocar: las reservas y
 * los depósitos NO son de Bookea. Cada proveedor aprueba las suyas y
 * valida sus propios comprobantes desde /mi-negocio, y son de su negocio
 * y de su cliente. Al principio estaban en este tablero y sumaban trece
 * pendientes que nadie de acá podía resolver: puro ruido, del que enseña
 * a ignorar el tablero entero.
 *
 * Lo que sí es de Bookea: aprobar los negocios que se registran y
 * atender lo que Bookea vende como producto propio. La plata tampoco se
 * duplica acá — vive en /admin/finanzas, que ya la muestra completa.
 *
 * Ojo con la frontera cliente/servidor: este archivo NO lleva
 * "use client" y no exporta helpers para el navegador. Es un componente
 * de servidor puro (ver src/app/admin/(dashboard)/ia/pestanas.ts).
 */

/** Una línea del tablero. `cuenta` en 0 no se muestra. */
type Pendiente = {
  id: string;
  cuenta: number;
  /** Qué falta hacer, en una frase. Singular y plural. */
  singular: string;
  plural: string;
  href: string;
  /** Los que involucran plata o bloquean a un cliente van marcados. */
  urgente: boolean;
  /** De qué parte del panel viene, para agrupar los contadores. */
  seccion: string;
};

/**
 * Cuenta todo lo pendiente, respetando la sección elegida en el
 * conmutador del header.
 *
 * Las publicaciones se filtran por vertical, igual que en su propia
 * pantalla. Los pedidos de invitación NO: son un producto propio de
 * Bookea, no una vertical del marketplace, así que se muestran siempre.
 * Esconderlos al elegir "Agendas y citas" sería justo el error que este
 * tablero existe para evitar.
 */
export const contarPendientes = cache(async function contarPendientes(
  seccion: SeccionAdmin,
): Promise<{ pendientes: Pendiente[]; sinLlave: boolean }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // No se consultan `reservas`: son del proveedor, no de Bookea.
  const [ranchosRes, pedidosRes, invitacionesRes] = await Promise.all([
    // Con la llave de servicio y `select("*")`: desde la 0155 el
    // permiso sobre `ranchos` es COLUMNA POR COLUMNA, y Postgres exige
    // privilegio sobre toda columna nombrada —incluidas las del WHERE—.
    // Pedir `en_marketplace` por nombre con la sesión daría 42501 y el
    // `?? []` lo convertiría en un cero silencioso: el tablero diría
    // que no hay nada pendiente.
    (admin ?? supabase).from("ranchos").select("*"),
    // Los pedidos van con la llave de servicio: la RLS de la 0075 solo
    // deja ver a cada cliente los suyos, así que con la sesión del admin
    // esta consulta vuelve VACÍA — parecería que no hay nada pendiente.
    admin
      ? admin.from("pedidos_invitacion").select("estado")
      : Promise.resolve({ data: null, error: null }),
    // Igual acá: las que no tienen dueño hay que verlas todas, incluidas
    // borradores, y eso la política pública no lo permite.
    admin
      ? admin.from("invitaciones").select("estado, cliente_id, es_ejemplo")
      : Promise.resolve({ data: null, error: null }),
  ]);

  const ranchos = (ranchosRes.data ?? []) as {
    id: string;
    estado: string | null;
    vertical: string | null;
    /** 0187. `undefined` si la migración no está corrida. */
    en_marketplace?: boolean | null;
  }[];

  const ranchosDeLaSeccion = ranchos.filter((r) => perteneceASeccion(r.vertical, seccion));
  // «Publicaciones esperando aprobación» es del DIRECTORIO. Un cliente
  // de Lealtad también nace en `pendiente` y nunca se publica: contarlo
  // acá mandaba al equipo a aprobar algo que no se aprueba, y ese ruido
  // es lo que enseña a ignorar el tablero entero.
  //
  // `!== false` y no `=== true`: sin la 0187 corrida la propiedad llega
  // `undefined` y el contador quedaría en cero.
  const publicacionesPorAprobar = ranchosDeLaSeccion.filter(
    (r) => r.estado === "pendiente" && r.en_marketplace !== false,
  ).length;

  const pedidos = (pedidosRes.data ?? []) as { estado: string }[];
  const pedidosPorAtender = pedidos.filter((p) =>
    ESTADOS_PEDIDO_ABIERTOS.includes(p.estado),
  ).length;
  const pedidosSinPagar = pedidos.filter((p) => p.estado === "pendiente_pago").length;

  // Una invitación activa sin dueño no la ve su cliente en /cuenta, no
  // puede administrar su lista de confirmados y el gate del PDF no lo
  // reconoce. Las muestras del catálogo no cuentan: no tienen dueño a
  // propósito.
  const invitacionesSinDueno = (
    (invitacionesRes.data ?? []) as {
      estado: string;
      cliente_id: string | null;
      es_ejemplo: boolean | null;
    }[]
  ).filter((i) => i.estado === "activa" && !i.cliente_id && !i.es_ejemplo).length;

  const pendientes: Pendiente[] = [
    {
      id: "publicaciones",
      cuenta: publicacionesPorAprobar,
      singular: "publicación esperando aprobación",
      plural: "publicaciones esperando aprobación",
      href: "/admin/ranchos",
      urgente: true,
      seccion: "Publicaciones",
    },
    {
      id: "pedidos",
      cuenta: pedidosPorAtender,
      singular: "pedido de invitación por atender",
      plural: "pedidos de invitación por atender",
      href: "/admin/invitaciones?tab=pedidos",
      urgente: true,
      seccion: "Invitaciones",
    },
    {
      id: "pedidos-sin-pagar",
      cuenta: pedidosSinPagar,
      singular: "pedido que no terminó de pagar",
      plural: "pedidos que no terminaron de pagar",
      href: "/admin/invitaciones?tab=pedidos",
      urgente: false,
      seccion: "Invitaciones",
    },
    {
      id: "sin-dueno",
      cuenta: invitacionesSinDueno,
      singular: "invitación activa sin dueño",
      plural: "invitaciones activas sin dueño",
      href: "/admin/invitaciones",
      urgente: false,
      seccion: "Invitaciones",
    },
  ];

  return {
    pendientes: pendientes.filter((p) => p.cuenta > 0),
    sinLlave: !admin,
  };
});

/**
 * Los dos contadores que la barra lateral pinta como badge.
 *
 * Son los ÚNICOS dos con badge, y a propósito: son los que salen de
 * una fuente de verdad — `ranchos.estado` y los estados abiertos de
 * `pedidos_invitacion`. Un badge sobre un número inventado enseña a
 * ignorar todos los badges, incluidos los que sí importan.
 *
 * `contarPendientes` va envuelta en `cache()` de React: el layout la
 * pide para los badges y la portada la pide para el tablero, y sin el
 * cache serían las mismas cuatro consultas dos veces por pantalla.
 */
export async function pendientesDeLaBarra(
  seccion: SeccionAdmin,
): Promise<{ publicaciones: number; invitaciones: number }> {
  const { pendientes } = await contarPendientes(seccion);
  const de = (id: string) => pendientes.find((p) => p.id === id)?.cuenta ?? 0;
  return {
    publicaciones: de("publicaciones"),
    // Los tres contadores de invitaciones se suman en uno: en una fila
    // de 13px no entra el desglose, y quien ve el número entra igual.
    invitaciones: de("pedidos") + de("pedidos-sin-pagar") + de("sin-dueno"),
  };
}

export default async function TableroPendientes({
  seccion,
}: {
  seccion: SeccionAdmin;
}) {
  const { pendientes, sinLlave } = await contarPendientes(seccion);
  const total = pendientes.reduce((suma, p) => suma + p.cuenta, 0);

  // Sin la llave de servicio los pedidos y las invitaciones no se pueden
  // contar (su RLS no deja verlos con la sesión del admin). Decirlo es
  // obligatorio: un "todo al día" que en realidad es "no pude mirar" es
  // peor que no tener tablero.
  const aviso = sinLlave ? (
    <p className="mt-2.5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-700">
      Falta <strong>SUPABASE_SERVICE_ROLE_KEY</strong>: los pedidos de invitación
      y las invitaciones sin dueño no se están contando.
    </p>
  ) : null;

  if (total === 0) {
    return (
      <div className="mt-6">
        <div className="flex items-center gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-green/10 text-aventurea-green">
            <IconCheck />
          </span>
          <div>
            <p className="text-[13.5px] font-bold text-aventurea-ink">Todo al día</p>
            <p className="text-[12.5px] text-aventurea-ink-soft">
              No hay nada esperando al equipo
              {seccion !== "todas" ? ` en ${SECCION_LABEL[seccion]}` : ""}.
            </p>
          </div>
        </div>
        {aviso}
      </div>
    );
  }

  // Agrupadas por sección del panel, en el orden en que aparecen: así el
  // tablero se lee como "qué me falta en Reservas", no como una lista
  // suelta de números.
  const porSeccion = new Map<string, Pendiente[]>();
  for (const p of pendientes) {
    porSeccion.set(p.seccion, [...(porSeccion.get(p.seccion) ?? []), p]);
  }

  return (
    <section className="mt-6" aria-labelledby="pendientes-titulo">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="pendientes-titulo"
          className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy"
        >
          Pendientes
        </h2>
        <p className="text-[12.5px] text-aventurea-ink-soft">
          {total} cosa{total === 1 ? "" : "s"} esperando al equipo
          {seccion !== "todas" ? ` · ${SECCION_LABEL[seccion]}` : ""}
        </p>
      </div>

      <div className="space-y-4">
        {[...porSeccion.entries()].map(([nombre, filas]) => {
          const suma = filas.reduce((s, f) => s + f.cuenta, 0);
          return (
            <div
              key={nombre}
              className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface"
            >
              <div className="flex items-center justify-between gap-3 border-b border-aventurea-line bg-aventurea-cream-2/60 px-5 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  {nombre}
                </span>
                <span className="text-[11px] font-bold text-aventurea-ink-soft">
                  {suma}
                </span>
              </div>
              <ul className="divide-y divide-aventurea-line">
                {filas.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={p.href}
                      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-aventurea-cream-2/60"
                    >
                      <span
                        className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-[15px] font-bold tabular-nums ${
                          p.urgente
                            ? "bg-aventurea-sky text-white"
                            : "bg-aventurea-navy/10 text-aventurea-navy"
                        }`}
                      >
                        {p.cuenta}
                      </span>
                      <span className="min-w-0 flex-1 text-[13.5px] font-bold text-aventurea-ink">
                        {p.cuenta === 1 ? p.singular : p.plural}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-bold text-aventurea-navy">
                        Atender
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
                        >
                          <path
                            d="M4 10h12m0 0-5-5m5 5-5 5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11.5px] text-aventurea-ink-soft">
        Las publicaciones se cuentan según la sección elegida arriba; las invitaciones
        son producto propio de Bookea y se cuentan siempre. Las reservas y los depósitos
        no aparecen acá: los aprueba cada proveedor desde su panel.
      </p>
      {aviso}
    </section>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}
