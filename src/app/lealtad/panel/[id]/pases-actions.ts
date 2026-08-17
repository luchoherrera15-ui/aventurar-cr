"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import {
  esTipoTarjeta,
  metaDe,
  tipoDe,
  TIPOS_TARJETA,
  validarBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import {
  esSelloElegido,
  selloParaGuardar,
  SELLO_PROPIO,
  urlDeIconoPropio,
  type SelloElegido,
} from "@/lib/lealtad/iconos-sello";
import { comprobarImagenSubida } from "@/lib/media/comprobar-imagen-subida";
import { planIncluyeTipo, planQueDesbloquea } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { pideRecompensa, puedeCambiarTipo, puedeEditarse } from "@/lib/lealtad/editable";
import { esColumnaAusente, traducirError, type ErrorBase } from "@/lib/lealtad/errores-base";
import {
  mesesGuardables,
  reglaDeFila,
  relojDeVencimiento,
} from "@/lib/lealtad/vencimiento-sellos";
import { avisarCambioDeDiseno } from "@/lib/wallet/aviso-de-diseno";
import type { ModoPrograma } from "@/lib/wallet/tarjeta";

/**
 * AVISARLE A LOS PASES YA INSTALADOS QUE LA TARJETA CAMBIÓ (0150).
 *
 * El dueño reportó que ni los sellos ni las ediciones de la tarjeta
 * llegaban al teléfono. Lo primero ya avisaba (`avisarCambioDePase` en
 * cada acreditación — ver lealtad-operar-actions.ts y escaner-actions.ts);
 * esto era lo que faltaba: guardar un color, un icono, la meta de
 * sellos o las reglas no tocaba un solo pase ya en un Wallet ajeno.
 *
 * Va por `after()` a propósito, igual que en el resto del módulo: el
 * dueño está mirando la pantalla esperando «Guardado», y avisarle a
 * cada pase instalado es una llamada de red por pase (a Apple o a
 * Google). `avisarCambioDeDiseno` hace el trabajo pesado por tandas
 * (aviso-de-diseno.ts) y nunca lanza.
 */
function avisarEdicionDeTarjeta(programaId: string): void {
  after(() => avisarCambioDeDiseno(programaId));
}

/**
 * La configuración del programa de lealtad y su tarjeta de Wallet
 * (migraciones 0060, 0121, 0122).
 *
 * Casi todo lo que se ve en la tarjeta se DERIVA: cuántos sellos y qué
 * regalía salen de la recompensa activa más barata; el saldo, del
 * ledger. Acá solo se edita lo que no se puede deducir de ningún lado:
 * las reglas de cómo se ganan puntos y cómo se ve la tarjeta.
 *
 * DESDE LA INTERFAZ NUEVA, CONFIGURA SOLO BOOKEA: el negocio elige un
 * paquete y deja una solicitud (/lealtad/planes, 0126); el programa lo
 * arma el equipo "para que se haga bien". Por eso el guard exige admin
 * de PLATAFORMA y no dueño — el dueño ve su programa, no lo edita.
 * (Las escrituras van con la sesión del admin: las políticas de la
 * 0060 ya incluyen `is_admin()`.)
 */

export type ProgramaFila = {
  id: string;
  rancho_id: string;
  nombre: string;
  puntos_por_visita: number;
  puntos_por_colon: number;
  activo: boolean;
  modo: ModoPrograma | null;
  pase_color_fondo: string | null;
  pase_color_sello: string | null;
  pase_logo_url: string | null;
  /**
   * El diseño del pase que suma la 0132. TODOS opcionales, y no por
   * pereza: la migración puede no estar pegada —las pega el dueño a
   * mano— y entonces la fila llega SIN estos campos. Declararlos
   * obligatorios haría que TypeScript creyera que siempre están, y la
   * pantalla leería `undefined` donde promete un booleano.
   */
  pase_banner_url?: string | null;
  /** El icono de cada sello (0145). Opcional por lo mismo. */
  pase_sello_icono?: string | null;
  /** El ícono propio que subió el negocio (0174). Opcional por lo mismo. */
  pase_sello_icono_url?: string | null;
  pase_codigo_formato?: string | null;
  pase_texto_reverso?: string | null;
  pase_mostrar_saldo?: boolean | null;
  pase_mostrar_progreso?: boolean | null;
  /** La config propia del tipo (0135, jsonb). La vista previa la
   *  necesita para dibujar lo mismo que el pase real. */
  beneficio?: unknown;
  /** Ciclo de vida (0125). null = se deriva de `activo`. Opcional:
   *  tolera bases sin migrar. */
  estado?: string | null;
  compra_minima?: number | null;
  max_por_transaccion?: number | null;
  max_diario_cliente?: number | null;
};

export type RecompensaFila = {
  id: string;
  programa_id: string;
  nombre: string;
  descripcion: string | null;
  costo_puntos: number;
  orden: number;
  activo: boolean;
  /** Campos de la 0125. Opcionales: toleran bases sin migrar. */
  tipo?: string | null;
  valor?: number | null;
  stock_total?: number | null;
  limite_por_cliente?: number | null;
  sku?: string | null;
  instrucciones?: string | null;
};

/** Qué código dibuja el pase (0132). Apple sabe leer los dos. */
export type FormatoCodigo = "qr" | "code128";

export type ProgramaInput = {
  nombre: string;
  modo: ModoPrograma;
  /** Cuántos puntos da una visita. En modo sellos, esto ES el sello. */
  puntosPorVisita: number;
  /** Puntos por cada colón gastado. 0.05 = 5% de vuelta. */
  puntosPorColon: number;
  colorFondo: string;
  colorSello: string;
  logoUrl: string;
  /** Banda superior: `strip.png` en Apple, `heroImage` en Google. */
  bannerUrl: string;
  /**
   * El dibujo de cada sello (0145). null = el logo del negocio;
   * 'propio' = el archivo de `iconoUrl` (0174).
   */
  iconoSello: SelloElegido | null;
  /** El ícono propio subido (0174). Se guarda esté elegido o no. */
  iconoUrl: string;
  codigoFormato: FormatoCodigo;
  /** Reemplaza el texto que el dorso del pase arma solo. "" = el de siempre. */
  textoReverso: string;
  mostrarSaldo: boolean;
  mostrarProgreso: boolean;
  activo: boolean;
};

