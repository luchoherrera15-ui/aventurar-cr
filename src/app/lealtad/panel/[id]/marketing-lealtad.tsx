import { listarPasesDelPrograma } from "./marketing-actions";
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
  const titulo = (
    <div>
      <h2 className="text-[21px] font-extrabold leading-tight text-white sm:text-[23px]">
        Marketing
      </h2>
      <p className="mt-1 text-[13.5px] text-white/55">
        Mandale un aviso a todos tus clientes, o probá el de uno solo y mirá qué contestó
        Apple o Google — sin esperar a que alguien escanee.
      </p>
    </div>
  );

  if (!programaId) {
    return (
      <div className="space-y-4">
        {titulo}
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-6 text-center text-[13.5px] text-white/55">
          Todavía no tenés una tarjeta activa — no hay ningún pase al que avisarle.
        </p>
      </div>
    );
  }

  const resultado = await listarPasesDelPrograma(ranchoId, programaId);

  return (
    <div className="space-y-4">
      {titulo}
      <MarketingMensaje ranchoId={ranchoId} programaId={programaId} />
      {!resultado.ok ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-[13px] font-bold text-red-200">
          {resultado.motivo}
        </p>
      ) : resultado.datos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-6 text-center text-[13.5px] text-white/55">
          Todavía nadie tiene el pase instalado — no hay a quién avisarle.
        </p>
      ) : (
        <>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45">
            Probar un pase específico
          </p>
          <TablaMarketing ranchoId={ranchoId} filas={resultado.datos} />
        </>
      )}
    </div>
  );
}
