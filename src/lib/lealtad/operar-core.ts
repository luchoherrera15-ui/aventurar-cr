import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avisarCambioDePase } from "@/lib/wallet/servicio";
import {
  INTENTO_VALIDO,
  reglaDeSellos,
  sellosPorCompra,
  traducirErrorDeBase,
  traducirMotivo,
} from "./mostrador";
import { recortarProducto, registrarTransaccionComercial } from "./transacciones";
import { productoDelNegocio } from "./productos-db";
import { formatearCRC } from "@/lib/dinero";
import { TIPOS_TARJETA, leerBeneficio, tipoDe, type TipoTarjeta } from "./tipos-tarjeta";
import { identidadesDeMiembros, miembrosConIdentidad } from "./identidades-db";
import { fichaVisible } from "./identidad-miembro";
import type { PermisosLealtad } from "./permisos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL NÚCLEO QUE MUEVE SALDO — una sola copia, dos puertas
 * ════════════════════════════════════════════════════════════════════
 *
 * Esto vivía dentro de `src/app/lealtad/panel/[id]/escaner-actions.ts`,
 * que es un `"use server"`. Un server action no se puede llamar desde
 * React Native: no es un contrato HTTP estable, es un mecanismo interno
 * de Next. Así que la app móvil necesita un route handler… y un route
 * handler que reimplemente esto sería la segunda copia de las reglas
 * que deciden cuántos sellos entran.
 *
 * Ese error ya está vivo en producción y es la razón de que este archivo
 * exista: `src/app/api/citas/[id]/asistencia/route.ts` escribe el ledger
 * de lealtad con un reparto de permisos reimplementado a mano.
 *
 * ── QUÉ SE MOVIÓ Y QUÉ CAMBIÓ ───────────────────────────────────────
 *
 * Se movió TAL CUAL. Los únicos tres cambios, deliberados:
 *
 *   1. La identidad y los permisos entran POR PARÁMETRO. Antes se
 *      resolvían adentro con `verificarAccesoLealtad`, que lee cookies.
 *      Ahora cada puerta resuelve quién pregunta —cookie o bearer— y se
 *      lo pasa ya resuelto. Ver `@/lib/lealtad/acceso`.
 *   2. Salió `revalidatePath`. Es de Next y solo tiene sentido cuando
 *      hay una página que refrescar; el server action lo sigue llamando
 *      después de invocar esto.
 *   3. Salió `redirect("/lealtad/login")`. Redirigir es decisión de la
 *      puerta: el navegador va al login, el teléfono recibe un 401.
 *
 * ── QUÉ SE QUEDÓ ADENTRO, Y POR QUÉ IMPORTA ─────────────────────────
 *
 * `after()` de `next/server` SE QUEDA. Funciona igual en un route
 * handler que en un server action, y es lo que mantiene viva la lambda
 * mientras salen el aviso al Wallet y el correo de hito. Sacarlo para
 * "que el núcleo sea puro" habría dejado a la app móvil sin las dos
 * cosas — que es exactamente el bug que el escáner web ya tuvo una vez
 * (el correo de respaldo nunca salía desde ese camino).
 *
 * ── LA REGLA DE REVISIÓN DE ESTE ARCHIVO ────────────────────────────
 *
 * Si aparece `rpc("acreditar_lealtad"` o `sellosPorCompra(` DENTRO de
 * `src/app/api/lealtad/app/**` o de un server action, el núcleo no se
 * extrajo bien: esas llamadas van acá y en ningún otro lado.
 */

/** Quién está operando, ya resuelto por la puerta que corresponda. */
export type QuienOpera = {
  usuarioId: string;
  permisos: PermisosLealtad;
};

export type ResultadoAcreditar =
  | {
      ok: true;
      cliente: string;
      /** Lo que ENTRÓ en esta operación. 0 cuando `yaEstaba`. */
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
      /** Para poder ofrecer el canje sin volver a escanear. */
      miembroId: string;
      /** El programa de la tarjeta LEÍDA, no el principal del negocio. */
      programaId: string;
      /** El tipo de la tarjeta que se acaba de leer. */
      tipo: TipoTarjeta;
    }
  | { ok: false; motivo: string; codigo?: string };

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
 * ⚠️ LA APP MÓVIL NO PUEDE CAER ACÁ. Su endpoint exige `intentoId` y
 * devuelve 400 si falta, precisamente para que este respaldo roto nunca
 * gobierne una operación que nace en un teléfono. Esto queda para el
 * panel web, que todavía tiene caminos sin intento.
 */
