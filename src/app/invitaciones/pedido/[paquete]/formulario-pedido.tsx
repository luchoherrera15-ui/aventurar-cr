"use client";

import { useActionState } from "react";
import { crearPedido, type EstadoPedido } from "@/app/invitaciones/pedido/actions";
import { ALBUM_ADICIONAL, TIPOS_EVENTO } from "@/lib/paquetes-invitaciones";

/**
 * Los datos que el diseñador necesita para armar la invitación. Solo
 * cuatro campos son obligatorios (tipo, nombre, fecha y contacto): el
 * resto se puede completar después por el chat, y pedirlo todo de
 * golpe espantaría a medio mundo.
 */
export default function FormularioPedido({
  paqueteId,
  nombreSugerido,
  correoSugerido,
  albumSugerido = false,
}: {
  paqueteId: string;
  nombreSugerido: string;
  correoSugerido: string;
  /** Viene marcado si lo eligió en la página de paquetes. */
  albumSugerido?: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoPedido, FormData>(
    crearPedido.bind(null, paqueteId),
    {},
  );

  return (
    <form action={accion} className="mt-5 grid gap-4">
      <Bloque titulo="Tu fiesta">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tipo de evento" requerido>
            <select name="tipo_evento" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Elegí una opción
              </option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="¿Cómo se llama?" requerido ayuda="Ej: Los 15 de Sofía">
            <input
              name="nombre_evento"
              required
              maxLength={160}
              placeholder="Los 15 de Sofía"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Fecha del evento" requerido>
            <input type="date" name="fecha_evento" required className={inputCls} />
          </Campo>
          <Campo etiqueta="Hora">
            <input type="time" name="hora" className={inputCls} />
          </Campo>
          <Campo etiqueta="Anfitriones" ayuda="Los nombres que van en la invitación">
            <input
              name="anfitriones"
              maxLength={200}
              placeholder="Familia Vargas Solís"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Cantidad de invitados (aprox.)">
            <input
              type="number"
              name="cantidad_invitados"
              min={1}
              max={5000}
              placeholder="80"
              className={inputCls}
            />
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="El lugar">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre del lugar">
            <input
              name="lugar_nombre"
              maxLength={160}
              placeholder="Hacienda La Ceiba"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Dirección o señas">
            <input
              name="lugar_direccion"
              maxLength={300}
              placeholder="Alajuela, 500 m norte de..."
              className={inputCls}
            />
          </Campo>
          <Campo
            etiqueta="Link de Google Maps"
            ayuda="Opcional — así tus invitados llegan de un toque"
          >
            <input
              name="maps_url"
              type="url"
              maxLength={500}
              placeholder="https://maps.app.goo.gl/..."
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Confirmar antes del" ayuda="La fecha límite del RSVP">
            <input type="date" name="fecha_limite_confirmacion" className={inputCls} />
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="El estilo">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Temática" ayuda="Ej: safari, princesas, minimalista, gala">
              <input
                name="tematica"
                maxLength={200}
                placeholder="Elegante en dorado y marfil"
                className={inputCls}
              />
            </Campo>
            <Campo etiqueta="Colores">
              <input
                name="colores"
                maxLength={160}
                placeholder="Dorado, marfil y verde olivo"
                className={inputCls}
              />
            </Campo>
          </div>
          <Campo etiqueta="Idioma de la invitación">
            <select name="idioma" className={inputCls} defaultValue="es">
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="bilingue">Bilingüe (español e inglés)</option>
            </select>
          </Campo>
          <Campo
            etiqueta="Contanos lo que soñás"
            ayuda="Detalles, dedicatoria, código de vestimenta, lo que quieras que lleve"
          >
            <textarea
              name="mensaje"
              rows={4}
              maxLength={1200}
              placeholder="Queremos algo romántico, con una foto de nosotros y cuenta regresiva..."
              className={`${inputCls} resize-y`}
            />
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="¿Con quién hablamos?">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Tu nombre" requerido>
            <input
              name="contacto_nombre"
              required
              maxLength={120}
              defaultValue={nombreSugerido}
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="WhatsApp">
            <input
              name="contacto_whatsapp"
              maxLength={40}
              placeholder="8888 8888"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Correo" requerido>
            <input
              type="email"
              name="contacto_correo"
              required
              maxLength={160}
              defaultValue={correoSugerido}
              className={inputCls}
            />
          </Campo>
        </div>
      </Bloque>

      {/* El álbum como extra. Lo que se manda es un checkbox y nada
          más: el precio lo pone la base al crear el pedido (0091), así
          que marcar esto no puede cambiar cuánto se cobra por su
          cuenta. Viene premarcado si el cliente ya lo eligió en la
          página de paquetes, pero se puede desmarcar acá. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 transition-colors hover:border-aventurea-sky">
        <input
          type="checkbox"
          name="con_album"
          defaultChecked={albumSugerido}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-aventurea-sky"
        />
        <span>
          <span className="block text-[14px] font-bold text-aventurea-ink">
            Agregar {ALBUM_ADICIONAL.nombre} · +${ALBUM_ADICIONAL.precioUSD}
          </span>
          <span className="mt-1 block text-[13px] leading-relaxed text-aventurea-ink-soft">
            {ALBUM_ADICIONAL.detalle}
          </span>
        </span>
      </label>

      {estado.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-xl bg-aventurea-sky px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark disabled:opacity-60"
      >
        {pendiente ? "Guardando tu pedido..." : "Continuar al pago →"}
      </button>
      <p className="text-center text-[12px] text-aventurea-ink-soft">
        Todavía no se cobra nada: en el siguiente paso elegís cómo pagar.
      </p>
    </form>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-aventurea-line bg-white px-3.5 text-[13.5px] text-aventurea-ink placeholder:text-aventurea-ink-soft/50 focus:border-aventurea-navy focus:outline-none";

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-aventurea-line bg-white p-5">
      <legend className="px-2 text-[12px] font-bold uppercase tracking-[0.14em] text-aventurea-orange">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

function Campo({
  etiqueta,
  ayuda,
  requerido,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-aventurea-ink">
        {etiqueta}
        {requerido && <span className="ml-1 text-aventurea-orange">*</span>}
      </span>
      {children}
      {ayuda && (
        <span className="mt-1 block text-[11.5px] leading-snug text-aventurea-ink-soft">
          {ayuda}
        </span>
      )}
    </label>
  );
}
