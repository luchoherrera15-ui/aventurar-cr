"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ModoPrograma } from "@/lib/wallet/tarjeta";
import type { ProgramaFila, RecompensaFila, TipoRecompensa } from "./pases-actions";
import { estadoDelPrograma } from "@/lib/lealtad/reglas";
import { TIPOS_TARJETA, tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import {
  AvisoError,
  AvisoGuardado,
  BarraGuardar,
  NotaCercania,
  ProveedorPrograma,
  usePrograma,
} from "./programa-contexto";
import { BloqueDiseno } from "./seccion-tarjeta-digital";

/**
 * «Tarjeta digital» ES el editor nuevo (seccion-tarjeta-digital.tsx).
 *
 * Se re-exporta desde acá para que la página no cambie de import: el
 * bloque viejo que vivía en este archivo —dos ruedas de color y un
 * campo pidiendo la URL del logo— ya no existe.
 */
export { default as SeccionTarjeta } from "./seccion-tarjeta-digital";

/**
 * El escáner se carga aparte y SOLO en el navegador.
 *
 * Arrastra `jsqr` y pide la cámara: nada de eso puede correr en el
 * servidor, y sobre todo, nada de eso puede tener la posibilidad de
 * tumbar el resto del panel. Cargándolo así, si la librería falla o el
 * dispositivo no tiene cámara, lo único que se pierde es el escáner —
 * la configuración del programa sigue en pie.
 */
const EscanerPanel = dynamic(() => import("./escaner-panel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <p className="text-[13px] font-bold text-aventurea-ink-soft">
        Preparando el escáner…
      </p>
    </div>
  ),
});

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const ayudaCls = "mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft";

const MODOS: { id: ModoPrograma; label: string; ayuda: string }[] = [
  {
    id: "sellos",
    label: "Sellos",
    ayuda: "«5 de 10» con círculos que se encienden. Cuántos hacen falta lo define la recompensa.",
  },
  {
    id: "cashback",
    label: "Cashback",
    ayuda: "«₡3.400 acumulados». Se usa con puntos por colón — 0.05 es devolver el 5%.",
  },
  { id: "puntos", label: "Puntos", ayuda: "«340 puntos». El clásico, sin meta visible." },
];

/** El alta de recompensa arranca simple; "más opciones" abre el resto. */
const RECOMPENSA_VACIA = {
  nombre: "",
  costo: "",
  tipo: null as TipoRecompensa | null,
  valor: "",
  stock: "",
  limite: "",
  sku: "",
  instrucciones: "",
};

const TIPOS_UI: { id: TipoRecompensa; label: string }[] = [
  { id: "producto", label: "Producto gratis" },
  { id: "servicio", label: "Servicio gratis" },
  { id: "descuento_porcentaje", label: "Descuento %" },
  { id: "descuento_fijo", label: "Descuento ₡" },
  { id: "personalizada", label: "Otro beneficio" },
];

