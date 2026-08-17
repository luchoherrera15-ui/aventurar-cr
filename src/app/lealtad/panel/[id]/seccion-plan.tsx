import Link from "next/link";
import {
  definicionDe,
  estadoDelLimite,
  etiquetasDeCapacidades,
  precioDe,
} from "@/lib/lealtad/planes";
import { textoRestante, type EstadoPrueba } from "@/lib/lealtad/prueba";
import { fechaISOCR, fechaLargaCR } from "@/lib/fechas";
import { Card, GrillaTablero, PildoraEstado } from "@/components/panel/piezas";
import {
  CUERPO,
  CUERPO_SUAVE,
  ESTADO_AVISO,
  GAP_TABLERO,
  RADIO_CARD,
  RADIO_TILE,
} from "@/components/panel/sistema";
import { ACCION, ACCION_BORDE, ACCION_TINTA, ACCION_TINTE, BOTON_ACCION } from "../sistema-lealtad";
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

/* El par de acción sale ahora de `panel/sistema-lealtad`, que es el
   único lugar donde vive: estaba copiado en cuatro archivos con el
   mismo comentario, y cuatro copias de un color es cómo un panel
   termina con cuatro azules.

   Acá vivía además `ACENTO`, que solo usaba la grilla de paquetes. La
   grilla se fue a `/lealtad/planes` —esta sección responde «qué tengo y
   cómo voy», no «cuál compro»— y con ella se fue el último naranja del
   panel. */

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
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {/* ── La prueba y su fecha de corte ─────────────────────────
          Es el `.insight` de la maqueta: el bloque que se despega para
          decir la única cosa que hay que decidir. Se enciende con el
          acento solo cuando quedan tres días o menos; el resto del
          tiempo es una tarjeta más, para que el énfasis signifique algo
          cuando llegue. */}
      {prueba.esPrueba && prueba.venceEn && (
        <div
          className={`${RADIO_CARD} border px-5 py-4`}
          style={
            cortaHoy
              ? { background: ACCION_TINTE, borderColor: ACCION_BORDE }
              : { background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.14)" }
          }
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
      <GrillaTablero>
        <Card
          eyebrow="Tu paquete"
          titulo="Tu plan actual"
          nivel="h3"
          accion={
            actual ? (
              <span
                className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase leading-none tracking-wide"
                style={{ background: ACCION_TINTE, color: ACCION }}
              >
                {actual.precioMensual === null
                  ? "A convenir"
                  : actual.precioMensual === 0
                    ? "Gratis"
                    : `${precioDe(actual)}/mes`}
              </span>
            ) : (
              <PildoraEstado estado="neutro">Sin paquete</PildoraEstado>
            )
          }
        >
          {actual ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-[28px] font-extrabold leading-none tracking-[-0.04em] text-aventurea-ink">
                  {actual.nombre}
                </p>
                {!actual.vigente && (
                  <PildoraEstado estado="neutro">Paquete anterior</PildoraEstado>
                )}
              </div>
              <p className={`mt-1.5 ${CUERPO_SUAVE}`}>{actual.descripcion}</p>
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
            <p className={CUERPO}>
              Tu programa está activo sin un paquete asignado. Elegí uno abajo para fijar tu
              tope de miembros y tus beneficios.
            </p>
          )}
        </Card>

        <Card
          eyebrow="Cómo vas"
          titulo="Tu consumo"
          nivel="h3"
          accion={
            limite.lleno ? (
              <PildoraEstado estado="alerta">Tope lleno</PildoraEstado>
            ) : limite.cerca ? (
              <PildoraEstado estado="aviso">Casi lleno</PildoraEstado>
            ) : undefined
          }
        >
          <p className={CUERPO_SUAVE}>Cómo vas contra los topes de tu paquete.</p>

          <div className="mt-4 space-y-4">
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
            <p
              className={`mt-4 ${RADIO_TILE} px-3 py-2.5 text-[12.5px] font-bold ${ESTADO_AVISO.alerta}`}
            >
              Tu paquete llegó al tope: un cliente nuevo ya no se puede afiliar. Subí de
              paquete para seguir sumando gente.
            </p>
          )}
          {limite.cerca && !limite.lleno && (
            <p
              className={`mt-4 ${RADIO_TILE} px-3 py-2.5 text-[12.5px] font-bold ${ESTADO_AVISO.aviso}`}
            >
              Te queda{limite.disponibles === 1 ? "" : "n"} {limite.disponibles} lugar
              {limite.disponibles === 1 ? "" : "es"}. Conviene subir antes de toparte.
            </p>
          )}
        </Card>
      </GrillaTablero>

      {/* ── Los paquetes: un botón, no la grilla entera ──────────────
          Acá se repetían las cuatro tarjetas de paquete con todas sus
          viñetas, o sea la misma grilla que ya vive en /lealtad/planes.
          Duplicada tenía dos problemas: empujaba «Tu plan actual» y «Tu
          consumo» —que es a lo que se entra a esta pantalla— muy abajo,
          y obligaba a mantener el mismo catálogo en dos lugares.
          Ahora esta sección responde «qué tengo y cómo voy», y para
          comparar paquetes manda a la pantalla que existe para eso. */}
      <Card
        eyebrow="Comparar"
        titulo="¿Necesitás más?"
        nivel="h3"
        accion={
          <Link
            href={`/lealtad/planes?negocio=${ranchoId}`}
            className={`${BOTON_ACCION} presionable`}
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            Ver paquetes
            <span aria-hidden>→</span>
          </Link>
        }
      >
        <p className={`max-w-[62ch] ${CUERPO}`}>
          Compará los paquetes, sus topes y qué incluye cada uno. Se paga con tarjeta y queda
          activo al instante, o por SINPE si tu tarjeta no acepta compras internacionales.
        </p>
      </Card>
    </div>
  );
}
