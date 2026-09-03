"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  borrarRancho,
  moverDestacado,
  obtenerVerificacion,
  setDestacado,
  setEstadoRancho,
  setSuperDestacado,
  setVerificado,
} from "./actions";
import type { EstadoRancho, Rancho } from "@/app/mi-negocio/types";
import { categoriaLabel } from "@/lib/categorias-vertical";
import {
  SECCION_BADGE,
  SECCION_CORTA,
  verticalDeRancho,
  type SeccionAdmin,
} from "../vertical";

export type RanchoConDueno = Rancho & { duenoEmail: string | null };

/** Cuántos negocios entran al carrusel de la portada. Tiene que coincidir
 *  con LIMITE_SUPER_DESTACADOS de actions.ts, que es quien manda. */
const LIMITE_SUPER_DESTACADOS = 10;

const ESTADO_LABEL: Record<EstadoRancho, string> = {
  pendiente: "Pendiente",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

const ESTADO_BADGE: Record<EstadoRancho, string> = {
  pendiente: "bg-aventurea-sky/15 text-aventurea-orange",
  aprobado: "bg-aventurea-green/15 text-aventurea-green",
  rechazado: "bg-red-50 text-red-700",
};

function fmtColones(n: number | null) {
  if (n === null) return "—";
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default function RanchosTable({
  initialRanchos,
  seccion = "todas",
  superDestacadosFueraDeSeccion = 0,
}: {
  initialRanchos: RanchoConDueno[];
  seccion?: SeccionAdmin;
  /** Los que ocupan puesto en el carrusel pero NO están en esta lista
   *  (otra vertical). Sin esto el contador de abajo mentiría y el
   *  checkbox se ofrecería habilitado para después fallar. */
  superDestacadosFueraDeSeccion?: number;
}) {
  // Con una sección elegida la columna sobra: todos son de la misma.
  const mostrarSeccion = seccion === "todas";
  const [ranchos, setRanchos] = useState(initialRanchos);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranchos
      .filter((r) =>
        !q
          ? true
          : r.nombre.toLowerCase().includes(q) ||
            (r.provincia ?? "").toLowerCase().includes(q) ||
            (r.duenoEmail ?? "").toLowerCase().includes(q),
      )
      // ── LEALTAD APARTE DEL DIRECTORIO (0187) ──────────────────
      // Los clientes de Bookea Lealtad NO se sacan de la pantalla: acá
      // es el único lugar con `borrarRancho` y con la vista completa
      // de la ficha, así que esconderlos cambiaría una fuga por un
      // punto ciego. Se separan: por defecto no salen, y hay un filtro
      // propio para verlos cuando hace falta.
      //
      // `!== false` y no `=== true`: sin la 0187 corrida la propiedad
      // llega `undefined` y la tabla entera quedaría vacía.
      .filter((r) =>
        filtro === "solo_lealtad"
          ? r.en_marketplace === false
          : r.en_marketplace !== false,
      )
      .filter((r) => filtro === "todos" || filtro === "solo_lealtad" || r.estado === filtro);
  }, [ranchos, query, filtro]);

  // Puesto de cada destacado (1, 2, 3...) sin los huecos que dejan
  // los que se quitaron.
  const puestoDestacado = useMemo(() => {
    const orden = ranchos
      .filter((r) => r.destacado_orden != null)
      .sort((a, b) => a.destacado_orden! - b.destacado_orden!);
    return new Map(orden.map((r, i) => [r.id, i + 1]));
  }, [ranchos]);

  // Cuántos ocupan puesto en el carrusel de la portada, en TODO el sitio
  // — el tope de 10 (0169) no es por sección. Los de esta lista más los
  // que están en otras verticales, que el servidor ya contó.
  const totalSuperDestacados = useMemo(
    () =>
      ranchos.filter((r) => r.super_destacado).length +
      superDestacadosFueraDeSeccion,
    [ranchos, superDestacadosFueraDeSeccion],
  );
  const carruselLleno = totalSuperDestacados >= LIMITE_SUPER_DESTACADOS;

  function cambiarEstado(id: string, estado: EstadoRancho) {
    setError(null);
    startTransition(async () => {
      const res = await setEstadoRancho(id, estado);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRanchos((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado } : r)),
      );
    });
  }

  // Los destacados primero (en su orden), después el resto tal cual
  // vino del servidor — el mismo criterio que usa la portada.
  function aplicarCambios(cambios: { id: string; destacado_orden: number | null }[]) {
    setRanchos((prev) => {
      const conCambio = prev.map((r) => {
        const c = cambios.find((x) => x.id === r.id);
        return c ? { ...r, destacado_orden: c.destacado_orden } : r;
      });
      return [...conCambio].sort((a, b) => {
        const ao = a.destacado_orden ?? Infinity;
        const bo = b.destacado_orden ?? Infinity;
        if (ao !== bo) return ao - bo;
        return 0;
      });
    });
  }

  function destacar(id: string, valor: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setDestacado(id, valor);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.cambios) aplicarCambios(res.cambios);
    });
  }

  function alternarSuperDestacado(id: string, valor: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setSuperDestacado(id, valor);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRanchos((prev) =>
        prev.map((r) => (r.id === id ? { ...r, super_destacado: valor } : r)),
      );
    });
  }

  /**
   * La insignia verde de la tarjeta publica (migracion 0214).
   *
   * El estado local se actualiza SOLO si el servidor dijo que si. Es el
   * mismo criterio que `alternarSuperDestacado` aca arriba, y aca pesa
   * mas: la base tiene un trigger que rechaza el cambio a quien no sea
   * admin, asi que este es un boton que de verdad puede fallar. Pintarlo
   * optimista dejaria la casilla marcada sobre un negocio que no quedo
   * verificado.
   */
  function alternarVerificado(id: string, valor: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setVerificado(id, valor);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRanchos((prev) => prev.map((r) => (r.id === id ? { ...r, verificado: valor } : r)));
    });
  }

  function mover(id: string, direccion: -1 | 1) {
    setError(null);
    startTransition(async () => {
      const res = await moverDestacado(id, direccion);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.cambios) aplicarCambios(res.cambios);
    });
  }

  const [verificacionAbierta, setVerificacionAbierta] = useState<{
    nombre: string;
    redSocialUrl: string;
    cedulaFrenteUrl: string | null;
    cedulaDorsoUrl: string | null;
  } | null>(null);
  const [cargandoVerificacion, setCargandoVerificacion] = useState<string | null>(null);

  function verVerificacion(id: string, nombre: string) {
    setError(null);
    setCargandoVerificacion(id);
    startTransition(async () => {
      const res = await obtenerVerificacion(id);
      setCargandoVerificacion(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (!res.verificacion) {
        setError(`"${nombre}" no tiene verificación registrada (se creó antes de exigirla).`);
        return;
      }
      setVerificacionAbierta({ nombre, ...res.verificacion });
    });
  }

  function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Borrar "${nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await borrarRancho(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRanchos((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div>
      <div className="mb-4.5 flex flex-wrap gap-2.5">
        <input
          type="search"
          placeholder="Buscar por nombre, provincia o correo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-xs rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:zinc-500"
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Publicados</option>
          <option value="rechazado">Rechazados</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-aventurea-cream-2/60">
              {[
                "Destacado",
                `Súper destacado (${totalSuperDestacados}/${LIMITE_SUPER_DESTACADOS})`,
                "Verificado",
                "Nombre",
                ...(mostrarSeccion ? ["Sección"] : []),
                "Categoría",
                "Dueño",
                "Ubicación",
                "Capacidad",
                "Desde",
                "Estado",
                "Acciones",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-aventurea-line px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={mostrarSeccion ? 11 : 10}
                  className="px-4 py-10 text-center text-[13.5px] text-zinc-500"
                >
                  No hay negocios que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {list.map((r) => (
              <tr
                key={r.id}
                className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
              >
                <td className="whitespace-nowrap px-4 py-3.5">
                  {r.destacado_orden != null ? (
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-aventurea-sky/15 px-2 py-1 text-[11.5px] font-bold text-aventurea-orange">
                        ★ {puestoDestacado.get(r.id)}
                      </span>
                      <button
                        disabled={pending}
                        onClick={() => mover(r.id, -1)}
                        title="Subir un puesto"
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-aventurea-line text-xs text-aventurea-ink hover:border-aventurea-navy disabled:opacity-50"
                      >
                        ↑
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => mover(r.id, 1)}
                        title="Bajar un puesto"
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-aventurea-line text-xs text-aventurea-ink hover:border-aventurea-navy disabled:opacity-50"
                      >
                        ↓
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => destacar(r.id, false)}
                        title="Quitar de destacados"
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-aventurea-line text-xs text-aventurea-ink-soft hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={pending || r.estado !== "aprobado"}
                      onClick={() => destacar(r.id, true)}
                      title={
                        r.estado !== "aprobado"
                          ? "Solo se pueden destacar negocios publicados"
                          : "Poner de primero en la portada"
                      }
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink-soft hover:border-aventurea-sky hover:text-aventurea-orange disabled:opacity-40"
                    >
                      ☆ Destacar
                    </button>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  {/* Solo se bloquea el paso de "fuera" a "adentro": si
                      ya está en el carrusel, SIEMPRE se tiene que poder
                      sacar, incluso despublicado o con los 10 llenos —
                      si no, el puesto queda tomado y sin forma de
                      liberarlo (mismo criterio que el botón × de
                      Destacado, acá al lado). */}
                  <label
                    title={
                      r.super_destacado
                        ? "Sacar del carrusel de la portada"
                        : r.estado !== "aprobado"
                          ? "Solo se pueden destacar negocios publicados"
                          : carruselLleno
                            ? `Ya hay ${LIMITE_SUPER_DESTACADOS} negocios en el carrusel — quitá uno antes de agregar otro`
                            : "Rotar en el carrusel de la portada"
                    }
                    className={`inline-flex items-center gap-2 ${
                      pending ||
                      (!r.super_destacado &&
                        (r.estado !== "aprobado" || carruselLleno))
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!r.super_destacado}
                      disabled={
                        pending ||
                        (!r.super_destacado &&
                          (r.estado !== "aprobado" || carruselLleno))
                      }
                      onChange={(e) => alternarSuperDestacado(r.id, e.target.checked)}
                      className="h-4 w-4 rounded border-aventurea-line accent-aventurea-orange"
                    />
                    <span className="text-[11.5px] font-bold text-aventurea-ink-soft">
                      {r.super_destacado ? "En el carrusel" : "Agregar"}
                    </span>
                  </label>
                </td>

                {/* ⚠️ VERIFICADO NO SE PIDE APROBADO, Y ES A PROPÓSITO.
                    Súper destacado sí lo exige, porque un negocio
                    despublicado no puede rotar en un carrusel donde no
                    aparece. Verificar es otra cosa: es constatar que el
                    negocio existe, y eso se hace ANTES de publicarlo —
                    de hecho es lo que uno querría comprobar para
                    decidir si publicarlo. Bloquearlo hasta que esté
                    aprobado invertiría el orden del trabajo.

                    Que un negocio no publicado quede verificado no
                    muestra nada de más: sin tarjeta no hay dónde pintar
                    la insignia. */}
                <td className="whitespace-nowrap px-4 py-3.5">
                  <label
                    title={
                      r.verificado
                        ? "Quitarle la insignia de verificado"
                        : "Marcarlo como verificado: Bookea comprobó que existe"
                    }
                    className={`inline-flex items-center gap-2 ${
                      pending ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!r.verificado}
                      disabled={pending}
                      onChange={(e) => alternarVerificado(r.id, e.target.checked)}
                      className="h-4 w-4 rounded border-aventurea-line accent-emerald-600"
                    />
                    <span
                      className={`text-[11.5px] font-bold ${
                        r.verificado ? "text-emerald-700" : "text-aventurea-ink-soft"
                      }`}
                    >
                      {r.verificado ? "Verificado" : "Sin verificar"}
                    </span>
                  </label>
                </td>
                <td className="px-4 py-3.5">
                  {/* El nombre abre el panel de gestión del negocio: la
                      página /mi-negocio/[id] ya deja entrar al admin
                      (misma puerta que "Modificar tu página"). */}
                  <Link
                    href={`/mi-negocio/${r.id}`}
                    className="font-bold text-aventurea-ink underline-offset-2 hover:text-aventurea-navy hover:underline"
                  >
                    {r.nombre}
                  </Link>
                  {r.contacto_whatsapp && (
                    <div className="text-xs text-zinc-500">
                      {r.contacto_whatsapp}
                    </div>
                  )}
                </td>
                {mostrarSeccion && (
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${SECCION_BADGE[verticalDeRancho(r.vertical)]}`}
                    >
                      {SECCION_CORTA[verticalDeRancho(r.vertical)]}
                    </span>
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {categoriaLabel(verticalDeRancho(r.vertical), r.categoria)}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {r.duenoEmail ?? "—"}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {r.provincia ?? "—"}
                  {r.canton ? ` · ${r.canton}` : ""}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {r.capacidad_min ?? "?"}–{r.capacidad_max ?? "?"}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-[13px] font-bold text-aventurea-orange">
                  {fmtColones(r.precio_desde)}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${ESTADO_BADGE[r.estado]}`}
                  >
                    {ESTADO_LABEL[r.estado]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      href={`/mi-negocio/${r.id}`}
                      className="flex h-[30px] items-center rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-navy hover:border-aventurea-navy"
                    >
                      Administrar
                    </Link>
                    {r.estado === "aprobado" && (
                      <Link
                        href={r.slug ? `/${r.slug}` : `/eventos/${r.id}`}
                        className="flex h-[30px] items-center rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                      >
                        Ver página
                      </Link>
                    )}
                    {r.estado !== "aprobado" && (
                      <button
                        disabled={pending}
                        onClick={() => cambiarEstado(r.id, "aprobado")}
                        className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-green hover:border-aventurea-green disabled:opacity-50"
                      >
                        Publicar
                      </button>
                    )}
                    {r.estado !== "rechazado" && (
                      <button
                        disabled={pending}
                        onClick={() => cambiarEstado(r.id, "rechazado")}
                        className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-400 disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    )}
                    <button
                      disabled={pending || cargandoVerificacion === r.id}
                      onClick={() => verVerificacion(r.id, r.nombre)}
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-navy hover:border-aventurea-navy disabled:opacity-50"
                    >
                      {cargandoVerificacion === r.id ? "Cargando…" : "Verificación"}
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => eliminar(r.id, r.nombre)}
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink-soft hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {verificacionAbierta && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setVerificacionAbierta(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-aventurea-surface p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Verificación de identidad
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-aventurea-ink">
                  {verificacionAbierta.nombre}
                </h2>
              </div>
              <button
                onClick={() => setVerificacionAbierta(null)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink"
              >
                ×
              </button>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                Redes o sitio web
              </p>
              <a
                href={verificacionAbierta.redSocialUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-[13.5px] font-bold text-aventurea-navy underline"
              >
                {verificacionAbierta.redSocialUrl}
              </a>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Cédula — frente
                </p>
                {verificacionAbierta.cedulaFrenteUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no cacheable por next/image
                  <img
                    src={verificacionAbierta.cedulaFrenteUrl}
                    alt="Cédula, frente"
                    className="w-full rounded-lg border border-aventurea-line"
                  />
                ) : (
                  <p className="text-[12.5px] text-zinc-500">No se pudo cargar.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Cédula — dorso
                </p>
                {verificacionAbierta.cedulaDorsoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ídem
                  <img
                    src={verificacionAbierta.cedulaDorsoUrl}
                    alt="Cédula, dorso"
                    className="w-full rounded-lg border border-aventurea-line"
                  />
                ) : (
                  <p className="text-[12.5px] text-zinc-500">No se pudo cargar.</p>
                )}
              </div>
            </div>
            <p className="mt-4 text-[11.5px] text-zinc-500">
              Estas imágenes vienen de un link temporal que vence en 5
              minutos — cerrá y volvé a abrir si necesitás verlas de nuevo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
