import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import FilaDeveloper, { type SolicitudDeveloper } from "./fila-developer";

/**
 * /admin/developers — la cola de admisión de la API de Lealtad.
 *
 * Va en su propia página y no dentro de /admin/complementos a propósito:
 * lo que se decide acá no es un plan ni un cobro, es a quién se le
 * permite existir como integrador. Mezclarlo con la cola de paquetes
 * haría que se apruebe con el mismo clic distraído.
 *
 * Lo que el admin ve, y por qué cada cosa: la identidad (razón social y
 * cédula), si el correo es de dominio propio, si probó control del
 * dominio, qué permisos pide con su justificación una por una, y —lo
 * más importante— para qué dice que la va a usar y qué guarda de su
 * lado. Sin esos dos textos no hay nada que contestarle a la PRODHAB.
 */

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Costa_Rica",
});

export default async function PaginaDevelopersAdmin() {
  const db = createAdminClient();
  if (!db) {
    return <Aviso texto="Falta configurar SUPABASE_SERVICE_ROLE_KEY." />;
  }

  const { data, error } = await db
    .from("desarrolladores")
    .select(
      "id, razon_social, cedula, correo_tecnico, correo_seguridad, sitio_web, sistema, " +
        "uso_declarado, datos_que_almacena, scopes_solicitados, justificacion, ips_permitidas, " +
        "dominio_verificado_en, acuerdo_version, acuerdo_hash, acuerdo_aceptado_en, estado, " +
        "motivo_rechazo, solicitante_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <Aviso texto="Falta correr la migración 0176 en Supabase (tabla `desarrolladores`)." />
    );
  }

  const filas = (data ?? []) as unknown as (Omit<SolicitudDeveloper, "creada"> & {
    created_at: string;
  })[];

  const solicitudes: SolicitudDeveloper[] = filas.map((f) => ({
    ...f,
    creada: FECHA.format(new Date(f.created_at)),
  }));

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente");
  const resto = solicitudes.filter((s) => s.estado !== "pendiente");

  // Cuántos negocios tiene conectados cada developer aprobado: es el
  // número que le da peso al botón de pánico.
  const { data: conexiones } = await db
    .from("autorizaciones_api")
    .select("desarrollador_id, estado");
  const activasPorDev = new Map<string, number>();
  for (const c of ((conexiones ?? []) as { desarrollador_id: string; estado: string }[]).filter(
    (c) => c.estado === "activa",
  )) {
    activasPorDev.set(c.desarrollador_id, (activasPorDev.get(c.desarrollador_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[26px] font-bold text-aventurea-ink">Developers de la API de Lealtad</h1>
        <p className="mt-1 max-w-[760px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          Acá se admite a alguien a <strong>existir</strong> como integrador.{" "}
          <strong>Aprobar no le abre ningún dato</strong>: después, cada negocio tiene que
          autorizarlo desde su propio panel de lealtad. Si Bookea aprobara sola y con eso se
          abrieran trescientas barberías, Bookea sería la parte que cede datos ajenos sin
          autorización del responsable.
        </p>
        <p className="mt-2 text-[12.5px] text-aventurea-ink-soft">
          Lo público está en{" "}
          <Link href="/lealtad/developers" className="font-bold underline">
            /lealtad/developers
          </Link>
          .
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Pendientes ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
            No hay solicitudes esperando.
          </p>
        ) : (
          <div className="space-y-4">
            {pendientes.map((s) => (
              <FilaDeveloper key={s.id} solicitud={s} conexionesActivas={0} />
            ))}
          </div>
        )}
      </section>

      {resto.length > 0 && (
        <section>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Ya atendidas ({resto.length})
          </h2>
          <div className="space-y-4">
            {resto.map((s) => (
              <FilaDeveloper
                key={s.id}
                solicitud={s}
                conexionesActivas={activasPorDev.get(s.id) ?? 0}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-[13.5px] font-bold text-amber-900">
      {texto}
    </p>
  );
}
