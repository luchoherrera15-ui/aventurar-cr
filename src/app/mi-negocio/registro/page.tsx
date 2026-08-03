import Link from "next/link";
import FormularioCodigoAcceso from "@/components/formulario-codigo-acceso";

export default function RegistroPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden p-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(240,120,42,0.10),transparent)]" />
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-aventurea-orange opacity-[0.07] blur-[100px]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Proveedores de servicios
        </p>
        <h1 className="mt-2.5 text-xl font-bold text-aventurea-ink">
          Creá tu cuenta
        </h1>
        <p className="mt-1.5 text-sm text-aventurea-ink-soft">
          Registrate para publicar tu negocio para eventos en Bookea —
          lugares, comida, música, decoración y más, en todo el país. Sin
          contraseñas: entrás con un código que te llega al correo.
        </p>

        <FormularioCodigoAcceso
          destino="/mi-negocio/nuevo"
          acento="orange"
          crearCuenta
          pedirNombre
        />

        <p className="mt-4 text-center text-[12.5px] text-zinc-500">
          ¿Ya tenés cuenta?{" "}
          <Link
            href="/mi-negocio/login"
            className="font-bold text-aventurea-orange underline"
          >
            Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
