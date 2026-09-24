import { tipoCelebracion } from "@/lib/celebrar/marca";
import { RUTA, rutaEditor } from "@/lib/celebrar/rutas";
import { ESTADO_TEXTO, type Celebracion } from "@/lib/celebrar/tipos";
import { fechaLargaCR } from "@/lib/fechas";
import { ICONO_TIPO } from "../iconos-tipos";
import { EnlaceCelebrar } from "../rutas-cliente";

/** La pastilla de estado de una celebración, con el color que le toca. */
export function PastillaEstado({ estado }: { estado: Celebracion["estado"] }) {
  const clase =
    estado === "publicada" || estado === "recuerdos"
      ? "c-pastilla c-pastilla-ok"
      : estado === "archivada"
        ? "c-pastilla bg-(--c-hielo) text-(--c-tinta-suave)"
        : "c-pastilla";
  return <span className={clase}>{ESTADO_TEXTO[estado]}</span>;
}

/**
 * La card de una celebración en la lista: tipo, nombre, fecha, estado y
 * los tres accesos del brief (Editar / Ver / Compartir). «Ver» y
 * «Compartir» se habilitan al publicar (Fase 3); mientras, abren la ficha.
 */
export default function TarjetaCelebracion({ c }: { c: Celebracion }) {
  const tipo = tipoCelebracion(c.tipo);
  const Icono = ICONO_TIPO[c.tipo];
  const ficha = `${RUTA.appCelebraciones}/${c.id}`;
  return (
    <li className="c-tarjeta elevar flex flex-col overflow-hidden">
      <EnlaceCelebrar a={ficha} className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="c-disco">
            <Icono className="h-5 w-5" />
          </span>
          <PastillaEstado estado={c.estado} />
        </div>
        <p className="c-montserrat mt-5 text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">
          {tipo?.nombre ?? c.tipo}
        </p>
        <h2 className="mt-1 text-xl leading-tight text-(--c-tinta)">{c.nombre}</h2>
        <p className="mt-2 text-[14px] text-(--c-tinta-suave)">
          {c.fecha ? fechaLargaCR(c.fecha) : "Sin fecha todavía"}
          {c.lugar_nombre ? ` · ${c.lugar_nombre}` : ""}
        </p>
      </EnlaceCelebrar>
      <div className="grid grid-cols-3 divide-x divide-(--c-linea) border-t border-(--c-linea)">
        <EnlaceCelebrar a={ficha} className="c-montserrat flex min-h-11 items-center justify-center text-[13px] font-semibold text-(--c-marino) hover:bg-(--c-hielo)">
          Editar
        </EnlaceCelebrar>
        <EnlaceCelebrar a={rutaEditor(c.id)} className="c-montserrat flex min-h-11 items-center justify-center text-[13px] font-semibold text-(--c-marino) hover:bg-(--c-hielo)">
          Diseño
        </EnlaceCelebrar>
        <EnlaceCelebrar a={`${ficha}#compartir`} className="c-montserrat flex min-h-11 items-center justify-center text-[13px] font-semibold text-(--c-marino) hover:bg-(--c-hielo)">
          Compartir
        </EnlaceCelebrar>
      </div>
    </li>
  );
}
