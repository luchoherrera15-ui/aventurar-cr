"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorTipo from "@/components/lealtad/selector-tipo";
import SelectorTipoExplorable from "@/components/lealtad/selector-tipo-explorable";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import SelectorFranja from "@/components/lealtad/selector-franja";
import SelectorImagenNegocio from "@/components/lealtad/selector-imagen-negocio";
import PasoBeneficio from "@/components/lealtad/paso-beneficio";
import ControlesTira from "@/components/lealtad/controles-tira";
import { Apartado, PlacaPase, Portada } from "@/components/lealtad/ficha";
import { ROTULO } from "@/components/lealtad/ficha-tokens";
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
import type { SelloElegido } from "@/lib/lealtad/iconos-sello";
import {
  TIPOS_TARJETA,
  configPorDefecto,
  metaDe,
  validarBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { FONDO_CLASICO } from "@/lib/wallet/fondo-tira";
import type { ConfigTira } from "@/lib/wallet/layout-tira";
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
 *   · El botón final cambia de texto, no de lugar: "Crear mi tarjeta
 *     YA" (publico, gratis) / "¡Pagar y activar tarjeta!" (publico, con
 *     paquete pago) / "Publicar tarjeta" (crear) / "Guardar cambios"
 *     (editar).
 *
 * ------------------------------------------------------------------
 * UNA SOLA PANTALLA, SIN PASOS — pedido del dueño (ago 2026)
 * ------------------------------------------------------------------
 * Esto fue, en orden: cinco secciones apiladas en un scroll largo, y
 * después un asistente de cuatro pasos con "Siguiente"/"Atrás". Las dos
 * formas fallaban por lo mismo, desde lados opuestos: la primera pedía
 * bajar mucho para encontrar algo, y la segunda ESCONDÍA los controles
 * detrás de un paso — el dueño tocaba un color en el paso 3 y no podía
 * ver el nombre que había escrito en el paso 1 sin perder de vista lo
 * que estaba haciendo.
 *
 * Ahora es una pantalla: los bloques a la izquierda, el pase pegado a
 * la derecha, y una barra de guardar que sigue al scroll. Se ve todo,
 * se toca cualquier cosa en cualquier orden, y el resultado está
 * siempre a la vista. «Ordenado y fácil de usar» fue el pedido literal.
 *
 * ── LO QUE SE FUE CON LOS PASOS ─────────────────────────────────────
 * La sección «Revisar y crear» —una tabla con nombre, tipo, colores e
 * imágenes— ya no existe. Era el resumen de lo que no se podía ver
 * porque estaba en otro paso; con todo en pantalla y el pase al lado,
 * repetía en texto lo que el dibujo ya dice mejor. Lo único que vivía
 * ahí y SÍ hacía falta —el teléfono del alta pública— se mudó al bloque
 * final, junto al botón.
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
  /**
   * Dónde y de qué tamaño van los sellos dentro de la tira (0212).
   *
   * Solo se toca en tarjetas de sellos —en los otros siete tipos la
   * tira no dibuja círculos— pero el campo viaja siempre: cambiar de
   * tipo a «cupón» y volver a «sellos» no puede borrarle al dueño la
   * posición que había elegido.
   */
  diseno: ConfigTira;
  /** Vigencia/días/horas/topes. Solo crear/editar la muestran. */
  reglas: Reglas;
  vencenMeses: number | null;
  /** Solo público lo pide (para coordinar el alta). */
  telefono: string;
  /**
   * El código del moderador/agente que refirió el alta (0219).
   *
   * ⚠️ VIAJA EN ESTE TIPO Y NO SOLO EN `EstadoLealtad` POR UNA RAZÓN:
   * `irAlPlanPago` respalda EXACTAMENTE este objeto en sessionStorage
   * antes de mandar a /lealtad/nuevo. Cuando el campo no estaba acá,
   * ese respaldo pisaba el del configurador y el código escrito se
   * perdía en silencio — y es justo el camino pago, el único que le
   * paga comisión al moderador.
   *
   * Opcional porque solo el alta pública lo llena: el creador y el
   * editor del panel operan sobre un negocio que ya tiene (o no)
   * su agente asignado, y no vuelven a preguntarlo.
   */
  codigoReferido?: string;

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

/**
 * A DÓNDE VUELVE QUIEN SE LOGUEA A MITAD DE ARMAR SU TARJETA.
 *
 * ⚠️ Era `/lealtad#configurador-lealtad` y estaba ROTO desde que el
 * configurador se mudó de la landing a su propia pantalla: entrar con
 * el correo devolvía a /lealtad —la página de venta— en vez de al
 * creador, así que la persona terminaba de loguearse y se encontraba
 * fuera de lo que estaba haciendo, con la sensación de haber perdido
 * el trabajo. (No lo perdía: el borrador sigue en sessionStorage y
 * `configurador-lealtad.tsx` lo restaura con su vista; pero había que
 * volver a mano a /lealtad/crear para verlo.)
 *
 * Reportado por el dueño el 30 ago 2026: «cuando inicia lo saca de la
 * página; la idea sería CREAR TARJETA → panel de login → panel de
 * configurar la tarjeta».
 *
 * ⚠️ SIN ANCLA (`#configurador-lealtad`), y eso NO es un olvido.
 * `FormularioCodigoAcceso` navega con `window.location.href = destino`,
 * y el login ocurre DENTRO de /lealtad/crear: si el destino se
 * diferenciara de la URL actual solo en el hash, el navegador haría
 * scroll y NADA MÁS —sin recargar—, así que el servidor no volvería a
 * renderizar y `haySesion` seguiría en false: la persona entraría bien
 * y seguiría viendo el formulario de acceso, como si no hubiera pasado
 * nada. Sin hash es la misma URL exacta y el navegador sí recarga, que
 * es justo lo que este flujo necesita para enterarse de la sesión.
 */
const ANCLA = "/lealtad/crear";

