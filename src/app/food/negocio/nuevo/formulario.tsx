"use client";

import { useActionState, useState } from "react";
import SubirImagen from "@/components/subir-imagen";
import { crearNegocioFood, type EstadoNuevoNegocioFood } from "./actions";

const INICIAL: EstadoNuevoNegocioFood = { error: null };

const campo =
  "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] " +
  "text-aventurea-ink outline-none focus:border-aventurea-navy";
const etiqueta = "mb-1.5 block text-[12.5px] font-bold text-aventurea-ink";

export default function FormularioNuevoNegocioFood() {
  const [estado, enviar, pendiente] = useActionState(crearNegocioFood, INICIAL);
  const [foto, setFoto] = useState("");

  return (
    <form action={enviar} className="flex flex-col gap-4 rounded-2xl border border-aventurea-line bg-white p-5">
      <label className="block">
        <span className={etiqueta}>Nombre del restaurante</span>
        <input name="nombre" required maxLength={80} placeholder="La Terraza" className={campo} />
      </label>

      <label className="block">
        <span className={etiqueta}>Descripción (opcional)</span>
        <textarea name="descripcion" rows={2} maxLength={280} className={campo} />
      </label>

      <div>
        <SubirImagen valor={foto} alCambiar={setFoto} etiqueta="Foto de portada (opcional)" carpeta="food" />
        <input type="hidden" name="foto_portada_url" value={foto} />
      </div>

      <label className="block">
        <span className={etiqueta}>Teléfono (opcional)</span>
        <input name="telefono" placeholder="+506 8888-8888" className={campo} />
      </label>

      <div className="border-t border-aventurea-line pt-4">
        <p className="mb-3 text-[13px] font-bold text-aventurea-ink">Tu primera sede</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={etiqueta}>Nombre de la sede</span>
            <input
              name="sede_nombre"
              defaultValue="Sede principal"
              maxLength={60}
              className={campo}
            />
          </label>
          <label className="block">
            <span className={etiqueta}>Dirección (opcional)</span>
            <input name="sede_direccion" maxLength={200} className={campo} />
          </label>
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
      >
        {pendiente ? "Creando…" : "Crear mi negocio"}
      </button>
    </form>
  );
}
