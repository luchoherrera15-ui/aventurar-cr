import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";
import { miNegocioFood } from "@/lib/food/auth";
import { HORAS_DEMANDA } from "@/lib/food/panel-demo";
import type { BarraGrafico } from "@/components/food/panel";
import FranjasPanel from "./franjas-panel";

/**
 * DISPONIBILIDAD — la pantalla donde el restaurante abre y administra
 * sus franjas horarias (fecha + hora + cupo + descuento). Server
 * Component: trae las sedes y las franjas REALES de food_locations /
 * food_franjas y le calcula a `hoy` la hora de Costa Rica UNA vez,
 * para que el cliente no dependa de su propio reloj (el patrón de
 * hidratación de todo el panel: el servidor decide qué día es).
 *
 * Lo único de utilería acá es la curva de demanda por hora
 * (HORAS_DEMANDA, panel-demo.ts): es la guía comercial de "¿a qué
 * hora conviene abrir?" mientras el negocio no tiene volumen propio,
 * y va marcada como "Datos de ejemplo". panel-demo se importa SOLO
 * en servidor (regla del módulo); acá se transforma a las barras
 * serializables que el gráfico cliente recibe por props — pasarle
 * también el formateador no se puede (una función no cruza la
 * frontera servidor→cliente), así que el % va en el propio valor y
 * el panel cliente pone el texto.
 */

/** "19:00" → "7 pm" — rótulo corto para el eje del gráfico de demanda
 *  (con `horaCorta` saldría "7:00 p.m.", que a 11 barras no cabe en
 *  el ancho de un teléfono). "12 md" es como se dice acá el mediodía. */
function etiquetaHora(hora: string): string {
  const h = Number(hora.slice(0, 2));
  if (h === 12) return "12 md";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export default async function FranjasFoodPage() {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  const [{ data: sedes }, { data: franjas }] = await Promise.all([
    supabase.from("food_locations").select("id, nombre").eq("business_id", negocio.id).order("nombre"),
    // fecha desc: con el tope de 200 filas, primero entran TODAS las
    // futuras (que son las administrables) y el resto del cupo lo
    // llena el histórico reciente.
    supabase
      .from("food_franjas")
      .select("id, location_id, fecha, hora, capacidad, reservado, descuento_porcentaje, activa")
      .eq("business_id", negocio.id)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(200),
  ]);

  // La demanda demo, ya convertida a "% de las reservas" por hora:
  // números enteros serializables, listos para GraficoBarras. Las dos
  // horas pico de la cena van `destacada` (la forma "énfasis" del
  // sistema: color solo donde está el argumento).
  const totalPeso = HORAS_DEMANDA.reduce((a, h) => a + h.peso, 0);
  const demanda: BarraGrafico[] = HORAS_DEMANDA.map((h) => ({
    etiqueta: etiquetaHora(h.hora),
    valor: Math.round((h.peso / totalPeso) * 100),
    destacada: h.hora === "19:00" || h.hora === "20:00",
  }));

  return (
    <FranjasPanel
      negocioId={negocio.id}
      sedes={sedes ?? []}
      franjas={franjas ?? []}
      hoy={hoyISOCR()}
      demanda={demanda}
    />
  );
}