const FORMATOS_CODIGO: readonly FormatoCodigo[] = ["qr", "code128"];
/** El mismo tope que el CHECK de la 0132: pasarse solo cambia quién da
 *  el error, y el de Postgres no está escrito para nadie. */
const MAX_TEXTO_REVERSO = 500;
const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * EL DUEÑO edita su propia tarjeta.
 *
 * Esto arrancó reservado al admin de plataforma («solo Bookea genera
 * los pases») y cambió a pedido: la competencia deja al negocio tocar
 * colores, logo y recompensas cuando quiera, y esperar a que alguien
 * conteste un correo para cambiar una regalía es fricción sin premio.
 *
 * `verificarAccesoRancho` ya resuelve dueño-o-admin; los colaboradores
 * NO entran acá — su checklist (0127) gobierna la operación diaria, no
 * la identidad de la marca.
 */
async function guard(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/lealtad/login");
  return { supabase, ok };
}

/**
 * Cómo se lee un error de la base, y cuándo se degrada.
 *
 * La clasificación vive en `src/lib/lealtad/errores-base.ts` para poder
 * probarla sin Supabase. Acá se usa, y el motivo por el que se sacó de
 * este archivo está escrito allá: distinguir «esa columna no existe»
 * de «ese valor viola un CHECK» era la diferencia entre reintentar sin
 * las columnas nuevas —correcto— y tirar a la basura la banda, el
 * icono y los textos del dueño para después decirle «Guardado».
 */
function traducir(error: ErrorBase, accion: string) {
  return traducirError(error, accion);
}

function validarPrograma(datos: ProgramaInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 80) return "El nombre es obligatorio (máximo 80 caracteres).";
  // LOS OCHO TIPOS, no tres. Acá había una lista propia con 'sellos',
  // 'cashback' y 'puntos', y eso dejaba a las cinco tarjetas de la 0135
  // sin poder guardarse: un cupón hecho con el asistente entraba al
  // editor del diseño, se le cambiaba el color, y al guardar contestaba
  // «Ese modo no existe» — un mensaje que no se puede ni obedecer,
  // porque el tipo no se edita desde esta pantalla.
  if (!esTipoTarjeta(datos.modo)) return "Ese tipo de tarjeta no existe.";

  if (!Number.isInteger(datos.puntosPorVisita) || datos.puntosPorVisita < 0) {
    return "Los puntos por visita no pueden ser negativos.";
  }
  if (!Number.isFinite(datos.puntosPorColon) || datos.puntosPorColon < 0) {
    return "Los puntos por colón no pueden ser negativos.";
  }
  // Un programa que no otorga nada es una tarjeta que nunca avanza: se
  // ve bien, no funciona, y nadie entiende por qué.
  if (datos.puntosPorVisita === 0 && datos.puntosPorColon === 0) {
    return "El programa tiene que dar algo: puntos por visita, por colón, o los dos.";
  }
  // Mismo check que la 0122: un color mal escrito no falla al dibujar,
  // sale un cuadro negro y nadie sabe por qué.
  if (!HEX.test(datos.colorFondo)) return "El color de fondo tiene que ser #RRGGBB.";
  if (!HEX.test(datos.colorSello)) return "El color del sello tiene que ser #RRGGBB.";

  if (!FORMATOS_CODIGO.includes(datos.codigoFormato)) {
    return "Ese formato de código no existe.";
  }
  // Mismo criterio que el creador: un id fuera del catálogo se rechaza
  // acá, con un mensaje en español, antes de que lo rechace el CHECK de
  // la 0145 con uno que nadie puede leer.
  if (datos.iconoSello !== null && !esSelloElegido(datos.iconoSello)) {
    return "Ese icono de sello no existe.";
  }
  // El ícono propio (0174): la URL tiene que ser https y de un largo
  // razonable ANTES de mirar de quién es. Y elegir «Mi ícono» sin
  // archivo es un estado que no existe — la base lo impide con un
  // CHECK, pero el error de Postgres no está escrito para nadie.
  const iconoUrl = datos.iconoUrl.trim();
  if (iconoUrl && urlDeIconoPropio(iconoUrl) === null) {
    return "El ícono no se subió bien — probá de nuevo.";
  }
  if (datos.iconoSello === SELLO_PROPIO && !iconoUrl) {
    return "Subí tu ícono antes de elegirlo como sello.";
  }
  if (datos.textoReverso.trim().length > MAX_TEXTO_REVERSO) {
    return `El texto del reverso no puede pasar de ${MAX_TEXTO_REVERSO} caracteres.`;
  }
  // Las imágenes NO se validan acá: hace falta saber qué tenía guardado
  // el programa (ver `imagenAjena`), y eso es una consulta.
  return null;
}

/**
 * ¿Esta imagen se puede guardar en el pase?
 *
 * La regla es la misma que en el creador (crear-actions.ts): la URL
 * tiene que ser de NUESTRO bucket. Una URL ajena en el pase significa
 * que un tercero decide qué imagen ve el cliente en el teléfono —y
 * puede cambiarla o borrarla— para siempre, porque el pase ya está
 * instalado.
 *
 * La excepción es la que YA ESTABA guardada. El editor viejo pedía una
 * «URL https» escrita a mano, así que hay programas en producción con
 * el logo colgado del dominio de otro. Rechazarla de golpe le rompería
 * el guardado a un negocio que no tocó la imagen: no podría cambiar ni
 * un color hasta resubir un logo que él no sabe que está mal. Se deja
 * pasar tal cual está, y para reemplazarla hay que subir un archivo —
 * que es el único camino que ofrece la pantalla nueva.
 */
