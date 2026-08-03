import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type CodigoInput = {
  codigo: string;
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  activo: boolean;
  usos_maximos: number | null;
  valido_hasta: string | null;
};

type PromocionInput = {
  dias_semana: number[];
  porcentaje_descuento: number;
  etiqueta: string;
  activo: boolean;
};

function revalidarTodo() {
  revalidatePath("/admin/eventos/precios");
  revalidatePath("/mi-negocio", "layout");
  revalidatePath("/eventos");
}

/** Reemplaza los códigos de descuento de UN rancho (nunca de todos). */
export async function guardarCodigosRancho(
  ranchoId: string,
  codigos: CodigoInput[],
) {
  const supabase = await createClient();

  const vacios = codigos.filter((c) => !c.codigo.trim());
  if (vacios.length > 0) {
    return { error: "Todos los códigos necesitan un texto (ej. BODA10)." };
  }

  const { error: errDel } = await supabase
    .from("codigos_descuento")
    .delete()
    .eq("rancho_id", ranchoId);
  if (errDel) return { error: errDel.message };

  if (codigos.length > 0) {
    const { error } = await supabase.from("codigos_descuento").insert(
      codigos.map((c) => ({
        ...c,
        codigo: c.codigo.trim().toUpperCase(),
        rancho_id: ranchoId,
      })),
    );
    if (error) {
      if (error.code === "23505") {
        return { error: "Hay un código repetido — cada código debe ser único." };
      }
      return { error: error.message };
    }
  }

  revalidarTodo();
  return { error: null };
}

/** Reemplaza las promociones automáticas de UN rancho (nunca de todos). */
export async function guardarPromocionesRancho(
  ranchoId: string,
  promociones: PromocionInput[],
) {
  const supabase = await createClient();

  const { error: errDel } = await supabase
    .from("promociones_dia")
    .delete()
    .eq("rancho_id", ranchoId);
  if (errDel) return { error: errDel.message };

  if (promociones.length > 0) {
    const { error } = await supabase.from("promociones_dia").insert(
      promociones.map((p) => ({ ...p, rancho_id: ranchoId })),
    );
    if (error) return { error: error.message };
  }

  revalidarTodo();
  return { error: null };
}
