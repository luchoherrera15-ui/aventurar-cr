"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { esTipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import type { ModoPrograma } from "@/lib/wallet/tarjeta";

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

function faltaLaTabla(mensaje: string) {
  if (!/programa_lealtad|recompensas/.test(mensaje)) return false;
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

function traducir(mensaje: string, accion: string) {
  if (faltaLaTabla(mensaje)) return "Faltan migraciones de lealtad en Supabase (0060/0121/0122).";
  return `No se pudo ${accion}: ${mensaje}`;
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
  const fila = {
    ...base,
    pase_banner_url: datos.bannerUrl.trim() || null,
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

  // Base sin la 0132: se reintenta con lo que la 0122 sí tiene. El
  // negocio pierde el diseño nuevo hasta que la migración corra, pero
  // no pierde el poder cambiar un color — que es lo que pasaba si esto
  // se dejaba reventar. Va ANTES de `traducir`, porque el mensaje de
  // PostgREST para una columna que falta ("Could not find …") cae en
  // `faltaLaTabla` y se traduciría a un consejo equivocado.
  if (
    error &&
    [
      "pase_banner_url",
      "pase_codigo_formato",
      "pase_texto_reverso",
      "pase_mostrar_saldo",
      "pase_mostrar_progreso",
    ].some((c) => error!.message.includes(c))
  ) {
    ({ data, error } = await guardarCon(base));
  }

  if (error) return { error: traducir(error.message, "guardar el programa") };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);
  return { programa: data as ProgramaFila };
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
  // más, para que la recompensa básica se pueda seguir editando.
  if (
    error &&
    ["tipo", "stock_total", "limite_por_cliente", "sku", "instrucciones"].some((c) =>
      error!.message.includes(c),
    )
  ) {
    ({ data, error } = await guardarCon({
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      costo_puntos: fila.costo_puntos,
      activo: fila.activo,
    }));
  }

  if (error) return { error: traducir(error.message, "guardar la recompensa") };

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

  if (error) return { error: traducir(error.message, "eliminar la recompensa") };

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
    });
    if (!veredicto.puede) return { error: veredicto.motivo };
  }

  let { data, error } = await supabase
    .from("programa_lealtad")
    .update({ estado: estadoNuevo, activo: estadoNuevo === "activo" })
    .eq("id", programaId)
    .select("*")
    .single();

  // Base sin la 0125: al menos el booleano viejo queda coherente.
  if (error && error.message.includes("estado")) {
    ({ data, error } = await supabase
      .from("programa_lealtad")
      .update({ activo: estadoNuevo === "activo" })
      .eq("id", programaId)
      .select("*")
      .single());
  }

  if (error) return { error: traducir(error.message, "cambiar el estado") };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  revalidatePath(`/admin/lealtad/${ranchoId}`);
  return { programa: data as ProgramaFila };
}
