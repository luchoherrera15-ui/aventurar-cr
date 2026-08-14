import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import { coloresDe, metaDeSellos, tarjetaDesdeFila } from "@/lib/wallet/tarjeta";
import { elegirDeFilasCrudas, emisoraDeFilasCrudas, resumenDeFila } from "@/lib/wallet/programa-principal";
import { credencialesGoogleDelEntorno } from "@/lib/wallet/google";
import { credencialesDelEntorno } from "@/lib/wallet/firma";
import { esCodigoDeFallo } from "@/lib/wallet/identidad";
import { estadoVisible } from "@/lib/lealtad/programas";
import { minutoISOCR } from "@/lib/fechas";
import {
  NOMBRE_COOKIE_PERSONA,
  identidadDeQuienPide,
  textoConsentimientoNegocio,
} from "@/lib/lealtad/personas";
import FormularioAlta from "./formulario-alta";
import {
  avisoDeFalloDelPase,
  avisoDeSlugDesconocido,
  avisoDeTarjetaQueNoEmite,
  type Aviso,
} from "./problemas";

/**
 * LA PUERTA DEL CLIENTE: acá es donde alguien consigue su tarjeta de
 * lealtad. El negocio comparte este link (o su QR impreso en el
 * mostrador), el cliente deja su WhatsApp y su correo, y se lleva el
 * pase. Dos campos y un botón.
 *
 * ------------------------------------------------------------------
 * QUÉ CAMBIÓ, Y POR QUÉ IMPORTA TANTO
 * ------------------------------------------------------------------
 * Hasta hoy esta pantalla exigía una CUENTA de Bookea: correo → salir a
 * buscar un código de 6 dígitos al buzón → volver → código → nombre →
 * botón. Cinco pasos y un salto a otra app, de pie en la caja. La 0138
 * se escribió entera para eliminar esa fricción —trae identidad global,
 * deduplicación y consentimiento en un solo RPC— y nadie la llamaba.
 * Ahora sí (`actions.ts` → `alta_persona_por_qr`).
 *
 * La cuenta sigue existiendo como camino alterno (`?entrar=1`): es la
 * PRUEBA que se le pide a quien quiere reclamar un contacto que ya
 * tiene sellos guardados. Nadie se lleva la tarjeta de otro escribiendo
 * su correo.
 *
 * ------------------------------------------------------------------
 * SE LEE CON LA LLAVE DE SERVICIO A PROPÓSITO
 * ------------------------------------------------------------------
 * Un negocio "solo lealtad" vive en estado 'pendiente' (invisible en
 * los directorios) y la RLS no se lo mostraría ni a un cliente logueado.
 * Lo único que se expone acá es la cara pública de un programa —nombre,
 * colores y regalía— que es exactamente lo que el negocio reparte
 * impreso en su póster.
 */

