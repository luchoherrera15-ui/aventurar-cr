import RegistrarVisita from "@/components/registrar-visita";
import {
  fraseVisitas,
  leerResumenVisitas,
  textoVisitas,
  type FraseVisitas,
} from "@/lib/visitas";

/**
 * La tarjetita de prueba social arriba de la página de un negocio:
 * "12 personas visitaron este sitio hoy". Chica y discreta a propósito
 * — es un apoyo, no compite con el precio ni con el botón de reservar.
 *
 * El número es real: sale de `visitas_pagina_resumen` (migración 0107).
 * Si la base todavía no tiene la migración, o si no hay visitas
 * suficientes, la tarjeta no se muestra y ya. Nunca se infla ni se
 * inventa nada.
 */
export function TarjetaVisitas({ frase }: { frase: FraseVisitas }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-1.5 text-[12px] font-semibold text-aventurea-ink-soft">
      {/* El puntito "en vivo": late suave y se queda quieto si la
          persona pidió movimiento reducido. */}
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aventurea-green opacity-50 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-aventurea-green" />
      </span>
      <span>
        <strong className="font-extrabold text-aventurea-ink">
          {frase.numero.toLocaleString("es-CR")} personas
        </strong>{" "}
        {textoVisitas(frase)}
      </span>
    </p>
  );
}

/**
 * Lo que se monta en la página de cada negocio: anota la visita (desde
 * el navegador, después de cargar) y muestra la tarjeta si los números
 * dan. Las dos mitades fallan en silencio.
 */
export default async function VisitasPagina({
  ranchoId,
  className,
}: {
  ranchoId: string;
  /**
   * Separación de lo que viene abajo. Va acá y no en la página porque
   * sin visitas suficientes no se pinta NADA: un margen puesto por
   * fuera dejaría un hueco cuando la tarjeta no aparece.
   */
  className?: string;
}) {
  const frase = fraseVisitas(await leerResumenVisitas(ranchoId));
  return (
    <>
      <RegistrarVisita ranchoId={ranchoId} />
      {frase && (
        <div className={className}>
          <TarjetaVisitas frase={frase} />
        </div>
      )}
    </>
  );
}