function imagenAjena(url: string, anterior: string | null): boolean {
  const limpia = url.trim();
  if (!limpia) return false;
  if (esUrlDeNuestroStorage(limpia, "ranchos-fotos")) return false;
  return limpia !== (anterior ?? "").trim();
}

/**
 * El tope del ÍCONO PROPIO del lado del servidor, en bytes.
 *
 * Es el mismo número que muestra la pantalla al subir (`MAX_MB` en
 * subir-imagen.tsx), y se vuelve a exigir acá porque el archivo NO pasa
 * por el server action: lo sube el navegador directo al bucket. Todo lo
 * que el navegador comprobó lo comprobó en la máquina de quien sube.
 */
const MAX_BYTES_ICONO = 2 * 1024 * 1024;

/**
 * ¿El archivo que hay en esa URL es de verdad una imagen y pesa lo que
 * puede pesar? Se pregunta SOLO cuando la URL cambió: es una llamada de
 * red, y guardar un color no tiene por qué pagarla.
 *
 * Devuelve el motivo en español, o null si está todo bien.
 */
async function iconoInvalido(url: string, anterior: string | null): Promise<string | null> {
  const limpia = url.trim();
  if (!limpia || limpia === (anterior ?? "").trim()) return null;
  const res = await comprobarImagenSubida(limpia, { maxBytes: MAX_BYTES_ICONO });
  return res.ok ? null : res.motivo;
}

/**
 * Crea o actualiza el programa.
 *
 * `programaId` viene de la pantalla que está editando. Desde la 0134 un
 * negocio puede tener VARIAS tarjetas (se liberó el `unique(rancho_id)`
 * de la 0060), así que buscar «el programa del rancho» ya no identifica
 * a nadie: con dos tarjetas, guardar el diseño de una podía escribirle
 * a la otra. Se sigue verificando que el id sea de ESTE negocio — viene
 * del navegador, y eso no autoriza nada.
 */
