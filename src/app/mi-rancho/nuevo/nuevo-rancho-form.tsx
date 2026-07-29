"use client";

import { useActionState, useState } from "react";
import { crearRancho, type NuevoRanchoState } from "./actions";
import { createClient } from "@/lib/supabase/client";
import {
  CANTONES,
  CATEGORIAS,
  CATEGORIA_LABEL,
  PROVINCIAS,
  SUBCATEGORIAS,
  type Categoria,
  type Provincia,
} from "../types";
import { CATEGORIAS_CITAS, CATEGORIA_CITA_LABEL } from "@/app/citas/tipos";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

type Vertical = "eventos" | "citas";

// Las dos verticales que se pueden publicar desde este formulario.
const VERTICALES: { id: Vertical; titulo: string; detalle: string }[] = [
  {
    id: "eventos",
    titulo: "Servicios para eventos",
    detalle: "Salones, catering, DJ, decoración y todo lo que se contrata para un evento.",
  },
  {
    id: "citas",
    titulo: "Citas y reservas",
    detalle: "Salón de belleza, barbería, spa, consultorio... atendés con cita por hora.",
  },
];

export default function NuevoRanchoForm() {
  const [state, formAction, pending] = useActionState<
    NuevoRanchoState,
    FormData
  >(crearRancho, undefined);
  const [vertical, setVertical] = useState<Vertical>("eventos");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [provincia, setProvincia] = useState<Provincia | "">("");
  const [canton, setCanton] = useState("");

  const esEventos = vertical === "eventos";
  // La categoría de eventos válida (para subcategorías); en citas es null.
  const categoriaEvento =
    esEventos && (CATEGORIAS as readonly string[]).includes(categoria)
      ? (categoria as Categoria)
      : null;
  const esLugar = categoriaEvento === "lugares";

  // Verificación de identidad: las fotos se suben apenas se eligen
  // (al bucket privado verificacion-proveedores) y el formulario solo
  // viaja con la ruta ya subida — nunca con el archivo repetido.
  const [redSocialUrl, setRedSocialUrl] = useState("");
  const [cedulaFrenteUrl, setCedulaFrenteUrl] = useState<string | null>(null);
  const [cedulaDorsoUrl, setCedulaDorsoUrl] = useState<string | null>(null);
  const [subiendoFrente, setSubiendoFrente] = useState(false);
  const [subiendoDorso, setSubiendoDorso] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  async function subirCedula(lado: "frente" | "dorso", archivo: File | null) {
    if (!archivo) return;
    setErrorSubida(null);
    (lado === "frente" ? setSubiendoFrente : setSubiendoDorso)(true);
    const supabase = createClient();
    const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `solicitudes/${crypto.randomUUID()}-${lado}.${ext}`;
    const { error } = await supabase.storage
      .from("verificacion-proveedores")
      .upload(path, archivo);
    (lado === "frente" ? setSubiendoFrente : setSubiendoDorso)(false);
    if (error) {
      setErrorSubida("No se pudo subir la foto: " + error.message);
      return;
    }
    (lado === "frente" ? setCedulaFrenteUrl : setCedulaDorsoUrl)(path);
  }

  const verificacionCompleta = !!redSocialUrl.trim() && !!cedulaFrenteUrl && !!cedulaDorsoUrl;

  return (
    <form
      action={formAction}
      className="mt-6 flex flex-col gap-3.5 rounded-[18px] border border-aventurea-line bg-aventurea-surface p-6"
    >
      {/* La vertical: eventos (lo de siempre) o citas (Fresha-style).
          Cambiar de una a otra resetea la categoría, porque cada
          vertical tiene su propia lista. */}
      <div>
        <label className={labelCls}>¿Qué publicás?</label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {VERTICALES.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={vertical === v.id}
              onClick={() => {
                if (vertical === v.id) return;
                setVertical(v.id);
                setCategoria("");
                setSubcategoria("");
              }}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                vertical === v.id
                  ? "border-aventurea-orange bg-aventurea-orange/5"
                  : "border-aventurea-line bg-aventurea-cream-2 hover:border-aventurea-orange/40"
              }`}
            >
              <span className="block text-[13.5px] font-bold text-aventurea-ink">
                {v.titulo}
              </span>
              <span className="mt-1 block text-[12px] leading-relaxed text-zinc-500">
                {v.detalle}
              </span>
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="vertical" value={vertical} />

      <div>
        <label className={labelCls}>
          {esEventos ? "¿Qué tipo de servicio ofrecés?" : "¿Qué tipo de negocio tenés?"}
        </label>
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
          <option value="">Selecciona una opción</option>
          {esEventos
            ? CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))
            : CATEGORIAS_CITAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_CITA_LABEL[c]}
                </option>
              ))}
        </select>
      </div>

      {/* Las subcategorías son de la vertical de eventos; en citas la
          categoría ya es lo bastante específica. */}
      {categoriaEvento && (
        <div>
          <label className={labelCls}>
            {esLugar ? "Tipo de lugar" : "¿Qué ofrecés exactamente?"}
          </label>
          <select
            name="subcategoria"
            required
            value={subcategoria}
            onChange={(e) => setSubcategoria(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecciona una opción</option>
            {SUBCATEGORIAS[categoriaEvento].map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>
          {esLugar ? "Nombre del salón o rancho" : "Nombre de tu negocio"}
        </label>
        <input
          type="text"
          name="nombre"
          required
          placeholder={
            esLugar
              ? "Ej. Rancho Los Almendros"
              : esEventos
                ? "Ej. DJ Mauricio Eventos"
                : "Ej. Barbería La Norteña"
          }
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Descripción</label>
        <textarea
          name="descripcion"
          placeholder="Contanos qué ofrecés y qué te hace especial"
          className={`min-h-[80px] ${inputCls}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <option value="">Selecciona una opción</option>
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
            <option value="">
              {provincia ? "Selecciona una opción" : "Elegí primero la provincia"}
            </option>
            {(provincia ? CANTONES[provincia] : []).map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        </div>
        {esEventos && categoria && !esLugar && (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500 sm:col-span-2">
            Tu zona de cobertura — vos te trasladás al evento del cliente, no
            hace falta una dirección exacta.
          </p>
        )}
      </div>

      {/* La dirección aplica a los lugares de eventos y a todo negocio
          de citas: el cliente llega al local. */}
      {(esLugar || !esEventos) && (
        <div>
          <label className={labelCls}>Dirección exacta</label>
          <input
            type="text"
            name="direccion_exacta"
            placeholder="Ej. Calle Monge, 200m norte de la iglesia"
            className={inputCls}
          />
        </div>
      )}

      {esLugar && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Capacidad mínima</label>
            <input
              type="number"
              min={1}
              name="capacidad_min"
              placeholder="Ej. 20"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Capacidad máxima</label>
            <input
              type="number"
              min={1}
              name="capacidad_max"
              placeholder="Ej. 150"
              className={inputCls}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Precio desde (₡)</label>
          <input
            type="number"
            min={0}
            name="precio_desde"
            placeholder="Ej. 80000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>WhatsApp de contacto</label>
          <input
            type="text"
            name="contacto_whatsapp"
            placeholder="+506 ...."
            className={inputCls}
          />
        </div>
      </div>

      {/* ---------- Verificación de identidad ---------- */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4">
        <p className="text-[13px] font-bold text-aventurea-ink">
          Verificación de tu negocio
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
          Esto es solo por seguridad: nos ayuda a confirmar que quien
          publica es una persona real y no una empresa fantasma. Tu
          cédula la ve únicamente nuestro equipo de revisión — nunca se
          hace pública ni se comparte con nadie.
        </p>

        <div className="mt-3">
          <label className={labelCls}>Link de tus redes o tu sitio web</label>
          <input
            type="url"
            required
            value={redSocialUrl}
            onChange={(e) => setRedSocialUrl(e.target.value)}
            placeholder="https://instagram.com/tu_negocio"
            className={inputCls}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Cédula — frente</label>
            <input
              type="file"
              accept="image/*"
              required={!cedulaFrenteUrl}
              onChange={(e) => subirCedula("frente", e.target.files?.[0] ?? null)}
              className="block w-full text-[12.5px] text-aventurea-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-aventurea-navy file:px-3.5 file:py-2 file:text-[12px] file:font-bold file:text-white"
            />
            {subiendoFrente && (
              <p className="mt-1.5 text-[11.5px] text-zinc-500">Subiendo…</p>
            )}
            {cedulaFrenteUrl && !subiendoFrente && (
              <p className="mt-1.5 text-[11.5px] font-bold text-aventurea-green">
                ✓ Foto subida
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Cédula — dorso</label>
            <input
              type="file"
              accept="image/*"
              required={!cedulaDorsoUrl}
              onChange={(e) => subirCedula("dorso", e.target.files?.[0] ?? null)}
              className="block w-full text-[12.5px] text-aventurea-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-aventurea-navy file:px-3.5 file:py-2 file:text-[12px] file:font-bold file:text-white"
            />
            {subiendoDorso && (
              <p className="mt-1.5 text-[11.5px] text-zinc-500">Subiendo…</p>
            )}
            {cedulaDorsoUrl && !subiendoDorso && (
              <p className="mt-1.5 text-[11.5px] font-bold text-aventurea-green">
                ✓ Foto subida
              </p>
            )}
          </div>
        </div>
        {errorSubida && (
          <p className="mt-2 text-[12px] text-red-700">{errorSubida}</p>
        )}
      </div>

      <input type="hidden" name="red_social_url" value={redSocialUrl.trim()} />
      <input type="hidden" name="cedula_frente_url" value={cedulaFrenteUrl ?? ""} />
      <input type="hidden" name="cedula_dorso_url" value={cedulaDorsoUrl ?? ""} />

      {state?.error && (
        <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || subiendoFrente || subiendoDorso || !verificacionCompleta}
        className="mt-1.5 rounded-xl bg-aventurea-orange py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
      >
        {pending
          ? "Enviando..."
          : !verificacionCompleta
            ? "Completá la verificación para continuar"
            : "Enviar para revisión"}
      </button>
    </form>
  );
}
