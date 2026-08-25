"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { ACCION, ACCION_TINTA, BOTON_ACCION } from "../sistema-lealtad";
import type { ModoPrograma } from "@/lib/wallet/tarjeta";
import { selloParaGuardar, type SelloElegido } from "@/lib/lealtad/iconos-sello";
import {
  cambiarEstadoPrograma,
  eliminarRecompensa,
  guardarBeneficio,
  guardarPrograma,
  guardarRecompensa,
  type EdicionTarjeta,
  type FormatoCodigo,
  type ProgramaFila,
  type ProgramaInput,
  type RecompensaFila,
  type RecompensaInput,
} from "./pases-actions";

/**
 * EL ESTADO DEL PROGRAMA, COMPARTIDO.
 *
 * El menú lateral partió lo que antes era un solo formulario en dos
 * secciones: «Recompensas» (cómo se gana y qué se gana) y «Tarjeta
 * digital» (cómo se ve). Las dos escriben la MISMA fila de
 * `programa_lealtad`, y `guardarPrograma` guarda la fila completa.
 *
 * Con un borrador por sección, esto pasaba: el dueño cambia los sellos
 * por visita en Recompensas y guarda; se va a Tarjeta —cuyo borrador
 * se sembró al cargar la página, con el valor viejo—, toca un color y
 * guarda: los sellos vuelven atrás sin que nadie lo pida.
 *
 * Por eso el borrador es UNO solo y vive acá arriba, por encima de las
 * dos secciones. Cada «Guardar» manda el mismo objeto coherente.
 */

export type Borrador = {
  nombre: string;
  modo: ModoPrograma;
  puntosPorVisita: string;
  puntosPorColon: string;
  colorFondo: string;
  colorSello: string;
  logoUrl: string;
  /** Banda de arriba del pase (0132). */
  bannerUrl: string;
  /** El logo del AVISO de Wallet (0208), no el de la tarjeta. */
  notificacionLogoUrl: string;
  /**
   * El dibujo de cada sello (0145). null = el logo del negocio;
   * 'propio' = el ícono que subió el negocio, que vive en `iconoUrl`.
   */
  iconoSello: SelloElegido | null;
  /**
   * El ícono propio (0174). Viaja SIEMPRE, esté elegido o no: es el
   * archivo del negocio, y probar «Café» un rato no puede borrárselo.
   */
  iconoUrl: string;
  codigoFormato: FormatoCodigo;
  textoReverso: string;
  mostrarSaldo: boolean;
  mostrarProgreso: boolean;
  activo: boolean;
};

