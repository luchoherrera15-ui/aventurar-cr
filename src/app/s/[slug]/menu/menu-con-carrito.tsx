"use client";

import { useMemo, useState, useTransition } from "react";
import { fmtColones } from "@/lib/finanzas";
import { METODO_PAGO, MODALIDAD, TOPES, type MetodoPago } from "@/lib/solutions/tipos";
import { enlaceDeWhatsapp, textoDelPedido } from "@/lib/solutions/whatsapp";
import { pedirDesdeLaMesa, pedirParaLlevar } from "./pedir-actions";

type Item = { id: string; nombre: string; descripcion: string; precio: number | null; foto_url: string | null };
type Grupo = { nombre: string; items: Item[] };
type Paleta = {
  fondo: string;
  acento: string;
  tinta: string;
  suave: string;
  superficie: string;
  borde: string;
  tintaSobreAcento: string;
};

/**
 * EL MENÚ CON CARRITO — y las dos formas de pedir.
 *
 * Solo lectura si no se puede pedir. Cada plato con precio suma al
 * carrito; los «a consultar» no se pueden pedir (no hay monto que
 * congelar). El carrito vive abajo, fijo, y se abre en una hoja antes
 * de enviar.
 *
 * ── DESDE LA MESA ───────────────────────────────────────────────────
 * Con número de mesa (viene en el QR), el pedido va a la cocina: se
 * guarda y aparece en «Comandas». Nombre y nota opcionales; se paga en
 * el local.
 *
 * ── PARA LLEVAR / EXPRÉS → WHATSAPP (0233) ──────────────────────────
 * Sin mesa y con alguna de esas dos prendidas, la hoja pide los datos
 * del cliente —nombre, teléfono, cédula, dirección si es exprés y
 * cómo paga— y al enviar: (1) el pedido se guarda y recibe un código,
 * (2) se arma el mensaje ordenado con lo que devolvió el servidor, y
 * (3) se abre WhatsApp con ese mensaje ya escrito. La persona solo
 * toca «Enviar» en el chat.
 *
 * Se abre con `location.assign` y no con `window.open`: después de
 * esperar a la action ya no estamos dentro del clic, y los
 * navegadores bloquean las ventanas nuevas que no salen de un gesto.
 * Navegar nunca se bloquea. En el teléfono abre la app y esta pantalla
 * queda atrás; por si acaso, la confirmación deja el enlace a mano.
 */
/**
 * Un botón de opción (modalidad, forma de pago) con la paleta del negocio.
 *
 * En el MÓDULO y no adentro del componente: un componente declarado
 * dentro del render es un tipo nuevo en cada pasada y React desmonta
 * y vuelve a montar el subárbol — el mismo bug que ya se arregló en
 * `vista-pagina.tsx` con `Ancla`.
 */
function Opcion({
  paleta,
  activo,
  onClick,
  children,
}: {
  paleta: Paleta;
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="presionable min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-[13.5px] font-extrabold"
      style={{
        background: activo ? paleta.acento : paleta.superficie,
        color: activo ? paleta.tintaSobreAcento : paleta.tinta,
        borderColor: activo ? paleta.acento : paleta.borde,
      }}
    >
      {children}
    </button>
  );
}

