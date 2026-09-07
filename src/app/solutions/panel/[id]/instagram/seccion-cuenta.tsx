"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CUERPO_SUAVE } from "@/components/panel/sistema";
import type { CuentaIg } from "@/lib/instagram/tipos";
import type { EstadoToken } from "@/lib/instagram/tokens";
import { desconectarInstagramIg, refrescarTokenIg, reintentarSuscripcionIg } from "./actions";

/**
 * LA CUENTA DE INSTAGRAM — conectar, ver el estado, desconectar.
 *
 * El botón «Conectar» es un enlace a /api/instagram/conectar: el OAuth
 * empieza en el servidor (que firma el state), no acá. Nada de esta
 * pantalla ve un token: `CuentaIg` no lo tiene.
 */

const FECHA = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Costa_Rica" });

export default function SeccionCuenta({
  negocioId,
  cuenta,
  estadoToken,
  configurado,
  faltantes,
}: {
  negocioId: string;
  cuenta: CuentaIg | null;
  estadoToken: EstadoToken | null;
  configurado: boolean;
  faltantes: string[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta" | "info"; texto: string } | null>(null);
  const [ocupado, arrancar] = useTransition();
  const conectarHref = `/api/instagram/conectar?negocio=${negocioId}`;

  if (!configurado) {
    return (
      <Card eyebrow="Instagram" titulo="Instagram no está configurado">
        <p className={CUERPO_SUAVE}>
          Faltan variables de entorno en el servidor: <span className="font-mono">{faltantes.join(", ")}</span>. El paso a paso
          está en <span className="font-mono">docs/instagram-auto-reply.md</span>.
        </p>
      </Card>
    );
  }

  if (!cuenta || cuenta.estado === "desconectada") {
    return (
      <Card eyebrow="Instagram" titulo="Conectá tu Instagram">
        <p className={CUERPO_SUAVE}>
          Cuando alguien comente una publicación tuya con una palabra clave, le mandamos un mensaje privado con tu
          enlace. Necesitás una cuenta <strong>profesional</strong> (Empresa o Creador) y aceptar los permisos que pide
          Instagram: ver tu perfil y publicaciones, leer y responder comentarios, y mandar mensajes.
        </p>
        <a href={conectarHref} className={`mt-4 inline-flex ${BOTON_PANEL_PRIMARIO}`}>
          Conectar Instagram →
        </a>
        {cuenta?.estado === "desconectada" && <p className={`mt-2 ${CUERPO_SUAVE}`}>Tu cuenta @{cuenta.username} está desconectada; volvé a conectarla cuando quieras.</p>}
      </Card>
    );
  }

  const necesitaReconectar = cuenta.estado === "reconectar" || estadoToken === "vencido";
  const pildora = necesitaReconectar ? (
    <PildoraEstado estado="alerta">Reconectar</PildoraEstado>
  ) : estadoToken === "por_vencer" ? (
    <PildoraEstado estado="aviso">Por vencer</PildoraEstado>
  ) : (
    <PildoraEstado estado="exito">Conectada</PildoraEstado>
  );

  const correr = (fn: () => Promise<{ ok: boolean; motivo?: string; resultado?: string }>, exito?: string) => {
    setMsg(null);
    arrancar(async () => {
      const r = await fn();
      if (!r.ok) return setMsg({ tono: "alerta", texto: r.motivo ?? "No se pudo." });
      setMsg({ tono: "exito", texto: r.resultado ?? exito ?? "Listo." });
      router.refresh();
    });
  };

  return (
    <Card eyebrow="Instagram" titulo="Tu cuenta" accion={pildora}>
      <div className="flex items-center gap-3">
        {cuenta.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar externo de Instagram
          <img src={cuenta.foto_url} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-aventurea-cream-2 text-[16px] font-extrabold text-aventurea-navy">
            {cuenta.username.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold text-aventurea-navy">@{cuenta.username}</p>
          <p className={CUERPO_SUAVE}>
            {cuenta.tipo_cuenta === "BUSINESS" ? "Cuenta de empresa" : "Cuenta de creador"} · conectada el {FECHA.format(new Date(cuenta.conectada_en))}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-[12.5px] sm:grid-cols-2">
        <div className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-3 py-2">
          <dt className="font-bold text-aventurea-ink-soft">Token</dt>
          <dd className="text-aventurea-ink">
            {estadoToken === "vencido" ? "Vencido — reconectá" : `Vence el ${FECHA.format(new Date(cuenta.token_vence_en))}`}
            {cuenta.token_refrescado_en ? ` · renovado el ${FECHA.format(new Date(cuenta.token_refrescado_en))}` : ""}
          </dd>
        </div>
        <div className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-3 py-2">
          <dt className="font-bold text-aventurea-ink-soft">Avisos de comentarios</dt>
          <dd className="text-aventurea-ink">{cuenta.suscrito_webhook ? "Suscrita al webhook ✓" : "Sin suscribir — los comentarios no llegan"}</dd>
        </div>
      </dl>
      {cuenta.estado_nota && <p className={`mt-2 ${CUERPO_SUAVE}`}>{cuenta.estado_nota}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {necesitaReconectar ? (
          <a href={conectarHref} className={BOTON_PANEL_PRIMARIO}>
            Reconectar Instagram
          </a>
        ) : (
          <a href={conectarHref} className={BOTON_PANEL}>
            Volver a conectar
          </a>
        )}
        {!cuenta.suscrito_webhook && !necesitaReconectar && (
          <button type="button" onClick={() => correr(() => reintentarSuscripcionIg(negocioId), "Suscripción al webhook lista.")} disabled={ocupado} className={BOTON_PANEL_PRIMARIO}>
            {ocupado ? "Un momento…" : "Reintentar suscripción"}
          </button>
        )}
        {estadoToken === "por_vencer" && (
          <button type="button" onClick={() => correr(() => refrescarTokenIg(negocioId))} disabled={ocupado} className={BOTON_PANEL}>
            Renovar token
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!confirm(`¿Desconectar @${cuenta.username}? Las automatizaciones dejan de responder hasta que vuelvas a conectar.`)) return;
            correr(() => desconectarInstagramIg(negocioId), "Cuenta desconectada.");
          }}
          disabled={ocupado}
          className={BOTON_PANEL}
        >
          Desconectar
        </button>
      </div>
      {msg && (
        <p className={`mt-3 text-[13px] font-bold ${msg.tono === "exito" ? "text-green-700" : msg.tono === "alerta" ? "text-red-700" : "text-aventurea-navy"}`}>{msg.texto}</p>
      )}
    </Card>
  );
}
