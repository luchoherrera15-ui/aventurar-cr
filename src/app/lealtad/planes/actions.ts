"use server";

import { after } from "next/server";
import { esPlanOfrecido, esPlanSinCosto } from "@/lib/lealtad/planes";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";

/**
 * Dejar la solicitud de un paquete de lealtad (0126).
 *
 * El INSERT va con la sesión del usuario: la política "Pedir el plan
 * del propio negocio" exige que gestione el rancho y que firme con su
 * propio id — este archivo no decide permisos, los hereda.
 *
 * El aviso a Bookea sale en `after()` — después de responder, sin
 * frenar al que pide — y la FILA es la fuente de verdad: si el correo
 * se pierde, la solicitud sigue en /admin/complementos.
 *
 * ------------------------------------------------------------------
 * SIN NEGOCIO TAMBIÉN SE PUEDE — LOS DOS CAMINOS, NO SOLO LA TARJETA
 * ------------------------------------------------------------------
 * Lealtad no exige tener nada registrado en /citas, hospedajes ni
 * eventos: se contrata en frío. Eso ya valía para el pago con tarjeta,
 * pero el depósito por SINPE mandaba a crear el negocio primero en
 * /lealtad/nuevo — o sea que la MISMA pantalla dejaba comprar sin
 * negocio con Visa y no con SINPE, que es el medio que de verdad usa
 * buena parte de la clientela costarricense.
 *
 * Acá se usa la forma que la 0130 ya definió para eso: `rancho_id`
 * nulo + `negocio_nombre`, con su propia política («Pedir el alta de un
 * negocio nuevo») y su propio unique parcial de una pendiente por
 * persona. El negocio NO nace en este archivo: nace cuando un admin
 * acepta la solicitud, por el mismo `crearNegocioDesdeSolicitud` que
 * usa el webhook de Stripe. Una sola puerta de alta, dos formas de
 * pagar.
 */

type Resultado = { ok: true } | { ok: false; motivo: string };