function num(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pases de lealtad: el programa, su tarjeta de Wallet y las
 * recompensas.
 *
 * Lo que NO se edita acá es a propósito: cuántos sellos hacen falta y
 * qué regalía espera salen de la recompensa activa más barata. Si
 * fueran campos aparte, cambiar la recompensa dejaría la tarjeta
 * prometiendo lo viejo.
 *
 * ESTE componente es la vista de UNA sola página, la que usa el panel
 * de administración de Bookea (/admin/lealtad/[id]). El panel del
 * negocio no lo usa: reparte los mismos bloques entre las secciones
 * «Recompensas» y «Tarjeta digital» de su menú lateral, con el estado
 * compartido por <ProveedorPrograma> para que los dos «Guardar»
 * manden la fila completa y coherente.
 */
export default function PasesPanel({
  ranchoId,
  programaInicial,
  recompensasIniciales,
  tieneCercania,
}: {
  ranchoId: string;
  programaInicial: ProgramaFila | null;
  recompensasIniciales: RecompensaFila[];
  /** Complemento de pago (0123): el aviso en pantalla bloqueada. */
  tieneCercania: boolean;
}) {
  return (
    <ProveedorPrograma
      ranchoId={ranchoId}
      programaInicial={programaInicial}
      recompensasIniciales={recompensasIniciales}
      tieneCercania={tieneCercania}
    >
      <div className="space-y-6">
        <AvisoError />
        {/* Primero lo que se usa a diario: sumar el sello del cliente
            que está en el mostrador. La configuración se toca una vez. */}
        <EscanerDelPanel />
        <AvisoGuardado />
        <BloqueComoSeGana />
        <BloqueQueSeGana />
        <BloqueDiseno />
        <BloqueEstado />
        <BarraGuardar />
        <NotaCercania />
      </div>
    </ProveedorPrograma>
  );
}

// ── Las dos secciones del panel del negocio ───────────────────────

// Acá vivía `SeccionRecompensas`, el montaje que el panel del negocio
// usaba para su sección homónima. Ya no: esa sección la arma
// `editor-recompensas.tsx`, que conoce los ocho tipos y sabe EDITAR una
// regalía en vez de solo agregar y borrar. Este archivo quedó para lo
// que siempre fue, la pantalla única del panel de Bookea.

// ── Los bloques ───────────────────────────────────────────────────

function EscanerDelPanel() {
  const { ranchoId, programa, borrador, meta } = usePrograma();
  return (
    <EscanerPanel
      ranchoId={ranchoId}
      pideMonto={(programa?.modo ?? borrador.modo) !== "sellos"}
      recompensa={meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null}
    />
  );
}

function BloqueComoSeGana() {
  const { borrador, cambiar } = usePrograma();
  // ── LOS OTROS CINCO TIPOS NO SE TOCAN DESDE ACÁ ────────────────────
  // `MODOS` son tres y `ModoPrograma` son ocho desde la 0135. Esto era
  // un `.find(...)!` que con un cupón, un descuento, una membresía, un
  // evento o una gift card devolvía `undefined` y reventaba la pantalla
  // entera con un TypeError al leer `.ayuda`.
  //
  // Y ofrecer los tres botones tampoco servía: tocar cualquiera le
  // cambiaría el TIPO a una tarjeta que ya tiene gente adentro, que es
  // exactamente lo que el candado de `editable.ts` existe para impedir.
  // Se muestra el tipo y se manda a la pantalla que sabe editarlo.
  const modoActual = MODOS.find((m) => m.id === borrador.modo) ?? null;
  const tipo = TIPOS_TARJETA[tipoDe(borrador.modo)];

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Cómo se gana</h3>

      <div className="mt-4">
        <label className={labelCls}>Modo de la tarjeta</label>
        {modoActual ? (
          <>
            <div className="flex flex-wrap gap-2">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => cambiar({ modo: m.id })}
                  className={`rounded-xl border px-3 py-2 text-[12.5px] font-bold ${
                    borrador.modo === m.id
                      ? "border-aventurea-navy bg-aventurea-navy text-white"
                      : "border-aventurea-line bg-white text-aventurea-ink-soft"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className={ayudaCls}>{modoActual.ayuda}</p>
          </>
        ) : (
          <>
            <p className="rounded-xl border border-aventurea-line bg-white px-3 py-2.5 text-[13px] font-bold text-aventurea-ink">
              {tipo.nombre}
            </p>
            <p className={ayudaCls}>
              {tipo.descripcion} Su beneficio y sus reglas se editan desde la pantalla de la
              tarjeta, en el panel del negocio.
            </p>
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            {borrador.modo === "sellos" ? "Sellos por visita" : "Puntos por visita"}
          </label>
          <input
            type="number"
            min={0}
            value={borrador.puntosPorVisita}
            onChange={(e) => cambiar({ puntosPorVisita: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Puntos por cada colón</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={borrador.puntosPorColon}
            onChange={(e) => cambiar({ puntosPorColon: e.target.value })}
            placeholder="0.05 = 5% de vuelta"
            className={inputCls}
          />
        </div>
      </div>
      <p className={ayudaCls}>
        Se pueden combinar. Una barbería de sellos usa 1 por visita y 0 por colón; una
        cafetería de cashback usa 0 por visita y 0.05 por colón.
      </p>
    </div>
  );
}

function BloqueQueSeGana() {
  const { borrador, recompensas, meta, ocupado, agregarRecompensa, borrarRecompensa } =
    usePrograma();
  const [nueva, setNueva] = useState(RECOMPENSA_VACIA);
  const [masOpciones, setMasOpciones] = useState(false);

  function agregar() {
    agregarRecompensa({
      nombre: nueva.nombre,
      descripcion: "",
      costoPuntos: Math.round(num(nueva.costo)),
      activo: true,
      tipo: nueva.tipo,
      valor: num(nueva.valor),
      stockTotal: num(nueva.stock) === 0 ? null : num(nueva.stock) || null,
      limitePorCliente: num(nueva.limite) === 0 ? null : num(nueva.limite) || null,
      sku: nueva.sku,
      instrucciones: nueva.instrucciones,
    });
    setNueva(RECOMPENSA_VACIA);
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Qué se gana</h3>
      <p className={ayudaCls}>
        La recompensa <strong>más barata</strong> es la que marca la meta de la tarjeta. Si
        cuesta 10, la tarjeta muestra «5 de 10» y promete esa regalía.
      </p>

      {recompensas.length > 0 && (
        <ul className="mt-4 space-y-2">
          {recompensas.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-aventurea-line bg-white px-3 py-2"
            >
              <span className="flex-1 text-[13.5px] font-bold text-aventurea-ink">
                {r.nombre}
                {r.id === meta?.id && (
                  <span className="ml-2 rounded-lg bg-aventurea-green-light px-2 py-0.5 text-[10.5px] font-bold text-aventurea-green">
                    meta de la tarjeta
                  </span>
                )}
              </span>
              <span className="text-[12.5px] text-aventurea-ink-soft">
                {r.costo_puntos} {borrador.modo === "sellos" ? "sellos" : "puntos"}
              </span>
              <button
                type="button"
                onClick={() => borrarRecompensa(r.id)}
                disabled={ocupado}
                className="text-[12.5px] font-bold text-red-700 underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={nueva.nombre}
          onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
          placeholder="Tu bebida favorita gratis"
          className={`${inputCls} flex-1`}
        />
        <input
          type="number"
          min={1}
          value={nueva.costo}
          onChange={(e) => setNueva({ ...nueva, costo: e.target.value })}
          placeholder="10"
          className={`${inputCls} w-28`}
        />
        <button
          type="button"
          onClick={agregar}
          disabled={ocupado || !nueva.nombre.trim() || !nueva.costo}
          className="shrink-0 rounded-[10px] bg-aventurea-ink px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          Agregar
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMasOpciones((v) => !v)}
        className="mt-3 text-[12.5px] font-bold text-aventurea-ink-soft underline"
      >
        {masOpciones ? "Menos opciones" : "Más opciones (tipo, stock, POS…)"}
      </button>

      {masOpciones && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Tipo</label>
            <select
              value={nueva.tipo ?? ""}
              onChange={(e) =>
                setNueva({ ...nueva, tipo: (e.target.value || null) as TipoRecompensa | null })
              }
              className={inputCls}
            >
              <option value="">Sin especificar</option>
              {TIPOS_UI.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {(nueva.tipo === "descuento_porcentaje" || nueva.tipo === "descuento_fijo") && (
            <div>
              <label className={labelCls}>
                {nueva.tipo === "descuento_porcentaje" ? "Descuento (%)" : "Descuento (₡)"}
              </label>
              <input
                type="number"
                min={1}
                value={nueva.valor}
                onChange={(e) => setNueva({ ...nueva, valor: e.target.value })}
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Stock total</label>
            <input
              type="number"
              min={1}
              value={nueva.stock}
              onChange={(e) => setNueva({ ...nueva, stock: e.target.value })}
              placeholder="Vacío = sin límite"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Máximo por cliente</label>
            <input
              type="number"
              min={1}
              value={nueva.limite}
              onChange={(e) => setNueva({ ...nueva, limite: e.target.value })}
              placeholder="Vacío = sin límite"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>SKU / código en tu POS</label>
            <input
              value={nueva.sku}
              onChange={(e) => setNueva({ ...nueva, sku: e.target.value })}
              placeholder="Opcional"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Instrucciones para el personal</label>
            <input
              value={nueva.instrucciones}
              onChange={(e) => setNueva({ ...nueva, instrucciones: e.target.value })}
              placeholder="Ej. aplicar en caja como cortesía"
              className={inputCls}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * El ciclo de vida del programa (0125).
 *
 * Se exporta porque el panel del negocio lo monta SUELTO, en su sección
 * «Recompensas»: cuando el creador rechaza una tarjeta por el tope del
 * paquete, el aviso dice «archivá una desde Recompensas → Estado del
 * programa» — y durante un tiempo ese bloque no estaba en ninguna
 * sección del panel, así que la única salida que se le ofrecía al dueño
 * no existía en su pantalla.
 */
export function BloqueEstado() {
  const { programa, ocupado, cambiarEstado } = usePrograma();
  if (!programa) return null;

  const actual = estadoDelPrograma({
    estado: programa.estado ?? null,
    activo: programa.activo,
  });

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Estado del programa</h3>
      <p className={ayudaCls}>
        Solo el <strong>activo</strong> acumula y canjea. Pausar conserva todo; archivar
        con historial es para siempre — el historial nunca se borra.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["borrador", "Borrador"],
            ["activo", "Activo"],
            ["pausado", "Pausado"],
            ["archivado", "Archivado"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => cambiarEstado(id)}
            disabled={ocupado || actual === id}
            className={`rounded-xl border px-3 py-2 text-[12.5px] font-bold ${
              actual === id
                ? "border-aventurea-navy bg-aventurea-navy text-white"
                : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

