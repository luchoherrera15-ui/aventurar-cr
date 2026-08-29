"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
} from "react";
import Link from "next/link";
import { Card, CardVacia } from "@/components/panel/piezas";
import {
  CAMPO_PANEL,
  CUERPO_SUAVE,
  ESTADO_AVISO,
  RADIO_TILE,
  ROTULO_CAMPO,
} from "@/components/panel/sistema";
import { iniciales } from "@/lib/iniciales";
import {
  ACCION,
  ACCION_BORDE,
  ACCION_TINTA,
  ACCION_TINTE,
  BOTON_ACCION,
  BOTON_LEALTAD,
} from "../sistema-lealtad";
import Medidor from "./medidor";
import SelectorUbicacion from "@/components/selector-ubicacion";
import {
  agregarUbicacion,
  eliminarUbicacion,
  type UbicacionFila,
} from "./ubicaciones-actions";

/**
 * GEO-PUSH — la sección «Ubicación» del panel (0196).
 *
 * El dueño registra sus puntos (lat/lng + mensaje) y el pase de Apple
 * los lleva en `locations`: el iPhone muestra el mensaje en la
 * pantalla bloqueada al pasar cerca. El radio (~100 m) lo fija iOS, no
 * nosotros, y la pantalla lo dice así — prometer un radio configurable
 * sería vender lo que no existe. Lo mismo con Android: `google.ts` no
 * escribe ubicaciones en el objeto, y acá se dice tal cual.
 *
 * Los topes (el del paquete y el techo de 10 de Apple) los hace
 * cumplir el servidor (`ubicaciones-actions.ts`); esta pantalla los
 * PINTA para que el dueño no choque contra un botón que iba a fallar.
 */

/** El techo de Apple; el mismo número que remacha la 0196. */
const TOPE_APPLE = 10;
const TOPE_NOMBRE = 80;
const TOPE_MENSAJE = 120;

