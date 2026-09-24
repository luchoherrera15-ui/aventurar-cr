import type { Metadata } from "next";
import MiniaturaPlantilla from "@/components/celebrar/editor/miniatura-plantilla";
import { EncabezadoPanel, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { PAQUETES_PARTNER, VALOR_CREDITO_CRC, precioPaquetePartner } from "@/lib/celebrar/creditos";
import { misCelebraciones } from "@/lib/celebrar/datos";
import { TIPOS_PARTNER, miPartner, misPlantillasPartner, nombreTipoPartner, type Partner } from "@/lib/celebrar/partners";
import { BENEFICIOS_PARTNER } from "@/lib/celebrar/partners-beneficios";
import { RUTA } from "@/lib/celebrar/rutas";
import { fechaLargaCR } from "@/lib/fechas";
import { actualizarFichaPartner, aplicarComoPartner, borrarPlantillaPartner, usarPlantillaPartnerYEditar } from "./acciones";

export const metadata: Metadata = { title: "Partners" };


type Busqueda = { aviso?: string };

export default async function PartnerPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const q = await searchParams;
  const partner = await miPartner();

  return (
    <div className="grid gap-8">
      {q.aviso && (
        <p role="status" className="rounded-2xl border border-(--c-linea) bg-(--c-blanco) px-5 py-4 text-[14px] text-(--c-tinta)">
          {q.aviso}
        </p>
      )}
      {!partner ? <Aplicar /> : partner.estado === "aprobado" ? <PanelPartner partner={partner} /> : <EstadoSolicitud partner={partner} />}
    </div>
  );
}

/* ── Sin ficha: el programa y el formulario ─────────────────────── */

