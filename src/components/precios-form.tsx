"use client";

import { useMemo, useState, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  GuardarPreciosInput,
  PrecioTier,
  ServicioAdicional,
} from "@/app/mi-negocio/types";
import {
  MODALIDADES_PRECIO_LUGAR,
  MODALIDAD_PRECIO_LUGAR_LABEL,
  type ModalidadPrecioLugar,
} from "@/app/mi-negocio/types";
import {
  calcularBaseLugar,
  parsearPrecioPorPersona,
  type EscalonFijo,
  type PrecioPorPersona,
} from "@/lib/precio-lugar";
import { IconTrash } from "@/components/icons";
import SeccionPlegable from "@/components/seccion-plegable";

type TierDraft = {
  key: string;
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

/**
 * Un ancla de la tarifa deslizante de diciembre, mientras se edita.
 * Los campos van como texto para poder quedar vacíos (placeholder) sin
 * inventar un 0: al guardar se convierten y los valida el MISMO parser
 * que usa el cálculo.
 */
type TramoDraft = { key: string; invitados: string; tarifa: string };

/**
 * Un escalón de precio fijo mientras se edita. Solo se escribe el
 * "hasta": el "desde" sale del escalón anterior, así el dueño no puede
 * dejar un hueco (o un solape) entre dos tramos por escribir mal un
 * número.
 */
type EscalonDraft = { key: string; hasta: string; precio: string };

/**
 * Un problema de la config "por persona". Se distinguen dos clases
 * porque no se muestran igual: "incompleto" es una casilla que todavía
 * no llenaron (avisar mientras escribe sería regañarlo por no haber
 * terminado) y solo sale al guardar; "estructura" es una lista que ya
 * está mal armada y se muestra en vivo, que es cuando sirve.
 */
type ProblemaPorPersona = { tipo: "incompleto" | "estructura"; texto: string };

/** Los tamaños de grupo del ejemplo vivo debajo del editor. */
const EJEMPLOS_INVITADOS = [15, 25, 50, 100];

const colones = (n: number) => `₡${n.toLocaleString("es-CR")}`;
type ServicioDraft = {
  key: string;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
  activo: boolean;
};

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `new-${keySeq}`;
}

const CLASE_INPUT =
  "w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink px-2.5 py-2 text-[13px]";

/** Los rangos de diciembre son filas de la misma tabla (0099). */
function esDeDiciembre(t: PrecioTier) {
  return t.temporada === "diciembre";
}

function aDraft(t: PrecioTier): TierDraft {
  return {
    key: t.id,
    min_invitados: t.min_invitados,
    max_invitados: t.max_invitados,
    precio: t.precio,
  };
}

export type GuardarPreciosFn = (
  input: GuardarPreciosInput,
) => Promise<{ error: string | null } | undefined>;

/**
 * La tabla de rangos "desde–hasta–precio". Es la misma para los precios
 * de todo el año y para los de diciembre: cambiarla en un solo lugar
 * evita que las dos listas terminen comportándose distinto.
 */
