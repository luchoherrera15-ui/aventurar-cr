import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esFuncionInexistente, hashDelPedido } from "@/lib/visitas";

/**
 * POST /api/visitas — anota que alguien está viendo la página de un
 * negocio. Body: { ranchoId }.
 *
 * POR QUÉ ES EL NAVEGADOR EL QUE AVISA, y no el servidor al renderizar:
 * ahí también contarían los robots de Google y las precargas del
 * navegador, y el número se inflaría solo. El aviso sale después de que
 * la página cargó — eso ya deja afuera a casi todo lo que no es gente.
 *
 * LA IP NO SE GUARDA. Acá se convierte en un hash junto con el
 * navegador, el día y una sal secreta (ver src/lib/visitas.ts) y solo
 * eso viaja a la base. El hash cambia todos los días, así que tampoco
 * sirve para seguir a nadie.
 *
 * SIEMPRE RESPONDE 204, pase lo que pase: la base sin migrar, un id que
 * no existe, Supabase caído. Un contador no puede romper —ni demorar—
 * la página de un negocio, y el navegador no tiene nada que hacer con
 * el error.
 */

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

/** Lo mismo para todas las salidas: no hay nada que contarle al cliente. */
const SIN_CONTENIDO = { status: 204 } as const;

export async function POST(request: Request) {
  try {
    let body: { ranchoId?: unknown } | null = null;
    try {
      body = await request.json();
    } catch {
      // Cae al chequeo de abajo.
    }
    const ranchoId = typeof body?.ranchoId === "string" ? body.ranchoId : "";
    if (!UUID_REGEX.test(ranchoId)) {
      return new NextResponse(null, SIN_CONTENIDO);
    }

    const supabase = await createClient();

    // El DUEÑO mirando su propia página no cuenta: si no, el negocio
    // que revisa su publicación diez veces al día se infla su propio
    // número y el cartel deja de decir la verdad.
    //
    // El ADMIN sí cuenta y sí ve el cartel como cualquiera (decisión
    // del dueño): es una persona más mirando, y excluirlo obligaba a
    // abrir una ventana de incógnito solo para comprobar que el
    // contador funciona.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: rancho } = await supabase
        .from("ranchos")
        .select("owner_id")
        .eq("id", ranchoId)
        .maybeSingle();
      if (rancho?.owner_id === user.id) {
        return new NextResponse(null, SIN_CONTENIDO);
      }
    }

    const visitante = hashDelPedido(await headers());
    const { error } = await supabase.rpc("registrar_visita", {
      p_rancho: ranchoId,
      p_visitante: visitante,
    });
    // Sin la migración 0107 la función no existe todavía: es lo
    // esperado, no se ensucian los logs con eso.
    if (error && !esFuncionInexistente(error)) {
      console.warn("[visitas] no se pudo registrar:", error.message);
    }
  } catch {
    // A prueba de todo, a propósito.
  }
  return new NextResponse(null, SIN_CONTENIDO);
}
