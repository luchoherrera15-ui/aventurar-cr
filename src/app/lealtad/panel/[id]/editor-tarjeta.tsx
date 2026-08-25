"use client";

import { useEffect, useMemo, useState } from "react";
import { metaDe, type ConfigBeneficio, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { avisoDeMeta, puedeCambiarTipo, puedeEditarse, type SituacionTarjeta } from "@/lib/lealtad/editable";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";
import TarjetaFormulario, { type CandadoTipo, type ValorFormulario } from "@/app/lealtad/tarjeta-formulario";
import type { Reglas } from "./paso-reglas";
import { contextoDeLaTarjeta } from "./pases-actions";
import { usePrograma, type Borrador } from "./programa-contexto";

/**
 * EDITAR UNA TARJETA QUE YA EXISTE — desde el panel autenticado.
 *
 * Igual que `creador-tarjeta.tsx`, este archivo dejó de dibujar su
 * propio formulario: es el ADAPTADOR entre el borrador compartido de
 * `usePrograma()` (colores/ícono/imágenes — lo que también editan
 * «Recompensas» y «Tarjeta digital» del panel de Bookea) y
 * `TarjetaFormulario` (modo "editar"), que dibuja las secciones —la
 * MISMA UI que la página pública y el creador. Ver el comentario
 * grande de `tarjeta-formulario.tsx`.
 *
 * Por qué esto NO puede ser el mismo `useState` simple que usa
 * `creador-tarjeta.tsx`: nombre/tipo/beneficio/reglas/vencenMeses SÍ
 * son locales de esta pantalla, pero colorFondo/colorSello/iconoSello/
 * iconoUrl/logoUrl/bannerUrl viven en el `borrador` de
 * `usePrograma()`, porque «Recompensas» y «Tarjeta digital» —las
 * secciones del panel de Bookea— leen y escriben esos mismos campos
 * fuera de esta pantalla. `alCambiarFormulario` reparte cada patch al
 * lugar que corresponde; `guardarTodo` (en `programa-contexto.tsx`) ya
 * sabía combinar las dos mitades al guardar, y eso NO se tocó.
 */
export default function EditorTarjeta({
  ranchoId,
  programaId,
  negocioNombre,
  plan,
  situacion,
  nombreInicial,
  beneficioInicial,
  reglasIniciales,
  vencimientoInicial = null,
  metaActual,
  ayudaInicial = null,
}: {
  ranchoId: string;
  programaId: string;
  negocioNombre: string;
  plan: string | null;
  situacion: SituacionTarjeta;
  nombreInicial: string;
  beneficioInicial: ConfigBeneficio;
  reglasIniciales: Reglas;
  /**
   * Los meses de inactividad tras los que se reinician los sellos
   * (0180). null = no vencen, que es el caso de casi todas y el de
   * cualquier tarjeta guardada antes de esa migración.
   */
  vencimientoInicial?: number | null;
  /**
   * La meta que la tarjeta promete HOY. En sellos sale de la recompensa
   * activa más barata —que es de donde la saca el pase real— y no del
   * jsonb, así que el aviso de «vas a mover la meta» compara contra lo
   * que el cliente ve en el teléfono.
   */
  metaActual: number | null;
  /** El hilo de ayuda con el equipo, si ya hay uno abierto (0149). */
  ayudaInicial?: HiloAyuda | null;
}) {
  const { borrador, cambiar, ocupado, error, guardarTodo } = usePrograma();

  const [nombre, setNombre] = useState(nombreInicial);
  const [tipo, setTipo] = useState<TipoTarjeta>(situacion.tipo);
  const [beneficio, setBeneficio] = useState<ConfigBeneficio>(beneficioInicial);
  const [reglas, setReglas] = useState<Reglas>(reglasIniciales);
  // El vencimiento de sellos (0180). Abre con lo que la tarjeta tiene
  // guardado: si abriera apagado, el primer «Guardar» le apagaría la
  // regla al dueño sin que la haya tocado.
  const [vencenMeses, setVencenMeses] = useState<number | null>(vencimientoInicial);

  // El nombre del negocio (para el reverso del pase) y cuántos ya están
  // instalados.
  const [nombreNegocioReal, setNombreNegocioReal] = useState(negocioNombre);
  const [emitidos, setEmitidos] = useState(0);
  useEffect(() => {
    let vivo = true;
    void contextoDeLaTarjeta(ranchoId, programaId).then((r) => {
      if (!vivo) return;
      setNombreNegocioReal(r.negocioNombre);
      setEmitidos(r.pasesEmitidos);
    });
    return () => {
      vivo = false;
    };
  }, [ranchoId, programaId]);

  const editable = puedeEditarse(situacion);
  const bloqueada = !editable.puede;
  const cambioDeTipo = puedeCambiarTipo(situacion);
  const candado: CandadoTipo = cambioDeTipo.puede
    ? { puede: true, motivo: null }
    : { puede: false, motivo: cambioDeTipo.motivo };

  const aviso = useMemo(
    () =>
      avisoDeMeta({
        miembros: situacion.miembros,
        anterior: metaActual,
        nueva: metaDe(beneficio),
        tipo,
      }),
    [situacion.miembros, metaActual, beneficio, tipo],
  );

  /**
   * Reparte cada patch al lugar donde de verdad vive: los cinco campos
   * de esta pantalla van a `useState` local, y colores/ícono/imágenes
   * van al `borrador` compartido — ver el comentario grande de arriba.
   */
  function alCambiarFormulario(p: Partial<ValorFormulario>) {
    if (p.nombre !== undefined) setNombre(p.nombre);
    if (p.tipo !== undefined) setTipo(p.tipo);
    if (p.beneficio !== undefined) setBeneficio(p.beneficio);
    if (p.reglas !== undefined) setReglas(p.reglas);
    if (p.vencenMeses !== undefined) setVencenMeses(p.vencenMeses);

    const cambiosBorrador: Partial<Borrador> = {};
    if (p.colorFondo !== undefined) cambiosBorrador.colorFondo = p.colorFondo;
    if (p.colorSello !== undefined) cambiosBorrador.colorSello = p.colorSello;
    if (p.iconoSello !== undefined) cambiosBorrador.iconoSello = p.iconoSello;
    if (p.iconoUrl !== undefined) cambiosBorrador.iconoUrl = p.iconoUrl;
    if (p.logoUrl !== undefined) cambiosBorrador.logoUrl = p.logoUrl;
    if (p.bannerUrl !== undefined) cambiosBorrador.bannerUrl = p.bannerUrl;
    if (p.notificacionLogoUrl !== undefined) cambiosBorrador.notificacionLogoUrl = p.notificacionLogoUrl;
    if (Object.keys(cambiosBorrador).length > 0) cambiar(cambiosBorrador);
  }

  function aplicar() {
    guardarTodo({ nombre: nombre.trim(), tipo, beneficio, reglas, vencenMeses });
  }

  const valor: ValorFormulario = {
    nombre,
    tipo,
    beneficio,
    colorFondo: borrador.colorFondo,
    colorSello: borrador.colorSello,
    iconoSello: borrador.iconoSello,
    iconoUrl: borrador.iconoUrl,
    logoUrl: borrador.logoUrl,
    bannerUrl: borrador.bannerUrl,
    notificacionLogoUrl: borrador.notificacionLogoUrl,
    reglas,
    vencenMeses,
    // Los tres de abajo no aplican en "editar" (son del banco de
    // plantillas de la página pública): quedan en su valor vacío.
    telefono: "",
    imagenModo: "ninguna",
    imagenStockId: null,
    franjaModo: "ninguna",
    franjaBancoId: null,
    planElegido: null,
  };

  return (
    <TarjetaFormulario
      modo="editar"
      ranchoId={ranchoId}
      programaId={programaId}
      negocioNombre={negocioNombre}
      negocioNombreReal={nombreNegocioReal}
      plan={plan}
      ayudaInicial={ayudaInicial}
      candado={candado}
      bloqueada={bloqueada}
      motivoBloqueada={editable.puede ? null : editable.motivo}
      aviso={aviso}
      emitidos={emitidos}
      valor={valor}
      alCambiar={alCambiarFormulario}
      guardando={ocupado}
      error={error}
      onGuardar={aplicar}
    />
  );
}
