import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { verificarBaja } from "@/lib/correo/baja";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmarBaja } from "./actions";

/**
 * "Darme de baja de estos correos" — la página a la que llega el link
 * del pie de todo correo de marketing (0082). Sin sesión y sin
 * fricción: el token firmado del link demuestra que quien entró es
 * quien recibió el correo, se confirma con UN botón y listo.
 *
 * Tres estados: link válido (confirmar), baja registrada (listo=1) y
 * link inválido o vencido.
 */
export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; r?: string; t?: string; listo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const listo = params.listo === "1";
  const fallo = params.error === "1";
  const datos = listo ? null : verificarBaja(params);

  // El nombre del negocio, para decir claramente de QUÉ se baja. En
  // el estado "listo" el ámbito ya no viene firmado (la acción
  // redirige con él), así que se valida la forma antes de usarlo en
  // una consulta con la service key.
  let nombreNegocio: string | null = null;
  const rParam = params.r && /^[0-9a-f-]{36}$/i.test(params.r) ? params.r : null;
  const ranchoId = datos?.ranchoId ?? (listo ? rParam : null);
  if (ranchoId) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin
        .from("ranchos")
        .select("nombre")
        .eq("id", ranchoId)
        .maybeSingle();
      nombreNegocio = (data?.nombre as string | undefined) ?? null;
    }
  }

  const alcance = nombreNegocio
    ? `los correos promocionales de ${nombreNegocio}`
    : "los correos promocionales de Bookea";

  return (
    <div className="min-h-screen bg-[linear-gradient(175deg,#ffffff_0%,#f5f8fd_38%,#e9f0fb_100%)]">
      <SiteHeader breadcrumb="Correos" />
      <main className="mx-auto flex max-w-[520px] flex-col px-5 py-16">
        <div className="rounded-2xl border border-aventurea-line bg-white p-8 shadow-[0_20px_60px_-30px_rgba(22,41,94,0.4)] sm:p-10">
          {listo ? (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-aventurea-green/10 text-[22px]">
                ✓
              </span>
              <h1 className="titulo mt-4 text-[22px] text-aventurea-ink">
                Listo — quedaste fuera
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                No vas a recibir más {alcance}. Los correos de tus reservas
                (confirmaciones y recordatorios) siguen llegando normal — esos
                no son promociones.
              </p>
            </>
          ) : fallo ? (
            <>
              <h1 className="titulo text-[22px] text-aventurea-ink">
                No se pudo registrar la baja
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                Algo falló de nuestro lado. Probá el link del correo otra vez
                en unos minutos, o escribinos y lo resolvemos a mano.
              </p>
            </>
          ) : datos ? (
            <>
              <h1 className="titulo text-[22px] text-aventurea-ink">
                ¿Darte de baja?
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                Dejás de recibir {alcance} en{" "}
                <strong className="text-aventurea-ink">{datos.correo}</strong>.
                Los correos de tus reservas siguen llegando normal.
              </p>
              <form action={confirmarBaja} className="mt-6">
                <input type="hidden" name="e" value={params.e ?? ""} />
                <input type="hidden" name="r" value={params.r ?? ""} />
                <input type="hidden" name="t" value={params.t ?? ""} />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-aventurea-navy px-6 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
                >
                  Sí, darme de baja
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="titulo text-[22px] text-aventurea-ink">
                Este link no es válido
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                El link de baja viene en el pie de cada correo promocional —
                abrilo desde ahí para que llegue completo. Si lo copiaste a
                mano, puede que le falte un pedazo.
              </p>
            </>
          )}

          <Link
            href="/"
            className="mt-6 block text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
