import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, ETIQUETAS_CAPACIDAD } from "@/lib/lealtad/planes";
import { estadoDelPrograma } from "@/lib/lealtad/reglas";
import { permisosDeFila } from "@/lib/lealtad/permisos";
import TabsLealtad, { type PestanaLealtad } from "./tabs-lealtad";
import BotonEscanear from "./boton-escanear";
import LealtadEstado from "./lealtad-estado";
import CompartirTarjeta from "./compartir-tarjeta";
import PasesPanel from "./pases-panel";
import MetricasLealtad from "./metricas";
import AuditoriaResumen from "./auditoria-resumen";
import EquipoLealtad, { type MiembroEquipo } from "./equipo-cliente";
import { ActividadLealtad, IntegracionesLealtad, WalletLealtad } from "./lealtad-secciones";
import type { ProgramaFila, RecompensaFila } from "./pases-actions";

/**
 * LA interfaz del programa de lealtad de un negocio — la que reemplaza
 * a la pestaña de /mi-negocio.
 *
 * Shell navy (la marca de lealtad) con el contenido en paneles claros.
 * Las pestañas las decide el permiso de quien mira (0127):
 *
 *   General        → todos los que entran (estado, QR, escáner, plan)
 *   Auditoría      → permiso `auditoria` (quién hizo qué y cuándo)
 *   Métricas       → permiso `auditoria` (crecimiento y proyecciones)
 *   Equipo         → el dueño (roles y checklist por colaborador)
 *   Configuración  → SOLO Bookea (el negocio solicita, Bookea genera)
 */

const NAVY_PROFUNDO = "#0a1226";
const NARANJA = "#ee7420";

export const metadata = { title: "Programa de lealtad · Bookea" };

