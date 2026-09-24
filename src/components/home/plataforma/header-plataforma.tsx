import Link from "next/link";
import AccionesPortada from "@/components/home/acciones-portada";
import {
  FAMILIAS,
  FAMILIA_LABEL,
  TIPOS_NEGOCIO,
  type FamiliaId,
} from "@/lib/business/modulos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL HEADER DEL MODO PLATAFORMA — con lo que hay adentro del sitio
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (23 sep 2026): «ese menú superior cambialo: colocar
 * lo de cada sección de cada página que tenemos, en la principal».
 *
 * El header traía el logo, un botón a `/negocios` y la cuenta. No
 * decía en ninguna parte qué hay adentro del sitio: quien llegaba solo
 * podía bajar o irse.
 *
 * Ahora lleva dos menús —qué hace Bookea y para qué rubros— más las
 * puertas que de verdad existen.
 *
 * ── SIN JAVASCRIPT ──────────────────────────────────────────────────
 *
 * Los desplegables abren con `group-hover` y `group-focus-within`: con
 * el mouse encima o con el foco adentro. Eso los deja funcionando
 * antes de que hidrate nada y los hace recorribles con el tabulador
 * sin escribir un manejador de teclado que después haya que mantener.
 * El header sigue siendo un componente de servidor; lo único de
 * cliente es `AccionesPortada`, que ya lo era porque lee la sesión.
 *
 * ── SOLO SE ENLAZA LO QUE EXISTE ────────────────────────────────────
 *
 * Nada de `/precios` (no está decidido cómo se cobra), nada de
 * `/productos/*` (no existen) y nada de Celebrar (sus migraciones no
 * están aplicadas en producción). Cada sección del producto apunta a
 * su ancla en esta misma página, que es donde está explicada.
 */

/** Lo que Bookea hace, con su ancla en el home. */
const PRODUCTO: { nombre: string; resumen: string; href: string }[] = [
  { nombre: "Tu página", resumen: "Tu negocio, en un solo link", href: "/#tu-pagina" },
  { nombre: "Reservas", resumen: "Tus clientes reservan solos", href: "/#reservas" },
  { nombre: "Pedidos", resumen: "Te llegan por WhatsApp", href: "/#pedidos" },
  { nombre: "Clientes", resumen: "La ficha se llena sola", href: "/#clientes" },
  { nombre: "Lealtad", resumen: "Sellos en Apple y Google Wallet", href: "/lealtad" },
  { nombre: "Marketing", resumen: "Campañas que salen solas", href: "/#marketing" },
  { nombre: "Métricas", resumen: "Cómo va tu negocio", href: "/#metricas" },
];

function tiposDe(familia: FamiliaId) {
  return TIPOS_NEGOCIO.filter((t) => t.familia === familia && t.id !== "otro");
}

/** Un desplegable del nav. Abre con el mouse o con el foco. */
function Menu({
  etiqueta,
  ancho,
  children,
}: {
  etiqueta: string;
  ancho: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[14.5px] font-bold text-[color:var(--tinta)] transition-colors hover:bg-[color:var(--superficie)]"
      >
        {etiqueta}
        <span aria-hidden className="text-[10px] text-[color:var(--tinta-suave)]">
          ▾
        </span>
      </button>

      {/* `invisible` + `opacity-0` en vez de `hidden`: así el panel
          existe en el árbol y `group-focus-within` puede alcanzarlo
          cuando alguien llega con el tabulador. */}
      <div
        className={`invisible absolute left-0 top-[calc(100%+6px)] z-50 ${ancho} rounded-[16px] border border-[color:var(--linea)] bg-white p-2 opacity-0 shadow-[0_24px_60px_-28px_rgba(20,22,26,0.35)] transition-[opacity,visibility] group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100`}
      >
        {children}
      </div>
    </div>
  );
}

export default function HeaderPlataforma() {
  const familias = FAMILIAS.filter((f) => f !== "otro").filter(
    (f) => tiposDe(f).length > 0,
  );

  return (
    <header className="relative z-40 border-b border-[color:var(--linea)] bg-[color:var(--papel)]">
      <div className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center gap-2 px-4 lg:px-6">
        <Link
          href="/"
          className="titulo shrink-0 text-[22px] text-[color:var(--tinta)]"
        >
          Bookea
        </Link>

        {/* ── EL NAV ────────────────────────────────────────────────
            Se esconde abajo de `lg` y en su lugar queda el cajón de
            siempre: siete secciones y cinco rubros no entran en un
            teléfono sin convertirse en otra cosa. */}
        <nav className="ml-6 hidden items-center gap-0.5 lg:flex">
          <Menu etiqueta="Producto" ancho="w-[520px]">
            <div className="grid grid-cols-2 gap-0.5">
              {PRODUCTO.map((p) => (
                <Link
                  key={p.nombre}
                  href={p.href}
                  className="rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[color:var(--superficie)]"
                >
                  <span className="block text-[14px] font-extrabold text-[color:var(--tinta)]">
                    {p.nombre}
                  </span>
                  <span className="block text-[12.5px] text-[color:var(--tinta-suave)]">
                    {p.resumen}
                  </span>
                </Link>
              ))}
            </div>
          </Menu>

          {/* Los rubros NO se escriben a mano: salen de `modulos.ts`,
              el mismo archivo del que sale el selector del alta. */}
          <Menu etiqueta="Rubros" ancho="w-[380px]">
            <div className="grid gap-0.5">
              {familias.map((f) => (
                <Link
                  key={f}
                  href="/mi-negocio/nuevo"
                  className="flex items-baseline justify-between gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[color:var(--superficie)]"
                >
                  <span className="text-[14px] font-extrabold text-[color:var(--tinta)]">
                    {FAMILIA_LABEL[f]}
                  </span>
                  <span className="shrink-0 text-[12.5px] text-[color:var(--tinta-suave)]">
                    {tiposDe(f)
                      .slice(0, 2)
                      .map((t) => t.label)
                      .join(" · ")}
                  </span>
                </Link>
              ))}
            </div>
          </Menu>

          {/* «Descubrir» lleva al MARKETPLACE, que desde el 24 sep 2026
              tiene dirección propia. Antes era `/#catalogo`, un ancla
              que solo bajaba a los cuatro productos de la misma
              landing: el menú prometía un catálogo y entregaba scroll. */}
          <Link
            href="/all"
            className="rounded-[10px] px-3 py-2 text-[14.5px] font-bold text-[color:var(--tinta)] transition-colors hover:bg-[color:var(--superficie)]"
          >
            Descubrir
          </Link>
          <Link
            href="/negocios"
            className="rounded-[10px] px-3 py-2 text-[14.5px] font-bold text-[color:var(--tinta)] transition-colors hover:bg-[color:var(--superficie)]"
          >
            Para negocios
          </Link>
          <Link
            href="/ayuda"
            className="rounded-[10px] px-3 py-2 text-[14.5px] font-bold text-[color:var(--tinta)] transition-colors hover:bg-[color:var(--superficie)]"
          >
            Ayuda
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AccionesPortada />
        </div>
      </div>
    </header>
  );
}
