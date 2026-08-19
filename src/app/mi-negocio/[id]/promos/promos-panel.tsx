"use client";

import { useActionState, useState, useTransition } from "react";
import SubirImagen from "@/components/subir-imagen";
import {
  alternarPromo,
  borrarPromo,
  crearPromo,
  editarPromo,
  type EstadoPromo,
} from "./actions";

export type PromoFila = {
  id: string;
  titulo: string;
  descripcion: string | null;
  foto_url: string | null;
  descuento_porcentaje: number | null;
  precio_antes: number | null;
  precio_ahora: number | null;
  desde: string | null;
  hasta: string | null;
  activa: boolean;
};

const INICIAL: EstadoPromo = { error: null };

const campo =
  "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] " +
  "text-aventurea-ink outline-none focus:border-aventurea-navy";
const etiqueta = "mb-1.5 block text-[12.5px] font-bold text-aventurea-ink";

const CRC = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "dic",
];
function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MESES[m - 1]}`;
}

/**
 * LAS PROMOS DEL NEGOCIO.
 *
 * Acá el dueño escribe lo que quiere anunciar y le sale en la pestaña
 * «Promos» de la app, mezclado con las de los demás negocios.
 *
 * ── EL GANCHO ES UNO SOLO, Y LA INTERFAZ LO IMPONE ─────────────────
 * Una promo dice «20 %» O dice «₡5.000 en vez de ₡8.000». Nunca las
 * dos: son dos formas de decir lo mismo que se contradicen en cuanto
 * alguien edita una y se olvida de la otra. La base lo rechaza
 * (constraint `promociones_un_solo_gancho`, 0189) y acá se elige con
 * un par de botones, así que el error no llega a pasar.
 */
export default function PromosPanel({
  ranchoId,
  promos,
}: {
  ranchoId: string;
  promos: PromoFila[];
}) {
  const [editando, setEditando] = useState<PromoFila | null>(null);
  const [creando, setCreando] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {!creando && !editando && (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="self-start rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
        >
          Crear una promo
        </button>
      )}

      {(creando || editando) && (
        <Formulario
          ranchoId={ranchoId}
          promo={editando}
          alCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}

      {promos.length === 0 && !creando ? (
        <div className="rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-10 text-center">
          <p className="text-[15px] font-bold text-aventurea-ink">Todavía no publicaste ninguna</p>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
            Una promo es un anuncio: «20 % en corte esta semana», «2x1 en manicura los martes».
            Sale en la pestaña Promos de la app, junto con las de los demás negocios.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {promos.map((p) => (
            <Fila
              key={p.id}
              ranchoId={ranchoId}
              promo={p}
              alEditar={() => {
                setCreando(false);
                setEditando(p);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Fila({
  ranchoId,
  promo,
  alEditar,
}: {
  ranchoId: string;
  promo: PromoFila;
  alEditar: () => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const gancho =
    promo.descuento_porcentaje !== null
      ? `${promo.descuento_porcentaje}% OFF`
      : promo.precio_ahora !== null
        ? CRC.format(promo.precio_ahora)
        : null;

  const desde = fechaCorta(promo.desde);
  const hasta = fechaCorta(promo.hasta);
  const cuando =
    desde && hasta ? `${desde} — ${hasta}` : hasta ? `Hasta el ${hasta}` : desde ? `Desde el ${desde}` : "Sin fecha de fin";

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-aventurea-line bg-white p-4">
      <div
        className="h-14 w-14 shrink-0 rounded-xl bg-aventurea-cream-2 bg-cover bg-center"
        style={promo.foto_url ? { backgroundImage: `url(${promo.foto_url})` } : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14.5px] font-bold text-aventurea-ink">{promo.titulo}</p>
          {gancho && (
            <span className="rounded-md bg-aventurea-orange px-2 py-0.5 text-[11px] font-extrabold text-aventurea-ink">
              {gancho}
            </span>
          )}
          {!promo.activa && (
            <span className="rounded-md bg-aventurea-cream-2 px-2 py-0.5 text-[11px] font-bold text-aventurea-ink-soft">
              Apagada
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">{cuando}</p>
        {error && <p className="mt-1 text-[12.5px] font-bold text-red-700">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await alternarPromo(ranchoId, promo.id, !promo.activa);
              setError(r.error);
            })
          }
          className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
        >
          {promo.activa ? "Apagar" : "Prender"}
        </button>
        <button
          type="button"
          onClick={alEditar}
          className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
        >
          Editar
        </button>
        {confirmando ? (
          <>
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await borrarPromo(ranchoId, promo.id);
                  setError(r.error);
                })
              }
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-bold text-white"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-[12.5px] font-bold text-aventurea-ink-soft"
            >
              No
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-red-700 transition-colors hover:border-red-400"
          >
            Borrar
          </button>
        )}
      </div>
    </li>
  );
}

function Formulario({
  ranchoId,
  promo,
  alCerrar,
}: {
  ranchoId: string;
  promo: PromoFila | null;
  alCerrar: () => void;
}) {
  const accion = promo
    ? editarPromo.bind(null, ranchoId, promo.id)
    : crearPromo.bind(null, ranchoId);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  // Qué gancho está usando: el porcentaje o el par de precios. Se
  // decide acá para que la base nunca reciba los dos.
  const [tipoGancho, setTipoGancho] = useState<"porcentaje" | "precios" | "ninguno">(
    promo?.descuento_porcentaje !== null && promo?.descuento_porcentaje !== undefined
      ? "porcentaje"
      : promo?.precio_ahora !== null && promo?.precio_ahora !== undefined
        ? "precios"
        : "ninguno",
  );
  const [foto, setFoto] = useState(promo?.foto_url ?? "");

  if (estado.ok) {
    // Guardó: la lista de arriba ya se revalidó en el servidor.
    alCerrar();
  }

  return (
    <form action={enviar} className="flex flex-col gap-4 rounded-2xl border border-aventurea-line bg-white p-5">
      <h2 className="text-[16px] font-bold text-aventurea-ink">
        {promo ? "Editar la promo" : "Nueva promo"}
      </h2>

      <label className="block">
        <span className={etiqueta}>¿Qué estás ofreciendo?</span>
        <input
          name="titulo"
          defaultValue={promo?.titulo ?? ""}
          required
          maxLength={80}
          placeholder="20 % en corte de pelo"
          className={campo}
        />
      </label>

      <label className="block">
        <span className={etiqueta}>Detalle (opcional)</span>
        <textarea
          name="descripcion"
          defaultValue={promo?.descripcion ?? ""}
          rows={2}
          maxLength={280}
          placeholder="Solo martes y miércoles, con cita previa."
          className={campo}
        />
      </label>

      <div>
        <SubirImagen
          valor={foto}
          alCambiar={setFoto}
          etiqueta="Foto de la promo (opcional)"
          carpeta="promos"
        />
        <input type="hidden" name="foto_url" value={foto} />
        <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
          Si no ponés ninguna, se usa la foto de tu negocio.
        </p>
      </div>

      <div>
        <span className={etiqueta}>El gancho</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["porcentaje", "Un porcentaje"],
              ["precios", "Precio antes y ahora"],
              ["ninguno", "Sin número"],
            ] as const
          ).map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setTipoGancho(valor)}
              className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                tipoGancho === valor
                  ? "bg-aventurea-navy text-white"
                  : "border border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Solo se dibuja el elegido: los campos del otro NO viajan, y
            así la base no puede recibir los dos ganchos a la vez. */}
        {tipoGancho === "porcentaje" && (
          <div className="mt-3 max-w-[200px]">
            <input
              name="descuento_porcentaje"
              type="number"
              min={1}
              max={90}
              defaultValue={promo?.descuento_porcentaje ?? ""}
              placeholder="20"
              className={campo}
            />
            <p className="mt-1 text-[12px] text-aventurea-ink-soft">Entre 1 % y 90 %.</p>
          </div>
        )}

        {tipoGancho === "precios" && (
          <div className="mt-3 grid max-w-[420px] gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-aventurea-ink-soft">Antes</span>
              <input
                name="precio_antes"
                type="number"
                min={0}
                defaultValue={promo?.precio_antes ?? ""}
                placeholder="8000"
                className={campo}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-aventurea-ink-soft">Ahora</span>
              <input
                name="precio_ahora"
                type="number"
                min={0}
                defaultValue={promo?.precio_ahora ?? ""}
                placeholder="5000"
                className={campo}
              />
            </label>
          </div>
        )}
      </div>

      <div className="grid max-w-[420px] gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Desde</span>
          <input name="desde" type="date" defaultValue={promo?.desde ?? ""} className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Hasta</span>
          <input name="hasta" type="date" defaultValue={promo?.hasta ?? ""} className={campo} />
        </label>
      </div>
      <p className="-mt-2 text-[12px] text-aventurea-ink-soft">
        Sin fechas, la promo vale hasta que la apagués.
      </p>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="activa"
          defaultChecked={promo?.activa ?? true}
          className="h-4 w-4 accent-aventurea-navy"
        />
        <span className="text-[13.5px] text-aventurea-ink">Publicarla ya en la app</span>
      </label>

      {estado.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : promo ? "Guardar los cambios" : "Publicar la promo"}
        </button>
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-xl border border-aventurea-line px-5 py-2.5 text-[14px] font-bold text-aventurea-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
