"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ADDONS,
  DURACIONES,
  estadoDeAddon,
  nombreAddon,
  type AddonId,
  type EstadoAddon,
} from "@/lib/addons";
import { activarAddon, desactivarAddon } from "./actions";
import { asignarPlanLealtad } from "./plan-actions";
import { estadoDelLimite, PLANES, PLANES_ID } from "@/lib/lealtad/planes";
import {
  avisosDeCambioDePlan,
  CONCEPTO_AYUDA,
  CONCEPTO_LABEL,
  CONCEPTOS_PLAN,
  estadoDeCortesia,
  motivoObligatorio,
  MOTIVO_MAX,
  resumenDePlan,
  type ConceptoPlan,
} from "@/lib/lealtad/regalias";
import { perteneceASeccion, SECCION_CORTA, SECCION_LABEL, type SeccionAdmin } from "../vertical";

export type FilaAddon = {
  rancho_id: string;
  addon: string;
  activo: boolean;
  vence_en: string | null;
  notas: string | null;
  activado_en: string | null;
  /** 0173. Se REGALÓ: no entró plata por esta fila. */
  es_cortesia: boolean;
};

/** El último movimiento de paquete registrado (0173). */
export type MovimientoPlan = {
  /** 'venta' | 'cortesia' | 'correccion' | 'baja'. */
  concepto: string;
  motivo: string | null;
  /** El paquete que quedó tras el movimiento. */
  plan: string | null;
  /** ISO. Solo para regalías. null = indefinida. */
  cortesiaHasta: string | null;
  creadoEn: string;
  /** Nombre o correo del admin que lo hizo. null = no se pudo resolver. */
  autor: string | null;
};

export type NegocioConAddons = {
  id: string;
  nombre: string;
  slug: string | null;
  vertical: string | null;
  estado: string | null;
  addons: FilaAddon[];
  /** El plan EFECTIVO: `cuentas.plan ?? ranchos.plan_lealtad` (0134). */
  planLealtad: string | null;
  /** Lo que dice `ranchos.plan_lealtad`. */
  planRancho: string | null;
  /** Lo que dice `cuentas.plan`. null = sin cuenta o sin plan en ella. */
  planCuenta: string | null;
  tieneCuenta: boolean;
  /** Clientes activos (mismo conteo que la puerta de Wallet). */
  miembros: number;
  /** Tarjetas que ocupan cupo. null = no se pudieron contar todas. */
  tarjetas: number | null;
  /** Tarjetas operando ahora mismo. */
  tarjetasActivas: number | null;
  /** ISO. Desde cuándo existe el negocio. */
  creadoEn: string | null;
  /** Estado de la suscripción de Stripe (0143). null = no tiene. */
  stripe: string | null;
  movimiento: MovimientoPlan | null;
};

const CHIP: Record<EstadoAddon, string> = {
  activo: "bg-aventurea-green-light text-aventurea-green",
  vencido: "bg-aventurea-sky-light text-aventurea-orange-dark",
  apagado: "bg-aventurea-cream-2 text-aventurea-ink-soft",
};

const ETIQUETA: Record<EstadoAddon, string> = {
  activo: "Activo",
  vencido: "Vencido",
  apagado: "Sin contratar",
};

/** Cuántas filas se pintan a la vez. */
const POR_PAGINA = 50;

function fechaCorta(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("es-CR");
}

function diasPara(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

/** El nombre del paquete tal como se muestra. null = sin paquete. */
function nombrePlan(plan: string | null): string {
  if (!plan) return "Sin plan";
  return (PLANES_ID as readonly string[]).includes(plan)
    ? PLANES[plan as keyof typeof PLANES].nombre
    : plan;
}

/** ¿Este negocio tiene HOY un paquete regalado? */
function regaliaDePlan(n: NegocioConAddons) {
  const m = n.movimiento;
  // El movimiento tiene que seguir siendo el que explica el paquete de
  // hoy: si después alguien lo cambió por otra puerta —el webhook de
  // Stripe, el alta automática— la regalía ya no describe la realidad y
  // afirmar que sigue vigente sería inventar.
  if (!m || m.concepto !== "cortesia" || m.plan !== n.planLealtad) return null;
  return { ...m, estado: estadoDeCortesia(m.cortesiaHasta) };
}

/** Los complementos regalados y encendidos de un negocio. */
function regaliasDeAddons(n: NegocioConAddons) {
  return n.addons.filter((a) => a.es_cortesia && estadoDeAddon(a) !== "apagado");
}

type Campo = "nombre" | "categoria" | "plan" | "clientes" | "desde";
type Filtro = "todos" | "sin_plan" | "con_plan" | "regalia" | "stripe" | "vencido";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "con_plan", label: "Con paquete" },
  { id: "sin_plan", label: "Sin paquete" },
  { id: "regalia", label: "Con regalía" },
  { id: "stripe", label: "Pagan con tarjeta" },
  { id: "vencido", label: "Con algo vencido" },
];

/**
 * LA ADMINISTRACIÓN DEL MÓDULO DE LEALTAD.
 *
 * Primero la LISTA —todos los negocios, su paquete, sus clientes y sus
 * complementos— y después el detalle del que se elija. La versión
 * anterior era al revés: una columna angosta de nombres y todo el
 * contenido en el panel del negocio abierto. Eso sirve para editar uno;
 * no contesta «¿quién está en Impulso?», «¿a quién se le vence algo
 * este mes?» ni «¿qué estamos regalando?».
 */
