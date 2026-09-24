"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cambiarPublicacion, guardarDocumento, pagarYPublicar, resumenPublicacion, type ResumenPublicacion } from "@/app/celebrar/editor/acciones";
import { guardarComoPlantillaPartner } from "@/app/celebrar/app/partner/acciones";
import { VALOR_CREDITO_CRC, colones } from "@/lib/celebrar/creditos";
import BotonCopiar from "@/components/boton-copiar";
import Telefono from "@/components/solutions/telefono";
import type { Documento, Seccion } from "@/lib/celebrar/invitacion/esquema";
import { asignarRuta } from "@/lib/celebrar/invitacion/ruta-datos";
import { rutaEditor, rutaFicha } from "@/lib/celebrar/rutas";
import type { Celebracion } from "@/lib/celebrar/tipos";
import { IconoAlbumes, IconoEditor, IconoPlantillas } from "../iconos-celebrar";
import RenderInvitacion from "../invitacion/render-invitacion";
import { EnlaceCelebrar } from "../rutas-cliente";
import PanelEsencial from "./panel-esencial";
import PanelEstilo from "./panel-estilo";
import PanelFotos from "./panel-fotos";
import PanelMusica from "./panel-musica";
import { ProveedorIA } from "./asistente-texto";
import PanelSecciones from "./panel-secciones";

type Pestana = "esencial" | "secciones" | "fotos" | "estilo";
type Dispositivo = "movil" | "escritorio";

/** El ancho del teléfono de la previa y el alto de su pantalla (ancho × 2.05, menos el bisel). */
const ANCHO_TELEFONO = 390;
const ALTO_PANTALLA = Math.round(ANCHO_TELEFONO * 2.05) - 14;

const PESTANAS: { id: Pestana; texto: string; Icono: (p: { className?: string }) => React.JSX.Element }[] = [
  { id: "esencial", texto: "Esencial", Icono: IconoEditor },
  { id: "secciones", texto: "Secciones", Icono: IconoPlantillas },
  { id: "fotos", texto: "Fotos", Icono: IconoAlbumes },
  { id: "estilo", texto: "Estilo", Icono: IconoPaleta },
];

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL EDITOR EN VIVO
 * ══════════════════════════════════════════════════════════════════
 *
 * A la izquierda el teléfono con la invitación tal como se va a ver; a
 * la derecha el panel con cuatro pestañas. Cada cambio actualiza el
 * documento en memoria (la previa reacciona al instante) y, 900 ms
 * después del último cambio, se guarda solo. El estado «Guardado /
 * Guardando…» se deriva de comparar el documento con lo último que la
 * base confirmó — no hay un estado que se pueda desincronizar.
 */