/**
 * El rótulo de un campo.
 *
 * Era `text-[9.5px] uppercase tracking-wide text-bookea-gris` — el texto
 * más chico de todo el producto, repetido trece veces con el mismo peso
 * y el mismo color. Eso era lo que hacía que la pantalla se leyera como
 * un formulario viejo aunque se le movieran las cajas de lugar: no había
 * jerarquía, todo pesaba igual.
 *
 * Ahora sale de `ficha-tokens.ts`, y el escalón lo da la TINTA, no el
 * tamaño. Ver el comentario de ese módulo.
 */
const etiqueta = ROTULO;

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
      <div className="flex items-stretch gap-2">
        {/* El país va CHICO y a la izquierda: es un dato que se elige una
            vez y casi siempre queda en +506. El protagonista de la fila
            es el número. `w-[104px]` entra justo con la bandera, el
            prefijo de hasta cuatro dígitos y la flechita del select. */}
        <select
          aria-label="Extensión del país"
          value={pais.codigo}
          onChange={(e) => {
            const elegido =
              PAISES.find((p) => p.codigo === e.target.value) ?? COSTA_RICA;
            alCambiar(unir(elegido.prefijoTelefono, numero));
          }}
          className={`${CAMPO_BASE} w-[104px] shrink-0 cursor-pointer px-2.5`}
        >
          {PAISES.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.bandera} {p.prefijoTelefono}
            </option>
          ))}
        </select>
        {/* `min-w-0` sobre un hijo de flex NO es de adorno: por defecto
            un input tiene `min-width:auto`, o sea que se niega a
            achicarse por debajo de su ancho intrínseco y desborda la
            fila en pantallas angostas en vez de encogerse. */}
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
          className={`${CAMPO_BASE} min-w-0 flex-1`}
        />
      </div>
    </div>
  );
}
/**
 * El estilo de un campo, SIN el ancho.
 *
 * ⚠️ El ancho salió de acá y no es cosmético. `campo` empezaba con
 * `w-full`, y cuando dos campos comparten una fila —el selector de país
 * y el número de teléfono— ese `w-full` pelea con el ancho que se le
 * quiera dar: Tailwind emite las dos clases y gana la que vaya después
 * en la HOJA, no en el atributo. Resultado real: el selector se comía
 * la fila entera y la caja del número desaparecía de la pantalla.
 *
 * Ahora `campo` sigue trayendo su `w-full` para el 99 % de los casos, y
 * quien comparte fila usa `CAMPO_BASE` y decide el ancho él.
 *
 * ⚠️ Y SE LE CAYÓ EL `outline-none`, QUE ERA UN BUG DE VERDAD.
 *
 * El anillo de foco global vive en `globals.css` dentro de un
 * `:where(...)`, o sea con especificidad CERO: cualquier `outline-none`
 * lo apaga. Con esa clase puesta, NINGÚN campo de esta pantalla mostraba
 * el anillo al navegar con teclado — y ese mismo archivo escribe tres
 * líneas antes «⚠️ Y prohibido `outline-none` sin un reemplazo medido».
 * No había reemplazo. Ahora no está la clase.
 */
const CAMPO_BASE =
  "rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[15px] font-medium text-bookea-tinta transition-colors placeholder:font-normal placeholder:text-bookea-gris/70 hover:border-bookea-gris focus:border-bookea-azul";

