import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import {
  Aviso,
  BarraConfirmacion,
  Boton,
  Estado,
  Identidad,
  Micro,
  Opcion,
  Tarjeta,
  Vacio,
} from "@/components/ui";
import { abrirHiloConsulta } from "@/lib/consulta";
import { useAuth } from "@/lib/auth-context";
import { obtenerIdDispositivo } from "@/lib/device";
import { pedirCorreosDeReserva } from "@/lib/notificaciones";
import { promoAplicableDelDia } from "@/lib/promociones";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import {
  bloqueDisponibleEnDia,
  etiquetaHorario,
  fmtColones,
  type HorarioBloqueConfig,
  type PrecioTier,
  type PromocionDia,
  type Rancho,
  type ServicioAdicional,
} from "@/lib/types";

const MINUTOS_HOLD = 10;
const CEDULA_REGEX = /^[0-9-]{7,14}$/;
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_REGEX = /^[0-9+\s-]{8,16}$/;

type MetodoPago = "sinpe" | "transferencia";

/**
 * El flujo de reserva de un lugar de eventos, en el lenguaje de la
 * marca: la fecha ya viene elegida del calendario, acá van los datos
 * del evento y el depósito. Cada bloque lleva su rótulo en
 * micro-mayúsculas, el horario y el método de pago se eligen en filas
 * de ancho completo, y la cuenta regresiva del bloqueo va arriba de
 * todo — es lo único con reloj en la pantalla.
 */
