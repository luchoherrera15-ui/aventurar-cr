import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconChair,
  IconClipboard,
  IconCloche,
  IconEnlace,
  IconGear,
  IconHome,
  IconInstagram,
  IconStar,
  IconTagLine,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import type { EstadoAddons } from "@/lib/solutions/addons";
import type { vocabDe } from "@/lib/solutions/rubros";
import { cerrarSesionSolutions } from "../../sesion-actions";
import { LP_BOTON_CHICO_SUAVE, LP_BOTON_LIMA, LP_DISCO, LP_PILDORA_LIMA, LP_PILDORA_VELO, bloque, type Bloque } from "./sistema-linksy";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA NAVEGACIÓN DEL PANEL DE LINKSY — una sola lista, dos envoltorios
 * ════════════════════════════════════════════════════════════════════
 *
 * `itemsNavLinksy` es LA lista de secciones del panel: qué existe,
 * en qué orden, con qué ícono y color, y a dónde lleva. La usan el
 * shell con pestañas (`panel-linksy.tsx`, para `/solutions/panel/<id>`)
 * y el marco de las páginas propias (`marco-linksy.tsx`: Ventas,
 * Lealtad, Instagram). Antes cada página dibujaba su «← Volver al
 * panel» y el menú vivía solo en la principal; el dueño pidió que
 * «todos esos menús» fueran el mismo concepto. Ahora lo son porque
 * salen de acá.
 *
 * `BarraLinksy` y `NavLinksy` son presentación pura (sin hooks): el
 * shell —que es cliente— y el marco —que es servidor— los montan tal
 * cual. El único estado (qué pestaña está abierta) vive en el shell.
 */

export type ItemNavLinksy = {
  id: string;
  label: string;
  descripcion?: string;
  icon: ReactNode;
  href: string;
  badge?: number;
  /** Un add-on apagado: se ve, con la marca, y lleva a Inicio. */
  bloqueado?: { etiqueta: string; pie: string };
  bloque: Bloque;
  /** true = pestaña del panel (`?tab=`); false = página propia. */
  pestana: boolean;
};

export type NegocioEnBarra = {
  id: string;
  nombre: string;
  logoUrl: string | null;
  colorAcento: string;
  publicado: boolean;
  urlPublica: string;
};

