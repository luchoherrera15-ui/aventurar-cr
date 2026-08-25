"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { acreditarPorSerialCore, type ResultadoAcreditar } from "@/lib/lealtad/operar-core";
import type { TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";

/**
 * Sumar una visita/compra escaneando la tarjeta del cliente.
 *
 * ── ESTE ARCHIVO YA NO TIENE LÓGICA DE NEGOCIO ──────────────────────
 *
 * Todo lo que decide cuántos sellos entran —la regla de acumulación, la
 * cadena de tenencia de la tarjeta, la llave de idempotencia, el RPC, el
 * registro comercial, el aviso al Wallet y el correo de respaldo— se
 * mudó a `@/lib/lealtad/operar-core`, porque la app móvil necesita
 * exactamente lo mismo y un server action no se puede llamar desde React
 * Native. Reimplementarlo en un route handler habría creado una segunda
 * copia de las reglas que mueven saldo, que es un error que este repo ya
 * tiene vivo en `api/citas/[id]/asistencia/route.ts`.
 *
 * Lo que queda acá es lo que SOLO tiene sentido en el navegador:
 * resolver la identidad por cookie, mandar al login, y revalidar la
 * página. La firma pública no cambió — `escaner-panel.tsx` y
 * `modo-mostrador.tsx` no se tocaron.
 */

/**
 * El tipo que ya consumían las pantallas. Se mantiene con este nombre y
 * esta forma —sin `programaId`, que el núcleo sí devuelve— para no
 * tocar a `escaner-panel.tsx`: lo que el escáner web necesita saber no
 * cambió, y ensanchar el tipo acá obligaría a revisar cada lugar que lo
 * desestructura.
 */
export type ResultadoEscaneo =
  | {
      ok: true;
      cliente: string;
      puntos: number;
      saldo: number;
      yaEstaba: boolean;
      miembroId: string;
      tipo: TipoTarjeta;
    }
  | { ok: false; motivo: string };

/** Del resultado del núcleo al que esperan las pantallas del panel. */
function paraElPanel(r: ResultadoAcreditar): ResultadoEscaneo {
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return {
    ok: true,
    cliente: r.cliente,
    puntos: r.puntos,
    saldo: r.saldo,
    yaEstaba: r.yaEstaba,
    miembroId: r.miembroId,
    tipo: r.tipo,
  };
}

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
  /** El producto del CATÁLOGO que se eligió en la caja (0198). */
  productoId?: string | null,
): Promise<ResultadoEscaneo> {
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };

  // Llave de servicio: `pases_wallet` no le da lectura al negocio, solo
  // al dueño de la tarjeta (0060). El acceso ya se comprobó arriba.
  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const resultado = await acreditarPorSerialCore({
    db,
    ranchoId,
    quien: { usuarioId: user.id, permisos },
    serial: serialNumber,
    monto,
    intentoId,
    producto,
    productoId,
  });

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return paraElPanel(resultado);
}
