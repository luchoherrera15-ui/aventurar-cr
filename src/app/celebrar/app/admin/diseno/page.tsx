import type { Metadata } from "next";
import { EncabezadoPanel, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { rutaEditor } from "@/lib/celebrar/rutas";
import { createClient } from "@/lib/supabase/server";
import { atenderPedidoDiseno } from "./acciones";

export const metadata: Metadata = { title: "Admin · Ayuda de diseño" };

type Pedido = {
  id: string;
  owner_id: string;
  correo: string;
  nombre: string | null;
  celebracion_id: string | null;
  celebracion: string | null;
  celebracion_slug: string | null;
  mensaje: string;
  contacto: string | null;
  alcance: "ajustes" | "rediseno" | "a_medida";
  estado: "pendiente" | "en_proceso" | "atendida";
  nota_admin: string | null;
  atendida_en: string | null;
  created_at: string;
};

const ALCANCE: Record<Pedido["alcance"], string> = { ajustes: "Ajustes", rediseno: "Rediseño completo", a_medida: "A medida por el equipo" };
const ESTADO: Record<Pedido["estado"], { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-(--c-coral-suave) text-(--c-coral-tinta)" },
  en_proceso: { texto: "En proceso", clase: "bg-(--c-celeste) text-(--c-marino)" },
  atendida: { texto: "Atendida", clase: "bg-(--c-ok-suave) text-(--c-ok)" },
};

/**
 * LA BANDEJA DE «¿NO ESTÁS CONTENTO CON TU DISEÑO?»: cada pedido con
 * quién lo hizo, de qué celebración, qué quiere y cómo contactarle, con
 * el link directo al editor de esa invitación (el admin también es
 * dueño de todo por RLS… no: entra por la RPC y edita con el link).
 */
export default async function AdminDisenoPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_admin_ayuda_diseno");
  if (error) console.error("[celebrar] admin ayuda diseño:", error.message);
  const pedidos = (data ?? []) as Pedido[];
  const pendientes = pedidos.filter((p) => p.estado === "pendiente").length;

  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Ayuda de diseño · administración"
        descripcion={`${pendientes} ${pendientes === 1 ? "pedido pendiente" : "pedidos pendientes"}. Cada uno es alguien que quiere una invitación mejor: se atiende por WhatsApp o correo, y se marca acá.`}
      />
      {q.aviso && (
        <p role="status" className="rounded-2xl border border-(--c-linea) bg-(--c-blanco) px-5 py-4 text-[14px] text-(--c-tinta)">
          {q.aviso}
        </p>
      )}
      {pedidos.length === 0 ? (
        <TarjetaPanel>
          <p className="text-[14px] text-(--c-tinta-suave)">Todavía nadie pidió ayuda. Cuando alguien toque «Pedir ayuda al equipo» en su celebración, aparece acá y llega un correo.</p>
        </TarjetaPanel>
      ) : (
        <ul className="grid gap-4">
          {pedidos.map((p) => {
            const e = ESTADO[p.estado] ?? ESTADO.pendiente;
            return (
              <li key={p.id}>
                <TarjetaPanel>
                  <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg leading-tight text-(--c-tinta)">{p.celebracion ?? "Sin celebración"}</h2>
                        <span className={`c-montserrat rounded-full px-2.5 py-1 text-[11px] font-bold ${e.clase}`}>{e.texto}</span>
                        <span className="c-montserrat rounded-full bg-(--c-hielo) px-2.5 py-1 text-[11px] font-semibold text-(--c-tinta-suave)">{ALCANCE[p.alcance] ?? p.alcance}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-(--c-tinta-suave)">
                        {p.nombre ? `${p.nombre} · ` : ""}
                        {p.correo}
                        {p.contacto ? ` · ${p.contacto}` : ""} · {new Date(p.created_at).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="mt-3 whitespace-pre-line rounded-xl bg-(--c-hielo) p-4 text-[14px] leading-relaxed text-(--c-tinta)">{p.mensaje}</p>
                      {p.celebracion_id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <EnlaceCelebrar a={rutaEditor(p.celebracion_id)} className="c-boton c-boton-secundario min-h-9 text-[12px]">
                            Abrir su editor
                          </EnlaceCelebrar>
                          {p.celebracion_slug && (
                            <EnlaceCelebrar a={`/${p.celebracion_slug}`} className="c-boton c-boton-secundario min-h-9 text-[12px]">
                              Ver la invitación
                            </EnlaceCelebrar>
                          )}
                        </div>
                      )}
                    </div>
                    <form action={atenderPedidoDiseno} className="grid gap-3 rounded-2xl border border-(--c-linea) p-4">
                      <input type="hidden" name="id" value={p.id} />
                      <label className="grid gap-1.5 text-[12px] font-semibold text-(--c-tinta)">
                        Estado
                        <select name="estado" defaultValue={p.estado} className="c-campo min-h-10 text-[13px]">
                          <option value="pendiente">Pendiente</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="atendida">Atendida</option>
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-[12px] font-semibold text-(--c-tinta)">
                        Nota interna
                        <input name="nota" defaultValue={p.nota_admin ?? ""} maxLength={300} className="c-campo min-h-10 text-[13px]" placeholder="Le escribí por WhatsApp, quedamos en…" />
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
