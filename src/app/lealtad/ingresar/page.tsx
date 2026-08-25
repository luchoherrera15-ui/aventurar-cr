import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
import NavLealtad from "../nav-lealtad";
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
    /* ⚠️ SIN `overflow-hidden` ACÁ, Y NO ES UN OLVIDO.
       Un ancestro con `overflow: hidden` ANULA el `position: sticky` de
       sus descendientes: pasa a ser el contenedor de scroll, y como ese
       contenedor no scrollea, el nav en burbuja se quedaría clavado
       arriba de todo en vez de seguir a la persona.

       El recorte de las manchas no hace falta acá: `aurora-lienzo` trae
       el suyo. Es exactamente lo que ya advierte globals.css — «el
       recorte vive en su propia caja, NUNCA en la sección». */
    <main className="relative min-h-svh bg-[#fbfcff]">
      {/* La aurora, detrás de todo. `-z-10` la manda debajo del nav y del
          formulario sin sacarla del flujo — es un fondo, no una capa
          flotante que tape los clics (además `aurora-lienzo` ya declara
          `pointer-events: none`). */}
      <div aria-hidden className="aurora-lienzo -z-10">
        <div className="aurora-mancha-lenta aurora-lenta-1" />
        <div className="aurora-mancha-lenta aurora-lenta-2" />
        <div className="aurora-mancha-lenta aurora-lenta-3" />
      </div>

      <NavLealtad logueado={sesion.logueado} nombre={sesion.nombre} />

      <section className="relative px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
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
