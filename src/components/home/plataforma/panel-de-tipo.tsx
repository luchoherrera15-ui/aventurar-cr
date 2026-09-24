import {
  GRUPO_LABEL,
  resolverModulos,
  type GrupoId,
  type TipoNegocioId,
} from "@/lib/business/modulos";
import { itemsMenuNegocio, type ItemMenu } from "@/lib/business/menu";
import { identidadDe } from "@/lib/business/identidad";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PANEL DE UN TIPO DE NEGOCIO — producto real, cero invento
 * ════════════════════════════════════════════════════════════════════
 *
 * Esta pieza dibuja el menú lateral EXACTO que ve el dueño de una
 * barbería, un gimnasio o un consultorio cuando entra a su panel.
 *
 * No es una maqueta ni una captura: los ítems salen de las mismas
 * funciones que arman el panel de verdad —`resolverModulos()` e
 * `itemsMenuNegocio()`— y las dos son PURAS. Ni una consulta a la
 * base, ni un dato inventado, ni una lista escrita a mano que mañana
 * se desincronice del producto.
 *
 * Es la demostración más honesta que este home puede dar de «el panel
 * se arma solo según tu tipo de negocio», y sale prácticamente gratis.
 *
 * ── LO QUE TODAVÍA NO EXISTE SE MUESTRA APAGADO ─────────────────────
 *
 * `itemsMenuNegocio` devuelve también los módulos que el tipo DECLARA
 * y que aún no tienen pantalla (un consultorio trabaja con
 * expedientes, aunque la pantalla de expedientes no esté construida).
 * Vienen marcados con destino «próximamente» y acá se pintan en gris
 * con su rótulo: es lo que hace que un consultorio se vea como un
 * consultorio, y prometer que ya se puede abrir sería justo la clase
 * de mentira que este home no cuenta.
 */

/** El negocio de la muestra. Un nombre neutro: la estrella es el menú. */
const NOMBRE_MUESTRA = "Mi negocio";

/** Es un módulo declarado que todavía no tiene pantalla. */
function esProximamente(item: ItemMenu): boolean {
  return item.destino.clase === "proximamente";
}

export default function PanelDeTipo({
  tipo,
  compacto = false,
  destacado = false,
}: {
  tipo: TipoNegocioId;
  /** En el héroe entra una versión corta: menos ítems, menos aire. */
  compacto?: boolean;
  /**
   * Borde azul, como la tarjeta recomendada de una tabla de precios.
   * Acá no marca «el mejor rubro» —no existe tal cosa— sino cuál de
   * los dos paneles mirar primero cuando están lado a lado.
   */
  destacado?: boolean;
}) {
  const identidad = identidadDe(tipo);
  const modulos = resolverModulos({ tipo });

  const items = itemsMenuNegocio({
    // Un id de muestra: nada de lo que se pinta acá navega a ningún
    // lado (ver `inerte` más abajo), pero la firma lo pide.
    ranchoId: "demo",
    tipo,
    modulos,
    vocabulario: identidad.vocabulario,
    // Un lugar de eventos alquila la fecha entera y no tiene agenda por
    // horas; todo lo demás de este home sí. Se pasa el valor real del
    // tipo para que el menú no prometa una pantalla que no le toca.
    agendaPorHoras: tipo !== "eventos_lugar" && tipo !== "hospedaje",
    esVerticalCitas: true,
    etiquetaCatalogo: "Servicios",
  });

  const visibles = compacto ? items.slice(0, 7) : items;

  // Los ítems ya vienen ordenados por grupo desde `itemsMenuNegocio`;
  // acá solo se parten para poder titular cada bloque como el panel.
  const porGrupo = new Map<GrupoId, ItemMenu[]>();
  for (const item of visibles) {
    const lista = porGrupo.get(item.grupo) ?? [];
    lista.push(item);
    porGrupo.set(item.grupo, lista);
  }

  return (
    <div
      // `inerte`: esto es una demostración dentro de una página
      // pública. Nada navega y nada recibe foco — un menú de mentira
      // que se pudiera tabular sería una trampa para quien usa teclado.
      aria-hidden
      className={`w-full select-none overflow-hidden rounded-[14px] bg-white text-left ${
        destacado
          ? "border-2 border-[color:var(--acento)] shadow-[0_18px_44px_-24px_rgba(0,130,230,0.5)]"
          : "border border-[color:var(--linea)]"
      }`}
    >
      {/* La cabecera lleva EL ACENTO REAL DEL RUBRO.
          `identidadDe()` le asigna a cada tipo su color —uno para
          barbería, otro para gimnasio— y es el mismo que el dueño ve
          en su panel. Acá se usa tal cual: es un dato del producto, no
          una decoración, y es justo el color que tiene que aparecer en
          un mockup. */}
      <div className="flex items-center gap-2.5 border-b border-[color:var(--linea)] px-3.5 py-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[12px] font-extrabold"
          style={{
            backgroundColor: identidad.acento.solido,
            color: identidad.acento.sobreSolido,
          }}
        >
          {/* La inicial del NEGOCIO, no la del vocabulario: antes salía
              una «C» de «Cliente» y se leía como si el negocio se
              llamara así. */}
          {NOMBRE_MUESTRA.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-extrabold text-[color:var(--tinta)]">
            {NOMBRE_MUESTRA}
          </span>
          <span className="block truncate text-[10.5px] text-[color:var(--tinta-suave)]">
            {identidad.descripcion}
          </span>
        </span>
      </div>

      <div className="px-2 py-2">
        {[...porGrupo.entries()].map(([grupo, lista]) => (
          <div key={grupo} className="mb-1.5 last:mb-0">
            <p className="px-2 pb-1 pt-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--tinta-suave)]">
              {GRUPO_LABEL[grupo]}
            </p>
            <ul className="space-y-px">
              {lista.map((item) => {
                const proximo = esProximamente(item);
                return (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-[12px] font-semibold ${
                      proximo
                        ? "text-[color:var(--tinta-suave)]"
                        : "text-[color:var(--tinta)]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: proximo
                            ? "var(--linea)"
                            : identidad.acento.solido,
                        }}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {proximo ? (
                      <span className="shrink-0 rounded-full bg-[color:var(--superficie)] px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wide text-[color:var(--tinta-suave)]">
                        Pronto
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
