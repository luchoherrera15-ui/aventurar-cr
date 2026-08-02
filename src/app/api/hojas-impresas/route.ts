import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COLUMNAS_HOJA,
  componerHoja,
  type InvitacionParaHoja,
} from "@/lib/ia/componer-hoja";

/**
 * Las hojas para imprimir se arman solas de noche.
 *
 * El paquete Plus incluye la invitación en papel, pero componerla es
 * una llamada larga al modelo: el cliente entraba a /i/{slug}/imprimir,
 * apretaba "Componer la hoja" y esperaba minutos mirando un botón. Con
 * esto, cuando entra ya está hecha.
 *
 * POR QUÉ UN CRON Y NO AL ENTREGAR: componer tarda minutos, y tanto la
 * server action de la entrega como el render de la página mueren mucho
 * antes de eso. Un cron es el único lugar donde el tiempo alcanza sin
 * que nadie espere del otro lado.
 *
 * QUÉ CUESTA: cada hoja son unos ₡200 de tokens. Por eso hay tres
 * frenos, del más general al más específico:
 *
 *  1. `motivoParaNoGastar()` — el interruptor de IA y el tope mensual,
 *     los mismos que gobiernan todo lo demás. Si están cerrados, no se
 *     compone nada.
 *  2. MAX_POR_CORRIDA — un atraso de veinte invitaciones no se paga
 *     todo en una noche; se van haciendo de a poco.
 *  3. El presupuesto de tiempo de la función, que corta antes de que
 *     Vercel la mate a la mitad de una composición ya cobrada.
 *
 * Solo se componen las de clientes que YA PAGARON el paquete Plus y ya
 * recibieron su invitación (pedido entregado). Nunca se adelanta a un
 * pedido sin cerrar.
 *
 * El botón manual sigue existiendo, y ahora sirve para rehacerla cuando
 * el diseño digital cambia.
 */

export const maxDuration = 300;

/** Cuántas hojas como máximo por corrida, para no gastar de golpe. */
const MAX_POR_CORRIDA = 3;

/**
 * Cuándo dejar de empezar hojas nuevas. Se corta bastante antes del
 * tope de la función: si Vercel mata la corrida a mitad de una
 * composición, los tokens ya se gastaron y la hoja no se guardó.
 */
const MS_PARA_EMPEZAR_OTRA = 200_000;

type PedidoPlus = { invitacion_id: string | null };

export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno." },
      { status: 500 },
    );
  }

  const inicio = Date.now();

  // Los pedidos Plus ya entregados. `invitacion_id` lo empezó a llenar
  // la entrega desde el panel (0085): antes de eso estaba siempre en
  // null, así que las invitaciones anteriores a esa migración no las va
  // a encontrar por acá — esas se componen con el botón, como siempre.
  const { data: pedidosData, error: errorPedidos } = await admin
    .from("pedidos_invitacion")
    .select("invitacion_id")
    .eq("paquete", "plus")
    .eq("estado", "entregado")
    .not("invitacion_id", "is", null);

  if (errorPedidos) {
    return NextResponse.json(
      { error: "No se pudieron leer los pedidos: " + errorPedidos.message },
      { status: 500 },
    );
  }

  const ids = [
    ...new Set(
      ((pedidosData ?? []) as PedidoPlus[])
        .map((p) => p.invitacion_id)
        .filter((id): id is string => !!id),
    ),
  ];

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, pendientes: 0, compuestas: 0 });
  }

  // De esas, las que tienen diseño propio y todavía no tienen hoja.
  const { data: invData, error: errorInv } = await admin
    .from("invitaciones")
    .select(COLUMNAS_HOJA)
    .in("id", ids)
    .not("html_personalizado", "is", null)
    .is("html_impresion", null)
    // Las más viejas primero: quien lleva más tiempo esperando su hoja
    // es quien menos debería seguir esperando.
    .order("created_at", { ascending: true });

  if (errorInv) {
    return NextResponse.json(
      { error: "No se pudieron leer las invitaciones: " + errorInv.message },
      { status: 500 },
    );
  }

  const pendientes = (invData ?? []) as unknown as InvitacionParaHoja[];
  const compuestas: string[] = [];
  const fallidas: { slug: string; error: string }[] = [];
  let cortadaPorTiempo = false;
  let cortadaPorPresupuesto = false;

  for (const invitacion of pendientes.slice(0, MAX_POR_CORRIDA)) {
    if (Date.now() - inicio > MS_PARA_EMPEZAR_OTRA) {
      cortadaPorTiempo = true;
      break;
    }

    const res = await componerHoja({
      admin,
      invitacion,
      // Sin usuario: el gasto queda a nombre de la plataforma, que es
      // quien lo paga cuando la hoja se arma sola.
      usuarioId: null,
    });

    if (res.ok) {
      compuestas.push(res.slug);
      continue;
    }

    fallidas.push({ slug: invitacion.slug, error: res.error });
    // El interruptor de IA apagado o el tope del mes alcanzado no es un
    // problema de ESTA invitación: es la respuesta para todas. Seguir
    // intentando sería repetir el mismo error una vez por invitación.
    if (res.sinPresupuesto) {
      cortadaPorPresupuesto = true;
      break;
    }
  }

  const quedan = Math.max(0, pendientes.length - compuestas.length);
  if (quedan > 0) {
    console.warn(
      `[hojas] Quedan ${quedan} hoja(s) sin componer; siguen en la próxima corrida.`,
    );
  }

  return NextResponse.json({
    ok: true,
    pendientes: pendientes.length,
    compuestas: compuestas.length,
    slugs: compuestas,
    quedan,
    fallidas,
    cortadaPorTiempo,
    cortadaPorPresupuesto,
    segundos: Math.round((Date.now() - inicio) / 1000),
  });
}
