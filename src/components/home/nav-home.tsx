import Link from "next/link";
import { ID_COMO_FUNCIONA } from "./como-funciona";
import { IconCompass, IconStore } from "@/components/icons";

/**
 * Los links de la nav del home. NO es un header: se le pasan al prop
 * `extra` de `SiteHeader`, que existe justo para eso.
 *
 *     <SiteHeader ancho="max-w-[1200px]" extra={<NavHome />} />
 *
 * Por qué no un header propio del home, aunque la maqueta traiga el
 * suyo: `SiteHeader` es el que sostiene el contrato de altura `h-16`
 * del que dependen todas las barras `top-16` del sitio, el que sabe si
 * quien mira ya publicó un negocio (`tieneNegocioPropio`), y el que
 * monta el menú de cuenta con el contador de mensajes sin leer. Un
 * header paralelo empezaría sin nada de eso y con la portada —la URL
 * más visitada— como conejillo de indias.
 *
 * En móvil no se pinta: duplicaría el menú hamburguesa que `MenuCuenta`
 * ya tiene ahí adentro. De ahí el `hidden lg:flex`.
 */

/**
 * YA NO VIVEN ACÁ «CITAS Y SERVICIOS» NI «EVENTOS».
 *
 * Estaban acá EN BURBUJA, repetidas un renglón más abajo como las
 * pestañas de `BuscadorHome` — que además son las que de verdad hacen
 * algo (cambian el formulario de búsqueda y a dónde manda el botón).
 * Dos controles idénticos a un renglón de distancia es ruido, y el
 * dueño lo reportó mirando la portada: «se repite abajo y arriba».
 *
 * Se sacan de ACÁ y no de la otra, porque la otra es la funcional, ya
 * está adaptada al móvil (colapsa a un botón compacto bajo `sm`,
 * `buscador-home.tsx:797`) y tiene navegación de teclado con flechas
 * (`role="tablist"`). Reconstruir eso acá para conservar la burbuja
 * habría sido la duplicación al revés.
 *
 * Quedan solo los dos links de acompañamiento, en texto — la nav ya no
 * necesita el separador que distinguía «puerta» de «acompañamiento».
 */
type Link = {
  href: string;
  texto: string;
  Icono: (p: { className?: string }) => React.ReactElement;
};

const LINKS: Link[] = [
  // Ancla, no ruta: la sección vive en esta misma página. El id sale de
  // quien lo pinta, para que no se despareje si alguien lo renombra.
  { href: `#${ID_COMO_FUNCIONA}`, texto: "Cómo funciona", Icono: IconCompass },
  // OJO, fase de ensamble: `SiteHeader` ya muestra a la derecha su
  // propio "Publicá tu espacio" (o "Manejá tu espacio" si la persona ya
  // publicó). Si en pantalla los dos juntos se leen redundantes, la
  // palanca es `conPublicar={false}` en el SiteHeader del home — el
  // atajo sigue estando en el menú de cuenta y en el aviso de arriba,
  // así que no se pierde ninguna puerta.
  { href: "/publicar", texto: "Para negocios", Icono: IconStore },
];

export default function NavHome() {
  return (
    <nav aria-label="Secciones de Bookea" className="hidden items-center gap-5 lg:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex items-center gap-1.5 whitespace-nowrap px-1.5 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
        >
          {/* `aria-hidden`: el texto de al lado ya dice lo mismo. */}
          <link.Icono className="h-[15px] w-[15px] shrink-0" />
          {link.texto}
        </Link>
      ))}
    </nav>
  );
}
