"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPin, IconSearch } from "@/components/icons";
import {
  TEXTOS,
  urlBusqueda,
  type PestanaBuscador,
} from "@/components/buscador-home-datos";
import LogoGooglePlay from "@/components/logo-google-play";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL BUSCADOR DEL HÉROE — una cápsula de cuatro tramos
 * ════════════════════════════════════════════════════════════════════
 *
 *   [ ¿Qué buscás? │ ¿Dónde? │ ¿Cuándo? ] ( Buscar )
 *
 * ── NO ARMA URLs: LLAMA AL EMBUDO QUE YA EXISTE ─────────────────────
 *
 * `urlBusqueda()` de `buscador-home-datos.ts` ya es el único lugar del
 * repo que convierte campos en una URL de directorio, y ya trae las tres
 * reglas que importan: lo vacío no viaja, lo inválido se descarta acá y
 * no allá, y Costa Rica no se emite porque es el caso por defecto de
 * todo el sitio. Escribir un segundo armador habría sido tener dos
 * embudos que se despegan a la primera.
 *
 * ── LAS DOS PESTAÑAS SON LAS DOS VERTICALES QUE SE PUEDEN BUSCAR ────
 *
 * `/hospedajes` NO lee `?q=` ni `?provincia=` —su firma es literalmente
 * `{ categoria?: … }`— así que ofrecerlo como destino sería mandar a
 * alguien a una lista que ignora lo que escribió. A Hospedaje se llega
 * por el mega menú, que sí filtra por categoría. Ese criterio es el
 * mismo que ya documentaba el buscador anterior.
 *
 * ── EL BOTÓN ES NAVY, Y NO ES UNA ELECCIÓN ESTÉTICA ─────────────────
 *
 * Blanco sobre el naranja de marca (#ee7420) da 2,94:1: reprueba el
 * 4,5:1 de texto normal Y el 3:1 de texto grande. Navy con letra blanca
 * da 13,88:1. Si alguna vez se quiere naranja de verdad, el único que
 * pasa es `--orange-fuerte` (#a83f00), con 6,22:1. Lo que no se puede
 * es #ee7420 con letra blanca.
 *
 * ── PREPARADO PARA LA BÚSQUEDA INTELIGENTE ──────────────────────────
 *
 * El día que Bookea interprete «Villa para 8 personas en Guanacaste», lo
 * que cambia es `urlBusqueda` —o una función que la envuelva— y ningún
 * componente de esta pantalla. Por eso acá no hay una sola regla de
 * ruteo: se juntan los campos y se delega.
 */

const TRAMO = "flex min-w-0 flex-1 flex-col justify-center px-5 py-2.5 text-left";
const ROTULO = "text-[11.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft";
const CONTROL =
  "w-full truncate bg-transparent text-[14.5px] font-semibold text-aventurea-ink outline-none placeholder:font-normal placeholder:text-aventurea-ink-soft";

/**
 * Las palabras que mandan a EVENTOS. Todo lo demás cae en Citas.
 *
 * ── POR QUÉ UNA LISTA Y NO UN SELECTOR ──────────────────────────────
 *
 * Antes había dos pestañas y la persona elegía la vertical a mano. El
 * dueño las sacó: obligan a decidir algo nuestro («¿esto es Citas o
 * Eventos?») antes de saber qué hay adentro.
 *
 * Sin pestañas hay que adivinar, y adivinar mal tiene un costo
 * asimétrico: mandar «rancho» a Citas devuelve CERO resultados, mientras
 * que mandar algo raro a Citas devuelve la lista completa de Citas —
 * incompleta, pero no vacía. Por eso el default es Citas y esta lista
 * solo contiene lo que es inequívocamente de un evento.
 *
 * ── ESTO ES LA v1 DETERMINISTA, A PROPÓSITO ─────────────────────────
 *
 * El día que Bookea interprete «Villa para 8 personas en Guanacaste», lo
 * que cambia es el cuerpo de `destinoDe` —y `urlBusqueda`, que ya es el
 * único armador de URLs del repo— sin tocar un solo componente. El
 * repo además ya tiene un diccionario de sinónimos mucho más rico
 * (`SENALES_TIPO` en `lib/business/adivinar-tipo.ts`, hoy usado solo
 * para adivinar el tipo de un negocio al darlo de alta): es de ahí de
 * donde debería salir esta decisión cuando se conecte.
 */
const SENAS_DE_EVENTO = [
  "rancho", "ranchos", "salon", "salones", "quinta", "finca", "local para",
  "boda", "bodas", "matrimonio", "quince", "xv", "cumpleanos", "graduacion",
  "baby shower", "despedida", "evento", "eventos", "fiesta", "fiestas",
  "catering", "banquete", "buffet", "queque", "pastel", "reposteria",
  "dj", "djs", "sonido", "grupo musical", "mariachi", "marimba", "karaoke",
  "decoracion", "decorador", "globos", "flores", "floristeria",
  "fotografo", "fotografia", "video", "toldo", "toldos", "mesas", "sillas",
  "brincolin", "inflable", "payaso", "animacion",
];

/** Sin tildes y en minúsculas, para comparar contra la lista de arriba. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function destinoDe(texto: string): PestanaBuscador {
  const t = ` ${normalizar(texto).replace(/[^a-z0-9]+/g, " ").trim()} `;
  return SENAS_DE_EVENTO.some((s) => t.includes(` ${s} `)) ? "eventos" : "citas";
}

export default function BuscadorHero() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [lugar, setLugar] = useState("");
  const [ubicando, setUbicando] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);

  // El destino se recalcula mientras se escribe para que el ejemplo del
  // campo acompañe: al teclear «rancho» el placeholder pasa a hablar de
  // eventos. Es la única señal de que la búsqueda entendió algo.
  const pestana = destinoDe(texto);

  /**
   * «MI UBICACIÓN» — de las coordenadas del navegador a una provincia.
   *
   * El permiso se pide SOLO cuando la persona toca el pin, nunca al
   * cargar la página: un cartel del sistema pidiendo la ubicación antes
   * de que nadie sepa qué es este sitio se rechaza casi siempre, y
   * además quema el permiso para más adelante.
   *
   * La resolución la hace el servidor (`/api/ubicacion/cerca`) contra
   * las coordenadas de los negocios REALES, no contra una tabla de
   * centroides inventada. Ver ese archivo.
   *
   * Los tres finales posibles son honestos: se resuelve y se ESCRIBE la
   * provincia en el campo —texto visible y editable, no un estado
   * escondido—; no hay negocios ubicados todavía y se dice; o el
   * permiso se negó y se dice que se puede escribir a mano. En ninguno
   * se inventa una región.
   */
  function pedirUbicacion() {
    if (!("geolocation" in navigator)) {
      setAvisoUbicacion("Tu navegador no comparte la ubicación. Escribí el lugar a mano.");
      return;
    }
    setUbicando(true);
    setAvisoUbicacion(null);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const r = await fetch(
            `/api/ubicacion/cerca?lat=${coords.latitude}&lng=${coords.longitude}`,
          );
          const datos = (await r.json()) as {
            ok?: boolean;
            cerca?: { provincia: string } | null;
          };
          if (datos.ok && datos.cerca?.provincia) {
            setLugar(datos.cerca.provincia);
          } else {
            setAvisoUbicacion("Todavía no hay negocios ubicados cerca tuyo.");
          }
        } catch {
          setAvisoUbicacion("No se pudo resolver tu ubicación. Escribí el lugar a mano.");
        } finally {
          setUbicando(false);
        }
      },
      () => {
        setUbicando(false);
        setAvisoUbicacion("No nos diste permiso. Podés escribir el lugar a mano.");
      },
      // 8s de tope: un GPS que no engancha adentro de un local no puede
      // dejar el buscador colgado. `maximumAge` acepta una lectura de
      // hasta 5 min, que para elegir una provincia sobra y evita
      // encender el GPS de nuevo.
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    // `#catalogo` — buscar sin aterrizar en el resultado deja a la
    // persona mirando el mismo héroe, convencida de que no pasó nada.
    // Es la misma ancla que ya usan los íconos de rubro.
    router.push(`${urlBusqueda(pestana, { q: texto, lugar })}#catalogo`);
  }

  return (
    <div className="mx-auto mt-7 w-full max-w-[860px]">
      {/* ── ACÁ VIVÍAN LAS PESTAÑAS «Citas y servicios / Eventos» ──────
          Se fueron (pedido del dueño, ago 2026). Obligaban a elegir una
          VERTICAL antes de saber qué había adentro, y «vertical» es
          vocabulario nuestro, no de quien entra a reservar. Su lugar lo
          toma la fila de rubros con ícono de abajo del buscador
          (`rubros-icono.tsx`), que muestra directo lo que se puede
          pedir: Uñas, Barbería, Spa, Lugares.

          El destino del buscador ahora se decide SOLO: ver
          `destinoDe()`. */}
      <form
        onSubmit={buscar}
        className="flex flex-col items-stretch overflow-hidden rounded-3xl border border-aventurea-line bg-white shadow-[0_24px_60px_-28px_rgba(16,47,82,0.35)] transition-shadow focus-within:shadow-[0_28px_70px_-26px_rgba(16,47,82,0.45)] sm:flex-row sm:items-center sm:rounded-full"
      >
        <label className={TRAMO}>
          <span className={ROTULO}>Qué buscás</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={100}
            // El ejemplo cambia con la pestaña: «Uñas, masajes,
            // barbería…» enseña qué se puede pedir mucho mejor que un
            // «Servicio, negocio o experiencia» que no compromete nada.
            placeholder={TEXTOS[pestana].placeholderQue}
            className={CONTROL}
          />
        </label>

        <span aria-hidden className="mx-2 hidden h-8 w-px bg-aventurea-line sm:block" />
        <span aria-hidden className="mx-5 h-px bg-aventurea-line sm:hidden" />

        <div className="flex min-w-0 flex-1 items-center gap-1 px-5 py-2.5">
          {/* Texto LIBRE y no un `<select>` de provincias (pedido del
              dueño, 27 ago 2026): «que sea una barra de búsqueda, para
              poder ser universal — daremos servicios en toda
              Latinoamérica». Una lista cerrada de 7 provincias era
              exactamente lo contrario. Lo escrito viaja como `?lugar=`
              y la portada lo compara contra provincia y cantón, sin
              tildes (`filtrarPorBusqueda`, carriles-home.ts). */}
          <label className="flex min-w-0 flex-1 flex-col justify-center text-left">
            <span className={ROTULO}>Dónde</span>
            <input
              type="search"
              value={lugar}
              onChange={(e) => {
                setAvisoUbicacion(null);
                setLugar(e.target.value);
              }}
              maxLength={80}
              placeholder="Ciudad o provincia"
              className={CONTROL}
            />
          </label>
          {/* El atajo del GPS sobrevive al selector: sigue siendo la
              forma más rápida de contestar «dónde» desde un teléfono.
              Es hermano del label y no hijo — un botón ADENTRO de un
              label pelea con el clic que enfoca el campo. */}
          <button
            type="button"
            onClick={pedirUbicacion}
            disabled={ubicando}
            title="Usar mi ubicación"
            aria-label="Usar mi ubicación"
            className="presionable shrink-0 rounded-full p-2 text-aventurea-ink-soft transition-colors hover:bg-aventurea-cream-2 hover:text-[color:var(--navy)] disabled:animate-pulse"
          >
            <IconPin aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <span aria-hidden className="mx-2 hidden h-8 w-px bg-aventurea-line sm:block" />
        <span aria-hidden className="mx-5 h-px bg-aventurea-line sm:hidden" />

        {/* ── EL CUARTO TRAMO EXISTE, PERO NO MIENTE ──────────────────
            El dueño pidió un campo de fecha, y el ritmo visual de cuatro
            tramos es parte del pedido. Pero HOY no hay ningún directorio
            que lea una fecha: en Citas la disponibilidad se calcula
            negocio por negocio (no existe una consulta que responda
            «quién tiene campo el martes» para el directorio entero), y en
            Eventos solo aplicaría a la categoría «lugares». Y el atajo de
            plegar la fecha dentro de `?q=` tampoco sirve: solo `/eventos`
            interpreta fechas escritas — mandarle «barbería 3 de agosto» a
            `/citas`, que hace un `includes` plano, devuelve CERO
            resultados.

            Un control que no filtra nada es un control que miente, así
            que se muestra deshabilitado y diciendo qué es. Encenderlo es
            una consulta de disponibilidad agregada por vertical, que es
            trabajo propio y no un detalle de este buscador. */}
        <div className={`${TRAMO} opacity-55`} aria-disabled>
          <span className={ROTULO}>Cuándo</span>
          <span className="truncate text-[14.5px] font-semibold text-aventurea-ink-soft">
            Próximamente
          </span>
        </div>

        <div className="p-2">
          <button
            type="submit"
            className="presionable flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-[14.5px] font-extrabold text-white sm:w-auto"
            style={{ background: "var(--navy)" }}
          >
            <IconSearch aria-hidden className="h-4 w-4" />
            Buscar
          </button>
        </div>
      </form>

      {/* El desenlace de «Mi ubicación», cuando no salió. `role="status"`
          para que un lector de pantalla lo anuncie sin robar el foco:
          quien pidió la ubicación está esperando una respuesta. */}
      {avisoUbicacion && (
        <p role="status" className="mt-3 text-[13px] font-semibold text-aventurea-ink-soft">
          {avisoUbicacion}
        </p>
      )}

      <InsigniasTiendas />
    </div>
  );
}

