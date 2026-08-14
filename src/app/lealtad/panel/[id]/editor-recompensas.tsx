"use client";

import { useState } from "react";
import { pideRecompensa } from "@/lib/lealtad/editable";
import { TIPOS_TARJETA, tipoDe, UNIDAD_SALDO } from "@/lib/lealtad/tipos-tarjeta";
import { usePrograma } from "./programa-contexto";
import type { RecompensaFila, RecompensaInput, TipoRecompensa } from "./pases-actions";

/**
 * QUÉ SE LLEVA EL CLIENTE — el editor que no existía.
 *
 * ------------------------------------------------------------------
 * QUÉ REEMPLAZA
 * ------------------------------------------------------------------
 * La sección «Recompensas» del panel del negocio mostraba… el
 * asistente para crear OTRA tarjeta. El dueño que quería cambiar «Café
 * gratis a los 10» por «Corte gratis a los 8» entraba, se encontraba
 * con un formulario de cinco pasos para armar una tarjeta nueva, y si
 * su paquete estaba en el tope el asistente ni siquiera lo dejaba
 * terminar. La regalía que ya tenía no se podía tocar desde ninguna
 * pantalla del panel: `agregarRecompensa` y `borrarRecompensa` solo se
 * invocaban desde el panel de administración de Bookea.
 *
 * ------------------------------------------------------------------
 * EDITAR, NO BORRAR-Y-VOLVER-A-ESCRIBIR
 * ------------------------------------------------------------------
 * Cada fila se edita en su lugar. Borrar y re-crear parece lo mismo y
 * no lo es: la recompensa es la META de la tarjeta, y durante el rato
 * en que está borrada el programa no promete nada — un canje que caiga
 * justo ahí se rechaza.
 *
 * Los campos de la 0125 (tipo, stock, SKU, instrucciones) NO se pierden
 * al editar el nombre o el costo: se vuelven a mandar tal como estaban.
 * `guardarRecompensa` reemplaza la fila entera, así que omitirlos sería
 * borrarlos sin decirlo.
 */

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-white px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const ayudaCls = "mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft";

const TIPOS_UI: { id: TipoRecompensa; label: string }[] = [
  { id: "producto", label: "Producto gratis" },
  { id: "servicio", label: "Servicio gratis" },
  { id: "descuento_porcentaje", label: "Descuento %" },
  { id: "descuento_fijo", label: "Descuento ₡" },
  { id: "personalizada", label: "Otro beneficio" },
];

const NUEVA_VACIA = {
  nombre: "",
  costo: "",
  tipo: null as TipoRecompensa | null,
  valor: "",
  stock: "",
  limite: "",
  sku: "",
  instrucciones: "",
};

