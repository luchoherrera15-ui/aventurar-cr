import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SiteHeader from "@/components/site-header";
import { consultarSaldo } from "@/lib/lealtad/motor";
import {
  tipoDe,
  leerBeneficio,
  configPorDefecto,
  type ConfigBeneficio,
} from "@/lib/lealtad/tipos-tarjeta";
import { esIconoSello, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { CardVacia } from "@/components/panel/piezas";
import {
  BAJADA_PANTALLA,
  EYEBROW_NEUTRO,
  GAP_TABLERO,
  LIENZO_PANEL,
  RADIO_CARD,
  ROTULO_CIFRA,
  SUPERFICIE_PANEL,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
import VistaPase from "@/components/lealtad/vista-pase";

/**
 * EL RESPALDO WEB DE LA TARJETA — "vení a bookea.lat/cuenta/lealtad si
 * tu Wallet no se actualizó".
 *
 * Nace del mismo problema que el correo de sello-acreditado.ts: el
 * aviso push a Apple no siempre despierta la app en el teléfono, así
 * que el pase del Wallet puede quedar atrasado. Esta pantalla NO tiene
 * ese problema — lee el saldo de `transacciones_puntos` en cada visita,
 * la misma fuente de verdad que usa el mostrador del negocio, nunca
 * una copia que se pueda desincronizar.
 *
 * Reusa <VistaPase>, el MISMO componente que ya dibuja la maqueta en el
 * creador y el editor del panel del negocio — con el saldo REAL en vez
 * de uno de ejemplo. Dos dibujos del mismo pase en dos pantallas
 * distintas es exactamente el bug que ya costó caro una vez en este
 * módulo (ver el comentario grande de vista-pase.tsx).
 */

type MembresiaVista = {
  miembroId: string;
  negocioNombre: string;
  saldo: number;
  meta: { nombre: string; costo_puntos: number } | null;
  modo: string | null;
  beneficio: ConfigBeneficio;
  colorFondo: string | null;
  colorSello: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  iconoSello: IconoSello | null;
};

export const metadata = { title: "Mi lealtad · Bookea" };

export default async function MiLealtadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const admin = createAdminClient();
  const membresias: MembresiaVista[] = [];

  if (admin) {
    const { data: miembros } = await admin
      .from("miembros")
      .select("id, programa_id")
      .eq("cliente_id", user.id)
      .eq("estado", "activa");

    for (const m of (miembros ?? []) as { id: string; programa_id: string }[]) {
      const { data: programa } = await admin
        .from("programa_lealtad")
        .select("*")
        .eq("id", m.programa_id)
        .eq("activo", true)
        .maybeSingle();
      if (!programa) continue; // programa archivado o borrado: no hay nada que mostrarle

      const { data: negocio } = await admin
        .from("ranchos")
        .select("nombre")
        .eq("id", programa.rancho_id as string)
        .maybeSingle();

      const { data: recompensa } = await admin
        .from("recompensas")
        .select("nombre, costo_puntos")
        .eq("programa_id", m.programa_id)
        .eq("activo", true)
        .order("costo_puntos", { ascending: true })
        .limit(1)
        .maybeSingle();

      const saldo = (await consultarSaldo(m.id)) ?? 0;
      const modo = tipoDe((programa.modo as string | null) ?? null);

      membresias.push({
        miembroId: m.id,
        negocioNombre: ((negocio?.nombre as string | null) ?? "").trim() || "Tu negocio",
        saldo,
        meta: recompensa
          ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
          : null,
        modo: programa.modo as string | null,
        // Un programa de antes de la 0135 no tiene `beneficio` guardado:
        // se completa con el default del tipo en vez de dejar el pase
        // sin texto — mismo criterio que ya usa el creador del panel.
        beneficio: leerBeneficio(programa.beneficio, modo) ?? configPorDefecto(modo),
        colorFondo: (programa.pase_color_fondo as string | null) ?? null,
        colorSello: (programa.pase_color_sello as string | null) ?? null,
        logoUrl: (programa.pase_logo_url as string | null) ?? null,
        bannerUrl: (programa.pase_banner_url as string | null) ?? null,
        iconoSello: esIconoSello(programa.pase_sello_icono) ? programa.pase_sello_icono : null,
      });
    }
  }

  return (
    <div className={`min-h-screen ${LIENZO_PANEL}`}>
      <SiteHeader breadcrumb="Tu cuenta" />
      <section className="mx-auto max-w-[720px] px-4 py-6 sm:px-6">
        <Link
          href="/cuenta"
          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Tu cuenta
        </Link>

        <p className={`mt-4 ${EYEBROW_NEUTRO}`}>
          {membresias.length} tarjeta{membresias.length === 1 ? "" : "s"} activa
          {membresias.length === 1 ? "" : "s"}
        </p>
        <h1 className={`mt-1.5 ${TITULO_PANTALLA}`}>Mi lealtad</h1>
        <p className={`mt-1.5 ${BAJADA_PANTALLA}`}>
          Tus sellos y puntos, siempre al día — este panel lee el saldo directo de la base,
          así que si tu Wallet tarda en actualizarse, acá lo ves igual.
        </p>

        {membresias.length === 0 ? (
          <div className="mt-6">
            <CardVacia>
              Todavía no tenés ninguna tarjeta de lealtad. Cuando te afiliés a la de un
              negocio, la vas a ver acá.
            </CardVacia>
          </div>
        ) : (
          <div className={`mt-6 grid ${GAP_TABLERO} sm:grid-cols-2`}>
            {membresias.map((m) => (
              /* El marco de la tarjeta pasa a ser la superficie del
                 panel —blanca, con borde y elevación— y el pase queda
                 adentro con SU propio color, que es el del negocio. El
                 marco navy de antes competía con el pase: dos azules,
                 uno encima del otro, y el del negocio perdía. */
              <div
                key={m.miembroId}
                className={`${SUPERFICIE_PANEL} ${RADIO_CARD} p-4`}
              >
                <p className={`mb-3 truncate text-center ${ROTULO_CIFRA}`}>
                  {m.negocioNombre}
                </p>
                <VistaPase
                  datos={{
                    negocioNombre: m.negocioNombre,
                    modo: m.modo,
                    beneficio: m.beneficio,
                    colorFondo: m.colorFondo,
                    colorSello: m.colorSello,
                    logoUrl: m.logoUrl,
                    bannerUrl: m.bannerUrl,
                    iconoSello: m.iconoSello,
                    saldoEjemplo: m.saldo,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
