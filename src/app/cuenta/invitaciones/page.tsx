import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";

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
          <div className="rounded-[24px] border border-aventurea-line bg-white p-8 text-center">
            <p className="titulo text-lg text-aventurea-ink">
              Todavía no tenés invitaciones ni álbumes
            </p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Bookea diseña tu invitación digital a la medida: tus invitados
              confirman desde el link, vos ves la lista en vivo, y con el
              álbum del evento todos suben sus fotos escaneando un QR.
            </p>
            <Link
              href="/invitaciones"
              className="mt-5 inline-flex items-center justify-center rounded-full bg-aventurea-navy px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
            >
              Conocer las invitaciones digitales
            </Link>
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
          </div>
        )}
      </main>
    </div>
  );
}
