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
 */

const NAVY_PROFUNDO = "#0a1226";
const NARANJA = "#ee7420";

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
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[960px]">
        {/* Chrome mínimo del dashboard: el logo vuelve a la landing, y
            la cuenta general queda a un link — sin duplicar menús. */}
        <header className="flex items-center justify-between">
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v3.png"
              alt="Bookea"
              width={132}
              height={33}
              className="h-[30px] w-auto"
            />
          </Link>
          <Link href="/cuenta" className="text-[12.5px] font-bold text-white/50 hover:text-white">
            Tu cuenta →
          </Link>
        </header>

        <h1 className="mt-10 text-[26px] font-extrabold text-white">Mis negocios</h1>
        <p className="mt-1 text-[14px] text-white/55">
          Elegí un negocio para administrar su programa de lealtad.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {/* Los trámites de alta esperando a Bookea: el negocio aún no
              existe, pero el dueño ve que su solicitud está viva. */}
          {altasPendientes.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-dashed p-5"
              style={{ background: "rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.2)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-[16.5px] font-bold text-white/85">
                  {a.negocio_nombre}
                </h2>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                  style={{ background: "rgba(238,116,32,.18)", color: NARANJA }}
                >
                  {definicionDe(a.plan)?.nombre ?? a.plan}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] text-white/50">
                Solicitud en revisión — recibimos tu depósito y te avisamos al correo al
                crear el negocio.
              </p>
              <p className="mt-4 rounded-xl border border-dashed border-white/25 px-4 py-3 text-center text-[12.5px] font-bold text-white/50">
                ⏳ Esperando a Bookea
              </p>
            </div>
          ))}
          {negocios.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border p-5"
              style={{ background: "rgba(255,255,255,.045)", borderColor: "rgba(255,255,255,.12)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-[16.5px] font-bold text-white">
                  {n.nombre}
                </h2>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
                  style={
                    n.plan
                      ? { background: "rgba(238,116,32,.18)", color: NARANJA }
                      : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.5)" }
                  }
                >
                  {definicionDe(n.plan)?.nombre ?? "Sin plan"}
                </span>
              </div>

              <p className="mt-1.5 text-[12.5px] text-white/50">
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
                  <p className="rounded-xl border border-dashed border-white/25 px-4 py-3 text-center text-[12.5px] font-bold text-white/50">
                    ⏳ Esperando aprobación
                  </p>
                ) : n.addonActivo ? (
                  <Link
                    href={`/lealtad/panel/${n.id}`}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-[13.5px] font-bold text-white transition-transform hover:scale-[1.01]"
                    style={{ background: NARANJA }}
                  >
                    Plan de Lealtad
                    <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <Link
                    href={`/lealtad/planes?negocio=${n.id}`}
                    className="flex items-center justify-between rounded-xl border px-4 py-3 text-[13.5px] font-bold text-white transition-colors hover:bg-white/10"
                    style={{ borderColor: NARANJA, color: NARANJA }}
                  >
                    Solicitar el plan
                    <span aria-hidden>→</span>
                  </Link>
                )}
                <p className="text-center text-[11px] text-white/30">
                  Más herramientas de Bookea, pronto.
                </p>
              </div>

              {n.estadoPrograma === "activo" && n.slug && (
                <Link
                  href={`/tarjeta/${n.slug}`}
                  className="mt-2 block text-center text-[12px] font-bold text-white/45 underline hover:text-white/80"
                >
                  Ver la tarjeta como la ve tu cliente
                </Link>
              )}
            </div>
          ))}

          {/* Crear otro programa — o el primero. */}
          <Link
            href="/lealtad/nuevo"
            className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center transition-colors hover:border-white/50"
            style={{ borderColor: "rgba(255,255,255,.25)" }}
          >
            <span className="text-[28px] text-white/60" aria-hidden>
              +
            </span>
            <span className="mt-1 text-[13.5px] font-bold text-white/80">
              {negocios.length === 0 ? "Creá tu primer programa" : "Otro negocio"}
            </span>
            <span className="mt-0.5 text-[11.5px] text-white/40">
              Sin publicarte en el marketplace
            </span>
          </Link>
        </div>

        {negocios.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-white/40">
            Todavía no administrás ningún negocio — creá el primero arriba y en dos
            campos estás adentro.
          </p>
        )}
      </div>
    </main>
  );
}
