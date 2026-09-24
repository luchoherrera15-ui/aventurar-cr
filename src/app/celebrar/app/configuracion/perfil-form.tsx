"use client";

import { useActionState, useState } from "react";
import type { PerfilCelebrar } from "@/lib/celebrar/tipos";
import { PAIS, PAISES, type Pais } from "@/lib/monedas";
import { guardarPerfil, type EstadoPerfil } from "./acciones";

export default function PerfilForm({
  nombre,
  correo,
  perfil,
}: {
  nombre: string;
  correo: string;
  perfil: PerfilCelebrar | null;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoPerfil, FormData>(guardarPerfil, null);
  const [pais, setPais] = useState<Pais>(((perfil?.pais as Pais) ?? "CR") in PAIS ? ((perfil?.pais as Pais) ?? "CR") : "CR");
  const errores = estado?.errores ?? {};

  return (
    <form action={enviar} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-nombre" className="c-rotulo">
            Nombre
          </label>
          <input id="pf-nombre" name="nombre" type="text" required maxLength={60} defaultValue={nombre} className="c-campo" />
          {errores.nombre && <Error>{errores.nombre}</Error>}
        </div>
        <div>
          <label htmlFor="pf-correo" className="c-rotulo">
            Correo
          </label>
          <input id="pf-correo" type="email" value={correo} readOnly className="c-campo bg-(--c-hielo) text-(--c-tinta-suave)" />
          <p className="mt-2 text-[13px] text-(--c-tinta-suave)">Es tu forma de entrar; no se cambia desde acá.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-whatsapp" className="c-rotulo">
            WhatsApp <span className="font-normal text-(--c-tinta-suave)">(opcional)</span>
          </label>
          <input
            id="pf-whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={perfil?.whatsapp ?? ""}
            placeholder={`+${PAIS[pais].telefono} 8888 8888`}
            className="c-campo"
          />
          {errores.whatsapp && <Error>{errores.whatsapp}</Error>}
        </div>
        <div>
          <label htmlFor="pf-pais" className="c-rotulo">
            País
          </label>
          <select id="pf-pais" name="pais" value={pais} onChange={(e) => setPais(e.target.value as Pais)} className="c-campo">
            {PAISES.map((p) => (
              <option key={p} value={p}>
                {PAIS[p].nombre}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[13px] text-(--c-tinta-suave)">
            Los precios se muestran en {PAIS[pais].moneda}.
          </p>
          {errores.pais && <Error>{errores.pais}</Error>}
        </div>
      </div>

      <label className="flex items-start gap-3 text-[14px] text-(--c-tinta)">
        <input type="checkbox" name="marketing" defaultChecked={perfil?.acepta_marketing ?? false} className="mt-1 h-4 w-4 accent-(--c-marino)" />
        Quiero recibir novedades de CELEBRAR (diseños nuevos, funciones). Se puede quitar cuando querás.
      </label>

      {estado?.mensaje && (
        <p role="alert" className="rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[14px] text-(--c-coral-tinta)">
          {estado.mensaje}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--c-linea) pt-5">
        <p role="status" className="text-[14px] text-(--c-ok)">
          {estado?.guardado ? "Guardado." : ""}
        </p>
        <button type="submit" disabled={pendiente} className="c-boton c-boton-primario">
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-[13px] text-(--c-coral-tinta)">
      {children}
    </p>
  );
}