export async function guardarPrograma(
  ranchoId: string,
  datos: ProgramaInput,
  programaId?: string | null,
): Promise<{ error?: string; programa?: ProgramaFila }> {
  const invalido = validarPrograma(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "Solo el dueño del negocio edita la tarjeta." };

  // `select *` y no una lista de columnas: las de la 0132 pueden no
  // existir todavía y un select explícito fallaría entero.
  const busqueda = supabase.from("programa_lealtad").select("*").eq("rancho_id", ranchoId);
  const { data: fila0 } = programaId
    ? await busqueda.eq("id", programaId).maybeSingle()
    : await busqueda.limit(1).maybeSingle();
  const previo = (fila0 ?? null) as ProgramaFila | null;

  if (programaId && !previo) return { error: "Esa tarjeta no es de este negocio." };

  if (imagenAjena(datos.logoUrl, previo?.pase_logo_url ?? null)) {
    return { error: "El logo no se subió bien — probá de nuevo." };
  }
  if (imagenAjena(datos.bannerUrl, previo?.pase_banner_url ?? null)) {
    return { error: "La banda no se subió bien — probá de nuevo." };
  }
  if (imagenAjena(datos.iconoUrl, previo?.pase_sello_icono_url ?? null)) {
    return { error: "El ícono no se subió bien — probá de nuevo." };
  }
  // Y que ADEMÁS sea una imagen de verdad: la URL puede ser de nuestro
  // bucket y el objeto ser cualquier cosa renombrada. Esto se mira una
  // sola vez, cuando el ícono cambia.
  const falloIcono = await iconoInvalido(datos.iconoUrl, previo?.pase_sello_icono_url ?? null);
  if (falloIcono) return { error: falloIcono };

  // ── EL TIPO, SEGÚN EL PAQUETE (0142) ──────────────────────────────
  // Esta es la SEGUNDA puerta que escribe `modo`; la primera es el
  // creador (`crear-actions.ts`), que ya lo comprueba. Sin este check,
  // una cuenta de Prueba podía crear su tarjeta de sellos y después
  // cambiarle el `modo` a "evento" desde el editor del diseño: el
  // reparto de tipos se saltaría entero por la puerta de atrás.
  //
  // Solo se frena el CAMBIO, no el guardado. Una tarjeta que YA es de
  // un tipo que el paquete de hoy no incluye se sigue pudiendo editar:
  // bajar de paquete no puede dejar a nadie sin poder cambiarle un
  // color a lo que ya tiene instalado en teléfonos ajenos.
  const cambiaElTipo = (previo?.modo ?? null) !== datos.modo;
  const admin = cambiaElTipo ? createAdminClient() : null;
  if (admin && esTipoTarjeta(datos.modo)) {
    const { data: fila } = await admin
      .from("ranchos")
      .select("plan_lealtad")
      .eq("id", ranchoId)
      .maybeSingle();
    // `maybeSingle` porque sin la 0134 la tabla no existe: ahí el plan
    // sale del rancho, como salía antes.
    const { data: cuenta } = await admin
      .from("cuentas")
      .select("id")
      .eq("rancho_id", ranchoId)
      .maybeSingle();
    const { plan } = await contextoDeCuenta(
      admin,
      cuenta?.id ? { cuenta_id: cuenta.id as string } : {},
      { planRancho: (fila?.plan_lealtad as string | null) ?? null },
    );
    if (!planIncluyeTipo(plan, datos.modo)) {
      const abre = planQueDesbloquea(datos.modo);
      const nombreTipo = TIPOS_TARJETA[datos.modo].nombre.toLowerCase();
      return {
        error: abre
          ? `Las tarjetas de ${nombreTipo} vienen con el paquete ${abre.nombre}. Subí de paquete para cambiarla.`
          : `Tu paquete no incluye las tarjetas de ${nombreTipo}.`,
      };
    }
  }

  const base = {
    nombre: datos.nombre.trim(),
    modo: datos.modo,
    puntos_por_visita: datos.puntosPorVisita,
    puntos_por_colon: datos.puntosPorColon,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_logo_url: datos.logoUrl.trim() || null,
    activo: datos.activo,
  };
  // Solo las de sellos llevan icono: cambiar el tipo a «cupón» lo borra
  // —con su archivo— en vez de dejarlo colgado esperando a que alguien
  // lo dibuje. El ícono propio, en cambio, SOBREVIVE a elegir uno de
  // los doce: es el archivo del negocio, no un valor temporal.
  const sello = selloParaGuardar({
    tipo: datos.modo,
    icono: datos.iconoSello,
    url: datos.iconoUrl,
  });
  const fila = {
    ...base,
    pase_banner_url: datos.bannerUrl.trim() || null,
    pase_sello_icono: sello.icono,
    pase_sello_icono_url: sello.url,
    pase_codigo_formato: datos.codigoFormato,
    pase_texto_reverso: datos.textoReverso.trim() || null,
    pase_mostrar_saldo: datos.mostrarSaldo,
    pase_mostrar_progreso: datos.mostrarProgreso,
  };

  const guardarCon = (f: Record<string, unknown>) =>
    previo
      ? supabase.from("programa_lealtad").update(f).eq("id", previo.id).select("*").single()
      : supabase
          .from("programa_lealtad")
          .insert({ rancho_id: ranchoId, ...f })
          .select("*")
          .single();

  let { data, error } = await guardarCon(fila);

  // Base sin la 0132 (o sin la 0145): se reintenta con lo que la 0122
  // sí tiene. El negocio pierde el diseño nuevo hasta que la migración
  // corra, pero no pierde el poder cambiar un color — que es lo que
  // pasaba si esto se dejaba reventar.
  //
  // ------------------------------------------------------------------
  // POR QUÉ SE PREGUNTA POR EL CÓDIGO Y NO POR EL TEXTO
  // ------------------------------------------------------------------
  // Esto miraba si el mensaje MENCIONABA alguna de estas columnas. Y
  // los CHECK que las cuidan llevan el nombre de la columna adentro
  // (`programa_lealtad_pase_sello_icono_check`), así que un valor
  // RECHAZADO por la base entraba por acá: se reintentaba sin la banda,
  // sin el icono y sin los textos, el reintento pasaba, y la pantalla
  // contestaba «Guardado» después de descartar en silencio lo que el
  // dueño acababa de elegir.
  //
  // `esColumnaAusente` separa las dos cosas por el CÓDIGO del error
  // (PGRST204/42703 = falta la columna; 23514 = CHECK violado), que es
  // lo único que no se confunde. Un CHECK violado ya no degrada: cae
  // abajo, en `traducir`, y sale en español diciendo qué corregir.
  const COLUMNAS_NUEVAS = [
    "pase_banner_url",
    "pase_sello_icono",
    "pase_sello_icono_url",
    "pase_codigo_formato",
    "pase_texto_reverso",
    "pase_mostrar_saldo",
    "pase_mostrar_progreso",
  ];
  if (error && esColumnaAusente(error, COLUMNAS_NUEVAS)) {
    ({ data, error } = await guardarCon(base));
  }

  if (error) return { error: traducir(error, "guardar el programa") };

  // Colores, logo, banda, icono del sello —incluido el ÍCONO PROPIO de
  // la 0174, que se dibuja adentro de cada círculo—, si se ve el saldo
  // o el progreso: todo esto es lo que Apple y Google DIBUJAN. Un pase
  // ya instalado se queda con el diseño viejo hasta que alguien avise;
  // por eso cambiar el ícono entra por la misma puerta que cambiar un
  // color, y no por un camino propio que alguien tenga que acordarse
  // de llamar.
  // `avisarEdicionDeTarjeta` no hace nada si `previo` es null (una
  // tarjeta recién creada no tiene pases todavía que avisar).
  const programaGuardado = data as ProgramaFila;
  if (previo) avisarEdicionDeTarjeta(programaGuardado.id);

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);
  return { programa: programaGuardado };
}

// ── EDITAR LA TARJETA QUE YA EXISTE ────────────────────────────────
//
// El asistente promete «podés cambiar todo después». Hasta acá era
// mentira: `guardarPrograma` escribe el diseño y las reglas de puntos,
// pero NUNCA escribió `beneficio` ni una sola columna de la 0136. O
// sea que la meta de sellos, el porcentaje del cupón, el valor de la
// gift card, la fecha del evento, los vencimientos, los días y horas
// permitidas y los topes de canje se elegían UNA vez, en el asistente,
// y eran para siempre.
//
// Esta es la puerta que faltaba. Escribe lo mismo que escribe el
// creador (`crear-actions.ts`) y con las mismas validaciones —las de
// `validarBeneficio`, que es la función compartida— más un candado que
// el creador no necesita: el TIPO no se cambia con gente adentro.

export type ReglasTarjeta = {
  desde: string;
  hasta: string;
  usoUnico: boolean;
  maxPorCliente: number | null;
  maxGlobal: number | null;
  /** 0 = domingo. Vacío = todos los días. */
  dias: number[];
  horaDesde: string;
  horaHasta: string;
};

export type EdicionTarjeta = {
  nombre: string;
  tipo: TipoTarjeta;
  beneficio: ConfigBeneficio;
  reglas: ReglasTarjeta;
  /** Meses de inactividad antes de reiniciar los sellos (0180). */
  sellosVencenMeses: number | null;
};


