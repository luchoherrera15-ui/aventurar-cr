import FormularioCodigoAcceso from "@/components/formulario-codigo-acceso";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-aventurea-cream p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(240,120,42,0.10),transparent)]" />
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-aventurea-sky opacity-[0.07] blur-[100px]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Acceso privado
        </p>
        <h2 className="mt-2.5 text-xl font-bold text-aventurea-ink">
          Panel Administrativo
        </h2>
        <p className="mt-1.5 text-sm text-aventurea-ink-soft">
          Gestiona las reservas de Bookea.
        </p>

        <FormularioCodigoAcceso destino="/admin" acento="orange" soloAdmin />

        <p className="mt-4 rounded-[10px] bg-aventurea-cream-2 p-3 text-[11.5px] leading-relaxed text-aventurea-ink-soft">
          Este acceso es solo para el equipo de Bookea. El código de
          acceso llega al correo de tu cuenta de administración.
        </p>
      </div>
    </main>
  );
}