export default function ComplementosPanel({
  negocios,
  seccion,
  faltaLaBitacora,
  negociosOcultosPorTope,
  totalNegocios,
  conteoTruncado,
  conteoAMano,
  tarjetasCompletas,
}: {
  negocios: NegocioConAddons[];
  /** Sección activa del panel (cookie admin_seccion). */
  seccion: SeccionAdmin;
  /** La bitácora de planes no se pudo leer: falta pegar la 0173. */
  faltaLaBitacora: boolean;
  /** Negocios que quedaron fuera por el techo de la consulta. */
  negociosOcultosPorTope: number;
  totalNegocios: number;
  /** El conteo de clientes se topó y hay negocios por debajo del real. */
  conteoTruncado: boolean;
  /** El conteo se hizo a mano porque falta la función de la 0173. */
  conteoAMano: boolean;
  /** Se pudieron contar TODAS las tarjetas. */
  tarjetasCompletas: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [soloSeccion, setSoloSeccion] = useState(seccion !== "todas");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [filtroPlan, setFiltroPlan] = useState<string>("todos");
  const [campo, setCampo] = useState<Campo>("nombre");
  const [desc, setDesc] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [elegido, setElegido] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    // Buscar IGNORA la sección Y los filtros: si alguien escribe el
    // nombre de un negocio, lo está buscando, no filtrando. Que no
    // aparezca por culpa de una cookie de otra pantalla es el peor
    // resultado posible — parece que el negocio no existe.
    if (q) {
      return negocios.filter(
        (n) => n.nombre.toLowerCase().includes(q) || (n.slug ?? "").includes(q),
      );
    }

    return negocios.filter((n) => {
      if (soloSeccion && seccion !== "todas" && !perteneceASeccion(n.vertical, seccion)) {
        return false;
      }
      if (filtroPlan !== "todos") {
        if (filtroPlan === "sin" ? n.planLealtad !== null : n.planLealtad !== filtroPlan) {
          return false;
        }
      }
      if (filtro === "con_plan" && !n.planLealtad) return false;
      if (filtro === "sin_plan" && n.planLealtad) return false;
      if (filtro === "regalia" && !regaliaDePlan(n) && regaliasDeAddons(n).length === 0) {
        return false;
      }
      if (filtro === "stripe" && n.stripe !== "activa" && n.stripe !== "en_prueba") return false;
      if (filtro === "vencido" && !n.addons.some((a) => estadoDeAddon(a) === "vencido")) {
        return false;
      }
      return true;
    });
  }, [negocios, busqueda, soloSeccion, seccion, filtro, filtroPlan]);

  const ordenados = useMemo(() => {
    const orden = (a: NegocioConAddons, b: NegocioConAddons) => {
      switch (campo) {
        case "categoria":
          return (
            (SECCION_CORTA[a.vertical ?? ""] ?? "zzz").localeCompare(
              SECCION_CORTA[b.vertical ?? ""] ?? "zzz",
              "es",
            ) || a.nombre.localeCompare(b.nombre, "es")
          );
        case "plan":
          // Por posición en el catálogo (de menor a mayor), no
          // alfabético: «Starter, Impulso, Ilimitado» ordenado por
          // nombre no dice nada.
          return (
            indicePlan(a.planLealtad) - indicePlan(b.planLealtad) ||
            a.nombre.localeCompare(b.nombre, "es")
          );
        case "clientes":
          return a.miembros - b.miembros || a.nombre.localeCompare(b.nombre, "es");
        case "desde":
          return (a.creadoEn ?? "").localeCompare(b.creadoEn ?? "");
        default:
          return a.nombre.localeCompare(b.nombre, "es");
      }
    };
    const lista = [...filtrados].sort(orden);
    return desc ? lista.reverse() : lista;
  }, [filtrados, campo, desc]);

  const paginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, paginas - 1);
  const visibles = ordenados.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA);

  const negocio = negocios.find((n) => n.id === elegido) ?? null;

  function ordenarPor(nuevo: Campo) {
    if (nuevo === campo) setDesc((d) => !d);
    else {
      setCampo(nuevo);
      setDesc(nuevo === "clientes" || nuevo === "desde");
    }
    setPagina(0);
  }

  return (
    <div>
      {/* ── Lo que la pantalla NO puede garantizar ────────────────── */}
      <Advertencias
        faltaLaBitacora={faltaLaBitacora}
        negociosOcultosPorTope={negociosOcultosPorTope}
        totalNegocios={totalNegocios}
        conteoTruncado={conteoTruncado}
        conteoAMano={conteoAMano}
        tarjetasCompletas={tarjetasCompletas}
      />

      <BandejaRegalias negocios={negocios} onElegir={setElegido} />

      {/* ── Buscar y filtrar ──────────────────────────────────────── */}
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(0);
          }}
          placeholder="Buscar un negocio por nombre… (busca en todas las secciones y sin filtros)"
          className="w-full rounded-[10px] border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400"
        />
        <select
          value={filtroPlan}
          onChange={(e) => {
            setFiltroPlan(e.target.value);
            setPagina(0);
          }}
          className="rounded-[10px] border border-aventurea-line bg-white px-3 py-2.5 text-[13px] text-aventurea-ink"
        >
          <option value="todos">Cualquier paquete</option>
          <option value="sin">Sin paquete</option>
          {PLANES_ID.map((id) => (
            <option key={id} value={id}>
              {PLANES[id].nombre}
              {PLANES[id].vigente ? "" : " (retirado)"}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px]">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFiltro(f.id);
              setPagina(0);
            }}
            className={`rounded-full px-3 py-1 font-bold ${
              filtro === f.id
                ? "bg-aventurea-navy text-white"
                : "border border-aventurea-line bg-white text-aventurea-ink-soft"
            }`}
          >
            {f.label}
          </button>
        ))}

        {!busqueda.trim() && seccion !== "todas" && (
          <label className="flex cursor-pointer items-center gap-2 font-bold text-aventurea-ink-soft">
            <input
              type="checkbox"
              checked={soloSeccion}
              onChange={(e) => {
                setSoloSeccion(e.target.checked);
                setPagina(0);
              }}
              className="h-4 w-4 accent-aventurea-navy"
            />
            Solo {SECCION_LABEL[seccion]}
          </label>
        )}

        <span className="ml-auto text-aventurea-ink-soft">
          {ordenados.length} de {negocios.length} negocio{negocios.length === 1 ? "" : "s"}
          {busqueda.trim() ? " (buscando en todos)" : ""}
        </span>
      </div>

      {/* ── LA LISTA ──────────────────────────────────────────────── */}
      {ordenados.length === 0 ? (
        <p className="rounded-2xl border border-aventurea-line bg-white p-8 text-center text-[13.5px] text-aventurea-ink-soft">
          Ningún negocio con eso.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-white">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-aventurea-line bg-aventurea-cream-2/50 text-left text-[11px] uppercase tracking-[0.1em] text-aventurea-ink-soft">
                <Encabezado campo="nombre" actual={campo} desc={desc} onClick={ordenarPor}>
                  Negocio
                </Encabezado>
                <Encabezado campo="categoria" actual={campo} desc={desc} onClick={ordenarPor}>
                  Categoría
                </Encabezado>
                <Encabezado campo="plan" actual={campo} desc={desc} onClick={ordenarPor}>
                  Paquete
                </Encabezado>
                <Encabezado campo="clientes" actual={campo} desc={desc} onClick={ordenarPor}>
                  Clientes
                </Encabezado>
                <th className="px-3 py-2.5 font-bold">Tarjetas</th>
                <th className="px-3 py-2.5 font-bold">Complementos</th>
                <th className="px-3 py-2.5 font-bold">Vence</th>
                <Encabezado campo="desde" actual={campo} desc={desc} onClick={ordenarPor}>
                  Cliente desde
                </Encabezado>
              </tr>
            </thead>
            <tbody>
              {visibles.map((n) => (
                <Fila
                  key={n.id}
                  negocio={n}
                  elegido={elegido === n.id}
                  onElegir={() => setElegido(elegido === n.id ? null : n.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginado. Se dice SIEMPRE cuántas filas se están viendo de
          cuántas: una lista que corta en silencio hace creer que lo que
          no aparece no existe. */}
      {ordenados.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] text-aventurea-ink-soft">
          <span>
            Mostrando {paginaSegura * POR_PAGINA + 1}–
            {Math.min((paginaSegura + 1) * POR_PAGINA, ordenados.length)} de {ordenados.length}
          </span>
          {paginas > 1 && (
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={paginaSegura === 0}
                onClick={() => setPagina(paginaSegura - 1)}
                className="rounded-lg border border-aventurea-line bg-white px-3 py-1 font-bold text-aventurea-ink disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {paginaSegura + 1} de {paginas}
              </span>
              <button
                type="button"
                disabled={paginaSegura >= paginas - 1}
                onClick={() => setPagina(paginaSegura + 1)}
                className="rounded-lg border border-aventurea-line bg-white px-3 py-1 font-bold text-aventurea-ink disabled:opacity-40"
              >
                Siguiente
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── El detalle del elegido ────────────────────────────────── */}
      {negocio && (
        <Detalle negocio={negocio} onCerrar={() => setElegido(null)} faltaLaBitacora={faltaLaBitacora} />
      )}
    </div>
  );
}

/** Posición del paquete en el catálogo, para ordenar de menor a mayor. */
function indicePlan(plan: string | null): number {
  if (!plan) return -1;
  const i = (PLANES_ID as readonly string[]).indexOf(plan);
  return i < 0 ? 99 : i;
}

function Encabezado({
  campo,
  actual,
  desc,
  onClick,
  children,
}: {
  campo: Campo;
  actual: Campo;
  desc: boolean;
  onClick: (c: Campo) => void;
  children: React.ReactNode;
}) {
  return (
    <th className="px-3 py-2.5 font-bold">
      <button
        type="button"
        onClick={() => onClick(campo)}
        className={`flex items-center gap-1 uppercase tracking-[0.1em] ${
          actual === campo ? "text-aventurea-navy" : ""
        }`}
      >
        {children}
        {actual === campo && <span aria-hidden="true">{desc ? "↓" : "↑"}</span>}
      </button>
    </th>
  );
}

function Fila({
  negocio: n,
  elegido,
  onElegir,
}: {
  negocio: NegocioConAddons;
  elegido: boolean;
  onElegir: () => void;
}) {
  const activos = n.addons.filter((a) => estadoDeAddon(a) === "activo");
  const vencidos = n.addons.filter((a) => estadoDeAddon(a) === "vencido");
  const limite = estadoDelLimite(n.planLealtad, "clientesActivos", n.miembros);
  const regalia = regaliaDePlan(n);
  const proximo = n.addons
    .filter((a) => a.activo && a.vence_en)
    .map((a) => a.vence_en as string)
    .sort()[0];
  const dias = diasPara(proximo ?? null);
  const discrepa =
    n.tieneCuenta && n.planCuenta !== null && n.planCuenta !== n.planRancho;

  return (
    <tr
      onClick={onElegir}
      className={`cursor-pointer border-b border-aventurea-line/70 last:border-b-0 ${
        elegido ? "bg-aventurea-navy/[0.06]" : "hover:bg-aventurea-cream-2/50"
      }`}
    >
      <td className="px-3 py-2.5">
        <span className="font-bold text-aventurea-ink">{n.nombre}</span>
        {n.estado !== "aprobado" && (
          <span className="ml-2 rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
            {n.estado ?? "sin estado"}
          </span>
        )}
        {discrepa && (
          <span
            title="La cuenta y el negocio guardan paquetes distintos, y el que manda es el de la cuenta."
            className="ml-2 rounded-full bg-aventurea-sky-light px-2 py-0.5 text-[10.5px] font-bold text-aventurea-orange-dark"
          >
            dato cruzado
          </span>
        )}
      </td>

      <td className="px-3 py-2.5 text-aventurea-ink-soft">
        {SECCION_CORTA[n.vertical ?? ""] ?? "sin categoría"}
      </td>

      <td className="px-3 py-2.5">
        <span className={n.planLealtad ? "font-bold text-aventurea-ink" : "text-aventurea-ink-soft"}>
          {nombrePlan(n.planLealtad)}
        </span>
        {regalia && (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
              regalia.estado.vencida
                ? "bg-aventurea-sky-light text-aventurea-orange-dark"
                : "bg-aventurea-navy/10 text-aventurea-navy"
            }`}
          >
            {regalia.estado.vencida ? "regalía vencida" : "regalía"}
          </span>
        )}
        {n.stripe === "activa" && (
          <span className="ml-2 rounded-full bg-aventurea-green-light px-2 py-0.5 text-[10.5px] font-bold text-aventurea-green">
            paga con tarjeta
          </span>
        )}
        {n.stripe === "morosa" && (
          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-700">
            moroso
          </span>
        )}
      </td>

      <td className="px-3 py-2.5">
        <span
          className={
            limite.lleno
              ? "font-bold text-red-700"
              : limite.cerca
                ? "font-bold text-aventurea-orange-dark"
                : "text-aventurea-ink"
          }
        >
          {n.miembros.toLocaleString("es-CR")}
          {limite.limite !== null && (
            <span className="text-aventurea-ink-soft">
              {" "}
              / {limite.limite.toLocaleString("es-CR")}
            </span>
          )}
        </span>
      </td>

      <td className="px-3 py-2.5 text-aventurea-ink-soft">
        {n.tarjetas === null ? "—" : `${n.tarjetasActivas ?? 0} de ${n.tarjetas}`}
      </td>

      <td className="px-3 py-2.5 text-aventurea-ink-soft">
        {activos.length === 0 && vencidos.length === 0 ? (
          "—"
        ) : (
          <span className="flex flex-wrap gap-1">
            {activos.map((a) => (
              <span
                key={a.addon}
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                  a.es_cortesia
                    ? "bg-aventurea-navy/10 text-aventurea-navy"
                    : "bg-aventurea-green-light text-aventurea-green"
                }`}
              >
                {nombreAddon(a.addon)}
                {a.es_cortesia ? " · regalo" : ""}
              </span>
            ))}
            {vencidos.map((a) => (
              <span
                key={a.addon}
                className="rounded-full bg-aventurea-sky-light px-2 py-0.5 text-[10.5px] font-bold text-aventurea-orange-dark"
              >
                {nombreAddon(a.addon)} · vencido
              </span>
            ))}
          </span>
        )}
      </td>

      <td className="px-3 py-2.5 text-aventurea-ink-soft">
        {proximo ? (
          <span className={dias !== null && dias <= 15 ? "font-bold text-aventurea-orange-dark" : ""}>
            {fechaCorta(proximo)}
            {dias !== null && dias <= 15 ? ` · ${dias}d` : ""}
          </span>
        ) : (
          "—"
        )}
      </td>

      <td className="px-3 py-2.5 text-aventurea-ink-soft">{fechaCorta(n.creadoEn) ?? "—"}</td>
    </tr>
  );
}

