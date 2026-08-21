"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCambioDePase } from "@/lib/wallet/servicio";
import { reglaDeSellos, sellosPorCompra, traducirErrorDeBase, traducirMotivo } from "@/lib/lealtad/mostrador";
import {
  recortarProducto,
  registrarTransaccionComercial,
} from "@/lib/lealtad/transacciones";
import { productoDelNegocio } from "@/lib/lealtad/productos-db";
import { formatearCRC } from "@/lib/dinero";
import {
  TIPOS_TARJETA,
  leerBeneficio,
  tipoDe,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { identidadesDeMiembros, miembrosConIdentidad } from "@/lib/lealtad/identidades-db";
import { fichaVisible } from "@/lib/lealtad/identidad-miembro";

/**
 * Sumar una visita/compra escaneando la tarjeta del cliente.
 *
 * Lo puede hacer el dueño o un colaborador: `verificarAccesoOperativo`
 * resuelve los dos. El QR del pase lleva el `serial_number`, que es la
 * identidad de la tarjeta; de ahí sale el miembro.
 *
 * Desde la 0125 esto delega en el RPC `acreditar_lealtad`: el cálculo
 * de puntos, la compra mínima, los topes por transacción y por día y
 * el estado del programa se validan TODOS bajo lock en la base. El
 * navegador manda el hecho (escaneó, gastó tanto) — nunca los puntos.
 */

export type ResultadoEscaneo =
  | {
      ok: true;
      cliente: string;
      /** Lo que ENTRÓ en este escaneo. 0 cuando `yaEstaba`. */
      puntos: number;
      saldo: number;
      /**
       * NO SE ACREDITÓ NADA: esta lectura ya había entrado antes.
       *
       * `ok: true` significa «la operación se resolvió», no «se sumó».
       * Quien pinte esto TIENE que separar los dos casos: el dueño
       * escaneó de más, vio «¡Sello sumado!» cada vez, el saldo se quedó
       * clavado y reportó que el sistema no entrega los sellos.
       */
      yaEstaba: boolean;
      /** Para que el panel pueda ofrecer el canje sin volver a escanear. */
      miembroId: string;
      /**
       * EL TIPO DE LA TARJETA QUE SE ACABA DE LEER.
       *
       * Viaja en el resultado y NO como prop del componente a propósito:
       * el escáner vive dentro del modo mostrador y del botón de Inicio,
       * y los dos reciben sus props de `page.tsx`. Con el tipo acá, el
       * mostrador dice «Cupón de Marta — vigente» en vez de «¡Sello
       * sumado a Marta!» sin que ninguna pantalla tenga que pasárselo —
       * y si un día un negocio tiene dos tarjetas de tipos distintos, el
       * texto sigue siendo el de la que se leyó.
       */
      tipo: TipoTarjeta;
    }
  | { ok: false; motivo: string };

/**
 * LA LLAVE DE IDEMPOTENCIA DEL ESCANEO — el respaldo, no la principal.
 *
 * La cámara lee el QR unas diez veces por segundo. El cliente para el
 * bucle al primer acierto, pero eso es cortesía: esta referencia con el
 * MINUTO adentro es lo que rebota el segundo intento.
 *
 * ------------------------------------------------------------------
 * POR QUÉ DEJÓ DE SER LA PRINCIPAL
 * ------------------------------------------------------------------
 * El minuto es de CALENDARIO, no una ventana que corre. Eso hace que la
 * protección caiga justo al revés de como uno la imagina:
 *
 *   · dos escaneos a las 14:28:01 y 14:28:59 —cincuenta y ocho segundos
 *     aparte, o sea DOS VENTAS DE VERDAD en un café con fila— se
 *     colapsan en uno y el segundo sello no existe;
 *   · dos escaneos a las 14:28:59 y 14:29:01 —dos segundos aparte, o
 *     sea el doble toque que esto venía a evitar— caen en minutos
 *     distintos y pasan los dos.
 *
 * Verificado en producción: el ledger del dueño tenía exactamente dos
 * movimientos, 14:28 y 14:29, después de escanear muchas más veces.
 *
 * Ahora la llave principal la manda el mostrador: un identificador POR
 * INTENTO, que se reusa si el intento hay que repetirlo (se cortó la
 * señal) y se renueva cuando el sello entró. Con eso, un reintento del
 * mismo escaneo no suma dos veces y dos ventas seguidas sí suman dos.
 *
 * Esto queda como respaldo para quien todavía no manda intento — la app
 * móvil, sin ir más lejos—: sin llave, dos peticiones idénticas
 * duplicarían el sello, y eso es peor que perder uno.
 */
function referenciaDelMinuto(serial: string, ahora: Date) {
  return `escaneo:${serial}:${ahora.toISOString().slice(0, 16)}`;
}

/** Un intento del mostrador: letras, números y guiones (un uuid entra). */
const INTENTO_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;

export async function sumarSelloEscaneado(
  ranchoId: string,
  serialNumber: string,
  /** Colones enteros de la compra; null = visita sin monto (sellos). */
  monto: number | null = null,
  /**
   * Identificador del INTENTO de escaneo, lo genera el mostrador.
   *
   * Mismo intento (un reintento por señal mala) = misma llave = un solo
   * sello. Intento nuevo (el empleado volvió a escanear a propósito) =
   * llave nueva = sello nuevo. Sin él se cae al minuto de calendario.
   */
  intentoId?: string,
  /**
   * Producto o concepto de la compra ("Matcha latte"). Opcional: viaja
   * al registro comercial (0197), nunca decide sellos ni puntos.
   */
  producto?: string | null,
  /**
   * El producto del CATÁLOGO que se eligió en la caja (0198).
   *
   * Llega del navegador, así que se COMPROBA contra este negocio antes
   * de usarlo (más abajo) y de ahí sale el nombre que se guarda en la
   * venta. No decide el monto: el monto es el que llegó, porque en la
   * caja es editable a propósito — una venta puede llevar dos cafés.
   */
  productoId?: string | null,
): Promise<ResultadoEscaneo> {
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };
  if (!permisos.acreditar) {
    return { ok: false, motivo: "No tenés permiso para dar sellos — pedíselo al dueño." };
  }

  const serial = serialNumber.trim();
  if (!serial || serial.length > 100) {
    return { ok: false, motivo: "Ese código no es una tarjeta de Bookea." };
  }
  if (monto !== null && (!Number.isInteger(monto) || monto < 0 || monto > 10_000_000)) {
    return { ok: false, motivo: "El monto debe ser una cantidad entera de colones." };
  }

  // Llave de servicio: `pases_wallet` no le da lectura al negocio, solo
  // al dueño de la tarjeta (0060). El acceso ya se comprobó arriba.
  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: pase } = await db
    .from("pases_wallet")
    .select("miembro_id")
    .eq("serial_number", serial)
    .maybeSingle();
  if (!pase) return { ok: false, motivo: "Esa tarjeta no existe." };

  const { data: miembro } = await db
    .from("miembros")
    .select("id, cliente_id, programa_id")
    .eq("id", pase.miembro_id)
    .maybeSingle();
  if (!miembro) return { ok: false, motivo: "Esa tarjeta ya no tiene dueño." };

  // LA COMPROBACIÓN QUE IMPORTA: que la tarjeta sea de ESTE negocio.
  // El serial viene del QR, o sea de fuera — sin esto, escanear la
  // tarjeta de otro local sumaría puntos acá.
  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id, modo, beneficio")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta es de otro negocio." };
  }

  // `tipoDe` tolera lo desconocido y cae a 'puntos', igual que en el
  // resto del módulo: un `modo` que este código no conoce no puede
  // dejar al cliente sin su sello.
  const tipo = tipoDe(programa.modo as string | null);
  const acumula = TIPOS_TARJETA[tipo].acumula;

  // LA REGLA DE ACUMULACIÓN (0197): la decide el SERVIDOR leyendo el
  // beneficio guardado — el navegador manda el hecho (gastó ₡9.000),
  // nunca los sellos. `leerBeneficio` tolera configs viejas o rotas y
  // `sellosPorCompra` cae a «1 por compra», el comportamiento de
  // siempre.
  const beneficio = tipo === "sellos" ? leerBeneficio(programa.beneficio, "sellos") : null;
  const regla = reglaDeSellos(beneficio);
  const porMonto = tipo === "sellos" && regla.por === "monto" && monto !== null;
  const sellos = porMonto ? sellosPorCompra(beneficio, monto) : null;

  // EL PRODUCTO DEL CATÁLOGO (0198), comprobado contra ESTE negocio: un
  // id ajeno enlazaría la venta al producto de otro local. Si no pasa
  // el filtro —o si la 0198 todavía no está— la venta se registra igual
  // con el texto que haya: el catálogo nunca puede frenar un sello.
  //
  // El nombre que se guarda es el del CATÁLOGO y no el que teclearon:
  // es la foto del menú al momento de la venta, que es justo lo que
  // hace que el reporte no se descuadre cuando el producto se renombra.
  const delCatalogo =
    productoId && productoId.trim() ? await productoDelNegocio(db, ranchoId, productoId) : null;
  const productoLimpio = recortarProducto(delCatalogo?.nombre ?? producto);

  // El intento manda; el minuto es el respaldo. Un `intentoId` con
  // forma rara se descarta en vez de usarse: una llave que el navegador
  // arme mal no puede convertirse en «cada escaneo es único».
  const intento = (intentoId ?? "").trim();
  const referencia =
    intento && INTENTO_VALIDO.test(intento)
      ? `escaneo:${serial}:${intento}`
      : referenciaDelMinuto(serial, new Date());

  // LA COMPRA QUE NO LLEGA AL MONTO no suma sello, y se dice con el
  // número enfrente en vez de un «no se pudo». La venta SÍ queda
  // registrada (0197): la compra es el dato principal, con sellos o
  // sin ellos.
  if (porMonto && sellos !== null && sellos < 1) {
    await registrarTransaccionComercial(db, {
      ranchoId,
      programaId: miembro.programa_id as string,
      miembroId: miembro.id as string,
      monto,
      producto: productoLimpio,
      productoId: delCatalogo?.id ?? null,
      sellosOtorgados: 0,
      puntosOtorgados: null,
      referencia,
      registradoPor: user.id,
    });
    return {
      ok: false,
      motivo: `La compra quedó registrada, pero no llega a ${formatearCRC(
        regla.por === "monto" ? regla.montoPorSello : 0,
      )}: no suma sello.`,
    };
  }

  // EL MOTIVO QUEDA EN EL LEDGER PARA SIEMPRE, así que dice lo que de
  // verdad pasó. En una tarjeta que no acumula, este movimiento no es
  // un sello: es el derecho de uso que entra al presentarla y que el
  // canje consume en el mismo acto (ver mostrador.ts).
  const argumentos = {
    p_miembro_id: miembro.id,
    p_monto: monto,
    p_referencia: referencia,
    p_usuario_id: user.id,
    p_motivo: !acumula
      ? "Tarjeta presentada (escaneo)"
      : monto === null
        ? "Sello por visita (escaneo)"
        : "Compra (escaneo)",
  };

  // Con regla por monto, los sellos van YA CALCULADOS acá arriba
  // (`p_sellos`, 0197). Si esa migración todavía no está pegada, el
  // RPC de 6 argumentos no existe: se degrada al camino de siempre —
  // un sello por compra — en vez de dejar al cliente sin nada.
  let respuesta =
    porMonto && sellos !== null
      ? await db.rpc("acreditar_lealtad", { ...argumentos, p_sellos: sellos })
      : await db.rpc("acreditar_lealtad", argumentos);
  if (
    respuesta.error &&
    porMonto &&
    (respuesta.error.code === "PGRST202" || respuesta.error.code === "42883")
  ) {
    respuesta = await db.rpc("acreditar_lealtad", argumentos);
  }
  const { data, error } = respuesta;

  if (error) return { ok: false, motivo: traducirErrorDeBase(error, "registrar el sello") };

  const r = data as { otorgado: boolean; puntos?: number; saldo?: number; motivo?: string };
  const yaEstaba = !r.otorgado && r.motivo === "ya-otorgado";
  if (!r.otorgado && !yaEstaba) {
    return { ok: false, motivo: traducirMotivo(r.motivo, "No se pudo registrar.") };
  }

  // EL EVENTO COMERCIAL (0197): el sello ya está en el ledger; acá se
  // conserva la compra que lo generó — monto (o null), producto y qué
  // otorgó. Degrada en silencio si la tabla no existe, y un reintento
  // rebota por la misma referencia: nada de esto puede quitarle el
  // sello a nadie. Solo en tarjetas acumulativas: presentar un cupón
  // no es una compra.
  if (acumula && !yaEstaba) {
    await registrarTransaccionComercial(db, {
      ranchoId,
      programaId: miembro.programa_id as string,
      miembroId: miembro.id as string,
      monto,
      producto: productoLimpio,
      productoId: delCatalogo?.id ?? null,
      sellosOtorgados: tipo === "sellos" ? (r.puntos ?? 0) : 0,
      puntosOtorgados: tipo === "sellos" ? null : (r.puntos ?? null),
      referencia,
      registradoPor: user.id,
    });
  }

  // A QUIÉN se le acaba de sellar. Salía de `perfiles` por `cliente_id`
  // y por eso el mostrador decía «¡Sello para Cliente!» a todo el que se
  // hubiera afiliado por el póster: desde la 0138 esa gente no tiene
  // cuenta y `perfiles` no la conoce. La identidad sale de `personas`,
  // igual que en el resto del panel.
  const [conPersona] = await miembrosConIdentidad(db, { ids: [miembro.id as string] });
  const identidades = await identidadesDeMiembros(db, [conPersona ?? miembro], ranchoId);
  const cliente = fichaVisible(
    identidades.get(miembro.id) ?? { nombre: null, correo: null, telefono: null },
  ).titulo;

  // El aviso al teléfono nunca frena la operación (los puntos ya
  // están), pero SÍ tiene que ejecutarse: un `void` suelto muere cuando
  // Vercel congela la función al responder. `after` la mantiene viva.
  after(() => avisarCambioDePase(miembro.id));

  // El respaldo por correo — HASTA AHORA ESTE CAMINO (el escáner) NO
  // LO MANDABA. `motor.ts` sí lo tiene, pero el escáner desde la 0125
  // acredita por su cuenta contra `acreditar_lealtad` y nunca pasa por
  // ahí: el aviso al Wallet se acordó de portar, este no. Resultado real
  // (reportado por el dueño, con su propia tarjeta): el sello sale bien
  // en la base, el push a veces no llega, y el correo — el respaldo que
  // se armó justamente para ese caso — tampoco salía nunca desde acá.
  //
  // Sin correo si `yaEstaba`: un reescaneo por señal mala no otorgó
  // nada nuevo, y avisar "¡se acreditó tu sello!" ahí sería mentira.
  if (!yaEstaba) {
    after(async () => {
      try {
        const { avisarSelloPorCorreo } = await import("@/lib/correo/sello-acreditado");
        await avisarSelloPorCorreo(miembro.id, r.saldo ?? 0);
      } catch (e) {
        console.warn("[correo] No salió el respaldo de sello acreditado:", e);
      }
    });
  }

  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    cliente,
    puntos: r.puntos ?? 0,
    saldo: r.saldo ?? 0,
    yaEstaba,
    miembroId: miembro.id,
    tipo,
  };
}
