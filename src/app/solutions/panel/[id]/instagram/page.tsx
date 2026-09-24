import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { negocioPorId } from "@/lib/solutions/datos";
import { urlDelNegocio } from "@/lib/solutions/tipos";
import { Card, Metrica } from "@/components/panel/piezas";
import { CUERPO_SUAVE, GRILLA_METRICAS } from "@/components/panel/sistema";
import { configMeta, faltantesMeta } from "@/lib/instagram/config";
import { cuentaDelNegocio, refrescarSiToca } from "@/lib/instagram/cuentas";
import { automatizacionesDelNegocio, eventosDelNegocio, resumenGlobal, resumenPorAutomatizacion } from "@/lib/instagram/datos";
import { estadoDelToken } from "@/lib/instagram/tokens";
import { codigoErrorDe, EXPLICACION_ERROR, type EventoIg } from "@/lib/instagram/tipos";
import SeccionCuenta from "./seccion-cuenta";
import MarcoLinksy from "../marco-linksy";
import { navDelPanel } from "../nav-datos";
import ListaAutomatizaciones, { type AutomatizacionConResumen } from "./lista-automatizaciones";

export const metadata: Metadata = { title: "Instagram · Bookea" };

/**
 * /solutions/panel/[id]/instagram — RESPUESTAS AUTOMÁTICAS.
 *
 * Misma puerta que el panel (`verificarAccesoSolutions`, solo quien
 * puede editar). Cuatro bloques: las cifras de la cuenta, la cuenta
 * conectada, las automatizaciones y la bitácora reciente. Todo lo que
 * se lee viene sin token.
 *
 * Al abrirse, si al token le toca refresco (Meta: ≥24 h y por vencer),
 * se refresca acá mismo: es la red de seguridad mientras el cron de
 * /api/instagram/refrescar-tokens no esté programado.
 */

const FECHA_HORA = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica" });

const AVISO_MOTIVO: Record<string, string> = {
  sin_configurar: "Instagram no está configurado en el servidor.",
  state: "La conexión no se pudo verificar. Volvé a intentar desde «Conectar Instagram».",
  cancelado: "Cancelaste la conexión en Instagram.",
  sin_codigo: "Instagram no devolvió el código de autorización.",
  sesion: "La conexión la tiene que terminar la misma persona que la empezó. Iniciá sesión y volvé a intentar.",
  acceso: "No tenés permiso para conectar Instagram a este negocio.",
  servidor: "Falta la llave de servicio en el servidor.",
  guardar: "No se pudo guardar la conexión.",
};

function RESULTADO(e: EventoIg): string {
  switch (e.resultado) {
    case "enviado":
      return e.publica_enviada ? "DM + pública" : "DM enviado";
    case "sin_coincidencia":
      return "Sin coincidencia";
    case "omitido":
      return "Omitido";
    case "limite":
      return "Límite";
    case "error":
      return "Error";
    default:
      return "Pendiente";
  }
}

