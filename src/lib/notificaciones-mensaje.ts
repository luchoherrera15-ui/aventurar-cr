import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push";
import { enviarCorreo, plantillaMensajeNuevo } from "@/lib/email";
import {
  asuntoMensajeNuevo,
  decidirCorreoMensaje,
  esMomentoDeAvisar,
} from "@/lib/correo/aviso-mensaje";

/**
 * El aviso de un mensaje nuevo del chat: le suena al OTRO participante
 * de la conversación (el autor ya sabe qué escribió). Son DOS avisos
 * con criterios distintos:
 *
 *  - PUSH: por cada mensaje. Es barato, silencioso y es lo que hace que
 *    un chat se sienta un chat.
 *  - CORREO: solo al abrirse la conversación, o cuando revive después
 *    de mucho silencio (ver src/lib/correo/aviso-mensaje.ts). Desde que
 *    los proveedores de servicios de eventos pasaron de recibir
 *    RESERVAS a recibir CONSULTAS por el chat, este correo es lo único
 *    que le avisa al proveedor sin app instalada que tiene un cliente
 *    esperando: antes lo mandaba `notificarReservaCompletada`, que ya
 *    no se dispara porque no se crea ninguna reserva.
 *
 * Vive acá y no en la acción de la web porque hay tres caminos que
 * terminan en lo mismo — la acción enviarMensaje de la web, el primer
 * mensaje que inserta el chat flotante desde el navegador, y la app
 * móvil; los dos últimos pegan en /api/mensajes/[id]/aviso porque no
 * tienen servidor propio.
 *
 * UNA SOLA VEZ POR MENSAJE, push y correo: la bandera `push_enviado` se
 * reclama dentro del mismo UPDATE que lee los datos (migración 0057),
 * el mismo patrón de confirmacion_enviada en reservas. Todo lo que va
 * después de ese UPDATE corre como mucho una vez por mensaje, así que
 * un doble clic o un reintento del endpoint no manda un correo de más
 * — y por eso el correo NO necesita columna propia ni migración nueva.
 *
 * Nunca lanza: el mensaje ya quedó guardado y eso no puede fallar por
 * un aviso. La fila es la fuente de verdad; si el correo se pierde, la
 * consulta sigue en el chat.
 */

type FilaMensaje = {
  id: string;
  conversacion_id: string;
  texto: string;
  autor_id: string;
  created_at: string;
  conversaciones: {
    id: string;
    reserva_id: string | null;
    cliente_id: string;
    proveedor_id: string;
    ranchos: { nombre: string } | null;
  } | null;
};

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

export async function notificarMensajeNuevo(
  mensajeId: string,
  opciones?: { maxAntiguedadMinutos?: number },
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  try {
    let consulta = admin
      .from("mensajes")
      .update({ push_enviado: true })
      .eq("id", mensajeId)
      .eq("push_enviado", false);

    if (opciones?.maxAntiguedadMinutos) {
      const desde = new Date(
        Date.now() - opciones.maxAntiguedadMinutos * 60 * 1000,
      ).toISOString();
      consulta = consulta.gte("created_at", desde);
    }

    const { data } = await consulta
      .select(
        "id, conversacion_id, texto, autor_id, created_at, conversaciones(id, reserva_id, cliente_id, proveedor_id, ranchos(nombre))",
      )
      .maybeSingle();
    if (!data) return;

    const m = data as unknown as FilaMensaje;
    const conv = m.conversaciones;
    if (!conv) return;

    const receptor =
      m.autor_id === conv.cliente_id ? conv.proveedor_id : conv.cliente_id;
    const nombreNegocio = conv.ranchos?.nombre ?? "Bookea";
    const texto =
      m.texto.length > 120 ? m.texto.slice(0, 117) + "…" : m.texto;

    await enviarPush({
      usuarios: [receptor],
      titulo: `Mensaje nuevo — ${nombreNegocio}`,
      cuerpo: texto,
      data: { url: "/?tab=mensajes" },
    });

    // Independiente del push a propósito: que Expo falle no puede
    // dejar al proveedor sin el correo, que es justo el aviso que le
    // llega aunque no tenga la app.
    await avisarPorCorreo(admin, m, conv, receptor, nombreNegocio);
  } catch (e) {
    console.warn("[mensajes] No se pudo avisar el mensaje:", e);
  }
}

