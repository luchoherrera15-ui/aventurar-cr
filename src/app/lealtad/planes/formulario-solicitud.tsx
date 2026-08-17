"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { definicionDe, descuentoAnualPct, precioDe } from "@/lib/lealtad/planes";
import { solicitarPlanLealtad } from "./actions";
import { iniciarPagoDelPaquete } from "./pago-actions";

/**
 * El paso final de la compra, con SUS DOS CAMINOS.
 *
 *  1. CON TARJETA. Un botón, Stripe Checkout, y el paquete queda activo
 *     al instante — sin que nadie revise nada. Si la persona todavía no
 *     tiene negocio en Bookea, escribe el nombre acá y el negocio se
 *     crea solo cuando el cobro se confirma.
 *
 *  2. POR SINPE O TRANSFERENCIA. El de siempre: deposita, adjunta la
 *     captura y el equipo de Bookea lo revisa. Sin comprobante no hay
 *     botón — nadie inicia el programa sin haber pagado. El comprobante
 *     va al mismo bucket `comprobantes` que ya usan las invitaciones y
 *     las reservas: un solo lugar donde buscar depósitos.
 *
 *     Y TAMBIÉN SIN NEGOCIO PREVIO. Lealtad no exige tener nada
 *     registrado en /citas, hospedajes ni eventos. Eso ya valía para la
 *     tarjeta; el depósito mandaba a crear el negocio primero en
 *     /lealtad/nuevo. O sea que la misma pantalla dejaba comprar en frío
 *     con Visa y no con SINPE — y el SINPE es el que de verdad usa buena
 *     parte de la clientela. Ahora los dos caminos preguntan lo mismo
 *     (`listoParaPagar`) y el negocio nace igual de tarde: con el cobro
 *     confirmado o con la solicitud aceptada.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTÁN LOS DOS, Y POR QUÉ SE DICE LA DIFERENCIA
 * ------------------------------------------------------------------
 * El SINPE no es un respaldo temporal: muchas tarjetas costarricenses
 * vienen bloqueadas para compras internacionales y la LLC cobra desde
 * Estados Unidos, así que para buena parte de la clientela es el único
 * camino que funciona. Y la diferencia —al instante contra lo revisa el
 * equipo— se escribe en pantalla porque es la razón para elegir uno u
 * otro.
 *
 * Si el servidor no tiene llaves de Stripe, `periodosConTarjeta` llega
 * vacío, el bloque de tarjeta no se dibuja y esta pantalla es
 * exactamente la que era antes: solo SINPE.
 */

/**
 * Igual que la pantalla que lo monta, este formulario vive sobre navy
 * profundo: los botones usan el par de acción para fondo OSCURO
 * —relleno claro, letra navy—, nunca el de fondo claro, que sobre este
 * navy da 1,44:1.
 */
const BOTON_ACCION =
  "bg-[color:var(--accion-claro)] text-[color:var(--accion-claro-tinta)] hover:bg-[color:var(--accion-claro-hover)]";

export type NegocioElegible = { id: string; nombre: string };

export type DatosPago = {
  sinpe: { numero: string; titular: string };
  banco: { nombre: string; cuenta: string; titular: string };
};

