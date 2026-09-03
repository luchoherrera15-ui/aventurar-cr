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
import { fichaVisible, SIN_DATOS } from "./identidad-miembro";
import {
  duenosDelContacto,
  revisarAlta,
  textoConsentimientoMostrador,
} from "./personas";
import { contextoDeCuenta } from "./cuenta";
import { personasActivasDe } from "./cupo";
import { definicionDe } from "./planes";
import { estadoDelPrograma } from "./reglas";
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
 * Si aparece `rpc("acreditar_lealtad"`, `rpc("canjear_recompensa"` o
 * `sellosPorCompra(` DENTRO de `src/app/api/lealtad/app/**` o de un
 * server action, el núcleo no se extrajo bien: esas llamadas van acá y
 * en ningún otro lado.
 *
 * ── LO QUE MÁS CUESTA VER: EL TOPE DEL PAQUETE ──────────────────────
 *
 * El cupo de clientes del paquete se comprueba dentro de `afiliarCore`,
 * NO en la puerta que lo llama. Vivía en el server action del panel, y
 * dejarlo ahí habría convertido al endpoint del teléfono en la puerta de
 * atrás del cobro: un paquete de $12 afiliando sin techo desde la caja
 * mientras la web frena en el mismo número. Es la misma advertencia que
 * `cupo.ts:45-56` dejó escrita y la misma que `altaPorQr` ya respeta.
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
  /** El programa está ARCHIVADO: se dice con nombre, antes del RPC. */
  archivado: boolean;
  /** El nombre de la tarjeta, para poder nombrarla en el rechazo. */
  nombrePrograma: string | null;
};

/**
 * LA FRASE DE LA TARJETA ARCHIVADA — la que ve el escáner.
 *
 * El RPC contesta «El programa está en estado archivado y no acumula.»,
 * que es cierto pero no le dice al dueño ni CUÁL tarjeta es ni cómo
 * salir — el caso Café Oscuro: archivó su tarjeta, el escaneo «dejó de
 * funcionar» y nadie le dijo que la salida era restaurarla. Esta frase
 * se devuelve ANTES del RPC (el RPC sigue siendo la autoridad y
 * revalida bajo lock; esto solo mejora lo que se lee) y les sirve a las
 * tres puertas de una vez: el escáner web, /[slug]/scan y la app móvil
 * pintan `motivo` tal cual.
 */
function motivoTarjetaArchivada(nombre: string | null): string {
  const cual = nombre && nombre.trim() ? `La tarjeta «${nombre.trim()}»` : "Esta tarjeta";
  return (
    `${cual} está archivada — los sellos de tus clientes siguen guardados. ` +
    "Restaurala desde el panel, en Tarjetas → Archivadas."
  );
}

/**
 * Arma el `MiembroResuelto` desde la fila cruda del programa.
 *
 * La fila llega de un `select *` A PROPÓSITO: `estado` es de la 0125 y
 * contra una base sin migrar una lista explícita de columnas fallaría
 * entera (mismo criterio que `revisarReglas`). Sin la columna,
 * `estadoDelPrograma` deriva del booleano `activo` de la 0060 — y una
 * fila vieja nunca se lee como archivada.
 */
