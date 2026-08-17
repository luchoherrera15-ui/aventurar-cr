import {
  definicionDe,
  descuentoAnualPct,
  precioDe,
  type PlanId,
} from "@/lib/lealtad/planes";
import {
  ETIQUETA_ESTADO,
  planesConPrecio,
  type EstadoSuscripcion,
  type Periodo,
} from "@/lib/pagos/precios";
import {
  BotonesPagarConTarjeta,
  BotonPortalDeFacturacion,
  type OpcionDePago,
} from "./pago-tarjeta";

/**
 * PAGAR CON TARJETA — el bloque de Stripe dentro de «Plan y
 * facturación».
 *
 * Vive en su propio archivo y no dentro de `seccion-plan.tsx` por dos
 * razones. La primera es que se pinta o no se pinta ENTERO: sin llaves
 * de Stripe configuradas no devuelve nada y la pantalla queda
 * exactamente como estaba antes de la 0143. La segunda es que la
 * grilla de paquetes de al lado describe el PRODUCTO (qué trae cada
 * uno) y esto describe el COBRO (cómo se paga y en qué estado está):
 * mezclarlos hace que cambiar una cosa obligue a leer la otra.
 *
 * ------------------------------------------------------------------
 * EL SINPE NO SE VA A NINGUNA PARTE
 * ------------------------------------------------------------------
 * Debajo de estos botones sigue estando «Solicitar este paquete», que
 * es el depósito con comprobante de siempre. No es un respaldo
 * temporal: muchas tarjetas costarricenses vienen bloqueadas para
 * compras internacionales y la LLC cobra desde Estados Unidos, así que
 * para buena parte de la clientela ese es el único camino que
 * funciona.
 *
 * ------------------------------------------------------------------
 * ACÁ NO SE ACTIVA NADA
 * ------------------------------------------------------------------
 * Ni un botón de esta pantalla escribe un plan. El plan lo escribe el
 * webhook cuando Stripe confirma el cobro con un evento firmado
 * (src/app/api/stripe/webhook/route.ts). Lo que se muestra del estado
 * de la suscripción es el ESPEJO de lo que Stripe dijo la última vez.
 */

/* El azul de acción para fondo oscuro: la card vive en el panel navy,
   donde el azul de marca se apaga. */
const ACCION = "var(--accion-claro)";

export type SuscripcionEnPanel = {
  estado: string;
  plan: string | null;
  periodo: string;
  periodoFin: string | null;
  cancelaAlFinal: boolean;
};