/**
 * Los dos números de la 0060 que lee el motor de puntos, DERIVADOS del
 * beneficio y no pedidos aparte: dos campos para lo mismo se separan
 * el día que alguien cambia uno.
 *
 * El cashback merece su línea. El creador le pone `puntos_por_colon: 0`
 * a todo lo que no es «puntos», así que una tarjeta de cashback del 5%
 * se llamaba cashback y no devolvía un cinco: el motor no tenía de
 * dónde sacar el porcentaje. Un 5% ES 0.05 puntos por colón, que es
 * exactamente lo que ese motor sabe hacer.
 */
function puntosDelBeneficio(
  b: ConfigBeneficio,
  previo: { visita: number; colon: number },
  cambiaElTipo: boolean,
): { visita: number; colon: number } {
  if (b.tipo === "puntos") return { visita: b.porVisita, colon: b.porMoneda };
  if (b.tipo === "cashback") return { visita: 0, colon: b.porcentaje / 100 };

  // Los otros seis NO llevan la tasa adentro de su config. El creador
  // les pone 1 por visita y ya, pero una tarjeta de sellos puede estar
  // dando 2 —se configura desde el panel de Bookea— y pisarle un 1 al
  // guardar el beneficio sería cambiarle la regla al negocio sin que
  // nadie lo pida. Se conserva lo que la fila ya tenía.
  //
  // Salvo que el TIPO haya cambiado: ahí lo de antes describía otra
  // clase de tarjeta (un 0.05 por colón de cashback no significa nada
  // en un cupón) y se arranca con lo de fábrica.
  if (cambiaElTipo) return { visita: 1, colon: 0 };
  const sirve = previo.visita > 0 || previo.colon > 0;
  return sirve ? previo : { visita: 1, colon: 0 };
}

/**
 * La META de una tarjeta de sellos vive en la RECOMPENSA, no en el
 * jsonb: el pase real la saca de la recompensa activa más barata
 * (`metaDeSellos` en wallet/tarjeta.ts). Por eso cambiar «Café gratis a
 * los 10» por «Corte gratis a los 8» tiene que mover las dos cosas — si
 * solo se guardara el jsonb, el dueño vería el 8 en el panel y el
 * cliente seguiría viendo «5 de 10» en el teléfono.
 *
 * Solo sellos. En los otros siete tipos las recompensas son del dueño y
 * se editan en su propia sección: pisarle el nombre de una regalía con
 * un texto genérico sería peor que no sincronizar nada.
 *
 * Si falla, el resto ya se guardó: se devuelve el motivo para poder
 * decirlo, no para deshacer lo que sí quedó bien.
 */
async function sincronizarMetaDeSellos(
  supabase: Awaited<ReturnType<typeof guard>>["supabase"],
  programaId: string,
  beneficio: ConfigBeneficio,
): Promise<string | null> {
  if (beneficio.tipo !== "sellos") return null;
  const meta = metaDe(beneficio);
  const nombre = beneficio.recompensa.trim();
  if (meta === null || !nombre) return null;

  const costo = Math.max(1, Math.round(meta));

  const { data: actuales } = await supabase
    .from("recompensas")
    .select("id")
    .eq("programa_id", programaId)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1);

  const vigente = (actuales ?? [])[0] as { id: string } | undefined;

  const { error } = vigente
    ? await supabase
        .from("recompensas")
        .update({ nombre, costo_puntos: costo })
        .eq("id", vigente.id)
        .eq("programa_id", programaId)
    : await supabase
        .from("recompensas")
        .insert({ programa_id: programaId, nombre, costo_puntos: costo, activo: true });

  return error ? traducir(error, "guardar la regalía") : null;
}

/** Las recompensas del programa, como las quiere la pantalla. */
async function recompensasDe(
  supabase: Awaited<ReturnType<typeof guard>>["supabase"],
  programaId: string,
): Promise<RecompensaFila[]> {
  const { data } = await supabase
    .from("recompensas")
    .select("*")
    .eq("programa_id", programaId)
    .order("costo_puntos", { ascending: true });
  return (data ?? []) as RecompensaFila[];
}

/**
 * Guarda el beneficio, las reglas y (si se puede) el tipo.
 *
 * Lo que NO se puede se dice ANTES en la pantalla y se vuelve a
 * comprobar acá con el mismo criterio (`src/lib/lealtad/editable.ts`):
 * dos criterios distintos son un candado que se abre por un lado.
 */
