import { createAdminClient } from "@/lib/supabase/admin";

/**
 * El filtro de consentimiento para envíos masivos — solo servidor.
 *
 * Toda campaña (del admin hoy, por negocio en la Fase 4) pasa su lista
 * por acá ANTES de enviar: fuera los suprimidos (rebotes/quejas) y los
 * que revocaron su consentimiento (0082). Una sola pasada con dos
 * consultas — no un RPC por destinatario.
 */
export async function filtrarDestinatariosMarketing(
  correos: string[],
  ranchoId: string | null = null,
): Promise<{ permitidos: string[]; excluidos: number; error?: string }> {
  // Mismo criterio de validez que el CHECK de la 0082: lo que no es un
  // correo normalizable no se envía (ni cuenta como permitido).
  const unicos = [
    ...new Set(
      correos
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.indexOf("@") > 0 && !/\s/.test(c)),
    ),
  ];
  if (unicos.length === 0) return { permitidos: [], excluidos: 0 };

  const admin = createAdminClient();
  // Sin service key (entorno local pelado, o la variable vencida tras
  // rotar la llave) no se puede verificar el consentimiento — y sin
  // poder verificarlo, no se manda marketing. Va con `error` para que
  // el panel diga "no pude verificar" y no "todos están dados de
  // baja", que manda al admin a revisar la base equivocada.
  if (!admin) {
    return {
      permitidos: [],
      excluidos: unicos.length,
      error: "Falta SUPABASE_SERVICE_ROLE_KEY: no se pudo verificar el consentimiento.",
    };
  }

  // El ámbito llega de código nuestro, pero se valida igual: va
  // interpolado dentro de un filtro .or() de PostgREST y un valor
  // raro ahí cambiaría el significado de la consulta.
  if (ranchoId !== null && !/^[0-9a-f-]{36}$/i.test(ranchoId)) {
    return { permitidos: [], excluidos: unicos.length, error: "Ámbito inválido." };
  }
  // Normalizado antes de armar llaves: Postgres devuelve los uuid en
  // minúscula, así que un ámbito en mayúsculas no encontraría su fila
  // en el Map de abajo y la revocación se ignoraría en silencio.
  const ambito = ranchoId?.toLowerCase() ?? null;

  const [supresRes, consRes] = await Promise.all([
    admin.from("supresiones_correo").select("correo").in("correo", unicos),
    // Las filas de plataforma y las del negocio (si aplica), de las
    // más nuevas a las más viejas: la primera por (correo, ámbito) es
    // el estado vigente.
    ambito
      ? admin
          .from("consentimientos")
          .select("correo, rancho_id, estado, created_at")
          .in("correo", unicos)
          .or(`rancho_id.is.null,rancho_id.eq.${ambito}`)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
      : admin
          .from("consentimientos")
          .select("correo, rancho_id, estado, created_at")
          .in("correo", unicos)
          .is("rancho_id", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
  ]);

  // FALLA CERRADO: si una de las dos consultas se cae, `data` viene
  // null y sin este freno la lista saldría "limpia" — le mandaríamos
  // la campaña justo a quien se dio de baja o rebotó.
  if (supresRes.error || consRes.error) {
    return {
      permitidos: [],
      excluidos: unicos.length,
      error: `No se pudo verificar el consentimiento: ${(supresRes.error ?? consRes.error)?.message}`,
    };
  }

  const suprimidos = new Set(
    ((supresRes.data ?? []) as { correo: string }[]).map((s) => s.correo),
  );

  // El estado vigente por (correo, ámbito): la primera fila que
  // aparece, porque vienen ordenadas de nuevo a viejo.
  const vigente = new Map<string, string>();
  for (const fila of (consRes.data ?? []) as {
    correo: string;
    rancho_id: string | null;
    estado: string;
  }[]) {
    const llave = `${fila.correo}|${fila.rancho_id?.toLowerCase() ?? ""}`;
    if (!vigente.has(llave)) vigente.set(llave, fila.estado);
  }

  const permitidos = unicos.filter((correo) => {
    if (suprimidos.has(correo)) return false;
    if (vigente.get(`${correo}|`) === "revocado") return false;
    if (ambito && vigente.get(`${correo}|${ambito}`) === "revocado") return false;
    return true;
  });

  return { permitidos, excluidos: unicos.length - permitidos.length };
}

/**
 * Registra una revocación (o aceptación) en el ledger — solo servidor.
 *
 * Idempotente: si el estado vigente ya es el mismo, no escribe. El
 * link de baja no vence (a propósito: tiene que funcionar meses
 * después), así que sin este freno cada clic repetido — o cada
 * pre-fetch del buzón — sumaría una fila igual al ledger.
 */
export async function registrarConsentimiento({
  correo,
  ranchoId,
  estado,
  origen,
  detalle,
  clienteId,
}: {
  correo: string;
  ranchoId: string | null;
  estado: "aceptado" | "revocado";
  origen: string;
  detalle?: string;
  clienteId?: string | null;
}): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  if (!admin) {
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno." };
  }
  const limpio = correo.trim().toLowerCase();

  const consulta = admin
    .from("consentimientos")
    .select("estado")
    .eq("correo", limpio)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  const { data: vigente, error: errorLectura } = await (ranchoId
    ? consulta.eq("rancho_id", ranchoId)
    : consulta.is("rancho_id", null));
  // Un error de lectura no frena la baja: ante la duda, se registra.
  if (!errorLectura && vigente?.[0]?.estado === estado) return { error: null };

  const { error } = await admin.from("consentimientos").insert({
    correo: limpio,
    rancho_id: ranchoId,
    cliente_id: clienteId ?? null,
    estado,
    origen,
    detalle: detalle ?? null,
  });
  return { error: error ? error.message : null };
}
