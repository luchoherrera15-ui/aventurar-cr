"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import SubirImagen from "@/components/subir-imagen";
import { EncabezadoPagina, TarjetaPanel } from "@/components/food/panel";
import { IconUtensils } from "@/components/icons";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  ESTADO_PILDORA,
  RADIO_TILE,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import { CRC, type FoodMenuCategory, type FoodMenuItem } from "@/lib/food/tipos";
import {
  alternarItem,
  borrarCategoria,
  borrarItem,
  crearCategoria,
  crearItem,
  type EstadoMenu,
} from "./actions";

/**
 * EL MENÚ — la vitrina del restaurante en Food Bookea, no un POS: acá
 * no hay comandas ni inventario, solo lo que un cliente ve antes de
 * decidirse a reservar (foto, precio, descripción, disponibilidad).
 *
 * Rediseño al lenguaje "centro de control" del panel (tarjetas del
 * sistema, encabezado estándar, filas con jerarquía) SIN tocar el
 * comportamiento: las server actions de ./actions.ts quedan exactamente
 * como estaban — mismos nombres de campo, mismas firmas, mismos
 * revalidatePath. Solo cambió la piel.
 *
 * Un detalle de mecánica: los formularios se cierran cuando la action
 * termina bien, y ese cierre se dispara DENTRO de la action envuelta
 * (contexto de transición) y no en el cuerpo del render — llamar al
 * setState del padre durante el render del hijo es la advertencia
 * clásica de React, y hacerlo en un efecto chocaría con la regla
 * react-hooks/set-state-in-effect del repo.
 */

const INICIAL: EstadoMenu = { error: null };

/** El campo del sistema + el foco navy que los formularios de FOOD usan. */
const CAMPO = `${CAMPO_PANEL} outline-none transition-colors focus:border-aventurea-navy`;
const ETIQUETA = `${ROTULO_CAMPO} mb-1.5 block`;

type CategoriaProp = Pick<FoodMenuCategory, "id" | "nombre" | "orden">;
type ItemProp = Omit<FoodMenuItem, "business_id">;

