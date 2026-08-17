import { listarPasesDelPrograma } from "./marketing-actions";
import { CardVacia } from "@/components/panel/piezas";
import {
  BAJADA_PANTALLA,
  ESTADO_AVISO,
  EYEBROW_NEUTRO,
  GAP_TABLERO,
  RADIO_TILE,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
import MarketingMensaje from "./marketing-mensaje";
import TablaMarketing from "./marketing-tabla";

/**
 * MARKETING — probar, contra un pase real, que el aviso de cambio
 * llega de verdad.
 *
 * Nace de un reporte concreto: la plataforma decía 4 sellos, el
 * teléfono seguía en 2. El ledger, el caché y el código de aviso ya se
 * revisaron a mano y son correctos — lo que faltaba era una forma de
 * disparar el MISMO aviso real desde acá y ver la respuesta de
 * Apple/Google en el momento, sin escribir un script cada vez.
 *
 * Self-fetching, mismo patrón que <LealtadEstado>: el server component
 * trae los datos, el client component (marketing-tabla.tsx) pone el
 * botón y pinta la respuesta.
 */
export default async function MarketingLealtad({
  ranchoId,
  programaId,
}: {
  ranchoId: string;
  programaId: string | null;
}) {
  /* El mismo titular que el resto de las secciones (kicker + h2 +
     bajada). Esta sección se pinta sin pasar por el helper `Seccion` de
     page.tsx porque necesita partirse en dos caminos —con tarjeta y
     sin ella— y el titular tiene que salir en los dos. */
  const titulo = (
    <div className="min-w-0">
      <p className={EYEBROW_NEUTRO}>Avisos a tus clientes</p>
      <h2 className={`mt-1.5 ${TITULO_PANTALLA}`}>Marketing</h2>
      <p className={`mt-1.5 ${BAJADA_PANTALLA}`}>
        Mandale un aviso a todos tus clientes, o probá el de uno solo y mirá qué contestó
        Apple o Google — sin esperar a que alguien escanee.
      </p>
    </div>
  );

  if (!programaId) {
    return (
      <div className={`flex flex-col ${GAP_TABLERO}`}>
        {titulo}
        <CardVacia>
          Todavía no tenés una tarjeta activa — no hay ningún pase al que avisarle.
        </CardVacia>
      </div>
    );
  }

  const resultado = await listarPasesDelPrograma(ranchoId, programaId);

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {titulo}
      <MarketingMensaje ranchoId={ranchoId} programaId={programaId} />
      {!resultado.ok ? (
        /* El error usa el estado `alerta` del sistema en vez de un rojo
           propio: `text-red-200` sobre `bg-red-500/10` daba 5,0:1 pero
           era un sexto rojo del producto, y ninguna otra pantalla lo
           conocía. */
        <p className={`${RADIO_TILE} px-4 py-3 text-[13px] font-bold ${ESTADO_AVISO.alerta}`}>
          {resultado.motivo}
        </p>
      ) : resultado.datos.length === 0 ? (
        <CardVacia>Todavía nadie tiene el pase instalado — no hay a quién avisarle.</CardVacia>
      ) : (
        <>
          <p className={EYEBROW_NEUTRO}>Probar un pase específico</p>
          <TablaMarketing ranchoId={ranchoId} filas={resultado.datos} />
        </>
      )}
    </div>
  );
}
