"use client";

import { useRef, useState } from "react";
import {
  leerMontoColones,
  llaveDeIntento,
  textosDelTipo,
  type TextosDelTipo,
} from "@/lib/lealtad/mostrador";
import type { TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import {
  acreditarOperacion,
  buscarClientesDelPrograma,
  cambiarEstadoMiembro,
  canjearRecompensa,
  type MiembroAtendible,
} from "./lealtad-operar-actions";

/**
 * ATENDER A MANO — el cliente que llega sin teléfono.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * El modo mostrador era el escáner y NADA MÁS, y la lista de Clientes
 * era de solo lectura. O sea que el cliente que llegaba con el teléfono
 * descargado, o sin smartphone, o con la tarjeta todavía sin agregar al
 * Wallet, sencillamente NO SE PODÍA ATENDER: se le decía «volvé con la
 * tarjeta» y el negocio perdía la visita que el programa existe para
 * premiar.
 *
 * Del otro lado, `acreditarOperacion` y `cambiarEstadoMiembro` estaban
 * escritas enteras —con su comprobación de permiso, su filtro de
 * tenencia y su llave de idempotencia— y tenían CERO llamadores. Este
 * archivo es la puerta que les faltaba.
 *
 * ------------------------------------------------------------------
 * DOS PUERTAS, UNA SOLA FILA
 * ------------------------------------------------------------------
 *   <BuscarYAtender>  va en el modo mostrador: se busca por nombre y se
 *                     suma. Quien está de pie no navega listas.
 *   <ListaClientes>   va en la sección Clientes: la misma lista de
 *                     siempre, ahora con los botones al lado.
 *
 * Las dos pintan la MISMA <FilaCliente>, así que el sello se da igual
 * desde los dos lados y no hay dos comportamientos que mantener.
 *
 * NADA DE ESTO DECIDE: cada botón llama a la server action, que vuelve
 * a comprobar el permiso, la tenencia del miembro y las reglas. Esconder
 * un botón es cortesía; la autorización pasa del otro lado.
 */

export type ClienteEnLista = {
  miembroId: string;
  nombre: string;
  saldo: number;
  estado: string;
  conPase: boolean;
  /** Solo en la sección Clientes; el buscador del mostrador no lo trae. */
  diasSinVenir?: number | null;
  // «Cuántos le faltan» NO viaja, a propósito: el saldo cambia con cada
  // sello que se da desde acá, y un número calculado en el servidor
  // quedaría viejo al primer toque. Se deriva de `saldo` y `meta`, que
  // sí se actualizan.
};

export type PermisosMostrador = {
  acreditar: boolean;
  canjear: boolean;
  revertir: boolean;
};

export type RecompensaDelPrograma = { id: string; nombre: string; costo: number } | null;

/** Lo que le pasó a un cliente en el último toque, para pintarlo. */
type Novedad = {
  saldo: number | null;
  estado: string | null;
  texto: string;
  /**
   * TRES tonos, no dos. «aviso» es el caso que la base resolvió sin
   * escribir nada (una operación repetida): no es un error —no hay nada
   * que arreglar— pero decirle «listo» es mentir sobre el saldo.
   */
  tono: "bien" | "aviso" | "mal";
};

// ── La fila: el cliente y lo que se le puede hacer ─────────────────

function FilaCliente({
  ranchoId,
  cliente,
  meta,
  textos,
  recompensa,
  permisos,
  pideMonto,
  novedad,
  onNovedad,
}: {
  ranchoId: string;
  cliente: ClienteEnLista;
  meta: number | null;
  textos: TextosDelTipo;
  recompensa: RecompensaDelPrograma;
  permisos: PermisosMostrador;
  pideMonto: boolean;
  novedad: Novedad | undefined;
  onNovedad: (miembroId: string, n: Novedad) => void;
}) {
  const [ocupado, setOcupado] = useState<null | "sello" | "canje" | "estado">(null);
  const [monto, setMonto] = useState("");
  const [avisoMonto, setAvisoMonto] = useState<string | null>(null);

  /**
   * La llave de ESTE intento de acreditar. Misma regla que el escáner:
   * se conserva mientras no se sepa el resultado (para que un reintento
   * por señal mala no dé dos sellos) y se tira apenas el servidor
   * contesta (para que la segunda venta del día sí sume).
   *
   * Sin esto, la llave la armaba el servidor con el MINUTO DE
   * CALENDARIO adentro, y dos ventas seguidas al mismo cliente dentro
   * del mismo minuto se colapsaban en una sola.
   */
  const intento = useRef<string | null>(null);

  const saldo = novedad?.saldo ?? cliente.saldo;
  const estado = novedad?.estado ?? cliente.estado;
  const activa = estado === "activa";
  const puedeCanjear = recompensa !== null && saldo >= recompensa.costo;

  function sumarSello() {
    const lectura = leerMontoColones(pideMonto ? monto : "");
    if (!lectura.ok) {
      setAvisoMonto(lectura.motivo);
      return;
    }
    setAvisoMonto(null);
    setOcupado("sello");
    if (!intento.current) intento.current = llaveDeIntento();
    acreditarOperacion(ranchoId, cliente.miembroId, lectura.monto, `mostrador:${intento.current}`)
      .then((res) => {
        // Contestó: el intento se cierra pase lo que pase. Ver el ref.
        intento.current = null;
        if (!res.ok) {
          onNovedad(cliente.miembroId, { saldo: null, estado: null, texto: res.motivo, tono: "mal" });
          return;
        }
        if (!res.yaEstaba) setMonto("");
        onNovedad(cliente.miembroId, {
          saldo: res.saldo,
          estado: null,
          // `yaEstaba` NO es éxito: no se sumó nada. Se pinta como aviso
          // y dice el saldo real — decirle «listo» a algo que no entró
          // es lo que hizo que el dueño reportara que el sistema no
          // entrega los sellos.
          texto: res.yaEstaba
            ? `No se sumó de nuevo: esa misma operación ya había entrado. Sigue en ${res.saldo} ${textos.unidad}.`
            : `Listo: +${res.puntos} ${textos.unidad} para ${cliente.nombre}.`,
          tono: res.yaEstaba ? "aviso" : "bien",
        });
      })
      // El intento se CONSERVA: no se sabe si el servidor escribió, y
      // reintentar con la misma llave es lo que evita el sello doble.
      .catch(() =>
        onNovedad(cliente.miembroId, {
          saldo: null,
          estado: null,
          texto: "No se pudo. Probá de nuevo.",
          tono: "mal",
        }),
      )
      .finally(() => setOcupado(null));
  }

  function entregar() {
    if (!recompensa) return;
    setOcupado("canje");
    canjearRecompensa(ranchoId, cliente.miembroId, recompensa.id)
      .then((res) => {
        onNovedad(cliente.miembroId, {
          saldo: res.ok ? res.saldo : null,
          estado: null,
          texto: res.ok
            ? `Entregado: ${res.recompensa}.${res.instrucciones ? ` ${res.instrucciones}` : ""}`
            : res.motivo,
          tono: res.ok ? "bien" : "mal",
        });
      })
      .catch(() =>
        onNovedad(cliente.miembroId, {
          saldo: null,
          estado: null,
          texto: "No se pudo entregar. Probá de nuevo.",
          tono: "mal",
        }),
      )
      .finally(() => setOcupado(null));
  }

  function cambiarEstado() {
    const destino = activa ? "pausada" : "activa";
    setOcupado("estado");
    cambiarEstadoMiembro(ranchoId, cliente.miembroId, destino)
      .then((res) => {
        onNovedad(cliente.miembroId, {
          saldo: null,
          estado: res.ok ? destino : null,
          texto: res.ok
            ? destino === "pausada"
              ? "Se pausó. Sus sellos y su historial quedan como están."
              : "Vuelve a estar activa."
            : res.motivo,
          tono: res.ok ? "bien" : "mal",
        });
      })
      .catch(() =>
        onNovedad(cliente.miembroId, {
          saldo: null,
          estado: null,
          texto: "No se pudo cambiar. Probá de nuevo.",
          tono: "mal",
        }),
      )
      .finally(() => setOcupado(null));
  }

  return (
    <div
      className={`px-4 py-3 ${puedeCanjear && activa ? "bg-aventurea-green-light/40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-full min-w-0 truncate text-[13.5px] font-bold text-aventurea-ink sm:w-auto sm:flex-1">
          {cliente.nombre}
          {cliente.conPase && (
            <span className="ml-2 rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
              en Wallet
            </span>
          )}
          {!activa && (
            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-700">
              {estado}
            </span>
          )}
        </span>

        {/* En una tarjeta que no acumula no hay contador que enseñar: un
            «1 de 1» debajo de un cupón es ruido que el empleado tiene
            que descifrar con un cliente esperando. */}
        {textos.muestraSaldo && (
          <span className="text-[12.5px] font-bold text-aventurea-ink">
            {meta === null ? `${saldo} ${textos.unidad}` : `${saldo} de ${meta}`}
          </span>
        )}

        <span
          className={`text-[12px] ${
            puedeCanjear ? "font-bold text-aventurea-green" : "text-aventurea-ink-soft"
          }`}
        >
          {puedeCanjear
            ? "puede canjear"
            : meta !== null && textos.muestraSaldo
              ? `faltan ${Math.max(0, meta - saldo)}`
              : ""}
        </span>

        {cliente.diasSinVenir !== undefined && (
          <span className="text-[12px] text-aventurea-ink-soft">
            {cliente.diasSinVenir === null
              ? "recién afiliado"
              : cliente.diasSinVenir === 0
                ? "vino hoy"
                : `hace ${cliente.diasSinVenir} día${cliente.diasSinVenir === 1 ? "" : "s"}`}
          </span>
        )}
      </div>

      {/* Los botones en su propia línea: en el teléfono del mostrador
          compitiendo con el nombre quedaban de 30px y se tocaba el
          equivocado. */}
      {(permisos.acreditar || permisos.canjear || permisos.revertir) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {permisos.acreditar && activa && (
            <>
              {pideMonto && (
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={monto}
                  onChange={(e) => {
                    setMonto(e.target.value);
                    if (avisoMonto) setAvisoMonto(null);
                  }}
                  placeholder="Monto ₡"
                  aria-label={`Monto de la compra de ${cliente.nombre}`}
                  className={`w-[110px] rounded-[10px] border bg-white px-2.5 py-2 text-[13px] text-aventurea-ink placeholder:text-zinc-500 ${
                    avisoMonto ? "border-red-500" : "border-aventurea-line"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={sumarSello}
                disabled={ocupado !== null}
                className="rounded-[10px] bg-aventurea-ink px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
              >
                {ocupado === "sello" ? "Guardando…" : textos.verboSumar}
              </button>
            </>
          )}

          {permisos.canjear && activa && puedeCanjear && recompensa && (
            <button
              type="button"
              onClick={entregar}
              disabled={ocupado !== null}
              className="rounded-[10px] bg-aventurea-green px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              {ocupado === "canje" ? "Entregando…" : `${textos.verboCanje}: ${recompensa.nombre}`}
            </button>
          )}

          {permisos.revertir && (
            <button
              type="button"
              onClick={cambiarEstado}
              disabled={ocupado !== null}
              className="rounded-[10px] border border-aventurea-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-40"
            >
              {ocupado === "estado" ? "Guardando…" : activa ? "Pausar" : "Reactivar"}
            </button>
          )}
        </div>
      )}

      {avisoMonto && <p className="mt-1.5 text-[12px] font-bold text-red-700">{avisoMonto}</p>}

      {novedad && (
        <p
          className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold ${
            novedad.tono === "bien"
              ? "bg-aventurea-green-light text-aventurea-green"
              : novedad.tono === "aviso"
                ? "border-l-4 border-amber-500 bg-amber-50 text-amber-900"
                : "bg-red-50 text-red-700"
          }`}
        >
          {novedad.texto}
        </p>
      )}
    </div>
  );
}

// ── Puerta 1: el mostrador ─────────────────────────────────────────

/**
 * Buscar por nombre y atender, sin tarjeta y sin cámara.
 *
 * La búsqueda va contra el servidor y no contra una lista cargada de
 * antemano: el teléfono del mostrador no tiene por qué llevar encima
 * los nombres de todos los clientes del negocio.
 */
export function BuscarYAtender({
  ranchoId,
  tipo,
  meta,
  recompensa,
  permisos,
  pideMonto,
}: {
  ranchoId: string;
  tipo: TipoTarjeta;
  meta: number | null;
  recompensa: RecompensaDelPrograma;
  permisos: PermisosMostrador;
  pideMonto: boolean;
}) {
  const textos = textosDelTipo(tipo);
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [encontrados, setEncontrados] = useState<MiembroAtendible[] | null>(null);
  const [novedades, setNovedades] = useState<Record<string, Novedad>>({});

  function buscar() {
    setBuscando(true);
    setAviso(null);
    buscarClientesDelPrograma(ranchoId, texto)
      .then((res) => {
        if (!res.ok) {
          setAviso(res.motivo);
          setEncontrados(null);
          return;
        }
        setEncontrados(res.clientes);
      })
      .catch(() => setAviso("No se pudo buscar. Probá de nuevo."))
      .finally(() => setBuscando(false));
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Sin la tarjeta a mano</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Teléfono descargado, tarjeta sin agregar al Wallet o cliente sin smartphone: buscalo
        por nombre y sumale su sello igual.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
        className="mt-3 flex flex-wrap gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre del cliente"
          aria-label="Nombre del cliente"
          className="min-w-0 flex-1 rounded-[10px] border border-aventurea-line bg-white px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={buscando}
          className="rounded-[10px] bg-aventurea-ink px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {aviso && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
          {aviso}
        </p>
      )}

      {encontrados !== null && encontrados.length === 0 && (
        <p className="mt-3 rounded-xl bg-aventurea-cream-2 px-3 py-2.5 text-[12.5px] text-aventurea-ink-soft">
          Nadie con ese nombre está afiliado todavía. Se afilia solo agregando la tarjeta desde
          tu QR, y ahí ya aparece acá.
        </p>
      )}

      {encontrados !== null && encontrados.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-aventurea-line bg-white">
          {encontrados.map((c, i) => (
            <div key={c.miembroId} className={i > 0 ? "border-t border-aventurea-line" : ""}>
              <FilaCliente
                ranchoId={ranchoId}
                cliente={c}
                meta={meta}
                textos={textos}
                recompensa={recompensa}
                // El mostrador NO pausa membresías: eso es del panel del
                // dueño, no de la caja.
                permisos={{ ...permisos, revertir: false }}
                pideMonto={pideMonto}
                novedad={novedades[c.miembroId]}
                onNovedad={(id, n) => setNovedades((v) => ({ ...v, [id]: n }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Puerta 2: la sección Clientes ──────────────────────────────────

/**
 * La lista de Clientes, ahora con los botones al lado de cada quien.
 *
 * Misma lista de siempre —los 50 con más saldo, ordenados por quién
 * necesita atención— con un buscador encima que filtra EN EL NAVEGADOR
 * lo que el servidor ya mandó: acá la lista ya está, y una ida al
 * servidor por cada letra sería peor.
 */
export function ListaClientes({
  ranchoId,
  clientes,
  total,
  tipo,
  meta,
  recompensa,
  permisos,
  pideMonto,
}: {
  ranchoId: string;
  clientes: ClienteEnLista[];
  total: number;
  tipo: TipoTarjeta;
  meta: number | null;
  recompensa: RecompensaDelPrograma;
  permisos: PermisosMostrador;
  pideMonto: boolean;
}) {
  const [filtro, setFiltro] = useState("");
  const [novedades, setNovedades] = useState<Record<string, Novedad>>({});
  const textos = textosDelTipo(tipo);

  const aguja = filtro.trim().toLowerCase();
  const visibles = aguja
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(aguja))
    : clientes;

  return (
    <div>
      {clientes.length > 5 && (
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar un cliente por nombre"
          className="mb-3 w-full max-w-[320px] rounded-[10px] border border-aventurea-line bg-white px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500"
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
        {visibles.length === 0 ? (
          <p className="px-4 py-5 text-center text-[13px] text-aventurea-ink-soft">
            Nadie con ese nombre en esta lista.
          </p>
        ) : (
          visibles.map((c, i) => (
            <div key={c.miembroId} className={i > 0 ? "border-t border-aventurea-line" : ""}>
              <FilaCliente
                ranchoId={ranchoId}
                cliente={c}
                meta={meta}
                textos={textos}
                recompensa={recompensa}
                permisos={permisos}
                pideMonto={pideMonto}
                novedad={novedades[c.miembroId]}
                onNovedad={(id, n) => setNovedades((v) => ({ ...v, [id]: n }))}
              />
            </div>
          ))
        )}

        {total > clientes.length && (
          <p className="border-t border-aventurea-line px-4 py-2.5 text-[12px] text-aventurea-ink-soft">
            Se muestran los {clientes.length} con más saldo, de {total}.
          </p>
        )}
      </div>
    </div>
  );
}
