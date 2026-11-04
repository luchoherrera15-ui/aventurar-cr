import { Suspense } from "react";
import { verificarAccesoLealtad } from "@/lib/auth";
import { fechaISOCR, fechaLargaCR } from "@/lib/fechas";
import { bloqueoPorMembresia } from "@/lib/lealtad/membresia-vencida";
import { definicionDe } from "@/lib/lealtad/planes";
import { createAdminClient } from "@/lib/supabase/admin";
import PopupMembresiaVencida from "./popup-membresia-vencida";

/**
 * LA PUERTA DE LA MEMBRESÍA VENCIDA, para el panel entero.
 *
 * Es un layout y no un chequeo en `armado.tsx` porque el panel son cinco
 * páginas: `/crear`, `/editar/…`, `/poster` y `/poster/mesas` se abren
 * directo por URL y no pasan por el armado.
 *
 * Se devuelve el popup EN VEZ de `children`, no encima: el panel no se
 * manda al navegador, así que no hay nada que destapar borrando el popup
 * desde las herramientas del navegador.
 *
 * El acceso se revisa DESPUÉS y solo si hay bloqueo, para no sumarle
 * esa consulta a la carga normal. Sin sesión o sin acceso se devuelven
 * los `children` y la página hace su redirect de siempre: este layout no
 * le dice a nadie ajeno que un negocio tiene la membresía vencida.
 *
 * Bookea (admin) entra igual: tiene que poder ayudarle al negocio.
 */
export default async function LayoutNegocioLealtad({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const admin = createAdminClient();
  const bloqueo = admin ? await bloqueoPorMembresia(admin, id) : null;
  if (!admin || !bloqueo) return children;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.ok || acceso.esAdmin) return children;

  const { data: rancho } = await admin.from("ranchos").select("nombre").eq("id", id).maybeSingle();

  return (
    // `useSearchParams` adentro: el popup lee `?pago=listo` porque un
    // layout no recibe los parámetros de búsqueda.
    <Suspense fallback={null}>
      <PopupMembresiaVencida
        ranchoId={id}
        negocio={(rancho?.nombre as string | undefined) ?? "Tu negocio"}
        paquete={definicionDe(bloqueo.plan)?.nombre ?? null}
        fecha={fechaLargaCR(fechaISOCR(new Date(bloqueo.hasta))).toLowerCase()}
        esDueno={acceso.esDueno}
        comprobanteEnRevision={bloqueo.comprobanteEnRevision}
      />
    </Suspense>
  );
}
