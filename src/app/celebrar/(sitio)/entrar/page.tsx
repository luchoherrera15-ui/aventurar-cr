import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MarcaCelebrar from "@/components/celebrar/marca-celebrar";
import { destinoDentroDeCelebrar } from "@/lib/celebrar/dominios";
import { origenDeLaPeticion, prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";
import AccesoCelebrar from "./acceso-celebrar";

/** Lo que el callback de Auth puede traer en `?aviso=` cuando algo salió mal. */
const AVISOS: Record<string, string> = {
  "sin-codigo": "El link que abriste no traía nada que canjear. Entrá de nuevo desde acá.",
  "codigo-vencido": "Ese link ya venció o ya se usó. Pedí uno nuevo.",
};

const VENTAJAS = [
  "Tus invitaciones, invitados, álbumes y pagos en un solo panel.",
  "Sin contraseña que recordar: te mandamos un código al correo.",
  "Si ya usás Bookea, es la misma cuenta. No hace falta crear otra.",
];

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entrá a CELEBRAR con tu correo. Si es tu primera vez, la cuenta se crea ahí mismo.",
  robots: { index: false },
};

/**
 * /celebrar/entrar — login y registro en la misma puerta.
 *
 * `?next=` dice a dónde volver (validado: interno y dentro de CELEBRAR).
 * `?modo=contrasena` abre directo la pestaña de contraseña (la usa el
 * correo de recuperación). Con sesión abierta no hay nada que hacer
 * acá: al destino.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; modo?: string; aviso?: string }>;
}) {
  const [{ next, modo, aviso }, prefijo, origen, sesion] = await Promise.all([
    searchParams,
    prefijoDeLaPeticion(),
    origenDeLaPeticion(),
    sesionCelebrar(),
  ]);
  const destino = destinoDentroDeCelebrar(next, prefijo, origen);
  if (sesion) redirect(destino);

  return (
    <section className="bg-(--c-hielo) py-10 lg:py-16">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:px-8">
        {/* En el teléfono el formulario va primero: la persona vino a entrar. */}
        <aside className="sobre-oscuro order-2 flex flex-col justify-between rounded-[24px] bg-(--c-marino) p-8 text-(--c-blanco) lg:order-none lg:p-10">
          <MarcaCelebrar tono="claro" tamano="lg" comoTexto />
          <div className="mt-12 lg:mt-0">
            <p className="c-montserrat text-[clamp(1.6rem,2.8vw,2.25rem)] font-bold leading-[1.12] tracking-tight text-(--c-blanco)">
              Una cuenta, todas tus celebraciones.
            </p>
            <ul className="mt-7 grid gap-4">
              {VENTAJAS.map((v) => (
                <li key={v} className="flex gap-3 text-[15px] leading-relaxed text-(--c-sobre-marino-suave)">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--c-marino-medio) text-(--c-blanco)">
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                      <path d="m3.5 8.5 2.8 2.8L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {v}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-10 text-[13px] text-(--c-sobre-marino-suave) lg:mt-0">
            Al entrar aceptás los términos y la política de privacidad del servicio.
          </p>
        </aside>

        <div className="c-tarjeta order-1 p-6 sm:p-10 lg:order-none">
          <h1 className="text-[clamp(1.6rem,2.8vw,2.25rem)] leading-[1.12] text-(--c-tinta)">
            Entrá o creá tu cuenta
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-(--c-tinta-suave)">
            Escribí tu correo. Si ya tenés cuenta entrás directo; si es tu primera vez, la creamos
            con tu nombre.
          </p>
          {aviso && AVISOS[aviso] && (
            <p role="status" className="mt-5 max-w-md rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[14px] leading-relaxed text-(--c-coral-tinta)">
              {AVISOS[aviso]}
            </p>
          )}
          <div className="mt-8">
            <AccesoCelebrar
              destino={destino}
              modoInicial={modo === "contrasena" ? "contrasena" : "codigo"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
