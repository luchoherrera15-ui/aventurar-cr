"use client";

import { useMemo, useState, useTransition } from "react";
import { fmtColones } from "@/lib/finanzas";
import { TOPES } from "@/lib/solutions/tipos";
import { pedirDesdeLaMesa } from "./pedir-actions";

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
 * LA CARTA CON CARRITO.
 *
 * Solo lectura si `puedePedir` es false. Con mesa, cada plato con
 * precio suma al carrito; los «a consultar» no se pueden pedir (no hay
 * monto que congelar). El carrito vive abajo, fijo, y se abre en una
 * hoja con nombre y nota antes de enviar. Después de pedir se muestra
 * el resumen y se vacía: la siguiente ronda arranca limpia.
 */
export default function MenuConCarrito({
  negocioId,
  slug,
  mesa,
  puedePedir,
  grupos,
  paleta,
}: {
  negocioId: string;
  slug: string;
  mesa: number | null;
  puedePedir: boolean;
  grupos: Grupo[];
  paleta: Paleta;
}) {
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ total: number; renglones: number } | null>(null);
  const [enviando, arrancar] = useTransition();

  const porId = useMemo(() => new Map(grupos.flatMap((g) => g.items).map((it) => [it.id, it])), [grupos]);
  const renglones = Object.entries(carrito).filter(([, c]) => c > 0);
  const cantidadTotal = renglones.reduce((s, [, c]) => s + c, 0);
  const total = renglones.reduce((s, [id, c]) => s + (porId.get(id)?.precio ?? 0) * c, 0);

  const ajustar = (id: string, delta: number) =>
    setCarrito((prev) => {
      const n = Math.max(0, Math.min(TOPES.cantidadPorRenglon, (prev[id] ?? 0) + delta));
      const copia = { ...prev };
      if (n === 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });

  const enviar = () => {
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
      setEnviado({ total: r.total, renglones: cantidadTotal });
      setCarrito({});
      setNota("");
      setAbierto(false);
    });
  };

  const seccionId = (n: string) => `seccion-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

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

      {/* ── La carta ───────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-7 px-5 pt-4">
        {grupos.map((g) => (
          <section key={g.nombre} id={seccionId(g.nombre)} className="scroll-mt-14">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>
              {g.nombre}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {g.items.map((it) => {
                const cant = carrito[it.id] ?? 0;
                const pedible = puedePedir && it.precio !== null;
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

      {/* ── Confirmación del pedido enviado ───────────────────── */}
      {enviado && (
        <div className="mx-auto mt-6 w-full max-w-[520px] px-5">
          <div className="rounded-2xl border p-4" style={{ background: paleta.superficie, borderColor: paleta.acento }}>
            <p className="text-[15px] font-extrabold">✓ Pedido enviado a la mesa {mesa}</p>
            <p className="mt-1 text-[13px]" style={{ color: paleta.suave }}>
              {enviado.renglones} {enviado.renglones === 1 ? "plato" : "platos"} · {fmtColones(enviado.total)}. Te lo llevan a
              la mesa; el pago es en el local.
            </p>
            <button type="button" onClick={() => setEnviado(null)} className="mt-2 text-[12.5px] font-bold underline">
              Pedir algo más
            </button>
          </div>
        </div>
      )}

      {/* ── La barra del carrito ──────────────────────────────── */}
      {puedePedir && cantidadTotal > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="presionable mx-auto flex w-full max-w-[520px] items-center justify-between rounded-2xl px-5 py-4 text-[15px] font-extrabold shadow-flotante"
            style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
          >
            <span>Ver pedido · {cantidadTotal}</span>
            <span className="tabular-nums">{fmtColones(total)} →</span>
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
            className="w-full max-w-[520px] rounded-t-3xl p-5 sm:rounded-3xl"
            style={{ background: paleta.fondo, color: paleta.tinta, border: `1px solid ${paleta.borde}` }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold">Tu pedido · Mesa {mesa}</h2>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-[22px] leading-none">
                ×
              </button>
            </div>
            <ul className="mt-3 flex max-h-[38vh] flex-col gap-2 overflow-y-auto">
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
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-[16px] font-extrabold" style={{ borderColor: paleta.borde }}>
              <span>Total</span>
              <span className="tabular-nums">{fmtColones(total)}</span>
            </div>
            <div className="mt-4 grid gap-3">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={TOPES.pedidoNombre}
                placeholder="Tu nombre (opcional)"
                className="w-full rounded-xl border px-3.5 py-3 text-[15px] outline-none"
                style={{ background: paleta.superficie, borderColor: paleta.borde, color: paleta.tinta }}
              />
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={TOPES.pedidoNota}
                rows={2}
                placeholder="Algo que debamos saber (sin cebolla, alergias…)"
                className="w-full rounded-xl border px-3.5 py-3 text-[14px] outline-none"
                style={{ background: paleta.superficie, borderColor: paleta.borde, color: paleta.tinta }}
              />
            </div>
            {error && <p className="mt-3 rounded-xl bg-red-600/15 p-3 text-[13px] font-bold text-red-200">{error}</p>}
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || renglones.length === 0}
              className="presionable mt-4 w-full rounded-2xl py-4 text-[15px] font-extrabold disabled:opacity-60"
              style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
            >
              {enviando ? "Enviando…" : `Enviar pedido · ${fmtColones(total)}`}
            </button>
            <p className="mt-2 text-center text-[11.5px]" style={{ color: paleta.suave }}>
              El pago es en el local. Esto solo avisa a la cocina.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
