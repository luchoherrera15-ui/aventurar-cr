"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generarConIA, type ResumenGeneracion } from "@/app/celebrar/editor/ia-acciones";
import { BOTS_EN_ORDEN, BOTS_IA, BOT_POR_DEFECTO, type BotIA } from "@/lib/celebrar/ia-modelos";
import { DATOS_IA_VACIOS, ESTILOS_IA, SECCIONES_IA, TONOS_TEXTO_IA, armarPedidoIA, type DatosIA, type EstiloIA, type SeccionIA } from "@/lib/celebrar/ia-prompt";
import { RUTA } from "@/lib/celebrar/rutas";
import { EnlaceCelebrar } from "../rutas-cliente";

/**
 * ══════════════════════════════════════════════════════════════════
 *  CREAR CON IA — datos → pedido → bot
 * ══════════════════════════════════════════════════════════════════
 *
 * Tres pasos en una tarjeta:
 *   1. DATOS: quién celebra, cuántos años, estilo, colores, tono, qué
 *      secciones y algo más que quieran contar (fecha y lugar vienen de
 *      la celebración). Nada de escribir un prompt en blanco.
 *   2. EL PEDIDO: el texto que se le va a pedir al bot, armado desde los
 *      datos y editable, para que la persona sepa exactamente qué pidió.
 *   3. EL BOT: Chispa, Musa o Maestra, cada uno con su precio fijo en
 *      créditos. Ni modelos ni costos internos (decisión del dueño).
 */