function num(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

function dePrograma(p: ProgramaFila | null): Borrador {
  // Las dos columnas del sello se leen juntas y con el filtro
  // compartido: sin la 0145/0174 la fila llega sin ellas y esto queda
  // en null, que es el sello de siempre.
  const sello = selloParaGuardar({
    tipo: p?.modo,
    icono: p?.pase_sello_icono,
    url: p?.pase_sello_icono_url,
  });
  return {
    nombre: p?.nombre ?? "Programa de lealtad",
    modo: p?.modo ?? "sellos",
    puntosPorVisita: String(p?.puntos_por_visita ?? 1),
    puntosPorColon: String(p?.puntos_por_colon ?? 0),
    colorFondo: p?.pase_color_fondo ?? "#002472",
    colorSello: p?.pase_color_sello ?? "#F39200",
    logoUrl: p?.pase_logo_url ?? "",
    // Los cinco de la 0132 con `??` y no con `||`: la migración puede
    // no estar pegada y entonces la fila llega SIN el campo. `undefined`
    // tiene que caer en el valor que reproduce el pase de hoy —los dos
    // interruptores encendidos y el QR— o el editor arrancaría
    // apagando cosas que nadie apagó.
    bannerUrl: p?.pase_banner_url ?? "",
    notificacionLogoUrl: p?.pase_notificacion_logo_url ?? "",
    iconoSello: sello.icono,
    iconoUrl: sello.url ?? "",
    codigoFormato: p?.pase_codigo_formato === "code128" ? "code128" : "qr",
    textoReverso: p?.pase_texto_reverso ?? "",
    mostrarSaldo: p?.pase_mostrar_saldo ?? true,
    mostrarProgreso: p?.pase_mostrar_progreso ?? true,
    activo: p?.activo ?? true,
  };
}

type ContextoPrograma = {
  ranchoId: string;
  tieneCercania: boolean;
  programa: ProgramaFila | null;
  recompensas: RecompensaFila[];
  /** La más barata activa: la que marca la meta de la tarjeta. */
  meta: RecompensaFila | null;
  borrador: Borrador;
  cambiar: (parte: Partial<Borrador>) => void;
  error: string | null;
  guardado: boolean;
  ocupado: boolean;
  guardar: () => void;
  /**
   * EL "GUARDAR CAMBIOS" ÚNICO del editor unificado (antes: dos botones
   * en dos pestañas separadas, "Qué se gana" con `guardarBeneficio` y
   * "Cómo se ve" con `guardar()`/`guardarPrograma` — dos guardados
   * independientes de la MISMA fila, que es exactamente lo que hacía
   * que el editor se sintiera distinto del creador). Encadena las dos
   * acciones que ya existían, sin duplicar su lógica: primero el
   * beneficio (nombre/tipo/beneficio/reglas/vencimiento), y con esa
   * respuesta ya sincronizada, el diseño (colores/logo/banda/ícono/
   * estado) — mismo orden que un guardado manual de las dos pestañas
   * viejas, una detrás de la otra.
   */
  guardarTodo: (datos: {
    nombre: string;
    tipo: EdicionTarjeta["tipo"];
    beneficio: EdicionTarjeta["beneficio"];
    reglas: EdicionTarjeta["reglas"];
    vencenMeses: number | null;
  }) => void;
  agregarRecompensa: (datos: RecompensaInput) => void;
  /**
   * CORREGIR una recompensa que ya existe.
   *
   * Faltaba, y con ella faltaba media promesa del producto: el dueño
   * podía agregar «Corte gratis a los 8» y borrar «Café gratis a los
   * 10», pero no cambiar el 10 por un 8 — o sea que para subir un
   * precio había que borrar la regalía y volverla a escribir. La server
   * action ya sabía hacerlo (`guardarRecompensa` acepta un id); lo que
   * no existía era quién se lo pidiera.
   */
  editarRecompensa: (id: string, datos: RecompensaInput) => void;
  borrarRecompensa: (id: string) => void;
  cambiarEstado: (estado: string) => void;
  /**
   * Re-sincroniza la fila después de que OTRA pantalla la guardó.
   *
   * El editor por tarjeta guarda el beneficio, las reglas y a veces el
   * tipo con su propia acción. Sin esto, el borrador compartido seguiría
   * con el nombre y el modo viejos, y el siguiente «Guardar» del diseño
   * revertiría lo que se acababa de guardar — exactamente el bug que
   * este contexto existe para evitar.
   *
   * Se mezcla en vez de re-sembrar entero: lo que el dueño esté
   * escribiendo en el editor del diseño no se pierde.
   */
  sincronizarPrograma: (fila: ProgramaFila, recompensas?: RecompensaFila[]) => void;
};

const Contexto = createContext<ContextoPrograma | null>(null);

export function usePrograma(): ContextoPrograma {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error("Las secciones del programa van dentro de <ProveedorPrograma>.");
  }
  return ctx;
}