function miembroResuelto(
  miembro: { id: string; programa_id: string },
  programa: Record<string, unknown>,
): MiembroResuelto {
  return {
    miembroId: miembro.id,
    programaId: miembro.programa_id,
    modo: typeof programa.modo === "string" ? programa.modo : null,
    beneficio: programa.beneficio,
    archivado:
      estadoDelPrograma({
        estado: typeof programa.estado === "string" ? programa.estado : null,
        activo: !!programa.activo,
      }) === "archivado",
    nombrePrograma: typeof programa.nombre === "string" ? programa.nombre : null,
  };
}

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
    .select("*")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  const fila = (programa ?? null) as Record<string, unknown> | null;
  if (!fila || fila.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta es de otro negocio." };
  }

  return {
    ok: true,
    miembro: miembroResuelto(
      { id: miembro.id as string, programa_id: miembro.programa_id as string },
      fila,
    ),
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
    .select("*")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  const fila = (programa ?? null) as Record<string, unknown> | null;
  if (!fila || fila.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa membresía es de otro negocio." };
  }

  return {
    ok: true,
    miembro: miembroResuelto(
      { id: miembro.id as string, programa_id: miembro.programa_id as string },
      fila,
    ),
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

  // ── LA ARCHIVADA SE DICE CON NOMBRE, ANTES DEL RPC ──────────────
  // El RPC sigue siendo la autoridad (revalida el estado bajo lock);
  // esto solo cambia la frase que le llega al mostrador: sin este
  // corte, el escáner leía «El programa está en estado archivado y no
  // acumula.» — sin el nombre de la tarjeta y sin la salida.
  if (miembro.archivado) {
    return {
      ok: false,
      codigo: "programa_archivado",
      motivo: motivoTarjetaArchivada(miembro.nombrePrograma),
    };
  }

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

// ════════════════════════════════════════════════════════════════════
//  CANJEAR — entregar el premio
// ════════════════════════════════════════════════════════════════════

export type ResultadoCanjear =
  | {
      ok: true;
      saldo: number;
      recompensa: string;
      sku: string | null;
      instrucciones: string | null;
    }
  | { ok: false; motivo: string; codigo?: string };

/**
 * Confirma el canje de una recompensa. El RPC revalida TODO bajo lock
 * (saldo, stock, vigencia, límites): lo que el panel mostró hace un
 * minuto no cuenta — dos canjes simultáneos no pueden gastar el mismo
 * saldo.
 *
 * `referencia` la manda el llamador POR LA MISMA RAZÓN que en
 * `acreditarPorMiembroCore`: las dos puertas la arman distinto y las dos
 * tienen razón. El panel web usa `canje:<miembro>:<recompensa>:<minuto>`
 * —y acepta el número de factura del POS, que gana— y el endpoint del
 * app usa `canje:<miembro>:<recompensa>:<intento>` porque allá el
 * `intentoId` es obligatorio y no tiene el problema del minuto de
 * calendario. Unificarlas acá habría cambiado la llave de idempotencia
 * que ya está en producción.
 *
 * ⚠️ NINGUNA de las dos acepta una referencia CRUDA del teléfono: eso
 * dejaría mandar `api:tiquete-2026-0001` y quemar de antemano la llave
 * del integrador de punto de venta.
 */
export async function canjearCore(entrada: {
  db: SupabaseClient;
  ranchoId: string;
  quien: QuienOpera;
  miembroId: string;
  recompensaId: string;
  referencia: string;
}): Promise<ResultadoCanjear> {
  const { db, ranchoId, quien, miembroId, recompensaId, referencia } = entrada;

  // `canjear` y NO `acreditar`: son permisos distintos del checklist de
  // la 0127. El que entrega premios no es necesariamente el que sella.
  if (!quien.permisos.canjear) {
    return {
      ok: false,
      codigo: "sin_permiso",
      motivo: "No tenés permiso para canjear premios — pedíselo al dueño.",
    };
  }

  const resuelto = await miembroDeEsteNegocio(db, ranchoId, miembroId);
  if (!resuelto.ok) return { ok: false, codigo: "miembro_ajeno", motivo: resuelto.motivo };
  const programaId = resuelto.miembro.programaId;

  // ── LA RECOMPENSA TAMBIÉN TIENE QUE SER DE ESTA TARJETA ─────────
  // `recompensaId` llega de fuera —del navegador o del teléfono— y de
  // acá para abajo todo corre con la LLAVE DE SERVICIO: sin este filtro
  // se leían y se anotaban filas de la recompensa de otro negocio.
  //
  // El débito real ya lo frenaba la base —el RPC compara
  // `v_rec.programa_id <> v_miembro.programa_id` (0125:461)— así que
  // esto no era plata que se fuera. Lo que faltaba era la capa de
  // afuera: `revisarReglas` leía el costo de una recompensa ajena y
  // `anotarIntento` escribía su id en la auditoría de este negocio.
  //
  // MISMO MENSAJE para «no existe» y «es de otro negocio», igual que el
  // RPC: no se delata qué recompensas existen fuera de acá.
  const { data: duena } = await db
    .from("recompensas")
    .select("programa_id")
    .eq("id", recompensaId)
    .maybeSingle();
  if (!duena || duena.programa_id !== programaId) {
    return { ok: false, codigo: "recompensa_ajena", motivo: "Ese premio no es de esta tarjeta." };
  }

  // ── Las reglas de la tarjeta (0136), ANTES del RPC ──────────────
  // El RPC de la 0125 revalida saldo, stock y límites bajo lock, pero
  // no sabe nada de vigencia, días ni horarios: son de la 0136 y son
  // posteriores. Se comprueban acá, con el estado real de la base — no
  // mirando el pase, que es un dibujo del que se puede sacar captura.
  //
  // Un rechazo queda registrado con su motivo: el canje que NO procede
  // es justo el que hay que poder explicar después.
  const veredicto = await revisarReglas(db, {
    miembroId,
    recompensaId,
    usuarioId: quien.usuarioId,
  });
  if (!veredicto.ok) {
    anotarIntento(db, {
      programaId: veredicto.programaId,
      miembroId,
      recompensaId,
      usuarioId: quien.usuarioId,
      aprobado: false,
      motivo: veredicto.codigo ?? "reglas",
    });
    return { ok: false, codigo: veredicto.codigo ?? "reglas", motivo: veredicto.motivo };
  }

  const { data, error } = await db.rpc("canjear_recompensa", {
    p_miembro_id: miembroId,
    p_recompensa_id: recompensaId,
    p_usuario_id: quien.usuarioId,
    // ── LA LLAVE DE IDEMPOTENCIA, POR FIN CONECTADA ──────────────
    // Acá decía `canje:${randomUUID()}`. Como el azar es distinto en
    // cada request, el índice único `canjes_referencia_unica` (0125:207)
    // —que SÍ está pegado en producción— nunca rebotaba nada, y el
    // `exception when unique_violation` del RPC (0125:517) era código
    // muerto. Dos toques del botón: dos débitos del ledger, dos filas
    // en `canjes`, UN premio entregado.
    //
    // Ahora la referencia es determinista y la arma la puerta (ver la
    // cabecera de esta función): dos toques producen la MISMA, y el
    // segundo choca contra el índice y no escribe. Sin migración: la
    // protección ya estaba pagada, solo no se estaba usando.
    p_referencia: referencia,
  });

  if (error) {
    anotarIntento(db, {
      programaId: veredicto.programaId,
      miembroId,
      recompensaId,
      usuarioId: quien.usuarioId,
      aprobado: false,
      motivo: "error_rpc",
    });
    return {
      ok: false,
      codigo: "error_base",
      motivo: traducirErrorDeBase(error, "entregar el premio"),
    };
  }

  const r = data as {
    ok: boolean;
    motivo?: string;
    canje_id?: string;
    saldo?: number;
    recompensa?: string;
    sku?: string | null;
    instrucciones?: string | null;
  };

  // ── ACÁ SE ANOTA LO QUE DE VERDAD PASÓ ──────────────────────────
  // El RPC revalida bajo lock saldo, stock, límite por cliente y estado
  // de la membresía. Todos esos rechazos quedaban antes anotados como
  // «aprobado», porque la constancia se escribía antes de llegar hasta
  // acá. Ahora el veredicto que se guarda es el final.
  anotarIntento(db, {
    programaId: veredicto.programaId,
    miembroId,
    recompensaId,
    usuarioId: quien.usuarioId,
    aprobado: r.ok,
    motivo: r.ok ? null : (r.motivo ?? "rechazado"),
  });

  // ── «ya-canjeado» NO SE LEE EN VOZ ALTA ─────────────────────────
  // Acá salía `r.motivo` tal cual, y el segundo toque del botón hacía
  // que el empleado leyera «ya-canjeado» delante del cliente. El RPC
  // devuelve frases en español para casi todo, pero ese motivo (y
  // `ya-otorgado` del otro RPC) son códigos de máquina.
  if (!r.ok) {
    return {
      ok: false,
      codigo: r.motivo ?? "rechazado",
      motivo: traducirMotivo(r.motivo, "No se pudo entregar el premio."),
    };
  }

  // Tras el canje sale el evento para el POS. En modo manual queda
  // 'pendiente' hasta que el personal lo marque; si algún día hay un
  // proveedor con API, el worker lo levanta de acá. Un fallo escribiendo
  // el evento NO tumba el canje: el débito ya está en el ledger.
  //
  // La idempotencia es el id del canje: un reintento de red del mismo
  // canje no duplica el evento (el unique de la tabla lo rebota).
  if (r.canje_id) {
    try {
      await db.from("eventos_integracion").insert({
        rancho_id: ranchoId,
        tipo: "canje",
        payload: {
          canje_id: r.canje_id,
          miembro_id: miembroId,
          recompensa: r.recompensa,
          sku: r.sku,
          saldo_resultante: r.saldo,
        },
        idempotencia: `canje:${r.canje_id}`,
      });
    } catch {
      // Ver arriba: el canje vale igual.
    }
  }

  // Igual que al acreditar: `after` mantiene viva la lambda mientras
  // sale el aviso, y funciona igual desde un route handler que desde un
  // server action. Un `void` suelto se muere cuando Vercel congela la
  // función al responder, y el premio se descontaría sin que la tarjeta
  // del teléfono se enterara.
  after(() => avisarCambioDePase(miembroId));

  return {
    ok: true,
    saldo: r.saldo ?? 0,
    recompensa: r.recompensa ?? "",
    sku: r.sku ?? null,
    instrucciones: r.instrucciones ?? null,
  };
}

/**
 * Comprueba las reglas de la tarjeta (0136) y DEJA CONSTANCIA.
 *
 * Se llama antes del RPC de canje. El RPC resuelve la carrera por el
 * saldo bajo lock; esto resuelve si la tarjeta puede canjearse hoy, a
 * esta hora, y si a este cliente le queda alguno.
 *
 * Tolerante a la base sin migrar: si `programa_lealtad` todavía no
 * tiene las columnas de reglas, no hay reglas que romper y el canje
 * sigue su curso como antes de la 0136.
 */
async function revisarReglas(
  db: SupabaseClient,
  datos: { miembroId: string; recompensaId: string; usuarioId: string | null },
): Promise<
  | { ok: true; programaId: string | null }
  | { ok: false; motivo: string; codigo?: string; programaId: string | null }
> {
  const { autorizarCanje } = await import("@/lib/lealtad/canje");
  const { hoyISOCR } = await import("@/lib/fechas");

  // El miembro, su programa y el costo de lo que quiere canjear.
  const { data: miembro } = await db
    .from("miembros")
    .select("programa_id")
    .eq("id", datos.miembroId)
    .maybeSingle();
  // El RPC lo rebota con su propio motivo; acá no hay programa que mirar.
  if (!miembro) return { ok: true, programaId: null };

  const programaId = miembro.programa_id as string;

  // `select *`: las columnas de la 0136 pueden no existir todavía, y
  // una lista explícita fallaría entera.
  const [{ data: programa }, { data: recompensa }] = await Promise.all([
    db.from("programa_lealtad").select("*").eq("id", programaId).maybeSingle(),
    db.from("recompensas").select("costo_puntos").eq("id", datos.recompensaId).maybeSingle(),
  ]);
  if (!programa) return { ok: true, programaId };

  // Cuántos canjes lleva este cliente, y cuántos el programa entero.
  const { data: miembrosDelPrograma } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId);
  const idsMiembros = ((miembrosDelPrograma ?? []) as { id: string }[]).map((m) => m.id);

  const [{ count: delCliente }, { count: totales }] = await Promise.all([
    db
      .from("canjes")
      .select("*", { count: "exact", head: true })
      .eq("miembro_id", datos.miembroId)
      .neq("estado", "anulado"),
    idsMiembros.length
      ? db
          .from("canjes")
          .select("*", { count: "exact", head: true })
          .in("miembro_id", idsMiembros)
          .neq("estado", "anulado")
      : Promise.resolve({ count: 0 }),
  ]);

  const ahoraCR = `${hoyISOCR()}T${new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())}`;

  const fila = programa as Record<string, unknown>;
  const veredicto = autorizarCanje({
    programa: {
      estado: (fila.estado as string | null) ?? null,
      activo: !!fila.activo,
      vigente_desde: (fila.vigente_desde as string | null) ?? null,
      vigente_hasta: (fila.vigente_hasta as string | null) ?? null,
      uso_unico: !!fila.uso_unico,
      max_por_cliente: (fila.max_por_cliente as number | null) ?? null,
      max_global: (fila.max_global as number | null) ?? null,
      dias_permitidos: (fila.dias_permitidos as number[] | null) ?? null,
      hora_desde: (fila.hora_desde as string | null) ?? null,
      hora_hasta: (fila.hora_hasta as string | null) ?? null,
    },
    // El saldo lo revalida el RPC bajo lock: acá se le pasa el costo
    // como saldo para que ESA comprobación no rechace nada de más. La
    // autoridad sobre el saldo es una sola, y es el RPC.
    saldo: (recompensa?.costo_puntos as number) ?? 0,
    costo: (recompensa?.costo_puntos as number) ?? 0,
    canjesDelCliente: delCliente ?? 0,
    canjesTotales: totales ?? 0,
    ahoraCR,
  });

  // ── LA CONSTANCIA YA NO SE ESCRIBE ACÁ ──────────────────────────
  // Antes se anotaba en este punto con `aprobado: veredicto.ok`, o sea
  // con el resultado de las reglas de la 0136 y NADA MÁS. El problema:
  // después de esto todavía corre el RPC, que revalida bajo lock el
  // saldo, el stock, el límite por cliente y el estado de la membresía
  // (0125:446-501). Un canje rechazado ahí quedaba anotado como
  // `aprobado: true`.
  //
  // O sea: la tabla que existe justamente para poder explicarle al
  // cliente «no me lo aceptaron» estaba mintiendo, y en la dirección
  // más cara — decía que sí cuando fue que no.
  //
  // Ahora se devuelve el veredicto y lo anota `canjearCore` DESPUÉS del
  // RPC, con lo que de verdad pasó.
  return veredicto.ok
    ? { ok: true, programaId }
    : { ok: false, motivo: veredicto.motivo, codigo: veredicto.codigo, programaId };
}

/**
 * Deja la constancia del intento — el que entró y el que no.
 *
 * Nunca tumba el canje: si la 0137 no está pegada la tabla no existe y
 * esto falla en silencio. Perder el canje por no poder anotarlo sería
 * peor que perder la anotación.
 */
function anotarIntento(
  db: SupabaseClient,
  datos: {
    programaId: string | null;
    miembroId: string;
    recompensaId: string;
    usuarioId: string | null;
    aprobado: boolean;
    motivo: string | null;
  },
) {
  after(async () => {
    try {
      await db.from("intentos_canje").insert({
        programa_id: datos.programaId,
        miembro_id: datos.miembroId,
        recompensa_id: datos.recompensaId,
        usuario_id: datos.usuarioId,
        aprobado: datos.aprobado,
        motivo: datos.motivo,
      });
    } catch {
      // Sin la 0137 no hay dónde anotar. El canje ya se decidió.
    }
  });
}

// ════════════════════════════════════════════════════════════════════
//  ATENDER A MANO — el cliente que llega sin la tarjeta
// ════════════════════════════════════════════════════════════════════

export type MiembroAtendible = {
  miembroId: string;
  nombre: string;
  sinNombre: boolean;
  contacto: string[];
  saldo: number;
  estado: string;
  conPase: boolean;
};

export type ResultadoBuscarClientes =
  | { ok: true; clientes: MiembroAtendible[] }
  | { ok: false; motivo: string; codigo?: string };

/** El tope de resultados. Lo fija el SERVIDOR, no el que pregunta. */
const TOPE_CLIENTES = 20;

/**
 * Buscar a un cliente por nombre para atenderlo SIN escanear.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * El modo mostrador era el escáner y nada más, y la lista de Clientes
 * era de solo lectura. O sea: el cliente que llega sin smartphone, o
 * con el teléfono descargado, o con la tarjeta todavía sin agregar al
 * Wallet, hoy NO SE PODÍA ATENDER — se le decía «volvé con la tarjeta».
 *
 * ------------------------------------------------------------------
 * ESTE BUSCADOR NO ENCONTRABA A NADIE DEL PÓSTER
 * ------------------------------------------------------------------
 * Bug real, y del mismo origen que el «Cliente» de la lista: buscaba
 * los nombres en `perfiles` por `miembros.cliente_id` y, si no había ni
 * un `cliente_id`, cortaba con `return { clientes: [] }`. Desde la 0138
 * quien se afilia escaneando el póster NO tiene cuenta —`cliente_id` en
 * null— así que la pantalla que existe para atender «al cliente sin la
 * tarjeta a mano» le contestaba «nadie con ese nombre está afiliado
 * todavía» a los clientes que sí lo estaban. Justo la gente que este
 * buscador vino a rescatar.
 *
 * Ahora la identidad sale de `personas` (con la ficha del negocio y
 * `perfiles` de respaldo), igual que el resto del panel.
 *
 * ------------------------------------------------------------------
 * QUÉ SE DEVUELVE Y QUÉ NO
 * ------------------------------------------------------------------
 * El nombre, el contacto y el saldo, y solo de ESTE negocio. `cliente_id`
 * no: para dar un sello no hace falta, y lo que no se manda al navegador
 * no se puede filtrar. El correo y el teléfono SÍ van —el dueño los pidió
 * para reconocer a quién está atendiendo— y son suyos: se los dio su
 * propio cliente al afiliarse.
 *
 * Exige el permiso `acreditar`: quien no puede dar sellos tampoco
 * necesita la lista de clientes del negocio en su teléfono.
 */
export async function buscarClientesCore(entrada: {
  db: SupabaseClient;
  ranchoId: string;
  quien: QuienOpera;
  texto: string;
}): Promise<ResultadoBuscarClientes> {
  const { db, ranchoId, quien } = entrada;

  if (!quien.permisos.acreditar) {
    return {
      ok: false,
      codigo: "sin_permiso",
      motivo: "No tenés permiso para dar sellos — pedíselo al dueño.",
    };
  }

  const busqueda = entrada.texto.trim();
  if (busqueda.length < 2) {
    return { ok: false, codigo: "busqueda_corta", motivo: "Escribí al menos dos letras del nombre." };
  }

  // Los programas del negocio primero: el filtro por tenencia va en la
  // consulta, no después. Así ningún nombre de otro negocio llega a
  // materializarse en memoria.
  const { data: programas } = await db
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", ranchoId);
  const idsProgramas = ((programas ?? []) as { id: string }[]).map((p) => p.id);
  if (!idsProgramas.length) return { ok: true, clientes: [] };

  const filas = await miembrosConIdentidad(db, { programaIds: idsProgramas });
  if (!filas.length) return { ok: true, clientes: [] };

  const identidades = await identidadesDeMiembros(db, filas, ranchoId);

  // El filtro por texto se hace ACÁ y no con `ilike` en la consulta por
  // dos razones: `ilike` metería los `%` y `_` que el empleado teclee
  // dentro del patrón, y sobre todo `ilike` NO ignora las tildes — en un
  // mostrador nadie escribe «Hernández» con tilde, y «hernandez` no
  // encontraría a nadie. Es la misma cantidad de filas que ya trae el
  // tablero del panel (datos-lealtad.ts) para el mismo negocio.
  //
  // Y se busca por nombre, correo Y teléfono: en la caja lo que el
  // cliente dice es «soy Melissa» o «mi número es el 7011…», y las dos
  // cosas tienen que servir.
  const aguja = normalizar(busqueda);
  const vistas = new Map(
    filas.map((m) => [
      m.id,
      fichaVisible(identidades.get(m.id) ?? { nombre: null, correo: null, telefono: null }, {
        alta: m.created_at,
        miembroId: m.id,
      }),
    ]),
  );

  const candidatos = filas
    .filter((m) => {
      const v = vistas.get(m.id);
      if (!v) return false;
      // La ficha vacía NO entra por su texto: buscar «cliente» no puede
      // devolver a todos los anónimos del negocio.
      const buscables = v.titulo === SIN_DATOS ? v.contacto : [v.titulo, ...v.contacto];
      return buscables.some((t) => normalizar(t).includes(aguja));
    })
    .slice(0, TOPE_CLIENTES);
  if (!candidatos.length) return { ok: true, clientes: [] };

  const idsMiembros = candidatos.map((m) => m.id);

  const [{ data: tx }, { data: pases }] = await Promise.all([
    db.from("transacciones_puntos").select("miembro_id, puntos").in("miembro_id", idsMiembros),
    db.from("pases_wallet").select("miembro_id").in("miembro_id", idsMiembros),
  ]);

  // El saldo SIEMPRE se suma del ledger, nunca se lee de un contador:
  // es el mismo criterio que el resto del módulo (tablero.ts, motor.ts).
  const saldos = new Map<string, number>();
  for (const t of (tx ?? []) as { miembro_id: string; puntos: number }[]) {
    saldos.set(t.miembro_id, (saldos.get(t.miembro_id) ?? 0) + t.puntos);
  }
  const conPase = new Set(((pases ?? []) as { miembro_id: string }[]).map((p) => p.miembro_id));

  return {
    ok: true,
    clientes: candidatos
      .map((m) => {
        const v = vistas.get(m.id);
        return {
          miembroId: m.id,
          nombre: v?.titulo ?? SIN_DATOS,
          sinNombre: v?.sinNombre ?? true,
          contacto: v?.contacto ?? [],
          saldo: saldos.get(m.id) ?? 0,
          estado: m.estado,
          conPase: conPase.has(m.id),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

/** Sin tildes y en minúscula: en un mostrador nadie escribe «Hernández». */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// ════════════════════════════════════════════════════════════════════
//  ALTA A MANO — la puerta que no es un QR
// ════════════════════════════════════════════════════════════════════

export type ResultadoAfiliar =
  | { ok: true; miembroId: string; nombre: string; contacto: string[] }
  | { ok: false; motivo: string; codigo?: string };

/**
 * ═══════════════════════════════════════════════════════════════════
 *  ALTA A MANO: LA PUERTA QUE NO ES UN QR
 * ═══════════════════════════════════════════════════════════════════
 *
 * ── PARA QUIÉN ES, Y PARA QUIÉN NO ──────────────────────────────────
 * Hasta hoy la ÚNICA puerta de alta a un programa era que el cliente
 * escaneara el póster y llenara su propio formulario. El dueño pidió
 * poder afiliar a mano, desde la caja, a gente real que va a quedar
 * funcionando PARA SIEMPRE — no un script de una vez.
 *
 * Esta función es para GENTE NUEVA EN BOOKEA ENTERAMENTE. Si el
 * correo o el WhatsApp que se teclea ya es de alguien —de este negocio
 * o de cualquier otro— no se crea una fila nueva: se avisa, y a esa
 * persona se la busca por nombre con `buscarClientesCore`, que es la
 * puerta correcta para quien ya tiene ficha. Confundir las dos dejaría
 * que un cajero apurado le cuelgue un consentimiento y una membresía de
 * este negocio a la identidad de un tercero que nunca puso un pie acá,
 * solo porque compartió el mismo dato con otra persona en otro lado.
 *
 * ── POR QUÉ NO ES `completarDatosDelCliente` CON OTRO NOMBRE ────────
 * `completarDatosDelCliente` regulariza una ficha que YA EXISTE
 * (exige `persona_id`, corta si es null). Acá no hay membresía previa
 * de la cual partir: se crea la persona, el vínculo, el consentimiento
 * y la membresía LOS CUATRO, en una sola transacción, adentro del RPC
 * `alta_persona_por_mostrador` (0184) — hermana de `alta_persona_por_qr`
 * con el mismo orden interno que exige el trigger `miembros_zexigir_
 * respaldo` (0181): vínculo y consentimiento tienen que existir ANTES
 * del insert en `miembros`, o la base rechaza la transacción entera.
 *
 * ── EL TOPE DEL PAQUETE VIVE ACÁ, Y NO EN LA PUERTA ─────────────────
 * Estaba en el server action del panel web. Ahí quedó claro por qué no
 * podía quedarse: el endpoint del teléfono habría sido la puerta de
 * atrás del cupo que la web sí cobra — un paquete de $12 afiliando sin
 * techo desde la caja. `cupo.ts:45-56` dejó la advertencia textual y
 * `altaPorQr` (personas.ts:863-880) usa el mismo criterio: se frena la
 * afiliación NUEVA cuando el paquete ya está lleno.
 *
 * ⚠️ EL MOTIVO DE CUPO LLENO MENCIONA EL PLAN, y eso NO puede llegar
 * tal cual al binario de iOS (regla 3.1.1). Por eso viaja con
 * `codigo: "cupo_agotado"`: `motivoParaMovil()` de la puerta del app lo
 * reescribe sin hablar de paquetes, y el panel web sigue leyendo el
 * texto útil de siempre. El filtro es por código y no por substring a
 * propósito — ver `app-movil/puerta.ts`.
 *
 * ── EXIGE `acreditar` Y NO UN PERMISO NUEVO ─────────────────────────
 * Es el permiso de quien atiende la caja, que es quien tiene a la
 * persona enfrente para preguntarle — mismo criterio que
 * `completarDatosDelCliente`.
 */
export async function afiliarCore(entrada: {
  db: SupabaseClient;
  ranchoId: string;
  quien: QuienOpera;
  programaId: string;
  datos: { nombre: string; whatsapp: string; correo: string; aceptaPromos: boolean };
}): Promise<ResultadoAfiliar> {
  const { db, ranchoId, quien, programaId, datos } = entrada;

  // Mismo permiso que completarDatosDelCliente: es quien atiende la
  // caja, que es quien tiene a la persona enfrente para preguntarle.
  if (!quien.permisos.acreditar) {
    return {
      ok: false,
      codigo: "sin_permiso",
      motivo: "No tenés permiso para dar sellos — pedíselo al dueño.",
    };
  }

  const revision = revisarAlta({
    nombre: datos.nombre,
    correo: datos.correo,
    telefono: datos.whatsapp,
  });
  if (!revision.ok) return { ok: false, codigo: "datos_invalidos", motivo: revision.error };

  // El programa tiene que ser DE ESTE negocio: llega de fuera, y sin
  // este chequeo cualquiera podría afiliar gente al programa de otro
  // rancho con sus propios permisos de mostrador.
  const { data: programa } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || (programa as { rancho_id?: string | null }).rancho_id !== ranchoId) {
    return { ok: false, codigo: "programa_ajeno", motivo: "Ese programa no es de este negocio." };
  }

  const { correo, telefono } = revision.contacto;

  // Mismo chequeo que completarDatosDelCliente. Acá no hay persona_id
  // propio: CUALQUIER persona existente con ese contacto cuenta como
  // ajena — este formulario es solo para gente nueva.
  const duenos = await duenosDelContacto(db, { correo, telefono });
  if (!duenos.confiable) {
    return {
      ok: false,
      codigo: "contacto_no_verificable",
      motivo: "No pudimos comprobar esos datos ahora mismo. Probá de nuevo.",
    };
  }
  if (duenos.porCorreo !== null) {
    return {
      ok: false,
      codigo: "correo_duplicado",
      motivo: "Ese correo ya es de otro cliente. Buscalo arriba con el nombre.",
    };
  }
  if (duenos.porTelefono !== null) {
    return {
      ok: false,
      codigo: "telefono_duplicado",
      motivo: "Ese WhatsApp ya es de otro cliente. Buscalo arriba con el nombre.",
    };
  }

  const { data: negocio } = await db
    .from("ranchos")
    .select("nombre, plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  const nombreNegocio = ((negocio as { nombre?: string | null } | null)?.nombre ?? "").trim();

  // ── EL TOPE DEL PAQUETE, ANTES DEL RPC ──────────────────────────
  // Ver la cabecera: esto NO puede vivir en el server action, o el
  // endpoint del teléfono se salta el cupo entero.
  const { plan, cuentaId } = await contextoDeCuenta(db, programa as Record<string, unknown>, {
    planRancho: (negocio as { plan_lealtad?: string | null } | null)?.plan_lealtad ?? null,
  });
  const limite = definicionDe(plan)?.limites.clientesActivos;
  if (limite !== null && limite !== undefined) {
    const usadas = await personasActivasDe(db, { cuentaId, ranchoId });
    if (usadas >= limite) {
      return {
        ok: false,
        // ⚠️ ESTE CÓDIGO ES CONTRATO con `motivoParaMovil()`. Si se
        // renombra, el upsell de plan viaja crudo al binario de iOS.
        codigo: "cupo_agotado",
        motivo: "Tu paquete ya usó todo su cupo de clientes. Escribile a Bookea para subir de plan.",
      };
    }
  }

  const { data, error } = await db.rpc("alta_persona_por_mostrador", {
    p_programa: programaId,
    p_correo: correo,
    p_telefono: telefono,
    p_nombre: revision.nombre,
    p_acepta: datos.aceptaPromos,
    p_texto_consentimiento: textoConsentimientoMostrador(nombreNegocio),
  });
  if (error) {
    return { ok: false, codigo: "error_base", motivo: traducirErrorDeBase(error, "afiliar al cliente") };
  }

  const r = data as {
    estado?: string;
    campo?: "correo" | "whatsapp";
    miembro_id?: string;
  };

  if (r.estado === "duplicado") {
    return {
      ok: false,
      codigo: r.campo === "correo" ? "correo_duplicado" : "telefono_duplicado",
      motivo:
        r.campo === "correo"
          ? "Ese correo ya es de otro cliente. Buscalo arriba con el nombre."
          : "Ese WhatsApp ya es de otro cliente. Buscalo arriba con el nombre.",
    };
  }
  if (r.estado !== "listo" || typeof r.miembro_id !== "string") {
    return { ok: false, codigo: "alta_rechazada", motivo: "No se pudo afiliar. Probá de nuevo." };
  }

  return {
    ok: true,
    miembroId: r.miembro_id,
    nombre: revision.nombre,
    contacto: [correo, telefono].filter((v): v is string => v !== null),
  };
}
