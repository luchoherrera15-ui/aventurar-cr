import Link from "next/link";

/**
 * Lo que ESTE negocio tiene pendiente ahora mismo — no una copia del
 * tablero de Bookea (ese es del equipo y ve todos los negocios; este es
 * de un solo negocio), así que va sin agrupar por sección: es una lista
 * corta que cabe de un vistazo arriba de las pestañas.
 */
type Pendiente = {
  id: string;
  cuenta: number;
  singular: string;
  plural: string;
  href: string;
};

export default function PendientesRancho({
  reservasPorAprobar,
  depositosSinValidar,
  cobranHoy,
}: {
  reservasPorAprobar: number;
  depositosSinValidar: number;
  cobranHoy: number;
}) {
  const pendientes: Pendiente[] = [
    {
      id: "reservas",
      cuenta: reservasPorAprobar,
      singular: "reserva esperando tu aprobación",
      plural: "reservas esperando tu aprobación",
      href: "?tab=agenda",
    },
    {
      id: "depositos",
      cuenta: depositosSinValidar,
      singular: "depósito sin validar",
      plural: "depósitos sin validar",
      href: "?tab=finanzas",
    },
    {
      id: "cobran-hoy",
      cuenta: cobranHoy,
      singular: "evento de hoy con saldo por cobrar",
      plural: "eventos de hoy con saldo por cobrar",
      href: "?tab=finanzas",
    },
  ].filter((p) => p.cuenta > 0);

  if (pendientes.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-green/10 text-aventurea-green">
          <IconCheck />
        </span>
        <div>
          <p className="text-[13.5px] font-bold text-aventurea-ink">Todo al día</p>
          <p className="text-[12.5px] text-aventurea-ink-soft">
            No tenés nada pendiente ahora mismo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      <ul className="divide-y divide-aventurea-line">
        {pendientes.map((p) => (
          <li key={p.id}>
            <Link
              href={p.href}
              className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-aventurea-cream-2/60"
            >
              <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-aventurea-orange px-2 text-[15px] font-bold tabular-nums text-white">
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
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}
