"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { minutoISOCR } from "@/lib/fechas";
import {
  filasCrudasPorAntiguedad,
  laDelLinkDeFilasCrudas,
  resumenDeFila,
} from "@/lib/wallet/programa-principal";
import { operaAhora } from "@/lib/lealtad/programas";
import { buscarPorLlave } from "@/lib/lealtad/llave-tarjeta";
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
 *   · resuelve LA MISMA TARJETA que la pantalla acaba de dibujar —por
 *     su llave si el link la trae, o la original del negocio si es el
 *     link viejo—, para que nadie se afilie a una tarjeta distinta de
 *     la que vio;
 *   · abre la sesión de la persona en este navegador y deja la cookie,
 *     que es lo que hace que no haya que volver a escribir nada nunca.
 *
 * ------------------------------------------------------------------
 * LA TARJETA VIAJA EN EL FORMULARIO, Y ESO ES UN ARREGLO
 * ------------------------------------------------------------------
 * Antes acá se llamaba a `emisoraDeFilasCrudas`, o sea: el alta volvía
 * a elegir por su cuenta cuál de las tarjetas del negocio afiliar. Con
 * dos tarjetas activas, alguien podía ver la tarjeta A en pantalla y
 * quedar afiliado a la B. Ahora la pantalla dice cuál dibujó y esta
 * acción respeta eso — y comprueba igual que esa tarjeta sea del
 * negocio del slug y esté emitiendo: el campo viene del navegador.
 */

export type EstadoAlta = {
  error: string | null;
  /** Para marcar el campo exacto que hay que arreglar. */
  campo?: CampoDelAlta | null;
  /**
   * El contacto ya es de alguien con cuenta o con sellos juntados. No
   * se escribió nada. Hay dos salidas y la pantalla ofrece las dos:
   * entrar con el código (recupera la tarjeta y sus sellos) o seguir
   * sin cuenta con una tarjeta propia y nueva.
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

  // Cuál tarjeta del negocio. Vacío = el link viejo del negocio, o sea
  // la tarjeta ORIGINAL (`laDelLinkDelNegocio`).
  const llave = String(datos.get("tarjeta") ?? "").trim();

  // ¿La persona ya vio el desvío de «ese contacto tiene dueño» y
  // eligió seguir sin cuenta? Es un botón distinto del formulario, no
  // una casilla escondida ni un valor por defecto.
  const sinReclamo = datos.get("sin_cuenta") === "si";

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

  // `select *`: las columnas de las 0134/0135/0136/0199 pueden no
  // existir todavía y una lista explícita fallaría la consulta entera.
  const { data: filasCrudas } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", negocio.id);

  const filas = filasCrudasPorAntiguedad((filasCrudas ?? []) as Record<string, unknown>[]);
  const pedida = llave === "" ? laDelLinkDeFilasCrudas(filas) : buscarPorLlave(filas, llave);

  if (!pedida) {
    return { error: "Este QR ya no lleva a ninguna tarjeta. Preguntá en el local." };
  }

  // Que esté emitiendo se comprueba ACÁ y no se confía en que la
  // pantalla ya lo miró: entre que se dibujó el formulario y se tocó el
  // botón, el dueño pudo pausarla.
  if (!operaAhora(resumenDeFila(pedida), minutoISOCR())) {
    return {
      error: "Esta tarjeta no está repartiendo pases ahora mismo. Preguntá en el local.",
    };
  }
  const programa = pedida;

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
    sinReclamo,
    ip: ipDePeticion(cabeceras),
    userAgent: cabeceras.get("user-agent"),
  });

  if (resultado.estado === "requiere_prueba") {
    // El texto NO confirma que haya sellos ni cuántos: la respuesta ya
    // deja ver que ese contacto está en Bookea (es inevitable si se
    // quiere proteger la tarjeta), pero no hace falta agregarle valor
    // al dato para quien esté probando contactos ajenos.
    //
    // Y ya NO es un callejón sin salida: la pantalla muestra las dos
    // salidas (recuperar la tarjeta con el código, o seguir sin cuenta
    // con una propia). Ver `formulario-alta.tsx`.
    return {
      requierePrueba: true,
      error:
        resultado.canal === "whatsapp"
          ? "Ya hay una tarjeta con ese contacto. Si es tuya, entrá con tu correo y la recuperás con todo lo que tengas juntado."
          : "Ya hay una tarjeta con ese contacto. Si es tuya, entrá con el código que te mandamos al correo y la recuperás con todo lo que tengas juntado.",
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
  // cookie recién puesta y muestre los botones del pase. Se vuelve al
  // MISMO link por el que entró: si vino por el póster de la segunda
  // tarjeta, no se lo manda al de la primera.
  redirect(
    llave === ""
      ? `/tarjeta/${encodeURIComponent(slug)}`
      : `/tarjeta/${encodeURIComponent(slug)}/${encodeURIComponent(llave)}`,
  );
}
