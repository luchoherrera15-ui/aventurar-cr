"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ROTULO_CAMPO } from "@/components/panel/sistema";
import { instruccionesDns } from "@/lib/solutions/dominios";
import type { NegocioSolutions } from "@/lib/solutions/tipos";
import { guardarDominioSolutions, quitarDominioSolutions, verificarDominioSolutions } from "./actions";

/**
 * TU PROPIO DOMINIO — la tarjeta de Mi página (0234).
 *
 * Pedido del dueño (5 sep 2026): «que la gente agregue su propio
 * dominio y tenga sus mini portales».
 *
 * Tres momentos, una sola tarjeta:
 *   · sin dominio: el campo y un botón;
 *   · con dominio pendiente: las instrucciones de DNS en la forma en
 *     que las pide cualquier proveedor (tipo, nombre, valor), la nota
 *     de qué falta, y «Verificar»;
 *   · activo: el enlace y la píldora verde.
 *
 * «Verificar» no adivina: hace una petición real al dominio y busca la
 * cabecera de nuestro proxy (ver vercel-dominios.ts). Por eso la
 * píldora dice la verdad.
 */
export default function SeccionDominio({ negocio }: { negocio: NegocioSolutions }) {
  const router = useRouter();
  const [entrada, setEntrada] = useState("");
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta" | "info"; texto: string } | null>(null);
  const [ocupado, arrancar] = useTransition();

  const dominio = negocio.dominio;
  const estado = negocio.dominio_estado;

  const guardar = () => {
    setMsg(null);
    arrancar(async () => {
      const r = await guardarDominioSolutions(negocio.id, entrada);
      if (!r.ok) return setMsg({ tono: "alerta", texto: r.motivo });
      setEntrada("");
      setMsg({ tono: "exito", texto: "Dominio guardado. Ahora poné el registro en tu DNS." });
      router.refresh();
    });
  };

  const verificar = () => {
    setMsg(null);
    arrancar(async () => {
      const r = await verificarDominioSolutions(negocio.id);
      if (!r.ok) return setMsg({ tono: "alerta", texto: r.motivo });
      setMsg({ tono: r.estado === "activo" ? "exito" : "info", texto: r.nota });
      router.refresh();
    });
  };

  const quitar = () => {
    if (!confirm(`¿Quitar ${dominio}? Tu página sigue en bookea.lat/s/${negocio.slug}.`)) return;
    setMsg(null);
    arrancar(async () => {
      const r = await quitarDominioSolutions(negocio.id);
      if (!r.ok) return setMsg({ tono: "alerta", texto: r.motivo });
      router.refresh();
    });
  };

  const pildora = dominio ? (
    <PildoraEstado estado={estado === "activo" ? "exito" : estado === "error" ? "alerta" : "aviso"}>
      {estado === "activo" ? "Activo" : estado === "error" ? "Con error" : "Pendiente"}
    </PildoraEstado>
  ) : (
    <PildoraEstado estado="neutro">Opcional</PildoraEstado>
  );

  return (
    <Card eyebrow="Tu mini portal" titulo="Tu propio dominio" accion={pildora}>
      {!dominio ? (
        <>
          <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
            Tu página también puede vivir en tu dominio: <strong>casanostra.com</strong> o{" "}
            <strong>menu.casanostra.com</strong>. Vos lo comprás donde quieras; nosotros lo conectamos.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <label htmlFor="dominio" className={ROTULO_CAMPO}>
                Tu dominio
              </label>
              <input
                id="dominio"
                type="text"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                placeholder="casanostra.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={`mt-1.5 ${CAMPO_PANEL}`}
              />
            </div>
            <button type="button" onClick={guardar} disabled={ocupado || !entrada.trim()} className={BOTON_PANEL_PRIMARIO}>
              {ocupado ? "Guardando…" : "Usar este dominio"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="break-all text-[16px] font-extrabold text-aventurea-navy">
            {estado === "activo" ? (
              <a href={`https://${dominio}`} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                https://{dominio} →
              </a>
            ) : (
              dominio
            )}
          </p>
          {negocio.dominio_nota && (
            <p className="mt-1 text-[12.5px] leading-snug text-aventurea-ink-soft">{negocio.dominio_nota}</p>
          )}

          {estado !== "activo" && (
            <div className="mt-4">
              <p className={ROTULO_CAMPO}>Poné esto en el DNS de tu dominio</p>
              <p className="mt-1 text-[12px] leading-snug text-aventurea-ink-soft">
                Entrá donde compraste el dominio (GoDaddy, Namecheap, Cloudflare, tu proveedor) y agregá
                {instruccionesDns(dominio).length > 1 ? " estos registros" : " este registro"}. Suele tardar entre
                minutos y unas horas en propagarse.
              </p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-aventurea-line">
                <table className="w-full text-[13px]">
                  <thead className="bg-aventurea-cream-2 text-left text-[11px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">
                    <tr>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aventurea-line font-mono">
                    {instruccionesDns(dominio).map((r) => (
                      <tr key={`${r.tipo}-${r.nombre}`}>
                        <td className="px-3 py-2 font-bold">{r.tipo}</td>
                        <td className="px-3 py-2">{r.nombre}</td>
                        <td className="px-3 py-2 break-all">{r.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={verificar} disabled={ocupado} className={BOTON_PANEL_PRIMARIO}>
              {ocupado ? "Comprobando…" : estado === "activo" ? "Volver a comprobar" : "Verificar ahora"}
            </button>
            <button type="button" onClick={quitar} disabled={ocupado} className={BOTON_PANEL}>
              Quitar dominio
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
            Tu página sigue disponible en bookea.lat/s/{negocio.slug}; el QR que ya imprimiste no cambia.
          </p>
        </>
      )}

      {/* Después de «Verificar», la nota guardada y el mensaje dicen lo
          mismo: se muestra una sola vez. */}
      {msg && msg.texto !== negocio.dominio_nota && (
        <p
          className={`mt-3 text-[13px] font-bold ${
            msg.tono === "exito" ? "text-green-700" : msg.tono === "alerta" ? "text-red-700" : "text-aventurea-navy"
          }`}
        >
          {msg.texto}
        </p>
      )}
    </Card>
  );
}
