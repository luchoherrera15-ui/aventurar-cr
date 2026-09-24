import Link from "next/link";
import type { ReactNode } from "react";
import { IconClipboard, IconCloche, IconEnlace, IconInstagram, IconWallet } from "@/components/icons";
import { ADDON, type AddonId, type EstadoAddons } from "@/lib/solutions/addons";
import { PLAN_LINKSY, esPro } from "@/lib/solutions/planes";
import { esDeComida, vocabDe } from "@/lib/solutions/rubros";
import type { NegocioSolutions } from "@/lib/solutions/tipos";
import AddonToggle from "./addon-toggle";
import BotonCopiar from "./boton-copiar";
import {
  LP_BAJADA,
  LP_BOTON,
  LP_BOTON_CHICO,
  LP_BOTON_CHICO_SUAVE,
  LP_BOTON_CHICO_VELO,
  LP_BOTON_LIMA,
  LP_BOTON_SUAVE,
  LP_CIFRA,
  LP_DETALLE,
  LP_DISCO,
  LP_EYEBROW,
  LP_PILDORA_LIMA,
  LP_PILDORA_PAPEL,
  LP_PILDORA_VELO,
  LP_ROTULO_CIFRA,
  LP_TILE,
  LP_TILE_BLANCA,
  LP_TITULO,
  LP_TITULO_TILE,
  bloque,
  type Bloque,
} from "./sistema-linksy";

/**
 * ════════════════════════════════════════════════════════════════════
 *  INICIO — el tablero del panel de Linksy, en tiles grandes
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026): «un panel cien por ciento amigable:
 * al entrar, ver qué tenemos agregado como add-ons —si tenemos lo de
 * Instagram—, qué está activo, nuestro plan, cuánto estamos pagando;
 * figuras grandes, textos grandes, como Linksy».
 *
 * ── EL ORDEN ES EL DE LAS PREGUNTAS QUE SE HACE EL DUEÑO ───────────
 *   1. ¿Cuál es mi link y está publicado?   → la tile celeste, con el
 *      enlace para copiar y los dos botones que más se tocan.
 *   2. ¿Cómo va?                            → las cifras, grandes.
 *   3. ¿Qué plan tengo y cuánto pago?       → la tile carbón: el total
 *      del mes, qué está incluido, el paquete de Lealtad si lo hay.
 *      Y al lado, qué falta para terminar el sitio.
 *   4. ¿Qué tengo prendido y qué puedo sumar? → una tile por add-on,
 *      con su color, su estado y su botón. Instagram entra acá aunque
 *      no sea un add-on de pago: es algo que «se tiene» o no.
 *
 * Los add-ons se prenden y apagan con el mismo `AddonToggle` de antes
 * (misma action, misma regla): cambió la ropa, no el mecanismo.
 */

type Paso = { clave: string; titulo: string; detalle: string; listo: boolean; href: string; accion: string };

export type ResumenInstagram = {
  /** Las variables META_* están en el servidor. */
  configurado: boolean;
  conectado: boolean;
  usuario: string | null;
  automatizaciones: number;
};

export type ResumenLealtad = {
  tarjetas: number;
  clientes: number | null;
  listos: number | null;
  /** El paquete de Lealtad de la cuenta y su precio, si hay tarjeta. */
  plan: string | null;
  precioMes: number | null;
};

