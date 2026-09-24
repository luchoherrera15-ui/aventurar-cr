import type { MovimientoCreditos } from "@/lib/celebrar/datos";
import { enColones } from "@/lib/celebrar/creditos";
import { TarjetaPanel } from "./piezas";

/**
 * EL BALANCE DEL MONEDERO: cuánto entró (compras, regalos, ajustes),
 * cuánto salió (publicaciones, IA) y cuánto queda, con una barra que
 * muestra qué parte de lo que entró ya se usó. Lo mismo en el Inicio y
 * en Mis créditos, para que la persona entienda su saldo de un vistazo.
 */
export function resumenDeMovimientos(movimientos: MovimientoCreditos[]) {
  let compras = 0;
  let regalos = 0;
  let gastados = 0;
  let pagadoCrc = 0;
  let ultimoUso: MovimientoCreditos | null = null;
  for (const m of movimientos) {
    if (m.tipo === "consumo") {
      gastados += -m.cantidad;
      if (!ultimoUso) ultimoUso = m;
    } else if (m.tipo === "compra") {
      compras += m.cantidad;
      pagadoCrc += m.monto_crc ?? 0;
    } else {
      regalos += m.cantidad;
    }
  }
  const entradas = compras + regalos;
  return { compras, regalos, entradas, gastados, pagadoCrc, ultimoUso, porcentajeUsado: entradas > 0 ? Math.min(100, Math.round((gastados / entradas) * 100)) : 0 };
}

export default function BalanceCreditos({ movimientos, saldo, compacto = false }: { movimientos: MovimientoCreditos[]; saldo: number; compacto?: boolean }) {
  const r = resumenDeMovimientos(movimientos);
  return (
    <TarjetaPanel>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`leading-tight text-(--c-tinta) ${compacto ? "text-lg" : "text-xl"}`}>Balance</h2>
        <p className="text-[12px] text-(--c-tinta-suave)">{movimientos.length} {movimientos.length === 1 ? "movimiento" : "movimientos"}</p>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-(--c-hielo) p-3">
          <dt className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.08em] text-(--c-tinta-suave)">Entraron</dt>
          <dd className="c-montserrat mt-1 text-xl font-extrabold leading-none text-(--c-ok)">+{r.entradas.toLocaleString("es-CR")}</dd>
          <dd className="mt-1 text-[11px] leading-snug text-(--c-tinta-suave)">
            {r.compras > 0 ? `${r.compras} comprados` : "0 comprados"}
            {r.regalos > 0 ? ` · ${r.regalos} de regalo` : ""}
          </dd>
        </div>
        <div className="rounded-xl bg-(--c-hielo) p-3">
          <dt className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.08em] text-(--c-tinta-suave)">Usados</dt>
          <dd className="c-montserrat mt-1 text-xl font-extrabold leading-none text-(--c-tinta)">−{r.gastados.toLocaleString("es-CR")}</dd>
          <dd className="mt-1 text-[11px] leading-snug text-(--c-tinta-suave)">{r.ultimoUso ? r.ultimoUso.concepto : "Todavía nada"}</dd>
        </div>
        <div className="rounded-xl bg-(--c-marino) p-3">
          <dt className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.08em] text-(--c-sobre-marino-suave)">Quedan</dt>
          <dd className="c-montserrat mt-1 text-xl font-extrabold leading-none text-(--c-blanco)">{saldo.toLocaleString("es-CR")}</dd>
          <dd className="mt-1 text-[11px] leading-snug text-(--c-sobre-marino-suave)">≈ {enColones(saldo)}</dd>
        </div>
      </dl>
      {r.entradas > 0 && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-(--c-hielo)" role="img" aria-label={`Usaste el ${r.porcentajeUsado} % de los créditos que entraron`}>
            <div className="h-full rounded-full bg-(--c-azul)" style={{ width: `${r.porcentajeUsado}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-(--c-tinta-suave)">
            Usaste el {r.porcentajeUsado} % de lo que entró
            {r.pagadoCrc > 0 ? ` · invertiste ₡${r.pagadoCrc.toLocaleString("es-CR")} en créditos` : ""}.
          </p>
        </div>
      )}
    </TarjetaPanel>
  );
}
