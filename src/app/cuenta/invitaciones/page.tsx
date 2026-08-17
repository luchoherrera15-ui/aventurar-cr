import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SeccionPlegable from "@/components/seccion-plegable";
import PaquetesInvitaciones from "@/components/paquetes-invitaciones";
import {
  IconCalendarLine,
  IconCamera,
  IconSparkles,
  IconUsers,
} from "@/components/icons";
import {
  BAJADA_PANTALLA,
  EYEBROW,
  LIENZO_PANEL,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
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

/** El estado sale como pill discreta — solo cuando no es el default. */
function BadgeEstado({ estado, esDefault }: { estado: string; esDefault: string }) {
  if (estado === esDefault) return null;
  return (
    <span className="shrink-0 whitespace-nowrap rounded-lg bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold capitalize text-aventurea-ink-soft">
      {estado}
    </span>
  );
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
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-aventurea-line bg-white p-4 transition-shadow hover:shadow-[0_14px_34px_-22px_rgba(22,41,94,0.35)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-aventurea-navy/10 text-aventurea-navy">
        <IconCalendarLine className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14.5px] font-bold text-aventurea-ink">{inv.titulo}</p>
          <BadgeEstado estado={inv.estado} esDefault="activa" />
        </div>
        <p className="text-[12.5px] text-aventurea-ink-soft">
          {fechaEventoLarga(inv.fecha_evento)}
        </p>
        {finalizada && (
          <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft/80">
            Se borra el {fechaBorradoBonita(fechaBorradoInvitacion(inv.fecha_evento))}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
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

/** Un álbum en la lista — mismo lenguaje visual que la invitación. */
function TarjetaAlbum({ alb }: { alb: FilaAlbum }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-aventurea-line bg-white p-4 transition-shadow hover:shadow-[0_14px_34px_-22px_rgba(22,41,94,0.35)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-aventurea-sky/10 text-aventurea-orange">
        <IconCamera className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14.5px] font-bold text-aventurea-ink">{alb.titulo}</p>
          <BadgeEstado estado={alb.estado} esDefault="activo" />
        </div>
        <p className="text-[12.5px] text-aventurea-ink-soft">Álbum del evento</p>
      </div>
      <Link
        href={`/a/${alb.slug}`}
        className="rounded-xl bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2"
      >
        Ver álbum
      </Link>
    </div>
  );
}

/** Un paso del "cómo funciona", dentro del bento navy. */
function Paso({ icono, texto }: { icono: React.ReactNode; texto: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
        {icono}
      </span>
      <p className="pt-1.5 text-[13px] leading-snug text-white/80">{texto}</p>
    </div>
  );
}

/**
 * El espacio fijo de Invitaciones y álbumes del cliente: siempre
 * accesible desde /cuenta aunque todavía no tenga nada asignado —
 * en ese caso vende el producto con la misma línea visual de
 * /invitaciones (kicker naranja, bloque bento navy, botones rectos:
 * nada de estética prestada de otra plataforma). Tolera que las
 * migraciones 0066/0068 no estén corridas (las consultas fallan y se
 * listan vacíos).
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
  const sinNada = invitaciones.length === 0 && albumes.length === 0;

  return (
    <div className={`min-h-screen ${LIENZO_PANEL}`}>
      <SiteHeader breadcrumb="Invitaciones y álbumes" ancho="max-w-[720px]" />
      <main className="mx-auto max-w-[720px] px-4 py-6 sm:px-6">
        {/* El kicker usaba `text-aventurea-orange` (#ee7420) sobre fondo
            claro: 2,94:1, por debajo hasta del 3:1 de texto grande — y
            esto es letra de 11px. Pasa al naranja que sí se lee sobre
            claro, `--orange-fuerte`: 5,76:1 sobre el lienzo. */}
        <p className={EYEBROW}>Tu espacio</p>
        <h1 className={`mt-2 ${TITULO_PANTALLA}`}>Invitaciones y álbumes</h1>
        <p className={`mb-6 mt-2 max-w-[54ch] ${BAJADA_PANTALLA}`}>
          Tus eventos, la lista de confirmados y las fotos que suben tus
          invitados — todo en un solo lugar.
        </p>

        {sinNada ? (
          <div className="flex flex-col gap-10">
            {/* El hero: misma línea de /invitaciones (kicker naranja,
                titulo grande, bloque navy con acento) pero contenida en
                una tarjeta bento, no a pantalla completa — esto sigue
                siendo la cuenta del cliente, no la landing. */}
            <div className="bento bento-navy p-8 sm:p-10">
              <div aria-hidden className="bento-orbe -right-16 -top-16" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
                  <IconSparkles className="h-3.5 w-3.5" />
                  Cómo funciona
                </span>
                <h2 className="titulo mt-4 max-w-[24ch] text-balance text-[26px] text-white sm:text-[32px]">
                  Todavía no tenés invitaciones ni álbumes
                </h2>
                <p className="mt-3 max-w-[50ch] text-[14px] leading-relaxed text-white/70">
                  Bookea diseña tu invitación digital a la medida: tus
                  invitados confirman desde el link, vos ves la lista en
                  vivo, y con el álbum del evento todos suben sus fotos
                  escaneando un QR.
                </p>

                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  <Paso
                    icono={<IconSparkles className="h-4 w-4" />}
                    texto="Diseñada a mano para tu evento"
                  />
                  <Paso
                    icono={<IconUsers className="h-4 w-4" />}
                    texto="Tus invitados confirman con un toque"
                  />
                  <Paso
                    icono={<IconCamera className="h-4 w-4" />}
                    texto="El álbum junta las fotos con un QR"
                  />
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="#paquetes"
                    className="rounded-xl bg-aventurea-sky px-7 py-3.5 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-sky-dark"
                  >
                    Ver los paquetes
                  </Link>
                  <Link
                    href="/invitaciones"
                    className="rounded-xl bg-white px-7 py-3.5 text-[14px] font-bold text-aventurea-navy transition-colors hover:bg-white/90"
                  >
                    Cómo funciona
                  </Link>
                </div>
              </div>
            </div>

            <div id="paquetes">
              <PaquetesInvitaciones
                disposicion="pila"
                intro="Elegí el que le calce a tu evento y contanos tu idea por el chat — te la entregamos lista para compartir."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {proximas.map((inv) => (
              <TarjetaInvitacion key={inv.id} inv={inv} />
            ))}
            {albumes.map((alb) => (
              <TarjetaAlbum key={alb.id} alb={alb} />
            ))}

            {/* La carpeta de lo que ya pasó. Cerrada por defecto para
                no competir con los eventos que vienen — salvo que no
                haya nada más que mostrar, ahí se abre sola para que la
                página no se vea vacía. */}
            {finalizadas.length > 0 && (
              <div className="mt-3">
                <SeccionPlegable
                  marco={false}
                  titulo="Invitaciones finalizadas"
                  resumen={String(finalizadas.length)}
                  abierta={proximas.length === 0 && albumes.length === 0}
                >
                  <p className="px-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                    Tus eventos que ya pasaron. El link sigue funcionando y
                    la lista de confirmados queda acá{" "}
                    {MESES_RETENCION_INVITACION} meses después del evento;
                    luego se borran para siempre. Si querés guardar algo,
                    descargalo antes de esa fecha.
                  </p>
                  <div className="flex flex-col gap-3">
                    {finalizadas.map((inv) => (
                      <TarjetaInvitacion key={inv.id} inv={inv} />
                    ))}
                  </div>
                </SeccionPlegable>
              </div>
            )}

            {/* Los paquetes viven cerrados: quien ya tiene su evento
                entra a ver confirmados, no a que le vendan de nuevo. */}
            <div className="mt-5">
              <SeccionPlegable
                marco={false}
                etiqueta="Más opciones"
                titulo="¿Se viene otro evento?"
              >
                <PaquetesInvitaciones
                  disposicion="pila"
                  intro="Elegí el paquete y contanos tu idea por el chat — te la entregamos lista para compartir."
                />
              </SeccionPlegable>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
