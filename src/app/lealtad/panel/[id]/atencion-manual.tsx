"use client";

import { useRef, useState } from "react";
import {
  leerMontoColones,
  llaveDeIntento,
  textosDelTipo,
  type TextosDelTipo,
} from "@/lib/lealtad/mostrador";
import { CAMPO_PANEL, DETALLE, RADIO_CARD } from "@/components/panel/sistema";
import { ACCION, ACCION_TINTA, BOTON_ACCION, BOTON_LEALTAD } from "../sistema-lealtad";
import type { TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import type { ProductoDeVenta } from "@/lib/lealtad/productos";
import SelectorProducto from "./selector-producto";
import {
  acreditarOperacion,
  afiliarClienteAMano,
  buscarClientesDelPrograma,
  cambiarEstadoMiembro,
  canjearRecompensa,
  completarDatosDelCliente,
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
  /** El renglón grande: el nombre, el correo, el teléfono o «Cliente
   *  sin datos» — lo decide `fichaVisible` en el servidor, no acá. */
  nombre: string;
  /** true = eso no es un nombre. Sirve para no decirle «Listo, +1 para
   *  Cliente sin datos» como si fuera el nombre de alguien. */
  sinNombre?: boolean;
  /**
   * Los renglones chicos: correo y teléfono del cliente, o la
   * explicación de por qué la ficha está vacía.
   *
   * SON DATOS PERSONALES Y ACÁ CORRESPONDEN: es el negocio mirando a sus
   * propios clientes, que le dejaron esos datos a él en el alta. No se
   * pintan en ninguna pantalla que no sea esta lista.
   */
  contacto?: string[];
  /**
   * true = identidad LOCAL de este negocio (0200).
   *
   * QUÉ SIGNIFICA PARA QUIEN ATIENDE: esta persona escribió un correo o
   * un WhatsApp que ya pertenecía a otra identidad de Bookea y eligió
   * seguir sin cuenta. Sus datos SIRVEN para escribirle —son los que le
   * dio a este negocio— pero no están verificados y pueden estar
   * repetidos con los de otra ficha. Sin decirlo, dos fichas con el
   * mismo correo se leen como un error del sistema.
   */
  soloContacto?: boolean;
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
  productos,
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
  /** El catálogo activo (0198). Vacío = el campo de monto a mano de
   *  siempre, sin desplegable y sin ningún cambio de comportamiento. */
  productos: ProductoDeVenta[];
  novedad: Novedad | undefined;
  onNovedad: (miembroId: string, n: Novedad) => void;
}) {
  const [ocupado, setOcupado] = useState<null | "sello" | "canje" | "estado">(null);
  const [monto, setMonto] = useState("");
  /** El producto del catálogo elegido para ESTA fila. null = a mano. */
  const [productoId, setProductoId] = useState<string | null>(null);
  const [avisoMonto, setAvisoMonto] = useState<string | null>(null);
  const [completando, setCompletando] = useState(false);
  /** Lo que se acaba de teclear, para pintar la fila sin recargar. */
  const [completado, setCompletado] = useState<{ nombre: string; contacto: string[] } | null>(
    null,
  );

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

  // Lo que se acaba de teclear gana sobre lo que trajo el servidor: sin
  // esto la fila seguiría diciendo «Cliente sin datos» debajo del
  // mensaje de «guardado», que se lee como que no se guardó.
  const nombreVisible = completado?.nombre ?? cliente.nombre;
  const contactoVisible = completado?.contacto ?? cliente.contacto;
  const faltanDatos = completado === null && cliente.sinNombre === true;

  function sumarSello() {
    const lectura = leerMontoColones(pideMonto ? monto : "");
    if (!lectura.ok) {
      setAvisoMonto(lectura.motivo);
      return;
    }
    setAvisoMonto(null);
    setOcupado("sello");
    if (!intento.current) intento.current = llaveDeIntento();
    // El producto viaja como ID: el nombre que se guarda lo resuelve el
    // servidor contra el catálogo de ESTE negocio, no el navegador.
    acreditarOperacion(
      ranchoId,
      cliente.miembroId,
      lectura.monto,
      `mostrador:${intento.current}`,
      null,
      productoId,
    )
      .then((res) => {
        // Contestó: el intento se cierra pase lo que pase. Ver el ref.
        intento.current = null;
        if (!res.ok) {
          onNovedad(cliente.miembroId, { saldo: null, estado: null, texto: res.motivo, tono: "mal" });
          return;
        }
        if (!res.yaEstaba) {
          setMonto("");
          setProductoId(null);
        }
        onNovedad(cliente.miembroId, {
          saldo: res.saldo,
          estado: null,
          // `yaEstaba` NO es éxito: no se sumó nada. Se pinta como aviso
          // y dice el saldo real — decirle «listo» a algo que no entró
          // es lo que hizo que el dueño reportara que el sistema no
          // entrega los sellos.
          // Sin nombre no se saluda: «para Cliente sin datos» se lee como
          // si ese fuera el nombre de la señora que está enfrente.
          texto: res.yaEstaba
            ? `No se sumó de nuevo: esa misma operación ya había entrado. Sigue en ${res.saldo} ${textos.unidad}.`
            : faltanDatos
              ? `Listo: +${res.puntos} ${textos.unidad}.`
              : `Listo: +${res.puntos} ${textos.unidad} para ${nombreVisible}.`,
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
          {nombreVisible}
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

      {/* EL CORREO Y EL TELÉFONO, que es lo que el dueño pidió ver.
          Renglón propio y no al lado del nombre: en el teléfono del
          mostrador un correo largo empuja el saldo fuera de la pantalla.
          `DETALLE` es el token del sistema (`text-aventurea-ink-soft`),
          que dentro de `.lealtad-oscuro` ya vale rgba(255,255,255,.62)
          → 6,81:1 sobre la superficie de tarjeta: AA con margen, y sin
          estrenar ningún color. */}
      {contactoVisible && contactoVisible.length > 0 && (
        <p className={`mt-0.5 ${DETALLE}`}>
          {contactoVisible.join(" · ")}
          {/* La marca de la identidad local (0200), pegada al contacto
              porque es de ÉL de lo que habla: «podés escribirle, pero
              este dato no lo verificó nadie y puede estar repetido».
              Sin esto, dos fichas con el mismo correo se leen como una
              falla del sistema y el dueño lo reporta como tal. */}
          {cliente.soloContacto && (
            <span className="ml-2 rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
              contacto sin verificar
            </span>
          )}
        </p>
      )}

      {/* Los botones en su propia línea: en el teléfono del mostrador
          compitiendo con el nombre quedaban de 30px y se tocaba el
          equivocado. */}
      {(permisos.acreditar || permisos.canjear || permisos.revertir) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {permisos.acreditar && activa && (
            <>
              {/* EL CATÁLOGO (0198): elegir el producto pone su precio
                  en el campo de al lado, que sigue siendo editable —
                  una venta puede llevar dos. Sin catálogo cargado, esto
                  no se dibuja y la fila queda idéntica a la de antes.
                  El <label> va oculto y no como `aria-label` para que
                  el nombre del cliente sea parte del nombre accesible:
                  en una lista de 50 filas, «Producto» a secas no dice
                  de quién es el desplegable. */}
              {pideMonto && productos.length > 0 && (
                <div className="w-[190px] [&_label]:sr-only [&_select]:bg-white [&_select]:py-2 [&_select]:text-[13px]">
                  <SelectorProducto
                    id={`producto-${cliente.miembroId}`}
                    productos={productos}
                    valor={productoId}
                    onElegir={(p) => {
                      setProductoId(p?.id ?? null);
                      if (avisoMonto) setAvisoMonto(null);
                      if (p) setMonto(String(p.precio));
                    }}
                    etiqueta={`Producto que le vendés a ${cliente.nombre}`}
                  />
                </div>
              )}

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
                className={BOTON_ACCION}
                style={{ background: ACCION, color: ACCION_TINTA }}
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
              className={`${BOTON_LEALTAD} border-transparent bg-aventurea-green text-white`}
            >
              {ocupado === "canje" ? "Entregando…" : `${textos.verboCanje}: ${recompensa.nombre}`}
            </button>
          )}

          {permisos.revertir && (
            <button
              type="button"
              onClick={cambiarEstado}
              disabled={ocupado !== null}
              className={BOTON_LEALTAD}
            >
              {ocupado === "estado" ? "Guardando…" : activa ? "Pausar" : "Reactivar"}
            </button>
          )}

          {/* SOLO en la ficha vacía. Un botón de «completar datos» en
              todas las filas invitaría a reescribir el nombre que la
              persona dio ella misma, que es justo lo que no se hace. */}
          {faltanDatos && permisos.acreditar && !completando && (
            <button
              type="button"
              onClick={() => setCompletando(true)}
              className={BOTON_LEALTAD}
            >
              Completar datos
            </button>
          )}
        </div>
      )}

      {completando && (
        <FormularioCompletar
          ranchoId={ranchoId}
          miembroId={cliente.miembroId}
          onListo={(datos) => {
            setCompletado(datos);
            setCompletando(false);
          }}
          onCancelar={() => setCompletando(false)}
        />
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

// ── Completar la ficha vacía, desde la caja ────────────────────────

/**
 * TRES CAMPOS Y UNA CASILLA, con el cliente enfrente.
 *
 * ── QUÉ ARREGLA ─────────────────────────────────────────────────────
 * Las fichas que dicen «Cliente sin datos»: gente con tarjeta y con
 * sellos de la que no se sabe ni el nombre, porque se afilió por el
 * camino roto que `personas.ts` documenta. En producción eran 3 de 5.
 *
 * ── POR QUÉ ACÁ Y NO EN UNA PANTALLA APARTE ─────────────────────────
 * Porque el único momento en que se puede llenar es cuando la señora
 * está enfrente: el dato no lo tiene el dueño en ningún lado, hay que
 * preguntárselo. Una pantalla de administración aparte se llenaría el
 * día que alguien se acuerde, o sea nunca.
 *
 * ── LA CASILLA NO ES DECORACIÓN ─────────────────────────────────────
 * Es lo que decide si en `consentimientos_persona` queda 'aceptado' o
 * 'revocado', y sale SIN marcar: si el cajero no preguntó, la respuesta
 * es no. El texto que se archiva dice explícitamente que los datos los
 * tomó el negocio de viva voz y no la persona en una pantalla — son dos
 * pruebas de fuerza distinta y la tabla tiene que poder distinguirlas
 * (`textoConsentimientoMostrador`).
 *
 * ── LOS TECLADOS ────────────────────────────────────────────────────
 * `type="tel"` e `inputMode` no son cosmética: esto se llena en el
 * teléfono del mostrador, de pie, con alguien esperando.
 */
function FormularioCompletar({
  ranchoId,
  miembroId,
  onListo,
  onCancelar,
}: {
  ranchoId: string;
  miembroId: string;
  onListo: (datos: { nombre: string; contacto: string[] }) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [correo, setCorreo] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function guardar() {
    setGuardando(true);
    setAviso(null);
    completarDatosDelCliente(ranchoId, miembroId, {
      nombre,
      whatsapp,
      correo,
      aceptaPromos: acepta,
    })
      .then((res) => {
        if (!res.ok) {
          setAviso(res.motivo);
          return;
        }
        onListo({ nombre: res.nombre, contacto: res.contacto });
      })
      .catch(() => setAviso("No se pudo guardar. Probá de nuevo."))
      .finally(() => setGuardando(false));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      className="mt-2.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3"
    >
      <p className="text-[12.5px] font-bold text-aventurea-ink">
        ¿Cómo se llama? Preguntale y anotalo acá.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          autoComplete="off"
          placeholder="Nombre"
          aria-label="Nombre del cliente"
          className={CAMPO_PANEL}
        />
        <div className="flex flex-wrap gap-2">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="WhatsApp"
            aria-label="WhatsApp del cliente"
            className={`min-w-0 flex-1 ${CAMPO_PANEL}`}
          />
          <input
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="Correo"
            aria-label="Correo del cliente"
            className={`min-w-0 flex-1 ${CAMPO_PANEL}`}
          />
        </div>
        <p className={DETALLE}>Con el WhatsApp o el correo alcanza.</p>
      </div>

      <label className="mt-2.5 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ accentColor: ACCION }}
        />
        <span className={DETALLE}>
          Le preguntamos y dijo que sí quiere recibir avisos de promociones y premios.
        </span>
      </label>

      {aviso && <p className="mt-2 text-[12px] font-bold text-red-700">{aviso}</p>}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={guardando}
          className={BOTON_ACCION}
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar} className={BOTON_LEALTAD}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Dar de alta a un cliente nuevo, desde la caja ──────────────────

/**
 * ALTA A MANO DE UN CLIENTE QUE TODAVÍA NO EXISTE EN BOOKEA.
 *
 * ── EN QUÉ SE DIFERENCIA DE `FormularioCompletar` ───────────────────
 * `FormularioCompletar` ARREGLA una ficha vieja que ya tiene `miembro`
 * (llegó rota por el camino que `personas.ts` documenta): solo le pone
 * nombre y contacto a algo que ya existía. Este formulario CREA todo
 * de cero —persona, vínculo con el negocio, consentimiento y
 * membresía— para alguien que hoy no tiene ninguna fila en ningún
 * lado. Por eso llama a `afiliarClienteAMano` y no a
 * `completarDatosDelCliente`, y por eso necesita `programaId`: hace
 * falta saber a qué programa se afilia, no solo qué miembro completar.
 *
 * ── EL CHECKBOX ES EL MISMO TEXTO, A PROPÓSITO ──────────────────────
 * No se reescribe: es lenguaje ya aprobado y ya archivado en
 * `consentimientos_persona` con ese texto exacto para las fichas
 * arregladas por `FormularioCompletar`. Que diga lo mismo acá evita
 * que dos pantallas casi iguales le pidan al cajero leer dos frases
 * distintas para la misma pregunta.
 */
function FormularioAgregarCliente({
  ranchoId,
  programaId,
  nombreInicial,
  onListo,
  onCancelar,
}: {
  ranchoId: string;
  programaId: string;
  /** Lo que ya se tecleó en el buscador — para no hacerlo escribir dos veces. */
  nombreInicial: string;
  onListo: (cliente: { miembroId: string; nombre: string; contacto: string[] }) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [whatsapp, setWhatsapp] = useState("");
  const [correo, setCorreo] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function guardar() {
    setGuardando(true);
    setAviso(null);
    afiliarClienteAMano(ranchoId, programaId, {
      nombre,
      whatsapp,
      correo,
      aceptaPromos: acepta,
    })
      .then((res) => {
        if (!res.ok) {
          setAviso(res.motivo);
          return;
        }
        onListo({ miembroId: res.miembroId, nombre: res.nombre, contacto: res.contacto });
      })
      .catch(() => setAviso("No se pudo guardar. Probá de nuevo."))
      .finally(() => setGuardando(false));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      className="mt-3 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3"
    >
      <p className="text-[12.5px] font-bold text-aventurea-ink">
        Cliente nuevo — pedile el nombre y un contacto.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          autoComplete="off"
          placeholder="Nombre"
          aria-label="Nombre del cliente nuevo"
          className={CAMPO_PANEL}
        />
        <div className="flex flex-wrap gap-2">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="WhatsApp"
            aria-label="WhatsApp del cliente nuevo"
            className={`min-w-0 flex-1 ${CAMPO_PANEL}`}
          />
          <input
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="Correo"
            aria-label="Correo del cliente nuevo"
            className={`min-w-0 flex-1 ${CAMPO_PANEL}`}
          />
        </div>
        <p className={DETALLE}>Con el WhatsApp o el correo alcanza.</p>
      </div>

      <label className="mt-2.5 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ accentColor: ACCION }}
        />
        <span className={DETALLE}>
          Le preguntamos y dijo que sí quiere recibir avisos de promociones y premios.
        </span>
      </label>

      {aviso && <p className="mt-2 text-[12px] font-bold text-red-700">{aviso}</p>}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={guardando}
          className={BOTON_ACCION}
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar} className={BOTON_LEALTAD}>
          Cancelar
        </button>
      </div>
    </form>
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
  programaId,
  tipo,
  meta,
  recompensa,
  permisos,
  pideMonto,
  productos = [],
}: {
  ranchoId: string;
  /**
   * El programa que se está operando en esta caja. Solo lo necesita
   * el alta de cliente nuevo (`afiliarClienteAMano`) — ni el escáner ni
   * la búsqueda por nombre lo usan, porque ahí el miembro ya existe y
   * ya sabe a qué programa pertenece.
   */
  programaId: string;
  tipo: TipoTarjeta;
  meta: number | null;
  recompensa: RecompensaDelPrograma;
  permisos: PermisosMostrador;
  pideMonto: boolean;
  /** El catálogo activo del negocio (0198). Vacío = monto a mano. */
  productos?: ProductoDeVenta[];
}) {
  const textos = textosDelTipo(tipo);
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [encontrados, setEncontrados] = useState<MiembroAtendible[] | null>(null);
  const [novedades, setNovedades] = useState<Record<string, Novedad>>({});
  /** El formulario de alta está abierto — se puede abrir con o sin
   *  haber buscado antes, ver la nota junto al botón de abajo. */
  const [agregando, setAgregando] = useState(false);
  /** El aviso de éxito del alta recién hecha, con el recordatorio del
   *  Wallet. Se limpia con la próxima búsqueda para que no quede
   *  pegado mirando a otro cliente. */
  const [recienAgregado, setRecienAgregado] = useState<string | null>(null);

  function buscar() {
    setBuscando(true);
    setAviso(null);
    setRecienAgregado(null);
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

  /**
   * El alta terminó bien. En vez de forzar una búsqueda nueva contra
   * el servidor, la fila se arma acá mismo con lo que la acción ya
   * devolvió y se pone arriba de la lista: el cajero pasa directo a
   * apretar «sumar sello» para la visita que motivó el alta, sin un
   * segundo viaje.
   */
  function altaLista(cliente: { miembroId: string; nombre: string; contacto: string[] }) {
    const fila: MiembroAtendible = {
      miembroId: cliente.miembroId,
      nombre: cliente.nombre,
      sinNombre: false,
      contacto: cliente.contacto,
      saldo: 0,
      estado: "activa",
      conPase: false,
    };
    setEncontrados((v) => [fila, ...(v ?? [])]);
    setAgregando(false);
    setAviso(null);
    setRecienAgregado(cliente.nombre);
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">Sin la tarjeta a mano</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Teléfono descargado, tarjeta sin agregar al Wallet o cliente sin smartphone: buscalo
        por nombre y sumale su sello igual.
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
          className="flex min-w-[200px] flex-1 flex-wrap gap-2"
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre del cliente"
            aria-label="Nombre del cliente"
            className={`min-w-0 flex-1 ${CAMPO_PANEL}`}
          />
          <button
            type="submit"
            disabled={buscando}
            className={BOTON_ACCION}
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {/* Siempre visible y no solo cuando la búsqueda falla: muchos
            clientes nuevos son obviamente nuevos desde el principio
            (primera visita), y obligar a buscar y fallar antes de poder
            darlos de alta es fricción de sobra con el cliente enfrente. */}
        {permisos.acreditar && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className={BOTON_LEALTAD}
          >
            + Agregar cliente nuevo
          </button>
        )}
      </div>

      {agregando && (
        <FormularioAgregarCliente
          ranchoId={ranchoId}
          programaId={programaId}
          nombreInicial={texto}
          onListo={altaLista}
          onCancelar={() => setAgregando(false)}
        />
      )}

      {recienAgregado && (
        <div className="mt-3 rounded-xl bg-aventurea-green-light px-3 py-2.5 text-[12.5px] text-aventurea-green">
          <p className="font-bold">Cliente agregado. Ya puede empezar a juntar.</p>
          {/* No hay un enlace personal que reconozca a la persona sola
              todavía (pendiente de una mejora futura): el link genérico
              de «Compartí tu tarjeta» funciona, pero recién la reconoce
              cuando teclea el MISMO correo o WhatsApp que se anotó acá. */}
          <p className="mt-1 font-normal text-aventurea-ink-soft">
            Para que se lleve la tarjeta al teléfono, compartile el link o el QR de arriba
            («Compartí tu tarjeta») — cuando lo abra con el mismo correo o WhatsApp que acabás
            de anotar, el sistema ya lo va a reconocer.
          </p>
        </div>
      )}

      {aviso && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
          {aviso}
        </p>
      )}

      {encontrados !== null && encontrados.length === 0 && (
        <p className="mt-3 rounded-xl bg-aventurea-cream-2 px-3 py-2.5 text-[12.5px] text-aventurea-ink-soft">
          Nadie con ese nombre está afiliado todavía.{" "}
          {permisos.acreditar ? (
            <button
              type="button"
              onClick={() => setAgregando(true)}
              className="font-bold underline underline-offset-2"
            >
              Agregalo vos mismo →
            </button>
          ) : (
            "Se afilia solo agregando la tarjeta desde tu QR, y ahí ya aparece acá."
          )}
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
                productos={productos}
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
  productos = [],
}: {
  ranchoId: string;
  clientes: ClienteEnLista[];
  total: number;
  tipo: TipoTarjeta;
  meta: number | null;
  recompensa: RecompensaDelPrograma;
  permisos: PermisosMostrador;
  pideMonto: boolean;
  /** El catálogo activo del negocio (0198). Vacío = monto a mano. */
  productos?: ProductoDeVenta[];
}) {
  const [filtro, setFiltro] = useState("");
  const [novedades, setNovedades] = useState<Record<string, Novedad>>({});
  const textos = textosDelTipo(tipo);

  // Se busca también por correo y por teléfono: ahora están en pantalla,
  // y un buscador que solo mira el nombre delante de un dato visible se
  // siente roto. Es filtrado local sobre lo que el servidor ya mandó.
  const aguja = filtro.trim().toLowerCase();
  const visibles = aguja
    ? clientes.filter((c) =>
        [c.nombre, ...(c.contacto ?? [])].some((t) => t.toLowerCase().includes(aguja)),
      )
    : clientes;

  return (
    <div>
      {clientes.length > 5 && (
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre, correo o teléfono"
          aria-label="Buscar un cliente por nombre, correo o teléfono"
          className={`mb-3 w-full max-w-[320px] ${CAMPO_PANEL}`}
        />
      )}

      <div className={`overflow-hidden ${RADIO_CARD} border border-aventurea-line bg-aventurea-surface`}>
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
                productos={productos}
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
