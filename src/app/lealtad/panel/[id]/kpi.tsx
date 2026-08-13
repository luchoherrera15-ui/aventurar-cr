/**
 * EL DATO GRANDE de las pantallas de lealtad.
 *
 * Había dos copias casi iguales —`Dato` en lealtad-estado.tsx y `Kpi`
 * en metricas.tsx— que solo se diferenciaban en el tamaño de la cifra.
 * Cuando Inicio pasó a mostrar números iba a haber una tercera, y tres
 * versiones del mismo cuadrito es cómo un panel deja de verse como un
 * panel.
 *
 * Los colores salen de las clases del tema claro A PROPÓSITO: el bloque
 * `.lealtad-oscuro` de globals.css las re-mapea a sus equivalentes
 * translúcidos sobre navy. Una clase que ese bloque no conozca deja el
 * texto invisible sobre el fondo oscuro — ya pasó.
 */
export default function Kpi({
  titulo,
  valor,
  detalle,
  tono = "normal",
}: {
  titulo: string;
  /** Ya escrito: quien llama decide el formato (miles, ₡, %). */
  valor: string;
  detalle?: string | null;
  /** `aviso` = pide atención; `alerta` = algo está frenado. */
  tono?: "normal" | "aviso" | "alerta";
}) {
  const fondo =
    tono === "alerta" ? "bg-red-50" : tono === "aviso" ? "bg-aventurea-sky-light" : "bg-white";

  return (
    <div className={`rounded-2xl border border-aventurea-line px-4 py-3.5 ${fondo}`}>
      <p className="text-[11px] font-bold uppercase leading-snug tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p className="mt-0.5 text-[22px] font-extrabold tabular-nums text-aventurea-ink">{valor}</p>
      {detalle && (
        <p className="text-[11.5px] leading-snug text-aventurea-ink-soft">{detalle}</p>
      )}
    </div>
  );
}
