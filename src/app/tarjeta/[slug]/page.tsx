import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import { coloresDe, metaDeSellos, type ConfigPase } from "@/lib/wallet/tarjeta";

/**
 * LA PUERTA DEL CLIENTE: acá es donde alguien consigue su tarjeta de
 * lealtad. El negocio comparte este link (o su QR impreso en el
 * mostrador), el cliente entra, inicia sesión si hace falta, y toca
 * "Agregar a Apple Wallet" — el endpoint /api/pases lo afilia solo y
 * le devuelve el pase firmado.
 *
 * Se lee con la llave de servicio A PROPÓSITO: un negocio "solo
 * lealtad" vive en estado 'pendiente' (invisible en los directorios) y
 * la RLS no se lo mostraría ni a un cliente logueado. Lo único que se
 * expone acá es la cara pública de un programa ACTIVO — nombre, colores
 * y regalía — que es exactamente lo que el negocio quiere repartir.
 */
export default async function TarjetaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: negocio } = await admin
    .from("ranchos")
    .select("id, nombre, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) notFound();

  const { data: programa } = await admin
    .from("programa_lealtad")
    .select(
      "id, nombre, activo, estado, modo, pase_color_fondo, pase_color_sello, pase_logo_url",
    )
    .eq("rancho_id", negocio.id)
    .maybeSingle();

  // Solo un programa OPERANDO reparte tarjetas. Pausado o borrador →
  // la página no existe para el público, igual que antes de crearla.
  const estado =
    (programa?.estado as string | null) ??
    (programa?.activo ? "activo" : "pausado");
  if (!programa || estado !== "activo") notFound();

  const config: ConfigPase = {
    modo: (programa.modo as ConfigPase["modo"]) ?? null,
    pase_color_fondo: programa.pase_color_fondo as string | null,
    pase_color_sello: programa.pase_color_sello as string | null,
    pase_logo_url: programa.pase_logo_url as string | null,
  };
  const colores = coloresDe(config);

  // La regalía que promete: la recompensa activa más barata, igual que
  // en el pase. Si cambia allá, cambia acá sola.
  const { data: recompensa } = await admin
    .from("recompensas")
    .select("nombre, costo_puntos")
    .eq("programa_id", programa.id)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1)
    .maybeSingle();

  const total = metaDeSellos(
    recompensa
      ? {
          nombre: recompensa.nombre as string,
          costo_puntos: recompensa.costo_puntos as number,
        }
      : null,
  );

  // ¿Ya hay sesión? Decide si se muestra el botón o el login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main
      className="flex min-h-svh items-center justify-center px-5 py-12"
      style={{ background: "#0a1226" }}
    >
      <div className="w-full max-w-sm text-center">
        {/* La tarjeta, como se va a ver: los colores del negocio. */}
        <div
          className="mx-auto overflow-hidden rounded-2xl p-6 text-left shadow-2xl"
          style={{ backgroundColor: colores.fondo }}
        >
          <p className="text-[17px] font-light text-white">{negocio.nombre}</p>
          {total !== null && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {Array.from({ length: Math.min(total, 12) }, (_, i) => (
                <span
                  key={i}
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: colores.sello, opacity: i === 0 ? 1 : 0.26 }}
                />
              ))}
            </div>
          )}
          {recompensa && (
            <p className="mt-4 text-[12.5px] text-white/70">
              Al completar {recompensa.costo_puntos as number}:{" "}
              <span className="font-bold text-white">{recompensa.nombre as string}</span>
            </p>
          )}
          <p className="mt-3 text-right text-[10px] text-white/50">Powered by Bookea.lat</p>
        </div>

        <h1 className="mt-7 text-xl font-bold text-white">
          Tu tarjeta de {negocio.nombre}
        </h1>
        <p className="mt-1.5 text-sm text-white/60">
          Vive en tu teléfono y suma sola en cada visita — sin apps que instalar.
        </p>

        {user ? (
          <>
            {/* El href directo es lo que hace que iOS ofrezca "Agregar
                a Wallet": el endpoint responde application/vnd.apple.pkpass
                y el sistema hace el resto. */}
            <a
              href={`/api/pases/${negocio.id}`}
              className="mt-6 inline-block w-full rounded-full px-7 py-3.5 text-[15px] font-bold text-white transition-transform hover:scale-[1.02]"
              style={{ background: "#ee7420" }}
            >
               Agregar a Apple Wallet
            </a>
            <p className="mt-3 text-[12px] text-white/40">
              Abrilo desde tu iPhone para que Wallet lo agregue directo. Google Wallet
              llega pronto.
            </p>
          </>
        ) : (
          <div className="mt-6 rounded-2xl bg-white p-6 text-left">
            {/* El MISMO login de /cuenta: crea la cuenta si el correo es
                nuevo, y vuelve exactamente acá al terminar. */}
            <FormularioAuth
              destino={`/tarjeta/${negocio.slug}`}
              titulo="Entrá para agregar tu tarjeta"
              intro="Con tu correo alcanza: si es tu primera vez te creamos la cuenta ahí mismo."
            />
          </div>
        )}

        <p className="mt-8 text-[12px] text-white/30">
          <Link href="/lealtad" className="underline hover:text-white/60">
            ¿Tenés un negocio? Armá tu propio programa
          </Link>
        </p>
      </div>
    </main>
  );
}