function referenciaDelMinuto(serial: string, ahora: Date) {
  return `escaneo:${serial}:${ahora.toISOString().slice(0, 16)}`;
}

/**
 * La referencia que se guarda en el ledger, armada SIEMPRE por el
 * servidor.
 *
 * El cliente nunca manda una referencia cruda: aceptarla dejaría mandar
 * `api:tiquete-2026-0001` y quemar de antemano la llave del integrador
 * de punto de venta, haciendo rebotar su sello legítimo. Lo mismo que ya
 * previene `api/lealtad/v1/acreditaciones`.
 *
 * Los prefijos son los que `canal-del-sello.ts` YA conoce (`escaneo:` y
 * `mostrador:`), así que la pantalla de Actividad los etiqueta bien sin
 * tocar una línea. Un prefijo nuevo tipo `app:` caería al descarte y el
 * movimiento aparecería mal atribuido.
 */
function referenciaDeIntento(
  via: "escaneo" | "mostrador",
  identificador: string,
  intentoId: string | undefined,
  serialParaRespaldo: string | null,
): string {
  const intento = (intentoId ?? "").trim();
  if (intento && INTENTO_VALIDO.test(intento)) {
    return `${via}:${identificador}:${intento}`;
  }
  // Sin intento válido: el respaldo del minuto, y solo cuando hay serial
  // (el camino del escáner web). Ver `referenciaDelMinuto`.
  return referenciaDelMinuto(serialParaRespaldo ?? identificador, new Date());
}

/**
 * Por dónde entró la operación. Decide DOS cosas: el texto que queda en
 * el ledger y, en el caso del panel, el prefijo de la referencia.
 *
 *   · `escaneo`   — el QR, desde el panel web o desde la app.
 *   · `panel`     — buscado por nombre en el panel web.
 *   · `mostrador` — buscado por nombre desde la caja del teléfono.
 *
 * `escaneo` y `mostrador` son además los prefijos que `canal-del-sello`
 * ya conoce, así que la pantalla de Actividad los etiqueta sin tocar una
 * línea. Un prefijo nuevo tipo `app:` caería al descarte y el movimiento
 * aparecería mal atribuido.
 */
export type ViaOperacion = "escaneo" | "panel" | "mostrador";

/**
 * EL MOTIVO QUEDA EN EL LEDGER PARA SIEMPRE, así que dice lo que de
 * verdad pasó.
 *
 * ⚠️ LOS TEXTOS NO SE UNIFICARON A PROPÓSITO. Hoy el escáner escribe
 * «Sello por visita (escaneo)» y el panel escribe «Sello por visita», y
 * el escáner además distingue la tarjeta que NO acumula («Tarjeta
 * presentada»), cosa que el panel nunca hizo. Emparejarlos habría
 * cambiado lo que se lee en el historial de movimientos que ya está
 * escrito en producción, y ese historial es justamente lo que un negocio
 * mira cuando desconfía de un movimiento. Se preservan tal cual; lo
 * único nuevo es `mostrador`, que es un camino que antes no existía.
 */
function motivoDelLedger(via: ViaOperacion, acumula: boolean, monto: number | null): string {
  if (via === "panel") return monto === null ? "Sello por visita" : "Compra";

  const sufijo = via === "escaneo" ? "(escaneo)" : "(mostrador)";
  // En una tarjeta que no acumula, este movimiento no es un sello: es el
  // derecho de uso que entra al presentarla y que el canje consume en el
  // mismo acto (ver mostrador.ts).
  if (!acumula) return `Tarjeta presentada ${sufijo}`;
  return monto === null ? `Sello por visita ${sufijo}` : `Compra ${sufijo}`;
}

/** El miembro y su programa, ya comprobados contra ESTE negocio. */
type MiembroResuelto = {
  miembroId: string;
  programaId: string;
  modo: string | null;
  beneficio: unknown;
};