export async function solicitarPlanLealtad(datos: {
  /** El negocio que ya administra. "" = todavía no tiene ninguno. */
  ranchoId: string;
  /** Solo cuando no hay `ranchoId`: cómo se llama el que se creará. */
  nombreNegocio: string;
  plan: string;
  telefono: string;
  mensaje: string;
  metodoPago: string;
  comprobanteUrl: string;
}): Promise<Resultado> {
  const { ranchoId, plan, telefono, mensaje, metodoPago, comprobanteUrl } = datos;
  // Los OFRECIDOS, no todos los que la base acepta: la MISMA puerta que
  // /lealtad/nuevo. `esPlan` deja pasar los retirados —y tiene que
  // dejarlos, para que quien ya los tiene siga funcionando—, así que
  // usarlo acá dejaba PEDIR a mano un paquete retirado y quedarse sin
  // ningún tope en cuanto un admin aprobara la solicitud sin mirar.
  if (!esPlanOfrecido(plan)) return { ok: false, motivo: "Ese paquete no existe." };

  // Alta en frío: no hay negocio todavía y el nombre lo escribió la
  // persona. El largo se valida acá Y en la base (check de la 0130):
  // el mensaje de error de un constraint no es algo que se le muestre
  // a nadie.
  const esAlta = !ranchoId.trim();
  const nombreNuevo = datos.nombreNegocio.trim().slice(0, 80);
  if (esAlta && !nombreNuevo) {
    return { ok: false, motivo: "Escribí cómo se llama tu negocio." };
  }

  // El plan sin costo no lleva depósito; los demás sí, y el link tiene
  // que ser del NUESTRO bucket de comprobantes, no una URL cualquiera
  // que después abra un admin confiado desde el correo.
  //
  // `esPlanSinCosto` y no `precioMensual === 0`: el paquete retirado
  // `gratis` también cuesta $0 y con la comparación suelta se saltaba
  // el comprobante.
  const gratis = esPlanSinCosto(plan);
  if (!gratis) {
    if (metodoPago !== "sinpe" && metodoPago !== "transferencia") {
      return { ok: false, motivo: "Elegí cómo pagaste: SINPE o transferencia." };
    }
    if (!esUrlDeNuestroStorage(comprobanteUrl, "comprobantes")) {
      return { ok: false, motivo: "Adjuntá la captura del depósito para enviar la solicitud." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión para solicitar el plan." };

  // Solo aplica cuando HAY negocio: en un alta en frío no hay nada que
  // revisar todavía, y consultar `ranchos` con un id vacío ni siquiera
  // es una consulta válida.
  if (!esAlta) {
    // Lealtad se separó por completo del resto del sitio (14 ago 2026):
    // un negocio de Citas/Eventos/Restaurantes que TODAVÍA no tiene
    // programa no puede pedirlo acá — eso es lo que mezclaba negocios
    // reales del directorio con pases (el caso de Rancho Las Torres).
    // Si YA tiene programa (nació aislado, o es un caso viejo de antes
    // de este cambio), esto es exactamente el upgrade que este archivo
    // sí tiene que dejar pasar.
    const { data: yaTienePrograma } = await supabase
      .from("programa_lealtad")
      .select("id")
      .eq("rancho_id", ranchoId)
      .maybeSingle();
    if (!yaTienePrograma) {
      return {
        ok: false,
        motivo:
          "Ese negocio todavía no tiene programa de lealtad. Lealtad ahora nace siempre en un negocio aparte — escribí un nombre nuevo y arrancá desde cero.",
      };
    }

    // Un negocio en revisión (0129) no solicita nada: primero lo aprueba
    // un administrador. `select *` tolera bases sin la migración. Con
    // la llave de servicio: `esAlta`/el resto de esta función ya
    // comprobaron que el que pide gestiona `ranchoId` — esto solo
    // necesita poder pedir `*` sin lista de columnas a mano (desde la
    // 0155, `authenticated` no tiene permiso de tabla completa).
    const { data: ranchoRevision } = await (createAdminClient() ?? supabase)
      .from("ranchos")
      .select("*")
      .eq("id", ranchoId)
      .maybeSingle();
    if (
      ranchoRevision &&
      "lealtad_aprobado_en" in ranchoRevision &&
      ranchoRevision.lealtad_aprobado_en === null
    ) {
      return {
        ok: false,
        motivo: "Tu negocio está en revisión por Bookea — te avisamos al aprobarlo y ahí podés solicitar el plan.",
      };
    }
  }

  const tel = telefono.trim().slice(0, 30);
  const msj = mensaje.trim().slice(0, 500);

  // Freno al spam: el unique parcial de la 0126 ya limita a UNA
  // pendiente por negocio, pero crear negocios es gratis — sin este
  // tope, un solo usuario puede inundar el correo de los admins.
  const { count } = await supabase
    .from("solicitudes_lealtad")
    .select("*", { count: "exact", head: true })
    .eq("solicitante_id", user.id)
    .eq("estado", "pendiente");
  if ((count ?? 0) >= 3) {
    return {
      ok: false,
      motivo: "Ya tenés 3 solicitudes en revisión — esperá a que atendamos esas primero.",
    };
  }

  const { error } = await supabase.from("solicitudes_lealtad").insert({
    // Una de las dos, nunca las dos: el check de la 0130 exige que
    // haya rancho O nombre, y las dos políticas de insert se reparten
    // exactamente por ese campo.
    rancho_id: esAlta ? null : ranchoId,
    negocio_nombre: esAlta ? nombreNuevo : null,
    // Sin preguntar de qué rubro es: acá se viene a comprar Lealtad,
    // no a publicarse. `otro` es lo que el alta convierte en un negocio
    // sin vertical de marketplace, igual que /lealtad/nuevo.
    negocio_vertical: esAlta ? "otro" : null,
    solicitante_id: user.id,
    plan,
    telefono: tel || null,
    mensaje: msj || null,
    metodo_pago: gratis ? null : metodoPago,
    comprobante_url: gratis ? null : comprobanteUrl,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        motivo: esAlta
          ? "Ya tenés una solicitud en revisión — te contactamos apenas la veamos."
          : "Ya hay una solicitud pendiente para este negocio — te contactamos pronto.",
      };
    }
    if (error.code === "42501") {
      return { ok: false, motivo: "No administrás ese negocio." };
    }
    if (/negocio_nombre|negocio_vertical/.test(error.message) && /schema cache|Could not find|does not exist/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0130 en Supabase." };
    }
    if (/metodo_pago|comprobante_url/.test(error.message) && /schema cache|Could not find|does not exist/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0128 en Supabase." };
    }
    if (/solicitudes_lealtad/.test(error.message) && /does not exist|schema cache|Could not find/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0126 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo enviar: " + error.message };
  }

  // Los datos del correo se juntan ANTES del after: acá todavía hay
  // sesión y cookies; adentro del after ya no hay request.
  const [{ data: rancho }, { data: perfil }] = await Promise.all([
    esAlta
      ? Promise.resolve({ data: null })
      : supabase.from("ranchos").select("nombre").eq("id", ranchoId).maybeSingle(),
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
  ]);

  const nombreNegocio = esAlta
    ? nombreNuevo
    : ((rancho?.nombre as string | undefined) ?? "(negocio)");
  const nombrePersona = ((perfil?.nombre as string | undefined) ?? "").trim() || "(sin nombre)";
  const correo = user.email ?? "(sin correo)";

  after(() =>
    avisarAAdministradores({
      subject:
        (esAlta ? "ALTA NUEVA — " : "") +
        `HAY UNA SOLICITUD DEL PASE DE LEALTAD — ${nombreNegocio}`,
      html: `
        <h2 style="margin:0 0 12px">Solicitud del programa de lealtad</h2>
        ${
          esAlta
            ? `<p style="margin:0 0 12px;padding:10px 12px;background:#fff4e5;border-left:3px solid #ee7420;font-size:13px">
                 <b>Este negocio todavía NO existe.</b> Se crea al aceptar la solicitud,
                 sin publicarse en el marketplace.
               </p>`
            : ""
        }
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0"><b>Negocio</b></td><td>${escapar(nombreNegocio)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Paquete pedido</b></td><td>${escapar(plan)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Solicitante</b></td><td>${escapar(nombrePersona)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Correo</b></td><td>${escapar(correo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Teléfono</b></td><td>${escapar(tel || "—")}</td></tr>
          ${
            gratis
              ? `<tr><td style="padding:4px 12px 4px 0"><b>Pago</b></td><td>plan gratis — sin depósito</td></tr>`
              : `<tr><td style="padding:4px 12px 4px 0"><b>Pagó por</b></td><td>${escapar(metodoPago)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Comprobante</b></td><td><a href="${escapar(comprobanteUrl)}">ver la captura del depósito</a></td></tr>`
          }
          <tr><td style="padding:4px 12px 4px 0"><b>Mensaje</b></td><td>${escapar(msj || "—")}</td></tr>
        </table>
        <p style="margin:16px 0 0">
          Se activa desde
          <a href="https://www.bookea.lat/admin/complementos">el panel de complementos</a>.
        </p>
      `,
    }),
  );

  return { ok: true };
}

/** Lo mínimo para que un nombre con <> no rompa (ni inyecte) el HTML. */
function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
