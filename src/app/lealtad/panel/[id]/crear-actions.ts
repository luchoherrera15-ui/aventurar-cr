"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import {
  esTipoTarjeta,
  metaDe,
  validarBeneficio,
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
  cuentaId: string | null;
  ranchoId: string;
  nombre: string;
  tipo: TipoTarjeta;
  beneficio: ConfigBeneficio;
  colorFondo: string;
  colorSello: string;
  logoUrl: string;
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

  const logo = datos.logoUrl.trim();
  if (logo && !logo.startsWith("https://")) {
    return { ok: false, motivo: "El logo tiene que ser una URL https." };
  }

  // Las fechas tienen que tener sentido entre sí. Al revés, la tarjeta
  // nacería vencida y nadie entendería por qué no se puede canjear.
  const { desde, hasta } = datos.reglas;
  if (desde && hasta && hasta < desde) {
    return { ok: false, motivo: "La fecha de vencimiento no puede ser anterior a la de inicio." };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // ── 3. El tope del plan ─────────────────────────────────────────
  // Cuántos programas activos permite el paquete. Se hace cumplir acá
  // y no solo se pinta: un tope que solo se dibuja es decoración.
  const { data: rancho } = await db
    .from("ranchos")
    .select("plan_lealtad")
    .eq("id", datos.ranchoId)
    .maybeSingle();

  const { plan } = await contextoDeCuenta(
    db,
    datos.cuentaId ? { cuenta_id: datos.cuentaId } : {},
    { planRancho: (rancho?.plan_lealtad as string | null) ?? null },
  );

  const topeProgramas = definicionDe(plan)?.limites.programas ?? null;
  if (topeProgramas !== null) {
    const consulta = db
      .from("programa_lealtad")
      .select("*", { count: "exact", head: true })
      .neq("estado", "archivado");
    const { count } = datos.cuentaId
      ? await consulta.eq("cuenta_id", datos.cuentaId)
      : await consulta.eq("rancho_id", datos.ranchoId);

    if ((count ?? 0) >= topeProgramas) {
      return {
        ok: false,
        motivo: `Tu paquete permite ${topeProgramas} programa${topeProgramas === 1 ? "" : "s"}. Archivá uno o subí de paquete para crear otro.`,
      };
    }
  }

  // ── 4. Guardar ──────────────────────────────────────────────────
  // Nace en BORRADOR a propósito: publicar es una decisión aparte, y
  // una tarjeta que se activa sola al crearse empieza a emitir pases
  // antes de que nadie la haya mirado dos veces.
  const fila: Record<string, unknown> = {
    rancho_id: datos.ranchoId,
    nombre,
    modo: datos.tipo,
    beneficio: datos.beneficio,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_logo_url: logo || null,
    activo: false,
    estado: "borrador",
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
  if (datos.cuentaId) fila.cuenta_id = datos.cuentaId;

  const { data, error } = await db
    .from("programa_lealtad")
    .insert(fila)
    .select("id")
    .single();

  if (error) {
    // La 0134 agrega `cuenta_id`, la 0135 `beneficio` y la 0136 las
    // reglas. Si todavía no se corrieron, se reintenta sin ellas para
    // que el creador siga sirviendo — el programa queda con lo que la
    // base sí sabe guardar, y el resto entra cuando la migración corra.
    const faltaColumna =
      /beneficio|cuenta_id|estado|vigente_|uso_unico|max_por_cliente|max_global|dias_permitidos|hora_/.test(
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
        activo: false,
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
