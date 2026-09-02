import Link from "next/link";
import { fmtColones } from "@/lib/finanzas";
import { agruparClientes, type ClienteCRM, type ReservaCliente } from "@/lib/crm-citas";
import {
  conteoPorSegmento,
  ritmoDeVisitaDias,
  segmentarCartera,
} from "@/lib/crm-segmentos";
import { claveAUrl } from "@/lib/crm-clave-url";
import { Card } from "@/components/panel/piezas";
import { DETALLE, ENLACE_CARD, RADIO_PILDORA } from "@/components/panel/sistema";

/**
 * «CLIENTES QUE NECESITAN ATENCIÓN» — el bloque CRM del tablero.
 *
 * Parte de la transformación CRM (1 sep 2026). El tablero decía cómo
 * VA el negocio (ingresos, citas de hoy, ocupación); este bloque dice
 * qué HACER: los clientes en riesgo con nombre y apellido, el porqué
 * («faltó a sus últimas 2», «venía cada 15 días y lleva 40 sin
 * venir»), y el link directo a su ficha para escribirles.
 *
 * ------------------------------------------------------------------
 * NO PIDE NADA A LA BASE
 * ------------------------------------------------------------------
 * Recibe las reservas que la página del panel YA cargó para finanzas y
 * agenda, y deriva encima (`agruparClientes` + `segmentarCartera`).
 * El costo de este bloque es cero consultas — la regla de oro del
 * tablero: información nueva sí, viajes nuevos no.
 *
 * ------------------------------------------------------------------
 * SI NO HAY NADA QUE ATENDER, NO EXISTE
 * ------------------------------------------------------------------
 * Devuelve null en vez de una tarjeta que diga «todo bien»: el tablero
 * ya tiene suficientes tarjetas, y una que solo confirma que no pasa
 * nada es ruido que entrena a ignorar el bloque justo la semana que sí
 * pasa algo.
 */

/** Cuántos clientes en riesgo se muestran con nombre. */
const TOPE_VISIBLES = 3;

function porQueEstaEnRiesgo(c: ClienteCRM): string {
  if (c.fallosSeguidos >= 2) {
    return `faltó a sus últimas ${c.fallosSeguidos} citas`;
  }
  const ritmo = ritmoDeVisitaDias(c);
  if (ritmo !== null && c.diasSinVenir !== null) {
    return `venía cada ${ritmo} días y lleva ${c.diasSinVenir} sin venir`;
  }
  return `lleva ${c.diasSinVenir ?? "?"} días sin venir`;
}

export default function AtencionClientes({
  negocioId,
  reservas,
  hoy,
}: {
  negocioId: string;
  /** Las MISMAS filas que la página ya cargó — no se vuelve a pedir. */
  reservas: ReservaCliente[];
  hoy: string;
}) {
  const cartera = agruparClientes(reservas, hoy);
  if (cartera.length === 0) return null;

  const segmentados = segmentarCartera(cartera, hoy);
  const conteo = conteoPorSegmento(segmentados);

  const enRiesgo = segmentados
    .filter((s) => s.segmento === "en_riesgo")
    .slice(0, TOPE_VISIBLES);

  // Nada urgente y nada que resumir: el bloque no existe (ver cabecera).
  if (enRiesgo.length === 0 && conteo.inactivo === 0 && conteo.nuevo === 0) return null;

  return (
    <Card
      eyebrow="Clientes"
      titulo="Quiénes necesitan atención"
      accion={
        <Link href={`/mi-negocio/${negocioId}/clientes`} className={ENLACE_CARD}>
          Ver toda la cartera →
        </Link>
      }
    >
      {enRiesgo.length > 0 ? (
        <ul className="divide-y divide-aventurea-line/70">
          {enRiesgo.map(({ cliente }) => (
            <li key={cliente.clave} className="flex items-center gap-3 py-2.5">
              <span
                className={`${RADIO_PILDORA} shrink-0 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700`}
              >
                En riesgo
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={`/mi-negocio/${negocioId}/clientes/${claveAUrl(cliente.clave)}`}
                  className="font-bold text-aventurea-navy hover:underline"
                >
                  {cliente.nombre ?? cliente.correo ?? cliente.whatsapp ?? "Sin nombre"}
                </Link>
                <span className="ml-2 text-[12px] text-aventurea-ink-soft">
                  {porQueEstaEnRiesgo(cliente)}
                </span>
              </span>
              {cliente.gastoTotal > 0 && (
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-aventurea-ink-soft">
                  {fmtColones(cliente.gastoTotal)}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={DETALLE}>Nadie en riesgo esta semana.</p>
      )}

      {/* El pulso del resto de la cartera, en una línea. */}
      <p className={`mt-3 ${DETALLE}`}>
        {conteo.nuevo > 0 && (
          <>
            <b className="text-aventurea-ink">{conteo.nuevo}</b> nuevo
            {conteo.nuevo === 1 ? "" : "s"} este mes
          </>
        )}
        {conteo.nuevo > 0 && conteo.inactivo > 0 && " · "}
        {conteo.inactivo > 0 && (
          <>
            <b className="text-aventurea-ink">{conteo.inactivo}</b> inactivo
            {conteo.inactivo === 1 ? "" : "s"} que recuperar
          </>
        )}
      </p>
    </Card>
  );
}
