"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorTipo from "@/components/lealtad/selector-tipo";
import SelectorTipoExplorable from "@/components/lealtad/selector-tipo-explorable";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import SelectorFranja from "@/components/lealtad/selector-franja";
import SelectorImagenNegocio from "@/components/lealtad/selector-imagen-negocio";
import PasoBeneficio from "@/components/lealtad/paso-beneficio";
import CampoColor from "@/components/campo-color";
import SubirImagen from "@/components/subir-imagen";
import { PAISES, COSTA_RICA } from "@/lib/paises";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import { contraste } from "@/lib/invitaciones/paleta";
import { dataUriPlantillaIcono } from "@/lib/lealtad/plantillas-icono";
import { PLANTILLAS_FRANJA } from "@/lib/lealtad/plantillas-franjas";
import { subirImagenAlAlta } from "@/lib/lealtad/subida-alta";
import { PALETAS, coloresDePaleta, paletaDeLosColores } from "@/lib/lealtad/paletas";
import { PLANES, esPlanSinCosto, planQueDesbloquea, tiposDelPlan, type PlanId } from "@/lib/lealtad/planes";
import {
  ICONOS_SELLO,
  esIconoSello,
  type SelloElegido,
} from "@/lib/lealtad/iconos-sello";
import {
  TIPOS_TARJETA,
  configPorDefecto,
  validarBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { Icono, type NombreIcono } from "@/app/lealtad/panel/[id]/iconos";
import PasoReglas, { resumenDeReglas, type Reglas } from "@/app/lealtad/panel/[id]/paso-reglas";
import AyudaDeDiseno from "@/app/lealtad/panel/[id]/ayuda-diseno";
import { AvisoError, AvisoGuardado } from "@/app/lealtad/panel/[id]/programa-contexto";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";

/**
 * EL PANEL ÚNICO PARA ARMAR Y EDITAR UNA TARJETA.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ------------------------------------------------------------------
 * Hasta este cambio había TRES formularios distintos pintando lo mismo
 * de tres formas distintas: `editor-tarjeta-completo.tsx` (Modo 3 del
 * configurador público, sin sesión), `panel/[id]/creador-tarjeta.tsx`
 * (un asistente de puntitos, autenticado, para crear) y
 * `panel/[id]/editor-tarjeta.tsx` (secciones numeradas, autenticado,
 * para editar — que ya había copiado a mano el lenguaje visual de este
 * mismo archivo). El dueño pidió UN SOLO panel para los tres casos.
 *
 * Este componente es ese panel. Un `modo` ("publico" | "crear" |
 * "editar") decide las diferencias que SÍ importan; todo lo demás —las
 * cinco secciones numeradas, el pase pegado a la derecha, la vista
 * móvil— es una sola implementación.
 *
 * ------------------------------------------------------------------
 * CONTROLADO DE AFUERA, A PROPÓSITO
 * ------------------------------------------------------------------
 * Este archivo NO sabe guardar nada. Recibe `valor`/`alCambiar` (el
 * borrador, controlado por quien lo monta) y `guardando`/`error`/
 * `onGuardar` (el resultado de guardar, también de quien lo monta). Los
 * tres guardados de verdad son genuinamente distintos —crear un
 * `INSERT` nuevo (`crear-actions.ts`), editar con el candado del tipo
 * (`pases-actions.ts` vía `programa-contexto.tsx`), o dar de alta un
 * negocio entero sin sesión (`nuevo/actions.ts`)— y unificar la UI no
 * significa reescribir esa lógica que ya funciona en producción.
 *
 * Quien llama decide DE DÓNDE sale `valor`: `configurador-lealtad.tsx`
 * lo arma desde su `EstadoLealtad` (con respaldo en sessionStorage),
 * el creador desde un `useState` nuevo, y el editor desde el `borrador`
 * de `usePrograma()` combinado con estado local — ver el comentario de
 * cada uno de esos tres archivos.
 *
 * ------------------------------------------------------------------
 * DIFERENCIAS REALES QUE SÍ SE RESPETAN POR MODO
 * ------------------------------------------------------------------
 *   · Selector de tipo: "publico" usa `SelectorTipoExplorable` (los
 *     ocho, con badge de paquete, nada bloqueado — el negocio todavía
 *     no existe). "crear"/"editar" usan `SelectorTipo` (bloqueo real
 *     contra el paquete contratado). En "editar", si `candado` dice que
 *     no se puede, se pinta `TipoCerrado` en vez del selector: el tipo
 *     queda fijo en cuanto se afilia el primer cliente (regla real de
 *     `src/lib/lealtad/editable.ts`, no se toca acá).
 *   · Imágenes: "publico" ofrece bancos de plantillas (preview-only,
 *     `SelectorFranja`/`SelectorImagenNegocio`) más una subida propia
 *     que sube a `comprobantes` porque el negocio todavía no tiene
 *     carpeta. "crear"/"editar" ya tienen un rancho, así que suben
 *     directo con `SubirImagen` a su carpeta real.
 *   · Reglas (vigencia/días/horas/topes): solo "crear" y "editar" las
 *     ofrecen. El alta pública se queda liviana a propósito — se
 *     afinan después, ya con el negocio creado.
 *   · "Tu cuenta": solo "publico" sin sesión.
 *   · Este panel YA NO dibuja "Regalías" ni "Estado" en modo "editar"
 *     (se sacaron para que editar quede IGUAL a crear en estructura —
 *     pedido del dueño, ago 2026): esas dos siguen viviendo en la
 *     pestaña «Recompensas» del panel principal (`panel/[id]/page.tsx`),
 *     aunque ahí solo editan la tarjeta PRINCIPAL. Con varias tarjetas,
 *     archivar/pausar una que no es la principal se quedó sin pantalla
 *     propia — es la contrapartida conocida de esta unificación.
 *   · El botón final: "Crear mi tarjeta YA" (publico, gratis) / aviso
 *     de paquete pago (publico, no gratis) / "Publicar tarjeta" (crear)
 *     / "Guardar cambios" sin sección "Revisar" (editar — el resto del
 *     panel de "editar" ya tiene su propio ritmo de guardado por
 *     bloque, ver `programa-contexto.tsx`).
 */

export type ValorFormulario = {
  nombre: string;
  tipo: TipoTarjeta;
  beneficio: ConfigBeneficio;
  colorFondo: string;
  colorSello: string;
  iconoSello: SelloElegido | null;
  /** Ícono propio subido (0174). "" = ninguno. Solo crear/editar lo llenan. */
  iconoUrl: string;
  logoUrl: string;
  bannerUrl: string;
  /**
   * El logo del AVISO de Wallet (0208) — NO se dibuja en la tarjeta, es
   * la imagen que Apple/Google muestran cuando el pase se actualiza.
   * Solo crear/editar lo ofrecen: sin rancho no hay dónde subirlo.
   */
  notificacionLogoUrl: string;
  /** Vigencia/días/horas/topes. Solo crear/editar la muestran. */
  reglas: Reglas;
  vencenMeses: number | null;
  /** Solo público lo pide (para coordinar el alta). */
  telefono: string;

  /** Bookkeeping SOLO de modo "publico": banco de plantillas + preview local. */
  imagenModo: "ninguna" | "stock" | "propia";
  imagenStockId: string | null;
  franjaModo: "ninguna" | "banco" | "propia";
  franjaBancoId: string | null;
  /** Cosmético (publico): qué paquete se tocó en el paso de Paquetes. */
  planElegido: PlanId | null;
};

export type CandadoTipo = { puede: boolean; motivo: string | null };

const CLAVE_SESION_RESPALDO = "bookea-lealtad-wizard:nuevo";
const ANCLA = "/lealtad#configurador-lealtad";

const etiqueta = "mb-1.5 block text-[9.5px] font-bold uppercase tracking-wide text-bookea-gris";

/**
 * EL ASTERISCO DE «ESTO SÍ HACE FALTA» — pedido del dueño (ago 2026).
 *
 * No es decoración ni se reparte a gusto: lo llevan EXACTAMENTE los dos
 * campos que `puedeGuardar` (más abajo) exige para dejar crear la
 * tarjeta en el alta pública — `nombre.length > 0` y `telefonoListo`.
 * Ya eran obligatorios; lo único que faltaba era decirlo. Sin la marca
 * el botón de crear se quedaba apagado sin explicar cuál de los dos
 * campos lo estaba frenando.
 *
 * ⚠️ Si algún día se agrega o se saca una condición de `puedeGuardar`,
 * esta marca tiene que moverse con ella — un asterisco que miente es
 * peor que ninguno.
 *
 * Va `aria-hidden` a propósito: un lector de pantalla leyendo
 * «asterisco» no informa nada. Quien informa es el `required` del
 * input, que el navegador traduce a `aria-required`. Uno para el ojo,
 * el otro para el lector; no se pisan. Y `required` acá no dispara la
 * validación nativa del navegador porque estos campos no viven dentro
 * de un `<form>` — el guardado va por el botón, no por un submit.
 */
function Obligatorio() {
  return (
    <span aria-hidden className="ml-0.5 text-bookea-azul">
      *
    </span>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL TELÉFONO, CON SU EXTENSIÓN DE PAÍS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): «que salga elegir extensión del país y
 * luego número de teléfono», y que se caiga el «(para coordinar)».
 *
 * ── LA LISTA DE PAÍSES NO SE ESCRIBE ACÁ ────────────────────────────
 * Sale de `@/lib/paises`, que es el catálogo único del sitio (el mismo
 * que usan las regiones, las monedas y las zonas horarias). Escribir
 * ocho prefijos a mano habría creado un segundo catálogo que se despega
 * en cuanto entre el noveno país — y el propio `paises.ts` cuenta que
 * eso YA pasó una vez con las zonas horarias.
 *
 * ── SE GUARDA UN SOLO TEXTO, NO DOS CAMPOS ──────────────────────────
 * `valor.telefono` sigue siendo UN string, ahora con la forma
 * «+506 8888 8888». Es deliberado: partirlo en dos campos obligaba a
 * tocar la acción que crea el negocio, la tabla y todo lo que ya lee ese
 * dato. Acá se parte solo para pintarlo y se vuelve a unir al escribir.
 *
 * ⚠️ EL ORDEN DE BÚSQUEDA DEL PREFIJO VA POR LARGO, NO POR LISTA. Con
 * ocho países cuyos prefijos comparten raíz (+506, +507, +505, +502…),
 * buscar en el orden del arreglo funciona hoy de casualidad. Ordenar de
 * más largo a más corto es lo que lo hace correcto para siempre: si
 * algún día entra un «+5» genérico, seguiría ganando el específico.
 */
const PREFIJOS_POR_LARGO = [...PAISES].sort(
  (a, b) => b.prefijoTelefono.length - a.prefijoTelefono.length,
);

function CampoTelefono({
  valor,
  alCambiar,
}: {
  valor: string;
  alCambiar: (telefono: string) => void;
}) {
  const guardado = valor.trim();
  const pais =
    PREFIJOS_POR_LARGO.find((p) => guardado.startsWith(p.prefijoTelefono)) ??
    COSTA_RICA;
  const numero = guardado.startsWith(pais.prefijoTelefono)
    ? guardado.slice(pais.prefijoTelefono.length).trim()
    : guardado;

  /* Se vuelve a unir en cada cambio. Si el número está vacío se manda
     vacío y NO «+506 » solo: `puedeGuardar` mira `telefono.trim()`, y un
     prefijo suelto lo daría por completo — el botón se encendería con un
     teléfono que no existe. */
  const unir = (pref: string, num: string) =>
    num.trim() ? `${pref} ${num.trim()}` : "";

  return (
    <div className="block">
      <span className={etiqueta} id="etiqueta-telefono">
        Teléfono
        <Obligatorio />
      </span>
      <div className="flex gap-2">
        <select
          aria-label="Extensión del país"
          value={pais.codigo}
          onChange={(e) => {
            const elegido =
              PAISES.find((p) => p.codigo === e.target.value) ?? COSTA_RICA;
            alCambiar(unir(elegido.prefijoTelefono, numero));
          }}
          className={`${campo} w-[132px] shrink-0 cursor-pointer`}
        >
          {PAISES.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.bandera} {p.prefijoTelefono}
            </option>
          ))}
        </select>
        <input
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-labelledby="etiqueta-telefono"
          value={numero}
          onChange={(e) =>
            alCambiar(unir(pais.prefijoTelefono, e.target.value.slice(0, 24)))
          }
          placeholder="8888 8888"
          className={`${campo} min-w-0 flex-1`}
        />
      </div>
    </div>
  );
}
const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] font-medium text-bookea-tinta placeholder:text-bookea-gris/70 outline-none focus:border-bookea-azul";