export default async function InstagramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const busqueda = await searchParams;
  const acceso = await verificarAccesoSolutions(id);
  if (!acceso.user) redirect("/cuenta?volver=solutions");
  if (!acceso.ok) redirect("/solutions/panel");
  if (!acceso.puedeEditar) redirect(`/solutions/panel/${id}`);

  const admin = createAdminClient();
  if (!admin) notFound();
  const negocio = await negocioPorId(admin, id);
  if (!negocio) notFound();

  const cfg = configMeta();
  let cuenta = cfg ? await cuentaDelNegocio(admin, id) : null;
  if (cfg && cuenta?.activa) {
    const r = await refrescarSiToca(admin, cfg, cuenta.id);
    if (r === "refrescado") cuenta = await cuentaDelNegocio(admin, id);
  }
  const conectada = !!cuenta && cuenta.activa && cuenta.estado !== "desconectada";
  const estadoToken = cuenta ? estadoDelToken(cuenta.token_vence_en) : null;

  const [autos, eventos] = cuenta ? await Promise.all([automatizacionesDelNegocio(admin, id), eventosDelNegocio(admin, id, 500)]) : [[], []];
  const porAuto = resumenPorAutomatizacion(eventos);
  const global = resumenGlobal(eventos);
  const conResumen: AutomatizacionConResumen[] = autos.map((a) => ({
    ...a,
    resumen: porAuto.get(a.id) ?? { comentarios: 0, coincidencias: 0, dms: 0, publicas: 0, errores: 0, tasaExito: null, ultimaActividad: null },
  }));

  // El aviso de la vuelta del OAuth (?instagram=conectado|error&motivo=…).
  const estadoUrl = typeof busqueda.instagram === "string" ? busqueda.instagram : null;
  const motivoUrl = typeof busqueda.motivo === "string" ? busqueda.motivo : "";
  const detalleUrl = typeof busqueda.detalle === "string" ? busqueda.detalle.slice(0, 160) : "";
  const aviso =
    estadoUrl === "conectado"
      ? { tono: "exito" as const, texto: "Instagram conectado. Ya podés crear tu primera automatización." }
      : estadoUrl === "error"
        ? { tono: "alerta" as const, texto: AVISO_MOTIVO[motivoUrl] ?? EXPLICACION_ERROR[codigoErrorDe(motivoUrl) ?? "desconocido"] + (detalleUrl ? ` ${detalleUrl}` : "") }
        : null;

  const puedeCrear = conectada && estadoToken !== "vencido" && cuenta?.estado !== "reconectar";
  const motivoNoCrear = !cfg ? "Instagram no está configurado." : !conectada ? "Conectá tu Instagram para crear la primera." : "Instagram necesita reconectar esta cuenta.";

  const marco = await navDelPanel(admin, negocio, acceso);

  return (
    <MarcoLinksy
      negocio={marco.barra}
      items={marco.items}
      activo="instagram"
      titulo="Instagram Auto Reply"
      bajada={`Alguien comenta una publicación de ${negocio.nombre} con una palabra clave y recibe tu mensaje por DM. Con la API oficial de Instagram.`}
    >
      <div>

        {aviso && (
          <p className={`mt-4 rounded-xl border px-4 py-3 text-[13px] font-bold ${aviso.tono === "exito" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
            {aviso.texto}
          </p>
        )}

        <div className={`mt-5 ${GRILLA_METRICAS}`}>
          <Metrica rotulo="Comentarios" valor={String(global.comentarios)} detalle="recibidos por el webhook" />
          <Metrica rotulo="DMs enviados" valor={String(global.dms)} detalle="respuestas privadas" />
          <Metrica rotulo="Tasa de respuesta" valor={global.tasaExito === null ? "—" : `${global.tasaExito} %`} detalle="DMs sobre coincidencias" />
          <Metrica rotulo="Errores" valor={String(global.errores)} detalle="incluye límites" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="flex flex-col gap-4">
            <SeccionCuenta negocioId={id} cuenta={cuenta} estadoToken={estadoToken} configurado={!!cfg} faltantes={faltantesMeta()} />
            <Card eyebrow="Cómo funciona" titulo="Lo que hay que saber">
              <ul className={`flex flex-col gap-1.5 ${CUERPO_SUAVE}`}>
                <li>· Solo responde comentarios en publicaciones tuyas, hechos después de crear la automatización.</li>
                <li>· Instagram permite <strong>un solo</strong> mensaje privado por comentario, y dentro de los 7 días.</li>
                <li>· El DM es texto con tu enlace; Instagram no admite botones en estas respuestas.</li>
                <li>· Si el mismo aviso llega dos veces, se responde una sola vez.</li>
              </ul>
            </Card>
          </div>
          <div className="flex flex-col gap-4">
            <ListaAutomatizaciones negocioId={id} automatizaciones={conResumen} puedeCrear={puedeCrear} motivoNoCrear={motivoNoCrear} urlPagina={urlDelNegocio(negocio)} />

            <Card eyebrow="Bitácora" titulo="Últimos comentarios">
              {eventos.length === 0 ? (
                <p className={CUERPO_SUAVE}>Todavía no llegó ningún comentario. Cuando alguien comente una publicación con automatización, aparece acá.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead className="text-left text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">
                      <tr>
                        <th className="py-1.5 pr-3">Cuándo</th>
                        <th className="py-1.5 pr-3">Quién</th>
                        <th className="py-1.5 pr-3">Comentario</th>
                        <th className="py-1.5 pr-3">Palabra</th>
                        <th className="py-1.5">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aventurea-line">
                      {eventos.slice(0, 40).map((e) => (
                        <tr key={e.id}>
                          <td className="py-1.5 pr-3 whitespace-nowrap text-aventurea-ink-soft">{FECHA_HORA.format(new Date(e.creado_en))}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap font-bold text-aventurea-navy">{e.ig_usuario_username ? `@${e.ig_usuario_username}` : "—"}</td>
                          <td className="max-w-[260px] truncate py-1.5 pr-3 text-aventurea-ink">{e.texto_comentario ?? ""}</td>
                          <td className="py-1.5 pr-3 text-aventurea-ink-soft">{e.palabra_coincidente ?? ""}</td>
                          <td className="py-1.5">
                            <span className={e.resultado === "enviado" ? "font-bold text-green-700" : e.resultado === "error" || e.resultado === "limite" ? "font-bold text-red-700" : "text-aventurea-ink-soft"}>
                              {RESULTADO(e)}
                            </span>
                            {e.error_codigo && <span className={`block ${CUERPO_SUAVE}`}>{EXPLICACION_ERROR[e.error_codigo]}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </MarcoLinksy>
  );
}
