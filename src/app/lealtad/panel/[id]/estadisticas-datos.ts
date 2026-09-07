import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { identidadesDeMiembros, miembrosConIdentidad } from "@/lib/lealtad/identidades-db";
import { fichaVisible, numeroCorto, SIN_DATOS } from "@/lib/lealtad/identidad-miembro";
import { canalDelMovimiento, ETIQUETA_CANAL, type CanalDelSello } from "@/lib/lealtad/canal-del-sello";
import { fechaISOCR, hoyISOCR } from "@/lib/fechas";
import { tipoDe, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS DATOS DE ESTADÍSTICAS — el libro entero, plano y cruzado
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026): «Métricas y Clientes son un desorden.
 * Quiero un verdadero programa de estadísticas: ordenado, que se pueda
 * filtrar, con tablas separadas de entregas de sellos y de canjes, y
 * ver cuánto consume cada cliente».
 *
 * ── UNA SOLA LECTURA, TRES TABLAS CRUZADAS ─────────────────────────
 * El ledger (`transacciones_puntos`) es la verdad del saldo; la venta
 * (`lealtad_transacciones`, 0197) es la verdad del valor y el detalle;
 * el canje (`canjes`) es la verdad del premio entregado. Acá se leen
 * las tres UNA vez para el programa y se cruzan fila por fila:
 *
 *   sello  ← ledger 'ganado'   + su venta (misma `referencia`, o la
 *                                venta del mismo miembro a < 10 s)
 *   canje  ← ledger 'canjeado' + su canje (`canjes.transaccion_id`, o el
 *                                canje del mismo miembro a < 10 s)
 *   ajuste / reversión ← ledger 'ajuste' (reversión si `reversion_de`)
 *
 * El resultado es una lista PLANA de movimientos con todo lo que una
 * fila de estadística necesita —cliente, cantidad, valor, detalle,
 * canal, quién, premio— y el cliente filtra, agrupa y suma sin volver
 * a la base. Es el mismo criterio que Clientes: una consulta por
 * pantalla, y el resto es trabajo del navegador sobre datos que ya
 * llegaron.
 *
 * ── EL TOPE ────────────────────────────────────────────────────────
 * Se traen los últimos 5.000 movimientos. Un negocio con más los tiene
 * igual en la base; la pantalla lo dice (`truncado`) en vez de sumar
 * en silencio con la mitad de la historia.
 */

export type TipoMovimiento = "sello" | "canje" | "ajuste" | "reversion";

export type MovimientoEstadistica = {
  id: string;
  /** ISO completo, para ordenar y mostrar la hora. */
  fecha: string;
  /** YYYY-MM-DD en hora de Costa Rica, para los filtros de rango. */
  fechaISO: string;
  miembroId: string;
  cliente: string;
  contacto: string;
  tipo: TipoMovimiento;
  /** Sellos o puntos, con signo: +N en una entrega, −N en un canje. */
  cantidad: number;
  saldoDespues: number | null;
  /** El valor de la compra (sin moneda: cada país tiene la suya). */
  valor: number | null;
  /** «Hamburguesas», «Matcha latte»… lo que el negocio anotó. */
  detalle: string | null;
  canal: CanalDelSello;
  canalEtiqueta: string;
  /** Quién lo hizo: el colaborador, o «API», «Automático»… */
  quien: string;
  /** Solo en canjes: el premio entregado y su estado. */
  premio: string | null;
  estadoCanje: string | null;
  motivo: string;
  referencia: string | null;
};

export type ClienteEstadistica = {
  miembroId: string;
  nombre: string;
  contacto: string;
  /** YYYY-MM-DD de la afiliación, en hora de Costa Rica. */
  desde: string;
};

export type DatosEstadisticas = {
  movimientos: MovimientoEstadistica[];
  clientes: ClienteEstadistica[];
  tipo: TipoTarjeta;
  /** «sellos», «puntos»… en plural. */
  unidad: string;
  hoy: string;
  tope: number;
  truncado: boolean;
};

const TOPE = 5000;
const VENTANA_CRUCE_MS = 10_000;

/** Quién está detrás de un movimiento sin persona del equipo. */
function quienAutomatico(canal: CanalDelSello): string {
  switch (canal) {
    case "api":
      return "API";
    case "cita":
      return "Automático (cita)";
    case "vencimiento":
      return "Automático (vencimiento)";
    default:
      return "Sistema";
  }
}