export default function SeccionUbicaciones({
  ranchoId,
  negocioNombre,
  iniciales: filasIniciales,
  topePlan,
  planNombre,
}: {
  ranchoId: string;
  negocioNombre: string;
  /** null = la tabla no existe todavía (la 0196 se aplica aparte). */
  iniciales: UbicacionFila[] | null;
  /** El tope del paquete (planes.ts). null = sin tope declarado. */
  topePlan: number | null;
  planNombre: string | null;
}) {
  const [lista, setLista] = useState<UbicacionFila[]>(filasIniciales ?? []);
  const [nombre, setNombre] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  // ── La tabla todavía no existe: aviso neutro y el panel sigue ─────
  // Mismo criterio degradable del resto del módulo (errores-base.ts):
  // la migración la aplica Bookea aparte, y mientras tanto esta
  // sección no puede tumbar nada ni prometer que guarda.
  if (filasIniciales === null) {
    return (
      <CardVacia>
        Las ubicaciones todavía no están disponibles en tu panel. El equipo de Bookea las está
        habilitando — el resto del panel funciona igual que siempre.
      </CardVacia>
    );
  }

  // ── El paquete no incluye Geo-Push: se MUESTRA bloqueado ─────────
  // Decisión del dueño (ago 2026): Geo-Push arranca en Impulso, y a
  // quien no lo tiene no se le esconde la función — se le enseña
  // detrás de un velo con la invitación a cambiar de suscripción. Ver
  // algo que no se puede usar vende; no ver nada, no.
  //
  // El velo es cosmético: el servidor rechaza igual cualquier alta con
  // tope 0 (`ubicaciones-actions.ts`), así que apagar el CSS desde el
  // navegador no habilita nada.
  if (topePlan === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl">
        <div aria-hidden className="pointer-events-none select-none opacity-40 blur-[2px]">
          <VistaPreviaBloqueada negocioNombre={negocioNombre} />
        </div>
        <div className="absolute inset-0 grid place-items-center bg-[rgba(10,18,38,0.55)] px-5 text-center backdrop-blur-[1px]">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">
              Geo-Push
            </p>
            <p className="titulo mt-1.5 text-[19px] leading-snug text-white">
              Cambiá tu suscripción para activar esta función
            </p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-white/75">
              Con el paquete Impulso registrás tus puntos y el pase de tus clientes les avisa
              en la pantalla bloqueada cuando pasan cerca de tu local.
              {planNombre ? ` Tu paquete actual es ${planNombre}.` : ""}
            </p>
            <Link
              href={`/lealtad/planes?negocio=${ranchoId}`}
              className="presionable mt-4 inline-block rounded-full px-6 py-2.5 text-[13px] font-extrabold"
              style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
            >
              Ver paquetes →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Sin tope declarado (plan desconocido) manda solo el techo de
  // Apple — la misma doctrina que `estadoDelLimite`: no se castiga al
  // negocio por un plan que el catálogo no conoce.
  const tope = Math.min(topePlan ?? TOPE_APPLE, TOPE_APPLE);
  const lleno = lista.length >= tope;

  /**
   * «9,93» tecleado con coma decimal también vale — pero solo UNA coma
   * con dígitos a ambos lados, para no confundirla con el par
   * «lat, lng» que se maneja aparte en `alEscribirLatitud`.
   */
  function numeroDe(texto: string): number {
    const limpio = texto.trim();
    if (limpio === "") return NaN;
    const coma = limpio.match(/^(-?\d+),(\d+)$/);
    if (coma) return Number(`${coma[1]}.${coma[2]}`);
    return Number(limpio);
  }

  /**
   * Google Maps copia las coordenadas como UN texto («9.93340,
   * -84.08330»). Si eso cae entero en el campo de latitud, se reparte
   * solo en los dos campos — es exactamente lo que la ayuda de abajo
   * manda a hacer, así que pegarlo tiene que funcionar.
   */
  function alEscribirLatitud(valor: string) {
    const par = valor.match(/^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
    if (par) {
      setLatitud(par[1]);
      setLongitud(par[2]);
      return;
    }
    setLatitud(valor);
  }

  const lat = numeroDe(latitud);
  const lng = numeroDe(longitud);
  const formularioValido =
    nombre.trim().length > 0 &&
    nombre.trim().length <= TOPE_NOMBRE &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    mensaje.trim().length > 0 &&
    mensaje.trim().length <= TOPE_MENSAJE;

  function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const res = await agregarUbicacion(ranchoId, {
        nombre: nombre.trim(),
        latitud: lat,
        longitud: lng,
        mensaje: mensaje.trim(),
      });
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setLista(res.datos);
      setNombre("");
      setLatitud("");
      setLongitud("");
      setMensaje("");
      setAviso(
        "Ubicación guardada. Los pases ya instalados se actualizan solos — puede tardar unos minutos.",
      );
    });
  }

  function eliminar(id: string) {
    setError(null);
    setAviso(null);
    setConfirmando(null);
    iniciar(async () => {
      const res = await eliminarUbicacion(ranchoId, id);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setLista(res.datos);
      setAviso("Ubicación eliminada. Los pases ya instalados se actualizan solos.");
    });
  }

  // Lo que muestra la vista previa: lo que se está escribiendo, o la
  // primera ubicación guardada, o un ejemplo honesto (dice «Ejemplo»).
  const mensajeVista = mensaje.trim() || lista[0]?.mensaje || null;

  return (
    <>
      {/* ── El tope del paquete, con el medidor del panel ─────────── */}
      <Card eyebrow="Tu paquete" titulo="Ubicaciones con Geo-Push" nivel="h3">
        <p className={CUERPO_SUAVE}>
          En tu paquete{planNombre ? ` (${planNombre})` : ""}:{" "}
          <strong className="font-extrabold text-aventurea-ink">
            {tope} {tope === 1 ? "ubicación" : "ubicaciones"}
          </strong>
          . Apple Wallet acepta 10 por pase como máximo — ese techo no es nuestro, es de iOS.
        </p>
        <div className="mt-3">
          <Medidor
            icono="ubicacion"
            etiqueta="Ubicaciones registradas"
            usado={lista.length}
            tope={tope}
            alerta={lleno}
            aviso={lista.length >= tope * 0.8}
          />
        </div>
        {lleno && (
          <p className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}>
            {tope >= TOPE_APPLE
              ? "Llegaste al máximo de Apple (10). Para agregar otra, eliminá una primero."
              : "Llegaste al tope de tu paquete. Para registrar más ubicaciones, subí de paquete en «Plan y facturación»."}
          </p>
        )}
      </Card>

      {/* ── Las registradas ───────────────────────────────────────── */}
      <Card eyebrow="Dónde te encuentran" titulo="Tus ubicaciones" nivel="h3">
        {lista.length === 0 ? (
          <p className={CUERPO_SUAVE}>
            Todavía no registraste ninguna. Con la primera, el pase de tus clientes empieza a
            aparecer solo en la pantalla bloqueada cuando pasan cerca.
          </p>
        ) : (
          <ul className="flex flex-col">
            {lista.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-aventurea-line py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-extrabold leading-tight text-aventurea-ink">
                    {u.nombre}
                  </p>
                  <p className={`mt-0.5 ${CUERPO_SUAVE}`}>
                    {u.latitud.toFixed(5)}, {u.longitud.toFixed(5)}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-aventurea-ink">
                    «{u.mensaje}»
                  </p>
                </div>
                {confirmando === u.id ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] font-bold text-aventurea-ink">¿Eliminarla?</span>
                    <button
                      type="button"
                      onClick={() => eliminar(u.id)}
                      disabled={ocupado}
                      className={BOTON_LEALTAD}
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className={BOTON_LEALTAD}
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(u.id)}
                    disabled={ocupado}
                    aria-label={`Eliminar la ubicación ${u.nombre}`}
                    className={`${BOTON_LEALTAD} shrink-0`}
                  >
                    Eliminar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Alta + vista previa, lado a lado en pantallas anchas ──── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card eyebrow="Punto nuevo" titulo="Añadí una ubicación" nivel="h3">
          <form onSubmit={agregar} className="flex flex-col gap-3">
            <div>
              <label htmlFor="ubic-nombre" className={ROTULO_CAMPO}>
                Nombre del punto
              </label>
              <input
                id="ubic-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={TOPE_NOMBRE}
                placeholder="Local de Escazú"
                className={`mt-1 ${CAMPO_PANEL}`}
              />
            </div>

            {/* ── EL MAPA (pedido del dueño, 28 ago 2026: «que haya un
                mapa y uno pueda buscar y colocar un PIN») ─────────────
                El MISMO selector del editar de mi-negocio, ahora con
                buscador. El pin llena los campos de abajo; pegar las
                coordenadas a mano sigue funcionando como atajo. */}
            <div>
              <span className={ROTULO_CAMPO}>Buscá tu local y poné el pin</span>
              <div className="mt-1">
                <MapaCuandoSeVe
                  latitudInicial={null}
                  longitudInicial={null}
                  claseCampo={CAMPO_PANEL}
                  claseBoton={`${BOTON_LEALTAD} shrink-0`}
                  alCambiar={(p) => {
                    if (p) {
                      setLatitud(p.lat.toFixed(6));
                      setLongitud(p.lng.toFixed(6));
                    } else {
                      setLatitud("");
                      setLongitud("");
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ubic-lat" className={ROTULO_CAMPO}>
                  Latitud
                </label>
                <input
                  id="ubic-lat"
                  type="text"
                  inputMode="decimal"
                  value={latitud}
                  onChange={(e) => alEscribirLatitud(e.target.value)}
                  placeholder="9.93340"
                  className={`mt-1 ${CAMPO_PANEL}`}
                />
              </div>
              <div>
                <label htmlFor="ubic-lng" className={ROTULO_CAMPO}>
                  Longitud
                </label>
                <input
                  id="ubic-lng"
                  type="text"
                  inputMode="decimal"
                  value={longitud}
                  onChange={(e) => setLongitud(e.target.value)}
                  placeholder="-84.08330"
                  className={`mt-1 ${CAMPO_PANEL}`}
                />
              </div>
            </div>

            {/* La ayuda honesta: de dónde se sacan las coordenadas.
                Pegar el par entero en «Latitud» también funciona —
                `alEscribirLatitud` lo reparte en los dos campos. */}
            <p className={`${RADIO_TILE} border px-3 py-2.5 text-[12px] leading-snug text-aventurea-ink`}
              style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
            >
              El mapa llena estos campos solo. ¿Preferís Google Maps? Clic
              derecho sobre tu local → tocá las coordenadas para copiarlas y
              pegalas en «Latitud»: se acomodan solas.
            </p>

            <div>
              <label htmlFor="ubic-mensaje" className={ROTULO_CAMPO}>
                Mensaje que ve tu cliente al pasar cerca
              </label>
              <input
                id="ubic-mensaje"
                type="text"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                maxLength={TOPE_MENSAJE}
                placeholder="¡Estás cerca! Pasá por tu sello de hoy"
                className={`mt-1 ${CAMPO_PANEL}`}
              />
              <p className="mt-1 text-right text-[10.5px] text-aventurea-ink-soft">
                {mensaje.length}/{TOPE_MENSAJE}
              </p>
            </div>

            <button
              type="submit"
              disabled={ocupado || lleno || !formularioValido}
              className={BOTON_ACCION}
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              {ocupado ? "Guardando…" : "Añadir la ubicación"}
            </button>

            {error && (
              <p
                role="alert"
                className={`${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.alerta}`}
              >
                {error}
              </p>
            )}
            {aviso && (
              <p className={`${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.exito}`}>
                {aviso}
              </p>
            )}
          </form>
        </Card>

        {/* ── La vista previa: cómo se ve en la pantalla bloqueada ── */}
        <Card eyebrow="Así se ve" titulo="En el iPhone" nivel="h3">
          <div
            aria-hidden
            className="mx-auto w-full max-w-[250px] rounded-[2rem] border border-white/15 bg-gradient-to-b from-[#101a33] to-[#070d1c] px-4 pb-8 pt-6"
          >
            <p className="text-center text-[11px] font-bold text-white/60">miércoles 20 de agosto</p>
            <p className="mt-0.5 text-center text-[34px] font-extrabold leading-none text-white">
              9:41
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
              <div className="flex items-start gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold"
                  style={{ background: ACCION_TINTE, color: ACCION }}
                >
                  {iniciales(negocioNombre) || "B"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-extrabold text-white">
                    {negocioNombre}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-white/85">
                    {mensajeVista ?? "Ejemplo: ¡Estás cerca! Pasá por tu sello de hoy"}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <p className={`mt-3 ${CUERPO_SUAVE}`}>
            Geo-Push está disponible solo en iPhone (Apple Wallet), en un radio de ~100 m que fija
            iOS. En Android (Google Wallet) este aviso no aparece.
          </p>
        </Card>
      </div>
    </>
  );
}

/**
 * EL MAPA, SOLO CUANDO SE VE.
 *
 * `SelectorUbicacion` baja Leaflet (~145 KB + su CSS) y pide tiles de
 * OpenStreetMap apenas se MONTA — el `import()` vive en su efecto de
 * montaje. Y este panel monta TODO de entrada: el shell deja cada
 * sección montada y escondida con `hidden` (shell-lealtad.tsx), y
 * `TabsContenido` hace lo mismo con sus pestañas. Resultado: cada
 * visita al panel descargaba un mapa que casi nadie abría — la
 * sección vive en Configuración → Ubicación, a dos toques de
 * distancia.
 *
 * El gate es un IntersectionObserver y no un prop de «sección activa»
 * a propósito: el ocultamiento acá es DOBLE (la sección del shell Y la
 * pestaña del tab), y `display: none` en cualquier ancestro hace que
 * el observer reporte «no interseca». O sea que un solo observer cubre
 * los dos niveles sin cablear el estado del shell y del tab hasta acá
 * — y de yapa, montar el mapa recién cuando su caja tiene tamaño real
 * evita el clásico mapa gris de Leaflet inicializado en un contenedor
 * de 0×0.
 *
 * Una vez visible, se monta y NO se desmonta más: el pin puesto y la
 * búsqueda escrita sobreviven a cambiar de pestaña, exactamente igual
 * que antes de este gate. El formulario de lat/lng de al lado nunca
 * dependió del mapa — pegar coordenadas a mano siguió funcionando
 * incluso mientras el mapa no existía.
 */
function MapaCuandoSeVe(props: ComponentProps<typeof SelectorUbicacion>) {
  const marco = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = marco.current;
    if (!el) return;
    // Sin IntersectionObserver (navegador viejísimo) se monta igual,
    // en el próximo tick: quedarse sin mapa sería peor que descargarlo
    // de más. En un timeout y no en línea porque un setState sincrónico
    // dentro del cuerpo del efecto encadena renders (lo marca el
    // compilador de React).
    if (typeof IntersectionObserver === "undefined") {
      const idTimer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(idTimer);
    }
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setVisible(true);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [visible]);

  return (
    <div ref={marco}>
      {visible ? (
        <SelectorUbicacion {...props} />
      ) : (
        /* El hueco del mapa, con su mismo fondo y su misma altura
           aproximada (buscador + mapa + fila de abajo): el observer
           dispara en el frame en que la pestaña se abre, así que esto
           vive un parpadeo — pero si viviera más, que no salte nada. */
        <div
          aria-hidden
          className="h-[340px] w-full rounded-xl border border-aventurea-line"
          style={{ background: "#e8ecf6" }}
        />
      )}
    </div>
  );
}

/**
 * Lo que se ve DETRÁS del velo cuando el paquete no incluye Geo-Push:
 * el mismo teléfono de la vista previa, con un ejemplo fijo. Es una
 * muestra de lo que el negocio se está perdiendo — por eso vale la
 * pena dibujarlo en vez de dejar un cuadro gris.
 */
function VistaPreviaBloqueada({ negocioNombre }: { negocioNombre: string }) {
  return (
    <Card>
      <p className={ROTULO_CAMPO}>Así se ve</p>
      <p className="mt-0.5 text-[15px] font-extrabold text-white">En el iPhone</p>
      <div className={`mt-3 ${RADIO_TILE} border border-white/10 bg-[#0b1220] px-4 py-5`}>
        <p className="text-center text-[11px] text-white/60">miércoles 20 de agosto</p>
        <p className="text-center text-[30px] font-extrabold leading-tight text-white">9:41</p>
        <div className={`mt-3 flex items-start gap-2.5 ${RADIO_TILE} bg-white/10 px-3 py-2.5`}>
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold"
            style={{ background: ACCION_TINTE, color: ACCION }}
          >
            {iniciales(negocioNombre) || "B"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-extrabold text-white">
              {negocioNombre}
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-white/85">
              Ejemplo: ¡Estás cerca! Pasá por tu sello de hoy
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}
