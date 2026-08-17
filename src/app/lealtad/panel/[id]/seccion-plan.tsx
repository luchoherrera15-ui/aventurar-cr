import Link from "next/link";
import {
  definicionDe,
  estadoDelLimite,
  etiquetasDeCapacidades,
  precioDe,
} from "@/lib/lealtad/planes";
import { textoRestante, type EstadoPrueba } from "@/lib/lealtad/prueba";
import { fechaISOCR, fechaLargaCR } from "@/lib/fechas";
import { Icono } from "./iconos";
import Medidor from "./medidor";

/**
 * PLAN Y FACTURACIÓN — el equivalente nuestro del "Billing &
 * Subscription" de Cockato: el plan actual, cuánto llevás consumido de
 * tus topes, y la grilla de paquetes para comparar.
 *
 * Todo sale de `planes.ts` y de contar filas. Acá no se guarda ningún
 * número: el tope es del catálogo y el consumo se cuenta, así que
 * cambiar de plan cambia los medidores solo.
 *
 * DOS COSAS DE COCKATO QUE NO SE COPIARON, porque mentirían:
 *
 *  · «Outlets» (sucursales) — no existe el modelo de datos. Un medidor
 *    "0 / 1 sucursales" sería decoración.
 *  · «45-day free trial» y el interruptor Mensual/Anual — nuestra
 *    compra es por depósito SINPE con comprobante (0128), no hay
 *    suscripción ni cobro recurrente que anualizar. Prometer una
 *    prueba que nadie puede empezar es peor que no ofrecerla.
 */

/* El azul de acción para fondo oscuro. La sección vive dentro del panel
   navy —y sus cards `bg-white` ahí son blanco al 5%, o sea casi el mismo
   fondo—, así que el azul de marca no se lee en ninguno de los dos. */
const ACCION = "var(--accion-claro)";
const ACCION_TINTE = "rgba(157,180,255,.14)";
const ACCION_BORDE = "rgba(157,180,255,.45)";

/* Acá vivían `ACCION_TINTA` y `ACENTO`, que solo usaba la grilla de
   paquetes. La grilla se fue a `/lealtad/planes` —esta sección responde
   «qué tengo y cómo voy», no «cuál compro»— y con ella se fue el último
   naranja del panel. */

