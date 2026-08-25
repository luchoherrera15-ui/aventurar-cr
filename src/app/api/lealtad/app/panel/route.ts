import { abrirPuertaApp, jsonApp, responderPreflight } from "@/lib/lealtad/app-movil/puerta";
import { cargarLealtad } from "@/app/lealtad/panel/[id]/datos-lealtad";
import { elegirPrograma, resumenDeFila } from "@/lib/wallet/programa-principal";
import { operaAhora } from "@/lib/lealtad/programas";
import { minutoISOCR } from "@/lib/fechas";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import {
  pideMontoElTipo,
  registraCompraElTipo,
  textosDelTipo,
} from "@/lib/lealtad/mostrador";
import { productosParaVender } from "@/lib/lealtad/productos-db";

/**
 * TODO LO QUE LA PANTALLA DE LEALTAD DEL TELÉFONO NECESITA, EN UN VIAJE.
 *
 * Una caja abre esto de pie, con un cliente enfrente: una cascada de
 * cuatro peticiones se siente rota aunque cada una sea rápida.
 *
 * ── ⛔ ACÁ NO SALE NADA QUE HUELA A PAGO ────────────────────────────
 *
 * Decisión del dueño (ago 2026), y además la regla 3.1.1 de Apple: la
 * app muestra métricas y opera la caja — escanear, sellar, canjear — y
 * NADA de planes, precios, cupos del paquete ni facturación. Vender
 * software por fuera de la compra dentro de la app es lo que hace que
 * una revisión rebote.
 *
 * Por eso esta respuesta NO lleva `plan_lealtad`, ni los topes del
 * paquete, ni el estado de la suscripción, aunque los tenga a mano.
 * `panel.test.ts` lo fija con una prueba que recorre el JSON entero
 * buscando esas llaves: si alguien las agrega «para mostrar el uso»,
 * la suite se pone en rojo antes que la tienda.
 *
 * ── DEVUELVE LA LISTA DE TARJETAS, NO UNA ───────────────────────────
 *
 * Un negocio puede tener varias (0134). Pura Matcha tiene dos, y cuando
 * tres personas quedaron afiliadas a la equivocada nadie lo notó hasta
 * la tarde. Si el teléfono recibiera solo la principal, ofrecería el
 * premio de una tarjeta contra el saldo de otra.
 */

export const OPTIONS = responderPreflight;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ranchoId = (url.searchParams.get("ranchoId") ?? "").trim();

  // `solo-entrar`: exigir `acreditar` para MIRAR dejaría afuera al
  // colaborador que solo canjea y al dueño que entra a ver los números.
  // Cada bloque se recorta por su propio permiso más abajo.
  const puerta = await abrirPuertaApp(req, { ranchoId, permiso: "solo-entrar", escribe: false });
  if (!puerta.ok) return puerta.respuesta;

  const { db, permisos } = puerta;
  const ahoraCR = minutoISOCR();

  const { data: negocio } = await db
    .from("ranchos")
    .select("id, nombre")
    .eq("id", ranchoId)
    .maybeSingle();

  // `select *` y no una lista de columnas: las de las 0134/0135/0136
  // pueden no existir todavía y una lista explícita fallaría entera.
  const { data: filas } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", ranchoId);

  const todas = (filas ?? []) as Record<string, unknown>[];
  if (todas.length === 0) {
    return jsonApp({
      ok: true,
      negocio: negocio ?? { id: ranchoId, nombre: "" },
      programas: [],
      productos: [],
      permisos,
    });
  }

  // La misma elección que hacen el panel web, la página pública del QR
  // y los dos generadores de pases. Dos criterios distintos mostrarían
  // tarjetas distintas en la misma visita.
  // `resumenDeFila` ya normaliza id, estado, activo y las dos fechas de
  // vigencia — que es exactamente lo que `elegirPrograma` mira para
  // desempatar. Armar el objeto a mano acá era duplicar ese criterio.
  const principal = elegirPrograma(todas.map(resumenDeFila), ahoraCR);

  const idsProgramas = todas.map((f) => f.id as string);
  const { data: recompensas } = await db
    .from("recompensas")
    .select("id, programa_id, nombre, costo_puntos, activo, instrucciones")
    .in("programa_id", idsProgramas);

  const programas = todas.map((f) => {
    const id = f.id as string;
    const tipo = tipoDe(f.modo as string | null);
    const textos = textosDelTipo(tipo);
    const mias = (recompensas ?? []).filter(
      (r) => (r as { programa_id: string }).programa_id === id && r.activo,
    );
    return {
      id,
      nombre: (f.nombre as string) ?? "Tarjeta",
      tipo,
      esPrincipal: principal?.id === id,
      emitiendo: operaAhora(resumenDeFila(f), ahoraCR),
      pideMonto: pideMontoElTipo(tipo),
      registraCompra: registraCompraElTipo(tipo),
      // Los verbos salen del servidor: el teléfono nunca escribe «sello»
      // a mano, porque en un cupón la palabra correcta es otra.
      textos: {
        verboSumar: textos.verboSumar,
        verboCanje: textos.verboCanje,
        muestraSaldo: textos.muestraSaldo,
        unidad: textos.unidad,
      },
      recompensas: mias
        .map((r) => ({
          id: r.id as string,
          nombre: r.nombre as string,
          costo: r.costo_puntos as number,
          instrucciones: (r.instrucciones as string | null) ?? null,
        }))
        .sort((a, b) => a.costo - b.costo),
    };
  });

  // El catálogo de la caja (0198). Es un dato OPERATIVO —qué se está
  // vendiendo— y no comercial: son los productos del negocio a sus
  // clientes, no un plan de Bookea al negocio.
  const productos = await productosParaVender(db, ranchoId).catch(() => []);

  // El resumen SOLO con permiso de auditoría, igual que en el panel web.
  const principalCompleto = todas.find((f) => f.id === principal?.id);
  const metaPrincipal =
    (recompensas ?? [])
      .filter((r) => (r as { programa_id: string }).programa_id === principal?.id && r.activo)
      .map((r) => r.costo_puntos as number)
      .sort((a, b) => a - b)[0] ?? null;

  const resumen =
    permisos.auditoria && principalCompleto
      ? ((await cargarLealtad(principal?.id ?? null, metaPrincipal))?.resumen ?? null)
      : null;

  return jsonApp({
    ok: true,
    negocio: negocio ?? { id: ranchoId, nombre: "" },
    programas,
    productos,
    permisos,
    ...(resumen ? { resumen } : {}),
  });
}
