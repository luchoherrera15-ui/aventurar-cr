import { notFound, redirect } from "next/navigation";
import { toString as qrATexto } from "qrcode";
import { verificarAccesoLealtad } from "@/lib/auth";
import {
  contenidoDelPoster,
  estiloDe,
  etiquetaDeMeta,
  leerConfigPoster,
  variablesDePoster,
} from "@/lib/lealtad/plantillas-poster";
import { createAdminClient } from "@/lib/supabase/admin";
import { coloresDe, metaDeSellos, type ConfigPase } from "@/lib/wallet/tarjeta";
import {
  elegirDeFilasCrudas,
  filasCrudasPorAntiguedad,
  resumenDeFila,
} from "@/lib/wallet/programa-principal";
import { operaAhora } from "@/lib/lealtad/programas";
import { llaveDeTarjeta, tarjetaConLlaveDeFila } from "@/lib/lealtad/llave-tarjeta";
import SelectorTarjeta from "./selector-tarjeta";
import { minutoISOCR } from "@/lib/fechas";
import BotonImprimir from "./boton-imprimir";
import HojaPoster, { type DatosHoja } from "./hoja-poster";
import Personalizador from "./personalizador";
import SelectorEstilo from "./selector-estilo";
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
 *
 * ------------------------------------------------------------------
 * UN SOLO HTML PARA LOS CINCO DISEÑOS
 * ------------------------------------------------------------------
 * El estilo elegido sale a `data-estilo` y de ahí lo agarra el CSS.
 * Cinco plantillas de JSX habrían sido cinco copias del mismo texto:
 * a la tercera corrección de copy, dos habrían quedado viejas y el
 * negocio habría impreso la vieja sin enterarse.
 *
 * ------------------------------------------------------------------
 * EL TEXTO SALE DEL TIPO DE TARJETA, NO DE SELLOS
 * ------------------------------------------------------------------
 * Esta hoja decía «Sumá sellos con tu teléfono» y «A los N sellos»
 * para los ocho tipos, incluso para una gift card o una entrada de
 * evento. Un cartel que promete algo que la tarjeta no hace se paga en
 * la caja: el cliente lo pide y el negocio queda mal. Todo el copy
 * viene ahora de `plantillas-poster`.
 *
 * ------------------------------------------------------------------
 * EL SEXTO ESTILO SE EDITA, Y SE GUARDA EN LA 0132
 * ------------------------------------------------------------------
 * `poster_config` (jsonb) es la columna que la 0132 dejó justo para
 * esto. Puede no estar pegada —las migraciones las pega el dueño a
 * mano—, así que se lee tolerando que no exista: sin columna, el
 * personalizado arranca de la plantilla y la pantalla avisa que no va
 * a poder guardar, en vez de fingir que guardó.
 */

/**
 * ------------------------------------------------------------------
 * UN PÓSTER POR TARJETA
 * ------------------------------------------------------------------
 * Esta pantalla imprimía SIEMPRE la tarjeta principal del negocio y su
 * QR apuntaba SIEMPRE a `/tarjeta/<negocio>`. Con dos tarjetas eso
 * quería decir que la segunda no se podía repartir: no había forma de
 * imprimir un cartel para ella.
 *
 * Ahora la tarjeta viaja en la URL (`?programa=<id>`) igual que el
 * estilo, por el mismo motivo: el link que el dueño le manda al
 * empleado, el botón de imprimir y un F5 tienen que dar la MISMA hoja.
 * Sin el parámetro se imprime la de siempre, que es lo que ya está
 * pegado en la caja.
 *
 * Y el QR de cada hoja lleva el link de SU tarjeta: el de la tarjeta
 * original sigue siendo el link corto del negocio —el que ya está
 * impreso y no puede cambiar— y el de las demás, el suyo propio.
 */

export const metadata = { title: "Póster para tu mostrador · Bookea" };

