import InsigniaVerificado from "@/components/insignia-verificado";

/**
 * ════════════════════════════════════════════════════════════════════
 *  QUÉ QUIEREN DECIR LOS SELLOS DE LAS TARJETAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): «poné ahí arriba de Salud y Belleza
 * una leyenda de Verificado y de Info Pública».
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────
 *
 * Un sello sin explicación se interpreta solo, y se interpreta de más.
 * «Verificado» a secas, sobre un negocio que nosotros publicamos con su
 * información pública, se lee como «Bookea responde por esto» — y lo que
 * en realidad podemos afirmar es apenas que los datos son ciertos.
 *
 * La leyenda es lo que hace que la distinción exista para quien mira.
 * Sin ella, «Info pública» es un sello raro que nadie sabe si es bueno o
 * malo, y la diferencia que las dos insignias marcan se pierde.
 *
 * ── VA ANTES DEL PRIMER LISTADO, NO EN EL PIE ───────────────────────
 *
 * Tiene que leerse ANTES de la primera tarjeta que lo lleva. En el pie
 * llegaría cuando la persona ya decidió, que es tarde para una
 * aclaración sobre en qué confiar.
 *
 * ── SE EXPLICAN LOS DOS, AUNQUE SOLO HAYA UNO EN PANTALLA ───────────
 *
 * Primero escondí cada fila por separado —solo si ese sello estaba a la
 * vista—, con el argumento de no enseñarle a nadie a buscar algo que no
 * está. El dueño pidió las dos, y tiene razón por un motivo que se me
 * había escapado: la leyenda no rotula lo que hay hoy en pantalla,
 * explica UN SISTEMA de dos estados.
 *
 * Ver solo «Info pública» deja la pregunta abierta —¿comparado con
 * qué?—. Es el contraste con «Verificado» lo que le da sentido: sin él,
 * el sello parece una advertencia suelta en vez de un punto de una
 * escala.
 *
 * Lo único que sigue escondiendo la leyenda es que no haya NINGÚN
 * negocio con sello: ahí no hay sistema que explicar.
 */
export default function LeyendaSellos({
  hayVerificados,
  hayInfoPublica,
}: {
  hayVerificados: boolean;
  hayInfoPublica: boolean;
}) {
  if (!hayVerificados && !hayInfoPublica) return null;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-aventurea-line bg-aventurea-surface px-4 py-3">
        {(hayVerificados || hayInfoPublica) && (
          <li className="flex items-center gap-2">
            <InsigniaVerificado estado="verificado" />
            <span className="text-[12.5px] text-aventurea-ink-soft">
              Su dueño lo administra en Bookea.
            </span>
          </li>
        )}
        {(hayVerificados || hayInfoPublica) && (
          <li className="flex items-center gap-2">
            <InsigniaVerificado estado="info-publica" />
            <span className="text-[12.5px] text-aventurea-ink-soft">
              {/* Se dice lo que ES, sin rodeos: los datos son reales y
                  el negocio todavía no está adentro. Un eufemismo acá
                  («aún no activo») dejaría a la persona igual de a
                  ciegas que sin leyenda. */}
              Datos reales tomados de fuentes públicas. El negocio todavía no lo reclamó.
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
