"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, planIncluyeTipo, planQueDesbloquea } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import {
  esSelloElegido,
  selloParaGuardar,
  SELLO_PROPIO,
  urlDeIconoPropio,
  type SelloElegido,
} from "@/lib/lealtad/iconos-sello";
import { comprobarImagenSubida } from "@/lib/media/comprobar-imagen-subida";
import { minutoISOCR } from "@/lib/fechas";
import { acumulacionDe, recompensaInicial, traducirErrorDeBase } from "@/lib/lealtad/mostrador";
import { sembrarRecompensa } from "@/lib/lealtad/sembrar-recompensa";
import { esColumnaAusente } from "@/lib/lealtad/errores-base";
import { mesesGuardables } from "@/lib/lealtad/vencimiento-sellos";
import { elegirPrograma, resumenDeFila } from "@/lib/wallet/programa-principal";
import { estadoAlCrear } from "./estado-inicial";
import { cupoLleno, lasQueOcupanCupo, tarjetaDelCupo } from "./cupo-tarjetas";
import {
  esTipoTarjeta,
  leerBeneficio,
  validarBeneficio,
  TIPOS_TARJETA,
  tipoDe,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";

/**
 * Crear una tarjeta desde el asistente de cinco pasos.
 *
 * ------------------------------------------------------------------
 * ACÁ SE DECIDE, NO EN EL FORMULARIO
 * ------------------------------------------------------------------
 * El asistente valida mientras se escribe para avisar temprano, pero
 * NO autoriza nada: una petición armada a mano no pasa por ese código.
 * Todo lo que importa se vuelve a comprobar de este lado —el permiso,
 * el tipo, la forma del beneficio y el tope del plan— porque es el
 * único lado que el navegador no puede saltarse.
 */

export type BorradorTarjeta = {
  /**
   * NO HAY `cuentaId` ACÁ, Y ES A PROPÓSITO.
   *
   * Lo había, y era el agujero más caro del módulo: viajaba
   * servidor→cliente→servidor, el guard validaba `ranchoId` y nunca
   * `cuentaId`, y detrás corría `createAdminClient()` con la RLS fuera
   * de juego. Con un `cuenta_id` ajeno —uno real, no inventado, así
   * que la FK no lo frenaba— se podía: leer el plan de otro negocio y
   * heredar su tope, hacer que el contador de programas diera 0 y
   * saltarse el límite entero, y sobre todo INSERTAR una tarjeta
   * dentro de la cuenta de otro.
   *
   * Y desde la 0138, `pertenece_a_cuenta(cuenta_id)` es la llave de
   * lectura de `personas` y `consentimientos_persona`: esa escritura
   * cruzada se convertía en lectura cruzada de datos personales.
   *
   * La cuenta se deriva del `ranchoId` en el servidor. Un dato que el
   * servidor puede averiguar solo nunca debería pedírselo al navegador.
   */
  ranchoId: string;
  nombre: string;
  tipo: TipoTarjeta;
  beneficio: ConfigBeneficio;
  colorFondo: string;
  colorSello: string;
  /**
   * El dibujo de cada sello (0145). null = el logo del negocio;
   * 'propio' = el archivo de `iconoUrl` (0174).
   */
  iconoSello: SelloElegido | null;
  /** El ícono propio que subió el negocio (0174). */
  iconoUrl: string;
  logoUrl: string;
  /** La banda de arriba del pase: `strip` en Apple, `heroImage` en Google. */
  bannerUrl: string;
  /** El logo del AVISO de Wallet (0208) — no el de la tarjeta. */
  notificacionLogoUrl: string;
  reglas: {
    desde: string;
    /** true = la tarjeta de cada cliente vale desde su primer sello o
     *  bono — sin fecha fija de inicio (la 0195). Excluyente con
     *  `desde`. */
    desdePrimerSello: boolean;
    hasta: string;
    usoUnico: boolean;
    maxPorCliente: number | null;
    maxGlobal: number | null;
    dias: number[];
    horaDesde: string;
    horaHasta: string;
  };
  /**
   * Meses de inactividad tras los cuales los sellos del cliente se
   * reinician (0180). null = no vencen nunca, que es como nace toda
   * tarjeta. Solo tiene efecto en las de sellos: el servidor lo
   * descarta en los otros siete tipos.
   */
  sellosVencenMeses: number | null;
};

type Resultado = { ok: true; programaId: string } | { ok: false; motivo: string };

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * El tope del ícono propio (0174), en bytes: el MISMO número que
 * muestra la pantalla al subir. Se vuelve a exigir de este lado porque
 * el archivo no viaja por acá — lo sube el navegador directo al bucket.
 */
const MAX_BYTES_ICONO = 2 * 1024 * 1024;

/**
 * Las columnas que la tarjeta puede perder si la base va atrás.
 *
 * Es la lista EXACTA de lo que el reintento de abajo deja de escribir:
 * pedir más de lo que se degrada haría que un `PGRST204` de otra
 * columna disparara un reintento que guarda de menos.
 */
const COLUMNAS_DEGRADABLES = [
  "beneficio",
  "cuenta_id",
  "estado",
  "pase_banner_url",
  "pase_notificacion_logo_url",
  "pase_sello_icono",
  "pase_sello_icono_url",
  "compra_minima",
  "vigente_desde",
  "vigencia_desde_primer_sello",
  "vigente_hasta",
  "uso_unico",
  "max_por_cliente",
  "max_global",
  "dias_permitidos",
  "hora_desde",
  "hora_hasta",
  "sellos_vencen_meses",
  "sellos_vencen_desde",
] as const;

export async function crearTarjeta(datos: BorradorTarjeta): Promise<Resultado> {
  // ── 1. Quién ────────────────────────────────────────────────────
  const { user, ok } = await verificarAccesoRancho(datos.ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "Solo el dueño del negocio crea tarjetas." };

  // ── 2. Qué ──────────────────────────────────────────────────────
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 80) {
    return { ok: false, motivo: "El nombre es obligatorio (máximo 80 caracteres)." };
  }
  if (!esTipoTarjeta(datos.tipo)) return { ok: false, motivo: "Ese tipo de tarjeta no existe." };

  // El tipo del beneficio TIENE que ser el mismo que el de la tarjeta.
  // Si no se comprobara, se podría guardar una tarjeta de sellos con
  // la config de una gift card: el pase se dibujaría de una forma y el
  // canje se resolvería de otra.
  const esperado: string = datos.tipo === "descuento" ? "descuento" : datos.tipo;
  if (datos.beneficio?.tipo !== esperado) {
    return { ok: false, motivo: "La configuración no corresponde a ese tipo de tarjeta." };
  }

  const invalido = validarBeneficio(datos.beneficio);
  if (invalido) return { ok: false, motivo: invalido };

  // Un color mal escrito no falla al dibujar: sale un cuadro negro y
  // nadie sabe por qué (mismo criterio que la 0122).
  if (!HEX.test(datos.colorFondo)) return { ok: false, motivo: "El color de fondo tiene que ser #RRGGBB." };
  if (!HEX.test(datos.colorSello)) return { ok: false, motivo: "El color del acento tiene que ser #RRGGBB." };

  // ── EL ICONO DEL SELLO (0145) ───────────────────────────────────
  // Un id fuera del catálogo se RECHAZA en vez de guardarse: la columna
  // tiene su CHECK, pero un error del que el usuario se entera acá dice
  // qué pasó, y el de Postgres no está escrito para nadie. Y en un tipo
  // que no es sellos el icono no se rechaza —no es culpa de nadie— se
  // descarta, porque no hay círculos donde dibujarlo.
  if (datos.iconoSello !== null && !esSelloElegido(datos.iconoSello)) {
    return { ok: false, motivo: "Ese icono de sello no existe." };
  }
  // El ícono PROPIO (0174) es un archivo del negocio, así que pasa por
  // los mismos tres filtros que el logo y la banda: forma de la URL,
  // que sea de NUESTRO storage, y que el objeto sea de verdad una
  // imagen. Los dos primeros son gratis; el tercero es una llamada de
  // red y por eso va después de que todo lo demás ya pasó.
  const iconoUrl = datos.iconoUrl.trim();
  if (iconoUrl && urlDeIconoPropio(iconoUrl) === null) {
    return { ok: false, motivo: "El ícono no se subió bien — probá de nuevo." };
  }
  if (datos.iconoSello === SELLO_PROPIO && !iconoUrl) {
    return { ok: false, motivo: "Subí tu ícono antes de elegirlo como sello." };
  }
  const sello = selloParaGuardar({
    tipo: datos.tipo,
    icono: datos.iconoSello,
    url: iconoUrl,
  });

  // ── LAS IMÁGENES TIENEN QUE SER NUESTRAS ────────────────────────
  // Antes alcanzaba con que empezara por `https://`, porque el campo
  // era una URL que el dueño pegaba a mano. Ahora las sube el
  // componente directo a nuestro bucket, así que se puede exigir lo
  // correcto: que la URL SEA de nuestro storage.
  //
  // No es formalismo. Una URL ajena en el pase significa que un tercero
  // decide qué imagen ve el cliente en su teléfono —y puede cambiarla,
  // o borrarla y dejar el pase roto— para siempre, porque el pase ya
  // está instalado. `esUrlDeNuestroStorage` valida con `URL` y no con
  // `startsWith`, que es lo que ya rompió el logo en producción una vez
  // (una barra de más en la variable de entorno).
  const logo = datos.logoUrl.trim();
  if (logo && !esUrlDeNuestroStorage(logo, "ranchos-fotos")) {
    return { ok: false, motivo: "El logo no se subió bien — probá de nuevo." };
  }

  const banner = datos.bannerUrl.trim();
  if (banner && !esUrlDeNuestroStorage(banner, "ranchos-fotos")) {
    return { ok: false, motivo: "La banda no se subió bien — probá de nuevo." };
  }

  const notificacionLogo = datos.notificacionLogoUrl.trim();
  if (notificacionLogo && !esUrlDeNuestroStorage(notificacionLogo, "ranchos-fotos")) {
    return { ok: false, motivo: "El logo de notificaciones no se subió bien — probá de nuevo." };
  }

  if (sello.url) {
    if (!esUrlDeNuestroStorage(sello.url, "ranchos-fotos")) {
      return { ok: false, motivo: "El ícono no se subió bien — probá de nuevo." };
    }
    // Que sea de nuestro bucket no dice qué hay adentro: el archivo lo
    // sube el navegador directo al storage, así que el tipo real y el
    // tamaño se comprueban ACÁ (`comprobarImagenSubida`), leyendo los
    // primeros bytes del objeto.
    const revision = await comprobarImagenSubida(sello.url, { maxBytes: MAX_BYTES_ICONO });
    if (!revision.ok) return { ok: false, motivo: revision.motivo };
  }

  // Las fechas tienen que tener sentido entre sí. Al revés, la tarjeta
  // nacería vencida y nadie entendería por qué no se puede canjear.
  // Con «desde el primer sello» (0195) la fecha fija de inicio no
  // aplica: se descarta acá aunque el navegador la mandara igual.
  const desde = datos.reglas.desdePrimerSello ? "" : datos.reglas.desde;
  const { hasta } = datos.reglas;
  if (desde && hasta && hasta < desde) {
    return { ok: false, motivo: "La fecha de vencimiento no puede ser anterior a la de inicio." };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // ── 3. Los topes del plan ───────────────────────────────────────
  // Cuántos programas activos permite el paquete, y de QUÉ TIPOS. Se
  // hacen cumplir acá y no solo se pintan: un tope que solo se dibuja
  // es decoración — el selector del creador esconde o bloquea lo que
  // quiera, pero una petición armada a mano no pasa por esa pantalla.
  const { data: rancho } = await db
    .from("ranchos")
    .select("plan_lealtad")
    .eq("id", datos.ranchoId)
    .maybeSingle();

  // LA CUENTA SE DERIVA ACÁ, del rancho que el guard ya verificó que es
  // de quien llama. `maybeSingle` porque mientras la 0134 no esté
  // pegada la tabla no existe y esto devuelve null sin romper nada — el
  // programa nace colgado solo del rancho, como hasta hoy.
  const { data: cuenta } = await db
    .from("cuentas")
    .select("id")
    .eq("rancho_id", datos.ranchoId)
    .maybeSingle();
  const cuentaId = (cuenta?.id as string | undefined) ?? null;

  const { plan } = await contextoDeCuenta(
    db,
    cuentaId ? { cuenta_id: cuentaId } : {},
    { planRancho: (rancho?.plan_lealtad as string | null) ?? null },
  );

  // ── SIN PLAN, ¿NUNCA TUVO NADA O SOLO SE DESINCRONIZÓ EL CAMPO? ──
  // `tiposDelPlan(null)` (planes.ts) devuelve los 8 tipos A PROPÓSITO
  // para no dejar sin poder tocar SU PROPIA tarjeta a un negocio que
  // YA es cliente y cuyo `plan_lealtad` quedó sin sincronizar -esa
  // doctrina protege al que YA tiene algo. Pero acá, crear la PRIMERA
  // tarjeta con `plan === null`, casi siempre significa que el negocio
  // nunca contrató lealtad -es el valor por defecto de TODO negocio
  // del marketplace (0124)-, y dejarlo seguir regalaría el paquete
  // Ilimitado gratis a cualquier negocio publicado, sin Stripe, sin
  // SINPE, sin aprobación de nadie. La distinción es simple: si no
  // tiene NINGÚN programa todavía, no hay nada que proteger.
  if (plan === null) {
    const { count } = await db
      .from("programa_lealtad")
      .select("id", { count: "exact", head: true })
      .eq("rancho_id", datos.ranchoId);
    if (!count) {
      return {
        ok: false,
        motivo: "Este negocio todavía no tiene un paquete de lealtad — elegí uno en /lealtad/planes antes de crear una tarjeta.",
      };
    }
  }

  // EL TIPO, SEGÚN EL PAQUETE (0142). La Prueba arma sellos, puntos y
  // cashback; Arranque suma cupón y descuento; de Impulso para arriba,
  // los ocho. El mensaje dice CUÁL paquete lo abre: un «no podés» a
  // secas no se puede ni obedecer.
  if (!planIncluyeTipo(plan, datos.tipo)) {
    const abre = planQueDesbloquea(datos.tipo);
    const nombreTipo = TIPOS_TARJETA[datos.tipo].nombre.toLowerCase();
    return {
      ok: false,
      motivo: abre
        ? `Las tarjetas de ${nombreTipo} vienen con el paquete ${abre.nombre}. Subí de paquete para armarla.`
        : `Tu paquete no incluye las tarjetas de ${nombreTipo}.`,
    };
  }

  const topeProgramas = definicionDe(plan)?.limites.programas ?? null;
  if (topeProgramas !== null) {
    // Se piden los NOMBRES y no solo el conteo: un «llegaste al tope»
    // sin decir qué lo ocupa es un callejón sin salida. Le pasó al
    // dueño con una tarjeta en borrador que ninguna pantalla mostraba.
    //
    // `select *` y el filtro EN CÓDIGO, no un `.neq("estado", ...)`:
    //   · el criterio tiene que ser LITERALMENTE el mismo que pinta el
    //     panel (`cupo-tarjetas.ts`), o archivar no libera lo que el
    //     aviso promete que libera;
    //   · en SQL, `estado <> 'archivado'` también descarta las filas con
    //     `estado` NULL —las anteriores a la 0125—, que están vivas;
    //   · y una lista de columnas explícita se rompe entera contra una
    //     base que va una migración atrás.
    const consulta = db.from("programa_lealtad").select("*");
    const { data: ocupan } = cuentaId
      ? await consulta.eq("cuenta_id", cuentaId)
      : await consulta.eq("rancho_id", datos.ranchoId);

    const ahoraCR = minutoISOCR();
    const existentes = lasQueOcupanCupo(
      ((ocupan ?? []) as Record<string, unknown>[]).map(tarjetaDelCupo),
      ahoraCR,
    );
    if (cupoLleno({ ocupadas: existentes.length, tope: topeProgramas })) {
      const nombres = existentes
        .map((p) => `«${p.nombre}»${p.estado === "borrador" ? " (en borrador)" : ""}`)
        .join(", ");
      // EL CAMINO QUE ESTE MENSAJE MANDA A HACER TIENE QUE EXISTIR.
      // Decía «Archivá una desde Recompensas → Estado del programa», y
      // ese camino ya no existe: cada tarjeta se abre desde «Tarjetas» y
      // se archiva desde su propia sección Estado. Un aviso que manda a
      // una pantalla que no está deja al dueño sin salida — con el cupo
      // lleno y sin forma de liberarlo.
      //
      // La frase es la MISMA que pinta el aviso de tope en la lista
      // (`seccion-programas.tsx`): dos textos distintos para el mismo
      // trámite mandan a dos lugares y uno de los dos siempre está viejo.
      return {
        ok: false,
        motivo:
          `Tu paquete permite ${topeProgramas} tarjeta${topeProgramas === 1 ? "" : "s"} y ya ` +
          `tenés ${nombres}. ` +
          `Abrí desde Tarjetas la que ya no usás y archivala desde Estado —el cupo se libera ` +
          `al instante—, o subí de paquete para tener más.`,
      };
    }
  }

  // ── 4. Guardar ──────────────────────────────────────────────────
  // NACE ACTIVA. Antes nacía en borrador «porque publicar es una
  // decisión aparte», y eso rompía el producto entero de la peor
  // manera: en silencio y diciendo lo contrario.
  //
  // El asistente termina en un paso que dice «Revisar — una última
  // mirada antes de publicar», el botón dice «Publicar tarjeta»,
  // mientras guarda dice «Publicando…» y la pantalla de éxito dice
  // «quedó publicada». Cuatro veces. Y la fila quedaba en `borrador`
  // con `activo: false`.
  //
  // Consecuencias reales, verificadas contra producción: la tarjeta no
  // emitía UN SOLO pase, así que el dueño reportó «no se ve la imagen
  // en el pase» cuando lo que no había era pase. Y al intentar de nuevo
  // se topaba con el límite de tarjetas del paquete, porque ese
  // borrador invisible ya ocupaba el cupo — sin ninguna pantalla que le
  // dijera que existía.
  //
  // La cautela de «que nadie publique sin mirarla dos veces» ya la
  // cumple el paso de Revisar. Un botón que promete publicar, publica.
  const acumula = acumulacionDe(datos.beneficio);
  const vencenMeses = mesesGuardables(datos.tipo, datos.sellosVencenMeses);

  const fila: Record<string, unknown> = {
    rancho_id: datos.ranchoId,
    nombre,
    modo: datos.tipo,
    beneficio: datos.beneficio,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_sello_icono: sello.icono,
    pase_sello_icono_url: sello.url,
    pase_logo_url: logo || null,
    pase_banner_url: banner || null,
    pase_notificacion_logo_url: notificacionLogo || null,
    ...estadoAlCrear(),
    // ── LO QUE LA TARJETA ACUMULA ───────────────────────────────
    // El motor (`acreditar_lealtad`, 0125) calcula
    // `puntos_por_visita + floor(puntos_por_colon × monto)` y NO mira
    // el jsonb del beneficio: estas dos columnas son lo ÚNICO que
    // decide cuánto recibe el cliente.
    //
    // Acá decía `tipo === "puntos" ? ... : 1` y `: 0`. O sea que una
    // tarjeta creada como «Cashback 5%» —que el asistente le confirma
    // al dueño como «5% de vuelta»— acreditaba 1 punto por visita y 0%
    // de la compra: el cliente no recibía su devolución NUNCA. Y una
    // gift card de ₡10.000 sumaba 1 por visita, o sea diez mil visitas
    // para llenarla.
    //
    // La derivación vive en `acumulacionDe` (mostrador.ts) y la comparte
    // con el editor: dos derivaciones para las mismas dos columnas se
    // separan el día que alguien toca una.
    puntos_por_visita: acumula.porVisita,
    puntos_por_colon: acumula.porColon,
    compra_minima: acumula.compraMinima,
    // Las reglas (0136). Van en columnas y no en el jsonb del
    // beneficio porque las lee el motor que autoriza un canje: una
    // regla que decide si algo procede no puede vivir donde nadie la
    // valida.
    vigente_desde: desde || null,
    vigencia_desde_primer_sello: datos.reglas.desdePrimerSello === true,
    vigente_hasta: hasta || null,
    uso_unico: datos.reglas.usoUnico,
    max_por_cliente: datos.reglas.maxPorCliente,
    max_global: datos.reglas.maxGlobal,
    dias_permitidos: datos.reglas.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    hora_desde: datos.reglas.horaDesde || null,
    hora_hasta: datos.reglas.horaHasta || null,
    // El vencimiento de sellos por inactividad (0180). Se sanea acá y
    // no en el navegador: el rango lo vuelve a exigir el CHECK, y solo
    // las tarjetas de SELLOS lo llevan — en una gift card o un
    // cashback el saldo es plata, y eso no se vence por no volver.
    sellos_vencen_meses: vencenMeses,
    // Y el reloj arranca HOY, nunca antes: ver el encabezado de la
    // 0180. En una tarjeta recién creada no hay nadie adentro, así que
    // es lo mismo — pero dejarlo null acá haría que la primera edición
    // tuviera que adivinar cuándo se encendió.
    sellos_vencen_desde: vencenMeses === null ? null : new Date().toISOString(),
  };
  if (cuentaId) fila.cuenta_id = cuentaId;

  const { data, error } = await db
    .from("programa_lealtad")
    .insert(fila)
    .select("id")
    .single();

  if (error) {
    // La 0125 agrega `compra_minima`, la 0134 `cuenta_id`, la 0135
    // `beneficio`, la 0136 las reglas y la 0145 el icono del sello. Si
    // todavía no se corrieron, se reintenta sin ellas para que el
    // creador siga sirviendo — el programa queda con lo que la base sí
    // sabe guardar, y el resto entra cuando la migración corra. Sin la
    // 0145 (o sin la 0174, que suma el ícono propio), la tarjeta se
    // crea igual y el sello sale como hasta hoy: con el logo adentro.
    //
    // ── SE DECIDE POR CÓDIGO, NO POR EL TEXTO ────────────────────
    // Acá había un regex sobre `error.message` con los nombres de las
    // columnas. Desde la 0132/0145 esos nombres también aparecen en los
    // nombres de los CHECK que las cuidan
    // (`programa_lealtad_pase_sello_icono_check`), así que un valor
    // RECHAZADO por un CHECK se leía como «esa columna no existe», se
    // reintentaba sin ella, el reintento entraba… y la tarjeta nacía
    // sin la banda, sin el icono y sin las reglas que el dueño acababa
    // de elegir, diciéndole que se había creado bien.
    //
    // `esColumnaAusente` (errores-base.ts) mira el CÓDIGO: PGRST204 y
    // 42703 son «no existe la columna»; 23514 es «existe y el valor no
    // pasa su CHECK», y ese NUNCA se degrada.
    const faltaColumna = esColumnaAusente(error, COLUMNAS_DEGRADABLES);
    if (!faltaColumna) {
      // El texto de Postgres («null value in column "x" violates
      // not-null constraint») no está escrito para el dueño de una
      // barbería. `traducirErrorDeBase` deja pasar NUESTROS mensajes
      // —los `raise exception` de las 0129/0146/0148, que sí están
      // escritos para él— y registra el resto en el servidor.
      return { ok: false, motivo: traducirErrorDeBase(error, "crear la tarjeta") };
    }
    const { data: reintento, error: error2 } = await db
      .from("programa_lealtad")
      .insert({
        rancho_id: datos.ranchoId,
        nombre,
        modo: datos.tipo,
        pase_color_fondo: datos.colorFondo,
        pase_color_sello: datos.colorSello,
        pase_logo_url: logo || null,
        // Activa también acá: en una base sin la columna `estado`, este
        // booleano es lo ÚNICO que decide si la tarjeta opera.
        activo: true,
        puntos_por_visita: fila.puntos_por_visita,
        puntos_por_colon: fila.puntos_por_colon,
      })
      .select("id")
      .single();
    if (error2) return { ok: false, motivo: traducirErrorDeBase(error2, "crear la tarjeta") };
    await sembrarRecompensa(db, reintento.id as string, datos.beneficio);
    revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
    return { ok: true, programaId: reintento.id as string };
  }

  await sembrarRecompensa(db, data.id as string, datos.beneficio);
  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return { ok: true, programaId: data.id as string };
}

// `sembrarRecompensa` vivía acá; hoy está en
// src/lib/lealtad/sembrar-recompensa.ts porque también la llama el
// asistente de alta de /lealtad/nuevo. El comentario grande de por qué
// siembra los OCHO tipos —y no tres— se fue con ella.

/**
 * REPARAR una tarjeta que nació sin nada canjeable.
 *
 * Las tarjetas de los cinco tipos que `sembrarRecompensa` se saltaba ya
 * están creadas en producción y siguen sin recompensa: arreglar el
 * sembrado no las alcanza hacia atrás. Esto las alcanza.
 *
 * Se llama desde el mostrador, que es donde el problema se nota (no
 * aparece el botón de canje), y NO hace nada si la tarjeta ya tiene una
 * recompensa activa: no es un botón que reescriba lo que el dueño
 * configuró, es uno que llena lo que quedó vacío.
 *
 * Solo el dueño: crear el premio de la tarjeta es configuración, no
 * operación de mostrador.
 */
export async function sembrarBeneficioFaltante(
  ranchoId: string,
): Promise<{ ok: true; nombre: string } | { ok: false; motivo: string }> {
  const { user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) {
    return {
      ok: false,
      motivo: "Esto lo configura el dueño del negocio — pedíselo y en un minuto queda.",
    };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // LA MISMA tarjeta que el panel y el pase: `elegirPrograma`. Con un
  // criterio propio acá se le sembraría el premio a una tarjeta y el
  // mostrador seguiría mirando la otra.
  const { data: filas } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", ranchoId);
  const todas = (filas ?? []) as Record<string, unknown>[];
  const elegida = elegirPrograma(todas.map(resumenDeFila), minutoISOCR());
  const fila = elegida ? (todas.find((f) => f.id === elegida.id) ?? null) : null;
  if (!fila) return { ok: false, motivo: "Este negocio todavía no tiene ninguna tarjeta." };
  const programaId = fila.id as string;

  const { data: yaHay } = await db
    .from("recompensas")
    .select("id")
    .eq("programa_id", programaId)
    .eq("activo", true)
    .limit(1);
  if ((yaHay ?? []).length > 0) {
    return { ok: false, motivo: "Esta tarjeta ya tiene su premio configurado." };
  }

  const beneficio = leerBeneficio(fila.beneficio, tipoDe(fila.modo as string | null));
  if (!beneficio) {
    return {
      ok: false,
      motivo:
        "Esta tarjeta no guardó la configuración de su beneficio. Armá el premio a mano en Recompensas.",
    };
  }

  const receta = recompensaInicial(beneficio);
  if (!receta) {
    return {
      ok: false,
      motivo: "Falta decir qué se gana con esta tarjeta. Completalo en Recompensas.",
    };
  }

  await sembrarRecompensa(db, programaId, beneficio);

  const { data: quedo } = await db
    .from("recompensas")
    .select("id")
    .eq("programa_id", programaId)
    .eq("activo", true)
    .limit(1);
  if (!(quedo ?? []).length) {
    return { ok: false, motivo: "No se pudo crear el premio. Probá desde Recompensas." };
  }

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true, nombre: receta.nombre };
}
