import type { Metadata } from "next";
import { EncabezadoPanel, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { PAQUETES, PAQUETES_PARTNER, PRECIOS, PRECIO_A_MEDIDA_CRC, PRECIO_PLANTILLA_CRC, VALOR_CREDITO_CRC, colones, enColones, precioPaquetePartner } from "@/lib/celebrar/creditos";
import { partnerAprobado } from "@/lib/celebrar/partners";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { RUTA } from "@/lib/celebrar/rutas";
import { movimientosCreditos, saldoCreditos } from "@/lib/celebrar/datos";
import { sePuedenComprarCreditos } from "@/lib/celebrar/pagos/checkout-creditos";
import { fechaLargaCR } from "@/lib/fechas";
import { comprarCreditos, confirmarVueltaDeStripe, type EstadoDeVuelta } from "./acciones";

export const metadata: Metadata = { title: "Precios y pagos" };

type Busqueda = { pago?: string; sesion?: string; motivo?: string };

const RECARGA_IA = PAQUETES.find((p) => p.id === "ia")!;

/**
 * PRECIOS Y PAGOS (antes «Mis créditos»).
 *
 * El dueño (24 sep 2026): los créditos confundían a la gente. Acá manda
 * lo que cuesta UNA invitación —₡7 500 la de plantilla, se paga al
 * publicar; ₡10 500 la a medida, se paga al pedirla— y los créditos
 * quedan por dentro: el saldo a favor (si hay), la recarga para la IA y
 * los paquetes mayoristas de partners, cada uno en un desplegable.
 *
 * La vuelta desde Stripe de una recarga o un paquete llega con
 * `?pago=listo&sesion=cs_…`: se verifica contra la API y se acredita
 * antes de pintar. (El pago de UNA invitación vuelve por /app/pago.)
 */
export default async function PreciosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const q = await searchParams;
  let vuelta: EstadoDeVuelta | null = null;
  if (q.pago === "listo" && q.sesion) vuelta = await confirmarVueltaDeStripe(q.sesion);

  const [saldo, movimientos, partner] = await Promise.all([saldoCreditos(), movimientosCreditos(), partnerAprobado()]);
  const hayTarjeta = sePuedenComprarCreditos();
  const tipoTexto: Record<string, string> = { compra: "Pago", consumo: "Uso", regalo: "Regalo", ajuste: "Ajuste", reembolso: "Reembolso" };

  return (
    <div className="grid gap-8">
      <EncabezadoPanel titulo="Precios y pagos" descripcion="Crear, editar y probar tu invitación es gratis. Pagás una sola vez, cuando la publicás." />

      {vuelta && <AvisoDeVuelta vuelta={vuelta} />}
      {q.pago === "cancelado" && (
        <p role="status" className="rounded-2xl border border-(--c-linea) bg-(--c-blanco) px-5 py-4 text-[14px] text-(--c-tinta-suave)">
          No se hizo ningún cobro.
        </p>
      )}
      {q.pago === "error" && (
        <p role="alert" className="rounded-2xl border border-(--c-coral) bg-(--c-coral-suave) px-5 py-4 text-[14px] text-(--c-coral-tinta)">
          {q.motivo ?? "No se pudo abrir el pago."}
        </p>
      )}

      {/* ── Los dos precios ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TarjetaPanel tono="marina" className="flex flex-col">
          <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-sobre-marino-suave)">Invitación de plantilla</p>
          <p className="c-montserrat mt-3 text-5xl font-extrabold leading-none text-(--c-blanco)">{colones(PRECIO_PLANTILLA_CRC)}</p>
          <p className="mt-2 text-[14px] text-(--c-sobre-marino-suave)">por invitación · se paga al publicar</p>
          <ul className="mt-6 grid gap-2.5 border-t border-(--c-blanco)/15 pt-5 text-[14px] text-(--c-blanco)">
            <Incluye oscuro>Elegís una plantilla y la editás a tu gusto: textos, fotos, colores, música</Incluye>
            <Incluye oscuro>Tu link propio para compartir por WhatsApp y redes</Incluye>
            <Incluye oscuro>Confirmación de asistencia y panel de invitados</Incluye>
            <Incluye oscuro>Despublicar y volver a publicar no cobra de nuevo</Incluye>
          </ul>
          <div className="mt-auto pt-6">
            <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-claro">
              Crear una invitación
            </EnlaceCelebrar>
          </div>
        </TarjetaPanel>

        <TarjetaPanel className="flex flex-col border-2 border-(--c-marino)">
          <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">Diseñada a medida por el equipo</p>
          <p className="c-montserrat mt-3 text-5xl font-extrabold leading-none text-(--c-tinta)">{colones(PRECIO_A_MEDIDA_CRC)}</p>
          <p className="mt-2 text-[14px] text-(--c-tinta-suave)">por invitación · se paga al pedirla</p>
          <ul className="mt-6 grid gap-2.5 border-t border-(--c-linea) pt-5 text-[14px] text-(--c-tinta)">
            <Incluye>Nuestro equipo de diseño la arma con tus ideas y referencias</Incluye>
            <Incluye>Todo lo de la invitación de plantilla</Incluye>
            <Incluye>La publicación ya está incluida: no pagás nada más</Incluye>
            <Incluye>Te escribimos en menos de 24 horas para empezar</Incluye>
          </ul>
          <div className="mt-auto pt-6">
            <EnlaceCelebrar a={RUTA.appCelebraciones} className="c-boton c-boton-primario">
              Pedirla desde tu celebración
            </EnlaceCelebrar>
            <p className="mt-2 text-[12px] text-(--c-tinta-suave)">Abrí la celebración y tocá «¿No estás contento con tu diseño?» → «Que el equipo la haga a medida».</p>
          </div>
        </TarjetaPanel>
      </div>

      {/* ── Cómo se paga ── */}
      <TarjetaPanel>
        <h2 className="text-xl leading-tight text-(--c-tinta)">Cómo se paga</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          <Paso n={1} titulo="Creala gratis">Elegí una plantilla, editala y mirá la vista previa todas las veces que quieras.</Paso>
          <Paso n={2} titulo="Tocá «Publicar»">Pagás {colones(PRECIO_PLANTILLA_CRC)} con tarjeta, Apple Pay o Google Pay en una página segura de Stripe.</Paso>
          <Paso n={3} titulo="Compartí tu link">Vuelve publicada sola, lista para mandar. ¿Preferís SINPE? Escribinos y la activamos.</Paso>
        </ol>
        {saldo > 0 && (
          <p className="mt-5 rounded-xl bg-(--c-hielo) px-4 py-3 text-[13px] text-(--c-tinta)">
            Tenés <strong>{enColones(saldo)}</strong> a favor ({saldo.toLocaleString("es-CR")} créditos). Se usan primero al publicar o al generar con IA.
          </p>
        )}
      </TarjetaPanel>

      {/* ── Lo de los créditos, cerrado ── */}
      <div className="grid gap-4">
        <Desplegable titulo="Créditos para generar con IA" resumen={`Crear la invitación con IA gasta créditos (desde ${PRECIOS.invitacion_ia} por generación).`}>
          <p className="text-[14px] leading-relaxed text-(--c-tinta-suave)">
            Editar a mano es gratis. La invitación completa generada con IA gasta créditos según el bot que elijas (desde {PRECIOS.invitacion_ia}). Tu saldo: <strong className="text-(--c-tinta)">{saldo.toLocaleString("es-CR")} créditos</strong>.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-(--c-linea) p-4">
            <div className="flex-1">
              <p className="c-montserrat text-[15px] font-semibold text-(--c-tinta)">
                {RECARGA_IA.creditos} créditos · {colones(RECARGA_IA.precioCRC)}
              </p>
              <p className="text-[12px] text-(--c-tinta-suave)">No vencen. También sirven para publicar.</p>
            </div>
            {hayTarjeta ? (
              <form action={comprarCreditos}>
                <input type="hidden" name="paquete" value={RECARGA_IA.id} />
                <button type="submit" className="c-boton c-boton-secundario min-h-10 text-[13px]">
                  Recargar
                </button>
              </form>
            ) : (
              <p className="text-[12px] text-(--c-tinta-suave)">Pago con tarjeta no disponible: escribinos y te los cargamos.</p>
            )}
          </div>
        </Desplegable>

        <Desplegable titulo="Partners · paquetes mayoristas" resumen={partner ? `Tu descuento: ${partner.descuento_pct} %` : "Para planners, agencias y decoradores que hacen muchas invitaciones."}>
          {partner ? (
            <>
              <p className="text-[14px] leading-relaxed text-(--c-tinta-suave)">
                Como partner comprás créditos con {partner.descuento_pct} % de descuento: una invitación de plantilla te sale en{" "}
                <strong className="text-(--c-tinta)">{colones(Math.round(PRECIOS.publicar * VALOR_CREDITO_CRC * (1 - partner.descuento_pct / 100)))}</strong> y le cobrás a tu cliente lo que quieras.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {PAQUETES_PARTNER.map((p) => {
                  const precio = precioPaquetePartner(p.creditos, partner.descuento_pct);
                  return (
                    <li key={p.id} className={`flex flex-col rounded-2xl border-2 p-4 ${"destacado" in p && p.destacado ? "border-(--c-marino)" : "border-(--c-linea)"}`}>
                      <p className="c-montserrat text-2xl font-extrabold leading-none text-(--c-tinta)">{p.creditos.toLocaleString("es-CR")}</p>
                      <p className="c-montserrat text-[12px] font-semibold text-(--c-tinta-suave)">créditos · {Math.floor(p.creditos / PRECIOS.publicar)} invitaciones</p>
                      <p className="mt-3 text-lg font-semibold text-(--c-tinta)">{colones(precio)}</p>
                      <p className="flex-1 text-[12px] text-(--c-tinta-suave)">{p.nota}</p>
                      {hayTarjeta ? (
                        <form action={comprarCreditos} className="mt-4">
                          <input type="hidden" name="paquete" value={p.id} />
                          <button type="submit" className="c-boton c-boton-primario min-h-10 w-full text-[13px]">
                            Comprar
                          </button>
                        </form>
                      ) : (
                        <button type="button" disabled className="c-boton c-boton-primario mt-4 min-h-10 w-full text-[13px] opacity-60">
                          Comprar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[12px] text-(--c-tinta-suave)">
                ¿Transferencia o SINPE por volumen? Escribinos y te cargamos el paquete con tu descuento.{" "}
                <EnlaceCelebrar a={RUTA.appPartner} className="underline underline-offset-4">
                  Tu panel de partner
                </EnlaceCelebrar>
              </p>
            </>
          ) : (
            <p className="text-[14px] leading-relaxed text-(--c-tinta-suave)">
              Si hacés invitaciones para tus clientes, el programa de partners te da créditos con descuento, plantillas propias y tu firma en cada invitación.{" "}
              <EnlaceCelebrar a={RUTA.partners} className="font-semibold text-(--c-tinta) underline underline-offset-4">
                Conocé el programa
              </EnlaceCelebrar>
            </p>
          )}
        </Desplegable>
      </div>

      {/* ── Historial ── */}
      <TarjetaPanel className="overflow-hidden !p-0">
        <div className="border-b border-(--c-linea) px-6 py-4">
          <h2 className="text-xl leading-tight text-(--c-tinta)">Historial</h2>
          <p className="mt-0.5 text-[13px] text-(--c-tinta-suave)">{movimientos.length === 0 ? "Todavía no hay pagos." : "Lo más reciente primero."}</p>
        </div>
        {movimientos.length > 0 && (
          <ul className="divide-y divide-(--c-linea)">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 px-6 py-3 text-[14px]">
                <div className="min-w-0">
                  <p className="truncate text-(--c-tinta)">{m.concepto}</p>
                  <p className="text-[12px] text-(--c-tinta-suave)">
                    {tipoTexto[m.tipo] ?? m.tipo} · {fechaLargaCR(m.created_at.slice(0, 10))}
                  </p>
                </div>
                <p className={`c-montserrat shrink-0 font-semibold ${m.cantidad < 0 ? "text-(--c-tinta)" : "text-(--c-ok)"}`}>
                  {m.monto_crc ? colones(m.monto_crc) : `${m.cantidad > 0 ? "+" : "−"}${enColones(Math.abs(m.cantidad))}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </TarjetaPanel>
    </div>
  );
}

function Incluye({ children, oscuro = false }: { children: React.ReactNode; oscuro?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <svg viewBox="0 0 24 24" className={`mt-0.5 h-4 w-4 shrink-0 ${oscuro ? "text-(--c-sobre-marino-suave)" : "text-(--c-ok)"}`} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="c-montserrat grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--c-marino) text-[13px] font-bold text-(--c-blanco)">{n}</span>
      <span>
        <span className="c-montserrat block text-[14px] font-semibold text-(--c-tinta)">{titulo}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-(--c-tinta-suave)">{children}</span>
      </span>
    </li>
  );
}

/** Un bloque cerrado que se abre al tocarlo (lo de los créditos, que no es para todo el mundo). */
function Desplegable({ titulo, resumen, children }: { titulo: string; resumen: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-(--c-linea) bg-(--c-blanco)">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="c-montserrat block text-[15px] font-semibold text-(--c-tinta)">{titulo}</span>
          <span className="mt-0.5 block text-[13px] text-(--c-tinta-suave)">{resumen}</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-(--c-tinta-suave) transition-transform duration-(--duracion-micro) group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="border-t border-(--c-linea) px-6 py-5">{children}</div>
    </details>
  );
}

function AvisoDeVuelta({ vuelta }: { vuelta: EstadoDeVuelta }) {
  if (vuelta.tipo === "acreditado" || vuelta.tipo === "ya_estaba") {
    return (
      <p role="status" className="rounded-2xl border border-(--c-ok) bg-(--c-ok-suave) px-5 py-4 text-[14px] text-(--c-ok)">
        <span className="c-montserrat font-semibold">¡Listo!</span> Se acreditaron {vuelta.creditos} créditos ({enColones(vuelta.creditos)}) a tu cuenta. Gracias.
      </p>
    );
  }
  if (vuelta.tipo === "pendiente") {
    return (
      <p role="status" className="rounded-2xl border border-(--c-linea) bg-(--c-blanco) px-5 py-4 text-[14px] text-(--c-tinta-suave)">
        Recibimos tu pago y lo estamos acreditando. Si en un minuto no lo ves, recargá esta página.
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-2xl border border-(--c-coral) bg-(--c-coral-suave) px-5 py-4 text-[14px] text-(--c-coral-tinta)">
      No encontramos ese pago en tu cuenta. Si se cobró, escribinos con el comprobante y lo resolvemos.
    </p>
  );
}