export default function FormularioSolicitud({
  plan,
  planNombre,
  precio,
  esGratis,
  enDolares,
  negocios,
  negocioInicial,
  pago,
  periodosConTarjeta,
  alCerrar,
}: {
  plan: string;
  planNombre: string;
  /** Ya formateado con su moneda por `precioDe()`. null = a convenir. */
  precio: string | null;
  /** El plan no lleva depósito. */
  esGratis: boolean;
  /** true = el precio está en dólares y el SINPE se hace en colones. */
  enDolares: boolean;
  negocios: NegocioElegible[];
  negocioInicial: string | null;
  pago: DatosPago;
  /**
   * Los períodos que este paquete se puede pagar con tarjeta. Vacío =
   * no hay Stripe configurado y el único camino es el depósito.
   */
  periodosConTarjeta: string[];
  alCerrar: () => void;
}) {
  const [negocioId, setNegocioId] = useState(
    negocioInicial && negocios.some((n) => n.id === negocioInicial)
      ? negocioInicial
      : (negocios[0]?.id ?? ""),
  );
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [errorTarjeta, setErrorTarjeta] = useState("");
  const [pagando, iniciarPago] = useTransition();
  const [metodo, setMetodo] = useState<"sinpe" | "transferencia">("sinpe");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviada" | string>("editando");
  const [ocupado, iniciar] = useTransition();

  async function subirComprobante(archivo: File) {
    setErrorSubida("");
    if (archivo.size > 8 * 1024 * 1024) {
      setErrorSubida("El archivo pesa más de 8 MB — mandá una captura más liviana.");
      return;
    }
    setSubiendo(true);
    const supabase = createClient();
    const liviano = await comprimirImagen(archivo);
    const ext = liviano.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `solicitudes-lealtad/${negocioId || "sin-negocio"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("comprobantes").upload(path, liviano);
    if (error) {
      setErrorSubida("No pudimos subir el comprobante. Intentá de nuevo.");
      setSubiendo(false);
      return;
    }
    const { data } = supabase.storage.from("comprobantes").getPublicUrl(path);
    setComprobanteUrl(data?.publicUrl ?? "");
    setSubiendo(false);
  }

  function enviar() {
    iniciar(async () => {
      const res = await solicitarPlanLealtad({
        ranchoId: negocios.length > 0 ? negocioId : "",
        nombreNegocio: nombreNuevo,
        plan,
        telefono,
        mensaje,
        metodoPago: metodo,
        comprobanteUrl,
      });
      setEstado(res.ok ? "enviada" : res.motivo);
    });
  }

  /**
   * Al Checkout de Stripe. Este botón NO activa nada: le pide una URL
   * al servidor y manda el navegador ahí. Quién puede pagar, para qué
   * negocio y a qué precio se resuelve del otro lado —una petición
   * armada a mano no pasa por esta pantalla— y el paquete lo escribe el
   * webhook recién cuando Stripe confirma el cobro.
   *
   * `window.location.assign` y no `router.push`: Checkout es un sitio
   * ajeno y el router de Next solo navega dentro de la app.
   */
  function pagarConTarjeta(periodo: string) {
    setErrorTarjeta("");
    iniciarPago(async () => {
      const r = await iniciarPagoDelPaquete({
        plan,
        periodo,
        ranchoId: negocios.length > 0 ? negocioId : "",
        nombreNegocio: nombreNuevo,
      });
      if (r.ok) window.location.assign(r.url);
      else setErrorTarjeta(r.motivo);
    });
  }

  if (estado === "enviada") {
    return (
      <div className="rounded-2xl bg-white/10 p-5 text-center">
        <p className="text-[14.5px] font-extrabold text-white">¡Solicitud enviada!</p>
        <p className="mx-auto mt-1.5 max-w-[380px] text-[12.5px] leading-relaxed text-white/60">
          Recibimos tu depósito y tu solicitud del plan {planNombre}. El equipo de Bookea
          los revisa, arma tu programa y te avisa al correo cuando esté funcionando.
        </p>
      </div>
    );
  }

  const etiqueta = "grid gap-1 text-[11.5px] font-bold uppercase tracking-wide text-white/50";
  const campo =
    "rounded-[10px] border border-white/20 bg-[#131c36] px-3 py-2.5 text-[13.5px] font-normal normal-case tracking-normal text-white placeholder:text-white/30";

  // El paquete gratis nunca pasa por Stripe (se activa solo), y sin
  // llaves configuradas la lista llega vacía.
  const hayTarjeta = !esGratis && periodosConTarjeta.length > 0;
  const def = definicionDe(plan);
  // Para comprar hace falta saber PARA QUÉ negocio: el que ya tiene, o
  // el nombre del que se va a crear. Vale igual para la tarjeta y para
  // el depósito — es la misma pregunta, y por eso es una sola condición
  // y no una por forma de pago.
  const listoParaPagar = negocios.length > 0 ? !!negocioId : nombreNuevo.trim().length > 0;

  return (
    <div className="rounded-2xl bg-white/10 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-extrabold text-white">
          {hayTarjeta ? `Llevar el plan ${planNombre}` : `Solicitar el plan ${planNombre}`}
        </p>
        <button type="button" onClick={alCerrar} className="text-[12px] font-bold text-white/50 hover:text-white">
          Cancelar
        </button>
      </div>

      {/* Para cuál negocio — arriba de todo y COMPARTIDO por los dos
          caminos: es la misma pregunta, y repetirla una vez por forma
          de pago dejaría dos selectores capaces de decir cosas
          distintas. */}
      {negocios.length > 1 && (
        <label className={`${etiqueta} mt-3`}>
          Para cuál negocio
          <select
            value={negocioId}
            onChange={(e) => setNegocioId(e.target.value)}
            className={campo}
          >
            {negocios.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {negocios.length === 1 && (
        <p className="mt-2 text-[12.5px] text-white/60">
          Para <strong className="text-white">{negocios[0].nombre}</strong>
        </p>
      )}

      {/* Sin negocio todavía: se pide el nombre y nada más.
          COMPARTIDO por los dos caminos de pago, igual que el selector
          de arriba. Antes vivía dentro del bloque de tarjeta, y esa era
          justo la incoherencia: la misma pantalla dejaba comprar sin
          negocio con Visa y mandaba a crearlo primero con SINPE — que
          es el medio que de verdad usa buena parte de la clientela.
          El negocio NO se crea acá; nace cuando entra el cobro (tarjeta)
          o cuando un admin acepta la solicitud (depósito). */}
      {negocios.length === 0 && (
        <label className={`${etiqueta} mt-3`}>
          ¿Cómo se llama tu negocio?
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Barbería Silencio"
            maxLength={80}
            className={campo}
          />
          <span className="text-[11px] font-normal normal-case tracking-normal text-white/45">
            Lo creamos por vos — sin publicarte en el marketplace.
          </span>
        </label>
      )}

      {/* ── 1. CON TARJETA: queda activo al instante ─────────────────
          Va PRIMERO porque es el único camino que no depende de que
          alguien revise un depósito. Debajo sigue el SINPE de siempre,
          intacto. */}
      {hayTarjeta && (
        <div
          className="mt-3 rounded-xl border p-3.5"
          style={{ background: "rgba(157,180,255,.14)", borderColor: "rgba(157,180,255,.45)" }}
        >
          <p className="text-[13px] font-extrabold text-white">
            Pagar con tarjeta — queda activo al instante
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/65">
            Se cobra solo cada período y lo cancelás cuando querás, desde tu panel. Nadie
            tiene que revisar nada.
          </p>

          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {periodosConTarjeta.map((periodo, i) => (
              <button
                key={periodo}
                type="button"
                disabled={pagando || !listoParaPagar}
                onClick={() => pagarConTarjeta(periodo)}
                className={`rounded-xl px-4 py-3 text-[13px] font-extrabold disabled:opacity-40 ${
                  i === 0 ? BOTON_ACCION : "border border-white/25 text-white"
                }`}
              >
                {pagando ? "Abriendo…" : etiquetaDePeriodo(periodo, def, precio)}
              </button>
            ))}
          </div>

          {errorTarjeta && (
            <p className="mt-2 text-[12.5px] font-bold text-red-300">{errorTarjeta}</p>
          )}
        </div>
      )}

      {hayTarjeta && (
        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/15" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">
            o pagá por SINPE
          </span>
          <span className="h-px flex-1 bg-white/15" />
        </div>
      )}

      {hayTarjeta && (
        <p className="text-[12.5px] leading-snug text-white/65">
          Si tu tarjeta no acepta compras internacionales —le pasa a muchas tarjetas de acá—
          depositá y el equipo de Bookea te deja el programa andando.
        </p>
      )}

      {/* ── 2. POR SINPE O TRANSFERENCIA: lo revisa el equipo ───────
          Se dibuja SIEMPRE, con negocio o sin él. Lo que decide si se
          puede enviar es `listoParaPagar`, no si la persona ya tiene
          algo registrado en Bookea. */}
      <div className="mt-3 grid gap-2.5">
          {/* ── El depósito: primero se paga, después se solicita.
                 El plan Gratis se salta este paso entero. ── */}
          {esGratis ? (
            <p className="rounded-xl border border-white/15 bg-[#0f1930] px-3.5 py-3 text-[13px] text-white/70">
              Plan gratis — sin depósito. Hasta 5 miembros para probar el programa.
            </p>
          ) : (
          <div className="rounded-xl border border-white/15 bg-[#0f1930] p-3.5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-white/50">
              1 · Hacé el depósito
              {precio !== null && (
                <span className="text-white"> de {precio} (primer mes)</span>
              )}
            </p>
            {/* El precio está en dólares pero el SINPE se hace en
                colones: decirlo acá evita el depósito por un monto
                equivocado y el ida y vuelta para corregirlo. */}
            {enDolares && precio !== null && (
              <p className="mt-1.5 text-[12px] leading-snug text-amber-300">
                El SINPE se hace en colones: escribinos y te confirmamos el monto exacto
                al tipo de cambio del día.
              </p>
            )}
            <div className="mt-2 flex gap-1.5">
              {(["sinpe", "transferencia"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                    metodo === m ? "bg-white text-[#0a1226]" : "bg-white/10 text-white/60"
                  }`}
                >
                  {m === "sinpe" ? "SINPE Móvil" : "Transferencia"}
                </button>
              ))}
            </div>
            {metodo === "sinpe" ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                SINPE Móvil al{" "}
                <strong className="text-white">{pago.sinpe.numero}</strong> a nombre de{" "}
                <strong className="text-white">{pago.sinpe.titular}</strong>. En el detalle
                poné el nombre de tu negocio.
              </p>
            ) : pago.banco.cuenta ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                {pago.banco.nombre} · cuenta{" "}
                <strong className="text-white">{pago.banco.cuenta}</strong> a nombre de{" "}
                <strong className="text-white">{pago.banco.titular}</strong>. En el detalle
                poné el nombre de tu negocio.
              </p>
            ) : (
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                Escribinos y te pasamos la cuenta — o usá SINPE Móvil al{" "}
                <strong className="text-white">{pago.sinpe.numero}</strong>, que es inmediato.
              </p>
            )}

            <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-white/50">
              2 · Adjuntá la captura
            </p>
            {comprobanteUrl ? (
              <p className="mt-1.5 text-[12.5px] font-bold text-emerald-300">
                ✓ Comprobante adjunto.{" "}
                <button
                  type="button"
                  onClick={() => setComprobanteUrl("")}
                  className="font-bold text-white/50 underline"
                >
                  Cambiarlo
                </button>
              </p>
            ) : (
              <label className="mt-1.5 block">
                <input
                  type="file"
                  accept="image/*"
                  disabled={subiendo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void subirComprobante(f);
                  }}
                  className="block w-full text-[12.5px] text-white/60 file:mr-3 file:rounded-[10px] file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-white"
                />
              </label>
            )}
            {subiendo && <p className="mt-1 text-[12px] text-white/50">Subiendo…</p>}
            {errorSubida && <p className="mt-1 text-[12.5px] font-bold text-red-300">{errorSubida}</p>}
          </div>
          )}

          <label className={etiqueta}>
            Teléfono (para coordinar)
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="8888 8888"
              maxLength={30}
              className={campo}
            />
          </label>

          <label className={etiqueta}>
            Algo que debamos saber (opcional)
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Colores de la marca, la regalía que querés dar…"
              className={campo}
            />
          </label>

          <button
            type="button"
            onClick={enviar}
            disabled={ocupado || subiendo || !listoParaPagar || (!esGratis && !comprobanteUrl)}
            className={`rounded-xl px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-40 ${BOTON_ACCION}`}
          >
            {ocupado
              ? "Enviando…"
              : !listoParaPagar
                ? "Escribí el nombre de tu negocio"
                : esGratis || comprobanteUrl
                  ? "Enviar la solicitud"
                  : "Adjuntá el comprobante para enviar"}
          </button>

          {estado !== "editando" && (
            <p className="text-[12.5px] font-bold text-red-300">{estado}</p>
          )}
        </div>
    </div>
  );
}

/**
 * Lo que dice cada botón de tarjeta.
 *
 * El «2 meses gratis» sale de `mesesDeAhorroAnual`, o sea de los
 * precios del catálogo, y no de un texto escrito a mano que se
 * desincroniza el día que cambie uno. Sin definición del paquete —que
 * no debería pasar— cae a algo neutro en vez de mostrar un precio en
 * blanco.
 */
function etiquetaDePeriodo(
  periodo: string,
  def: ReturnType<typeof definicionDe>,
  precioMensual: string | null,
): string {
  if (periodo !== "anual") {
    return precioMensual ? `Pagar ${precioMensual} por mes` : "Pagar por mes";
  }
  if (!def) return "Pagar el año";
  const anual = precioDe(def, "año");
  const ahorro = descuentoAnualPct(def);
  return (
    `Pagar el año${anual ? ` — ${anual}` : ""}` +
    (ahorro > 0 ? ` (${ahorro}% menos)` : "")
  );
}
