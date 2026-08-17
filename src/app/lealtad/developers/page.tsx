import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import { ACUERDO_TEXTO, ACUERDO_VERSION, SCOPES_ENTREGA_1 } from "@/lib/lealtad/api/acuerdo";
import NavLealtad from "../nav-lealtad";
import FormularioDeveloper from "./formulario-developer";

/**
 * /lealtad/developers — la API de Lealtad, explicada y pedida.
 *
 * Mismo lenguaje visual que /lealtad: nav blanco, franjas navy para el
 * hero y el cierre, claro en el medio, y los colores por token de
 * `.lealtad` (azul lo que se toca, naranja lo que se gana) en vez de
 * hexadecimales copiados.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA PÁGINA DICE PRIMERO, Y POR QUÉ
 * ------------------------------------------------------------------
 * Arranca con lo que la API **no** hace. No es humildad: es la
 * información que un negocio necesita para decidir si deja entrar a
 * alguien, y es la que un integrador honesto quiere leer antes de
 * escribir código que no va a poder escribir. Una sección de
 * developers que empieza vendiendo «acceso completo a tus clientes»
 * ya perdió.
 *
 * Y dice en voz alta que no es auto-servicio: registro, revisión a
 * mano, y después la autorización del negocio. Dos firmas.
 */

const NAVY_PROFUNDO = "#0a1226";
const ACCION_OSCURO = "var(--accion-claro)";
const ACCION_OSCURO_TINTA = "var(--accion-claro-tinta)";
const ACCION = "var(--accion)";

export const metadata: Metadata = {
  title: "Developers — API de Lealtad",
  description:
    "Conectá tu punto de venta al programa de lealtad de Bookea: consultá la tarjeta que te presentan, sumá el sello al cobrar y el pase del teléfono del cliente se actualiza solo. Por registro y aprobación, y sin acceso a los datos personales de los clientes.",
  alternates: { canonical: "/lealtad/developers" },
};

const NO_PUEDE = [
  "Ver el nombre completo, el teléfono, el correo o las notas de un cliente",
  "Listar los clientes de un negocio, ni buscarlos por ningún dato",
  "Leer el catálogo de premios ni las reglas internas del programa",
  "Canjear un premio o revertir un movimiento (no existe ese permiso)",
  "Salir del negocio y de la tarjeta que la autorizaron a tocar",
  "Cambiar las reglas del programa, ni tocar agenda, finanzas o cobros",
  "Ampliarse sus propios permisos sin que el dueño vuelva a autorizarla",
];

const SI_PUEDE = [
  "Consultar el saldo y la meta de una tarjeta que el cliente le presente",
  "Sumar sellos o puntos al cobrar, según las reglas que el negocio configuró",
  "Y con eso, que el pase del teléfono del cliente se actualice solo",
];

const ENDPOINTS: { metodo: string; ruta: string; scope: string; que: string }[] = [
  { metodo: "GET", ruta: "/yo", scope: "—", que: "Quién soy y qué me dejaron hacer." },
  {
    metodo: "GET",
    ruta: "/saldo?serial=… | ?ref=…",
    scope: "saldo",
    que: "Saldo, meta, cuánto falta — y el ref de esa tarjeta.",
  },
  {
    metodo: "POST",
    ruta: "/acreditaciones",
    scope: "acreditar",
    que: "Sumar el sello al cobrar. Idempotente, y actualiza el pase.",
  },
];

