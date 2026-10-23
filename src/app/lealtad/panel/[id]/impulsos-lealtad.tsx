import { CardVacia } from "@/components/panel/piezas";
import { BAJADA_PANTALLA, EYEBROW_NEUTRO, GAP_TABLERO, TITULO_PANTALLA } from "@/components/panel/sistema";
import { datosDeImpulsos } from "./impulsos-actions";
import ImpulsosPanel from "./impulsos-panel";

/**
 * IMPULSOS AUTOMÁTICOS — la sección del panel.
 *
 * Server component: trae los datos reales (impulsos, conteos de su cola, el contexto de la tarjeta) y se los
 * pasa a la pantalla. Mismo patrón que <MarketingLealtad>: el titular sale siempre, también cuando no hay
 * tarjeta o falta correr la migración.
 */
export default async function ImpulsosLealtad({ ranchoId, programaId }: { ranchoId: string; programaId: string | null }) {
  const titulo = (
    <div className="min-w-0">
      <p className={EYEBROW_NEUTRO}>Mensajes automáticos</p>
      <h2 className={`mt-1.5 ${TITULO_PANTALLA}`}>Impulsos</h2>
      <p className={`mt-1.5 ${BAJADA_PANTALLA}`}>
        Reglas que escriben solas en el momento justo: una bienvenida al inscribirse, un empujón cuando le falta un sello, un «te
        extrañamos» a quien dejó de venir.
      </p>
    </div>
  );

  if (!programaId) {
    return (
      <div className={`flex flex-col ${GAP_TABLERO}`}>
        {titulo}
        <CardVacia>Todavía no tenés una tarjeta activa: los impulsos se arman sobre una tarjeta.</CardVacia>
      </div>
    );
  }

  const datos = await datosDeImpulsos(ranchoId, programaId);

  if (!datos.disponible) {
    return (
      <div className={`flex flex-col ${GAP_TABLERO}`}>
        {titulo}
        <CardVacia>{datos.motivo}</CardVacia>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {titulo}
      <ImpulsosPanel ranchoId={ranchoId} contexto={datos.contexto} impulsos={datos.impulsos} plantillas={datos.plantillas} />
    </div>
  );
}