/**
 * De un serial de QR al miembro, comprobando la cadena de tenencia
 * completa: pase → miembro → programa → rancho.
 *
 * LA COMPROBACIÓN QUE IMPORTA es la última: que la tarjeta sea de ESTE
 * negocio. El serial viene del QR, o sea de fuera — sin eso, escanear la
 * tarjeta de otro local sumaría puntos acá.
 */
async function miembroDesdeSerial(
  db: SupabaseClient,
  ranchoId: string,
  serial: string,
): Promise<{ ok: true; miembro: MiembroResuelto } | { ok: false; motivo: string }> {
  const { data: pase } = await db
    .from("pases_wallet")
    .select("miembro_id")
    .eq("serial_number", serial)
    .maybeSingle();
  if (!pase) return { ok: false, motivo: "Esa tarjeta no existe." };

  const { data: miembro } = await db
    .from("miembros")
    .select("id, programa_id")
    .eq("id", pase.miembro_id)
    .maybeSingle();
  if (!miembro) return { ok: false, motivo: "Esa tarjeta ya no tiene dueño." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id, modo, beneficio")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta es de otro negocio." };
  }

  return {
    ok: true,
    miembro: {
      miembroId: miembro.id as string,
      programaId: miembro.programa_id as string,
      modo: programa.modo as string | null,
      beneficio: programa.beneficio,
    },
  };
}

export type EntradaAcreditar = {
  db: SupabaseClient;
  ranchoId: string;
  quien: QuienOpera;
  /** Colones enteros de la compra; null = visita sin monto (sellos). */
  monto: number | null;
  /** Ver `referenciaDeIntento`. */
  intentoId?: string;
  /** Texto libre del concepto ("Matcha latte"). Nunca decide sellos. */
  producto?: string | null;
  /** El id del catálogo (0198), comprobado contra este negocio. */
  productoId?: string | null;
};

/**
 * Acreditar leyendo el QR de la tarjeta.
 *
 * Desde la 0125 esto delega en el RPC `acreditar_lealtad`: el cálculo de
 * puntos, la compra mínima, los topes por transacción y por día y el
 * estado del programa se validan TODOS bajo lock en la base. Quien llama
 * manda el HECHO (escaneó, gastó tanto) — nunca los puntos.
 */
export async function acreditarPorSerialCore(
  entrada: EntradaAcreditar & { serial: string },
): Promise<ResultadoAcreditar> {
  const { db, ranchoId, quien, monto, intentoId, producto, productoId } = entrada;

  if (!quien.permisos.acreditar) {
    return {
      ok: false,
      codigo: "sin_permiso",
      motivo: "No tenés permiso para dar sellos — pedíselo al dueño.",
    };
  }

  const serial = entrada.serial.trim();
  if (!serial || serial.length > 100) {
    return { ok: false, codigo: "serial_invalido", motivo: "Ese código no es una tarjeta de Bookea." };
  }
  const revisionMonto = revisarMonto(monto);
  if (revisionMonto) return revisionMonto;

  const resuelto = await miembroDesdeSerial(db, ranchoId, serial);
  if (!resuelto.ok) return { ok: false, codigo: "tarjeta_ajena", motivo: resuelto.motivo };

  return acreditarResuelto({
    db,
    ranchoId,
    quien,
    monto,
    producto,
    productoId,
    miembro: resuelto.miembro,
    referencia: referenciaDeIntento("escaneo", serial, intentoId, serial),
    via: "escaneo",
  });
}

/**
 * Acreditar a un miembro que se buscó POR NOMBRE, sin escanear.
 *
 * Es el camino de quien no trae el teléfono o no agregó la tarjeta al
 * Wallet. La única diferencia con el escaneo es de dónde sale el
 * miembro: acá llega su id y hay que comprobar que sea de este negocio;
 * allá llega un serial y hay que recorrer pase → miembro → programa.
 *
 * `referencia` la manda el llamador PORQUE LAS DOS PUERTAS LA ARMAN
 * DISTINTO y las dos tienen razón: el panel web usa `panel:<miembro>:
 * <monto>:<minuto>` —que además acepta el número de factura del negocio,
 * y ese gana—, y el endpoint del app usa `mostrador:<miembro>:<intento>`
 * porque allá el `intentoId` es obligatorio. Unificarlas acá habría
 * cambiado la llave de idempotencia del panel que ya está en producción.
 */
