import Link from "next/link";
import Image from "next/image";
import FormularioCodigoAcceso from "@/components/formulario-codigo-acceso";
import BotonesSociales from "./botones-sociales";

/**
 * Entrada al sistema de lealtad.
 *
 * Es una puerta APARTE, no una cuenta aparte: misma tabla de usuarios,
 * mismo código por correo, mismos negocios. Lo único propio es la
 * pantalla y a dónde aterriza — `/lealtad/entrar` lleva directo al
 * programa en vez de al panel general.
 *
 * Duplicar la autenticación habría sido el error caro: dos formas de
 * iniciar sesión son dos formas de que una falle, y el dueño de un
 * negocio no entiende por qué su correo funciona en una y no en la
 * otra. Por eso reusa `FormularioCodigoAcceso` sin tocarlo.
 */

// La misma paleta de /lealtad, para que la puerta y la sala se sientan
// del mismo lugar.
const NAVY_PROFUNDO = "#0a1226";
const NAVY = "#16295e";
const NARANJA = "#ee7420";

export const metadata = {
  title: "Entrar · Lealtad Bookea",
  description: "Accedé al programa de lealtad de tu negocio.",
};

export default function LoginLealtadPage() {
  return (
    <main
      className="relative flex min-h-svh items-center justify-center overflow-hidden px-5 py-12"
      style={{ background: NAVY_PROFUNDO }}
    >
      {/* Dos luces: una naranja arriba y una navy abajo. Le quitan el
          plano al fondo sin robarle atención a la tarjeta. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background: `radial-gradient(ellipse 60% 60% at 50% 0%, ${NARANJA}22, transparent 70%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
        style={{ background: NAVY }}
      />

      <div className="relative w-full max-w-sm">
        <Link href="/lealtad" className="mb-7 flex justify-center">
          <Image
            src="/logo-bookea-blanco-v3.png"
            alt="Bookea"
            width={150}
            height={38}
            className="h-[34px] w-auto"
            priority
          />
        </Link>

        <div
          className="rounded-2xl border p-8 shadow-2xl"
          style={{
            background: "rgba(255,255,255,.04)",
            borderColor: "rgba(255,255,255,.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          <p
            className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] before:block before:h-[1.5px] before:w-[18px]"
            style={{ color: NARANJA }}
          >
            <span className="sr-only">Sección</span>
            Programa de lealtad
          </p>
          <h1 className="mt-2.5 text-xl font-bold text-white">Entrá a tu programa</h1>
          <p className="mt-1.5 text-sm text-white/60">
            Con el mismo correo de tu negocio. Te mandamos un código, sin contraseñas.
          </p>

          {/* El formulario es el MISMO de todo el sitio. Acá solo cambia
              a dónde va después de entrar.

              OJO con el selector: se estilizan inputs y labels, pero NO
              los <p> — los mensajes del formulario ("ya te mandamos un
              código…", errores) traen su propio fondo claro, y pintarles
              el texto de blanco los volvía ilegibles. Ya pasó. */}
          <div className="mt-1 [&_input]:border-white/15 [&_input]:bg-white/[0.06] [&_input]:text-white [&_input]:placeholder:text-white/35 [&_label]:text-white/70">
            <FormularioCodigoAcceso destino="/lealtad/entrar" acento="orange" />
          </div>

          <BotonesSociales destino="/lealtad/entrar" />
        </div>

        <p className="mt-5 text-center text-[12.5px] text-white/45">
          ¿Todavía no lo tenés?{" "}
          <Link href="/lealtad" className="font-bold underline" style={{ color: NARANJA }}>
            Ver cómo funciona
          </Link>
        </p>
        <p className="mt-2 text-center text-[12px] text-white/30">
          ¿Buscabas el panel completo?{" "}
          <Link href="/mi-negocio/login" className="underline hover:text-white/60">
            Entrá como proveedor
          </Link>
        </p>
      </div>
    </main>
  );
}
