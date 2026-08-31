import type { Metadata } from "next";
import Link from "next/link";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
import { esPlanOfrecido } from "@/lib/lealtad/planes";
import { createClient } from "@/lib/supabase/server";
import { idDeCuentaDeBookea } from "@/lib/lealtad/personas";
import NavLealtad from "../nav-lealtad";
import ConfiguradorLealtad from "../configurador-lealtad";
import BurbujaContacto from "../burbuja-contacto";

/**
 * /lealtad/crear — LA PANTALLA DEDICADA PARA ARMAR EL PASE.
 *
 * Pedido del dueño (ago 2026): que «¡Creá tu pase de lealtad!» lleve a
 * su propia pantalla en vez de desplegar el configurador a mitad de la
 * landing. Armar una tarjeta es una tarea con principio y fin —el
 * mismo criterio que ya usan `/lealtad/panel/[id]/crear` y el editor de
 * tarjeta—: acá no hay secciones de marketing compitiendo por la
 * atención, solo el configurador y la ayuda.
 *
 * Es el MISMO `ConfiguradorLealtad` de siempre (menú → paquetes →
 * editor), con su respaldo en sessionStorage intacto: quien empezó a
 * armar su tarjeta acá y pasa por «Tu cuenta» —que recarga la página
 * entera— vuelve exactamente a este punto, no a la landing.
 *
 * ── LA AYUDA, EN UNA BURBUJA (31 ago 2026) ─────────────────────────
 * Acá hubo una columna de ayuda al lado del configurador. Se cambió
 * por `BurbujaContacto` flotante cuando el asistente pasó a ocupar el
 * ancho completo: el hilo de chat con su carga de sesión pesaba una
 * consulta por render y ocupaba una tercera columna en una pantalla
 * que ya tenía dos.
 */
export const metadata: Metadata = {
  title: "Creá tu pase · Bookea Lealtad",
  description:
    "Armá tu tarjeta de lealtad: elegí el tipo, los colores y la regalía, y mirala en el teléfono antes de crear cuenta.",
  alternates: { canonical: "/lealtad/crear" },
};

