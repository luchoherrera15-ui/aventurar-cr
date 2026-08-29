"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icono } from "./panel/[id]/iconos";
import { INDUSTRIAS } from "./industrias/datos";
import { iniciales } from "@/lib/iniciales";
import { cerrarSesionLealtad } from "./sesion-actions";
import { createClient } from "@/lib/supabase/client";

/**
 * EL NAV COMPACTO DE /lealtad.
 *
 * Antes esta landing era "inmersiva, sin chrome": dos píldoras fijas
 * (Volver / Entrar) y nada más. El rediseño pide una barra real —quien
 * llega necesita moverse entre "cómo funciona", "soluciones" y
 * "planes" sin scrollear a ciegas, y quien ya tiene cuenta necesita
 * una puerta que no dependa de memorizar dónde quedó "Entrá acá".
 *
 * Blanca y no navy a propósito: el resto de la página alterna franjas
 * claras y oscuras, y una barra fija oscura se pelea con el contenido
 * claro que queda debajo al hacer scroll. Blanca funciona igual sobre
 * las dos.
 */

const ENLACES: { href: string; label: string }[] = [
  // Al TUTORIAL (/lealtad/ayuda, 28 ago 2026) y ya no al ancla
  // #como-funciona: el dueño pidió la puerta en el nav, y una ruta real
  // funciona desde CUALQUIER página de Lealtad — el ancla solo servía
  // parada sobre la landing (desde /lealtad/industrias no iba a ningún
  // lado). La sección de la landing conserva su id por si algún enlace
  // viejo la apunta.
  { href: "/lealtad/ayuda", label: "¿Cómo funciona?" },
  { href: "#soluciones", label: "Soluciones" },
  { href: "#planes", label: "Planes" },
];

/** Los ítems del menú de cuenta — desktop y mobile dibujan la misma lista. */
const ITEMS_CUENTA: { href: string; label: string }[] = [
  { href: "/lealtad/panel", label: "Ver mis negocios con planes" },
  { href: "/cuenta", label: "Configuración de perfil" },
];

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA SESIÓN SE RESUELVE EN EL NAVEGADOR CUANDO NADIE LA PASA
 * ════════════════════════════════════════════════════════════════════
 *
 * Las tres landings —/lealtad, /lealtad/industrias y la ficha de cada
 * industria— son páginas de marketing: el mismo HTML para todo el
 * mundo, sin un solo dato por visitante. Y aun así se renderizaban
 * ENTERAS en el servidor en cada visita, porque llamaban a
 * `sesionDelNavLealtad()` para saber qué decir en esta esquina.
 *
 * Ese único `await` —leer una cookie— era lo que las volvía dinámicas.
 * Next no puede prerenderizar una página que lee cookies, así que la
 * landing completa se armaba de nuevo por visitante, con su CPU.
 *
 * Sacándolo, las tres se prerenderizan y salen del CDN: cero
 * invocaciones. La sesión la resuelve este componente, que YA corre en
 * el navegador, con el cliente de Supabase del navegador — que lee el
 * token de su propio almacenamiento, SIN pedirle nada al servidor.
 *
 * ── EL PRECIO, QUE ES REAL PERO CHICO ───────────────────────────────
 * Hay un instante en que la esquina dice «Ingresar» antes de decir el
 * nombre. Es cosmético y solo lo ve quien tiene sesión. A cambio, la
 * página aparece de una en vez de esperar al servidor.
 *
 * ── LAS PÁGINAS CON SESIÓN DE VERDAD SIGUEN PASANDO LAS PROPS ───────
 * `/lealtad/crear` y `/lealtad/ingresar` son puertas de sesión: tienen
 * que decidir en el servidor a dónde mandar a quien llega. Esas dos
 * siguen llamando a `sesionDelNavLealtad()` y pasando `logueado`/
 * `nombre`, y por eso las props siguen existiendo. Cuando llegan, el
 * componente NO consulta nada.
 */
