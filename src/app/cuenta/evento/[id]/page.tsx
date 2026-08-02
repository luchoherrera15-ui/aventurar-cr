import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import BotonCopiar from "@/components/boton-copiar";
import BotonBorrarRsvp from "./boton-borrar-rsvp";
import { IconCamera, IconClock, IconMail, IconPin, IconUsers } from "@/components/icons";
import { parsearPreguntas, type PreguntaInvitacion } from "@/lib/invitaciones-preguntas";
import { fechaCortaMensaje, fechaLargaCR } from "@/lib/fechas";

export const metadata: Metadata = {
  title: "Tu evento",
  robots: { index: false },
};

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

type Rsvp = {
  id: string;
  nombre: string;
  acompanantes: number;
  asistira: boolean;
  mensaje: string | null;
  respuestas: Record<string, string> | null;
  correo: string | null;
  created_at: string;
};

type AlbumResumen = {
  id: string;
  slug: string;
  estado: string;
};

/**
 * El espacio de fiesta del anfitrión (/cuenta/evento/{id}): su
 * invitación con el link listo para compartir, el tablero de
 * confirmaciones con los conteos por pregunta (los números exactos
 * para el catering) y el QR del álbum de fotos si ya se lo crearon.
 * Solo entra el cliente dueño de la invitación — las políticas de la
 * base tampoco dejarían ver nada ajeno.
 */