function Aplicar() {
  return (
    <>
      <EncabezadoPanel
        titulo="Programa de partners"
        descripcion="Para planners, agencias, fotógrafos, salones y quienes ya organizan celebraciones: hacé las invitaciones de tus clientes con CELEBRAR, cobrales vos y pagá precio mayorista."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BENEFICIOS_PARTNER.map((b, i) => (
          <li key={b.titulo}>
            <TarjetaPanel className="h-full">
              <p className="c-montserrat text-[12px] font-bold text-(--c-azul)">0{i + 1}</p>
              <h2 className="mt-1 text-lg leading-tight text-(--c-tinta)">{b.titulo}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-(--c-tinta-suave)">{b.texto}</p>
            </TarjetaPanel>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-start">
        <TarjetaPanel>
          <h2 className="text-xl leading-tight text-(--c-tinta)">Aplicar al programa</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">Contanos de tu negocio. Revisamos cada solicitud a mano y te respondemos en menos de 48 horas.</p>
          <form action={aplicarComoPartner} className="mt-5 grid gap-4">
            <CamposFicha />
            <button type="submit" className="c-boton c-boton-primario min-h-11">
              Enviar solicitud
            </button>
            <p className="text-[12px] leading-relaxed text-(--c-tinta-suave)">Mientras tanto podés seguir creando invitaciones como cualquier cuenta: al aprobarte, todo lo que ya hiciste queda con los beneficios.</p>
          </form>
        </TarjetaPanel>
        <TarjetaPanel tono="marina">
          <p className="c-montserrat text-[12px] font-semibold uppercase tracking-[0.1em] text-(--c-sobre-marino-suave)">Cómo funciona la plata</p>
          <ol className="mt-4 grid gap-3 text-[14px] leading-relaxed text-(--c-blanco)">
            <li>
              <strong>1.</strong> Comprás créditos en paquetes mayoristas: 1 crédito = ₡{VALOR_CREDITO_CRC} menos tu descuento.
            </li>
            <li>
              <strong>2.</strong> Publicás cada invitación al mismo costo en créditos que todo el mundo (80 con WhatsApp, 120 con panel de invitados).
            </li>
            <li>
              <strong>3.</strong> Le cobrás a tu cliente por tu servicio de diseño. Lo que le cobrás es tuyo; CELEBRAR no toca esa parte.
            </li>
          </ol>
          <div className="mt-5 grid gap-2 border-t border-(--c-blanco)/15 pt-4 text-[13px]">
            {PAQUETES_PARTNER.map((p) => (
              <div key={p.id} className="flex justify-between gap-3">
                <span className="text-(--c-sobre-marino-suave)">{p.creditos.toLocaleString("es-CR")} créditos · {p.nota}</span>
                <span className="c-montserrat shrink-0 font-semibold text-(--c-blanco)">₡{precioPaquetePartner(p.creditos, 20).toLocaleString("es-CR")}</span>
              </div>
            ))}
            <p className="mt-1 text-[12px] text-(--c-sobre-marino-suave)">Precios con el 20 % de descuento inicial. Ejemplo: una invitación con panel te cuesta ₡4 800 y la podés vender en ₡15 000–25 000 con tu diseño.</p>
          </div>
        </TarjetaPanel>
      </div>
    </>
  );
}

function CamposFicha({ p }: { p?: Partner }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
          Nombre de tu negocio
          <input name="nombre_comercial" required minLength={2} maxLength={80} defaultValue={p?.nombre_comercial ?? ""} className="c-campo" placeholder="Eventos Luna" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
          Qué hacés
          <select name="tipo" defaultValue={p?.tipo ?? "planner"} className="c-campo">
            {TIPOS_PARTNER.map(([id, t]) => (
              <option key={id} value={id}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
          Ciudad
          <input name="ciudad" maxLength={80} defaultValue={p?.ciudad ?? ""} className="c-campo" placeholder="San José" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
          Eventos al año, aprox.
          <input name="eventos_por_anio" type="number" min={0} max={10000} defaultValue={p?.eventos_por_anio ?? ""} className="c-campo" placeholder="24" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
          Instagram
          <input name="instagram" maxLength={40} defaultValue={p?.instagram ?? ""} className="c-campo" placeholder="@eventosluna" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
          WhatsApp
          <input name="whatsapp" inputMode="tel" maxLength={20} defaultValue={p?.whatsapp ?? ""} className="c-campo" placeholder="8888 8888" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta) sm:col-span-2">
          Sitio web (opcional)
          <input name="sitio" inputMode="url" maxLength={200} defaultValue={p?.sitio ?? ""} className="c-campo" placeholder="https://eventosluna.cr" />
        </label>
      </div>
      <label className="grid gap-1.5 text-[13px] font-semibold text-(--c-tinta)">
        Contanos de tu negocio
        <textarea name="descripcion" rows={3} maxLength={600} defaultValue={p?.descripcion ?? ""} className="c-campo min-h-24" placeholder="Qué tipo de celebraciones organizás, desde cuándo, qué te gustaría ofrecerles a tus clientes." />
      </label>
      {p && (
        <div className="grid gap-2 rounded-xl bg-(--c-hielo) p-4 text-[14px]">
          <label className="flex items-center gap-3">
            <input type="hidden" name="marca_en_invitaciones" value="off" />
            <input type="checkbox" name="marca_en_invitaciones" value="on" defaultChecked={p.marca_en_invitaciones} className="h-4 w-4" />
            Firmar mis invitaciones («Diseñada por {p.nombre_comercial}»)
          </label>
          <label className="flex items-center gap-3">
            <input type="hidden" name="mostrar_en_directorio" value="off" />
            <input type="checkbox" name="mostrar_en_directorio" value="on" defaultChecked={p.mostrar_en_directorio} className="h-4 w-4" />
            Aparecer en el directorio público de partners
          </label>
        </div>
      )}
    </>
  );
}

/* ── Pendiente / rechazada / suspendida ─────────────────────────── */

function EstadoSolicitud({ partner }: { partner: Partner }) {
  const textos: Record<string, { titulo: string; texto: string }> = {
    pendiente: { titulo: "Solicitud en revisión", texto: "La recibimos y la estamos revisando. Te avisamos por correo en menos de 48 horas. Mientras, podés seguir creando invitaciones." },
    rechazado: { titulo: "Solicitud no aprobada", texto: "Por ahora no pudimos aprobar la solicitud. Si creés que hay un error o tu negocio cambió, escribinos y la volvemos a mirar." },
    suspendido: { titulo: "Cuenta de partner en pausa", texto: "Los beneficios del programa están en pausa. Escribinos para retomarlos." },
  };
  const t = textos[partner.estado] ?? textos.pendiente;
  return (
    <>
      <EncabezadoPanel titulo={t.titulo} descripcion={t.texto} />
      <TarjetaPanel>
        <h2 className="text-xl leading-tight text-(--c-tinta)">Tu ficha</h2>
        <p className="mt-1 text-[14px] text-(--c-tinta-suave)">
          {partner.nombre_comercial} · {nombreTipoPartner(partner.tipo)} · enviada el {fechaLargaCR(partner.created_at.slice(0, 10))}
        </p>
        <form action={actualizarFichaPartner} className="mt-5 grid gap-4">
          <CamposFicha p={partner} />
          <button type="submit" className="c-boton c-boton-secundario min-h-11 justify-self-start">
            Guardar cambios
          </button>
        </form>
      </TarjetaPanel>
    </>
  );
}

/* ── Aprobado: el panel del partner ─────────────────────────────── */

async function PanelPartner({ partner }: { partner: Partner }) {
  const [plantillas, celebraciones] = await Promise.all([misPlantillasPartner(), misCelebraciones()]);
  const activas = celebraciones.filter((c) => c.estado !== "archivada");
  return (
    <>
      <EncabezadoPanel
        titulo={partner.nombre_comercial}
        descripcion={`Partner de CELEBRAR desde ${partner.aprobado_en ? fechaLargaCR(partner.aprobado_en.slice(0, 10)) : "hoy"} · ${nombreTipoPartner(partner.tipo)} · ${partner.descuento_pct} % de descuento en créditos.`}
        accion={
          <EnlaceCelebrar a={RUTA.appCreditos} className="c-boton c-boton-primario">
            Comprar créditos mayoristas
          </EnlaceCelebrar>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaPanel tono="marina">
          <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.1em] text-(--c-sobre-marino-suave)">Tu precio por crédito</p>
          <p className="c-montserrat mt-2 text-3xl font-extrabold leading-none text-(--c-blanco)">₡{Math.round(VALOR_CREDITO_CRC * (1 - partner.descuento_pct / 100))}</p>
          <p className="mt-2 text-[12px] text-(--c-sobre-marino-suave)">en vez de ₡{VALOR_CREDITO_CRC} · una invitación con panel te cuesta ₡{(120 * VALOR_CREDITO_CRC * (1 - partner.descuento_pct / 100)).toLocaleString("es-CR")}</p>
        </TarjetaPanel>
        <TarjetaPanel>
          <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">Tu firma</p>
          <p className="c-montserrat mt-2 text-lg font-extrabold leading-tight text-(--c-tinta)">{partner.marca_en_invitaciones ? `Diseñada por ${partner.nombre_comercial}` : "Apagada"}</p>
          <p className="mt-2 text-[12px] text-(--c-tinta-suave)">{partner.marca_en_invitaciones ? "Al pie de cada invitación publicada, con tu link." : "Activala abajo, en tu ficha."}</p>
        </TarjetaPanel>
        <TarjetaPanel>
          <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">Celebraciones</p>
          <p className="c-montserrat mt-2 text-3xl font-extrabold leading-none text-(--c-tinta)">{activas.length}</p>
          <p className="mt-2 text-[12px] text-(--c-tinta-suave)">{celebraciones.filter((c) => c.estado === "publicada").length} publicadas · {plantillas.length} {plantillas.length === 1 ? "plantilla propia" : "plantillas propias"}</p>
        </TarjetaPanel>
      </div>

      <TarjetaPanel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl leading-tight text-(--c-tinta)">Plantillas de la casa</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">
              Desde el editor de cualquier invitación, «Guardar como plantilla». Después la usás en la celebración de tu próximo cliente y arrancás con tu estilo listo.
            </p>
          </div>
          <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-secundario min-h-10 text-[13px]">
            Nueva celebración
          </EnlaceCelebrar>
        </div>
        {plantillas.length === 0 ? (
          <p className="mt-5 rounded-xl bg-(--c-hielo) px-5 py-6 text-center text-[14px] text-(--c-tinta-suave)">Todavía no guardaste ninguna. Abrí una invitación en el editor y tocá «Guardar como plantilla».</p>
        ) : (
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {plantillas.map((p) => (
              <li key={p.id} className="grid gap-3 rounded-2xl border border-(--c-linea) p-3">
                <MiniaturaPlantilla
                  estilos={p.documento.estilo}
                  esquema={p.documento}
                  muestra={p.documento.secciones[0]?.tipo === "hero" ? p.documento.secciones[0].datos.titulo || p.nombre : p.nombre}
                  saludo=""
                />
                <div>
                  <p className="c-montserrat text-[14px] font-semibold text-(--c-tinta)">{p.nombre}</p>
                  <p className="text-[12px] text-(--c-tinta-suave)">Guardada el {fechaLargaCR(p.created_at.slice(0, 10))}</p>
                </div>
                {activas.length > 0 && (
                  <form action={usarPlantillaPartnerYEditar} className="grid gap-2">
                    <input type="hidden" name="plantilla" value={p.id} />
                    <select name="celebracion" className="c-campo min-h-10 text-[13px]" defaultValue={activas[0].id} aria-label="Usar en la celebración">
                      {activas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="c-boton c-boton-primario min-h-10 text-[13px]">
                      Usar en esa celebración
                    </button>
                  </form>
                )}
                <form action={borrarPlantillaPartner}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="c-boton c-boton-texto min-h-9 text-[12px] text-(--c-coral-tinta)">
                    Borrar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </TarjetaPanel>

      <TarjetaPanel>
        <h2 className="text-xl leading-tight text-(--c-tinta)">Tu ficha pública</h2>
        <p className="mt-1 text-[14px] text-(--c-tinta-suave)">Lo que ven tus clientes en la firma y en el directorio.</p>
        <form action={actualizarFichaPartner} className="mt-5 grid gap-4">
          <CamposFicha p={partner} />
          <button type="submit" className="c-boton c-boton-secundario min-h-11 justify-self-start">
            Guardar cambios
          </button>
        </form>
      </TarjetaPanel>
    </>
  );
}