type ClienteAdmin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * El correo, si corresponde. Las consultas a la base van en el orden
 * más barato posible: primero el mensaje anterior del hilo (que decide
 * el 95% de los casos con una sola lectura) y recién si toca avisar se
 * buscan los perfiles y la supresión.
 */
async function avisarPorCorreo(
  admin: ClienteAdmin,
  m: FilaMensaje,
  conv: NonNullable<FilaMensaje["conversaciones"]>,
  receptorId: string,
  nombreNegocio: string,
): Promise<void> {
  try {
    // El mensaje inmediatamente anterior del hilo. Sin fila, este es el
    // primero: la consulta recién abierta, el caso que importa.
    const { data: previo } = await admin
      .from("mensajes")
      .select("created_at")
      .eq("conversacion_id", m.conversacion_id)
      .lt("created_at", m.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ritmo = {
      autorId: m.autor_id,
      receptorId,
      texto: m.texto,
      creadoEn: m.created_at,
      previoCreadoEn: (previo as { created_at: string } | null)?.created_at ?? null,
    };
    if (!esMomentoDeAvisar(ritmo).avisar) return;

    // Los dos perfiles de un saque: el del destinatario (para el correo
    // y el saludo) y el del autor (para decir quién escribió). La
    // política de `perfiles` solo deja ver el propio perfil — por eso
    // esto va con la llave de servicio y no desde el navegador.
    const { data: perfilesData } = await admin
      .from("perfiles")
      .select("id, nombre, email")
      .in("id", [receptorId, m.autor_id]);
    const perfiles = (perfilesData ?? []) as {
      id: string;
      nombre: string | null;
      email: string | null;
    }[];
    const receptor = perfiles.find((p) => p.id === receptorId) ?? null;
    const autor = perfiles.find((p) => p.id === m.autor_id) ?? null;

    const correo = receptor?.email?.trim().toLowerCase() ?? null;

    // Rebotes duros y quejas de spam (0082): a ese buzón no se le
    // escribe más. Si la consulta falla se sigue adelante — un aviso
    // transaccional que se pierde por un hipo de la base es una venta
    // perdida, y el riesgo del lado contrario es un solo correo.
    let suprimido = false;
    if (correo) {
      const { data: supresion, error } = await admin
        .from("supresiones_correo")
        .select("correo")
        .eq("correo", correo)
        .maybeSingle();
      if (error) {
        console.warn("[mensajes] No se pudo leer supresiones_correo:", error.message);
      }
      suprimido = !!supresion;
    }

    const decision = decidirCorreoMensaje({
      ...ritmo,
      correoReceptor: correo,
      correoSuprimido: suprimido,
    });
    if (!decision.avisar || !correo) return;

    const paraProveedor = receptorId === conv.proveedor_id;
    const esPrimerMensaje = ritmo.previoCreadoEn === null;
    // Los hilos con reserva tienen su propia página (con el contexto de
    // la reserva); las consultas van por id de conversación.
    const urlHilo = conv.reserva_id
      ? `${SITIO_URL}/mensajes/${conv.reserva_id}`
      : `${SITIO_URL}/mensajes/hilo/${conv.id}`;

    await enviarCorreo({
      to: correo,
      subject: asuntoMensajeNuevo({
        nombreNegocio,
        texto: m.texto,
        paraProveedor,
        esPrimerMensaje,
      }),
      html: plantillaMensajeNuevo({
        nombreDestinatario: receptor?.nombre?.trim() || correo,
        nombreNegocio,
        // Una consulta puede venir de una sesión anónima: ahí no hay
        // nombre ni correo del cliente, y está bien — el aviso es para
        // el proveedor, que sí tiene cuenta.
        nombreQuienEscribe: paraProveedor
          ? autor?.nombre?.trim() || "Un cliente"
          : nombreNegocio,
        textoMensaje: m.texto,
        urlHilo,
        paraProveedor,
        esPrimerMensaje,
      }),
    });
  } catch (e) {
    console.warn("[mensajes] No se pudo mandar el correo del mensaje:", e);
  }
}
