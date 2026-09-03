import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { tienePasesDeFidelidad } from "@/lib/lealtad-app";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import AgendaCompacta from "@/components/agenda-compacta";
import PanelNav, { ALTO_PANEL_NAV } from "@/components/panel-nav";
import ReservaAuditoria from "@/components/reserva-auditoria";
import { Boton, ChipCategoria, Micro, Vacio } from "@/components/ui";
import { pedirCorreoDeAprobacion } from "@/lib/notificaciones";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Sombras, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";
import { fechaISOLocal } from "@/lib/citas";
import { saldoPendiente, totalEvento } from "@/lib/finanzas";
import { esCitas as esVerticalCitas, esLugarPorDia } from "@/lib/agenda-negocio";
import {
  avisosDe,
  diasDeAgenda,
  fechaDelEvento,
  historico,
  horarioDelEvento,
  montosDe,
  selloDeTiempo,
  type ReservaPanel,
} from "@/lib/panel-reservas";

/**
 * El INICIO del panel del dueño, en el orden en que se usa un teléfono:
 *
 *   1. Lo que pide una respuesta — las reservas nuevas por aceptar y
 *      los avisos de plata (adelantos sin validar, saldos vencidos).
 *   2. La agenda — qué hay hoy y qué se viene.
 *   3. El histórico con auditoría — las últimas reservas realizadas:
 *      quién, con qué correo, a qué hora la hizo, cuánto depositó y
 *      cuánto queda pendiente. Cada una se abre para ver el resto.
 *
 * Antes esta pantalla era una lista de TODAS las reservas con siete
 * atajos encima; en un celular eso eran tres rieles apilados y el
 * dueño se perdía. Ahora los destinos del panel son cuatro y viven en
 * la barra de abajo (PanelNav), y la pantalla cuenta una historia
 * ordenada de arriba hacia abajo.
 *
 * Mismas políticas RLS que /mi-negocio: el dueño solo ve y edita lo
 * suyo. Las acciones son las del panel web — confirmar (una sola por
 * fecha; la base lo garantiza), rechazar, validar el adelanto y abrir
 * el comprobante.
 */

/** Cuántos días muestra la tira de la agenda. */
const DIAS_AGENDA = 14;
/** Cuántas reservas del histórico se ven antes de "Ver más". */
const HISTORICO_VISIBLE = 8;
/** El techo del histórico: más que esto se consulta en la web. */
const HISTORICO_MAX = 40;
/** Cuántas por aceptar se muestran sin desplegar. */
const POR_ACEPTAR_VISIBLE = 3;

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "por_cobrar", label: "Con saldo" },
  { id: "canceladas", label: "Canceladas" },
] as const;

type Filtro = (typeof FILTROS)[number]["id"];

/** Las tres cards del resumen de pagos, arriba del histórico. */
const CARDS_PAGO = [
  { id: "pagadas", icono: "checkmark-circle" as const, color: Colors.green, fondo: Colors.greenLight, titulo: "Reservas pagadas" },
  { id: "pendientes", icono: "time-outline" as const, color: Colors.sky, fondo: Colors.skyLight, titulo: "Reservas pendientes" },
  { id: "canceladas", icono: "close-circle-outline" as const, color: Colors.inkMuted, fondo: Colors.cream2, titulo: "Canceladas" },
] as const;

type CategoriaPago = (typeof CARDS_PAGO)[number]["id"];

