import { createClient } from "@/lib/supabase/server";
import ReclamosTabla, { type ReclamoFila } from "./reclamos-tabla";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /admin/reclamos — quién dice que un negocio publicado es suyo
 * ════════════════════════════════════════════════════════════════════
 *
 * La bandeja del flujo de reclamo (0218). El gate de admin vive en el
 * layout del dashboard, igual que en el resto de las pantallas; acá la
 * RLS de `reclamos_negocio` solo deja leer a administradores, así que
 * el cliente CON sesión es el correcto — no hace falta la llave de
 * servicio.
 */
export default async function AdminReclamosPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reclamos_negocio")
    .select(
      "id, rancho_id, nombre, correo, telefono, mensaje, estado, created_at, nota_interna, ranchos(nombre, slug)",
    )
    .order("created_at", { ascending: false });

  const filas: ReclamoFila[] = (data ?? []).map((r) => {
    const negocio = r.ranchos as unknown as { nombre: string; slug: string | null } | null;
    return {
      id: r.id as string,
      negocio: negocio?.nombre ?? "(negocio borrado)",
      slug: negocio?.slug ?? null,
      nombre: r.nombre as string,
      correo: r.correo as string,
      telefono: (r.telefono as string | null) ?? null,
      mensaje: (r.mensaje as string | null) ?? null,
      estado: r.estado as ReclamoFila["estado"],
      creadoEn: r.created_at as string,
      notaInterna: (r.nota_interna as string | null) ?? null,
    };
  });

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-[-0.4px] text-aventurea-ink">
        Reclamos de negocio
      </h1>
      <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Personas que dicen ser dueñas de una ficha publicada. Aprobar un reclamo{" "}
        <strong>traspasa el negocio a su cuenta</strong> — verificá por fuera (Instagram,
        teléfono del local) antes de aprobar.
      </p>
      <div className="mt-6">
        <ReclamosTabla filas={filas} />
      </div>
    </div>
  );
}
