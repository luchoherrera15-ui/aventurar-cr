import { estadoDelLimite } from "@/lib/lealtad/planes";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { pideMontoElTipo } from "@/lib/lealtad/mostrador";
import { CardVacia } from "@/components/panel/piezas";
import {
  ESTADO_AVISO,
  GAP_METRICAS,
  GAP_TABLERO,
  RADIO_TILE,
} from "@/components/panel/sistema";
import { cargarLealtad } from "./datos-lealtad";
import Kpi from "./kpi";
import { ListaClientes, type ClienteEnLista } from "./atencion-manual";

/**
 * El estado del programa: cuánta gente hay, quién está por ganarse algo
 * y quién se está enfriando.
 *
 * Todo se deriva del ledger — acá no se lee ningún contador guardado.
 * Las consultas viven en `cargarLealtad` (datos-lealtad.ts) y no acá:
 * el tablero de Inicio muestra los mismos números, y con la consulta
 * adentro de este componente el mismo render traía dos veces los
 * miembros, el ledger y los pases del negocio.
 *
 * ------------------------------------------------------------------
 * LA LISTA DEJÓ DE SER UN CUADRO Y PASÓ A SER UN MOSTRADOR
 * ------------------------------------------------------------------
 * Era de SOLO LECTURA: se veía quién podía canjear y no había forma de
 * canjearle. Junto con un modo mostrador que solo escaneaba, eso
 * significaba que el cliente sin teléfono no se podía atender de
 * NINGUNA manera.
 *
 * Ahora cada renglón trae sus botones (<ListaClientes>). El negocio, el
 * permiso y la recompensa se DERIVAN acá del `programaId` en vez de
 * pedírselos a quien monta el componente: así la sección Clientes queda
 * completa sin que ninguna otra pantalla tenga que cambiar, y el
 * permiso lo resuelve el servidor —nunca el navegador— igual que en el
 * resto del módulo.
 */
