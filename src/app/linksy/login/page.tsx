import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
import FormularioAuth from "@/app/cuenta/formulario-auth";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /linksy/login — LA PUERTA DE LINKSY, EN bookea.lat
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): «un login diferente, con el diseño de
 * Linksy: todo el lado izquierdo de un solo color con un texto grande,
 * y a la derecha la cajita de login».
 *
 * ── POR QUÉ VIVE EN bookea.lat Y NO EN linksy.lat ───────────────────
 * La cookie de sesión de Supabase nace pegada al host que la escribe.
 * Si la persona entrara en linksy.lat, la cookie quedaría ahí y el
 * panel —que vive en bookea.lat/solutions/panel— la vería como
 * anónima. Por eso `linksy.lat/entrar` redirige acá con una URL
 * absoluta (ver `destinoEnLinksy`), la sesión se escribe en bookea.lat
 * y el panel la encuentra. La piel es de Linksy; la puerta es la misma.
 *
 * ── EL MISMO LOGIN DE SIEMPRE, CON OTRA ROPA ───────────────────────
 * `FormularioAuth` es el componente que usan /cuenta y /lealtad/ingresar:
 * correo + código de un solo uso, Google y Facebook si están prendidos,
 * y la creación de cuenta si el correo es nuevo. Acá no se toca nada
 * de eso — solo se le pone alrededor el bloque lima y el titular. Un
 * login «propio» con su lógica propia sería la segunda copia de algo
 * que ya funciona y ya pasó un pentest.
 *
 * Con sesión abierta no hay nada que hacer acá: al panel.
 */

export const metadata: Metadata = {
  title: { absolute: "Ingresá · Linksy" },
  description: "Entrá a tu cuenta para editar tu página de Linksy.",
  alternates: { canonical: "/linksy/login" },
};

export default async function LoginLinksyPage() {
  const sesion = await sesionDelNavLealtad();
  if (sesion.logueado) redirect("/solutions/panel");

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* ── El bloque de color: la marca arriba, el texto grande abajo ── */}
      <section
        className="flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:min-h-svh lg:px-16 lg:py-14"
        style={{ background: "var(--linksy-lima)", color: "var(--linksy-lima-tinta)" }}
      >
        <Link href="/linksy" className="titulo text-[28px] font-extrabold tracking-tight" style={{ color: "var(--linksy-lima-tinta)" }}>
          Linksy
        </Link>
        <div className="pt-10 lg:pt-0">
          <h1 className="titulo max-w-[10ch] text-balance text-[clamp(44px,7vw,104px)] font-extrabold leading-[0.95] tracking-[-0.03em]">
            Tu página te espera.
          </h1>
          <p className="mt-6 max-w-[38ch] text-[clamp(16px,1.8vw,21px)] font-semibold leading-snug">
            Entrá con tu correo. Sin contraseñas: te mandamos un código de un solo uso y listo.
          </p>
        </div>
      </section>

      {/* ── La cajita: el formulario de siempre, centrado ── */}
      <section
        className="flex flex-col items-center justify-center px-4 py-12 sm:px-8 lg:min-h-svh"
        style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}
      >
        <div className="w-full max-w-sm">
          <FormularioAuth
            destino="/solutions/panel"
            titulo="Entrá a Linksy"
            intro="Es la misma cuenta de Bookea. Si es tu primera vez, te la creamos con tu correo."
          />
          <p className="mt-6 text-center text-[14px] font-semibold" style={{ color: "var(--linksy-tinta-suave)" }}>
            ¿Todavía no tenés tu página?{" "}
            <Link href="/solutions/crear" className="font-extrabold underline underline-offset-4" style={{ color: "var(--linksy-tinta)" }}>
              Crearla es gratis
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