export async function acreditarPorMiembroCore(
  entrada: EntradaAcreditar & {
    miembroId: string;
    referencia: string;
    /** Qué texto queda escrito en el ledger. Ver `acreditarResuelto`. */
    via: ViaOperacion;
  },
): Promise<ResultadoAcreditar> {
  const { db, ranchoId, quien, monto, producto, productoId, miembroId, referencia, via } = entrada;

  if (!quien.permisos.acreditar) {
    return {
      ok: false,
      codigo: "sin_permiso",
      motivo: "No tenés permiso para dar sellos — pedíselo al dueño.",
    };
  }

  const revisionMonto = revisarMonto(monto);
  if (revisionMonto) return revisionMonto;

  const resuelto = await miembroDeEsteNegocio(db, ranchoId, miembroId);
  if (!resuelto.ok) return { ok: false, codigo: "miembro_ajeno", motivo: resuelto.motivo };

  return acreditarResuelto({
    db,
    ranchoId,
    quien,
    monto,
    producto,
    productoId,
    miembro: resuelto.miembro,
    referencia,
    via,
  });
}

/**
 * De un id de miembro al miembro, comprobando que sea de ESTE negocio.
 *
 * LA comprobación que importa: el id llega de fuera. Sin esto, un dueño
 * con dos negocios podría acreditarle al miembro de A usando el
 * `ranchoId` de B — y peor, canjearle el premio caro de B contra el
 * saldo de A.
 */
async function miembroDeEsteNegocio(
  db: SupabaseClient,
  ranchoId: string,
  miembroId: string,
): Promise<{ ok: true; miembro: MiembroResuelto } | { ok: false; motivo: string }> {
  const { data: miembro } = await db
    .from("miembros")
    .select("id, programa_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return { ok: false, motivo: "Esa membresía no existe." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id, modo, beneficio")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa membresía es de otro negocio." };
  }

  return {
    ok: true,
    miembro: {
      miembroId: miembro.id as string,
      programaId: miembro.programa_id as string,
      modo: programa.modo as string | null,
      beneficio: programa.beneficio,
    },
  };
}

/**
 * El monto que llega de fuera. Se valida acá y no en cada puerta: dos
 * validaciones distintas del mismo número es cómo se llega a que el app
 * acepte lo que la web rechaza.
 */
function revisarMonto(monto: number | null): { ok: false; motivo: string; codigo: string } | null {
  if (monto === null) return null;
  if (!Number.isInteger(monto) || monto < 0 || monto > 10_000_000) {
    return {
      ok: false,
      codigo: "monto_invalido",
      motivo: "El monto debe ser una cantidad entera de colones.",
    };
  }
  return null;
}

/**
 * El tramo común: de un miembro YA comprobado al movimiento en el
 * ledger, con su registro comercial, su aviso al Wallet y su correo.
 *
 * Es el único lugar del repo que llama `acreditar_lealtad`.
 */
