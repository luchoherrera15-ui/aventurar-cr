"use client";

import { useActionState, useMemo, useState } from "react";
import {
  crearRanchoComoAdmin,
  type NuevoRanchoAdminState,
} from "./actions";
import SelectorTipoNegocio from "@/components/business/selector-tipo-negocio";
import { adivinarTipoNegocio } from "@/lib/business/adivinar-tipo";
import { seLePreguntaElTipo } from "@/lib/business/tipo-en-alta";
import type { TipoNegocioId } from "@/lib/business/modulos";
import {
  CANTONES,
  CATEGORIAS,
  PROVINCIAS,
  SUBCATEGORIAS,
  type Categoria,
  type Provincia,
} from "@/app/mi-negocio/types";
import {
  categoriaOptions,
  subcategoriasDe,
  usaSubcategoria,
  type VerticalNegocio,
} from "@/lib/categorias-vertical";

export type DuenoOption = { id: string; email: string | null };

export type Vertical = VerticalNegocio;

const VERTICALES: { value: Vertical; label: string }[] = [
  { value: "eventos", label: "Eventos" },
  { value: "citas", label: "Citas y reservas" },
  { value: "hospedajes", label: "Hospedajes" },
  { value: "restaurantes", label: "Restaurantes" },
];

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function NuevoRanchoAdminForm({
  duenos,
  puedeCrearCuentas,
}: {
  duenos: DuenoOption[];
  puedeCrearCuentas: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    NuevoRanchoAdminState,
    FormData
  >(crearRanchoComoAdmin, undefined);
  const [modoDueno, setModoDueno] = useState<"existente" | "nuevo">(
    puedeCrearCuentas ? "nuevo" : "existente",
  );
  const [vertical, setVertical] = useState<Vertical>("eventos");
  const [categoria, setCategoria] = useState<string>("lugares");
  const [subcategoria, setSubcategoria] = useState("");
  const [provincia, setProvincia] = useState<Provincia | "">("");
  const [canton, setCanton] = useState("");
  // El nombre es controlado solo para alimentar la sugerencia de rubro.
  const [nombre, setNombre] = useState("");

  // El mismo paso que ve el dueño en /mi-negocio/nuevo: un negocio que
  // el equipo carga a mano tiene que nacer igual de completo que uno que
  // se registró solo. Si no, los negocios sembrados desde acá son
  // justamente los que quedan con el panel neutro.
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocioId | null>(null);
  const [tipoTocado, setTipoTocado] = useState(false);
  const preguntaTipo = seLePreguntaElTipo(vertical);
  const sugerido = useMemo(
    () => adivinarTipoNegocio({ nombre, vertical, categoria }),
    [nombre, vertical, categoria],
  );
  const tipoElegido = tipoTocado ? tipoNegocio : sugerido;
  // `categoriaEvento` queda SOLO para la capacidad (Eventos > Lugares);
  // el segundo nivel ahora es por vertical: Citas también lo tiene
  // desde el 28 ago 2026 (opcional), vía `subcategoriasDe`.
  const categoriaEvento =
    vertical === "eventos" && (CATEGORIAS as readonly string[]).includes(categoria)
      ? (categoria as Categoria)
      : null;
  const esLugar = categoriaEvento === "lugares";
  const opcionesSub = usaSubcategoria(vertical) ? subcategoriasDe(vertical, categoria) : [];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Paso 1
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          ¿De quién es este negocio?
        </h3>

        <input type="hidden" name="modo_dueno" value={modoDueno} />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModoDueno("nuevo")}
            disabled={!puedeCrearCuentas}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-40 ${
              modoDueno === "nuevo"
                ? "bg-aventurea-sky text-white"
                : "border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-sky"
            }`}
          >
            Crear una cuenta nueva
          </button>
          <button
            type="button"
            onClick={() => setModoDueno("existente")}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-bold transition-colors ${
              modoDueno === "existente"
                ? "bg-aventurea-sky text-white"
                : "border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-sky"
            }`}
          >
            Usar una cuenta existente
          </button>
        </div>

        {!puedeCrearCuentas && (
          <p className="mt-3 rounded-[10px] bg-aventurea-sky/10 p-3 text-[12px] leading-relaxed text-aventurea-orange">
            Para poder crear cuentas desde acá hay que agregar la variable{" "}
            <strong>SUPABASE_SERVICE_ROLE_KEY</strong> en Vercel. Mientras
            tanto podés asignar el negocio a una cuenta que ya exista.
          </p>
        )}

        {modoDueno === "nuevo" ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Nombre del dueño</label>
              <input
                type="text"
                name="nuevo_nombre"
                placeholder="Nombre completo"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Correo</label>
              <input
                type="email"
                name="nuevo_email"
                placeholder="dueno@ejemplo.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contraseña temporal</label>
              <input
                type="text"
                name="nuevo_password"
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className={inputCls}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 max-w-sm">
            <label className={labelCls}>Cuenta existente</label>
            <select name="owner_id" className={inputCls}>
              <option value="">Selecciona una cuenta</option>
              {duenos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.email ?? d.id}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Paso 2
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Datos del negocio
        </h3>

        <div className="mt-4 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Vertical</label>
            <select
              name="vertical"
              required
              value={vertical}
              onChange={(e) => {
                const v = e.target.value as Vertical;
                setVertical(v);
                const opciones = categoriaOptions(v);
                setCategoria(opciones[0]?.id ?? "");
                setSubcategoria("");
              }}
              className={inputCls}
            >
              {VERTICALES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Tipo de servicio</label>
            <select
              name="categoria"
              required
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setSubcategoria("");
              }}
              className={inputCls}
            >
              {categoriaOptions(vertical).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {opcionesSub.length > 0 && (
            <div>
              <label className={labelCls}>
                {esLugar ? "Tipo de lugar" : "¿Qué ofrece exactamente?"}
              </label>
              <select
                name="subcategoria"
                required={vertical === "eventos"}
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                className={inputCls}
              >
                <option value="">
                  {vertical === "eventos" ? "Selecciona una opción" : "Sin especificar (opcional)"}
                </option>
                {opcionesSub.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Nombre del negocio</label>
            <input
              type="text"
              name="nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Salón Bella Vista"
              className={inputCls}
            />
          </div>

          {/* El rubro operativo: de acá salen el menú y el vocabulario
              del panel del dueño (Bookea Business, 0108). Viene marcado
              lo que sugiere el nombre; el equipo confirma o corrige. */}
          {preguntaTipo && (
            <div>
              <label className={labelCls}>Tipo de negocio (arma su panel)</label>
              <SelectorTipoNegocio
                vertical={vertical}
                valor={tipoElegido}
                sugerido={sugerido}
                alElegir={(t) => {
                  setTipoNegocio(t);
                  setTipoTocado(true);
                }}
                alSaltar={() => {
                  setTipoNegocio(null);
                  setTipoTocado(true);
                }}
                textoSaltar="Dejarlo sin definir"
                textoSinElegir="Sin definir, el panel arranca en el modo neutro y el dueño elige su rubro desde Configuración."
              />
              <input type="hidden" name="tipo_negocio" value={tipoElegido ?? ""} />
            </div>
          )}

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              name="descripcion"
              placeholder="Qué incluye y qué lo hace especial"
              className={`min-h-[80px] ${inputCls}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>Provincia</label>
              <select
                name="provincia"
                required
                value={provincia}
                onChange={(e) => {
                  setProvincia(e.target.value as Provincia);
                  setCanton("");
                }}
                className={inputCls}
              >
                <option value="">Selecciona</option>
                {PROVINCIAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cantón</label>
              <select
                name="canton"
                value={canton}
                onChange={(e) => setCanton(e.target.value)}
                disabled={!provincia}
                className={inputCls}
              >
                <option value="">{provincia ? "Selecciona" : "Elegí la provincia"}</option>
                {(provincia ? CANTONES[provincia] : []).map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className={labelCls}>Dirección exacta</label>
              <input
                type="text"
                name="direccion_exacta"
                placeholder="Ej. Calle Monge, 200m norte de la iglesia"
                className={inputCls}
              />
            </div>
            {esLugar && (
              <>
                <div>
                  <label className={labelCls}>Capacidad mínima</label>
                  <input type="number" min={1} name="capacidad_min" placeholder="20" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Capacidad máxima</label>
                  <input type="number" min={1} name="capacidad_max" placeholder="150" className={inputCls} />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Precio desde (₡)</label>
              <input type="number" min={0} name="precio_desde" placeholder="80000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp de contacto</label>
              <input type="text" name="contacto_whatsapp" placeholder="+506 ...." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estado inicial</label>
              <select name="estado" defaultValue="aprobado" className={inputCls}>
                <option value="aprobado">Publicado (visible ya)</option>
                <option value="pendiente">Pendiente de revisión</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {state?.error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {state.error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-aventurea-sky px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Crear negocio"}
        </button>
      </div>
    </form>
  );
}
