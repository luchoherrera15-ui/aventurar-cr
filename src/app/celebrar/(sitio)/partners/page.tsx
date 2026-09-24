import type { Metadata } from "next";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { PAQUETES_PARTNER, PRECIOS, VALOR_CREDITO_CRC, precioPaquetePartner } from "@/lib/celebrar/creditos";
import { urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { directorioPartners, nombreTipoPartner, urlDePartner } from "@/lib/celebrar/partners";
import { BENEFICIOS_PARTNER } from "@/lib/celebrar/partners-beneficios";
import { RUTA } from "@/lib/celebrar/rutas";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Para planners, agencias, fotógrafos y salones: hacé las invitaciones digitales de tus clientes con CELEBRAR a precio mayorista, con tu firma en cada una.",
  alternates: { canonical: urlPublicaCelebrar(RUTA.partners) },
};

/**
 * La landing del programa de partners y el directorio público de los
 * aprobados. Los beneficios salen de partners-beneficios.ts (el mismo
 * texto que ve la persona al aplicar desde su panel).
 */
export default async function PartnersPublica() {
  const directorio = await directorioPartners();
  const precioPanel = Math.round(PRECIOS.publicar * VALOR_CREDITO_CRC * 0.8);

  return (
    <>
      <section className="bg-(--c-marino) py-16 text-(--c-blanco) lg:py-24">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8">
          <div>
            <p className="c-pastilla">Programa de partners</p>
            <h1 className="mt-4 max-w-3xl text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">
              Vos organizás la celebración. La invitación la hacés con nosotros y la cobrás vos.
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-(--c-sobre-marino-suave)">
              Para planners, agencias, fotógrafos, salones y quienes ya trabajan con celebraciones: créditos a precio mayorista,
              tu firma al pie de cada invitación, tus plantillas de la casa y un panel para todos tus clientes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <EnlaceCelebrar a={RUTA.appPartner} className="c-boton c-boton-claro">
                Aplicar al programa
              </EnlaceCelebrar>
              <EnlaceCelebrar a={RUTA.plantillas} className="c-boton c-boton-fantasma">
                Ver las plantillas
              </EnlaceCelebrar>
            </div>
          </div>
          <div className="rounded-3xl border border-(--c-blanco)/15 bg-(--c-marino-medio) p-7">
            <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-sobre-marino-suave)">La cuenta, en corto</p>
            <ul className="mt-4 grid gap-3 text-[15px] leading-relaxed">
              <li>
                <strong>Una invitación</strong> (que al público le cuesta ₡{(PRECIOS.publicar * VALOR_CREDITO_CRC).toLocaleString("es-CR")}) te cuesta <strong>₡{precioPanel.toLocaleString("es-CR")}</strong> en créditos mayoristas (20 % de descuento inicial).
              </li>
              <li>
                <strong>Vos decidís tu precio</strong>: ₡15 000, ₡25 000, lo que valga tu diseño y tu servicio. CELEBRAR no toca esa parte.
              </li>
              <li>
                <strong>Tu firma</strong> —«Diseñada por tu marca», con tu link— llega a cada invitado. Publicidad que trabaja por vos.
              </li>
            </ul>
            <div className="mt-5 grid gap-2 border-t border-(--c-blanco)/15 pt-4 text-[13px]">
              {PAQUETES_PARTNER.map((p) => (
                <div key={p.id} className="flex justify-between gap-3">
                  <span className="text-(--c-sobre-marino-suave)">{p.creditos.toLocaleString("es-CR")} créditos · {p.nota}</span>
                  <span className="c-montserrat shrink-0 font-semibold">₡{precioPaquetePartner(p.creditos, 20).toLocaleString("es-CR")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-(--c-tinta)">Lo que recibe un partner</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS_PARTNER.map((b, i) => (
            <li key={b.titulo} className="c-tarjeta p-6">
              <p className="c-montserrat text-[12px] font-bold text-(--c-azul)">0{i + 1}</p>
              <h3 className="mt-1 text-xl leading-tight text-(--c-tinta)">{b.titulo}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-(--c-tinta-suave)">{b.texto}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <EnlaceCelebrar a={RUTA.appPartner} className="c-boton c-boton-primario">
            Aplicar al programa
          </EnlaceCelebrar>
          <p className="text-[14px] text-(--c-tinta-suave)">Revisamos cada solicitud a mano y respondemos en menos de 48 horas.</p>
        </div>
      </section>

      {directorio.length > 0 && (
        <section className="bg-(--c-hielo) py-14 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="c-pastilla">Directorio</p>
            <h2 className="mt-4 text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-(--c-tinta)">Profesionales que trabajan con CELEBRAR</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {directorio.map((p) => {
                const url = urlDePartner(p);
                return (
                  <li key={p.slug ?? p.nombre_comercial} className="c-tarjeta flex gap-4 p-5">
                    {p.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                    ) : (
                      <span className="c-montserrat flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--c-marino) text-lg font-bold text-(--c-blanco)" aria-hidden="true">
                        {p.nombre_comercial.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg leading-tight text-(--c-tinta)">{p.nombre_comercial}</h3>
                      <p className="mt-0.5 text-[13px] text-(--c-tinta-suave)">
                        {nombreTipoPartner(p.tipo)}
                        {p.ciudad ? ` · ${p.ciudad}` : ""}
                      </p>
                      {p.descripcion && <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-(--c-tinta-suave)">{p.descripcion}</p>}
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="c-montserrat mt-3 inline-block text-[13px] font-semibold text-(--c-azul) underline underline-offset-4">
                          {p.sitio ? "Ver sitio" : p.instagram ? `@${p.instagram}` : "Escribir por WhatsApp"}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