export async function guardarBeneficio(
  ranchoId: string,
  programaId: string,
  datos: EdicionTarjeta,
): Promise<{ error?: string; programa?: ProgramaFila; recompensas?: RecompensaFila[] }> {
  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "Solo el dueño del negocio edita la tarjeta." };

  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 80) {
    return { error: "El nombre es obligatorio (máximo 80 caracteres)." };
  }
  if (!esTipoTarjeta(datos.tipo)) return { error: "Ese tipo de tarjeta no existe." };

  // El beneficio tiene que ser DEL tipo que se está guardando. Sin este
  // control se podría dejar una tarjeta de sellos con la config de una
  // gift card: el pase se dibujaría de una forma y el canje se
  // resolvería de otra. (Mismo par que valida el creador; `descuento`
  // comparte forma con `cupon`.)
  const esperado: string = datos.tipo === "descuento" ? "descuento" : datos.tipo;
  if (datos.beneficio?.tipo !== esperado) {
    return { error: "La configuración no corresponde a ese tipo de tarjeta." };
  }
  const invalido = validarBeneficio(datos.beneficio);
  if (invalido) return { error: invalido };

  const { desde, hasta } = datos.reglas;
  if (desde && hasta && hasta < desde) {
    return { error: "La fecha de vencimiento no puede ser anterior a la de inicio." };
  }

  // La tarjeta tiene que ser de ESTE negocio: el id viene del
  // navegador y eso no autoriza nada. `select *` porque las columnas de
  // la 0135/0136 pueden no existir todavía.
  const { data: fila0 } = await supabase
    .from("programa_lealtad")
    .select("*")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  const previo = (fila0 ?? null) as ProgramaFila | null;
  if (!previo) return { error: "Esa tarjeta no es de este negocio." };

  const { estadoDelPrograma } = await import("@/lib/lealtad/reglas");
  const estado = estadoDelPrograma({ estado: previo.estado ?? null, activo: previo.activo });

  // Cuánta gente hay adentro. Es el dato del que cuelga el candado del
  // tipo, y lo cuenta el SERVIDOR: el navegador podría mandar cero.
  const { count } = await supabase
    .from("miembros")
    .select("*", { count: "exact", head: true })
    .eq("programa_id", programaId);
  const miembros = count ?? 0;

  const situacion = { miembros, estado, tipo: tipoDe(previo.modo) };

  const editable = puedeEditarse(situacion);
  if (!editable.puede) return { error: editable.motivo };

  const cambiaElTipo = tipoDe(previo.modo) !== datos.tipo;
  if (cambiaElTipo) {
    const cambio = puedeCambiarTipo(situacion);
    if (!cambio.puede) return { error: cambio.motivo };

    // Y el paquete, igual que en el creador y que en `guardarPrograma`:
    // sin esto, una cuenta de Prueba armaba su tarjeta de sellos y le
    // cambiaba el tipo a «evento» desde acá.
    const admin = createAdminClient();
    if (admin) {
      const { data: rancho } = await admin
        .from("ranchos")
        .select("plan_lealtad")
        .eq("id", ranchoId)
        .maybeSingle();
      const { data: cuenta } = await admin
        .from("cuentas")
        .select("id")
        .eq("rancho_id", ranchoId)
        .maybeSingle();
      const { plan } = await contextoDeCuenta(
        admin,
        cuenta?.id ? { cuenta_id: cuenta.id as string } : {},
        { planRancho: (rancho?.plan_lealtad as string | null) ?? null },
      );
      if (!planIncluyeTipo(plan, datos.tipo)) {
        const abre = planQueDesbloquea(datos.tipo);
        const nombreTipo = TIPOS_TARJETA[datos.tipo].nombre.toLowerCase();
        return {
          error: abre
            ? `Las tarjetas de ${nombreTipo} vienen con el paquete ${abre.nombre}. Subí de paquete para cambiarla.`
            : `Tu paquete no incluye las tarjetas de ${nombreTipo}.`,
        };
      }
    }
  }

  // Los meses, saneados con el MISMO criterio que usa el creador. Va
  // después del candado del tipo a propósito: si la tarjeta deja de
  // ser de sellos, la regla se apaga sola en vez de quedar escondida
  // en una gift card.
  const vencenMeses = mesesGuardables(datos.tipo, datos.sellosVencenMeses);

  const puntos = puntosDelBeneficio(
    datos.beneficio,
    { visita: previo.puntos_por_visita, colon: Number(previo.puntos_por_colon) },
    cambiaElTipo,
  );
  const base = {
    nombre,
    modo: datos.tipo,
    puntos_por_visita: puntos.visita,
    puntos_por_colon: puntos.colon,
  };
  const fila = {
    ...base,
    beneficio: datos.beneficio,
    // Las reglas van en columnas y no en el jsonb porque las lee el
    // motor que autoriza un canje: una regla que decide si algo procede
    // no puede vivir donde nadie la valida.
    vigente_desde: desde || null,
    vigente_hasta: hasta || null,
    uso_unico: datos.reglas.usoUnico,
    max_por_cliente: datos.reglas.maxPorCliente,
    max_global: datos.reglas.maxGlobal,
    dias_permitidos: datos.reglas.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    hora_desde: datos.reglas.horaDesde || null,
    hora_hasta: datos.reglas.horaHasta || null,
    // El vencimiento de sellos por inactividad (0180) y su reloj. Van
    // en columnas por lo mismo que las reglas de arriba, y con más
    // motivo: esta es la única que le QUITA algo a un cliente.
    sellos_vencen_meses: vencenMeses,
    sellos_vencen_desde: relojDeVencimiento({
      meses: vencenMeses,
      // La fila CRUDA: `ProgramaFila` no declara estas columnas y no
      // debe — la 0180 la pega el dueño a mano, y hasta que corra la
      // fila llega sin ellas. `reglaDeFila` ya sabe leerlas así.
      previa: reglaDeFila(previo as unknown as Record<string, unknown>),
      ahora: new Date(),
    }),
  };

  const guardarCon = (f: Record<string, unknown>) =>
    supabase.from("programa_lealtad").update(f).eq("id", programaId).select("*").single();

  let { data, error } = await guardarCon(fila);

  // Base sin la 0135/0136: se guarda al menos el nombre, el tipo y los
  // puntos. Por CÓDIGO y no por texto — los CHECK de esas migraciones
  // llevan el nombre de la columna adentro, y degradar por un valor
  // rechazado sería tirar el beneficio y contestar «Guardado».
  if (
    error &&
    esColumnaAusente(error, [
      "beneficio",
      "vigente_desde",
      "vigente_hasta",
      "uso_unico",
      "max_por_cliente",
      "max_global",
      "dias_permitidos",
      "hora_desde",
      "hora_hasta",
      "sellos_vencen_meses",
      "sellos_vencen_desde",
    ])
  ) {
    ({ data, error } = await guardarCon(base));
  }

  if (error) return { error: traducir(error, "guardar la tarjeta") };

  const fallaMeta = await sincronizarMetaDeSellos(supabase, programaId, datos.beneficio);
  if (fallaMeta) return { error: fallaMeta };

  // El beneficio y las reglas son justo lo que promete la tarjeta: la
  // meta de sellos, el % del cupón, el valor de la gift card, la
  // vigencia. Cambiar esto sin avisar deja a un pase ya instalado
  // mostrando una promesa vieja.
  avisarEdicionDeTarjeta(programaId);

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/lealtad/panel/${ranchoId}/editar/${programaId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);
  // Las recompensas vuelven con la fila porque el guardado pudo mover
  // la meta: sin esto, la pestaña de regalías seguiría mostrando «Café
  // gratis a los 10» un segundo después de que el dueño lo cambió a
  // «Corte gratis a los 8».
  return { programa: data as ProgramaFila, recompensas: await recompensasDe(supabase, programaId) };
}