export default async function PosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estilo?: string; programa?: string }>;
}) {
  const { id } = await params;
  // El estilo viaja en la URL y no en un estado del cliente: así el
  // link que el dueño manda al empleado, el botón de imprimir y un F5
  // dan exactamente la misma hoja.
  const { estilo: estiloPedido, programa: programaPedido } = await searchParams;
  const estilo = estiloDe(estiloPedido);

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.ok) redirect("/lealtad/panel");

  // `verificarAccesoLealtad` ya es el chequeo de seguridad real; con la
  // llave de servicio acá solo para poder pedir `*` sin lista de
  // columnas a mano (`authenticated` no tiene permiso de tabla completa
  // sobre `ranchos` desde la 0155).
  const { data: rancho } = await (createAdminClient() ?? acceso.supabase)
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) notFound();

  // Con la llave de servicio: el programa puede estar pausado y la RLS
  // no se lo mostraría a un colaborador.
  //
  // Y sin `.maybeSingle()`: desde que la 0134 quitó el
  // `unique(rancho_id)`, un negocio con dos tarjetas hacía que la
  // consulta devolviera error y `data` en null — el póster salía con los
  // colores por defecto y sin la regalía, que es justo lo que se
  // imprime y se pega en la caja. Cuál manda lo decide `elegirPrograma`,
  // la misma elección del panel y de la página del QR: la hoja impresa
  // muestra la tarjeta que el cliente va a recibir.
  const db = createAdminClient();
  const { data: filasPrograma } = db
    ? await db.from("programa_lealtad").select("*").eq("rancho_id", id)
    : { data: [] };
  // Ordenadas de la más vieja a la más nueva: la primera es la que
  // sirve el link corto del negocio, la que ya está impresa.
  const tarjetas = filasCrudasPorAntiguedad((filasPrograma ?? []) as Record<string, unknown>[]);
  const laOriginal = tarjetas[0] ?? null;
  const pedida = programaPedido
    ? (tarjetas.find((f) => f.id === programaPedido) ?? null)
    : null;
  // Sin `?programa=` (o con uno que no es de este negocio) se imprime la
  // de siempre: la principal. El póster que el dueño ya tenía guardado
  // sale igual que ayer.
  const ahoraCR = minutoISOCR();
  const programa = pedida ?? elegirDeFilasCrudas(tarjetas, ahoraCR);

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
  // Sin `?? 10`: inventar una meta que la recompensa no fija es
  // prometer diez sellos que el canje no va a respetar. Si no hay meta
  // —o el tipo no promete ninguna— el bloque del premio no se dibuja.
  const etiquetaMeta = etiquetaDeMeta(config.modo, metaDeSellos(meta));

  // La 0132 agregó estas dos columnas. Si la migración todavía no se
  // pegó, el `select *` las devuelve `undefined` en vez de fallar: el
  // banner cae al degradado del color del negocio y el personalizado
  // arranca de la plantilla. La hoja sale igual.
  const banner = (programa?.pase_banner_url as string | null | undefined) ?? null;
  const configPoster = leerConfigPoster(programa?.poster_config, config.modo, colores.sello);

  // `select *` trae la columna aunque valga `{}`; si NO viene, es que la
  // 0132 no corrió. Se avisa ANTES de que el dueño escriba su póster
  // entero y descubra al guardar que no había dónde guardarlo.
  const faltaColumna = !!programa && !("poster_config" in programa);

  const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat";
  // EL LINK DE **ESTA** TARJETA.
  //
  // La original se queda con el link corto del negocio: es el que está
  // impreso en la calle, y reimprimir el póster no puede cambiarlo. Las
  // demás llevan el suyo. `llaveDeTarjeta` da el mismo texto antes y
  // después de la 0199 — ver `llave-tarjeta.ts`.
  const esLaOriginal = !!programa && !!laOriginal && programa.id === laOriginal.id;
  const rutaTarjeta =
    !programa || esLaOriginal
      ? ""
      : `/${llaveDeTarjeta(tarjetaConLlaveDeFila(programa))}`;
  const url = rancho.slug ? `${SITIO}/tarjeta/${rancho.slug}${rutaTarjeta}` : null;

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

  const paleta = { fondo: colores.fondo, acento: colores.sello };
  const datos: DatosHoja = {
    negocio: rancho.nombre as string,
    logoUrl: config.pase_logo_url,
    bannerUrl: banner,
    svgQr: svgQr ?? "",
    etiquetaMeta,
    premio: meta ? meta.nombre : null,
  };

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
        <>
          <SelectorTarjeta
            ruta={`/lealtad/panel/${id}/poster`}
            estilo={estilo}
            actualId={(programa?.id as string | undefined) ?? null}
            tarjetas={tarjetas.map((t) => {
              const llave = llaveDeTarjeta(tarjetaConLlaveDeFila(t));
              const original = !!laOriginal && t.id === laOriginal.id;
              return {
                id: t.id as string,
                nombre: (t.nombre as string) ?? "Tarjeta",
                color: (t.pase_color_fondo as string | null) ?? null,
                url: rancho.slug
                  ? `${SITIO}/tarjeta/${rancho.slug}${original ? "" : `/${llave}`}`
                  : null,
                esLaDelQrImpreso: original,
                emitiendo: operaAhora(resumenDeFila(t), ahoraCR),
              };
            })}
          />

          <SelectorEstilo
            ruta={`/lealtad/panel/${id}/poster`}
            programaId={pedida ? (pedida.id as string) : null}
            actual={estilo}
            marca={colores.fondo}
            acento={colores.sello}
          />

          {estilo === "personalizado" ? (
            <Personalizador
              ranchoId={id}
              programaId={(programa?.id as string | undefined) ?? null}
              tipo={config.modo}
              inicial={configPoster}
              colores={paleta}
              datos={datos}
              puedeGuardar={acceso.esDueno || acceso.esAdmin}
              avisoBase={
                faltaColumna
                  ? "Tu base todavía no tiene la columna del póster (migración 0132): podés probar el diseño e imprimirlo, pero no se va a poder guardar."
                  : null
              }
            />
          ) : (
            <HojaPoster
              estilo={estilo}
              // Sin `as`: el ternario ya deja fuera 'personalizado', y
              // lo que queda ES una plantilla.
              layout={estilo}
              contenido={contenidoDelPoster(estilo, config.modo, null)}
              variables={variablesDePoster(paleta, null)}
              datos={datos}
            />
          )}
        </>
      )}
    </main>
  );
}
