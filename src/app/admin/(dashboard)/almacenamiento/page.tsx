import { createClient } from "@/lib/supabase/server";
import AlmacenamientoPanel, {
  type FilaArchivo,
  type FilaBucket,
  type FilaInvitacion,
  type FilaUsuario,
} from "./almacenamiento-panel";

/**
 * Almacenamiento: quién está pesando.
 *
 * Los números salen de cuatro funciones `security definer` (migración
 * 0080) que agregan `storage.objects` sin exponer la tabla: PostgREST
 * no la publica, y con razón — ahí viven también los comprobantes de
 * pago. Cada función exige rol admin por su cuenta.
 *
 * No se parte por sección (la cookie del header): el disco es uno solo
 * para toda la plataforma.
 */
export default async function AdminAlmacenamientoPage() {
  const supabase = await createClient();

  const [bucketsRes, usuariosRes, invitacionesRes, archivosRes] = await Promise.all([
    supabase.rpc("almacenamiento_por_bucket"),
    supabase.rpc("almacenamiento_por_usuario"),
    supabase.rpc("almacenamiento_por_invitacion"),
    supabase.rpc("almacenamiento_archivos_top", { limite: 60 }),
  ]);

  // Si la migración no corrió, las cuatro fallan igual: se avisa una vez.
  const faltaMigracion = Boolean(
    bucketsRes.error &&
      /almacenamiento_por_bucket|does not exist|schema cache/i.test(
        bucketsRes.error.message,
      ),
  );

  const numero = (v: unknown) => Number(v ?? 0);
  const buckets: FilaBucket[] = (bucketsRes.data ?? []).map(
    (f: Record<string, unknown>) => ({
      bucket: String(f.bucket ?? "—"),
      archivos: numero(f.archivos),
      bytes: numero(f.bytes),
    }),
  );
  const usuarios: FilaUsuario[] = (usuariosRes.data ?? []).map(
    (f: Record<string, unknown>) => ({
      usuario_id: String(f.usuario_id ?? ""),
      email: (f.email as string | null) ?? null,
      nombre: (f.nombre as string | null) ?? null,
      archivos: numero(f.archivos),
      bytes: numero(f.bytes),
      bytes_sin_usar: numero(f.bytes_sin_usar),
    }),
  );
  const invitaciones: FilaInvitacion[] = (invitacionesRes.data ?? []).map(
    (f: Record<string, unknown>) => ({
      invitacion_id: String(f.invitacion_id ?? ""),
      titulo: (f.titulo as string | null) ?? null,
      slug: (f.slug as string | null) ?? null,
      estado: (f.estado as string | null) ?? null,
      cliente: (f.cliente as string | null) ?? null,
      creada: (f.creada as string | null) ?? null,
      archivos: numero(f.archivos),
      bytes: numero(f.bytes),
    }),
  );
  const archivos: FilaArchivo[] = (archivosRes.data ?? []).map(
    (f: Record<string, unknown>) => ({
      bucket: String(f.bucket ?? "—"),
      ruta: String(f.ruta ?? ""),
      bytes: numero(f.bytes),
      tipo: (f.tipo as string | null) ?? null,
      creado: (f.creado as string | null) ?? null,
    }),
  );

  const errores = [
    bucketsRes.error,
    usuariosRes.error,
    invitacionesRes.error,
    archivosRes.error,
  ]
    .filter(Boolean)
    .map((e) => e!.message);

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Almacenamiento</h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Quién está pesando: cuántos megas guarda cada cuenta, cuál invitación
        se llevó el disco y qué archivos son los más grandes. Storage se cobra
        por giga guardado, así que acá se ve de dónde sale la factura.
      </p>

      {faltaMigracion ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no corrió la migración{" "}
          <strong>0080_panel_almacenamiento.sql</strong> en Supabase: es la que
          crea las funciones que miden el disco. Corrésela y esta pantalla se
          llena sola.
        </p>
      ) : (
        <>
          {errores.length > 0 && (
            <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              No se pudo cargar todo: {errores.join(" · ")}
            </p>
          )}
          <AlmacenamientoPanel
            buckets={buckets}
            usuarios={usuarios}
            invitaciones={invitaciones}
            archivos={archivos}
          />
        </>
      )}
    </div>
  );
}
