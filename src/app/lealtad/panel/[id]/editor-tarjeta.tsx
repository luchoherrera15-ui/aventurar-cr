"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  configPorDefecto,
  metaDe,
  TIPOS_TARJETA,
  tipoDe,
  validarBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { contraste } from "@/lib/invitaciones/paleta";
import { avisoDeMeta, puedeCambiarTipo, puedeEditarse, type SituacionTarjeta } from "@/lib/lealtad/editable";
import { Icono, type NombreIcono } from "./iconos";
import SelectorTipo from "@/components/lealtad/selector-tipo";
import PasoBeneficio from "@/components/lealtad/paso-beneficio";
import PasoReglas, { resumenDeReglas, type Reglas } from "./paso-reglas";
import EditorRecompensas from "./editor-recompensas";
import SubirImagen from "@/components/subir-imagen";
import CampoColor from "@/components/campo-color";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import VistaPase from "@/components/lealtad/vista-pase";
import { BloqueEstado } from "./pases-panel";
import { AvisoError, AvisoGuardado, usePrograma } from "./programa-contexto";
import { contextoDeLaTarjeta } from "./pases-actions";
import AyudaDeDiseno from "./ayuda-diseno";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";

/**
 * EL EDITOR DE UNA TARJETA QUE YA EXISTE.
 *
 * ------------------------------------------------------------------
 * UN SOLO PANEL, EL MISMO QUE SE USA PARA CREAR
 * ------------------------------------------------------------------
 * Antes esto vivía en pestañas (Configurar/Regalías/Estado), un patrón
 * distinto al de `/lealtad` (Modo 3, `editor-tarjeta-completo.tsx`):
 * secciones numeradas en una sola columna que se scrollea, con el pase
 * pegado al costado. El dueño pidió explícitamente UN SOLO panel para
 * crear y modificar — este archivo adopta ese mismo lenguaje visual
 * (el componente `Seccion` de acá abajo es una copia intencional del
 * de `editor-tarjeta-completo.tsx`, no una importación: los dos
 * contextos difieren en columna de vista previa y en que acá los
 * campos ya vienen llenos, así que mantenerlos separados evita que un
 * cambio pensado para "crear sin cuenta" rompa "editar con cuenta").
 *
 * Regalías y Estado se suman como secciones 4 y 5 — antes no existían
 * al crear una tarjeta nueva (no hay recompensas ni estado que
 * gestionar antes de que la tarjeta exista), así que solo aparecen
 * acá, en el editor de una tarjeta que ya se publicó.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ES UNA PANTALLA POR TARJETA Y NO UNA SECCIÓN DEL PANEL
 * ------------------------------------------------------------------
 * Las secciones «Recompensas» y «Tarjeta digital» del panel cuelgan de
 * la tarjeta PRINCIPAL —la que `elegirPrograma` decide que manda— y
 * desde la 0134 un negocio puede tener varias. O sea que con dos
 * tarjetas, tocar la B llevaba a editar la A: los enlaces de la lista
 * apuntaban todos a la misma ancla y no existía ninguna ruta que dijera
 * QUÉ tarjeta se estaba editando.
 *
 * Acá el id viaja en la URL. La pantalla edita esa, y ninguna otra.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTE ARCHIVO NO DECIDE
 * ------------------------------------------------------------------
 * Nada. El candado del tipo, el veredicto de si la tarjeta se puede
 * editar y el tope del paquete se vuelven a comprobar en
 * `guardarBeneficio` con las mismas funciones puras
 * (src/lib/lealtad/editable.ts). Acá se pintan para que el dueño lo
 * sepa ANTES de escribir, no para autorizar: una petición armada a mano
 * no pasa por este archivo.
 *
 * ------------------------------------------------------------------
 * REGALÍAS Y ESTADO SON PANELES INDEPENDIENTES, NO PARTE DEL "GUARDAR"
 * ------------------------------------------------------------------
 * `EditorRecompensas` y `BloqueEstado` ya traen su propia tarjeta
 * blanca (`rounded-2xl border...`) y sus propias acciones (crear/
 * archivar una recompensa, pausar/archivar la tarjeta) — no comparten
 * el botón "Guardar cambios" de las secciones 1-3, que solo aplica
 * `guardarTodo`. Por eso van directo dentro de su `Seccion`, sin
 * envolverlas en otra tarjeta más (evita "tarjeta dentro de tarjeta").
 */

