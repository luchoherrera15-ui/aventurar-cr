import NavLealtad, { type MarcaNav } from "@/app/lealtad/nav-lealtad";
import { cerrarSesionSolutions } from "./sesion-actions";

/**
 * EL NAV DE /solutions — el mismo componente que el de Lealtad, con
 * SU marca.
 *
 * Antes /solutions montaba `NavLealtad` tal cual: arriba decía
 * «Lealtad», los enlaces llevaban a /lealtad#…, «Ingresar» iba a
 * /lealtad/ingresar y el botón decía «¡Creá tu tarjeta ya!». Un
 * visitante de Solutions no sabía en qué producto estaba — la
 * confusión que el dueño marcó el 4 sep 2026.
 *
 * No es una copia del nav: es el mismo, con la marca por prop (ver
 * `MarcaNav` en nav-lealtad.tsx). Lo único de Solutions es esto.
 */
export const MARCA_SOLUTIONS: MarcaNav = {
  etiqueta: "Solutions",
  enlaces: [
    { href: "/solutions#productos", label: "Add-ons y precios" },
    { href: "/solutions#como-funciona", label: "Cómo funciona" },
  ],
  itemsCuenta: [
    { href: "/solutions/panel", label: "Mis negocios" },
    { href: "/lealtad/panel", label: "Mis tarjetas de lealtad" },
    { href: "/cuenta", label: "Configuración de perfil" },
  ],
  hrefIngresar: "/cuenta?volver=solutions",
  cta: { href: "/solutions/crear", label: "Crear mi página gratis" },
  cerrarSesion: cerrarSesionSolutions,
  industrias: false,
  idMenu: "menu-solutions",
};

export default function NavSolutions(props: {
  logueado?: boolean;
  nombre?: string | null;
  autoOcultar?: boolean;
}) {
  return <NavLealtad {...props} marca={MARCA_SOLUTIONS} />;
}
