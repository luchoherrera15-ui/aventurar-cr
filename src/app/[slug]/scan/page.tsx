import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { registraCompraElTipo } from "@/lib/lealtad/mostrador";
import { productosParaVender } from "@/lib/lealtad/productos-db";
import ModoMostrador from "@/app/lealtad/panel/[id]/modo-mostrador";
import "@/app/lealtad/panel/panel-oscuro.css";

/**
 * EL LINK DIRECTO DE LA CAJA (0206): `bookea.lat/<negocio>/scan`.
 *
 * Pedido del dueño, textual: una ventana para dejar puesta en el
 * teléfono del mostrador, que solo deje escanear (o, si él lo prende,
 * buscar al cliente a mano) — sin el resto del panel a un toque.
 *
 * ------------------------------------------------------------------
 * LA MISMA SESIÓN Y EL MISMO CHECKLIST DE SIEMPRE
 * ------------------------------------------------------------------
 * Esta ruta NO es un acceso público nuevo: usa exactamente
 * `verificarAccesoLealtad` (0127), el mismo que protege todo
 * `/lealtad/panel/[id]`. Quien no tenga sesión cae al login y vuelve
 * acá (`?volver=scan:<slug>`, ver `/cuenta`); quien tenga sesión pero
 * sin fila de colaborador, o sin el permiso `acreditar`, ve un aviso y
 * nada más — jamás el escáner. Lo único que cambia frente al panel
 * completo es que ACÁ no se monta el menú lateral ni el resto de las
 * secciones: es literalmente el mismo `<ModoMostrador>` que ya vive
 * adentro de `ShellLealtad`, en su propia página.
 *
 * ------------------------------------------------------------------
 * EL NEGOCIO SE BUSCA POR SLUG, SIN FILTRAR POR ESTADO
 * ------------------------------------------------------------------
 * Igual que `/tarjeta/[slug]`: un negocio "solo lealtad" vive en estado
 * 'pendiente' y no por eso deja de tener equipo trabajando. El
 * candado real es la sesión, no el estado de la publicación.
 *
 * ------------------------------------------------------------------
 * VARIAS TARJETAS → SE ELIGE ANTES DE ENTRAR
 * ------------------------------------------------------------------
 * Con una sola tarjeta el link es corto y fijo. Con varias, la primera
 * pantalla es un selector (`?tarjeta=<id>` valida contra las tarjetas
 * REALES del negocio, igual que el `?tarjeta=` del panel) — nunca se
 * elige una "por defecto" a espaldas de quien está parado en la caja.
 */

const NAVY_PROFUNDO = "#0a1226";
const RAIL_LINEA = "rgba(255,255,255,.08)";

export const metadata = { title: "Escanear · Bookea" };