/**
 * Lo que el editor del diseño necesita saber y no está en la fila del
 * programa: cómo se llama el negocio (la vista previa escribe ESE
 * nombre, no el de la tarjeta) y cuántos pases hay ya emitidos.
 *
 * Se pregunta acá y no se recibe por props porque el editor cuelga del
 * contexto compartido, que solo lleva el programa y sus recompensas.
 * El número importa: cambiar el diseño toca tarjetas que ya están en
 * teléfonos ajenos, y eso hay que decirlo ANTES de guardar.
 */
export async function contextoDeLaTarjeta(
  ranchoId: string,
  programaId: string | null,
): Promise<{ negocioNombre: string; pasesEmitidos: number }> {
  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { negocioNombre: "", pasesEmitidos: 0 };

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("nombre")
    .eq("id", ranchoId)
    .maybeSingle();

  // `head` = el número, sin traerse las filas. La política de la 0060
  // ya deja al dueño contar los miembros de su programa.
  const { count } = programaId
    ? await supabase
        .from("miembros")
        .select("*", { count: "exact", head: true })
        .eq("programa_id", programaId)
    : { count: 0 };

  return {
    negocioNombre: (rancho?.nombre as string | undefined) ?? "",
    pasesEmitidos: count ?? 0,
  };
}

export type RecompensaInput = {
  nombre: string;
  descripcion: string;
  /** En modo sellos, esto ES la meta: "10 sellos". */
  costoPuntos: number;
  activo: boolean;
  /** Tipo de recompensa (0125). null = personalizada. */
  tipo: TipoRecompensa | null;
  /** % (1..100) o colones, según el tipo. Solo para descuentos. */
  valor: number | null;
  /** null = sin límite. El RPC lo CUENTA contra los canjes: no es un
   *  contador que se descuenta y se desincroniza. */
  stockTotal: number | null;
  limitePorCliente: number | null;
  /** Referencia externa para el POS. */
  sku: string;
  /** Qué debe hacer el personal al entregarla. */
  instrucciones: string;
};

export type TipoRecompensa =
  | "producto"
  | "servicio"
  | "descuento_porcentaje"
  | "descuento_fijo"
  | "personalizada";

const TIPOS_RECOMPENSA: readonly TipoRecompensa[] = [
  "producto",
  "servicio",
  "descuento_porcentaje",
  "descuento_fijo",
  "personalizada",
];

function validarRecompensa(datos: RecompensaInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 120) return "El nombre es obligatorio (máximo 120 caracteres).";
  if (datos.descripcion.trim().length > 300) return "La descripción es muy larga.";
  if (!Number.isInteger(datos.costoPuntos) || datos.costoPuntos < 1) {
    return "La recompensa tiene que costar al menos 1.";
  }
  if (datos.tipo !== null && !TIPOS_RECOMPENSA.includes(datos.tipo)) {
    return "Ese tipo de recompensa no existe.";
  }
  // Mismos rangos que recompensas_detalle_check (0125): un 150% de
  // descuento o un fijo negativo son errores de digitación.
  if (datos.tipo === "descuento_porcentaje") {
    if (datos.valor === null || !(datos.valor > 0 && datos.valor <= 100)) {
      return "El descuento porcentual va de 1 a 100.";
    }
  }
  if (datos.tipo === "descuento_fijo") {
    if (datos.valor === null || !(datos.valor > 0 && datos.valor <= 10000000)) {
      return "El descuento fijo va de ₡1 a ₡10.000.000.";
    }
  }
  if (
    datos.stockTotal !== null &&
    (!Number.isInteger(datos.stockTotal) || datos.stockTotal < 1 || datos.stockTotal > 1000000)
  ) {
    return "El stock debe estar entre 1 y 1.000.000 (vacío = sin límite).";
  }
  if (
    datos.limitePorCliente !== null &&
    (!Number.isInteger(datos.limitePorCliente) ||
      datos.limitePorCliente < 1 ||
      datos.limitePorCliente > 10000)
  ) {
    return "El límite por cliente debe estar entre 1 y 10.000.";
  }
  if (datos.sku.trim().length > 60) return "El SKU es muy largo (máximo 60).";
  if (datos.instrucciones.trim().length > 500) {
    return "Las instrucciones son muy largas (máximo 500).";
  }
  return null;
}

/**
 * Las recompensas del programa. La MÁS BARATA activa es la que marca
 * la meta de la tarjeta de sellos ("5 de 10") y la que se muestra como
 * próxima regalía — por eso no hay una columna aparte con ese número.
 */
