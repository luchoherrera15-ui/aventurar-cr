"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { iniciales } from "@/lib/iniciales";
import { Icono, type NombreIcono } from "./iconos";
import "../panel-oscuro.css";
import {
  ACCION,
  ACCION_BORDE,
  ACCION_TINTA,
  ACCION_TINTE,
  BOTON_ACCION,
  BOTON_LEALTAD,
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
  mostrador,
}: {
  negocio: { nombre: string; plan: string | null };
  usuario: { nombre: string; email: string; rol: string };
  grupos: GrupoLealtad[];
  contenidos: Record<string, ReactNode>;
  /** El escáner a pantalla completa. null = quien mira no acredita. */
  mostrador?: ReactNode;
}) {
  const items = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);
  const primera = items[0]?.id ?? "inicio";

  const [activa, setActiva] = useState(primera);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [enMostrador, setEnMostrador] = useState(false);
  const [pidiendoSalida, setPidiendoSalida] = useState(false);
  // El menú del avatar (0163): «Mi perfil» y «Mis negocios» ya no son
  // ítems del rail — viven acá, colgando del mismo bloque que ya
  // mostraba el nombre.
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);

  function entrarAlMostrador() {
    setMenuAbierto(false);
    setPidiendoSalida(false);
    setEnMostrador(true);
  }

  function salirDelMostrador() {
    setPidiendoSalida(false);
    setEnMostrador(false);
  }

  // El hash manda. Se lee en un efecto y no en el estado inicial para
  // que el HTML del servidor y el del cliente coincidan en el primer
  // render — leer `location` durante el render es un error de
  // hidratación esperando a pasar.
  //
  // Sin dependencias A PROPÓSITO: cada server action del panel llama a
  // `revalidatePath`, y con `items` en la lista el efecto se volvía a
  // correr en cada refresco. Eso sacaba del modo mostrador a quien
  // estaba escaneando — la acción que MÁS revalida. Un hash que no
  // corresponde a ninguna sección no rompe nada: `efectiva`, abajo,
  // cae a la primera visible.
  useEffect(() => {
    const aplicarHash = () => {
      const destino = window.location.hash.replace("#", "");
      if (!destino) return;
      setActiva(destino);
      setEnMostrador(false);
      setMenuAbierto(false);
    };
    aplicarHash();
    window.addEventListener("hashchange", aplicarHash);
    return () => window.removeEventListener("hashchange", aplicarHash);
  }, []);

  // Si a quien mira le quitaron un permiso, la sección elegida puede ya
  // no venir en la lista del servidor: se cae a la primera visible.
  const efectiva = items.some((i) => i.id === activa) ? activa : primera;
  const actual = items.find((i) => i.id === efectiva);

  return (
    <div className="lealtad-oscuro min-h-svh" style={{ background: NAVY_PROFUNDO }}>
      {/* EN MODO MOSTRADOR NO HAY COLUMNA DE MENÚ. Ver el comentario del
          <aside>: el menú no se esconde con CSS, no se monta. */}
      <div className={enMostrador ? "" : "lg:grid lg:grid-cols-[254px_minmax(0,1fr)]"}>
        {/* ── Fondo que cierra el cajón en móvil ─────────────────── */}
        {menuAbierto && !enMostrador && (
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
        {!enMostrador && (
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
                    const esta = item.id === efectiva && !enMostrador;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          aria-current={esta ? "page" : undefined}
                          onClick={() => {
                            setActiva(item.id);
                            setEnMostrador(false);
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
            {!enMostrador && (
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
                  del menú, y repetirlo a 20 cm de distancia es ruido. En
                  modo mostrador el rail no se monta en ningún tamaño, así
                  que ahí se muestra siempre — es la única pista de en qué
                  negocio está parado quien tiene el teléfono en la caja. */}
              <span
                className={`shrink-0 truncate text-[13px] font-bold text-aventurea-rail ${
                  enMostrador ? "" : "lg:hidden"
                }`}
              >
                {negocio.nombre}
              </span>
              <span
                aria-hidden
                className={`h-4 w-px shrink-0 ${enMostrador ? "" : "lg:hidden"}`}
                style={{ background: "rgba(255,255,255,.18)" }}
              />
              <span className="min-w-0 truncate text-[14px] font-extrabold text-white">
                {enMostrador ? "Modo mostrador" : (actual?.etiqueta ?? "Panel")}
              </span>
            </p>

            {/* Modo mostrador: el equivalente nuestro del "Staff Mode".
                Deja la pantalla en el escáner y nada más — es lo que se
                le pasa al empleado en la caja. Solo aparece si quien
                mira puede acreditar.

                ENTRAR es un toque; SALIR pide confirmación. Era un
                interruptor en las dos direcciones, y el interruptor está
                justo donde el pulgar agarra el teléfono: un roce y el
                empleado quedaba en el panel completo sin haber querido
                ir a ningún lado. */}
            {mostrador && !enMostrador && (
              <label className="flex shrink-0 cursor-pointer items-center gap-2">
                <span className="hidden text-[12px] font-bold text-aventurea-rail sm:block">
                  Modo mostrador
                </span>
                <input
                  type="checkbox"
                  checked={false}
                  onChange={entrarAlMostrador}
                  className="peer sr-only"
                />
                {/* El interruptor se pinta con el estado de React y no
                    con `peer-checked:`: la perilla es NIETA del input,
                    no su hermana, y la variante de Tailwind solo
                    alcanza hermanos. */}
                <span
                  aria-hidden
                  className="relative h-[22px] w-[40px] rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white/50"
                  style={{ background: "rgba(255,255,255,.15)" }}
                >
                  <span className="absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white transition-transform" />
                </span>
              </label>
            )}

            {enMostrador ? (
              pidiendoSalida ? (
                <span className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-[12px] font-bold text-aventurea-rail sm:block">
                    ¿Salir?
                  </span>
                  <button
                    type="button"
                    onClick={salirDelMostrador}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-extrabold"
                    style={{ background: ACCION, color: ACCION_TINTA }}
                  >
                    Sí, salir
                  </button>
                  <button
                    type="button"
                    onClick={() => setPidiendoSalida(false)}
                    className="rounded-lg border px-3 py-1.5 text-[12px] font-bold text-aventurea-rail"
                    style={{ borderColor: ACCION_BORDE }}
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPidiendoSalida(true)}
                  className="shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-bold text-aventurea-rail hover:text-white"
                  style={{ borderColor: ACCION_BORDE }}
                >
                  Salir
                </button>
              )
            ) : (
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
              {/* El mostrador se monta SOLO al encenderlo: arrastra el
                  escáner (jsQR + cámara), y cargarlo escondido en cada
                  visita al panel es peso que casi nadie usa. */}
              {mostrador && enMostrador && (
                <section>
                  {mostrador}
                  {/* El botón de abajo también confirma: es el mismo
                      estado que el «Salir» de la barra, así que tocar
                      uno u otro pregunta lo mismo. */}
                  {pidiendoSalida ? (
                    <div className="mt-3.5 rounded-3xl border border-aventurea-line bg-aventurea-surface px-5 py-4 text-center">
                      <p className="text-[13px] font-bold text-aventurea-ink">
                        ¿Salir del modo mostrador?
                      </p>
                      <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                        Se vuelve al panel completo, con la configuración del programa.
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={salirDelMostrador}
                          className={BOTON_ACCION}
                          style={{ background: ACCION, color: ACCION_TINTA }}
                        >
                          Sí, salir
                        </button>
                        <button
                          type="button"
                          onClick={() => setPidiendoSalida(false)}
                          className={BOTON_LEALTAD}
                        >
                          Seguir acá
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPidiendoSalida(true)}
                      className={`${BOTON_LEALTAD} mt-3.5 w-full`}
                    >
                      Salir del modo mostrador
                    </button>
                  )}
                </section>
              )}

              {items.map((item) => (
                <section key={item.id} hidden={enMostrador || item.id !== efectiva}>
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
