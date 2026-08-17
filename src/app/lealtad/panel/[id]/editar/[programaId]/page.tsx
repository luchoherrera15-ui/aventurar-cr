import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { hiloAbiertoDeAyuda } from "@/lib/lealtad/ayuda-hilo";
import { estadoDelPrograma } from "@/lib/lealtad/reglas";
import { reglaDeFila } from "@/lib/lealtad/vencimiento-sellos";
import { configPorDefecto, leerBeneficio, tipoDe, TIPOS_TARJETA } from "@/lib/lealtad/tipos-tarjeta";
import { ProveedorPrograma } from "../../programa-contexto";
import { PildoraEstado } from "@/components/panel/piezas";
import {
  BAJADA_PANTALLA,
  EYEBROW_NEUTRO,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
import EditorTarjeta from "../../editor-tarjeta";
import type { Reglas } from "../../paso-reglas";
import type { ProgramaFila, RecompensaFila } from "../../pases-actions";

/**
 * EDITAR **ESTA** TARJETA.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL ID VA EN LA URL
 * ------------------------------------------------------------------
 * Desde la 0134 un negocio puede tener varias tarjetas. Las secciones
 * del panel («Recompensas», «Tarjeta digital») editan la que
 * `elegirPrograma` decide que es la principal, así que con dos
 * tarjetas, tocar la B terminaba editando la A — los enlaces de la
 * lista apuntaban todos a la misma ancla.
 *
 * Acá el id viaja en la ruta y se comprueba contra el rancho: una
 * tarjeta de otro negocio no se abre por escribir su UUID.
 *
 * ------------------------------------------------------------------
 * PANTALLA PROPIA, COMO EL CREADOR
 * ------------------------------------------------------------------
 * Mismo criterio que `/crear`: corregir una tarjeta es una tarea con
 * principio y fin, necesita el ancho para el formulario más la vista
 * previa, y no es un lugar donde uno se queda.
 */

export const metadata = { title: "Editar tarjeta · Lealtad Bookea" };

/** `time` de Postgres llega «14:00:00»; el input de hora quiere «14:00». */
function hhmm(valor: unknown): string {
  return typeof valor === "string" ? valor.slice(0, 5) : "";
}

function fecha(valor: unknown): string {
  return typeof valor === "string" ? valor.slice(0, 10) : "";
}

function entero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

export default async function EditarTarjetaPage({
  params,
}: {
  params: Promise<{ id: string; programaId: string }>;
}) {
  const { id, programaId } = await params;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  // Editar la tarjeta es del DUEÑO: define la identidad y la plata del
  // programa. El colaborador de mostrador opera, no diseña.
  if (!acceso.ok || !(acceso.esDueno || acceso.esAdmin)) redirect(`/lealtad/panel/${id}`);

  const { data: rancho } = await acceso.supabase
    .from("ranchos")
    .select("nombre, plan_lealtad")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) redirect("/lealtad/panel");

  // Con la llave de servicio: la RLS de la 0060 no le muestra al dueño
  // un programa pausado, y justamente uno pausado es de los que más
  // falta hace poder corregir. `select *` porque las columnas de la
  // 0135/0136 pueden no existir y una lista explícita fallaría entera.
  const admin = createAdminClient();
  const { data: fila } = admin
    ? await admin
        .from("programa_lealtad")
        .select("*")
        .eq("id", programaId)
        .eq("rancho_id", id)
        .maybeSingle()
    : { data: null };
  // Una tarjeta que no es de este negocio no existe para esta pantalla.
  if (!fila) redirect(`/lealtad/panel/${id}#programas`);

  const cruda = fila as Record<string, unknown>;
  const programa = fila as ProgramaFila;

  const { data: recompensas } = admin
    ? await admin
        .from("recompensas")
        .select("*")
        .eq("programa_id", programaId)
        .order("costo_puntos", { ascending: true })
    : { data: [] };
  const lista = (recompensas ?? []) as RecompensaFila[];

  // Cuántos clientes tiene ADENTRO: de este número cuelga el candado
  // del tipo, y lo cuenta el servidor.
  const { count } = admin
    ? await admin
        .from("miembros")
        .select("*", { count: "exact", head: true })
        .eq("programa_id", programaId)
    : { count: 0 };
  const miembros = count ?? 0;

  const { data: cercania } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: id,
    p_addon: "pases_cercania",
  });

  // El paquete decide qué tipos se pueden elegir (0142). Se resuelve
  // igual que en `crear-actions.ts` y en `guardarBeneficio` —cuenta
  // primero, rancho de respaldo— para que la pantalla ofrezca
  // exactamente lo que el servidor va a aceptar.
  const { data: cuenta } = admin
    ? await admin.from("cuentas").select("id").eq("rancho_id", id).maybeSingle()
    : { data: null };
  const { plan } = admin
    ? await contextoDeCuenta(admin, cuenta?.id ? { cuenta_id: cuenta.id as string } : {}, {
        planRancho: (rancho.plan_lealtad as string | null) ?? null,
      })
    : { plan: (rancho.plan_lealtad as string | null) ?? null };

  // EL HILO DE AYUDA (0149), si ya hay uno abierto: el bloque del
  // editor abre mostrando la conversación en vez de un formulario en
  // blanco que haría creer que el pedido nunca se mandó.
  const ayuda = admin ? await hiloAbiertoDeAyuda(admin, id) : null;

  const tipo = tipoDe(programa.modo);
  const estado = estadoDelPrograma({ estado: programa.estado ?? null, activo: programa.activo });

  // El beneficio guardado, o el de fábrica si la 0135 no corrió o el
  // programa es anterior: el editor abre con algo que se puede leer y
  // corregir, no en blanco.
  const guardado = leerBeneficio(cruda.beneficio, tipo) ?? configPorDefecto(tipo);

  const activa = lista.find((r) => r.activo) ?? null;

  // EN SELLOS MANDA LA RECOMPENSA, no el jsonb. El pase real saca la
  // meta de la recompensa activa más barata (`metaDeSellos`), así que
  // si las dos difieren —pasa con las tarjetas de antes de este editor,
  // y con cualquiera cuya regalía se haya tocado desde «Recompensas»—
  // el formulario tiene que abrir con lo que el cliente ve en el
  // teléfono. Si no, el editor avisaría «vas a mover la meta» sin que
  // nadie haya escrito nada, y guardar sin tocar nada la movería.
  const beneficio =
    guardado.tipo === "sellos" && activa
      ? { ...guardado, requeridos: activa.costo_puntos, recompensa: activa.nombre }
      : guardado;

  // El vencimiento de sellos (0180) se lee de la fila CRUDA y con la
  // misma función que usa el motor: si la migración no está pegada, o
  // si la tarjeta no es de sellos, sale «sin regla» y el control abre
  // apagado en vez de romper la pantalla.
  const reglaSellos = reglaDeFila(cruda);

  const reglas: Reglas = {
    desde: fecha(cruda.vigente_desde),
    hasta: fecha(cruda.vigente_hasta),
    usoUnico: cruda.uso_unico === true,
    maxPorCliente: entero(cruda.max_por_cliente),
    maxGlobal: entero(cruda.max_global),
    dias: Array.isArray(cruda.dias_permitidos)
      ? (cruda.dias_permitidos as unknown[]).filter(
          (d): d is number => typeof d === "number" && d >= 0 && d <= 6,
        )
      : [],
    horaDesde: hhmm(cruda.hora_desde),
    horaHasta: hhmm(cruda.hora_hasta),
  };

  // La meta que la tarjeta promete HOY: contra esto compara el aviso de
  // «vas a mover la meta».
  const metaActual =
    tipo === "sellos"
      ? (activa?.costo_puntos ?? null)
      : beneficio.tipo === "puntos"
        ? beneficio.minimoCanje
        : beneficio.tipo === "giftcard"
          ? beneficio.valor
          : null;

  return (
    <main className="min-h-svh" style={{ background: "var(--grey)" }}>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/lealtad/panel/${id}#programas`}
          className="text-[12.5px] font-bold text-bookea-gris hover:text-bookea-azul"
        >
          ← Mis tarjetas
        </Link>

        {/* El titular, con la ficha de la tarjeta como kicker y el
            ESTADO como píldora del sistema, a la derecha — el mismo
            lugar y el mismo color con el que la lista de Tarjetas
            pinta esa misma tarjeta. */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className={EYEBROW_NEUTRO}>
              {TIPOS_TARJETA[tipo].nombre} ·{" "}
              {miembros === 0
                ? "todavía sin clientes"
                : `${miembros} ${miembros === 1 ? "cliente" : "clientes"} adentro`}
            </p>
            <h1 className={`mt-1.5 ${TITULO_PANTALLA}`}>{programa.nombre}</h1>
            <p className={`mt-1.5 max-w-[620px] ${BAJADA_PANTALLA}`}>
              Todo lo de acá llega al pase que ya tienen en el teléfono.
            </p>
          </div>
          <PildoraEstado estado={estado === "activo" ? "info" : "neutro"}>
            {ESTADO_EN_PALABRAS[estado]}
          </PildoraEstado>
        </div>

        <div className="mt-7">
          <ProveedorPrograma
            ranchoId={id}
            programaInicial={programa}
            recompensasIniciales={lista}
            tieneCercania={cercania === true}
          >
            <EditorTarjeta
              ranchoId={id}
              programaId={programaId}
              negocioNombre={rancho.nombre as string}
              plan={plan}
              situacion={{ miembros, estado, tipo }}
              nombreInicial={programa.nombre}
              beneficioInicial={beneficio}
              reglasIniciales={reglas}
              vencimientoInicial={reglaSellos.meses}
              metaActual={metaActual}
              ayudaInicial={ayuda}
            />
          </ProveedorPrograma>
        </div>
      </div>
    </main>
  );
}

const ESTADO_EN_PALABRAS: Record<string, string> = {
  borrador: "en borrador",
  activo: "activa",
  pausado: "en pausa",
  archivado: "archivada",
};
