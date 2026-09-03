"use server";

import { revalidatePath, updateTag } from "next/cache";

/**
 * El catálogo de la portada vive 60 s en la caché de datos (ver
 * `home-datos.ts`). Cualquier acción de acá que lo toque —aprobar,
 * despublicar, destacar, verificar, borrar— revienta el tag para que el
 * cambio se vea de inmediato y no cuando venza el minuto.
 *
 * `updateTag` y no `revalidateTag`: en ESTE Next (16.3) `revalidateTag`
 * exige un segundo argumento de perfil y está pensada para route
 * handlers; `updateTag` es la forma para server actions y da
 * lectura-de-lo-recién-escrito, que es justo lo que el admin espera —
 * aprueba un negocio y lo ve aparecer, no «en un ratito».
 */
function reventarCatalogo() {
  updateTag("catalogo-portada");
}
import { requireAdmin } from "@/lib/auth";
import type { EstadoRancho } from "@/app/mi-negocio/types";

/**
 * La verificación de un negocio (link de redes + cédula) para que el
 * admin la revise antes de aprobar. Las fotos viven en un bucket
 * privado — acá se generan URLs firmadas de corta duración, nunca
 * públicas.
 */
export async function obtenerVerificacion(ranchoId: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { data, error } = await supabase
    .from("verificacion_proveedores")
    .select("red_social_url, cedula_frente_url, cedula_dorso_url")
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: null, verificacion: null };

  const bucket = supabase.storage.from("verificacion-proveedores");
  const [frente, dorso] = await Promise.all([
    bucket.createSignedUrl(data.cedula_frente_url, 300),
    bucket.createSignedUrl(data.cedula_dorso_url, 300),
  ]);

  return {
    error: null,
    verificacion: {
      redSocialUrl: data.red_social_url,
      cedulaFrenteUrl: frente.data?.signedUrl ?? null,
      cedulaDorsoUrl: dorso.data?.signedUrl ?? null,
    },
  };
}

export async function setEstadoRancho(id: string, estado: EstadoRancho) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  // Despublicar saca al negocio del carrusel de la portada en el mismo
  // movimiento. Si no, su puesto quedaba ocupado por algo que el
  // carrusel ya no puede mostrar (la consulta pide estado='aprobado'):
  // un cupo fantasma de los 10, invisible y sin forma de liberarlo.
  const cambios: { estado: EstadoRancho; super_destacado?: boolean } = { estado };
  if (estado !== "aprobado") cambios.super_destacado = false;

  const { error } = await supabase.from("ranchos").update(cambios).eq("id", id);

  // Contra una base sin la 0169 corrida, mandar `super_destacado` haría
  // fallar el update entero y el admin no podría ni despublicar. Se
  // reintenta con lo único que de verdad se pidió cambiar.
  if (error && /super_destacado/.test(error.message)) {
    const reintento = await supabase.from("ranchos").update({ estado }).eq("id", id);
    if (reintento.error) return { error: reintento.error.message };
  } else if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/negocios");
  reventarCatalogo();
  revalidatePath("/");
  // ⚠️ Acá decía `revalidatePath("/")` DOS VECES, y el comentario de
  // arriba dice que las direcciones son dos: `/` y `/eventos`. La
  // segunda nunca se revalidaba — seguía sirviendo la lista vieja.
  revalidatePath("/eventos");
  return { error: null };
}

/**
 * Marca o desmarca un negocio como destacado de la portada. Al
 * destacar entra de último entre los destacados (después se puede
 * subir con las flechas); al quitar, vuelve al orden normal.
 * Devuelve los cambios para que la tabla actualice sin recargar.
 */
export async function setDestacado(id: string, destacar: boolean) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  let nuevoOrden: number | null = null;
  if (destacar) {
    const { data } = await supabase
      .from("ranchos")
      .select("destacado_orden")
      .not("destacado_orden", "is", null)
      .order("destacado_orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    nuevoOrden = ((data?.destacado_orden as number | null) ?? 0) + 1;
  }

  const { error } = await supabase
    .from("ranchos")
    .update({ destacado_orden: nuevoOrden })
    .eq("id", id);
  if (error) {
    return {
      error: /destacado_orden/.test(error.message)
        ? "Falta correr la migración en Supabase (supabase/aplicar-migraciones-pendientes.sql)."
        : error.message,
    };
  }

  revalidatePath("/admin/negocios");
  reventarCatalogo();
  revalidatePath("/");
  return { error: null, cambios: [{ id, destacado_orden: nuevoOrden }] };
}