export default async function PanelNegocioLealtad({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.ok) redirect("/lealtad/panel");
  const { permisos } = acceso;

  // El negocio, con la sesión: la RLS de la 0116 ya deja leerlo al
  // dueño y al colaborador (aunque esté pendiente, invisible al público).
  // `select *` a propósito: lealtad_aprobado_en es de la 0129 y un
  // select explícito reventaría en una base sin migrar.
  const { data: rancho } = await acceso.supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) redirect("/lealtad/panel");

  // ── En revisión (0129): creado pero sin aprobar por Bookea ──────────
  // Si la columna no existe todavía, el negocio se trata como aprobado
  // — el comportamiento de antes de la migración.
  const enRevision =
    "lealtad_aprobado_en" in rancho && rancho.lealtad_aprobado_en === null && !acceso.esAdmin;
  if (enRevision) {
    return (
      <Cascaron nombre={rancho.nombre} plan={null}>
        <Papel>
          <div className="py-6 text-center sm:py-10">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Tu negocio está en revisión
            </p>
            <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              El equipo de Bookea revisa cada negocio nuevo antes de habilitarle el
              programa de lealtad. Te avisamos al correo apenas quede aprobado — de ahí
              elegís tu paquete y dejás la solicitud.
            </p>
          </div>
        </Papel>
      </Cascaron>
    );
  }

  const { data: tieneAddon } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: id,
    p_addon: "lealtad",
  });

  // ── Sin el complemento: acá se pide, no se configura ────────────────
  if (tieneAddon !== true) {
    // ¿Ya hay una solicitud esperando? (0126; si no corrió, se ignora.)
    const { data: solicitud } = await acceso.supabase
      .from("solicitudes_lealtad")
      .select("plan, created_at")
      .eq("rancho_id", id)
      .eq("estado", "pendiente")
      .maybeSingle();

    return (
      <Cascaron nombre={rancho.nombre} plan={null}>
        {/* Papel y no la tarjeta clara vieja: el tema oscuro pinta la
            tinta de blanco, y blanco sobre crema era texto invisible. */}
        <Papel>
          <div className="py-6 text-center sm:py-10">
            {solicitud ? (
              <>
                <p className="text-[15px] font-extrabold text-aventurea-ink">
                  Tu solicitud del plan {definicionDe(solicitud.plan as string)?.nombre ?? ""} está
                  en revisión
                </p>
                <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  El equipo de Bookea la está armando para que quede bien. Te avisamos al correo
                  cuando el programa esté activo.
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-extrabold text-aventurea-ink">
                  Este negocio todavía no tiene el programa de lealtad
                </p>
                <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  Elegí tu paquete y dejá la solicitud: el equipo de Bookea genera el programa y
                  la tarjeta por vos, y te avisa cuando esté listo.
                </p>
                <Link
                  href={`/lealtad/planes?negocio=${id}`}
                  className="mt-5 inline-block rounded-2xl px-6 py-3.5 text-[14px] font-extrabold text-white"
                  style={{ background: NARANJA }}
                >
                  Ver los paquetes →
                </Link>
              </>
            )}
          </div>
        </Papel>
      </Cascaron>
    );
  }

  // ── Con el complemento: los datos del programa (llave de servicio,
  //    porque un colaborador no puede leer un programa pausado por RLS) ─
  const admin = createAdminClient();
  const { data: programa } = admin
    ? await admin.from("programa_lealtad").select("*").eq("rancho_id", id).maybeSingle()
    : { data: null };
  const { data: recompensas } = admin && programa
    ? await admin
        .from("recompensas")
        .select("*")
        .eq("programa_id", (programa as ProgramaFila).id)
        .order("costo_puntos", { ascending: true })
    : { data: [] };

  const p = programa as ProgramaFila | null;
  const lista = (recompensas ?? []) as RecompensaFila[];
  const meta = lista.find((r) => r.activo) ?? null;
  const programaActivo = p
    ? estadoDelPrograma({ estado: p.estado ?? null, activo: p.activo }) === "activo"
    : false;

  // El complemento de cercanía (0123): lo pide el editor de la tarjeta
  // para saber si ofrece el aviso por ubicación.
  const { data: cercania } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: id,
    p_addon: "pases_cercania",
  });

  // ── El equipo (solo lo carga quien lo puede editar) ─────────────────
  let equipo: MiembroEquipo[] = [];
  const puedeEquipo = acceso.esDueno || acceso.esAdmin;
  if (puedeEquipo) {
    const { data } = await acceso.supabase.rpc("colaboradores_del_rancho", { p_rancho: id });
    equipo = ((data ?? []) as {
      usuario_id: string;
      email: string;
      nombre: string;
      rol?: string | null;
      permisos_lealtad?: unknown;
    }[]).map((c) => ({
      usuario_id: c.usuario_id,
      email: c.email,
      nombre: c.nombre,
      // Sin la 0127 la RPC no trae rol: esos colaboradores siguen
      // siendo administradores, igual que antes de la migración.
      rol: c.rol ?? "administrador",
      // SIEMPRE el checklist GUARDADO (resuelto como empleado), no el
      // efectivo del rol: si el dueño baja a un administrador, hereda
      // su checklist real y no un "todo en true" fantasma.
      permisos: permisosDeFila("empleado", c.permisos_lealtad),
    }));
  }

  // ── Las pestañas según el permiso ───────────────────────────────────
  // «Tarjeta» es del DUEÑO: colores, logo y recompensas se editan sin
  // pedirle permiso a nadie (antes vivía solo en /admin). Los
  // colaboradores no la ven — su checklist gobierna la operación
  // diaria, no la identidad de la marca.
  const puedeDisenar = acceso.esDueno || acceso.esAdmin;
  const pestanas: PestanaLealtad[] = [
    { id: "general", etiqueta: "General" },
    ...(puedeDisenar ? [{ id: "tarjeta", etiqueta: "Tarjeta" }] : []),
    ...(permisos.auditoria
      ? [
          { id: "auditoria", etiqueta: "Auditoría" },
          { id: "metricas", etiqueta: "Métricas" },
        ]
      : []),
    ...(puedeEquipo ? [{ id: "equipo", etiqueta: "Equipo" }] : []),
  ];

  const contenidos: Record<string, React.ReactNode> = {
    general: (
      <Papel>
        <BannerPlan plan={rancho.plan_lealtad as string | null} ranchoId={id} />
        {p ? (
          <>
            <div className="mt-4">
              <LealtadEstado
                programaId={p.id}
                plan={rancho.plan_lealtad as string | null}
                meta={meta?.costo_puntos ?? null}
              />
            </div>
            {permisos.acreditar && (
              <div className="mt-4">
                <BotonEscanear
                  ranchoId={id}
                  pideMonto={(p.modo ?? "puntos") !== "sellos"}
                  recompensa={
                    meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
                  }
                />
              </div>
            )}
            <div className="mt-4">
              <CompartirTarjeta slug={rancho.slug as string | null} programaActivo={programaActivo} />
            </div>
            {/* El póster del mostrador: lo imprime el negocio solo. */}
            <Link
              href={`/lealtad/panel/${id}/poster`}
              className="mt-3 flex items-center justify-between rounded-2xl border border-aventurea-line bg-white px-4 py-3.5 transition-colors hover:border-aventurea-navy"
            >
              <span>
                <span className="block text-[13.5px] font-bold text-aventurea-ink">
                  🖨️ Imprimir el póster para tu mostrador
                </span>
                <span className="block text-[12px] text-aventurea-ink-soft">
                  Hoja lista para pegar en la caja, con tu QR y tu regalía.
                </span>
              </span>
              <span aria-hidden className="text-aventurea-ink-soft">
                →
              </span>
            </Link>
          </>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
            Tu plan está activo y el equipo de Bookea está armando el programa y la tarjeta.
            Te avisamos al correo cuando esté listo.
          </p>
        )}
      </Papel>
    ),
    ...(puedeDisenar
      ? {
          tarjeta: (
            <Papel>
              <PasesPanel
                ranchoId={id}
                programaInicial={p}
                recompensasIniciales={lista}
                tieneCercania={cercania === true}
              />
            </Papel>
          ),
        }
      : {}),
    ...(permisos.auditoria
      ? {
          auditoria: (
            <Papel>
              <Titulo>Quién hizo qué — últimos 30 días</Titulo>
              <AuditoriaResumen programaId={p?.id ?? null} />
              <Titulo className="mt-6">El libro, movimiento por movimiento</Titulo>
              <ActividadLealtad ranchoId={id} programaId={p?.id ?? null} />
              <Titulo className="mt-6">Canjes por pasar a la caja</Titulo>
              <IntegracionesLealtad ranchoId={id} programaId={p?.id ?? null} />
            </Papel>
          ),
          metricas: (
            <Papel>
              <MetricasLealtad programaId={p?.id ?? null} plan={rancho.plan_lealtad as string | null} />
              <Titulo className="mt-6">Estado de las tarjetas</Titulo>
              <WalletLealtad programaId={p?.id ?? null} />
            </Papel>
          ),
        }
      : {}),
    ...(puedeEquipo
      ? {
          equipo: (
            <Papel>
              <EquipoLealtad ranchoId={id} equipo={equipo} />
            </Papel>
          ),
        }
      : {}),
  };

  return (
    <Cascaron nombre={rancho.nombre} plan={rancho.plan_lealtad as string | null}>
      <TabsLealtad pestanas={pestanas} contenidos={contenidos} />
    </Cascaron>
  );
}