// `campo` (el `CAMPO_BASE` con `w-full`) vivía acá y se quedó sin usos:
// el único input suelto de la pantalla era el nombre de la tarjeta, y
// ése se mudó a la portada con su propia tipografía de 38 px. Lo que
// queda usando `CAMPO_BASE` es el teléfono, que comparte fila con el
// selector de país y por eso decide su ancho él.

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

  // ── EL ALTA PÚBLICA ES UN ASISTENTE, UN PASO POR PANTALLA ─────────
  //
  // Pedido del dueño (31 ago 2026): «el cuadro blanco donde se hacen
  // las configuraciones será por slides tipo Siguiente, Siguiente, e ir
  // configurando paso por paso».
  //
  // Antes era una hoja larga con cuatro capítulos apilados y había que
  // scrollear para saber cuánto faltaba. Un paso por pantalla contesta
  // esa pregunta sola: se ve dónde estás, cuánto queda y qué sigue.
  //
  // Solo en modo público. El panel (crear/editar) mantiene la hoja
  // continua: ahí quien edita ya sabe lo que busca y saltar entre
  // capítulos con el scroll es más rápido que pasar pantallas.
  const [paso, setPaso] = useState(0);
  function irAPaso(p: number) {
    setPaso(p);
    // Al tope de la tarjeta: el paso nuevo arranca donde empieza, no
    // donde el dedo dejó el scroll del paso anterior.
    document.getElementById("hoja-tarjeta")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
  // El logo del aviso (0208) no tiene vista previa local: no se dibuja
  // en la tarjeta, así que no habría nada que previsualizar. Solo sube.
  const [subiendoAviso, setSubiendoAviso] = useState(false);
  const [errorAviso, setErrorAviso] = useState<string | null>(null);

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
  /**
   * `slot` es "logo" (la imagen del negocio), "franja" (la banda de
   * arriba) o "aviso" (el logo de las notificaciones, 0208).
   *
   * ⚠️ "aviso" EXIGE SESIÓN, y es el único de los tres. Los otros dos
   * tienen un camino sin sesión —se leen como data URI y se muestran
   * como vista previa hasta que la persona cree su cuenta— porque son
   * lo que hace que la tarjeta se vea suya mientras la está armando.
   * El del aviso no se ve en la tarjeta, así que una vista previa local
   * no mostraría nada: sin sesión no se ofrece y punto.
   */
  async function elegirArchivoPropio(
    archivo: File | undefined,
    slot: "logo" | "franja" | "aviso",
  ) {
    if (!archivo) return;
    const avisarError =
      slot === "logo" ? setErrorLogo : slot === "franja" ? setErrorFranja : setErrorAviso;
    const ponerPreview = slot === "logo" ? setPreviewLocalLogo : setPreviewLocalFranja;
    const ponerSubiendo =
      slot === "logo" ? setSubiendoLogo : slot === "franja" ? setSubiendoFranja : setSubiendoAviso;

    avisarError(null);
    if (!archivo.type.startsWith("image/")) {
      avisarError("Eso no es una imagen.");
      return;
    }

    if (!haySesion) {
      // El del aviso no se ofrece sin sesión (ver arriba); si llegara
      // igual, no se hace nada en vez de fingir una vista previa.
      if (slot === "aviso") return;
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
    // El del aviso sube por el mismo camino que el logo: es una imagen
    // cuadrada de marca y va al mismo bucket del alta.
    const url = await subirImagenAlAlta(archivo, slot === "franja" ? "banda" : "logo");
    ponerSubiendo(false);
    if (!url) {
      avisarError("No pudimos subir la imagen. Intentá de nuevo.");
      return;
    }
    if (slot === "aviso") {
      patch({ notificacionLogoUrl: url });
      return;
    }
    ponerPreview(null);
    if (slot === "logo") patch({ imagenModo: "propia", imagenStockId: null, logoUrl: url });
    else patch({ franjaModo: "propia", franjaBancoId: null, bannerUrl: url });
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
    // La geometría de la tira (0212). La vista previa la resuelve con la
    // MISMA función que el PNG del pase, así que lo que se ve acá es lo
    // que va a recibir el cliente.
    diseno: valor.diseno,
  };

  /**
   * Los bloques se numeran corridos, y «Tu cuenta» solo existe en el
   * alta pública sin sesión. Sin este corrimiento la pantalla del panel
   * arrancaría en «2», o la pública tendría dos «1».
   */

  const contrasteTexto = contraste(valor.colorFondo, "#ffffff");
  const contrasteSello = contraste(valor.colorSello, valor.colorFondo);

  // Solo se usa en "editar" (la línea "Hoy: ..." antes de las reglas),
  // pero calcularlo siempre es más simple que otro `useMemo` condicional.
  const resumenReglasActual = useMemo(() => resumenDeReglas(valor.reglas), [valor.reglas]);

  /**
   * Cuántos sellos promete la tarjeta HOY.
   *
   * Sale del beneficio, que es de donde lo saca el pase real: las
   * miniaturas de «Dónde van los sellos» dibujan ESTA tarjeta y no una
   * genérica de diez.
   */
  const metaSellos = metaDe(valor.beneficio) ?? 0;
  /**
   * El bloque de geometría solo aparece cuando hay círculos que
   * acomodar. En los otros siete tipos la tira es la foto sola —o nada—
   * y estos controles no moverían un píxel: ofrecerlos sería un menú
   * que no hace nada.
   */
  const hayTira = valor.tipo === "sellos" && metaSellos > 0;

  // ⚠️ ACÁ Y NO ARRIBA CON EL RESTO DEL ESTADO: depende de `hayTira`, y
  // ponerlo antes reventaba con «Cannot access hayTira before
  // initialization» — la pantalla entera quedaba en blanco.
  //
  // «La franja» solo es un paso cuando el tipo dibuja una tira de sellos,
  // así que el total se calcula y no se escribe a mano: un asistente que
  // dice «paso 3 de 4» y termina en el 3 se siente roto.
  // ⚠️ «Tu cuenta» ES UN PASO MÁS, no un bloque encima de todo.
  //
  // Estaba arriba de la hoja y medía 1.687 px él solo —más que el
  // resto de la pantalla junta—, así que el asistente nacía con
  // 990 px de scroll antes de tocar nada. Como paso, se ve uno por
  // vez y el pedido de «que todo quede en la pantalla» se cumple sin
  // recortarle nada al formulario de acceso.
  //
  // Solo existe sin sesión: quien ya entró no tiene que pasar por una
  // pantalla que le pide lo que ya dio.
  const pasosVisibles = PASOS_PUBLICOS.filter(
    (x) =>
      (x.clave !== "franja" || hayTira) &&
      (x.clave !== "cuenta" || (esPublico && !haySesion)),
  );
  const totalPasos = pasosVisibles.length;
  /** ¿El paso que se está viendo es este? Por CLAVE y no por índice:
   *  con la cuenta entrando y saliendo, los índices se corren. */
  const enPaso = (clave: string) =>
    !esPublico || pasosVisibles[paso]?.clave === clave;

  /**
   * LA CUENTA ES OBLIGATORIA PARA SEGUIR (dueño, 31 ago 2026):
   * «el paso de registrarse debe ser obligatorio para poder crear una
   * tarjeta digital».
   *
   * Antes se podía pasar de largo y armar la tarjeta entera sin cuenta;
   * recién al final aparecía el pedido de entrar, con todo el trabajo ya
   * hecho y la sensación de peaje. Trabar el «Siguiente» ACÁ es más
   * honesto: se pide una vez, al principio, y después no molesta más.
   *
   * No hace falta candado en los demás pasos: sin sesión, la cuenta es
   * el paso 1 y no hay forma de llegar al 2 sin pasar por este botón.
   */
  const trabadoPorCuenta = esPublico && !haySesion && enPaso("cuenta");

  /**
   * Los datos que la portada muestra bajo el nombre, en una línea.
   *
   * Son los que contestan «¿qué es esta tarjeta?» de un vistazo, y los
   * tres salen de valores que ya se calculan más arriba — no se
   * inventan ni se vuelven a derivar.
   */
  const metadatosDeLaPortada: string[] = [
    TIPOS_TARJETA[valor.tipo].nombre,
    ...(metaSellos > 0 ? [`Meta de ${metaSellos} sellos`] : []),
    ...(esEditar && emitidos > 0
      ? [`${emitidos} ${emitidos === 1 ? "tarjeta emitida" : "tarjetas emitidas"}`]
      : []),
  ];

  /**
   * Los cuatro datos al pie de la placa del pase.
   *
   * El contraste va con su número y no con un semáforo: «4,8:1» es
   * comprobable y «bien» no. Los avisos ámbar que ya existen se siguen
   * encargando de gritar cuando está mal.
   */
  const derivadosDelPase: { rotulo: string; valor: string }[] = [
    { rotulo: "Tipo", valor: TIPOS_TARJETA[valor.tipo].nombre },
    ...(metaSellos > 0 ? [{ rotulo: "Meta", valor: `${metaSellos} sellos` }] : []),
    ...(hayTira
      ? [
          {
            rotulo: "Filas",
            valor: valor.diseno.filas === "auto" ? "Automático" : String(valor.diseno.filas),
          },
        ]
      : []),
    { rotulo: "Contraste", valor: `${contrasteTexto.toFixed(1)}:1` },
  ];


  // ── El botón de cerrar, que es UNO para los tres modos ──────────────
  const textoGuardar = guardando
    ? esPublico
      ? "Creando…"
      : esCrear
        ? "Publicando…"
        : "Guardando…"
    : esPublico
      ? "Crear mi tarjeta YA →"
      : esCrear
        ? "Publicar tarjeta"
        : "Guardar cambios";

  /* ══════════════════════════════════════════════════════════════
     LA CUENTA VA SOLA, EN UN CUADRO (dueño, 31 ago 2026)
     ══════════════════════════════════════════════════════════════

     «Lo de la cuenta es lo que debería salir de primero, pero en un
     solo cuadro; y luego darle siguiente y que ya aparezca el mockup
     y los pasos».

     EL PASE VA AL LADO (dueño, 31 ago 2026): «que salga el login, o
     sea el box, y a la derecha el mockup del teléfono, y que diga
     que para configurarlo debés registrarte».

     Acá esto estuvo un rato sin el pase, con este argumento: el
     teléfono mostraba una tarjeta que no era de nadie al lado de un
     formulario que solo pide un correo, o sea dos tareas en pantalla
     y la más grande es la que todavía no se puede hacer.

     Pesa más el otro lado: pedir una cuenta sin enseñar qué se
     recibe a cambio es exactamente el peaje que este paso tiene que
     NO parecer. El pase de al lado es la respuesta a «¿y esto para
     qué?», y por eso va SIN la ficha técnica al pie (meta, filas,
     tamaño, contraste): son decisiones que todavía no se tomaron, y
     mostrar los valores por defecto como si fueran elegidos es lo
     que hacía que se leyera como relleno.

     Con la cuenta resuelta el formulario desaparece del asistente
     (`pasosVisibles` lo saca cuando hay sesión) y el paso 1 pasa a
     ser la tarjeta — o sea que este cuadro se ve UNA vez, al
     principio, y nunca más.

     El return es temprano a propósito: esconder el asistente con
     `hidden` lo dejaría montado y la pantalla seguiría midiendo lo
     que mide el asistente completo. ═════════════════════════════ */
  if (trabadoPorCuenta) {
    return (
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0">
        {alVolver && (
          <button
            type="button"
            onClick={alVolver}
            className="presionable mb-4 text-[12px] font-bold text-bookea-gris hover:text-bookea-tinta"
          >
            ← Volver a los paquetes
          </button>
        )}

        <div className="rounded-3xl border border-bookea-linea bg-white p-6 shadow-elevado sm:p-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--accion)]">
            Paso previo
          </p>
          <h2 className="titulo mt-1.5 text-[22px] leading-tight text-bookea-tinta">
            Registrate para configurar tu tarjeta
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-bookea-gris">
            Es lo único que hace falta antes de empezar. Apenas entrés armás el pase paso
            por paso y lo vas viendo acá al lado, como le va a llegar a tu cliente.
          </p>

          <ul className="mt-4 space-y-1.5">
            {[
              "Tu correo — te llega un código, no hay contraseñas que recordar.",
              "Tu nombre, para que la tarjeta quede a tu nombre.",
              "Un teléfono, para poder avisarte si algo pasa con tu programa.",
            ].map((linea) => (
              <li
                key={linea}
                className="flex items-start gap-2.5 text-[12.5px] leading-snug text-bookea-tinta"
              >
                <span
                  aria-hidden
                  className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--accion)" }}
                >
                  ✓
                </span>
                {linea}
              </li>
            ))}
          </ul>

          {/* Sin `titulo` ni `intro`: el cuadro ya se llama «Tu cuenta»
              y los tres puntos de arriba dijeron qué se pide. Repetirlo
              adentro empujaba el campo del correo —lo único que hay que
              tocar— fuera de la pantalla. */}
          <div className="mt-4 border-t border-bookea-linea pt-4">
            <FormularioAuth destino={ANCLA} titulo={null} intro={null} />
          </div>
        </div>
        </div>

        {/* En teléfono va DEBAJO del formulario, no arriba: acá lo que
            hay que hacer es escribir un correo, y un mockup de 600 px
            por delante sería la tercera vez que se empuja el campo
            fuera de la primera pantalla. */}
        <aside className="mt-6 lg:mt-0">
          <div className="lg:sticky lg:top-24">
            <PlacaPase datos={datosVista} derivados={[]} />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
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

          {/* ── Los bloques, en el orden en que se piensa una tarjeta ──
              Todos abiertos y todos a la vez: se puede empezar por los
              colores y volver al nombre después. El número al costado
              ordena la lectura sin encerrar a nadie en un paso. */}
          <div>
            {/* «Tu cuenta» ya no vive acá: desde el 31 ago 2026 tiene
                su propia pantalla, sola y sin el mockup al lado (ver el
                return temprano de `trabadoPorCuenta` más arriba).
                Cuando este JSX corre, o hay sesión o el paso ya pasó. */}

            {/* ── La hoja ─────────────────────────────────────────────
                UNA superficie continua, no cinco cajas apiladas. Los
                capítulos se separan con una línea fina y aire; el número
                cuelga en el margen.

                ⚠️ SIN `overflow-hidden`, aunque el radio lo pida. Esa
                clase mata el `sticky bottom-0` de la barra de guardar —
                un contenedor que recorta deja de ser el ancestro contra
                el que se pega— y además cortaría los números colgantes
                del `lg:-ml-9`. El radio de abajo lo pinta la barra con
                su propio `rounded-b-3xl`. */}
            <div
              id="hoja-tarjeta"
              className="scroll-mt-24 rounded-3xl border border-bookea-linea bg-white shadow-elevado"
            >
              <Portada
                rotulo={esPublico ? "Nombre de tu negocio" : undefined}
                valor={valor.nombre}
                alCambiar={(v) => patch({ nombre: v })}
                bloqueada={esEditar && bloqueada}
                acento={valor.colorSello}
                placeholder={
                  esPublico
                    ? "Café Aroma"
                    : esCrear
                      ? `${TIPOS_TARJETA[valor.tipo].nombre} de ${negocioNombre}`
                      : "Tu tarjeta"
                }
                metadatos={metadatosDeLaPortada}
                nota={
                  esEditar ? (
                    <>
                      Es el nombre con el que la ves vos en el panel. En el pase, el cliente lee
                      el nombre del negocio.
                    </>
                  ) : undefined
                }
              />

              {/* ── LA HOJA EN DOS PARTES (30 ago 2026) ──────────────
                  En el alta pública los capítulos van de dos en dos:
                  parte 1 = identidad y premio; parte 2 = apariencia y
                  franja. Se usa el patrón `pasos`/`paso` de globals.css
                  (todas las partes apiladas en una celda de grid, sin
                  salto de altura al cambiar). En el panel el wrapper
                  existe igual pero sin clase y sin `hidden`: la hoja
                  sigue siendo UNA superficie continua y el JSX de los
                  capítulos vive una sola vez. */}
              <div className={esPublico ? "pasos" : undefined}>
                <div
                  className={esPublico ? "paso" : undefined}
                  data-estado={enPaso("identidad") ? "activo" : "saliendo"}
                  hidden={!enPaso("identidad")}
                >
              {/* ── 1 · Identidad ─────────────────────────────────────
                  El nombre se mudó a la portada: acá queda lo que de
                  verdad decide cómo funciona la tarjeta. */}
              <Apartado
                numero={1}
                capitulo="Identidad"
                titulo="Qué tipo de tarjeta es"
                nota="El tipo decide cómo suma el cliente y qué se lleva. Es lo único que queda fijo en cuanto se afilie el primero."
              >
                <div>
                  {esPublico ? (
                    <SelectorTipoExplorable valor={valor.tipo} alElegir={elegirTipo} />
                  ) : tipoLocked ? (
                    <TipoCerrado tipo={valor.tipo} motivo={candado?.motivo ?? null} />
                  ) : (
                    <>
                      <SelectorTipo valor={valor.tipo} alElegir={elegirTipo} plan={plan} />
                      {esEditar && (
                        <p className="mt-2 text-[11.5px] leading-relaxed text-bookea-gris">
                          Todavía no hay nadie adentro, así que el tipo se puede cambiar. Apenas
                          se afilie el primer cliente queda fijo — su saldo pasaría a significar
                          otra cosa.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </Apartado>

                </div>

                {/* ── Paso 2: el premio ────────────────────────────── */}
                <div
                  className={esPublico ? "paso" : undefined}
                  data-estado={enPaso("premio") ? "activo" : "saliendo"}
                  hidden={!enPaso("premio")}
                >

              {/* ── 2 · El premio ──────────────────────────────────── */}
              <Apartado
                numero={2}
                capitulo="El premio"
                titulo="Qué se gana"
                nota="Lo que el cliente se lleva, y cuánto le cuesta llegar. Es la promesa que va escrita en el pase."
              >
              <div className="space-y-4">
                <PasoBeneficio
                  config={valor.beneficio}
                  alCambiar={(c) => patch({ beneficio: c })}
                  {...(!esPublico
                    ? {
                        vencenMeses: valor.vencenMeses,
                        alCambiarVencimiento: (v: number | null) => patch({ vencenMeses: v }),
                      }
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
                        Hoy: <strong>{resumenReglasActual.vigencia}</strong> ·{" "}
                        {resumenReglasActual.cuando} · {resumenReglasActual.canjes}.
                      </p>
                    )}
                    <div className="mt-1.5">
                      <PasoReglas reglas={valor.reglas} alCambiar={(r) => patch({ reglas: r })} />
                    </div>
                  </div>
                )}
              </div>
              </Apartado>
                </div>

                {/* ── Paso 3: cómo se ve ──────────────────────────── */}
                <div
                  className={esPublico ? "paso" : undefined}
                  data-estado={enPaso("apariencia") ? "activo" : "saliendo"}
                  hidden={!enPaso("apariencia")}
                >

              {/* ── 3 · Apariencia ─────────────────────────────────── */}
              <Apartado
                numero={3}
                capitulo="Apariencia"
                titulo="Cómo se ve"
                nota="El color es lo que se ve primero. Elegí un estilo terminado y después afiná lo que quieras."
              >
              <div className="space-y-6">
                {/* ════════════════════════════════════════════════════
                    ACÁ VIVÍA LA GALERÍA DE ESTILOS CON DEGRADADO, Y SE
                    FUE — con un bug adentro que la hundía.
                    ════════════════════════════════════════════════════

                    Ocho tarjetas terminadas que repintaban el pase de un
                    toque. La idea era buena y el motor funciona: los
                    degradados se renderizaron, se miraron y no tenían
                    costura contra el color plano de abajo.

                    Lo que estaba roto era el CRUCE con los colores a
                    mano. Elegir un estilo guardaba sus acentos en
                    `diseno.fondo`; elegir después un color de esta lista
                    de acá abajo cambiaba `colorFondo` y `colorSello` y
                    NO tocaba esos acentos. Resultado real, que el dueño
                    vio en producción: una tarjeta verde con una franja
                    negra que no combinaba con nada, porque el degradado
                    seguía yendo hacia el acento del estilo anterior.

                    ⚠️ POR ESO `alElegir` DE ABAJO AHORA RESETEA EL
                    FONDO. No alcanza con sacar la galería: un negocio
                    que alcanzó a guardar un estilo durante la prueba
                    tiene el degradado viejo en la base, y sin este
                    reseteo se quedaría atrapado con él para siempre —
                    sin ninguna pantalla desde donde sacárselo.

                    El motor (`fondo-tira.ts`) se queda: está probado,
                    no cuesta CPU y `{forma:"plano"}` es inerte. Volver a
                    ofrecer degradados es cambiar este bloque, no
                    reescribir nada. Lo que falta antes de eso es
                    resolver de verdad cómo conviven un estilo terminado
                    y los colores sueltos — y esa es una decisión de
                    producto, no un arreglo. */}
                <div>
                  <span className={etiqueta}>Color de la tarjeta</span>
                  <PlantillasColor
                    colorFondo={valor.colorFondo}
                    colorSello={valor.colorSello}
                    alElegir={(c) =>
                      patch({
                        colorFondo: c.fondo,
                        colorSello: c.sello,
                        // El fondo vuelve a plano SIEMPRE. Ver arriba.
                        diseno: { ...valor.diseno, fondo: FONDO_CLASICO },
                      })
                    }
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
                      {(verMasColores ||
                        paletaDeLosColores(valor.colorFondo, valor.colorSello) === null) && (
                        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                          <CampoColor
                            id="tf-fondo"
                            etiqueta="Color de fondo"
                            valor={valor.colorFondo}
                            alCambiar={(v) => patch({ colorFondo: v, diseno: { ...valor.diseno, fondo: FONDO_CLASICO } })}
                          />
                          <CampoColor
                            id="tf-sello"
                            etiqueta="Color del acento"
                            valor={valor.colorSello}
                            alCambiar={(v) => patch({ colorSello: v, diseno: { ...valor.diseno, fondo: FONDO_CLASICO } })}
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
                        alCambiar={(v) => patch({ colorFondo: v, diseno: { ...valor.diseno, fondo: FONDO_CLASICO } })}
                      />
                      <CampoColor
                        id="tf-sello"
                        etiqueta={valor.tipo === "sellos" ? "Color del sello" : "Color del acento"}
                        valor={valor.colorSello}
                        alCambiar={(v) => patch({ colorSello: v, diseno: { ...valor.diseno, fondo: FONDO_CLASICO } })}
                      />
                    </div>
                  )}
                  {/* Los dos avisos de contraste dejaron de ser exclusivos
                      de "editar". Una tarjeta ilegible se crea igual de
                      fácil que se edita, y el flujo público es justamente
                      donde nadie tiene a un diseñador al lado. */}
                  {contrasteTexto < CONTRASTE_TEXTO && (
                    <p
                      role="status"
                      className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-amber-800"
                    >
                      Con ese fondo tan claro el texto de la tarjeta —que siempre es blanco— casi
                      no se lee. Probá un tono más oscuro o elegí uno de los temas de arriba.
                    </p>
                  )}
                  {contrasteSello < CONTRASTE_SELLO && (
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
                    {/* «Mi ícono» (la subida propia) se ofrece también en
                        el flujo público EN CUANTO HAY SESIÓN — antes el
                        público no lo pasaba nunca y la opción de subir el
                        archivo simplemente no existía, que es lo que el
                        dueño reportó como «no deja cargar la imagen». */}
                    <SelectorIconoSello
                      valor={valor.iconoSello}
                      alElegir={(i) => patch({ iconoSello: i })}
                      colorFondo={valor.colorFondo}
                      colorSello={valor.colorSello}
                      {...(!esPublico || haySesion
                        ? {
                            iconoUrl: valor.iconoUrl || null,
                            alSubirIcono: (url: string) => patch({ iconoUrl: url }),
                          }
                        : {})}
                    />
                    {esCrear && (
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                        Se llena cuando el cliente gana el sello y queda en contorno el que le
                        falta. Con «Mi ícono» va el símbolo que subas, y con «Mi logo» va tu logo
                        adentro del círculo.
                      </p>
                    )}
                    {esPublico && !haySesion && (
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                        ¿Querés subir tu propio ícono? Se habilita en cuanto creés tu cuenta, acá
                        arriba en «Tu cuenta».
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
                            Esto es solo una vista previa: se sube de verdad en cuanto tengas tu
                            cuenta.
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
                            Esto es solo una vista previa: se sube de verdad en cuanto tengas tu
                            cuenta.
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

                {/* ── EL LOGO DEL AVISO (0208) ────────────────────────
                    Es el cuadradito que el teléfono pone al lado de CADA
                    notificación del pase: cuando le acreditan un sello,
                    cuando el negocio manda un anuncio.

                    Se ofrecía SOLO en el panel autenticado, con el
                    motivo escrito de que «sin rancho no hay dónde
                    subirlo». Eso es cierto sin sesión y deja de serlo en
                    cuanto hay una: es exactamente el mismo caso que el
                    ícono propio, que ya se habilita así. Y el alta
                    pública es justo donde el negocio está armando su
                    marca, o sea el mejor momento para pedirlo.

                    Pedido del dueño (26 ago 2026): «agregar opción para
                    que suban el logo que se mostrará en el anuncio, por
                    si no se muestra el logo en la tarjeta». */}
                {(!esPublico || haySesion) && (
                  <div className="border-t border-bookea-linea pt-6">
                    <span className={etiqueta}>Logo que se muestra en el anuncio</span>
                    {esPublico ? (
                      <SubidaPropia
                        etiqueta="Tu logo para avisos"
                        subiendo={subiendoAviso}
                        error={errorAviso}
                        activa={!!valor.notificacionLogoUrl}
                        vista={valor.notificacionLogoUrl || null}
                        subida={!!valor.notificacionLogoUrl}
                        onArchivo={(a) => void elegirArchivoPropio(a, "aviso")}
                        onQuitar={() => patch({ notificacionLogoUrl: "" })}
                      />
                    ) : (
                      <SubirImagen
                        etiqueta=""
                        valor={valor.notificacionLogoUrl}
                        alCambiar={(url) => patch({ notificacionLogoUrl: url })}
                        destino="logo"
                        carpeta="lealtad/notificaciones"
                      />
                    )}
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                      No va dentro de la tarjeta: es la imagen que el teléfono muestra al lado del
                      aviso cuando le acreditás un sello o le mandás un anuncio. Sin esta, va el
                      logo de tu tarjeta.
                    </p>
                  </div>
                )}
              </div>
              </Apartado>

                </div>

                {/* ── Paso 4: dónde van los sellos ─────────────────── */}
                <div
                  className={esPublico ? "paso" : undefined}
                  data-estado={enPaso("franja") ? "activo" : "saliendo"}
                  hidden={!enPaso("franja")}
                >

              {/* ── 4 · La franja ──────────────────────────────────── */}
              {hayTira && (
                <Apartado
                  numero={4}
                  capitulo="La franja"
                  titulo="Dónde van los sellos"
                  nota="Los sellos y tu foto son la MISMA imagen en el teléfono. Por eso se acomodan acá y no encima de la foto."
                >
                  <ControlesTira
                    valor={valor.diseno}
                    alCambiar={(d) => patch({ diseno: d })}
                    meta={metaSellos}
                  />
                </Apartado>
              )}
                </div>
              </div>

              {/* ── LA NAVEGACIÓN DEL ASISTENTE ──────────────────────
                  Vive DENTRO de la tarjeta blanca para que pasar de paso
                  se lea como pasar la página de la misma ficha, no como
                  irse a otro lado.

                  Los puntos NO son decorativos: son el único lugar donde
                  se ve cuántos pasos faltan. Y se puede tocar cualquiera
                  para volver a uno ya visto — nada de obligar a pasar de
                  a uno para corregir un color dos pasos atrás. */}
              {esPublico && (
                <div className="border-t border-bookea-linea px-5 py-5 sm:px-8">
                  <div className="flex items-center justify-center gap-2">
                    {pasosVisibles.map((x, i) => {
                        const activo = i === paso;
                        return (
                          <button
                            key={x.clave}
                            type="button"
                            onClick={() => irAPaso(i)}
                            aria-current={activo ? "step" : undefined}
                            aria-label={`Paso ${i + 1}: ${x.titulo}`}
                            className="presionable grid h-11 w-11 place-items-center rounded-full"
                          >
                            <span
                              className="block rounded-full transition-all duration-200 ease-[var(--ease-bookea)]"
                              style={{
                                width: activo ? 26 : 9,
                                height: 9,
                                background: activo
                                  ? "var(--accion)"
                                  : i < paso
                                    ? "var(--accion-suave)"
                                    : "var(--line)",
                              }}
                            />
                          </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => irAPaso(Math.max(0, paso - 1))}
                      disabled={paso === 0}
                      className="presionable min-h-[44px] rounded-xl border border-bookea-linea px-4 py-3 text-[13px] font-bold text-bookea-gris disabled:invisible"
                    >
                      ← Atrás
                    </button>

                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-bookea-gris">
                      Paso {paso + 1} de {totalPasos}
                    </span>

                    {paso < totalPasos - 1 ? (
                      <span className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => irAPaso(paso + 1)}
                          disabled={trabadoPorCuenta}
                          className="presionable min-h-[44px] rounded-xl px-5 py-3 text-[13px] font-extrabold disabled:cursor-not-allowed disabled:opacity-45"
                          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                        >
                          Siguiente →
                        </button>
                        {/* Por qué está apagado. Un botón gris sin motivo es
                            el peor final de un formulario: la persona no
                            sabe si es un error nuestro o algo que le falta. */}
                        {trabadoPorCuenta && (
                          <span className="text-[11.5px] font-bold text-bookea-gris">
                            Entrá con tu correo para seguir
                          </span>
                        )}
                      </span>
                    ) : (
                      // En el último paso el botón de crear ya está abajo:
                      // dos llamados a la acción compitiendo en la misma
                      // pantalla es la forma más rápida de que no se toque
                      // ninguno.
                      <span className="text-[12.5px] font-bold text-bookea-gris">
                        Último paso ↓
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── El cierre ────────────────────────────────────────────
              Ni una sección numerada ni un paso: es la barra de guardar,
              y vive donde termina el trabajo.

              EN EL ALTA PÚBLICA YA NO ES PEGAJOSA (pedido del dueño,
              30 ago 2026): la caja del teléfono venía siguiendo el
              scroll y en el celular tapaba el propio formulario que la
              persona intentaba llenar. Ahí va al final, quieta, como
              cualquier cierre de formulario. En el panel (crear/editar)
              se conserva pegada abajo: ese editor no pide teléfono y
              poder guardar desde cualquier punto del scroll sigue
              valiendo. */}
          {/* Es su propia tarjeta, separada de la hoja: la hoja termina
              donde termina el diseño, y esto es la acción. Blanca en los
              dos modos ahora que los capítulos viven sobre blanco. */}
          <div
            className={`mt-4 rounded-3xl border border-bookea-linea px-5 py-5 shadow-elevado sm:px-10 ${
              esPublico ? "bg-white" : "sticky bottom-0 z-30 bg-white/95 backdrop-blur"
            }`}
          >
            {esPublico && (
              <div className="mb-4">
                <CampoTelefono valor={valor.telefono} alCambiar={(t) => patch({ telefono: t })} />
              </div>
            )}

            {/* ── EL CÓDIGO DE REFERIDO, PARA CORREGIRLO ACÁ ─────────
                Se escribe en el paso de paquetes, pero el servidor lo
                valida recién al crear —o sea acá—: si el código no
                existe, el aviso salía en esta barra mientras el campo
                quedaba una pantalla atrás. Aparece SOLO si ya hay algo
                escrito: quien no usó código no ve un campo de más, y
                quien sí lo usó puede arreglar el typo sin volver.

                Es el MISMO dato del estado (no una copia), así que
                editarlo acá o allá es indistinto. */}
            {esPublico && (valor.codigoReferido ?? "") !== "" && (
              <div className="mb-4">
                <label className={etiqueta} htmlFor="cierre-referido">
                  Código de referido
                </label>
                <input
                  id="cierre-referido"
                  value={valor.codigoReferido ?? ""}
                  onChange={(e) => patch({ codigoReferido: e.target.value.toUpperCase() })}
                  maxLength={24}
                  autoCapitalize="characters"
                  className={CAMPO_BASE}
                />
              </div>
            )}

            {esEditar && emitidos > 0 && (
              <p className="mb-3 rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] font-bold leading-relaxed text-amber-800">
                Ya hay {emitidos} {emitidos === 1 ? "tarjeta" : "tarjetas"} en teléfonos de
                clientes. Al guardar, {emitidos === 1 ? "esa tarjeta cambia" : "esas tarjetas cambian"}{" "}
                de aspecto la próxima vez que el teléfono las actualice.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-700"
              >
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {requierePago && planACobrar ? (
                <>
                  <button
                    type="button"
                    onClick={irAlPlanPago}
                    disabled={guardando}
                    className="presionable rounded-full px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-40"
                    style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                  >
                    ¡Pagar y activar tarjeta! →
                  </button>
                  {/* La salida de emergencia SOLO cuando el pago viene del
                      paquete elegido y no del tipo: un clic curioso en
                      «Impulso» no puede dejar a nadie obligado a pagar por
                      una tarjeta que el paquete gratis ya cubre. Si el
                      TIPO exige plan pago, no hay atajo — eso sería
                      regalar el paquete. */}
                  {planPagoElegido && esGratis && (
                    <button
                      type="button"
                      onClick={() => patch({ planElegido: "prueba" })}
                      disabled={guardando}
                      className="text-[11.5px] font-bold text-bookea-gris underline disabled:opacity-60"
                    >
                      Prefiero empezar con el paquete gratis y crear mi tarjeta ya
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={onGuardar}
                  disabled={!puedeGuardar}
                  className="presionable rounded-full px-5 py-3 text-[13.5px] font-extrabold disabled:opacity-40"
                  style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                >
                  {textoGuardar}
                </button>
              )}
              {/* Por qué el botón está apagado. Sin esto el dueño se queda
                  mirando un botón gris sin saber qué le falta — que es lo
                  mismo que arreglaba el asterisco de los obligatorios. */}
              {!puedeGuardar && !guardando && !requierePago && (
                <span className="text-[11.5px] font-bold text-bookea-gris">
                  {faltaParaGuardar({
                    nombre,
                    motivoBeneficio,
                    telefonoListo,
                    pideTelefono: esPublico,
                    bloqueada: esEditar && bloqueada,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Vista previa: pegada en escritorio ─────────────────── */}
        {/* El pase deja de ser «una vista previa al costado»: es una
            placa navy con presencia y sus datos derivados al pie. Es el
            RESULTADO de todo lo de la izquierda, y ocupa el lugar de un
            resultado. */}
        <aside className="mt-6 hidden lg:mt-0 lg:block">
          <div className="sticky top-24">
            <PlacaPase datos={datosVista} derivados={derivadosDelPase} />
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

      {/* ── Móvil: la vista previa no cabe pegada, así que se abre desde
          un botón flotante. Va ARRIBA del borde inferior para no taparle
          el botón de guardar, que ahora vive pegado ahí. */}
      <button
        type="button"
        onClick={() => setVerPase(true)}
        className="presionable fixed bottom-24 right-4 z-40 rounded-full border border-bookea-linea bg-white px-4 py-2.5 text-[12.5px] font-bold text-bookea-tinta shadow-[0_10px_24px_-8px_rgba(4,10,26,0.35)] lg:hidden"
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

/**
 * LOS PASOS DEL ALTA PÚBLICA.
 *
 * Vive acá y no dentro del componente porque no depende de nada del
 * estado: es el guion de la pantalla. El `hayTira` que decide si «La
 * franja» entra o no se aplica al usarlo, no acá.
 */
const PASOS_PUBLICOS: { clave: string; titulo: string }[] = [
  { clave: "cuenta", titulo: "Tu cuenta" },
  { clave: "identidad", titulo: "Qué tipo de tarjeta es" },
  { clave: "premio", titulo: "Qué se gana" },
  { clave: "apariencia", titulo: "Cómo se ve" },
  { clave: "franja", titulo: "Dónde van los sellos" },
];

// ── Piezas ─────────────────────────────────────────────────────────

/**
 * QUÉ LE FALTA AL BOTÓN PARA ENCENDERSE.
 *
 * Las condiciones son las MISMAS de `puedeGuardar`, en el mismo orden,
 * y por eso esta función vive pegada a él. Un botón apagado sin motivo
 * es el peor final posible de un formulario: todo el trabajo hecho y
 * ninguna pista de qué corregir.
 *
 * ⚠️ Si `puedeGuardar` cambia, esto cambia con él. Un mensaje que
 * nombra el campo equivocado es peor que ninguno — manda a corregir lo
 * que ya está bien.
 */
function faltaParaGuardar({
  nombre,
  motivoBeneficio,
  telefonoListo,
  pideTelefono,
  bloqueada,
}: {
  nombre: string;
  motivoBeneficio: string | null;
  telefonoListo: boolean;
  pideTelefono: boolean;
  bloqueada: boolean;
}): string {
  if (bloqueada) return "Esta tarjeta está archivada.";
  if (!nombre) return "Falta el nombre.";
  if (nombre.length > 80) return "El nombre es muy largo.";
  if (motivoBeneficio) return motivoBeneficio;
  if (pideTelefono && !telefonoListo) return "Falta el teléfono.";
  return "";
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