/**
 * ── «PRONTO EN LAS TIENDAS» ─────────────────────────────────────────
 *
 * Dos insignias que anuncian la app, sin enlace: todavía no hay ficha a
 * la que mandar. Son `<span>` y no `<a href="#">` a propósito — un
 * enlace que no lleva a ningún lado es peor que un aviso quieto, porque
 * el cursor promete un destino y el teclado lo enfoca para nada.
 *
 * Los logos se dibujan a mano en SVG. No se usan los oficiales de Apple
 * y Google: los dos tienen guías de marca que exigen tamaños, márgenes y
 * el texto exacto («Download on the App Store»), y usarlos recortados o
 * traducidos es justamente lo que esas guías prohíben. Una silueta
 * propia dice lo mismo sin apropiarse de una marca ajena.
 *
 * El día que la app salga, esto pasa a ser dos `<a>` con las URLs
 * reales — y ahí sí corresponde usar las insignias oficiales.
 */
function InsigniasTiendas() {
  const marco =
    "flex items-center gap-2.5 rounded-xl border border-aventurea-line bg-white/80 px-4 py-2.5 text-left";

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
      <span className={marco}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-current text-[color:var(--navy)]">
          <path d="M16.5 12.6c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2C4.9 12.4 6 16 7.4 18c.7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6 1.7-.9 2.4-1.9c.7-1.1 1-2.1 1-2.2 0 0-1.9-.7-2-2.9zM14.6 6.3c.5-.7.9-1.6.8-2.5-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.2z" />
        </svg>
        <span className="min-w-0">
          <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
            Pronto en
          </span>
          <span className="block text-[13.5px] font-extrabold text-aventurea-ink">
            App Store
          </span>
        </span>
      </span>

      <span className={marco}>
        <LogoGooglePlay />
        <span className="min-w-0">
          <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
            Pronto en
          </span>
          <span className="block text-[13.5px] font-extrabold text-aventurea-ink">
            Google Play
          </span>
        </span>
      </span>
    </div>
  );
}