export function ProveedorPrograma({
  ranchoId,
  programaInicial,
  recompensasIniciales,
  tieneCercania,
  children,
}: {
  ranchoId: string;
  programaInicial: ProgramaFila | null;
  recompensasIniciales: RecompensaFila[];
  /** Complemento de pago (0123): el aviso en pantalla bloqueada. */
  tieneCercania: boolean;
  children: ReactNode;
}) {
  const [programa, setPrograma] = useState(programaInicial);
  const [recompensas, setRecompensas] = useState(
    [...recompensasIniciales].sort((a, b) => a.costo_puntos - b.costo_puntos),
  );
  const [borrador, setBorrador] = useState<Borrador>(dePrograma(programaInicial));
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const meta = recompensas.find((r) => r.activo) ?? null;

  function cambiar(parte: Partial<Borrador>) {
    setBorrador((prev) => ({ ...prev, ...parte }));
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    const entrada: ProgramaInput = {
      nombre: borrador.nombre,
      modo: borrador.modo,
      puntosPorVisita: Math.round(num(borrador.puntosPorVisita)),
      puntosPorColon: num(borrador.puntosPorColon),
      colorFondo: borrador.colorFondo,
      colorSello: borrador.colorSello,
      logoUrl: borrador.logoUrl,
      bannerUrl: borrador.bannerUrl,
      notificacionLogoUrl: borrador.notificacionLogoUrl,
      iconoSello: borrador.iconoSello,
      iconoUrl: borrador.iconoUrl,
      codigoFormato: borrador.codigoFormato,
      textoReverso: borrador.textoReverso,
      mostrarSaldo: borrador.mostrarSaldo,
      mostrarProgreso: borrador.mostrarProgreso,
      activo: borrador.activo,
    };
    iniciar(async () => {
      // El id va explícito: un negocio puede tener varias tarjetas
      // (0134) y sin él el servidor tendría que adivinar cuál se está
      // editando.
      const res = await guardarPrograma(ranchoId, entrada, programa?.id ?? null);
      if (res.error) setError(res.error);
      else if (res.programa) {
        setPrograma(res.programa);
        setGuardado(true);
      }
    });
  }

  function guardarTodo(datos: {
    nombre: string;
    tipo: EdicionTarjeta["tipo"];
    beneficio: EdicionTarjeta["beneficio"];
    reglas: EdicionTarjeta["reglas"];
    vencenMeses: number | null;
  }) {
    if (!programa) {
      setError("Esta tarjeta todavía no existe.");
      return;
    }
    setError(null);
    setGuardado(false);
    iniciar(async () => {
      const r1 = await guardarBeneficio(ranchoId, programa.id, {
        nombre: datos.nombre,
        tipo: datos.tipo,
        beneficio: datos.beneficio,
        reglas: datos.reglas,
        sellosVencenMeses: datos.vencenMeses,
      });
      if (r1.error) {
        setError(r1.error);
        return;
      }
      // El diseño se manda con el MISMO nombre/tipo que se acaba de
      // guardar — nunca el que traía el borrador antes de este guardado
      // — para que las dos escrituras de la misma fila nunca se
      // contradigan entre sí.
      const entrada: ProgramaInput = {
        nombre: datos.nombre,
        modo: datos.tipo,
        puntosPorVisita: Math.round(num(borrador.puntosPorVisita)),
        puntosPorColon: num(borrador.puntosPorColon),
        colorFondo: borrador.colorFondo,
        colorSello: borrador.colorSello,
        logoUrl: borrador.logoUrl,
        bannerUrl: borrador.bannerUrl,
        notificacionLogoUrl: borrador.notificacionLogoUrl,
        iconoSello: datos.tipo === "sellos" ? borrador.iconoSello : null,
        iconoUrl: datos.tipo === "sellos" ? borrador.iconoUrl : "",
        codigoFormato: borrador.codigoFormato,
        textoReverso: borrador.textoReverso,
        mostrarSaldo: borrador.mostrarSaldo,
        mostrarProgreso: borrador.mostrarProgreso,
        activo: borrador.activo,
      };
      const r2 = await guardarPrograma(ranchoId, entrada, programa.id);
      if (r2.error) {
        setError(r2.error);
        return;
      }
      if (r2.programa) sincronizarPrograma(r2.programa, r1.recompensas);
      setGuardado(true);
    });
  }

  function agregarRecompensa(datos: RecompensaInput) {
    if (!programa) {
      setError("Guardá el programa antes de agregar recompensas.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const res = await guardarRecompensa(ranchoId, programa.id, datos);
      if (res.error) setError(res.error);
      else if (res.recompensa) {
        setRecompensas((prev) =>
          [...prev, res.recompensa!].sort((a, b) => a.costo_puntos - b.costo_puntos),
        );
      }
    });
  }

  function editarRecompensa(id: string, datos: RecompensaInput) {
    if (!programa) return;
    setError(null);
    iniciar(async () => {
      const res = await guardarRecompensa(ranchoId, programa.id, datos, id);
      if (res.error) setError(res.error);
      else if (res.recompensa) {
        setRecompensas((prev) =>
          prev
            .map((r) => (r.id === id ? res.recompensa! : r))
            .sort((a, b) => a.costo_puntos - b.costo_puntos),
        );
      }
    });
  }

  function sincronizarPrograma(fila: ProgramaFila, lista?: RecompensaFila[]) {
    setPrograma(fila);
    // Guardar el beneficio de una tarjeta de sellos MUEVE la recompensa
    // que hace de meta. Si la lista no se refrescara, la pestaña de
    // regalías seguiría mostrando la vieja hasta recargar la página.
    if (lista) setRecompensas([...lista].sort((a, b) => a.costo_puntos - b.costo_puntos));
    setBorrador((prev) => {
      // El icono pasa por el filtro compartido: si el tipo dejó de ser
      // «sellos», no quedan círculos donde dibujarlo y el icono se cae
      // solo —con su archivo— en vez de viajar colgado hasta el próximo
      // guardado.
      const sello = selloParaGuardar({
        tipo: fila.modo,
        icono: prev.iconoSello,
        url: prev.iconoUrl,
      });
      return {
        ...prev,
        nombre: fila.nombre,
        modo: fila.modo ?? prev.modo,
        iconoSello: sello.icono,
        iconoUrl: sello.url ?? "",
      };
    });
  }

  function borrarRecompensa(id: string) {
    if (!programa) return;
    setError(null);
    iniciar(async () => {
      const res = await eliminarRecompensa(ranchoId, programa.id, id);
      if (res.error) setError(res.error);
      else setRecompensas((prev) => prev.filter((r) => r.id !== id));
    });
  }

  function cambiarEstado(estado: string) {
    if (!programa) return;
    setError(null);
    iniciar(async () => {
      const res = await cambiarEstadoPrograma(ranchoId, programa.id, estado);
      if (res.error) setError(res.error);
      else if (res.programa) setPrograma(res.programa);
    });
  }

  return (
    <Contexto.Provider
      value={{
        ranchoId,
        tieneCercania,
        programa,
        recompensas,
        meta,
        borrador,
        cambiar,
        error,
        guardado,
        ocupado,
        guardar,
        guardarTodo,
        agregarRecompensa,
        editarRecompensa,
        borrarRecompensa,
        cambiarEstado,
        sincronizarPrograma,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

// ── Las piezas que usan LAS DOS secciones ─────────────────────────
//
// Viven acá, junto al contexto del que leen, y no en una de las dos
// secciones. Puestas en «Recompensas», el editor del diseño tendría que
// importarlas de ahí mientras esa misma sección lo importa a él: un
// ciclo entre dos módulos cliente para reusar cuatro párrafos. Y
// copiarlas es peor — el aviso de guardado ya diría dos cosas distintas
// según en qué sección estés.

export function AvisoError() {
  const { error } = usePrograma();
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
      {error}
    </p>
  );
}

export function AvisoGuardado() {
  const { guardado } = usePrograma();
  if (!guardado) return null;
  return (
    <p
      role="status"
      className="rounded-xl bg-aventurea-green-light px-3 py-2 text-[12.5px] font-bold text-aventurea-green"
    >
      Guardado. Las tarjetas nuevas ya salen con estos cambios.
    </p>
  );
}

export function BarraGuardar() {
  const { borrador, cambiar, ocupado, guardar } = usePrograma();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={guardar}
        disabled={ocupado}
        className={`${BOTON_ACCION} presionable`}
        style={{ background: ACCION, color: ACCION_TINTA }}
      >
        {ocupado ? "Guardando…" : "Guardar"}
      </button>
      <label className="flex items-center gap-2 text-[12.5px] font-bold text-aventurea-ink-soft">
        <input
          type="checkbox"
          checked={borrador.activo}
          onChange={(e) => cambiar({ activo: e.target.checked })}
        />
        Programa activo
      </label>
    </div>
  );
}

export function NotaCercania() {
  const { tieneCercania } = usePrograma();
  return (
    <p className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
      {tieneCercania
        ? "Aviso por cercanía activo: la tarjeta aparece sola en la pantalla bloqueada cuando el cliente pasa cerca del local."
        : "El aviso por cercanía —que la tarjeta salga sola cuando el cliente pasa cerca— es un complemento aparte."}
    </p>
  );
}