export default function PanelNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  /** La vertical decide cómo se llama el catálogo (servicios en Citas). */
  const [vertical, setVertical] = useState<string | null>(null);
  const [reservas, setReservas] = useState<ReservaPanel[] | null>(null);

  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [diaAgenda, setDiaAgenda] = useState(() => fechaISOLocal(new Date()));
  const [verTodasPendientes, setVerTodasPendientes] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [verTodoHistorico, setVerTodoHistorico] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState<string | null>(null);
  const [categoriaModal, setCategoriaModal] = useState<CategoriaPago | null>(null);
  const [fichaModalAbierta, setFichaModalAbierta] = useState<string | null>(null);
  const listaRef = useRef<FlatList<ReservaPanel>>(null);

  /**
   * ¿Este negocio tiene pases de fidelidad?
   *
   * Decide si se dibuja el acceso de arriba. Empieza en `false` y solo
   * pasa a `true` si la consulta lo confirma: mostrar el botón mientras
   * se averigua haría que parpadeara en el panel de todos los negocios
   * que NO tienen el programa.
   */
  const [tieneLealtad, setTieneLealtad] = useState(false);
  useEffect(() => {
    let vigente = true;
    void tienePasesDeFidelidad(id).then((tiene) => {
      if (vigente) setTieneLealtad(tiene);
    });
    return () => {
      vigente = false;
    };
  }, [id]);

  const cargar = useCallback(async () => {
    if (!session) return;
    const [{ data: rancho }, { data: filas }] = await Promise.all([
      supabase.from("ranchos").select("nombre, categoria, vertical").eq("id", id).maybeSingle(),
      // select("*") a propósito: la auditoría usa casi todas las
      // columnas, y así una migración nueva (por ejemplo
      // adelanto_devuelto) no rompe la consulta por nombrar una
      // columna que todavía no existe en la base.
      supabase
        .from("reservas")
        .select("*")
        .eq("rancho_id", id)
        .neq("estado", "temporal")
        .order("created_at", { ascending: false }),
    ]);
    setNombreNegocio(rancho?.nombre ?? null);
    setCategoria((rancho?.categoria as string) ?? null);
    setVertical((rancho?.vertical as string) ?? null);
    setReservas((filas ?? []) as ReservaPanel[]);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  /**
   * Aprobar o rechazar una reserva que espera respuesta.
   *
   * Gemelo de `confirmarReserva` / `cancelarReserva` de la web
   * (src/app/mi-negocio/[id]/agenda-actions.ts): mismos DOS filtros y
   * la misma marca de tiempo al cancelar.
   *
   * - `.eq("rancho_id")` va SOBRE la RLS, no en su lugar: el id sale
   *   de la pantalla, así que la pertenencia se exige también en la
   *   ESCRITURA y no queda solo en manos de la política.
   * - El filtro por estado PREVIO evita que un doble toque reviva una
   *   reserva ya rechazada.
   */
  async function cambiarEstado(reserva: ReservaPanel, estado: "confirmada" | "rechazada") {
    setOcupado(reserva.id);
    const cambio = supabase
      .from("reservas")
      .update(
        estado === "confirmada"
          ? { estado }
          : // Cancelar deja constancia de CUÁNDO: sin `cancelada_en`
            // no hay forma de saber en qué semana se cayó la reserva.
            { estado, cancelada_en: new Date().toISOString() },
      )
      .eq("id", reserva.id)
      .eq("rancho_id", id);
    const { data, error } =
      estado === "confirmada"
        ? await cambio.eq("estado", "pendiente").select("id")
        : // Solo lo que todavía ocupa el día.
          await cambio.in("estado", ["pendiente", "confirmada", "bloqueada"]).select("id");
    setOcupado(null);

    if (error) {
      Alert.alert(
        "No se pudo",
        estado === "confirmada"
          ? "Ya hay otra reserva confirmada para esa misma fecha."
          : error.message,
      );
      return;
    }
    // Cero filas tocadas: el estado previo ya no era el que esta
    // pantalla creía (otro dispositivo la movió, o fue un doble
    // toque). Se recarga en vez de pintar un estado que la base no
    // tiene.
    if ((data ?? []).length === 0) {
      Alert.alert("No se pudo", "Esa reserva ya había cambiado de estado.");
      await cargar();
      return;
    }
    setReservas((prev) => (prev ?? []).map((r) => (r.id === reserva.id ? { ...r, estado } : r)));

    // El correo lo manda la web (Resend vive en el servidor). Sin await
    // que bloquee: la aprobación ya quedó guardada, así que si esto
    // falla el proveedor igual ve la reserva confirmada.
    if (estado === "confirmada") {
      void pedirCorreoDeAprobacion(reserva.id);
    }
  }

  function confirmarRechazo(reserva: ReservaPanel) {
    Alert.alert("Rechazar reserva", "¿Seguro? El cliente verá su reserva como rechazada.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rechazar",
        style: "destructive",
        onPress: () => cambiarEstado(reserva, "rechazada"),
      },
    ]);
  }

  function quitarConfirmacion(reserva: ReservaPanel) {
    Alert.alert("Quitar confirmación", "La reserva vuelve a quedar por aceptar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        onPress: async () => {
          setOcupado(reserva.id);
          // Los mismos dos filtros que `cambiarEstado`: pertenencia en
          // la escritura, y solo desde 'confirmada' — así un toque
          // repetido no devuelve a "por aceptar" algo ya rechazado.
          const { error } = await supabase
            .from("reservas")
            .update({ estado: "pendiente" })
            .eq("id", reserva.id)
            .eq("rancho_id", id)
            .eq("estado", "confirmada");
          setOcupado(null);
          if (!error) {
            setReservas((prev) =>
              (prev ?? []).map((r) => (r.id === reserva.id ? { ...r, estado: "pendiente" } : r)),
            );
          }
        },
      },
    ]);
  }

  /**
   * Dar el adelanto por recibido. Se guarda también CUÁNDO se validó
   * (deposito_pagado_en): sin esa fecha, Finanzas no sabe en qué
   * semana entró la plata — es el mismo campo que usa la web.
   */
  async function alternarAdelanto(reserva: ReservaPanel) {
    const recibido = !reserva.deposito_validado;
    const pagadoEn = recibido ? new Date().toISOString() : null;
    setReservas((prev) =>
      (prev ?? []).map((r) =>
        r.id === reserva.id
          ? { ...r, deposito_validado: recibido, deposito_pagado_en: pagadoEn }
          : r,
      ),
    );
    const { error } = await supabase
      .from("reservas")
      .update({ deposito_validado: recibido, deposito_pagado_en: pagadoEn })
      .eq("id", reserva.id)
      .eq("rancho_id", id);
    if (error) {
      // Revertir: la base mandó, no la pantalla.
      setReservas((prev) =>
        (prev ?? []).map((r) =>
          r.id === reserva.id
            ? {
                ...r,
                deposito_validado: reserva.deposito_validado,
                deposito_pagado_en: reserva.deposito_pagado_en,
              }
            : r,
        ),
      );
      Alert.alert("No se pudo guardar", error.message);
    }
  }

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      Alert.alert("No se pudo abrir", "El comprobante no está disponible.");
      return;
    }
    WebBrowser.openBrowserAsync(data.signedUrl);
  }

  /**
   * Cierra el cobro del evento (el RESTO, no el adelanto) — portado tal
   * cual de finanzas.tsx (pestaña "Cobros"): se pregunta el monto final
   * porque casi nunca es el cotizado (más invitados, se pasaron de
   * hora). Android no tiene `Alert.prompt`: ahí se cobra por el monto
   * cotizado y el ajuste fino queda para la web.
   */
  function cobrarEvento(reserva: ReservaPanel) {
    Alert.prompt?.(
      "¿Cuánto cobraste?",
      `Cotizado: ${fmtColones(totalEvento(reserva))}. Dejalo vacío si cobraste eso mismo.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Registrar cobro", onPress: (valor?: string) => void registrarCobro(reserva, valor) },
      ],
      "plain-text",
      "",
      "numeric",
    );
    if (!Alert.prompt) {
      Alert.alert(
        "Registrar el cobro",
        `Se va a registrar ${fmtColones(totalEvento(reserva))} como cobrado. Si el monto final fue otro, corregilo desde bookea.lat.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Registrar", onPress: () => void registrarCobro(reserva, undefined) },
        ],
      );
    }
  }

  async function registrarCobro(reserva: ReservaPanel, valor?: string) {
    const limpio = (valor ?? "").replace(/[^\d]/g, "");
    const montoFinal = limpio ? Number(limpio) : null;
    if (montoFinal !== null && (!Number.isFinite(montoFinal) || montoFinal < 0)) {
      Alert.alert("Monto inválido", "El monto cobrado no puede ser negativo.");
      return;
    }
    setOcupado(reserva.id);
    const update: Record<string, unknown> = {
      evento_pagado: true,
      saldo_pagado_en: new Date().toISOString(),
    };
    if (montoFinal !== null) update.monto_cobrado_final = montoFinal;
    const { error } = await supabase
      .from("reservas")
      .update(update)
      .eq("id", reserva.id)
      .eq("rancho_id", id);
    setOcupado(null);
    if (error) {
      Alert.alert("No se pudo guardar", error.message);
      return;
    }
    await cargar();
  }

  const todas = useMemo(() => reservas ?? [], [reservas]);
  const avisos = useMemo(() => avisosDe(todas), [todas]);
  const dias = useMemo(() => diasDeAgenda(todas, DIAS_AGENDA), [todas]);

  const historial = useMemo(() => {
    const lista = historico(todas, HISTORICO_MAX);
    if (filtro === "por_cobrar") {
      return lista.filter(
        (r) =>
          (r.estado === "confirmada" || r.estado === "pendiente" || r.estado === "cumplida") &&
          saldoPendiente(r) > 0,
      );
    }
    if (filtro === "canceladas") {
      return lista.filter(
        (r) => r.estado === "rechazada" || r.estado === "cancelada" || r.estado === "no_asistio",
      );
    }
    return lista;
  }, [todas, filtro]);

  // Las tres cards de arriba del histórico: cuentan sobre TODAS las
  // reservas del negocio, no solo sobre las 40 del histórico visible
  // (`historial`) — así el número no queda corto por el techo.
  const listasPorCategoria = useMemo<Record<CategoriaPago, ReservaPanel[]>>(
    () => ({
      pagadas: todas.filter((r) => r.evento_pagado === true),
      pendientes: todas.filter(
        (r) =>
          (r.estado === "confirmada" || r.estado === "pendiente" || r.estado === "cumplida") &&
          saldoPendiente(r) > 0,
      ),
      canceladas: todas.filter(
        (r) => r.estado === "rechazada" || r.estado === "cancelada" || r.estado === "no_asistio",
      ),
    }),
    [todas],
  );
  const listaModal = categoriaModal ? listasPorCategoria[categoriaModal] : [];

  /**
   * Tocar algo de la agenda abre SU ficha en el histórico y desplaza
   * la pantalla hasta ella: es la misma reserva, no hace falta otra
   * pantalla para verla en detalle.
   */
  function abrirFicha(reserva: ReservaPanel) {
    setFiltro("todas");
    setVerTodoHistorico(true);
    setFichaAbierta(reserva.id);
    const indice = historico(todas, HISTORICO_MAX).findIndex((r) => r.id === reserva.id);
    if (indice < 0) return;
    // Con un respiro para que la lista ya esté re-dibujada con el
    // filtro en "todas" y todas las filas visibles.
    setTimeout(() => {
      listaRef.current?.scrollToIndex({ index: indice, viewPosition: 0.1, animated: true });
    }, 80);
  }

  const historialVisible = verTodoHistorico ? historial : historial.slice(0, HISTORICO_VISIBLE);
  const restantes = historial.length - historialVisible.length;

  const pendientes = avisos.porAceptar;
  const pendientesVisibles = verTodasPendientes
    ? pendientes
    : pendientes.slice(0, POR_ACEPTAR_VISIBLE);

  // Un Lugar no tiene catálogo propio (sus extras van en Precios);
  // todo el resto sí — Citas lo llama "Servicios" y Eventos "Catálogo".
  // Mientras la fila no cargó, `categoria` es null y no se muestra.
  const mostrarCatalogo =
    esVerticalCitas({ vertical, categoria }) ||
    (categoria !== null && !esLugarPorDia({ categoria }));

  if (reservas === null) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior kicker="Panel" titulo="Inicio" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.navy} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Panel"
        titulo={nombreNegocio ?? "Tu negocio"}
        subtitulo="Avisos, agenda e histórico"
      />

      <FlatList
        ref={listaRef}
        style={{ flex: 1 }}
        // Las tarjetas del histórico no miden todas igual (una abierta
        // es mucho más alta), así que un salto puede fallar: se
        // reintenta cuando la lista ya midió las filas de en medio.
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listaRef.current?.scrollToIndex({ index, viewPosition: 0.1, animated: true });
          }, 250);
        }}
        contentContainerStyle={{
          gap: Spacing.two,
          padding: Spacing.three,
          paddingBottom: ALTO_PANEL_NAV + Spacing.four,
        }}
        data={historialVisible}
        keyExtractor={(r) => r.id}
        onRefresh={refrescar}
        refreshing={refrescando}
        ListHeaderComponent={
          <View style={styles.cabecera}>
            {/* ---------------- 0. Pases de fidelidad ----------------
                Solo si este negocio TIENE un programa. Un botón que
                lleva a una pantalla vacía es peor que no tenerlo, y
                `tienePasesDeFidelidad` devuelve false ante la duda.

                Va arriba de todo porque es lo que se usa con un cliente
                enfrente: buscarlo debajo de las reservas del mes es
                buscarlo con alguien esperando en la caja. */}
            {tieneLealtad && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir los pases de fidelidad de este negocio"
                onPress={() => router.push(`/negocio/${id}/lealtad`)}
                style={({ pressed }) => [styles.lealtadAcceso, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.lealtadIcono}>
                  <Ionicons name="qr-code-outline" size={20} color={Colors.surface} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lealtadTitulo}>Pases de fidelidad</Text>
                  <Text style={styles.lealtadTexto}>
                    Escaneá la tarjeta de tu cliente y dale su sello.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.inkMuted} />
              </Pressable>
            )}

            {/* ---------------- 1. Lo que pide respuesta ---------------- */}
            <View style={{ gap: Spacing.two + 2 }}>
              <View style={styles.filaMicro}>
                <Micro>Por aceptar</Micro>
                {pendientes.length > 0 && (
                  <View style={styles.contador}>
                    <Text style={styles.contadorTexto}>{pendientes.length}</Text>
                  </View>
                )}
              </View>

              {pendientes.length === 0 ? (
                <View style={styles.alDia}>
                  <Ionicons name="checkmark-circle" size={17} color={Colors.green} />
                  <Text style={styles.alDiaTexto}>
                    Todo al día — ninguna reserva espera tu respuesta.
                  </Text>
                </View>
              ) : (
                pendientesVisibles.map((r) => (
                  <TarjetaPorAceptar
                    key={r.id}
                    reserva={r}
                    ocupada={ocupado === r.id}
                    onAprobar={() => cambiarEstado(r, "confirmada")}
                    onRechazar={() => confirmarRechazo(r)}
                    onVerComprobante={verComprobante}
                  />
                ))
              )}

              {pendientes.length > POR_ACEPTAR_VISIBLE && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVerTodasPendientes((v) => !v)}
                  style={({ pressed }) => [styles.verMas, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.verMasTexto}>
                    {verTodasPendientes
                      ? "Ver menos"
                      : `Ver las ${pendientes.length - POR_ACEPTAR_VISIBLE} restantes`}
                  </Text>
                </Pressable>
              )}

              {/* Los avisos de plata: no piden un sí o un no, pero sí
                  que alguien los mire antes de que se enfríen. */}
              {avisos.adelantosPorValidar.conteo > 0 && (
                <FilaAviso
                  icono="wallet-outline"
                  titulo={`${avisos.adelantosPorValidar.conteo} ${
                    avisos.adelantosPorValidar.conteo === 1 ? "adelanto" : "adelantos"
                  } por validar`}
                  detalle={`${fmtColones(avisos.adelantosPorValidar.monto)} que ya te transfirieron`}
                  onPress={() => router.push(`/negocio/${id}/finanzas` as never)}
                />
              )}
              {avisos.saldosVencidos.conteo > 0 && (
                <FilaAviso
                  icono="alert-circle-outline"
                  tono="alerta"
                  titulo={`${avisos.saldosVencidos.conteo} ${
                    avisos.saldosVencidos.conteo === 1 ? "saldo vencido" : "saldos vencidos"
                  }`}
                  detalle={`${fmtColones(avisos.saldosVencidos.monto)} de eventos que ya pasaron`}
                  onPress={() => router.push(`/negocio/${id}/finanzas` as never)}
                />
              )}
            </View>

            {/* ---------------- 2. La agenda ---------------- */}
            <AgendaCompacta
              dias={dias}
              seleccionado={diaAgenda}
              onElegirDia={setDiaAgenda}
              onVerCompleta={() => router.push(`/negocio/${id}/agenda` as never)}
              onTocarReserva={abrirFicha}
            />

            {/* ---------------- 3. El histórico ---------------- */}
            <View style={{ gap: Spacing.two }}>
              <Micro>Últimas reservas</Micro>
              <Text style={styles.explicacion}>
                Cada una con cuándo se hizo, quién la hizo, cuánto depositó y cuánto queda
                pendiente. Tocá una para ver el detalle completo.
              </Text>

              {/* Las tres cards de pago: un vistazo rápido que abre la
                  auditoría de esa categoría en una ventana aparte, sin
                  perder el lugar en el histórico de abajo. */}
              <View style={styles.cardsPago}>
                {CARDS_PAGO.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    onPress={() => setCategoriaModal(c.id)}
                    style={[styles.cardPago, { backgroundColor: c.fondo }]}
                  >
                    <Ionicons name={c.icono} size={17} color={c.color} />
                    <Text style={[styles.cardPagoNumero, { color: c.color }]}>
                      {listasPorCategoria[c.id].length}
                    </Text>
                    <Text style={styles.cardPagoEtiqueta} numberOfLines={1}>
                      {c.titulo}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.filtros}>
                {FILTROS.map((f) => (
                  <ChipCategoria
                    key={f.id}
                    texto={f.label}
                    activo={filtro === f.id}
                    onPress={() => {
                      setFiltro(f.id);
                      setVerTodoHistorico(false);
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Vacio
            icono="receipt-outline"
            titulo={filtro === "todas" ? "Todavía no hay reservas" : "Nada con ese filtro"}
            texto={
              filtro === "todas"
                ? "Cuando alguien reserve, aparece acá con todo el detalle de lo que pagó."
                : "Probá con otro filtro para ver el resto del histórico."
            }
          />
        }
        renderItem={({ item }) => (
          <ReservaAuditoria
            reserva={item}
            abierta={fichaAbierta === item.id}
            ocupada={ocupado === item.id}
            onAlternar={() => setFichaAbierta((abierta) => (abierta === item.id ? null : item.id))}
            onValidarAdelanto={alternarAdelanto}
            onVerComprobante={verComprobante}
            onQuitarConfirmacion={quitarConfirmacion}
            onRegistrarCobro={cobrarEvento}
          />
        )}
        ListFooterComponent={
          restantes > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setVerTodoHistorico(true)}
              style={({ pressed }) => [styles.verMas, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.verMasTexto}>Ver las {restantes} restantes</Text>
            </Pressable>
          ) : null
        }
      />

      <PanelNav
        negocioId={id}
        activa="inicio"
        mostrarCatalogo={mostrarCatalogo}
        etiquetaCatalogo={esVerticalCitas({ vertical, categoria }) ? "Servicios" : "Catálogo"}
      />

      {/* La ventana de auditoría de una categoría de pago: se abre al
          tocar una de las tres cards, con la misma ficha expandible
          que el histórico de abajo, así que las acciones (adelanto
          recibido, resto pagado) son las mismas en los dos lugares. */}
      <Modal
        visible={categoriaModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoriaModal(null)}
      >
        <Pressable style={styles.hojaFondo} onPress={() => setCategoriaModal(null)}>
          <Pressable style={styles.hoja} onPress={(e) => e.stopPropagation()}>
            <View style={styles.hojaEncabezado}>
              <Text style={styles.hojaTitulo}>
                {categoriaModal ? CARDS_PAGO.find((c) => c.id === categoriaModal)?.titulo : ""}
              </Text>
              <Pressable onPress={() => setCategoriaModal(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={Colors.ink} />
              </Pressable>
            </View>
            <FlatList
              data={listaModal}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ gap: Spacing.two, paddingBottom: Spacing.four }}
              ListEmptyComponent={
                <Text style={styles.modalVacio}>No hay reservas en esta categoría.</Text>
              }
              renderItem={({ item }) => (
                <ReservaAuditoria
                  reserva={item}
                  abierta={fichaModalAbierta === item.id}
                  ocupada={ocupado === item.id}
                  onAlternar={() =>
                    setFichaModalAbierta((abierta) => (abierta === item.id ? null : item.id))
                  }
                  onValidarAdelanto={alternarAdelanto}
                  onVerComprobante={verComprobante}
                  onQuitarConfirmacion={quitarConfirmacion}
                  onRegistrarCobro={cobrarEvento}
                />
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * Una reserva esperando el sí o el no: lo mínimo para decidir sin
 * abrir nada (quién, cuándo la hizo, qué día es el evento, cuánto
 * depositó) y los dos botones. Es la única tarjeta contorneada de la
 * pantalla — es la única que le pide algo al dueño.
 */
function TarjetaPorAceptar({
  reserva,
  ocupada,
  onAprobar,
  onRechazar,
  onVerComprobante,
}: {
  reserva: ReservaPanel;
  ocupada: boolean;
  onAprobar: () => void;
  onRechazar: () => void;
  onVerComprobante: (path: string) => void;
}) {
  const { adelanto, total } = montosDe(reserva);
  const horario = horarioDelEvento(reserva);
  const hecha = selloDeTiempo(reserva.created_at);
  const deposito = Number(reserva.deposito_monto ?? 0);

  return (
    <View style={styles.pendiente}>
      <Text style={styles.pendienteCliente} numberOfLines={1}>
        {reserva.nombre ?? "Sin nombre"}
      </Text>
      <Text style={styles.pendienteEvento} numberOfLines={1}>
        {fechaDelEvento(reserva)}
        {horario ? ` · ${horario}` : ""}
        {reserva.tipo_evento ? ` · ${reserva.tipo_evento}` : ""}
      </Text>
      {hecha ? <Text style={styles.pendienteMeta}>Reservó el {hecha}</Text> : null}
      {reserva.correo ? (
        <Text style={styles.pendienteMeta} numberOfLines={1}>
          {reserva.correo}
        </Text>
      ) : null}
      <Text style={styles.pendienteMonto}>
        {total > 0 ? `Total ${fmtColones(total)}` : "Monto a coordinar"}
        {deposito > 0
          ? ` · Adelanto ${fmtColones(deposito)}${adelanto > 0 ? " (validado)" : " sin validar"}`
          : ""}
      </Text>

      {reserva.deposito_comprobante_url && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onVerComprobante(reserva.deposito_comprobante_url!)}
          style={({ pressed }) => [styles.comprobante, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="document-attach-outline" size={15} color={Colors.navy} />
          <Text style={styles.comprobanteTexto}>Ver comprobante</Text>
        </Pressable>
      )}

      <View style={styles.pendienteAcciones}>
        <Boton
          compacto
          tono="verde"
          icono="checkmark"
          texto="Aprobar"
          deshabilitado={ocupada}
          onPress={onAprobar}
          style={{ flex: 1 }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={ocupada}
          onPress={onRechazar}
          style={({ pressed }) => [styles.rechazar, (pressed || ocupada) && { opacity: 0.6 }]}
        >
          <Text style={styles.rechazarTexto}>Rechazar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Un aviso de plata: ícono, qué pasa y a dónde ir a resolverlo. */
function FilaAviso({
  icono,
  titulo,
  detalle,
  tono = "info",
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string | null;
  tono?: "info" | "alerta";
  onPress: () => void;
}) {
  const color = tono === "alerta" ? Colors.danger : Colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.aviso,
        tono === "alerta" && { backgroundColor: Colors.dangerLight },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icono} size={17} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.avisoTitulo, { color }]} numberOfLines={1}>
          {titulo}
        </Text>
        {detalle ? (
          <Text style={styles.avisoDetalle} numberOfLines={1}>
            {detalle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lealtadAcceso: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    // `elevada` y no `tarjeta`: es la puerta a un producto entero, que
    // se despegue un poco más del lienzo que las cards de todos los días.
    ...Sombras.elevada,
  },
  lealtadIcono: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.md,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  lealtadTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
  },
  lealtadTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 15.5,
  },
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  cabecera: { gap: Spacing.four, marginBottom: Spacing.two },

  filaMicro: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  contador: {
    backgroundColor: Colors.sky,
    borderRadius: Radios.full,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  contadorTexto: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    textAlign: "center",
  },

  alDia: {
    alignItems: "center",
    backgroundColor: Colors.greenLight,
    borderRadius: Radios.md,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  alDiaTexto: { color: Colors.green, flex: 1, fontFamily: Fonts.semiBold, fontSize: 12.5 },

  pendiente: {
    backgroundColor: Colors.surface,
    borderColor: Colors.sky,
    borderRadius: Radios.lg,
    borderWidth: 1.5,
    gap: 2,
    padding: Spacing.three,
  },
  pendienteCliente: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  pendienteEvento: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5, marginTop: 1 },
  pendienteMeta: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12 },
  pendienteMonto: {
    color: Colors.ink,
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    marginTop: 4,
  },
  comprobante: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    marginTop: 6,
  },
  comprobanteTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12 },
  pendienteAcciones: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two + 2 },
  rechazar: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  rechazarTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 13.5 },

  aviso: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.md,
    flexDirection: "row",
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  avisoTitulo: { fontFamily: Fonts.extraBold, fontSize: 12.5 },
  avisoDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },

  explicacion: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17 },

  cardsPago: { flexDirection: "row", gap: Spacing.two },
  cardPago: { borderRadius: Radios.md, flex: 1, gap: 2, padding: Spacing.two + 2 },
  cardPagoNumero: { fontFamily: Fonts.extraBold, fontSize: 19, marginTop: 4 },
  cardPagoEtiqueta: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 10.5 },

  filtros: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },

  verMas: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    paddingVertical: 11,
  },
  verMasTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },

  hojaFondo: { backgroundColor: "rgba(10,16,32,0.45)", flex: 1, justifyContent: "flex-end" },
  hoja: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radios.xl,
    borderTopRightRadius: Radios.xl,
    maxHeight: "88%",
    padding: Spacing.three,
  },
  hojaEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: Spacing.three,
  },
  hojaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17 },
  modalVacio: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    paddingVertical: Spacing.five,
    textAlign: "center",
  },
});
