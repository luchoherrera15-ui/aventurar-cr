import type { Metadata } from "next";
import Image from "next/image";
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
 * LA FOTO ARRIBA, LA TARJETA MONTADA ENCIMA
 * ------------------------------------------------------------------
 * Pedido del dueño: media pantalla con la foto de referencia (el pase
 * en el teléfono contra el datáfono, con los logos de Apple/Google
 * Wallet ya escritos adentro de la imagen — por eso el texto no se
 * repite acá arriba) y el cuadro del login montado encima, no al lado.
 * La tarjeta se sube con un margen negativo sobre el borde de la foto
 * — el recurso ya lo usa el resto del sitio (VerPaseModal, las cards
 * "elevar" del panel) para que un bloque se sienta flotando en vez de
 * apilado.
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
    <main className="min-h-svh bg-[#fbfcff]">
      <NavLealtad logueado={sesion.logueado} nombre={sesion.nombre} />

      {/* La foto: media pantalla de alto, a sangre. El degradé de abajo
          es lo que hace que la tarjeta, montada encima, no corte la
          imagen con un borde duro. */}
      <div className="relative h-[38vh] min-h-[280px] w-full overflow-hidden sm:h-[46vh]">
        <Image
          src="/lealtad/login.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_28%]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fbfcff] to-transparent"
        />
      </div>

      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto w-full max-w-[420px]">
          {/* `FormularioAuth` ya trae su propia tarjeta (borde, sombra,
              título e intro adentro) — acá solo se la sube por encima
              de la foto con un margen negativo, sin envolverla en una
              segunda tarjeta. */}
          <div className="relative -mt-28 sm:-mt-32">
            <FormularioAuth
              destino="/lealtad/entrar"
              titulo="Tus tarjetas, en un solo lugar"
              intro="Con tu cuenta de Bookea ves los sellos y puntos que juntaste en cada negocio donde te afiliaste. Escribí tu correo: si ya tenés cuenta entrás directo, y si es tu primera vez, con tu nombre alcanza."
            />
          </div>

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