const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris";

/** WCAG AA para texto — mismo umbral que usaba `seccion-tarjeta-digital.tsx`. */
const CONTRASTE_TEXTO = 4.5;
/** Los sellos son formas grandes, no texto: el umbral de gráficos alcanza. */
const CONTRASTE_SELLO = 2.2;

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
  const { borrador, cambiar, ocupado, guardarTodo } = usePrograma();

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
  const cambio = puedeCambiarTipo(situacion);
  const motivoBeneficio = validarBeneficio(beneficio);
  const esSellos = tipo === "sellos";
  const contrasteTexto = contraste(borrador.colorFondo, "#ffffff");
  const contrasteSello = contraste(borrador.colorSello, borrador.colorFondo);

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

  const resumen = resumenDeReglas(reglas);

  // Cambiar de tipo REEMPLAZA la config: los campos de una gift card no
  // significan nada en una tarjeta de sellos, y arrastrarlos dejaría
  // basura invisible en el jsonb.
  function elegirTipo(nuevo: TipoTarjeta) {
    setTipo(nuevo);
    setBeneficio(configPorDefecto(nuevo));
    if (nuevo !== "sellos") cambiar({ iconoSello: null, iconoUrl: "" });
  }

  function aplicar() {
    guardarTodo({ nombre: nombre.trim(), tipo, beneficio, reglas, vencenMeses });
  }

  return (
    <div>
      {bloqueada && (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[13px] font-bold leading-relaxed text-amber-900"
        >
          {editable.motivo}
        </p>
      )}

      <AvisoError />
      <AvisoGuardado />

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
        <div className="min-w-0">
          <Seccion numero={1} titulo="Tu negocio" bajada="Cómo se llama y qué tipo de tarjeta es." primera>
            <div className="space-y-4">
              <label className="block">
                <span className={etiqueta}>Nombre de la tarjeta</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={bloqueada}
                  maxLength={80}
                  className={campo}
                />
                <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                  Es el nombre con el que la ves vos en el panel. En el pase, el cliente lee el
                  nombre del negocio.
                </p>
              </label>

              <div>
                <span className={etiqueta}>Tipo de tarjeta</span>
                {cambio.puede && !bloqueada ? (
                  <>
                    <SelectorTipo valor={tipo} alElegir={elegirTipo} plan={plan} />
                    <p className="mt-2 text-[11.5px] leading-relaxed text-bookea-gris">
                      Todavía no hay nadie adentro, así que el tipo se puede cambiar. Apenas se
                      afilie el primer cliente queda fijo — su saldo pasaría a significar otra
                      cosa.
                    </p>
                  </>
                ) : (
                  <TipoCerrado tipo={tipo} motivo={cambio.puede ? null : cambio.motivo} />
                )}
              </div>
            </div>
          </Seccion>

          <Seccion numero={2} titulo="Programa" bajada="Qué se gana y cómo.">
            <div className="space-y-4">
              <PasoBeneficio
                config={beneficio}
                alCambiar={setBeneficio}
                vencenMeses={vencenMeses}
                alCambiarVencimiento={setVencenMeses}
              />
              {motivoBeneficio && (
                <p
                  role="status"
                  className="rounded-xl bg-bookea-azul-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-azul"
                >
                  {motivoBeneficio}
                </p>
              )}
              {aviso && (
                <p
                  role="status"
                  className="rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] font-bold leading-relaxed text-amber-800"
                >
                  {aviso}
                </p>
              )}

              <div className="border-t border-bookea-linea pt-4">
                <span className={etiqueta}>Cuándo vale</span>
                <p className="mb-3 text-[12.5px] leading-relaxed text-bookea-gris">
                  Hoy: <strong>{resumen.vigencia}</strong> · {resumen.cuando} · {resumen.canjes}.
                </p>
                <PasoReglas reglas={reglas} alCambiar={setReglas} />
              </div>
            </div>
          </Seccion>

          <Seccion numero={3} titulo="Apariencia" bajada="Cómo se ve en el teléfono de tu cliente.">
            <div className="space-y-6">
              <div>
                <span className={etiqueta}>Color de la tarjeta</span>
                <PlantillasColor
                  colorFondo={borrador.colorFondo}
                  colorSello={borrador.colorSello}
                  alElegir={({ fondo, sello }) => cambiar({ colorFondo: fondo, colorSello: sello })}
                />
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                  <CampoColor
                    id="e-fondo"
                    etiqueta="Color de fondo"
                    valor={borrador.colorFondo}
                    alCambiar={(v) => cambiar({ colorFondo: v })}
                  />
                  <CampoColor
                    id="e-acento"
                    etiqueta={esSellos ? "Color del sello" : "Color del acento"}
                    valor={borrador.colorSello}
                    alCambiar={(v) => cambiar({ colorSello: v })}
                  />
                </div>
                {contrasteTexto < CONTRASTE_TEXTO && (
                  <p
                    role="status"
                    className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-amber-800"
                  >
                    Con ese fondo tan claro el texto de la tarjeta —que siempre es blanco— casi no
                    se lee. Probá un tono más oscuro o elegí uno de los temas de arriba.
                  </p>
                )}
                {contrasteSello < CONTRASTE_SELLO && (
                  <p
                    role="status"
                    className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-amber-800"
                  >
                    {esSellos
                      ? "El color del sello se confunde con el fondo: los sellos van a verse todos iguales, ganados y por ganar."
                      : "El acento se confunde con el fondo y no se va a notar."}
                  </p>
                )}
              </div>

              {esSellos && (
                <div>
                  <span className={etiqueta}>Icono del sello</span>
                  <SelectorIconoSello
                    valor={borrador.iconoSello}
                    alElegir={(icono) => cambiar({ iconoSello: icono })}
                    colorFondo={borrador.colorFondo}
                    colorSello={borrador.colorSello}
                    iconoUrl={borrador.iconoUrl || null}
                    alSubirIcono={(url) => cambiar({ iconoUrl: url })}
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <SubirImagen
                    etiqueta="Logo del negocio"
                    valor={borrador.logoUrl}
                    alCambiar={(url) => cambiar({ logoUrl: url })}
                    destino="logo"
                    carpeta="lealtad/logos"
                  />
                  <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                    Sin logo, la tarjeta escribe el nombre del negocio.
                  </p>
                </div>
                <div>
                  <SubirImagen
                    etiqueta="Banda de la tarjeta (opcional)"
                    valor={borrador.bannerUrl}
                    alCambiar={(url) => cambiar({ bannerUrl: url })}
                    destino="banner"
                    carpeta="lealtad/bandas"
                  />
                  <p className="mt-1.5 text-[11.5px] text-bookea-gris">La franja de arriba del pase.</p>
                </div>
              </div>

              {emitidos > 0 && (
                <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] font-bold leading-relaxed text-amber-800">
                  Ya hay {emitidos} {emitidos === 1 ? "tarjeta" : "tarjetas"} en teléfonos de
                  clientes. Al guardar, {emitidos === 1 ? "esa tarjeta cambia" : "esas tarjetas cambian"}{" "}
                  de aspecto la próxima vez que el teléfono las actualice.
                </p>
              )}
            </div>
          </Seccion>

          {/* Un solo "Guardar cambios" para las secciones 1-3 (mismo
              origen: `guardarTodo`, en programa-contexto.tsx). Regalías
              y Estado (4-5) guardan por su cuenta — ver el comentario
              grande de arriba. */}
          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-bookea-linea pt-7">
            <button
              type="button"
              onClick={aplicar}
              disabled={bloqueada || ocupado || motivoBeneficio !== null || !nombre.trim()}
              className="presionable rounded-xl bg-bookea-tinta px-5 py-3 text-[13px] font-extrabold text-white disabled:opacity-40"
            >
              {ocupado ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>

          <Seccion numero={4} titulo="Regalías" bajada="Las recompensas que tus clientes canjean.">
            <EditorRecompensas />
          </Seccion>

          <Seccion numero={5} titulo="Estado" bajada="Pausar, archivar o ver el histórico.">
            <div className="space-y-4">
              <BloqueEstado />
              <p className="rounded-2xl border border-bookea-linea bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-bookea-gris">
                Archivar libera el cupo de tarjetas de tu paquete al instante. Los clientes que
                ya tienen esta tarjeta no pierden nada: su saldo y su historial quedan tal cual,
                pero deja de emitir pases nuevos.
              </p>
              <Link
                href={`/lealtad/panel/${ranchoId}#programas`}
                className="inline-block text-[12.5px] font-bold text-bookea-azul underline"
              >
                ← Volver a mis tarjetas
              </Link>
            </div>
          </Seccion>
        </div>

        {/* ── Vista previa: pegada en escritorio ────────────────────
            Mismo patrón que editor-tarjeta-completo.tsx. */}
        <aside className="mt-5 hidden lg:mt-0 lg:block">
          <div className="sticky top-24">
            <VistaPase
              datos={{
                negocioNombre: nombreNegocioReal,
                modo: tipo,
                beneficio,
                colorFondo: borrador.colorFondo,
                colorSello: borrador.colorSello,
                iconoSello: borrador.iconoSello,
                iconoUrl: borrador.iconoUrl || null,
                logoUrl: borrador.logoUrl || null,
                bannerUrl: borrador.bannerUrl || null,
              }}
            />
          </div>
        </aside>
      </div>

      {/* ── La salida cuando no le gusta cómo quedó ────────────────
          Visible siempre, no colgada de ninguna sección en particular:
          el dueño que no está conforme con su tarjeta no llega ahí por
          un camino fijo.

          Lo visual sale del BORRADOR compartido y no de la fila
          guardada: si acaba de mover los colores y todavía no guardó,
          lo que no le gusta es lo que está viendo. */}
      <div className="mt-7 border-t border-bookea-linea pt-7">
        <AyudaDeDiseno
          ranchoId={ranchoId}
          programaId={programaId}
          hiloInicial={ayudaInicial}
          tipo={tipoDe(borrador.modo)}
          colorFondo={borrador.colorFondo}
          colorSello={borrador.colorSello}
          iconoSello={borrador.iconoSello}
          tieneLogo={borrador.logoUrl.trim().length > 0}
          tieneBanda={borrador.bannerUrl.trim().length > 0}
        />
      </div>
    </div>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────

/** Mismo patrón visual que `editor-tarjeta-completo.tsx` (Modo 3 del
 * configurador sin cuenta) — copiado a propósito, no importado: ver el
 * comentario grande de arriba. */
function Seccion({
  numero,
  titulo,
  bajada,
  primera = false,
  children,
}: {
  numero: number;
  titulo: string;
  bajada: string;
  /** La primera sección no lleva el borde/separación de arriba. */
  primera?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={primera ? "" : "mt-7 border-t border-bookea-linea pt-7"}>
      <div className="flex items-baseline gap-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bookea-azul-suave text-[12px] font-extrabold text-bookea-azul">
          {numero}
        </span>
        <div>
          <h2 className="titulo text-[17px] text-bookea-tinta">{titulo}</h2>
          <p className="text-[12px] text-bookea-gris">{bajada}</p>
        </div>
      </div>
      <div className="mt-3.5 pl-[33px]">{children}</div>
    </section>
  );
}

/**
 * El tipo cuando NO se puede cambiar.
 *
 * Se pinta como un dato, no como un selector apagado. Ocho tarjetas
 * deshabilitadas se leen como «esto está roto»; una sola con su nombre
 * y el motivo al lado se lee como lo que es: una decisión ya tomada.
 */
function TipoCerrado({ tipo, motivo }: { tipo: TipoTarjeta; motivo: string | null }) {
  const def = TIPOS_TARJETA[tipo];
  return (
    <div className="rounded-2xl border border-bookea-linea bg-bookea-azul-suave/40 p-4">
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: "var(--navy)" }}
        >
          <Icono nombre={def.icono as NombreIcono} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-extrabold text-bookea-tinta">{def.nombre}</span>
          <span className="block text-[11.5px] text-bookea-gris">{def.descripcion}</span>
        </span>
      </div>
      {motivo && (
        <p className="mt-3 rounded-xl bg-white px-3.5 py-2.5 text-[12px] font-bold leading-relaxed text-bookea-gris">
          {motivo}
        </p>
      )}
    </div>
  );
}
