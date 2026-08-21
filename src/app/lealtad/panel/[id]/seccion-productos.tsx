"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import {
  CAMPO_PANEL,
  CUERPO_SUAVE,
  ESTADO_AVISO,
  RADIO_TILE,
  ROTULO_CAMPO,
} from "@/components/panel/sistema";
import { formatearCRC } from "@/lib/dinero";
import {
  TOPE_NOMBRE_PRODUCTO,
  TOPE_PRODUCTOS,
  leerPrecioColones,
  type ProductoCatalogo,
} from "@/lib/lealtad/productos";
import { ACCION, ACCION_BORDE, ACCION_TINTA, ACCION_TINTE, BOTON_ACCION, BOTON_LEALTAD } from "../sistema-lealtad";
import {
  actualizarProducto,
  agregarProducto,
  eliminarProducto,
} from "./productos-actions";

/**
 * PRODUCTOS — dónde el dueño dice cuánto vale lo que vende (0198).
 *
 * ------------------------------------------------------------------
 * LA PREGUNTA QUE ESTA PANTALLA CONTESTA
 * ------------------------------------------------------------------
 * «¿Dónde configuro los precios de lo que se vende?» Hasta la 0198 no
 * había respuesta: el mostrador tecleaba el monto en cada venta y el
 * producto era texto libre, así que el mismo café aparecía escrito de
 * tres formas en el reporte y nadie podía revisar un precio.
 *
 * Con el catálogo cargado, en la caja se elige de una lista y el monto
 * se rellena solo. Sin catálogo, TODO sigue igual que antes — y eso la
 * pantalla lo dice con todas sus letras en el estado vacío, porque un
 * dueño que cree que sin cargar productos deja de poder cobrar es un
 * dueño que no vuelve a entrar acá.
 *
 * El tope (100) y la autorización los hace cumplir el servidor
 * (`productos-actions.ts`); esta pantalla los PINTA para que nadie
 * choque contra un botón que iba a fallar. Misma construcción que
 * `seccion-ubicaciones.tsx`.
 */

