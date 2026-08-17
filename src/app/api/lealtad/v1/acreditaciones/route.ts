import { after } from "next/server";
import { abrirContexto, cerrar, responder } from "@/lib/lealtad/api/contexto";
import { metaDelPrograma, miembroPorRef } from "@/lib/lealtad/api/datos";
import { leerCuerpoJson, referenciaGuardada, validarAcreditacion } from "@/lib/lealtad/api/entrada";
import { MENSAJE_NO_ENCONTRADO, errorApi } from "@/lib/lealtad/api/errores";
import { serializarAcreditacion } from "@/lib/lealtad/api/respuestas";
import { avisarCambioDePase } from "@/lib/wallet/servicio";

/**
 * POST /api/lealtad/v1/acreditaciones — el sello desde la caja.
 *
 * ES LA API ENTERA. Después de acotar el alcance en agosto de 2026, la
 * API de Lealtad existe para exactamente esto: que un sistema externo
 * le sume un sello al cliente y el pase del teléfono se actualice solo.
 * Si el teléfono no se entera, este endpoint no sirve para nada.
 *
 * ------------------------------------------------------------------
 * POR ESO EL AVISO AL PASE NO ES OPCIONAL, Y ESTÁ PROBADO
 * ------------------------------------------------------------------
 * Acreditar tiene DOS mitades y este repo ya pagó caro olvidar una:
 *
 *   1. MARCAR el pase como cambiado (`pases_wallet.actualizado_en`).
 *      Eso lo hace `acreditar_lealtad` adentro de la transacción
 *      (0125:407-409), así que el camino de la API lo hereda gratis.
 *   2. EMPUJAR el aviso para que el teléfono PREGUNTE. Sin esto, la
 *      marca del punto 1 se queda esperando a que el sistema operativo
 *      se acuerde de consultar — o sea, el sello queda mudo hasta que
 *      el cliente abra la billetera a mano.
 *
 * `escaner-actions.ts` y `lealtad-operar-actions.ts` (los dos caminos
 * del panel) hacen las dos: acreditan y después llaman a
 * `avisarCambioDePase` dentro de `after()`. Esta ruta NO lo hacía. El
 * sello entraba a la base, la respuesta decía 201, y el pase del
 * teléfono no se movía. Es el mismo bug que ya dejó mudos los sellos
 * una vez (`entregarApple` empujaba sin marcar) visto desde el otro
 * lado: acá se marcaba sin empujar.
 *
 * `after()` y no un `void` suelto: Vercel congela la función en cuanto
 * se responde, y una promesa suelta muere ahí. El aviso NUNCA frena la
 * operación —los puntos ya están en el ledger— pero SÍ tiene que
 * ejecutarse. `acreditaciones.test.ts` falla si alguien lo saltea.
 *
 * NO se avisa en el reintento idempotente: no cambió nada que el
 * teléfono tenga que bajar, y empujar igual convertiría un POS con
 * reintentos agresivos en un generador de pushes.
 *
 * ------------------------------------------------------------------
 * EL RESTO DE LA INTEGRACIÓN
 * ------------------------------------------------------------------
 * El POS cobra y el sello aparece en el teléfono del cliente antes de
 * que guarde la billetera.
 *
 * ------------------------------------------------------------------
 * RECIBE EXACTAMENTE TRES CAMPOS
 * ------------------------------------------------------------------
 *   { "ref": "mb_…", "monto": 12500, "referencia": "tiquete-2026-…" }
 *
 * · NO acepta `miembro_id`: un solo camino de identidad es un solo
 *   camino que auditar, y el uuid real no entra ni sale.
 * · NO acepta `serial`: el serial consulta, el `ref` opera (ver
 *   ../saldo/route.ts).
 * · NO acepta `motivo`: sería texto libre de un tercero cayendo en una
 *   tabla sin datos personales. El servidor escribe siempre lo mismo.
 * · NO acepta `puntos`: los calcula el programa con SUS reglas. Que el
 *   integrador diga cuántos sellos vale una compra sería dejarlo poner
 *   el precio.
 *
 * ------------------------------------------------------------------
 * `referencia` ES OBLIGATORIA, AUNQUE EL RPC LA ACEPTE NULA
 * ------------------------------------------------------------------
 * Sin idempotencia obligatoria, el "falla cerrado" del rate limit
 * pondría al POS a elegir entre perder el sello o duplicarlo. Con ella,
 * el reintento es gratis. Las dos piezas se sostienen mutuamente.
 *
 * Se guarda prefijada `api:<referencia>` para no chocar con las
 * referencias que el panel escribe a mano.
 *
 * ------------------------------------------------------------------
 * POR QUÉ HAY QUE RELEER EL MOVIMIENTO
 * ------------------------------------------------------------------
 * `acreditar_lealtad` (0125) NO devuelve el id del movimiento, ni en el
 * camino feliz. Y en el `unique_violation` devuelve
 * `{otorgado:false, motivo:'ya-otorgado', saldo}` (0125:401), que es la
 * idempotencia haciendo su trabajo y no un error. Así que la ruta
 * releé `transacciones_puntos` por `(miembro_id, referencia)` para
 * armar la respuesta — y ese viaje, que igual hay que pagar, sirve
 * también para estampar el `llave_id` que hace reversible en bloque un
 * incidente.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResultadoRpc = {
  otorgado?: boolean;
  motivo?: string;
  puntos?: number;
  saldo?: number;
};

type MovimientoGuardado = {
  id: string;
  puntos: number;
  saldo_anterior: number | null;
  saldo_posterior: number | null;
  created_at: string;
  reglas: { monto?: number | null } | null;
};

export async function POST(pedido: Request) {
  const apertura = await abrirContexto(pedido, {
    ruta: "/acreditaciones",
    scope: "acreditar",
    escritura: true,
  });
  if (!apertura.ok) return apertura.respuesta;
  const { ctx } = apertura;
  const userAgent = pedido.headers.get("user-agent");

  const malaEntrada = (motivo: string, campo: string) =>
    cerrar(
      ctx,
      errorApi("entrada_invalida", motivo, ctx.requestId, {
        campo,
        cabeceras: ctx.cabecerasLimite,
      }),
      { codigoError: "entrada_invalida", userAgent },
    );

  const cuerpo = await leerCuerpoJson(pedido);
  if (!cuerpo.ok) return malaEntrada(cuerpo.fallo.motivo, cuerpo.fallo.campo);

  const validado = validarAcreditacion(cuerpo.datos);
  if (!validado.ok) return malaEntrada(validado.fallo.motivo, validado.fallo.campo);
  const { ref, monto, referencia } = validado.datos;

  // EL PASO 8: el `ref` solo existe dentro de esta autorización, y
  // además se comprueba que el miembro sea de esta tarjeta y de este
  // negocio. Un `ref` de otra llave da 404, igual que uno inventado.
  const miembro = await miembroPorRef(ctx, ref);
  if (!miembro) {
    return cerrar(
      ctx,
      errorApi("no_encontrado", MENSAJE_NO_ENCONTRADO, ctx.requestId, {
        cabeceras: ctx.cabecerasLimite,
      }),
      { codigoError: "no_encontrado", userAgent },
    );
  }

  const referenciaFinal = referenciaGuardada(referencia);

  // El servidor escribe SIEMPRE esta frase. Nunca texto del que llama —
  // y es también la que vuelve en la respuesta, en vez del `motivo`
  // guardado (ver más abajo, donde se arma `serializarAcreditacion`).
  const motivoDelServidor = `Acumulación (API: ${ctx.desarrollador})`.slice(0, 120);

  const { data, error } = await ctx.db.rpc("acreditar_lealtad", {
    p_miembro_id: miembro.miembroId,
    p_monto: monto,
    p_referencia: referenciaFinal,
    // null = lo originó el sistema, no una persona. Quién fue de verdad
    // queda en `llave_id` y en la bitácora.
    p_usuario_id: null,
    p_motivo: motivoDelServidor,
  });

  if (error) {
    console.error("[api-lealtad] acreditar_lealtad falló:", error.message);
    return cerrar(
      ctx,
      errorApi("degradado", "No se pudo registrar la acumulación.", ctx.requestId, {
        cabeceras: ctx.cabecerasLimite,
      }),
      { codigoError: "degradado", miembroId: miembro.miembroId, referencia, userAgent },
    );
  }

  const rpc = (data ?? {}) as ResultadoRpc;
  const duplicada = rpc.otorgado === false && rpc.motivo === "ya-otorgado";

  /**
   * EL AVISO AL TELÉFONO, EN CUANTO EL LEDGER DIJO QUE SÍ.
   *
   * Va ACÁ y no al final a propósito. Todo lo que sigue —releer el
   * movimiento, estampar la llave, armar el cuerpo— es para poder
   * CONTESTARLE bien al POS, y cualquiera de esos pasos puede fallar.
   * Pero el sello YA ESTÁ en la base y el pase ya quedó marcado
   * (`acreditar_lealtad` mueve `pases_wallet.actualizado_en` adentro de
   * su transacción, 0125:407-409). Si el aviso colgara de que la
   * relectura salga bien, un fallo ahí dejaría un sello acreditado y un
   * teléfono mudo — y el reintento del POS tampoco lo arreglaría,
   * porque el reintento es `duplicada` y por diseño no vuelve a
   * empujar.
   *
   * `after()` y no un `void` suelto: Vercel congela la función al
   * responder y una promesa suelta muere ahí. El aviso NUNCA frena la
   * operación (los puntos ya están), pero SÍ tiene que ejecutarse.
   *
   * Solo cuando el ledger otorgó de verdad. En el reintento idempotente
   * no cambió nada que el teléfono tenga que bajar, y empujar igual
   * convertiría un POS con reintentos agresivos en un generador de
   * pushes.
   */
  if (rpc.otorgado === true) {
    after(() => avisarCambioDePase(miembro.miembroId));
  }

  // Una regla del programa dijo que no (compra mínima, tope diario,
  // vigencia, membresía pausada…). 422 y el motivo tal cual: es
  // exactamente lo que el cajero tiene que poder leerle al cliente.
  if (rpc.otorgado === false && !duplicada) {
    return cerrar(
      ctx,
      errorApi(
        "regla_del_programa",
        rpc.motivo ?? "El programa no otorgó puntos por esta operación.",
        ctx.requestId,
        { cabeceras: ctx.cabecerasLimite },
      ),
      {
        codigoError: "regla_del_programa",
        miembroId: miembro.miembroId,
        referencia,
        puntosDelta: 0,
        userAgent,
      },
    );
  }

  const { data: filas } = await ctx.db
    .from("transacciones_puntos")
    // Columnas explícitas y ni una de más: `motivo` ya no se lee porque
    // ya no se devuelve.
    .select("id, puntos, saldo_anterior, saldo_posterior, created_at, reglas")
    .eq("miembro_id", miembro.miembroId)
    .eq("referencia", referenciaFinal)
    .limit(1);

  const movimiento = ((filas ?? [])[0] ?? null) as MovimientoGuardado | null;
  if (!movimiento) {
    // El RPC dijo que sí pero el movimiento no aparece: algo se rompió
    // entre las dos consultas. Se responde degradado en vez de inventar
    // una respuesta.
    console.error("[api-lealtad] la acreditación no dejó movimiento legible.");
    return cerrar(
      ctx,
      errorApi("degradado", "No se pudo confirmar la acumulación.", ctx.requestId, {
        cabeceras: ctx.cabecerasLimite,
      }),
      { codigoError: "degradado", miembroId: miembro.miembroId, referencia, userAgent },
    );
  }

  // MISMA REFERENCIA, OTRO CUERPO. No es un reintento: es un POS que
  // reusó el número de tiquete. Devolver 200 acá le haría creer que se
  // sumó algo que no se sumó.
  if (duplicada) {
    const montoViejo = movimiento.reglas?.monto ?? null;
    if ((montoViejo ?? null) !== (monto ?? null)) {
      return cerrar(
        ctx,
        errorApi(
          "conflicto",
          "Esa `referencia` ya se usó con otro monto. Usá una referencia distinta por cada cobro.",
          ctx.requestId,
          { cabeceras: ctx.cabecerasLimite },
        ),
        {
          codigoError: "conflicto",
          miembroId: miembro.miembroId,
          referencia,
          userAgent,
        },
      );
    }
  } else {
    // EL HILO QUE HACE REVERSIBLE UN INCIDENTE. Con esto, deshacer lo
    // que hizo una llave filtrada es `where llave_id = … and created_at
    // > …` en vez de buscar texto en `motivo`.
    await ctx.db
      .from("transacciones_puntos")
      .update({ llave_id: ctx.llaveId })
      .eq("id", movimiento.id);
  }

  const meta = await metaDelPrograma(ctx);
  const saldoPosterior = movimiento.saldo_posterior ?? rpc.saldo ?? 0;

  return responder(
    ctx,
    serializarAcreditacion({
      id: movimiento.id,
      otorgado: !duplicada,
      duplicada,
      puntosOtorgados: duplicada ? 0 : (rpc.puntos ?? movimiento.puntos ?? 0),
      saldoAnterior: movimiento.saldo_anterior ?? 0,
      saldoPosterior,
      meta,
      /**
       * LA FRASE DEL SERVIDOR, NO LA DE LA FILA.
       *
       * En el camino duplicado, `movimiento` es la fila que escribió
       * QUIEN LLEGÓ PRIMERO con esa `referencia`. Si dos integradores
       * están autorizados sobre la misma tarjeta y usan el mismo número
       * de tiquete, devolver `movimiento.motivo` le entregaría al
       * segundo la razón social del primero —«Acumulación (API: Fulano
       * POS)»— que es un tercero al que nadie le preguntó. La frase la
       * arma el servidor arriba y es siempre la de ESTA llamada.
       */
      motivo: motivoDelServidor,
      creadoEn: movimiento.created_at,
      requestId: ctx.requestId,
    }),
    // 201 la primera vez; 200 en el reintento idempotente, que no creó
    // nada nuevo.
    duplicada ? 200 : 201,
    {
      miembroId: miembro.miembroId,
      referencia,
      puntosDelta: duplicada ? 0 : (rpc.puntos ?? 0),
      userAgent,
    },
  );
}