/** Sube o baja un destacado un puesto, intercambiando con su vecino. */
export async function moverDestacado(id: string, direccion: -1 | 1) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { data } = await supabase
    .from("ranchos")
    .select("id, destacado_orden")
    .not("destacado_orden", "is", null)
    .order("destacado_orden", { ascending: true });

  const lista = (data ?? []) as { id: string; destacado_orden: number }[];
  const i = lista.findIndex((r) => r.id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= lista.length) return { error: null, cambios: [] };

  const cambios = [
    { id: lista[i].id, destacado_orden: lista[j].destacado_orden },
    { id: lista[j].id, destacado_orden: lista[i].destacado_orden },
  ];
  for (const c of cambios) {
    const { error } = await supabase
      .from("ranchos")
      .update({ destacado_orden: c.destacado_orden })
      .eq("id", c.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/negocios");
  reventarCatalogo();
  revalidatePath("/");
  return { error: null, cambios };
}

const LIMITE_SUPER_DESTACADOS = 10;

/**
 * Marca o desmarca un negocio como "súper destacado": hasta 10 rotan
 * cada 4s en el carrusel de la portada (0169) — a diferencia de
 * `destacado_orden`, esto no reordena la grilla normal.
 */
export async function setSuperDestacado(id: string, valor: boolean) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (valor) {
    const { count, error: errorConteo } = await supabase
      .from("ranchos")
      .select("id", { count: "exact", head: true })
      .eq("super_destacado", true)
      // Los mismos que el carrusel puede pintar: sin este filtro, un
      // negocio despublicado seguía ocupando uno de los 10 puestos.
      .eq("estado", "aprobado")
      // Sin este `neq` el negocio compite contra sí mismo: con los 10
      // puestos llenos, volver a marcar uno que YA estaba adentro
      // (doble clic, dos pestañas abiertas) se rechazaba solo.
      .neq("id", id);
    if (errorConteo) {
      return {
        error: /super_destacado/.test(errorConteo.message)
          ? "Falta correr la migración en Supabase (0169_super_destacados.sql)."
          : errorConteo.message,
      };
    }
    if ((count ?? 0) >= LIMITE_SUPER_DESTACADOS) {
      return {
        error: `Ya hay ${LIMITE_SUPER_DESTACADOS} negocios en Súper Destacados. Quitá uno antes de agregar otro.`,
      };
    }
  }

  const { error } = await supabase
    .from("ranchos")
    .update({ super_destacado: valor })
    .eq("id", id);
  if (error) {
    return {
      error: /super_destacado/.test(error.message)
        ? "Falta correr la migración en Supabase (0169_super_destacados.sql)."
        : error.message,
    };
  }

  revalidatePath("/admin/negocios");
  reventarCatalogo();
  // El carrusel vive en la portada, y la portada responde en DOS
  // direcciones: `/` (src/app/page.tsx monta el mismo componente) y
  // `/eventos`. Revalidar solo `/eventos` dejaba a `/` —justo la que
  // ve la gente— sirviendo la lista vieja.
  revalidatePath("/");
  revalidatePath("/");
  return { error: null };
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  VERIFICAR O DESVERIFICAR UN NEGOCIO
 * ════════════════════════════════════════════════════════════════════
 *
 * La insignia verde de la tarjeta (migración 0214). Significa que
 * alguien de Bookea comprobó que el negocio existe y es quien dice ser
 * — el expediente con la cédula y las redes vive en
 * `verificacion_proveedores` y se abre con `obtenerVerificacion()`, acá
 * arriba en este mismo archivo.
 *
 * ⚠️ EL PERMISO SE COMPRUEBA DOS VECES, Y NO SOBRA.
 *
 * Acá con `requireAdmin()`, y otra vez en la base con un trigger. Este
 * chequeo protege de un descuido nuestro; el de la base protege del
 * camino que NO pasa por acá: las políticas de `ranchos` dejan que un
 * dueño edite su propia fila, así que con la anon key y un cliente
 * armado a mano podría marcarse verificado él mismo. Una insignia que
 * cada quien se pone solo no verifica nada.
 */
export async function setVerificado(id: string, valor: boolean) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase.from("ranchos").update({ verificado: valor }).eq("id", id);
  if (error) {
    return {
      error: /verificado/.test(error.message)
        ? "Falta correr la migración en Supabase (0214_negocios_verificados.sql)."
        : error.message,
    };
  }

  revalidatePath("/admin/negocios");
  reventarCatalogo();
  // La insignia sale en las tarjetas de la portada Y del directorio.
  revalidatePath("/");
  revalidatePath("/eventos");
  return { error: null };
}

export async function borrarRancho(id: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase.from("ranchos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/negocios");
  reventarCatalogo();
  revalidatePath("/");
  return { error: null };
}
