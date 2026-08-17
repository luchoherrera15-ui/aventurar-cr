import Link from "next/link";
import { ID_COMO_FUNCIONA } from "./como-funciona";
import {
  IconCalendarLine,
  IconCelebrate,
  IconCompass,
  IconStore,
} from "@/components/icons";

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
 * DOS CLASES DE LINK, Y SE TIENEN QUE VER DISTINTAS.
 *
 * «Citas y servicios» y «Eventos» son las dos PUERTAS del marketplace:
 * llevan a un directorio con negocios de verdad. «Cómo funciona» y
 * «Para negocios» son de acompañamiento — una baja a una sección de
 * esta misma página y la otra es para el dueño de un negocio, no para
 * quien viene a reservar.
 *
 * Pintados los cuatro igual, las dos puertas se perdían entre el resto
 * y no se leían como los botones que son. Las de categoría van en
 * burbuja; las otras, en texto.
 */
/**
 * EL ÍCONO VA ADELANTE DEL TEXTO, Y ES DECORATIVO.
 *
 * Cada uno se eligió porque representa lo que hay del otro lado, no por
 * rellenar: un calendario para reservar una cita, una celebración para
 * eventos, una brújula para «cómo funciona» y una tienda para el lado
 * del negocio. Un ícono que no dice nada es peor que ninguno — le suma
 * ruido a un renglón que se lee de reojo.
 *
 * Van `aria-hidden` porque el texto de al lado ya dice lo mismo: un
 * lector de pantalla que anuncie «imagen, calendario, Citas y
 * servicios» hace más lento el recorrido sin agregar información.
 */
type Link = {
  href: string;
  texto: string;
  Icono: (p: { className?: string }) => React.ReactElement;
  categoria?: true;
};

const LINKS: Link[] = [
  { href: "/citas", texto: "Citas y servicios", Icono: IconCalendarLine, categoria: true },
  { href: "/eventos", texto: "Eventos", Icono: IconCelebrate, categoria: true },
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
    <nav aria-label="Secciones de Bookea" className="hidden items-center gap-2 lg:flex">
      {LINKS.map((link, i) => {
        const anterior = LINKS[i - 1];
        return (
          <span key={link.href} className="flex items-center">
            {/* La rayita separa las dos puertas del resto. Va donde
                cambia el tipo de link, no en una posición fija: si
                mañana se agrega una categoría, se corre sola. */}
            {anterior?.categoria && !link.categoria && (
              <span aria-hidden className="mx-2.5 h-4 w-px bg-aventurea-line" />
            )}
            <Link
              href={link.href}
              className={
                link.categoria
                  ? "presionable inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-aventurea-line bg-white px-3.5 py-2 text-[13.5px] font-extrabold text-aventurea-navy transition-colors hover:border-aventurea-navy/40 hover:bg-aventurea-navy/[0.04]"
                  : "inline-flex items-center gap-1.5 whitespace-nowrap px-1.5 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
              }
            >
              {/* `shrink-0` para que el ícono no se aplaste cuando la
                  nav se comprime en la columna del medio: un ícono
                  deformado se nota más que uno chico. */}
              <link.Icono className="h-[15px] w-[15px] shrink-0" />
              {link.texto}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