function useSesionDelNav(props: { logueado?: boolean; nombre?: string | null }) {
  // `undefined` (nadie pasó la prop) es distinto de `false` (el
  // servidor miró y no hay sesión). Solo el primero dispara la lectura.
  const loResuelveElServidor = props.logueado !== undefined;
  const [sesion, setSesion] = useState<{ logueado: boolean; nombre: string | null }>({
    logueado: props.logueado ?? false,
    nombre: props.nombre ?? null,
  });

  useEffect(() => {
    if (loResuelveElServidor) return;
    let vivo = true;
    void (async () => {
      try {
        const supabase = createClient();
        // `getUser()` en el navegador resuelve contra el token que ya
        // está guardado; no es un viaje a nuestro servidor.
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!vivo || !user) return;

        // El MISMO criterio que `sesionDelNavLealtad()` en el servidor:
        // primero `perfiles`, y si ahí no hay, la metadata del proveedor
        // de login. Dos lecturas distintas del mismo dato darían dos
        // nombres distintos para la misma persona según por dónde entró.
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre")
          .eq("id", user.id)
          .maybeSingle();
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const nombre =
          [perfil?.nombre, meta.nombre, meta.full_name, meta.name].find(
            (v): v is string => typeof v === "string" && v.trim().length > 0,
          ) ?? null;
        if (vivo) setSesion({ logueado: true, nombre: nombre?.trim() ?? null });
      } catch {
        // Sin sesión legible se queda como está: «Ingresar». Es una
        // etiqueta de un nav, no vale tirar la página por ella.
      }
    })();
    return () => {
      vivo = false;
    };
  }, [loResuelveElServidor]);

  return sesion;
}

