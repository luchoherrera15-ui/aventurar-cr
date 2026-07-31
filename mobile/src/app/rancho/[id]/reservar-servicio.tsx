import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode as decodeBase64 } from "base64-arraybuffer";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { abrirHiloConsulta } from "@/lib/consulta";
import { useAuth } from "@/lib/auth-context";
import { pedirCorreosDeReserva } from "@/lib/notificaciones";
import {
  agruparPorSeccion,
  cupoRestante,
  etiquetaDuracion,
  leerEleccionesIncluidas,
  paqueteBaseElegido,
  totalPedido,
} from "@/lib/catalogo";
import {
  cotizarServicio,
  duracionServicio,
  leerConfigCobro,
  totalCotizacion,
} from "@/lib/cotizador-servicio";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { CATALOGO_LABEL, fmtColones, type Rancho, type RanchoItem } from "@/lib/types";

const DOW = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Suma días a una fecha ISO sin pasar por zonas horarias. */
function sumarDiasISO(fechaIso: string, dias: number) {
  const [y, m, d] = fechaIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

type CupoDia = { eventos: number; porItem: Record<string, number> };

/**
 * Reserva nativa de servicios (photobooth, catering, barras...) — el
 * mismo flujo que /web: calendario con los días llenos bloqueados,
 * cotizador según cómo cobra el proveedor, carrito del catálogo con
 * inventario por fecha, depósito con comprobante y la reserva creada
 * por la función crear_reserva_servicio (los precios los relee la
 * base; el teléfono solo dice qué ítems y cuántos).
 *
 * Antes esta pantalla no existía: los servicios abrían la web en un
 * navegador embebido.
 */
export default function ReservarServicioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [rancho, setRancho] = useState<Rancho | null>(null);
  const [items, setItems] = useState<RanchoItem[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Record<string, CupoDia>>({});
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [mesOffset, setMesOffset] = useState(0);
  const [fecha, setFecha] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  const [invitados, setInvitados] = useState("");
  const [horas, setHoras] = useState(0);
  const [dias, setDias] = useState(0);
  const [horasExtra, setHorasExtra] = useState(0);
  const [hora, setHora] = useState("");
  // Elecciones incluidas en la tarifa ("elegí hasta N sin costo").
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({});
  // Secciones del catálogo abiertas — cerradas por defecto para que el
  // menú completo no haga la pantalla eterna. La selección vive en
  // `cantidades`/`elegidos` (arriba), así que sobrevive al colapsar.
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Set<string>>(
    () => new Set(),
  );

  const [tipoEvento, setTipoEvento] = useState("");
  const [notas, setNotas] = useState("");

  const [metodoPago, setMetodoPago] = useState<"sinpe" | "transferencia">("sinpe");
  const [comprobanteUri, setComprobanteUri] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [abriendoChat, setAbriendoChat] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);

    const hoy = new Date();
    const desde = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const hasta = iso(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate());

    const [ranchoRes, itemsRes, dispRes, dispItemsRes] = await Promise.all([
      supabase.from("ranchos").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", id)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("disponibilidad_rancho")
        .select("fecha, estado")
        .eq("rancho_id", id)
        .gte("fecha", desde)
        .lte("fecha", hasta),
      supabase
        .from("disponibilidad_items")
        .select("item_id, fecha, reservadas")
        .eq("rancho_id", id)
        .gte("fecha", desde)
        .lte("fecha", hasta),
    ]);

    if (!ranchoRes.data) {
      setErrorCarga("No encontramos esta publicación.");
      setCargando(false);
      return;
    }
    setRancho(ranchoRes.data as Rancho);
    setItems((itemsRes.data ?? []) as RanchoItem[]);

    const acc: Record<string, CupoDia> = {};
    const dia = (f: string) => (acc[f] ??= { eventos: 0, porItem: {} });
    for (const fila of dispRes.data ?? []) {
      dia(fila.fecha as string).eventos += 1;
    }
    for (const fila of dispItemsRes.data ?? []) {
      dia(fila.fecha as string).porItem[fila.item_id as string] =
        fila.reservadas as number;
    }
    setDisponibilidad(acc);
    setCargando(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  // ---------- Cotizador según cómo cobra el proveedor ----------
  const config = useMemo(
    () => leerConfigCobro(rancho?.detalles ?? null),
    [rancho?.detalles],
  );

  // El paquete del catálogo que SUSTITUYE la tarifa base (0067): su
  // precio entra por el pedido, no por la tarifa del jsonb.
  const pb = paqueteBaseElegido(items, cantidades);
  const paqueteBaseSel =
    pb &&
    (config.modalidad === "por_evento" || config.modalidad === "por_paquete")
      ? { nombre: pb.nombre, precio: pb.precio, duracionHoras: pb.duracion_horas }
      : null;

  const eleccionesPorGrupo = useMemo(
    () => leerEleccionesIncluidas(rancho?.detalles ?? null),
    [rancho?.detalles],
  );

  const pasoServicio =
    (config.modalidad === "por_persona" && !!config.tarifaPersona) ||
    (config.modalidad === "por_hora" && !!config.tarifaHora) ||
    ((config.modalidad === "por_evento" || config.modalidad === "por_paquete") &&
      (!!config.tarifaEvento || !!paqueteBaseSel)) ||
    (config.modalidad === "por_dia" && !!config.tarifaDia);

  const seleccion = {
    invitados: invitados ? parseInt(invitados, 10) : null,
    horas,
    dias,
    horasExtra,
    paqueteBase: paqueteBaseSel,
  };
  const lineasBase = cotizarServicio(config, seleccion);
  const totalBase = totalCotizacion(lineasBase);

  const resumenPedido = totalPedido(items, cantidades);
  const totalGeneral = totalBase + resumenPedido.total;

  // Alquiler multi-día: por día usa los días del cotizador; decoración
  // y otros lo ofrecen aparte (toldos, baños, sillas el finde entero).
  const esAlquiler =
    config.modalidad === "por_dia" ||
    ((rancho?.categoria === "decoracion" || rancho?.categoria === "otros") &&
      items.length > 0);
  const fechaFin =
    esAlquiler && fecha && dias > 1 && dias <= 60
      ? sumarDiasISO(fecha, dias - 1)
      : null;

  // Hora del evento (opcional, formato 24 h) y horas contratadas.
  const horaValida = /^([01]?\d|2[0-3]):[0-5]\d$/.test(hora.trim());
  const horaInicio = horaValida ? hora.trim() : null;
  const duracionHoras = duracionServicio(config, seleccion);

  // Mínimos del negocio: se avisan acá y la base los hace cumplir.
  const montoMinimo = Number(rancho?.monto_minimo) || 0;
  const minimoPedido = (() => {
    const n = Number(rancho?.detalles?.minimo_pedido);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  })();

  // ---------- Depósito ----------
  const tieneSinpe = !!rancho?.sinpe_numero;
  const tieneCuenta = !!rancho?.cuenta_numero;
  const deposito = rancho?.deposito_reserva ?? 0;
  const pagoActivo = deposito > 0 && (tieneSinpe || tieneCuenta);

  // ---------- Calendario ----------
  const hoy = useMemo(() => new Date(), []);
  const anticipacionDias = Number(rancho?.detalles?.anticipacion_dias) || 0;
  const minima = useMemo(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + Math.max(0, anticipacionDias));
    return iso(d.getFullYear(), d.getMonth(), d.getDate());
  }, [hoy, anticipacionDias]);

  const vista = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const anio = vista.getFullYear();
  const mes = vista.getMonth();
  const primerDow = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDow }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  function diaLleno(valor: string) {
    const cupo = rancho?.eventos_por_dia ?? null;
    if (cupo === null) return false;
    return (disponibilidad[valor]?.eventos ?? 0) >= cupo;
  }

  const reservadasDelDia = fecha ? (disponibilidad[fecha]?.porItem ?? {}) : {};

  function alternarSeccion(clave: string) {
    setSeccionesAbiertas((prev) => {
      const copia = new Set(prev);
      if (copia.has(clave)) copia.delete(clave);
      else copia.add(clave);
      return copia;
    });
  }

  function fijarCantidad(itemId: string, cantidad: number) {
    setCantidades((prev) => {
      const nueva = Math.max(0, Math.min(999, cantidad));
      const copia = { ...prev };
      if (nueva === 0) delete copia[itemId];
      else copia[itemId] = nueva;
      return copia;
    });
  }

  async function elegirComprobante() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setComprobanteUri(res.assets[0].uri);
  }

  async function chatearConProveedor() {
    if (abriendoChat) return;
    if (!session) {
      router.push("/cuenta");
      return;
    }
    setAbriendoChat(true);
    const convId = await abrirHiloConsulta(id, session.user.id);
    setAbriendoChat(false);
    if (convId) router.push(`/mensajes/hilo/${convId}` as never);
  }

  const listoParaEnviar =
    !!fecha && (!pagoActivo || !!comprobanteUri) && !enviando && !subiendo;

  async function enviarReserva() {
    if (!rancho || !fecha) return;
    if (!session) {
      router.push("/cuenta");
      return;
    }
    setEnviando(true);
    setErrorEnvio(null);

    try {
      // 1. El comprobante primero (si el proveedor cobra depósito).
      let comprobantePath: string | null = null;
      if (pagoActivo && comprobanteUri) {
        setSubiendo(true);
        const base64 = await FileSystem.readAsStringAsync(comprobanteUri, {
          encoding: "base64",
        });
        const extension = comprobanteUri.split(".").pop()?.toLowerCase() || "jpg";
        // eslint-disable-next-line react-hooks/purity -- corre dentro del handler de envío, no en el render; el timestamp evita colisiones de nombre en el bucket
        comprobantePath = `servicios/${rancho.id}/${Date.now()}-comprobante.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("comprobantes")
          .upload(comprobantePath, decodeBase64(base64), {
            contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
          });
        setSubiendo(false);
        if (uploadError) {
          setErrorEnvio("No se pudo subir el comprobante: " + uploadError.message);
          setEnviando(false);
          return;
        }
      }

      // 2. La reserva con su pedido, en una sola operación del lado de
      // la base — los precios los relee ella, el teléfono solo manda
      // qué ítems y cuántos.
      const pedido = Object.keys(cantidades).map((itemId) => ({
        item_id: itemId,
        cantidad: cantidades[itemId],
      }));

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", session.user.id)
        .maybeSingle();

      // Las elecciones incluidas no suman al precio: van como texto
      // en las notas, para que el proveedor arme el menú del cliente.
      const nombresElegidos = items
        .filter((i) => elegidos[i.id])
        .map((i) => i.nombre);
      const notasCompletas = [
        notas.trim(),
        nombresElegidos.length > 0
          ? `Elecciones incluidas en la tarifa (sin costo): ${nombresElegidos.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const invitadosNum = invitados ? parseInt(invitados, 10) : null;
      const paramsBase = {
        p_rancho_id: rancho.id,
        p_fecha: fecha,
        p_pedido: pedido,
        p_tipo_evento: tipoEvento.trim() || null,
        p_invitados: invitadosNum && invitadosNum > 0 ? invitadosNum : null,
        p_notas: notasCompletas || null,
        p_nombre: perfil?.nombre || session.user.email,
        p_correo: session.user.email,
        p_whatsapp: null,
        p_total_servicio: totalBase,
        p_metodo_pago: pagoActivo && comprobantePath ? metodoPago : null,
        p_deposito_comprobante_url: comprobantePath,
        p_terminos_aceptados: false,
      };

      // Primero con los parámetros nuevos (hora, duración, rango —
      // 0067); si la base tiene la firma vieja (PGRST202), se
      // reintenta sin ellos y la reserva sale igual.
      let { data: nuevaId, error } = await supabase.rpc("crear_reserva_servicio", {
        ...paramsBase,
        p_hora_inicio: horaInicio,
        p_duracion_horas: duracionHoras,
        p_fecha_fin: fechaFin,
      });
      if (error && error.code === "PGRST202") {
        ({ data: nuevaId, error } = await supabase.rpc(
          "crear_reserva_servicio",
          paramsBase,
        ));
      }

      if (error || !nuevaId) {
        // Los mensajes de la función ya vienen redactados para mostrar.
        setErrorEnvio(error?.message || "No se pudo enviar la reserva.");
        setEnviando(false);
        return;
      }

      const idReserva = nuevaId as string;
      setReservaId(idReserva);

      // 3. El chat con el resumen del pedido — igual que /web. Si algo
      // acá falla, la reserva ya quedó guardada igual.
      try {
        const { data: conversacion } = await supabase
          .from("conversaciones")
          .insert({ reserva_id: idReserva })
          .select("id")
          .maybeSingle();
        if (conversacion) {
          const { data: creada } = await supabase
            .from("reservas")
            .select("detalle_pedido")
            .eq("id", idReserva)
            .maybeSingle();
          const detalle = creada?.detalle_pedido as
            | { items: { nombre: string; precio: number | null; unidad: string | null; cantidad: number }[]; total_estimado: number | null }
            | null;

          const partes: string[] = [
            pagoActivo && comprobantePath
              ? `Reserva agendada para el ${fecha} — depósito de ${fmtColones(deposito)} enviado por ${metodoPago === "transferencia" ? "transferencia" : "SINPE"}, comprobante adjunto en tu panel.`
              : `Solicitud de reserva para el ${fecha}.`,
          ];
          if (horaInicio) partes.push(`Hora del evento: ${horaInicio}.`);
          if (fechaFin) partes.push(`Alquiler del ${fecha} al ${fechaFin}.`);
          if (tipoEvento.trim()) partes.push(`Tipo de evento: ${tipoEvento.trim()}.`);
          if (invitadosNum && invitadosNum > 0) partes.push(`Invitados: ${invitadosNum}.`);
          if (paqueteBaseSel) {
            partes.push(
              `Paquete elegido: ${paqueteBaseSel.nombre} — sustituye la tarifa base.`,
            );
          }
          if (nombresElegidos.length > 0) {
            partes.push(
              `Elecciones incluidas en la tarifa (sin costo): ${nombresElegidos.join(", ")}.`,
            );
          }
          if (lineasBase.length > 0) {
            partes.push(
              "Servicio cotizado:\n" +
                lineasBase.map((l) => `• ${l.etiqueta}: ${fmtColones(l.monto)}`).join("\n") +
                `\nEstimado del servicio: ${fmtColones(totalBase)}.`,
            );
          }
          if (detalle && detalle.items.length > 0) {
            partes.push(
              "Pedido:\n" +
                detalle.items
                  .map(
                    (l) =>
                      `• ${l.cantidad}× ${l.nombre}` +
                      (l.precio !== null
                        ? ` (${fmtColones(l.precio)}${l.unidad ? ` ${l.unidad}` : ""})`
                        : " (a cotizar)"),
                  )
                  .join("\n"),
            );
            if (detalle.total_estimado !== null) {
              partes.push(
                `Total estimado${totalBase > 0 ? " (servicio + pedido)" : ""}: ${fmtColones(totalBase + detalle.total_estimado)}.`,
              );
            }
          }
          if (notas.trim()) partes.push(`Notas: ${notas.trim()}`);

          await supabase.from("mensajes").insert({
            conversacion_id: conversacion.id,
            autor_id: session.user.id,
            texto: partes.join("\n").slice(0, 2000),
          });
        }
      } catch {
        // El chat es un plus: la reserva ya está guardada.
      }

      setConfirmado(true);

      // Los correos los manda la web (Resend vive en el servidor).
      void pedirCorreosDeReserva(idReserva);
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar la reserva.");
    } finally {
      setEnviando(false);
      setSubiendo(false);
    }
  }

  // ---------- Pantallas de estado ----------
  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (errorCarga || !rancho) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{errorCarga ?? "No encontramos esta publicación."}</Text>
        <Pressable style={styles.botonSecundario} onPress={() => router.back()}>
          <Text style={styles.botonSecundarioTexto}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Reservar" subtitulo={rancho.nombre} />
        <View style={styles.centro}>
          <Text style={styles.tituloEstado}>Iniciá sesión para reservar</Text>
          <Text style={styles.textoEstado}>
            Tu reserva queda ligada a tu cuenta: ahí ves el estado, el chat con
            el proveedor y tu historial.
          </Text>
          <Pressable style={styles.botonPrimario} onPress={() => router.push("/cuenta")}>
            <Text style={styles.botonPrimarioTexto}>Iniciar sesión</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (confirmado) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Reserva enviada" subtitulo={rancho.nombre} />
        <View style={styles.centro}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.tituloEstado}>¡Tu reserva quedó registrada!</Text>
          <Text style={styles.textoEstado}>
            {rancho.nombre} la revisa y te confirma. Te llegará un correo a{" "}
            {session.user.email}, y el chat quedó abierto con tu pedido ya
            detallado.
          </Text>
          {/* Acá iba la venta cruzada de la invitación digital. Salió
              del app: es contenido digital y ofrecerlo adentro obliga a
              compra in-app (guía 3.1.1 de Apple). Vive en bookea.lat. */}
          {reservaId && (
            <Pressable
              style={styles.botonPrimario}
              onPress={() => router.replace(`/mensajes/${reservaId}` as never)}
            >
              <Text style={styles.botonPrimarioTexto}>Ver el chat de mi reserva</Text>
            </Pressable>
          )}
          <Pressable style={styles.botonSecundario} onPress={() => router.back()}>
            <Text style={styles.botonSecundarioTexto}>Volver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const etiquetaCatalogo = CATALOGO_LABEL[rancho.categoria];
  const secciones = agruparPorSeccion(items);
  let paso = 1;
  const numServicio = pasoServicio ? ++paso : 0;
  const numPedido = items.length > 0 ? ++paso : 0;
  const numPago = pagoActivo ? ++paso : 0;
  const numDatos = ++paso;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo="Reservar"
        subtitulo={rancho.nombre}
        accion={{
          icono: "chatbubble-ellipses-outline",
          etiqueta: `Chateá con ${rancho.nombre}`,
          onPress: chatearConProveedor,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
        {/* ---------- 1 · Fecha ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.etiqueta}>1 · Elegí la fecha</Text>
          <View style={styles.calNav}>
            <Pressable
              disabled={mesOffset === 0}
              onPress={() => setMesOffset((v) => v - 1)}
              style={[styles.calFlecha, mesOffset === 0 && { opacity: 0.3 }]}
            >
              <Text style={styles.calFlechaTexto}>←</Text>
            </Pressable>
            <Text style={styles.calMes}>
              {MESES[mes]} {anio}
            </Text>
            <Pressable onPress={() => setMesOffset((v) => v + 1)} style={styles.calFlecha}>
              <Text style={styles.calFlechaTexto}>→</Text>
            </Pressable>
          </View>
          <View style={styles.calGrid}>
            {DOW.map((d, i) => (
              <Text key={`d-${i}`} style={styles.calDow}>
                {d}
              </Text>
            ))}
            {celdas.map((dia, i) => {
              if (dia === null) return <View key={`v-${i}`} style={styles.calCelda} />;
              const valor = iso(anio, mes, dia);
              const lleno = valor >= minima && diaLleno(valor);
              const deshabilitado = valor < minima || lleno;
              const activo = fecha === valor;
              return (
                <Pressable
                  key={valor}
                  disabled={deshabilitado}
                  onPress={() => setFecha(valor)}
                  style={[
                    styles.calCelda,
                    activo && styles.calCeldaActiva,
                    lleno && styles.calCeldaLlena,
                  ]}
                >
                  <Text
                    style={[
                      styles.calDia,
                      activo && styles.calDiaActivo,
                      deshabilitado && !activo && styles.calDiaMuerto,
                      lleno && styles.calDiaLleno,
                    ]}
                  >
                    {dia}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {anticipacionDias > 0 && (
            <Text style={styles.ayuda}>
              Este proveedor pide al menos {anticipacionDias} día
              {anticipacionDias === 1 ? "" : "s"} de anticipación.
            </Text>
          )}
          {fecha && <Text style={styles.fechaElegida}>Fecha elegida: {fecha}</Text>}
        </View>

        {/* ---------- Armá tu servicio (según cómo cobra) ---------- */}
        {pasoServicio && (
          <View style={styles.bloque}>
            <Text style={styles.etiqueta}>{numServicio} · Armá tu servicio</Text>
            {config.modalidad === "por_persona" && (
              <View>
                <Text style={styles.campoLabel}>¿Para cuántas personas?</Text>
                <TextInput
                  value={invitados}
                  onChangeText={setInvitados}
                  keyboardType="number-pad"
                  placeholder={
                    config.minimoPersonas ? `Mínimo ${config.minimoPersonas}` : "Ej. 80"
                  }
                  placeholderTextColor={Colors.inkSoft}
                  style={styles.input}
                />
                <Text style={styles.ayuda}>
                  {fmtColones(config.tarifaPersona!)} por persona
                  {config.minimoPersonas ? ` (mínimo ${config.minimoPersonas})` : ""}.
                </Text>
              </View>
            )}
            {config.modalidad === "por_hora" && (
              <Stepper
                label="¿Cuántas horas de servicio?"
                ayuda={`${fmtColones(config.tarifaHora!)} por hora${config.horasMinimas ? ` · mínimo ${config.horasMinimas}` : ""}`}
                valor={horas}
                sufijo={horas === 1 ? "hora" : "horas"}
                onCambiar={setHoras}
              />
            )}
            {(config.modalidad === "por_evento" || config.modalidad === "por_paquete") && (
              <View style={{ gap: Spacing.three }}>
                {paqueteBaseSel ? (
                  <Text style={styles.textoNormal}>
                    Paquete elegido:{" "}
                    <Text style={styles.negrita}>{paqueteBaseSel.nombre}</Text>
                    {paqueteBaseSel.precio !== null
                      ? ` — ${fmtColones(paqueteBaseSel.precio)}`
                      : ""}
                    {paqueteBaseSel.duracionHoras
                      ? ` — incluye ${paqueteBaseSel.duracionHoras} hora${paqueteBaseSel.duracionHoras === 1 ? "" : "s"}`
                      : ""}
                    . Sustituye la tarifa base (no se cobran las dos).
                  </Text>
                ) : config.tarifaEvento ? (
                  <Text style={styles.textoNormal}>
                    {config.modalidad === "por_paquete" ? "Paquete base" : "Tarifa por evento"}
                    : <Text style={styles.negrita}>{fmtColones(config.tarifaEvento)}</Text>
                    {config.horasIncluidas
                      ? ` — incluye ${config.horasIncluidas} hora${config.horasIncluidas === 1 ? "" : "s"}`
                      : ""}
                    .
                  </Text>
                ) : null}
                {config.horaExtra && (
                  <Stepper
                    label="¿Horas extra?"
                    ayuda={`${fmtColones(config.horaExtra)} por hora adicional`}
                    valor={horasExtra}
                    sufijo={horasExtra === 1 ? "hora extra" : "horas extra"}
                    onCambiar={setHorasExtra}
                  />
                )}
              </View>
            )}
            {config.modalidad === "por_dia" && (
              <View style={{ gap: 4 }}>
                <Stepper
                  label="¿Cuántos días de alquiler?"
                  ayuda={`${fmtColones(config.tarifaDia!)} por día`}
                  valor={dias}
                  sufijo={dias === 1 ? "día" : "días"}
                  onCambiar={setDias}
                />
                {fechaFin && (
                  <Text style={styles.fechaElegida}>
                    Tu alquiler va del {fecha} al {fechaFin} — el inventario
                    queda apartado todos esos días.
                  </Text>
                )}
              </View>
            )}
            {lineasBase.length > 0 && (
              <View style={styles.resumenCaja}>
                {lineasBase.map((l) => (
                  <View key={l.etiqueta} style={styles.resumenFila}>
                    <Text style={styles.resumenEtiqueta}>{l.etiqueta}</Text>
                    <Text style={styles.resumenMonto}>{fmtColones(l.monto)}</Text>
                  </View>
                ))}
                <View style={[styles.resumenFila, styles.resumenTotalFila]}>
                  <Text style={styles.resumenTotal}>Estimado del servicio</Text>
                  <Text style={styles.resumenTotal}>{fmtColones(totalBase)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ---------- El catálogo ---------- */}
        {items.length > 0 && (
          <View style={styles.bloque}>
            <Text style={styles.etiqueta}>
              {numPedido} · Elegí del {etiquetaCatalogo.toLowerCase()}
              {pasoServicio ? " (opcional)" : ""}
            </Text>
            {secciones.map(({ grupo, items: delGrupo }) => {
              // Sección "incluida en la tarifa": el cliente marca hasta
              // N sin costo — sin contadores ni precios.
              const topeEleccion = grupo ? (eleccionesPorGrupo[grupo] ?? 0) : 0;
              const marcados = delGrupo.filter((i) => elegidos[i.id]).length;

              // Cada sección arranca cerrada y se abre al toque. Si el
              // catálogo entero es una sola lista sin secciones, se
              // muestra plano como siempre (nada que colapsar).
              const clave = grupo ?? "__sin__";
              const colapsable = grupo !== null || secciones.length > 1;
              const abierta = !colapsable || seccionesAbiertas.has(clave);
              const enSeccion =
                topeEleccion > 0
                  ? marcados
                  : delGrupo.filter((i) => (cantidades[i.id] ?? 0) > 0).length;
              const encabezado = colapsable ? (
                <Pressable
                  onPress={() => alternarSeccion(clave)}
                  style={styles.seccionHeader}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: abierta }}
                  accessibilityLabel={`${grupo ?? "Otros"}, ${delGrupo.length} ítem${delGrupo.length === 1 ? "" : "s"}${enSeccion > 0 ? `, ${enSeccion} elegido${enSeccion === 1 ? "" : "s"}` : ""}`}
                >
                  <Text style={styles.seccionNombre} numberOfLines={1}>
                    {grupo ?? "Otros"}
                    <Text style={styles.seccionConteo}> · {delGrupo.length}</Text>
                  </Text>
                  {enSeccion > 0 && (
                    <View style={styles.seccionBadge}>
                      <Text style={styles.seccionBadgeTexto}>{enSeccion}</Text>
                    </View>
                  )}
                  <Ionicons
                    name={abierta ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={Colors.inkSoft}
                  />
                </Pressable>
              ) : null;

              if (topeEleccion > 0) {
                return (
                  <View key={clave} style={{ gap: Spacing.three }}>
                    {encabezado}
                    {abierta && (
                    <>
                    <Text style={styles.eleccionAyuda}>
                      Incluido en tu tarifa — elegí hasta {topeEleccion} sin
                      costo ({marcados}/{topeEleccion})
                    </Text>
                    {delGrupo.map((item) => {
                      const marcado = !!elegidos[item.id];
                      const bloqueado = !marcado && marcados >= topeEleccion;
                      return (
                        <Pressable
                          key={item.id}
                          disabled={bloqueado}
                          onPress={() =>
                            setElegidos((prev) => {
                              const copia = { ...prev };
                              if (marcado) delete copia[item.id];
                              else copia[item.id] = true;
                              return copia;
                            })
                          }
                          style={[
                            styles.itemCard,
                            marcado && styles.eleccionActiva,
                            bloqueado && { opacity: 0.5 },
                          ]}
                        >
                          <View style={styles.itemCuerpo}>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.itemNombre}>{item.nombre}</Text>
                              {item.descripcion && (
                                <Text style={styles.itemDesc} numberOfLines={2}>
                                  {item.descripcion}
                                </Text>
                              )}
                              <Text style={styles.eleccionIncluida}>
                                Incluido en tu tarifa
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.eleccionBoton,
                                marcado && styles.eleccionBotonActivo,
                              ]}
                            >
                              {marcado ? "Elegido ✓" : "Elegir"}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    </>
                    )}
                  </View>
                );
              }
              return (
              <View key={clave} style={{ gap: Spacing.three }}>
                {encabezado}
                {abierta && delGrupo.map((item) => {
                  const restante = fecha
                    ? cupoRestante(item, reservadasDelDia[item.id] ?? 0)
                    : null;
                  const agotado = restante !== null && restante <= 0;
                  const cantidad = cantidades[item.id] ?? 0;
                  const topes = [item.max_por_reserva, restante].filter(
                    (v): v is number => v !== null,
                  );
                  const tope = topes.length > 0 ? Math.min(...topes) : null;
                  const duracion = etiquetaDuracion(item.duracion_horas);

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.itemCard,
                        cantidad > 0 && styles.itemCardActiva,
                        agotado && { opacity: 0.5 },
                      ]}
                    >
                      {item.tipo === "paquete" && item.foto_url && (
                        <Image
                          source={{ uri: item.foto_url }}
                          style={styles.itemFoto}
                          contentFit="cover"
                          alt={item.nombre}
                        />
                      )}
                      <View style={styles.itemCuerpo}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.itemNombre}>{item.nombre}</Text>
                          {item.descripcion && (
                            <Text style={styles.itemDesc} numberOfLines={2}>
                              {item.descripcion}
                            </Text>
                          )}
                          <Text style={styles.itemPrecio}>
                            {item.precio !== null ? fmtColones(item.precio) : "A cotizar"}
                            {item.precio !== null && item.unidad ? (
                              <Text style={styles.itemUnidad}> {item.unidad}</Text>
                            ) : null}
                            {duracion ? (
                              <Text style={styles.itemUnidad}> · {duracion}</Text>
                            ) : null}
                            {item.es_paquete_base === true ? (
                              <Text style={styles.itemUnidad}> · sustituye la tarifa base</Text>
                            ) : null}
                          </Text>
                          {restante !== null && !agotado && (
                            <Text style={styles.itemQuedan}>
                              {restante === 1
                                ? "Queda 1 para esta fecha"
                                : `Quedan ${restante} para esta fecha`}
                            </Text>
                          )}
                          {agotado && (
                            <Text style={styles.itemAgotado}>Agotado para esta fecha</Text>
                          )}
                          {item.min_por_reserva > 1 && (
                            <Text style={styles.ayuda}>Mínimo {item.min_por_reserva} por reserva</Text>
                          )}
                        </View>
                        {!agotado && (
                          <ContadorItem
                            valor={cantidad}
                            min={item.min_por_reserva}
                            max={tope}
                            onCambiar={(v) => fijarCantidad(item.id, v)}
                          />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
              );
            })}
            {resumenPedido.unidades > 0 && (
              <Text style={styles.textoNormal}>
                {resumenPedido.unidades} ítem{resumenPedido.unidades === 1 ? "" : "s"}{" "}
                elegido{resumenPedido.unidades === 1 ? "" : "s"}
                {resumenPedido.total > 0 && (
                  <>
                    {" "}· Subtotal:{" "}
                    <Text style={styles.negrita}>{fmtColones(resumenPedido.total)}</Text>
                  </>
                )}
                {resumenPedido.hayACotizar ? " · algunos ítems se cotizan aparte" : ""}
              </Text>
            )}
          </View>
        )}

        {/* ---------- Total ---------- */}
        {totalGeneral > 0 && (
          <View style={styles.totalBanner}>
            <Text style={styles.totalBannerTexto}>Total estimado</Text>
            <Text style={styles.totalBannerMonto}>{fmtColones(totalGeneral)}</Text>
          </View>
        )}

        {/* ---------- Depósito ---------- */}
        {pagoActivo && (
          <View style={styles.bloque}>
            <Text style={styles.etiqueta}>{numPago} · Pagá el depósito para agendar</Text>
            <Text style={styles.textoNormal}>
              Este proveedor pide un depósito de{" "}
              <Text style={styles.negrita}>{fmtColones(deposito)}</Text>. Hacé el
              pago y subí el comprobante — tu reserva queda en aprobación hasta
              que lo confirme.
            </Text>
            {tieneSinpe && tieneCuenta && (
              <View style={styles.chipsFila}>
                {(["sinpe", "transferencia"] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMetodoPago(m)}
                    style={[styles.chip, metodoPago === m && styles.chipActivo]}
                  >
                    <Text
                      style={[styles.chipTexto, metodoPago === m && styles.chipTextoActivo]}
                    >
                      {m === "sinpe" ? "SINPE Móvil" : "Transferencia"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable
              onPress={async () => {
                const dato =
                  metodoPago === "sinpe" && tieneSinpe
                    ? rancho.sinpe_numero!
                    : rancho.cuenta_numero!;
                await Clipboard.setStringAsync(dato);
              }}
              style={styles.cuentaCaja}
            >
              {metodoPago === "sinpe" && tieneSinpe ? (
                <>
                  <Text style={styles.cuentaTexto}>
                    SINPE Móvil: <Text style={styles.negrita}>{rancho.sinpe_numero}</Text>
                  </Text>
                  {rancho.sinpe_titular && (
                    <Text style={styles.ayuda}>A nombre de {rancho.sinpe_titular}</Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.cuentaTexto}>
                    {rancho.cuenta_banco ? `${rancho.cuenta_banco} · ` : ""}
                    <Text style={styles.negrita}>{rancho.cuenta_numero}</Text>
                  </Text>
                  {rancho.cuenta_titular && (
                    <Text style={styles.ayuda}>A nombre de {rancho.cuenta_titular}</Text>
                  )}
                </>
              )}
              <Text style={styles.copiarPista}>Tocá para copiar</Text>
            </Pressable>
            <Pressable style={styles.botonSecundario} onPress={elegirComprobante}>
              <Text style={styles.botonSecundarioTexto}>
                {comprobanteUri ? "Cambiar comprobante" : "Subir comprobante del depósito"}
              </Text>
            </Pressable>
            {comprobanteUri && (
              <Text style={styles.comprobanteOk}>✓ Comprobante listo para enviar</Text>
            )}
          </View>
        )}

        {/* ---------- Datos del evento ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.etiqueta}>{numDatos} · Contanos de tu evento</Text>
          {!(config.modalidad === "por_persona" && pasoServicio) && (
            <View>
              <Text style={styles.campoLabel}>Cantidad de invitados (opcional)</Text>
              <TextInput
                value={invitados}
                onChangeText={setInvitados}
                keyboardType="number-pad"
                placeholder="Ej. 80"
                placeholderTextColor={Colors.inkSoft}
                style={styles.input}
              />
            </View>
          )}
          <View>
            <Text style={styles.campoLabel}>Tipo de evento (opcional)</Text>
            <TextInput
              value={tipoEvento}
              onChangeText={setTipoEvento}
              placeholder="Ej. Cumpleaños, boda, corporativo..."
              placeholderTextColor={Colors.inkSoft}
              style={styles.input}
            />
          </View>
          <View>
            <Text style={styles.campoLabel}>¿A qué hora es tu evento? (opcional)</Text>
            <TextInput
              value={hora}
              onChangeText={setHora}
              placeholder="Formato 24 horas, ej. 15:00"
              placeholderTextColor={Colors.inkSoft}
              keyboardType="numbers-and-punctuation"
              style={styles.input}
            />
            <Text style={styles.ayuda}>
              {hora.trim() && !horaValida
                ? "Escribila como HH:MM (ej. 15:00) para que quede guardada."
                : "Le ayuda al proveedor a cuidar su agenda y evitar choques de horario ese día."}
            </Text>
          </View>
          {esAlquiler && config.modalidad !== "por_dia" && (
            <Stepper
              label="¿Cuántos días necesitás el alquiler? (opcional)"
              ayuda={
                fechaFin
                  ? `Del ${fecha} al ${fechaFin} — el inventario queda apartado todos esos días.`
                  : "Si tu alquiler es de varios días (ej. de viernes a domingo), el inventario se aparta todo el rango."
              }
              valor={dias}
              sufijo={dias === 1 ? "día" : "días"}
              onCambiar={setDias}
            />
          )}
          <View>
            <Text style={styles.campoLabel}>Notas para el proveedor (opcional)</Text>
            <TextInput
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={3}
              placeholder="Ej. El evento es en Santa Ana, al aire libre."
              placeholderTextColor={Colors.inkSoft}
              style={[styles.input, { minHeight: 76, textAlignVertical: "top" }]}
            />
          </View>
        </View>

        {/* ---------- Avisos de mínimos, antes de intentar enviar ---------- */}
        {montoMinimo > 0 && totalGeneral > 0 && totalGeneral < montoMinimo && (
          <Text style={styles.aviso}>
            Este negocio toma pedidos desde {fmtColones(montoMinimo)}. Tu pedido
            va en {fmtColones(totalGeneral)} — agregale{" "}
            {fmtColones(montoMinimo - totalGeneral)} más para poder reservar.
          </Text>
        )}
        {minimoPedido !== null &&
          resumenPedido.unidades > 0 &&
          resumenPedido.unidades < minimoPedido && (
            <Text style={styles.aviso}>
              Este negocio despacha pedidos desde {minimoPedido} unidades y tu
              pedido lleva {resumenPedido.unidades}.
            </Text>
          )}

        {errorEnvio && <Text style={styles.error}>{errorEnvio}</Text>}

        <Pressable
          disabled={!listoParaEnviar}
          onPress={enviarReserva}
          style={[styles.botonPrimario, !listoParaEnviar && { opacity: 0.5 }]}
        >
          <Text style={styles.botonPrimarioTexto}>
            {enviando
              ? "Enviando..."
              : !fecha
                ? "Elegí una fecha para continuar"
                : pagoActivo && !comprobanteUri
                  ? "Subí el comprobante para reservar"
                  : pagoActivo
                    ? "Reservar y pagar el depósito"
                    : "Reservar mi fecha"}
          </Text>
        </Pressable>
        <Text style={styles.ayuda}>
          Tu reserva queda en aprobación del proveedor, con tu pedido ya
          detallado. Si tenés dudas, el chat queda abierto.
        </Text>
        <View style={{ height: Spacing.six }} />
      </ScrollView>
    </View>
  );
}

/** Stepper −/+ con salto al mínimo del proveedor al activar. */
function ContadorItem({
  valor,
  min,
  max,
  onCambiar,
}: {
  valor: number;
  min: number;
  max: number | null;
  onCambiar: (v: number) => void;
}) {
  const bajar = () => onCambiar(valor <= min ? 0 : valor - 1);
  const subir = () =>
    onCambiar(valor === 0 ? min : max !== null && valor >= max ? valor : valor + 1);
  return (
    <View style={styles.contador}>
      <Pressable
        onPress={bajar}
        disabled={valor === 0}
        style={[styles.contadorBoton, valor === 0 && { opacity: 0.3 }]}
      >
        <Text style={styles.contadorSigno}>−</Text>
      </Pressable>
      <Text style={styles.contadorValor}>{valor}</Text>
      <Pressable
        onPress={subir}
        disabled={max !== null && valor >= max}
        style={[styles.contadorBoton, max !== null && valor >= max && { opacity: 0.3 }]}
      >
        <Text style={styles.contadorSigno}>+</Text>
      </Pressable>
    </View>
  );
}

/** Stepper de horas/días del cotizador. */
function Stepper({
  label,
  ayuda,
  valor,
  sufijo,
  onCambiar,
}: {
  label: string;
  ayuda: string;
  valor: number;
  sufijo: string;
  onCambiar: (v: number) => void;
}) {
  return (
    <View>
      <Text style={styles.campoLabel}>{label}</Text>
      <View style={styles.stepperFila}>
        <Pressable
          onPress={() => onCambiar(Math.max(0, valor - 1))}
          disabled={valor === 0}
          style={[styles.contadorBoton, valor === 0 && { opacity: 0.3 }]}
        >
          <Text style={styles.contadorSigno}>−</Text>
        </Pressable>
        <Text style={styles.stepperValor}>
          {valor} {sufijo}
        </Text>
        <Pressable
          onPress={() => onCambiar(Math.min(48, valor + 1))}
          style={styles.contadorBoton}
        >
          <Text style={styles.contadorSigno}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.ayuda}>{ayuda}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.five,
    gap: Spacing.three,
  },
  error: { color: Colors.danger, textAlign: "center", fontFamily: Fonts.medium, fontSize: 13.5 },
  bloque: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  // Los dos rótulos usan el mismo micro (Tipo.micro) que encabeza los
  // bloques en el resto de la app.
  etiqueta: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  campoLabel: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.7,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: Colors.cream2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.ink,
  },
  ayuda: { fontSize: 12, color: Colors.inkSoft, fontFamily: Fonts.regular },
  textoNormal: { fontSize: 13.5, color: Colors.ink, fontFamily: Fonts.regular },
  negrita: { fontFamily: Fonts.bold, color: Colors.ink },

  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calFlecha: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
  calFlechaTexto: { fontSize: 15, color: Colors.ink, fontFamily: Fonts.bold },
  calMes: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calDow: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    color: Colors.inkSoft,
    paddingVertical: 4,
  },
  calCelda: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  calCeldaActiva: { backgroundColor: Colors.navy },
  calCeldaLlena: { backgroundColor: Colors.cream2 },
  calDia: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.ink },
  calDiaActivo: { color: "#ffffff" },
  calDiaMuerto: { color: Colors.line },
  calDiaLleno: { color: Colors.inkSoft, textDecorationLine: "line-through" },
  fechaElegida: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.navy },

  // Encabezado tocable de cada sección del catálogo (cerrada por defecto).
  seccionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  seccionNombre: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: Fonts.bold,
    color: Colors.ink,
  },
  seccionConteo: { fontFamily: Fonts.regular, color: Colors.inkSoft },
  seccionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  seccionBadgeTexto: { color: "#ffffff", fontSize: 11.5, fontFamily: Fonts.bold },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  itemCardActiva: { borderColor: Colors.accent, backgroundColor: "#fff8f2" },
  itemFoto: { width: "100%", height: 130 },
  itemCuerpo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  itemNombre: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  itemDesc: { fontSize: 12, color: Colors.inkSoft, marginTop: 2, fontFamily: Fonts.regular },
  itemPrecio: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.navy, marginTop: 3 },
  itemUnidad: { fontFamily: Fonts.regular, color: Colors.inkSoft },
  itemQuedan: { fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.accent, marginTop: 3 },
  itemAgotado: { fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.inkSoft, marginTop: 3 },

  // Secciones "incluido en tu tarifa: elegí hasta N" (0067).
  eleccionAyuda: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.green },
  eleccionActiva: { borderColor: Colors.green, backgroundColor: "#f2faf4" },
  eleccionIncluida: {
    fontSize: 11.5,
    fontFamily: Fonts.bold,
    color: Colors.green,
    marginTop: 3,
  },
  eleccionBoton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    fontFamily: Fonts.bold,
    color: Colors.ink,
    overflow: "hidden",
  },
  eleccionBotonActivo: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
    color: "#ffffff",
  },

  aviso: {
    backgroundColor: "#fdf6e3",
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 13,
    lineHeight: 19,
    color: "#8a6d1a",
    fontFamily: Fonts.medium,
  },

  contador: { flexDirection: "row", alignItems: "center", gap: 8 },
  contadorBoton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
  contadorSigno: { fontSize: 16, color: Colors.ink, fontFamily: Fonts.bold },
  contadorValor: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.ink,
  },
  stepperFila: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  stepperValor: {
    minWidth: 90,
    textAlign: "center",
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.ink,
  },

  resumenCaja: {
    backgroundColor: Colors.cream2,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  resumenFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    gap: Spacing.three,
  },
  resumenEtiqueta: { flex: 1, fontSize: 12.5, color: Colors.inkSoft, fontFamily: Fonts.regular },
  resumenMonto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.ink },
  resumenTotalFila: {
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    marginTop: 4,
    paddingTop: 7,
  },
  resumenTotal: { fontSize: 13.5, fontFamily: Fonts.bold, color: Colors.navy },

  totalBanner: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalBannerTexto: { color: "#ffffff", fontSize: 14, fontFamily: Fonts.bold },
  totalBannerMonto: { color: "#ffffff", fontSize: 16, fontFamily: Fonts.bold },

  chipsFila: { flexDirection: "row", gap: 8 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  chipTextoActivo: { color: "#ffffff" },
  cuentaCaja: {
    backgroundColor: Colors.cream2,
    borderRadius: 12,
    padding: Spacing.three,
    gap: 2,
  },
  cuentaTexto: { fontSize: 13.5, color: Colors.ink, fontFamily: Fonts.regular },
  copiarPista: { fontSize: 11, color: Colors.inkSoft, fontFamily: Fonts.medium, marginTop: 4 },
  comprobanteOk: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.green },

  botonPrimario: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonPrimarioTexto: { color: "#ffffff", fontSize: 14, fontFamily: Fonts.bold },
  botonSecundario: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonSecundarioTexto: { color: Colors.ink, fontSize: 13.5, fontFamily: Fonts.bold },

  check: { fontSize: 44, color: Colors.green, fontFamily: Fonts.bold },
  tituloEstado: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.ink, textAlign: "center" },
  textoEstado: {
    fontSize: 13.5,
    color: Colors.inkSoft,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: Fonts.regular,
  },
});