function num(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

/** Lo que YA tenía la fila, para no borrarlo al editar dos campos. */
function conservando(r: RecompensaFila, cambios: Partial<RecompensaInput>): RecompensaInput {
  return {
    nombre: r.nombre,
    descripcion: r.descripcion ?? "",
    costoPuntos: r.costo_puntos,
    activo: r.activo,
    tipo: (r.tipo as TipoRecompensa | null) ?? null,
    valor: r.valor ?? null,
    stockTotal: r.stock_total ?? null,
    limitePorCliente: r.limite_por_cliente ?? null,
    sku: r.sku ?? "",
    instrucciones: r.instrucciones ?? "",
    ...cambios,
  };
}

export default function EditorRecompensas() {
  const { programa, recompensas, meta, ocupado, agregarRecompensa, editarRecompensa, borrarRecompensa } =
    usePrograma();
  const [nueva, setNueva] = useState(NUEVA_VACIA);
  const [masOpciones, setMasOpciones] = useState(false);

  if (!programa) {
    return (
      <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
        Todavía no hay una tarjeta que premiar. Creá la primera y volvé acá.
      </p>
    );
  }

  const tipo = tipoDe(programa.modo);
  const unidad = UNIDAD_SALDO[tipo];

  // ── Los seis tipos que no usan recompensas ─────────────────────────
  // Un cupón ES el descuento; una membresía ES el carnet; un evento ES
  // la entrada. Ofrecerles un editor de regalías los manda a configurar
  // algo que su pase no muestra, y dejarles la sección vacía los deja
  // pensando que falta algo. Se dice cuál es su caso y dónde se edita.
  if (!pideRecompensa(tipo)) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <h3 className="text-[15px] font-bold text-aventurea-ink">
          Tu {TIPOS_TARJETA[tipo].nombre.toLowerCase()} lleva el beneficio adentro
        </h3>
        <p className={ayudaCls}>
          {TIPOS_TARJETA[tipo].descripcion} No hace falta una lista de regalías: lo que se
          lleva el cliente se configura en <strong>Qué se gana</strong>, dentro de la
          tarjeta.
        </p>
        {recompensas.length > 0 && (
          <>
            <p className="mt-4 text-[12.5px] font-bold text-aventurea-ink">
              Igual tenés estas regalías cargadas:
            </p>
            <ListaRecompensas
              recompensas={recompensas}
              metaId={meta?.id ?? null}
              unidad={unidad}
              ocupado={ocupado}
              alEditar={editarRecompensa}
              alBorrar={borrarRecompensa}
            />
          </>
        )}
      </div>
    );
  }

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
    setNueva(NUEVA_VACIA);
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Qué se gana</h3>
      <p className={ayudaCls}>
        La recompensa <strong>más barata que esté activa</strong> es la meta de la tarjeta:
        si cuesta 10, el pase muestra «5 de 10» y promete esa regalía. Las demás se canjean
        cuando el cliente llega a su costo.
      </p>

      {recompensas.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-aventurea-line px-3.5 py-3 text-[12.5px] font-bold text-aventurea-ink-soft">
          Sin ninguna recompensa activa, la tarjeta no promete nada — y el programa no se
          puede activar.
        </p>
      ) : (
        <ListaRecompensas
          recompensas={recompensas}
          metaId={meta?.id ?? null}
          unidad={unidad}
          ocupado={ocupado}
          alEditar={editarRecompensa}
          alBorrar={borrarRecompensa}
        />
      )}

      {/* ── Agregar una ─────────────────────────────────────────── */}
      <div className="mt-5 border-t border-aventurea-line pt-4">
        <p className={labelCls}>Agregar una regalía</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
            placeholder="Tu bebida favorita gratis"
            aria-label="Nombre de la regalía nueva"
            className={`${inputCls} flex-1`}
          />
          <input
            type="number"
            min={1}
            value={nueva.costo}
            onChange={(e) => setNueva({ ...nueva, costo: e.target.value })}
            placeholder="10"
            aria-label={`Cuántos ${unidad} cuesta`}
            className={`${inputCls} w-28`}
          />
          <button
            type="button"
            onClick={agregar}
            disabled={ocupado || !nueva.nombre.trim() || !nueva.costo}
            className="presionable shrink-0 rounded-[10px] bg-aventurea-ink px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
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
              <label className={labelCls} htmlFor="er-tipo">Tipo</label>
              <select
                id="er-tipo"
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
                <label className={labelCls} htmlFor="er-valor">
                  {nueva.tipo === "descuento_porcentaje" ? "Descuento (%)" : "Descuento (₡)"}
                </label>
                <input
                  id="er-valor"
                  type="number"
                  min={1}
                  value={nueva.valor}
                  onChange={(e) => setNueva({ ...nueva, valor: e.target.value })}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls} htmlFor="er-stock">Stock total</label>
              <input
                id="er-stock"
                type="number"
                min={1}
                value={nueva.stock}
                onChange={(e) => setNueva({ ...nueva, stock: e.target.value })}
                placeholder="Vacío = sin límite"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="er-limite">Máximo por cliente</label>
              <input
                id="er-limite"
                type="number"
                min={1}
                value={nueva.limite}
                onChange={(e) => setNueva({ ...nueva, limite: e.target.value })}
                placeholder="Vacío = sin límite"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="er-sku">SKU / código en tu POS</label>
              <input
                id="er-sku"
                value={nueva.sku}
                onChange={(e) => setNueva({ ...nueva, sku: e.target.value })}
                placeholder="Opcional"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="er-inst">Instrucciones para el personal</label>
              <input
                id="er-inst"
                value={nueva.instrucciones}
                onChange={(e) => setNueva({ ...nueva, instrucciones: e.target.value })}
                placeholder="Ej. aplicar en caja como cortesía"
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      {tipo === "sellos" && (
        <p className={ayudaCls}>
          En una tarjeta de sellos, la meta y el nombre de la regalía también se escriben en{" "}
          <strong>Qué se gana</strong>. Manda lo último que guardes: el pase del cliente
          siempre sigue a la recompensa más barata que esté activa.
        </p>
      )}
    </div>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────