export default function CrearConIA({
  celebracionId,
  inicial,
  tieneDocumento,
  saldo,
}: {
  celebracionId: string;
  /** Lo que ya se sabe de la celebración: nombre, tipo, fecha, hora, lugar. */
  inicial: Partial<DatosIA>;
  tieneDocumento: boolean;
  saldo: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [paso, setPaso] = useState<1 | 2>(1);
  const [datos, setDatos] = useState<DatosIA>({ ...DATOS_IA_VACIOS, ...inicial });
  const [pedido, setPedido] = useState("");
  const [pedidoTocado, setPedidoTocado] = useState(false);
  const [bot, setBot] = useState<BotIA>(BOT_POR_DEFECTO);
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<number | null>(null);
  const [listo, setListo] = useState<ResumenGeneracion | null>(null);

  // El pedido sigue a los datos mientras la persona no lo haya editado a mano.
  const pedidoMostrado = pedidoTocado ? pedido : armarPedidoIA(datos);

  const ficha = BOTS_IA[bot];
  const alcanza = saldo >= ficha.creditos;

  function alternar<T extends string>(lista: T[], v: T): T[] {
    return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
  }

  function generar() {
    if (tieneDocumento && !window.confirm(`Vas a reemplazar el diseño actual por uno creado por ${ficha.nombre} (${ficha.creditos} créditos). ¿Seguimos?`)) return;
    setError(null);
    setFaltan(null);
    iniciar(async () => {
      const r = await generarConIA(celebracionId, { prompt: pedidoMostrado, datos }, bot);
      if (!r.ok) {
        setError(r.mensaje);
        if (r.faltan) setFaltan(r.faltan);
        return;
      }
      setListo(r.resumen);
    });
  }

  const campo = "w-full rounded-xl border border-(--c-marino-medio) bg-(--c-marino-profundo) px-3 py-2.5 text-[14px] text-(--c-blanco) placeholder:text-(--c-sobre-marino-suave) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--c-blanco)";
  const etiqueta = "c-montserrat text-[12px] font-semibold text-(--c-sobre-marino-suave)";

  if (listo) {
    return (
      <section className="sobre-oscuro rounded-[var(--c-radio-tarjeta)] bg-(--c-marino) p-6 text-(--c-blanco)">
        <p className="c-montserrat inline-flex items-center gap-2 rounded-lg bg-(--c-marino-medio) px-3 py-1.5 text-[12px] font-semibold text-(--c-sobre-marino-suave)">
          <span className="h-1.5 w-1.5 rounded-full bg-(--c-coral)" aria-hidden="true" />
          Crear con IA
        </p>
        <h2 className="mt-4 text-xl leading-tight">¡{listo.nombreBot} terminó tu invitación!</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">
          Se usaron {listo.creditos} créditos · te quedan {listo.saldo}. Es un diseño tuyo, como cualquier plantilla: en el editor cambiás textos, colores, letras, fotos, música y secciones, y hasta lo guardás como plantilla.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              router.push(window.location.pathname);
              router.refresh();
            }}
            className="c-boton c-boton-claro min-h-10 text-[13px]"
          >
            Abrir el editor
          </button>
          <button type="button" onClick={() => setListo(null)} className="c-boton c-boton-fantasma min-h-10 text-[13px]">
            Pedir otra versión
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="sobre-oscuro rounded-[var(--c-radio-tarjeta)] bg-(--c-marino) p-6 text-(--c-blanco)">
      <div className="flex items-center justify-between gap-3">
        <p className="c-montserrat inline-flex items-center gap-2 rounded-lg bg-(--c-marino-medio) px-3 py-1.5 text-[12px] font-semibold text-(--c-sobre-marino-suave)">
          <span className="h-1.5 w-1.5 rounded-full bg-(--c-coral)" aria-hidden="true" />
          Crear con IA
        </p>
        <p className="c-montserrat text-[12px] text-(--c-sobre-marino-suave)">Paso {paso} de 2</p>
      </div>

      {paso === 1 ? (
        <>
          <h2 className="mt-4 text-xl leading-tight">Contanos de la celebración</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">Con esto armamos el pedido. Fecha y lugar ya los tomamos de la celebración.</p>

          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <label className="grid gap-1">
                <span className={etiqueta}>¿Quién celebra?</span>
                <input value={datos.quien} onChange={(e) => setDatos({ ...datos, quien: e.target.value })} maxLength={120} placeholder="Mateo · Sofía & Andrés · Grupo Aurora" className={campo} />
              </label>
              <label className="grid gap-1">
                <span className={etiqueta}>¿Cuántos años? (si aplica)</span>
                <input value={datos.edad} onChange={(e) => setDatos({ ...datos, edad: e.target.value })} maxLength={40} placeholder="7 · 15 · 25 años de casados" className={campo} />
              </label>
            </div>

            <div>
              <p className={etiqueta}>Estilo (elegí uno o dos)</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {ESTILOS_IA.map(([id, t]) => (
                  <Chip key={id} activo={datos.estilos.includes(id)} onClick={() => setDatos({ ...datos, estilos: alternar<EstiloIA>(datos.estilos, id).slice(-2) })}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className={etiqueta}>Colores</span>
                <input value={datos.colores} onChange={(e) => setDatos({ ...datos, colores: e.target.value })} maxLength={160} placeholder="verde selva y naranja · marfil y oro" className={campo} />
              </label>
              <label className="grid gap-1">
                <span className={etiqueta}>Tono de los textos</span>
                <select value={datos.tono} onChange={(e) => setDatos({ ...datos, tono: e.target.value as DatosIA["tono"] })} className={`${campo} min-h-[42px]`}>
                  {TONOS_TEXTO_IA.map(([id, t]) => (
                    <option key={id} value={id}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <p className={etiqueta}>Qué secciones querés (portada, fecha y confirmación van siempre)</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SECCIONES_IA.map(([id, t]) => (
                  <Chip key={id} activo={datos.secciones.includes(id)} onClick={() => setDatos({ ...datos, secciones: alternar<SeccionIA>(datos.secciones, id) })}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>

            <label className="grid gap-1">
              <span className={etiqueta}>Algo más que quieras contar (opcional)</span>
              <textarea
                value={datos.extra}
                onChange={(e) => setDatos({ ...datos, extra: e.target.value })}
                rows={3}
                maxLength={800}
                placeholder="Le encantan los dinosaurios · Nos conocimos en un concierto · Es la gala anual de la empresa…"
                className={`${campo} leading-relaxed`}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setPaso(2)} className="c-boton c-boton-claro min-h-10 text-[13px]">
              Ver el pedido →
            </button>
            <span className="text-[12px] text-(--c-sobre-marino-suave)">Después elegís quién lo hace y cuánto cuesta.</span>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-4 text-xl leading-tight">Así se lo vamos a pedir</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">Leelo y cambiá lo que querás. Es exactamente lo que recibe el bot.</p>
          <textarea
            value={pedidoMostrado}
            onChange={(e) => {
              setPedido(e.target.value);
              setPedidoTocado(true);
            }}
            rows={6}
            maxLength={1500}
            className={`${campo} mt-3 leading-relaxed`}
          />
          {pedidoTocado && (
            <button
              type="button"
              onClick={() => setPedidoTocado(false)}
              className="mt-1 text-[12px] text-(--c-sobre-marino-suave) underline underline-offset-4"
            >
              Volver a armarlo desde los datos
            </button>
          )}

          <p className={`${etiqueta} mt-5`}>¿Quién lo hace?</p>
          <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Bot">
            {BOTS_EN_ORDEN.map((id) => {
              const b = BOTS_IA[id];
              const activo = bot === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setBot(id)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
                    activo ? "border-(--c-blanco) bg-(--c-marino-medio)" : "border-(--c-marino-medio) hover:border-(--c-sobre-marino-suave)"
                  }`}
                >
                  <span className="c-ia-pastilla mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-(--c-blanco)" aria-hidden="true">
                    {b.nombre[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="c-montserrat text-[14px] font-bold">{b.nombre}</span>
                      <span className="text-[12px] text-(--c-sobre-marino-suave)">{b.lema}</span>
                      {b.recomendada && <span className="c-pastilla">Recomendada</span>}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-(--c-sobre-marino-suave)">{b.detalle}</span>
                  </span>
                  <span className="c-montserrat shrink-0 text-[13px] font-bold">{b.creditos} cr.</span>
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[13px] text-(--c-coral-tinta)">
              {error}
              {faltan !== null && (
                <>
                  {" "}
                  <EnlaceCelebrar a={RUTA.appCreditos} className="font-semibold underline underline-offset-4">
                    Conseguir {faltan} créditos
                  </EnlaceCelebrar>
                </>
              )}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setPaso(1)} className="c-boton c-boton-fantasma min-h-10 text-[13px]">
              ← Datos
            </button>
            {alcanza ? (
              <button type="button" onClick={generar} disabled={pendiente || pedidoMostrado.trim().length < 10} className="c-boton c-boton-claro min-h-10 text-[13px]">
                {pendiente ? `${ficha.nombre} está creando… (20–40 s)` : `Crear con ${ficha.nombre} · ${ficha.creditos} créditos`}
              </button>
            ) : (
              <EnlaceCelebrar a={RUTA.appCreditos} className="c-boton c-boton-claro min-h-10 text-[13px]">
                Conseguir créditos ({ficha.creditos - saldo} más)
              </EnlaceCelebrar>
            )}
            <span className="text-[12px] text-(--c-sobre-marino-suave)">Tu saldo: {saldo} créditos.</span>
          </div>
        </>
      )}
    </section>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`c-montserrat min-h-8 rounded-lg px-2.5 text-[12.5px] font-semibold transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
        activo ? "bg-(--c-blanco) text-(--c-marino)" : "border border-(--c-marino-medio) text-(--c-sobre-marino-suave) hover:border-(--c-sobre-marino-suave) hover:text-(--c-blanco)"
      }`}
    >
      {children}
    </button>
  );
}
