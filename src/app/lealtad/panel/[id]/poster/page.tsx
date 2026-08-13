import { notFound, redirect } from "next/navigation";
import { toString as qrATexto } from "qrcode";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { coloresDe, metaDeSellos, type ConfigPase } from "@/lib/wallet/tarjeta";
import BotonImprimir from "./boton-imprimir";
import "./poster.css";

/**
 * EL PÓSTER DEL MOSTRADOR: la hoja que el negocio imprime y pega en la
 * caja para que sus clientes escaneen y se afilien solos.
 *
 * Se arma con lo que ya existe (colores del programa, logo, regalía y
 * meta) y se imprime desde el navegador — sin diseñador, sin PDF que
 * generar en el servidor y sin que nadie tenga que pedirle nada a
 * Bookea. Es el equivalente nuestro del "poster generator" que el
 * dueño vio en Cockato.
 *
 * La hoja es A4 vertical: `poster.css` fija el tamaño de página, apaga
 * los márgenes del navegador y esconde todo lo que no sea la hoja.
 */

export const metadata = { title: "Póster para tu mostrador · Bookea" };

export default async function PosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.ok) redirect("/lealtad/panel");

  const { data: rancho } = await acceso.supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  // Con la llave de servicio: el programa puede estar pausado y la RLS
  // no se lo mostraría a un colaborador.
  const db = createAdminClient();
  const { data: programa } = db
    ? await db.from("programa_lealtad").select("*").eq("rancho_id", id).maybeSingle()
    : { data: null };

  const { data: recompensa } = db && programa
    ? await db
        .from("recompensas")
        .select("nombre, costo_puntos")
        .eq("programa_id", programa.id as string)
        .eq("activo", true)
        .order("costo_puntos", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const config: ConfigPase = {
    modo: (programa?.modo as ConfigPase["modo"]) ?? "sellos",
    pase_color_fondo: (programa?.pase_color_fondo as string | null) ?? null,
    pase_color_sello: (programa?.pase_color_sello as string | null) ?? null,
    pase_logo_url: (programa?.pase_logo_url as string | null) ?? null,
  };
  const colores = coloresDe(config);
  const meta = recompensa
    ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
    : null;
  const totalSellos = metaDeSellos(meta) ?? 10;

  const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat";
  const url = rancho.slug ? `${SITIO}/tarjeta/${rancho.slug}` : null;

  // Nivel H: el póster se imprime y vive pegado en una pared — puede
  // ensuciarse o quedar parcialmente tapado, y H tolera hasta un 30%
  // de daño. Margen 1: el marco blanco lo pone el diseño.
  const svgQr = url
    ? await qrATexto(url, {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 1,
        color: { dark: "#0a1226", light: "#ffffff" },
      })
    : null;

  return (
    <main className="poster-pantalla">
      <div className="poster-barra no-imprimir">
        <a href={`/lealtad/panel/${id}`} className="poster-volver">
          ← Volver al panel
        </a>
        <BotonImprimir />
      </div>

      {!url && (
        <p className="poster-aviso no-imprimir">
          Este negocio todavía no tiene su página pública lista, así que no hay
          código que imprimir. Escribinos y lo activamos.
        </p>
      )}

      {url && svgQr && (
        <div className="poster-hoja" style={{ background: colores.fondo }}>
          <div className="poster-cuerpo">
            {config.pase_logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element -- se
                 imprime tal cual; next/image no aporta acá. */
              <img src={config.pase_logo_url} alt="" className="poster-logo" />
            ) : null}

            <p className="poster-negocio">{rancho.nombre}</p>
            <h1 className="poster-titulo">
              Sumá sellos con
              <br />
              tu teléfono
            </h1>

            <div className="poster-qr" dangerouslySetInnerHTML={{ __html: svgQr }} />
            <p className="poster-escanea">Escaneá el código con la cámara</p>

            {meta && (
              <div className="poster-premio" style={{ borderColor: colores.sello }}>
                <span className="poster-premio-etiqueta" style={{ color: colores.sello }}>
                  A los {totalSellos} sellos
                </span>
                <span className="poster-premio-nombre">{meta.nombre}</span>
              </div>
            )}

            <ol className="poster-pasos">
              <li>
                <span className="poster-num" style={{ background: colores.sello }}>
                  1
                </span>
                Escaneá y agregá la tarjeta a tu teléfono
              </li>
              <li>
                <span className="poster-num" style={{ background: colores.sello }}>
                  2
                </span>
                Mostrala en cada visita y sumá tu sello
              </li>
              <li>
                <span className="poster-num" style={{ background: colores.sello }}>
                  3
                </span>
                Completala y reclamá tu premio
              </li>
            </ol>

            <p className="poster-pie">
              Sin apps que instalar · Apple Wallet y Google Wallet
              <span className="poster-marca">Powered by Bookea.lat</span>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