export async function guardarRecompensa(
  ranchoId: string,
  programaId: string,
  datos: RecompensaInput,
  recompensaId?: string,
): Promise<{ error?: string; recompensa?: RecompensaFila }> {
  const invalido = validarRecompensa(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "Solo el dueño del negocio edita la tarjeta." };

  // El programa tiene que ser DE ESTE negocio: `recompensas` cuelga del
  // programa y no lleva rancho_id propio, así que sin esta comprobación
  // el id del programa vendría del navegador sin control.
  const { data: programa } = await supabase
    .from("programa_lealtad")
    .select("id")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!programa) return { error: "Ese programa no es de este negocio." };

  const fila = {
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion.trim() || null,
    costo_puntos: datos.costoPuntos,
    activo: datos.activo,
    tipo: datos.tipo,
    valor: datos.tipo?.startsWith("descuento") ? datos.valor : null,
    stock_total: datos.stockTotal,
    limite_por_cliente: datos.limitePorCliente,
    sku: datos.sku.trim() || null,
    instrucciones: datos.instrucciones.trim() || null,
  };

  const guardarCon = (f: Record<string, unknown>) =>
    recompensaId
      ? supabase
          .from("recompensas")
          .update(f)
          .eq("id", recompensaId)
          .eq("programa_id", programaId)
          .select("*")
          .single()
      : supabase
          .from("recompensas")
          .insert({ programa_id: programaId, ...f })
          .select("*")
          .single();

  let { data, error } = await guardarCon(fila);

  // Base sin la 0125: se reintenta con las columnas de la 0060 nada
  // más, para que la recompensa básica se pueda seguir editando. Igual
  // que arriba: por CÓDIGO y no por texto, porque `recompensas_detalle_check`
  // menciona `tipo` y un descuento del 150% se estaba guardando «bien»
  // con el tipo tirado a la basura.
  if (
    error &&
    esColumnaAusente(error, ["tipo", "stock_total", "limite_por_cliente", "sku", "instrucciones"])
  ) {
    ({ data, error } = await guardarCon({
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      costo_puntos: fila.costo_puntos,
      activo: fila.activo,
    }));
  }

  if (error) return { error: traducir(error, "guardar la recompensa") };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);
  return { recompensa: data as RecompensaFila };
}

export async function eliminarRecompensa(
  ranchoId: string,
  programaId: string,
  recompensaId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "Solo el dueño del negocio edita la tarjeta." };

  const { data: programa } = await supabase
    .from("programa_lealtad")
    .select("id")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!programa) return { error: "Ese programa no es de este negocio." };

  const { error } = await supabase
    .from("recompensas")
    .delete()
    .eq("id", recompensaId)
    .eq("programa_id", programaId);

  if (error) return { error: traducir(error, "eliminar la recompensa") };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);
  return {};
}

/**
 * Cambia el ciclo de vida del programa (0125).
 *
 * Las reglas viven en src/lib/lealtad/reglas.ts y se comprueban ACÁ,
 * en el servidor — el panel solo pinta los botones:
 *
 *   · activar exige reglas que otorguen algo y ≥1 recompensa activa
 *     (una tarjeta que nunca avanza ni promete nada no se publica);
 *   · con historial, archivado es para siempre y no se vuelve a
 *     borrador — el historial no se borra ni se "resetea".
 *
 * También se mantiene el booleano `activo` de la 0060 espejado, porque
 * la política de afiliación de miembros (0060) y el flujo de citas lo
 * siguen leyendo.
 */
export async function cambiarEstadoPrograma(
  ranchoId: string,
  programaId: string,
  estadoNuevo: string,
): Promise<{ error?: string; programa?: ProgramaFila }> {
  const { estadoDelPrograma, puedeActivarse, transicionValida, ESTADOS_PROGRAMA } =
    await import("@/lib/lealtad/reglas");

  if (!(ESTADOS_PROGRAMA as readonly string[]).includes(estadoNuevo)) {
    return { error: "Ese estado no existe." };
  }

  const { supabase, ok } = await guard(ranchoId);
  if (!ok) return { error: "Solo el dueño del negocio edita la tarjeta." };

  const { data: programa } = await supabase
    .from("programa_lealtad")
    .select("*")
    .eq("id", programaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!programa) return { error: "Ese programa no es de este negocio." };

  const p = programa as ProgramaFila;
  const actual = estadoDelPrograma({ estado: p.estado ?? null, activo: p.activo });

  // ¿Tiene movimientos? Decide si archivado es reversible.
  const { data: miembros } = await supabase
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId)
    .limit(1);
  const tieneMovimientos = (miembros ?? []).length > 0;

  if (!transicionValida(actual, estadoNuevo as never, tieneMovimientos)) {
    return {
      error:
        actual === "archivado"
          ? "Un programa archivado con historial no se reactiva: se crea la etapa nueva con otro programa."
          : `No se puede pasar de ${actual} a ${estadoNuevo}.`,
    };
  }

  if (estadoNuevo === "activo") {
    const { data: recompensas } = await supabase
      .from("recompensas")
      .select("id")
      .eq("programa_id", programaId)
      .eq("activo", true)
      .limit(1);
    const veredicto = puedeActivarse({
      puntos_por_visita: p.puntos_por_visita,
      puntos_por_colon: Number(p.puntos_por_colon),
      recompensasActivas: (recompensas ?? []).length,
      // ── PAUSAR YA NO ES IRREVERSIBLE ──────────────────────────────
      // La recompensa solo se le pide a quien la usa: sellos y puntos.
      // Un cupón, un descuento, una membresía, un evento o un cashback
      // nunca nacen con una sembrada —su beneficio va adentro de la
      // tarjeta— así que exigírsela dejaba a esos cinco tipos pausados
      // PARA SIEMPRE, con un mensaje («agregá una recompensa activa»)
      // que el dueño no tenía cómo obedecer.
      pideRecompensa: pideRecompensa(tipoDe(p.modo)),
    });
    if (!veredicto.puede) return { error: veredicto.motivo };
  }

  let { data, error } = await supabase
    .from("programa_lealtad")
    .update({ estado: estadoNuevo, activo: estadoNuevo === "activo" })
    .eq("id", programaId)
    .select("*")
    .single();

  // Base sin la 0125: al menos el booleano viejo queda coherente. Por
  // CÓDIGO y no por texto: `programa_lealtad_estado_check` lleva la
  // palabra «estado» adentro, así que un estado inválido se guardaba
  // como un cambio de `activo` a secas y la pantalla lo daba por bueno.
  if (error && esColumnaAusente(error, ["estado"])) {
    ({ data, error } = await supabase
      .from("programa_lealtad")
      .update({ activo: estadoNuevo === "activo" })
      .eq("id", programaId)
      .select("*")
      .single());
  }

  if (error) return { error: traducir(error, "cambiar el estado") };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);
  return { programa: data as ProgramaFila };
}
