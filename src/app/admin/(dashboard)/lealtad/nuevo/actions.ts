"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { esPlanOfrecido } from "@/lib/lealtad/planes";
import { validarTarjetaDeAlta, type TarjetaDeAlta } from "@/lib/lealtad/tarjeta-alta";
import { regaliaDelBeneficio, metaDelBeneficio } from "@/lib/lealtad/mostrador";
import { crearNegocioDeLealtadCompleto } from "@/lib/lealtad/crear-negocio-completo";

/**
 * ════════════════════════════════════════════════════════════════════
 *  CREARLE EL PASE A UN CLIENTE, DESDE LA ADMINISTRACIÓN
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 sep 2026): «poder crearle pases de lealtad a
 * usuarios desde la administración; mismos pasos, uno elige qué tipo de
 * plan quiere y le configura la tarjeta, y al final pone el correo de la
 * persona que será el administrador de ese pase».
 *
 * Es el camino para cuando la venta se cierra por WhatsApp o en persona:
 * el cliente no arma nada, alguien de Bookea le deja el pase listo y él
 * entra a un panel que ya funciona.
 *
 * ------------------------------------------------------------------
 * EL NEGOCIO QUE SALE DE ACÁ ES IDÉNTICO AL DEL ALTA PÚBLICA
 * ------------------------------------------------------------------
 * No hay un «alta de admin» con sus propias reglas: se llama a
 * `crearNegocioDeLealtadCompleto`, la MISMA función que usa
 * /lealtad/nuevo. Lo único distinto es el `origen`, que cambia dos
 * textos (el aviso al equipo y la nota del complemento) y nada más.
 *
 * ------------------------------------------------------------------
 * ⚠️ ACÁ NO SE COBRA NADA
 * ------------------------------------------------------------------
 * Un pase creado desde el admin nace con el paquete puesto y SIN
 * suscripción de Stripe: la plata se acordó por fuera. O sea que este
 * formulario REGALA el paquete que elija — es exactamente para lo que
 * se pidió, pero conviene saberlo antes de tocar «Impulso».
 *
 * El paquete queda igual registrado en `solicitudes_lealtad` (lo hace
 * `crearNegocioDeLealtadCompleto`), así que finanzas y auditoría lo ven
 * como cualquier otra alta.
 */

export type ResultadoAltaAdmin =
  | {
      ok: true;
      ranchoId: string;
      slug: string | null;
      /** true = la cuenta no existía y se creó en el momento. */
      cuentaNueva: boolean;
      /**
       * El enlace para que la persona entre por primera vez. Solo cuando
       * la cuenta se acaba de crear: quien la tenía de antes entra con
       * su clave de siempre.
       */
      enlaceDeEntrada: string | null;
    }
  | { ok: false; motivo: string };

/** El correo, normalizado igual que en el resto del admin. */
function correoLimpio(valor: string): string | null {
  const c = valor.trim().toLowerCase();
  // Deliberadamente laxo: la validación de verdad la hace Supabase al
  // crear la cuenta. Acá solo se atajan los dedazos obvios para no
  // gastar un viaje a la base.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) ? c : null;
}

