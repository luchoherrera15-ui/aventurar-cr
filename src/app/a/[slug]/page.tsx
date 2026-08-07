import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import {
  conAlfa,
  PALETA_ALBUM_DEFECTO,
  paletaDelAlbum,
  type Paleta,
} from "@/lib/invitaciones/paleta";
import AlbumInteractivo from "./album-interactivo";
import VeloCarga from "./velo-carga";
import type { FotoAlbum } from "./galeria";

// La serif elegante del álbum ("Boda Mich & Dani") — solo esta página
// la usa; next/font la sirve desde el propio sitio, sin pedirle nada a
// Google en el navegador.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

// El color de la barra del navegador no puede salir de la base: se
// resuelve antes de saber qué álbum es. Queda el crema de siempre.
export const viewport: Viewport = {
  themeColor: PALETA_ALBUM_DEFECTO.fondo,
  colorScheme: "only light",
};

type Album = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  cliente_id: string | null;
  invitacion_id: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("albumes")
    .select("titulo")
    .eq("slug", slug)
    .eq("estado", "activo")
    .maybeSingle();
  return {
    title: data ? `Álbum · ${data.titulo as string}` : "Álbum de fotos",
    description: "Las fotos del evento — miralas y subí las tuyas.",
    robots: { index: false },
  };
}

/**
 * El álbum digital del evento (/a/{slug}): la página a la que llegan
 * los invitados escaneando el QR de las mesas. Ven las fotos en una
 * grilla masonry y suben las suyas sin cuenta — la política de la base
 * solo acepta fotos mientras el álbum esté activo. Si la migración 0068
 * no ha corrido, la consulta falla y esto es un 404 limpio.
 *
 * Los colores los hereda de su invitación (0089): la boda en verde
 * botella ya no cae en un álbum beige. Si el álbum no cuelga de ninguna
 * invitación, o esa invitación no tiene diseño propio, queda el crema
 * de siempre.
 */