export default function SeccionInicio({
  negocio,
  urlPublica,
  totalLinks,
  totalPlatos,
  totalSecciones,
  comandasHoy,
  tieneLealtad,
  addons,
  puedeEditar,
  esDueno,
  instagram,
  lealtad,
}: {
  negocio: NegocioSolutions;
  urlPublica: string;
  totalLinks: number;
  totalPlatos: number;
  totalSecciones: number;
  comandasHoy: number;
  /** Por cuenta, no por negocio: Lealtad vive sobre `ranchos`. */
  tieneLealtad: boolean;
  addons: EstadoAddons;
  puedeEditar: boolean;
  esDueno: boolean;
  instagram: ResumenInstagram;
  lealtad: ResumenLealtad;
}) {
  const base = `/solutions/panel/${negocio.id}`;
  const lealtadActiva = addons.lealtad || tieneLealtad;
  const vocab = vocabDe(negocio.rubro);
  const comida = esDeComida(negocio.rubro);
  const linkCorto = urlPublica.replace(/^https?:\/\//, "");

  // ── Los pasos para terminar el sitio ──────────────────────────────
  const pasos: Paso[] = [
    { clave: "marca", titulo: "Ponele tu marca", detalle: "Logo, portada, fuente y colores.", listo: Boolean(negocio.logo_url || negocio.foto_portada_url), href: `${base}?tab=diseno`, accion: "Elegir el diseño" },
    { clave: "links", titulo: "Agregá tus enlaces", detalle: "Instagram, reservas, cómo llegar.", listo: totalLinks > 0, href: `${base}?tab=enlaces`, accion: "Agregar" },
    { clave: "contacto", titulo: "Dejá tu contacto", detalle: "WhatsApp y dirección.", listo: Boolean(negocio.whatsapp || negocio.direccion), href: `${base}?tab=ajustes`, accion: "Completar" },
  ];
  if (addons.menu) pasos.push({ clave: "menu", titulo: vocab.cargar, detalle: vocab.cargarDetalle, listo: totalPlatos > 0, href: `${base}?tab=menu`, accion: `Agregar ${vocab.items}` });
  if (addons.pedidos) {
    pasos.push({ clave: "pedidos", titulo: vocab.decidir, detalle: vocab.decidirDetalle, listo: negocio.acepta_pedidos || negocio.pedidos_llevar || negocio.pedidos_express, href: `${base}?tab=ajustes`, accion: "Configurar" });
    if (comida && negocio.acepta_pedidos) pasos.push({ clave: "mesas", titulo: "Imprimí tus QR de mesa", detalle: "Uno por mesa.", listo: negocio.mesas > 0, href: `${base}/mesas`, accion: "Generar" });
  }
  const hechos = pasos.filter((p) => p.listo).length;
  const avance = Math.round((hechos / pasos.length) * 100);
  const faltan = pasos.filter((p) => !p.listo);

  // ── Las cifras: solo las que tienen algo detrás ───────────────────
  const cifras: { r: string; v: string; d: string; href?: string }[] = [{ r: "Enlaces visibles", v: String(totalLinks), d: "en tu página", href: `${base}?tab=enlaces` }];
  if (addons.menu) cifras.push({ r: `${vocab.Items} en tu ${vocab.catalogo.toLowerCase()}`, v: String(totalPlatos), d: `${totalSecciones || 1} secciones`, href: `${base}?tab=menu` });
  if (addons.pedidos) cifras.push({ r: "Pedidos hoy", v: String(comandasHoy), d: "en tu tablero", href: `${base}/restaurante` });
  if (lealtad.clientes !== null) cifras.push({ r: "Clientes con tarjeta", v: String(lealtad.clientes), d: lealtad.listos ? `${lealtad.listos} listos para su premio` : "en tu programa de lealtad", href: esDueno ? `${base}/lealtad` : undefined });
  if (instagram.conectado) cifras.push({ r: "Automatizaciones de Instagram", v: String(instagram.automatizaciones), d: `@${instagram.usuario}`, href: `${base}/instagram` });

  // ── El plan: qué está prendido y cuánto suma por mes ──────────────
  const prendidos = (["menu", "pedidos", "lealtad"] as AddonId[]).filter((a) => (a === "lealtad" ? lealtadActiva : addons[a]));
  const planLinksy = PLAN_LINKSY[negocio.plan];
  const pro = esPro(negocio.plan);
  const totalMes = planLinksy.precioMes + prendidos.reduce((s, a) => s + ADDON[a].precioMes, 0) + (lealtad.precioMes ?? 0);
  const precioDe = (id: AddonId) => (ADDON[id].incluido ? "Gratis" : ADDON[id].precioMes === 0 ? "Gratis · en prueba" : `US$${ADDON[id].precioMes}/mes`);

  // ── Qué dice cada add-on debajo del nombre ────────────────────────
  const detalleDe = (id: AddonId): string => {
    if (id === "linkhub") return linkCorto;
    if (id === "menu") return addons.menu ? (totalPlatos > 0 ? `${totalPlatos} ${vocab.items} en ${totalSecciones || 1} secciones` : `Sin ${vocab.items} todavía`) : vocab.cargarDetalle;
    if (id === "pedidos") {
      if (!addons.pedidos) return vocab.pedidosPie;
      const modos = [comida && negocio.acepta_pedidos && `mesa (${negocio.mesas})`, negocio.pedidos_llevar && vocab.modalidades.llevar.rotulo.toLowerCase(), negocio.pedidos_express && vocab.modalidades.express.rotulo.toLowerCase()].filter(Boolean);
      return modos.length > 0 ? `${modos.join(" · ")} · sin comisión` : "Sin modalidad elegida todavía";
    }
    if (lealtadActiva) return lealtad.tarjetas > 0 ? `${lealtad.tarjetas === 1 ? "Tu tarjeta" : `${lealtad.tarjetas} tarjetas`} · ${lealtad.clientes ?? 0} clientes` : "Ya tenés cuenta en Lealtad: armá tu tarjeta";
    return ADDON.lealtad.pie;
  };
  const nombreDe = (id: AddonId) => (id === "menu" ? vocab.catalogoLargo : id === "pedidos" ? vocab.pedidosNombre : ADDON[id].nombre);
  const incluyeDe = (id: AddonId): string[] => (id === "menu" ? vocab.catalogoIncluye : id === "pedidos" ? vocab.pedidosIncluye : ADDON[id].incluye);

  const tiles: { id: string; bloque: Bloque; icono: ReactNode; nombre: string; estado: ReactNode; detalle: string; incluye?: string[]; acciones: ReactNode }[] = [
    {
      id: "linkhub",
      bloque: "celeste",
      icono: <IconEnlace />,
      nombre: "Link hub",
      estado: <span className={LP_PILDORA_PAPEL}>Incluido · gratis</span>,
      detalle: detalleDe("linkhub"),
      acciones: puedeEditar ? <Link href={`${base}?tab=diseno`} className={LP_BOTON_CHICO}>Editar mi página →</Link> : null,
    },
    {
      id: "menu",
      bloque: "menta",
      icono: <IconCloche />,
      nombre: nombreDe("menu"),
      estado: <span className={addons.menu ? LP_PILDORA_PAPEL : LP_PILDORA_VELO}>{addons.menu ? "Activo" : "Apagado"} · {precioDe("menu")}</span>,
      detalle: detalleDe("menu"),
      incluye: addons.menu ? undefined : incluyeDe("menu"),
      acciones: (
        <>
          {addons.menu && puedeEditar && <Link href={`${base}?tab=menu`} className={LP_BOTON_CHICO}>Abrir →</Link>}
          <AddonToggle negocioId={negocio.id} addon="menu" activo={addons.menu} incluido={false} puedeEditar={puedeEditar} />
        </>
      ),
    },
    {
      id: "pedidos",
      bloque: "coral",
      icono: <IconClipboard />,
      nombre: nombreDe("pedidos"),
      estado: <span className={addons.pedidos ? LP_PILDORA_PAPEL : LP_PILDORA_VELO}>{addons.pedidos ? "Activo" : "Apagado"} · {precioDe("pedidos")}</span>,
      detalle: detalleDe("pedidos"),
      incluye: addons.pedidos ? undefined : incluyeDe("pedidos"),
      acciones: (
        <>
          {addons.pedidos && <Link href={`${base}/restaurante`} className={LP_BOTON_CHICO}>Ver pedidos →</Link>}
          {addons.pedidos && comida && negocio.acepta_pedidos && puedeEditar && <Link href={`${base}/mesas`} className={LP_BOTON_CHICO_VELO}>QR de mesas</Link>}
          <AddonToggle negocioId={negocio.id} addon="pedidos" activo={addons.pedidos} incluido={false} puedeEditar={puedeEditar} />
        </>
      ),
    },
    {
      id: "lealtad",
      bloque: "lila",
      icono: <IconWallet />,
      nombre: "Tarjeta de lealtad",
      estado: <span className={lealtadActiva ? LP_PILDORA_PAPEL : LP_PILDORA_VELO}>{lealtadActiva ? (lealtad.plan ? `Plan ${lealtad.plan}` : "Activo") : "Apagado"} · {lealtad.precioMes ? `US$${lealtad.precioMes}/mes` : precioDe("lealtad")}</span>,
      detalle: detalleDe("lealtad"),
      incluye: lealtadActiva ? undefined : incluyeDe("lealtad"),
      acciones: (
        <>
          {lealtadActiva && esDueno && <Link href={`${base}/lealtad`} className={LP_BOTON_CHICO}>{lealtad.tarjetas > 0 ? "Escanear y ver clientes →" : "Armar mi tarjeta →"}</Link>}
          <AddonToggle negocioId={negocio.id} addon="lealtad" activo={lealtadActiva} incluido={false} externoHref={lealtadActiva ? "/lealtad/panel" : ADDON.lealtad.externo?.href} puedeEditar={puedeEditar} />
        </>
      ),
    },
    {
      id: "instagram",
      bloque: "amarillo",
      icono: <IconInstagram />,
      nombre: "Instagram Auto Reply",
      estado: <span className={instagram.conectado ? LP_PILDORA_PAPEL : LP_PILDORA_VELO}>{instagram.conectado ? `Conectado · @${instagram.usuario}` : instagram.configurado ? "Sin conectar · gratis" : "Muy pronto"}</span>,
      detalle: instagram.conectado ? `${instagram.automatizaciones} ${instagram.automatizaciones === 1 ? "automatización" : "automatizaciones"} · comentan una palabra y reciben tu DM` : "Comentan una palabra clave en tu post y reciben tu enlace por DM, solo.",
      incluye: instagram.conectado ? undefined : ["Palabra clave por publicación", "DM automático con tu enlace", "Respuesta pública opcional"],
      acciones: puedeEditar ? <Link href={`${base}/instagram`} className={instagram.conectado ? LP_BOTON_CHICO : LP_BOTON_CHICO_VELO}>{instagram.conectado ? "Ver automatizaciones →" : "Conectar Instagram →"}</Link> : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1 · TU LINK ─────────────────────────────────────────── */}
      <section className={`${LP_TILE} grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end`} style={bloque("celeste")}>
        <div className="min-w-0">
          <p className={LP_EYEBROW}>Tu página</p>
          <h1 className={`mt-3 ${LP_TITULO}`}>{negocio.nombre}</h1>
          <p className={`mt-3 max-w-[52ch] ${LP_BAJADA}`}>{negocio.bajada || "Tu WhatsApp, tus redes, tu catálogo y tu tarjeta de lealtad, en un solo link."}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex min-h-[48px] max-w-full items-center truncate rounded-full bg-[var(--linksy-papel)] px-5 text-[15.5px] font-extrabold text-[var(--linksy-tinta)]">{linkCorto}</span>
            <BotonCopiar texto={urlPublica} className={LP_BOTON_CHICO_SUAVE} />
            <span className={negocio.publicado ? LP_PILDORA_LIMA : LP_PILDORA_VELO}>{negocio.publicado ? "Publicada" : "Apagada"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 lg:flex-col lg:items-stretch">
          <a href={urlPublica} target="_blank" rel="noopener noreferrer" className={LP_BOTON}>
            Ver mi página →
          </a>
          {puedeEditar && (
            <Link href={`${base}?tab=diseno`} className={LP_BOTON_SUAVE}>
              Editar mi página
            </Link>
          )}
        </div>
      </section>

      {/* ── 2 · CÓMO VA ─────────────────────────────────────────── */}
      <div className={`grid gap-4 grid-cols-2 ${cifras.length >= 4 ? "xl:grid-cols-4" : cifras.length === 3 ? "xl:grid-cols-3" : ""}`}>
        {cifras.map((c) => {
          const cuerpo = (
            <>
              <p className={LP_ROTULO_CIFRA}>{c.r}</p>
              <p className={`mt-3 ${LP_CIFRA}`}>{c.v}</p>
              <p className={`mt-1.5 ${LP_DETALLE}`}>{c.d}</p>
            </>
          );
          return c.href ? (
            <Link key={c.r} href={c.href} className={`${LP_TILE_BLANCA} presionable transition-shadow hover:shadow-elevado`}>
              {cuerpo}
            </Link>
          ) : (
            <div key={c.r} className={LP_TILE_BLANCA}>
              {cuerpo}
            </div>
          );
        })}
      </div>

      {/* ── 3 · TU PLAN Y LO QUE FALTA ──────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${LP_TILE} flex flex-col`} style={bloque("carbon")}>
          <p className={LP_EYEBROW}>Tu plan</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={LP_CIFRA}>Linksy {planLinksy.nombre}</span>
            <span className="text-[15px] font-extrabold opacity-70">
              {totalMes === 0 ? "US$0" : `US$${totalMes}`} / mes
            </span>
          </div>
          <p className={`mt-3 max-w-[46ch] ${LP_BAJADA}`}>
            {pro ? "Tenés toda la personalización: temas, fuentes, efectos, fondos, encabezados y tu propio dominio." : "Tu link hub, gratis. Con Pro se abren los trece temas, las fuentes, los efectos, los fondos animados y tu dominio."}
          </p>
          <ul className="mt-5 flex flex-col gap-2">
            <li className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-[14px] font-bold">
              <span>Linksy {planLinksy.nombre}</span>
              <span className={LP_PILDORA_LIMA}>{planLinksy.precioMes === 0 ? "Gratis" : `US$${planLinksy.precioMes}/mes`}</span>
            </li>
            {prendidos.map((a) => (
              <li key={a} className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-[14px] font-bold">
                <span>{nombreDe(a)}</span>
                <span className={LP_PILDORA_VELO} style={{ background: "rgba(255,255,255,.14)" }}>
                  {a === "lealtad" && lealtad.plan ? `${lealtad.plan} · ${lealtad.precioMes ? `US$${lealtad.precioMes}/mes` : "gratis"}` : precioDe(a)}
                </span>
              </li>
            ))}
            {instagram.conectado && (
              <li className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-[14px] font-bold">
                <span>Instagram Auto Reply</span>
                <span className={LP_PILDORA_VELO} style={{ background: "rgba(255,255,255,.14)" }}>
                  Gratis
                </span>
              </li>
            )}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {esDueno && (
              <Link href={`${base}/plan`} className={LP_BOTON_LIMA}>
                {pro ? "Ver mi plan →" : "Pasar a Pro →"}
              </Link>
            )}
            {lealtadActiva && esDueno && (
              <Link href="/lealtad/planes" className={LP_BOTON_CHICO_VELO} style={{ background: "rgba(255,255,255,.14)" }}>
                Planes de lealtad
              </Link>
            )}
          </div>
        </section>

        <section className={`${LP_TILE} flex flex-col`} style={bloque("amarillo")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={LP_EYEBROW}>Tu sitio</p>
              <h2 className={`mt-3 ${LP_TITULO_TILE}`}>{avance === 100 ? "Tu sitio está completo" : "Terminá de armar tu sitio"}</h2>
            </div>
            <span className={LP_PILDORA_VELO}>
              {hechos} de {pasos.length}
            </span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/10" role="presentation">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${avance}%`, background: "var(--linksy-carbon)" }} />
          </div>
          {faltan.length === 0 ? (
            <p className={`mt-4 ${LP_BAJADA}`}>Todo listo. Tu página está publicada y lista para el QR.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {faltan.slice(0, 3).map((p) => (
                <li key={p.clave} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/45 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-extrabold leading-tight">{p.titulo}</span>
                    <span className="block text-[12.5px] font-semibold opacity-75">{p.detalle}</span>
                  </span>
                  <Link href={p.href} className={LP_BOTON_CHICO}>
                    {p.accion} →
                  </Link>
                </li>
              ))}
              {faltan.length > 3 && <li className="px-1 text-[12.5px] font-bold opacity-70">y {faltan.length - 3} más</li>}
            </ul>
          )}
        </section>
      </div>

      {/* ── 4 · TUS ADD-ONS ─────────────────────────────────────── */}
      <section id="addons" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 className={LP_TITULO_TILE}>Tus add-ons</h2>
            <p className={`mt-1.5 ${LP_DETALLE}`}>El link hub viene incluido. El resto lo prendés cuando lo necesitás y lo apagás cuando quieras.</p>
          </div>
          <span className={`${LP_PILDORA_LIMA}`}>Gratis mientras dure la prueba</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tiles.map((t) => (
            <article key={t.id} className={`${LP_TILE} flex min-h-[260px] flex-col`} style={bloque(t.bloque)}>
              <div className="flex items-start justify-between gap-3">
                <span className={LP_DISCO} style={{ background: "rgba(255,255,255,.55)", color: "var(--linksy-tinta)" }}>
                  {t.icono}
                </span>
                {t.estado}
              </div>
              <h3 className={`mt-5 ${LP_TITULO_TILE}`}>{t.nombre}</h3>
              <p className={`mt-2 ${LP_DETALLE}`}>{t.detalle}</p>
              {t.incluye && (
                <ul className="mt-3 flex flex-col gap-1 text-[13px] font-semibold opacity-80">
                  {t.incluye.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span aria-hidden>·</span>
                      {x}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">{t.acciones}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
