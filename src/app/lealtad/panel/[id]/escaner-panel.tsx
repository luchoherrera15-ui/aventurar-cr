"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { leerMontoColones, llaveDeIntento, textosDelTipo, unidadDe } from "@/lib/lealtad/mostrador";
import type { ProductoDeVenta } from "@/lib/lealtad/productos";
import { ACCION, ACCION_TINTA, BOTON_ACCION, BOTON_LEALTAD } from "../sistema-lealtad";
import { sumarSelloEscaneado, type ResultadoEscaneo } from "./escaner-actions";
import { canjearRecompensa } from "./lealtad-operar-actions";
import SelectorProducto from "./selector-producto";

/** El lado más largo del cuadro que se decodifica. Un QR en la pantalla
 *  de un teléfono se lee de sobra a esta escala. */
const LADO_MAX = 640;

/** Tope de lecturas por segundo: más que esto es hilo quemado. */
const LECTURAS_POR_SEGUNDO = 12;

/** El lector del sistema operativo, cuando el navegador lo trae. */
type LectorNativo = { detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]> };
type VentanaConLector = {
  BarcodeDetector?: new (opciones: { formats: string[] }) => LectorNativo;
};

/**
 * Escanear la tarjeta del cliente para sumarle un sello.
 *
 * El QR del pase lleva el `serial_number`.
 *
 * ── CÓMO SE LEE, Y POR QUÉ POR DOS CAMINOS (8 sep 2026) ─────────────
 * El dueño reportó que «los QR no se están leyendo tan rápido». Lo
 * eran: cada cuadro de la cámara se decodificaba ENTERO —a la
 * resolución que diera el aparato, hasta 1920×1080— con jsQR, que es
 * JavaScript puro y corre en el mismo hilo que dibuja la pantalla. Dos
 * millones de píxeles por cuadro, sesenta veces por segundo: el hilo no
 * daba abasto, la vista previa se trababa y el código tardaba en caer.
 *
 * Ahora:
 *   · si el navegador trae `BarcodeDetector` (Chrome y Edge en Android,
 *     que es lo que hay en casi todo mostrador), lo lee el sistema
 *     operativo, fuera del hilo de la pantalla y con años de trabajo
 *     encima que jsQR no puede igualar;
 *   · si no —Safari, iPhone—, sigue jsQR, pero sobre un cuadro ACHICADO
 *     a 640 px de lado: escalar lo hace la GPU en `drawImage` y un QR de
 *     la pantalla de un teléfono se lee igual de bien con la cuarta
 *     parte de los píxeles;
 *   · y en los dos casos se lee un máximo de doce veces por segundo. El
 *     resto del tiempo el hilo queda libre para pintar la cámara, que
 *     es lo que hace que apuntar se sienta rápido.
 *
 * jsQR NO se saca: es el único camino en iPhone, y sigue siendo el que
 * responde si el lector nativo falla.
 *
 * La cámara se pide SOLO al tocar el botón. Pedirla al montar hace que
 * el navegador muestre el permiso apenas se abre la pestaña, que es la
 * forma más rápida de que alguien lo niegue para siempre.
 *
 * ------------------------------------------------------------------
 * UNA PANTALLA, UN CLIENTE A LA VEZ
 * ------------------------------------------------------------------
 * Este componente atiende a UNA PERSONA y después a la siguiente, y esa
 * es la regla que gobierna su estado. Lo que se sabe del cliente que
 * está enfrente —el resultado del escaneo, el canje, el monto de su
 * compra, el error de la vez pasada— muere junto con su turno.
 *
 * No era así, y costaba caro: `encender()` limpiaba `error` y
 * `resultado` pero NUNCA `canje`, y el botón de canjear estaba
 * condicionado a `!canje`. O sea que después del primer canje del día
 * —o del primer canje FALLIDO— el botón no volvía a aparecer NUNCA, y
 * en pantalla se quedaba la caja verde «Canje hecho: <premio del
 * cliente anterior>» con su SKU debajo del resultado del cliente nuevo.
 * La única salida era recargar la página.
 *
 * `limpiarTurno()` es la respuesta: una sola función que borra TODO lo
 * del cliente anterior, llamada en los dos lugares donde empieza un
 * turno nuevo (al abrir la cámara y al mandar un escaneo). Agregar
 * estado nuevo del cliente sin sumarlo ahí es volver a este bug.
 */
