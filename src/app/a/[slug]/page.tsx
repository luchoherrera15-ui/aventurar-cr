import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import SubirFotos from "./subir-fotos";

// La serif elegante del álbum ("Boda Mich & Dani") — solo esta página
// la usa; next/font la sirve desde el propio sitio, sin pedirle nada a
// Google en el navegador.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

// El lienzo es crema de punta a punta, también en la barra del navegador.
export const viewport: Viewport = {
  themeColor: "#f7f2ea",
  colorScheme: "only light",
};

type Album = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
};

type Foto = { id: string; path: string; autor: string | null };

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
 * grilla masonry sobre fondo crema y suben las suyas sin cuenta — la
 * política de la base solo acepta fotos mientras el álbum esté activo.
 * Si la migración 0068 no ha corrido, la consulta falla y esto es un
 * 404 limpio.
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
    .select("id, slug, titulo, subtitulo")
    .eq("slug", slug)
    .eq("estado", "activo")
    .maybeSingle();

  const album = (data ?? null) as Album | null;
  if (!album) notFound();

  const { data: fotosData } = await supabase
    .from("album_fotos")
    .select("id, path, autor")
    .eq("album_id", album.id)
    .order("created_at", { ascending: false });
  const fotos = (fotosData ?? []) as Foto[];

  // Las fotos viven en el bucket público `albumes`: la URL se arma
  // directo, sin firmar nada.
  const baseFotos = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/albumes/`;

  return (
    <main className="flex min-h-svh flex-col bg-[#f7f2ea] text-[#16295e]">
      <div className="mx-auto w-full max-w-[1080px] flex-1 px-5 pb-16 pt-14 sm:px-8">
        {/* Cabecera: la serif itálica en grande, como un álbum impreso. */}
        <header className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#16295e]/55">
            El álbum del evento
          </p>
          <h1
            className={`${cormorant.className} mx-auto mt-3 max-w-[18ch] text-[clamp(38px,8vw,68px)] font-semibold italic leading-[1.05]`}
          >
            {album.titulo}
          </h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-[#16295e]/65">
            {album.subtitulo ??
              "Los recuerdos del evento, contados por sus invitados. Miralos y sumá los tuyos."}
          </p>
          <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.18em] text-[#16295e]/45">
            {fotos.length} foto{fotos.length === 1 ? "" : "s"}
          </p>
        </header>

        {/* La grilla masonry: columnas CSS, cada foto entera en su
            columna, bordes redondeados y nada más — que manden ellas. */}
        {fotos.length > 0 ? (
          <div className="mt-10 columns-2 gap-3 sm:columns-3 sm:gap-4">
            {fotos.map((f) => (
              <figure key={f.id} className="mb-3 break-inside-avoid sm:mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- fotos de invitados en el bucket público */}
                <img
                  src={`${baseFotos}${f.path}`}
                  alt={f.autor ? `Foto de ${f.autor}` : "Foto del evento"}
                  loading="lazy"
                  className="w-full rounded-xl object-cover shadow-[0_10px_30px_-18px_rgba(22,41,94,0.4)]"
                />
                {f.autor && (
                  <figcaption
                    className={`${cormorant.className} mt-1.5 text-center text-[13px] italic text-[#16295e]/55`}
                  >
                    {f.autor}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <p className="mx-auto mt-10 max-w-[400px] rounded-2xl border border-dashed border-[#16295e]/25 p-8 text-center text-[14px] text-[#16295e]/60">
            Todavía no hay fotos — sé la primera persona en subir una.
          </p>
        )}

        {/* El bloque de subir, para los invitados. */}
        <SubirFotos
          albumId={album.id}
          fotosActuales={fotos.length}
          claseSerif={cormorant.className}
        />

        {fotos.length > 0 && (
          <p
            className={`${cormorant.className} mt-14 text-center text-[17px] italic text-[#16295e]/45`}
          >
            — Has llegado al final —
          </p>
        )}
      </div>

      {/* Footer navy, como el pie de un álbum encuadernado. */}
      <footer className="bg-[#16295e] px-6 py-8 text-center">
        <p className={`${cormorant.className} text-[17px] italic text-white/90`}>
          Gracias por confiar en nosotros
        </p>
        <p className="mt-1.5 text-[12px] font-bold uppercase tracking-[0.22em] text-white/50">
          <Link href="/" className="hover:text-white">
            Bookea
          </Link>
        </p>
      </footer>
    </main>
  );
}
