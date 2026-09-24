import NavCelebrar from "@/components/celebrar/nav-celebrar";
import PieCelebrar from "@/components/celebrar/pie-celebrar";
import { ProveedorRutas } from "@/components/celebrar/rutas-cliente";
import { prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";

/**
 * El sitio público de CELEBRAR (portada, plantillas, acceso). Lee el
 * host —para armar los links con o sin `/celebrar`— y la sesión —para
 * mostrar «Entrar» o «Mi panel»—, y por eso es dinámico. La invitación
 * pública (Fase 3) NO va acá adentro: tendrá su propio grupo para poder
 * ser estática.
 */
export default async function LayoutSitioCelebrar({ children }: { children: React.ReactNode }) {
  const [prefijo, sesion] = await Promise.all([prefijoDeLaPeticion(), sesionCelebrar()]);
  return (
    <ProveedorRutas prefijo={prefijo}>
      <NavCelebrar sesion={sesion} />
      <main className="flex-1">{children}</main>
      <PieCelebrar />
    </ProveedorRutas>
  );
}
