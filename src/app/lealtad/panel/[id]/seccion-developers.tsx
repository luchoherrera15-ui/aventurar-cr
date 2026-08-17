import { createAdminClient } from "@/lib/supabase/admin";
import DevelopersLealtad, {
  type ActividadApi,
  type ConexionApi,
  type DeveloperAdmitido,
  type TarjetaElegible,
} from "./developers-panel";

/**
 * LA SECCIÓN «DEVELOPERS» DEL PANEL DEL DUEÑO.
 *
 * Componente de servidor con la llave de servicio porque
 * `llaves_api_lealtad` NO le da lectura a nadie que no sea el servidor
 * —ni al dueño— y la bitácora expone su `ip_hmac` solo por acá. El
 * dueño ve a TRAVÉS de esta pantalla, no consultando las tablas: es el
 * mismo criterio que ya usa `lealtad-secciones.tsx` con el ledger y
 * los pases.
 *
 * Se pinta SOLO para `puedeDisenar` (dueño o Bookea). Un colaborador
 * con permiso de auditoría no entra acá: mirar el libro mayor y poder
 * abrirle la puerta a un tercero no son el mismo permiso.
 */

const FECHA = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Costa_Rica",
});

const FECHA_HORA = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Costa_Rica",
});

type FilaAutorizacion = {
  id: string;
  desarrollador_id: string;
  programa_id: string;
  scopes: string[] | null;
  estado: string;
  mostrar_iniciales: boolean;
  autorizada_en: string;
};

type FilaLlave = {
  id: string;
  autorizacion_id: string;
  kid: string;
  sufijo_visible: string;
  estado: string;
  etiqueta: string | null;
  expira_en: string;
  ultima_usada_en: string | null;
};

export default async function SeccionDevelopers({
  ranchoId,
  tarjetas,
}: {
  ranchoId: string;
  tarjetas: { id: string; nombre: string; topeDiario: number | null }[];
}) {
  const db = createAdminClient();
  if (!db) {
    return (
      <DevelopersLealtad
        ranchoId={ranchoId}
        tarjetas={[]}
        admitidos={[]}
        conexiones={[]}
        actividad={[]}
        falta="Falta configurar la llave de servicio en el servidor."
      />
    );
  }

  const { data: autorizaciones, error: errorAut } = await db
    .from("autorizaciones_api")
    .select("id, desarrollador_id, programa_id, scopes, estado, mostrar_iniciales, autorizada_en")
    .eq("rancho_id", ranchoId)
    .order("autorizada_en", { ascending: false })
    .limit(50);

  // Sin las migraciones corridas la sección no se cae: lo dice.
  if (errorAut) {
    return (
      <DevelopersLealtad
        ranchoId={ranchoId}
        tarjetas={[]}
        admitidos={[]}
        conexiones={[]}
        actividad={[]}
        falta="Faltan correr las migraciones 0175-0177 en Supabase para poder usar la API."
      />
    );
  }

  const filas = (autorizaciones ?? []) as unknown as FilaAutorizacion[];
  const idsDevs = [...new Set(filas.map((a) => a.desarrollador_id))];

  const [{ data: admitidos }, { data: nombresDevs }, { data: llaves }, { data: bitacora }] =
    await Promise.all([
      db
        .from("desarrolladores_admitidos")
        .select("id, razon_social, sistema, sitio_web, dominio_verificado")
        .order("razon_social")
        .limit(100),
      idsDevs.length
        ? db.from("desarrolladores").select("id, razon_social, sistema").in("id", idsDevs)
        : Promise.resolve({ data: [] }),
      filas.length
        ? db
            .from("llaves_api_lealtad")
            .select("id, autorizacion_id, kid, sufijo_visible, estado, etiqueta, expira_en, ultima_usada_en")
            .in(
              "autorizacion_id",
              filas.map((a) => a.id),
            )
        : Promise.resolve({ data: [] }),
      db
        .from("bitacora_api_lealtad")
        .select("id, kid, metodo, ruta_patron, estado_http, codigo_error, puntos_delta, created_at")
        .eq("rancho_id", ranchoId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const porDev = new Map(
    ((nombresDevs ?? []) as { id: string; razon_social: string; sistema: string }[]).map((d) => [
      d.id,
      d,
    ]),
  );
  const porTarjeta = new Map(tarjetas.map((t) => [t.id, t.nombre]));

  const llavesPorAut = new Map<string, FilaLlave[]>();
  for (const l of (llaves ?? []) as unknown as FilaLlave[]) {
    const lista = llavesPorAut.get(l.autorizacion_id) ?? [];
    lista.push(l);
    llavesPorAut.set(l.autorizacion_id, lista);
  }

  const conexiones: ConexionApi[] = filas.map((a) => ({
    id: a.id,
    desarrollador: porDev.get(a.desarrollador_id)?.razon_social ?? "Aplicación",
    tarjeta: porTarjeta.get(a.programa_id) ?? "Una tarjeta",
    scopes: a.scopes ?? [],
    estado: a.estado,
    mostrarIniciales: a.mostrar_iniciales,
    autorizadaEn: FECHA.format(new Date(a.autorizada_en)),
    llaves: (llavesPorAut.get(a.id) ?? []).map((l) => ({
      id: l.id,
      kid: l.kid,
      sufijo: l.sufijo_visible,
      estado: l.estado,
      etiqueta: l.etiqueta,
      expiraEn: FECHA.format(new Date(l.expira_en)),
      ultimaUsada: l.ultima_usada_en ? FECHA_HORA.format(new Date(l.ultima_usada_en)) : null,
    })),
  }));

  const actividad: ActividadApi[] = (
    (bitacora ?? []) as {
      id: string;
      kid: string | null;
      metodo: string;
      ruta_patron: string;
      estado_http: number;
      codigo_error: string | null;
      puntos_delta: number | null;
      created_at: string;
    }[]
  ).map((b) => ({
    id: b.id,
    kid: b.kid ?? "—",
    llamada: `${b.metodo} ${b.ruta_patron}`,
    estado: b.estado_http,
    error: b.codigo_error,
    puntos: b.puntos_delta,
    cuando: FECHA_HORA.format(new Date(b.created_at)),
  }));

  const elegibles: TarjetaElegible[] = tarjetas.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    // La precondición dura, visible ANTES de intentar: sin tope diario
    // no se puede autorizar `acreditar`, y el RPC lo va a rechazar.
    tieneTopeDiario: t.topeDiario !== null,
  }));

  return (
    <DevelopersLealtad
      ranchoId={ranchoId}
      tarjetas={elegibles}
      admitidos={
        ((admitidos ?? []) as {
          id: string;
          razon_social: string;
          sistema: string;
          sitio_web: string | null;
          dominio_verificado: boolean;
        }[]).map<DeveloperAdmitido>((d) => ({
          id: d.id,
          nombre: d.razon_social,
          sistema: d.sistema,
          sitio: d.sitio_web,
          dominioVerificado: d.dominio_verificado,
        }))
      }
      conexiones={conexiones}
      actividad={actividad}
      falta={null}
    />
  );
}
