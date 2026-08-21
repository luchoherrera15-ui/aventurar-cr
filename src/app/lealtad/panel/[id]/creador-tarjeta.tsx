"use client";

import { useState, useTransition } from "react";
import { coloresDePaleta, PALETAS } from "@/lib/lealtad/paletas";
import { configPorDefecto } from "@/lib/lealtad/tipos-tarjeta";
import { REGLAS_VACIAS } from "./paso-reglas";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";
import TarjetaFormulario, { type ValorFormulario } from "@/app/lealtad/tarjeta-formulario";
import { Icono } from "./iconos";
import { crearTarjeta, type BorradorTarjeta } from "./crear-actions";

/**
 * CREAR UNA TARJETA — desde el panel autenticado.
 *
 * Este archivo dejó de dibujar su propio formulario (era un asistente
 * de cinco pasos con puntitos, el más alejado de "un solo panel" que
 * pidió el dueño). Ahora es un envoltorio delgado: guarda el borrador
 * en `useState`, y `TarjetaFormulario` (modo "crear") dibuja las
 * secciones — la MISMA UI que usan la página pública (modo "publico")
 * y el editor de una tarjeta existente (modo "editar"). Ver el
 * comentario grande de `tarjeta-formulario.tsx`.
 *
 * El guardado NO se tocó: sigue siendo `crearTarjeta`
 * (`crear-actions.ts`), con su propio reintento por columnas
 * degradables y su propia traducción de errores — eso ya funciona en
 * producción y unificar la UI no es motivo para reescribirlo.
 */
export default function CreadorTarjeta({
  ranchoId,
  negocioNombre,
  plan = null,
  ayudaInicial = null,
}: {
  ranchoId: string;
  negocioNombre: string;
  /** El paquete del negocio (0142): decide qué tipos se pueden elegir. */
  plan?: string | null;
  /** El hilo de ayuda con el equipo, si ya hay uno abierto (0149). */
  ayudaInicial?: HiloAyuda | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();

  const paletaInicial = coloresDePaleta(PALETAS.sellos);
  const [valor, setValor] = useState<ValorFormulario>({
    nombre: "",
    tipo: "sellos",
    beneficio: configPorDefecto("sellos"),
    colorFondo: paletaInicial.fondo,
    colorSello: paletaInicial.sello,
    iconoSello: null,
    iconoUrl: "",
    logoUrl: "",
    bannerUrl: "",
    reglas: REGLAS_VACIAS,
    vencenMeses: null,
    telefono: "",
    imagenModo: "ninguna",
    imagenStockId: null,
    franjaModo: "ninguna",
    franjaBancoId: null,
    planElegido: null,
  });

  function alCambiar(p: Partial<ValorFormulario>) {
    setValor((v) => ({ ...v, ...p }));
  }

  function publicar() {
    setError(null);
    const borrador: BorradorTarjeta = {
      ranchoId,
      nombre: valor.nombre.trim(),
      tipo: valor.tipo,
      beneficio: valor.beneficio,
      colorFondo: valor.colorFondo,
      colorSello: valor.colorSello,
      iconoSello: valor.tipo === "sellos" ? valor.iconoSello : null,
      iconoUrl: valor.tipo === "sellos" ? valor.iconoUrl.trim() : "",
      logoUrl: valor.logoUrl.trim(),
      bannerUrl: valor.bannerUrl.trim(),
      reglas: valor.reglas,
      sellosVencenMeses: valor.tipo === "sellos" ? valor.vencenMeses : null,
    };
    guardar(async () => {
      const res = await crearTarjeta(borrador);
      if (res.ok) setCreada(res.programaId);
      else setError(res.motivo);
    });
  }

  if (creada) {
    return (
      <div className="rounded-3xl border border-bookea-linea bg-white p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bookea-azul-suave text-bookea-azul">
          <Icono nombre="listo" className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-[20px] font-extrabold text-bookea-tinta">Tu tarjeta ya existe</h2>
        <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-bookea-gris">
          <strong>{valor.nombre.trim()}</strong> quedó publicada. Compartí tu QR desde el panel y tus clientes ya la
          pueden agregar al teléfono.
        </p>
        <a
          href={`/lealtad/panel/${ranchoId}#poster`}
          className="presionable mt-5 inline-block rounded-xl px-5 py-3 text-[13.5px] font-extrabold"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          Ver mi QR →
        </a>
      </div>
    );
  }

  return (
    <TarjetaFormulario
      modo="crear"
      ranchoId={ranchoId}
      negocioNombre={negocioNombre}
      plan={plan}
      ayudaInicial={ayudaInicial}
      valor={valor}
      alCambiar={alCambiar}
      guardando={guardando}
      error={error}
      onGuardar={publicar}
    />
  );
}

// `elegirTipo`, los pasos con puntitos y `Resumen`/`resumenDelBeneficio`
// vivían acá. Los dos primeros los reemplaza `TarjetaFormulario`; el
// resumen final también — su propia sección "Revisar y crear" arma la
// misma tabla con el mismo `resumenDeReglas` que ya compartía este
// archivo con `panel/[id]/editor-tarjeta.tsx`.