async function acreditarResuelto(args: {
  db: SupabaseClient;
  ranchoId: string;
  quien: QuienOpera;
  monto: number | null;
  producto?: string | null;
  productoId?: string | null;
  miembro: MiembroResuelto;
  referencia: string;
  via: ViaOperacion;
}): Promise<ResultadoAcreditar> {
  const { db, ranchoId, quien, monto, miembro, referencia, via } = args;

  // `tipoDe` tolera lo desconocido y cae a 'puntos', igual que en el
  // resto del módulo: un `modo` que este código no conoce no puede
  // dejar al cliente sin su sello.
  const tipo = tipoDe(miembro.modo);
  const acumula = TIPOS_TARJETA[tipo].acumula;

  // LA REGLA DE ACUMULACIÓN (0197): la decide el SERVIDOR leyendo el
  // beneficio guardado — quien llama manda el hecho (gastó ₡9.000),
  // nunca los sellos. `leerBeneficio` tolera configs viejas o rotas y
  // `sellosPorCompra` cae a «1 por compra», el comportamiento de
  // siempre.
  const beneficio = tipo === "sellos" ? leerBeneficio(miembro.beneficio, "sellos") : null;
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
  const idProducto = args.productoId;
  const delCatalogo =
    idProducto && idProducto.trim() ? await productoDelNegocio(db, ranchoId, idProducto) : null;
  const productoLimpio = recortarProducto(delCatalogo?.nombre ?? args.producto);

  // LA COMPRA QUE NO LLEGA AL MONTO no suma sello, y se dice con el
  // número enfrente en vez de un «no se pudo». La venta SÍ queda
  // registrada (0197): la compra es el dato principal, con sellos o
  // sin ellos.
  if (porMonto && sellos !== null && sellos < 1) {
    await registrarTransaccionComercial(db, {
      ranchoId,
      programaId: miembro.programaId,
      miembroId: miembro.miembroId,
      monto,
      producto: productoLimpio,
      productoId: delCatalogo?.id ?? null,
      sellosOtorgados: 0,
      puntosOtorgados: null,
      referencia,
      registradoPor: quien.usuarioId,
    });
    return {
      ok: false,
      codigo: "no_llega_al_monto",
      motivo: `La compra quedó registrada, pero no llega a ${formatearCRC(
        regla.por === "monto" ? regla.montoPorSello : 0,
      )}: no suma sello.`,
    };
  }

  const argumentos = {
    p_miembro_id: miembro.miembroId,
    p_monto: monto,
    p_referencia: referencia,
    p_usuario_id: quien.usuarioId,
    p_motivo: motivoDelLedger(via, acumula, monto),
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

  if (error) {
    return {
      ok: false,
      codigo: "error_base",
      motivo: traducirErrorDeBase(error, "registrar el sello"),
    };
  }

  const r = data as { otorgado: boolean; puntos?: number; saldo?: number; motivo?: string };
  const yaEstaba = !r.otorgado && r.motivo === "ya-otorgado";
  if (!r.otorgado && !yaEstaba) {
    return {
      ok: false,
      codigo: r.motivo ?? "rechazado",
      motivo: traducirMotivo(r.motivo, "No se pudo registrar."),
    };
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
      programaId: miembro.programaId,
      miembroId: miembro.miembroId,
      monto,
      producto: productoLimpio,
      productoId: delCatalogo?.id ?? null,
      sellosOtorgados: tipo === "sellos" ? (r.puntos ?? 0) : 0,
      puntosOtorgados: tipo === "sellos" ? null : (r.puntos ?? null),
      referencia,
      registradoPor: quien.usuarioId,
    });
  }

  // A QUIÉN se le acaba de sellar. Salía de `perfiles` por `cliente_id`
  // y por eso el mostrador decía «¡Sello para Cliente!» a todo el que se
  // hubiera afiliado por el póster: desde la 0138 esa gente no tiene
  // cuenta y `perfiles` no la conoce. La identidad sale de `personas`,
  // igual que en el resto del panel.
  const [conPersona] = await miembrosConIdentidad(db, { ids: [miembro.miembroId] });
  const identidades = await identidadesDeMiembros(
    db,
    [conPersona ?? { id: miembro.miembroId }],
    ranchoId,
  );
  const cliente = fichaVisible(
    identidades.get(miembro.miembroId) ?? { nombre: null, correo: null, telefono: null },
  ).titulo;

  // El aviso al teléfono nunca frena la operación (los puntos ya
  // están), pero SÍ tiene que ejecutarse: un `void` suelto muere cuando
  // Vercel congela la función al responder. `after` la mantiene viva, y
  // funciona igual desde un route handler que desde un server action.
  after(() => avisarCambioDePase(miembro.miembroId));

  // El respaldo por correo. Sin correo si `yaEstaba`: un reescaneo por
  // señal mala no otorgó nada nuevo, y avisar «¡se acreditó tu sello!»
  // ahí sería mentira.
  if (!yaEstaba) {
    after(async () => {
      try {
        const { avisarSelloPorCorreo } = await import("@/lib/correo/sello-acreditado");
        await avisarSelloPorCorreo(miembro.miembroId, r.saldo ?? 0);
      } catch (e) {
        console.warn("[correo] No salió el respaldo de sello acreditado:", e);
      }
    });
  }

  return {
    ok: true,
    cliente,
    puntos: r.puntos ?? 0,
    saldo: r.saldo ?? 0,
    yaEstaba,
    miembroId: miembro.miembroId,
    programaId: miembro.programaId,
    tipo,
  };
}
