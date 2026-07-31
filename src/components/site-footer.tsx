import Link from "next/link";

/**
 * El pie del sitio. Existe sobre todo por dos razones:
 *
 * 1. Los documentos legales tienen que ser alcanzables desde cualquier
 *    página — antes /privacidad estaba publicada pero no la enlazaba
 *    nadie, que a efectos prácticos es como no tenerla.
 * 2. La aclaración de que Bookea intermedia y no presta los servicios
 *    conviene que se lea en el sitio, no solo enterrada en los
 *    términos.
 *
 * Va en claro a propósito: las landings cierran con un bloque navy y
 * dos navys pegados se leen como uno solo.
 */

const VERTICALES: { href: string; label: string }[] = [
  { href: "/eventos", label: "Eventos" },
  { href: "/citas", label: "Citas" },
  { href: "/restaurantes", label: "Restaurantes" },
  { href: "/hospedajes", label: "Hospedajes" },
  { href: "/invitaciones", label: "Invitaciones digitales" },
];

const NEGOCIOS: { href: string; label: string }[] = [
  { href: "/publicar", label: "Publicá tu negocio" },
  { href: "/lealtad", label: "Programa de lealtad" },
  { href: "/mi-rancho", label: "Panel de anfitriones" },
];

const LEGAL: { href: string; label: string }[] = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/politicas", label: "Políticas" },
  { href: "/privacidad", label: "Privacidad" },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-aventurea-line bg-aventurea-surface">
      <div className="mx-auto max-w-[1200px] px-6 py-12 lg:px-10">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- el
                logo oficial es un PNG estático: next/image no aporta
                nada acá. */}
            <img
              src="/logo-bookea.png"
              alt="Bookea"
              className="h-8 w-auto"
            />
            <p className="mt-4 max-w-[42ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
              Bookea es una plataforma que conecta clientes con proveedores
              independientes. Cada servicio lo presta y lo responde el
              proveedor que lo publica — Bookea no organiza ni ejecuta los
              eventos ni los servicios reservados.
            </p>
            <a
              href="mailto:hola@bookea.lat"
              className="mt-4 inline-block text-[13px] font-bold text-aventurea-navy hover:text-aventurea-orange"
            >
              hola@bookea.lat
            </a>
          </div>

          <ColumnaFooter titulo="Reservá" links={VERTICALES} />
          <ColumnaFooter titulo="Para negocios" links={NEGOCIOS} />
          <ColumnaFooter titulo="Legal" links={LEGAL} />
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-aventurea-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-aventurea-ink-soft">
            © {new Date().getFullYear()} Bookea · Costa Rica
          </p>
          <p className="text-[12px] text-aventurea-ink-soft">
            Precios en colones. Los cobros con tarjeta los procesa Stripe.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Una columna de enlaces del pie. */
function ColumnaFooter({
  titulo,
  links,
}: {
  titulo: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-ink">
        {titulo}
      </p>
      <ul className="mt-3.5 grid gap-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[13px] text-aventurea-ink-soft transition-colors hover:text-aventurea-orange"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