export default function SeccionProductos({
  ranchoId,
  iniciales,
}: {
  ranchoId: string;
  /** null = la tabla no existe todavía (la 0198 se aplica aparte). */
  iniciales: ProductoCatalogo[] | null;
}) {
  const [lista, setLista] = useState<ProductoCatalogo[]>(iniciales ?? []);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [precioEditado, setPrecioEditado] = useState("");
  const [ocupado, iniciar] = useTransition();

  // ── La tabla todavía no existe: aviso neutro y el panel sigue ─────
  // Mismo criterio degradable del resto del módulo (errores-base.ts):
  // la migración la aplica Bookea aparte, y mientras tanto esta sección
  // no puede tumbar nada ni prometer que guarda.
  if (iniciales === null) {
    return (
      <CardVacia>
        El catálogo de productos todavía no está disponible en tu panel. El equipo de Bookea lo
        está habilitando — mientras tanto seguís cobrando escribiendo el monto a mano, igual que
        siempre.
      </CardVacia>
    );
  }

  const lleno = lista.length >= TOPE_PRODUCTOS;
  const activos = lista.filter((p) => p.activo).length;
  const lecturaPrecio = leerPrecioColones(precio);
  const formularioValido =
    nombre.trim().length > 0 && nombre.trim().length <= TOPE_NOMBRE_PRODUCTO && lecturaPrecio.ok;

  /** Todas las acciones terminan igual: lista nueva, o el motivo. */
  function aplicar(
    accion: () => Promise<{ ok: true; datos: ProductoCatalogo[] } | { ok: false; motivo: string }>,
    exito: string,
    despues?: () => void,
  ) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const res = await accion();
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setLista(res.datos);
      setAviso(exito);
      despues?.();
    });
  }

  function agregar(e: FormEvent) {
    e.preventDefault();
    aplicar(
      () => agregarProducto(ranchoId, { nombre: nombre.trim(), precio }),
      "Producto agregado. Ya aparece en la caja para cobrarlo.",
      () => {
        setNombre("");
        setPrecio("");
      },
    );
  }

  function guardarPrecio(id: string) {
    const lectura = leerPrecioColones(precioEditado);
    if (!lectura.ok) {
      setError(lectura.motivo);
      return;
    }
    aplicar(
      () => actualizarProducto(ranchoId, id, { precio: precioEditado }),
      "Precio actualizado. Las ventas que ya se registraron no cambian.",
      () => {
        setEditando(null);
        setPrecioEditado("");
      },
    );
  }

  function alternarActivo(p: ProductoCatalogo) {
    aplicar(
      () => actualizarProducto(ranchoId, p.id, { activo: !p.activo }),
      p.activo
        ? `«${p.nombre}» salió del menú. Sus ventas anteriores se conservan.`
        : `«${p.nombre}» vuelve a estar disponible en la caja.`,
    );
  }

  function borrar(p: ProductoCatalogo) {
    setConfirmando(null);
    aplicar(
      () => eliminarProducto(ranchoId, p.id),
      `«${p.nombre}» se eliminó del catálogo. Las ventas que generó siguen en tu reporte.`,
    );
  }

  return (
    <>
      {/* ── El catálogo ───────────────────────────────────────────── */}
      <Card
        eyebrow="Tu menú"
        titulo="Productos y precios"
        nivel="h3"
        accion={
          <PildoraEstado estado={lleno ? "aviso" : "neutro"}>
            {lista.length} de {TOPE_PRODUCTOS}
          </PildoraEstado>
        }
      >
        {lista.length === 0 ? (
          <p className={CUERPO_SUAVE}>
            Todavía no cargaste productos — podés seguir cobrando escribiendo el monto a mano.
            Cuando cargues el primero, en la caja te aparece una lista y el monto se llena solo.
          </p>
        ) : (
          <>
            <p className={CUERPO_SUAVE}>
              {activos === 0
                ? "Ninguno está activo: en la caja se sigue escribiendo el monto a mano."
                : `${activos} ${activos === 1 ? "producto activo" : "productos activos"} en la caja. Al elegir uno, el monto se llena solo y queda editable — una venta puede llevar dos.`}
            </p>

            <ul className="mt-3 flex flex-col">
              {lista.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-aventurea-line py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[13.5px] font-extrabold leading-tight ${
                        p.activo ? "text-aventurea-ink" : "text-aventurea-ink-soft line-through"
                      }`}
                    >
                      {p.nombre}
                    </p>
                    {editando === p.id ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <label htmlFor={`precio-${p.id}`} className="sr-only">
                          Precio de {p.nombre} en colones
                        </label>
                        <input
                          id={`precio-${p.id}`}
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={precioEditado}
                          onChange={(e) => setPrecioEditado(e.target.value)}
                          className={`w-[130px] ${CAMPO_PANEL}`}
                        />
                        <button
                          type="button"
                          onClick={() => guardarPrecio(p.id)}
                          disabled={ocupado}
                          className={BOTON_ACCION}
                          style={{ background: ACCION, color: ACCION_TINTA }}
                        >
                          {ocupado ? "Guardando…" : "Guardar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(null);
                            setError(null);
                          }}
                          className={BOTON_LEALTAD}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <p className={`mt-0.5 ${CUERPO_SUAVE}`}>
                        {formatearCRC(p.precio)}
                        {p.activo ? "" : " · fuera del menú"}
                      </p>
                    )}
                  </div>

                  {editando !== p.id && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(p.id);
                          setPrecioEditado(String(p.precio));
                          setConfirmando(null);
                          setError(null);
                        }}
                        disabled={ocupado}
                        aria-label={`Cambiar el precio de ${p.nombre}`}
                        className={BOTON_LEALTAD}
                      >
                        Cambiar precio
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarActivo(p)}
                        disabled={ocupado}
                        aria-label={
                          p.activo
                            ? `Sacar ${p.nombre} del menú`
                            : `Volver a poner ${p.nombre} en el menú`
                        }
                        className={BOTON_LEALTAD}
                      >
                        {p.activo ? "Desactivar" : "Activar"}
                      </button>

                      {confirmando === p.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-aventurea-ink">
                            ¿Eliminarlo?
                          </span>
                          <button
                            type="button"
                            onClick={() => borrar(p)}
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
                          onClick={() => setConfirmando(p.id)}
                          disabled={ocupado}
                          aria-label={`Eliminar ${p.nombre} del catálogo`}
                          className={BOTON_LEALTAD}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* ── Alta ──────────────────────────────────────────────────── */}
      <Card eyebrow="Producto nuevo" titulo="Agregá lo que vendés" nivel="h3">
        <form onSubmit={agregar} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div>
              <label htmlFor="producto-nombre" className={ROTULO_CAMPO}>
                Nombre del producto
              </label>
              <input
                id="producto-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={TOPE_NOMBRE_PRODUCTO}
                placeholder="Capuchino grande"
                className={`mt-1 ${CAMPO_PANEL}`}
              />
            </div>
            <div>
              <label htmlFor="producto-precio" className={ROTULO_CAMPO}>
                Precio (₡)
              </label>
              <input
                id="producto-precio"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="2500"
                aria-describedby="producto-precio-ayuda"
                className={`mt-1 ${CAMPO_PANEL}`}
              />
            </div>
          </div>

          <p
            id="producto-precio-ayuda"
            className={`${RADIO_TILE} border px-3 py-2.5 text-[12px] leading-snug text-aventurea-ink`}
            style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
          >
            En colones enteros, sin céntimos. Este precio es el que se propone en la caja: el
            empleado lo puede corregir si la venta lleva más de uno.
          </p>

          <button
            type="submit"
            disabled={ocupado || lleno || !formularioValido}
            className={BOTON_ACCION}
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            {ocupado ? "Guardando…" : "Agregar el producto"}
          </button>

          {lleno && (
            <p className={`${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.aviso}`}>
              Llegaste a {TOPE_PRODUCTOS} productos. Eliminá alguno para agregar otro.
            </p>
          )}

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
    </>
  );
}
