"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { leerMontoColones, llaveDeIntento, textosDelTipo } from "@/lib/lealtad/mostrador";
import { ACCION, ACCION_TINTA, BOTON_ACCION, BOTON_LEALTAD } from "../sistema-lealtad";
import { sumarSelloEscaneado, type ResultadoEscaneo } from "./escaner-actions";
import { canjearRecompensa } from "./lealtad-operar-actions";

/**
 * Escanear la tarjeta del cliente para sumarle un sello.
 *
 * El QR del pase lleva el `serial_number`. Se decodifica con jsQR y no
 * con `BarcodeDetector`: esa API nativa no existe en Safari, y el
 * personal de un local costarricense usa iPhone tanto como Android.
 * Una sola ruta para los dos evita que "funciona en mi teléfono" sea
 * una respuesta válida.
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
}: {
  ranchoId: string;
  /** true en modo puntos/cashback: la compra trae un monto. */
  pideMonto?: boolean;
  /** La meta actual, para ofrecer el canje apenas el saldo alcance. */
  recompensa?: { id: string; nombre: string; costo: number } | null;
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

  const [activo, setActivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEscaneo | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [monto, setMonto] = useState("");
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

  function leer() {
    if (!buscando.current) return;

    const v = video.current;
    const c = lienzo.current;
    if (!v || !c || v.readyState !== v.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(leer);
      return;
    }

    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(v, 0, 0, c.width, c.height);
    const imagen = ctx.getImageData(0, 0, c.width, c.height);
    const codigo = jsQR(imagen.data, imagen.width, imagen.height, {
      inversionAttempts: "dontInvert",
    });

    if (!codigo?.data) {
      requestAnimationFrame(leer);
      return;
    }

    // Se para el bucle en el primer acierto. Es cortesía, no garantía:
    // la cámara lee unas diez veces por segundo y sin esto se dispararían
    // diez peticiones. Lo que de verdad impide el sello doble es la
    // referencia por minuto del servidor.
    buscando.current = false;
    canjear(codigo.data);
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
    sumarSelloEscaneado(ranchoId, serial, lectura.monto, intento.current.id)
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
          // compra del anterior con solo volver a escanear.
          setMonto("");
        }
        apagar();
      })
      // Acá SÍ se conserva: no se sabe si el servidor llegó a escribir.
      // Reintentar con la misma llave es lo único que garantiza que el
      // cliente no reciba dos sellos por una compra.
      .catch(() => setError("No se pudo registrar el sello. Probá de nuevo."))
      .finally(() => setProcesando(false));
  }

  /** Cerrar el turno a mano: deja la pantalla lista para el siguiente. */
  function siguienteCliente() {
    limpiarTurno();
    setMonto("");
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
                    ? `Sigue en ${resultado.saldo} ${textos.unidad}.`
                    : "La tarjeta ya estaba leída."}{" "}
                  Esta lectura ya había entrado. Si es otra venta, volvé a escanear.
                </p>
              ) : (
                textos.muestraSaldo && (
                  <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                    +{resultado.puntos} — lleva {resultado.saldo} {textos.unidad} en total.
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
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Monto de la compra (₡)
          </label>
          <input
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
