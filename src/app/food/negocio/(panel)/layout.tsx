import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import { fmtFechaCorta, hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { horaCorta } from "@/lib/food/tipos";
import PanelShellFood, { type NotificacionPanel } from "./panel-nav";

// Privado: nada de esto le sirve a un buscador. Cubre todas las
// pantallas del panel, que heredan esto salvo que declaren su propia
// `metadata`.
export const metadata: Metadata = { title: "Panel · FOOD.BOOKEA", robots: { index: false } };

/**
 * EL PANEL DEL RESTAURANTE — todo lo que cuelga de acá exige sesión Y
 * un negocio de FOOD ya creado. `nuevo/` y `login/` viven FUERA de
 * este grupo de rutas a propósito: `nuevo/` necesita sesión pero
 * TODAVÍA NO tiene negocio (este layout lo mandaría en un loop), y
 * `login/` no necesita ninguna de las dos cosas.
 *
 * Desde el rediseño "centro de control" el layout ya no pinta la
 * cabecera él mismo: arma los datos (negocio, correo, notificaciones
 * reales) y se los da a PanelShellFood (panel-nav.tsx), que es la
 * sidebar + topbar de todo el panel. Este archivo sigue siendo el
 * ÚNICO dueño de la autenticación — el shell solo pinta.
 */
export default async function PanelFoodLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/food/negocio/login");

  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  // La campana muestra las reservas confirmadas QUE VIENEN (hoy en
  // adelante) — datos reales, no utilería: si no hay nada, la campana
  // dice que no hay nada. hoyISOCR() y no new Date(): el servidor
  // corre en UTC y desde las 6 p.m. de CR creería que ya es mañana.
  const hoy = hoyISOCR();
  const { data: proximas, error } = await supabase
    .from("food_reservations")
    .select("id, party_size, codigo_confirmacion, food_franjas!inner(fecha, hora)")
    .eq("business_id", negocio.id)
    .eq("estado", "confirmada")
    .gte("food_franjas.fecha", hoy)
    .limit(30);
  if (error) console.error("[food/negocio layout] notificaciones:", error.message);

  const manana = sumarDiasISO(hoy, 1);
  const notificaciones: NotificacionPanel[] = (proximas ?? [])
    .map((r) => {
      // El join puede venir como objeto o como array de uno, igual que
      // en la página de "Hoy" — se normaliza acá y listo.
      const franja = Array.isArray(r.food_franjas) ? r.food_franjas[0] : r.food_franjas;
      return {
        id: r.id,
        fecha: franja?.fecha ?? "",
        hora: franja?.hora ?? "",
        partySize: r.party_size,
        codigo: r.codigo_confirmacion,
      };
    })
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      titulo: `Reserva confirmada · ${r.partySize} ${r.partySize === 1 ? "persona" : "personas"}`,
      detalle: `${
        r.fecha === hoy ? "Hoy" : r.fecha === manana ? "Mañana" : fmtFechaCorta(r.fecha)
      } · ${horaCorta(r.hora)} · código ${r.codigo}`,
    }));

  return (
    <PanelShellFood
      negocio={{ nombre: negocio.nombre, activo: negocio.activo }}
      correo={user.email ?? ""}
      notificaciones={notificaciones}
    >
      {!negocio.activo && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12.5px] font-bold text-red-700">
          Tu negocio está apagado — no lo ve el público. Prendelo en Configuración.
        </p>
      )}
      {children}
    </PanelShellFood>
  );
}
