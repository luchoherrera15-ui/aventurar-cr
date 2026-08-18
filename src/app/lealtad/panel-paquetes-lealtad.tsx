"use client";

import Link from "next/link";
import {
  PLANES_VIGENTES,
  PLAN_DESTACADO,
  precioDe,
  tiposDelPlan,
  planQueDesbloquea,
  etiquetasDeCapacidades,
  type DefinicionPlan,
} from "@/lib/lealtad/planes";
import { TIPOS_TARJETA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { Icono } from "./panel/[id]/iconos";

/**
 * MODO 2 — «al hacer clic en el botón se abren los paquetes que
 * ofrecemos para que vean lo que están creando y al crear gratis lo que
 * obtendrán luego».
 *
 * Los datos salen de `src/lib/lealtad/planes.ts` DEL LADO DEL CLIENTE,
 * igual que ya hacía `configurador-lealtad.tsx` hasta hoy — no de
 * `catalogoPublico()` traído por el servidor. No hay ninguna red de por
 * medio (es JS que ya viaja al cliente en este mismo módulo) y agregar
 * el viaje por `page.tsx` solo suma un archivo tocado y un prop más sin
 * ganar nada real. Si mañana esto se expone por HTTP a la app móvil, ahí
 * sí aplica el criterio de blindar "la última puerta antes de la red" —
 * hoy no hay puerta que blindar.
 *
 * Es una vista de SOLO LECTURA: sin diálogo modal, sin SINPE/Stripe, sin
 * selector de negocio (todo eso vive en `/lealtad/planes`, que se sigue
 * ofreciendo como el link de "ver el detalle completo"). Los dos CTA no
 * son dos flujos distintos — el texto cambia según si el tipo elegido es
 * gratis o pago, pero los dos hacen lo mismo: `alSeguir()`. Ninguno
 * bloquea el avance, a propósito: armar la tarjeta es gratis siempre, y
 * el único momento honesto para pedir plata es cuando la persona ya
 * decidió publicar (la sección «Revisar y crear» del editor, con el
 * mismo aviso ámbar de siempre). Bloquear acá sería un candado que el
 * resto del producto no tiene.
 */
export default function PanelPaquetesLealtad({
  tipoElegido,
  alSeguir,
}: {
  tipoElegido: TipoTarjeta;
  alSeguir: () => void;
}) {
  const esGratis = tiposDelPlan("prueba").includes(tipoElegido);
  const planQueAbre = esGratis ? null : planQueDesbloquea(tipoElegido);
  const idResaltado = esGratis ? "prueba" : (planQueAbre?.id ?? null);

  return (
    <div className="p-4 lg:p-5">
      <h2 className="titulo text-[18px] text-bookea-tinta">Elegí tu paquete</h2>
      <p className="mt-0.5 text-[12px] text-bookea-gris">
        Armar tu tarjeta de {TIPOS_TARJETA[tipoElegido].nombre.toLowerCase()} es gratis con
        cualquiera de estos — vas a ver todo antes de crear cuenta.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANES_VIGENTES.map((def) => (
          <TarjetaPlanLectura key={def.id} def={def} resaltado={def.id === idResaltado} />
        ))}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={alSeguir}
          className="presionable w-full rounded-full px-5 py-3 text-[13.5px] font-extrabold"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          {esGratis ? "Crear gratis y personalizar →" : "Personalizar mi tarjeta →"}
        </button>
        <p className="mt-2.5 text-center text-[11.5px]">
          <Link href="/lealtad/planes" className="font-bold text-bookea-azul underline">
            Ver el detalle completo de los paquetes →
          </Link>
        </p>
      </div>
    </div>
  );
}

function TarjetaPlanLectura({ def, resaltado }: { def: DefinicionPlan; resaltado: boolean }) {
  const precio = precioDe(def);
  const esGratis = def.precioMensual === 0;
  const destacado = def.id === PLAN_DESTACADO;
  const beneficios = etiquetasDeCapacidades(def).slice(0, 4);

  return (
    <div
      className={`flex flex-col rounded-2xl border p-3.5 ${
        resaltado
          ? "border-bookea-azul bg-bookea-azul-suave"
          : destacado
            ? "border-bookea-linea bg-bookea-fondo"
            : "border-bookea-linea bg-white"
      }`}
    >
      {resaltado ? (
        <span
          className="mb-1.5 self-start rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          Con lo que elegiste
        </span>
      ) : destacado ? (
        <span className="mb-1.5 self-start rounded-full bg-orange-50 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-orange-700">
          El más popular
        </span>
      ) : (
        <span className="mb-1.5 h-[19px]" aria-hidden />
      )}

      <h3 className="text-[14.5px] font-extrabold text-bookea-tinta">{def.nombre}</h3>
      <p className="mt-0.5 text-[17px] font-extrabold leading-none text-bookea-tinta">
        {precio === null ? "A convenir" : esGratis ? "Gratis" : precio}
        {!esGratis && precio !== null && (
          <span className="text-[11px] font-bold text-bookea-gris"> /mes</span>
        )}
      </p>

      <ul className="mt-2.5 flex-1 space-y-1">
        {beneficios.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-[11px] leading-snug text-bookea-gris">
            <Icono nombre="listo" className="mt-0.5 h-3 w-3 shrink-0 text-bookea-azul" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
