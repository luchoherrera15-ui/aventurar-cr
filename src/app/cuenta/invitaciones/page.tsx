import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import PaquetesInvitaciones from "@/components/paquetes-invitaciones";
import { IconChevronDown } from "@/components/icons";
import { hoyISOCR } from "@/lib/fechas";
import {
  MESES_RETENCION_INVITACION,
  fechaBorradoBonita,
  fechaBorradoInvitacion,
  invitacionFinalizada,
} from "@/lib/invitaciones-retencion";

type FilaInvitacion = {
  id: string;
  slug: string;
  titulo: string;
  fecha_evento: string;
  estado: string;
};

type FilaAlbum = { id: string; slug: string; titulo: string; estado: string };

/** La fecha del evento, en largo: "jueves, 30 de julio de 2026". */
function fechaEventoLarga(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Una invitación en la lista. La misma tarjeta sirve para las próximas
 * y para las finalizadas: lo único que cambia es la segunda línea —
 * en las finalizadas dice cuándo se borra, para que nadie descubra la
 * política el día que su invitación ya no está.
 */
function TarjetaInvitacion({ inv }: { inv: FilaInvitacion }) {
  const finalizada = invitacionFinalizada(inv.fecha_evento, hoyISOCR());
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aventurea-line bg-white p-4">
      <div>
        <p className="text-[14.5px] font-bold text-aventurea-ink">{inv.titulo}</p>
        <p className="text-[12.5px] text-aventurea-ink-soft">
          {fechaEventoLarga(inv.fecha_evento)}
          {inv.estado !== "activa" ? ` · ${inv.estado}` : ""}
        </p>
        {finalizada && (
          <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft/80">
            Se borra el {fechaBorradoBonita(fechaBorradoInvitacion(inv.fecha_evento))}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Link
          href={`/i/${inv.slug}`}
          className="rounded-xl border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
        >
          Ver invitación
        </Link>
        {/* Para imprimir. El link se ofrece siempre y el paquete se
            verifica del otro lado: esconderlo acá obligaría a consultar
            el pedido de cada invitación de la lista, y quien no tenga
            Plus llega a una pantalla que le explica qué es y cómo
            obtenerlo — que vende más que un botón ausente. */}
        <Link
          href={`/i/${inv.slug}/imprimir`}
          className="rounded-xl border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
        >
          Imprimir
        </Link>
        <Link
          href={`/cuenta/evento/${inv.id}`}
          className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2"
        >
          Abrir mi espacio
        </Link>
      </div>
    </div>
  );
}

/**
 * El espacio fijo de Invitaciones y álbumes del cliente: siempre
 * accesible desde /cuenta aunque todavía no tenga nada asignado —
 * en ese caso vende el producto. Tolera que las migraciones 0066/0068
 * no estén corridas (las consultas fallan y se listan vacíos).
 *
 * Pasado el evento, la invitación baja sola a la carpeta de
 * finalizadas (ver `@/lib/invitaciones-retencion`): la lista de arriba
 * queda con lo que todavía va a pasar, que es lo que el cliente entra
 * a ver. Los álbumes no se mueven — duran años y son para volver.
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
      // Fuera las muestras del catálogo. Al publicar una invitación
      // como ejemplo se crea una COPIA (slug "ejemplo-…") que lleva el
      // mismo cliente_id, para poder retirarla después. Esa copia no es
      // un evento del cliente: aparecía acá duplicando su invitación, y
      // sus botones apuntaban a una muestra que no se puede administrar
      // ni imprimir. `is not true` y no `eq false` porque las filas
      // anteriores a la 0074 tienen la columna en null.
      .not("es_ejemplo", "is", true)
      .order("fecha_evento", { ascending: true }),
    supabase
      .from("albumes")
      .select("id, slug, titulo, estado")
      .eq("cliente_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const invitaciones = (invRes.data ?? []) as FilaInvitacion[];
  const albumes = (albRes.data ?? []) as FilaAlbum[];

  // La consulta ya vino por fecha ascendente: las próximas quedan con
  // la más cercana primero, y las finalizadas se dan vuelta para que
  // arriba esté el evento más reciente.
  const hoy = hoyISOCR();
  const proximas = invitaciones.filter((i) => !invitacionFinalizada(i.fecha_evento, hoy));
  const finalizadas = invitaciones
    .filter((i) => invitacionFinalizada(i.fecha_evento, hoy))
    .reverse();

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
            <div className="rounded-2xl border border-aventurea-line bg-white p-8 text-center">
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
            {proximas.map((inv) => (
              <TarjetaInvitacion key={inv.id} inv={inv} />
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
                  className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2"
                >
                  Ver álbum
                </Link>
              </div>
            ))}

            {/* La carpeta de lo que ya pasó. Cerrada por defecto para
                no competir con los eventos que vienen — salvo que no
                haya nada más que mostrar, ahí se abre sola para que la
                página no se vea vacía. */}
            {finalizadas.length > 0 && (
              <details
                className="group mt-3"
                open={proximas.length === 0 && albumes.length === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-aventurea-line bg-white px-5 py-4 text-[14px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy hover:text-aventurea-navy [&::-webkit-details-marker]:hidden">
                  Invitaciones finalizadas ({finalizadas.length})
                  <IconChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mb-3 mt-3 px-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                  Tus eventos que ya pasaron. El link sigue funcionando y la
                  lista de confirmados queda acá {MESES_RETENCION_INVITACION}{" "}
                  meses después del evento; luego se borran para siempre. Si
                  querés guardar algo, descargalo antes de esa fecha.
                </p>
                <div className="flex flex-col gap-3">
                  {finalizadas.map((inv) => (
                    <TarjetaInvitacion key={inv.id} inv={inv} />
                  ))}
                </div>
              </details>
            )}

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