export default function ReservarScreen() {
  const { id, fecha, invitados: invitadosParam } = useLocalSearchParams<{
    id: string;
    fecha: string;
    invitados?: string;
  }>();
  const router = useRouter();
  const { session, cargando: cargandoAuth } = useAuth();

  // El chat con el proveedor, a mano DURANTE la reserva (mismo rol que
  // la burbuja flotante de la web). Ir a iniciar sesión no pierde nada:
  // esta pantalla queda abajo en la pila y el formulario sigue como
  // estaba al volver.
  const [abriendoChat, setAbriendoChat] = useState(false);
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

  const [rancho, setRancho] = useState<Rancho | null>(null);
  const [tiers, setTiers] = useState<PrecioTier[]>([]);
  const [servicios, setServicios] = useState<ServicioAdicional[]>([]);
  const [promociones, setPromociones] = useState<PromocionDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [holdId, setHoldId] = useState<string | null>(null);
  const [expiraEn, setExpiraEn] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const [errorHold, setErrorHold] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const confirmadoRef = useRef(false);

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [correo, setCorreo] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  // Si se llega acá con ?invitados= (ej. un link armado por el
  // asistente de IA), se precarga — el cliente igual puede corregirlo.
  const [invitados, setInvitados] = useState(() =>
    invitadosParam && /^[1-9][0-9]*$/.test(invitadosParam) ? invitadosParam : "",
  );
  const [horasEvento, setHorasEvento] = useState("");
  const [horario, setHorario] = useState<HorarioBloqueConfig | null>(null);
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [avisoAceptado, setAvisoAceptado] = useState(false);
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null);
  const [comprobanteUri, setComprobanteUri] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  // El flujo va en dos pasos como en la web (la fecha ya quedó elegida
  // en el calendario): 2 = datos del evento, 3 = pagar el depósito.
  const [paso, setPaso] = useState<"datos" | "pago">("datos");
  const scrollRef = useRef<ScrollView>(null);
  function irAPaso(p: "datos" | "pago") {
    setPaso(p);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  // Código de descuento del proveedor (mismo RPC que la web).
  const [codigoInput, setCodigoInput] = useState("");
  const [codigoAplicado, setCodigoAplicado] = useState<{
    codigo: string;
    tipo: "porcentaje" | "monto_fijo";
    valor: number;
  } | null>(null);
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);

  async function verificarCodigo() {
    if (!codigoInput.trim()) return;
    setVerificandoCodigo(true);
    setCodigoError(null);
    const { data, error } = await supabase.rpc("verificar_codigo_descuento", {
      p_rancho_id: id,
      p_codigo: codigoInput.trim(),
    });
    setVerificandoCodigo(false);
    if (error || !data || data.length === 0) {
      setCodigoAplicado(null);
      setCodigoError("Ese código no es válido o ya venció.");
      return;
    }
    const fila = data[0] as { tipo: "porcentaje" | "monto_fijo"; valor: number };
    setCodigoAplicado({ codigo: codigoInput.trim().toUpperCase(), ...fila });
  }

  function quitarCodigo() {
    setCodigoInput("");
    setCodigoAplicado(null);
    setCodigoError(null);
  }

  // Con sesión, el contacto llega precargado (ajuste durante el
  // render, el patrón de React para derivar estado de props): nombre
  // y correo salen de la cuenta; el WhatsApp se aprende en la primera
  // reserva (queda en los metadatos del usuario al enviar).
  const [precargado, setPrecargado] = useState(false);
  if (!precargado && session?.user) {
    setPrecargado(true);
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    const nombreMeta = [meta.nombre, meta.full_name].find(
      (v): v is string => typeof v === "string" && v.trim() !== "",
    );
    const whatsappMeta = meta.whatsapp;
    if (session.user.email && !correo) setCorreo(session.user.email);
    if (nombreMeta && !nombre) setNombre(nombreMeta);
    if (typeof whatsappMeta === "string" && whatsappMeta.trim() !== "" && !whatsapp) {
      setWhatsapp(whatsappMeta);
    }
  }

  // Carga el rancho y toma el hold temporal de la fecha elegida, igual
  // que /web (misma tabla `reservas`, mismo estado 'temporal').
  const iniciar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);

    const [ranchoRes, tiersRes, svcRes, promoRes] = await Promise.all([
      supabase.from("ranchos").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("precio_tiers")
        .select("min_invitados, max_invitados, precio")
        .eq("rancho_id", id)
        .order("min_invitados", { ascending: true }),
      supabase
        .from("servicios_adicionales")
        .select("id, nombre, precio, requisito_max_invitados")
        .eq("rancho_id", id)
        .eq("activo", true),
      supabase.from("promociones_dia").select("*").eq("rancho_id", id).eq("activo", true),
    ]);

    if (!ranchoRes.data) {
      setErrorCarga("No encontramos esta publicación.");
      setCargando(false);
      return;
    }
    setRancho(ranchoRes.data as Rancho);
    setTiers((tiersRes.data ?? []) as PrecioTier[]);
    setServicios((svcRes.data ?? []) as ServicioAdicional[]);
    setPromociones((promoRes.data ?? []) as PromocionDia[]);

    const deviceId = await obtenerIdDispositivo();
    deviceIdRef.current = deviceId;

    const nowIso = new Date().toISOString();
    await supabase
      .from("reservas")
      .delete()
      .eq("rancho_id", id)
      .eq("fecha", fecha)
      .eq("estado", "temporal")
      .lt("expira_en", nowIso);

    const expira = new Date(Date.now() + MINUTOS_HOLD * 60 * 1000).toISOString();
    const { data: hold, error } = await supabase
      .from("reservas")
      .insert({
        fecha,
        estado: "temporal",
        expira_en: expira,
        origen: "movil",
        rancho_id: id,
        creado_por_ip: deviceId,
      })
      .select("id, expira_en")
      .single();

    if (error) {
      setErrorHold(
        error.code === "23505"
          ? "Justo ahora otra persona reservó temporalmente esta fecha. Volvé y elegí otro día."
          : "No se pudo bloquear la fecha: " + error.message,
      );
      setCargando(false);
      return;
    }

    setHoldId(hold.id);
    setExpiraEn(hold.expira_en);
    setCargando(false);
  }, [id, fecha]);

  useEffect(() => {
    // Sin sesión no se toma el hold: reservar requiere cuenta (la
    // pantalla muestra el aviso y, al volver del login, esto corre solo).
    if (cargandoAuth || !session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- toma el hold temporal al montar, sin librería de data-fetching en este proyecto
    iniciar();
  }, [iniciar, session, cargandoAuth]);

  // Libera el hold si la persona sale de la pantalla sin completar.
  useEffect(() => {
    return () => {
      if (holdId && !confirmadoRef.current && deviceIdRef.current) {
        supabase.rpc("liberar_hold_temporal", {
          p_id: holdId,
          p_ip: deviceIdRef.current,
        });
      }
    };
  }, [holdId]);

  useEffect(() => {
    if (!expiraEn || confirmado) return;
    const tick = () => {
      const restante = Math.max(0, Math.floor((new Date(expiraEn).getTime() - Date.now()) / 1000));
      setSegundosRestantes(restante);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiraEn, confirmado]);

  const fechaObj = useMemo(() => {
    const [y, m, d] = fecha.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [fecha]);
  const esDiciembre = fechaObj.getMonth() === 11;
  const invitadosNum = parseInt(invitados) || 0;
  const horasNum = parseInt(horasEvento) || 0;

  // Cómo cotiza este lugar según lo configuró el dueño en su panel:
  // por rangos de invitados (de siempre), por hora, o un precio fijo
  // del evento. Mismo cálculo que el BookingCalendar de /web.
  const modalidadPrecio = rancho?.modalidad_precio_lugar ?? "rango_personas";

  // La promo vigente para el día elegido, ya con invitados en mano —
  // una de tipo precio_fijo aplicable (dentro de su tope de personas,
  // si tiene) manda sobre cualquiera de las tres modalidades de cobro
  // de abajo, porque es un precio de REEMPLAZO, no un descuento sobre
  // el normal (mismo orden que el BookingCalendar de /web).
  const promoAplicable = useMemo(
    () => promoAplicableDelDia(promociones, fechaObj.getDay(), invitadosNum),
    [fechaObj, promociones, invitadosNum],
  );

  const tierBase = useMemo(() => {
    if (promoAplicable?.tipo === "precio_fijo") return promoAplicable.precio_fijo;
    if (!rancho) return null;
    if (modalidadPrecio === "fijo") return rancho.precio_fijo_lugar ?? null;
    if (modalidadPrecio === "hora") {
      if (!horasNum || rancho.precio_hora_lugar === null) return null;
      return horasNum * rancho.precio_hora_lugar;
    }
    if (!invitadosNum) return null;
    if (esDiciembre) return invitadosNum * (rancho.tarifa_diciembre_por_persona ?? 0);
    const tier = tiers.find(
      (t) => invitadosNum >= t.min_invitados && invitadosNum <= t.max_invitados,
    );
    return tier ? tier.precio : null;
  }, [promoAplicable, modalidadPrecio, horasNum, invitadosNum, esDiciembre, tiers, rancho]);

  // Los horarios de alquiler pueden estar restringidos a ciertos días
  // (ej. "Turno finde" solo Vie-Dom) — la fecha ya está elegida acá,
  // así que se filtra directo (mismo helper que el BookingCalendar de
  // /web).
  const horariosDelDia = useMemo(
    () => (rancho ? rancho.horarios_bloques.filter((h) => bloqueDisponibleEnDia(h, fechaObj.getDay())) : []),
    [rancho, fechaObj],
  );

  const addonsTotal = servicios.reduce((acc, s) => {
    const eligible = !s.requisito_max_invitados || invitadosNum <= s.requisito_max_invitados;
    return acc + (eligible && addons[s.id] ? s.precio : 0);
  }, 0);

  const subtotal = tierBase === null ? null : tierBase + addonsTotal;
  // Cuando la promo es precio_fijo, el ahorro ya quedó adentro de
  // tierBase — acá se deja en 0 a propósito para no restarlo dos
  // veces ni mostrar un "-₡0" en la UI.
  const descuentoMonto =
    subtotal !== null && promoAplicable?.tipo === "porcentaje" && promoAplicable.porcentaje_descuento !== null
      ? Math.round(subtotal * (promoAplicable.porcentaje_descuento / 100))
      : 0;
  const totalConPromo = subtotal === null ? null : subtotal - descuentoMonto;
  // El código se aplica DESPUÉS de la promoción del día, igual que la web.
  const descuentoCodigoMonto =
    totalConPromo === null || !codigoAplicado
      ? 0
      : codigoAplicado.tipo === "porcentaje"
        ? Math.round(totalConPromo * (codigoAplicado.valor / 100))
        : Math.min(codigoAplicado.valor, totalConPromo);
  const total =
    totalConPromo === null ? null : Math.max(0, totalConPromo - descuentoCodigoMonto);

  const metodosDisponibles: MetodoPago[] = [
    ...(rancho?.sinpe_numero ? (["sinpe"] as const) : []),
    ...(rancho?.cuenta_numero ? (["transferencia"] as const) : []),
  ];

  async function copiar(texto: string) {
    await Clipboard.setStringAsync(texto);
  }

  async function elegirComprobante() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para adjuntar el comprobante.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!resultado.canceled && resultado.assets[0]) {
      setComprobanteUri(resultado.assets[0].uri);
    }
  }

  // Lo que hace falta para cotizar cambia según la modalidad: por
  // rangos necesita invitados, por hora necesita las horas, y el
  // precio fijo no depende de ninguno de los dos.
  const cotizacionCompleta =
    modalidadPrecio === "hora"
      ? horasNum > 0
      : modalidadPrecio === "fijo"
        ? true
        : invitadosNum > 0;

  // El lugar tiene un tope físico de gente, sin importar la modalidad
  // de cobro que haya configurado.
  const excedeCapacidad =
    modalidadPrecio === "rango_personas" &&
    !!rancho?.capacidad_max &&
    invitadosNum > rancho.capacidad_max;

  const puedeAvanzar =
    !!nombre.trim() &&
    CEDULA_REGEX.test(cedula.trim()) &&
    CORREO_REGEX.test(correo.trim()) &&
    WHATSAPP_REGEX.test(whatsapp.trim()) &&
    !!tipoEvento.trim() &&
    cotizacionCompleta &&
    !excedeCapacidad &&
    (rancho?.horarios_bloques.length ? horariosDelDia.length > 0 && !!horario : true) &&
    avisoAceptado;

  const puedeEnviar =
    puedeAvanzar &&
    !!metodoPago &&
    !!comprobanteUri &&
    terminosAceptados &&
    !enviando &&
    !subiendo;

  async function enviarReserva() {
    if (!holdId || !rancho || !comprobanteUri) return;
    setEnviando(true);
    setErrorEnvio(null);

    try {
      setSubiendo(true);
      const base64 = await FileSystem.readAsStringAsync(comprobanteUri, {
        encoding: "base64",
      });
      const extension = comprobanteUri.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${fecha}/${Date.now()}-comprobante.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("comprobantes")
        .upload(path, decodeBase64(base64), {
          contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
        });
      setSubiendo(false);

      if (uploadError) {
        setErrorEnvio("No se pudo subir el comprobante: " + uploadError.message);
        setEnviando(false);
        return;
      }

      const { data: ranchoIdRpc, error } = await supabase.rpc("completar_reserva_temporal", {
        p_id: holdId,
        p_nombre: nombre.trim(),
        p_correo: correo.trim(),
        p_whatsapp: whatsapp.trim(),
        p_cedula: cedula.trim(),
        p_tipo_evento: tipoEvento.trim(),
        p_invitados: invitadosNum,
        p_horario_bloque: horario ? etiquetaHorario(horario) : null,
        p_monto_total: total ?? 0,
        p_deposito_monto: rancho.deposito_reserva ?? 25000,
        p_metodo_pago: metodoPago,
        p_deposito_comprobante_url: path,
        p_terminos_aceptados: terminosAceptados,
        p_aviso_prohibiciones_aceptado: avisoAceptado,
        // Sin columna propia para las horas contratadas, van en las
        // notas para que el dueño las vea al revisar la reserva.
        p_notas:
          modalidadPrecio === "hora" && horasNum > 0
            ? `Evento contratado por ${horasNum} hora${horasNum === 1 ? "" : "s"}.`
            : null,
        p_codigo_descuento: codigoAplicado?.codigo ?? null,
        p_descuento_monto: descuentoMonto + descuentoCodigoMonto,
      });

      if (error) {
        setErrorEnvio(error.message);
        setEnviando(false);
        return;
      }
      if (!ranchoIdRpc) {
        setErrorEnvio(
          "Esta reserva ya no está disponible (se venció el tiempo o ya se completó). Volvé y elegí la fecha de nuevo.",
        );
        setEnviando(false);
        return;
      }

      confirmadoRef.current = true;
      setConfirmado(true);

      // Marca el uso del código para que respete su límite de canjes
      // (mismo par verificar/redimir que usa la web).
      if (codigoAplicado) {
        void supabase.rpc("redimir_codigo_descuento", {
          p_rancho_id: id,
          p_codigo: codigoAplicado.codigo,
        });
      }

      // La próxima reserva sale precargada: nombre y WhatsApp quedan
      // en los metadatos del usuario (solo con sesión iniciada).
      if (session) {
        void supabase.auth.updateUser({
          data: { nombre: nombre.trim(), whatsapp: whatsapp.trim() },
        });
      }

      // Los correos los manda la web (Resend vive en el servidor). Va
      // después de mostrar la confirmación y sin `await` que bloquee:
      // la reserva ya está guardada, así que si esto falla la persona
      // igual ve su pantalla de éxito.
      //
      // El id que va acá es `holdId`, NO `ranchoIdRpc`: la función de
      // Supabase devuelve el id del RANCHO, y la reserva es la misma
      // fila del hold que acaba de pasar a 'pendiente'.
      void pedirCorreosDeReserva(holdId);
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar la reserva.");
    } finally {
      setEnviando(false);
      setSubiendo(false);
    }
  }

  if (cargandoAuth) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  // Reservar requiere cuenta: la reserva queda ligada a la persona
  // (estado, chat, historial) y sus datos llegan precargados. Esta
  // pantalla queda abajo en la pila — al volver del login sigue acá.
  if (!session) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior kicker="Eventos" titulo="Reservar" />
        <View style={styles.centrado}>
          <Vacio
            icono="lock-closed-outline"
            titulo="Iniciá sesión para reservar"
            texto="Tu reserva queda ligada a tu cuenta: ahí ves el estado, el chat con el proveedor y tu historial — y tus datos llegan precargados."
          />
          <View style={styles.botonesEstado}>
            <Boton texto="Iniciar sesión" tono="navy" onPress={() => router.push("/cuenta")} />
            <Boton texto="Volver" tono="contorno" onPress={() => router.back()} />
          </View>
        </View>
      </View>
    );
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (errorCarga || errorHold) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior kicker="Eventos" titulo="Reservar" />
        <View style={styles.centrado}>
          <Vacio
            icono="alert-circle-outline"
            titulo="No se pudo abrir la reserva"
            texto={errorCarga ?? errorHold ?? undefined}
            accion={{ texto: "Volver", onPress: () => router.back() }}
          />
        </View>
      </View>
    );
  }

  // ---------- Reserva enviada ----------
  if (confirmado) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior kicker="Eventos" titulo="Reserva enviada" contexto={rancho?.nombre} />
        <ScrollView contentContainerStyle={styles.contenido}>
          <Tarjeta style={styles.tarjetaExito}>
            <View style={styles.exitoCheck}>
              <Ionicons name="checkmark" size={28} color={Colors.navy} />
            </View>
            <Text style={styles.exitoTitulo}>¡Reserva recibida!</Text>
            <Text style={styles.exitoTexto}>
              Quedó en revisión — {rancho?.nombre} la confirma en cuanto revise tu
              comprobante. Te llega un correo a {correo}.
            </Text>
          </Tarjeta>

          {/* La misma barra del mockup: lo que pasó, y qué sigue. */}
          <BarraConfirmacion titulo="Reserva enviada" nota="Esperando al proveedor" />

          {/* Acá iba la venta cruzada de la invitación digital. Salió
              del app: es contenido digital y ofrecerlo adentro obliga a
              compra in-app (guía 3.1.1 de Apple). Vive en bookea.lat. */}

          <Boton
            texto="Volver al directorio"
            tono="contorno"
            onPress={() => router.dismissTo("/")}
          />
        </ScrollView>
      </View>
    );
  }

  const minutos = segundosRestantes !== null ? Math.floor(segundosRestantes / 60) : 0;
  const segundos = segundosRestantes !== null ? segundosRestantes % 60 : 0;
  const apurado = segundosRestantes !== null && segundosRestantes < 120;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Eventos"
        titulo="Reservar"
        subtitulo={rancho?.nombre ?? undefined}
        accion={{
          icono: "chatbubble-ellipses-outline",
          etiqueta: rancho ? `Chateá con ${rancho.nombre}` : "Chat",
          onPress: chatearConProveedor,
        }}
      />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.contenido}>
        {/* El reloj del bloqueo: lo primero que se ve, siempre. */}
        <View style={[styles.reloj, apurado && styles.relojApurado]}>
          <Ionicons
            name="time-outline"
            size={17}
            color={apurado ? Colors.danger : Colors.accent}
          />
          <Text style={[styles.relojTexto, apurado && { color: Colors.danger }]}>
            Fecha bloqueada {String(minutos).padStart(2, "0")}:
            {String(segundos).padStart(2, "0")} — completá antes de que se libere.
          </Text>
        </View>

        {/* La identidad del lugar y la fecha elegida, como en el mockup. */}
        {rancho && (
          <Tarjeta style={styles.identidadTarjeta}>
            <Identidad
              nombre={rancho.nombre}
              meta={[
                "Eventos",
                [rancho.canton, rancho.provincia].filter(Boolean).join(", ") || null,
              ]}
              derecha={<Estado texto={fecha} tono="navy" />}
            />
          </Tarjeta>
        )}

        {/* Los tres pasos del flujo, como en la web: la fecha ya quedó
            hecha en el calendario. */}
        <View style={styles.pasos}>
          <PasoPill numero="✓" etiqueta="Fecha" estado="hecho" />
          <PasoPill
            numero="2"
            etiqueta="Tus datos"
            estado={paso === "datos" ? "activo" : "hecho"}
          />
          <PasoPill
            numero="3"
            etiqueta="Depósito"
            estado={paso === "pago" ? "activo" : "pendiente"}
          />
        </View>

        {paso === "datos" && (
          <>
            <View style={styles.bloque}>
              <Micro>Datos del evento</Micro>
              <Tarjeta style={styles.tarjetaCampos}>
                <Campo label="Nombre completo *" value={nombre} onChangeText={setNombre} />
                <Campo
                  label="Cédula *"
                  value={cedula}
                  onChangeText={setCedula}
                  keyboardType="numeric"
                />
                <Campo
                  label="Correo *"
                  value={correo}
                  onChangeText={setCorreo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Campo
                  label="WhatsApp *"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                />
                <Campo
                  label="Tipo de evento *"
                  value={tipoEvento}
                  onChangeText={setTipoEvento}
                  placeholder="Ej. cumpleaños, boda"
                />
                {modalidadPrecio === "hora" ? (
                  <Campo
                    label="Cantidad de horas"
                    value={horasEvento}
                    onChangeText={setHorasEvento}
                    keyboardType="numeric"
                    placeholder="Ej. 5"
                  />
                ) : modalidadPrecio === "rango_personas" ? (
                  <Campo
                    label={
                      rancho?.capacidad_max
                        ? `Invitados (máximo ${rancho.capacidad_max})`
                        : "Cantidad de invitados"
                    }
                    value={invitados}
                    onChangeText={setInvitados}
                    keyboardType="numeric"
                  />
                ) : null}
              </Tarjeta>
              {excedeCapacidad && (
                <Aviso
                  tono="error"
                  texto={`Este lugar recibe hasta ${rancho?.capacidad_max} personas — para grupos más grandes, escribile directo para coordinar.`}
                />
              )}
            </View>

            {rancho && rancho.horarios_bloques.length > 0 && (
              <View style={styles.bloque}>
                <Micro>Elegí el horario</Micro>
                {horariosDelDia.length > 0 ? (
                  <View style={styles.opciones}>
                    {horariosDelDia.map((h) => (
                      <Opcion
                        key={h.id}
                        titulo={etiquetaHorario(h)}
                        seleccionada={horario?.id === h.id}
                        onPress={() => setHorario(h)}
                      />
                    ))}
                  </View>
                ) : (
                  <Aviso
                    tono="error"
                    texto={`${rancho.nombre} no tiene un horario definido para este día — escribile directo para coordinar, o volvé y elegí otra fecha.`}
                  />
                )}
              </View>
            )}

            {servicios.length > 0 && (
              <View style={styles.bloque}>
                <Micro>Servicios adicionales</Micro>
                <View style={styles.opciones}>
                  {servicios.map((s) => (
                    <Opcion
                      key={s.id}
                      titulo={s.nombre}
                      derecha={fmtColones(s.precio) ?? undefined}
                      seleccionada={!!addons[s.id]}
                      onPress={() => setAddons((a) => ({ ...a, [s.id]: !a[s.id] }))}
                    />
                  ))}
                </View>
              </View>
            )}

            <Pressable style={styles.filaCheckbox} onPress={() => setAvisoAceptado((v) => !v)}>
              <Switch
                value={avisoAceptado}
                onValueChange={setAvisoAceptado}
                trackColor={{ true: Colors.navy }}
              />
              <Text style={styles.avisoTexto}>
                Entiendo que este lugar no se alquila para serenatas, fiestas de menores de
                edad ni fiestas clandestinas donde se venda alcohol. Si reservo para uno de
                estos casos, acepto que se cancele sin devolución de dinero.
              </Text>
            </Pressable>

            <View style={styles.bloque}>
              <Micro>Cotización estimada</Micro>
              <Tarjeta style={styles.tarjetaTotal}>
                {(descuentoMonto > 0 || descuentoCodigoMonto > 0) && subtotal !== null && (
                  <View>
                    <Text style={[styles.totalTexto, { textDecorationLine: "line-through", opacity: 0.5 }]}>
                      {fmtColones(subtotal)}
                    </Text>
                    {promoAplicable && descuentoMonto > 0 && (
                      <Estado
                        tono="verde"
                        texto={`${promoAplicable.etiqueta || "Promoción"} −${promoAplicable.porcentaje_descuento}%`}
                      />
                    )}
                    {descuentoCodigoMonto > 0 && !promoAplicable && (
                      <Estado
                        tono="verde"
                        texto="Código de descuento aplicado"
                      />
                    )}
                    <Text style={styles.totalTexto}>{fmtColones(total ?? 0)}</Text>
                  </View>
                )}
                {(descuentoMonto === 0 && descuentoCodigoMonto === 0) && total !== null && (
                  <Text style={styles.totalTexto}>{fmtColones(total)}</Text>
                )}
                {total === null && (
                  <Text style={styles.hint}>
                    {modalidadPrecio === "hora"
                      ? horasNum
                        ? "Consultá el precio por hora con el proveedor."
                        : "Indicá cuántas horas necesitás para ver el precio."
                      : modalidadPrecio === "fijo"
                        ? "Consultá el precio del evento con el proveedor."
                        : invitadosNum
                          ? "Cotización personalizada — el proveedor te confirma el monto."
                          : "Indicá tus invitados para ver el precio."}
                  </Text>
                )}
              </Tarjeta>
            </View>

            <Boton
              texto="Siguiente: pagar el depósito"
              icono="arrow-forward"
              deshabilitado={!puedeAvanzar}
              onPress={() => irAPaso("pago")}
            />
          </>
        )}

        {paso === "pago" && (
          <>
            <Pressable onPress={() => irAPaso("datos")} hitSlop={8}>
              <Text style={styles.linkVolver}>← Volver a mis datos</Text>
            </Pressable>

            <View style={styles.bloque}>
              <Micro>Código de descuento</Micro>
              {codigoAplicado ? (
                <Tarjeta style={styles.filaCodigoAplicado}>
                  <Text style={styles.codigoOk}>
                    ✓ Código {codigoAplicado.codigo} aplicado
                    {codigoAplicado.tipo === "porcentaje"
                      ? ` (−${codigoAplicado.valor}%)`
                      : ` (−${fmtColones(codigoAplicado.valor)})`}
                  </Text>
                  <Pressable onPress={quitarCodigo} hitSlop={8}>
                    <Text style={styles.codigoQuitar}>Quitar</Text>
                  </Pressable>
                </Tarjeta>
              ) : (
                <View style={styles.filaCodigo}>
                  <TextInput
                    value={codigoInput}
                    onChangeText={setCodigoInput}
                    placeholder="Ej. BODA10"
                    autoCapitalize="characters"
                    style={[styles.input, { flex: 1 }]}
                    placeholderTextColor="#98a0b0"
                  />
                  <Boton
                    compacto
                    tono="navy"
                    texto="Aplicar"
                    cargando={verificandoCodigo}
                    deshabilitado={!codigoInput.trim()}
                    onPress={verificarCodigo}
                  />
                </View>
              )}
              {codigoError && <Aviso tono="error" texto={codigoError} />}
            </View>

            {promoAplicable && total !== null && (
              <View style={styles.filaPromoTag}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.green} />
                <Text style={styles.promoTagTexto}>
                  {promoAplicable.tipo === "precio_fijo"
                    ? `${promoAplicable.etiqueta || "Precio promocional"} — ${fmtColones(promoAplicable.precio_fijo ?? 0)} fijo`
                    : `${promoAplicable.etiqueta} aplicado (−${fmtColones(descuentoMonto)})`}
                </Text>
              </View>
            )}

            {/* Total y depósito lado a lado, como en el panel de la web. */}
            <View style={styles.filaTotales}>
              <Tarjeta style={styles.cajaTotal}>
                <Micro>Total del evento</Micro>
                {(descuentoMonto > 0 || descuentoCodigoMonto > 0) && subtotal !== null && (
                  <Text style={styles.precioTachado}>{fmtColones(subtotal)}</Text>
                )}
                <Text style={styles.cajaTotalValor}>
                  {total !== null ? fmtColones(total) : "A cotizar"}
                </Text>
              </Tarjeta>
              <Tarjeta style={[styles.cajaTotal, styles.cajaDeposito]}>
                <Micro>Depósito ahora</Micro>
                <Text style={[styles.cajaTotalValor, { color: Colors.accent }]}>
                  {fmtColones(rancho?.deposito_reserva ?? 25000)}
                </Text>
              </Tarjeta>
            </View>
            <Text style={styles.hint}>
              Solo el depósito se paga ahora — el resto de la cotización se coordina para el
              día del evento.
            </Text>

            {metodosDisponibles.length > 0 && (
              <>
                <View style={styles.bloque}>
                  <Micro>Cómo pagar</Micro>
                  <View style={styles.opciones}>
                    {metodosDisponibles.map((m) => (
                      <Opcion
                        key={m}
                        titulo={m === "sinpe" ? "SINPE Móvil" : "Transferencia bancaria"}
                        detalle={
                          m === "sinpe"
                            ? "Al número del proveedor"
                            : "A la cuenta del proveedor"
                        }
                        seleccionada={metodoPago === m}
                        onPress={() => setMetodoPago(m)}
                      />
                    ))}
                    {/* Prevista de Stripe: se ve, todavía no cobra —
                        cuando la pasarela esté viva esta fila se activa. */}
                    <Opcion
                      titulo="Tarjeta"
                      detalle="Muy pronto"
                      deshabilitada
                      onPress={() => {}}
                    />
                  </View>
                </View>

                {metodoPago === "sinpe" && rancho?.sinpe_numero && (
                  <Tarjeta style={styles.tarjetaDatos}>
                    <CampoCopiable
                      label="Número SINPE"
                      valor={rancho.sinpe_numero}
                      onCopiar={copiar}
                    />
                    {rancho.sinpe_titular && (
                      <CampoCopiable
                        label="A nombre de"
                        valor={rancho.sinpe_titular}
                        onCopiar={copiar}
                      />
                    )}
                  </Tarjeta>
                )}
                {metodoPago === "transferencia" && rancho?.cuenta_numero && (
                  <Tarjeta style={styles.tarjetaDatos}>
                    {rancho.cuenta_banco && (
                      <CampoCopiable
                        label="Banco"
                        valor={rancho.cuenta_banco}
                        onCopiar={copiar}
                      />
                    )}
                    <CampoCopiable
                      label="Número de cuenta"
                      valor={rancho.cuenta_numero}
                      onCopiar={copiar}
                    />
                    {rancho.cuenta_titular && (
                      <CampoCopiable
                        label="A nombre de"
                        valor={rancho.cuenta_titular}
                        onCopiar={copiar}
                      />
                    )}
                  </Tarjeta>
                )}

                <View style={styles.bloque}>
                  <Micro>Comprobante del depósito</Micro>
                  <Pressable style={styles.zonaFoto} onPress={elegirComprobante}>
                    {comprobanteUri ? (
                      <Image
                        source={{ uri: comprobanteUri }}
                        style={styles.previewFoto}
                        contentFit="cover"
                        alt="Comprobante de depósito"
                      />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={22} color={Colors.blue} />
                        <Text style={styles.zonaFotoTexto}>
                          Tocá para subir una foto del comprobante
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  style={styles.filaCheckbox}
                  onPress={() => setTerminosAceptados((v) => !v)}
                >
                  <Switch
                    value={terminosAceptados}
                    onValueChange={setTerminosAceptados}
                    trackColor={{ true: Colors.navy }}
                  />
                  <Text style={styles.avisoTexto}>
                    Acepto los términos y condiciones de la reserva.
                  </Text>
                </Pressable>
              </>
            )}

            {errorEnvio && <Aviso tono="error" texto={errorEnvio} />}

            <Boton
              texto="Confirmar mi reserva"
              cargando={enviando}
              deshabilitado={!puedeEnviar}
              onPress={enviarReserva}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Campo(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Micro>{props.label}</Micro>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType ?? "default"}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        style={styles.input}
        placeholderTextColor="#98a0b0"
      />
    </View>
  );
}

function PasoPill({
  numero,
  etiqueta,
  estado,
}: {
  numero: string;
  etiqueta: string;
  estado: "hecho" | "activo" | "pendiente";
}) {
  return (
    <View
      style={[
        styles.pasoPill,
        estado === "activo" && styles.pasoPillActivo,
        estado === "hecho" && styles.pasoPillHecho,
      ]}
    >
      <Text
        style={[
          styles.pasoPillTexto,
          estado === "activo" && styles.pasoPillTextoActivo,
          estado === "hecho" && styles.pasoPillTextoHecho,
        ]}
      >
        {numero} · {etiqueta}
      </Text>
    </View>
  );
}

function CampoCopiable({
  label,
  valor,
  onCopiar,
}: {
  label: string;
  valor: string;
  onCopiar: (v: string) => void;
}) {
  return (
    <Pressable style={styles.filaCopiable} onPress={() => onCopiar(valor)}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Micro>{label}</Micro>
        <Text style={styles.copiableValor}>{valor}</Text>
      </View>
      <Text style={styles.copiableAccion}>Copiar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  centro: {
    alignItems: "center",
    backgroundColor: Colors.canvas,
    flex: 1,
    justifyContent: "center",
  },
  centrado: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.three },
  botonesEstado: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  contenido: { gap: Spacing.four, padding: Spacing.three, paddingBottom: Spacing.five },

  reloj: {
    alignItems: "center",
    backgroundColor: Colors.skyLight,
    borderRadius: Radios.md,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  relojApurado: { backgroundColor: Colors.dangerLight },
  relojTexto: { color: "#a2490c", flex: 1, fontFamily: Fonts.bold, fontSize: 12.5 },

  identidadTarjeta: { padding: Spacing.three },

  pasos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pasoPill: {
    backgroundColor: Colors.cream2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pasoPillActivo: { backgroundColor: Colors.sky },
  pasoPillHecho: { backgroundColor: Colors.greenLight },
  pasoPillTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 11.5 },
  pasoPillTextoActivo: { color: "#ffffff" },
  pasoPillTextoHecho: { color: Colors.green },

  bloque: { gap: Spacing.two + 2 },
  opciones: { gap: Spacing.two },
  tarjetaCampos: { gap: Spacing.three, padding: Spacing.three },
  input: {
    backgroundColor: Colors.canvas,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },

  filaCheckbox: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.two,
  },
  avisoTexto: { color: Colors.inkSoft, flex: 1, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },

  tarjetaTotal: { gap: 6, padding: Spacing.three },
  totalTexto: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 27, letterSpacing: -0.8 },
  hint: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },

  linkVolver: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 13 },
  filaCodigo: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  filaCodigoAplicado: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
  },
  codigoOk: { color: Colors.green, flex: 1, fontFamily: Fonts.bold, fontSize: 13 },
  codigoQuitar: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 12.5 },

  filaPromoTag: { alignItems: "center", flexDirection: "row", gap: 6 },
  promoTagTexto: { color: Colors.green, flex: 1, fontFamily: Fonts.bold, fontSize: 11.5 },

  filaTotales: { flexDirection: "row", gap: Spacing.two },
  cajaTotal: { flex: 1, gap: 4, padding: Spacing.three },
  cajaDeposito: { backgroundColor: Colors.skyLight, borderColor: "#f7d8bd" },
  cajaTotalValor: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 19, letterSpacing: -0.4 },
  precioTachado: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    textDecorationLine: "line-through",
  },

  tarjetaDatos: { gap: Spacing.three, padding: Spacing.three },
  filaCopiable: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  copiableValor: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 15, marginTop: 2 },
  copiableAccion: { color: Colors.accent, fontFamily: Fonts.extraBold, fontSize: 12.5 },

  zonaFoto: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: "#cfd5e2",
    borderRadius: Radios.md,
    borderStyle: "dashed",
    borderWidth: 1.5,
    gap: 8,
    justifyContent: "center",
    minHeight: 130,
    overflow: "hidden",
  },
  zonaFotoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13,
    paddingHorizontal: Spacing.three,
    textAlign: "center",
  },
  previewFoto: { height: 180, width: "100%" },

  tarjetaExito: { alignItems: "center", padding: Spacing.four },
  exitoCheck: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.full,
    height: 58,
    justifyContent: "center",
    marginBottom: Spacing.three,
    width: 58,
  },
  exitoTitulo: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 21,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  exitoTexto: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
});
