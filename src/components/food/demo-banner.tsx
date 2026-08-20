/**
 * El aviso de "esto es una demo" de FOOD.BOOKEA (0193). Vive en su
 * propio componente porque aparece en DOS lugares que no comparten
 * layout: /food/demo (el showcase) y la ficha de un restaurante
 * demo (/food/restaurante/[slug], cuando ese negocio tiene
 * `es_demo = true`) — nunca en el directorio ni en fichas reales.
 *
 * A propósito NO es cerrable: el dueño pidió que fuera "permanente, no
 * un tooltip escondido" — alguien que entra a mitad de la sesión (por
 * ejemplo desde un link directo a la ficha) tiene que verlo igual.
 */
export default function FoodDemoBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center sm:px-6">
      <p className="mx-auto max-w-[1100px] text-[12.5px] font-bold leading-relaxed text-amber-900">
        Esto es una demo — los restaurantes y reservas de acá son de
        ejemplo, no reales.
      </p>
    </div>
  );
}
