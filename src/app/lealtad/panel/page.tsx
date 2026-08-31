import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadoDelPrograma } from "@/lib/lealtad/reglas";
import { definicionDe } from "@/lib/lealtad/planes";
import { estadoDeAddon } from "@/lib/addons";
import { elegirDeFilasCrudas } from "@/lib/wallet/programa-principal";
import { minutoISOCR } from "@/lib/fechas";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { tenenciaDeLealtad } from "@/lib/lealtad/tenencia";
import PedirOtroNegocio from "./pedir-otro-negocio";
import {
  BAJADA_PANTALLA,
  CUERPO_SUAVE,
  EYEBROW_NEUTRO,
  GAP_TABLERO,
  LIENZO_PANEL,
  RADIO_CARD,
  RADIO_TILE,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";

/**
 * EL DASHBOARD DE LEALTAD: a donde aterriza quien entra por
 * /lealtad/login. Mismas cuentas que todo Bookea — lo distinto es el
 * recorte: acá solo se ve el mundo de lealtad, con la estética navy de
 * la marca del producto.
 *
 * "Mis negocios" arriba, una tarjeta por negocio (propios y donde es
 * colaborador). Dentro de cada tarjeta, el menú de productos: hoy solo
 * existe el Plan de Lealtad; los que vengan se suman a esa fila sin
 * rediseñar nada.
 *
 * La profundidad NO se duplica: la tarjeta lleva a la pestaña Lealtad
 * del panel del negocio, que es la única fuente de verdad del programa.
 * Dos pantallas editando lo mismo es el bug de mañana.
 *
 * TEMA CLARO (0163): esta pantalla dejó de usar el dialecto `.lealtad-oscuro`
 * — vive en el lienzo claro que `.lealtad` ya declara (`--grey` #f5f7fa), el
 * mismo mecanismo de `/mi-negocio`. El azul de acción es el par para fondo
 * claro (`--accion`/`--accion-tinta`, fundacion-visual.md), no el par para
 * navy que usaba antes. El resto del panel (`/lealtad/panel/[id]`) sigue en
 * el dialecto oscuro hasta que se decida convertirlo también.
 */

export const metadata = {
  title: "Mis negocios · Lealtad Bookea",
};

type TarjetaNegocio = {
  id: string;
  nombre: string;
  slug: string | null;
  plan: string | null;
  addonActivo: boolean;
  /** null = sin programa creado todavía. */
  estadoPrograma: string | null;
  miembros: number;
  /** 0129: creado pero sin aprobar por Bookea — todo en pausa. */
  enRevision: boolean;
};

export default async function PanelLealtadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/lealtad/login");

  // Los negocios que administra: el filtro real de seguridad es
  // `owner_id`/colaborador, calculado acá mismo. La llave de servicio
  // (desde la 0155) es solo para poder pedir `*` sobre `ranchos` sin
  // mantener una lista de columnas a mano — `authenticated` ya no
  // tiene permiso de tabla completa, y Postgres no deja `select("*")`
  // con permiso por columna. Se adelanta acá (antes se creaba más
  // abajo) para reusarla en esta consulta también.
  // `select *`: lealtad_aprobado_en (0129) puede no existir todavía y
  // un select explícito reventaría la página entera.
  const admin = createAdminClient();
  const db = admin ?? supabase;
  const [{ data: propios }, { data: colaboraciones }] = await Promise.all([
    db.from("ranchos").select("*").eq("owner_id", user.id),
    supabase.from("rancho_colaboradores").select("rancho_id").eq("usuario_id", user.id),
  ]);

  const idsColab = ((colaboraciones ?? []) as { rancho_id: string }[]).map((c) => c.rancho_id);
  const { data: colaborados } = idsColab.length
    ? await db.from("ranchos").select("*").in("id", idsColab)
    : { data: [] };

  // Dueño y colaborador del mismo negocio a la vez = una sola tarjeta.
  type FilaRancho = {
    id: string;
    nombre: string;
    slug: string | null;
    plan_lealtad: string | null;
    lealtad_aprobado_en?: string | null;
  };
  const base = [
    ...new Map(
      [...((propios ?? []) as FilaRancho[]), ...((colaborados ?? []) as FilaRancho[])].map(
        (r) => [r.id, r] as const,
      ),
    ).values(),
  ];

  // Las solicitudes de ALTA pendientes (0130): el negocio todavía no
  // existe, pero la persona necesita ver que su trámite está vivo.
  // Tolerante a bases sin migrar: un error deja la lista vacía.
  const { data: altasData } = await supabase
    .from("solicitudes_lealtad")
    .select("*")
    .eq("solicitante_id", user.id)
    .eq("estado", "pendiente")
    .is("rancho_id", null);
  const altasPendientes = ((altasData ?? []) as { id: string; negocio_nombre?: string | null; plan: string }[])
    .filter((a) => a.negocio_nombre);

  // ── EL CUPO (dueño, 31 ago 2026) ─────────────────────────────────
  // Una cuenta, un negocio de Lealtad; el segundo lo abre el equipo.
  //
  // ⚠️ SE PREGUNTA AL MISMO CONTADOR QUE USAN LAS PUERTAS DEL
  //    SERVIDOR, y no se deduce de `negocios.length`: esa lista mezcla
  //    los propios con aquellos donde la persona solo COLABORA, que no
  //    son suyos y no gastan cupo. Deducirlo de acá le cerraría el
  //    alta a quien ayuda a administrar el negocio de otro.
  const cupo = await tenenciaDeLealtad(user.id);
  const puedeCrear = cupo.total === 0;

  const negocios: TarjetaNegocio[] = [];

  for (const r of base) {
    let addonActivo = false;
    let estadoPrograma: string | null = null;
    let miembros = 0;

    if (admin) {
      // El programa se pide SIN `.maybeSingle()` y con `select *`: desde
      // que la 0134 quitó el `unique(rancho_id)` un negocio puede tener
      // varias tarjetas, y `maybeSingle` devolvía error y null — o sea
      // que esta lista mostraba «sin programa» justo en el negocio que
      // más había armado. Cuál representa al negocio lo decide
      // `elegirDeFilasCrudas`, la misma elección que hace su panel.
      const [{ data: addon }, { data: filasPrograma }] = await Promise.all([
        admin
          .from("addons_negocio")
          .select("activo, vence_en")
          .eq("rancho_id", r.id)
          .eq("addon", "lealtad")
          .maybeSingle(),
        admin.from("programa_lealtad").select("*").eq("rancho_id", r.id),
      ]);

      addonActivo =
        estadoDeAddon(
          addon as { activo: boolean; vence_en: string | null } | null,
        ) === "activo";

      const programa = elegirDeFilasCrudas(
        (filasPrograma ?? []) as Record<string, unknown>[],
        minutoISOCR(),
      );

      if (programa) {
        estadoPrograma = estadoDelPrograma({
          estado: (programa.estado as string | null) ?? null,
          activo: !!programa.activo,
        });
        const { count } = await admin
          .from("miembros")
          .select("*", { count: "exact", head: true })
          .eq("programa_id", programa.id as string);
        miembros = count ?? 0;
      }
    }

    negocios.push({
      id: r.id,
      nombre: r.nombre,
      slug: r.slug,
      plan: r.plan_lealtad,
      addonActivo,
      estadoPrograma,
      miembros,
      enRevision: "lealtad_aprobado_en" in r && r.lealtad_aprobado_en === null,
    });
  }

  return (
    <main className={`relative min-h-svh overflow-hidden px-4 pb-12 sm:px-6 ${LIENZO_PANEL}`}>
      {/* El "blur azul": un resplandor decorativo detrás del titular, nada
          más — mismo espíritu que `.acceso-resplandor` de /cuenta pero sin
          su aparato de mapa/rutas, que es específico de esa pantalla de
          acceso. `color-mix()` sobre `--accion` (mismo patrón que
          fondo-acceso.css) en vez de `--accion-suave`: ese tinte ya está
          pensado para el RELLENO de una píldora/chip, y a ese nivel de
          opacidad se pierde casi entero contra el lienzo. Sin `@supports` +
          respaldo plano porque es 100% decorativo (`aria-hidden`,
          `pointer-events-none`): en un navegador sin `color-mix()` la
          declaración se descarta entera y el resplandor no aparece, sin
          romper nada más. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[440px]"
        style={{
          background:
            "radial-gradient(640px circle at 50% -10%, color-mix(in srgb, var(--accion) 16%, transparent) 0%, transparent 72%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[960px]">
        {/* La misma barra de 64px que el panel: es el chrome del
            producto, no de una pantalla. */}
        <header className="flex h-16 items-center justify-between">
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-v4.png"
              alt="Bookea"
              width={132}
              height={41}
              className="h-[26px] w-auto"
            />
          </Link>
          <Link
            href="/cuenta"
            className="text-[12.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-navy"
          >
            Tu cuenta →
          </Link>
        </header>

        <p className={`mt-6 ${EYEBROW_NEUTRO}`}>Programas de lealtad</p>
        <h1 className={`mt-1.5 ${TITULO_PANTALLA}`}>Mis negocios</h1>
        <p className={`mt-1.5 ${BAJADA_PANTALLA}`}>
          Elegí un negocio para administrar su programa de lealtad.
        </p>

        <div className={`mt-6 grid ${GAP_TABLERO} sm:grid-cols-2`}>
          {/* Los trámites de alta esperando a Bookea: el negocio aún no
              existe, pero el dueño ve que su solicitud está viva. */}
          {altasPendientes.map((a) => (
            <Card
              key={a.id}
              eyebrow="Trámite en curso"
              titulo={a.negocio_nombre ?? "Negocio nuevo"}
              accion={
                <PildoraEstado estado="aviso">
                  {definicionDe(a.plan)?.nombre ?? a.plan}
                </PildoraEstado>
              }
            >
              <p className={CUERPO_SUAVE}>
                Solicitud en revisión — recibimos tu depósito y te avisamos al correo al
                crear el negocio.
              </p>
              <p
                className={`mt-4 ${RADIO_TILE} border border-dashed border-aventurea-line px-4 py-3 text-center text-[12.5px] font-bold text-aventurea-ink-soft`}
              >
                Esperando a Bookea
              </p>
            </Card>
          ))}
          {negocios.map((n) => (
            <Card
              key={n.id}
              eyebrow="Negocio"
              titulo={n.nombre}
              /* El paquete como píldora del sistema: es un ESTADO —tiene
                 plan o no lo tiene— y así se ve igual acá que adentro
                 del panel. */
              accion={
                <PildoraEstado estado={n.plan ? "info" : "neutro"}>
                  {definicionDe(n.plan)?.nombre ?? "Sin plan"}
                </PildoraEstado>
              }
            >
              <p className={CUERPO_SUAVE}>
                {n.enRevision
                  ? "En revisión de Bookea — te avisamos al aprobarlo"
                  : n.estadoPrograma === "activo"
                    ? `Programa activo · ${n.miembros} miembro${n.miembros === 1 ? "" : "s"}`
                    : n.estadoPrograma
                      ? `Programa en ${n.estadoPrograma}`
                      : n.addonActivo
                        ? "Sin programa configurado todavía"
                        : "Lealtad sin activar"}
              </p>

              {/* El menú de productos del negocio. Hoy: solo lealtad.
                  Los próximos se agregan a ESTA fila. Sin el addon, el
                  botón lleva a los paquetes — ahí empieza la compra. En
                  revisión (0129): sin botones — todo espera al admin. */}
              <div className="mt-4 grid gap-2">
                {n.enRevision ? (
                  <p
                    className={`${RADIO_TILE} border border-dashed border-aventurea-line px-4 py-3 text-center text-[12.5px] font-bold text-aventurea-ink-soft`}
                  >
                    Esperando aprobación
                  </p>
                ) : n.addonActivo ? (
                  <Link
                    href={`/lealtad/panel/${n.id}`}
                    className={`flex items-center justify-between ${RADIO_TILE} px-4 py-3 text-[13.5px] font-extrabold transition-opacity hover:opacity-90`}
                    style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
                  >
                    Plan de Lealtad
                    <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <Link
                    href={`/lealtad/planes?negocio=${n.id}`}
                    className={`flex items-center justify-between ${RADIO_TILE} border px-4 py-3 text-[13.5px] font-bold transition-opacity hover:opacity-80`}
                    style={{ borderColor: "var(--accion)", color: "var(--accion)" }}
                  >
                    Solicitar el plan
                    <span aria-hidden>→</span>
                  </Link>
                )}
                {/* Gris de texto suave del sistema — mismo tono que el resto
                    de las notas al pie de la tarjeta. */}
                <p className="text-center text-[11px] text-aventurea-ink-soft">
                  Más herramientas de Bookea, pronto.
                </p>
              </div>

              {n.estadoPrograma === "activo" && n.slug && (
                <Link
                  href={`/tarjeta/${n.slug}`}
                  className="mt-2 block text-center text-[12px] font-bold text-aventurea-navy underline"
                >
                  Ver la tarjeta como la ve tu cliente
                </Link>
              )}
            </Card>
          ))}

          {/* El primer programa se arma solo; el segundo se pide.
              Ver `pedir-otro-negocio.tsx` para el porqué. */}
          {puedeCrear ? (
            <Link
              href="/lealtad/crear"
              className={`flex min-h-[150px] flex-col items-center justify-center ${RADIO_CARD} border border-dashed border-aventurea-line bg-aventurea-cream-2 p-5 text-center transition-colors hover:border-aventurea-navy`}
            >
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-xl text-[22px] leading-none"
                style={{ background: "var(--accion-suave)", color: "var(--accion)" }}
              >
                +
              </span>
              <span className="mt-2.5 text-[13.5px] font-bold text-aventurea-ink">
                Creá tu primer programa
              </span>
              <span className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
                Sin publicarte en el marketplace
              </span>
            </Link>
          ) : (
            <PedirOtroNegocio />
          )}
        </div>

        {negocios.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-aventurea-ink-soft">
            Todavía no administrás ningún negocio — creá el primero arriba y en dos
            campos estás adentro.
          </p>
        )}
      </div>
    </main>
  );
}
