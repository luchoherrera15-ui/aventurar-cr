"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import PasoBeneficio from "@/components/lealtad/paso-beneficio";
import CampoColor from "@/components/campo-color";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import SelectorTipoExplorable from "@/components/lealtad/selector-tipo-explorable";
import SelectorFranja from "@/components/lealtad/selector-franja";
import SelectorImagenNegocio from "@/components/lealtad/selector-imagen-negocio";
import { dataUriPlantillaIcono } from "@/lib/lealtad/plantillas-icono";
import { solicitarAltaConPlan } from "./nuevo/actions";
import { subirImagenAlAlta } from "@/lib/lealtad/subida-alta";
import { TIPOS_TARJETA, validarBeneficio, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { ICONOS_SELLO, esIconoSello } from "@/lib/lealtad/iconos-sello";
import { paletaDeLosColores } from "@/lib/lealtad/paletas";
import { tiposDelPlan, planQueDesbloquea } from "@/lib/lealtad/planes";
import { PLANTILLAS_FRANJA } from "@/lib/lealtad/plantillas-franjas";
import type { EstadoLealtad } from "./configurador-lealtad";

/**
 * MODO 3 DEL CONFIGURADOR: el editor completo, una sola pantalla larga.
 *
 * Reemplaza al asistente de puntitos que vivía acá (ver el comentario
 * grande de `configurador-lealtad.tsx` para la historia completa). Ya
 * no hay «pasos» que navegar: cinco secciones numeradas en una columna
 * que se scrollea normal, con el pase pegado (`sticky`) al costado en
 * escritorio — el mismo patrón que ya resuelve `creador-tarjeta.tsx`
 * para el mismo problema, replicado literal.
 *
 * ------------------------------------------------------------------
 * ESTE COMPONENTE ES DUEÑO DE TODO LO QUE PASA ACÁ ADENTRO
 * ------------------------------------------------------------------
 * El padre (`ConfiguradorLealtad`) solo guarda `estado` y lo respalda en
 * sessionStorage. `FormularioAuth`, `solicitarAltaConPlan`, la pantalla
 * de éxito y el aviso de plan pago viven ENTERAMENTE acá: nada de eso
 * vuelve a subir. Por eso este archivo importa `solicitarAltaConPlan`
 * directo (no lo recibe por prop) y define su propio `useTransition`.
 *
 * ------------------------------------------------------------------
 * LAS GALERÍAS SON PREVIEW-ONLY, NUNCA VIAJAN AL SERVIDOR
 * ------------------------------------------------------------------
 * `SelectorFranja`/`SelectorImagenNegocio` eligen un ID del banco
 * (`plantillas-franjas.ts` / `plantillas-icono.ts`), no una URL de
 * Storage — sus rutas son de `public/`, y el servidor solo acepta
 * `logoUrl`/`bannerUrl` que sean de NUESTRO Storage
 * (`esUrlDeNuestroStorage`, en `tarjeta-alta.ts`). Por eso el mapeo a
 * `solicitarAltaConPlan` (ver `publicar()`) manda `logoUrl`/`bannerUrl`
 * SOLO cuando el modo es "propia" (una subida real, con sesión) —
 * "stock"/"banco" quedan afuera del payload aunque se vean puestos en
 * la vista previa. Es la misma regla que ya seguía `imagen-stock.ts`.
 *
 * ------------------------------------------------------------------
 * DOS SLOTS DE SUBIDA PROPIA, UN SOLO CAMINO
 * ------------------------------------------------------------------
 * "Subí tu propia imagen" existe para el logo Y para la franja, cada
 * uno con su propio archivo — nunca se pisan entre sí. Sin sesión, el
 * archivo elegido queda como vista previa local (`FileReader`) y se
 * pierde si la persona pasa por «Tu cuenta» (la recarga entera de
 * `FormularioAuth` no tiene forma de evitarse); con sesión sube DE
 * VERDAD por `subirImagenAlAlta` — el negocio todavía no existe, así
 * que no hay carpeta de rancho a la que subir, y por eso el bucket es
 * `comprobantes` y no `ranchos-fotos`.
 */

// Misma llave que `CLAVE_SESION` en `configurador-lealtad.tsx`: al
// crear con éxito hay que borrar el respaldo, y este archivo no
// importa esa constante (no es parte del contrato entre agentes) así
// que el literal se repite acá. Si el padre cambia la llave algún día,
// este borrado queda huérfano — el respaldo simplemente se sobrescribe
// en la próxima visita, así que no es un fallo silencioso grave.
const CLAVE_SESION_RESPALDO = "bookea-lealtad-wizard:nuevo";
const ANCLA = "/lealtad#configurador-lealtad";

const etiqueta = "mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris";

type Exito = { ranchoId: string; slug: string | null };

export default function EditorTarjetaCompleto({
  estado,
  alCambiar,
  alElegirTipo,
  haySesion,
  alVolver,
}: {
  estado: EstadoLealtad;
  alCambiar: (patch: Partial<EstadoLealtad>) => void;
  /** La MISMA función que usa el Modo 1 (menú inicial), pasada por el padre. */
  alElegirTipo: (t: TipoTarjeta) => void;
  haySesion: boolean;
  /** patch({ vista: "paquetes" }) en el padre — el link "← Volver a los paquetes". */
  alVolver: () => void;
}) {
  const router = useRouter();
  const patch = alCambiar;

  const [verMasColores, setVerMasColores] = useState(false);
  const [verPase, setVerPase] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  // Las vistas previas locales del archivo propio SIN sesión: nunca se
  // guardan en el respaldo del padre (mismo criterio que tenía el
  // configurador viejo) porque son un `data:` URI larguísimo que no
  // tiene sentido serializar, y porque de todos modos se pierden con la
  // recarga entera que hace `FormularioAuth`.
  const [previewLocalLogo, setPreviewLocalLogo] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  const [previewLocalFranja, setPreviewLocalFranja] = useState<string | null>(null);
  const [subiendoFranja, setSubiendoFranja] = useState(false);
  const [errorFranja, setErrorFranja] = useState<string | null>(null);

  function elegirImagenBanco(id: string | null) {
    setPreviewLocalLogo(null);
    setErrorLogo(null);
    patch({ imagenModo: id ? "stock" : "ninguna", imagenStockId: id, logoUrl: null });
  }

  function elegirFranjaBanco(id: string | null) {
    setPreviewLocalFranja(null);
    setErrorFranja(null);
    patch({ franjaModo: id ? "banco" : "ninguna", franjaBancoId: id, bannerUrl: null });
  }

  function quitarImagenPropia() {
    setPreviewLocalLogo(null);
    setErrorLogo(null);
    patch({ imagenModo: "ninguna", imagenStockId: null, logoUrl: null });
  }

  function quitarFranjaPropia() {
    setPreviewLocalFranja(null);
    setErrorFranja(null);
    patch({ franjaModo: "ninguna", franjaBancoId: null, bannerUrl: null });
  }

  async function elegirArchivoPropio(archivo: File | undefined, slot: "logo" | "franja") {
    if (!archivo) return;
    const avisarError = slot === "logo" ? setErrorLogo : setErrorFranja;
    const ponerPreview = slot === "logo" ? setPreviewLocalLogo : setPreviewLocalFranja;
    const ponerSubiendo = slot === "logo" ? setSubiendoLogo : setSubiendoFranja;

    avisarError(null);
    if (!archivo.type.startsWith("image/")) {
      avisarError("Eso no es una imagen.");
      return;
    }

    if (!haySesion) {
      // Sin sesión no hay a dónde subir: solo vista previa local, igual
      // que hacía este mismo panel antes de este cambio.
      if (archivo.size > 5 * 1024 * 1024) {
        avisarError("Muy pesada — probá con una de menos de 5 MB.");
        return;
      }
      const lector = new FileReader();
      lector.onload = () => {
        if (typeof lector.result === "string") ponerPreview(lector.result);
      };
      lector.onerror = () => avisarError("No se pudo leer la imagen. Probá con otra.");
      lector.readAsDataURL(archivo);
      if (slot === "logo") patch({ imagenModo: "propia", imagenStockId: null, logoUrl: null });
      else patch({ franjaModo: "propia", franjaBancoId: null, bannerUrl: null });
      return;
    }

    if (archivo.size > 8 * 1024 * 1024) {
      avisarError("El archivo pesa más de 8 MB — probá con una versión más liviana.");
      return;
    }
    ponerSubiendo(true);
    const url = await subirImagenAlAlta(archivo, slot === "logo" ? "logo" : "banda");
    ponerSubiendo(false);
    if (url) {
      ponerPreview(null);
      if (slot === "logo") patch({ imagenModo: "propia", imagenStockId: null, logoUrl: url });
      else patch({ franjaModo: "propia", franjaBancoId: null, bannerUrl: url });
    } else {
      avisarError("No pudimos subir la imagen. Intentá de nuevo.");
    }
  }

  const nombre = estado.nombreNegocio.trim();
  const motivoBeneficio = validarBeneficio(estado.beneficio);
  const tiposGratis = tiposDelPlan("prueba");
  const esGratis = tiposGratis.includes(estado.modo);
  const planQueAbre = planQueDesbloquea(estado.modo);
  const planDestino = esGratis ? "prueba" : (planQueAbre?.id ?? "arranque");
  const telefonoListo = estado.telefono.trim().length > 0;
  const puedePublicar =
    !ocupado &&
    esGratis &&
    nombre.length > 0 &&
    nombre.length <= 80 &&
    motivoBeneficio === null &&
    telefonoListo;

  function irAlPlanPago() {
    // El borrador ya está guardado (el padre lo escribe en cada
    // cambio): /lealtad/nuevo lo restaura con la misma llave.
    iniciar(() => router.push(`/lealtad/nuevo?plan=${planDestino}`));
  }

  function publicar() {
    setError(null);
    const b = estado.beneficio;
    const datos = {
      nombreNegocio: nombre,
      // Sin paso de rubro en este flujo: "citas" es el vertical más
      // común de Lealtad y evita el único campo que
      // `solicitarAltaConPlan` exige cuando el tipo es "otro".
      tipo: "citas",
      detalleOtro: "",
      plan: planDestino,
      metodoPago: "sinpe",
      comprobanteUrl: "",
      telefono: estado.telefono,
      personalizado: false,
      descripcion: "",
      paseColor: estado.colorFondo,
      paseLogoUrl: estado.imagenModo === "propia" ? (estado.logoUrl ?? "") : "",
      regalia: b.tipo === "sellos" ? b.recompensa || "Tu regalía" : "Tu regalía",
      metaSellos: b.tipo === "sellos" ? b.requeridos : 10,
      tarjeta: {
        modo: estado.modo,
        beneficio: b,
        colorFondo: estado.colorFondo,
        colorSello: estado.colorSello,
        iconoSello: estado.modo === "sellos" ? estado.iconoSello : null,
        logoUrl: estado.imagenModo === "propia" ? estado.logoUrl : null,
        // NUNCA cuando franjaModo === "banco": esa ruta es de public/,
        // no de nuestro Storage (ver el comentario grande de arriba).
        bannerUrl: estado.franjaModo === "propia" ? estado.bannerUrl : null,
      },
    };
    iniciar(async () => {
      const res = await solicitarAltaConPlan(datos);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      try {
        sessionStorage.removeItem(CLAVE_SESION_RESPALDO);
      } catch {
        /* sin storage no hay nada que limpiar */
      }
      if (res.creado) setExito({ ranchoId: res.creado.ranchoId, slug: res.creado.slug });
    });
  }

  const logoUrlVista =
    estado.imagenModo === "propia"
      ? (estado.logoUrl ?? previewLocalLogo)
      : estado.imagenModo === "stock" && estado.imagenStockId
        ? dataUriPlantillaIcono(estado.imagenStockId, estado.colorFondo)
        : null;

  const bannerUrlVista =
    estado.franjaModo === "propia"
      ? (estado.bannerUrl ?? previewLocalFranja)
      : estado.franjaModo === "banco" && estado.franjaBancoId
        ? (PLANTILLAS_FRANJA.find((f) => f.id === estado.franjaBancoId)?.src ?? null)
        : null;

  const datosVista: DatosVista = {
    negocioNombre: nombre || "Tu negocio",
    modo: estado.modo,
    beneficio: estado.beneficio,
    colorFondo: estado.colorFondo,
    colorSello: estado.colorSello,
    logoUrl: logoUrlVista,
    bannerUrl: bannerUrlVista,
    iconoSello: estado.modo === "sellos" ? estado.iconoSello : null,
  };

  if (exito) {
    return (
      <div className="entra-suave mx-auto max-w-[560px] text-center">
        <h2 className="titulo text-[22px] text-bookea-tinta">¡Tu tarjeta está lista! 🎉</h2>
        <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-bookea-gris">
          <strong className="text-bookea-tinta">{nombre}</strong> quedó creado con su tarjeta
          funcionando. Compartí el QR de tu panel y tus clientes ya pueden agregarla al teléfono.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/lealtad/panel/${exito.ranchoId}`}
            className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold"
            style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
          >
            Ir a mi panel →
          </a>
          {exito.slug && (
            <a
              href={`/tarjeta/${exito.slug}`}
              className="presionable rounded-xl border border-bookea-linea px-5 py-2.5 text-[13px] font-bold text-bookea-gris"
            >
              Ver mi tarjeta como cliente
            </a>
          )}
        </div>
      </div>
    );
  }

  // Numeración dinámica: «Tu cuenta» solo existe (y solo cuenta un
  // número) cuando no hay sesión — mismo criterio que ya usaba el
  // asistente de puntitos con PANTALLAS_SIN_CUENTA/PANTALLAS_CON_CUENTA,
  // aplicado ahora solo al número visible.
  const numeroCuenta = 4;
  const numeroRevisar = haySesion ? 4 : 5;

  const filas: (readonly [string, React.ReactNode])[] = [
    ["Negocio", nombre || "— falta"],
    ["Tipo", TIPOS_TARJETA[estado.modo].nombre],
    [
      "Colores",
      <span key="c" className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-4 w-4 rounded-full border border-bookea-linea"
          style={{ background: estado.colorFondo }}
        />
        <span
          aria-hidden
          className="inline-block h-4 w-4 rounded-full border border-bookea-linea"
          style={{ background: estado.colorSello }}
        />
      </span>,
    ],
    [
      "Imagen",
      estado.imagenModo === "ninguna"
        ? "Sin imagen (va tu nombre)"
        : estado.imagenModo === "stock"
          ? "De la galería"
          : estado.logoUrl
            ? "Subida"
            : "Vista previa (falta subirla)",
    ],
  ];
  if (estado.modo === "sellos" && estado.iconoSello) {
    filas.push(["Ícono del sello", ICONOS_SELLO[estado.iconoSello].nombre]);
  }
  if (estado.franjaModo !== "ninguna") {
    filas.push([
      "Franja",
      estado.franjaModo === "banco"
        ? "De la galería"
        : estado.bannerUrl
          ? "Subida"
          : "Vista previa (falta subirla)",
    ]);
  }

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={alVolver}
            className="presionable mb-5 text-[12px] font-bold text-bookea-gris hover:text-bookea-tinta"
          >
            ← Volver a los paquetes
          </button>

          <Seccion numero={1} titulo="Tu negocio" bajada="Cómo se llama y qué tipo de tarjeta es." primera>
            <div className="space-y-4">
              <label className="block">
                <span className={etiqueta}>Nombre del negocio</span>
                <input
                  autoFocus
                  value={estado.nombreNegocio}
                  onChange={(e) => patch({ nombreNegocio: e.target.value.slice(0, 80) })}
                  maxLength={80}
                  placeholder="Café Aroma"
                  className="w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] font-medium text-bookea-tinta outline-none focus:border-bookea-azul"
                />
              </label>
              <div>
                <span className={etiqueta}>Tipo de tarjeta</span>
                <SelectorTipoExplorable valor={estado.modo} alElegir={alElegirTipo} />
              </div>
            </div>
          </Seccion>

          <Seccion numero={2} titulo="Programa" bajada="Qué se gana y cómo.">
            <div className="space-y-4">
              <PasoBeneficio config={estado.beneficio} alCambiar={(c) => patch({ beneficio: c })} />
              {motivoBeneficio && (
                <p
                  role="status"
                  className="rounded-xl bg-bookea-azul-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-azul"
                >
                  {motivoBeneficio}
                </p>
              )}
            </div>
          </Seccion>

          <Seccion numero={3} titulo="Apariencia" bajada="Cómo se ve en el teléfono de tu cliente.">
            <div className="space-y-6">
              <div>
                <span className={etiqueta}>Color de la tarjeta</span>
                <PlantillasColor
                  colorFondo={estado.colorFondo}
                  colorSello={estado.colorSello}
                  alElegir={(c) => patch({ colorFondo: c.fondo, colorSello: c.sello })}
                />
                <button
                  type="button"
                  onClick={() => setVerMasColores((v) => !v)}
                  className="presionable mt-2 text-[11.5px] font-bold text-bookea-azul underline"
                >
                  {verMasColores ? "Ocultar colores personalizados" : "Ver más colores"}
                </button>
                {(verMasColores || paletaDeLosColores(estado.colorFondo, estado.colorSello) === null) && (
                  <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                    <CampoColor
                      id="ec-fondo"
                      etiqueta="Color de fondo"
                      valor={estado.colorFondo}
                      alCambiar={(v) => patch({ colorFondo: v })}
                    />
                    <CampoColor
                      id="ec-sello"
                      etiqueta="Color del acento"
                      valor={estado.colorSello}
                      alCambiar={(v) => patch({ colorSello: v })}
                    />
                  </div>
                )}
              </div>

              {estado.modo === "sellos" && (
                <div>
                  <span className={etiqueta}>Icono del sello</span>
                  <SelectorIconoSello
                    valor={estado.iconoSello}
                    alElegir={(i) => patch({ iconoSello: esIconoSello(i) ? i : null })}
                    colorFondo={estado.colorFondo}
                    colorSello={estado.colorSello}
                  />
                </div>
              )}

              <div>
                <span className={etiqueta}>Franja (la imagen de arriba del pase)</span>
                <SelectorFranja
                  valor={estado.franjaModo === "banco" ? estado.franjaBancoId : null}
                  alElegir={elegirFranjaBanco}
                />
              </div>

              <div>
                <span className={etiqueta}>Imagen del negocio</span>
                <SelectorImagenNegocio
                  valor={estado.imagenModo === "stock" ? estado.imagenStockId : null}
                  alElegir={elegirImagenBanco}
                  colorFondo={estado.colorFondo}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SubidaPropia
                  etiqueta="Tu logo"
                  subiendo={subiendoLogo}
                  error={errorLogo}
                  activa={estado.imagenModo === "propia"}
                  vista={estado.logoUrl ?? previewLocalLogo}
                  subida={!!estado.logoUrl}
                  onArchivo={(a) => void elegirArchivoPropio(a, "logo")}
                  onQuitar={quitarImagenPropia}
                />
                <SubidaPropia
                  etiqueta="Tu franja"
                  subiendo={subiendoFranja}
                  error={errorFranja}
                  activa={estado.franjaModo === "propia"}
                  vista={estado.bannerUrl ?? previewLocalFranja}
                  subida={!!estado.bannerUrl}
                  onArchivo={(a) => void elegirArchivoPropio(a, "franja")}
                  onQuitar={quitarFranjaPropia}
                />
              </div>
              {!haySesion && (previewLocalLogo || previewLocalFranja) && (
                <p className="text-[11px] leading-relaxed text-bookea-gris">
                  Esto es solo una vista previa: se sube de verdad en cuanto tengas tu cuenta, en
                  la sección «Tu cuenta».
                </p>
              )}
            </div>
          </Seccion>

          {!haySesion && (
            <Seccion numero={numeroCuenta} titulo="Tu cuenta" bajada="Un correo y un código — sin contraseñas.">
              <div className="-mx-1">
                <FormularioAuth
                  destino={ANCLA}
                  titulo="Ya casi — creá tu cuenta"
                  intro="Con eso queda a tu nombre. Escribí tu correo: si ya tenés cuenta entrás directo, y si es tu primera vez, con tu nombre alcanza. Tu tarjeta queda tal como la armaste."
                />
              </div>
            </Seccion>
          )}

          <Seccion numero={numeroRevisar} titulo="Revisar y crear" bajada="Una última mirada antes de publicar.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-bookea-linea bg-white p-4">
                <dl className="divide-y divide-bookea-linea">
                  {filas.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
                        {k}
                      </dt>
                      <dd className="text-[13px] font-bold text-bookea-tinta">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <label className="block">
                <span className={etiqueta}>Teléfono (para coordinar)</span>
                <input
                  value={estado.telefono}
                  onChange={(e) => patch({ telefono: e.target.value.slice(0, 30) })}
                  placeholder="8888 8888"
                  className="w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] font-medium text-bookea-tinta outline-none focus:border-bookea-azul"
                />
              </label>

              {!esGratis && planQueAbre && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-[12px] leading-snug text-amber-800">
                    <strong className="font-extrabold">
                      Las tarjetas de {TIPOS_TARJETA[estado.modo].nombre.toLowerCase()} vienen con
                      el paquete {planQueAbre.nombre}.
                    </strong>{" "}
                    Ese camino pide un depósito y lo confirma Bookea — lo tuyo se guarda igual, no
                    perdés nada de lo que armaste acá.
                  </p>
                  <button
                    type="button"
                    onClick={irAlPlanPago}
                    disabled={ocupado}
                    className="presionable mt-2.5 rounded-full px-4 py-2 text-[12.5px] font-extrabold disabled:opacity-60"
                    style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                  >
                    Continuar con {planQueAbre.nombre} →
                  </button>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-700"
                >
                  {error}
                </p>
              )}

              {esGratis && (
                <button
                  type="button"
                  onClick={publicar}
                  disabled={!puedePublicar}
                  className="presionable w-full rounded-full px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-40 sm:w-auto"
                  style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                >
                  {ocupado ? "Creando…" : "Crear mi tarjeta YA →"}
                </button>
              )}
            </div>
          </Seccion>
        </div>

        {/* ── Vista previa: pegada en escritorio ────────────────────
            El mismo patrón exacto que `creador-tarjeta.tsx`: `sticky
            top-24` dentro de un grid `align-items: stretch`, sin ningún
            ancestro `overflow-hidden` entre acá y el body (por eso el
            padre monta este componente en un wrapper PROPIO cuando
            `vista === "editor"`, sin el `overflow-hidden` que sí tienen
            los Modos 1 y 2). */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <VistaPase datos={datosVista} superficie="clara" marco="telefono" />
          </div>
        </aside>
      </div>

      {/* ── Móvil: la vista previa no cabe pegada, así que se abre
          desde un botón flotante chico. No es la barra de ancho
          completo de `creador-tarjeta.tsx` —esa sostiene Atrás/
          Continuar entre pasos, y acá no hay pasos que navegar, es un
          solo scroll con un único CTA al final— así que un FAB liviano
          alcanza. */}
      <button
        type="button"
        onClick={() => setVerPase(true)}
        className="presionable fixed bottom-4 right-4 z-40 rounded-full border border-bookea-linea bg-white px-4 py-2.5 text-[12.5px] font-bold text-bookea-tinta shadow-[0_10px_24px_-8px_rgba(4,10,24,0.35)] lg:hidden"
      >
        Ver tarjeta
      </button>

      {verPase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la tarjeta"
        >
          <div className="w-full max-w-[340px]">
            <VistaPase datos={datosVista} superficie="clara" marco="telefono" />
            <button
              type="button"
              onClick={() => setVerPase(false)}
              className="presionable mt-4 w-full rounded-xl bg-white py-3 text-[13px] font-bold text-bookea-tinta"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────

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
 * UN SLOT DE "SUBÍ TU PROPIA IMAGEN" — logo y franja son dos copias de
 * la misma pieza, no dos formularios distintos: la única diferencia
 * entre ambos es qué archivo guardan y a qué destino se lo pasan a
 * `subirImagenAlAlta`, y eso lo decide quien llama, no este componente.
 */
function SubidaPropia({
  etiqueta: rotulo,
  subiendo,
  error,
  activa,
  vista,
  subida,
  onArchivo,
  onQuitar,
}: {
  etiqueta: string;
  subiendo: boolean;
  error: string | null;
  /** true cuando el modo actual (imagenModo/franjaModo) es "propia". */
  activa: boolean;
  /** La URL subida de verdad, o la vista previa local — lo que haya. */
  vista: string | null;
  /** true = `vista` es una URL ya subida (no un preview sin guardar). */
  subida: boolean;
  onArchivo: (archivo: File | undefined) => void;
  onQuitar: () => void;
}) {
  return (
    <div>
      <span className={etiqueta}>{rotulo}</span>
      {activa && vista ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-bookea-linea p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista
              previa local o URL recién subida, no un asset del sitio. */}
          <img src={vista} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          <span className="min-w-0 flex-1 text-[11.5px] font-bold text-bookea-tinta">
            {subida ? "Imagen subida" : "Vista previa (se sube con tu cuenta)"}
          </span>
          <button
            type="button"
            onClick={onQuitar}
            className="shrink-0 text-[11.5px] font-bold text-bookea-gris underline"
          >
            Quitar
          </button>
        </div>
      ) : (
        <label className="presionable flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-bookea-linea bg-white px-3 py-2.5 text-[11.5px] font-bold text-bookea-gris hover:border-bookea-azul">
          <span aria-hidden>🖼</span>
          <span>{subiendo ? "Subiendo…" : "Subir imagen propia"}</span>
          <input
            type="file"
            accept="image/*"
            disabled={subiendo}
            className="hidden"
            onChange={(e) => {
              onArchivo(e.target.files?.[0]);
              // Se limpia para que elegir DOS VECES el mismo archivo
              // vuelva a disparar el change.
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && <p className="mt-1.5 text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
