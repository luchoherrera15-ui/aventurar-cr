import { abrirContexto, cerrar, responder } from "@/lib/lealtad/api/contexto";
import {
  metaDelPrograma,
  miembroPorRef,
  miembroPorSerial,
  nombreParaIniciales,
  refDelMiembro,
  saldoDelMiembro,
} from "@/lib/lealtad/api/datos";
import { validarConsultaDeSaldo } from "@/lib/lealtad/api/entrada";
import { MENSAJE_NO_ENCONTRADO, errorApi } from "@/lib/lealtad/api/errores";
import { serializarSaldo } from "@/lib/lealtad/api/respuestas";

/**
 * GET /api/lealtad/v1/saldo?serial=… | ?ref=… — la tarjeta del cliente.
 *
 * ------------------------------------------------------------------
 * LOS DOS IDENTIFICADORES, Y PARA QUÉ SIRVE CADA UNO
 * ------------------------------------------------------------------
 * · `serial` es lo que va en el QR del pase que el cliente enseña en el
 *   mostrador. Es la ÚNICA forma de conocer a un cliente por primera
 *   vez, y por eso esta consulta devuelve el `ref`: es el arranque de
 *   la integración.
 * · `ref` es el seudónimo que el POS guardó de esa primera vez.
 *   Consultar por `ref` es lo que le permite mostrar el saldo sin
 *   volver a escanear.
 *
 * `POST /acreditaciones` acepta SOLO el `ref`. Esa asimetría es
 * deliberada y es la propiedad más valiosa del diseño:
 *
 *   · Una base de `ref` robada al integrador permite regalar sellos y
 *     leer saldos en el negocio que consintió la llave (reversible en
 *     bloque, con tope diario, con rastro, y apagable rotando el
 *     pepper desde el panel).
 *   · Pero NO sirve contra otra llave, ni contra el panel, ni contra
 *     una llave futura del mismo integrador: cada autorización tiene su
 *     propio pepper.
 *
 * Por eso la documentación le pide al POS, en negrita, que guarde el
 * `ref` y NO guarde el serial.
 *
 * ------------------------------------------------------------------
 * LA DEBILIDAD DEL SERIAL, DICHA DE FRENTE
 * ------------------------------------------------------------------
 * El serial es un secreto de baja calidad haciendo trabajo de
 * credencial: va impreso en un QR fotografiable desde la fila y queda
 * en las capturas y en los logs del POS, sistemas sobre los que Bookea
 * no tiene control. Un serial capturado da consulta de saldo
 * permanente. Se mitiga con el límite propio (20/min) y con que la
 * respuesta no traiga nada más que dos letras y un número; la solución
 * de verdad —un PIN, o un token rotativo en el pase— rompe el flujo de
 * dos segundos que justifica la API y obliga a re-emitir todos los
 * pases. Es una decisión consciente, no un olvido.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA RESPUESTA YA NO TRAE
 * ------------------------------------------------------------------
 * Llevaba adentro el programa entero (con sus reglas) y el catálogo
 * completo de recompensas. Con la API acotada al caso del pase, esos
 * dos bloques —y los endpoints `/programa` y `/recompensas` que los
 * servían, y el scope `catalogo` que los protegía— dejaron de existir.
 * Queda la meta: un número suelto, el que hace posible el «te faltan 3».
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  const apertura = await abrirContexto(pedido, {
    ruta: "/saldo",
    scope: "saldo",
    bucketPropio: "saldo",
  });
  if (!apertura.ok) return apertura.respuesta;
  const { ctx } = apertura;
  const userAgent = pedido.headers.get("user-agent");

  const parametros = new URL(pedido.url).searchParams;
  const consulta = validarConsultaDeSaldo(parametros.get("serial"), parametros.get("ref"));
  if (!consulta.ok) {
    return cerrar(
      ctx,
      errorApi("entrada_invalida", consulta.fallo.motivo, ctx.requestId, {
        campo: consulta.fallo.campo,
        cabeceras: ctx.cabecerasLimite,
      }),
      { codigoError: "entrada_invalida", userAgent },
    );
  }

  // EL PASO 8. Las dos resoluciones exigen que el miembro sea de ESTA
  // tarjeta y de ESTE negocio; null es null para "no existe", para "no
  // es tuyo" y para "está cancelada" — el mismo 404, para no regalar un
  // enumerador (el criterio de wallet/servicio.ts:52-56).
  const miembro =
    consulta.datos.tipo === "serial"
      ? await miembroPorSerial(ctx, consulta.datos.valor)
      : await miembroPorRef(ctx, consulta.datos.valor);
  if (!miembro) {
    return cerrar(
      ctx,
      errorApi("no_encontrado", MENSAJE_NO_ENCONTRADO, ctx.requestId, {
        cabeceras: ctx.cabecerasLimite,
      }),
      { codigoError: "no_encontrado", userAgent },
    );
  }

  const [meta, saldo, nombre, ref] = await Promise.all([
    metaDelPrograma(ctx),
    saldoDelMiembro(ctx, miembro.miembroId),
    nombreParaIniciales(ctx, miembro.clienteId),
    refDelMiembro(ctx, miembro.miembroId),
  ]);

  return responder(
    ctx,
    serializarSaldo({
      ref,
      nombre,
      mostrarIniciales: ctx.mostrarIniciales,
      meta,
      saldo,
      requestId: ctx.requestId,
    }),
    200,
    { miembroId: miembro.miembroId, userAgent },
  );
}
