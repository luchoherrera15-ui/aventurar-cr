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

  // La precedencia la resuelve Postgres (0083) y devuelve SOLO los
  // correos bloqueados. Antes se traían las filas del ledger para
  // decidir acá, y eso fallaba ABIERTO: PostgREST recorta la respuesta
  // en `db-max-rows` (mil por defecto), así que arriba de esa cantidad
  // los que se dieron de baja quedaban fuera del recorte y volvían a la
  // lista de permitidos. Fallar abierto en esta tabla significa
  // mandarle la campaña justo a quien pidió que no le escribieran.
  //
  // El resultado nunca es más grande que la entrada, y el lote lo deja
  // muy por debajo de cualquier recorte — además de acotar el largo de
  // la petición.
  const LOTE = 400;
  const bloqueados = new Set<string>();

  for (let i = 0; i < unicos.length; i += LOTE) {
    const { data, error } = await admin.rpc("correos_bloqueados_marketing", {
      p_correos: unicos.slice(i, i + LOTE),
      p_rancho_id: ambito,
    });
    // FALLA CERRADO: sin poder verificar, no se manda nada. Incluye el
    // caso de que la 0083 todavía no se haya corrido — mejor una
    // campaña que no sale que una que sale sin filtrar.
    if (error) {
      return {
        permitidos: [],
        excluidos: unicos.length,
        error: `No se pudo verificar el consentimiento: ${error.message}`,
      };
    }
    for (const fila of (data ?? []) as { correo: string }[]) {
      bloqueados.add(fila.correo);
    }
  }

  const permitidos = unicos.filter((correo) => !bloqueados.has(correo));
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
  // Mismo criterio que el CHECK de la 0083. Un correo con un espacio o
  // un salto de línea en el medio se guardaría igual pero el filtro de
  // envíos nunca lo encontraría: quedaría una baja registrada que jamás
  // surte efecto, que es peor que no registrarla.
  if (limpio.indexOf("@") < 1 || /\s/.test(limpio)) {
    return { error: "El correo no es válido." };
  }

  const consulta = admin
    .from("consentimientos")
    .select("estado")
    .eq("correo", limpio)
    .order("created_at", { ascending: false })
    // `seq` y no `id`: el uuid es aleatorio, así que desempataba al
    // azar entre dos filas del mismo instante (0083).
    .order("seq", { ascending: false })
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