/**
 * Lo que la pantalla NO puede garantizar, dicho arriba y sin rodeos.
 *
 * Un panel de administración que muestra números incompletos sin
 * decirlo es peor que uno que no los muestra: quien decide un cambio de
 * plan mirando un cero cree que ese negocio no tiene clientes.
 */
function Advertencias({
  faltaLaBitacora,
  negociosOcultosPorTope,
  totalNegocios,
  conteoTruncado,
  conteoAMano,
  tarjetasCompletas,
}: {
  faltaLaBitacora: boolean;
  negociosOcultosPorTope: number;
  totalNegocios: number;
  conteoTruncado: boolean;
  conteoAMano: boolean;
  tarjetasCompletas: boolean;
}) {
  const avisos: string[] = [];

  if (faltaLaBitacora) {
    avisos.push(
      "Falta correr 0173_regalias_y_rastro_del_plan.sql. Hasta que se pegue: los cambios de paquete NO dejan registro de quién los hizo, y un paquete regalado no se puede distinguir de uno vendido.",
    );
  }
  if (negociosOcultosPorTope > 0) {
    avisos.push(
      `Se están mostrando ${totalNegocios - negociosOcultosPorTope} de ${totalNegocios} negocios: la consulta tiene un techo. Los ${negociosOcultosPorTope} restantes NO están en esta lista — buscalos por nombre desde /admin/ranchos.`,
    );
  }
  if (conteoTruncado) {
    avisos.push(
      "El conteo de clientes se topó: hay negocios cuyo número está POR DEBAJO del real. No tomes una decisión de bajar de paquete con estos números hasta pegar la 0173.",
    );
  } else if (conteoAMano) {
    avisos.push(
      "Los clientes se están contando a mano porque falta la función de la 0173. El número es correcto, pero la página va a ir lenta a medida que crezcan las membresías.",
    );
  }
  if (!tarjetasCompletas) {
    avisos.push(
      "No se pudieron leer todas las tarjetas, así que la columna «Tarjetas» va en «—» para todos. Se prefiere no mostrar nada antes que mostrar un conteo parcial.",
    );
  }

  if (avisos.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      {avisos.map((a) => (
        <p
          key={a}
          className="rounded-xl border border-aventurea-sky/40 bg-aventurea-sky-light/60 p-3.5 text-[12.5px] leading-snug text-aventurea-ink"
        >
          {a}
        </p>
      ))}
    </div>
  );
}

