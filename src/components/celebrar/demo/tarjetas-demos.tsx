import { DEMOS, type DemoInvitacion } from "@/lib/celebrar/demos";
import { tipoCelebracion } from "@/lib/celebrar/marca";
import { RUTA, rutaDemo } from "@/lib/celebrar/rutas";
import { EnlaceCelebrar } from "../rutas-cliente";

const foto = (id: string, w = 1000) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/**
 * Las tarjetas de «Ver demos»: cada invitación de muestra con su foto,
 * más el álbum de la fiesta y el panel del anfitrión. Las usa la portada
 * (solo las destacadas) y la página /demos (todas).
 */
export default function TarjetasDemos({ soloDestacadas = false }: { soloDestacadas?: boolean }) {
  const lista = soloDestacadas ? DEMOS.filter((d) => d.destacada) : DEMOS;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lista.map((d) => (
        <li key={d.id}>
          <TarjetaInvitacion d={d} />
        </li>
      ))}
      <li>
        <TarjetaExtra
          a={RUTA.demoAlbum}
          foto={foto("1496337589254-7e19d01cec44")}
          kicker="Durante la fiesta"
          titulo="El álbum de la fiesta"
          texto="Un QR por mesa; los invitados suben sus fotos desde el teléfono y el álbum se arma solo."
          cta="Ver el álbum"
        />
      </li>
      <li>
        <TarjetaExtra
          a={RUTA.demoPanel}
          foto={foto("1556761175-5973dc0f32e7")}
          kicker="Para quien organiza"
          titulo="El panel del anfitrión"
          texto="Las confirmaciones en vivo, con las preguntas que configuraste, el Excel y tus créditos."
          cta="Ver el panel"
        />
      </li>
    </ul>
  );
}

function TarjetaInvitacion({ d }: { d: DemoInvitacion }) {
  const tipo = tipoCelebracion(d.tipo)?.nombre ?? d.tipo;
  const conMusica = !!d.documento.musica.url;
  return (
    <article className="c-tarjeta elevar flex h-full flex-col overflow-hidden">
      <EnlaceCelebrar a={rutaDemo(d.id)} className="relative block aspect-[4/3] overflow-hidden" aria-label={`Ver demo: ${d.etiqueta}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.portada} alt="" className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]" loading="lazy" />
        <span className="absolute left-3 top-3 c-montserrat rounded-full bg-(--c-blanco)/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-(--c-marino)">{tipo}</span>
        {conMusica && (
          <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-(--c-marino)/80 text-(--c-blanco)" title="Con música" aria-label="Con música">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 18V6l10-2v12" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6.5" cy="18" r="2.5" />
              <circle cx="16.5" cy="16" r="2.5" />
            </svg>
          </span>
        )}
      </EnlaceCelebrar>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg leading-tight text-(--c-tinta)">{d.etiqueta}</h3>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">{d.descripcion}</p>
        <EnlaceCelebrar a={rutaDemo(d.id)} className="c-boton c-boton-secundario mt-4 min-h-10 w-full text-[13px]">
          Ver demo
        </EnlaceCelebrar>
      </div>
    </article>
  );
}

function TarjetaExtra({ a, foto, kicker, titulo, texto, cta }: { a: string; foto: string; kicker: string; titulo: string; texto: string; cta: string }) {
  return (
    <article className="c-tarjeta elevar flex h-full flex-col overflow-hidden bg-(--c-marino) text-(--c-blanco)">
      <EnlaceCelebrar a={a} className="relative block aspect-[4/3] overflow-hidden" aria-label={`${cta}: ${titulo}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto} alt="" className="h-full w-full object-cover opacity-80 transition-transform duration-500 hover:scale-[1.04]" loading="lazy" />
        <span className="absolute left-3 top-3 c-montserrat rounded-full bg-(--c-blanco)/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-(--c-marino)">{kicker}</span>
      </EnlaceCelebrar>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg leading-tight">{titulo}</h3>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">{texto}</p>
        <EnlaceCelebrar a={a} className="c-boton c-boton-claro mt-4 min-h-10 w-full text-[13px]">
          {cta}
        </EnlaceCelebrar>
      </div>
    </article>
  );
}