export default function EditorInvitacion({
  celebracion,
  documentoInicial,
  urlPublica,
  esPartner = false,
  avisoPago = null,
}: {
  celebracion: Celebracion;
  documentoInicial: Documento;
  urlPublica: string;
  /** Partner aprobado: puede guardar la invitación como plantilla de la casa. */
  esPartner?: boolean;
  /** Al volver de pagar la invitación con tarjeta (?pago=…). */
  avisoPago?: string | null;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<Documento>(documentoInicial);
  const [ultimoGuardado, setUltimoGuardado] = useState(() => JSON.stringify(documentoInicial));
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("esencial");
  const [dispositivo, setDispositivo] = useState<Dispositivo>("movil");
  // La sección seleccionada, compartida entre el teléfono y el panel:
  // tocarla en uno la abre en el otro.
  const [activa, setActiva] = useState<string | null>(null);
  const [publicando, iniciarPublicacion] = useTransition();
  const [aviso, setAviso] = useState<string | null>(avisoPago);
  // El diálogo de publicar: qué cuesta, cuánto hay.
  const [resumen, setResumen] = useState<ResumenPublicacion | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [faltan, setFaltan] = useState<number | null>(null);

  const serializado = useMemo(() => JSON.stringify(doc), [doc]);
  const pendiente = serializado !== ultimoGuardado;
  const publicada = celebracion.estado === "publicada";

  // Autoguardado: espera a que la persona deje de escribir.
  useEffect(() => {
    if (!pendiente) return;
    const t = setTimeout(async () => {
      const r = await guardarDocumento(celebracion.id, doc);
      if (r.ok) {
        setUltimoGuardado(serializado);
        setErrorGuardado(null);
      } else {
        setErrorGuardado(r.mensaje);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [serializado, pendiente, doc, celebracion.id]);

  // Aviso del navegador si se va con cambios sin guardar.
  useEffect(() => {
    if (!pendiente) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [pendiente]);

  const cambiar = (fn: (d: Documento) => Documento) => setDoc((d) => fn(d));

  function seleccionar(id: string | null) {
    setActiva(id);
    if (id) setPestana("secciones");
  }
  /** Un texto escrito directo sobre la previa: va a la sección por su ruta dentro de datos. */
  function editarTexto(id: string, ruta: string, valor: string) {
    cambiar((d) => ({
      ...d,
      secciones: d.secciones.map((x) => (x.id === id ? ({ ...x, datos: asignarRuta(x.datos, ruta, valor) } as Seccion) : x)),
    }));
  }
  function alternarVisible(id: string) {
    cambiar((d) => ({ ...d, secciones: d.secciones.map((x) => (x.id === id && x.tipo !== "hero" ? { ...x, visible: !x.visible } : x)) }));
  }

  /** Guarda lo pendiente y, si es publicar, primero muestra el costo. */
  function alternarPublicacion() {
    setAviso(null);
    setFaltan(null);
    if (publicada) {
      iniciarPublicacion(async () => {
        const r = await cambiarPublicacion(celebracion.id, false);
        if (!r.ok) {
          setAviso(r.mensaje);
          return;
        }
        setAviso("La invitación volvió a borrador.");
        router.refresh();
      });
      return;
    }
    iniciarPublicacion(async () => {
      if (pendiente) {
        const g = await guardarDocumento(celebracion.id, doc);
        if (!g.ok) {
          setAviso(g.mensaje);
          return;
        }
        setUltimoGuardado(serializado);
      }
      const r = await resumenPublicacion(celebracion.id);
      if (!r) {
        setAviso("No pudimos calcular el costo de publicar. Probá de nuevo.");
        return;
      }
      setResumen(r);
      setConfirmando(true);
    });
  }

  /** Partners: la invitación tal como está, como plantilla propia reutilizable. */
  function guardarPlantillaDeLaCasa() {
    const nombre = window.prompt("Nombre de la plantilla (para reconocerla con el próximo cliente):", `Estilo ${celebracion.nombre}`);
    if (nombre === null) return;
    setAviso(null);
    iniciarPublicacion(async () => {
      if (pendiente) {
        const g = await guardarDocumento(celebracion.id, doc);
        if (!g.ok) {
          setAviso(g.mensaje);
          return;
        }
        setUltimoGuardado(serializado);
      }
      const r = await guardarComoPlantillaPartner(celebracion.id, nombre);
      setAviso(r.ok ? "Guardada en tus plantillas de la casa (Partners → Plantillas)." : r.mensaje);
    });
  }

  function publicarConfirmado() {
    setConfirmando(false);
    iniciarPublicacion(async () => {
      const r = await cambiarPublicacion(celebracion.id, true);
      if (!r.ok) {
        setAviso(r.mensaje);
        if ("faltan" in r) setFaltan(r.faltan);
        return;
      }
      setAviso("¡Publicada! Tu link ya está activo.");
      router.refresh();
    });
  }

  /** Los créditos a favor no alcanzan: a Stripe por exactamente esta invitación, y de vuelta publicada. */
  function pagarConTarjeta() {
    setConfirmando(false);
    setAviso(null);
    iniciarPublicacion(async () => {
      const r = await pagarYPublicar(celebracion.id);
      if (!r.ok) {
        setAviso(r.mensaje);
        return;
      }
      window.location.assign(r.url);
    });
  }

  const render = (
    <RenderInvitacion
      documento={doc}
      celebracion={{
        nombre: celebracion.nombre,
        fecha: celebracion.fecha,
        hora: celebracion.hora,
        lugarNombre: celebracion.lugar_nombre,
        direccion: celebracion.direccion,
        mapsUrl: celebracion.maps_url,
      }}
      modo="editor"
      altoPantalla={dispositivo === "movil" ? `${ALTO_PANTALLA}px` : undefined}
      edicion={{ activa, alSeleccionar: seleccionar, alOcultar: alternarVisible, alDisenar: seleccionar, alEditarTexto: editarTexto }}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-(--c-hielo)">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-(--c-linea) bg-(--c-blanco)">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
          <EnlaceCelebrar a={rutaFicha(celebracion.id)} className="c-montserrat flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[14px] font-semibold text-(--c-tinta-suave) hover:text-(--c-tinta)">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Volver
          </EnlaceCelebrar>

          <div className="min-w-0 flex-1 text-center">
            <p className="c-montserrat truncate text-[14px] font-semibold text-(--c-tinta)">{celebracion.nombre}</p>
            <p className="text-[12px]" aria-live="polite">
              {errorGuardado ? (
                <span className="text-(--c-coral-tinta)">No se pudo guardar: {errorGuardado}</span>
              ) : pendiente ? (
                <span className="text-(--c-tinta-suave)">Guardando…</span>
              ) : (
                <span className="text-(--c-ok)">Guardado ✓</span>
              )}
            </p>
          </div>

          <div className="hidden items-center rounded-xl border border-(--c-linea) p-0.5 lg:flex" role="group" aria-label="Vista">
            <BotonDispositivo activo={dispositivo === "movil"} onClick={() => setDispositivo("movil")} etiqueta="Teléfono">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" strokeLinecap="round" /></svg>
            </BotonDispositivo>
            <BotonDispositivo activo={dispositivo === "escritorio"} onClick={() => setDispositivo("escritorio")} etiqueta="Escritorio">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 20h8" strokeLinecap="round" /></svg>
            </BotonDispositivo>
          </div>

          <EnlaceCelebrar a={`${rutaEditor(celebracion.id)}?plantillas=1`} className="c-boton c-boton-secundario hidden min-h-10 text-[13px] xl:inline-flex">
            Cambiar diseño
          </EnlaceCelebrar>
          {esPartner && (
            <button type="button" onClick={guardarPlantillaDeLaCasa} disabled={publicando} className="c-boton c-boton-secundario hidden min-h-10 text-[13px] xl:inline-flex" title="Guardar esta invitación como plantilla propia">
              Guardar como plantilla
            </button>
          )}
          <EnlaceCelebrar a={`${rutaEditor(celebracion.id)}/previa`} className="c-boton c-boton-secundario hidden min-h-10 text-[13px] sm:inline-flex">
            Vista previa
          </EnlaceCelebrar>
          <button type="button" onClick={alternarPublicacion} disabled={publicando} className={`c-boton min-h-10 text-[13px] ${publicada ? "c-boton-secundario" : "c-boton-primario"}`}>
            {publicando ? "Un momento…" : publicada ? "Despublicar" : "Publicar"}
          </button>
        </div>
        {faltan !== null && (
          <p role="alert" className="border-t border-(--c-linea) bg-(--c-coral-suave) px-5 py-2 text-center text-[13px] text-(--c-coral-tinta)">
            Para publicar falta el pago de la invitación ({colones(faltan * VALOR_CREDITO_CRC)}).{" "}
            <button type="button" onClick={pagarConTarjeta} className="font-semibold underline underline-offset-4">
              Pagar y publicar
            </button>
          </p>
        )}
        {aviso && (
          <p role="status" className="border-t border-(--c-linea) bg-(--c-ok-suave) px-5 py-2 text-center text-[13px] text-(--c-ok)">
            {aviso}
            {publicada && (
              <>
                {" "}
                <a href={urlPublica} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  Abrir
                </a>{" "}
                <BotonCopiar texto={urlPublica} etiqueta="Copiar link" className="underline underline-offset-4" />
              </>
            )}
          </p>
        )}
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* La previa */}
        <div className="flex flex-1 items-start justify-center overflow-auto px-4 py-6 lg:py-8">
          {dispositivo === "movil" ? (
            <Telefono ancho={ANCHO_TELEFONO} tinta={doc.estilo.paleta.tinta}>
              {render}
            </Telefono>
          ) : (
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-(--c-linea) shadow-elevado">{render}</div>
          )}
        </div>

        {/* El panel */}
        <aside className="w-full border-t border-(--c-linea) bg-(--c-blanco) lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:w-[400px] lg:shrink-0 lg:border-l lg:border-t-0 xl:w-[440px]">
          <div className="grid grid-cols-4 gap-1 border-b border-(--c-linea) p-2" role="tablist" aria-label="Qué editar">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={pestana === p.id}
                onClick={() => setPestana(p.id)}
                className={`c-montserrat flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[12px] font-semibold transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${
                  pestana === p.id ? "bg-(--c-marino) text-(--c-blanco)" : "text-(--c-tinta-suave) hover:bg-(--c-hielo) hover:text-(--c-tinta)"
                }`}
              >
                <p.Icono className="h-5 w-5" />
                {p.texto}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto p-4 lg:h-[calc(100%-73px)]">
            <ProveedorIA celebracionId={celebracion.id}>
            {pestana === "esencial" && (
              <div className="grid gap-6">
                <PanelEsencial doc={doc} celebracion={celebracion} cambiar={cambiar} />
                <PanelMusica doc={doc} celebracionId={celebracion.id} cambiar={cambiar} />
              </div>
            )}
            {pestana === "secciones" && <PanelSecciones doc={doc} celebracionId={celebracion.id} cambiar={cambiar} activa={activa} alSeleccionar={setActiva} />}
            {pestana === "fotos" && <PanelFotos doc={doc} celebracionId={celebracion.id} cambiar={cambiar} />}
            {pestana === "estilo" && <PanelEstilo doc={doc} tipo={celebracion.tipo} cambiar={cambiar} celebracionId={celebracion.id} />}
            </ProveedorIA>
          </div>
        </aside>
      </div>

      {confirmando && resumen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-(--c-marino)/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="publicar-titulo" onClick={() => setConfirmando(false)}>
          <div className="w-full max-w-md rounded-[20px] bg-(--c-blanco) p-6 shadow-elevado" onClick={(e) => e.stopPropagation()}>
            <h3 id="publicar-titulo" className="text-xl leading-tight text-(--c-tinta)">Publicar la invitación</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">
              {resumen.yaPagado
                ? "Esta invitación ya está pagada: se publica sin costo."
                : "Al publicar se activa tu link para compartir, con confirmación de asistencia y panel de invitados."}
            </p>
            {!resumen.yaPagado && (
              <dl className="mt-4 grid gap-2 rounded-xl border border-(--c-linea) p-4 text-[14px]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-(--c-tinta-suave)">{resumen.aMedida ? "Invitación a medida" : "Invitación de plantilla"}</dt>
                  <dd className="c-montserrat text-lg font-semibold text-(--c-tinta)">{colones(resumen.costoCRC)}</dd>
                </div>
                {resumen.saldo > 0 && (
                  <div className="flex justify-between gap-4 border-t border-(--c-linea) pt-2 text-[13px]">
                    <dt className="text-(--c-tinta-suave)">Saldo a favor</dt>
                    <dd className="c-montserrat font-semibold text-(--c-tinta)">
                      {resumen.saldo >= resumen.costo ? "Alcanza: no se cobra la tarjeta" : `${colones(resumen.saldo * VALOR_CREDITO_CRC)} (no alcanza)`}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-(--c-tinta-suave)">
              Editar, cambiar de plantilla y probar es gratis. Se paga una sola vez por invitación: despublicar y volver a publicar no cobra de nuevo.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={() => setConfirmando(false)} className="c-boton c-boton-secundario min-h-10 text-[13px]">
                Todavía no
              </button>
              {resumen.yaPagado || resumen.saldo >= resumen.costo ? (
                <button type="button" onClick={publicarConfirmado} className="c-boton c-boton-primario min-h-10 text-[13px]">
                  {resumen.yaPagado ? "Publicar" : "Publicar con mi saldo"}
                </button>
              ) : resumen.hayTarjeta ? (
                <button type="button" onClick={pagarConTarjeta} className="c-boton c-boton-primario min-h-10 text-[13px]">
                  Pagar {colones(resumen.costoCRC)} y publicar
                </button>
              ) : (
                <p className="text-[12px] text-(--c-coral-tinta)">El pago con tarjeta no está disponible ahora. Escribinos y te ayudamos a publicar por SINPE.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonDispositivo({ activo, onClick, etiqueta, children }: { activo: boolean; onClick: () => void; etiqueta: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      className={`flex h-9 w-10 items-center justify-center rounded-[10px] transition-colors duration-(--duracion-micro) ease-(--ease-bookea) ${activo ? "bg-(--c-marino) text-(--c-blanco)" : "text-(--c-tinta-suave) hover:text-(--c-tinta)"}`}
    >
      {children}
    </button>
  );
}

function IconoPaleta({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.2-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5h1.7a3.5 3.5 0 0 0 3.5-3.5c0-4.2-3.6-7.5-8-7.5z" />
      <circle cx="8" cy="10" r="1.2" fill="currentColor" />
      <circle cx="11.5" cy="7.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}