/**
 * LO QUE SE ESTÁ REGALANDO, arriba de todo.
 *
 * Va en una bandeja propia y no escondido en cada ficha por una razón
 * concreta: una regalía con fecha NO se apaga sola. El paquete no tiene
 * gate por tiempo —lo único que la base hace vencer es el complemento,
 * por `addons_negocio.vence_en`— así que una cortesía que se pasó de
 * fecha es, en la práctica, una suscripción regalada para siempre
 * mientras nadie la mire. Esta bandeja es el «mirarla».
 */
function BandejaRegalias({
  negocios,
  onElegir,
}: {
  negocios: NegocioConAddons[];
  onElegir: (id: string) => void;
}) {
  const filas = negocios.flatMap((n) => {
    const items: { negocio: NegocioConAddons; que: string; detalle: string; vencida: boolean }[] =
      [];

    const plan = regaliaDePlan(n);
    if (plan) {
      const cuando = plan.estado.indefinida
        ? "sin fecha de fin"
        : plan.estado.vencida
          ? `se pasó de fecha el ${fechaCorta(plan.cortesiaHasta)}`
          : `hasta el ${fechaCorta(plan.cortesiaHasta)} (${plan.estado.diasRestantes} días)`;
      items.push({
        negocio: n,
        que: `Paquete ${nombrePlan(n.planLealtad)}`,
        detalle: `${cuando}${plan.motivo ? ` — ${plan.motivo}` : ""}${plan.autor ? ` · lo dio ${plan.autor}` : ""}`,
        vencida: plan.estado.vencida,
      });
    }

    for (const a of regaliasDeAddons(n)) {
      const estado = estadoDeAddon(a);
      items.push({
        negocio: n,
        que: nombreAddon(a.addon),
        detalle: a.vence_en
          ? `${estado === "vencido" ? "venció" : "hasta"} el ${fechaCorta(a.vence_en)}${a.notas ? ` — ${a.notas}` : ""}`
          : `sin vencimiento${a.notas ? ` — ${a.notas}` : ""}`,
        vencida: estado === "vencido",
      });
    }

    return items;
  });

  if (filas.length === 0) return null;

  const vencidas = filas.filter((f) => f.vencida).length;

  return (
    <div className="mb-6 rounded-2xl border border-aventurea-navy/25 bg-aventurea-navy/[0.04] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-navy">
        Lo que estamos regalando · {filas.length}
        {vencidas > 0 ? ` · ${vencidas} pasada${vencidas === 1 ? "" : "s"} de fecha` : ""}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-aventurea-ink-soft">
        Ninguna de estas filas es plata que entró. Una regalía de paquete con fecha{" "}
        <strong>no se apaga sola</strong>: el paquete no tiene vencimiento en la base, así que
        cuando se pasa la fecha hay que decidir acá.
      </p>

      <div className="mt-3 space-y-1.5">
        {filas.map((f, i) => (
          <button
            key={`${f.negocio.id}-${f.que}-${i}`}
            type="button"
            onClick={() => onElegir(f.negocio.id)}
            className={`flex w-full flex-wrap items-baseline gap-x-2 rounded-lg border px-3 py-2 text-left text-[12.5px] ${
              f.vencida
                ? "border-aventurea-orange-dark/30 bg-white"
                : "border-aventurea-line bg-white"
            }`}
          >
            <span className="font-bold text-aventurea-ink">{f.negocio.nombre}</span>
            <span className="text-aventurea-ink">{f.que}</span>
            <span className="text-aventurea-ink-soft">{f.detalle}</span>
            {f.vencida && (
              <span className="ml-auto rounded-full bg-aventurea-sky-light px-2 py-0.5 text-[10.5px] font-bold text-aventurea-orange-dark">
                hay que decidir
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** La ficha completa del negocio elegido: paquete y complementos. */
function Detalle({
  negocio,
  onCerrar,
  faltaLaBitacora,
}: {
  negocio: NegocioConAddons;
  onCerrar: () => void;
  faltaLaBitacora: boolean;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-aventurea-line bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h3 className="text-[17px] font-bold text-aventurea-ink">{negocio.nombre}</h3>
        <span className="rounded-full bg-aventurea-cream-2 px-2.5 py-0.5 text-[11px] font-bold text-aventurea-ink-soft">
          {SECCION_CORTA[negocio.vertical ?? ""] ?? "sin categoría"}
        </span>
        {negocio.estado !== "aprobado" && (
          <span className="rounded-full bg-aventurea-sky-light px-2.5 py-0.5 text-[11px] font-bold text-aventurea-orange-dark">
            {negocio.estado ?? "sin estado"}
          </span>
        )}
        <button
          type="button"
          onClick={onCerrar}
          className="ml-auto rounded-lg border border-aventurea-line bg-white px-3 py-1 text-[12.5px] font-bold text-aventurea-ink-soft"
        >
          Cerrar
        </button>
      </div>

      <EditorDePlan negocio={negocio} faltaLaBitacora={faltaLaBitacora} />
      <Complementos negocio={negocio} />
    </div>
  );
}

/**
 * EL PAQUETE DE ESTE NEGOCIO: verlo, cambiarlo y saber por qué está así.
 *
 * Cambiar de paquete pasa por una confirmación con TRES cosas que antes
 * no existían:
 *
 *   · los avisos con los números CONCRETOS de este negocio (300 clientes
 *     contra un paquete de 200), porque bajar de paquete no rompe nada
 *     de inmediato pero deja al negocio sin poder crecer y sin enterarse;
 *   · el CONCEPTO —venta, regalía, corrección o baja— que es lo único
 *     que separa la plata del regalo;
 *   · el motivo, obligatorio cuando se regala.
 */
function EditorDePlan({
  negocio,
  faltaLaBitacora,
}: {
  negocio: NegocioConAddons;
  faltaLaBitacora: boolean;
}) {
  const [propuesto, setPropuesto] = useState<string | null>(null);
  const [concepto, setConcepto] = useState<ConceptoPlan>("venta");
  const [motivo, setMotivo] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const actual = negocio.planLealtad;
  const limite = estadoDelLimite(actual, "clientesActivos", negocio.miembros);
  const regalia = regaliaDePlan(negocio);
  const abierto = propuesto !== null;
  const planNuevo = propuesto === "" ? null : propuesto;

  const avisos = abierto
    ? avisosDeCambioDePlan({
        planActual: actual,
        planNuevo,
        clientes: negocio.miembros,
        tarjetas: negocio.tarjetas,
      })
    : [];

  function abrir(valor: string, conceptoInicial: ConceptoPlan) {
    setPropuesto(valor);
    setConcepto(conceptoInicial);
    setMotivo("");
    setHasta("");
    setError(null);
    setAviso(null);
  }

  function guardar() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const res = await asignarPlanLealtad({
        ranchoId: negocio.id,
        plan: planNuevo,
        concepto,
        motivo,
        cortesiaHasta: concepto === "cortesia" && hasta ? new Date(hasta).toISOString() : null,
      });
      if (res.error) setError(res.error);
      else {
        setPropuesto(null);
        if (res.aviso) setAviso(res.aviso);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-aventurea-navy/25 bg-aventurea-navy/[0.04] px-4 py-3.5">
      <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-navy">
        Paquete de lealtad
        <a
          href={`/admin/lealtad/${negocio.id}`}
          className="font-bold normal-case tracking-normal underline"
        >
          Configurar el programa →
        </a>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <select
          value={propuesto ?? (actual ?? "")}
          onChange={(e) => abrir(e.target.value, e.target.value ? "venta" : "baja")}
          disabled={pendiente}
          className="rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[13px] font-bold text-aventurea-ink"
        >
          <option value="">Sin plan</option>
          {/* Los retirados siguen en la lista para poder DEJAR a un
              negocio en el suyo sin moverlo de plan sin querer: el
              selector muestra el valor guardado tal cual, marcado. */}
          {PLANES_ID.map((id) => (
            <option key={id} value={id}>
              {resumenDePlan(id)}
            </option>
          ))}
        </select>

        {actual && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
              limite.lleno
                ? "bg-red-50 text-red-700"
                : limite.cerca
                  ? "bg-aventurea-sky-light text-aventurea-orange-dark"
                  : "bg-white text-aventurea-ink-soft"
            }`}
          >
            {negocio.miembros.toLocaleString("es-CR")}
            {limite.limite === null
              ? " clientes (sin tope)"
              : ` de ${limite.limite.toLocaleString("es-CR")} clientes`}
            {limite.lleno ? " · lleno" : limite.cerca ? " · casi lleno" : ""}
          </span>
        )}
      </div>

      {/* De dónde sale el paquete que manda. Se dice porque el dato
          vive en DOS columnas y la que gana no es la obvia. */}
      {negocio.tieneCuenta && negocio.planCuenta !== negocio.planRancho && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[12px] leading-snug text-aventurea-ink">
          <strong>Dato cruzado:</strong> la cuenta dice{" "}
          <strong>{nombrePlan(negocio.planCuenta)}</strong> y el negocio dice{" "}
          <strong>{nombrePlan(negocio.planRancho)}</strong>. Manda la cuenta. Guardar cualquier
          paquete desde acá deja las dos iguales.
        </p>
      )}

      {/* Quién lo puso así, cuándo y con qué concepto. */}
      {negocio.movimiento && (
        <p className="mt-2 text-[12px] leading-snug text-aventurea-ink-soft">
          Último movimiento: <strong>{etiquetaConcepto(negocio.movimiento.concepto)}</strong> a{" "}
          {nombrePlan(negocio.movimiento.plan)} el {fechaCorta(negocio.movimiento.creadoEn)}
          {negocio.movimiento.autor ? `, por ${negocio.movimiento.autor}` : ""}
          {negocio.movimiento.motivo ? ` — «${negocio.movimiento.motivo}»` : ""}.
        </p>
      )}
      {!negocio.movimiento && !faltaLaBitacora && (
        <p className="mt-2 text-[12px] text-aventurea-ink-soft">
          Sin movimientos registrados. El paquete se puso antes de que hubiera bitácora, o lo
          escribió el webhook de Stripe (esos no dejan fila).
        </p>
      )}

      {/* La regalía vigente, con su salida. */}
      {regalia && !abierto && (
        <div className="mt-3 rounded-lg border border-aventurea-navy/25 bg-white px-3 py-2.5">
          <p className="text-[12.5px] font-bold text-aventurea-navy">
            Este paquete está REGALADO
            {regalia.estado.indefinida
              ? ", sin fecha de fin"
              : regalia.estado.vencida
                ? ` y la fecha se pasó el ${fechaCorta(regalia.cortesiaHasta)}`
                : ` hasta el ${fechaCorta(regalia.cortesiaHasta)}`}
            .
          </p>
          <p className="mt-1 text-[12px] leading-snug text-aventurea-ink-soft">
            No entró plata por él. Si ya empezó a pagar, cerrala como venta; si se terminó,
            cambiale el paquete abajo con concepto «Baja».
          </p>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => abrir(actual ?? "", "venta")}
            className="mt-2 rounded-lg bg-aventurea-navy px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            Ya paga — cerrar la regalía
          </button>
        </div>
      )}

      {/* ── La confirmación ─────────────────────────────────────── */}
      {abierto && (
        <div className="mt-3 rounded-xl border border-aventurea-navy/30 bg-white p-3.5">
          <p className="text-[13px] font-bold text-aventurea-ink">
            {planNuevo === actual
              ? `Registrar un movimiento sin cambiarle el paquete (sigue en ${nombrePlan(actual)})`
              : `Pasar de ${nombrePlan(actual)} a ${nombrePlan(planNuevo)}`}
          </p>

          {avisos.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {avisos.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-lg px-3 py-2 text-[12px] leading-snug ${
                    a.clase === "sin_candado"
                      ? "bg-red-50 text-red-800"
                      : "bg-aventurea-sky-light/70 text-aventurea-ink"
                  }`}
                >
                  {a.texto}
                </li>
              ))}
            </ul>
          )}

          {negocio.stripe === "activa" && (
            <p className="mt-2 rounded-lg bg-aventurea-sky-light/70 px-3 py-2 text-[12px] leading-snug text-aventurea-ink">
              Este negocio tiene una suscripción de Stripe <strong>activa</strong>. Cambiarle el
              paquete acá NO toca el cobro automático: se le va a seguir cobrando lo de antes hasta
              que alguien mueva la suscripción en Stripe.
            </p>
          )}

          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft">
            ¿Qué es este movimiento?
          </p>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {CONCEPTOS_PLAN.map((c) => (
              <label
                key={c}
                className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-[12.5px] ${
                  concepto === c
                    ? "border-aventurea-navy bg-aventurea-navy/[0.06]"
                    : "border-aventurea-line bg-white"
                }`}
              >
                <input
                  type="radio"
                  name={`concepto-${negocio.id}`}
                  checked={concepto === c}
                  onChange={() => setConcepto(c)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-aventurea-navy"
                />
                <span>
                  <span className="block font-bold text-aventurea-ink">{CONCEPTO_LABEL[c]}</span>
                  <span className="block text-[11.5px] leading-snug text-aventurea-ink-soft">
                    {CONCEPTO_AYUDA[c]}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {concepto === "cortesia" && (
            <div className="mt-2.5">
              <label className="block text-[12px] font-bold text-aventurea-ink">
                ¿Hasta cuándo?{" "}
                <span className="font-normal text-aventurea-ink-soft">
                  (dejalo vacío para una regalía indefinida)
                </span>
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-1 rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink"
              />
              <p className="mt-1 text-[11.5px] leading-snug text-aventurea-ink-soft">
                Ojo: esta fecha <strong>no apaga nada sola</strong> — el paquete no vence en la
                base. Cuando llegue, el negocio va a aparecer en la bandeja de arriba para que
                alguien decida.
              </p>
            </div>
          )}

          <label className="mt-2.5 block text-[12px] font-bold text-aventurea-ink">
            Motivo{motivoObligatorio(concepto) ? " (obligatorio)" : " (opcional)"}
          </label>
          <input
            value={motivo}
            maxLength={MOTIVO_MAX}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={
              concepto === "cortesia"
                ? "Ej. compensación por la caída del 3/8, o negocio piloto"
                : "Ej. SINPE 2/8 por ₡24.000"
            }
            className="mt-1 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink placeholder:text-zinc-400"
          />

          {error && <p className="mt-2 text-[12px] font-bold text-red-700">{error}</p>}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={pendiente}
              className="rounded-lg bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              {pendiente ? "Guardando…" : "Guardar el cambio"}
            </button>
            <button
              type="button"
              onClick={() => setPropuesto(null)}
              disabled={pendiente}
              className="rounded-lg border border-aventurea-line bg-white px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <p className="mt-2 rounded-lg bg-aventurea-sky-light/70 px-3 py-2 text-[12px] leading-snug text-aventurea-ink">
          {aviso}
        </p>
      )}
    </div>
  );
}

function etiquetaConcepto(concepto: string): string {
  const c = CONCEPTOS_PLAN.find((x) => x === concepto);
  return c ? CONCEPTO_LABEL[c].split(" — ")[0] : concepto;
}

/** Los complementos sueltos del negocio: activar, regalar y quitar. */
function Complementos({ negocio }: { negocio: NegocioConAddons }) {
  const [duracion, setDuracion] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<Record<string, string>>({});
  const [regalo, setRegalo] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function clave(addon: string) {
    return `${negocio.id}:${addon}`;
  }

  function activar(addon: AddonId) {
    const k = clave(addon);
    const elegida = DURACIONES.find((d) => d.id === (duracion[k] ?? "1"));
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const res = await activarAddon({
        ranchoId: negocio.id,
        addon,
        meses: elegida?.meses ?? 1,
        notas: nota[k] ?? "",
        esCortesia: regalo[k] === true,
      });
      if (res.error) setError(res.error);
      else {
        setNota((prev) => ({ ...prev, [k]: "" }));
        setAviso(res.aviso ?? null);
      }
    });
  }

  function quitar(addon: AddonId) {
    if (
      !window.confirm(
        `¿Quitarle "${nombreAddon(addon)}" a ${negocio.nombre}? Deja de funcionarle de inmediato.`,
      )
    ) {
      return;
    }
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const res = await desactivarAddon(negocio.id, addon);
      if (res.error) setError(res.error);
    });
  }

  return (
    <>
      <p className="mt-5 mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft">
        Complementos sueltos
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-[12.5px] text-red-700">{error}</p>
      )}
      {aviso && (
        <p className="mb-3 rounded-lg bg-aventurea-sky-light/70 p-3 text-[12.5px] text-aventurea-ink">
          {aviso}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {ADDONS.map((def) => {
          const fila = negocio.addons.find((a) => a.addon === def.id) ?? null;
          const estado = estadoDeAddon(fila);
          const k = clave(def.id);
          const vence = fechaCorta(fila?.vence_en ?? null);
          const dias = diasPara(fila?.vence_en ?? null);
          // Lealtad se separó del resto del sitio (14 ago 2026): ya no se
          // activa acá — nace aislado desde /lealtad/planes. Esta tarjeta
          // se queda solo para poder VER un caso viejo y quitarlo.
          const esLealtad = def.id === "lealtad";

          return (
            <div
              key={def.id}
              className="rounded-xl border border-aventurea-line bg-aventurea-cream-2/40 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-aventurea-ink">{def.nombre}</span>
                <span className="flex items-center gap-1.5">
                  {fila?.es_cortesia && estado !== "apagado" && (
                    <span className="rounded-full bg-aventurea-navy/10 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-navy">
                      Regalado
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CHIP[estado]}`}>
                    {ETIQUETA[estado]}
                  </span>
                </span>
              </div>

              <p className="mt-1 text-[11.5px] leading-snug text-aventurea-ink-soft">
                {def.resumen}
              </p>

              {estado !== "apagado" && (
                <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
                  {vence
                    ? estado === "vencido"
                      ? `Venció el ${vence}`
                      : `Vence el ${vence}${dias !== null && dias <= 15 ? ` · faltan ${dias} días` : ""}`
                    : "Sin vencimiento"}
                </p>
              )}
              {fila?.notas && (
                <p className="mt-1 text-[11.5px] italic text-aventurea-ink-soft">{fila.notas}</p>
              )}

              {esLealtad ? (
                <>
                  <p className="mt-2.5 text-[11.5px] leading-snug text-aventurea-ink-soft">
                    {estado === "apagado" ? (
                      <>Ya no se activa acá — cada negocio de lealtad nace aparte desde /lealtad/planes.</>
                    ) : (
                      <>Caso de antes de separar lealtad del resto del sitio. Se puede quitar, pero ya no se renueva desde acá.</>
                    )}
                  </p>
                  {estado !== "apagado" && (
                    <button
                      type="button"
                      onClick={() => quitar(def.id)}
                      disabled={pendiente}
                      className="mt-2.5 w-full rounded-lg border border-aventurea-line bg-white px-3 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-40"
                    >
                      Quitar
                    </button>
                  )}
                </>
              ) : (
                <>
                  <select
                    value={duracion[k] ?? "1"}
                    onChange={(e) => setDuracion((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="mt-2.5 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink"
                  >
                    {DURACIONES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>

                  {/* LA CASILLA QUE HACE LA DIFERENCIA. Antes había una
                      duración llamada «1 mes (cortesía)» que escribía
                      exactamente lo mismo que una venta de un mes: el
                      regalo y el cobro quedaban indistinguibles. */}
                  <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-aventurea-line bg-white px-2.5 py-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={regalo[k] === true}
                      onChange={(e) => setRegalo((prev) => ({ ...prev, [k]: e.target.checked }))}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-aventurea-navy"
                    />
                    <span>
                      <span className="block font-bold text-aventurea-ink">
                        Es una regalía (no entró plata)
                      </span>
                      <span className="block text-[11px] leading-snug text-aventurea-ink-soft">
                        Queda marcado para que ninguna auditoría lo cuente como ingreso.
                      </span>
                    </span>
                  </label>

                  <input
                    value={nota[k] ?? ""}
                    maxLength={300}
                    onChange={(e) => setNota((prev) => ({ ...prev, [k]: e.target.value }))}
                    placeholder={
                      regalo[k]
                        ? "Por qué se regala (obligatorio)"
                        : "Nota (ej. pagó SINPE 2/8)"
                    }
                    className="mt-2 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink placeholder:text-zinc-400"
                  />

                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => activar(def.id)}
                      disabled={pendiente}
                      className="flex-1 rounded-lg bg-aventurea-navy px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
                    >
                      {estado === "apagado" ? "Activar" : "Renovar"}
                    </button>
                    {estado !== "apagado" && (
                      <button
                        type="button"
                        onClick={() => quitar(def.id)}
                        disabled={pendiente}
                        className="rounded-lg border border-aventurea-line bg-white px-3 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-40"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