export default function SeccionPlan({
  ranchoId,
  plan,
  miembros,
  equipo,
  prueba,
}: {
  ranchoId: string;
  plan: string | null;
  miembros: number;
  /** Colaboradores dados de alta, sin contar al dueño. */
  equipo: number;
  /**
   * En qué punto de la prueba de 14 días está. Se pinta acá y no solo
   * en un correo porque el correo se pierde y el panel es donde el
   * dueño ya está mirando: con la fecha a la vista, el corte deja de
   * ser una sorpresa. `esPrueba: false` = no hay nada que contar.
   */
  prueba: EstadoPrueba;
}) {
  const actual = definicionDe(plan);
  const limite = estadoDelLimite(plan, "clientesActivos", miembros);
  // +1 por el dueño: `administradores` lo cuenta, y por eso la Prueba
  // va en 1. El mismo criterio que hace cumplir `equipo-actions.ts`, o
  // el medidor diría 0/1 mientras la invitación rebota.
  const limiteEquipo = estadoDelLimite(plan, "administradores", equipo + 1);

  // La cuenta regresiva, escrita UNA vez: el mismo texto que usa el
  // correo del aviso, para que las dos superficies nunca digan números
  // distintos.
  const restante = textoRestante(prueba);
  const cortaHoy = prueba.esPrueba && !prueba.vencida && (prueba.diasRestantes ?? 99) <= 3;

  return (
    <div className="space-y-5">
      {/* ── La prueba y su fecha de corte ───────────────────────── */}
      {prueba.esPrueba && prueba.venceEn && (
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: cortaHoy ? ACCION_TINTE : "rgba(255,255,255,.06)",
            border: `1px solid ${cortaHoy ? ACCION_BORDE : "rgba(255,255,255,.14)"}`,
          }}
        >
          <p className="text-[14.5px] font-extrabold text-aventurea-ink">{restante}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            Tu prueba se termina el{" "}
            <b>{fechaLargaCR(fechaISOCR(new Date(prueba.venceEn)))}</b>. Ese día el programa
            queda en pausa hasta que elijas un paquete —{" "}
            <b>no se borra nada</b>: tus clientes, sus sellos y sus pases quedan tal cual.
          </p>
        </div>
      )}

      {/* ── Tu plan + el consumo ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Encabezado icono="plan" titulo="Tu plan actual" />
          {actual ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[28px] font-extrabold leading-none text-aventurea-ink">
                  {actual.nombre}
                </p>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: ACCION_TINTE, color: ACCION }}
                >
                  {actual.precioMensual === null
                    ? "A convenir"
                    : actual.precioMensual === 0
                      ? "Gratis"
                      : `${precioDe(actual)}/mes`}
                </span>
                {!actual.vigente && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-aventurea-ink-soft">
                    Paquete anterior
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">
                {actual.descripcion}
              </p>
              {/* `etiquetasDeCapacidades` y no `ETIQUETAS_CAPACIDAD`
                  suelto: la viñeta de los tipos depende del paquete
                  (0142), y la etiqueta estática dice «según tu paquete»
                  a propósito para que nadie la pinte sola por error. */}
              <ul className="mt-4 space-y-1.5">
                {etiquetasDeCapacidades(actual).map((texto) => (
                  <li key={texto} className="flex items-start gap-2">
                    <span className="mt-[1px] shrink-0 text-aventurea-green">
                      <Icono nombre="listo" className="h-[15px] w-[15px]" />
                    </span>
                    <span className="text-[12.5px] leading-snug text-aventurea-ink-soft">
                      {texto}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-aventurea-ink-soft">
              Tu programa está activo sin un paquete asignado. Elegí uno abajo para fijar tu
              tope de miembros y tus beneficios.
            </p>
          )}
        </Card>

        <Card>
          <Encabezado icono="metricas" titulo="Tu consumo" />
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Cómo vas contra los topes de tu paquete.
          </p>

          <div className="mt-5 space-y-4">
            <Medidor
              icono="clientes"
              etiqueta="Miembros afiliados"
              usado={miembros}
              tope={limite.limite}
              alerta={limite.lleno}
              aviso={limite.cerca}
            />
            <Medidor
              icono="equipo"
              etiqueta="Gente de tu equipo"
              usado={equipo + 1}
              tope={limiteEquipo.limite}
              alerta={limiteEquipo.lleno}
              aviso={limiteEquipo.cerca}
              detalle="Sin tope: sumá a quien necesités en el mostrador."
            />
          </div>

          {limite.lleno && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] font-bold text-red-700">
              Tu paquete llegó al tope: un cliente nuevo ya no se puede afiliar. Subí de
              paquete para seguir sumando gente.
            </p>
          )}
          {limite.cerca && !limite.lleno && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] font-bold text-amber-800">
              Te queda{limite.disponibles === 1 ? "" : "n"} {limite.disponibles} lugar
              {limite.disponibles === 1 ? "" : "es"}. Conviene subir antes de toparte.
            </p>
          )}
        </Card>
      </div>

      {/* ── Los paquetes: un botón, no la grilla entera ──────────────
          Acá se repetían las cuatro tarjetas de paquete con todas sus
          viñetas, o sea la misma grilla que ya vive en /lealtad/planes.
          Duplicada tenía dos problemas: empujaba «Tu plan actual» y «Tu
          consumo» —que es a lo que se entra a esta pantalla— muy abajo,
          y obligaba a mantener el mismo catálogo en dos lugares.
          Ahora esta sección responde «qué tengo y cómo voy», y para
          comparar paquetes manda a la pantalla que existe para eso. */}
      <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5">
        <h3 className="text-[16px] font-extrabold text-white">¿Necesitás más?</h3>
        <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-white/55">
          Compará los paquetes, sus topes y qué incluye cada uno. Se paga con tarjeta y queda
          activo al instante, o por SINPE si tu tarjeta no acepta compras internacionales.
        </p>
        <Link
          href={`/lealtad/planes?negocio=${ranchoId}`}
          className="presionable mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-extrabold"
          style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
        >
          Ver paquetes
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-white p-5">{children}</div>
  );
}

function Encabezado({
  icono,
  titulo,
}: {
  icono: Parameters<typeof Icono>[0]["nombre"];
  titulo: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
        style={{ background: ACCION_TINTE, color: ACCION }}
      >
        <Icono nombre={icono} className="h-[17px] w-[17px]" />
      </span>
      <h3 className="text-[15px] font-extrabold text-aventurea-ink">{titulo}</h3>
    </div>
  );
}
