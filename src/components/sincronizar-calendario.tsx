import BotonCopiar from "./boton-copiar";
import { IconCalendarLine } from "./icons";

/**
 * La tarjeta "Sincronizá tu calendario" del panel del proveedor: el
 * link del feed .ics del negocio con instrucciones para suscribirlo
 * en Google Calendar o Apple Calendar. Suscribir (no importar): el
 * calendario se refresca solo cuando entran reservas nuevas.
 *
 * `feedUrl` null = la migración 0071 no ha corrido o el token no se
 * pudo crear — la tarjeta no se muestra y el panel sigue igual.
 */
export default function SincronizarCalendario({ feedUrl }: { feedUrl: string | null }) {
  if (!feedUrl) return null;

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-5">
      <h3 className="flex items-center gap-2 text-[14px] font-extrabold text-aventurea-ink">
        <IconCalendarLine className="h-4.5 w-4.5 text-aventurea-orange" />
        Sincronizá tu calendario
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
        Si llevás tu agenda en Google Calendar o en el calendario del iPhone,
        suscribí este link una sola vez: tus reservas y citas de Bookea van a
        aparecer ahí solitas, junto a lo demás de tu día.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-aventurea-line bg-white px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-aventurea-ink">
          {feedUrl}
        </span>
        <BotonCopiar texto={feedUrl} etiqueta="Copiar link" />
      </div>

      <ul className="mt-3 grid gap-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        <li>
          <span className="font-bold text-aventurea-ink">Google Calendar:</span>{" "}
          Configuración → Añadir calendario → Desde URL → pegá el link.
        </li>
        <li>
          <span className="font-bold text-aventurea-ink">iPhone / Apple Calendar:</span>{" "}
          Ajustes → Apps → Calendario → Cuentas → Añadir cuenta → Otra →
          Añadir suscripción de calendario → pegá el link.
        </li>
      </ul>
      <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
        El link es privado de tu negocio — no lo compartás con nadie.
      </p>
    </div>
  );
}