function EditorRangos({
  rangos,
  setRangos,
  vacio,
  nota,
}: {
  rangos: TierDraft[];
  setRangos: Dispatch<SetStateAction<TierDraft[]>>;
  /** Qué decir cuando todavía no hay ningún rango cargado. */
  vacio?: string;
  /** Aclaración corta debajo del botón de agregar. */
  nota?: string;
}) {
  function actualizar(key: string, campo: keyof TierDraft, valor: number) {
    setRangos((prev) =>
      prev.map((t) => (t.key === key ? { ...t, [campo]: valor } : t)),
    );
  }

  return (
    <div>
      {rangos.length > 0 ? (
        // Scroll horizontal: la tabla pide ~520px y en un teléfono hay
        // ~306px — sin esto desbordaba la PÁGINA entera.
        <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              {["Desde (invitados)", "Hasta (invitados)", "Precio (₡)", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rangos.map((t) => (
              <tr key={t.key}>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.min_invitados}
                    onChange={(e) =>
                      actualizar(t.key, "min_invitados", Number(e.target.value))
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.max_invitados}
                    onChange={(e) =>
                      actualizar(t.key, "max_invitados", Number(e.target.value))
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={t.precio}
                    onChange={(e) =>
                      actualizar(t.key, "precio", Number(e.target.value))
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setRangos((prev) => prev.filter((x) => x.key !== t.key))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-400 hover:text-red-700"
                    title="Eliminar"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : (
        vacio && (
          <p className="mt-4 rounded-lg border border-dashed border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[12px] text-aventurea-ink-soft">
            {vacio}
          </p>
        )
      )}

      <button
        type="button"
        onClick={() =>
          setRangos((prev) => {
            const anterior = prev[prev.length - 1];
            const desde = anterior ? anterior.max_invitados + 1 : 1;
            return [
              ...prev,
              {
                key: newKey(),
                min_invitados: desde,
                max_invitados: desde + 9,
                precio: anterior?.precio ?? 0,
              },
            ];
          })
        }
        className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
      >
        ＋ Agregar rango
      </button>
      {nota && (
        <p className="mt-2 text-[11px] text-aventurea-ink-soft">{nota}</p>
      )}
    </div>
  );
}

/** Para prellenar los campos de texto: null/ausente = casilla vacía. */
function aTexto(n: number | null | undefined): string {
  return typeof n === "number" && n > 0 ? String(n) : "";
}

export default function PreciosForm({
  initialTiers,
  initialServicios,
  initialTarifaDiciembre,
  initialDepositoReserva,
  initialModalidadPrecio,
  initialPrecioHora,
  initialPrecioFijo,
  initialPrecioHoraDiciembre,
  initialPrecioFijoDiciembre,
  initialPrecioPorPersona = null,
  onGuardar,
}: {
  /** TODOS los rangos del lugar: acá se separan por temporada (0099). */
  initialTiers: PrecioTier[];
  initialServicios: ServicioAdicional[];
  initialTarifaDiciembre: number;
  initialDepositoReserva: number;
  initialModalidadPrecio: ModalidadPrecioLugar;
  initialPrecioHora: number | null;
  initialPrecioFijo: number | null;
  initialPrecioHoraDiciembre: number | null;
  initialPrecioFijoDiciembre: number | null;
  /** La config "por persona" (0103) YA validada con
   *  parsearPrecioPorPersona; null = nunca la cargó (editor vacío). */
  initialPrecioPorPersona?: PrecioPorPersona | null;
  onGuardar: GuardarPreciosFn;
}) {
  const [tiers, setTiers] = useState<TierDraft[]>(
    initialTiers.filter((t) => !esDeDiciembre(t)).map(aDraft),
  );
  const [tiersDiciembre, setTiersDiciembre] = useState<TierDraft[]>(
    initialTiers.filter(esDeDiciembre).map(aDraft),
  );
  const [servicios, setServicios] = useState<ServicioDraft[]>(
    initialServicios.map((s) => ({ ...s, key: s.id })),
  );
  const [tarifaDiciembre, setTarifaDiciembre] = useState(
    initialTarifaDiciembre,
  );
  const [depositoReserva, setDepositoReserva] = useState(
    initialDepositoReserva,
  );
  const [modalidadPrecio, setModalidadPrecio] = useState<ModalidadPrecioLugar>(
    initialModalidadPrecio,
  );
  const [precioHora, setPrecioHora] = useState(initialPrecioHora ?? 0);
  const [precioFijo, setPrecioFijo] = useState(initialPrecioFijo ?? 0);
  const [precioHoraDiciembre, setPrecioHoraDiciembre] = useState(
    initialPrecioHoraDiciembre ?? 0,
  );
  const [precioFijoDiciembre, setPrecioFijoDiciembre] = useState(
    initialPrecioFijoDiciembre ?? 0,
  );

  // --- Modalidad "por persona" (0103) ---
  // Texto y no número para que una casilla sin cargar quede vacía con
  // su placeholder, en vez de un 0 que parece un precio real.
  // Los escalones son una lista: "1-20 a ₡80.000, 21-30 a ₡100.000…".
  // Siempre queda al menos una fila — sin ningún escalón la modalidad no
  // tendría precio para los grupos chicos.
  const [ppEscalones, setPpEscalones] = useState<EscalonDraft[]>(() => {
    const guardados = initialPrecioPorPersona?.escalones ?? [];
    if (guardados.length === 0) return [{ key: newKey(), hasta: "", precio: "" }];
    return guardados.map((e) => ({
      key: newKey(),
      hasta: String(e.hasta),
      precio: String(e.precio),
    }));
  });
  const [ppTarifa, setPpTarifa] = useState(aTexto(initialPrecioPorPersona?.tarifa));
  const [ppMaxPersonas, setPpMaxPersonas] = useState(
    aTexto(initialPrecioPorPersona?.maxPersonas),
  );
  const [ppDicLunJue, setPpDicLunJue] = useState(
    aTexto(initialPrecioPorPersona?.dicLunJue),
  );
  const [ppDicViernes, setPpDicViernes] = useState(
    aTexto(initialPrecioPorPersona?.dicViernes),
  );
  const [ppDicSabDom, setPpDicSabDom] = useState(
    aTexto(initialPrecioPorPersona?.dicSabDom),
  );
  // Siempre hay al menos una fila de ancla: la lista vacía no existe
  // en este editor (sin anclas, diciembre cobraría la tarifa normal).
  const [ppTramos, setPpTramos] = useState<TramoDraft[]>(() => {
    const tramos = initialPrecioPorPersona?.dicTramos ?? [];
    if (tramos.length === 0) return [{ key: newKey(), invitados: "", tarifa: "" }];
    return tramos.map((t) => ({
      key: newKey(),
      invitados: String(t.invitados),
      tarifa: String(t.tarifa),
    }));
  });

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  function updateServicio(
    key: string,
    field: keyof ServicioDraft,
    value: string | number | boolean | null,
  ) {
    setServicios((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
    );
  }

  // Se calcula de los valores GUARDADOS, no del estado: si dependiera
  // de lo que se está escribiendo, borrar el último rango cerraría la
  // sección de golpe mientras el dueño la está editando.
  const diciembreYaCargado =
    initialTiers.some(esDeDiciembre) ||
    initialTarifaDiciembre > 0 ||
    (initialPrecioHoraDiciembre ?? 0) > 0 ||
    (initialPrecioFijoDiciembre ?? 0) > 0 ||
    // Una config "por persona" válida siempre trae sus precios de
    // diciembre — si existe, diciembre ya está cargado.
    initialPrecioPorPersona !== null;

  // El resumen del encabezado sí sigue lo que hay en pantalla.
  const tieneDiciembre =
    modalidadPrecio === "rango_personas"
      ? tiersDiciembre.length > 0 || tarifaDiciembre > 0
      : modalidadPrecio === "hora"
        ? precioHoraDiciembre > 0
        : modalidadPrecio === "por_persona"
          ? Number(ppDicLunJue) > 0 ||
            Number(ppDicViernes) > 0 ||
            Number(ppDicSabDom) > 0
          : precioFijoDiciembre > 0;

  function actualizarTramo(key: string, campo: "invitados" | "tarifa", valor: string) {
    setPpTramos((prev) =>
      prev.map((t) => (t.key === key ? { ...t, [campo]: valor } : t)),
    );
  }

  function actualizarEscalon(key: string, campo: "hasta" | "precio", valor: string) {
    setPpEscalones((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [campo]: valor } : e)),
    );
  }

  /**
   * Desde qué invitado arranca el escalón `i`: el 1, o donde terminó el
   * anterior. Nunca se escribe a mano — se muestra calculado para que
   * el dueño lea el tramo completo ("21 a 30") mientras edita.
   */
  function desdeDelEscalon(i: number): number | null {
    if (i === 0) return 1;
    const anterior = Number(ppEscalones[i - 1]?.hasta);
    return Number.isFinite(anterior) && anterior > 0 ? anterior + 1 : null;
  }

  /** El último "hasta" cargado — de ahí en adelante manda la tarifa. */
  const ultimoEscalon = (() => {
    const n = Number(ppEscalones[ppEscalones.length - 1]?.hasta);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  /**
   * Revisa la config "por persona" antes de dejar guardar. El parser de
   * @/lib/precio-lugar también la valida (y es el que manda), pero
   * devuelve un null pelado: acá se arma el mensaje que dice QUÉ está
   * mal y en qué fila. null = no hay nada que corregir.
   */
  function revisarPorPersona(): ProblemaPorPersona | null {
    const hastas: number[] = [];

    for (let i = 0; i < ppEscalones.length; i++) {
      const fila = i + 1;
      const hasta = Number(ppEscalones[i].hasta);
      const precio = Number(ppEscalones[i].precio);

      if (ppEscalones[i].hasta.trim() === "" || !Number.isFinite(hasta) || hasta <= 0) {
        return {
          tipo: "incompleto",
          texto: `Escalón ${fila}: escribí hasta cuántos invitados llega.`,
        };
      }
      if (!Number.isInteger(hasta)) {
        return {
          tipo: "estructura",
          texto: `Escalón ${fila}: la cantidad de invitados va en números enteros, sin decimales.`,
        };
      }
      if (ppEscalones[i].precio.trim() === "" || !Number.isFinite(precio) || precio <= 0) {
        return {
          tipo: "incompleto",
          texto: `Escalón ${fila}: falta el precio del tramo (tiene que ser mayor a cero).`,
        };
      }
      hastas.push(hasta);
    }

    for (let i = 1; i < hastas.length; i++) {
      if (hastas[i] === hastas[i - 1]) {
        return {
          tipo: "estructura",
          texto: `Dos escalones terminan en ${hastas[i]} invitados. Cada uno tiene que cubrir un tramo distinto.`,
        };
      }
      if (hastas[i] < hastas[i - 1]) {
        return {
          tipo: "estructura",
          texto: `Los escalones van de menor a mayor: el de ${hastas[i]} invitados no puede ir después del de ${hastas[i - 1]}.`,
        };
      }
    }

    const tarifa = Number(ppTarifa);
    if (ppTarifa.trim() === "" || !Number.isFinite(tarifa) || tarifa <= 0) {
      return {
        tipo: "incompleto",
        texto: "Falta la tarifa por persona que se cobra pasado el último escalón.",
      };
    }

    if (ppMaxPersonas.trim() !== "") {
      const tope = Number(ppMaxPersonas);
      if (!Number.isFinite(tope) || tope <= 0 || !Number.isInteger(tope)) {
        return {
          tipo: "estructura",
          texto: "El tope de personas va en números enteros mayores a cero, o vacío si no tenés tope.",
        };
      }
      const ultimo = hastas[hastas.length - 1];
      if (tope <= ultimo) {
        return {
          tipo: "estructura",
          texto: `El tope de personas (${tope}) tiene que ser mayor que el último escalón (${ultimo}); si no, la tarifa por persona nunca se usaría.`,
        };
      }
    }

    return null;
  }

  const problemaPorPersona =
    modalidadPrecio === "por_persona" ? revisarPorPersona() : null;

  /**
   * La config tal como está escrita AHORA, para el ejemplo vivo. Los
   * montos de diciembre no importan acá (el ejemplo es fuera de
   * diciembre) pero el tipo los pide, así que van como están.
   */
  const configEnPantalla = useMemo<PrecioPorPersona | null>(() => {
    const escalones: EscalonFijo[] = [];
    for (const e of ppEscalones) {
      const hasta = Number(e.hasta);
      const precio = Number(e.precio);
      if (!Number.isFinite(hasta) || hasta <= 0) return null;
      if (!Number.isFinite(precio) || precio <= 0) return null;
      escalones.push({ hasta, precio });
    }
    const tarifa = Number(ppTarifa);
    if (escalones.length === 0 || !Number.isFinite(tarifa) || tarifa <= 0) return null;
    const tope = Number(ppMaxPersonas);
    return {
      escalones: [...escalones].sort((a, b) => a.hasta - b.hasta),
      tarifa,
      maxPersonas:
        ppMaxPersonas.trim() !== "" && Number.isFinite(tope) && tope > 0 ? tope : null,
      dicLunJue: Number(ppDicLunJue) || tarifa,
      dicViernes: Number(ppDicViernes) || tarifa,
      dicSabDom: Number(ppDicSabDom) || tarifa,
      dicTramos: [],
    };
  }, [ppEscalones, ppTarifa, ppMaxPersonas, ppDicLunJue, ppDicViernes, ppDicSabDom]);

  /**
   * Cuánto pagaría un grupo de ese tamaño, con la MISMA función que usa
   * el sitio público — si el ejemplo tuviera su propia cuenta, podría
   * mostrar un número que después no se cobra.
   */
  function ejemploPara(invitados: number): string {
    if (!configEnPantalla) return "—";
    const total = calcularBaseLugar({
      modalidad: "por_persona",
      esDiciembre: false,
      porPersona: configEnPantalla,
      invitados,
      rangos: [],
      horas: null,
      precioHora: null,
      precioFijo: null,
    });
    return total === null ? "Cotización personalizada" : colones(total);
  }

  /**
   * Arma la config con las llaves EXACTAS del jsonb y la pasa por el
   * mismo parser del cálculo: si algo quedó vacío o en 0, devuelve null
   * y no se guarda nada a medias. Number("") da 0, que el parser
   * rechaza — una casilla vacía nunca se convierte en precio.
   */
  function armarPorPersona(): PrecioPorPersona | null {
    return parsearPrecioPorPersona({
      escalones: ppEscalones.map((e) => ({
        hasta: Number(e.hasta),
        precio: Number(e.precio),
      })),
      tarifa: Number(ppTarifa),
      // Vacío es "sin tope", que en el jsonb se escribe null; el parser
      // rechaza un 0, que es lo que daría Number("").
      maxPersonas: ppMaxPersonas.trim() === "" ? null : Number(ppMaxPersonas),
      dicLunJue: Number(ppDicLunJue),
      dicViernes: Number(ppDicViernes),
      dicSabDom: Number(ppDicSabDom),
      dicTramos: ppTramos.map((t) => ({
        invitados: Number(t.invitados),
        tarifa: Number(t.tarifa),
      })),
    });
  }

  function guardar() {
    setMessage(null);

    // La modalidad "por persona" se valida ANTES de mandar nada: sin
    // config completa el sitio público solo podría decir "consultar".
    let precioPorPersona: PrecioPorPersona | null = null;
    if (modalidadPrecio === "por_persona") {
      // Primero el mensaje que dice qué fila está mal; el parser de
      // abajo solo sabe decir "no sirve".
      const problema = revisarPorPersona();
      if (problema) {
        setMessage({ type: "error", text: problema.texto });
        return;
      }
      precioPorPersona = armarPorPersona();
      if (!precioPorPersona) {
        setMessage({
          type: "error",
          text: "Completá todos los campos de la modalidad Por persona (los de diciembre también) con montos mayores a cero.",
        });
        return;
      }
    }

    startTransition(async () => {
      const soloRango = (t: TierDraft) => ({
        min_invitados: t.min_invitados,
        max_invitados: t.max_invitados,
        precio: t.precio,
      });
      const res = await onGuardar({
        tiers: tiers.map(soloRango),
        tiersDiciembre: tiersDiciembre.map(soloRango),
        servicios: servicios.map((s) => ({
          nombre: s.nombre,
          precio: s.precio,
          requisito_max_invitados: s.requisito_max_invitados,
          activo: s.activo,
        })),
        tarifaDiciembre,
        depositoReserva,
        modalidadPrecio,
        precioHora: modalidadPrecio === "hora" ? precioHora : null,
        precioFijo: modalidadPrecio === "fijo" ? precioFijo : null,
        // 0 no es "gratis en diciembre": es "ese mes cobro lo de
        // siempre", y eso en la base se escribe null.
        precioHoraDiciembre:
          modalidadPrecio === "hora" && precioHoraDiciembre > 0
            ? precioHoraDiciembre
            : null,
        precioFijoDiciembre:
          modalidadPrecio === "fijo" && precioFijoDiciembre > 0
            ? precioFijoDiciembre
            : null,
        precioPorPersona,
      });
      if (res?.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "ok", text: "Guardado — ya se refleja en el sitio público." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Reserva de la fecha
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Depósito fijo para reservar
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Monto fijo (no depende de la cantidad de invitados) que el
          cliente paga por SINPE o transferencia para reservar la fecha
          en el sitio público.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[13px] font-bold text-aventurea-ink-soft">₡</span>
          <input
            type="number"
            min={0}
            value={depositoReserva}
            onChange={(e) => setDepositoReserva(Number(e.target.value))}
            className="w-40 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Cotización automática
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          ¿Cómo cobrás?
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Elegí una forma de cobro. El sitio público calcula la cotización
          sola, según la que elijas acá.
        </p>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {MODALIDADES_PRECIO_LUGAR.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModalidadPrecio(m)}
              aria-pressed={modalidadPrecio === m}
              className={`rounded-lg border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                modalidadPrecio === m
                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                  : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-navy"
              }`}
            >
              {MODALIDAD_PRECIO_LUGAR_LABEL[m]}
            </button>
          ))}
        </div>

        {modalidadPrecio === "hora" && (
          <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio por hora (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioHora}
              onChange={(e) => setPrecioHora(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Al reservar, el cliente indica cuántas horas necesita y la
              cotización sale sola (horas × este precio).
            </p>
          </div>
        )}

        {modalidadPrecio === "fijo" && (
          <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio fijo del evento (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioFijo}
              onChange={(e) => setPrecioFijo(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Un solo precio para todo el evento, sin importar la cantidad de
              invitados.
            </p>
          </div>
        )}

        {modalidadPrecio === "por_persona" && (
          <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Escalones de precio fijo
            </p>
            <p className="mt-1 text-[12px] text-aventurea-ink-soft">
              Los grupos chicos pagan un precio fijo por tramo, lleguen los
              que lleguen. Vos escribís hasta dónde llega cada escalón; el
              tramo que cubre se calcula solo desde el anterior.
            </p>

            <ul className="mt-3 flex flex-col gap-2.5">
              {ppEscalones.map((e, i) => {
                const desde = desdeDelEscalon(i);
                const hasta = Number(e.hasta);
                const tramo =
                  desde !== null && Number.isFinite(hasta) && hasta >= desde
                    ? `${desde} a ${hasta} invitados`
                    : desde !== null
                      ? `desde ${desde} invitado${desde === 1 ? "" : "s"}`
                      : "tramo por definir";
                return (
                  <li
                    key={e.key}
                    className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        data-tramo={i}
                        className="rounded-md border border-aventurea-navy/20 bg-aventurea-navy/[0.06] px-2 py-1 text-[11px] font-bold text-aventurea-navy"
                      >
                        Cubre {tramo}
                      </span>
                      <button
                        type="button"
                        disabled={ppEscalones.length === 1}
                        onClick={() =>
                          setPpEscalones((prev) =>
                            prev.length > 1
                              ? prev.filter((x) => x.key !== e.key)
                              : prev,
                          )
                        }
                        aria-label={`Quitar escalón ${i + 1}`}
                        title={
                          ppEscalones.length === 1
                            ? "Tiene que quedar al menos un escalón"
                            : "Quitar escalón"
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-aventurea-line disabled:hover:text-aventurea-ink-soft"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2.5 flex max-w-md flex-wrap gap-3">
                      <div className="min-w-0 flex-1 basis-[110px]">
                        <label
                          htmlFor={`escalon-hasta-${i}`}
                          className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                        >
                          Hasta (invitados)
                        </label>
                        <input
                          id={`escalon-hasta-${i}`}
                          type="number"
                          min={1}
                          step={1}
                          placeholder="20"
                          value={e.hasta}
                          onChange={(ev) =>
                            actualizarEscalon(e.key, "hasta", ev.target.value)
                          }
                          className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[13px] text-aventurea-ink"
                        />
                      </div>
                      <div className="min-w-0 flex-1 basis-[130px]">
                        <label
                          htmlFor={`escalon-precio-${i}`}
                          className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                        >
                          Precio del tramo (₡)
                        </label>
                        <input
                          id={`escalon-precio-${i}`}
                          type="number"
                          min={0}
                          placeholder="80000"
                          value={e.precio}
                          onChange={(ev) =>
                            actualizarEscalon(e.key, "precio", ev.target.value)
                          }
                          className="w-full rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[13px] text-aventurea-ink"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() =>
                setPpEscalones((prev) => [
                  ...prev,
                  { key: newKey(), hasta: "", precio: "" },
                ])
              }
              className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy"
            >
              ＋ Agregar escalón
            </button>

            <div className="mt-4.5 flex flex-wrap gap-4 border-t border-dashed border-aventurea-line pt-4">
              <div className="min-w-0 flex-1 basis-[150px]">
                <label
                  htmlFor="pp-tarifa"
                  className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                >
                  Tarifa por persona (₡)
                </label>
                <input
                  id="pp-tarifa"
                  type="number"
                  min={0}
                  placeholder="3200"
                  value={ppTarifa}
                  onChange={(ev) => setPpTarifa(ev.target.value)}
                  className="w-full max-w-[190px] rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                />
                <p className="mt-1.5 text-[11px] text-aventurea-ink-soft">
                  Se cobra pasado el último escalón
                  {ultimoEscalon ? ` (del invitado ${ultimoEscalon + 1} en adelante)` : ""}:
                  invitados × esta tarifa.
                </p>
              </div>
              <div className="min-w-0 flex-1 basis-[150px]">
                <label
                  htmlFor="pp-max"
                  className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                >
                  Tope de personas
                </label>
                <input
                  id="pp-max"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Sin tope"
                  value={ppMaxPersonas}
                  onChange={(ev) => setPpMaxPersonas(ev.target.value)}
                  className="w-full max-w-[190px] rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                />
                <p className="mt-1.5 text-[11px] text-aventurea-ink-soft">
                  Más personas que esto quedan a &quot;cotización
                  personalizada&quot;. Dejalo vacío si no tenés tope.
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-lg border border-dashed border-aventurea-line px-3 py-2 text-[11.5px] text-aventurea-ink-soft">
              El cliente siempre ve el total ya multiplicado — la tarifa por
              persona es información tuya y nunca aparece en el sitio.
            </p>

            {/* El ejemplo vivo: la forma de darse cuenta de un número mal
                escrito ANTES de guardarlo, y no cuando llega la reserva. */}
            <div className="mt-4 rounded-xl border border-aventurea-navy/25 bg-aventurea-navy/[0.04] p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-navy">
                Así queda la cotización
              </p>
              <p className="mt-1 text-[11.5px] text-aventurea-ink-soft">
                Lo que vería un cliente hoy, fuera de diciembre, con lo que
                está escrito acá arriba.
              </p>

              {problemaPorPersona?.tipo === "estructura" ? (
                <p
                  role="alert"
                  data-error-escalones
                  className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800"
                >
                  {problemaPorPersona.texto}
                </p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {EJEMPLOS_INVITADOS.map((n) => (
                      <div
                        key={n}
                        data-ejemplo={n}
                        className="min-w-0 rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 py-2"
                      >
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                          {n} personas
                        </p>
                        <p className="mt-0.5 break-words text-[13.5px] font-bold text-aventurea-ink">
                          {ejemploPara(n)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {!configEnPantalla && (
                    <p className="mt-2 text-[11px] text-aventurea-ink-soft">
                      Completá los escalones y la tarifa para ver el ejemplo.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {modalidadPrecio === "rango_personas" && (
        <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
            Rangos de invitados
          </p>
          <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
            Rangos de precio según número de invitados
          </h3>
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Si un número de invitados no cae en ningún rango, el sitio muestra
            &quot;cotización personalizada&quot;.
          </p>

          <EditorRangos
            rangos={tiers}
            setRangos={setTiers}
            vacio="Todavía no cargaste ningún rango: mientras tanto, el sitio pide cotización personalizada."
            nota="Cada rango nuevo continúa automáticamente donde terminó el anterior — solo ajustá el precio."
          />
        </section>
      )}

      {/* Diciembre es su propia lista de precios (0099), no un recargo:
          lo que quede acá vacío se cobra igual que el resto del año. */}
      <SeccionPlegable
        abierta={diciembreYaCargado}
        etiqueta="Temporada alta"
        titulo="Precios de diciembre"
        descripcion="Lo que cobrás solo en diciembre. Si lo dejás vacío, ese mes se cobra igual que el resto del año."
        resumen={tieneDiciembre ? "Con precios propios" : "Igual todo el año"}
      >
        {modalidadPrecio === "rango_personas" && (
          <>
            <p className="text-[12.5px] text-aventurea-ink-soft">
              Los mismos rangos de arriba, pero con los precios de
              diciembre. Un número de invitados que no caiga en ninguno se
              cobra con los rangos de todo el año.
            </p>

            <EditorRangos
              rangos={tiersDiciembre}
              setRangos={setTiersDiciembre}
              vacio="Sin rangos de diciembre: ese mes se cobra con los precios de todo el año."
              nota="Podés copiar los mismos tramos de arriba y subirles el precio."
            />

            <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                Tarifa por persona de diciembre (₡)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={tarifaDiciembre}
                  onChange={(e) => setTarifaDiciembre(Number(e.target.value))}
                  className="w-32 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                />
                <span className="text-[12.5px] text-aventurea-ink-soft">
                  colones por persona
                </span>
              </div>
              <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
                La forma vieja de cobrar diciembre; sigue funcionando. Si
                cargaste rangos de diciembre, mandan los rangos. Dejala en
                0 si no la usás.
              </p>
            </div>
          </>
        )}

        {modalidadPrecio === "hora" && (
          <>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio por hora en diciembre (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioHoraDiciembre}
              onChange={(e) => setPrecioHoraDiciembre(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Dejalo en 0 si en diciembre cobrás la misma hora que el resto
              del año.
            </p>
          </>
        )}

        {modalidadPrecio === "fijo" && (
          <>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio fijo del evento en diciembre (₡)
            </label>
            <input
              type="number"
              min={0}
              value={precioFijoDiciembre}
              onChange={(e) => setPrecioFijoDiciembre(Number(e.target.value))}
              className="w-40 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <p className="mt-2 text-[11.5px] text-aventurea-ink-soft">
              Dejalo en 0 si en diciembre cobrás lo mismo que el resto del
              año.
            </p>
          </>
        )}

        {modalidadPrecio === "por_persona" && (
          <>
            <p className="text-[12.5px] text-aventurea-ink-soft">
              En esta modalidad diciembre tiene su propia lista y estos
              campos son obligatorios: el precio fijo de los grupos chicos
              cambia según el día del evento, y la tarifa por persona baja
              conforme crece el grupo.
            </p>

            <p className="mt-4 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Precio fijo hasta {ultimoEscalon ?? "N"} invitados, según el día
            </p>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Lunes a jueves (₡)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="125000"
                  value={ppDicLunJue}
                  onChange={(e) => setPpDicLunJue(e.target.value)}
                  className="w-36 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Viernes (₡)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="145000"
                  value={ppDicViernes}
                  onChange={(e) => setPpDicViernes(e.target.value)}
                  className="w-36 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Sábado y domingo (₡)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="165000"
                  value={ppDicSabDom}
                  onChange={(e) => setPpDicSabDom(e.target.value)}
                  className="w-36 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink"
                />
              </div>
            </div>

            <div className="mt-4.5 border-t border-dashed border-aventurea-line pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                Anclas de la tarifa por persona
              </p>
              <p className="mt-1 text-[12px] text-aventurea-ink-soft">
                Cada ancla dice &quot;a tantos invitados, tanta tarifa&quot;.
                Entre anclas la tarifa baja en línea recta; después de la
                última queda plana.
              </p>

              <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] max-w-md border-collapse">
                <thead>
                  <tr>
                    {["Invitados", "Tarifa por persona (₡)", ""].map((h) => (
                      <th
                        key={h}
                        className="pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ppTramos.map((t) => (
                    <tr key={t.key}>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="30"
                          value={t.invitados}
                          onChange={(e) =>
                            actualizarTramo(t.key, "invitados", e.target.value)
                          }
                          className={CLASE_INPUT}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={0}
                          placeholder="5500"
                          value={t.tarifa}
                          onChange={(e) =>
                            actualizarTramo(t.key, "tarifa", e.target.value)
                          }
                          className={CLASE_INPUT}
                        />
                      </td>
                      <td className="py-1.5">
                        <button
                          type="button"
                          disabled={ppTramos.length === 1}
                          onClick={() =>
                            setPpTramos((prev) =>
                              prev.length > 1
                                ? prev.filter((x) => x.key !== t.key)
                                : prev,
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-aventurea-line disabled:hover:text-aventurea-ink-soft"
                          title={
                            ppTramos.length === 1
                              ? "Tiene que quedar al menos un ancla"
                              : "Eliminar"
                          }
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPpTramos((prev) => [
                    ...prev,
                    { key: newKey(), invitados: "", tarifa: "" },
                  ])
                }
                className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
              >
                ＋ Agregar ancla
              </button>
              <p className="mt-2 text-[11px] text-aventurea-ink-soft">
                Ejemplo: 30 → ₡5.500, 50 → ₡4.500, 100 → ₡4.000. El
                cliente nunca ve estas tarifas — solo el total ya
                multiplicado.
              </p>
            </div>
          </>
        )}
      </SeccionPlegable>

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          Servicios adicionales
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Checklist de extras para el cliente
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          El campo &quot;requisito&quot; es opcional: si lo llenás, el
          servicio solo aparece cuando los invitados no superan ese número.
        </p>

        {/* Envuelta en scroll horizontal: la tabla pide ~530px y en un
            teléfono hay ~306px — sin esto desbordaba la PÁGINA entera. */}
        <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              {["Servicio", "Precio (₡)", "Máx. invitados", "Activo", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.key}>
                <td className="min-w-[200px] py-1.5 pr-2">
                  <input
                    type="text"
                    value={s.nombre}
                    placeholder="Nombre del servicio"
                    onChange={(e) =>
                      updateServicio(s.key, "nombre", e.target.value)
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="w-28 py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={s.precio}
                    onChange={(e) =>
                      updateServicio(s.key, "precio", Number(e.target.value))
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="w-32 py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Sin límite"
                    value={s.requisito_max_invitados ?? ""}
                    onChange={(e) =>
                      updateServicio(
                        s.key,
                        "requisito_max_invitados",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className={CLASE_INPUT}
                  />
                </td>
                <td className="py-1.5 pr-2 text-center">
                  <input
                    type="checkbox"
                    checked={s.activo}
                    onChange={(e) =>
                      updateServicio(s.key, "activo", e.target.checked)
                    }
                    className="h-[18px] w-[18px] accent-aventurea-sky"
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setServicios((prev) =>
                        prev.filter((x) => x.key !== s.key),
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-400 hover:text-red-700"
                    title="Eliminar"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <button
          type="button"
          onClick={() =>
            setServicios((prev) => [
              ...prev,
              {
                key: newKey(),
                nombre: "",
                precio: 0,
                requisito_max_invitados: null,
                activo: true,
              },
            ])
          }
          className="mt-3.5 rounded-lg border-[1.5px] border-aventurea-line bg-aventurea-cream-2 px-3.5 py-2 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
        >
          ＋ Agregar servicio
        </button>
      </section>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="rounded-xl bg-aventurea-sky px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        {message && (
          <span
            className={`text-[12.5px] font-bold ${
              message.type === "ok" ? "text-aventurea-green" : "text-red-700"
            }`}
          >
            {message.type === "ok" ? "✓ " : ""}
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