export default async function TarjetaPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const busqueda = await searchParams;
  const problema = primero(busqueda.problema);
  const quiereEntrar = primero(busqueda.entrar) === "1";

  const admin = createAdminClient();
  if (!admin) {
    return (
      <Pantalla>
        <PanelDeAviso aviso={avisoDeFalloDelPase("sin_conexion", "")} />
      </Pantalla>
    );
  }

  const { data: negocio } = await admin
    .from("ranchos")
    .select("id, nombre, slug")
    .eq("slug", slug)
    .maybeSingle();

  // EL QR MAL IMPRESO TIENE SU PROPIA PANTALLA. Antes esto era un
  // `notFound()`, el mismo que salía cuando el negocio pausaba su
  // tarjeta: el cliente no tenía cómo saber si volver el mes que viene
  // o avisarle al de la caja que el póster está mal.
  if (!negocio) {
    return (
      <Pantalla>
        <PanelDeAviso aviso={avisoDeSlugDesconocido()} />
      </Pantalla>
    );
  }

  const nombreNegocio = (negocio.nombre as string) ?? "";

  // TODAS las tarjetas del negocio, y de ahí la que emite.
  //
  // Acá había un `.maybeSingle()`, de cuando la base garantizaba UNA
  // tarjeta por negocio. Desde que la 0134 quitó ese `unique(rancho_id)`,
  // con dos tarjetas `maybeSingle` devuelve error y `data` en null: esta
  // página respondía «no encontrado» y el QR IMPRESO del mostrador
  // dejaba de funcionar — justo en el negocio que más había armado.
  //
  // `emisoraDeFilasCrudas` es la misma elección que hace el panel del
  // negocio y la que usa el generador del pase: el dueño configura la
  // tarjeta que su cliente termina recibiendo, y no una hermana suya.
  // `select *` porque las columnas de las 0134/0135/0136 pueden no
  // existir todavía y una lista explícita fallaría entera.
  const { data: filasCrudas } = await admin
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", negocio.id);

  const ahoraCR = minutoISOCR();
  const filas = (filasCrudas ?? []) as Record<string, unknown>[];
  const programa = emisoraDeFilasCrudas(filas, ahoraCR);

  // Solo una tarjeta OPERANDO reparte pases. Pausada, en borrador,
  // programada, vencida o archivada tiene cada una SU pantalla: el
  // cliente se entera de qué pasó y de qué hacer.
  if (!programa) {
    const principal = elegirDeFilasCrudas(filas, ahoraCR);
    const estado = principal
      ? estadoVisible(resumenDeFila(principal), ahoraCR)
      : ("sin_tarjeta" as const);
    return (
      <Pantalla>
        <PanelDeAviso aviso={avisoDeTarjetaQueNoEmite(estado, nombreNegocio)} />
        <PieDeNegocio />
      </Pantalla>
    );
  }

  const programaId = programa.id as string;
  // El MISMO lector que usa el pase (tarjeta.ts): si esta pantalla
  // leyera los colores por su cuenta, prometería una tarjeta y el
  // teléfono mostraría otra.
  const { config } = tarjetaDesdeFila(programa);
  const colores = coloresDe(config);

  // La regalía que promete: la recompensa activa más barata, igual que
  // en el pase. Si cambia allá, cambia acá sola.
  const { data: recompensa } = await admin
    .from("recompensas")
    .select("nombre, costo_puntos")
    .eq("programa_id", programaId)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1)
    .maybeSingle();

  const total = metaDeSellos(
    recompensa
      ? {
          nombre: recompensa.nombre as string,
          costo_puntos: recompensa.costo_puntos as number,
        }
      : null,
  );

  // ¿Ya sabemos quién es? Dos caminos y ninguno pide escribir nada: la
  // cookie del alta por QR (0138) y la sesión de Bookea, para quien
  // además tenga cuenta.
  const jar = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const identidad = await identidadDeQuienPide(admin, {
    token: jar.get(NOMBRE_COOKIE_PERSONA)?.value ?? null,
    clienteId: user?.id ?? null,
  });
  const conocida = !!(identidad.personaId || identidad.clienteId);

  // Los dos botones se muestran solo si el servidor PUEDE emitir esa
  // plataforma. El de Apple se mostraba siempre, tuviera certificado o
  // no: al tocarlo, el cliente se llevaba un error en la cara.
  const hayApple = credencialesDelEntorno() !== null;
  const hayGoogle = credencialesGoogleDelEntorno() !== null;

  return (
    <Pantalla>
      {/* La tarjeta, como se va a ver: los colores del negocio. */}
      <div
        className="mx-auto overflow-hidden rounded-2xl p-6 text-left shadow-2xl"
        style={{ backgroundColor: colores.fondo }}
      >
        <p className="text-[17px] font-light text-white">{nombreNegocio}</p>
        {total !== null && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(total, 12) }, (_, i) => (
              <span
                key={i}
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: colores.sello, opacity: i === 0 ? 1 : 0.26 }}
              />
            ))}
          </div>
        )}
        {recompensa && (
          <p className="mt-4 text-[12.5px] text-white/70">
            Al completar {recompensa.costo_puntos as number}:{" "}
            <span className="font-bold text-white">{recompensa.nombre as string}</span>
          </p>
        )}
        <p className="mt-3 text-right text-[10px] text-white/50">Powered by Bookea.lat</p>
      </div>

      <h1 className="mt-7 text-xl font-bold text-white">Tu tarjeta de {nombreNegocio}</h1>
      <p className="mt-1.5 text-sm text-white/60">
        {/* Esto ya es verdad: con el alta de dos campos no hay app que
            instalar NI código que buscar en el correo. Antes esta misma
            línea estaba encima de un formulario que mandaba al buzón. */}
        Vive en tu teléfono y suma sola en cada visita — sin apps que instalar.
      </p>

      {/* El aviso de lo que salió mal, si el botón rebotó. Llega como
          código cerrado por la URL (`?problema=`), nunca como texto
          libre: nadie puede hacer que esta pantalla diga otra cosa. */}
      {esCodigoDeFallo(problema) && (
        <div className="mt-6">
          <PanelDeAviso aviso={avisoDeFalloDelPase(problema, nombreNegocio)} compacto />
        </div>
      )}

      {conocida && (hayApple || hayGoogle) ? (
        <>
          {hayApple && (
            // El href directo es lo que hace que iOS ofrezca "Agregar a
            // Wallet": el endpoint responde application/vnd.apple.pkpass
            // y el sistema hace el resto.
            <a
              href={`/api/pases/${negocio.id}`}
              className="mt-6 inline-block w-full rounded-full px-7 py-3.5 text-[15px] font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: "#ee7420" }}
            >
               Agregar a Apple Wallet
            </a>
          )}
          {hayGoogle && (
            // Android: el endpoint redirige al link de guardado firmado
            // y Google Wallet abre con la tarjeta lista.
            <a
              href={`/api/pases-google/${negocio.id}`}
              className={`${hayApple ? "mt-3" : "mt-6"} inline-block w-full rounded-full border border-white/30 px-7 py-3.5 text-[15px] font-bold text-white transition-transform hover:scale-[1.02]`}
            >
              Guardar en Google Wallet
            </a>
          )}
          <p className="mt-3 text-[12px] text-white/40">
            {hayApple && hayGoogle
              ? "iPhone o Android: la tarjeta vive en tu teléfono y se actualiza sola."
              : hayApple
                ? "Abrilo desde tu iPhone para que Wallet lo agregue directo. Google Wallet llega pronto."
                : "Abrilo desde tu Android para guardarla en Google Wallet. Apple Wallet llega pronto."}
          </p>
        </>
      ) : conocida ? (
        // Ya sabemos quién es, pero el servidor no puede emitir ninguna
        // de las dos plataformas. Antes acá se mostraba el botón de
        // Apple igual y el cliente se llevaba un error al tocarlo.
        <div className="mt-6">
          <PanelDeAviso aviso={avisoDeFalloDelPase("sin_credenciales", nombreNegocio)} compacto />
        </div>
      ) : quiereEntrar ? (
        <div className="mt-6 text-left">
          {/* El camino con cuenta: sigue existiendo, y es la PRUEBA que
              se le pide a quien reclama un contacto que ya tiene sellos
              (`requiere_prueba` de la 0138). `FormularioAuth` ya trae su
              propia tarjeta blanca — envolverlo en otra lo dejaba con
              dos marcos, uno dentro del otro. */}
          <FormularioAuth
            destino={`/tarjeta/${negocio.slug}`}
            titulo="Entrá con tu correo"
            intro="Te mandamos un código de 6 dígitos. Con eso recuperás tu tarjeta y todos tus sellos."
          />
          <p className="mt-4 text-center text-[12px] text-white/40">
            <Link href={`/tarjeta/${negocio.slug}`} className="font-bold underline">
              ← Volver al formulario
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white p-6">
          <p className="mb-4 text-left text-[13px] leading-relaxed text-aventurea-ink-soft">
            Dejanos tu contacto y la tarjeta es tuya. Si ya tenías una con este
            negocio, la recuperás con todos tus sellos.
          </p>
          <FormularioAlta
            slug={negocio.slug as string}
            // El texto del permiso se arma en el servidor y viaja como
            // prop: es EXACTAMENTE el mismo string que se guarda como
            // prueba en `consentimientos_persona`.
            textoConsentimiento={textoConsentimientoNegocio(nombreNegocio)}
          />
          <p className="mt-4 text-center text-[12px] text-zinc-500">
            ¿Ya tenés cuenta de Bookea?{" "}
            <Link href={`/tarjeta/${negocio.slug}?entrar=1`} className="font-bold underline">
              Entrá con tu correo
            </Link>
          </p>
        </div>
      )}

      <PieDeNegocio />
    </Pantalla>
  );
}

