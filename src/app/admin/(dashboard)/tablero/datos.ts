import { createAdminClient } from "@/lib/supabase/admin";
import { fechaISOCR, hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { perteneceASeccion, type SeccionAdmin } from "../vertical";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  LOS NÚMEROS DEL TABLERO
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── TODO CON LA LLAVE DE SERVICIO, Y NO POR PEREZA ─────────────────
 * `pases_wallet`, `cobros_modulo` y `pedidos_invitacion` NO tienen
 * política de lectura para el admin: con la sesión devuelven CERO
 * FILAS Y NINGÚN ERROR. O sea que el tablero mostraría un cero
 * tranquilo donde hay ocho pases y dos pedidos. Y `ranchos` perdió el
 * select de tabla completa para `authenticated` en la 0155.
 *
 * Por eso, si no hay llave de servicio, esto NO devuelve ceros:
 * devuelve `sinLlave: true` y la pantalla lo dice en rojo. Un cero
 * falso en un tablero es peor que un tablero que avisa que está roto.
 *
 * ── LOS DÍAS SE CUENTAN EN HORA DE COSTA RICA ──────────────────────
 * Vercel corre en UTC. Agrupar ahí corre el corte del día seis horas:
 * todo lo que pasa entre las 6pm y la medianoche tica cae en el día
 * siguiente. `fechaISOCR` es lo que lo evita.
 *
 * ── ESTE ARCHIVO ES DE SERVIDOR Y NO SE IMPORTA DESDE EL NAVEGADOR ─
 * Usa la llave de servicio. Un import desde un módulo "use client" la
 * filtraría al bundle — y ya rompió Finanzas e IA por menos.
 */

/** Cuántos días mira el tablero. */
export const DIAS = 30;
/** Cuántos meses mira el libro de plata. */
export const MESES = 6;

export type Serie = { dia: string; valor: number }[];

export type Metrica = {
  /** Los últimos 7 días. */
  semana: number;
  /** Los 7 anteriores, para comparar. `null` = no hay con qué. */
  semanaPrevia: number | null;
  /** El total de la ventana de 30 días. */
  total: number;
  serie: Serie;
};

export type LibroMes = {
  /** "2026-08" */
  mes: string;
  reservas: number;
  modulos: number;
  invitaciones: number;
};

export type DatosTablero = {
  sinLlave: boolean;
  /** Las consultas que tocaron el techo de 1000 filas de PostgREST. */
  seriesTruncadas: string[];
  desde: string;
  hasta: string;
  reservas: Metrica;
  clientes: Metrica;
  pases: Metrica;
  pedidos: Metrica;
  /** Apple / Google de los pases de la ventana. */
  pasesPorPlataforma: { apple: number; google: number };
  libro: LibroMes[];
  /** Lo que entró en dólares (módulos). Va aparte: no hay tipo de
   *  cambio guardado por transacción, así que sumarlo a los colones
   *  sería inventar una cifra. */
  dolaresDelMes: number;
  publicaciones: { publicadas: number; pendientes: number };
  /** Última fecha con movimiento en `cobros_plataforma`. */
  ultimoDevengo: string | null;
};

/** Una serie de 30 días, con los días sin nada en cero. */
function serieDesde(fechas: string[], desde: string, dias: number): Serie {
  const cuenta = new Map<string, number>();
  for (const f of fechas) cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
  const salida: Serie = [];
  for (let i = 0; i < dias; i++) {
    const dia = sumarDiasISO(desde, i);
    salida.push({ dia, valor: cuenta.get(dia) ?? 0 });
  }
  return salida;
}

/** La métrica completa a partir de las fechas crudas de cada fila. */
function metricaDe(fechas: string[], hoy: string): Metrica {
  const desde = sumarDiasISO(hoy, -(DIAS - 1));
  const serie = serieDesde(fechas, desde, DIAS);
  const ultimos = (n: number, salto: number) =>
    serie.slice(Math.max(0, DIAS - n - salto), DIAS - salto).reduce((s, d) => s + d.valor, 0);
  const semana = ultimos(7, 0);
  const previa = ultimos(7, 7);
  return {
    semana,
    // Si la semana previa fue cero no se compara: un "+300%" contra
    // cero, o un infinito, no le dice nada a nadie.
    semanaPrevia: previa === 0 ? null : previa,
    total: serie.reduce((s, d) => s + d.valor, 0),
    serie,
  };
}

/** "2026-08" del mes de hoy en Costa Rica, y los anteriores. */
function ultimosMeses(hoy: string, cuantos: number): string[] {
  const [y, m] = hoy.split("-").map(Number);
  const salida: string[] = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    salida.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return salida;
}

const TECHO_POSTGREST = 1000;

export async function datosDelTablero(seccion: SeccionAdmin): Promise<DatosTablero> {
  const hoy = hoyISOCR();
  const desde = sumarDiasISO(hoy, -(DIAS - 1));
  const meses = ultimosMeses(hoy, MESES);

  const vacia: Metrica = { semana: 0, semanaPrevia: null, total: 0, serie: [] };
  const db = createAdminClient();
  if (!db) {
    return {
      sinLlave: true,
      seriesTruncadas: [],
      desde,
      hasta: hoy,
      reservas: vacia,
      clientes: vacia,
      pases: vacia,
      pedidos: vacia,
      pasesPorPlataforma: { apple: 0, google: 0 },
      libro: [],
      dolaresDelMes: 0,
      publicaciones: { publicadas: 0, pendientes: 0 },
      ultimoDevengo: null,
    };
  }

  // El corte de la ventana como timestamp. Se pide desde 60 días atrás
  // para poder comparar la semana contra la anterior sin una segunda
  // consulta.
  const desde60 = `${sumarDiasISO(hoy, -59)}T00:00:00-06:00`;
  const desdeMeses = `${meses[0]}-01T00:00:00-06:00`;
  const truncadas: string[] = [];
  const avisarSiTope = (nombre: string, n: number) => {
    if (n >= TECHO_POSTGREST) truncadas.push(nombre);
  };

  const [ranchosRes, reservasRes, perfilesRes, pedidosRes, programasRes, cobrosRes, modulosRes] =
    await Promise.all([
      db.from("ranchos").select("id, vertical, estado, created_at"),
      db
        .from("reservas")
        .select("id, created_at, rancho_id, estado, origen")
        .gte("created_at", desde60),
      db.from("perfiles").select("id, created_at").gte("created_at", desde60),
      db
        .from("pedidos_invitacion")
        .select("id, created_at, estado, monto_crc, precio_crc, pagado_en")
        .gte("created_at", desdeMeses),
      db.from("programa_lealtad").select("id, rancho_id"),
      db
        .from("cobros_plataforma")
        .select("rancho_id, monto, estado, devengado_en")
        .neq("estado", "anulado")
        .gte("devengado_en", desdeMeses),
      db
        .from("cobros_modulo")
        .select("rancho_id, monto, moneda, cobrado_en")
        .is("anulado_en", null)
        .eq("es_cortesia", false)
        .gte("cobrado_en", desdeMeses),
    ]);

  const ranchos = (ranchosRes.data ?? []) as {
    id: string;
    vertical: string | null;
    estado: string | null;
    created_at: string | null;
  }[];
  const verticalDe = new Map(ranchos.map((r) => [r.id, r.vertical]));
  /** ¿Esta fila entra en la sección elegida? Sin negocio, no. */
  const enSeccion = (ranchoId: string | null | undefined) =>
    seccion === "todas" ||
    (ranchoId != null && perteneceASeccion(verticalDe.get(ranchoId) ?? null, seccion));

  // ── Reservas ──────────────────────────────────────────────────────
  // Fuera los holds del carrito, los bloqueos del dueño y lo importado
  // del calendario: son estados internos, no reservas que alguien hizo.
  const reservas = (reservasRes.data ?? []) as {
    created_at: string;
    rancho_id: string | null;
    estado: string | null;
    origen: string | null;
  }[];
  avisarSiTope("reservas", reservas.length);
  const reservasReales = reservas
    .filter((r) => r.estado !== "temporal" && r.estado !== "bloqueada")
    .filter((r) => r.origen !== "sync")
    .filter((r) => enSeccion(r.rancho_id));

  // ── Clientes ──────────────────────────────────────────────────────
  // Sin filtrar por rol: desde la 0086 toda cuenta nace 'cliente' y
  // asciende a dueño al publicar, así que contar rol='cliente' achicaría
  // el pasado solo. Y no se filtra por sección: una cuenta no pertenece
  // a una vertical.
  const perfiles = (perfilesRes.data ?? []) as { created_at: string | null }[];
  avisarSiTope("perfiles", perfiles.length);

  // ── Pases de lealtad ──────────────────────────────────────────────
  // Dos saltos: el pase es del miembro, el miembro del programa, el
  // programa del negocio. Solo columnas de la 0060 — pedir `activo` o
  // `pase_en_pausa` haría fallar la consulta entera en una base sin las
  // migraciones nuevas pegadas.
  const programas = (programasRes.data ?? []) as { id: string; rancho_id: string | null }[];
  const programasDeLaSeccion = programas.filter((p) => enSeccion(p.rancho_id)).map((p) => p.id);

  let pasesFechas: string[] = [];
  const porPlataforma = { apple: 0, google: 0 };
  if (programasDeLaSeccion.length > 0) {
    const { data: miembros } = await db
      .from("miembros")
      .select("id, programa_id")
      .in("programa_id", programasDeLaSeccion);
    const ids = ((miembros ?? []) as { id: string }[]).map((m) => m.id);
    if (ids.length > 0) {
      const { data: pases } = await db
        .from("pases_wallet")
        .select("created_at, plataforma, miembro_id")
        .in("miembro_id", ids)
        .gte("created_at", desde60);
      for (const p of (pases ?? []) as { created_at: string; plataforma: string }[]) {
        pasesFechas.push(p.created_at);
        if (p.plataforma === "apple") porPlataforma.apple++;
        else if (p.plataforma === "google") porPlataforma.google++;
      }
    }
  }
  pasesFechas = pasesFechas.filter(Boolean);

  // ── Invitaciones ──────────────────────────────────────────────────
  // Producto propio de Bookea: NO se filtra por sección. Esconderlas al
  // elegir "Agendas y citas" sería el mismo error que el tablero de
  // pendientes ya evita.
  const pedidos = (pedidosRes.data ?? []) as {
    created_at: string;
    estado: string | null;
    monto_crc: number | null;
    precio_crc: number | null;
    pagado_en: string | null;
  }[];
  const pedidosVentana = pedidos.filter((p) => p.created_at >= desde60);

  // ── El libro de la plata, mes por mes ─────────────────────────────
  const porMes = new Map<string, LibroMes>(
    meses.map((m) => [m, { mes: m, reservas: 0, modulos: 0, invitaciones: 0 }]),
  );
  const mesDe = (iso: string | null) => (iso ? fechaISOCR(new Date(iso)).slice(0, 7) : null);

  for (const c of (cobrosRes.data ?? []) as {
    rancho_id: string | null;
    monto: number | null;
    devengado_en: string | null;
  }[]) {
    if (!enSeccion(c.rancho_id)) continue;
    const m = porMes.get(mesDe(c.devengado_en) ?? "");
    if (m) m.reservas += Number(c.monto ?? 0);
  }

  let dolares = 0;
  const mesActual = meses[meses.length - 1];
  for (const c of (modulosRes.data ?? []) as {
    rancho_id: string | null;
    monto: number | null;
    moneda: string | null;
    cobrado_en: string | null;
  }[]) {
    if (!enSeccion(c.rancho_id)) continue;
    const mes = mesDe(c.cobrado_en) ?? "";
    // Los dólares van por su cuenta: no hay tipo de cambio guardado
    // por transacción, así que meterlos al total en colones sería
    // inventar una cifra que después nadie puede reproducir.
    if ((c.moneda ?? "CRC").toUpperCase() === "USD") {
      if (mes === mesActual) dolares += Number(c.monto ?? 0);
      continue;
    }
    const m = porMes.get(mes);
    if (m) m.modulos += Number(c.monto ?? 0);
  }

  if (seccion === "todas") {
    const COBRADOS = ["pagado", "en_diseno", "entregado"];
    for (const p of pedidos) {
      if (!COBRADOS.includes(p.estado ?? "")) continue;
      const m = porMes.get(mesDe(p.pagado_en ?? p.created_at) ?? "");
      if (m) m.invitaciones += Number(p.monto_crc ?? p.precio_crc ?? 0);
    }
  }

  // ── Publicaciones ─────────────────────────────────────────────────
  const deLaSeccion = ranchos.filter((r) => perteneceASeccion(r.vertical, seccion));

  // ── El vigía del cron ─────────────────────────────────────────────
  // Sin esto, el cron de /api/cobro-plataforma caído se ve idéntico a
  // un mes sin ventas.
  const devengos = ((cobrosRes.data ?? []) as { devengado_en: string | null }[])
    .map((c) => c.devengado_en)
    .filter((d): d is string => Boolean(d))
    .sort();

  const fechaCR = (iso: string | null) => (iso ? fechaISOCR(new Date(iso)) : null);

  return {
    sinLlave: false,
    seriesTruncadas: truncadas,
    desde,
    hasta: hoy,
    reservas: metricaDe(
      reservasReales.map((r) => fechaISOCR(new Date(r.created_at))),
      hoy,
    ),
    clientes: metricaDe(
      perfiles.map((p) => fechaCR(p.created_at)).filter((d): d is string => Boolean(d)),
      hoy,
    ),
    pases: metricaDe(
      pasesFechas.map((f) => fechaISOCR(new Date(f))),
      hoy,
    ),
    pedidos: metricaDe(
      pedidosVentana.map((p) => fechaISOCR(new Date(p.created_at))),
      hoy,
    ),
    pasesPorPlataforma: porPlataforma,
    libro: meses.map((m) => porMes.get(m)!),
    dolaresDelMes: dolares,
    publicaciones: {
      publicadas: deLaSeccion.filter((r) => r.estado === "aprobado").length,
      pendientes: deLaSeccion.filter((r) => r.estado === "pendiente").length,
    },
    ultimoDevengo: devengos.length > 0 ? fechaCR(devengos[devengos.length - 1]) : null,
  };
}