/** WCAG AA para texto — mismo umbral que ya usaba el editor autenticado. */
const CONTRASTE_TEXTO = 4.5;
/** Los sellos son formas grandes, no texto: el umbral de gráficos alcanza. */
const CONTRASTE_SELLO = 2.2;

export default function TarjetaFormulario({
  modo,
  valor,
  alCambiar,
  negocioNombre,
  negocioNombreReal = null,
  haySesion = true,
  plan = null,
  ranchoId = null,
  programaId = null,
  ayudaInicial = null,
  candado = null,
  bloqueada = false,
  motivoBloqueada = null,
  aviso = null,
  emitidos = 0,
  guardando,
  error,
  onGuardar,
  alVolver,
}: {
  modo: "publico" | "crear" | "editar";
  valor: ValorFormulario;
  alCambiar: (patch: Partial<ValorFormulario>) => void;
  /** Nombre de respaldo para la vista previa (rancho.nombre en crear/editar; "" en público). */
  negocioNombre: string;
  /**
   * SOLO "editar": el nombre REAL del negocio, que es lo que muestra el
   * pase — desacoplado del campo "nombre" de la Sección 1, que ahí es
   * solo la etiqueta con la que el dueño ve la tarjeta en su panel.
   */
  negocioNombreReal?: string | null;
  haySesion?: boolean;
  /** El paquete real del negocio (crear/editar). Ignorado en público. */
  plan?: string | null;
  /** null en "publico" (el negocio no existe todavía). */
  ranchoId?: string | null;
  programaId?: string | null;
  ayudaInicial?: HiloAyuda | null;
  /** SOLO "editar": si el tipo quedó fijo por tener miembros adentro. */
  candado?: CandadoTipo | null;
  /** SOLO "editar": la tarjeta está archivada y no se toca. */
  bloqueada?: boolean;
  motivoBloqueada?: string | null;
  /** SOLO "editar": el aviso de mover la meta con gente adentro. */
  aviso?: string | null;
  /** SOLO "editar": cuántos pases ya hay en teléfonos. */
  emitidos?: number;
  guardando: boolean;
  error: string | null;
  onGuardar: () => void;
  /** SOLO "publico": "← Volver a los paquetes" (cambia de modo en el padre, no navega). */
  alVolver?: () => void;
}) {
  const router = useRouter();
  const patch = alCambiar;

  const esPublico = modo === "publico";
  const esCrear = modo === "crear";
  const esEditar = modo === "editar";

  const [verMasColores, setVerMasColores] = useState(false);
  const [verPase, setVerPase] = useState(false);

  // ── Estado local SOLO del banco/preview de "publico" ────────────────
  // Nunca se usan en crear/editar (que suben directo con `SubirImagen`),
  // pero declararlos siempre —y no "cuando modo===publico"— es lo que
  // mantiene válidas las reglas de hooks: lo condicional es si se USAN
  // en el JSX, no si el hook se llama.
  const [previewLocalLogo, setPreviewLocalLogo] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const [previewLocalFranja, setPreviewLocalFranja] = useState<string | null>(null);
  const [subiendoFranja, setSubiendoFranja] = useState(false);
  const [errorFranja, setErrorFranja] = useState<string | null>(null);

  const nombre = valor.nombre.trim();
  const motivoBeneficio = validarBeneficio(valor.beneficio);
  const tipoLocked = esEditar && candado !== null && !candado.puede;

  const tiposGratis = tiposDelPlan("prueba");
  const esGratis = tiposGratis.includes(valor.tipo);
  const planQueAbre = planQueDesbloquea(valor.tipo);
  /**
   * EL PLAN QUE HAY QUE COBRAR ANTES DE CREAR — pedido del dueño
   * (ago 2026): si en el panel de paquetes se ELIGIÓ un paquete pago,
   * «Crear tarjeta» ya no crea directo en el gratis ignorando ese
   * clic; primero se despliega el camino de pago. El paquete elegido
   * deja de ser puro cosmético: decide si el cierre cobra o crea.
   *
   * El servidor sigue revalidando igual que siempre — este cálculo
   * solo decide QUÉ CIERRE se muestra, no qué plan se otorga.
   */
  const planPagoElegido =
    esPublico && valor.planElegido && !esPlanSinCosto(valor.planElegido)
      ? PLANES[valor.planElegido]
      : null;
  const planACobrar = planPagoElegido ?? (esGratis ? null : planQueAbre);
  const requierePago = esPublico && planACobrar !== null;
  const planDestino: PlanId = planACobrar?.id ?? "prueba";
  const telefonoListo = valor.telefono.trim().length > 0;

  const puedeGuardar = esPublico
    ? !guardando && !requierePago && nombre.length > 0 && nombre.length <= 80 && motivoBeneficio === null && telefonoListo
    : esCrear
      ? !guardando && motivoBeneficio === null && nombre.length > 0 && nombre.length <= 80
      : !bloqueada && !guardando && motivoBeneficio === null && nombre.length > 0;

  /**
   * Cambiar el tipo REEMPLAZA el beneficio (los campos de una gift card
   * no significan nada en sellos) y limpia el icono si deja de ser
   * sellos. El color solo sigue a la paleta del tipo nuevo cuando los
   * colores actuales TODAVÍA son de plantilla — y nunca en "editar":
   * una tarjeta que ya vive en teléfonos ajenos no se recolorea sola
   * por cambiar el tipo, aunque sus colores coincidan con una plantilla
   * (la misma cautela que ya tenía `panel/[id]/editor-tarjeta.tsx`).
   */
  function elegirTipo(nuevo: TipoTarjeta) {
    const sigueEnPlantilla = !esEditar && paletaDeLosColores(valor.colorFondo, valor.colorSello) !== null;
    const coloresNuevos = sigueEnPlantilla ? coloresDePaleta(PALETAS[nuevo]) : null;
    patch({
      tipo: nuevo,
      beneficio: configPorDefecto(nuevo),
      ...(coloresNuevos ? { colorFondo: coloresNuevos.fondo, colorSello: coloresNuevos.sello } : {}),
      ...(nuevo !== "sellos" ? { iconoSello: null, iconoUrl: "" } : {}),
    });
  }

  // ── Imágenes de "publico": banco de plantillas + subida propia ─────
  function elegirImagenBanco(id: string | null) {
    setPreviewLocalLogo(null);
    setErrorLogo(null);
    patch({ imagenModo: id ? "stock" : "ninguna", imagenStockId: id, logoUrl: "" });
  }
  function elegirFranjaBanco(id: string | null) {
    setPreviewLocalFranja(null);
    setErrorFranja(null);
    patch({ franjaModo: id ? "banco" : "ninguna", franjaBancoId: id, bannerUrl: "" });
  }
  function quitarImagenPropia() {
    setPreviewLocalLogo(null);
    setErrorLogo(null);
    patch({ imagenModo: "ninguna", imagenStockId: null, logoUrl: "" });
  }
  function quitarFranjaPropia() {
    setPreviewLocalFranja(null);
    setErrorFranja(null);
    patch({ franjaModo: "ninguna", franjaBancoId: null, bannerUrl: "" });
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
      if (slot === "logo") patch({ imagenModo: "propia", imagenStockId: null, logoUrl: "" });
      else patch({ franjaModo: "propia", franjaBancoId: null, bannerUrl: "" });
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

  function irAlPlanPago() {
    // Se marca el respaldo con `camino: "prellenado"` ANTES de navegar,
    // para que /lealtad/nuevo salte directo a "Revisar y publicar" en
    // vez de volver a pedir negocio/tipo/beneficio/apariencia que esta
    // pantalla ya resolvió.
    try {
      sessionStorage.setItem(
        CLAVE_SESION_RESPALDO,
        JSON.stringify({ ...valor, vista: "editor", camino: "prellenado", tipoNegocio: "citas" }),
      );
    } catch {
      /* sin storage: /lealtad/nuevo arranca de cero, como antes de este cambio */
    }
    router.push(`/lealtad/nuevo?plan=${planDestino}`);
  }

  // ── Vista previa ─────────────────────────────────────────────────
  const logoUrlVista = esPublico
    ? valor.imagenModo === "propia"
      ? (valor.logoUrl || previewLocalLogo)
      : valor.imagenModo === "stock" && valor.imagenStockId
        ? dataUriPlantillaIcono(valor.imagenStockId, valor.colorFondo)
        : null
    : valor.logoUrl || null;
  const bannerUrlVista = esPublico
    ? valor.franjaModo === "propia"
      ? (valor.bannerUrl || previewLocalFranja)
      : valor.franjaModo === "banco" && valor.franjaBancoId
        ? (PLANTILLAS_FRANJA.find((f) => f.id === valor.franjaBancoId)?.src ?? null)
        : null
    : valor.bannerUrl || null;
  const nombreVista = esEditar
    ? negocioNombreReal || negocioNombre || "Tu negocio"
    : nombre || negocioNombre || "Tu negocio";

  const datosVista: DatosVista = {
    negocioNombre: nombreVista,
    modo: valor.tipo,
    beneficio: valor.beneficio,
    colorFondo: valor.colorFondo,
    colorSello: valor.colorSello,
    logoUrl: logoUrlVista,
    bannerUrl: bannerUrlVista,
    iconoSello: valor.tipo === "sellos" ? valor.iconoSello : null,
    iconoUrl: valor.tipo === "sellos" ? valor.iconoUrl || null : null,
  };

  // ── Pasos del wizard ─────────────────────────────────────────────────
  // Antes esto dibujaba las secciones apiladas, todas juntas, en un solo
  // scroll largo — lo más lejos posible de "un panel" que pidió el
  // dueño la primera vez, y el mismo problema volvió a aparecer una vez
  // armado: mucho para bajar de una sola vez. Ahora es un wizard de
  // verdad — una sección visible a la vez, con "Siguiente"/"Atrás" — y
  // la lista de pasos varía por `modo` exactamente con el mismo criterio
  // que antes decidía qué sección existía.
  const pasos = [
    "negocio",
    "programa",
    "apariencia",
    ...(esPublico && !haySesion ? ["cuenta"] : []),
    ...(!esEditar ? ["revisar"] : []),
  ] as const;
  const [paso, setPaso] = useState(0);
  const pasoActual = pasos[Math.min(paso, pasos.length - 1)];
  const esPasoNegocio = pasoActual === "negocio";
  const esPasoPrograma = pasoActual === "programa";
  const esPasoApariencia = pasoActual === "apariencia";
  const esPasoCuenta = pasoActual === "cuenta";
  const esPasoRevisar = pasoActual === "revisar";
  function irAlSiguientePaso() {
    setPaso((p) => Math.min(pasos.length - 1, p + 1));
  }
  function irAlPasoAnterior() {
    setPaso((p) => Math.max(0, p - 1));
  }

  // Cada paso trae una altura distinta ("revisar" es mucho más largo
  // que "apariencia"), así que sin esto el navegador conserva el
  // scroll en el mismo PÍXEL de antes — y ese píxel cae en un punto
  // distinto del paso nuevo, dando la sensación de que "la pantalla se
  // scrolleó sola" al tocar Siguiente/Atrás. Se vuelve al principio del
  // indicador "Paso X de Y", que existe en todos los pasos.
  const inicioPasoRef = useRef<HTMLDivElement>(null);
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    inicioPasoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [paso]);

  const contrasteTexto = contraste(valor.colorFondo, "#ffffff");
  const contrasteSello = contraste(valor.colorSello, valor.colorFondo);

  // Solo se usa en "editar" (la línea "Hoy: ..." antes de las reglas),
  // pero calcularlo siempre es más simple que otro `useMemo` condicional.
  const resumenReglasActual = useMemo(() => resumenDeReglas(valor.reglas), [valor.reglas]);

  const filasPublico: (readonly [string, React.ReactNode])[] = useMemo(() => {
    const filas: (readonly [string, React.ReactNode])[] = [
      ["Negocio", nombre || "— falta"],
      ["Tipo", TIPOS_TARJETA[valor.tipo].nombre],
      [
        "Colores",
        <span key="c" className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded-full border border-bookea-linea"
            style={{ background: valor.colorFondo }}
          />
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded-full border border-bookea-linea"
            style={{ background: valor.colorSello }}
          />
        </span>,
      ],
      [
        "Imagen",
        valor.imagenModo === "ninguna"
          ? "Sin imagen (va tu nombre)"
          : valor.imagenModo === "stock"
            ? "De la galería"
            : valor.logoUrl
              ? "Subida"
              : "Vista previa (falta subirla)",
      ],
    ];
    if (valor.tipo === "sellos" && valor.iconoSello) {
      filas.push([
        "Ícono del sello",
        esIconoSello(valor.iconoSello) ? ICONOS_SELLO[valor.iconoSello].nombre : "Tu ícono",
      ]);
    }
    if (valor.franjaModo !== "ninguna") {
      filas.push([
        "Franja",
        valor.franjaModo === "banco"
          ? "De la galería"
          : valor.bannerUrl
            ? "Subida"
            : "Vista previa (falta subirla)",
      ]);
    }
    return filas;
  }, [
    nombre,
    valor.tipo,
    valor.colorFondo,
    valor.colorSello,
    valor.imagenModo,
    valor.logoUrl,
    valor.iconoSello,
    valor.franjaModo,
    valor.bannerUrl,
  ]);

  const filasCrear: (readonly [string, React.ReactNode])[] = useMemo(() => {
    const r = resumenDeReglas(valor.reglas);
    return [
      ["Nombre", nombre || "— falta"],
      ["Tipo", TIPOS_TARJETA[valor.tipo].nombre],
      ["Beneficio", resumenDelBeneficio(valor.beneficio)],
      ["Vigencia", r.vigencia],
      ["Cuándo vale", r.cuando],
      ["Canjes", r.canjes],
    ];
  }, [nombre, valor.tipo, valor.beneficio, valor.reglas]);

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="min-w-0">
          {esPublico && alVolver && (
            <button
              type="button"
              onClick={alVolver}
              className="presionable mb-5 text-[12px] font-bold text-bookea-gris hover:text-bookea-tinta"
            >
              ← Volver a los paquetes
            </button>
          )}

          {esEditar && bloqueada && motivoBloqueada && (
            <p
              role="status"
              className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[13px] font-bold leading-relaxed text-amber-900"
            >
              {motivoBloqueada}
            </p>
          )}
          {esEditar && (
            <div className="mb-4 space-y-2">
              <AvisoError />
              <AvisoGuardado />
            </div>
          )}

          <div ref={inicioPasoRef} className="mb-5 flex scroll-mt-20 items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-bookea-gris">
              Paso {paso + 1} de {pasos.length}
            </span>
            <div className="flex items-center gap-1.5" role="presentation">
              {pasos.map((p, i) => (
                <span
                  key={p}
                  aria-hidden
                  className={`h-1.5 rounded-full transition-all ${
                    i === paso ? "w-5 bg-bookea-azul" : "w-1.5 bg-bookea-linea"
                  }`}
                />
              ))}
            </div>
          </div>

          {esPasoNegocio && (
          <Seccion numero={paso + 1} titulo="Tu negocio" bajada="Cómo se llama y qué tipo de tarjeta es." primera>
            <div className="space-y-4">
              <label className="block">
                <span className={etiqueta}>
                  {esPublico ? "Nombre del negocio" : "Nombre de la tarjeta"}
                  <Obligatorio />
                </span>
                <input
                  required
                  autoFocus={esPublico}
                  value={valor.nombre}
                  onChange={(e) => patch({ nombre: e.target.value.slice(0, 80) })}
                  disabled={esEditar && bloqueada}
                  maxLength={80}
                  placeholder={
                    esPublico ? "Café Aroma" : esCrear ? `${TIPOS_TARJETA[valor.tipo].nombre} de ${negocioNombre}` : undefined
                  }
                  className={campo}
                />
                {esEditar && (
                  <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                    Es el nombre con el que la ves vos en el panel. En el pase, el cliente lee el nombre del negocio.
                  </p>
                )}
              </label>

              <div>
                <span className={etiqueta}>Tipo de tarjeta</span>
                {esPublico ? (
                  <SelectorTipoExplorable valor={valor.tipo} alElegir={elegirTipo} />
                ) : tipoLocked ? (
                  <TipoCerrado tipo={valor.tipo} motivo={candado?.motivo ?? null} />
                ) : (
                  <>
                    <SelectorTipo valor={valor.tipo} alElegir={elegirTipo} plan={plan} />
                    {esEditar && (
                      <p className="mt-2 text-[11.5px] leading-relaxed text-bookea-gris">
                        Todavía no hay nadie adentro, así que el tipo se puede cambiar. Apenas se afilie el primer
                        cliente queda fijo — su saldo pasaría a significar otra cosa.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Seccion>
          )}

          {esPasoPrograma && (
          <Seccion numero={paso + 1} titulo="Programa" bajada="Qué se gana y cómo." primera>
            <div className="space-y-4">
              <PasoBeneficio
                config={valor.beneficio}
                alCambiar={(c) => patch({ beneficio: c })}
                {...(!esPublico
                  ? { vencenMeses: valor.vencenMeses, alCambiarVencimiento: (v: number | null) => patch({ vencenMeses: v }) }
                  : {})}
              />
              {motivoBeneficio && (
                <p
                  role="status"
                  className="rounded-xl bg-bookea-azul-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-azul"
                >
                  {motivoBeneficio}
                </p>
              )}
              {esEditar && aviso && (
                <p
                  role="status"
                  className="rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] font-bold leading-relaxed text-amber-800"
                >
                  {aviso}
                </p>
              )}

              {!esPublico && (
                <div className="border-t border-bookea-linea pt-4">
                  <span className={etiqueta}>Cuándo vale</span>
                  {esEditar && (
                    <p className="mb-3 mt-1.5 text-[12.5px] leading-relaxed text-bookea-gris">
                      Hoy: <strong>{resumenReglasActual.vigencia}</strong> · {resumenReglasActual.cuando} ·{" "}
                      {resumenReglasActual.canjes}.
                    </p>
                  )}
                  <div className="mt-1.5">
                    <PasoReglas reglas={valor.reglas} alCambiar={(r) => patch({ reglas: r })} />
                  </div>
                </div>
              )}
            </div>
          </Seccion>
          )}

          {esPasoApariencia && (
          <Seccion numero={paso + 1} titulo="Apariencia" bajada="Cómo se ve en el teléfono de tu cliente." primera>
            <div className="space-y-6">
              <div>
                <span className={etiqueta}>Color de la tarjeta</span>
                <PlantillasColor
                  colorFondo={valor.colorFondo}
                  colorSello={valor.colorSello}
                  alElegir={(c) => patch({ colorFondo: c.fondo, colorSello: c.sello })}
                />
                {esPublico ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setVerMasColores((v) => !v)}
                      className="presionable mt-2 text-[11.5px] font-bold text-bookea-azul underline"
                    >
                      {verMasColores ? "Ocultar colores personalizados" : "Ver más colores"}
                    </button>
                    {(verMasColores || paletaDeLosColores(valor.colorFondo, valor.colorSello) === null) && (
                      <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                        <CampoColor
                          id="tf-fondo"
                          etiqueta="Color de fondo"
                          valor={valor.colorFondo}
                          alCambiar={(v) => patch({ colorFondo: v })}
                        />
                        <CampoColor
                          id="tf-sello"
                          etiqueta="Color del acento"
                          valor={valor.colorSello}
                          alCambiar={(v) => patch({ colorSello: v })}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                    <CampoColor
                      id="tf-fondo"
                      etiqueta="Color de fondo"
                      valor={valor.colorFondo}
                      alCambiar={(v) => patch({ colorFondo: v })}
                    />
                    <CampoColor
                      id="tf-sello"
                      etiqueta={valor.tipo === "sellos" ? "Color del sello" : "Color del acento"}
                      valor={valor.colorSello}
                      alCambiar={(v) => patch({ colorSello: v })}
                    />
                  </div>
                )}
                {esEditar && contrasteTexto < CONTRASTE_TEXTO && (
                  <p
                    role="status"
                    className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-amber-800"
                  >
                    Con ese fondo tan claro el texto de la tarjeta —que siempre es blanco— casi no se lee. Probá un
                    tono más oscuro o elegí uno de los temas de arriba.
                  </p>
                )}
                {esEditar && contrasteSello < CONTRASTE_SELLO && (
                  <p
                    role="status"
                    className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-amber-800"
                  >
                    {valor.tipo === "sellos"
                      ? "El color del sello se confunde con el fondo: los sellos van a verse todos iguales, ganados y por ganar."
                      : "El acento se confunde con el fondo y no se va a notar."}
                  </p>
                )}
              </div>

              {valor.tipo === "sellos" && (
                <div>
                  <span className={etiqueta}>Icono del sello</span>
                  {/* «Mi ícono» (la subida propia) se ofrece también en el
                      flujo público EN CUANTO HAY SESIÓN — antes el público
                      no lo pasaba nunca y la opción de subir el archivo
                      simplemente no existía, que es lo que el dueño
                      reportó como «no deja cargar la imagen». Sin sesión
                      sigue sin ofrecerse (no hay bucket al que subir) y la
                      nota de abajo explica dónde se habilita. */}
                  <SelectorIconoSello
                    valor={valor.iconoSello}
                    alElegir={(i) => patch({ iconoSello: i })}
                    colorFondo={valor.colorFondo}
                    colorSello={valor.colorSello}
                    {...(!esPublico || haySesion
                      ? { iconoUrl: valor.iconoUrl || null, alSubirIcono: (url: string) => patch({ iconoUrl: url }) }
                      : {})}
                  />
                  {esCrear && (
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                      Se llena cuando el cliente gana el sello y queda en contorno el que le falta. Con «Mi ícono»
                      va el símbolo que subas, y con «Mi logo» va tu logo adentro del círculo.
                    </p>
                  )}
                  {esPublico && !haySesion && (
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                      ¿Querés subir tu propio ícono? Se habilita en cuanto creés tu cuenta, en la
                      sección «Tu cuenta» de abajo.
                    </p>
                  )}
                </div>
              )}

              {esPublico ? (
                <>
                  <div>
                    <span className={etiqueta}>Franja (la imagen de arriba del pase)</span>
                    <SelectorFranja
                      valor={valor.franjaModo === "banco" ? valor.franjaBancoId : null}
                      alElegir={elegirFranjaBanco}
                    />
                    <div className="mt-3">
                      <SubidaPropia
                        etiqueta="Tu franja"
                        subiendo={subiendoFranja}
                        error={errorFranja}
                        activa={valor.franjaModo === "propia"}
                        vista={valor.bannerUrl || previewLocalFranja}
                        subida={!!valor.bannerUrl}
                        onArchivo={(a) => void elegirArchivoPropio(a, "franja")}
                        onQuitar={quitarFranjaPropia}
                      />
                      {!haySesion && previewLocalFranja && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-bookea-gris">
                          Esto es solo una vista previa: se sube de verdad en cuanto tengas tu cuenta, en la sección
                          «Tu cuenta».
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className={etiqueta}>Imagen del negocio</span>
                    <SelectorImagenNegocio
                      valor={valor.imagenModo === "stock" ? valor.imagenStockId : null}
                      alElegir={elegirImagenBanco}
                      colorFondo={valor.colorFondo}
                    />
                    <div className="mt-3">
                      <SubidaPropia
                        etiqueta="Tu logo"
                        subiendo={subiendoLogo}
                        error={errorLogo}
                        activa={valor.imagenModo === "propia"}
                        vista={valor.logoUrl || previewLocalLogo}
                        subida={!!valor.logoUrl}
                        onArchivo={(a) => void elegirArchivoPropio(a, "logo")}
                        onQuitar={quitarImagenPropia}
                      />
                      {!haySesion && previewLocalLogo && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-bookea-gris">
                          Esto es solo una vista previa: se sube de verdad en cuanto tengas tu cuenta, en la sección
                          «Tu cuenta».
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <SubirImagen
                      etiqueta="Logo del negocio"
                      valor={valor.logoUrl}
                      alCambiar={(url) => patch({ logoUrl: url })}
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
                      valor={valor.bannerUrl}
                      alCambiar={(url) => patch({ bannerUrl: url })}
                      destino="banner"
                      carpeta="lealtad/bandas"
                    />
                    <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                      {esEditar
                        ? "La franja de arriba del pase."
                        : "La franja de arriba del pase. Una foto de tu local o de lo que vendés."}
                    </p>
                  </div>
                </div>
              )}

              {!esPublico && (
                <div className="border-t border-bookea-linea pt-4">
                  <SubirImagen
                    etiqueta="Logo para notificaciones"
                    valor={valor.notificacionLogoUrl}
                    alCambiar={(url) => patch({ notificacionLogoUrl: url })}
                    destino="logo"
                    carpeta="lealtad/notificaciones"
                  />
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                    No va en la tarjeta — es la imagen que muestra el aviso del teléfono cuando el
                    pase se actualiza.
                  </p>
                </div>
              )}

              {esEditar && emitidos > 0 && (
                <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] font-bold leading-relaxed text-amber-800">
                  Ya hay {emitidos} {emitidos === 1 ? "tarjeta" : "tarjetas"} en teléfonos de clientes. Al guardar,{" "}
                  {emitidos === 1 ? "esa tarjeta cambia" : "esas tarjetas cambian"} de aspecto la próxima vez que el
                  teléfono las actualice.
                </p>
              )}
            </div>
          </Seccion>
          )}

          {esPasoCuenta && (
            <Seccion numero={paso + 1} titulo="Tu cuenta" bajada="Un correo y un código — sin contraseñas." primera>
              <div className="-mx-1">
                <FormularioAuth
                  destino={ANCLA}
                  titulo="Ya casi — creá tu cuenta"
                  intro="Con eso queda a tu nombre. Escribí tu correo: si ya tenés cuenta entrás directo, y si es tu primera vez, con tu nombre alcanza. Tu tarjeta queda tal como la armaste."
                />
              </div>
            </Seccion>
          )}

          {/* ── Navegación del wizard: Atrás + Siguiente, mientras falte
              paso. En el ÚLTIMO paso esta fila no se dibuja — ahí
              "Atrás" vive pegado al botón de guardar/publicar de abajo,
              no flotando solo arriba de él con una línea de por medio. */}
          {paso < pasos.length - 1 && (
            <div className="mt-7 flex items-center justify-between gap-3 border-t border-bookea-linea pt-7">
              <button
                type="button"
                onClick={irAlPasoAnterior}
                disabled={paso === 0}
                className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-tinta disabled:opacity-0"
              >
                ← Atrás
              </button>
              <button
                type="button"
                onClick={irAlSiguientePaso}
                className="presionable rounded-xl bg-bookea-tinta px-5 py-2.5 text-[13px] font-extrabold text-white"
              >
                Siguiente →
              </button>
            </div>
          )}

          {esEditar ? (
            esPasoApariencia && (
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-bookea-linea pt-7">
              <button
                type="button"
                onClick={irAlPasoAnterior}
                className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-tinta"
              >
                ← Atrás
              </button>
              <button
                type="button"
                onClick={onGuardar}
                disabled={!puedeGuardar}
                className="presionable rounded-xl bg-bookea-tinta px-5 py-3 text-[13px] font-extrabold text-white disabled:opacity-40"
              >
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
            )
          ) : (
            esPasoRevisar && (
            <Seccion numero={paso + 1} titulo="Revisar y crear" bajada="Una última mirada antes de publicar." primera>
              <div className="space-y-4">
                <div className="rounded-2xl border border-bookea-linea bg-white p-4">
                  <dl className="divide-y divide-bookea-linea">
                    {(esPublico ? filasPublico : filasCrear).map(([k, v]) => (
                      <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-bookea-gris">{k}</dt>
                        <dd className="text-[13px] font-bold text-bookea-tinta">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {esPublico && <CampoTelefono valor={valor.telefono} alCambiar={(t) => patch({ telefono: t })} />}

                {requierePago && planACobrar && (
                  <div>
                    <button
                      type="button"
                      onClick={irAlPlanPago}
                      disabled={guardando}
                      className="presionable w-full rounded-full px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-40 sm:w-auto"
                      style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                    >
                      ¡Pagar y activar tarjeta! →
                    </button>
                    {/* La salida de emergencia SOLO cuando el pago viene
                        del paquete elegido y no del tipo: un clic curioso
                        en «Impulso» no puede dejar a nadie obligado a
                        pagar por una tarjeta que el paquete gratis ya
                        cubre. Si el TIPO exige plan pago, no hay
                        atajo — eso sería regalar el paquete. */}
                    {planPagoElegido && esGratis && (
                      <button
                        type="button"
                        onClick={() => patch({ planElegido: "prueba" })}
                        disabled={guardando}
                        className="mt-2.5 block text-[11.5px] font-bold text-bookea-gris underline disabled:opacity-60"
                      >
                        Prefiero empezar con el paquete gratis y crear mi tarjeta ya
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-700">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={irAlPasoAnterior}
                    className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-tinta"
                  >
                    ← Atrás
                  </button>
                  {(!esPublico || !requierePago) && (
                    <button
                      type="button"
                      onClick={onGuardar}
                      disabled={!puedeGuardar}
                      className="presionable rounded-full px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-40"
                      style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                    >
                      {esPublico
                        ? guardando
                          ? "Creando…"
                          : "Crear mi tarjeta YA →"
                        : guardando
                          ? "Publicando…"
                          : "Publicar tarjeta"}
                    </button>
                  )}
                </div>
              </div>
            </Seccion>
            )
          )}

        </div>

        {/* ── Vista previa: pegada en escritorio ─────────────────── */}
        <aside className="mt-5 hidden lg:mt-0 lg:block">
          <div className="sticky top-24">
            <VistaPase datos={datosVista} superficie="clara" marco="telefono" />
          </div>
        </aside>
      </div>

      {ranchoId && (
        <div className="mt-7 border-t border-bookea-linea pt-7">
          <AyudaDeDiseno
            ranchoId={ranchoId}
            programaId={programaId}
            hiloInicial={ayudaInicial}
            tipo={valor.tipo}
            colorFondo={valor.colorFondo}
            colorSello={valor.colorSello}
            iconoSello={valor.tipo === "sellos" ? valor.iconoSello : null}
            tieneLogo={valor.logoUrl.trim().length > 0}
            tieneBanda={valor.bannerUrl.trim().length > 0}
          />
        </div>
      )}

      {/* ── Móvil: la vista previa no cabe pegada, así que se abre desde un botón flotante. */}
      <button
        type="button"
        onClick={() => setVerPase(true)}
        className="presionable fixed bottom-4 right-4 z-40 rounded-full border border-bookea-linea bg-white px-4 py-2.5 text-[12.5px] font-bold text-bookea-tinta shadow-[0_10px_24px_-8px_rgba(4,10,26,0.35)] lg:hidden"
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
 * El tipo cuando NO se puede cambiar (candado de `src/lib/lealtad/editable.ts`).
 * Se pinta como un dato, no como un selector apagado.
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

/** Un slot de "subí tu propia imagen" — logo y franja del modo "publico". */
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
  activa: boolean;
  vista: string | null;
  subida: boolean;
  onArchivo: (archivo: File | undefined) => void;
  onQuitar: () => void;
}) {
  return (
    <div>
      <span className={etiqueta}>{rotulo}</span>
      {activa && vista ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-bookea-linea p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local o URL recién subida. */}
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
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && <p className="mt-1.5 text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

function resumenDelBeneficio(b: ConfigBeneficio): string {
  switch (b.tipo) {
    case "sellos":
      return `${b.requeridos} sellos → ${b.recompensa || "…"}`;
    case "puntos":
      return `${b.porVisita} por visita · ${b.porMoneda} por colón`;
    case "cupon":
    case "descuento":
      return b.beneficio.forma === "porcentaje"
        ? `${b.beneficio.valor}% de descuento`
        : b.beneficio.forma === "monto"
          ? `₡${b.beneficio.valor.toLocaleString("es-CR")} de descuento`
          : `${b.beneficio.que || "…"} gratis`;
    case "membresia":
      return `${b.nivel || "…"} · ${b.vigenciaMeses} meses`;
    case "giftcard":
      return `${b.moneda === "USD" ? "$" : "₡"}${b.valor.toLocaleString("es-CR")}`;
    case "evento":
      return `${b.fecha || "…"} ${b.hora} · ${b.ubicacion || "…"}`;
    case "cashback":
      return `${b.porcentaje}% de vuelta`;
  }
}
