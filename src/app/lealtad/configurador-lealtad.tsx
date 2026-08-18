"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import PasoBeneficio from "@/components/lealtad/paso-beneficio";
import CampoColor from "@/components/campo-color";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import { solicitarAltaConPlan } from "./nuevo/actions";
import { subirImagenAlAlta } from "@/lib/lealtad/subida-alta";
import {
  configPorDefecto,
  esTipoTarjeta,
  leerBeneficio,
  validarBeneficio,
  TIPOS_TARJETA,
  TIPOS_TARJETA_LISTA,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { PALETAS, coloresDePaleta, paletaDeLosColores } from "@/lib/lealtad/paletas";
import { tiposDelPlan, planQueDesbloquea } from "@/lib/lealtad/planes";
import { esIconoSello, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { IMAGENES_STOCK, esImagenStock, dataUriImagenStock } from "@/lib/lealtad/imagen-stock";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * EL CONFIGURADOR EN VIVO del hero de /lealtad — pedido del dueño
 * (2026-08-17): «quiero que la gente configure su pase desde este
 * sitio», con puntitos arriba, «Siguiente» avanzando, y TODO el alta
 * —incluida la cuenta— sin salir de esta pantalla.
 *
 * Antes esto era un formulario de una sola pantalla que guardaba un
 * borrador en sessionStorage y mandaba a `/lealtad/nuevo`, un asistente
 * aparte que además exigía sesión ANTES de empezar. Ahora el asistente
 * VIVE ACÁ: nombre y tipo → premio → apariencia → (cuenta, si hace
 * falta) → revisar y crear. `/lealtad/nuevo` se queda funcionando para
 * lo que este flujo no cubre — ver el comentario grande al pie.
 *
 * ------------------------------------------------------------------
 * LA CUENTA ES UN PASO MÁS, NO UNA PARED
 * ------------------------------------------------------------------
 * `haySesion` lo decide el SERVIDOR (`page.tsx`, con la cookie de
 * sesión) y llega como prop: es la misma comprobación que ya hacía
 * `/lealtad/nuevo/page.tsx`, sin inventar una segunda forma de saber si
 * alguien está logueado. Con sesión, el paso «Tu cuenta» directamente
 * no existe —ni se cuenta en los puntitos—; sin sesión, aparece justo
 * antes de «Revisar».
 *
 * `FormularioAuth` completa el login con una navegación ENTERA
 * (`window.location.href`, ver `formulario-codigo-acceso.tsx`): no hay
 * forma de evitarlo sin tocar ese componente, que es de otro frente.
 * Por eso el borrador entero —incluida en qué paso iba— se respalda en
 * sessionStorage bajo la MISMA llave que ya usaba el puente viejo hacia
 * `/lealtad/nuevo`: sobrevive a esa recarga, y al volver el paso
 * «cuenta» ya no está en la lista (`haySesion` ahora es `true`) así que
 * el asistente salta derecho a «Revisar» — no hace las mismas preguntas
 * dos veces. El destino lleva el ancla `#configurador-lealtad` para que
 * la recarga no deje a la persona mirando el tope de la página.
 *
 * ------------------------------------------------------------------
 * LA IMAGEN, SIN SESIÓN, NUNCA SE SUBE DE VERDAD
 * ------------------------------------------------------------------
 * `SubirImagen` exige sesión. Con sesión (la tenía de entrada, o la
 * acaba de crear) «Subir mi propia imagen» sube DE VERDAD, por el mismo
 * camino que usa `/lealtad/nuevo` para el logo del alta —bucket
 * `comprobantes`, `subirImagenAlAlta()`— porque el negocio todavía no
 * existe y no hay carpeta de rancho a la que subir. SIN sesión, elegir
 * un archivo solo arma una vista previa local (`FileReader`, igual que
 * hacía este mismo componente antes de este cambio): si la persona pasa
 * por el paso de cuenta, esa vista previa se pierde con la recarga —tal
 * como se perdía antes al cruzar hacia `/lealtad/nuevo`— y hay que
 * volver a elegirla ya con sesión. Es la misma limitación de siempre,
 * no una nueva.
 *
 * Las CINCO imágenes por defecto (`src/lib/lealtad/imagen-stock.ts`) no
 * tienen ese problema porque no son un archivo: son un ícono del juego
 * que ya existe, dibujado como un `data:` URI. Por eso NUNCA viajan
 * como `logoUrl` al servidor —no hay nada que `esUrlDeNuestroStorage`
 * pueda validar—: son una ayuda visual nada más, y la tarjeta se crea
 * sin logo (el comportamiento de siempre) hasta que haya uno de verdad.
 *
 * ------------------------------------------------------------------
 * EL TIPO QUE PIDE UN PAQUETE PAGO NO ARMA UN COBRO ACÁ
 * ------------------------------------------------------------------
 * Los ocho tipos se pueden elegir siempre, sin candado —igual que
 * antes—: es una vitrina para explorar. En «Revisar», si el tipo
 * elegido no es gratis, no hay botón de crear: hay el mismo aviso ámbar
 * de siempre con un link a `/lealtad/nuevo?plan=…`, que es donde vive el
 * flujo de depósito y comprobante (SINPE/transferencia) — eso no se
 * duplica acá.
 */

type Pantalla = "negocio" | "premio" | "apariencia" | "cuenta" | "revisar";
const PANTALLAS_SIN_CUENTA: readonly Pantalla[] = ["negocio", "premio", "apariencia", "revisar"];
const PANTALLAS_CON_CUENTA: readonly Pantalla[] = [
  "negocio",
  "premio",
  "apariencia",
  "cuenta",
  "revisar",
];

const TITULOS: Record<Pantalla, { titulo: string; bajada: string }> = {
  negocio: { titulo: "Tu negocio y tu tarjeta", bajada: "Con eso alcanza para arrancar." },
  premio: { titulo: "El premio", bajada: "Qué se gana y cómo." },
  apariencia: { titulo: "Apariencia", bajada: "Cómo se ve en el teléfono de tu cliente." },
  cuenta: { titulo: "Tu cuenta", bajada: "Un correo y un código — sin contraseñas." },
  revisar: { titulo: "Revisar y crear", bajada: "Una última mirada antes de publicar." },
};

type EstadoGuardado = {
  nombreNegocio: string;
  modo: TipoTarjeta;
  beneficio: ConfigBeneficio;
  colorFondo: string;
  colorSello: string;
  iconoSello: IconoSello | null;
  imagenModo: "ninguna" | "stock" | "propia";
  imagenStockId: string | null;
  /** Solo se llena con una subida REAL (requiere sesión). */
  logoUrl: string | null;
  telefono: string;
  pantalla: Pantalla;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const CLAVE_SESION = "bookea-lealtad-wizard:nuevo";
const ANCLA = "/lealtad#configurador-lealtad";

function estadoInicial(): EstadoGuardado {
  const base = coloresDePaleta(PALETAS.sellos);
  return {
    nombreNegocio: "",
    modo: "sellos",
    beneficio: configPorDefecto("sellos"),
    colorFondo: base.fondo,
    colorSello: base.sello,
    iconoSello: null,
    imagenModo: "ninguna",
    imagenStockId: null,
    logoUrl: null,
    telefono: "",
    pantalla: "negocio",
  };
}

/** Igual criterio que `wizard-alta.tsx`: nunca se cree el borrador tal
 *  cual — un valor viejo o manipulado se descarta al default. */
function sanearGuardado(crudo: unknown, pantallas: readonly Pantalla[]): EstadoGuardado {
  const limpio = estadoInicial();
  if (!crudo || typeof crudo !== "object") return limpio;
  const c = crudo as Record<string, unknown>;

  if (typeof c.nombreNegocio === "string") limpio.nombreNegocio = c.nombreNegocio.slice(0, 80);
  if (typeof c.telefono === "string") limpio.telefono = c.telefono.slice(0, 30);
  if (typeof c.modo === "string" && esTipoTarjeta(c.modo)) {
    limpio.modo = c.modo;
    limpio.beneficio = leerBeneficio(c.beneficio, c.modo) ?? configPorDefecto(c.modo);
  }
  if (typeof c.colorFondo === "string" && HEX.test(c.colorFondo)) limpio.colorFondo = c.colorFondo;
  if (typeof c.colorSello === "string" && HEX.test(c.colorSello)) limpio.colorSello = c.colorSello;
  if (esIconoSello(c.iconoSello)) limpio.iconoSello = c.iconoSello;

  if (c.imagenModo === "stock" && esImagenStock(c.imagenStockId)) {
    limpio.imagenModo = "stock";
    limpio.imagenStockId = c.imagenStockId;
  } else if (c.imagenModo === "propia" && typeof c.logoUrl === "string" && c.logoUrl) {
    limpio.imagenModo = "propia";
    limpio.logoUrl = c.logoUrl;
  }

  if (typeof c.pantalla === "string" && (pantallas as readonly string[]).includes(c.pantalla)) {
    limpio.pantalla = c.pantalla as Pantalla;
  } else if (c.pantalla === "cuenta") {
    // Ya había sesión (o el paso ya no existe por otra razón): el
    // siguiente paso lógico después de «cuenta» es «revisar».
    limpio.pantalla = "revisar";
  }
  return limpio;
}

type Exito = { ranchoId: string; slug: string | null };

export default function ConfiguradorLealtad({ haySesion }: { haySesion: boolean }) {
  const router = useRouter();
  const pantallas = haySesion ? PANTALLAS_SIN_CUENTA : PANTALLAS_CON_CUENTA;

  const [estado, setEstado] = useState<EstadoGuardado>(estadoInicial);
  const [restaurado, setRestaurado] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const [verMasColores, setVerMasColores] = useState(false);

  // La vista previa local del archivo propio SIN sesión: nunca se
  // guarda (ver el comentario grande de arriba), así que vive fuera del
  // estado que se respalda.
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const crudo = sessionStorage.getItem(CLAVE_SESION);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata desde sessionStorage una sola vez por carga
      if (crudo) setEstado(sanearGuardado(JSON.parse(crudo), pantallas));
    } catch {
      /* storage bloqueado o JSON roto: se arranca de cero */
    }
    setRestaurado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);
  useEffect(() => {
    if (!restaurado) return;
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(estado));
    } catch {
      /* sin espacio o bloqueado: el asistente sigue, solo sin respaldo */
    }
  }, [estado, restaurado]);

  const patch = (p: Partial<EstadoGuardado>) => setEstado((e) => ({ ...e, ...p }));

  const indiceActual = Math.max(0, pantallas.indexOf(estado.pantalla));
  const pantalla = pantallas[indiceActual];

  function avanzar() {
    patch({ pantalla: pantallas[Math.min(indiceActual + 1, pantallas.length - 1)] });
  }
  function atras() {
    patch({ pantalla: pantallas[Math.max(indiceActual - 1, 0)] });
  }

  function elegirTipo(t: TipoTarjeta) {
    setEstado((e) => {
      const sigueEnPlantilla = paletaDeLosColores(e.colorFondo, e.colorSello) !== null;
      const c = sigueEnPlantilla ? coloresDePaleta(PALETAS[t]) : null;
      return {
        ...e,
        modo: t,
        beneficio: configPorDefecto(t),
        colorFondo: c?.fondo ?? e.colorFondo,
        colorSello: c?.sello ?? e.colorSello,
      };
    });
  }

  function elegirImagenStock(id: string) {
    setPreviewLocal(null);
    setErrorLogo(null);
    patch({ imagenModo: "stock", imagenStockId: id, logoUrl: null });
  }

  function quitarImagen() {
    setPreviewLocal(null);
    setErrorLogo(null);
    patch({ imagenModo: "ninguna", imagenStockId: null, logoUrl: null });
  }

  async function elegirArchivoPropio(archivo: File | undefined) {
    if (!archivo) return;
    setErrorLogo(null);
    if (!archivo.type.startsWith("image/")) {
      setErrorLogo("Eso no es una imagen.");
      return;
    }

    if (!haySesion) {
      // Sin sesión no hay a dónde subir: solo vista previa local, igual
      // que hacía este mismo panel antes de este cambio.
      if (archivo.size > 5 * 1024 * 1024) {
        setErrorLogo("Muy pesada — probá con una de menos de 5 MB.");
        return;
      }
      const lector = new FileReader();
      lector.onload = () => {
        if (typeof lector.result === "string") setPreviewLocal(lector.result);
      };
      lector.onerror = () => setErrorLogo("No se pudo leer la imagen. Probá con otra.");
      lector.readAsDataURL(archivo);
      patch({ imagenModo: "propia", imagenStockId: null, logoUrl: null });
      return;
    }

    if (archivo.size > 8 * 1024 * 1024) {
      setErrorLogo("El archivo pesa más de 8 MB — probá con una versión más liviana.");
      return;
    }
    setSubiendoLogo(true);
    const url = await subirImagenAlAlta(archivo, "logo");
    setSubiendoLogo(false);
    if (url) {
      setPreviewLocal(null);
      patch({ imagenModo: "propia", imagenStockId: null, logoUrl: url });
    } else {
      setErrorLogo("No pudimos subir la imagen. Intentá de nuevo.");
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
    !ocupado && esGratis && nombre.length > 0 && motivoBeneficio === null && telefonoListo;

  const puedeAvanzar: Record<Pantalla, boolean> = {
    negocio: nombre.length > 0 && nombre.length <= 80,
    premio: motivoBeneficio === null,
    apariencia: !subiendoLogo,
    cuenta: false,
    revisar: puedePublicar,
  };

  function limpiarRespaldo() {
    try {
      sessionStorage.removeItem(CLAVE_SESION);
    } catch {
      /* sin storage no hay nada que limpiar */
    }
  }

  function irAlPlanPago() {
    // El borrador ya está guardado (el efecto lo escribe en cada
    // cambio): /lealtad/nuevo lo restaura con la misma llave.
    iniciar(() => router.push(`/lealtad/nuevo?plan=${planDestino}`));
  }

  function publicar() {
    setError(null);
    const b = estado.beneficio;
    const datos = {
      nombreNegocio: nombre,
      // Sin paso de rubro en este flujo fusionado: "citas" es el
      // vertical más común de Lealtad y evita el único campo que
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
        bannerUrl: null,
      },
    };
    iniciar(async () => {
      const res = await solicitarAltaConPlan(datos);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      limpiarRespaldo();
      if (res.creado) setExito({ ranchoId: res.creado.ranchoId, slug: res.creado.slug });
    });
  }

  const logoUrlVista =
    estado.imagenModo === "propia"
      ? (estado.logoUrl ?? previewLocal)
      : estado.imagenModo === "stock" && estado.imagenStockId
        ? dataUriImagenStock(estado.imagenStockId, estado.colorFondo)
        : null;

  const datosVista: DatosVista = {
    negocioNombre: nombre || "Tu negocio",
    modo: estado.modo,
    beneficio: estado.beneficio,
    colorFondo: estado.colorFondo,
    colorSello: estado.colorSello,
    logoUrl: logoUrlVista,
    iconoSello: estado.modo === "sellos" ? estado.iconoSello : null,
  };

  if (exito) {
    return (
      <div
        id="configurador-lealtad"
        className="entra-suave mx-auto max-w-[560px] scroll-mt-20 rounded-3xl border border-white/10 bg-white p-8 text-center"
      >
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

  return (
    <div
      id="configurador-lealtad"
      className="scroll-mt-20 overflow-hidden rounded-[22px] border border-white/10 bg-white shadow-[0_30px_70px_-28px_rgba(4,10,24,0.55)]"
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-2"
        style={{ background: "linear-gradient(90deg,#0a1226,#16295e)" }}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white/85">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#20ae74", boxShadow: "0 0 0 3px rgba(32,174,116,.18)" }}
          />
          Armá tu tarjeta acá mismo
        </span>
        <span className="text-[9.5px] font-bold text-white/50">
          Paso {indiceActual + 1} de {pantallas.length}
        </span>
      </div>

      {/* ── Puntitos ─────────────────────────────────────────────── */}
      <div className="flex gap-1.5 px-4 pt-3.5" aria-label="Pasos">
        {pantallas.map((p, i) => (
          <span
            key={p}
            className="block h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= indiceActual ? "var(--accion)" : "var(--line)" }}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr]">
        {/* ============== PANEL DEL PASO ACTUAL ============== */}
        <div className="border-b border-bookea-linea p-4 lg:border-b-0 lg:border-r lg:p-5">
          <h2 className="titulo text-[18px] text-bookea-tinta">{TITULOS[pantalla].titulo}</h2>
          <p className="mt-0.5 text-[12px] text-bookea-gris">{TITULOS[pantalla].bajada}</p>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pantalla === "revisar") {
                if (puedePublicar) publicar();
              } else if (pantalla !== "cuenta" && puedeAvanzar[pantalla]) avanzar();
            }}
          >
            {/* ── Negocio y tarjeta ─────────────────────────────── */}
            {pantalla === "negocio" && (
              <div className="space-y-3.5">
                <label className="block">
                  <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                    Nombre del negocio
                  </span>
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
                  <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                    Tipo de tarjeta
                  </span>
                  <div role="radiogroup" aria-label="Tipo de tarjeta" className="grid grid-cols-4 gap-1.5">
                    {TIPOS_TARJETA_LISTA.map((t) => {
                      const elegido = t.id === estado.modo;
                      const gratis = tiposGratis.includes(t.id);
                      const abre = !gratis ? planQueDesbloquea(t.id) : null;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={elegido}
                          onClick={() => elegirTipo(t.id)}
                          className={`presionable relative flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center ${
                            elegido
                              ? "border-bookea-azul bg-bookea-azul-suave"
                              : "border-bookea-linea bg-white hover:border-bookea-azul/40"
                          }`}
                        >
                          <span
                            className="grid h-6 w-6 place-items-center rounded-lg"
                            style={{
                              background: elegido ? "var(--navy)" : "var(--navy-suave)",
                              color: elegido ? "#fff" : "var(--navy)",
                            }}
                          >
                            <Icono nombre={t.icono as NombreIcono} className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-[9.5px] font-extrabold leading-tight text-bookea-tinta">
                            {t.nombre}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-[1px] text-[6.5px] font-extrabold uppercase tracking-wide ${
                              gratis ? "bg-emerald-50 text-emerald-700" : "bg-bookea-azul-suave text-bookea-azul"
                            }`}
                          >
                            {gratis ? "Gratis" : abre?.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Premio ────────────────────────────────────────── */}
            {pantalla === "premio" && (
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
            )}

            {/* ── Apariencia ────────────────────────────────────── */}
            {pantalla === "apariencia" && (
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                    Color de la tarjeta
                  </span>
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
                        id="c-fondo"
                        etiqueta="Color de fondo"
                        valor={estado.colorFondo}
                        alCambiar={(v) => patch({ colorFondo: v })}
                      />
                      <CampoColor
                        id="c-sello"
                        etiqueta="Color del acento"
                        valor={estado.colorSello}
                        alCambiar={(v) => patch({ colorSello: v })}
                      />
                    </div>
                  )}
                </div>

                {estado.modo === "sellos" && (
                  <div>
                    <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                      Icono del sello
                    </span>
                    <SelectorIconoSello
                      valor={estado.iconoSello}
                      alElegir={(i) => patch({ iconoSello: esIconoSello(i) ? i : null })}
                      colorFondo={estado.colorFondo}
                      colorSello={estado.colorSello}
                    />
                  </div>
                )}

                <div>
                  <span className="mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                    Imagen del negocio
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {IMAGENES_STOCK.map((img) => {
                      const puesta = estado.imagenModo === "stock" && estado.imagenStockId === img.id;
                      const uri = dataUriImagenStock(img.id, estado.colorFondo);
                      return (
                        <button
                          key={img.id}
                          type="button"
                          aria-pressed={puesta}
                          title={img.nombre}
                          onClick={() => elegirImagenStock(img.id)}
                          className={`presionable overflow-hidden rounded-xl border ${
                            puesta ? "border-bookea-azul ring-2 ring-bookea-azul" : "border-bookea-linea"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI generado, no un archivo */}
                          {uri && <img src={uri} alt="" className="aspect-square w-full" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2.5">
                    {estado.imagenModo === "propia" && (previewLocal || estado.logoUrl) ? (
                      <div className="flex items-center gap-2.5 rounded-xl border border-bookea-linea p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local o URL recién subida */}
                        <img
                          src={estado.logoUrl ?? previewLocal ?? ""}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-lg object-cover"
                        />
                        <span className="min-w-0 flex-1 text-[11.5px] font-bold text-bookea-tinta">
                          {estado.logoUrl ? "Imagen subida" : "Vista previa (se sube con tu cuenta)"}
                        </span>
                        <button
                          type="button"
                          onClick={quitarImagen}
                          className="shrink-0 text-[11.5px] font-bold text-bookea-gris underline"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <label className="presionable flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-bookea-linea bg-white px-3 py-2.5 text-[11.5px] font-bold text-bookea-gris hover:border-bookea-azul">
                        <span aria-hidden>🖼</span>
                        <span>{subiendoLogo ? "Subiendo…" : "Subir mi propia imagen"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={subiendoLogo}
                          className="hidden"
                          onChange={(e) => {
                            void elegirArchivoPropio(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    {!haySesion && estado.imagenModo === "propia" && previewLocal && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-bookea-gris">
                        Esto es solo una vista previa: se sube de verdad en cuanto tengas tu
                        cuenta, en el siguiente paso.
                      </p>
                    )}
                    {errorLogo && (
                      <p className="mt-1.5 text-[11px] font-bold text-red-600">{errorLogo}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Cuenta ────────────────────────────────────────── */}
            {pantalla === "cuenta" && (
              <div className="-mx-1">
                <FormularioAuth
                  destino={ANCLA}
                  titulo="Ya casi — creá tu cuenta"
                  intro="Con eso queda a tu nombre. Escribí tu correo: si ya tenés cuenta entrás directo, y si es tu primera vez, con tu nombre alcanza. Tu tarjeta queda tal como la armaste."
                />
              </div>
            )}

            {/* ── Revisar y crear ───────────────────────────────── */}
            {pantalla === "revisar" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-bookea-linea bg-white p-4">
                  <dl className="divide-y divide-bookea-linea">
                    {(
                      [
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
                              ? "Ícono por defecto"
                              : estado.logoUrl
                                ? "Subida"
                                : "Vista previa (falta subirla)",
                        ],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-bookea-gris">{k}</dt>
                        <dd className="text-[13px] font-bold text-bookea-tinta">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris">
                    Teléfono (para coordinar)
                  </span>
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
                      Ese camino pide un depósito y lo confirma Bookea — lo tuyo se guarda igual,
                      no perdés nada de lo que armaste acá.
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
                  <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* ── Navegación ────────────────────────────────────── */}
            {pantalla !== "cuenta" && (
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={atras}
                  disabled={indiceActual === 0}
                  className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-gris disabled:opacity-40"
                >
                  Atrás
                </button>
                <span className="flex-1" />
                {pantalla !== "revisar" ? (
                  <button
                    type="submit"
                    disabled={!puedeAvanzar[pantalla]}
                    className="presionable rounded-full px-5 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
                    style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                  >
                    Siguiente →
                  </button>
                ) : (
                  esGratis && (
                    <button
                      type="submit"
                      disabled={!puedePublicar}
                      className="presionable rounded-full px-5 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
                      style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                    >
                      {ocupado ? "Creando…" : "Crear mi tarjeta YA →"}
                    </button>
                  )
                )}
              </div>
            )}
            {pantalla === "cuenta" && (
              <button
                type="button"
                onClick={atras}
                className="presionable mt-3 rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-gris"
              >
                ← Atrás
              </button>
            )}
          </form>
        </div>

        {/* ============== VISTA PREVIA ============== */}
        <div
          className="flex items-center justify-center px-4 py-5"
          style={{ background: "linear-gradient(155deg,#dceaf5,var(--accion-suave))" }}
        >
          <VistaPase datos={datosVista} superficie="clara" marco="telefono" />
        </div>
      </div>
    </div>
  );
}
