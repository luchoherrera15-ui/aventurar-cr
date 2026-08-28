"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { iniciales } from "@/lib/iniciales";
import { Icono, type NombreIcono } from "./iconos";
import "../panel-oscuro.css";
import {
  ACCION,
  ACCION_TINTE,
  RAIL_GRUPO_LEALTAD,
  RAIL_ITEM_LEALTAD,
} from "../sistema-lealtad";

/**
 * EL SHELL DEL PANEL DE LEALTAD: menú lateral fijo a la izquierda,
 * barra superior, y el contenido a la derecha.
 *
 * Reemplaza a las pestañas horizontales viejas. La estructura es la de
 * un panel de administración de verdad —grupos de secciones, no una
 * fila de píldoras— porque el módulo ya no cabía en cinco pestañas:
 * hay operación diaria (clientes, actividad, equipo) y configuración
 * (recompensas, tarjeta, póster, plan), y mezclarlas obligaba a
 * adivinar dónde estaba cada cosa.
 *
 * DOS DECISIONES QUE VALE LA PENA CONOCER:
 *
 * 1. Todo el contenido queda MONTADO y se esconde con `hidden` (el
 *    patrón que ya traía TabsLealtad): cambiar de sección no
 *    re-consulta nada, el escáner no pierde su estado y el formulario
 *    del programa no pierde lo escrito a medias.
 *
 * 2. La sección activa se sincroniza con el HASH de la URL. Así los
 *    botones del tablero de Inicio ("Configurá tus recompensas →") son
 *    anclas normales renderizadas EN EL SERVIDOR: no necesitan un
 *    callback que cruce la frontera, y de yapa cada sección queda
 *    enlazable (/lealtad/panel/xxx#tarjeta).
 */

const NAVY_PROFUNDO = "#0a1226";

/* ── LOS DOS TEMAS DEL PANEL ────────────────────────────────────────
   El tema CLARO no es una segunda hoja de estilos: es el panel SIN el
   dialecto `.lealtad-oscuro`. Ese bloque de globals.css existe para
   re-mapear los componentes del panel claro de mi-negocio (tarjeta
   blanca, tinta navy) a sus equivalentes translúcidos sobre navy — o
   sea que quitarlo devuelve a cada componente su aspecto NATIVO, ya
   medido y con contraste probado. Escribir un tercer juego de colores
   habría sido inventar un tema nuevo para algo que ya existe.

   Lo que sí cambia por tema es el LIENZO, y nada más. El menú lateral y
   la barra de arriba se quedan navy en los dos: su texto es blanco y su
   contraste está medido contra ese fondo, así que aclararlos obligaría a
   re-mapear cada `text-white` del chrome — y un `text-white` remapeado
   rompe todos los botones de relleno sólido que llevan letra blanca a
   propósito. Rail oscuro + contenido claro es además el patrón que ya
   usan los paneles de administración serios. */
const LIENZO_CLARO = "#e9eff9";

/* Los BLURS naranjas que el dueño pidió para el modo claro: dos manchas
   grandes y muy diluidas, no un degradado de borde a borde. Van al
   ~10 % porque abajo se apoyan tarjetas BLANCAS — más saturación las
   teñiría de durazno y el panel dejaría de leerse como una superficie
   neutra. */
const BLURS_CLARO =
  "radial-gradient(60rem 30rem at 12% -8%, rgba(243,146,0,.13), transparent 62%)," +
  "radial-gradient(46rem 26rem at 96% 8%, rgba(243,146,0,.10), transparent 60%)," +
  "radial-gradient(52rem 34rem at 78% 105%, rgba(38,56,111,.10), transparent 62%)";

/* ── DÓNDE VIVE LA PREFERENCIA DE TEMA ──────────────────────────────
   En `localStorage`, que para React es un sistema EXTERNO: no es
   estado suyo, puede cambiar sin que él se entere (otra pestaña del
   mismo panel) y en el servidor no existe.

   Por eso se lee con `useSyncExternalStore` y no con
   `useState` + `useEffect`. Ese par parece más simple pero pinta DOS
   veces —primero el valor por defecto, después el guardado—, que es
   justo el parpadeo de oscuro-a-claro al entrar; y además React
   desaconseja el `setState` sincrónico dentro de un efecto (lo marca
   el linter). `useSyncExternalStore` está hecho para esto: se le da
   una lectura para el cliente y otra para el servidor, y él resuelve
   la hidratación sin descuadrarla.

   La instantánea del SERVIDOR es siempre `false` (oscuro): es el tema
   con el que el módulo nació y el que conocen los negocios que ya lo
   usan, así que el HTML servido y el primer render del cliente
   coinciden. */
