import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { crearNegocioLealtad } from "./actions";

/**
 * Alta "solo lealtad": el negocio que quiere su tarjeta de sellos SIN
 * publicarse en el marketplace. Dos campos y listo — el resto (colores,
 * recompensas, reglas) se configura adentro.
 */

export const metadata = {
  title: "Creá tu programa · Lealtad Bookea",
};

const NAVY_PROFUNDO = "#0a1226";
const NARANJA = "#ee7420";

const TIPOS = [
  { id: "citas", label: "Citas y servicios", detalle: "salón, barbería, spa, consultorio…" },
  { id: "restaurantes", label: "Comida y bebida", detalle: "café, restaurante, soda, bar…" },
  { id: "eventos", label: "Eventos", detalle: "lugares, catering, animación…" },
  { id: "hospedajes", label: "Hospedaje", detalle: "hotel, cabina, casa…" },
];

export default async function NuevoNegocioLealtadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/lealtad/login");

  const { error } = await searchParams;

  return (
    <main
      className="flex min-h-svh items-center justify-center px-5 py-12"
      style={{ background: NAVY_PROFUNDO }}
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border p-8"
          style={{ background: "rgba(255,255,255,.04)", borderColor: "rgba(255,255,255,.12)" }}
        >
          <p
            className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] before:block before:h-[1.5px] before:w-[18px]"
            style={{ color: NARANJA }}
          >
            Programa de lealtad
          </p>
          <h1 className="mt-2.5 text-xl font-bold text-white">Creá tu programa</h1>
          <p className="mt-1.5 text-sm text-white/60">
            No hace falta publicarte en Bookea ni recibir reservas: tu negocio puede
            existir SOLO para su tarjeta de sellos. Dos datos y adentro.
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error === "nombre"
                ? "Poné el nombre del negocio (máximo 80 caracteres)."
                : "No se pudo crear. Probá de nuevo."}
            </p>
          )}

          <form action={crearNegocioLealtad} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">
                Nombre del negocio
              </label>
              <input
                name="nombre"
                required
                maxLength={80}
                placeholder="Café La Esquina"
                className="w-full rounded-[10px] border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/35"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-white/70">
                ¿Qué tipo de negocio es?
              </label>
              <div className="grid gap-2">
                {TIPOS.map((t, i) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 has-[:checked]:border-[#ee7420] has-[:checked]:bg-white/[0.09]"
                  >
                    <input
                      type="radio"
                      name="vertical"
                      value={t.id}
                      defaultChecked={i === 0}
                      className="accent-[#ee7420]"
                    />
                    <span>
                      <span className="block text-[13.5px] font-bold text-white">{t.label}</span>
                      <span className="block text-[11.5px] text-white/50">{t.detalle}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-full px-7 py-3 text-[14.5px] font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: NARANJA }}
            >
              Crear mi programa
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] text-white/40">
          ¿Ya tenés un negocio en Bookea?{" "}
          <Link href="/lealtad/entrar" className="font-bold underline" style={{ color: NARANJA }}>
            Entrá a su programa
          </Link>
        </p>
      </div>
    </main>
  );
}
