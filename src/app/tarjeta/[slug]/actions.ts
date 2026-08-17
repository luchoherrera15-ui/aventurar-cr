"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { minutoISOCR } from "@/lib/fechas";
import { emisoraDeFilasCrudas } from "@/lib/wallet/programa-principal";
import {
  DIAS_COOKIE_PERSONA,
  NOMBRE_COOKIE_PERSONA,
  altaPorQr,
  idDeCuentaDeBookea,
  ipDePeticion,
  personaDelToken,
  revisarAlta,
  type CampoDelAlta,
} from "@/lib/lealtad/personas";

/**
 * EL ALTA DE DOS CAMPOS, DESDE LA PANTALLA.
 *
 * Corre en el servidor por obligación y no por gusto:
 * `alta_persona_por_qr` está concedida SOLO a `service_role`
 * (0138:2145). La llave de servicio no sale de acá.
 *
 * Lo que este archivo aporta sobre el RPC:
 *   · revisa los dos campos ANTES, para que un dedazo cueste corregir
 *     un campo y no el pase;
 *   · elige la tarjeta que EMITE con el mismo criterio que la página y
 *     que los dos generadores (`emisoraDeFilasCrudas`), para que nadie
 *     se afilie a una tarjeta distinta de la que vio;
 *   · abre la sesión de la persona en este navegador y deja la cookie,
 *     que es lo que hace que no haya que volver a escribir nada nunca.
 */

export type EstadoAlta = {
  error: string | null;
  /** Para marcar el campo exacto que hay que arreglar. */
  campo?: CampoDelAlta | null;
  /**
   * El contacto ya es de alguien con cuenta o con sellos juntados. No
   * se escribió nada: se recupera entrando con el código, que es la
   * prueba de posesión que Bookea ya tiene.
   */
  requierePrueba?: boolean;
};

// OJO: de un archivo "use server" solo pueden salir funciones async.
// Una constante exportada acá (el estado inicial, por ejemplo) rompe el
// build. Ese valor vive en el componente que la usa.

export async function afiliarPorQr(
  _anterior: EstadoAlta,
  datos: FormData,
): Promise<EstadoAlta> {
  const slug = String(datos.get("slug") ?? "").trim();
  if (!slug) return { error: "Volvé a escanear el QR del local." };

  // El mínimo que pidió el dueño: nombre y AL MENOS un contacto. Se
  // revisa acá para poder marcar el campo exacto, y otra vez adentro de
  // `altaPorQr` — que es la puerta de verdad, la que ve también lo que
  // no pasó por esta pantalla.
  const revision = revisarAlta({
    nombre: String(datos.get("nombre") ?? ""),
    correo: String(datos.get("correo") ?? ""),
    telefono: String(datos.get("whatsapp") ?? ""),
  });
  if (!revision.ok) return { error: revision.error, campo: revision.campo };

  const db = createAdminClient();
  if (!db) {
    return { error: "No pudimos conectarnos ahora mismo. Probá otra vez en un momento." };
  }

  const { data: negocio } = await db
    .from("ranchos")
    .select("id, nombre, plan_lealtad")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) return { error: "Este QR ya no lleva a ninguna tarjeta. Preguntá en el local." };

  // `select *`: las columnas de las 0134/0135/0136 pueden no existir
  // todavía y una lista explícita fallaría la consulta entera.
  const { data: filas } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", negocio.id);

  const programa = emisoraDeFilasCrudas(
    (filas ?? []) as Record<string, unknown>[],
    minutoISOCR(),
  );
  if (!programa) {
    return {
      error: "Esta tarjeta no está repartiendo pases ahora mismo. Preguntá en el local.",
    };
  }

  const jar = await cookies();
  const cabeceras = await headers();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Las dos identidades que puede traer alguien parado en el mostrador
  // se pasan EN CRUDO: cuál de ellas vale como prueba de posesión —y
  // por lo tanto quién puede reclamar un contacto que ya tiene sellos—
  // lo decide `altaPorQr`, en un solo lugar y con el contacto tecleado
  // a la vista. Esta pantalla no vota en eso.
  const personaProbada = await personaDelToken(
    db,
    jar.get(NOMBRE_COOKIE_PERSONA)?.value ?? null,
  );

  const resultado = await altaPorQr(db, {
    programa,
    ranchoId: negocio.id as string,
    planRancho: (negocio as { plan_lealtad?: string | null }).plan_lealtad ?? null,
    nombreNegocio: (negocio.nombre as string) ?? "",
    contacto: revision.contacto,
    nombre: revision.nombre,
    acepta: datos.get("promos") === "si",
    personaProbada,
    // La sesión anónima del chat flotante NO es una cuenta: colgarle la
    // identidad de lealtad es el bug que documenta `personas.ts`.
    sesion: { clienteId: idDeCuentaDeBookea(user), correo: user?.email ?? null },
    ip: ipDePeticion(cabeceras),
    userAgent: cabeceras.get("user-agent"),
  });

  if (resultado.estado === "requiere_prueba") {
    // El texto NO confirma que haya sellos ni cuántos: la respuesta ya
    // deja ver que ese contacto está en Bookea (es inevitable si se
    // quiere proteger la tarjeta), pero no hace falta agregarle valor
    // al dato para quien esté probando contactos ajenos.
    return {
      requierePrueba: true,
      error:
        resultado.canal === "whatsapp"
          ? "Ese contacto ya tiene una tarjeta en Bookea. Para que nadie más se la lleve, entrá con tu correo y la recuperás con todo lo que tengas juntado."
          : "Ese contacto ya tiene una tarjeta en Bookea. Para que nadie más se la lleve, entrá con el código que te mandamos al correo y la recuperás con todo lo que tengas juntado.",
    };
  }

  if (resultado.estado === "lleno") {
    return {
      error:
        "El programa de este negocio llegó al tope de clientes. No es algo que hayas hecho vos: avisale en la caja.",
    };
  }

  if (resultado.estado === "error") return { error: resultado.mensaje };

  // El correo de bienvenida — SOLO en un alta genuinamente nueva
  // (`miembroNuevo`, del `miembro_nuevo` que calcula la propia 0138), no
  // en cada re-escaneo de quien ya es miembro. `after`: no puede frenar
  // el redirect de acá abajo, y una promesa suelta muere apenas Vercel
  // congela la función al responder.
  if (resultado.miembroNuevo && resultado.miembroId) {
    const miembroId = resultado.miembroId;
    after(async () => {
      try {
        const { avisarBienvenidaAlPlan } = await import("@/lib/correo/bienvenida-al-plan");
        await avisarBienvenidaAlPlan(miembroId);
      } catch (e) {
        console.warn("[correo] No salió la bienvenida al plan:", e);
      }
    });
  }

  // La cookie httpOnly con el token de `sesiones_persona` (0138): es lo
  // que hace que la próxima vez la tarjeta ya esté ahí, sin escribir
  // nada. Secreto de conveniencia, nunca de autoridad — canjear no
  // depende jamás de esto.
  jar.set(NOMBRE_COOKIE_PERSONA, resultado.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS_COOKIE_PERSONA * 24 * 60 * 60,
  });

  // Navegación completa para que el servidor rehaga la página con la
  // cookie recién puesta y muestre los botones del pase.
  redirect(`/tarjeta/${encodeURIComponent(slug)}`);
}