// ── Piezas del shell ──────────────────────────────────────────────────

function Cascaron({
  nombre,
  plan,
  children,
}: {
  nombre: string;
  plan: string | null;
  children: React.ReactNode;
}) {
  const def = definicionDe(plan);
  return (
    <main className="lealtad-oscuro min-h-svh px-5 py-8" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[1040px]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad/panel" className="text-[12.5px] font-bold text-white/50 hover:text-white">
            ← Mis negocios
          </Link>
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v3.png"
              alt="Bookea"
              width={110}
              height={28}
              className="h-[24px] w-auto"
            />
          </Link>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <h1 className="min-w-0 flex-1 truncate text-[24px] font-extrabold text-white">
            {nombre}
          </h1>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold"
            style={
              def
                ? { background: "rgba(238,116,32,.18)", color: NARANJA }
                : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.5)" }
            }
          >
            {def ? `Plan ${def.nombre}` : "Sin plan"}
          </span>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}

/**
 * El contenedor de cada pestaña: azul con opacidad sobre el navy (el
 * dueño vetó los paneles claros). Las cards internas se re-mapean con
 * el tema .lealtad-oscuro de globals.css.
 */
function Papel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl border p-4 sm:p-6"
      style={{ background: "rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.08)" }}
    >
      {children}
    </div>
  );
}

function Titulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`mb-3 text-[13px] font-extrabold uppercase tracking-wide text-aventurea-ink ${className}`}>
      {children}
    </h2>
  );
}

/**
 * "Tenés el plan X, incluye esto; si querés más, mejorá el paquete" —
 * lo que el dueño ve apenas entra, como pidió el producto.
 */
function BannerPlan({ plan, ranchoId }: { plan: string | null; ranchoId: string }) {
  const def = definicionDe(plan);
  if (!def) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
        <p className="text-[13.5px] font-bold text-aventurea-ink">
          Tu programa está activo sin plan asignado.
        </p>
        <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
          Elegí un paquete para fijar tu tope de miembros y tus beneficios.{" "}
          <Link href={`/lealtad/planes?negocio=${ranchoId}`} className="font-bold underline">
            Ver los paquetes
          </Link>
        </p>
      </div>
    );
  }

  const esTope = def.id === "enterprise";
  return (
    <div className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[13.5px] font-bold text-aventurea-ink">
          Tenés el plan {def.nombre} — hasta{" "}
          {def.limiteMiembros === null ? "miembros ilimitados" : `${def.limiteMiembros} miembros`}.
        </p>
        {!esTope && (
          <Link
            href={`/lealtad/planes?negocio=${ranchoId}`}
            className="text-[12.5px] font-bold text-aventurea-orange-dark underline"
          >
            ¿Querés más? Mejorá tu paquete →
          </Link>
        )}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-aventurea-ink-soft">
        Incluye: {def.capacidades.map((c) => ETIQUETAS_CAPACIDAD[c].toLowerCase()).join(" · ")}.
      </p>
    </div>
  );
}