export default function MenuConCarrito({
  negocioId,
  slug,
  mesa,
  puedePedir,
  grupos,
  paleta,
  llevar = false,
  express = false,
  costoExpress = 0,
  metodosPago = ["efectivo"],
  whatsappPedidos = null,
}: {
  negocioId: string;
  slug: string;
  mesa: number | null;
  /** Desde la mesa: add-on + interruptor + número de mesa. */
  puedePedir: boolean;
  grupos: Grupo[];
  paleta: Paleta;
  /** Por WhatsApp (0233). Los decide el servidor con el add-on y los interruptores. */
  llevar?: boolean;
  express?: boolean;
  costoExpress?: number;
  metodosPago?: MetodoPago[];
  whatsappPedidos?: string | null;
}) {
  /* Por chat solo SIN mesa: desde la mesa se pide a la cocina, no por
     WhatsApp — y si hubiera las dos puertas a la vez, la persona en la
     mesa 4 podría pedirse un exprés a su casa. */
  const porWhatsapp = mesa === null && Boolean(whatsappPedidos) && (llevar || express);
  const puedeAgregar = puedePedir || porWhatsapp;

  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  const [modalidad, setModalidad] = useState<"llevar" | "express">(llevar ? "llevar" : "express");
  const [telefono, setTelefono] = useState("");
  const [cedula, setCedula] = useState("");
  const [direccion, setDireccion] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(metodosPago[0] ?? "efectivo");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<
    | { tipo: "mesa"; total: number; renglones: number }
    | { tipo: "whatsapp"; codigo: string; total: number; enlace: string }
    | null
  >(null);
  const [enviando, arrancar] = useTransition();

  const porId = useMemo(() => new Map(grupos.flatMap((g) => g.items).map((it) => [it.id, it])), [grupos]);
  const renglones = Object.entries(carrito).filter(([, c]) => c > 0);
  const cantidadTotal = renglones.reduce((s, [, c]) => s + c, 0);
  const subtotal = renglones.reduce((s, [id, c]) => s + (porId.get(id)?.precio ?? 0) * c, 0);
  const envio = porWhatsapp && modalidad === "express" ? costoExpress : 0;
  const total = subtotal + envio;

  const ajustar = (id: string, delta: number) =>
    setCarrito((prev) => {
      const n = Math.max(0, Math.min(TOPES.cantidadPorRenglon, (prev[id] ?? 0) + delta));
      const copia = { ...prev };
      if (n === 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });

  const limpiar = () => {
    setCarrito({});
    setNota("");
    setAbierto(false);
  };

  const enviarALaMesa = () => {
    if (!mesa) return;
    setError(null);
    arrancar(async () => {
      const r = await pedirDesdeLaMesa({
        negocioId,
        slug,
        mesa,
        nombre,
        nota,
        renglones: renglones.map(([id, cantidad]) => ({ itemId: id, cantidad })),
      });
      if (!r.ok) {
        setError(r.motivo);
        return;
      }
      setEnviado({ tipo: "mesa", total: r.total, renglones: cantidadTotal });
      limpiar();
    });
  };

  const enviarPorWhatsapp = () => {
    setError(null);
    if (nombre.trim().length < 2) return setError("Decinos tu nombre.");
    if (telefono.replace(/\D/g, "").length < 8) return setError("Dejanos un teléfono de 8 dígitos o más.");
    if (modalidad === "express" && direccion.trim().length < 5) return setError("Para el exprés necesitamos tu dirección.");
    arrancar(async () => {
      const r = await pedirParaLlevar({
        negocioId,
        slug,
        modalidad,
        nombre,
        telefono,
        cedula,
        direccion,
        metodoPago,
        nota,
        renglones: renglones.map(([id, cantidad]) => ({ itemId: id, cantidad })),
      });
      if (!r.ok) {
        setError(r.motivo);
        return;
      }
      // El texto sale de lo que DEVOLVIÓ el servidor —nombres y precios
      // de la base—, no del carrito: una sola verdad para el chat y el
      // panel.
      const texto = textoDelPedido({
        negocio: r.negocio,
        slug,
        codigo: r.codigo,
        modalidad,
        renglones: r.renglones,
        costoEnvio: r.costoEnvio,
        total: r.total,
        cliente: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          cedula: cedula.trim(),
          direccion: direccion.trim(),
          metodoPago: r.metodoPago,
          nota: nota.trim(),
        },
      });
      const enlace = enlaceDeWhatsapp(r.whatsapp, texto);
      setEnviado({ tipo: "whatsapp", codigo: r.codigo, total: r.total, enlace });
      limpiar();
      window.location.assign(enlace);
    });
  };

  const seccionId = (n: string) => `seccion-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const campo = "w-full rounded-xl border px-3.5 py-3 text-[15px] outline-none";
  const estiloCampo = { background: paleta.superficie, borderColor: paleta.borde, color: paleta.tinta };

  return (
    <>
      {/* ── Anclas ─────────────────────────────────────────────── */}
      {grupos.length > 1 && (
        <nav
          aria-label="Secciones del menú"
          className="sticky top-0 z-10 mt-4 overflow-x-auto px-5 py-2.5"
          style={{ background: paleta.fondo }}
        >
          <ul className="mx-auto flex w-full max-w-[520px] gap-2">
            {grupos.map((g) => (
              <li key={g.nombre} className="shrink-0">
                <a
                  href={`#${seccionId(g.nombre)}`}
                  className="block rounded-full px-3 py-1.5 text-[12.5px] font-bold"
                  style={{ background: paleta.superficie, border: `1px solid ${paleta.borde}` }}
                >
                  {g.nombre}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── El menú ────────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-7 px-5 pt-4">
        {grupos.map((g) => (
          <section key={g.nombre} id={seccionId(g.nombre)} className="scroll-mt-14">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>
              {g.nombre}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {g.items.map((it) => {
                const cant = carrito[it.id] ?? 0;
                const pedible = puedeAgregar && it.precio !== null;
                return (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 rounded-2xl border p-3"
                    style={{ background: paleta.superficie, borderColor: cant > 0 ? paleta.acento : paleta.borde }}
                  >
                    {it.foto_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.foto_url} alt="" className="h-[60px] w-[60px] shrink-0 rounded-xl object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-extrabold leading-tight">{it.nombre}</p>
                      {it.descripcion && (
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug" style={{ color: paleta.suave }}>
                          {it.descripcion}
                        </p>
                      )}
                      <p className="mt-1 text-[14px] font-bold tabular-nums" style={{ color: paleta.acento }}>
                        {it.precio === null ? "Consultar" : fmtColones(it.precio)}
                      </p>
                    </div>
                    {pedible &&
                      (cant === 0 ? (
                        <button
                          type="button"
                          onClick={() => ajustar(it.id, 1)}
                          aria-label={`Agregar ${it.nombre}`}
                          className="presionable grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[20px] font-extrabold"
                          style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
                        >
                          +
                        </button>
                      ) : (
                        <div
                          className="flex shrink-0 items-center rounded-xl"
                          style={{ border: `1px solid ${paleta.acento}` }}
                        >
                          <button
                            type="button"
                            onClick={() => ajustar(it.id, -1)}
                            aria-label={`Quitar uno de ${it.nombre}`}
                            className="presionable h-10 w-9 text-[18px] font-extrabold"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-[14px] font-extrabold tabular-nums">{cant}</span>
                          <button
                            type="button"
                            onClick={() => ajustar(it.id, 1)}
                            aria-label={`Agregar uno de ${it.nombre}`}
                            className="presionable h-10 w-9 text-[18px] font-extrabold"
                          >
                            +
                          </button>
                        </div>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* ── Confirmación ──────────────────────────────────────── */}
      {enviado && (
        <div className="mx-auto mt-6 w-full max-w-[520px] px-5">
          <div className="rounded-2xl border p-4" style={{ background: paleta.superficie, borderColor: paleta.acento }}>
            {enviado.tipo === "mesa" ? (
              <>
                <p className="text-[15px] font-extrabold">✓ Pedido enviado a la mesa {mesa}</p>
                <p className="mt-1 text-[13px]" style={{ color: paleta.suave }}>
                  {enviado.renglones} {enviado.renglones === 1 ? "plato" : "platos"} · {fmtColones(enviado.total)}. Te lo
                  llevan a la mesa; el pago es en el local.
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-extrabold">✓ Pedido #{enviado.codigo} listo · {fmtColones(enviado.total)}</p>
                <p className="mt-1 text-[13px]" style={{ color: paleta.suave }}>
                  Se abrió WhatsApp con tu pedido ya escrito: solo tocá enviar. El negocio te confirma por ese
                  chat.
                </p>
                <a
                  href={enviado.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="presionable mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-[14px] font-extrabold"
                  style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
                >
                  Abrir WhatsApp de nuevo
                </a>
              </>
            )}
            <button type="button" onClick={() => setEnviado(null)} className="mt-2 block text-[12.5px] font-bold underline">
              Pedir algo más
            </button>
          </div>
        </div>
      )}

      {/* ── La barra del carrito ──────────────────────────────── */}
      {puedeAgregar && cantidadTotal > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="presionable mx-auto flex w-full max-w-[520px] items-center justify-between rounded-2xl px-5 py-4 text-[15px] font-extrabold shadow-flotante"
            style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
          >
            <span>Ver pedido · {cantidadTotal}</span>
            <span className="tabular-nums">{fmtColones(subtotal)} →</span>
          </button>
        </div>
      )}

      {/* ── La hoja de confirmación ───────────────────────────── */}
      {abierto && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar pedido"
            className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
            style={{ background: paleta.fondo, color: paleta.tinta, border: `1px solid ${paleta.borde}` }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold">{mesa ? `Tu pedido · Mesa ${mesa}` : "Tu pedido"}</h2>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-[22px] leading-none">
                ×
              </button>
            </div>

            <ul className="mt-3 flex max-h-[30vh] flex-col gap-2 overflow-y-auto">
              {renglones.map(([id, c]) => {
                const it = porId.get(id);
                if (!it) return null;
                return (
                  <li key={id} className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-extrabold tabular-nums">{c}×</span> {it.nombre}
                    </span>
                    <span className="tabular-nums" style={{ color: paleta.suave }}>
                      {fmtColones((it.precio ?? 0) * c)}
                    </span>
                    <button type="button" onClick={() => ajustar(id, -c)} aria-label={`Quitar ${it.nombre}`} className="text-[12px] font-bold underline">
                      quitar
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* ── Para llevar / exprés: cómo y a quién ─────────── */}
            {porWhatsapp && (llevar && express) && (
              <div className="mt-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>
                  ¿Cómo lo querés?
                </p>
                <div className="mt-2 flex gap-2">
                  <Opcion paleta={paleta} activo={modalidad === "llevar"} onClick={() => setModalidad("llevar")}>
                    {MODALIDAD.llevar.rotulo}
                  </Opcion>
                  <Opcion paleta={paleta} activo={modalidad === "express"} onClick={() => setModalidad("express")}>
                    {MODALIDAD.express.rotulo}
                    {costoExpress > 0 && <span className="block text-[11px] font-bold opacity-80">+{fmtColones(costoExpress)}</span>}
                  </Opcion>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-[14px]" style={{ borderColor: paleta.borde }}>
              {envio > 0 && (
                <div className="flex items-center justify-between" style={{ color: paleta.suave }}>
                  <span>Envío</span>
                  <span className="tabular-nums">{fmtColones(envio)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[16px] font-extrabold">
                <span>Total</span>
                <span className="tabular-nums">{fmtColones(total)}</span>
              </div>
            </div>

            {porWhatsapp ? (
              <div className="mt-4 grid gap-3">
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={TOPES.pedidoNombre} placeholder="Tu nombre" autoComplete="name" className={campo} style={estiloCampo} />
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={TOPES.telefono + 4} placeholder="Tu teléfono" autoComplete="tel" className={campo} style={estiloCampo} />
                <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} maxLength={TOPES.cedula} placeholder="Cédula (opcional, para la factura)" className={campo} style={estiloCampo} />
                {modalidad === "express" && (
                  <textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={TOPES.direccionPedido} rows={2} placeholder="Dirección exacta para el envío" autoComplete="street-address" className={`${campo} text-[14px]`} style={estiloCampo} />
                )}
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>
                    ¿Cómo pagás?
                  </p>
                  <div className="mt-2 flex gap-2">
                    {metodosPago.map((m) => (
                      <Opcion key={m} paleta={paleta} activo={metodoPago === m} onClick={() => setMetodoPago(m)}>
                        {METODO_PAGO[m]}
                      </Opcion>
                    ))}
                  </div>
                </div>
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={TOPES.pedidoNota} rows={2} placeholder="Algo que debamos saber (sin cebolla, alergias…)" className={`${campo} text-[14px]`} style={estiloCampo} />
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={TOPES.pedidoNombre} placeholder="Tu nombre (opcional)" className={campo} style={estiloCampo} />
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={TOPES.pedidoNota} rows={2} placeholder="Algo que debamos saber (sin cebolla, alergias…)" className={`${campo} text-[14px]`} style={estiloCampo} />
              </div>
            )}

            {error && <p className="mt-3 rounded-xl bg-red-600/15 p-3 text-[13px] font-bold text-red-200">{error}</p>}

            <button
              type="button"
              onClick={porWhatsapp ? enviarPorWhatsapp : enviarALaMesa}
              disabled={enviando || renglones.length === 0}
              className="presionable mt-4 w-full rounded-2xl py-4 text-[15px] font-extrabold disabled:opacity-60"
              style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
            >
              {enviando ? "Enviando…" : porWhatsapp ? `Enviar por WhatsApp · ${fmtColones(total)}` : `Enviar pedido · ${fmtColones(total)}`}
            </button>
            <p className="mt-2 text-center text-[11.5px]" style={{ color: paleta.suave }}>
              {porWhatsapp
                ? "Se abre WhatsApp con el pedido ya escrito. El pago se coordina con el negocio."
                : "El pago es en el local. Esto solo avisa a la cocina."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
