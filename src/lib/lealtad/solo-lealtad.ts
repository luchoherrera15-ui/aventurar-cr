import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Un negocio que nace del creador de lealtad existe para SU PROGRAMA:
 * no toma reservas, no tiene catálogo ni equipo que agendar. Sin esto,
 * el panel le muestra un calendario vacío, un histórico de reservas que
 * nunca tendrá y media docena de secciones que no le sirven — el
 * "se ve horrible así alto" del que se quejó el dueño.
 *
 * Los módulos (0108) se resuelven como "default del tipo, corregido por
 * las filas de modulos_negocio". Acá se escriben las correcciones que
 * apagan lo operativo. El dueño puede volver a encender lo que quiera
 * desde Configuración → Tipo de negocio y módulos: esto es el punto de
 * partida, no una jaula.
 *
 * Nunca lanza: si la tabla no existe o falla, el negocio ya está creado
 * y lo único que pasa es que ve el panel completo.
 */
const MODULOS_OPERATIVOS = ["agenda", "servicios", "equipo", "recursos", "pagos"] as const;

export async function apagarModulosOperativos(
  db: SupabaseClient,
  ranchoId: string,
): Promise<void> {
  try {
    const { error } = await db.from("modulos_negocio").upsert(
      MODULOS_OPERATIVOS.map((modulo) => ({
        rancho_id: ranchoId,
        modulo,
        activo: false,
      })),
      { onConflict: "rancho_id,modulo" },
    );
    if (error) {
      console.warn("[solo-lealtad] No se pudieron apagar los módulos:", error.message);
    }
  } catch (e) {
    console.warn("[solo-lealtad] No se pudieron apagar los módulos:", e);
  }
}
