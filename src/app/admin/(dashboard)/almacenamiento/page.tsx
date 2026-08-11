import { createClient } from "@/lib/supabase/server";
import { consumoCloudflare } from "@/lib/media/analytics-cloudflare";
import {
  auditar,
  comparar,
  progresoAlbumes,
  type FilaAlbumLegacy,
  type FilaUso,
} from "@/lib/media/auditoria";
import { PRECIOS_AL, costoSupabase, precios, preciosAjustados } from "@/lib/media/precios";
import AlmacenamientoPanel, {
  type FilaArchivo,
  type FilaBucket,
  type FilaInvitacion,
  type FilaUsuario,
} from "./almacenamiento-panel";
import CostosPanel, { type DatosCostos } from "./costos-panel";

/**
 * Almacenamiento: quién está pesando, y cuánto cuesta.
 *
 * Los números de disco salen de funciones `security definer` (0080 y
 * 0115) que agregan `storage.objects` y `media_assets` sin exponer
 * ninguna de las dos: ahí viven también los comprobantes de pago. Cada
 * función exige rol admin por su cuenta.
 *
 * Lo que Cloudflare sirvió de verdad se le pregunta a su API de
 * analítica, que puede no responder. La pantalla NO depende de eso: si
 * falla, se muestra todo lo demás y se dice qué faltó.
 *
 * No se parte por sección (la cookie del header): el disco es uno solo
 * para toda la plataforma.
 */

/**
 * El egreso mensual de Supabase NO está en nuestra base.
 *
 * Supabase no lo expone por SQL: vive en su panel de facturación. Sin
 * ese número no se puede calcular el ahorro real, porque es justamente
 * el renglón que R2 pone en cero.
 *
 * Se lee de una variable para que se pueda copiar lo que diga la factura
 * y ver el ahorro de verdad. Si falta, la comparación se muestra igual
 * pero SOLO con almacenamiento, y la pantalla lo dice — nunca se inventa
 * un egreso para que el ahorro se vea bonito.
 */
function egresoSupabaseBytes(): number | null {
  const v = Number(process.env.SUPABASE_EGRESO_GB_MES);
  return Number.isFinite(v) && v >= 0 ? v * 1024 ** 3 : null;
}

