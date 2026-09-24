import type { Metadata } from "next";
import { EncabezadoPanel, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { movimientosAdmin, resumenCreditosAdmin } from "@/lib/celebrar/admin";
import { PAQUETES, VALOR_CREDITO_CRC, enColones } from "@/lib/celebrar/creditos";
import { acreditarAMano } from "./acciones";

export const metadata: Metadata = { title: "Admin · Créditos" };

type Busqueda = { tipo?: string; correo?: string; aviso?: string };

const TIPOS = [
  ["", "Todos"],
  ["compra", "Compras"],
  ["consumo", "Usos"],
  ["regalo", "Regalos"],
  ["ajuste", "Ajustes"],
  ["reembolso", "Reembolsos"],
] as const;

const NOMBRE_TIPO: Record<string, string> = { compra: "Compra", consumo: "Uso", regalo: "Regalo", ajuste: "Ajuste", reembolso: "Reembolso" };

/**
 * EL LIBRO MAYOR DE LOS CRÉDITOS, para el equipo: cuánto se vendió y por
 * cuánta plata, cuánto se regaló, cuánto se consumió y cuánto hay en
 * circulación (el pasivo: créditos que la gente todavía puede gastar).
 * Debajo, cada movimiento con la cuenta, y un formulario para acreditar
 * a mano (SINPE, cortesías, correcciones).
 */
export default async function AdminCreditosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const q = await searchParams;
  const [resumen, movimientos] = await Promise.all([resumenCreditosAdmin(), movimientosAdmin({ tipo: q.tipo, correo: q.correo })]);

  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Créditos · administración"
        descripcion={`Todos los movimientos de todas las cuentas. 1 crédito = ₡${VALOR_CREDITO_CRC}. Lo que está en circulación es lo que la gente todavía puede gastar.`}
      />

      {q.aviso && (
        <p role="status" className="rounded-2xl border border-(--c-linea) bg-(--c-blanco) px-5 py-4 text-[14px] text-(--c-tinta)">
          {q.aviso}
        </p>
      )}

      {resumen && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Dato titulo="Vendidos" valor={`${resumen.vendidos.toLocaleString("es-CR")} cr.`} detalle={`${resumen.compras} ${resumen.compras === 1 ? "compra" : "compras"} · ₡${resumen.ingresos_crc.toLocaleString("es-CR")} ingresados`} tono="marina" />
          <Dato titulo="Consumidos" valor={`${resumen.consumidos.toLocaleString("es-CR")} cr.`} detalle={`≈ ${enColones(resumen.consumidos)} en publicaciones e IA`} />
          <Dato titulo="Regalados y ajustes" valor={`${(resumen.regalados + resumen.ajustes + resumen.reembolsados).toLocaleString("es-CR")} cr.`} detalle={`${resumen.regalados} regalo · ${resumen.ajustes} ajuste · ${resumen.reembolsados} reembolso`} />
          <Dato titulo="En circulación" valor={`${resumen.en_circulacion.toLocaleString("es-CR")} cr.`} detalle={`≈ ${enColones(resumen.en_circulacion)} · ${resumen.cuentas_con_saldo} ${resumen.cuentas_con_saldo === 1 ? "cuenta" : "cuentas"} con saldo`} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <TarjetaPanel className="overflow-hidden !p-0">
          <div className="grid gap-3 border-b border-(--c-linea) px-6 py-4 sm:flex sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl leading-tight text-(--c-tinta)">Movimientos</h2>
              <p className="mt-0.5 text-[13px] text-(--c-tinta-suave)">{movimientos.length === 0 ? "Nada con esos filtros." : `${movimientos.length} ${movimientos.length === 1 ? "movimiento" : "movimientos"}, lo más reciente primero.`}</p>
            </div>
            <form method="get" className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="f-tipo">Tipo</label>
              <select id="f-tipo" name="tipo" defaultValue={q.tipo ?? ""} className="c-campo !w-auto min-h-10 text-[13px]">
                {TIPOS.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="f-correo">Correo</label>
              <input id="f-correo" name="correo" defaultValue={q.correo ?? ""} placeholder="Buscar por correo" className="c-campo !w-48 min-h-10 text-[13px]" />
              <button type="submit" className="c-boton c-boton-secundario min-h-10 text-[13px]">
                Filtrar
              </button>
            </form>
          </div>
          {movimientos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-(--c-hielo) text-left text-[11px] uppercase tracking-[0.08em] text-(--c-tinta-suave)">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Cuándo</th>
                    <th className="px-4 py-2 font-semibold">Cuenta</th>
                    <th className="px-4 py-2 font-semibold">Tipo</th>
                    <th className="px-4 py-2 font-semibold">Concepto</th>
                    <th className="px-4 py-2 text-right font-semibold">Créditos</th>
                    <th className="px-4 py-2 text-right font-semibold">₡</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--c-linea)">
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-(--c-tinta-suave)">{new Date(m.created_at).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-2">
                        <p className="truncate text-(--c-tinta)">{m.correo}</p>
                        {m.nombre && <p className="truncate text-[12px] text-(--c-tinta-suave)">{m.nombre}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-(--c-tinta-suave)">{NOMBRE_TIPO[m.tipo] ?? m.tipo}</td>
                      <td className="px-4 py-2">
                        <p className="text-(--c-tinta)">{m.concepto}</p>
                        <p className="truncate text-[12px] text-(--c-tinta-suave)">
                          {m.celebracion ? `${m.celebracion} · ` : ""}
                          {m.referencia ?? ""}
                        </p>
                      </td>
                      <td className={`c-montserrat whitespace-nowrap px-4 py-2 text-right font-semibold ${m.cantidad < 0 ? "text-(--c-tinta)" : "text-(--c-ok)"}`}>
                        {m.cantidad > 0 ? "+" : ""}
                        {m.cantidad}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-(--c-tinta-suave)">{m.monto_crc ? `₡${m.monto_crc.toLocaleString("es-CR")}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TarjetaPanel>

        <TarjetaPanel>
          <h2 className="text-xl leading-tight text-(--c-tinta)">Acreditar a mano</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">
            Para un pago por SINPE, una cortesía o una corrección. La referencia (el número de comprobante) evita acreditar dos veces lo mismo.
          </p>
          <form action={acreditarAMano} className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
              Correo de la cuenta
              <input name="correo" type="email" required className="c-campo" placeholder="persona@correo.com" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
                Créditos
                <input name="cantidad" type="number" min={1} max={100000} required className="c-campo" list="paquetes-sugeridos" />
                <datalist id="paquetes-sugeridos">
                  {PAQUETES.map((p) => (
                    <option key={p.id} value={p.creditos}>{`Paquete ${p.creditos} · ₡${p.precioCRC.toLocaleString("es-CR")}`}</option>
                  ))}
                </datalist>
              </label>
              <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
                Tipo
                <select name="tipo" defaultValue="regalo" className="c-campo">
                  <option value="regalo">Regalo</option>
                  <option value="compra">Compra (SINPE / transferencia)</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
              Monto pagado en ₡ (solo compras)
              <input name="monto_crc" type="number" min={0} step={1} className="c-campo" placeholder="11500" />
            </label>
            <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
              Concepto
              <input name="concepto" className="c-campo" placeholder="Pago por SINPE del paquete de 250" maxLength={160} />
            </label>
            <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
              Referencia (comprobante), opcional
              <input name="referencia" className="c-campo" placeholder="SINPE 123456789" maxLength={120} />
            </label>
            <button type="submit" className="c-boton c-boton-primario min-h-11">
              Acreditar
            </button>
          </form>
        </TarjetaPanel>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, detalle, tono = "blanca" }: { titulo: string; valor: string; detalle: string; tono?: "blanca" | "marina" }) {
  const marina = tono === "marina";
  return (
    <TarjetaPanel tono={tono}>
      <p className={`c-montserrat text-[11px] font-semibold uppercase tracking-[0.1em] ${marina ? "text-(--c-sobre-marino-suave)" : "text-(--c-tinta-suave)"}`}>{titulo}</p>
      <p className={`c-montserrat mt-2 text-3xl font-extrabold leading-none ${marina ? "text-(--c-blanco)" : "text-(--c-tinta)"}`}>{valor}</p>
      <p className={`mt-2 text-[12px] leading-snug ${marina ? "text-(--c-sobre-marino-suave)" : "text-(--c-tinta-suave)"}`}>{detalle}</p>
    </TarjetaPanel>
  );
}