export default function EscanerPanel({
  ranchoId,
  pideMonto = false,
  recompensa = null,
  productos = [],
}: {
  ranchoId: string;
  /**
   * true en puntos/cashback/giftcard (el monto cambia lo acreditado) y
   * en SELLOS desde la 0197 (la compra queda registrada, y si la
   * tarjeta tiene la regla «por monto», el monto decide los sellos).
   * Los dos campos —monto y producto— son opcionales: escanear sin
   * teclear nada sigue funcionando como siempre.
   */
  pideMonto?: boolean;
  /** La meta actual, para ofrecer el canje apenas el saldo alcance. */
  recompensa?: { id: string; nombre: string; costo: number } | null;
  /**
   * El catálogo ACTIVO del negocio (0198). Vacío = no hay catálogo, y
   * entonces el desplegable ni se dibuja: el mostrador queda
   * exactamente como antes, con el monto a mano. Cero regresión.
   */
  productos?: ProductoDeVenta[];
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const buscando = useRef(false);

  /**
   * LA LLAVE DE ESTE INTENTO — quién dedupe a quién.
   *
   * Vive en un ref y no en el estado porque no pinta nada, y sobre todo
   * porque tiene que sobrevivir a los renders del turno.
   *
   * La regla, entera:
   *   · se genera cuando se lee una tarjeta DISTINTA a la anterior;
   *   · se CONSERVA si el intento anterior falló o no se supo su
   *     suerte — un reintento por señal mala manda la misma llave y el
   *     unique del ledger lo rebota, así que no hay sello doble;
   *   · se BORRA cuando el sello entró — la siguiente lectura de la
   *     misma tarjeta es otra venta y tiene que sumar.
   */
  const intento = useRef<{ serial: string; id: string } | null>(null);

  /** El lector nativo, si este navegador lo tiene. null = jsQR. */
  const lector = useRef<LectorNativo | null>(null);
  /** Cuándo se decodificó por última vez, para no pasarse del tope. */
  const ultimaLectura = useRef(0);

  const [activo, setActivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEscaneo | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [monto, setMonto] = useState("");
  const [producto, setProducto] = useState("");
  /** El producto del catálogo elegido (0198). null = venta a mano. */
  const [productoId, setProductoId] = useState<string | null>(null);
  const [avisoMonto, setAvisoMonto] = useState<string | null>(null);
  const [canje, setCanje] = useState<
    | { fase: "hecho"; nombre: string; sku: string | null; instrucciones: string | null }
    | { fase: "error"; motivo: string }
    | null
  >(null);

  const apagar = useCallback(() => {
    buscando.current = false;
    // Sin esto la luz de la cámara queda encendida aunque se cierre la
    // sección: el navegador no libera el dispositivo solo.
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
    setActivo(false);
  }, []);

  // Apagar al desmontar. Es el caso que se olvida y el que más molesta:
  // el usuario cambia de pestaña y la cámara sigue prendida.
  useEffect(() => apagar, [apagar]);

  /**
   * Empieza un turno nuevo: nada de la persona anterior sobrevive.
   *
   * El `monto` NO se limpia acá, y es a propósito: se limpia al
   * ACREDITAR (ver `canjear`). Si se borrara al abrir la cámara, el
   * empleado que teclea la compra y después toca «Abrir cámara»
   * perdería lo que acaba de escribir.
   */
  function limpiarTurno() {
    setError(null);
    setResultado(null);
    setCanje(null);
    setAvisoMonto(null);
  }

  async function encender() {
    // El monto se revisa ANTES de abrir la cámara: enterarse de que
    // estaba mal escrito después de apuntar al teléfono del cliente es
    // enterarse tarde.
    if (pideMonto) {
      const lectura = leerMontoColones(monto);
      if (!lectura.ok) {
        setAvisoMonto(lectura.motivo);
        return;
      }
    }
    limpiarTurno();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no da acceso a la cámara. Probá con Chrome o Safari.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // `environment` = cámara trasera, que es con la que se apunta a
        // un teléfono ajeno. En una laptop cae a la única que haya.
        video: { facingMode: "environment" },
        audio: false,
      });
      // El lector nativo se arma acá y no al montar: construirlo abre
      // el servicio de códigos del sistema, y no hay por qué hacerlo
      // hasta que alguien vaya a escanear de verdad.
      if (lector.current === null) {
        const Lector = (window as unknown as VentanaConLector).BarcodeDetector;
        try {
          lector.current = Lector ? new Lector({ formats: ["qr_code"] }) : null;
        } catch {
          // El navegador lo anuncia pero no sabe leer QR: jsQR.
          lector.current = null;
        }
      }

      flujo.current = stream;
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play();
      }
      setActivo(true);
      buscando.current = true;
      requestAnimationFrame(leer);
    } catch (e) {
      // Los mensajes del navegador vienen en inglés y son crípticos;
      // los tres casos que de verdad pasan se traducen.
      const nombre = e instanceof DOMException ? e.name : "";
      if (nombre === "NotAllowedError") {
        setError(
          "Le negaste el permiso de cámara a esta página. Habilitalo en los ajustes del navegador y volvé a intentar.",
        );
      } else if (nombre === "NotFoundError") {
        setError("Este dispositivo no tiene cámara.");
      } else {
        setError("No se pudo abrir la cámara. Revisá que ninguna otra app la esté usando.");
      }
    }
  }

  /** `ahora` lo pasa `requestAnimationFrame`: milisegundos desde que se
   *  abrió la página. Se usa para el tope de lecturas por segundo. */
  async function leer(ahora: number) {
    if (!buscando.current) return;

    const v = video.current;
    const c = lienzo.current;
    if (!v || !c || v.readyState !== v.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(leer);
      return;
    }

    // El tope de lecturas por segundo. Sin esto se decodifica en cada
    // cuadro y el hilo que decodifica es el mismo que pinta la cámara:
    // apuntar se siente lento justo por intentar leer de más.
    if (ahora - ultimaLectura.current < 1000 / LECTURAS_POR_SEGUNDO) {
      requestAnimationFrame(leer);
      return;
    }
    ultimaLectura.current = ahora;

    let dato: string | null = null;

    if (lector.current) {
      // Camino nativo: se le pasa el VIDEO, sin copiar nada al lienzo.
      try {
        const [codigo] = await lector.current.detect(v);
        dato = codigo?.rawValue ?? null;
      } catch {
        // Falló el lector del sistema: de acá en adelante, jsQR.
        lector.current = null;
      }
    } else {
      // Camino jsQR: el cuadro se ACHICA antes de decodificar. El
      // escalado lo hace la GPU dentro de `drawImage`; lo caro es
      // recorrer los píxeles en JavaScript, y así son cuatro veces
      // menos.
      const escala = Math.min(1, LADO_MAX / Math.max(v.videoWidth, v.videoHeight, 1));
      c.width = Math.max(1, Math.round(v.videoWidth * escala));
      c.height = Math.max(1, Math.round(v.videoHeight * escala));
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(v, 0, 0, c.width, c.height);
      const imagen = ctx.getImageData(0, 0, c.width, c.height);
      dato =
        jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: "dontInvert" })?.data ??
        null;
    }

    if (!buscando.current) return; // se apagó mientras se decodificaba

    if (!dato) {
      requestAnimationFrame(leer);
      return;
    }

    // Se para el bucle en el primer acierto. Es cortesía, no garantía:
    // la cámara lee unas diez veces por segundo y sin esto se dispararían
    // diez peticiones. Lo que de verdad impide el sello doble es la
    // referencia por minuto del servidor.
    buscando.current = false;
    canjear(dato);
  }

  function confirmarCanje() {
    if (!resultado?.ok || !recompensa) return;
    setProcesando(true);
    setCanje(null);
    canjearRecompensa(ranchoId, resultado.miembroId, recompensa.id)
      .then((res) => {
        if (res.ok) {
          setCanje({
            fase: "hecho",
            nombre: res.recompensa,
            sku: res.sku,
            instrucciones: res.instrucciones,
          });
          // El saldo mostrado baja al del canje.
          setResultado({ ...resultado, saldo: res.saldo });
        } else {
          setCanje({ fase: "error", motivo: res.motivo });
        }
      })
      .catch(() => setCanje({ fase: "error", motivo: "No se pudo canjear. Probá de nuevo." }))
      .finally(() => setProcesando(false));
  }

  function canjear(serial: string) {
    // Segundo lugar donde empieza un turno: el escaneo. Sin esto, el
    // «Canje hecho» del cliente anterior seguía en pantalla debajo del
    // resultado del cliente nuevo.
    limpiarTurno();

    const lectura = leerMontoColones(pideMonto ? monto : "");
    if (!lectura.ok) {
      setAvisoMonto(lectura.motivo);
      apagar();
      return;
    }

    if (!intento.current || intento.current.serial !== serial) {
      intento.current = { serial, id: llaveDeIntento() };
    }

    setProcesando(true);
    mandarSello(serial, lectura.monto, 0);
  }

  /**
   * El viaje al servidor, con UN reintento automático.
   *
   * ── POR QUÉ (8 sep 2026) ────────────────────────────────────────
   * El dueño reportó que al escanear «salía un error y que se intentara
   * después». Ese texto es el `catch` de acá: el server action no
   * llegó a contestar. En un mostrador eso pasa por lo de siempre —el
   * wifi del local, los datos del teléfono— y también por algo nuestro:
   * cuando se publica una versión nueva, las páginas que quedaron
   * abiertas apuntan a acciones que ya no existen en el servidor.
   *
   * Un reintento solo no arregla el segundo caso (para eso hay que
   * recargar, y el mensaje ahora lo dice), pero sí el primero, que es
   * el que pasa todos los días. Y es SEGURO: la llave del intento se
   * conserva mientras no se sepa el resultado, así que si el primer
   * viaje sí había escrito, el segundo rebota contra el único del
   * ledger y el cliente no recibe dos sellos.
   */
  function mandarSello(serial: string, montoCompra: number | null, vuelta: number) {
    sumarSelloEscaneado(
      ranchoId,
      serial,
      montoCompra,
      intento.current?.id,
      producto || null,
      productoId,
    )
      .then((res) => {
        setResultado(res);
        // LA REGLA: la llave sobrevive SOLO mientras el resultado sea
        // desconocido. Si el servidor contestó —entró, ya estaba, o lo
        // rechazó— este intento está cerrado y el próximo escaneo lleva
        // llave nueva.
        //
        // Conservarla también en `yaEstaba` sería una trampa: esa
        // respuesta PRUEBA que la llave ya se usó, así que reintentar
        // con ella devolvería «ya estaba» para siempre y el cliente
        // nunca podría recibir su segundo sello.
        intento.current = null;
        if (res.ok && !res.yaEstaba) {
          // EL MONTO NO SE HEREDA. Acreditada la compra, el campo queda
          // vacío: sin esto, al cliente siguiente se le acreditaba la
          // compra del anterior con solo volver a escanear. El producto
          // —tecleado o elegido del catálogo— sigue la misma regla.
          setMonto("");
          setProducto("");
          setProductoId(null);
        }
        apagar();
        setProcesando(false);
      })
      // La llave SÍ se conserva: no se sabe si el servidor llegó a
      // escribir. Reintentar con la misma es lo único que garantiza que
      // el cliente no reciba dos sellos por una compra.
      .catch(() => {
        if (vuelta === 0) {
          // Medio segundo: lo que tarda un mostrador en recuperar la
          // señal, y poco como para que nadie alcance a tocar nada.
          setTimeout(() => mandarSello(serial, montoCompra, 1), 500);
          return;
        }
        setError(
          "No se pudo registrar el sello. Revisá la conexión y volvé a escanear; si sigue fallando, recargá la página.",
        );
        setProcesando(false);
      });
  }

  /** Cerrar el turno a mano: deja la pantalla lista para el siguiente. */
  function siguienteCliente() {
    limpiarTurno();
    setMonto("");
    setProducto("");
    setProductoId(null);
  }

  /**
   * Se eligió del catálogo (0198): el monto se rellena con el precio y
   * el nombre viaja como concepto. Los dos quedan EDITABLES — el precio
   * es una propuesta, no un candado: una venta puede llevar dos cafés y
   * el empleado tiene que poder corregirlo con el cliente enfrente.
   */
  function elegirProducto(p: ProductoDeVenta | null) {
    setProductoId(p?.id ?? null);
    setAvisoMonto(null);
    if (!p) return;
    setMonto(String(p.precio));
    setProducto(p.nombre);
  }

  // Las palabras del mostrador salen del TIPO de la tarjeta que se
  // acaba de leer (viene en el resultado, no en las props): a un cupón
  // no se le dice «¡Sello sumado!» ni se le pinta un contador.
  const textos = resultado?.ok ? textosDelTipo(resultado.tipo) : null;

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      {/* «Escanear la tarjeta» y no «Sumar un sello»: acá también se
          leen cupones, entradas y carnets de socio, que no llevan
          sellos. El título tiene que servir antes de saber qué tarjeta
          es — el tipo recién se conoce cuando el código se leyó. */}
      <h3 className="text-[15px] font-bold text-aventurea-ink">Escanear la tarjeta</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Apuntá la cámara al código de la tarjeta del cliente. Lo puede hacer el dueño o
        cualquier colaborador del negocio.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
          {error}
        </p>
      )}

      {/* ── TRES ESTADOS, NO DOS ──────────────────────────────────
          «Entró», «ya estaba» y «falló». El del medio se pintaba casi
          igual que el primero, y eso llegó a producción como «no se
          entregan los sellos»: el dueño escaneó de más para probar, la
          pantalla le dijo «¡Sello sumado!» todas las veces, y el saldo
          se quedó clavado porque las lecturas repetidas se colapsan a
          propósito. Desde su lado, el sistema estaba roto.

          Ahora el repetido tiene su propio color, su propio título y una
          línea que dice LAS TRES COSAS que hacen falta: que no se sumó,
          en cuánto quedó, y qué hacer si de verdad era otra venta. */}
      {resultado && (
        <div
          className={`mt-3 rounded-xl px-4 py-3 ${
            resultado.ok
              ? resultado.yaEstaba
                ? "border-l-4 border-amber-500 bg-amber-50"
                : "bg-aventurea-green-light"
              : "bg-red-50"
          }`}
        >
          {resultado.ok && textos ? (
            <>
              <p
                className={`text-[14px] font-bold ${
                  resultado.yaEstaba ? "text-amber-800" : "text-aventurea-green"
                }`}
              >
                {resultado.yaEstaba
                  ? textos.repetido(resultado.cliente)
                  : textos.titulo(resultado.cliente)}
              </p>

              {resultado.yaEstaba ? (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-900">
                  <strong className="font-bold">No se sumó de nuevo.</strong>{" "}
                  {textos.muestraSaldo
                    ? `Sigue en ${resultado.saldo} ${unidadDe(resultado.saldo, textos)}.`
                    : "La tarjeta ya estaba leída."}{" "}
                  Esta lectura ya había entrado. Si es otra venta, volvé a escanear.
                </p>
              ) : (
                textos.muestraSaldo && (
                  <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                    +{resultado.puntos} — lleva {resultado.saldo} {unidadDe(resultado.saldo, textos)} en total.
                  </p>
                )
              )}

              {/* El canje aparece SOLO cuando el saldo alcanza. El RPC
                  vuelve a validar todo bajo lock (saldo, stock,
                  vigencia, límites): esto es la puerta, no la
                  garantía. */}
              {recompensa && resultado.saldo >= recompensa.costo && !canje && (
                <button
                  type="button"
                  onClick={confirmarCanje}
                  disabled={procesando}
                  className={`${BOTON_LEALTAD} mt-2.5 border-transparent bg-aventurea-green text-white`}
                >
                  {procesando
                    ? "Procesando…"
                    : `${textos.verboCanje}: ${recompensa.nombre}${
                        textos.muestraSaldo ? ` (${recompensa.costo})` : ""
                      }`}
                </button>
              )}

              {canje?.fase === "hecho" && (
                <div className="mt-2.5 rounded-xl border border-aventurea-green/40 bg-white px-3 py-2.5">
                  <p className="text-[13px] font-bold text-aventurea-green">
                    Listo: {canje.nombre}
                  </p>
                  {canje.instrucciones && (
                    <p className="mt-1 text-[12.5px] text-aventurea-ink">
                      {canje.instrucciones}
                    </p>
                  )}
                  <p className="mt-1 text-[12px] text-aventurea-ink-soft">
                    {canje.sku
                      ? `Registralo en tu caja con el código ${canje.sku}.`
                      : "Registralo en tu caja como cortesía del programa."}
                  </p>
                </div>
              )}
              {canje?.fase === "error" && (
                <p className="mt-2.5 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
                  {canje.motivo}
                </p>
              )}
            </>
          ) : (
            !resultado.ok && (
              <p className="text-[13.5px] font-bold text-red-700">{resultado.motivo}</p>
            )
          )}
        </div>
      )}

      {pideMonto && (
        <div className="mt-4 max-w-[260px]">
          {/* EL CATÁLOGO (0198), si el negocio cargó productos. Va
              ARRIBA del monto porque es lo que lo rellena: elegir el
              café pone su precio y su nombre, y de ahí el empleado
              corrige si la venta lleva dos. Sin catálogo esto no
              existe y la pantalla es la de siempre. */}
          {productos.length > 0 && (
            <div className="mb-3">
              <SelectorProducto
                id="escaner-catalogo"
                productos={productos}
                valor={productoId}
                onElegir={elegirProducto}
                etiqueta="¿Qué se vendió?"
              />
            </div>
          )}

          <label
            htmlFor="escaner-monto"
            className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
          >
            Valor de la compra
          </label>
          <input
            id="escaner-monto"
            type="number"
            min={0}
            step={1}
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              if (avisoMonto) setAvisoMonto(null);
            }}
            placeholder="Opcional"
            aria-invalid={avisoMonto ? true : undefined}
            className={`w-full rounded-[10px] border bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500 ${
              avisoMonto ? "border-red-500" : "border-aventurea-line"
            }`}
          />
          {/* EL MONTO MAL ESCRITO SE DICE, NO SE TIRA. Antes, «1500.50»
              se convertía en `null` sin avisar y la compra entraba como
              visita sin monto: el cliente perdía sus puntos y nadie se
              enteraba. */}
          {avisoMonto && (
            <p className="mt-1.5 text-[12px] font-bold text-red-700">{avisoMonto}</p>
          )}

          {/* EL PRODUCTO (0197): puro registro comercial. No decide
              sellos ni puntos — por eso no tiene validación que pueda
              frenar un escaneo. */}
          <label
            className="mb-1.5 mt-3 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
            htmlFor="escaner-producto"
          >
            Detalle (opcional)
          </label>
          <input
            id="escaner-producto"
            type="text"
            maxLength={120}
            value={producto}
            onChange={(e) => {
              setProducto(e.target.value);
              // Corregir el texto a mano DESATA el enlace al catálogo:
              // el reporte diría «Capuchino» con el id de otro producto,
              // que es la clase de dato que no se puede auditar después.
              if (productoId) setProductoId(null);
            }}
            placeholder="«Hamburguesas», «Matcha latte»…"
            className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500"
          />
        </div>
      )}

      {/* El video se mantiene montado siempre: crearlo recién al
          encender hace que el primer cuadro llegue tarde y se vea un
          parpadeo negro. Se oculta con `hidden`, no se desmonta. */}
      <div className={activo ? "mt-4" : "hidden"}>
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={video}
            playsInline
            muted
            className="h-auto w-full max-w-md"
          />
          {/* La mira: el personal apunta más rápido con una referencia
              visual que con una instrucción escrita. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-2xl border-[3px] border-white/80" />
          </div>
        </div>
      </div>
      <canvas ref={lienzo} className="hidden" />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!activo ? (
          <button
            type="button"
            onClick={encender}
            disabled={procesando}
            className={BOTON_ACCION}
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            {procesando ? "Registrando…" : resultado ? "Escanear al siguiente" : "Abrir cámara"}
          </button>
        ) : (
          <button
            type="button"
            onClick={apagar}
            className={BOTON_LEALTAD}
          >
            Cerrar cámara
          </button>
        )}

        {/* Cerrar el turno sin escanear a nadie: el cliente se fue, o se
            canjeó y hay que dejar la pantalla limpia para el siguiente.
            Sin esto, la única forma de sacar de pantalla el canje del
            cliente anterior era recargar. */}
        {!activo && resultado && (
          <button
            type="button"
            onClick={siguienteCliente}
            className={BOTON_LEALTAD}
          >
            Limpiar
          </button>
        )}

        {activo && (
          <span className="text-[12.5px] font-bold text-aventurea-ink-soft">
            Buscando el código…
          </span>
        )}
      </div>
    </div>
  );
}