export default async function AdminAlmacenamientoPage() {
  const supabase = await createClient();

  const [
    bucketsRes,
    usuariosRes,
    invitacionesRes,
    archivosRes,
    albumesRes,
    usoRes,
  ] = await Promise.all([
    supabase.rpc("almacenamiento_por_bucket"),
    supabase.rpc("almacenamiento_por_usuario"),
    supabase.rpc("almacenamiento_por_invitacion"),
    supabase.rpc("almacenamiento_archivos_top", { limite: 60 }),
    supabase.rpc("almacenamiento_por_album"),
    supabase.rpc("media_uso_detalle", { p_limite: 100 }),
  ]);

  // Si la 0080 no corrió, las cuatro primeras fallan igual: se avisa una vez.
  const faltaMigracion = Boolean(
    bucketsRes.error &&
      /almacenamiento_por_bucket|does not exist|schema cache/i.test(bucketsRes.error.message),
  );
  // La 0115 puede faltar aunque la 0080 esté: son dos migraciones.
  const faltaAuditoria = Boolean(
    albumesRes.error &&
      /almacenamiento_por_album|does not exist|schema cache/i.test(albumesRes.error.message),
  );

  const numero = (v: unknown) => Number(v ?? 0);
  const texto = (v: unknown) => (typeof v === "string" ? v : null);

  const buckets: FilaBucket[] = (bucketsRes.data ?? []).map((f: Record<string, unknown>) => ({
    bucket: String(f.bucket ?? "—"),
    archivos: numero(f.archivos),
    bytes: numero(f.bytes),
  }));
  const usuarios: FilaUsuario[] = (usuariosRes.data ?? []).map((f: Record<string, unknown>) => ({
    usuario_id: String(f.usuario_id ?? ""),
    email: texto(f.email),
    nombre: texto(f.nombre),
    archivos: numero(f.archivos),
    bytes: numero(f.bytes),
    bytes_sin_usar: numero(f.bytes_sin_usar),
  }));
  const invitaciones: FilaInvitacion[] = (invitacionesRes.data ?? []).map(
    (f: Record<string, unknown>) => ({
      invitacion_id: String(f.invitacion_id ?? ""),
      titulo: texto(f.titulo),
      slug: texto(f.slug),
      estado: texto(f.estado),
      cliente: texto(f.cliente),
      creada: texto(f.creada),
      archivos: numero(f.archivos),
      bytes: numero(f.bytes),
    }),
  );
  const archivos: FilaArchivo[] = (archivosRes.data ?? []).map((f: Record<string, unknown>) => ({
    bucket: String(f.bucket ?? "—"),
    ruta: String(f.ruta ?? ""),
    bytes: numero(f.bytes),
    tipo: texto(f.tipo),
    creado: texto(f.creado),
  }));

  const albumes: FilaAlbumLegacy[] = (albumesRes.data ?? []).map((f: Record<string, unknown>) => ({
    albumId: String(f.album_id ?? ""),
    titulo: texto(f.titulo) ?? "—",
    slug: texto(f.slug) ?? "",
    archivos: numero(f.archivos),
    bytes: numero(f.bytes),
    migradas: numero(f.migradas),
  }));

  const uso: FilaUso[] = (usoRes.data ?? []).map((f: Record<string, unknown>) => ({
    entityType: String(f.entity_type ?? "—"),
    entityId: String(f.entity_id ?? ""),
    nombre: texto(f.nombre) ?? "—",
    archivos: numero(f.archivos),
    bytes: numero(f.bytes),
    imagenesCf: numero(f.imagenes_cf),
    // `null` (no medido) tiene que sobrevivir: un cero acá haría pasar
    // por medición lo que es una estimación.
    visitas30d: f.visitas_30d === null || f.visitas_30d === undefined ? null : numero(f.visitas_30d),
  }));

  // ── La plata ──
  const p = precios();
  const analitica = await consumoCloudflare();
  const entregas = analitica.disponible ? analitica.consumo.imagenesEntregadas : null;

  const bytesLegacy = buckets.reduce((s, b) => s + b.bytes, 0);
  const imagenesEnCf = uso.reduce((s, f) => s + f.imagenesCf, 0);
  const egresoBytes = egresoSupabaseBytes();

  const comparacion = comparar(
    {
      // Se compara TODO lo que hoy vive en Supabase: es lo que se va a
      // mover. Si no se declaró el egreso, ese renglón va en cero y la
      // pantalla lo aclara en vez de inventarlo.
      bytes: bytesLegacy,
      bytesServidosSupabase: egresoBytes ?? 0,
      imagenes: imagenesEnCf,
      entregas: entregas ?? 0,
    },
    p,
  );

  const filas = auditar(uso, entregas, p);

  const albumesConCosto = albumes.map((a) => ({
    ...a,
    costoLegacyUSD: costoSupabase({ bytes: a.bytes, bytesServidos: 0 }, p).totalUSD,
  }));

  const datos: DatosCostos = {
    precios: p,
    ajustados: preciosAjustados(),
    preciosAl: PRECIOS_AL,
    analitica: analitica.disponible
      ? {
          disponible: true,
          entregas,
          desde: analitica.consumo.desde,
          hasta: analitica.consumo.hasta,
          parcial: analitica.parcial,
        }
      : { disponible: false, motivo: analitica.motivo },
    albumes: albumesConCosto,
    filas,
    comparacion,
    progreso: progresoAlbumes(albumes),
  };

  const errores = [bucketsRes.error, usuariosRes.error, invitacionesRes.error, archivosRes.error]
    .filter(Boolean)
    .map((e) => e!.message);

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Almacenamiento y costos</h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Quién está pesando y cuánto sale. Storage se cobra por giga guardado y por giga servido; lo
        segundo es lo que se va a cero al mover la multimedia a Cloudflare.
      </p>

      {faltaMigracion ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no corrió la migración <strong>0080_panel_almacenamiento.sql</strong> en Supabase:
          es la que crea las funciones que miden el disco. Corrésela y esta pantalla se llena sola.
        </p>
      ) : (
        <>
          {egresoBytes === null && (
            <p className="mb-5 rounded-xl bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
              El <strong>egreso mensual</strong> no se puede leer por SQL: vive en el panel de
              facturación de Supabase. Poné el número de tu factura en la variable{" "}
              <strong>SUPABASE_EGRESO_GB_MES</strong> y el ahorro real aparece acá. Mientras tanto la
              comparación solo cuenta el disco, que es la parte donde casi no hay diferencia.
            </p>
          )}

          {faltaAuditoria ? (
            <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Falta correr <strong>0115_auditoria_almacenamiento.sql</strong>: es la que agrega los
              álbumes y el uso de Cloudflare. El resto de la pantalla funciona igual.
            </p>
          ) : (
            <div className="mb-10">
              <CostosPanel datos={datos} />
            </div>
          )}

          <h2 className="mb-3 mt-2 text-lg font-bold text-aventurea-ink">Detalle por archivo</h2>
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