export default function MenuPanel({
  negocioId,
  slug,
  categorias,
  items,
}: {
  negocioId: string;
  /** Para "Ver mi página": la vitrina se juzga viéndola como cliente. */
  slug: string;
  categorias: CategoriaProp[];
  items: ItemProp[];
}) {
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  const itemsPorCategoria = new Map<string, ItemProp[]>();
  for (const it of items) {
    const lista = itemsPorCategoria.get(it.category_id) ?? [];
    lista.push(it);
    itemsPorCategoria.set(it.category_id, lista);
  }

  const activos = items.filter((it) => it.activo).length;

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Menú"
        descripcion="La vitrina de tu restaurante en Food Bookea: lo que un cliente ve antes de decidirse a reservar."
        acciones={
          <>
            <Link href={`/food/restaurante/${slug}`} className={BOTON_PANEL}>
              Ver mi página
            </Link>
            <button
              type="button"
              onClick={() => setCreandoCategoria((v) => !v)}
              className={BOTON_PANEL_PRIMARIO}
            >
              Nueva categoría
            </button>
          </>
        }
      />

      {/* El resumen en una línea: cuánto hay y cuánto se ve. Es dato
          REAL de la base, no utilería — por eso no lleva NotaDemo. */}
      {items.length > 0 && (
        <p className="text-[12.5px] font-bold text-aventurea-ink-soft">
          {categorias.length} {categorias.length === 1 ? "categoría" : "categorías"} · {items.length}{" "}
          {items.length === 1 ? "plato" : "platos"} · {activos}{" "}
          {activos === 1 ? "visible" : "visibles"} al público
        </p>
      )}

      {creandoCategoria && (
        <FormularioCategoria negocioId={negocioId} alCerrar={() => setCreandoCategoria(false)} />
      )}

      {categorias.length === 0 ? (
        <TarjetaPanel>
          <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} px-6 py-10 text-center`}>
            <p className="text-[14px] font-bold text-aventurea-ink">Tu menú todavía está vacío</p>
            <p className="mx-auto mt-1.5 max-w-[46ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              Creá una categoría (por ejemplo «Entradas» o «Platos fuertes») y subí tus platos con
              foto y precio: es lo primero que mira quien está decidiendo dónde reservar.
            </p>
            <button
              type="button"
              onClick={() => setCreandoCategoria(true)}
              className={`${BOTON_PANEL_PRIMARIO} mt-4`}
            >
              Crear la primera categoría
            </button>
          </div>
        </TarjetaPanel>
      ) : (
        categorias.map((cat) => (
          <CategoriaBloque
            key={cat.id}
            negocioId={negocioId}
            categoria={cat}
            items={itemsPorCategoria.get(cat.id) ?? []}
          />
        ))
      )}

      {/* Sin toggle falso: destacados necesita columna propia en
          food_menu_items y todavía no existe. Mismo patrón "Pronto"
          que el selector de restaurante del rail. */}
      {categorias.length > 0 && (
        <p className="text-[12px] leading-relaxed text-aventurea-ink-soft">
          Pronto: marcar platos destacados para que salgan de primeros en tu página.
        </p>
      )}
    </div>
  );
}

function FormularioCategoria({
  negocioId,
  alCerrar,
}: {
  negocioId: string;
  alCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoMenu, FormData>(
    async (previo, formData) => {
      const r = await crearCategoria(negocioId, previo, formData);
      // Cerrar acá (contexto de transición), no en el render: ver el
      // comentario de cabecera del archivo.
      if (r.ok) alCerrar();
      return r;
    },
    INICIAL,
  );

  return (
    <TarjetaPanel kicker="Menú" titulo="Nueva categoría">
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[220px] flex-1">
          <span className={ETIQUETA}>Nombre de la categoría</span>
          <input name="nombre" required maxLength={60} placeholder="Entradas" className={CAMPO} />
        </label>
        <button type="submit" disabled={pendiente} className={BOTON_PANEL_PRIMARIO}>
          {pendiente ? "Creando…" : "Crear categoría"}
        </button>
        <button type="button" onClick={alCerrar} className={BOTON_PANEL}>
          Cancelar
        </button>
        {estado.error && (
          <p className="w-full text-[12.5px] font-bold text-red-700">{estado.error}</p>
        )}
      </form>
    </TarjetaPanel>
  );
}

function CategoriaBloque({
  negocioId,
  categoria,
  items,
}: {
  negocioId: string;
  categoria: Pick<FoodMenuCategory, "id" | "nombre">;
  items: ItemProp[];
}) {
  const [creandoItem, setCreandoItem] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <TarjetaPanel
      kicker="Categoría"
      titulo={categoria.nombre}
      accion={
        confirmando ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold text-red-700">
              {items.length > 0
                ? `Se borra la categoría y sus ${items.length} plato${items.length === 1 ? "" : "s"}.`
                : "¿Borrar la categoría?"}
            </span>
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await borrarCategoria(negocioId, categoria.id);
                  setError(r?.error ?? null);
                })
              }
              className="rounded-lg bg-red-600 px-2.5 py-1 text-[11.5px] font-bold text-white disabled:opacity-50"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCreandoItem((v) => !v)}
              className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
            >
              + Agregar plato
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="text-[12px] font-bold text-red-700 hover:underline"
            >
              Borrar
            </button>
          </span>
        )
      }
    >
      {error && <p className="mb-2 text-[12px] font-bold text-red-700">{error}</p>}

      {creandoItem && (
        <div className="mb-3">
          <FormularioItem
            negocioId={negocioId}
            categoryId={categoria.id}
            alCerrar={() => setCreandoItem(false)}
          />
        </div>
      )}

      {items.length === 0 ? (
        <p
          className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} px-4 py-6 text-center text-[12.5px] text-aventurea-ink-soft`}
        >
          Sin platos todavía — agregá el primero con «+ Agregar plato».
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <ItemFila key={it.id} negocioId={negocioId} item={it} />
          ))}
        </ul>
      )}
    </TarjetaPanel>
  );
}

