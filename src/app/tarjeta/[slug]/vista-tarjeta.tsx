import Link from "next/link";
import { cookies } from "next/headers";
import { usuarioActual } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import { coloresDe, metaDeSellos, tarjetaDesdeFila } from "@/lib/wallet/tarjeta";
import {
  filasCrudasPorAntiguedad,
  laDelLinkDeFilasCrudas,
  resumenDeFila,
} from "@/lib/wallet/programa-principal";
import { buscarPorLlave, llaveDeTarjeta, tarjetaConLlaveDeFila } from "@/lib/lealtad/llave-tarjeta";
import { credencialesGoogleDelEntorno } from "@/lib/wallet/google";
import { credencialesDelEntorno } from "@/lib/wallet/firma";
import { esCodigoDeFallo } from "@/lib/wallet/identidad";
import { estadoVisible, operaAhora } from "@/lib/lealtad/programas";
import { minutoISOCR } from "@/lib/fechas";
import {
  NOMBRE_COOKIE_PERSONA,
  afiliacionDeQuienPide,
  idDeCuentaDeBookea,
  identidadDeQuienPide,
  textoConsentimientoNegocio,
} from "@/lib/lealtad/personas";
import FormularioAlta from "./formulario-alta";
import {
  avisoDeFalloDelPase,
  avisoDeSlugDesconocido,
  avisoDeTarjetaDesconocida,
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
 * UNA VISTA, DOS RUTAS
 * ------------------------------------------------------------------
 * Este archivo lo comparten:
 *
 *   · `/tarjeta/<negocio>`          — el link viejo, el que está IMPRESO
 *   · `/tarjeta/<negocio>/<llave>`  — uno por tarjeta (`llave-tarjeta.ts`)
 *
 * Lo único que cambia entre las dos es CÓMO se elige la tarjeta, y esa
 * es toda la diferencia que puede haber: si la pantalla estuviera
 * escrita dos veces, la del póster impreso sería la que quedaría vieja.
 *
 * ------------------------------------------------------------------
 * EL LINK VIEJO ESTÁ CLAVADO A LA TARJETA ORIGINAL
 * ------------------------------------------------------------------
 * Antes, con dos tarjetas activas, esta ruta servía «la que emita,
 * desempatando por uuid». O sea que crear una segunda tarjeta podía
 * cambiar a qué tarjeta lleva el QR pegado en la pared del local, sin
 * que nadie tocara nada. Ahora el link sin llave resuelve SIEMPRE a la
 * tarjeta más vieja del negocio —`laDelLinkDelNegocio`, con el porqué
 * largo escrito ahí— y si esa está pausada muestra el aviso de pausa en
 * vez de servir calladamente otra tarjeta.
 *
 * ------------------------------------------------------------------
 * EL PASE SE PIDE POR TARJETA, NO POR NEGOCIO
 * ------------------------------------------------------------------
 * Los botones llevan `?programa=<id>`: el mismo id de la tarjeta que
 * esta pantalla acaba de dibujar. Sin eso, el generador volvía a elegir
 * por su cuenta y podía entregar el pase de la tarjeta hermana — el
 * cliente veía una y se llevaba otra. Los endpoints sin el parámetro
 * siguen comportándose exactamente como hoy (ver sus rutas).
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

/**
 * Los colores del contrato, en hexadecimal y no en `var(--accion)`.
 *
 * Esta ruta es la única de Lealtad que NO cuelga de
 * `src/app/lealtad/layout.tsx`: no lleva la clase `.lealtad` y por lo
 * tanto no ve los tokens del módulo. Se copian con nombre para que se
 * lea de qué par salen y no vuelvan a divergir sueltos en un `style`.
 *
 * Toda la pantalla vive sobre el navy de `Pantalla` (#0a1226), así que
 * va el par OSCURO: el azul de acción de fondo claro (#0f4c9e) sobre
 * este navy da 1,44:1, o sea que el botón se fundiría con la página.
 */
const ACCION = "#9db4ff";
const ACCION_TINTA = "#0a1226";

export default async function VistaDeTarjeta({
  slug,
  llave,
  busqueda,
}: {
  /** El slug del NEGOCIO (`ranchos.slug`). */
  slug: string;
  /**
   * La llave de la tarjeta pedida, o null para el link viejo del
   * negocio. Ver `llave-tarjeta.ts`.
   */
  llave: string | null;
  busqueda: Record<string, string | string[] | undefined>;
}) {
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

  // ── TANDA 1 de 3: el negocio, y quién lo está mirando ─────────────
  //
  // Esta pantalla llegó a encadenar SEIS idas y vueltas en fila —y es
  // la página que el cliente escanea parado en el mostrador, donde
  // cada 100 ms se sienten—. Casi ninguna necesitaba a la anterior,
  // así que ahora van en tres tandas por dependencia real:
  //
  //   1. negocio (por slug)  ‖  cookies  ‖  sesión (local, ver abajo)
  //   2. tarjetas del negocio (necesita negocio.id)  ‖  identidad de
  //      la persona (necesita cookie + sesión, NO necesita el negocio)
  //   3. recompensa (necesita la tarjeta elegida)  ‖  afiliación
  //      (necesita identidad + negocio.id)
  //
  // `usuarioActual()` en vez del `supabase.auth.getUser()` que vivía
  // acá: ese era un viaje de ~150 ms a /auth/v1/user que el middleware
  // ya pagó en esta misma petición. `usuarioActual` lee la sesión
  // local (`getSession`, con cache() por render) — y lo que se decide
  // con ella acá es PRESENTACIÓN (formulario vs. botones de Wallet):
  // la emisión real del pase re-verifica la afiliación en su propia
  // ruta contra la base, así que una cookie inventada no consigue nada.
  const [{ data: negocio }, jar, user] = await Promise.all([
    admin.from("ranchos").select("id, nombre, slug").eq("slug", slug).maybeSingle(),
    cookies(),
    usuarioActual(),
  ]);

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
  const rutaDeEstaTarjeta = `/tarjeta/${negocio.slug as string}${llave ? `/${llave}` : ""}`;

  // TODAS las tarjetas del negocio, y de ahí la que pide el link.
  //
  // Acá había un `.maybeSingle()`, de cuando la base garantizaba UNA
  // tarjeta por negocio. Desde que la 0134 quitó ese `unique(rancho_id)`,
  // con dos tarjetas `maybeSingle` devuelve error y `data` en null: esta
  // página respondía «no encontrado» y el QR IMPRESO del mostrador
  // dejaba de funcionar — justo en el negocio que más había armado.
  //
  // `select *` porque las columnas de las 0134/0135/0136/0199 pueden no
  // existir todavía y una lista explícita fallaría entera.
  //
  // ── TANDA 2: las tarjetas ‖ quién es esta persona ─────────────────
  // La identidad viaja en paralelo a propósito: solo depende de la
  // cookie del alta por QR (0138) y de la sesión — no de qué tarjeta
  // pida el link. Si el QR trae una llave rota y abajo se corta con un
  // aviso, se habrán hecho un par de lecturas de más; en el camino
  // normal (el de la fila de la caja) se ahorra un viaje entero.
  const [{ data: filasCrudas }, identidad] = await Promise.all([
    admin.from("programa_lealtad").select("*").eq("rancho_id", negocio.id),
    identidadDeQuienPide(admin, {
      token: jar.get(NOMBRE_COOKIE_PERSONA)?.value ?? null,
      // NO `user?.id`: el chat flotante del sitio abre una sesión
      // ANÓNIMA de Supabase, que también es una fila de `auth.users`.
      // Tomándola por cuenta, esta pantalla daba por «conocida» a una
      // persona de la que no sabía NADA: se saltaba el formulario de
      // dos campos, la afiliaba sin nombre, sin correo, sin teléfono,
      // sin vínculo con el negocio y sin consentimiento. Ver
      // `personas.ts`.
      clienteId: idDeCuentaDeBookea(user),
    }),
  ]);

  const ahoraCR = minutoISOCR();
  // Ordenadas de la más vieja a la más nueva: es el desempate que usa
  // `buscarPorLlave` cuando dos tarjetas derivan el mismo slug (solo
  // posible mientras la 0199 no esté pegada).
  const filas = filasCrudasPorAntiguedad((filasCrudas ?? []) as Record<string, unknown>[]);

  const pedida = llave === null ? laDelLinkDeFilasCrudas(filas) : buscarPorLlave(filas, llave);

  // La llave de la URL no corresponde a ninguna tarjeta de ESTE
  // negocio. Es su propio aviso: el negocio existe, así que quien
  // atiende puede arreglarlo en el momento.
  if (llave !== null && !pedida) {
    return (
      <Pantalla>
        <PanelDeAviso aviso={avisoDeTarjetaDesconocida(nombreNegocio)} />
        <PieDeNegocio />
      </Pantalla>
    );
  }

  // Solo una tarjeta OPERANDO reparte pases. Pausada, en borrador,
  // programada, vencida o archivada tiene cada una SU pantalla: el
  // cliente se entera de qué pasó y de qué hacer.
  //
  // Y se pregunta por LA QUE PIDIÓ EL LINK, no por «alguna que emita»:
  // si la tarjeta del póster está pausada, la respuesta honesta es
  // «está en pausa», no entregarle al cliente una tarjeta distinta.
  const programa = pedida && operaAhora(resumenDeFila(pedida), ahoraCR) ? pedida : null;

  if (!programa) {
    const estado = pedida
      ? estadoVisible(resumenDeFila(pedida), ahoraCR)
      : ("sin_tarjeta" as const);
    return (
      <Pantalla>
        <PanelDeAviso aviso={avisoDeTarjetaQueNoEmite(estado, nombreNegocio)} />
        <PieDeNegocio />
      </Pantalla>
    );
  }

  const programaId = programa.id as string;
  const nombreTarjeta =
    typeof programa.nombre === "string" ? programa.nombre.trim() : "";
  // El MISMO lector que usa el pase (tarjeta.ts): si esta pantalla
  // leyera los colores por su cuenta, prometería una tarjeta y el
  // teléfono mostraría otra.
  const { config } = tarjetaDesdeFila(programa);
  const colores = coloresDe(config);

  // ── TANDA 3: la regalía ‖ el estado de la afiliación ──────────────
  //
  // La regalía que promete: la recompensa activa más barata, igual que
  // en el pase. Si cambia allá, cambia acá sola.
  //
  // ── «CONOCIDA» YA NO ES «TIENE UNA FILA EN ALGÚN LADO» ────────────
  //
  // Era `!!(personaId || clienteId)`, o sea: cualquier identificador
  // servía para saltarse el formulario. Con eso, tres de los cinco
  // miembros que hay en producción terminaron con tarjeta y SIN nombre,
  // SIN vínculo con el negocio y SIN consentimiento — la fila existía,
  // que es todo lo que esta línea comprobaba.
  //
  // Ahora la pregunta es la que importa: ¿esta afiliación está
  // COMPLETA? (`personas.ts`, tres condiciones). Si no lo está, vuelve
  // el formulario — con lo que ya se sabe precargado, para que quien
  // vuelve solo llene el hueco y no vuelva a tipear todo.
  //
  // Y lo que NO pasa por acá: el pase que la persona ya tiene en su
  // teléfono. Ese lo refresca `/api/wallet/v1/passes/…`, que no se
  // tocó. Nadie pierde un sello por esto.
  const [{ data: recompensa }, afiliacion] = await Promise.all([
    admin
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", programaId)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle(),
    afiliacionDeQuienPide(
      admin,
      identidad,
      // La llave es el rancho: esta ruta se sirve por `slug` de rancho, o
      // sea que el programa que emite tiene sí o sí este `rancho_id`, y es
      // por esa columna que `alta_persona_por_qr` escribe el vínculo.
      { ranchoId: negocio.id as string, cuentaId: null },
    ),
  ]);

  const total = metaDeSellos(
    recompensa
      ? {
          nombre: recompensa.nombre as string,
          costo_puntos: recompensa.costo_puntos as number,
        }
      : null,
  );
  const conocida = afiliacion.falta === null;

  // Los dos botones se muestran solo si el servidor PUEDE emitir esa
  // plataforma. El de Apple se mostraba siempre, tuviera certificado o
  // no: al tocarlo, el cliente se llevaba un error en la cara.
  const hayApple = credencialesDelEntorno() !== null;
  const hayGoogle = credencialesGoogleDelEntorno() !== null;

  // El pase que se pide es EL DE ESTA TARJETA, con su id explícito.
  const pase = (base: string) => `${base}/${negocio.id}?programa=${programaId}`;

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
      {/* CUÁL de las tarjetas del negocio es esta. Con una sola, decir
          su nombre sería ruido; desde la segunda, es lo único que
          distingue este póster del de al lado. Por eso se muestra solo
          cuando el negocio tiene más de una. */}
      {filas.length > 1 && nombreTarjeta !== "" && (
        <p className="mt-1 text-[13px] font-bold" style={{ color: ACCION }}>
          {nombreTarjeta}
        </p>
      )}
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
              href={pase("/api/pases")}
              className="mt-6 inline-block w-full rounded-full px-7 py-3.5 text-[15px] font-bold transition-transform hover:scale-[1.02]"
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
               Agregar a Apple Wallet
            </a>
          )}
          {hayGoogle && (
            // Android: el endpoint redirige al link de guardado firmado
            // y Google Wallet abre con la tarjeta lista.
            <a
              href={pase("/api/pases-google")}
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
            destino={rutaDeEstaTarjeta}
            titulo="Entrá con tu correo"
            intro="Te mandamos un código de 6 dígitos. Con eso recuperás tu tarjeta y todos tus sellos."
          />
          <p className="mt-4 text-center text-[12px] text-white/40">
            <Link href={rutaDeEstaTarjeta} className="font-bold underline">
              ← Volver al formulario
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white p-6">
          <p className="mb-4 text-left text-[13px] leading-relaxed text-aventurea-ink-soft">
            {/* Dos textos, porque son dos situaciones distintas. Al que
                ya tiene sellos guardados por el camino roto no se le
                puede hablar como si acabara de llegar: se le dice que su
                tarjeta sigue ahí y que solo falta el dato. */}
            {afiliacion.personaId
              ? "Nos falta un dato para terminar de armar tu tarjeta. Tus sellos siguen guardados — esto no los toca."
              : "Dejanos tu contacto y la tarjeta es tuya. Si ya tenías una con este negocio, la recuperás con todos tus sellos."}
          </p>
          <FormularioAlta
            slug={negocio.slug as string}
            // CUÁL tarjeta, explícito. Sin esto el alta volvía a elegir
            // por su cuenta y podía afiliar a la hermana de la que el
            // cliente estaba mirando.
            tarjeta={llaveDeTarjeta(tarjetaConLlaveDeFila(programa))}
            // El texto del permiso se arma en el servidor y viaja como
            // prop: es EXACTAMENTE el mismo string que se guarda como
            // prueba en `consentimientos_persona`.
            textoConsentimiento={textoConsentimientoNegocio(nombreNegocio)}
            // Lo que ya se sabe de esta persona, para no hacerla tipear
            // dos veces lo mismo. Son SUS propios datos, en su propia
            // pantalla: no se le está contando a nadie nada nuevo.
            yaSabido={afiliacion.personaId ? afiliacion.identidad : undefined}
          />
          <p className="mt-4 text-center text-[12px] text-zinc-500">
            ¿Ya tenés cuenta de Bookea?{" "}
            <Link href={`${rutaDeEstaTarjeta}?entrar=1`} className="font-bold underline">
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
 *
 * El naranja se queda aunque el resto del módulo haya pasado a azul:
 * acá no es marca sino ESTADO, y es lo único que separa «esperá, el
 * negocio decidió algo» del rojo «falló Bookea» y del neutro «el QR no
 * lleva a nada». En azul se confundiría con el neutro. El hexadecimal
 * sí se actualizó al del logotipo (#f39200), que además tira más al
 * ámbar y así se parece menos a un botón. Va literal y no por
 * constante porque Tailwind necesita leer el valor en el código para
 * generar la utilidad.
 */
function PanelDeAviso({ aviso, compacto = false }: { aviso: Aviso; compacto?: boolean }) {
  const borde =
    aviso.tono === "espera"
      ? "border-[#f39200]/40 bg-[#f39200]/10"
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
