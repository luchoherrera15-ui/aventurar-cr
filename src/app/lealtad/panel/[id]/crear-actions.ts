"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, planIncluyeTipo, planQueDesbloquea } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
import { esIconoSello, iconoDelSello, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { minutoISOCR } from "@/lib/fechas";
import { estadoAlCrear } from "./estado-inicial";
import { cupoLleno, lasQueOcupanCupo, tarjetaDelCupo } from "./cupo-tarjetas";
import {
  esTipoTarjeta,
  metaDe,
  validarBeneficio,
  TIPOS_TARJETA,
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
  /** El dibujo de cada sello (0145). null = el logo del negocio. */
  iconoSello: IconoSello | null;
  logoUrl: string;
  /** La banda de arriba del pase: `strip` en Apple, `heroImage` en Google. */
  bannerUrl: string;
  reglas: {
    desde: string;
    hasta: string;
    usoUnico: boolean;
    maxPorCliente: number | null;
    maxGlobal: number | null;
    dias: number[];
    horaDesde: string;
    horaHasta: string;
  };
};

type Resultado = { ok: true; programaId: string } | { ok: false; motivo: string };

const HEX = /^#[0-9A-Fa-f]{6}$/;

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
  if (datos.iconoSello !== null && !esIconoSello(datos.iconoSello)) {
    return { ok: false, motivo: "Ese icono de sello no existe." };
  }
  const icono = iconoDelSello({ tipo: datos.tipo, icono: datos.iconoSello });

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

  // Las fechas tienen que tener sentido entre sí. Al revés, la tarjeta
  // nacería vencida y nadie entendería por qué no se puede canjear.
  const { desde, hasta } = datos.reglas;
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

  // EL TIPO, SEGÚN EL PAQUETE (0142). La Prueba arma sellos y puntos;
  // Arranque suma cashback, cupón y descuento; de Impulso para arriba,
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
      return {
        ok: false,
        motivo:
          `Tu paquete permite ${topeProgramas} tarjeta${topeProgramas === 1 ? "" : "s"} y ya ` +
          `tenés ${nombres}. ` +
          `Archivá una desde Recompensas → Estado del programa, o subí de paquete para tener más.`,
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
  const fila: Record<string, unknown> = {
    rancho_id: datos.ranchoId,
    nombre,
    modo: datos.tipo,
    beneficio: datos.beneficio,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_sello_icono: icono,
    pase_logo_url: logo || null,
    pase_banner_url: banner || null,
    ...estadoAlCrear(),
    // El motor de puntos sigue leyendo estas dos columnas (0060). Se
    // derivan del beneficio en vez de pedirlas aparte: dos números
    // para lo mismo se separan en cuanto alguien cambia uno.
    puntos_por_visita: datos.beneficio.tipo === "puntos" ? datos.beneficio.porVisita : 1,
    puntos_por_colon: datos.beneficio.tipo === "puntos" ? datos.beneficio.porMoneda : 0,
    // Las reglas (0136). Van en columnas y no en el jsonb del
    // beneficio porque las lee el motor que autoriza un canje: una
    // regla que decide si algo procede no puede vivir donde nadie la
    // valida.
    vigente_desde: desde || null,
    vigente_hasta: hasta || null,
    uso_unico: datos.reglas.usoUnico,
    max_por_cliente: datos.reglas.maxPorCliente,
    max_global: datos.reglas.maxGlobal,
    dias_permitidos: datos.reglas.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    hora_desde: datos.reglas.horaDesde || null,
    hora_hasta: datos.reglas.horaHasta || null,
  };
  if (cuentaId) fila.cuenta_id = cuentaId;

  const { data, error } = await db
    .from("programa_lealtad")
    .insert(fila)
    .select("id")
    .single();

  if (error) {
    // La 0134 agrega `cuenta_id`, la 0135 `beneficio`, la 0136 las
    // reglas y la 0145 el icono del sello. Si todavía no se corrieron,
    // se reintenta sin ellas para que el creador siga sirviendo — el
    // programa queda con lo que la base sí sabe guardar, y el resto
    // entra cuando la migración corra. Sin la 0145, la tarjeta se crea
    // igual y el sello sale como hasta hoy: con el logo adentro.
    const faltaColumna =
      /beneficio|cuenta_id|estado|vigente_|uso_unico|max_por_cliente|max_global|dias_permitidos|hora_|pase_sello_icono/.test(
        error.message,
      );
    if (!faltaColumna) {
      return { ok: false, motivo: "No se pudo crear la tarjeta: " + error.message };
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
    if (error2) return { ok: false, motivo: "No se pudo crear la tarjeta: " + error2.message };
    await sembrarRecompensa(db, reintento.id as string, datos);
    revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
    return { ok: true, programaId: reintento.id as string };
  }

  await sembrarRecompensa(db, data.id as string, datos);
  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return { ok: true, programaId: data.id as string };
}

/**
 * La recompensa que hace de META de la tarjeta.
 *
 * La meta de un pase de sellos («5 de 10») sale de la recompensa
 * activa más barata (0121) y NO de una columna propia. Por eso una
 * tarjeta acumulativa nace con su recompensa creada: sin ella el pase
 * mostraría el saldo pelado y no prometería nada.
 *
 * Si falla, la tarjeta igual quedó creada: el dueño puede agregar la
 * recompensa a mano desde el panel. Perder el programa entero por esto
 * sería peor.
 */
async function sembrarRecompensa(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  programaId: string,
  datos: BorradorTarjeta,
) {
  const meta = metaDe(datos.beneficio);
  if (meta === null) return;

  const nombre =
    datos.beneficio.tipo === "sellos"
      ? datos.beneficio.recompensa.trim()
      : datos.beneficio.tipo === "giftcard"
        ? "Saldo de regalo"
        : "Tu regalía";
  if (!nombre) return;

  await db.from("recompensas").insert({
    programa_id: programaId,
    nombre,
    costo_puntos: Math.max(1, Math.round(meta)),
    activo: true,
  });
}