/** El primer valor de un parámetro de búsqueda, o null. */
function primero(valor: string | string[] | undefined): string | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

/** El fondo y el ancho: lo mismo para todas las salidas de esta ruta. */
function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-svh items-center justify-center px-5 py-12"
      style={{ background: "#0a1226" }}
    >
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );
}

/**
 * El aviso, con el color según de quién es el problema: naranja cuando
 * hay que volver (el negocio decidió algo), rojo apagado cuando falló
 * Bookea, y neutro cuando el QR no lleva a ninguna parte.
 */
function PanelDeAviso({ aviso, compacto = false }: { aviso: Aviso; compacto?: boolean }) {
  const borde =
    aviso.tono === "espera"
      ? "border-[#ee7420]/40 bg-[#ee7420]/10"
      : aviso.tono === "nuestro"
        ? "border-red-400/30 bg-red-400/10"
        : "border-white/15 bg-white/5";

  return (
    <div className={`rounded-2xl border ${borde} p-5 text-left`}>
      <p className={`font-bold text-white ${compacto ? "text-[14px]" : "text-[17px]"}`}>
        {aviso.titulo}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-white/70">{aviso.texto}</p>
    </div>
  );
}

function PieDeNegocio() {
  return (
    <p className="mt-8 text-[12px] text-white/30">
      <Link href="/lealtad" className="underline hover:text-white/60">
        ¿Tenés un negocio? Armá tu propio programa
      </Link>
    </p>
  );
}
