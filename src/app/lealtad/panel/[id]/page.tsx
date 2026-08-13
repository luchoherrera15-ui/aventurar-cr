import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe } from "@/lib/lealtad/planes";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { hoyISOCR } from "@/lib/fechas";
import SeccionProgramas, { type ProgramaEnLista } from "./seccion-programas";
import { estadoDelPrograma } from "@/lib/lealtad/reglas";
import { permisosDeFila } from "@/lib/lealtad/permisos";
import ShellLealtad, { type GrupoLealtad } from "./shell-lealtad";
import InicioLealtad, { type PasoPrimero } from "./inicio-lealtad";
import ModoMostrador from "./modo-mostrador";
import BotonEscanear from "./boton-escanear";
import LealtadEstado from "./lealtad-estado";
import CompartirTarjeta from "./compartir-tarjeta";
import { SeccionRecompensas, SeccionTarjeta } from "./pases-panel";
import SeccionPlan from "./seccion-plan";
import { ProveedorPrograma } from "./programa-contexto";
import MetricasLealtad from "./metricas";
import AuditoriaResumen from "./auditoria-resumen";
import EquipoLealtad, { type MiembroEquipo } from "./equipo-cliente";
import { ActividadLealtad, IntegracionesLealtad, WalletLealtad } from "./lealtad-secciones";
import type { ProgramaFila, RecompensaFila } from "./pases-actions";

