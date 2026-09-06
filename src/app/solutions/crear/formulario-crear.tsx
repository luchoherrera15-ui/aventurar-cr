"use client";

import { useActionState, useState } from "react";
import { crearNegocioSolutions } from "./actions";
import { TOPES } from "@/lib/solutions/tipos";
import { GRUPO_RUBRO, RUBRO, RUBROS, type Rubro } from "@/lib/solutions/rubros";
import { banderaDe, MONEDA, monedaDelPais, PAIS, PAISES, type Pais } from "@/lib/monedas";

const CAMPO =
  "mt-1.5 w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-3 text-[16px] font-bold text-aventurea-navy outline-none focus:border-bookea-azul";
const ROTULO = "text-[12px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft";

/**
 * El alta: nombre, rubro y país (0236). Con el rubro el panel ya habla
 * el idioma del negocio (menú / servicios / catálogo) y con el país
 * salen la moneda y el prefijo del WhatsApp. Todo se puede cambiar
 * después en Mi página.
 *
 * `nombreInicial` lo trae `?nombre=` cuando la persona ya escribió su
 * negocio en el reclamo del link de la landing de Linksy: llegar acá y
 * tener que escribirlo de nuevo es el paso que hace abandonar un alta.
 * Es `defaultValue` y no `value`: el campo sigue siendo suyo desde el
 * primer tecleo, sin que este componente tenga que gobernarlo.
 */
export default function FormularioCrear({ nombreInicial = "" }: { nombreInicial?: string }) {
  const [estado, accion, pendiente] = useActionState(crearNegocioSolutions, null);
  const [rubro, setRubro] = useState<Rubro>("restaurante");
  const [pais, setPais] = useState<Pais>("CR");
  const grupos = Array.from(new Set(RUBROS.map((r) => RUBRO[r].grupo)));
  const moneda = monedaDelPais(pais);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div>
        <label htmlFor="nombre" className={ROTULO}>
          Nombre del negocio
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          minLength={2}
          maxLength={TOPES.nombre}
          defaultValue={nombreInicial}
          autoFocus
          placeholder="Café Aroma"
          className={CAMPO}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rubro" className={ROTULO}>
            ¿Qué tipo de negocio es?
          </label>
          <select id="rubro" name="rubro" value={rubro} onChange={(e) => setRubro(e.target.value as Rubro)} className={CAMPO}>
            {grupos.map((g) => (
              <optgroup key={g} label={GRUPO_RUBRO[g]}>
                {RUBROS.filter((r) => RUBRO[r].grupo === g).map((r) => (
                  <option key={r} value={r}>
                    {RUBRO[r].nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">{RUBRO[rubro].pie}</p>
        </div>
        <div>
          <label htmlFor="pais" className={ROTULO}>
            País
          </label>
          <select id="pais" name="pais" value={pais} onChange={(e) => setPais(e.target.value as Pais)} className={CAMPO}>
            {PAISES.map((p) => (
              <option key={p} value={p}>
                {banderaDe(p)} {PAIS[p].nombre}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
            Precios en {MONEDA[moneda].nombre.toLowerCase()} ({MONEDA[moneda].simbolo}) · WhatsApp +{PAIS[pais].telefono}. Se cambia después.
          </p>
        </div>
      </div>
      {estado?.error && <p className="rounded-xl bg-red-50 p-3 text-[13px] font-bold text-red-700">{estado.error}</p>}
      <button
        type="submit"
        disabled={pendiente}
        className="presionable inline-flex min-h-[48px] items-center justify-center rounded-xl bg-aventurea-navy px-6 text-[15px] font-extrabold text-white disabled:opacity-60"
      >
        {pendiente ? "Creando…" : "Crear mi negocio →"}
      </button>
    </form>
  );
}