export function itemsNavLinksy(p: {
  id: string;
  vocab: ReturnType<typeof vocabDe>;
  addons: EstadoAddons;
  comida: boolean;
  aceptaPedidos: boolean;
  esDueno: boolean;
  puedeEditar: boolean;
  tieneLealtad: boolean;
  escaneres: number;
  vivas?: number;
  totalMenu?: number;
  equipo?: number;
  /** La membresía (0239), para el rótulo de «Plan». */
  plan?: "gratis" | "pro";
}): ItemNavLinksy[] {
  const base = `/solutions/panel/${p.id}`;
  const pestana = (id: string) => `${base}?tab=${id}`;
  const bloqueada = { etiqueta: "Add-on", pie: "Sumalo en Inicio" };
  const items: ItemNavLinksy[] = [
    { id: "inicio", label: "Inicio", descripcion: "Tu tablero, tu plan y tus add-ons", icon: <IconHome />, href: pestana("inicio"), bloque: "celeste", pestana: true },
  ];

  if (p.addons.pedidos) {
    items.push({ id: "restaurante", label: p.vocab.tablero, descripcion: p.vocab.tableroPie, icon: <IconClipboard />, href: `${base}/restaurante`, badge: p.vivas, bloque: "coral", pestana: false });
  } else {
    items.push({ id: "restaurante", label: p.vocab.tablero, icon: <IconClipboard />, href: pestana("inicio"), bloqueado: bloqueada, bloque: "coral", pestana: false });
  }

  if (p.esDueno) {
    if (p.escaneres > 0 || p.addons.lealtad || p.tieneLealtad) {
      items.push({ id: "lealtad", label: "Lealtad", descripcion: p.escaneres > 0 ? "Escaneá, premios y estadísticas" : "Primero armá tu tarjeta", icon: <IconWallet />, href: `${base}/lealtad`, bloque: "lila", pestana: false });
    } else {
      items.push({ id: "lealtad", label: "Lealtad", icon: <IconWallet />, href: pestana("inicio"), bloqueado: bloqueada, bloque: "lila", pestana: false });
    }
  }

  if (p.puedeEditar) {
    // Como Linktree (8 sep 2026): Enlaces y Diseño son dos entradas, y los
    // ajustes van al final. Las tres pestañas montan el mismo editor.
    items.push({ id: "enlaces", label: "Enlaces", descripcion: "Tus botones, íconos y textos", icon: <IconEnlace />, href: pestana("enlaces"), bloque: "celeste", pestana: true });
    items.push({ id: "diseno", label: "Diseño", descripcion: "Tema, encabezado y efectos", icon: <IconTagLine />, href: pestana("diseno"), bloque: "amarillo", pestana: true });
    if (p.addons.menu) {
      items.push({ id: "menu", label: p.vocab.catalogoLargo, descripcion: p.vocab.cargarDetalle, icon: <IconCloche />, href: pestana("menu"), badge: p.totalMenu, bloque: "menta", pestana: true });
    } else {
      items.push({ id: "menu", label: p.vocab.catalogoLargo, icon: <IconCloche />, href: pestana("inicio"), bloqueado: bloqueada, bloque: "menta", pestana: true });
    }
    if (p.comida && p.addons.pedidos && p.aceptaPedidos) {
      items.push({ id: "mesas", label: "QR de mesas", descripcion: "La hoja para imprimir", icon: <IconChair />, href: `${base}/mesas`, bloque: "celeste", pestana: false });
    } else if (p.comida && !p.addons.pedidos) {
      items.push({ id: "mesas", label: "QR de mesas", icon: <IconChair />, href: pestana("inicio"), bloqueado: bloqueada, bloque: "celeste", pestana: false });
    }
    items.push({ id: "instagram", label: "Instagram", descripcion: "Respuestas automáticas", icon: <IconInstagram />, href: `${base}/instagram`, bloque: "lila", pestana: false });
    items.push({ id: "equipo", label: "Equipo", descripcion: "Quién entra a este panel", icon: <IconUsers />, href: pestana("equipo"), badge: p.equipo, bloque: "carbon", pestana: true });
    items.push({ id: "ajustes", label: "Ajustes", descripcion: "Dirección, contacto y publicación", icon: <IconGear />, href: pestana("ajustes"), bloque: "menta", pestana: true });
  }
  if (p.esDueno) {
    items.push({ id: "plan", label: "Plan", descripcion: p.plan === "pro" ? "Pro" : "Gratis · pasá a Pro", icon: <IconStar />, href: `${base}/plan`, bloque: "lima", pestana: false });
  }
  return items;
}

// ── La barra de arriba ───────────────────────────────────────────────