export default async function PaginaDevelopers() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <NavLealtad />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:px-8 sm:py-20" style={{ background: NAVY_PROFUNDO }}>
        <div className="mx-auto w-full max-w-[820px]">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--orange)" }}
          >
            Developers
          </p>
          <h1 className="mt-3 text-[34px] font-extrabold leading-[1.08] text-white sm:text-[46px]">
            Conectá tu caja al programa de lealtad.
          </h1>
          <p className="mt-4 max-w-[640px] text-[15.5px] leading-relaxed text-white/70">
            Tu punto de venta consulta la tarjeta que el cliente presenta y suma el sello en el
            mismo acto del cobro. Sin apps, sin pantallas extra y sin que nadie escriba un teléfono.
          </p>
          <p className="mt-4 max-w-[640px] text-[14px] leading-relaxed text-white/55">
            No es auto-servicio: se pide acceso, lo revisamos a mano, y después{" "}
            <strong className="text-white/80">cada negocio decide</strong> si te deja entrar a su
            tarjeta. Dos firmas, siempre.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#pedir"
              className="presionable rounded-xl px-5 py-3 text-[14px] font-extrabold"
              style={{ background: ACCION_OSCURO, color: ACCION_OSCURO_TINTA }}
            >
              Pedir acceso
            </a>
            <a
              href="/api/lealtad/v1/openapi.json"
              className="rounded-xl border border-white/25 px-5 py-3 text-[14px] font-bold text-white/85"
            >
              Ver el OpenAPI
            </a>
          </div>
        </div>
      </section>

      {/* ── Lo que NO puede, primero ─────────────────────────────── */}
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[820px]">
          <h2 className="text-[26px] font-extrabold leading-tight text-aventurea-ink sm:text-[32px]">
            Empecemos por lo que esta API <em>no</em> hace.
          </h2>
          <p className="mt-3 max-w-[640px] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            Los clientes de una barbería no son usuarios de Bookea: le dieron sus datos a la
            barbería. Por eso el diseño no expone lo máximo que la base permite, sino lo mínimo que
            hace útil la integración.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-red-800">
                Nunca va a poder
              </h3>
              <ul className="mt-3 space-y-2">
                {NO_PUEDE.map((t) => (
                  <li key={t} className="flex gap-2 text-[13.5px] leading-relaxed text-aventurea-ink">
                    <span aria-hidden className="mt-[2px] shrink-0 font-bold text-red-700">
                      ✕
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-aventurea-line bg-[color:var(--accion-suave)] p-5">
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--accion-fuerte)]">
                Sí va a poder
              </h3>
              <ul className="mt-3 space-y-2">
                {SI_PUEDE.map((t) => (
                  <li key={t} className="flex gap-2 text-[13.5px] leading-relaxed text-aventurea-ink">
                    <span
                      aria-hidden
                      className="mt-[2px] shrink-0 font-bold"
                      style={{ color: ACCION }}
                    >
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 rounded-2xl border border-aventurea-line bg-aventurea-cream p-5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
            <strong className="text-aventurea-ink">No existe</strong> un endpoint que liste
            clientes, ni paginado de clientes, ni búsqueda por teléfono, correo o nombre. Esa
            ausencia no es una funcionalidad pendiente: es la propiedad que sostiene todo lo
            demás.
          </p>
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────────── */}
      <section className="bg-aventurea-cream px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[820px]">
          <h2 className="text-[26px] font-extrabold leading-tight text-aventurea-ink sm:text-[32px]">
            Cómo se ve en la caja
          </h2>
          <ol className="mt-7 space-y-4">
            <Paso
              n={1}
              titulo="El cliente presenta su tarjeta"
              texto="Tu caja lee el QR del pase y llama a GET /saldo?serial=… . Recibe el saldo, cuánto le falta y un ref opaco."
            />
            <Paso
              n={2}
              titulo="Guardás el ref, no el serial"
              texto="El ref es el seudónimo con el que vas a operar, y con el que podés volver a consultar el saldo (GET /saldo?ref=…) sin escanear de nuevo. Solo sirve dentro de tu autorización, y el negocio puede invalidarlo cuando quiera desde su panel."
            />
            <Paso
              n={3}
              titulo="Al cerrar la factura, sumás el sello"
              texto="POST /acreditaciones con el ref, el monto y el número de tiquete. La referencia es obligatoria: si la red se cae y reintentás, no se duplica."
            />
            <Paso
              n={4}
              titulo="El teléfono del cliente se actualiza solo"
              texto="El pase de Apple Wallet o Google Wallet se refresca sin que nadie abra nada y sin que vos llames a nada más. Ese es el punto de toda la integración: por eso esta API tiene tres endpoints y no treinta."
            />
          </ol>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-aventurea-line bg-white">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-aventurea-line text-[11px] uppercase tracking-wide text-aventurea-ink-soft">
                  <th className="px-4 py-3 font-bold">Método</th>
                  <th className="px-4 py-3 font-bold">Ruta</th>
                  <th className="px-4 py-3 font-bold">Permiso</th>
                  <th className="px-4 py-3 font-bold">Qué hace</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.ruta} className="border-b border-aventurea-line/60 last:border-b-0">
                    <td className="px-4 py-3 font-bold text-aventurea-ink">{e.metodo}</td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-aventurea-ink">{e.ruta}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-aventurea-ink-soft">
                      {e.scope}
                    </td>
                    <td className="px-4 py-3 text-aventurea-ink-soft">{e.que}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12.5px] text-aventurea-ink-soft">
            Base: <code className="font-mono">https://bookea.lat/api/lealtad/v1</code> ·
            Autenticación: <code className="font-mono">Authorization: Bearer blk_live_…</code> ·
            Respuestas en JSON.{" "}
            <strong className="text-aventurea-ink">
              La API no manda cabeceras CORS a propósito
            </strong>
            : la llave es de servidor a servidor y un navegador nunca debe tenerla.
          </p>
        </div>
      </section>

      {/* ── La llave ─────────────────────────────────────────────── */}
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[820px]">
          <h2 className="text-[26px] font-extrabold leading-tight text-aventurea-ink sm:text-[32px]">
            La llave, y cómo la cuidamos
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Ficha
              titulo="Se muestra una sola vez"
              texto="La genera el dueño del negocio en su panel y la ve ahí, en ese momento. Nunca pasa por Bookea, nunca por un correo, nunca por un ticket de soporte. Si se pierde, se rota."
            />
            <Ficha
              titulo="Guardamos su hash, no la llave"
              texto="Como una contraseña. Un volcado de nuestra base no le sirve a nadie ni siquiera para verificar candidatos, porque la sal vive fuera de la base."
            />
            <Ficha
              titulo="Se revoca en la petición siguiente"
              texto="No hay caché de credenciales, a propósito. Cuando el negocio aprieta revocar, la llamada que ya venía en camino es la última que pasa."
            />
            <Ficha
              titulo="Vence, y avisa antes"
              texto="Doce meses por defecto, veinticuatro como máximo. Te avisamos a 30, 7 y 1 día. Una llave eterna es una llave que nadie vuelve a mirar."
            />
            <Ficha
              titulo="Tiene techo de peticiones"
              texto="60 por minuto en general, 30 para las que escriben y 20 para consultar saldos. El contador vive en la base, así que el límite es real y no una sugerencia."
            />
            <Ficha
              titulo="Queda registrada cada llamada"
              texto="Quién, qué, cuándo y con qué resultado — sin la llave, sin el cuerpo de la petición y sin un solo dato personal. El dueño del negocio lo ve desde su panel."
            />
          </div>
        </div>
      </section>

      {/* ── Permisos ─────────────────────────────────────────────── */}
      <section className="bg-aventurea-cream px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[820px]">
          <h2 className="text-[26px] font-extrabold leading-tight text-aventurea-ink sm:text-[32px]">
            Los dos permisos que existen hoy
          </h2>
          <p className="mt-3 max-w-[640px] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            Y no hay un tercero escondido. La lista está escrita en una restricción de la base de
            datos: un permiso que el código no implementa, la base lo rechaza. Eran tres —había uno
            para leer el programa y su catálogo de premios— y se quitó junto con los dos endpoints
            que servía: no hacen falta para sumar un sello, y un permiso que no protege nada le
            miente al dueño en la pantalla donde autoriza.
          </p>
          <div className="mt-6 space-y-3">
            {SCOPES_ENTREGA_1.map((s) => (
              <div key={s.id} className="rounded-2xl border border-aventurea-line bg-white p-5">
                <p className="text-[14.5px] font-extrabold text-aventurea-ink">
                  {s.nombre}{" "}
                  <code className="ml-1 font-mono text-[12px] text-aventurea-ink-soft">{s.id}</code>
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {s.detalle}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px] leading-relaxed text-aventurea-ink-soft">
            Canjear un premio y revertir un movimiento llegan después, y en ese orden: canjear de
            más le hace daño a un tercero que no autorizó nada —la señora llega con la tarjeta
            llena y está en cero— así que esa puerta no se abre hasta que la reparación en bloque
            exista y esté probada.
          </p>
        </div>
      </section>

      {/* ── El formulario ────────────────────────────────────────── */}
      <section id="pedir" className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[720px]">
          <h2 className="text-[26px] font-extrabold leading-tight text-aventurea-ink sm:text-[32px]">
            Pedir acceso
          </h2>
          <p className="mb-6 mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            Lo revisa una persona. Miramos identidad, control del dominio y qué decís que vas a
            hacer con la API. Si te aprobamos, todavía no vas a tener ninguna llave: la genera el
            dueño de cada negocio cuando te autorice desde su panel.
          </p>
          <FormularioDeveloper haySesion={Boolean(user)} />
        </div>
      </section>

      {/* ── El acuerdo, completo ─────────────────────────────────── */}
      <section id="acuerdo" className="bg-aventurea-cream px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[820px]">
          <h2 className="text-[22px] font-extrabold leading-tight text-aventurea-ink">
            Acuerdo de Tratamiento de Datos — v{ACUERDO_VERSION}
          </h2>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-aventurea-line bg-white p-5 font-mono text-[12.5px] leading-relaxed text-aventurea-ink">
            {ACUERDO_TEXTO}
          </pre>
        </div>
      </section>

      {/* ── Cierre ───────────────────────────────────────────────── */}
      <section className="px-5 py-14 sm:px-8" style={{ background: NAVY_PROFUNDO }}>
        <div className="mx-auto w-full max-w-[820px] text-center">
          <p className="text-[15px] leading-relaxed text-white/70">
            ¿Sos el negocio y querés conectar tu propio sistema? Es el mismo camino: registrate
            como desarrollador y autorizate a vos mismo desde{" "}
            <Link href="/lealtad/panel" className="font-bold text-white underline">
              tu panel de lealtad
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function Paso({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-aventurea-line bg-white p-5">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
        style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
      >
        {n}
      </span>
      <span>
        <span className="block text-[14.5px] font-extrabold text-aventurea-ink">{titulo}</span>
        <span className="mt-0.5 block text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          {texto}
        </span>
      </span>
    </li>
  );
}

function Ficha({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-white p-5">
      <p className="text-[14px] font-extrabold text-aventurea-ink">{titulo}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">{texto}</p>
    </div>
  );
}
