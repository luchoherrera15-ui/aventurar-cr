"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ROTULO_CAMPO } from "@/components/panel/sistema";
import { ADDON, ADDONS, type AddonId, type EstadoAddons } from "@/lib/solutions/addons";
import type { EstadoDominio } from "@/lib/solutions/tipos";
import { cambiarAddonDesdeAdmin, crearNegocioSolutionsDesdeAdmin, enlaceDeEntradaDesdeAdmin } from "./actions";

export type NegocioAdmin = {
  id: string;
  nombre: string;
  slug: string;
  publicado: boolean;
  origen: "publico" | "admin";
  creadoEn: string;
  dueno: { email: string; nombre: string | null };
  addons: EstadoAddons;
  dominio: string | null;
  dominioEstado: EstadoDominio;
  url: string;
  platos: number;
  pedidosVivos: number;
};

/**
 * La pantalla de Solutions del admin: el alta para un cliente arriba, la
 * lista abajo. Cada fila abre el panel del negocio (el admin entra como
 * dueño) y deja prender o apagar sus add-ons sin salir de acá.
 */
export default function SolutionsAdminPanel({ negocios, total, tope }: { negocios: NegocioAdmin[]; total: number; tope: number }) {
  const router = useRouter();
  const [ocupado, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [f, setF] = useState({ correo: "", nombrePersona: "", telefono: "", nombreNegocio: "", menu: true, pedidos: false, lealtad: false });
  const [creado, setCreado] = useState<{ nombre: string; correo: string; url: string; cuentaNueva: boolean; enlace: string | null } | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});

  const crear = () => {
    setError(null);
    arrancar(async () => {
      const r = await crearNegocioSolutionsDesdeAdmin({
        correo: f.correo,
        nombrePersona: f.nombrePersona,
        telefono: f.telefono,
        nombreNegocio: f.nombreNegocio,
        addons: { menu: f.menu, pedidos: f.pedidos, lealtad: f.lealtad },
      });
      if (!r.ok) return setError(r.motivo);
      setCreado({
        nombre: f.nombreNegocio.trim(),
        correo: f.correo.trim().toLowerCase(),
        url: `/solutions/panel/${r.negocioId}`,
        cuentaNueva: r.cuentaNueva,
        enlace: r.enlaceDeEntrada,
      });
      setF({ correo: "", nombrePersona: "", telefono: "", nombreNegocio: "", menu: true, pedidos: false, lealtad: false });
      router.refresh();
    });
  };

  const alternar = (n: NegocioAdmin, a: AddonId) => {
    if (a === "linkhub") return;
    setError(null);
    arrancar(async () => {
      const r = await cambiarAddonDesdeAdmin(n.id, a, !n.addons[a]);
      if (!r.ok) setError(r.motivo);
      else router.refresh();
    });
  };

  const pedirEnlace = (n: NegocioAdmin) => {
    setError(null);
    arrancar(async () => {
      const r = await enlaceDeEntradaDesdeAdmin(n.dueno.email);
      if (!r.ok) return setError(r.motivo);
      setEnlaces((p) => ({ ...p, [n.id]: r.enlace }));
    });
  };

  const q = filtro.trim().toLowerCase();
  const visibles = q
    ? negocios.filter((n) => [n.nombre, n.slug, n.dueno.email, n.dueno.nombre ?? "", n.dominio ?? ""].some((t) => t.toLowerCase().includes(q)))
    : negocios;

  const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-aventurea-ink-soft">Productos de Bookea</p>
        <h1 className="titulo mt-1 text-[clamp(22px,3vw,30px)] text-aventurea-navy">Solutions</h1>
        <p className="mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
          Link hub, menú digital, pedidos y tarjeta de lealtad. Acá le dejás el negocio listo a un cliente y entrás a cualquier
          panel como si fueras el dueño. Hoy nada tiene precio: todo es prueba.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-[13px] font-bold text-red-700">{error}</p>}

      {/* ── EL ALTA PARA UN CLIENTE ─────────────────────────────── */}
      <Card eyebrow="Dejárselo listo" titulo="Crear el negocio de un cliente">
        <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
          Ponés su correo y el nombre del negocio. Si no tiene cuenta, se le crea en el momento y te damos el enlace para que
          entre; la primera vez le pedimos nombre y teléfono. Vos podés entrar a su panel y configurarle todo antes.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="a-correo" className={ROTULO_CAMPO}>Correo del cliente</label>
            <input id="a-correo" type="email" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} placeholder="dueno@restaurante.com" className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div>
            <label htmlFor="a-negocio" className={ROTULO_CAMPO}>Nombre del negocio</label>
            <input id="a-negocio" type="text" value={f.nombreNegocio} onChange={(e) => setF({ ...f, nombreNegocio: e.target.value })} placeholder="Casa Nostra" className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div>
            <label htmlFor="a-persona" className={ROTULO_CAMPO}>Nombre de la persona (opcional)</label>
            <input id="a-persona" type="text" value={f.nombrePersona} onChange={(e) => setF({ ...f, nombrePersona: e.target.value })} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div>
            <label htmlFor="a-tel" className={ROTULO_CAMPO}>Teléfono (opcional)</label>
            <input id="a-tel" type="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="88887777" className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
        </div>
        <p className={`mt-4 ${ROTULO_CAMPO}`}>Qué le dejás prendido</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ADDONS.map((a) => {
            const incluido = a === "linkhub";
            const activo = incluido || f[a as "menu" | "pedidos" | "lealtad"];
            return (
              <label
                key={a}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-bold ${
                  activo ? "border-aventurea-navy bg-aventurea-navy/5 text-aventurea-navy" : "border-aventurea-line text-aventurea-ink-soft"
                } ${incluido ? "cursor-default opacity-80" : ""}`}
              >
                <input type="checkbox" checked={activo} disabled={incluido} onChange={(e) => !incluido && setF({ ...f, [a]: e.target.checked })} className="h-4 w-4" />
                {ADDON[a].nombre}
                {incluido && <span className="text-[10.5px] font-extrabold uppercase tracking-[0.1em]">incluido</span>}
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={crear} disabled={ocupado || !f.correo.trim() || !f.nombreNegocio.trim()} className={BOTON_PANEL_PRIMARIO}>
            {ocupado ? "Creando…" : "Crear y dejarle el panel listo"}
          </button>
        </div>

        {creado && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-[13px] text-aventurea-ink">
            <p className="font-extrabold text-green-800">
              ✓ {creado.nombre} quedó creado para {creado.correo}
              {creado.cuentaNueva ? " (cuenta nueva)" : " (ya tenía cuenta)"}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href={creado.url} className={BOTON_PANEL_PRIMARIO}>
                Configurárselo ahora →
              </Link>
            </div>
            {creado.enlace && (
              <div className="mt-3">
                <p className="text-[12px] font-bold text-aventurea-ink-soft">
                  Su enlace de primer ingreso (mandáselo por WhatsApp; entra sin contraseña y elige la suya):
                </p>
                <input readOnly value={creado.enlace} onFocus={(e) => e.currentTarget.select()} className={`mt-1.5 ${CAMPO_PANEL} font-mono text-[12px]`} />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── LA LISTA ────────────────────────────────────────────── */}
      <Card
        eyebrow="Todos"
        titulo={`Negocios de Solutions · ${total}`}
        accion={
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por nombre, correo o dominio"
            aria-label="Buscar"
            className={`${CAMPO_PANEL} w-[260px]`}
          />
        }
      >
        {total > tope && (
          <p className="mb-3 text-[12.5px] font-bold text-red-700">Se muestran {tope} de {total}. Usá el buscador para encontrar el resto.</p>
        )}
        {visibles.length === 0 && <p className="text-[13px] text-aventurea-ink-soft">No hay negocios que coincidan.</p>}
        <ul className="flex flex-col divide-y divide-aventurea-line">
          {visibles.map((n) => (
            <li key={n.id} className="grid gap-3 py-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/solutions/panel/${n.id}`} className="truncate text-[15px] font-extrabold text-aventurea-navy hover:underline">
                    {n.nombre}
                  </Link>
                  <PildoraEstado estado={n.publicado ? "exito" : "neutro"}>{n.publicado ? "Publicado" : "Apagado"}</PildoraEstado>
                  {n.origen === "admin" && <PildoraEstado estado="info">Lo armó Bookea</PildoraEstado>}
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-aventurea-ink-soft">
                  {n.dueno.nombre ? `${n.dueno.nombre} · ` : ""}
                  {n.dueno.email} · desde {fecha(n.creadoEn)}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-aventurea-ink-soft">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    {n.url.replace(/^https?:\/\//, "")}
                  </a>
                  {n.dominio && n.dominioEstado !== "activo" && ` · dominio ${n.dominio} pendiente`}
                  {` · ${n.platos} platos`}
                  {n.pedidosVivos > 0 && ` · ${n.pedidosVivos} pedidos en curso`}
                </p>
              </div>

              {/* Los add-ons, como chips que se tocan. */}
              <div className="flex flex-wrap gap-1.5">
                {ADDONS.map((a) => {
                  const activo = n.addons[a];
                  const incluido = a === "linkhub";
                  return (
                    <button
                      key={a}
                      type="button"
                      disabled={ocupado || incluido}
                      onClick={() => alternar(n, a)}
                      aria-pressed={activo}
                      title={incluido ? "Incluido con la cuenta" : activo ? "Tocá para apagar" : "Tocá para prender"}
                      className={`presionable rounded-lg border px-2.5 py-1 text-[11.5px] font-extrabold transition-colors ${
                        activo ? "border-aventurea-navy bg-aventurea-navy text-white" : "border-aventurea-line bg-white text-aventurea-ink-soft"
                      } ${incluido ? "opacity-70" : ""}`}
                    >
                      {ADDON[a].nombre}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Link href={`/solutions/panel/${n.id}`} className={BOTON_PANEL_PRIMARIO}>
                  Abrir panel →
                </Link>
                <button type="button" disabled={ocupado} onClick={() => pedirEnlace(n)} className={BOTON_PANEL} title="Genera un enlace de ingreso sin contraseña para el dueño">
                  Enlace de ingreso
                </button>
                {enlaces[n.id] && (
                  <input readOnly value={enlaces[n.id]} onFocus={(e) => e.currentTarget.select()} className={`${CAMPO_PANEL} w-full font-mono text-[11.5px] lg:w-[260px]`} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