export default function FacturacionConTarjeta({
  ranchoId,
  suscripcion,
  aviso = null,
}: {
  ranchoId: string;
  suscripcion: SuscripcionEnPanel | null;
  /** De vuelta de Stripe: `listo` o `cancelado`. */
  aviso?: "listo" | "cancelado" | null;
}) {
  // Qué se puede cobrar HOY en este servidor. Un paquete sin su
  // variable STRIPE_PRICE_… puesta no muestra botón, en vez de mostrar
  // uno que lleva a un error.
  const cobrables = planesConPrecio();

  // Sin Stripe y sin suscripción no hay absolutamente nada que decir.
  if (cobrables.length === 0 && !suscripcion && !aviso) return null;

  return (
    <div className="space-y-4">
      {/* ── De vuelta de Checkout ────────────────────────────────────
          «En unos segundos» y no «listo»: el plan lo confirma el
          webhook, no esta pantalla —que se abre escribiendo la URL—.
          Decir que ya está y que el panel muestre lo contrario es peor
          que pedir diez segundos. */}
      {aviso === "listo" && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-800">
          Recibimos tu pago. El paquete queda activo en unos segundos, apenas Stripe lo
          confirme — recargá esta página si todavía no lo ves.
        </p>
      )}
      {aviso === "cancelado" && (
        <p className="rounded-xl border border-aventurea-line bg-white px-4 py-3 text-[13px] font-bold text-aventurea-ink">
          No se cobró nada: se cerró el pago antes de terminar. Podés volver a intentarlo o
          pagar por SINPE.
        </p>
      )}

      {suscripcion && <TarjetaSuscripcion ranchoId={ranchoId} suscripcion={suscripcion} />}

      {cobrables.length > 0 && (
        <div className="rounded-2xl border border-aventurea-line bg-white p-5">
          <h3 className="text-[15px] font-extrabold text-aventurea-ink">
            {suscripcion ? "Cambiar de paquete con tarjeta" : "Pagar con tarjeta"}
          </h3>
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Se cobra solo cada período y se cancela cuando quieras. Si tu tarjeta no acepta
            compras internacionales —le pasa a muchas tarjetas de acá— pagá por SINPE con el
            botón de cada paquete.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {cobrables.map(({ plan, periodos }) => (
              <PaqueteCobrable
                key={plan}
                ranchoId={ranchoId}
                plan={plan}
                periodos={periodos}
                esElSuyo={suscripcion?.plan === plan}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────────

function TarjetaSuscripcion({
  ranchoId,
  suscripcion,
}: {
  ranchoId: string;
  suscripcion: SuscripcionEnPanel;
}) {
  const def = definicionDe(suscripcion.plan);
  const estado = suscripcion.estado as EstadoSuscripcion;
  const etiqueta = ETIQUETA_ESTADO[estado] ?? suscripcion.estado;
  const alDia = estado === "activa" || estado === "en_prueba";

  return (
    <div className="rounded-2xl border border-aventurea-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-[15px] font-extrabold text-aventurea-ink">Tu suscripción</h3>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={
            alDia
              ? { background: "rgba(22,163,74,.14)", color: "#15803d" }
              : { background: "rgba(239,68,68,.12)", color: "#b91c1c" }
          }
        >
          {etiqueta}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] text-aventurea-ink-soft">
        {def ? `Paquete ${def.nombre}` : "Paquete sin identificar"}
        {suscripcion.periodo === "anual" ? ", pago por año" : ", pago por mes"}
        {suscripcion.periodoFin ? ` · ${textoDeVencimiento(suscripcion)}` : ""}
      </p>

      {/* Cancelada-pero-corriendo es un estado propio y hay que
          decirlo: el negocio TIENE lo que pagó hasta esa fecha, y
          mostrarlo como «cancelada» a secas haría que alguien vuelva a
          pagar por algo que todavía está andando. */}
      {suscripcion.cancelaAlFinal && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] font-bold text-amber-800">
          Cancelaste la renovación: el paquete sigue funcionando hasta que termine el período
          pago, y después no se cobra más.
        </p>
      )}
      {estado === "morosa" && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] font-bold text-red-700">
          El último cobro no entró. Stripe lo reintenta solo; si tu tarjeta cambió,
          actualizala desde el botón de abajo.
        </p>
      )}

      <BotonPortalDeFacturacion ranchoId={ranchoId} />
    </div>
  );
}

function PaqueteCobrable({
  ranchoId,
  plan,
  periodos,
  esElSuyo,
}: {
  ranchoId: string;
  plan: PlanId;
  periodos: readonly Periodo[];
  esElSuyo: boolean;
}) {
  const def = definicionDe(plan);
  if (!def) return null;

  // Las etiquetas se arman en el SERVIDOR, donde vive el catálogo: el
  // «2 meses gratis» sale de `mesesDeAhorroAnual`, no de un texto
  // escrito a mano que se desincroniza el día que cambie un precio.
  const ahorro = descuentoAnualPct(def);
  const opciones: OpcionDePago[] = periodos.map((periodo) =>
    periodo === "anual"
      ? {
          periodo,
          etiqueta:
            `Pagar el año — ${precioDe(def, "año") ?? ""}` +
            (ahorro > 0 ? ` (${ahorro}% menos)` : ""),
        }
      : { periodo, etiqueta: `Pagar ${precioDe(def) ?? ""} por mes` },
  );

  return (
    <div className="rounded-2xl border border-aventurea-line p-4">
      <p className="text-[14px] font-extrabold text-aventurea-ink">{def.nombre}</p>
      <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
        {def.limites.clientesActivos === null
          ? "Clientes ilimitados"
          : `Hasta ${def.limites.clientesActivos.toLocaleString("es-CR")} clientes activos`}
      </p>
      {esElSuyo && (
        <p className="mt-1.5 text-[11px] font-bold" style={{ color: ACCION }}>
          Es el que estás pagando
        </p>
      )}
      <BotonesPagarConTarjeta
        ranchoId={ranchoId}
        plan={plan}
        opciones={opciones}
        destacado={!esElSuyo}
      />
    </div>
  );
}

/**
 * «Se renueva el 12 de septiembre» / «Vale hasta el 12 de septiembre».
 *
 * La diferencia importa: con la renovación cancelada, esa fecha es un
 * final y no un cobro.
 */
function textoDeVencimiento(s: SuscripcionEnPanel): string {
  if (!s.periodoFin) return "";
  const fecha = new Date(s.periodoFin).toLocaleDateString("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return s.cancelaAlFinal || s.estado === "cancelada"
    ? `vale hasta el ${fecha}`
    : `se renueva el ${fecha}`;
}
