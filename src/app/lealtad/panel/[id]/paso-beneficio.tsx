"use client";

import type { ConfigBeneficio } from "@/lib/lealtad/tipos-tarjeta";

/**
 * PASO 3 DEL CREADOR: qué se gana.
 *
 * Ocho tipos, ocho formularios distintos. Se resuelve con un `switch`
 * sobre el tipo y no con un formulario genérico de campos opcionales:
 * un formulario que sirve para todo muestra «capacidad» en una tarjeta
 * de sellos y «sellos requeridos» en una gift card, y el negocio tiene
 * que adivinar cuáles le tocan.
 *
 * La validación de verdad NO está acá: está en `validarBeneficio()`
 * (src/lib/lealtad/tipos-tarjeta.ts), que corre en el servidor antes
 * de guardar. Esto solo ayuda a llegar bien — una petición armada a
 * mano se saltaría cualquier cosa que haga este archivo.
 */

const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris";
const ayuda = "mt-1.5 text-[12px] leading-relaxed text-bookea-gris";

/** Number input que no convierte "" en 0 mientras se escribe. */
function num(valor: string, porDefecto = 0): number {
  const n = Number(valor);
  return valor.trim() === "" || Number.isNaN(n) ? porDefecto : n;
}

export default function PasoBeneficio({
  config,
  alCambiar,
}: {
  config: ConfigBeneficio;
  alCambiar: (c: ConfigBeneficio) => void;
}) {
  switch (config.tipo) {
    case "sellos":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-req">
                Sellos para la regalía
              </label>
              <input
                id="b-req"
                type="number"
                min={1}
                max={100}
                value={config.requeridos}
                onChange={(e) => alCambiar({ ...config, requeridos: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-ini">
                Sellos de regalo al afiliarse
              </label>
              <input
                id="b-ini"
                type="number"
                min={0}
                value={config.inicial}
                onChange={(e) => alCambiar({ ...config, inicial: num(e.target.value) })}
                className={campo}
              />
              <p className={ayuda}>
                Arrancar con uno o dos hace que la tarjeta se sienta empezada — y las
                empezadas se terminan más.
              </p>
            </div>
          </Fila>
          <div>
            <label className={etiqueta} htmlFor="b-rec">
              Qué se gana
            </label>
            <input
              id="b-rec"
              value={config.recompensa}
              onChange={(e) => alCambiar({ ...config, recompensa: e.target.value })}
              placeholder="Tu bebida favorita gratis"
              className={campo}
            />
          </div>
          <Interruptor
            id="b-rep"
            titulo="Se puede repetir"
            detalle="Al completarla, arranca otra vuelta en vez de quedar terminada."
            activo={config.repetible}
            alCambiar={(v) => alCambiar({ ...config, repetible: v })}
          />
        </div>
      );

    case "puntos":
      return (
        <div className="space-y-4">
          <div>
            <label className={etiqueta} htmlFor="b-nom">
              Cómo se llaman
            </label>
            <input
              id="b-nom"
              value={config.nombre}
              onChange={(e) => alCambiar({ ...config, nombre: e.target.value })}
              placeholder="puntos, estrellas, granos…"
              className={campo}
            />
          </div>
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-visita">
                Por cada visita
              </label>
              <input
                id="b-visita"
                type="number"
                min={0}
                value={config.porVisita}
                onChange={(e) => alCambiar({ ...config, porVisita: num(e.target.value) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-colon">
                Por cada colón gastado
              </label>
              <input
                id="b-colon"
                type="number"
                min={0}
                step="0.01"
                value={config.porMoneda}
                onChange={(e) => alCambiar({ ...config, porMoneda: num(e.target.value) })}
                placeholder="0.05"
                className={campo}
              />
            </div>
          </Fila>
          <p className={ayuda}>
            Se combinan. Una barbería usa 1 por visita y 0 por colón; una cafetería usa 0
            por visita y 0.05 por colón.
          </p>
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-min">
                Mínimo para canjear
              </label>
              <input
                id="b-min"
                type="number"
                min={1}
                value={config.minimoCanje}
                onChange={(e) => alCambiar({ ...config, minimoCanje: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-max">
                Tope acumulable
              </label>
              <input
                id="b-max"
                type="number"
                min={1}
                value={config.maximo ?? ""}
                onChange={(e) =>
                  alCambiar({
                    ...config,
                    maximo: e.target.value.trim() === "" ? null : num(e.target.value, 1),
                  })
                }
                placeholder="Vacío = sin tope"
                className={campo}
              />
            </div>
          </Fila>
        </div>
      );

    case "cupon":
    case "descuento": {
      const b = config.beneficio;
      return (
        <div className="space-y-4">
          <div>
            <span className={etiqueta}>Qué da</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Forma del beneficio">
              {(
                [
                  ["porcentaje", "Porcentaje"],
                  ["monto", "Monto fijo"],
                  ["gratis", "Producto gratis"],
                ] as const
              ).map(([forma, label]) => (
                <button
                  key={forma}
                  type="button"
                  aria-pressed={b.forma === forma}
                  onClick={() =>
                    alCambiar({
                      ...config,
                      beneficio:
                        forma === "gratis"
                          ? { forma, que: "" }
                          : { forma, valor: forma === "porcentaje" ? 10 : 1000 },
                    })
                  }
                  className={`presionable rounded-xl border px-3.5 py-2 text-[12.5px] font-bold ${
                    b.forma === forma
                      ? "border-bookea-azul bg-bookea-azul text-white"
                      : "border-bookea-linea bg-white text-bookea-gris"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {b.forma === "gratis" ? (
            <div>
              <label className={etiqueta} htmlFor="b-que">
                Qué va gratis
              </label>
              <input
                id="b-que"
                value={b.que}
                onChange={(e) =>
                  alCambiar({ ...config, beneficio: { forma: "gratis", que: e.target.value } })
                }
                placeholder="Un postre"
                className={campo}
              />
            </div>
          ) : (
            <div>
              <label className={etiqueta} htmlFor="b-val">
                {b.forma === "porcentaje" ? "Porcentaje de descuento" : "Monto del descuento (₡)"}
              </label>
              <input
                id="b-val"
                type="number"
                min={1}
                max={b.forma === "porcentaje" ? 100 : undefined}
                value={b.valor}
                onChange={(e) =>
                  alCambiar({
                    ...config,
                    beneficio: { forma: b.forma, valor: num(e.target.value, 1) },
                  })
                }
                className={campo}
              />
            </div>
          )}

          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-cmin">
                Compra mínima (₡)
              </label>
              <input
                id="b-cmin"
                type="number"
                min={0}
                value={config.compraMinima}
                onChange={(e) => alCambiar({ ...config, compraMinima: num(e.target.value) })}
                placeholder="0 = sin mínimo"
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-usos">
                Usos por cliente
              </label>
              <input
                id="b-usos"
                type="number"
                min={1}
                value={config.usosPorCliente}
                onChange={(e) => alCambiar({ ...config, usosPorCliente: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
          </Fila>
        </div>
      );
    }

    case "membresia":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-niv">
                Nombre del nivel
              </label>
              <input
                id="b-niv"
                value={config.nivel}
                onChange={(e) => alCambiar({ ...config, nivel: e.target.value })}
                placeholder="Gold, Socio, VIP…"
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-vig">
                Vigencia (meses)
              </label>
              <input
                id="b-vig"
                type="number"
                min={1}
                value={config.vigenciaMeses}
                onChange={(e) => alCambiar({ ...config, vigenciaMeses: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
          </Fila>
          <ListaEditable
            titulo="Beneficios del socio"
            items={config.beneficios}
            marcador="10% en todo, prioridad de horario…"
            alCambiar={(beneficios) => alCambiar({ ...config, beneficios })}
          />
          <Interruptor
            id="b-ren"
            titulo="Se renueva sola"
            detalle="Al vencer, la membresía se extiende otro período."
            activo={config.renovacionAutomatica}
            alCambiar={(v) => alCambiar({ ...config, renovacionAutomatica: v })}
          />
        </div>
      );

    case "giftcard":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-valor">
                Valor
              </label>
              <input
                id="b-valor"
                type="number"
                min={1}
                value={config.valor || ""}
                onChange={(e) => alCambiar({ ...config, valor: num(e.target.value) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-mon">
                Moneda
              </label>
              <select
                id="b-mon"
                value={config.moneda}
                onChange={(e) =>
                  alCambiar({ ...config, moneda: e.target.value as "CRC" | "USD" })
                }
                className={campo}
              >
                <option value="CRC">Colones (₡)</option>
                <option value="USD">Dólares ($)</option>
              </select>
            </div>
          </Fila>
          <Interruptor
            id="b-parc"
            titulo="Se puede gastar de a poco"
            detalle="El saldo baja con cada uso en vez de consumirse entero de una."
            activo={config.canjeParcial}
            alCambiar={(v) => alCambiar({ ...config, canjeParcial: v })}
          />
          <Interruptor
            id="b-tra"
            titulo="Se puede regalar"
            detalle="Quien la compra puede pasársela a otra persona."
            activo={config.transferible}
            alCambiar={(v) => alCambiar({ ...config, transferible: v })}
          />
        </div>
      );

    case "evento":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-fecha">
                Fecha
              </label>
              <input
                id="b-fecha"
                type="date"
                value={config.fecha}
                onChange={(e) => alCambiar({ ...config, fecha: e.target.value })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-hora">
                Hora
              </label>
              <input
                id="b-hora"
                type="time"
                value={config.hora}
                onChange={(e) => alCambiar({ ...config, hora: e.target.value })}
                className={campo}
              />
            </div>
          </Fila>
          <div>
            <label className={etiqueta} htmlFor="b-ubi">
              Dónde
            </label>
            <input
              id="b-ubi"
              value={config.ubicacion}
              onChange={(e) => alCambiar({ ...config, ubicacion: e.target.value })}
              placeholder="Rancho Las Torres, Alajuela"
              className={campo}
            />
          </div>
          <div>
            <label className={etiqueta} htmlFor="b-cap">
              Entradas disponibles
            </label>
            <input
              id="b-cap"
              type="number"
              min={1}
              value={config.capacidad ?? ""}
              onChange={(e) =>
                alCambiar({
                  ...config,
                  capacidad: e.target.value.trim() === "" ? null : num(e.target.value, 1),
                })
              }
              placeholder="Vacío = sin tope"
              className={campo}
            />
          </div>
        </div>
      );

    case "cashback":
      return (
        <div className="space-y-4">
          <div>
            <label className={etiqueta} htmlFor="b-pct">
              Porcentaje que devolvés
            </label>
            <input
              id="b-pct"
              type="number"
              min={1}
              max={100}
              value={config.porcentaje}
              onChange={(e) => alCambiar({ ...config, porcentaje: num(e.target.value, 1) })}
              className={campo}
            />
            <p className={ayuda}>
              De cada compra vuelve ese porcentaje como saldo, y el cliente lo gasta en su
              próxima visita.
            </p>
          </div>
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-cbmin">
                Compra mínima (₡)
              </label>
              <input
                id="b-cbmin"
                type="number"
                min={0}
                value={config.compraMinima}
                onChange={(e) => alCambiar({ ...config, compraMinima: num(e.target.value) })}
                placeholder="0 = sin mínimo"
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-tope">
                Tope por compra (₡)
              </label>
              <input
                id="b-tope"
                type="number"
                min={1}
                value={config.topePorCompra ?? ""}
                onChange={(e) =>
                  alCambiar({
                    ...config,
                    topePorCompra: e.target.value.trim() === "" ? null : num(e.target.value, 1),
                  })
                }
                placeholder="Vacío = sin tope"
                className={campo}
              />
            </div>
          </Fila>
        </div>
      );
  }
}

// ── Piezas ─────────────────────────────────────────────────────────

function Fila({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/**
 * Interruptor accesible: es un `<button role="switch">` y no un div
 * con onClick, así que el teclado y los lectores de pantalla lo
 * entienden sin que haya que explicarles nada.
 */
export function Interruptor({
  id,
  titulo,
  detalle,
  activo,
  alCambiar,
}: {
  id: string;
  titulo: string;
  detalle?: string;
  activo: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={activo}
      onClick={() => alCambiar(!activo)}
      className="presionable flex w-full items-start gap-3 rounded-2xl border border-bookea-linea bg-white p-3.5 text-left"
    >
      <span
        aria-hidden
        className="relative mt-0.5 h-[22px] w-[40px] shrink-0 rounded-full transition-colors"
        style={{ background: activo ? "var(--orange)" : "var(--line)" }}
      >
        <span
          className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
            activo ? "translate-x-[18px]" : ""
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-bookea-tinta">{titulo}</span>
        {detalle && (
          <span className="mt-0.5 block text-[11.5px] leading-snug text-bookea-gris">
            {detalle}
          </span>
        )}
      </span>
    </button>
  );
}

/** Lista de textos que crece: los beneficios de una membresía. */
function ListaEditable({
  titulo,
  items,
  marcador,
  alCambiar,
}: {
  titulo: string;
  items: string[];
  marcador: string;
  alCambiar: (items: string[]) => void;
}) {
  return (
    <div>
      <span className={etiqueta}>{titulo}</span>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => {
                const copia = [...items];
                copia[i] = e.target.value;
                alCambiar(copia);
              }}
              placeholder={marcador}
              className={`${campo} flex-1`}
              aria-label={`${titulo} ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => alCambiar(items.filter((_, j) => j !== i))}
              className="presionable shrink-0 rounded-xl border border-bookea-linea px-3 text-[12.5px] font-bold text-bookea-gris"
              aria-label={`Quitar ${titulo} ${i + 1}`}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => alCambiar([...items, ""])}
        className="presionable mt-2 rounded-xl border border-dashed border-bookea-linea px-3.5 py-2 text-[12.5px] font-bold text-bookea-gris"
      >
        + Agregar
      </button>
    </div>
  );
}