function ListaRecompensas({
  recompensas,
  metaId,
  unidad,
  ocupado,
  alEditar,
  alBorrar,
}: {
  recompensas: RecompensaFila[];
  metaId: string | null;
  unidad: string;
  ocupado: boolean;
  alEditar: (id: string, datos: RecompensaInput) => void;
  alBorrar: (id: string) => void;
}) {
  return (
    <ul className="mt-4 space-y-2">
      {recompensas.map((r) => (
        <li key={r.id}>
          <FilaRecompensa
            recompensa={r}
            esMeta={r.id === metaId}
            unidad={unidad}
            ocupado={ocupado}
            alEditar={alEditar}
            alBorrar={alBorrar}
          />
        </li>
      ))}
    </ul>
  );
}

function FilaRecompensa({
  recompensa: r,
  esMeta,
  unidad,
  ocupado,
  alEditar,
  alBorrar,
}: {
  recompensa: RecompensaFila;
  esMeta: boolean;
  unidad: string;
  ocupado: boolean;
  alEditar: (id: string, datos: RecompensaInput) => void;
  alBorrar: (id: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [nombre, setNombre] = useState(r.nombre);
  const [costo, setCosto] = useState(String(r.costo_puntos));
  const [confirmar, setConfirmar] = useState(false);

  const sucio = nombre.trim() !== r.nombre || Math.round(num(costo)) !== r.costo_puntos;

  return (
    <div className="rounded-xl border border-aventurea-line bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-[13.5px] font-bold text-aventurea-ink">
          {r.nombre}
          {esMeta && (
            <span className="ml-2 rounded-lg bg-aventurea-green-light px-2 py-0.5 text-[10.5px] font-bold text-aventurea-green">
              meta de la tarjeta
            </span>
          )}
          {!r.activo && (
            <span className="ml-2 rounded-lg bg-zinc-100 px-2 py-0.5 text-[10.5px] font-bold text-zinc-600">
              apagada
            </span>
          )}
        </span>
        <span className="text-[12.5px] text-aventurea-ink-soft">
          {r.costo_puntos} {unidad}
        </span>
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="text-[12.5px] font-bold text-aventurea-ink underline"
        >
          {abierta ? "Cerrar" : "Cambiar"}
        </button>
      </div>

      {abierta && (
        <div className="mt-3 border-t border-aventurea-line pt-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              aria-label="Nombre de la regalía"
              className={`${inputCls} flex-1`}
            />
            <input
              type="number"
              min={1}
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              aria-label={`Cuántos ${unidad} cuesta`}
              className={`${inputCls} w-28`}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                alEditar(
                  r.id,
                  conservando(r, {
                    nombre: nombre.trim(),
                    costoPuntos: Math.round(num(costo)),
                  }),
                )
              }
              disabled={ocupado || !sucio || !nombre.trim() || Math.round(num(costo)) < 1}
              className="presionable rounded-[10px] bg-aventurea-ink px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              Guardar cambios
            </button>

            {/* Apagar en vez de borrar es la salida amable: la regalía
                deja de ser la meta pero su historial de canjes sigue
                colgado de una fila que existe. */}
            <button
              type="button"
              onClick={() => alEditar(r.id, conservando(r, { activo: !r.activo }))}
              disabled={ocupado}
              className="presionable rounded-[10px] border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink"
            >
              {r.activo ? "Apagar" : "Encender"}
            </button>

            <span className="flex-1" />

            {confirmar ? (
              <span className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-aventurea-ink-soft">
                  ¿Borrarla?
                </span>
                <button
                  type="button"
                  onClick={() => alBorrar(r.id)}
                  disabled={ocupado}
                  className="presionable rounded-[10px] bg-red-700 px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmar(false)}
                  className="text-[12.5px] font-bold text-aventurea-ink-soft underline"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmar(true)}
                disabled={ocupado}
                className="text-[12.5px] font-bold text-red-700 underline"
              >
                Quitar
              </button>
            )}
          </div>

          {esMeta && (
            <p className={ayudaCls}>
              Es la que marca la meta del pase. Al cambiarle el costo, las tarjetas que ya
              están en teléfonos ajenos pasan a mostrar el número nuevo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