export default async function CrearPaseLealtadPage({
  searchParams,
}: {
  /** `?plan=` — quien llega desde /lealtad/planes con un paquete ya
   *  elegido. Mismo criterio de validación que /lealtad/nuevo: nunca
   *  confiar el string crudo, siempre contra `esPlanOfrecido`. */
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planParam } = await searchParams;
  const planPedido = planParam ?? null;
  const planInicial = esPlanOfrecido(planPedido) ? planPedido : null;

  const sesion = await sesionDelNavLealtad();

  // ⚠️ `idDeCuentaDeBookea` y NO `!!user`: Supabase abre sesiones
  //    ANÓNIMAS —el chat flotante de esta misma página abre una—, y con
  //    `!!user` esa sesión sin cuenta contaba como cuenta: el asistente
  //    se saltaba el registro obligatorio y el alta salía sin dueño.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sesionActiva = idDeCuentaDeBookea(user) !== null;

  return (
    /* ── EL FONDO: LISO (dueño, 31 ago 2026) ───────────────────────

       Acá vivió la aurora de la marca —las mismas tres manchas que
       usa /lealtad/ingresar—, puesta el mismo día a pedido. Se sacó
       horas después, también a pedido: «quitemos el blur de fondo,
       quiero que la página sea nítida y clara y que no sea enredada
       para los usuarios».

       El motivo es de fondo y no de gusto: esta pantalla es un
       formulario largo, y el degradado en movimiento detrás de la
       hoja blanca competía con lo único que hay que mirar. La aurora
       sigue siendo de la marca y sigue en su lugar en las pantallas
       de entrada; en el asistente el fondo se calla.

       Si alguien la quiere de vuelta: `aurora-lienzo` +
       `aurora-mancha-lenta` en globals.css, y este main necesita
       seguir siendo `relative` (ver el comentario de la sección de
       abajo, que explica por qué). */
    <main className="relative min-h-svh bg-[#f7f9fc]">
      <NavLealtad autoOcultar logueado={sesion.logueado} nombre={sesion.nombre} />

      {/* ── EL ENCABEZADO SE ACHICÓ A UNA LÍNEA (dueño, 31 ago 2026) ──

          Pedido: «que todo quede en la pantalla para hacerlo sencillo,
          que siempre no haya que hacer scroll».

          Acá había un titular de hasta 44 px en tres renglones, un
          rótulo y una bajada de dos líneas: unos 250 px de alto ANTES
          del primer control. En una pantalla de 900 px eso es más de un
          cuarto del espacio gastado en repetir lo que la persona ya
          sabe — hizo clic en «Creá tu tarjeta», no hace falta
          convencerla otra vez.

          Queda una sola línea que hace de barra: el volver a la
          izquierda y el nombre de la tarea a la derecha. Lo que se
          perdió del copy («la primera es gratis, no pide tarjeta») ya lo
          dice el paso de paquetes, que es donde de verdad importa. */}
      {/* ⚠️ `relative` NO ES DECORATIVO: SIN ESTO LA AURORA TIÑE LA
          TARJETA BLANCA.

          `aurora-lienzo` es `position: absolute`, y en CSS un elemento
          POSICIONADO se pinta sobre los estáticos aunque vaya antes en
          el DOM. La tarjeta era blanca sólida (se midió: rgb(255,255,
          255)) y aun así se veía anaranjada arriba, porque la aurora le
          pasaba por encima.

          Con la sección posicionada, el contenido vuelve a quedar sobre
          el fondo y el blanco es blanco — que es justo lo que se pidió:
          «el cuadro de crear la tarjeta queda en blanco para que no se
          mezcle visualmente». */}
      <section className="relative px-4 pb-6 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-[1560px]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/lealtad"
              className="text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              ← Volver a Lealtad
            </Link>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[color:var(--accion)]">
              Armá tu pase
            </p>
          </div>

          {/* ── TODO EN UNA PANTALLA (dueño, 31 ago 2026) ──────────

              «Acortalo, que no haya que hacer ningún scroll».

              La grilla toma la altura que queda —`100svh` menos el nav
              y los respiros— y cada columna se arregla adentro. `svh`
              y no `vh`: en el teléfono `vh` cuenta la barra del
              navegador que puede estar oculta, y la pantalla termina
              midiendo más que lo que se ve.

              El límite solo aplica desde `lg`. En teléfono forzar la
              altura sería peor: ahí el contenido SÍ tiene que poder
              correrse, porque no hay ancho para poner nada al lado. */}
          {/* ── UN SOLO CUADRO, CENTRADO (dueño, 31 ago 2026) ──────

              «Centralo; si ocupás quitar lo de la derecha de WhatsApp,
              quitalo y lo ponés abajo en burbujas flotantes».

              La columna de ayuda vivía al costado y hacía dos cosas
              malas a la vez: corría el asistente fuera del centro y le
              robaba 320 px de ancho a lo único que la persona vino a
              hacer. El canal no se pierde —abajo va `BurbujaContacto`,
              la misma que ya usa la landing— pero deja de competir con
              la tarea.

              `max-w` acotado y `mx-auto`: el asistente queda centrado y
              no se estira a 1.560 px, que a esa medida separa tanto la
              configuración del pase que dejan de leerse como una cosa. */}
          <div className="mx-auto w-full max-w-[1080px] lg:h-[calc(100svh-148px)]">
            {/* El scroll, si hace falta, vive ACÁ ADENTRO y no en la
                página: así el fondo y el nav no se mueven, y cada paso
                arranca arriba. */}
            <div className="sin-barra min-w-0 lg:h-full lg:overflow-y-auto lg:pr-1">
              <ConfiguradorLealtad haySesion={sesionActiva} planInicial={planInicial} />
            </div>
          </div>
        </div>
      </section>

      {/* El canal de ayuda que salió de la columna: la misma burbuja
          flotante de la landing. Acá adentro se puede chatear, escribir
          por WhatsApp o dejar un correo, sin ocupar un centímetro de la
          pantalla mientras la persona arma su tarjeta. */}
      <BurbujaContacto />
    </main>
  );
}
