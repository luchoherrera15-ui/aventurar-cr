import Link from "next/link";
import { GRUPO_LABEL, type GrupoId } from "@/lib/business/modulos";
import type { ItemMenu } from "@/lib/business/menu";
import { iconoModulo } from "./iconos-modulos";

/**
 * LAS HERRAMIENTAS DE ESTE TIPO DE NEGOCIO, en tarjetas.
 *
 * Es el bloque "Diseñado para psicología" de la maqueta: después de los
 * números del día y de lo que pasa hoy, el tablero muestra QUÉ TRAE tu
 * tipo de negocio. Sale exactamente de la misma lista que el menú
 * lateral (`itemsMenuNegocio`), así que no hay forma de que una tarjeta
 * ofrezca algo que el menú no tiene, ni al revés.
 *
 * Las que todavía no existen se pintan apagadas y NO son un enlace —
 * son un <div>, no un <Link>. Es la misma regla del menú: un módulo sin
 * pantalla no puede producir nada clickeable.
 *
 * Inicio y Configuración quedan afuera: ya están arriba en el menú y
 * como botones del encabezado; repetirlos acá sería relleno.
 *
 * Componente de SERVIDOR (sin "use client"): son enlaces y texto.
 */
/**
 * La grilla de las tarjetas, una sola vez: la usan las disponibles y las
 * de «Pronto», y si se separan se despareja el bloque.
 *
 * Los cortes están calculados contra el ancho REAL de la columna de
 * contenido (la pantalla menos el padding, menos los 236/260px del menú
 * y su gap), no contra el ancho de la ventana:
 *
 *   lg  1024px → ~716px de columna → 3 columnas darían 238px por
 *                tarjeta, y una tarjeta es ícono + título + resumen de
 *                dos líneas: a 238px el resumen se parte en cinco.
 *                Se queda en 2.
 *   xl  1280px → ~964px → 3 columnas de ~321px. Cómodo.
 *   2xl 1536px → ~1204px → 4 columnas de ~301px.
 *   Y con el panel a 1900px, esas mismas 4 quedan en ~382px.
 *
 * O sea: el ancho nuevo se gasta en MÁS COLUMNAS hasta 2xl y en
 * tarjetas más anchas de ahí para arriba, que es donde el resumen deja
 * de partirse.
 */
const GRILLA = "grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

export default function AccesosModulos({ items }: { items: ItemMenu[] }) {
  const modulos = items.filter((i) => i.modulo !== null);
  if (modulos.length === 0) return null;

  const disponibles = modulos.filter((i) => i.destino.clase !== "proximamente");
  const pendientes = modulos.filter((i) => i.destino.clase === "proximamente");

  return (
    <div className="flex flex-col gap-3">
      {disponibles.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {disponibles.map((item) => (
            <Tarjeta key={item.id} item={item} />
          ))}
        </div>
      )}

      {pendientes.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] text-aventurea-ink-soft">
            Lo que también trae tu tipo de negocio y estamos construyendo:
          </p>
          <div className={GRILLA}>
            {pendientes.map((item) => (
              <Tarjeta key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ item }: { item: ItemMenu }) {
  const destino = item.destino;
  const pronto = destino.clase === "proximamente";

  const cuerpo = (
    <>
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px] ${
          pronto ? "bg-aventurea-cream-2 text-aventurea-ink-soft" : ""
        }`}
        // El acento del tipo, heredado del contenedor del tablero. Sin
        // él (o si alguien reusa esto suelto) el bloque se pinta neutro
        // en vez de quedar sin fondo.
        style={
          pronto
            ? undefined
            : {
                backgroundColor: "var(--acento-suave, var(--grey))",
                color: "var(--acento, var(--navy))",
              }
        }
      >
        {iconoModulo(item.id)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={`truncate text-[13.5px] font-bold ${
              pronto ? "text-aventurea-ink-soft" : "text-aventurea-ink"
            }`}
          >
            {item.label}
          </span>
          <span className="shrink-0 rounded-md bg-aventurea-cream-2 px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none tracking-wide text-aventurea-ink-soft">
            {pronto ? "Pronto" : GRUPO_LABEL[item.grupo as GrupoId]}
          </span>
        </span>
        {/* Un módulo «Pronto» ya se distingue por el marco punteado, el
            chip y la tinta suave del título: el resumen no necesita
            encima una opacidad que lo bajaba a 2,78:1. Misma tinta para
            los dos estados, 7,11:1. */}
        <span className="mt-1 block text-[11.5px] leading-snug text-aventurea-ink-soft">
          {item.resumen}
        </span>
      </span>
    </>
  );

  const clases =
    "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors";

  if (destino.clase === "proximamente") {
    return (
      <div className={`${clases} border-dashed border-aventurea-line bg-transparent`}>
        {cuerpo}
      </div>
    );
  }

  // `seccion` navega dentro del mismo panel con `?tab=`; `ruta` sale a
  // otra pantalla. Las dos son `<Link>`: el href de una pestaña es una
  // URL de verdad (el panel lee `?tab=` en el servidor), así que se
  // puede compartir y volver con el botón atrás.
  const href = destino.clase === "ruta" ? destino.href : `?tab=${destino.tab}`;

  return (
    <Link
      href={href}
      className={`${clases} border-aventurea-line bg-aventurea-surface shadow-sm hover:border-aventurea-navy/40`}
    >
      {cuerpo}
    </Link>
  );
}