export async function crearPaseDesdeAdmin(datos: {
  /** El correo de quien va a administrar el pase. */
  correo: string;
  /** El nombre de quien administra, si la cuenta hay que crearla. */
  nombrePersona: string;
  nombreNegocio: string;
  /** La vertical operativa: citas | eventos | hospedajes | restaurantes | otro. */
  tipo: string;
  detalleOtro: string;
  plan: string;
  telefono: string;
  /** La tarjeta armada en el asistente. */
  tarjeta: TarjetaDeAlta;
}): Promise<ResultadoAltaAdmin> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };
  // Quién es el admin, para firmar `lealtad_aprobado_por`.
  const {
    data: { user: quienCrea },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const nombre = datos.nombreNegocio.trim();
  if (!nombre || nombre.length > 80) {
    return { ok: false, motivo: "El nombre del negocio es obligatorio (máximo 80)." };
  }

  const correo = correoLimpio(datos.correo);
  if (!correo) return { ok: false, motivo: "Ese correo no se ve bien. Revisalo." };

  // Contra los OFRECIDOS y no contra `esPlan`, por la misma razón que en
  // el alta pública: `esPlan` incluye los RETIRADOS —tiene que
  // incluirlos, para que las cuentas que ya los tienen sigan
  // resolviendo—, y un paquete retirado va SIN TOPES. Elegir es distinto
  // de tener; acá se elige.
  if (!esPlanOfrecido(datos.plan)) return { ok: false, motivo: "Ese paquete no existe." };

  // La MISMA validación que el alta pública: que el tipo de tarjeta esté
  // incluido en el paquete, que la meta esté en rango, que el ícono
  // propio venga con su archivo. Un admin puede regalar el paquete que
  // quiera, pero no puede armar una tarjeta que la base rechace.
  const validada = validarTarjetaDeAlta(datos.tarjeta, datos.plan);
  if (!validada.ok) return { ok: false, motivo: validada.motivo };
  // `validarTarjetaDeAlta` acepta que no venga tarjeta —el alta
  // pública tiene un camino «lo diseñamos nosotros» que la deja para
  // después—, pero por esta puerta no: el asistente la arma entera y
  // sin ella el cliente entraría a un panel con la tarjeta vacía.
  const t = validada.tarjeta;
  if (!t) return { ok: false, motivo: "Falta armar la tarjeta." };

  // ── LA CUENTA DE QUIEN LO VA A ADMINISTRAR ──────────────────────
  //
  // Si ya existe, se usa: crear una segunda cuenta con el mismo correo
  // no se puede, y aunque se pudiera dejaría a la persona con dos
  // paneles y sin saber en cuál está su negocio.
  const { data: perfil } = await admin
    .from("perfiles")
    .select("id")
    .eq("email", correo)
    .maybeSingle();

  let ownerId = (perfil?.id as string | undefined) ?? null;
  let cuentaNueva = false;

  if (!ownerId) {
    // Nace CONFIRMADA y sin contraseña utilizable: la persona entra por
    // el enlace de abajo y elige la suya. Poner una contraseña acá
    // obligaría a decírsela por WhatsApp, que es la peor forma de
    // repartir una credencial.
    const { data: creada, error: eCuenta } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: { nombre: datos.nombrePersona.trim() || null },
    });
    if (eCuenta || !creada.user) {
      return {
        ok: false,
        motivo: "No se pudo crear la cuenta: " + (eCuenta?.message ?? "sin respuesta"),
      };
    }
    ownerId = creada.user.id;
    cuentaNueva = true;
  }

  // ── EL NEGOCIO, CON LA MISMA FUNCIÓN QUE EL ALTA PÚBLICA ────────
  const creacion = await crearNegocioDeLealtadCompleto({
    userId: ownerId,
    plan: datos.plan,
    nombre,
    tipo: datos.tipo,
    detalle: datos.tipo === "otro" ? datos.detalleOtro.trim().slice(0, 80) : "",
    // Los campos «legado» se derivan del beneficio, igual que hace el
    // wizard público: la tarjeta de verdad viaja en `tarjeta`.
    paseColor: t.colorFondo ?? "",
    paseLogoUrl: t.logoUrl,
    regalia: t.beneficio ? regaliaDelBeneficio(t.beneficio) : "",
    metaSellos: t.beneficio ? metaDelBeneficio(t.beneficio) : 10,
    telefono: datos.telefono.trim() || null,
    correo,
    codigoReferido: null,
    agenteId: null,
    tarjeta: t,
    origen: "admin",
    // Queda firmado: `lealtad_aprobado_por` guarda al admin que lo armó.
    aprobadoPor: quienCrea?.id ?? null,
  });

  if (!creacion.ok) return { ok: false, motivo: creacion.motivo };

  // ── CÓMO ENTRA LA PERSONA ───────────────────────────────────────
  // Un magic-link para la cuenta recién creada. Si falla, el alta NO se
  // tumba: el negocio ya existe y el admin siempre puede mandarle un
  // «olvidé mi contraseña» desde /admin/usuarios.
  let enlaceDeEntrada: string | null = null;
  if (cuentaNueva) {
    const { data: enlace } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: correo,
    });
    enlaceDeEntrada = enlace?.properties?.action_link ?? null;
  }

  revalidatePath("/admin/lealtad");
  return {
    ok: true,
    ranchoId: creacion.creado.ranchoId,
    slug: creacion.creado.slug,
    cuentaNueva,
    enlaceDeEntrada,
  };
}