export default function NavLealtad(props: {
  /**
   * Si el servidor YA resolvió la sesión, la pasa acá. Sin esta prop el
   * componente la resuelve solo, en el navegador — ver `useSesionDelNav`.
   */
  logueado?: boolean;
  /** El nombre de la cuenta con sesión. null con sesión pero sin nombre
   *  cargado: entonces se cae a «Mi cuenta». */
  nombre?: string | null;
  /** Ocultar la barra al bajar y traerla de vuelta al subir. Opt-in
   *  (solo /lealtad/ayuda lo pide): en el resto de las landings la barra
   *  se queda fija como siempre. */
  autoOcultar?: boolean;
}) {
  const { logueado, nombre } = useSesionDelNav(props);
  const [abierto, setAbierto] = useState(false);
  const [abiertoCuenta, setAbiertoCuenta] = useState(false);

  /**
   * ── LA BURBUJA REACCIONA AL SCROLL ────────────────────────────────
   * Arriba del todo la burbuja es casi invisible: apenas un vidrio
   * sobre el héroe. Apenas el visitante baja, se opaca, saca borde y
   * levanta sombra — porque a partir de ahí flota sobre contenido y
   * necesita despegarse de él para seguir siendo legible.
   *
   * `{ passive: true }` NO es de trámite: sin eso el navegador tiene
   * que esperar a ver si el handler llama a `preventDefault()` antes de
   * dejar correr el scroll, y eso se siente como un tirón en el dedo.
   *
   * Se llama una vez a mano antes de suscribirse porque quien recarga a
   * media página ya arranca scrolleado: sin esa primera lectura, la
   * burbuja aparecería transparente encima del contenido hasta que la
   * persona moviera el dedo.
   */
  const [scrolleado, setScrolleado] = useState(false);
  useEffect(() => {
    const alScrollear = () => setScrolleado(window.scrollY > 16);
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  /**
   * ── OCULTAR AL BAJAR, MOSTRAR AL SUBIR (opt-in) ───────────────────
   * Solo cuando `autoOcultar` está prendido (lo pide /lealtad/ayuda).
   * Cerca del tope siempre visible; al bajar se esconde; al subir
   * reaparece — el patrón clásico. Umbral de 4px para no titilar con
   * micro-movimientos. `passive: true` por lo mismo que el efecto de
   * arriba: no bloquear el scroll.
   */
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    if (!props.autoOcultar) return;
    let ultimoY = window.scrollY;
    const alScrollear = () => {
      const y = window.scrollY;
      if (y < 120) setOculto(false);
      else if (y > ultimoY + 4) setOculto(true);
      else if (y < ultimoY - 4) setOculto(false);
      ultimoY = y;
    };
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, [props.autoOcultar]);
  // Pedido del dueño: que arriba se vea DE QUIÉN es la sesión. Con
  // nombre se muestra el nombre; sin él (sesión sin perfil cargado),
  // «Mi cuenta»; sin sesión, «Ingresar».
  const etiquetaCuenta = logueado ? nombre || "Mi cuenta" : "Ingresar";

  return (
    /**
     * ⚠️ `pointer-events-none` EN EL <header> NO ES OPCIONAL.
     *
     * El header dejó de ser una barra y pasó a ser un CARRIL
     * TRANSPARENTE de ancho completo con la burbuja adentro. Ese carril
     * sigue estando ahí aunque no se vea: sin esto, la franja invisible
     * a los costados de la burbuja se come cada clic de los primeros
     * ~76px de la página, y el visitante no puede tocar nada de lo que
     * ve debajo. Los hijos que sí se tocan lo vuelven a encender con
     * `pointer-events-auto`.
     */
    <header
      className={`pointer-events-none sticky top-0 z-50 px-3 pt-3 transition-transform duration-300 will-change-transform sm:px-5 sm:pt-4 ${
        oculto && !abierto ? "-translate-y-[130%]" : "translate-y-0"
      }`}
    >
      {/* LA BURBUJA. `rounded-full` de verdad (es una píldora, no una
          card), vidrio esmerilado siempre puesto, y el fondo/borde/
          sombra suben de intensidad al scrollear.

          Solo transiciona color, sombra y transform — que es
          exactamente lo que globals.css permite animar. Nada de ancho
          ni de alto: eso dispararía layout en cada scroll.

          `motion-reduce:` apaga el desplazamiento de 2px para quien
          pidió menos movimiento, pero DEJA el cambio de fondo y sombra:
          eso no es decoración, es lo que mantiene el texto legible
          sobre el contenido que pasa por debajo. */}
      <div
        className={`pointer-events-auto mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-4 rounded-full border px-5 backdrop-blur-xl transition-[background-color,border-color,box-shadow,transform] duration-300 sm:px-7 motion-reduce:transition-none ${
          scrolleado
            ? "-translate-y-0.5 border-aventurea-line bg-white/80 shadow-[0_18px_44px_-20px_rgba(16,38,88,.34)] motion-reduce:translate-y-0"
            : "translate-y-0 border-transparent bg-white/45 shadow-none"
        }`}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- mismo
              logo estático que site-header.tsx: next/image no aporta
              nada para un PNG de 4.2 KB que no cambia. */}
          <img
            src="/logo-bookea-nav-v4.png"
            alt="Bookea"
            width={440}
            height={138}
            className="h-7 w-auto shrink-0 sm:h-8"
          />
          <span className="hidden text-[13px] font-bold text-aventurea-ink-soft sm:inline">
            Lealtad
          </span>
        </Link>

        <nav
          aria-label="Secciones de la página"
          className="hidden items-center gap-7 lg:flex"
        >
          {ENLACES.map((e) => (
            <a
              key={e.href}
              href={e.href}
              className="text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              {e.label}
            </a>
          ))}
          {/* «Industrias» se despliega al pasar el mouse (pedido del
              dueño) — y también con foco de teclado (focus-within),
              porque un menú solo-hover deja afuera a quien navega con
              Tab. El pt-3 es el puente invisible entre el botón y el
              panel: sin él, el hover se corta al cruzar el espacio. */}
          <div className="group relative">
            <button
              type="button"
              aria-haspopup="true"
              className="flex items-center gap-1 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              Industrias
              <span
                aria-hidden
                className="text-[9px] transition-transform group-hover:rotate-180"
              >
                ▼
              </span>
            </button>
            <div className="invisible absolute left-1/2 top-full z-50 w-[230px] -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="rounded-2xl border border-aventurea-line bg-white p-2 shadow-[0_24px_60px_-24px_rgba(16,38,88,0.35)]">
                {INDUSTRIAS.map((i) => (
                  <Link
                    key={i.slug}
                    href={`/lealtad/industrias/${i.slug}`}
                    className="block rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:bg-[#f2f5fb]"
                  >
                    {i.nombre}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          {logueado ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAbiertoCuenta((v) => !v)}
                aria-haspopup="true"
                aria-expanded={abiertoCuenta}
                className="flex items-center gap-1.5 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-aventurea-navy text-[9.5px] font-extrabold text-white">
                  {nombre ? iniciales(nombre) : "✓"}
                </span>
                <span className="max-w-[150px] truncate">{etiquetaCuenta}</span>
                <span
                  aria-hidden
                  className={`text-[9px] transition-transform ${abiertoCuenta ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>

              {abiertoCuenta && (
                <>
                  <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={() => setAbiertoCuenta(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-2xl border border-aventurea-line bg-white p-1.5 shadow-[0_24px_60px_-24px_rgba(16,38,88,0.35)]">
                    {ITEMS_CUENTA.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setAbiertoCuenta(false)}
                        className="block whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold text-aventurea-ink hover:bg-[#f2f5fb]"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-aventurea-line" />
                    <form action={cerrarSesionLealtad}>
                      <button
                        type="submit"
                        className="block w-full whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold text-aventurea-ink hover:bg-[#f2f5fb]"
                      >
                        Cerrar sesión
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/lealtad/ingresar"
              className="flex items-center gap-1.5 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
            >
              <Icono nombre="perfil" className="h-4 w-4 shrink-0" />
              {etiquetaCuenta}
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="menu-lealtad"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-aventurea-line text-aventurea-navy lg:hidden"
        >
          <Icono nombre={abierto ? "cerrar" : "menu"} className="h-5 w-5" />
        </button>
      </div>

      {abierto && (
        /* El menú de móvil también se despega: era una franja pegada al
           borde inferior de la barra, y ahora esa barra no existe. Es
           una hoja flotante debajo de la burbuja, con el mismo ancho.
           Fondo casi sólido —no translúcido como la burbuja— porque acá
           hay una lista de enlaces que tiene que leerse sí o sí sobre
           cualquier cosa que pase por detrás. */
        <div
          id="menu-lealtad"
          className="pointer-events-auto mx-auto mt-2 w-full max-w-[1180px] rounded-3xl border border-aventurea-line bg-white/95 px-5 py-5 shadow-[0_24px_60px_-24px_rgba(16,38,88,.35)] backdrop-blur-xl lg:hidden"
        >
          <nav
            className="flex flex-col gap-4"
            aria-label="Secciones de la página"
          >
            {ENLACES.map((e) => (
              <a
                key={e.href}
                href={e.href}
                onClick={() => setAbierto(false)}
                className="text-[15px] font-bold text-aventurea-ink"
              >
                {e.label}
              </a>
            ))}
            <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-aventurea-ink-soft">
              Industrias
            </p>
            {INDUSTRIAS.map((i) => (
              <Link
                key={i.slug}
                href={`/lealtad/industrias/${i.slug}`}
                onClick={() => setAbierto(false)}
                className="pl-3 text-[14px] font-bold text-aventurea-ink"
              >
                {i.nombre}
              </Link>
            ))}
            {logueado ? (
              <>
                <div className="mt-1 flex items-center gap-2 text-[15px] font-bold text-aventurea-ink">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-aventurea-navy text-[9.5px] font-extrabold text-white">
                    {nombre ? iniciales(nombre) : "✓"}
                  </span>
                  <span className="truncate">{etiquetaCuenta}</span>
                </div>
                {ITEMS_CUENTA.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAbierto(false)}
                    className="pl-3 text-[14px] font-bold text-aventurea-ink"
                  >
                    {item.label}
                  </Link>
                ))}
                <form action={cerrarSesionLealtad}>
                  <button type="submit" className="pl-3 text-[14px] font-bold text-aventurea-ink">
                    Cerrar sesión
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/lealtad/ingresar"
                onClick={() => setAbierto(false)}
                className="flex items-center gap-2 text-[15px] font-bold text-aventurea-ink"
              >
                <Icono nombre="perfil" className="h-4 w-4 shrink-0" />
                {etiquetaCuenta}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
