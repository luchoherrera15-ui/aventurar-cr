import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
import FormularioAuth from "@/app/cuenta/formulario-auth";

/**
 * LA PORTADA DE LOGIN QUE USA EL AVATAR DE `NavLealtad`.
 *
 * `/lealtad/login` sigue existiendo tal cual estaba: es el funnel que
 * usan las guardas de sesión del panel del negocio
 * (`redirect("/lealtad/login")` en crear-actions.ts, pases-actions.ts,
 * etc.). Esta es la puerta que se ve — mismo login de siempre
 * (`FormularioAuth`, el mismo componente y las mismas cuentas que el
 * resto de Bookea) — pero el destino NO está fijo: es `/lealtad/entrar`,
 * el mismo punto de decisión que ya usaba el funnel del dueño. Ahí se
 * resuelve con `tieneNegocioPropio()`: quien administra un negocio cae
 * en `/lealtad/panel`, y quien solo junta sellos en negocios ajenos cae
 * en `/cuenta/lealtad` — sus tarjetas. Fijar acá "/cuenta/lealtad" a
 * secas mandaba a un dueño real a la lista de tarjetas de cliente en
 * vez de a su panel, que es justo el caso que este archivo tenía que
 * cubrir.
 *
 * ------------------------------------------------------------------
 * SE FUE LA FOTO, ENTRA LA AURORA (ago 2026)
 * ------------------------------------------------------------------
 * Pedido del dueño: «el mismo sistema de blur que usamos en bookea.lat,
 * pero que se mueva por la pantalla lentamente, y arriba los íconos de
 * Apple Wallet y Google Wallet».
 *
 * Acá había una foto de referencia a media pantalla (el pase contra el
 * datáfono) con la tarjeta del login montada encima con margen
 * negativo. Se va entera: era 480 KB que había que bajar ANTES de poder
 * escribir un correo, en la pantalla donde la persona ya decidió entrar
 * y solo quiere que aparezca el campo. La aurora es CSS — pesa cero y
 * se pinta con el primer frame.
 *
 * ── POR QUÉ `aurora-lienzo` Y NO `aurora-caja` ─────────────────────
 * `aurora-caja` (la de la portada) se apaga hacia abajo con una
 * máscara, porque ahí tiene que fundirse con el catálogo. Acá la aurora
 * ES el fondo de la pantalla entera: con esa máscara, la mitad de abajo
 * quedaría en blanco muerto justo detrás del formulario.
 *
 * ── Y POR QUÉ LAS INSIGNIAS DICEN EL NOMBRE ────────────────────────
 * Los logotipos de Apple Wallet y Google Wallet son marcas registradas
 * con guías de uso propias, y no hay un SVG oficial en el repo.
 * Dibujarlos de memoria produce una marca MAL hecha, que es peor que no
 * ponerla. Las insignias llevan un glifo de pase —que es lo que el
 * producto hace— y el nombre escrito, que es exacto y no falsifica nada.
 */

export const metadata: Metadata = {
  title: "Ingresá · Bookea Lealtad",
  description:
    "Entrá a tu cuenta de Bookea para ver los sellos y puntos que juntaste en cada negocio.",
  alternates: { canonical: "/lealtad/ingresar" },
};

export default async function IngresarLealtadPage() {
  const sesion = await sesionDelNavLealtad();
  if (sesion.logueado) redirect("/lealtad/entrar");

  return (
    /* Sin `overflow-hidden`: el recorte de las manchas ya lo trae
       `aurora-lienzo`. Es lo que advierte globals.css — «el recorte vive
       en su propia caja, NUNCA en la sección». Y de paso un ancestro con
       overflow anularía cualquier `position: sticky` de adentro. */
    <main className="relative min-h-svh bg-[#fbfcff]">
      {/* ⚠️ NADA DE `-z-10` ACÁ. Lo tenía y la aurora NO SE VEÍA.
          Un z-index NEGATIVO en un hijo lo manda detrás del FONDO DE SU
          PROPIO PADRE — y este `<main>` tiene `bg-[#fbfcff]` sólido, así
          que la aurora quedaba pintada debajo de esa capa opaca: invisible.

          Sin z-index, el orden lo decide el DOM: la aurora va primera y
          se pinta abajo, el nav y el formulario van después y se pintan
          encima. Que es exactamente lo que hace falta. Los clics ya
          están cubiertos por el `pointer-events: none` de
          `aurora-lienzo`. */}
      <div aria-hidden className="aurora-lienzo">
        <div className="aurora-mancha-lenta aurora-lenta-1" />
        <div className="aurora-mancha-lenta aurora-lenta-2" />
        <div className="aurora-mancha-lenta aurora-lenta-3" />
      </div>

      {/* ── ACÁ VIVÍA EL NAV COMPLETO DE LEALTAD, Y SOBRABA ──────────
          Traía «Cómo funciona», «Soluciones», «Planes», «Industrias» y
          un botón «Ingresar» — en la página de ingresar. Todo eso es
          material de venta, y quien llegó hasta acá YA DECIDIÓ: lo único
          que quiere es que aparezca el campo del correo.

          Peor: el «Ingresar» del nav apuntaba a esta misma página, así
          que el header ofrecía como acción justo lo que la persona
          estaba haciendo.

          Queda el logo —que es orientación, no venta— y una salida
          clara abajo. */}
      <header className="relative px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto flex w-full max-w-[420px] items-center">
          <Link href="/lealtad" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- mismo
                logo estático que el resto del sitio: next/image no aporta
                nada para un PNG de 4 KB que no cambia. */}
            <img src="/logo-bookea-nav-v4.png" alt="Bookea" className="h-7 w-auto" />
            <span className="text-[13px] font-bold text-aventurea-ink-soft">
              Lealtad
            </span>
          </Link>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <div className="mx-auto w-full max-w-[420px]">
          {/* ── DÓNDE VA A VIVIR LA TARJETA ─────────────────────────
              Arriba del formulario porque contesta la pregunta que
              alguien se hace ANTES de dar su correo: «¿esto qué es?».
              Debajo del campo ya no sirve — para entonces ya decidió. */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2.5">
            <InsigniaWallet nombre="Apple Wallet" />
            <InsigniaWallet nombre="Google Wallet" />
          </div>

          <FormularioAuth
            destino="/lealtad/entrar"
            titulo="Tus tarjetas, en un solo lugar"
            intro="Con tu cuenta de Bookea ves los sellos y puntos que juntaste en cada negocio donde te afiliaste. Escribí tu correo: si ya tenés cuenta entrás directo, y si es tu primera vez, con tu nombre alcanza."
          />

          <Link
            href="/lealtad"
            className="mt-6 block text-center text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
          >
            ← Volver a Lealtad
          </Link>
        </div>
      </section>
    </main>
  );
}

/**
 * La insignia de una billetera: un glifo de pase y el nombre escrito.
 *
 * Fondo blanco SÓLIDO y no translúcido: debajo pasa la aurora, que se
 * mueve, y con un fondo translúcido el contraste del texto cambiaría
 * solo a lo largo del bucle. Es el mismo criterio que ya está escrito
 * para los discos de rubro del héroe de la portada.
 */
function InsigniaWallet({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-aventurea-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-aventurea-navy shadow-[0_6px_18px_-10px_rgba(16,47,82,0.4)]">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[15px] w-[15px] text-aventurea-navy/65"
      >
        <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
        <path d="M2.5 10h19" />
        <path d="M16.5 14.5h2" />
      </svg>
      {nombre}
    </span>
  );
}