/**
 * LA interfaz del programa de lealtad de un negocio.
 *
 * Menú lateral con las secciones agrupadas (el shell vive en
 * shell-lealtad.tsx), tema navy de la marca de lealtad, y el contenido
 * en tarjetas translúcidas que el bloque .lealtad-oscuro de globals.css
 * re-mapea desde los componentes del panel claro.
 *
 * QUÉ VE CADA QUIEN lo decide el servidor, acá, y no el navegador
 * (0127). El shell solo pinta la lista de secciones que le llega:
 *
 *   Inicio · Clientes · Póster · Mi perfil  → todos los que entran
 *   Actividad · Métricas                    → permiso `auditoria`
 *   Equipo · Negocio · Recompensas ·
 *   Tarjeta digital · Plan                  → el dueño (y Bookea)
 *   Modo mostrador                          → permiso `acreditar`
 *
 * «Recompensas» y «Tarjeta digital» editan la misma fila, así que van
 * envueltas en <ProveedorPrograma>: un solo borrador para las dos, o
 * guardar en una revierte lo que se guardó en la otra.
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
      <Antesala nombre={rancho.nombre}>
        <p className="text-[15px] font-extrabold text-white">Tu negocio está en revisión</p>
        <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-white/60">
          El equipo de Bookea revisa cada negocio nuevo antes de habilitarle el programa de
          lealtad. Te avisamos al correo apenas quede aprobado — de ahí elegís tu paquete y
          dejás la solicitud.
        </p>
      </Antesala>
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
      <Antesala nombre={rancho.nombre}>
        {solicitud ? (
          <>
            <p className="text-[15px] font-extrabold text-white">
              Tu solicitud del plan {definicionDe(solicitud.plan as string)?.nombre ?? ""} está en
              revisión
            </p>
            <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-white/60">
              El equipo de Bookea la está armando para que quede bien. Te avisamos al correo
              cuando el programa esté activo.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-extrabold text-white">
              Este negocio todavía no tiene el programa de lealtad
            </p>
            <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-white/60">
              Elegí tu paquete y dejá la solicitud: el equipo de Bookea genera el programa y la
              tarjeta por vos, y te avisa cuando esté listo.
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
      </Antesala>
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

  // Cuánta gente se afilió: la última casilla de «Primeros pasos». Se
  // cuenta con `head` — el número, sin traerse las filas.
  const { count: totalMiembros } = admin && p
    ? await admin
        .from("miembros")
        .select("*", { count: "exact", head: true })
        .eq("programa_id", p.id)
    : { count: 0 };
  const miembros = totalMiembros ?? 0;

  // ── TODAS las tarjetas del negocio ─────────────────────────────
  // Desde la 0134 puede haber varias (el `unique(rancho_id)` se
  // liberó). `select *` porque las columnas de las 0134/0135/0136
  // pueden no existir todavía y una lista explícita fallaría entera.
  const { data: filasProgramas } = admin
    ? await admin.from("programa_lealtad").select("*").eq("rancho_id", id)
    : { data: [] };

  const todasLasFilas = (filasProgramas ?? []) as Record<string, unknown>[];

  // Los miembros de cada una, en UNA consulta y no una por tarjeta.
  const idsProgramas = todasLasFilas.map((f) => f.id as string);
  const { data: filasMiembros } = admin && idsProgramas.length
    ? await admin.from("miembros").select("programa_id").in("programa_id", idsProgramas)
    : { data: [] };
  const miembrosPorPrograma = new Map<string, number>();
  for (const m of (filasMiembros ?? []) as { programa_id: string }[]) {
    miembrosPorPrograma.set(m.programa_id, (miembrosPorPrograma.get(m.programa_id) ?? 0) + 1);
  }

  const programasEnLista: ProgramaEnLista[] = todasLasFilas.map((f) => ({
    id: f.id as string,
    nombre: (f.nombre as string) ?? "Tarjeta",
    modo: (f.modo as string | null) ?? null,
    estado: (f.estado as string | null) ?? null,
    activo: !!f.activo,
    vigente_desde: (f.vigente_desde as string | null) ?? null,
    vigente_hasta: (f.vigente_hasta as string | null) ?? null,
    colorFondo: (f.pase_color_fondo as string | null) ?? null,
    miembros: miembrosPorPrograma.get(f.id as string) ?? 0,
  }));

  // El complemento de cercanía (0123): lo pide el editor de la tarjeta
  // para saber si ofrece el aviso por ubicación.
  const { data: cercania } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: id,
    p_addon: "pases_cercania",
  });

  // Quién está mirando: el nombre sale de `perfiles`, nunca de la
  // metadata que el cliente puede escribir.
  const { data: perfil } = await acceso.supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", acceso.user.id)
    .maybeSingle();
  const nombreUsuario =
    ((perfil?.nombre as string | null) ?? "").trim() || (acceso.user.email ?? "Tu cuenta");

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

  // ── Las secciones según el permiso ──────────────────────────────────
  // «Negocio», «Recompensas», «Tarjeta digital» y «Plan» son del DUEÑO:
  // colores, logo, regalías y paquete se tocan sin pedirle permiso a
  // nadie. Los colaboradores no las ven — su checklist gobierna la
  // operación diaria, no la identidad ni la plata de la marca.
  const puedeDisenar = acceso.esDueno || acceso.esAdmin;
  const slug = rancho.slug as string | null;

  // El plan sale de la CUENTA desde la 0134 (`cuentas.plan`), con el
  // del rancho como respaldo mientras la migración no esté corrida.
  // Toda la pantalla —topes, capacidades, medidores— cuelga de acá,
  // así que resolverlo en UN lugar evita que media pantalla muestre el
  // plan nuevo y la otra media el viejo.
  const { plan } = admin
    ? await contextoDeCuenta(admin, (programa ?? {}) as Record<string, unknown>, {
        planRancho: rancho.plan_lealtad as string | null,
      })
    : { plan: (rancho.plan_lealtad as string | null) ?? null };
  const def = definicionDe(plan);
  const topeProgramas = def?.limites.programas ?? null;

  // El "ahora" en hora de Costa Rica, resuelto UNA vez en el servidor.
  // De acá salen los estados «programada» y «vencida»: si cada tarjeta
  // leyera su propio reloj, una lista larga podría cruzar la medianoche
  // a la mitad y mostrar dos verdades distintas en la misma pantalla.
  const ahoraCR = `${hoyISOCR()}T${new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())}`;

  const grupos: GrupoLealtad[] = [
    {
      titulo: "Principal",
      items: [
        { id: "inicio", etiqueta: "Inicio", icono: "inicio" as const },
        { id: "programas", etiqueta: "Tarjetas", icono: "tarjeta" as const },
        { id: "clientes", etiqueta: "Clientes", icono: "clientes" as const },
        ...(permisos.auditoria
          ? [
              { id: "actividad", etiqueta: "Actividad", icono: "actividad" as const },
              { id: "metricas", etiqueta: "Métricas", icono: "metricas" as const },
            ]
          : []),
        ...(puedeEquipo ? [{ id: "equipo", etiqueta: "Equipo", icono: "equipo" as const }] : []),
      ],
    },
    {
      titulo: "Configuración",
      items: [
        ...(puedeDisenar
          ? [
              { id: "negocio", etiqueta: "Negocio", icono: "negocio" as const },
              { id: "recompensas", etiqueta: "Recompensas", icono: "recompensas" as const },
              { id: "tarjeta", etiqueta: "Tarjeta digital", icono: "tarjeta" as const },
            ]
          : []),
        { id: "poster", etiqueta: "Póster y QR", icono: "poster" as const },
        ...(puedeDisenar ? [{ id: "plan", etiqueta: "Plan y facturación", icono: "plan" as const }] : []),
      ],
    },
    {
      titulo: "Cuenta",
      items: [{ id: "perfil", etiqueta: "Mi perfil", icono: "perfil" as const }],
    },
  ];

  // Un botón que apunta a una sección que quien mira no tiene es un
  // callejón sin salida: el ancla solo se pinta si la sección existe.
  const visibles = new Set(grupos.flatMap((g) => g.items).map((i) => i.id));
  const irA = (seccion: string, texto: string) =>
    visibles.has(seccion) ? { texto, href: `#${seccion}` } : null;

  const reglasDan = p ? p.puntos_por_visita > 0 || Number(p.puntos_por_colon) > 0 : false;
  const pasos: PasoPrimero[] = [
    {
      titulo: "Tu negocio está creado",
      detalle: `${rancho.nombre} ya existe en Bookea con su programa de lealtad.`,
      listo: true,
      cta: irA("negocio", "Ver los datos"),
    },
    {
      titulo: "Definí cómo se gana y qué se gana",
      detalle: meta
        ? `La meta es ${meta.nombre} a los ${meta.costo_puntos}.`
        : "Sin una recompensa activa, la tarjeta no promete nada.",
      listo: !!meta && reglasDan,
      cta: irA("recompensas", "Configurar"),
    },
    {
      // "Listo" = el QR EXISTE y lleva a algún lado (programa activo y
      // página publicada). Si el programa está pausado o el negocio no
      // tiene slug, el póster imprimiría un código que responde "no
      // encontrado" — eso no es un paso cumplido.
      titulo: "Publicá tu tarjeta y tu QR",
      detalle: programaActivo && slug
        ? "Ya funciona: imprimí el póster y pegalo en la caja para que se afilien solos."
        : "Con el programa activo y tu página publicada, el QR queda listo para imprimir.",
      listo: programaActivo && !!slug,
      cta: irA("poster", "Imprimir el póster"),
    },
    {
      titulo: "Conseguí tu primer cliente",
      detalle:
        miembros > 0
          ? `Ya llevás ${miembros} ${miembros === 1 ? "afiliado" : "afiliados"}.`
          : "Nadie se ha afiliado todavía. El QR y el link son el camino.",
      listo: miembros > 0,
      cta: irA("clientes", "Ver clientes"),
    },
  ];

  const contenidos: Record<string, React.ReactNode> = {
    inicio: (
      <InicioLealtad
        nombre={rancho.nombre}
        modo={(p?.modo ?? "sellos") as "sellos" | "puntos" | "cashback"}
        regalia={meta ? { nombre: meta.nombre, costo: meta.costo_puntos } : null}
        pasos={pasos}
        accion={
          p && permisos.acreditar ? (
            <BotonEscanear
              ranchoId={id}
              pideMonto={(p.modo ?? "puntos") !== "sellos"}
              recompensa={
                meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
              }
            />
          ) : null
        }
      />
    ),

    programas: (
      <Seccion
        titulo="Tarjetas"
        bajada="Todos los programas de tu negocio, con su estado y su gente."
      >
        <SeccionProgramas
          ranchoId={id}
          programas={programasEnLista}
          ahoraCR={ahoraCR}
          puedeCrear={puedeDisenar}
          topeAlcanzado={topeProgramas !== null && programasEnLista.length >= topeProgramas}
          topePlan={topeProgramas}
        />
      </Seccion>
    ),

    clientes: (
      <Seccion
        titulo="Clientes"
        bajada="Quién se afilió, cuánto lleva cada quien y a quién le toca su regalía."
      >
        {p ? (
          <LealtadEstado programaId={p.id} plan={plan} meta={meta?.costo_puntos ?? null} />
        ) : (
          <Vacio texto="Tu plan está activo y el equipo de Bookea está armando el programa y la tarjeta. Te avisamos al correo cuando esté listo." />
        )}
      </Seccion>
    ),

    poster: (
      <Seccion
        titulo="Póster y QR"
        bajada="Con esto tus clientes consiguen la tarjeta: el código para el mostrador y el link para mandar."
      >
        <Link
          href={`/lealtad/panel/${id}/poster`}
          className="flex items-center justify-between rounded-2xl border px-4 py-4 transition-colors hover:border-white/40"
          style={{ background: "rgba(238,116,32,.09)", borderColor: NARANJA }}
        >
          <span>
            <span className="block text-[14px] font-extrabold text-white">
              Diseñá e imprimí tu póster
            </span>
            <span className="block text-[12.5px] text-white/60">
              Hoja A4 lista para pegar en la caja, con tu QR, tus colores y tu regalía.
            </span>
          </span>
          <span aria-hidden className="ml-3 shrink-0 text-[18px]" style={{ color: NARANJA }}>
            →
          </span>
        </Link>
        <CompartirTarjeta slug={slug} programaActivo={programaActivo} />
      </Seccion>
    ),

    perfil: (
      <Seccion titulo="Mi perfil" bajada="Tu cuenta de Bookea — la misma para todo el sistema.">
        <div className="rounded-2xl border border-aventurea-line bg-white p-5">
          <p className="text-[15px] font-extrabold text-aventurea-ink">{nombreUsuario}</p>
          <p className="mt-0.5 text-[13px] text-aventurea-ink-soft">{acceso.user.email}</p>
          <p className="mt-3 text-[12.5px] text-aventurea-ink-soft">
            En {rancho.nombre} sos{" "}
            <strong>
              {acceso.esAdmin ? "administrador de Bookea" : acceso.esDueno ? "el dueño" : "colaborador"}
            </strong>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/cuenta"
              className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
            >
              Tu cuenta en Bookea →
            </Link>
            <Link
              href="/lealtad/panel"
              className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
            >
              Cambiar de negocio →
            </Link>
          </div>
        </div>
      </Seccion>
    ),

    ...(permisos.auditoria
      ? {
          actividad: (
            <Seccion
              titulo="Actividad"
              bajada="Quién hizo qué y cuándo. Todo movimiento queda escrito; nada se borra."
            >
              <Rotulo>Quién hizo qué — últimos 30 días</Rotulo>
              <AuditoriaResumen programaId={p?.id ?? null} />
              <Rotulo className="mt-6">El libro, movimiento por movimiento</Rotulo>
              <ActividadLealtad ranchoId={id} programaId={p?.id ?? null} />
              <Rotulo className="mt-6">Canjes por pasar a la caja</Rotulo>
              <IntegracionesLealtad ranchoId={id} programaId={p?.id ?? null} />
            </Seccion>
          ),
          metricas: (
            <Seccion
              titulo="Métricas"
              bajada="¿Está creciendo el programa? Los últimos 30 días contra los 30 anteriores."
            >
              <MetricasLealtad programaId={p?.id ?? null} plan={plan} />
              <Rotulo className="mt-6">Estado de las tarjetas</Rotulo>
              <WalletLealtad programaId={p?.id ?? null} />
            </Seccion>
          ),
        }
      : {}),

    ...(puedeEquipo
      ? {
          equipo: (
            <Seccion
              titulo="Equipo"
              bajada="Quién puede dar sellos, canjear, revertir y ver la auditoría."
            >
              <EquipoLealtad ranchoId={id} equipo={equipo} />
            </Seccion>
          ),
        }
      : {}),

    ...(puedeDisenar
      ? {
          negocio: (
            <Seccion
              titulo="Negocio"
              bajada="Los datos con los que tu cliente te reconoce en la tarjeta y en la página."
            >
              <div className="rounded-2xl border border-aventurea-line bg-white p-5">
                <Campo etiqueta="Nombre" valor={rancho.nombre} />
                <Campo etiqueta="Dirección de tu tarjeta" valor={slug ? `/tarjeta/${slug}` : "Sin publicar"} />
                <Campo etiqueta="Plan de lealtad" valor={def ? def.nombre : "Sin plan"} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/mi-negocio/${id}`}
                    className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
                  >
                    Editar en tu panel de negocio →
                  </Link>
                  {slug && (
                    <Link
                      href={`/tarjeta/${slug}`}
                      className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
                    >
                      Ver la tarjeta del cliente →
                    </Link>
                  )}
                </div>
              </div>
            </Seccion>
          ),
          recompensas: (
            <Seccion
              titulo="Recompensas"
              bajada="Cómo se ganan los sellos y qué se lleva el cliente al completarlos."
            >
              <Link
                href={`/lealtad/panel/${id}/crear`}
                className="flex items-center justify-between rounded-2xl border px-4 py-4 transition-colors hover:border-white/40"
                style={{ background: "rgba(255,106,0,.09)", borderColor: NARANJA }}
              >
                <span>
                  <span className="block text-[14px] font-extrabold text-white">
                    Crear una tarjeta
                  </span>
                  <span className="block text-[12.5px] text-white/60">
                    Sellos, puntos, cupón, descuento, membresía, gift card, evento o
                    cashback — en cinco pasos.
                  </span>
                </span>
                <span aria-hidden className="ml-3 shrink-0 text-[18px]" style={{ color: NARANJA }}>
                  →
                </span>
              </Link>
              <SeccionRecompensas />
            </Seccion>
          ),
          tarjeta: (
            <Seccion
              titulo="Tarjeta digital"
              bajada="Cómo se ve el pase que tu cliente guarda en el Wallet del teléfono."
            >
              <SeccionTarjeta />
            </Seccion>
          ),
          plan: (
            <Seccion
              titulo="Plan y facturación"
              bajada="Qué incluye tu paquete, cuánto llevás consumido y qué gana si subís."
            >
              <SeccionPlan
                ranchoId={id}
                plan={plan}
                miembros={miembros}
                equipo={equipo.length}
              />
            </Seccion>
          ),
        }
      : {}),
  };

  return (
    <ProveedorPrograma
      ranchoId={id}
      programaInicial={p}
      recompensasIniciales={lista}
      tieneCercania={cercania === true}
    >
      <ShellLealtad
        negocio={{ nombre: rancho.nombre, plan: def ? `Plan ${def.nombre}` : null }}
        usuario={{ nombre: nombreUsuario, email: acceso.user.email ?? "" }}
        grupos={grupos}
        contenidos={contenidos}
        mostrador={
          p && permisos.acreditar ? (
            <ModoMostrador
              ranchoId={id}
              pideMonto={(p.modo ?? "puntos") !== "sellos"}
              recompensa={
                meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
              }
            />
          ) : undefined
        }
      />
    </ProveedorPrograma>
  );
}

// ── Piezas ────────────────────────────────────────────────────────────

/**
 * La pantalla de los negocios que todavía no tienen nada que
 * administrar (en revisión, o sin el complemento). No lleva menú
 * lateral a propósito: no hay a dónde navegar.
 */
function Antesala({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <main className="lealtad-oscuro min-h-svh px-5 py-8" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[720px]">
        <header className="flex items-center justify-between">
          <Link
            href="/lealtad/panel"
            className="text-[12.5px] font-bold text-white/50 hover:text-white"
          >
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

        <h1 className="mt-6 text-[24px] font-extrabold text-white">{nombre}</h1>

        <div
          className="mt-5 rounded-3xl border px-5 py-10 text-center"
          style={{ background: "rgba(255,255,255,.035)", borderColor: "rgba(255,255,255,.09)" }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

function Seccion({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[21px] font-extrabold leading-tight text-white sm:text-[23px]">
          {titulo}
        </h2>
        <p className="mt-1 text-[13.5px] text-white/55">{bajada}</p>
      </div>
      {children}
    </div>
  );
}

function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h3
      className={`mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45 ${className}`}
    >
      {children}
    </h3>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
      {texto}
    </p>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border-b border-aventurea-line py-2.5 first:pt-0 last:border-b-0">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {etiqueta}
      </p>
      <p className="mt-0.5 text-[13.5px] font-bold text-aventurea-ink">{valor}</p>
    </div>
  );
}