export default async function AlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("albumes")
    .select("id, slug, titulo, subtitulo, cliente_id, invitacion_id")
    .eq("slug", slug)
    .eq("estado", "activo")
    .maybeSingle();

  const album = (data ?? null) as Album | null;
  if (!album) notFound();

  const [{ data: fotosData }, { data: sesion }] = await Promise.all([
    supabase
      .from("album_fotos")
      .select("id, path, autor")
      .eq("album_id", album.id)
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);
  const fotos = (fotosData ?? []) as FotoAlbum[];

  const paleta = await paletaDeLaInvitacion(supabase, album.invitacion_id);

  // El dueño del álbum (o un admin) puede quitar cualquier foto; un
  // invitado, solo las suyas, y eso lo resuelve el navegador.
  const usuario = sesion?.user ?? null;
  let esDueno = false;
  if (usuario) {
    esDueno = album.cliente_id === usuario.id;
    if (!esDueno) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", usuario.id)
        .maybeSingle();
      esDueno = perfil?.rol === "admin";
    }
  }

  // Las fotos viven en el bucket público `albumes`: la URL se arma
  // directo, sin firmar nada.
  //
  // El .trim() es un blindaje ganado a golpes: la variable en Vercel
  // llegó a tener DOS saltos de línea pegados al final. Un <img> normal
  // lo perdona (el parser de URLs del navegador quita los saltos), pero
  // el optimizador de next/image recibe la URL codificada tal cual y
  // responde 400 — y el álbum entero se quedó sin fotos en producción.
  const baseFotos = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()}/storage/v1/object/public/albumes/`;

  // La portada: la PRIMERA foto que se subió (las fotos vienen de la
  // más nueva a la más vieja) — suele ser la del anfitrión, no la
  // última ocurrencia de un invitado a las 2 a. m.
  const portada = fotos.length > 0 ? fotos[fotos.length - 1] : null;

  return (
    <main
      className="flex min-h-svh flex-col"
      style={{ background: paleta.fondo, color: paleta.tinta }}
    >
      {/* El velo de carga: primero "Cargando… %", y el álbum aparece
          entero de una sola vez (las primeras fotos ya en caché). */}
      <VeloCarga
        urls={fotos.slice(0, 12).map((f) => `${baseFotos}${f.path}`)}
        titulo={album.titulo}
        paleta={paleta}
        claseSerif={cormorant.className}
      />

      {/* La portada, de borde a borde, fundiéndose con el fondo. */}
      {portada && (
        <div className="relative h-[42svh] min-h-[280px] w-full sm:h-[52svh]">
          <Image
            src={`${baseFotos}${portada.path}`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, ${conAlfa(paleta.tinta, 0.22)}, transparent 38%, ${conAlfa(paleta.fondo, 0)} 62%, ${paleta.fondo} 97%)`,
            }}
          />
        </div>
      )}

      <div
        className={`mx-auto w-full max-w-[1080px] flex-1 px-5 pb-16 sm:px-8 ${portada ? "pt-6" : "pt-14"}`}
      >
        {/* Cabecera: la serif itálica en grande, como un álbum impreso. */}
        <header className="text-center">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.34em]"
            style={{ color: conAlfa(paleta.tinta, 0.55) }}
          >
            El álbum del evento
          </p>
          <h1
            className={`${cormorant.className} mx-auto mt-3 max-w-[18ch] text-[clamp(38px,8vw,68px)] font-semibold italic leading-[1.05]`}
          >
            {album.titulo}
          </h1>
          <p
            className="mx-auto mt-4 max-w-[52ch] text-[14.5px] leading-relaxed"
            style={{ color: conAlfa(paleta.tinta, 0.65) }}
          >
            {album.subtitulo ??
              "Los recuerdos del evento, contados por sus invitados. Miralos y sumá los tuyos."}
          </p>
          <p
            className="mt-5 text-[12px] font-bold uppercase tracking-[0.18em]"
            style={{ color: conAlfa(paleta.tinta, 0.45) }}
          >
            {fotos.length} foto{fotos.length === 1 ? "" : "s"}
          </p>
        </header>

        {/* Subir y descargar van arriba, en la misma barra: nadie tiene
            que bajar todo el álbum para poder aportar una foto. */}
        <AlbumInteractivo
          albumId={album.id}
          slug={album.slug}
          fotos={fotos}
          baseFotos={baseFotos}
          paleta={paleta}
          esDueno={esDueno}
          claseSerif={cormorant.className}
        />

        {fotos.length > 0 && (
          <p
            className={`${cormorant.className} mt-14 text-center text-[17px] italic`}
            style={{ color: conAlfa(paleta.tinta, 0.45) }}
          >
            — Has llegado al final —
          </p>
        )}
      </div>

      {/* Footer con el acento, como el pie de un álbum encuadernado. */}
      <footer className="px-6 py-8 text-center" style={{ background: paleta.acento }}>
        <p
          className={`${cormorant.className} text-[17px] italic`}
          style={{ color: conAlfa(paleta.fondo, 0.92) }}
        >
          Gracias por confiar en nosotros
        </p>
        <p
          className="mt-1.5 text-[12px] font-bold uppercase tracking-[0.22em]"
          style={{ color: conAlfa(paleta.fondo, 0.55) }}
        >
          <Link href="/" style={{ color: "inherit" }}>
            Bookea
          </Link>
        </p>
      </footer>
    </main>
  );
}

/**
 * Los colores del álbum: lo que se corrigió a mano en la invitación, o
 * lo que se deduce de su diseño.
 *
 * Se lee con la sesión de quien mira, no con la llave de servicio: la
 * política pública de `invitaciones` deja ver las activas, que son las
 * que tienen álbum vivo. Una invitación en borrador o archivada no se
 * lee y el álbum queda con el crema de siempre — preferible a poner una
 * llave de servicio en una página pública por un color.
 */
async function paletaDeLaInvitacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invitacionId: string | null,
): Promise<Paleta> {
  if (!invitacionId) return PALETA_ALBUM_DEFECTO;

  const { data } = await supabase
    .from("invitaciones")
    .select("paleta, html_personalizado")
    .eq("id", invitacionId)
    .maybeSingle();
  if (!data) return PALETA_ALBUM_DEFECTO;

  return paletaDelAlbum({
    paleta: (data as { paleta?: unknown }).paleta,
    htmlPersonalizado: (data as { html_personalizado?: string | null })
      .html_personalizado,
  });
}
