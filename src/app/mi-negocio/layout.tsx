import Link from "next/link";
import BotonVolver from "@/components/boton-volver";
import { createClient } from "@/lib/supabase/server";
import { saldoPendiente, type ReservaFinanzas } from "@/lib/finanzas";
import { hoyISOCR } from "@/lib/fechas";
import { iniciales } from "@/lib/iniciales";
import { LIENZO_PANEL } from "@/components/panel/sistema";
import NotificacionesBell, { type NotificacionItem } from "./notificaciones-bell";

/** Quién está adentro, para el bloque de identidad del topbar. Sale de
 *  la MISMA sesión que ya se lee para la campana: no hay consulta nueva
 *  ni dato nuevo, solo se pinta lo que el layout ya tenía en la mano. */
type UsuarioTopbar = { nombre: string; detalle: string };

/**
 * Lo pendiente de TODOS los negocios de la cuenta (no solo el que
 * estés mirando), para la campana del menú — mismo criterio que antes
 * usaba `PendientesRancho` (mi-negocio/[id]/pendientes-rancho.tsx, hoy
 * solo por negocio) y `resumenFinanciero`/`saldoPendiente` (lib/
 * finanzas.ts), pero agregado entre negocios.
 */
async function cargarSesion(): Promise<{
  items: NotificacionItem[];
  usuario: UsuarioTopbar;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // El nombre sale de la metadata de la sesión, que es lo mismo que ya
  // usa el menú de cuenta. Si no hay nombre cargado, el correo: un
  // avatar con la inicial de un correo sigue diciendo quién sos, y
  // "Usuario" no dice nada.
  const meta = user.user_metadata as { nombre?: string; full_name?: string } | null;
  const nombre = meta?.nombre?.trim() || meta?.full_name?.trim() || user.email || "Tu cuenta";
  const usuario: UsuarioTopbar = { nombre, detalle: user.email ?? "" };

  const { data: misRanchos } = await supabase
    .from("ranchos")
    .select("id, nombre")
    .eq("owner_id", user.id);
  const ranchos = misRanchos ?? [];
  if (ranchos.length === 0) return { items: [], usuario };

  const nombrePorId = new Map(ranchos.map((r) => [r.id as string, r.nombre as string]));
  const hoy = hoyISOCR();
  const { data: reservas } = await supabase
    .from("reservas")
    .select(
      "id, rancho_id, nombre, fecha, estado, deposito_validado, deposito_monto, monto_total, monto_cobrado_final, evento_pagado",
    )
    .in("rancho_id", Array.from(nombrePorId.keys()))
    .in("estado", ["pendiente", "confirmada"]);

  const items: NotificacionItem[] = [];
  for (const r of (reservas ?? []) as (ReservaFinanzas & {
    id: string;
    rancho_id: string;
    nombre: string;
    estado: string;
    deposito_validado: boolean;
    deposito_monto: number | null;
  })[]) {
    const negocio = nombrePorId.get(r.rancho_id);
    if (!negocio) continue;
    if (r.estado === "pendiente") {
      items.push({
        id: `reserva-${r.id}`,
        texto: `${r.nombre || "Una reserva"} espera tu aprobación`,
        negocio,
        href: `/mi-negocio/${r.rancho_id}?tab=agenda`,
      });
    }
    if (!r.deposito_validado && Number(r.deposito_monto ?? 0) > 0) {
      items.push({
        id: `deposito-${r.id}`,
        texto: `Depósito de ${r.nombre || "una reserva"} sin validar`,
        negocio,
        href: `/mi-negocio/${r.rancho_id}?tab=finanzas`,
      });
    }
    if (r.estado === "confirmada" && r.fecha === hoy && saldoPendiente(r) > 0) {
      items.push({
        id: `cobrar-${r.id}`,
        texto: `${r.nombre || "Un evento"} de hoy tiene saldo por cobrar`,
        negocio,
        href: `/mi-negocio/${r.rancho_id}?tab=finanzas`,
      });
    }
  }
  return { items, usuario };
}

