import type { Metadata } from "next";
import { EncabezadoPanel, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { nombreTipoPartner, partnersAdmin, urlDePartner } from "@/lib/celebrar/partners";
import { fechaLargaCR } from "@/lib/fechas";
import { cambiarEstadoPartner } from "./acciones";

export const metadata: Metadata = { title: "Admin · Partners" };

type Busqueda = { aviso?: string };

const ESTADO_TEXTO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-(--c-celeste) text-(--c-marino)" },
  aprobado: { texto: "Aprobado", clase: "bg-(--c-ok-suave) text-(--c-ok)" },
  suspendido: { texto: "Suspendido", clase: "bg-(--c-coral-suave) text-(--c-coral-tinta)" },
  rechazado: { texto: "Rechazado", clase: "bg-(--c-hielo) text-(--c-tinta-suave)" },
};

/**
 * Las solicitudes y los partners activos: aprobar, fijar descuento,
 * suspender. Las pendientes van primero.
 */
export default async function AdminPartnersPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const q = await searchParams;
  const partners = await partnersAdmin();
  const pendientes = partners.filter((p) => p.estado === "pendiente").length;
  const aprobados = partners.filter((p) => p.estado === "aprobado").length;

  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Partners · administración"
        descripcion={`${aprobados} ${aprobados === 1 ? "partner activo" : "partners activos"} · ${pendientes} ${pendientes === 1 ? "solicitud pendiente" : "solicitudes pendientes"}. El descuento es el margen del partner sobre el crédito (₡50).`}
      />
      {q.aviso && (
        <p role="status" className="rounded-2xl border border-(--c-linea) bg-(--c-blanco) px-5 py-4 text-[14px] text-(--c-tinta)">
          {q.aviso}
        </p>
      )}

      {partners.length === 0 ? (
        <TarjetaPanel>
          <p className="text-[14px] text-(--c-tinta-suave)">Todavía nadie aplicó al programa. Cuando alguien lo haga desde Partners en su panel, aparece acá.</p>
        </TarjetaPanel>
      ) : (
        <ul className="grid gap-4">
          {partners.map((p) => {
            const e = ESTADO_TEXTO[p.estado] ?? ESTADO_TEXTO.pendiente;
            const url = urlDePartner(p);
            return (
              <li key={p.id}>
                <TarjetaPanel>
                  <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl leading-tight text-(--c-tinta)">{p.nombre_comercial}</h2>
                        <span className={`c-montserrat rounded-full px-2.5 py-1 text-[11px] font-bold ${e.clase}`}>{e.texto}</span>
                        <span className="c-montserrat rounded-full bg-(--c-hielo) px-2.5 py-1 text-[11px] font-semibold text-(--c-tinta-suave)">{p.descuento_pct} %</span>
                      </div>
                      <p className="mt-1 text-[13px] text-(--c-tinta-suave)">
                        {p.correo} · {nombreTipoPartner(p.tipo)}
                        {p.ciudad ? ` · ${p.ciudad}` : ""}
                        {p.eventos_por_anio ? ` · ~${p.eventos_por_anio} eventos/año` : ""}
                      </p>
                      {p.descripcion && <p className="mt-3 text-[14px] leading-relaxed text-(--c-tinta)">{p.descripcion}</p>}
                      <dl className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
                        <div className="rounded-xl bg-(--c-hielo) p-3">
                          <dt className="text-[11px] uppercase tracking-[0.08em] text-(--c-tinta-suave)">Saldo</dt>
                          <dd className="c-montserrat mt-1 font-bold text-(--c-tinta)">{p.saldo} cr.</dd>
                        </div>
                        <div className="rounded-xl bg-(--c-hielo) p-3">
                          <dt className="text-[11px] uppercase tracking-[0.08em] text-(--c-tinta-suave)">Celebraciones</dt>
                          <dd className="c-montserrat mt-1 font-bold text-(--c-tinta)">{p.celebraciones}</dd>
                        </div>
                        <div className="rounded-xl bg-(--c-hielo) p-3">
                          <dt className="text-[11px] uppercase tracking-[0.08em] text-(--c-tinta-suave)">Publicadas</dt>
                          <dd className="c-montserrat mt-1 font-bold text-(--c-tinta)">{p.publicadas}</dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-[12px] text-(--c-tinta-suave)">
                        Aplicó el {fechaLargaCR(p.created_at.slice(0, 10))}
                        {p.aprobado_en ? ` · aprobado el ${fechaLargaCR(p.aprobado_en.slice(0, 10))}` : ""}
                        {url ? (
                          <>
                            {" · "}
                            <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                              {p.sitio ? "sitio" : p.instagram ? `@${p.instagram}` : "WhatsApp"}
                            </a>
                          </>
                        ) : null}
                        {" · "}firma {p.marca_en_invitaciones ? "activa" : "apagada"} · directorio {p.mostrar_en_directorio ? "sí" : "no"}
                      </p>
                    </div>

                    <form action={cambiarEstadoPartner} className="grid gap-3 rounded-2xl border border-(--c-linea) p-4">
                      <input type="hidden" name="id" value={p.id} />
                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1.5 text-[12px] font-semibold text-(--c-tinta)">
                          Estado
                          <select name="estado" defaultValue={p.estado} className="c-campo min-h-10 text-[13px]">
                            <option value="pendiente">Pendiente</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="suspendido">Suspendido</option>
                            <option value="rechazado">Rechazado</option>
                          </select>
                        </label>
                        <label className="grid gap-1.5 text-[12px] font-semibold text-(--c-tinta)">
                          Descuento %
                          <input name="descuento" type="number" min={0} max={60} defaultValue={p.descuento_pct} className="c-campo min-h-10 text-[13px]" />
                        </label>
                      </div>
                      <label className="grid gap-1.5 text-[12px] font-semibold text-(--c-tinta)">
                        Nota interna
                        <input name="notas" defaultValue={p.notas_admin ?? ""} maxLength={300} className="c-campo min-h-10 text-[13px]" placeholder="Referida por…, acordamos…" />
                      </label>
                      <button type="submit" className="c-boton c-boton-primario min-h-10 text-[13px]">
                        Guardar
                      </button>
                    </form>
                  </div>
                </TarjetaPanel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
