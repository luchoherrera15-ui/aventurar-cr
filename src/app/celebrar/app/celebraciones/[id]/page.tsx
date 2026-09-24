import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BotonCopiar from "@/components/boton-copiar";
import { ICONO_TIPO } from "@/components/celebrar/iconos-tipos";
import { TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { PastillaEstado } from "@/components/celebrar/panel/tarjeta-celebracion";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { celebracionPorId, invitacionDe } from "@/lib/celebrar/datos";
import { sitioCelebrar, urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { tipoCelebracion } from "@/lib/celebrar/marca";
import { RUTA, rutaEditor } from "@/lib/celebrar/rutas";
import { fechaLargaCR } from "@/lib/fechas";
import { cambiarEstadoCelebracion } from "./acciones";
import EditarBasicos from "./editar-basicos";
import AyudaDiseno from "@/components/celebrar/panel/ayuda-diseno";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await celebracionPorId(id);
  return { title: c ? c.nombre : "Celebración" };
}

/** Lo que viene después de crear, en el orden del asistente (pasos 3 a 7). */
const PASOS_SIGUIENTES = [
  { n: "03", titulo: "Elegir diseño", detalle: "Una plantilla como punto de partida." },
  { n: "04", titulo: "Personalizar", detalle: "Colores, fotos, textos y música, viendo el resultado en vivo." },
  { n: "05", titulo: "Agregar funciones", detalle: "Confirmaciones, álbum, libro de firmas, mesa de regalos." },
  { n: "06", titulo: "Vista previa", detalle: "Tal como la van a ver tus invitados en el teléfono." },
  { n: "07", titulo: "Publicar", detalle: "Tu link queda activo y listo para compartir." },
] as const;

/**
 * La ficha de una celebración: sus datos básicos (editables), su
 * dirección y lo que sigue. RLS decide si la persona puede verla; si no
 * es suya o no existe, 404.
 */
export default async function FichaCelebracion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const [{ id }, { nueva }] = await Promise.all([params, searchParams]);
  const c = await celebracionPorId(id);
  if (!c) notFound();
  const inv = await invitacionDe(c.id);

  const tipo = tipoCelebracion(c.tipo);
  const Icono = ICONO_TIPO[c.tipo];
  const urlPublica = urlPublicaCelebrar(`/${c.slug}`);
  const base = sitioCelebrar().replace(/^https?:\/\//, "");
  const archivada = c.estado === "archivada";

  return (
    <div className="grid gap-8">
      <nav aria-label="Migas" className="text-[13px] text-(--c-tinta-suave)">
        <EnlaceCelebrar a={RUTA.appCelebraciones} className="c-enlace">
          Mis celebraciones
        </EnlaceCelebrar>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-(--c-tinta)">{c.nombre}</span>
      </nav>

      {nueva === "1" && (
        <p role="status" className="rounded-xl bg-(--c-ok-suave) px-4 py-3 text-[14px] leading-relaxed text-(--c-ok)">
          Tu celebración quedó creada como borrador. Ya tiene su dirección; el diseño y las
          funciones vienen en los pasos siguientes.
        </p>
      )}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="c-disco h-12 w-12 rounded-[14px]">
            <Icono className="h-6 w-6" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">
                {tipo?.nombre ?? c.tipo}
              </span>
              <PastillaEstado estado={c.estado} />
            </div>
            <h1 className="mt-1 text-[clamp(1.6rem,2.6vw,2.1rem)] leading-[1.15] text-(--c-tinta)">{c.nombre}</h1>
            <p className="mt-1 text-[15px] text-(--c-tinta-suave)">
              {c.fecha ? fechaLargaCR(c.fecha) : "Sin fecha todavía"}
              {c.hora ? `, ${c.hora.slice(0, 5)}` : ""}
              {c.lugar_nombre ? ` · ${c.lugar_nombre}` : ""}
            </p>
          </div>
        </div>
        <form action={cambiarEstadoCelebracion.bind(null, c.id, archivada ? "borrador" : "archivada")}>
          <button type="submit" className="c-boton c-boton-secundario">
            {archivada ? "Restaurar" : "Archivar"}
          </button>
        </form>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-start">
        <TarjetaPanel>
          <h2 className="text-xl leading-tight text-(--c-tinta)">Datos básicos</h2>
          <p className="mt-1 text-[14px] text-(--c-tinta-suave)">
            Lo que aparece en la invitación. Se puede cambiar cuando quieras, incluso publicada.
          </p>
          <div className="mt-6">
            <EditarBasicos c={c} base={base} />
          </div>
        </TarjetaPanel>

        <div className="grid gap-6">
          <TarjetaPanel tono="marina" className="scroll-mt-24" >
            <h2 id="compartir" className="text-xl leading-tight text-(--c-blanco)">Tu dirección</h2>
            <p className="mt-1 text-[14px] text-(--c-sobre-marino-suave)">
              La que vas a compartir por WhatsApp y a imprimir como QR.
            </p>
            <p className="c-montserrat mt-4 break-all rounded-xl bg-(--c-marino-medio) px-4 py-3 text-[14px] font-semibold text-(--c-blanco)">
              {urlPublica.replace(/^https?:\/\//, "")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <BotonCopiar texto={urlPublica} etiqueta="Copiar dirección" className="c-boton c-boton-claro" />
              {c.estado === "publicada" ? (
                <a href={urlPublica} target="_blank" rel="noopener noreferrer" className="text-[13px] text-(--c-blanco) underline underline-offset-4">
                  Abrir la invitación
                </a>
              ) : (
                <span className="text-[13px] text-(--c-sobre-marino-suave)">Se activa al publicar desde el editor.</span>
              )}
            </div>
          </TarjetaPanel>

          <TarjetaPanel id="invitacion" className="scroll-mt-24">
            <h2 className="text-xl leading-tight text-(--c-tinta)">La invitación</h2>
            {inv ? (
              <>
                <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">
                  Diseño {inv.plantilla_slug ? "a partir de una plantilla" : "creado con IA"}, guardado por última vez el{" "}
                  {new Date(inv.updated_at).toLocaleDateString("es-CR", { day: "numeric", month: "long" })}.
                  {c.estado === "publicada" ? " Está publicada: el link ya funciona." : " Todavía no está publicada."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <EnlaceCelebrar a={rutaEditor(c.id)} className="c-boton c-boton-primario">
                    Abrir el editor
                  </EnlaceCelebrar>
                  <EnlaceCelebrar a={`${rutaEditor(c.id)}/previa`} className="c-boton c-boton-secundario">
                    Vista previa
                  </EnlaceCelebrar>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">
                  El siguiente paso es elegir el diseño: 40 plantillas para {tipo?.plural.toLowerCase() ?? "tu celebración"} que
                  se editan en vivo, o crearlo desde cero con IA.
                </p>
                <div className="mt-5">
                  <EnlaceCelebrar a={rutaEditor(c.id)} className="c-boton c-boton-primario">
                    Elegir diseño
                  </EnlaceCelebrar>
                </div>
              </>
            )}
            {inv && (
              <div className="mt-5">
                <AyudaDiseno celebracionId={c.id} />
              </div>
            )}
            <ol className="mt-6 grid gap-3 border-t border-(--c-linea) pt-5">
              {PASOS_SIGUIENTES.map((p) => (
                <li key={p.n} className="grid grid-cols-[2.25rem_1fr] gap-3">
                  <span className="c-montserrat text-lg font-extrabold text-(--c-linea)" aria-hidden="true">
                    {p.n}
                  </span>
                  <div>
                    <p className="c-montserrat text-[14px] font-semibold text-(--c-tinta)">{p.titulo}</p>
                    <p className="text-[13px] leading-relaxed text-(--c-tinta-suave)">{p.detalle}</p>
                  </div>
                </li>
              ))}
            </ol>
          </TarjetaPanel>
        </div>
      </div>
    </div>
  );
}