function FormularioItem({
  negocioId,
  categoryId,
  alCerrar,
}: {
  negocioId: string;
  categoryId: string;
  alCerrar: () => void;
}) {
  const [foto, setFoto] = useState("");
  const [estado, enviar, pendiente] = useActionState<EstadoMenu, FormData>(
    async (previo, formData) => {
      const r = await crearItem(negocioId, previo, formData);
      if (r.ok) alCerrar();
      return r;
    },
    INICIAL,
  );

  return (
    <form action={enviar} className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="category_id" value={categoryId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Nombre del plato</span>
          <input
            name="nombre"
            required
            maxLength={80}
            placeholder="Casado con pollo"
            className={CAMPO}
          />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Precio (₡)</span>
          <input name="precio" type="number" min={0} required className={CAMPO} />
        </label>
      </div>
      <label className="block">
        <span className={ETIQUETA}>Descripción (opcional)</span>
        <textarea name="descripcion" rows={2} maxLength={280} className={CAMPO} />
      </label>
      <SubirImagen valor={foto} alCambiar={setFoto} etiqueta="Foto (opcional)" carpeta="food" />
      <input type="hidden" name="foto_url" value={foto} />

      {estado.error && <p className="text-[12.5px] font-bold text-red-700">{estado.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pendiente} className={BOTON_PANEL_PRIMARIO}>
          {pendiente ? "Guardando…" : "Agregar plato"}
        </button>
        <button type="button" onClick={alCerrar} className={BOTON_PANEL}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Un plato de la vitrina: foto, nombre + descripción, precio, la
 * píldora de disponibilidad (texto, no solo color) y el interruptor.
 * Cuando está apagado, la fila entera baja el volumen (foto y nombre
 * atenuados) — el estado se ve de un vistazo sin leer nada.
 */
function ItemFila({ negocioId, item }: { negocioId: string; item: ItemProp }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} flex flex-wrap items-center gap-3 p-2.5`}>
      <div
        className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white ${
          item.activo ? "" : "opacity-50"
        }`}
      >
        {item.foto_url ? (
          <Image src={item.foto_url} alt={item.nombre} fill sizes="48px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-aventurea-navy/40">
            <IconUtensils className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13.5px] font-bold ${
            item.activo ? "text-aventurea-ink" : "text-aventurea-ink-soft"
          }`}
        >
          {item.nombre}
        </p>
        {item.descripcion && (
          <p className="truncate text-[12px] leading-snug text-aventurea-ink-soft">
            {item.descripcion}
          </p>
        )}
        {error && <p className="text-[12px] font-bold text-red-700">{error}</p>}
      </div>

      <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-aventurea-ink">
        {CRC.format(item.precio)}
      </span>

      <span
        className={`hidden shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold sm:inline-flex ${
          item.activo ? ESTADO_PILDORA.exito : ESTADO_PILDORA.neutro
        }`}
      >
        {item.activo ? "Disponible" : "Apagado"}
      </span>

      <div className="flex shrink-0 items-center gap-2.5">
        {/* role="switch": el estado lo anuncia aria-checked, y el
            nombre del plato viaja en el aria-label — sin esto, un
            lector de pantalla escucha veinte interruptores idénticos. */}
        <button
          type="button"
          role="switch"
          aria-checked={item.activo}
          aria-label={`Disponible: ${item.nombre}`}
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await alternarItem(negocioId, item.id, !item.activo);
              setError(r?.error ?? null);
            })
          }
          className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            item.activo ? "bg-aventurea-green" : "bg-aventurea-line-fuerte"
          }`}
        >
          <span
            aria-hidden
            className={`absolute left-[3px] h-4 w-4 rounded-full bg-white transition-transform ${
              item.activo ? "translate-x-4" : ""
            }`}
          />
        </button>

        {confirmando ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await borrarItem(negocioId, item.id);
                  setError(r?.error ?? null);
                })
              }
              className="rounded-lg bg-red-600 px-2.5 py-1 text-[11.5px] font-bold text-white disabled:opacity-50"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-[11.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="text-[11.5px] font-bold text-red-700 hover:underline"
          >
            Borrar
          </button>
        )}
      </div>
    </li>
  );
}
