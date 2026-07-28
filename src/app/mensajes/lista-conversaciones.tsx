import Link from "next/link";

/**
 * La lista de la bandeja de mensajes, separada de la página para poder
 * probarla con datos de mentira. No sabe nada de Supabase: recibe las
 * filas ya armadas.
 */

export type FilaConversacion = {
  id: string;
  reservaId: string;
  titulo: string;
  subtitulo: string;
  foto: string | null;
  ultimoTexto: string;
  actividad: string;
  pendientes: number;
};

export function fechaCorta(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

export default function ListaConversaciones({ filas }: { filas: FilaConversacion[] }) {
  if (filas.length === 0) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-8 text-center">
        <p className="text-[14px] font-bold text-aventurea-ink">
          Todavía no tenés conversaciones.
        </p>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-aventurea-ink-soft">
          Cuando reservés un lugar o pidás una cotización, el chat con el
          proveedor aparece acá.
        </p>
        <Link
          href="/ranchos-eventos"
          className="mt-5 inline-flex rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
        >
          Ver el directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      {filas.map((f) => (
        <Link
          key={f.id}
          href={`/mensajes/${f.reservaId}`}
          className="flex items-center gap-3.5 border-b border-aventurea-line px-4 py-3.5 transition-colors last:border-none hover:bg-aventurea-cream-2/50"
        >
          <div
            className="h-12 w-12 shrink-0 rounded-full bg-aventurea-cream-2 bg-cover bg-center"
            style={f.foto ? { backgroundImage: `url(${f.foto})` } : undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[14px] font-bold text-aventurea-ink">
                {f.titulo}
              </p>
              <p className="shrink-0 text-[11.5px] text-zinc-500">
                {fechaCorta(f.actividad)}
              </p>
            </div>
            {f.subtitulo && (
              <p className="truncate text-[12px] text-aventurea-ink-soft">
                {f.subtitulo}
              </p>
            )}
            <p
              className={`mt-0.5 truncate text-[12.5px] ${
                f.pendientes > 0
                  ? "font-bold text-aventurea-ink"
                  : "text-aventurea-ink-soft"
              }`}
            >
              {f.ultimoTexto}
            </p>
          </div>
          {f.pendientes > 0 && (
            <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-aventurea-navy px-1.5 text-[11px] font-bold text-white">
              {f.pendientes}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
