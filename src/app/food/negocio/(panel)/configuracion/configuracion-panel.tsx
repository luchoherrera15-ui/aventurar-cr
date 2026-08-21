"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import SubirImagen from "@/components/subir-imagen";
import { EncabezadoPagina, TarjetaPanel } from "@/components/food/panel";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  ENLACE_CARD,
  RADIO_TILE,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import type { FoodBusiness, FoodLocation } from "@/lib/food/tipos";
import { guardarNegocio, guardarSede, type EstadoConfig } from "./actions";

/**
 * CONFIGURACIÓN — el formulario de la ficha del restaurante. Este
 * rediseño es SOLO la envoltura visual (tarjetas del sistema,
 * encabezado estándar, campos con los tokens del panel): las server
 * actions de ./actions.ts quedaron intactas — mismos nombres de campo,
 * mismas firmas, mismo comportamiento de guardado. La vista de
 * solo-lectura de estos datos vive en /food/negocio/perfil.
 */

const INICIAL: EstadoConfig = { error: null };

/** El campo del sistema + el foco navy que los formularios de FOOD usan. */
const CAMPO = `${CAMPO_PANEL} outline-none transition-colors focus:border-aventurea-navy`;
const ETIQUETA = `${ROTULO_CAMPO} mb-1.5 block`;

type NegocioForm = Pick<
  FoodBusiness,
  "id" | "nombre" | "descripcion" | "telefono" | "foto_portada_url" | "activo" | "slug"
>;
type SedeForm = Pick<FoodLocation, "id" | "nombre" | "direccion" | "telefono">;

export default function ConfiguracionPanel({
  negocio,
  sedes,
}: {
  negocio: NegocioForm;
  sedes: SedeForm[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Los datos con los que tu restaurante se presenta en Food Bookea."
        acciones={
          <Link href="/food/negocio/perfil" className={BOTON_PANEL}>
            Ver mi perfil
          </Link>
        }
      />

      <TarjetaPanel
        kicker="Tu restaurante"
        titulo="Datos del negocio"
        accion={
          <Link href={`/food/restaurante/${negocio.slug}`} className={ENLACE_CARD}>
            Ver página pública →
          </Link>
        }
      >
        <FormularioNegocio negocio={negocio} />
      </TarjetaPanel>

      {sedes.length > 0 && (
        <TarjetaPanel kicker="Ubicación" titulo={sedes.length === 1 ? "Tu sede" : "Tus sedes"}>
          <div className="flex flex-col gap-3">
            {sedes.map((s) => (
              <FormularioSede key={s.id} negocioId={negocio.id} sede={s} />
            ))}
          </div>
        </TarjetaPanel>
      )}
    </div>
  );
}

function FormularioNegocio({ negocio }: { negocio: NegocioForm }) {
  const accion = guardarNegocio.bind(null, negocio.id);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [foto, setFoto] = useState(negocio.foto_portada_url ?? "");

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {/* El interruptor maestro primero y con su consecuencia escrita:
          apagar el negocio es la decisión más grande de esta pantalla
          y no puede parecer un checkbox más. */}
      <label
        className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} flex cursor-pointer items-center justify-between gap-3 p-3.5`}
      >
        <span>
          <span className="block text-[13.5px] font-bold text-aventurea-ink">Publicado</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-aventurea-ink-soft">
            Con esto apagado, tu restaurante no aparece en Food Bookea ni recibe reservas.
          </span>
        </span>
        <input
          type="checkbox"
          name="activo"
          defaultChecked={negocio.activo}
          className="h-[18px] w-[18px] shrink-0 accent-aventurea-navy"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Nombre</span>
          <input name="nombre" defaultValue={negocio.nombre} required maxLength={80} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Teléfono</span>
          <input name="telefono" defaultValue={negocio.telefono ?? ""} className={CAMPO} />
        </label>
      </div>

      <label className="block">
        <span className={ETIQUETA}>Descripción</span>
        <textarea
          name="descripcion"
          defaultValue={negocio.descripcion ?? ""}
          rows={3}
          maxLength={280}
          placeholder="Dos o tres líneas sobre tu cocina: es lo que lee un cliente antes de reservar."
          className={CAMPO}
        />
      </label>

      <div>
        <SubirImagen valor={foto} alCambiar={setFoto} etiqueta="Foto de portada" carpeta="food" />
        <input type="hidden" name="foto_portada_url" value={foto} />
      </div>

      {estado.error && <p className="text-[12.5px] font-bold text-red-700">{estado.error}</p>}
      {estado.ok && <p className="text-[12.5px] font-bold text-aventurea-green">Cambios guardados.</p>}

      <button type="submit" disabled={pendiente} className={`${BOTON_PANEL_PRIMARIO} self-start`}>
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

function FormularioSede({ negocioId, sede }: { negocioId: string; sede: SedeForm }) {
  const accion = guardarSede.bind(null, negocioId, sede.id);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} flex flex-col gap-3 p-4`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={ETIQUETA}>Nombre</span>
          <input name="nombre" defaultValue={sede.nombre} required maxLength={60} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Dirección</span>
          <input name="direccion" defaultValue={sede.direccion ?? ""} maxLength={200} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Teléfono</span>
          <input name="telefono" defaultValue={sede.telefono ?? ""} className={CAMPO} />
        </label>
      </div>
      {estado.error && <p className="text-[12.5px] font-bold text-red-700">{estado.error}</p>}
      {estado.ok && <p className="text-[12.5px] font-bold text-aventurea-green">Sede guardada.</p>}
      <button type="submit" disabled={pendiente} className={`${BOTON_PANEL} self-start`}>
        {pendiente ? "Guardando…" : "Guardar sede"}
      </button>
    </form>
  );
}
