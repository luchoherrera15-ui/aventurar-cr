"use client";

import { useActionState, useMemo, useState } from "react";
import { crearRancho, type NuevoRanchoState } from "./actions";
import { createClient } from "@/lib/supabase/client";
import SelectorTipoNegocio from "@/components/business/selector-tipo-negocio";
import { adivinarTipoNegocio } from "@/lib/business/adivinar-tipo";
import { seLePreguntaElTipo } from "@/lib/business/tipo-en-alta";
import type { TipoNegocioId } from "@/lib/business/modulos";
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
import { CATEGORIAS_HOSPEDAJES, CATEGORIA_HOSPEDAJE_LABEL } from "@/app/booking/tipos";
import {
  CATEGORIAS_RESTAURANTES,
  CATEGORIA_RESTAURANTE_LABEL,
} from "@/app/restaurantes/tipos";
import { PAISES } from "@/lib/zonas";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export type Vertical = "eventos" | "citas" | "hospedajes" | "restaurantes";

/**
 * El formulario de alta de UNA vertical: la persona ya eligió qué tipo
 * de negocio tiene en el selector (/mi-negocio/nuevo) y acá solo ve los
 * campos de SU registro — cada vertical pide cosas distintas.
 */
export default function NuevoRanchoForm({ vertical }: { vertical: Vertical }) {
  const [state, formAction, pending] = useActionState<
    NuevoRanchoState,
    FormData
  >(crearRancho, undefined);
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [provincia, setProvincia] = useState<Provincia | "">("");
  const [canton, setCanton] = useState("");
  // El nombre es controlado SOLO porque de él sale la sugerencia de
  // rubro: se adivina mientras se escribe, no al enviar.
  const [nombre, setNombre] = useState("");

  // ---- El rubro operativo (ranchos.tipo_negocio) ----
  // De acá salen el menú, el vocabulario y las herramientas del panel
  // (Bookea Business, 0108). Hasta ahora el registro nunca lo preguntaba
  // y todos los negocios nacían en null, así que el panel se resolvía
  // adivinando de la categoría — y la categoría no distingue un gimnasio
  // de una academia.
  //
  // `sugerido` se recalcula con cada tecla; `tocado` es lo que hace que
  // deje de mandar en cuanto la persona opina. Sin esa bandera, escribir
  // una palabra más en el nombre le pisaría en silencio la opción que
  // acaba de elegir a mano.
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocioId | null>(null);
  const [tipoTocado, setTipoTocado] = useState(false);
  const preguntaTipo = seLePreguntaElTipo(vertical);
  const sugerido = useMemo(
    () => adivinarTipoNegocio({ nombre, vertical, categoria }),
    [nombre, vertical, categoria],
  );
  const tipoElegido = tipoTocado ? tipoNegocio : sugerido;

  const esEventos = vertical === "eventos";
  const esHospedajes = vertical === "hospedajes";
  const esRestaurantes = vertical === "restaurantes";
  // La categoría de eventos válida (para subcategorías); en el resto es null.
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
      className="mt-6 flex flex-col gap-3.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-6"
    >
      <input type="hidden" name="vertical" value={vertical} />

      <div>
        <label className={labelCls}>
          {esEventos
            ? "¿Qué tipo de servicio ofrecés?"
            : esHospedajes
              ? "¿Qué tipo de hospedaje tenés?"
              : esRestaurantes
                ? "¿Qué tipo de lugar es?"
                : "¿Qué tipo de negocio tenés?"}
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
            : esHospedajes
              ? CATEGORIAS_HOSPEDAJES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_HOSPEDAJE_LABEL[c]}
                  </option>
                ))
              : esRestaurantes
                ? CATEGORIAS_RESTAURANTES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_RESTAURANTE_LABEL[c]}
                    </option>
                  ))
                : CATEGORIAS_CITAS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_CITA_LABEL[c]}
                    </option>
                  ))}
        </select>
      </div>

      {/* El país: arrancamos solo con Costa Rica, pero el sistema de
          horarios ya guarda la zona horaria del negocio según el país
          — abrir otro país es agregarlo a lib/zonas.ts. */}
      <div>
        <label className={labelCls}>País</label>
        <select name="pais" required defaultValue="CR" className={inputCls}>
          {PAISES.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
          Por ahora operamos en Costa Rica — muy pronto más países. La zona
          horaria de tu agenda se configura sola.
        </p>
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
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={
            esLugar
              ? "Ej. Rancho Los Almendros"
              : esEventos
                ? "Ej. DJ Mauricio Eventos"
                : esHospedajes
                  ? "Ej. Villa Vista al Mar"
                  : "Ej. Barbería La Norteña"
          }
          className={inputCls}
        />
      </div>

      {/* ---------- Qué clase de negocio es ----------
          Va acá y no al final a propósito: la sugerencia se arma con el
          nombre y la categoría, que son los dos campos de arriba. Se
          pregunta solo donde hay rubros de verdad entre los que elegir
          (ver seLePreguntaElTipo): en hospedajes y restaurantes la
          respuesta es una sola y el panel ya la deduce sin molestar a
          nadie. */}
      {preguntaTipo && (
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4">
          <p className="text-[13px] font-bold text-aventurea-ink">
            ¿Qué clase de negocio es?
          </p>
          <p className="mb-3 mt-1 text-[12px] leading-relaxed text-zinc-500">
            Con esto armamos tu panel: qué secciones ves en el menú, cómo te
            habla el sistema y qué herramientas trae tu rubro. No cambia cómo te
            encuentra la gente en Bookea — eso lo decide la categoría de arriba.
            Podés cambiarlo después desde tu panel.
          </p>

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
          />

          {/* El campo viaja SOLO cuando la pregunta se hizo. Donde no se
              pregunta no se manda nada, porque escribir una respuesta
              que nadie dio es justo lo que no queremos: el negocio nace
              en null, el panel lo deduce —en esas verticales acierta
              siempre— y el aviso de Configuración le sigue ofreciendo
              elegirlo. */}
          <input type="hidden" name="tipo_negocio" value={tipoElegido ?? ""} />
        </div>
      )}

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

      {/* Capacidad: los lugares de eventos piden rango (mín–máx); los
          hospedajes solo el máximo de huéspedes (como Airbnb); citas
          no pide nada de esto. */}
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
      {esHospedajes && (
        <div>
          <label className={labelCls}>¿Cuántos huéspedes recibís? (máximo)</label>
          <input
            type="number"
            min={1}
            name="capacidad_max"
            placeholder="Ej. 8"
            className={inputCls}
          />
        </div>
      )}

      {/* El precio: en eventos es "desde", en hospedajes es por noche,
          y en citas NO se pide — lo definen tus servicios en el panel. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {vertical !== "citas" && (
          <div>
            <label className={labelCls}>
              {esHospedajes
                ? "Precio por noche desde (₡)"
                : esRestaurantes
                  ? "Precio promedio por persona (₡)"
                  : "Precio desde (₡)"}
            </label>
            <input
              type="number"
              min={0}
              name="precio_desde"
              placeholder={
                esHospedajes ? "Ej. 45000" : esRestaurantes ? "Ej. 6500" : "Ej. 80000"
              }
              className={inputCls}
            />
          </div>
        )}
        <div className={vertical === "citas" ? "sm:col-span-2" : ""}>
          <label className={labelCls}>WhatsApp de contacto</label>
          <input
            type="text"
            name="contacto_whatsapp"
            placeholder="+506 ...."
            className={inputCls}
          />
          {vertical === "citas" && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
              El precio no se pide acá: lo definen tus servicios (corte,
              manicura, consulta...) cuando los configurés en tu panel.
            </p>
          )}
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
          {/* type="text" a propósito: type="url" rechaza "www.negocio.com"
              sin https:// y eso frustra a quien publica — el action le
              agrega el https:// solo. */}
          <input
            type="text"
            inputMode="url"
            required
            value={redSocialUrl}
            onChange={(e) => setRedSocialUrl(e.target.value)}
            placeholder="instagram.com/tu_negocio"
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
        className="mt-1.5 rounded-xl bg-aventurea-sky py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
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
