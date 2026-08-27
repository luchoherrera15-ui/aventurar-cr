import InsigniaVerificado from "@/components/insignia-verificado";

/**
 * ════════════════════════════════════════════════════════════════════
 *  QUÉ QUIEREN DECIR LOS SELLOS DE LAS TARJETAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): «una leyenda de Verificado y de Info
 * Pública». Y después, sobre dónde ponerla: «poné esa info ahí donde
 * están las X, una línea en cada X» — dos renglones, a la izquierda, a
 * la altura de la fila de Invitaciones y Lealtad.
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────
 *
 * Un sello sin explicación se interpreta solo, y se interpreta de más.
 * «Verificado» a secas, sobre una ficha que armamos nosotros con datos
 * públicos, se lee como «Bookea responde por esto» — y lo que en
 * realidad podemos afirmar es apenas que los datos son ciertos.
 *
 * ── SE EXPLICAN LOS DOS, AUNQUE SOLO HAYA UNO EN PANTALLA ───────────
 *
 * Primero escondí cada renglón si ese sello no estaba a la vista, con
 * el argumento de no enseñarle a nadie a buscar algo que no está. El
 * dueño pidió los dos, y tenía razón por un motivo que se me había
 * escapado: la leyenda no rotula lo que hay HOY en pantalla, explica UN
 * SISTEMA de dos estados. Ver solo «Info pública» deja la pregunta
 * abierta —¿comparado con qué?—; es el contraste el que le da sentido.
 *
 * Por eso ya no recibe props: no depende de qué haya cargado.
 *
 * ── DEJÓ DE SER UNA CAJA ANCHA ──────────────────────────────────────
 *
 * Era un recuadro a todo el ancho entre los íconos y el primer carril.
 * Ahí competía con el catálogo por la atención siendo apenas una
 * aclaración, y encima empujaba las tarjetas hacia abajo — en una
 * portada cuyo problema conocido es justamente cuánto hay que
 * scrollear para llegar a los negocios (ver el `pb` del héroe).
 *
 * Ahora son dos renglones en el aire que ya sobraba a la izquierda del
 * héroe: no roban alto, no piden turno, y quien mire una tarjeta y se
 * pregunte qué dice ese sello los tiene a la vista.
 */
export default function LeyendaSellos() {
  return (
    <ul
      /* `text-left` explícito: el héroe entero es `text-center`, y una
         leyenda de dos renglones centrada se lee como un eslogan en vez
         de como una aclaración al pie. */
      className="mt-7 flex flex-col items-start gap-1.5 text-left"
    >
      <li className="flex items-center gap-2">
        <InsigniaVerificado estado="verificado" />
        <span className="text-[12px] text-aventurea-ink-soft">
          Negocio real, confirmado por Bookea.
        </span>
      </li>
      <li className="flex items-center gap-2">
        <InsigniaVerificado estado="info-publica" />
        <span className="text-[12px] text-aventurea-ink-soft">
          {/* Se dice lo que ES, sin rodeos. Un eufemismo acá («aún no
              activo») dejaría a la persona igual de a ciegas que sin
              leyenda. */}
          Ficha armada con datos públicos. Nadie del negocio la confirmó.
        </span>
      </li>
    </ul>
  );
}