export const cargarEstadisticas = cache(
  async (programaId: string, ranchoId: string, modo: string | null): Promise<DatosEstadisticas | null> => {
    const db = createAdminClient();
    if (!db) return null;
    const hoy = hoyISOCR();
    const tipo = tipoDe(modo);
    const unidad = UNIDAD_SALDO[tipo];

    // ── Los miembros, con nombre y contacto ───────────────────────────
    const miembros = await miembrosConIdentidad(db, { programaId });
    const identidades = await identidadesDeMiembros(db, miembros, ranchoId);
    const clientes: ClienteEstadistica[] = miembros.map((m) => {
      const vista = fichaVisible(
        identidades.get(m.id) ?? { nombre: null, correo: null, telefono: null },
        { alta: m.created_at, miembroId: m.id },
      );
      const corto = numeroCorto(m.id);
      return {
        miembroId: m.id,
        nombre: vista.titulo === SIN_DATOS && corto ? `${SIN_DATOS} nº ${corto}` : vista.titulo,
        contacto: vista.sinNombre ? "" : vista.contacto.join(" · "),
        desde: fechaISOCR(new Date(m.created_at)),
      };
    });
    const porMiembro = new Map(clientes.map((c) => [c.miembroId, c]));
    const ids = clientes.map((c) => c.miembroId);
    if (ids.length === 0) {
      return { movimientos: [], clientes, tipo, unidad, hoy, tope: TOPE, truncado: false };
    }

    // ── El ledger, las ventas y los canjes, en paralelo ──────────────
    const columnas =
      "id, miembro_id, tipo, puntos, motivo, referencia, saldo_posterior, reversion_de, usuario_id, created_at";
    const [ledgerConLlave, ventasRes, canjesRes] = await Promise.all([
      db
        .from("transacciones_puntos")
        .select(`${columnas}, llave_id`)
        .in("miembro_id", ids)
        .order("created_at", { ascending: false })
        .limit(TOPE),
      // Sin la 0197 la tabla no existe: la consulta falla y se sigue
      // sin ventas — las filas del ledger igual salen, sin valor.
      db
        .from("lealtad_transacciones")
        .select("id, miembro_id, monto, producto, referencia, registrado_por, created_at")
        .eq("programa_id", programaId)
        .order("created_at", { ascending: false })
        .limit(TOPE),
      db
        .from("canjes")
        .select(
          "id, miembro_id, estado, created_at, entregado_por, transaccion_id, anulado_motivo, pos_registrado_en, factura_ref, recompensas(nombre, costo_puntos)",
        )
        .in("miembro_id", ids)
        .order("created_at", { ascending: false })
        .limit(TOPE),
    ]);
    // `llave_id` es de la 0178: si no está pegada, se vuelve a pedir sin ella.
    const ledgerRes = ledgerConLlave.error
      ? await db
          .from("transacciones_puntos")
          .select(columnas)
          .in("miembro_id", ids)
          .order("created_at", { ascending: false })
          .limit(TOPE)
      : ledgerConLlave;

    type FilaLedger = {
      id: string;
      miembro_id: string;
      tipo: string;
      puntos: number;
      motivo: string | null;
      referencia: string | null;
      saldo_posterior: number | null;
      reversion_de: string | null;
      usuario_id: string | null;
      llave_id?: string | null;
      created_at: string;
    };
    type FilaVenta = {
      id: string;
      miembro_id: string;
      monto: number | null;
      producto: string | null;
      referencia: string | null;
      registrado_por: string | null;
      created_at: string;
    };
    type FilaCanje = {
      id: string;
      miembro_id: string;
      estado: string | null;
      created_at: string;
      entregado_por: string | null;
      transaccion_id: string | null;
      anulado_motivo: string | null;
      pos_registrado_en: string | null;
      factura_ref: string | null;
      recompensas: { nombre: string; costo_puntos: number } | null;
    };
    const ledger = ((ledgerRes.data ?? []) as unknown as FilaLedger[]);
    const ventas = ((ventasRes.error ? [] : ventasRes.data) ?? []) as unknown as FilaVenta[];
    const canjes = ((canjesRes.error ? [] : canjesRes.data) ?? []) as unknown as FilaCanje[];

    // ── Quién: los perfiles del equipo, en UNA consulta ──────────────
    const operadores = new Set<string>();
    for (const t of ledger) if (t.usuario_id) operadores.add(t.usuario_id);
    for (const v of ventas) if (v.registrado_por) operadores.add(v.registrado_por);
    for (const c of canjes) if (c.entregado_por) operadores.add(c.entregado_por);
    const { data: perfiles } = operadores.size
      ? await db.from("perfiles").select("id, nombre, email").in("id", [...operadores])
      : { data: [] };
    const nombreDe = new Map(
      ((perfiles ?? []) as { id: string; nombre: string | null; email: string | null }[]).map((p) => [
        p.id,
        (p.nombre ?? "").trim() || (p.email ?? "").trim() || "Colaborador",
      ]),
    );

    // ── Los cruces ───────────────────────────────────────────────────
    const ventaPorReferencia = new Map<string, FilaVenta>();
    const ventasLibres = new Map<string, FilaVenta[]>();
    for (const v of ventas) {
      if (v.referencia) ventaPorReferencia.set(v.referencia, v);
      const lista = ventasLibres.get(v.miembro_id) ?? [];
      lista.push(v);
      ventasLibres.set(v.miembro_id, lista);
    }
    const canjePorTransaccion = new Map<string, FilaCanje>();
    const canjesLibres = new Map<string, FilaCanje[]>();
    for (const c of canjes) {
      if (c.transaccion_id) canjePorTransaccion.set(c.transaccion_id, c);
      const lista = canjesLibres.get(c.miembro_id) ?? [];
      lista.push(c);
      canjesLibres.set(c.miembro_id, lista);
    }
    const usadas = new Set<string>();
    const cercana = <T extends { id: string; created_at: string }>(
      lista: T[] | undefined,
      t: number,
    ): T | null => {
      if (!lista) return null;
      for (const x of lista) {
        if (usadas.has(x.id)) continue;
        if (Math.abs(Date.parse(x.created_at) - t) < VENTANA_CRUCE_MS) return x;
      }
      return null;
    };

    const movimientos: MovimientoEstadistica[] = ledger.map((t) => {
      const cliente = porMiembro.get(t.miembro_id);
      const canal = canalDelMovimiento({ referencia: t.referencia, llaveId: t.llave_id ?? null, usuarioId: t.usuario_id });
      const instante = Date.parse(t.created_at);
      let tipoMov: TipoMovimiento =
        t.tipo === "ganado" ? "sello" : t.tipo === "canjeado" ? "canje" : t.reversion_de ? "reversion" : "ajuste";
      let valor: number | null = null;
      let detalle: string | null = null;
      let premio: string | null = null;
      let estadoCanje: string | null = null;
      let quienId = t.usuario_id;

      if (tipoMov === "sello") {
        const venta =
          (t.referencia ? ventaPorReferencia.get(t.referencia) : undefined) ?? cercana(ventasLibres.get(t.miembro_id), instante);
        if (venta && !usadas.has(venta.id)) {
          usadas.add(venta.id);
          valor = venta.monto === null ? null : Number(venta.monto);
          detalle = (venta.producto ?? "").trim() || null;
          quienId = quienId ?? venta.registrado_por;
        }
      } else if (tipoMov === "canje") {
        const canje = canjePorTransaccion.get(t.id) ?? cercana(canjesLibres.get(t.miembro_id), instante);
        if (canje && !usadas.has(canje.id)) {
          usadas.add(canje.id);
          premio = canje.recompensas?.nombre ?? null;
          estadoCanje = canje.estado ?? "entregado";
          quienId = quienId ?? canje.entregado_por;
        }
      } else if (t.reversion_de) {
        tipoMov = "reversion";
      }

      return {
        id: t.id,
        fecha: t.created_at,
        fechaISO: fechaISOCR(new Date(t.created_at)),
        miembroId: t.miembro_id,
        cliente: cliente?.nombre ?? SIN_DATOS,
        contacto: cliente?.contacto ?? "",
        tipo: tipoMov,
        cantidad: Number(t.puntos) || 0,
        saldoDespues: t.saldo_posterior === null || t.saldo_posterior === undefined ? null : Number(t.saldo_posterior),
        valor,
        detalle,
        canal,
        canalEtiqueta: ETIQUETA_CANAL[canal],
        quien: quienId ? (nombreDe.get(quienId) ?? "Colaborador") : quienAutomatico(canal),
        premio,
        estadoCanje,
        motivo: (t.motivo ?? "").trim(),
        referencia: t.referencia,
      };
    });

    return {
      movimientos,
      clientes,
      tipo,
      unidad,
      hoy,
      tope: TOPE,
      truncado: ledger.length >= TOPE,
    };
  },
);
