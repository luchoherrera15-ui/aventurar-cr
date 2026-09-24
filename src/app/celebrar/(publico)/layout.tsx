/**
 * Las páginas públicas de CELEBRAR (la invitación de cada celebración).
 * Sin nav ni pie del sitio, sin leer cookies ni host: por eso pueden ser
 * estáticas con revalidación. Lo único que las envuelve es el layout raíz
 * del producto (fuentes y tokens).
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