export default async function MiRanchoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await cargarSesion();

  return (
    /* ======== EL LIENZO DEL PANEL ES GRIS ========
     *
     * Era `bg-aventurea-cream`, que es `--bg` (#ffffff). O sea: tarjeta
     * blanca sobre lienzo blanco, 1:1 — por eso el panel entero se veía
     * PLANO, sin importar cuánto borde o cuánta sombra le pusiéramos a
     * cada bloque. Es el diagnóstico visual de la maqueta, que apoya
     * tarjetas `#fff` sobre un lienzo `#f5f7fa`.
     *
     * Ahora es `--grey` (#f6f6f6): 1,08:1 contra la tarjeta, la misma
     * separación que la maqueta (1,07:1), sin un hexadecimal nuevo y
     * sin tocar el marketplace — este lienzo es solo de /mi-negocio.
     * El texto no pierde nada: la tinta fuerte da 16,75:1 sobre gris y
     * el gris de texto 6,58:1.
     *
     * El header se queda BLANCO a propósito (es el `.topbar` blanco de
     * la maqueta): así la barra de arriba se despega del lienzo en vez
     * de fundirse con él. */
    <div className={`min-h-screen ${LIENZO_PANEL}`}>
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-surface/95 backdrop-blur-sm">
        {/* Altura FIJA (h-16 = 64px + borde): la columna del menú se pega
            justo debajo con `top-16`, y sin una altura determinista ese
            offset era adivinanza — a 390px el header envolvía en dos
            líneas y se comía la barra.

            EL HEADER TAMBIÉN VA DE BORDE A BORDE. Estaba centrado en un
            `max-w-[1900px]`, y con el menú del panel ahora pegado al
            borde izquierdo eso dejaba el logo flotando a cientos de
            píxeles de la columna que debería encabezar: dos anclas
            distintas para la misma pantalla. Así que el header pierde el
            tope y toma, desde lg, el MISMO padding interno que el rail
            (16px) — el logo queda a plomo con la tarjeta de identidad y
            con las pastillas del menú de abajo, en cualquier ancho de
            pantalla. No se le fija el ancho del rail porque "Publicá tu
            negocio" no entra en 252px sin cortarse, y un logo recortado
            es peor que uno que sobresale unos píxeles.

            La derecha se pega al otro borde con la misma escala de
            padding que usa el contenido del panel (32 → 40).

            En las otras pantallas de /mi-negocio (la lista de
            publicaciones, la agenda de citas) no hay rail: ahí el logo
            simplemente queda arriba a la izquierda, que es donde iba. */}
        <div className="flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:pl-4 lg:pr-0">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- el
                logo oficial es un PNG estático: next/image no aporta
                nada acá. */}
            <img src="/logo-bookea-v4.png" alt="Bookear" className="h-7 w-auto shrink-0" />
            <span className="hidden text-zinc-300 sm:inline">/</span>
            <span className="hidden text-[13px] font-light text-aventurea-ink-soft sm:inline">
              Publicá tu negocio
            </span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-3 lg:pr-8 2xl:pr-10">
            <BotonVolver />
            {sesion && <NotificacionesBell items={sesion.items} />}
            {/* QUIÉN ESTÁ ADENTRO, a la derecha del todo — el `.user` de
                la maqueta. No es un dato nuevo: es la misma sesión que
                ya se lee para la campana. En el teléfono queda solo el
                avatar (el nombre y el correo se comen la barra a 390px),
                que es exactamente lo que hace la maqueta a ≤780px.
                El avatar es decorativo: las iniciales repiten el nombre
                que está al lado, así que va `aria-hidden` para que un
                lector de pantalla no lo lea dos veces. */}
            {sesion && (
              <Link
                href="/cuenta"
                className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-aventurea-cream-2"
                title={sesion.usuario.nombre}
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[12px] font-extrabold text-white"
                >
                  {iniciales(sesion.usuario.nombre)}
                </span>
                <span className="hidden min-w-0 flex-col leading-tight xl:flex">
                  <span className="max-w-[150px] truncate text-[12.5px] font-bold text-aventurea-ink">
                    {sesion.usuario.nombre}
                  </span>
                  <span className="max-w-[150px] truncate text-[11px] text-aventurea-ink-soft">
                    {sesion.usuario.detalle}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
