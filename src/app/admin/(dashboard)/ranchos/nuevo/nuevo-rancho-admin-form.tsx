"use client";

import { useActionState, useState } from "react";
import {
  crearRanchoComoAdmin,
  type NuevoRanchoAdminState,
} from "./actions";
import {
  CANTONES,
  CATEGORIAS,
  CATEGORIA_LABEL,
  PROVINCIAS,
  SUBCATEGORIAS,
  type Categoria,
  type Provincia,
} from "@/app/mi-rancho/types";

export type DuenoOption = { id: string; email: string | null };

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
  const [categoria, setCategoria] = useState<Categoria>("lugares");
  const [subcategoria, setSubcategoria] = useState("");
  const [provincia, setProvincia] = useState<Provincia | "">("");
  const [canton, setCanton] = useState("");
  const esLugar = categoria === "lugares";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Paso 1
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          ¿De quién es este salón?
        </h3>

        <input type="hidden" name="modo_dueno" value={modoDueno} />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModoDueno("nuevo")}
            disabled={!puedeCrearCuentas}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-40 ${
              modoDueno === "nuevo"
                ? "bg-aventurea-orange text-white"
                : "border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange"
            }`}
          >
            Crear una cuenta nueva
          </button>
          <button
            type="button"
            onClick={() => setModoDueno("existente")}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-bold transition-colors ${
              modoDueno === "existente"
                ? "bg-aventurea-orange text-white"
                : "border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange"
            }`}
          >
            Usar una cuenta existente
          </button>
        </div>

        {!puedeCrearCuentas && (
          <p className="mt-3 rounded-[10px] bg-aventurea-orange/10 p-3 text-[12px] leading-relaxed text-aventurea-orange">
            Para poder crear cuentas desde acá hay que agregar la variable{" "}
            <strong>SUPABASE_SERVICE_ROLE_KEY</strong> en Vercel. Mientras
            tanto podés asignar el salón a una cuenta que ya exista.
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
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Paso 2
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Datos del salón
        </h3>

        <div className="mt-4 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Tipo de servicio</label>
            <select
              name="categoria"
              required
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value as Categoria);
                setSubcategoria("");
              }}
              className={inputCls}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>
              {esLugar ? "Tipo de lugar" : "¿Qué ofrece exactamente?"}
            </label>
            <select
              name="subcategoria"
              required
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecciona una opción</option>
              {SUBCATEGORIAS[categoria].map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Nombre del salón o negocio</label>
            <input
              type="text"
              name="nombre"
              required
              placeholder="Ej. Rancho Los Almendros"
              className={inputCls}
            />
          </div>

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
            <div>
              <label className={labelCls}>Capacidad mínima</label>
              <input type="number" min={1} name="capacidad_min" placeholder="20" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Capacidad máxima</label>
              <input type="number" min={1} name="capacidad_max" placeholder="150" className={inputCls} />
            </div>
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
          className="rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Crear salón"}
        </button>
      </div>
    </form>
  );
}