const LLAVE_TEMA = "bookea:lealtad:tema";

const oyentesDelTema = new Set<() => void>();

function suscribirseAlTema(alCambiar: () => void): () => void {
  oyentesDelTema.add(alCambiar);
  // `storage` solo lo dispara OTRA pestaña, nunca la que escribió. Es
  // lo que hace que cambiar el tema en una pestaña del panel lo cambie
  // en las demás; a la propia la avisa `escribirTema`.
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentesDelTema.delete(alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

function leerTemaClaro(): boolean {
  try {
    return window.localStorage.getItem(LLAVE_TEMA) === "claro";
  } catch {
    // Navegador con el almacenamiento bloqueado: se queda en oscuro.
    return false;
  }
}

function escribirTema(claro: boolean): void {
  try {
    window.localStorage.setItem(LLAVE_TEMA, claro ? "claro" : "oscuro");
  } catch {
    // No poder recordarlo no puede impedir cambiarlo en esta visita:
    // se avisa igual y el panel cambia hasta que se recargue.
  }
  for (const avisar of oyentesDelTema) avisar();
}

/* La barra del menú, un escalón por DEBAJO del lienzo. Es la anatomía
   de la maqueta: el rail no es una franja del mismo color con un borde,
   es una superficie propia. */
const RAIL = "#070d1c";
const RAIL_LINEA = "rgba(255,255,255,.08)";

/* El naranja se quedó en UNA sola cosa de la navegación: la barrita del
   ítem activo. Es la única marca de marca del menú —el relleno del ítem
   ya es azul—, y así el naranja sigue significando «acá estás» en vez
   de «esto es un botón».

   Se queda el naranja del LOGO (#f39200) y no su versión clara: como
   barrita es un elemento gráfico, necesita 3:1, y sobre el #070d1c del
   rail da 8,24:1. El naranja solo deja de leerse sobre fondos CLAROS
   —ahí es donde el contrato manda usar `--orange-fuerte`—, y este no
   lo es. */
const ACENTO = "var(--orange)";

export type ItemLealtad = {
  id: string;
  etiqueta: string;
  icono: NombreIcono;
};

export type GrupoLealtad = {
  titulo: string;
  items: ItemLealtad[];
};

export default function ShellLealtad({
  negocio,
  usuario,
  grupos,
  contenidos,
}: {
  negocio: { nombre: string; plan: string | null };
  usuario: { nombre: string; email: string; rol: string };
  grupos: GrupoLealtad[];
  contenidos: Record<string, ReactNode>;
}) {
  const items = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);
  const primera = items[0]?.id ?? "inicio";

  const [activa, setActiva] = useState(primera);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // ── ACÁ VIVIÓ EL «MODO MOSTRADOR» (retirado el 28 ago 2026) ──────
  // Un interruptor en la barra dejaba la pantalla solo con el escáner
  // («Staff Mode»). Murió por redundante: desde que «Inicio» ES el
  // mostrador, el modo no agregaba nada — y para dejarle el escáner
  // pelado a un empleado está el «Link directo de la caja»
  // (link-scan.tsx), que ni siquiera carga el panel. El dueño lo
  // remató: «eliminá lo de modo mostrador».
  // El menú del avatar (0163): «Mi perfil» y «Mis negocios» ya no son
  // ítems del rail — viven acá, colgando del mismo bloque que ya
  // mostraba el nombre.
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);

  // Ver el bloque de `LLAVE_TEMA` arriba: la preferencia vive en
  // localStorage y se lee como lo que es, un sistema externo.
  const claro = useSyncExternalStore(suscribirseAlTema, leerTemaClaro, () => false);


  // Qué tarjeta se está mirando. NO se usa para nada más que como
  // disparador del efecto de abajo — ver ahí por qué hace falta.
  const tarjetaEnUrl = useSearchParams().get("tarjeta");

  // El hash manda. Se lee en un efecto y no en el estado inicial para
  // que el HTML del servidor y el del cliente coincidan en el primer
  // render — leer `location` durante el render es un error de
  // hidratación esperando a pasar.
  //
  // La única dependencia es `?tarjeta=`, y es la que arregla el selector
  // de tarjetas. `hashchange` NO cubre ese caso: el selector navega con
  // <Link>, o sea `history.pushState`, y pushState no dispara
  // `hashchange` NUNCA (solo lo hace un cambio de hash escrito en la
  // barra del navegador o un <a> normal). Resultado: se cambiaba de
  // tarjeta, la URL se actualizaba, el servidor devolvía los datos de la
  // otra tarjeta… y la sección visible seguía siendo la de antes, con el
  // hash y la pantalla dicíéndose cosas distintas.
  //
  // `items` sigue FUERA de la lista a propósito: cada server action del
  // panel llama a `revalidatePath` y con `items` adentro el efecto se
  // volvía a correr en cada refresco, sacando del modo mostrador a quien
  // estaba escaneando —la acción que MÁS revalida—. `?tarjeta=` no
  // cambia por una revalidación, así que ese problema no vuelve.
  useEffect(() => {
    const aplicarHash = () => {
      const destino = window.location.hash.replace("#", "");
      if (!destino) return;
      setActiva(destino);
      setMenuAbierto(false);
    };
    aplicarHash();
    window.addEventListener("hashchange", aplicarHash);
    return () => window.removeEventListener("hashchange", aplicarHash);
  }, [tarjetaEnUrl]);

  // Si a quien mira le quitaron un permiso, la sección elegida puede ya
  // no venir en la lista del servidor: se cae a la primera visible.
  const efectiva = items.some((i) => i.id === activa) ? activa : primera;
  const actual = items.find((i) => i.id === efectiva);

  return (
    <div
      className={`min-h-svh ${claro ? "" : "lealtad-oscuro"}`}
      style={
        claro
          ? { background: BLURS_CLARO, backgroundColor: LIENZO_CLARO }
          : { background: NAVY_PROFUNDO }
      }
    >
      {/* EN MODO MOSTRADOR NO HAY COLUMNA DE MENÚ. Ver el comentario del
          <aside>: el menú no se esconde con CSS, no se monta. */}
      <div className="lg:grid lg:grid-cols-[254px_minmax(0,1fr)]">
        {/* ── Fondo que cierra el cajón en móvil ─────────────────── */}
        {menuAbierto && (
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          />
        )}

        {/* ── Menú lateral ───────────────────────────────────────────
            NO SE MONTA EN MODO MOSTRADOR, y eso es el arreglo.

            El comentario del modo mostrador prometía «sin menú de
            configuración a un clic de distancia», pero el menú seguía
            montado y clickeable: el contenido se escondía con `hidden` y
            la barra lateral no. Un toque en «Recompensas» y el empleado
            estaba en la pantalla donde se archiva el programa.

            Esconderlo con CSS no habría alcanzado: un enlace escondido
            con `opacity` o `-translate-x-full` sigue recibiendo el
            teclado y el lector de pantalla. Se desmonta.

            Esto NO es un candado — quien tenga el teléfono puede tocar
            «Salir» (con confirmación) o recargar la página. Es lo que
            evita el resbalón, que es lo que de verdad pasa en una caja.
            El candado de verdad es el PIN de la 0137/0148, que va
            aparte. */}
        {(
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col overflow-y-auto border-r transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:w-auto lg:translate-x-0 ${
            menuAbierto ? "translate-x-0" : "-translate-x-full"
          }`}
          /* `scrollbarWidth: "none"` — mismo patrón que usa el riel de
             `riel-proveedores.tsx` para esconder la barra nativa: el menú
             sigue siendo scrolleable con rueda/gesto/teclado, solo no
             dibuja el control feo del navegador encima del rail oscuro. */
          style={{ background: RAIL, borderColor: RAIL_LINEA, scrollbarWidth: "none" }}
        >
          {/* LA CABECERA DE NEGOCIO (`.business` de la maqueta): un
              cuadrado con las iniciales, el nombre y su subtítulo, DENTRO
              de una superficie propia. Antes era una fila suelta con un
              borde debajo, o sea que el nombre del negocio pesaba lo
              mismo que un ítem del menú; en un panel de varios negocios,
              saber en cuál estás parado es lo primero que se lee. */}
          <div className="p-3">
            <div
              className="flex items-center gap-2.5 rounded-xl border p-2.5"
              style={{ background: "rgba(255,255,255,.07)", borderColor: "rgba(255,255,255,.1)" }}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[12.5px] font-extrabold"
                style={{ background: ACCION_TINTE, color: ACCION }}
              >
                {iniciales(negocio.nombre) || "B"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-extrabold text-white">
                  {negocio.nombre}
                </span>
                {/* Sólido y no `text-white/45`: el mismo dato caía sobre
                    dos fondos distintos (el rail y esta superficie al
                    7 %) y se veía de dos grises. #9fb0cf sobre el rail da
                    8,86:1 y sobre esta tarjeta 7,60:1. */}
                <span className="block truncate text-[11px] text-aventurea-rail">
                  {negocio.plan ?? "Sin plan"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="shrink-0 text-aventurea-rail hover:text-white lg:hidden"
                aria-label="Cerrar el menú"
              >
                <Icono nombre="cerrar" className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          <nav className="flex-1 px-3 pb-4">
            {grupos.map((grupo) => (
              <div key={grupo.titulo} className="mb-5 last:mb-0">
                <p className={RAIL_GRUPO_LEALTAD}>{grupo.titulo}</p>
                <ul className="space-y-0.5">
                  {grupo.items.map((item) => {
                    const esta = item.id === efectiva;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          aria-current={esta ? "page" : undefined}
                          onClick={() => {
                            setActiva(item.id);
                            setMenuAbierto(false);
                          }}
                          /* La barrita del acento entra por el BORDE
                             IZQUIERDO del propio ítem y no por un <span>
                             absoluto: así los 3px están siempre
                             reservados —el activo y el de reposo miden
                             igual— y el texto no salta al cambiar de
                             sección. Es el `inset 3px 0 var(--accent)`
                             de la maqueta. */
                          className={`${RAIL_ITEM_LEALTAD} ${
                            esta ? "text-white" : "text-aventurea-rail hover:text-white"
                          }`}
                          style={
                            esta
                              ? { background: ACCION_TINTE, borderLeftColor: ACENTO }
                              : undefined
                          }
                        >
                          <Icono nombre={item.icono} className="h-[17px] w-[17px] shrink-0" />
                          <span className="min-w-0 truncate">{item.etiqueta}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          {/* El pie del rail («Mis negocios») se mudó al menú del avatar
             (0163) — ver el bloque de la barra superior, más abajo. La
             maqueta ponía acá una tarjeta de plan con un «78 %
             configurado» que no existe en Bookea; nunca se agregó. */}
        </aside>
        )}

        {/* ── Columna del contenido ──────────────────────────────── */}
        <div className="min-w-0">
          {/* LA BARRA SUPERIOR (`.topbar`). 64px fijos, como la del panel
              de mi-negocio: los dos productos comparten el mismo alto de
              chrome para que pasar de uno al otro no se sienta un salto.
              El contexto va con separador vertical, igual que la maqueta
              —negocio · sección—, no como un título suelto. */}
          <header
            className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6"
            style={{
              background: "rgba(10,18,38,.88)",
              borderColor: RAIL_LINEA,
            }}
          >
            {(
              <button
                type="button"
                onClick={() => setMenuAbierto(true)}
                className="shrink-0 rounded-lg p-1.5 text-aventurea-rail hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Abrir el menú"
              >
                <Icono nombre="menu" className="h-5 w-5" />
              </button>
            )}

            <p className="flex min-w-0 flex-1 items-center gap-2.5 truncate">
              {/* El nombre del negocio solo entra en la barra cuando el
                  rail no está a la vista: en escritorio ya se lee arriba
                  del menú, y repetirlo a 20 cm de distancia es ruido. */}
              <span className="shrink-0 truncate text-[13px] font-bold text-aventurea-rail lg:hidden">
                {negocio.nombre}
              </span>
              <span
                aria-hidden
                className="h-4 w-px shrink-0 lg:hidden"
                style={{ background: "rgba(255,255,255,.18)" }}
              />
              <span className="min-w-0 truncate text-[14px] font-extrabold text-white">
                {actual?.etiqueta ?? "Panel"}
              </span>
            </p>

            {/* CLARO / OSCURO. Va en la barra y no enterrado en
                Configuración porque es una preferencia de VISTA que se
                cambia mirando la pantalla: quien atiende de día junto a
                una ventana lo necesita a mano, no a tres clics.

                Es un <button> con `aria-pressed` y no un checkbox: no
                envía nada ni forma parte de un formulario, y el estado
                que comunica es «esta opción está activada», que es
                exactamente lo que `aria-pressed` significa. */}
            <button
              type="button"
              onClick={() => escribirTema(!claro)}
              aria-pressed={claro}
              title={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-bold text-aventurea-rail transition-colors hover:text-white"
              style={{ borderColor: RAIL_LINEA, background: "rgba(255,255,255,.06)" }}
            >
              <Icono
                nombre={claro ? "sol" : "luna"}
                className="h-[15px] w-[15px] shrink-0"
              />
              <span className="hidden sm:block">{claro ? "Claro" : "Oscuro"}</span>
            </button>

            {(
              <>
                {/* AVATAR + NOMBRE, como en la maqueta — ahora con menú
                    (0163). «Mi perfil» y «Mis negocios» vivían como
                    sección propia del rail y como link suelto al pie del
                    menú; los dos absorbidos acá, que es donde ya estaba
                    el nombre de la cuenta. */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    title={usuario.email}
                    aria-haspopup="menu"
                    aria-expanded={menuUsuarioAbierto}
                    onClick={() => setMenuUsuarioAbierto((v) => !v)}
                    className="flex items-center gap-2 rounded-xl border px-1.5 py-1.5 transition-colors hover:border-white/40 sm:pr-3"
                    style={{
                      borderColor: "rgba(255,255,255,.18)",
                      background: "rgba(255,255,255,.06)",
                    }}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
                      style={{ background: ACCION_TINTE, color: ACCION }}
                    >
                      {iniciales(usuario.nombre) || "?"}
                    </span>
                    <span className="hidden max-w-[140px] truncate text-[12.5px] font-bold text-white sm:block">
                      {usuario.nombre}
                    </span>
                  </button>

                  {menuUsuarioAbierto && (
                    <>
                      {/* Capa transparente para cerrar al tocar afuera —
                          mismo truco que el cajón del rail en móvil, sin
                          el fondo oscuro: acá el menú es chico y no tapa
                          la pantalla. */}
                      <button
                        type="button"
                        aria-label="Cerrar el menú de la cuenta"
                        onClick={() => setMenuUsuarioAbierto(false)}
                        className="fixed inset-0 z-40"
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-[calc(100%+6px)] z-50 w-[220px] overflow-hidden rounded-xl border py-1.5 shadow-flotante"
                        style={{ background: RAIL, borderColor: RAIL_LINEA }}
                      >
                        <div className="border-b px-3.5 py-2.5" style={{ borderColor: RAIL_LINEA }}>
                          <p className="truncate text-[13px] font-extrabold text-white">
                            {usuario.nombre}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-aventurea-rail">{usuario.rol}</p>
                        </div>
                        <Link
                          href="/cuenta"
                          role="menuitem"
                          className={`${RAIL_ITEM_LEALTAD} mx-1.5 mt-1 text-aventurea-rail hover:text-white`}
                          onClick={() => setMenuUsuarioAbierto(false)}
                        >
                          <Icono nombre="perfil" className="h-[17px] w-[17px] shrink-0" />
                          <span className="min-w-0 truncate">Tu cuenta en Bookea</span>
                        </Link>
                        <Link
                          href="/lealtad/panel"
                          role="menuitem"
                          className={`${RAIL_ITEM_LEALTAD} mx-1.5 text-aventurea-rail hover:text-white`}
                          onClick={() => setMenuUsuarioAbierto(false)}
                        >
                          <Icono nombre="negocio" className="h-[17px] w-[17px] shrink-0" />
                          <span className="min-w-0 truncate">Cambiar de negocio</span>
                        </Link>
                      </div>
                    </>
                  )}
                </div>

                <Link href="/lealtad" className="hidden shrink-0 lg:block">
                  <Image
                    src="/logo-bookea-blanco-v4.png"
                    alt="Bookea"
                    width={92}
                    height={29}
                    className="h-[19px] w-auto opacity-70"
                  />
                </Link>
              </>
            )}
          </header>

          {/* El contenido: mismo ritmo que la maqueta (`.content`,
              30px/34px, y 4/5 en el teléfono) y el tope de legibilidad
              del panel. */}
          <main className="px-4 py-5 sm:px-6 sm:py-7">
            <div className="mx-auto w-full max-w-[1080px]">
              {items.map((item) => (
                <section key={item.id} hidden={item.id !== efectiva}>
                  {contenidos[item.id]}
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
