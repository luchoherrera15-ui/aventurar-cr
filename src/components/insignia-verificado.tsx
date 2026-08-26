import { IconCheck, IconGlobe } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL SELLO DE UNA TARJETA: «VERIFICADO» O «INFO PÚBLICA»
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): la insignia verde de verificado, y
 * además una para las fichas que armamos nosotros sin que el negocio
 * participe.
 *
 * ── SON DOS AFIRMACIONES DISTINTAS, NO DOS NIVELES ──────────────────
 *
 *   Verificado    → hay una persona real detrás de esta ficha: el
 *                   dueño la publicó, o nos pasó sus fotos y precios y
 *                   la cargamos por él.
 *   Info pública  → la armamos desde un directorio público y NADIE de
 *                   ese negocio participó. Los datos pueden ser
 *                   ciertos; lo que no hay es alguien que responda.
 *
 * ⚠️ NO PREGUNTA DE QUIÉN ES LA CUENTA, Y ESE FUE MI ERROR.
 *
 * La primera versión ató el sello a si el dueño ya administraba el
 * negocio en Bookea. Con eso, los tres negocios publicados —los tres
 * reales, con gente real atrás— cayeron en «Info pública», solo porque
 * el traspaso de cuenta sigue pendiente. El dueño lo corrigió: «todos
 * los que los cree una persona y no sean sembrados por vos son
 * VERIFICADOS».
 *
 * Tenía razón: el sello habla de si el negocio EXISTE y alguien
 * responde por él, no de un trámite nuestro. Ver la migración 0217.
 *
 * La distinción sigue siendo de HONESTIDAD y no de jerarquía: sobre una
 * ficha sacada de un directorio no podemos afirmar que alguien esté
 * mirando las reservas, y quien lea «Verificado» ahí va a reservar
 * creyéndolo.
 *
 * ── POR QUÉ VIVE ACÁ Y NO EN CADA TARJETA ───────────────────────────
 *
 * Seis tarjetas distintas lo muestran. Copiado seis veces, la primera
 * vez que alguien ajuste el verde va a ajustar cinco, y un sello que se
 * ve distinto según la pantalla deja de leerse como un sello.
 *
 * ── LOS COLORES, MEDIDOS ────────────────────────────────────────────
 *
 * La primera versión de este comentario tenía el número mal, que es
 * exactamente el riesgo de elegir un verde a ojo:
 *
 *   emerald-500 sobre blanco ...... 2,54:1  ✗  (el que uno agarra solo)
 *   emerald-600 sobre blanco ...... 3,77:1  ✗
 *   emerald-700 sobre blanco ...... 5,48:1  ✓
 *
 * AA pide 4,5:1 para texto chico, así que el texto va en `emerald-700`
 * y NO en el verde intuitivo. En un elemento cuyo único trabajo es que
 * se le crea, un texto que cuesta leer trabaja en contra.
 *
 * «Info pública» va en pizarra y no en verde a propósito: el verde es
 * la señal de «esto está confirmado del todo», y usarlo para los dos
 * estados borraría justo la diferencia que el sello existe para marcar.
 *
 * ── EL ÍCONO ES DECORATIVO, LA PALABRA ES EL DATO ───────────────────
 *
 * `aria-hidden` en el ícono: quien escucha ya recibe la palabra del
 * texto. Y el sello NO se apoya solo en el color — dice qué es, así que
 * también funciona para quien no distingue el verde del gris.
 */

export type EstadoSello = "verificado" | "info-publica";

/**
 * Qué sello le toca a un negocio, en un solo lugar.
 *
 * Vive acá y no repartido por las tarjetas porque la regla tiene una
 * trampa: `info_publica` por sí sola NO da un sello. Un negocio sin
 * verificar no muestra NADA, venga su ficha de donde venga — si nadie
 * comprobó los datos, no hay nada que afirmar sobre ellos, y de dónde
 * salieron es una respuesta a una pregunta que nadie hizo.
 */
export function selloDe(negocio: {
  verificado?: boolean | null;
  info_publica?: boolean | null;
}): EstadoSello | null {
  if (!negocio.verificado) return null;
  // `info_publica` tiene default `false` en la base, así que un
  // `undefined` —una consulta que no pidió la columna— cae en
  // «Verificado». Es el estado normal; la excepción es la que se
  // declara.
  return negocio.info_publica ? "info-publica" : "verificado";
}

const TEXTO: Record<EstadoSello, string> = {
  verificado: "Verificado",
  "info-publica": "Info pública",
};

export default function InsigniaVerificado({
  estado = "verificado",
  /** `sobreFoto` = va encima de la imagen y necesita fondo propio para
   *  despegarse de lo que tenga debajo. */
  sobreFoto = false,
}: {
  estado?: EstadoSello;
  sobreFoto?: boolean;
}) {
  const esVerificado = estado === "verificado";

  return (
    <span
      className={
        "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide " +
        (esVerificado ? "text-emerald-700 " : "text-slate-600 ") +
        (sobreFoto
          ? "bg-white/95 shadow-sm backdrop-blur"
          : esVerificado
            ? "bg-emerald-50 ring-1 ring-inset ring-emerald-600/20"
            : "bg-slate-50 ring-1 ring-inset ring-slate-500/20")
      }
    >
      {/* El punto: es «la insignia al lado» del pedido. Va antes de la
          palabra porque es lo que se reconoce de reojo, sin leer. */}
      <span
        aria-hidden
        className={
          "flex h-3.5 w-3.5 items-center justify-center rounded-full " +
          (esVerificado ? "bg-emerald-600" : "bg-slate-500")
        }
      >
        {esVerificado ? (
          <IconCheck className="h-2.5 w-2.5 text-white" />
        ) : (
          // Un globo y no un ✓: el ✓ dice «confirmado» y esto no lo
          // está. El globo dice de dónde salieron los datos.
          <IconGlobe className="h-2.5 w-2.5 text-white" />
        )}
      </span>
      {TEXTO[estado]}
    </span>
  );
}
