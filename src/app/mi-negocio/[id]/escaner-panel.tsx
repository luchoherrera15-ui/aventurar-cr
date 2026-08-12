"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
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

  const [activo, setActivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEscaneo | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [monto, setMonto] = useState("");
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

  async function encender() {
    setError(null);
    setResultado(null);

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
    setProcesando(true);
    const montoLimpio = pideMonto && monto.trim() !== "" ? Number(monto) : null;
    sumarSelloEscaneado(ranchoId, serial, Number.isInteger(montoLimpio) ? montoLimpio : null)
      .then((res) => {
        setResultado(res);
        apagar();
      })
      .catch(() => setError("No se pudo registrar el sello. Probá de nuevo."))
      .finally(() => setProcesando(false));
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Sumar un sello</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Apuntá la cámara al código de la tarjeta del cliente. Lo puede hacer el dueño o
        cualquier colaborador del negocio.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
          {error}
        </p>
      )}

      {resultado && (
        <div
          className={`mt-3 rounded-xl px-4 py-3 ${
            resultado.ok
              ? resultado.yaEstaba
                ? "bg-aventurea-cream-2"
                : "bg-aventurea-green-light"
              : "bg-red-50"
          }`}
        >
          {resultado.ok ? (
            <>
              <p
                className={`text-[14px] font-bold ${
                  resultado.yaEstaba ? "text-aventurea-ink" : "text-aventurea-green"
                }`}
              >
                {resultado.yaEstaba
                  ? `${resultado.cliente} ya tenía su sello`
                  : `¡Sello sumado a ${resultado.cliente}!`}
              </p>
              <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                Lleva {resultado.saldo} en total.
                {resultado.yaEstaba && " Se le contó hace menos de un minuto."}
              </p>

              {/* El canje aparece SOLO cuando el saldo alcanza. El RPC
                  vuelve a validar todo bajo lock (saldo, stock,
                  vigencia, límites): esto es la puerta, no la
                  garantía. */}
              {recompensa && resultado.saldo >= recompensa.costo && !canje && (
                <button
                  type="button"
                  onClick={confirmarCanje}
                  disabled={procesando}
                  className="mt-2.5 rounded-[10px] bg-aventurea-green px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                >
                  {procesando
                    ? "Canjeando…"
                    : `Canjear: ${recompensa.nombre} (${recompensa.costo})`}
                </button>
              )}

              {canje?.fase === "hecho" && (
                <div className="mt-2.5 rounded-xl border border-aventurea-green/40 bg-white px-3 py-2.5">
                  <p className="text-[13px] font-bold text-aventurea-green">
                    Canje hecho: {canje.nombre}
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
            <p className="text-[13.5px] font-bold text-red-700">{resultado.motivo}</p>
          )}
        </div>
      )}

      {pideMonto && (
        <div className="mt-4 max-w-[220px]">
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Monto de la compra (₡)
          </label>
          <input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Opcional"
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
            className="rounded-[10px] bg-aventurea-ink px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {procesando ? "Registrando…" : "Abrir cámara"}
          </button>
        ) : (
          <button
            type="button"
            onClick={apagar}
            className="rounded-[10px] border border-aventurea-line bg-white px-5 py-2.5 text-[13px] font-bold text-aventurea-ink"
          >
            Cerrar cámara
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
