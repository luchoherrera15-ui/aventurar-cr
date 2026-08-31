import { createAdminClient } from "@/lib/supabase/admin";

/**
 * UN NEGOCIO DE LEALTAD POR CUENTA — el conteo, en un solo lugar.
 *
 * Regla del dueño (31 ago 2026): «solo se puede crear UN NEGOCIO por
 * persona en los planes de lealtad. Si quisiera agregar otro lo
 * hacemos nosotros por contacto directo».
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTE ARCHIVO EXISTE
 * ------------------------------------------------------------------
 * Hay CUATRO puertas de servidor que dan de alta un negocio de
 * Lealtad, cada una por su lado:
 *
 *   1. `solicitarAltaConPlan` → `crearGratisAlInstante`  (plan gratis)
 *   2. `solicitarAltaConPlan` → insert en solicitudes    (plan pago)
 *   3. `solicitarPlanLealtad` (rama de alta, por SINPE)
 *   4. `iniciarPagoDelPaquete` (rama de alta, con tarjeta)
 *
 * Si cada una contara por su cuenta, la regla duraría hasta que
 * alguien tocara una sola de ellas. Cuentan todas por acá.
 *
 * ------------------------------------------------------------------
 * QUÉ CUENTA COMO «UN NEGOCIO DE LEALTAD» — y qué NO
 * ------------------------------------------------------------------
 * ⚠️ NO alcanza con contar los `ranchos` de la persona. Un proveedor
 * del marketplace (eventos, Citas) ya tiene su rancho, y contarlo lo
 * dejaría sin poder armar su PRIMER programa de lealtad — que es
 * justamente a quien queremos vender. Solo cuentan los negocios que
 * tienen señal de Lealtad: plan, complemento o programa.
 *
 * ⚠️ SOLO LOS PROPIOS. Ser colaborador del negocio de otro no gasta
 * el cupo: el negocio no es suyo. El panel («Mis negocios») sí mezcla
 * propios y colaboraciones para MOSTRAR, y por eso su lista no sirve
 * para decidir esto.
 *
 * ⚠️ EL TRÁMITE PENDIENTE TAMBIÉN OCUPA. Una solicitud de alta sin
 * `rancho_id` es un negocio que todavía no existe pero que el equipo
 * va a crear. Sin contarla, se pueden dejar cinco pedidos en cola y
 * terminar con cinco negocios sin haber roto ninguna regla.
 *
 * ------------------------------------------------------------------
 * ESTO ES UNA PUERTA DE CREACIÓN, NO UNA VALIDACIÓN DE LO QUE HAY
 * ------------------------------------------------------------------
 * Hay cuentas que HOY tienen más de un negocio, de antes de la regla.
 * Siguen administrando los suyos con normalidad: acá solo se decide
 * si se puede crear UNO MÁS. Nada de lo que ya existe se toca.
 */

/** El cupo. Uno, y la constante existe para que se lea el porqué. */
export const TOPE_NEGOCIOS_LEALTAD = 1;

export type TenenciaLealtad = {
  /** Negocios de lealtad que ya son suyos. */
  negocios: { id: string; nombre: string }[];
  /** Altas pedidas y todavía sin atender: ocupan cupo igual. */
  tramitesPendientes: number;
  /** Lo que se compara contra el tope. */
  total: number;
};

/**
 * Cuántos negocios de Lealtad tiene esta cuenta, contando los trámites
 * en curso.
 *
 * Usa el cliente admin porque tiene que ver TODO lo de la persona sin
 * depender de las políticas de lectura (un negocio en revisión, por
 * ejemplo). Si la llave de servicio no está, devuelve cero: preferimos
 * dejar pasar un alta a bloquear a alguien por una falla nuestra de
 * configuración —el equipo lo ve en el panel de todas formas—.
 */
export async function tenenciaDeLealtad(userId: string): Promise<TenenciaLealtad> {
  const vacio: TenenciaLealtad = { negocios: [], tramitesPendientes: 0, total: 0 };
  const admin = createAdminClient();
  if (!admin || !userId) return vacio;

  const { data: propios } = await admin
    .from("ranchos")
    .select("id, nombre, plan_lealtad")
    .eq("owner_id", userId);

  const filas = (propios ?? []) as { id: string; nombre: string; plan_lealtad: string | null }[];

  // Un negocio del marketplace sin nada de Lealtad no gasta cupo. La
  // señal se busca en tres lados porque las cuatro puertas de alta no
  // escriben las mismas columnas: `crearGratisAlInstante` deja plan +
  // complemento + programa, pero `crearNegocioDesdeSolicitud` escribe
  // `plan_lealtad` solo si la solicitud traía plan.
  const conPlan = new Set(filas.filter((r) => r.plan_lealtad).map((r) => r.id));
  const ids = filas.map((r) => r.id);

  if (ids.length > 0) {
    const [{ data: addons }, { data: programas }] = await Promise.all([
      admin.from("addons_negocio").select("rancho_id").eq("addon", "lealtad").in("rancho_id", ids),
      admin.from("programa_lealtad").select("rancho_id").in("rancho_id", ids),
    ]);
    for (const a of (addons ?? []) as { rancho_id: string }[]) conPlan.add(a.rancho_id);
    for (const p of (programas ?? []) as { rancho_id: string }[]) conPlan.add(p.rancho_id);
  }

  const negocios = filas
    .filter((r) => conPlan.has(r.id))
    .map((r) => ({ id: r.id, nombre: r.nombre }));

  const { count } = await admin
    .from("solicitudes_lealtad")
    .select("id", { count: "exact", head: true })
    .eq("solicitante_id", userId)
    .eq("estado", "pendiente")
    .is("rancho_id", null);

  const tramitesPendientes = count ?? 0;

  return { negocios, tramitesPendientes, total: negocios.length + tramitesPendientes };
}

/** El texto que ve la persona. Uno solo, para que las cuatro puertas digan lo mismo. */
export const MOTIVO_TOPE_NEGOCIOS =
  "Ya tenés tu negocio en Lealtad. Para abrir otro escribinos y lo damos de alta nosotros.";

/**
 * La puerta. `true` en `puede` = adelante.
 *
 * `yaTiene` viaja para que la pantalla pueda decir CUÁL negocio ocupa
 * el cupo en vez de un «no se puede» a secas.
 */
export async function puedeCrearNegocioDeLealtad(
  userId: string,
): Promise<{ puede: true } | { puede: false; motivo: string; yaTiene: TenenciaLealtad }> {
  const tenencia = await tenenciaDeLealtad(userId);
  if (tenencia.total < TOPE_NEGOCIOS_LEALTAD) return { puede: true };
  return { puede: false, motivo: MOTIVO_TOPE_NEGOCIOS, yaTiene: tenencia };
}