export default async function ScanDirectoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tarjeta?: string }>;
}) {
  const { slug } = await params;
  const { tarjeta } = await searchParams;

  const admin = createAdminClient();
  if (!admin) {
    return (
      <Pantalla>
        <Mensaje titulo="No se pudo cargar" texto="Probá de nuevo en un rato." />
      </Pantalla>
    );
  }

  const { data: rancho } = await admin.from("ranchos").select("*").eq("slug", slug).maybeSingle();
  if (!rancho) {
    return (
      <Pantalla>
        <Mensaje titulo="No encontramos ese negocio" texto="Revisá el link e intentá de nuevo." />
      </Pantalla>
    );
  }
  const ranchoId = rancho.id as string;
  const nombreNegocio = (rancho.nombre as string) ?? "Bookea";

  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) redirect(`/cuenta?volver=scan:${slug}`);
  if (!acceso.ok) {
    return (
      <Pantalla nombreNegocio={nombreNegocio}>
        <Mensaje
          titulo="No tenés acceso a este negocio"
          texto="Pedile al dueño que te invite como colaborador desde Equipo, en su panel."
          enlace="/cuenta"
          textoEnlace="¿No es tu cuenta? Cambiar →"
        />
      </Pantalla>
    );
  }
  if (!acceso.permisos.acreditar) {
    return (
      <Pantalla nombreNegocio={nombreNegocio}>
        <Mensaje
          titulo="No tenés permiso para dar sellos"
          texto="Pedíselo al dueño desde Equipo, en el panel."
        />
      </Pantalla>
    );
  }

  // Mismas dos condiciones que bloquean el panel completo (page.tsx): en
  // revisión, o sin el complemento activo. El link directo no puede ser
  // un atajo alrededor de ninguna de las dos.
  const enRevision =
    "lealtad_aprobado_en" in rancho && rancho.lealtad_aprobado_en === null && !acceso.esAdmin;
  if (enRevision) {
    return (
      <Pantalla nombreNegocio={nombreNegocio}>
        <Mensaje
          titulo="Tu negocio está en revisión"
          texto="Bookea todavía no lo aprueba — mirá el panel completo para más detalles."
          enlace={`/lealtad/panel/${ranchoId}`}
        />
      </Pantalla>
    );
  }

  const { data: tieneAddon } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: ranchoId,
    p_addon: "lealtad",
  });
  if (tieneAddon !== true) {
    return (
      <Pantalla nombreNegocio={nombreNegocio}>
        <Mensaje
          titulo="Este negocio no tiene el complemento activo"
          texto="Elegí un paquete desde el panel completo para volver a operar la caja."
          enlace={`/lealtad/panel/${ranchoId}`}
        />
      </Pantalla>
    );
  }

  const { data: filasProgramas } = await admin
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", ranchoId);
  const todasLasFilas = (filasProgramas ?? []) as Record<string, unknown>[];

  if (todasLasFilas.length === 0) {
    return (
      <Pantalla nombreNegocio={nombreNegocio}>
        <Mensaje
          titulo="Todavía no tenés una tarjeta"
          texto="Creala desde el panel completo."
          enlace={`/lealtad/panel/${ranchoId}`}
        />
      </Pantalla>
    );
  }

  let p: Record<string, unknown> | null = null;
  if (todasLasFilas.length === 1) {
    p = todasLasFilas[0];
  } else if (tarjeta) {
    p = todasLasFilas.find((f) => f.id === tarjeta) ?? null;
  }

  // Sin tarjeta elegida (o la pedida no es de este negocio): el
  // selector. Nunca se elige una por defecto a espaldas de quien mira.
  if (!p) {
    return (
      <Pantalla nombreNegocio={nombreNegocio}>
        <p className="mb-4 text-[13px] font-bold text-white/70">Elegí qué tarjeta operar</p>
        <div className="flex flex-col gap-2.5">
          {todasLasFilas.map((f) => (
            <Link
              key={f.id as string}
              href={`/${slug}/scan?tarjeta=${f.id}`}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-[14px] font-bold text-white transition-colors hover:border-white/35"
            >
              {(f.nombre as string) ?? "Tarjeta"}
            </Link>
          ))}
        </div>
      </Pantalla>
    );
  }

  const { data: recompensasData } = await admin
    .from("recompensas")
    .select("*")
    .eq("programa_id", p.id as string)
    .order("costo_puntos", { ascending: true });
  const recompensas = (recompensasData ?? []) as {
    id: string;
    nombre: string;
    costo_puntos: number;
    activo: boolean;
  }[];
  const meta = recompensas.find((r) => r.activo) ?? null;

  const tipoPrincipal = tipoDe((p.modo as string | null) ?? null);
  const pideMonto = registraCompraElTipo(tipoPrincipal);
  const productosDeVenta = await productosParaVender(admin, ranchoId);

  return (
    <div className="lealtad-oscuro min-h-svh" style={{ background: NAVY_PROFUNDO }}>
      <header
        className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6"
        style={{ background: "rgba(10,18,38,.88)", borderColor: RAIL_LINEA }}
      >
        <p className="flex min-w-0 flex-1 items-center gap-2 truncate">
          <span className="truncate text-[14px] font-extrabold text-white">{nombreNegocio}</span>
          {todasLasFilas.length > 1 && (
            <>
              <span aria-hidden className="h-4 w-px shrink-0" style={{ background: RAIL_LINEA }} />
              <span className="truncate text-[12.5px] font-bold text-aventurea-rail">
                {(p.nombre as string) ?? "Tarjeta"}
              </span>
            </>
          )}
        </p>
        {todasLasFilas.length > 1 && (
          <Link
            href={`/${slug}/scan`}
            className="shrink-0 text-[12px] font-bold text-aventurea-rail hover:text-white"
          >
            Cambiar tarjeta
          </Link>
        )}
        <Link
          href={`/lealtad/panel/${ranchoId}`}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-bold text-aventurea-rail hover:text-white"
          style={{ borderColor: "rgba(255,255,255,.18)" }}
        >
          Panel completo →
        </Link>
      </header>

      <main className="px-4 py-5 sm:px-6 sm:py-7">
        <div className="mx-auto w-full max-w-[720px]">
          <ModoMostrador
            ranchoId={ranchoId}
            programaId={p.id as string}
            pideMonto={pideMonto}
            tipo={(p.modo as string | null) ?? null}
            permisos={acceso.permisos}
            productos={productosDeVenta}
            recompensa={
              meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
            }
            permitirManual={p.permite_manual_en_link === true}
          />
        </div>
      </main>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────────

function Pantalla({
  nombreNegocio,
  children,
}: {
  nombreNegocio?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="lealtad-oscuro flex min-h-svh flex-col items-center justify-center px-5 py-12"
      style={{ background: NAVY_PROFUNDO }}
    >
      <div className="w-full max-w-sm text-center">
        {nombreNegocio && (
          <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.08em] text-aventurea-rail">
            {nombreNegocio}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

function Mensaje({
  titulo,
  texto,
  enlace,
  textoEnlace = "Ir ahí →",
}: {
  titulo: string;
  texto: string;
  enlace?: string;
  textoEnlace?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
      <p className="text-[15px] font-extrabold text-white">{titulo}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-aventurea-rail">{texto}</p>
      {enlace && (
        <Link
          href={enlace}
          className="mt-3 inline-block text-[12.5px] font-bold text-white underline underline-offset-2"
        >
          {textoEnlace}
        </Link>
      )}
    </div>
  );
}