export default async function EspacioEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const { data: inv } = await supabase
    .from("invitaciones")
    .select("id, slug, titulo, anfitriones, fecha_evento, hora, lugar_nombre, direccion, estado")
    .eq("id", id)
    .eq("cliente_id", user.id)
    .maybeSingle();
  if (!inv) notFound();

  // Lo que llegó con la 0068 (preguntas, respuestas y álbum) se pide
  // tolerando el error: sin esa migración el espacio funciona igual,
  // solo sin esos bloques.
  const [pregRes, rsvpConRes, albumRes] = await Promise.all([
    supabase.from("invitaciones").select("preguntas").eq("id", id).maybeSingle(),
    supabase
      .from("invitacion_rsvp")
      .select("id, nombre, acompanantes, asistira, mensaje, respuestas, correo, created_at")
      .eq("invitacion_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("albumes")
      .select("id, slug, estado")
      .eq("invitacion_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const preguntas = parsearPreguntas(
    (pregRes.data as { preguntas?: unknown } | null)?.preguntas,
  );

  let rsvps: Rsvp[];
  if (rsvpConRes.error) {
    // `respuestas` (0068) o `correo` (0070) no existen todavía: se van
    // recortando columnas hasta el select básico, que siempre está.
    rsvps = [];
    for (const columnas of [
      "id, nombre, acompanantes, asistira, mensaje, respuestas, created_at",
      "id, nombre, acompanantes, asistira, mensaje, created_at",
    ]) {
      const { data, error } = await supabase
        .from("invitacion_rsvp")
        .select(columnas)
        .eq("invitacion_id", id)
        .order("created_at", { ascending: false });
      if (!error) {
        rsvps = ((data ?? []) as unknown as Partial<Rsvp>[]).map((r) => ({
          respuestas: null,
          correo: null,
          ...r,
        })) as Rsvp[];
        break;
      }
    }
  } else {
    rsvps = (rsvpConRes.data ?? []) as Rsvp[];
  }

  const album = (albumRes.data ?? null) as AlbumResumen | null;

  // El tablero: cada "sí" cuenta a la persona más sus acompañantes.
  const asistiran = rsvps.filter((r) => r.asistira);
  const noVienen = rsvps.filter((r) => !r.asistira);
  const totalPersonas = asistiran.reduce((acc, r) => acc + 1 + (r.acompanantes ?? 0), 0);
  const acompanantesTotal = totalPersonas - asistiran.length;

  // Los correos que dejaron los invitados, listos para copiarlos en un
  // solo clic (avisos de última hora, agradecimientos…).
  const correosDe = (lista: Rsvp[]) =>
    [...new Set(lista.map((r) => r.correo).filter((c): c is string => !!c))].join(", ");

  // Conteos por pregunta de opciones, solo entre quienes sí vienen:
  // "Vegetarianos: 5" listo para dictárselo al catering.
  const preguntasOpciones = preguntas.filter((p) => p.tipo === "opciones");
  const conteosPorPregunta = preguntasOpciones.map((p) => {
    const porOpcion = new Map<string, number>((p.opciones ?? []).map((o) => [o, 0]));
    let sinResponder = 0;
    for (const r of asistiran) {
      const respuesta = r.respuestas?.[p.id];
      if (respuesta && porOpcion.has(respuesta)) {
        porOpcion.set(respuesta, (porOpcion.get(respuesta) ?? 0) + 1);
      } else if (respuesta) {
        porOpcion.set(respuesta, 1);
      } else {
        sinResponder += 1;
      }
    }
    return { pregunta: p, porOpcion, sinResponder };
  });

  const urlInvitacion = `${SITIO_URL}/i/${inv.slug as string}`;
  const urlAlbum = album ? `${SITIO_URL}/a/${album.slug}` : null;
  const urlQr = urlAlbum
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlAlbum)}`
    : null;

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Tu evento" />

      <section className="mx-auto max-w-[860px] px-6 py-8">
        <Link
          href="/cuenta"
          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Volver a tu cuenta
        </Link>

        {/* El evento en grande: es SU espacio, no un listado más. */}
        <div className="mt-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-6">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Tu espacio de fiesta
          </p>
          <h1 className="titulo mt-2 text-[clamp(24px,5vw,34px)] text-aventurea-ink">
            {inv.titulo as string}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] font-semibold text-aventurea-ink-soft">
            <span>{fechaLargaCR(inv.fecha_evento as string)}</span>
            {inv.hora && (
              <span className="inline-flex items-center gap-1.5">
                <IconClock className="h-3.5 w-3.5" /> {inv.hora as string}
              </span>
            )}
            {inv.lugar_nombre && (
              <span className="inline-flex items-center gap-1.5">
                <IconPin className="h-3.5 w-3.5" /> {inv.lugar_nombre as string}
              </span>
            )}
          </p>

          {/* El link de la invitación, listo para pegar en el chat. */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3">
            <IconMail className="h-4 w-4 shrink-0 text-aventurea-orange" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-aventurea-ink">
              {urlInvitacion}
            </span>
            <BotonCopiar texto={urlInvitacion} etiqueta="Copiar link" />
            {inv.estado === "activa" ? (
              <a
                href={`/i/${inv.slug as string}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-aventurea-navy px-3 py-1.5 text-[12px] font-bold text-white hover:bg-aventurea-navy-2"
              >
                Ver invitación
              </a>
            ) : (
              <span className="shrink-0 rounded-lg bg-aventurea-cream px-2.5 py-1 text-[10.5px] font-bold uppercase text-aventurea-ink-soft">
                {inv.estado as string}
              </span>
            )}
          </div>
        </div>

        {/* ---------- El tablero de confirmaciones ---------- */}
        <div className="mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-aventurea-ink">
            <IconUsers className="h-4.5 w-4.5 text-aventurea-orange" /> Confirmaciones
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra valor={totalPersonas} etiqueta="personas en total" destacada />
            <Cifra valor={asistiran.length} etiqueta={asistiran.length === 1 ? "sí asistirá" : "sí asistirán"} />
            <Cifra valor={acompanantesTotal} etiqueta={acompanantesTotal === 1 ? "acompañante" : "acompañantes"} />
            <Cifra valor={noVienen.length} etiqueta={noVienen.length === 1 ? "no podrá ir" : "no podrán ir"} />
          </div>
          <p className="mt-2 text-[12px] text-aventurea-ink-soft">
            El total cuenta a cada confirmado con sus acompañantes — es el número que le
            podés dar al catering y al lugar.
          </p>

          {/* Los conteos por pregunta: la razón de ser del tablero. */}
          {conteosPorPregunta.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {conteosPorPregunta.map(({ pregunta, porOpcion, sinResponder }) => (
                <div
                  key={pregunta.id}
                  className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-4"
                >
                  <p className="text-[12.5px] font-bold text-aventurea-ink">
                    {pregunta.etiqueta}
                  </p>
                  <ul className="mt-2 grid gap-1">
                    {[...porOpcion.entries()].map(([opcion, cuenta]) => (
                      <li
                        key={opcion}
                        className="flex items-baseline justify-between gap-3 text-[13px]"
                      >
                        <span className="text-aventurea-ink-soft">{opcion}</span>
                        <span className="font-extrabold tabular-nums text-aventurea-ink">
                          {cuenta}
                        </span>
                      </li>
                    ))}
                    {sinResponder > 0 && (
                      <li className="flex items-baseline justify-between gap-3 text-[13px] text-aventurea-ink-soft">
                        <span>Sin responder</span>
                        <span className="font-semibold tabular-nums">{sinResponder}</span>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Las listas, separadas: quiénes vienen y quiénes avisaron
              que no, cada quien con su correo y su fecha de respuesta. */}
          {rsvps.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-aventurea-line p-5 text-center text-[13px] text-aventurea-ink-soft">
              Todavía nadie ha confirmado. Compartí el link de arriba y acá van a ir
              apareciendo.
            </p>
          ) : (
            <>
              <ListaRsvp
                titulo={`Sí asistirán (${asistiran.length})`}
                vacio="Todavía nadie ha confirmado que viene."
                rsvps={asistiran}
                correos={correosDe(asistiran)}
                preguntas={preguntas}
                invitacionId={id}
              />
              <ListaRsvp
                titulo={`No podrán ir (${noVienen.length})`}
                vacio="Nadie ha avisado que no puede ir."
                rsvps={noVienen}
                correos={correosDe(noVienen)}
                preguntas={preguntas}
                invitacionId={id}
              />
            </>
          )}
        </div>

        {/* ---------- El álbum de fotos con su QR ---------- */}
        {album && urlAlbum && urlQr && (
          <div className="mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface p-6">
            <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-aventurea-ink">
              <IconCamera className="h-4.5 w-4.5 text-aventurea-orange" /> El álbum del evento
            </h2>
            <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-xl border border-aventurea-line bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR generado por servicio externo */}
                <img
                  src={urlQr}
                  alt={`Código QR del álbum de fotos (${urlAlbum})`}
                  width={180}
                  height={180}
                  className="h-[180px] w-[180px]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  Imprimí este QR y ponelo en las mesas: tus invitados escanean, ven las
                  fotos del evento y suben las suyas sin instalar nada.
                  {album.estado !== "activo" && (
                    <span className="ml-1 font-bold">
                      (El álbum está archivado — pedinos reactivarlo si lo necesitás.)
                    </span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-aventurea-ink">
                    {urlAlbum}
                  </span>
                  <BotonCopiar texto={urlAlbum} etiqueta="Copiar link" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <a
                    href={urlQr}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2"
                  >
                    Descargar / imprimir QR
                  </a>
                  <a
                    href={`/a/${album.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-aventurea-line px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                  >
                    Ver el álbum
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Un número del tablero con su etiqueta. */
function Cifra({
  valor,
  etiqueta,
  destacada,
}: {
  valor: number;
  etiqueta: string;
  destacada?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        destacada
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink"
      }`}
    >
      <p className="text-[26px] font-extrabold leading-tight tabular-nums">{valor}</p>
      <p
        className={`mt-0.5 text-[11.5px] font-semibold ${
          destacada ? "text-white/75" : "text-aventurea-ink-soft"
        }`}
      >
        {etiqueta}
      </p>
    </div>
  );
}

/**
 * Una de las dos listas del tablero ("Sí asistirán" / "No podrán ir"):
 * encabezado con el conteo, botón para copiar todos los correos de esa
 * lista y las filas una por una.
 */
function ListaRsvp({
  titulo,
  vacio,
  rsvps,
  correos,
  preguntas,
  invitacionId,
}: {
  titulo: string;
  vacio: string;
  rsvps: Rsvp[];
  correos: string;
  preguntas: PreguntaInvitacion[];
  invitacionId: string;
}) {
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-extrabold text-aventurea-ink">{titulo}</h3>
        {correos && <BotonCopiar texto={correos} etiqueta="Copiar correos" />}
      </div>
      {rsvps.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-aventurea-line px-4 py-3 text-[12.5px] text-aventurea-ink-soft">
          {vacio}
        </p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-aventurea-line">
          {rsvps.map((r) => (
            <FilaRsvp
              key={r.id}
              rsvp={r}
              preguntas={preguntas}
              invitacionId={invitacionId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Una confirmación: nombre, acompañantes, correo, mensaje y respuestas. */
function FilaRsvp({
  rsvp,
  preguntas,
  invitacionId,
}: {
  rsvp: Rsvp;
  preguntas: PreguntaInvitacion[];
  invitacionId: string;
}) {
  const etiquetaDe = new Map(preguntas.map((p) => [p.id, p.etiqueta]));
  const respuestas = Object.entries(rsvp.respuestas ?? {});
  return (
    <div className="border-b border-aventurea-line bg-white px-4 py-3 last:border-none">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[13.5px] font-bold text-aventurea-ink">{rsvp.nombre}</p>
        {rsvp.asistira && rsvp.acompanantes > 0 && (
          <span className="text-[12px] font-semibold text-aventurea-ink-soft">
            +{rsvp.acompanantes} acompañante{rsvp.acompanantes === 1 ? "" : "s"}
          </span>
        )}
        <span
          className={`ml-auto rounded-lg px-2.5 py-0.5 text-[10.5px] font-bold uppercase ${
            rsvp.asistira
              ? "bg-aventurea-green-light text-aventurea-green"
              : "bg-aventurea-cream-2 text-aventurea-ink-soft"
          }`}
        >
          {rsvp.asistira ? "Sí asistirá" : "No podrá ir"}
        </span>
        {/* El link de la invitación es público: la misma persona
            confirma dos veces sin querer, desde el teléfono y la compu.
            Ese conteo es el que se le pasa al salón y al catering. */}
        <BotonBorrarRsvp
          rsvpId={rsvp.id}
          invitacionId={invitacionId}
          nombre={rsvp.nombre}
        />
      </div>
      {(rsvp.correo || rsvp.created_at) && (
        <p className="mt-1 text-[12px] text-aventurea-ink-soft">
          {rsvp.correo && (
            <a
              href={`mailto:${rsvp.correo}`}
              className="font-semibold text-aventurea-navy hover:underline"
            >
              {rsvp.correo}
            </a>
          )}
          {rsvp.correo && rsvp.created_at && " · "}
          {rsvp.created_at && fechaCortaMensaje(rsvp.created_at)}
        </p>
      )}
      {respuestas.length > 0 && (
        <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">
          {respuestas.map(([pid, valor], idx) => (
            <span key={pid}>
              {idx > 0 && " · "}
              <span className="font-semibold text-aventurea-ink">
                {etiquetaDe.get(pid) ?? pid}:
              </span>{" "}
              {valor}
            </span>
          ))}
        </p>
      )}
      {rsvp.mensaje && (
        <p className="mt-1.5 text-[12.5px] italic leading-relaxed text-aventurea-ink-soft">
          “{rsvp.mensaje}”
        </p>
      )}
    </div>
  );
}
