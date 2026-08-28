"use client";

import { useState, useTransition } from "react";
import { Card, CardVacia } from "@/components/panel/piezas";
import { CUERPO_SUAVE, RADIO_TILE, ROTULO_CIFRA } from "@/components/panel/sistema";
import CopiarLink from "./copiar-link";
import { guardarPermiteManualEnLink } from "./link-scan-actions";

/**
 * EL LINK DIRECTO DE LA CAJA (0206): `bookea.lat/<negocio>/scan`.
 *
 * Pedido del dueño: una ventana aparte —sin el menú del panel
 * alrededor— para dejar puesta en el teléfono del mostrador. Adentro se
 * ve exactamente el mismo escáner que el Inicio del panel (mismo componente,
 * misma sesión, mismo checklist de la 0127); lo único que se configura
 * ACÁ es si ese link, además de escanear, también deja buscar y atender
 * a mano — arranca apagado, tarjeta por tarjeta.
 *
 * Con una sola tarjeta el link es corto y fijo. Con varias, quien lo abre
 * elige primero cuál está operando (ver `[slug]/scan/page.tsx`) — por eso
 * acá se listan todas, cada una con su propio interruptor.
 */
const SITIO = "https://www.bookea.lat";

export type TarjetaConLink = {
  id: string;
  nombre: string;
  permiteManual: boolean;
};

export default function LinkScanLealtad({
  ranchoId,
  slug,
  tarjetas,
}: {
  ranchoId: string;
  slug: string | null;
  tarjetas: TarjetaConLink[];
}) {
  if (!slug) return null;

  const url = `${SITIO}/${slug}/scan`;

  return (
    <Card eyebrow="Para dejar en el mostrador" titulo="Link directo de la caja" nivel="h3">
      <p className={CUERPO_SUAVE}>
        Abrí este link en el teléfono o la tablet de la caja: entra derecho al
        escáner, sin el resto del panel alrededor. Sirve la sesión de quien lo
        abra — cada quien necesita su propia cuenta invitada, igual que hoy.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 break-all rounded-lg bg-aventurea-cream-2 px-3 py-2 font-mono text-[12.5px] text-aventurea-ink">
          {url}
        </p>
        <CopiarLink url={url} etiqueta="el link de la caja" />
      </div>

      {tarjetas.length === 0 ? (
        <CardVacia>Todavía no tenés una tarjeta creada.</CardVacia>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {tarjetas.map((t) => (
            <li
              key={t.id}
              className={`${RADIO_TILE} flex flex-wrap items-center justify-between gap-2 border border-aventurea-line bg-aventurea-surface px-4 py-3`}
            >
              <span className="min-w-0">
                <span className={ROTULO_CIFRA}>{t.nombre}</span>
                {tarjetas.length > 1 && (
                  <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                    {url}?tarjeta={t.id}
                  </span>
                )}
              </span>
              <InterruptorManual ranchoId={ranchoId} programaId={t.id} inicial={t.permiteManual} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function InterruptorManual({
  ranchoId,
  programaId,
  inicial,
}: {
  ranchoId: string;
  programaId: string;
  inicial: boolean;
}) {
  const [permite, setPermite] = useState(inicial);
  const [ocupado, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cambiar(valor: boolean) {
    setPermite(valor);
    setError(null);
    iniciar(async () => {
      const res = await guardarPermiteManualEnLink(ranchoId, programaId, valor);
      if (!res.ok) {
        setPermite(!valor);
        setError(res.motivo);
      }
    });
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <label className="flex cursor-pointer items-center gap-2">
        <span className="text-[12px] font-bold text-aventurea-ink-soft">
          Dejar buscar a mano
        </span>
        <input
          type="checkbox"
          checked={permite}
          disabled={ocupado}
          onChange={(e) => cambiar(e.target.checked)}
          className="h-4 w-4"
          style={{ accentColor: "var(--orange)" }}
        />
      </label>
      {error && <span className="text-[11px] font-bold text-red-700">{error}</span>}
    </span>
  );
}