export function BarraLinksy({ negocio }: { negocio?: NegocioEnBarra }) {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 print:hidden sm:px-5 sm:pt-4">
      <div className="mx-auto flex min-h-[64px] w-[min(1440px,100%)] items-center justify-between gap-3 rounded-full bg-[var(--linksy-papel)] px-4 shadow-elevado sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link href="/solutions/panel" className="titulo shrink-0 text-[24px] font-extrabold tracking-tight text-[var(--linksy-tinta)]" title="Mis páginas">
            Bookea
          </Link>
          {negocio ? (
            <>
          <span aria-hidden className="hidden h-6 w-px bg-black/10 sm:block" />
          <Link href={`/solutions/panel/${negocio.id}?tab=inicio`} className="flex min-w-0 items-center gap-2.5">
            {negocio.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={negocio.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
            ) : (
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold" style={{ background: negocio.colorAcento, color: "var(--linksy-tinta)" }}>
                {negocio.nombre.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold text-[var(--linksy-tinta)]">{negocio.nombre}</span>
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--linksy-tinta-suave)]">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${negocio.publicado ? "bg-green-500" : "bg-black/30"}`} />
                {negocio.publicado ? "Publicada" : "Apagada"}
              </span>
            </span>
          </Link>
            </>
          ) : (
            <span className="hidden text-[13px] font-bold text-[var(--linksy-tinta-suave)] sm:block">Mis páginas</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {negocio ? (
            <a href={negocio.urlPublica} target="_blank" rel="noopener noreferrer" className={`${LP_BOTON_LIMA} !min-h-[42px] !px-5 !text-[13.5px]`}>
              Ver mi página →
            </a>
          ) : (
            <Link href="/solutions/crear" className={`${LP_BOTON_LIMA} !min-h-[42px] !px-5 !text-[13.5px]`}>
              Crear otra página
            </Link>
          )}
          <form action={cerrarSesionSolutions}>
            <button type="submit" className={`${LP_BOTON_CHICO_SUAVE} hidden sm:inline-flex`}>
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

// ── El menú lateral ──────────────────────────────────────────────────

function CuerpoItem({ item, activo }: { item: ItemNavLinksy; activo: boolean }) {
  const bloq = item.bloqueado;
  return (
    <>
      <span className={`${LP_DISCO} ${bloq ? "border border-dashed border-current opacity-50" : ""}`} style={bloq ? undefined : activo ? bloque("lima") : bloque(item.bloque)}>
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15.5px] font-extrabold leading-tight">{item.label}</span>
        {(bloq || item.descripcion) && <span className={`mt-0.5 block truncate text-[12px] font-semibold ${activo ? "opacity-70" : "opacity-60"}`}>{bloq ? bloq.pie : item.descripcion}</span>}
      </span>
      {bloq && <span className={LP_PILDORA_VELO}>{bloq.etiqueta}</span>}
      {!bloq && !!item.badge && item.badge > 0 && <span className={activo ? LP_PILDORA_LIMA : LP_PILDORA_VELO}>{item.badge}</span>}
    </>
  );
}

const ITEM = "presionable flex w-full items-center gap-3.5 rounded-[22px] px-3.5 py-3 text-left transition-colors";
const claseItem = (activo: boolean, bloq: boolean) =>
  `${ITEM} ${activo ? "bg-[var(--linksy-carbon)] text-[var(--linksy-carbon-tinta)] shadow-elevado" : bloq ? "bg-transparent text-[var(--linksy-tinta)] opacity-80 hover:bg-black/5" : "bg-[var(--linksy-papel)] text-[var(--linksy-tinta)] shadow-plano hover:shadow-elevado"}`;

/**
 * La lista de secciones. Con `alElegir`, las pestañas son botones que
 * cambian de contenido sin navegar (el shell); sin él, todo es enlace
 * (el marco de las páginas propias).
 */
export function NavLinksy({ items, activo, alElegir }: { items: ItemNavLinksy[]; activo: string; alElegir?: (id: string) => void }) {
  return (
    <nav aria-label="Secciones del panel" className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((it) => {
        const esActivo = !it.bloqueado && it.id === activo;
        const cls = `${claseItem(esActivo, !!it.bloqueado)} max-lg:w-auto max-lg:min-w-[220px]`;
        if (alElegir && it.pestana && !it.bloqueado) {
          return (
            <button key={it.id} type="button" onClick={() => alElegir(it.id)} aria-current={esActivo ? "page" : undefined} className={cls}>
              <CuerpoItem item={it} activo={esActivo} />
            </button>
          );
        }
        return (
          <Link key={it.id} href={it.href} aria-current={esActivo ? "page" : undefined} className={cls}>
            <CuerpoItem item={it} activo={esActivo} />
          </Link>
        );
      })}
    </nav>
  );
}