export default async function LealtadEstado({

  programaId,
  plan,
  meta,
}: {

  programaId: string | null;
  plan: string | null;
  /** Costo de la recompensa activa más barata. null = sin meta. */
  meta: number | null;
}) {
  if (!programaId) {
    return (
      <CardVacia>
        Todavía no hay programa. Cuando el equipo de Bookea lo active, acá vas a ver
        quién se afilia, cuántos sellos lleva cada quien y a quién le toca su regalía.
      </CardVacia>
    );
  }

  const datos = await cargarLealtad(programaId, meta);
  if (!datos) return null;

  const { fichas, resumen } = datos;
  const limite = estadoDelLimite(plan, "clientesActivos", resumen.miembros);

  // ── De qué negocio es esta tarjeta, y quién está mirando ────────
  // La llave de servicio: un colaborador no puede leer por RLS un
  // programa pausado, y esta sección la ve también él.
  const db = createAdminClient();
  const { data: programa } = db
    ? await db
        .from("programa_lealtad")
        .select("rancho_id, modo")
        .eq("id", programaId)
        .maybeSingle()
    : { data: null };

  const ranchoId = (programa?.rancho_id as string | undefined) ?? null;
  const tipo = tipoDe((programa?.modo as string | null) ?? null);

  const acceso = ranchoId ? await verificarAccesoLealtad(ranchoId) : null;
  const permisos = {
    acreditar: !!acceso?.ok && acceso.permisos.acreditar,
    canjear: !!acceso?.ok && acceso.permisos.canjear,
    revertir: !!acceso?.ok && acceso.permisos.revertir,
  };

  // La recompensa que se entrega desde acá es la MISMA que ofrece el
  // escáner: la activa más barata (0121). Un segundo criterio haría que
  // el mostrador y esta lista entregaran cosas distintas.
  const { data: premios } = db
    ? await db
        .from("recompensas")
        .select("id, nombre, costo_puntos")
        .eq("programa_id", programaId)
        .eq("activo", true)
        .order("costo_puntos", { ascending: true })
        .limit(1)
    : { data: [] };
  const premio = ((premios ?? []) as { id: string; nombre: string; costo_puntos: number }[])[0];
  const recompensa = premio
    ? { id: premio.id, nombre: premio.nombre, costo: premio.costo_puntos }
    : null;

  // El monto solo se pide donde CAMBIA lo que se otorga. En una tarjeta
  // de sellos o en un cupón es una pregunta sin consecuencia que el
  // empleado tiene que ignorar con un cliente enfrente.
  const pideMonto = pideMontoElTipo(tipo);

  // Al navegador va lo justo: `FichaMiembro` trae `clienteId`, que es
  // el id de auth de la persona y no hace falta para dar un sello.
  //
  // EL CORREO Y EL TELÉFONO SÍ VIAJAN, y acá corresponde: esta pantalla
  // es el negocio mirando a SUS clientes —los que le dieron esos datos a
  // él, con su consentimiento guardado (0138)— detrás de
  // `verificarAccesoLealtad`. No salen de esta pantalla.
  const clientes: ClienteEnLista[] = fichas.slice(0, 50).map((f) => ({
    miembroId: f.miembroId,
    nombre: f.nombre,
    sinNombre: f.sinNombre,
    contacto: f.contacto,
    saldo: f.saldo,
    estado: f.estado,
    conPase: f.conPase,
    diasSinVenir: f.diasSinVenir,
  }));

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      <div className={`grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`}>
        <Kpi
          titulo="Miembros"
          valor={String(resumen.miembros)}
          icono="clientes"
          detalle={
            limite.limite
              ? `de ${limite.limite.toLocaleString("es-CR")} del plan`
              : "sin tope"
          }
          /* El tope se dice con palabras además del color: la tarjeta
             roja y la ámbar se ven igual para quien no distingue esos
             dos, y este es el estado que frena las afiliaciones. */
          aviso={
            limite.lleno
              ? { estado: "alerta", texto: "Tope lleno" }
              : limite.cerca
                ? { estado: "aviso", texto: "Casi lleno" }
                : null
          }
        />
        <Kpi
          titulo="Con tarjeta"
          valor={String(resumen.conPase)}
          icono="movil"
          detalle="la llevan en el teléfono"
        />
        <Kpi
          titulo="Sellos (30 días)"
          valor={String(resumen.sellosRecientes)}
          icono="sumar"
          detalle={`${resumen.canjes} canje${resumen.canjes === 1 ? "" : "s"} en total`}
        />
        <Kpi
          titulo="Les toca su regalía"
          valor={String(resumen.listosParaCanjear)}
          icono="regalo"
          detalle={
            resumen.enRiesgo > 0
              ? `${resumen.enRiesgo} sin venir hace 2 meses`
              : "nadie se está enfriando"
          }
          aviso={
            resumen.listosParaCanjear > 0
              ? { estado: "aviso", texto: "Por entregar" }
              : null
          }
        />
      </div>

      {limite.lleno && (
        <p className={`${RADIO_TILE} px-4 py-3 text-[12.5px] font-bold ${ESTADO_AVISO.alerta}`}>
          El plan llegó a su tope: un cliente nuevo ya no se puede afiliar. Hay que subir
          de plan para seguir sumando gente.
        </p>
      )}

      {fichas.length === 0 ? (
        <CardVacia>
          Nadie se ha afiliado todavía. El cliente se afilia solo al agregar su tarjeta al
          Wallet desde tu página.
        </CardVacia>
      ) : !ranchoId ? (
        // Sin negocio resuelto no se puede autorizar nada, así que no se
        // ofrece: un botón que siempre va a fallar es peor que no tenerlo.
        <CardVacia>No se pudo leer el negocio de esta tarjeta. Recargá la página.</CardVacia>
      ) : (
        <ListaClientes
          ranchoId={ranchoId}
          clientes={clientes}
          total={fichas.length}
          tipo={tipo}
          meta={meta}
          recompensa={recompensa}
          permisos={permisos}
          pideMonto={pideMonto}
        />
      )}
    </div>
  );
}
