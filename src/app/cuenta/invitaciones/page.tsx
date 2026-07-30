import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import PaquetesInvitaciones from "@/components/paquetes-invitaciones";
import { IconChevronDown } from "@/components/icons";

type FilaInvitacion = {
  id: string;
  slug: string;
  titulo: string;
  fecha_evento: string;
  estado: string;
};

type FilaAlbum = { id: string; slug: string; titulo: string; estado: string };

/**
 * El espacio fijo de Invitaciones y álbumes del cliente: siempre
 * accesible desde /cuenta aunque todavía no tenga nada asignado —
 * en ese caso vende el producto. Tolera que las migraciones 0066/0068
 * no estén corridas (las consultas fallan y se listan vacíos).
 */
export default async function CuentaInvitacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const [invRes, albRes] = await Promise.all([
    supabase
      .from("invitaciones")
      .select("id, slug, titulo, fecha_evento, estado")
      .eq("cliente_id", user.id)
      .order("fecha_evento", { ascending: true }),
    supabase
      .from("albumes")
      .select("id, slug, titulo, estado")
      .eq("cliente_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const invitaciones = (invRes.data ?? []) as FilaInvitacion[];
  const albumes = (albRes.data ?? []) as FilaAlbum[];

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Invitaciones y álbumes" ancho="max-w-[720px]" />
      <main className="mx-auto max-w-[720px] px-4 py-8">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Tu espacio
        </p>
        <h1 className="titulo mt-1 text-2xl text-aventurea-ink">
          Invitaciones y álbumes
        </h1>
        <p className="mb-6 mt-1 text-[13.5px] text-aventurea-ink-soft">
          Tus eventos, la lista de confirmados y las fotos que suben tus
          invitados — todo en un solo lugar.
        </p>

        {invitaciones.length === 0 && albumes.length === 0 ? (
          <div className="flex flex-col gap-8">
            <div className="rounded-[24px] border border-aventurea-line bg-white p-8 text-center">
              <p className="titulo text-lg text-aventurea-ink">
                Todavía no tenés invitaciones ni álbumes
              </p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                Bookea diseña tu invitación digital a la medida: tus invitados
                confirman desde el link, vos ves la lista en vivo, y con el
                álbum del evento todos suben sus fotos escaneando un QR.{" "}
                <Link
                  href="/invitaciones"
                  className="font-bold text-aventurea-navy underline-offset-2 hover:underline"
                >
                  Conocé cómo funcionan
                </Link>
                .
              </p>
            </div>
            <PaquetesInvitaciones
              disposicion="pila"
              intro="Elegí el que le calce a tu evento y contanos tu idea por el chat — te la entregamos lista para compartir."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {invitaciones.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aventurea-line bg-white p-4"
              >
                <div>
                  <p className="text-[14.5px] font-bold text-aventurea-ink">
                    {inv.titulo}
                  </p>
                  <p className="text-[12.5px] text-aventurea-ink-soft">
                    {new Date(inv.fecha_evento + "T00:00:00").toLocaleDateString(
                      "es-CR",
                      { weekday: "long", day: "numeric", month: "long", year: "numeric" },
                    )}
                    {inv.estado !== "activa" ? ` · ${inv.estado}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/i/${inv.slug}`}
                    className="rounded-full border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                  >
                    Ver invitación
                  </Link>
                  <Link
                    href={`/cuenta/evento/${inv.id}`}
                    className="rounded-full bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2"
                  >
                    Abrir mi espacio
                  </Link>
                </div>
              </div>
            ))}
            {albumes.map((alb) => (
              <div
                key={alb.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aventurea-line bg-white p-4"
              >
                <div>
                  <p className="text-[14.5px] font-bold text-aventurea-ink">
                    📷 {alb.titulo}
                  </p>
                  <p className="text-[12.5px] text-aventurea-ink-soft">
                    Álbum del evento{alb.estado !== "activo" ? ` · ${alb.estado}` : ""}
                  </p>
                </div>
                <Link
                  href={`/a/${alb.slug}`}
                  className="rounded-full bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2"
                >
                  Ver álbum
                </Link>
              </div>
            ))}

            {/* Los paquetes viven cerrados: quien ya tiene su evento
                entra a ver confirmados, no a que le vendan de nuevo.
                <details> nativo — se abre sin JS. */}
            <details className="group mt-8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-aventurea-line bg-white px-5 py-4 text-[14px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy hover:text-aventurea-navy [&::-webkit-details-marker]:hidden">
                ¡Ver opciones de álbumes e invitaciones!
                <IconChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-6">
                <PaquetesInvitaciones
                  disposicion="pila"
                  intro="¿Se viene otro evento? Elegí el paquete y contanos tu idea por el chat — te la entregamos lista para compartir."
                />
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}
