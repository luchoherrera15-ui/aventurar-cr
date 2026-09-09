import { createAdminClient } from "@/lib/supabase/admin";
import type { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { addonsDelNegocio } from "@/lib/solutions/addons";
import { escaneresDeLaCuenta } from "@/lib/solutions/lealtad-puente";
import { esDeComida, vocabDe } from "@/lib/solutions/rubros";
import type { NegocioSolutions } from "@/lib/solutions/tipos";
import { urlDelNegocio } from "@/lib/solutions/tipos";
import { itemsNavLinksy, type ItemNavLinksy, type NegocioEnBarra } from "./nav-linksy";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Acceso = Extract<Awaited<ReturnType<typeof verificarAccesoSolutions>>, { ok: true }>;

/**
 * Lo que una PÁGINA PROPIA del panel (Ventas, Lealtad, Instagram)
 * necesita para dibujar el mismo menú que la principal: los add-ons,
 * si la cuenta tiene tarjeta en Lealtad, y el negocio para la barra.
 * Sin contadores (pedidos vivos, ítems): esos son de la principal.
 */
export async function navDelPanel(admin: Admin, negocio: NegocioSolutions, acceso: Acceso): Promise<{ items: ItemNavLinksy[]; barra: NegocioEnBarra }> {
  const addons = await addonsDelNegocio(admin, negocio.id);
  let tieneLealtad = false;
  let escaneres = 0;
  if (acceso.esDueno) {
    const lista = await escaneresDeLaCuenta(admin, negocio.owner_id);
    escaneres = lista.length;
    tieneLealtad = escaneres > 0 || addons.lealtad;
  }
  const items = itemsNavLinksy({
    id: negocio.id,
    vocab: vocabDe(negocio.rubro),
    addons,
    comida: esDeComida(negocio.rubro),
    aceptaPedidos: negocio.acepta_pedidos,
    esDueno: acceso.esDueno,
    puedeEditar: acceso.puedeEditar,
    tieneLealtad,
    escaneres,
    plan: negocio.plan,
  });
  const barra: NegocioEnBarra = {
    id: negocio.id,
    nombre: negocio.nombre,
    logoUrl: negocio.logo_url,
    colorAcento: negocio.color_acento,
    publicado: negocio.publicado,
    urlPublica: urlDelNegocio(negocio),
  };
  return { items, barra };
}
