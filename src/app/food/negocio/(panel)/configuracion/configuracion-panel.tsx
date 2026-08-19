"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import SubirImagen from "@/components/subir-imagen";
import type { FoodBusiness, FoodLocation } from "@/lib/food/tipos";
import { guardarNegocio, guardarSede, type EstadoConfig } from "./actions";

const INICIAL: EstadoConfig = { error: null };
const campo =
  "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] " +
  "text-aventurea-ink outline-none focus:border-aventurea-navy";
const etiqueta = "mb-1.5 block text-[12.5px] font-bold text-aventurea-ink";

type NegocioForm = Pick<FoodBusiness, "id" | "nombre" | "descripcion" | "telefono" | "foto_portada_url" | "activo" | "slug">;
type SedeForm = Pick<FoodLocation, "id" | "nombre" | "direccion" | "telefono">;

export default function ConfiguracionPanel({ negocio, sedes }: { negocio: NegocioForm; sedes: SedeForm[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-aventurea-ink-soft">Tu restaurante</p>
        <FormularioNegocio negocio={negocio} />
        <p className="mt-2 text-[12px] text-aventurea-ink-soft">
          Página pública:{" "}
          <Link href={`/food/restaurante/${negocio.slug}`} className="font-bold text-aventurea-navy hover:underline">
            /food/restaurante/{negocio.slug}
          </Link>
        </p>
      </div>

      {sedes.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-aventurea-ink-soft">Sedes</p>
          <div className="flex flex-col gap-3">
            {sedes.map((s) => (
              <FormularioSede key={s.id} negocioId={negocio.id} sede={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormularioNegocio({ negocio }: { negocio: NegocioForm }) {
  const accion = guardarNegocio.bind(null, negocio.id);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [foto, setFoto] = useState(negocio.foto_portada_url ?? "");

  return (
    <form action={enviar} className="flex flex-col gap-4 rounded-2xl border border-aventurea-line bg-white p-5">
      <label className="flex items-center gap-2">
        <input type="checkbox" name="activo" defaultChecked={negocio.activo} className="h-4 w-4 accent-aventurea-navy" />
        <span className="text-[13.5px] font-bold text-aventurea-ink">Publicado (visible al público)</span>
      </label>

      <label className="block">
        <span className={etiqueta}>Nombre</span>
        <input name="nombre" defaultValue={negocio.nombre} required maxLength={80} className={campo} />
      </label>

      <label className="block">
        <span className={etiqueta}>Descripción</span>
        <textarea name="descripcion" defaultValue={negocio.descripcion ?? ""} rows={2} maxLength={280} className={campo} />
      </label>

      <div>
        <SubirImagen valor={foto} alCambiar={setFoto} etiqueta="Foto de portada" carpeta="food" />
        <input type="hidden" name="foto_portada_url" value={foto} />
      </div>

      <label className="block">
        <span className={etiqueta}>Teléfono</span>
        <input name="telefono" defaultValue={negocio.telefono ?? ""} className={campo} />
      </label>

      {estado.error && <p className="text-[12.5px] font-bold text-red-700">{estado.error}</p>}
      {estado.ok && <p className="text-[12.5px] font-bold text-aventurea-green">Guardado.</p>}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
      >
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

function FormularioSede({ negocioId, sede }: { negocioId: string; sede: SedeForm }) {
  const accion = guardarSede.bind(null, negocioId, sede.id);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={etiqueta}>Nombre</span>
          <input name="nombre" defaultValue={sede.nombre} required maxLength={60} className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Dirección</span>
          <input name="direccion" defaultValue={sede.direccion ?? ""} maxLength={200} className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Teléfono</span>
          <input name="telefono" defaultValue={sede.telefono ?? ""} className={campo} />
        </label>
      </div>
      {estado.error && <p className="text-[12.5px] font-bold text-red-700">{estado.error}</p>}
      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-lg border border-aventurea-line px-4 py-1.5 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
      >
        {pendiente ? "Guardando…" : "Guardar sede"}
      </button>
    </form>
  );
}
