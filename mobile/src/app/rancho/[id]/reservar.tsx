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
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { abrirHiloConsulta } from "@/lib/consulta";
import { useAuth } from "@/lib/auth-context";
import { obtenerIdDispositivo } from "@/lib/device";
import { pedirCorreosDeReserva } from "@/lib/notificaciones";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import {
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

export default function ReservarScreen() {
  const { id, fecha } = useLocalSearchParams<{ id: string; fecha: string }>();
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
  const [invitados, setInvitados] = useState("");
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

  const tierBase = useMemo(() => {
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
  }, [modalidadPrecio, horasNum, invitadosNum, esDiciembre, tiers, rancho]);

  const addonsTotal = servicios.reduce((acc, s) => {
    const eligible = !s.requisito_max_invitados || invitadosNum <= s.requisito_max_invitados;
    return acc + (eligible && addons[s.id] ? s.precio : 0);
  }, 0);

  const promoAplicable = useMemo(() => {
    const dow = fechaObj.getDay();
    const activas = promociones.filter((p) => p.activo && p.dias_semana.includes(dow));
    if (activas.length === 0) return null;
    return activas.reduce((mejor, p) =>
      p.porcentaje_descuento > mejor.porcentaje_descuento ? p : mejor,
    );
  }, [fechaObj, promociones]);

  const subtotal = tierBase === null ? null : tierBase + addonsTotal;
  const descuentoMonto =
    subtotal !== null && promoAplicable
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
    (rancho?.horarios_bloques.length ? !!horario : true) &&
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
        <BarraSuperior titulo="Reservar" />
        <View style={styles.centro}>
          <Text style={styles.tituloConfirmacion}>Iniciá sesión para reservar</Text>
          <Text style={styles.textoConfirmacion}>
            Tu reserva queda ligada a tu cuenta: ahí ves el estado, el chat
            con el proveedor y tu historial — y tus datos llegan precargados.
          </Text>
          <Pressable style={styles.botonPrimario} onPress={() => router.push("/cuenta")}>
            <Text style={styles.botonPrimarioTexto}>Iniciar sesión</Text>
          </Pressable>
          <Pressable style={styles.botonSecundario} onPress={() => router.back()}>
            <Text style={styles.botonSecundarioTexto}>Volver</Text>
          </Pressable>
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
      <View style={styles.centro}>
        <Text style={styles.error}>{errorCarga ?? errorHold}</Text>
        <Pressable style={styles.botonSecundario} onPress={() => router.back()}>
          <Text style={styles.botonSecundarioTexto}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  if (confirmado) {
    return (
      <View style={styles.centro}>
        <Text style={styles.tituloConfirmacion}>¡Reserva recibida!</Text>
        <Text style={styles.textoConfirmacion}>
          Quedó en revisión — {rancho?.nombre} va a confirmarla en cuanto revise tu comprobante.
          Te llegará un correo a {correo}.
        </Text>
        <Pressable style={styles.botonPrimario} onPress={() => router.dismissTo("/")}>
          <Text style={styles.botonPrimarioTexto}>Volver al directorio</Text>
        </Pressable>
      </View>
    );
  }

  const minutos = segundosRestantes !== null ? Math.floor(segundosRestantes / 60) : 0;
  const segundos = segundosRestantes !== null ? segundosRestantes % 60 : 0;

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo="Reservar"
        subtitulo={rancho?.nombre ?? undefined}
        accion={{
          icono: "chatbubble-ellipses-outline",
          etiqueta: rancho ? `Chateá con ${rancho.nombre}` : "Chat",
          onPress: chatearConProveedor,
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}
      >
      <View style={styles.avisoTiempo}>
        <Text style={styles.avisoTiempoTexto}>
          Fecha bloqueada por {String(minutos).padStart(2, "0")}:{String(segundos).padStart(2, "0")} min — completá la reserva antes de que se libere.
        </Text>
      </View>

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
          etiqueta="Pagar depósito"
          estado={paso === "pago" ? "activo" : "pendiente"}
        />
      </View>

      {paso === "datos" && (<>
      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>Datos del evento — {fecha}</Text>
        <Campo label="Nombre completo *" value={nombre} onChangeText={setNombre} />
        <Campo label="Cédula *" value={cedula} onChangeText={setCedula} keyboardType="numeric" />
        <Campo label="Correo *" value={correo} onChangeText={setCorreo} keyboardType="email-address" autoCapitalize="none" />
        <Campo label="WhatsApp *" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
        <Campo label="Tipo de evento" value={tipoEvento} onChangeText={setTipoEvento} placeholder="Ej. cumpleaños, boda" />
        {modalidadPrecio === "hora" ? (
          <Campo label="Cantidad de horas" value={horasEvento} onChangeText={setHorasEvento} keyboardType="numeric" placeholder="Ej. 5" />
        ) : modalidadPrecio === "rango_personas" ? (
          <>
            <Campo
              label={
                rancho?.capacidad_max
                  ? `Cantidad de invitados (máximo ${rancho.capacidad_max})`
                  : "Cantidad de invitados"
              }
              value={invitados}
              onChangeText={setInvitados}
              keyboardType="numeric"
            />
            {excedeCapacidad && (
              <Text style={styles.avisoCapacidad}>
                Este lugar recibe hasta {rancho?.capacidad_max} personas — para
                grupos más grandes, escribile directo para coordinar.
              </Text>
            )}
          </>
        ) : null}

        {rancho && rancho.horarios_bloques.length > 0 && (
          <View style={styles.gap2}>
            <Text style={styles.campoLabel}>Horario</Text>
            <View style={styles.chips}>
              {rancho.horarios_bloques.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => setHorario(h)}
                  style={[styles.chip, horario?.id === h.id && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, horario?.id === h.id && styles.chipTextoActivo]}>
                    {etiquetaHorario(h)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {servicios.length > 0 && (
          <View style={styles.gap2}>
            <Text style={styles.campoLabel}>Servicios adicionales</Text>
            {servicios.map((s) => (
              <Pressable
                key={s.id}
                style={styles.filaAddon}
                onPress={() => setAddons((a) => ({ ...a, [s.id]: !a[s.id] }))}
              >
                <Switch
                  value={!!addons[s.id]}
                  onValueChange={(v) => setAddons((a) => ({ ...a, [s.id]: v }))}
                  trackColor={{ true: Colors.navy }}
                />
                <Text style={styles.addonTexto}>
                  {s.nombre} — {fmtColones(s.precio)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={styles.filaCheckbox} onPress={() => setAvisoAceptado((v) => !v)}>
          <Switch value={avisoAceptado} onValueChange={setAvisoAceptado} trackColor={{ true: Colors.navy }} />
          <Text style={styles.avisoTexto}>
            Entiendo que este lugar no se alquila para serenatas, fiestas de menores de edad ni
            fiestas clandestinas donde se venda alcohol. Si reservo para uno de estos casos, acepto
            que se cancele sin devolución de dinero.
          </Text>
        </Pressable>
      </View>

      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>Cotización estimada</Text>
        {promoAplicable && total !== null && (
          <Text style={styles.promoTexto}>
            {promoAplicable.etiqueta || "Promoción"} · -{promoAplicable.porcentaje_descuento}%
          </Text>
        )}
        {total !== null ? (
          <Text style={styles.totalTexto}>{fmtColones(total)}</Text>
        ) : (
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
      </View>

      <Pressable
        style={[styles.botonSiguiente, !puedeAvanzar && styles.botonDeshabilitado]}
        disabled={!puedeAvanzar}
        onPress={() => irAPaso("pago")}
      >
        <Text style={styles.botonPrimarioTexto}>Siguiente: pagar el depósito →</Text>
      </Pressable>
      </>)}

      {paso === "pago" && (<>
      <Pressable onPress={() => irAPaso("datos")}>
        <Text style={styles.linkVolver}>← Volver a mis datos</Text>
      </Pressable>

      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>Código de descuento</Text>
        {codigoAplicado ? (
          <View style={styles.filaCodigo}>
            <Text style={styles.codigoOk}>
              ✓ Código {codigoAplicado.codigo} aplicado
              {codigoAplicado.tipo === "porcentaje"
                ? ` (-${codigoAplicado.valor}%)`
                : ` (-${fmtColones(codigoAplicado.valor)})`}
            </Text>
            <Pressable onPress={quitarCodigo}>
              <Text style={styles.codigoQuitar}>Quitar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.filaCodigo}>
            <TextInput
              value={codigoInput}
              onChangeText={setCodigoInput}
              placeholder="Ej. BODA10"
              autoCapitalize="characters"
              style={[styles.input, { flex: 1 }]}
              placeholderTextColor={Colors.inkSoft}
            />
            <Pressable
              style={[
                styles.botonCodigo,
                (!codigoInput.trim() || verificandoCodigo) && styles.botonDeshabilitado,
              ]}
              disabled={!codigoInput.trim() || verificandoCodigo}
              onPress={verificarCodigo}
            >
              {verificandoCodigo ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.botonPrimarioTexto}>Aplicar</Text>
              )}
            </Pressable>
          </View>
        )}
        {codigoError && <Text style={styles.error}>{codigoError}</Text>}
      </View>

      {/* Total y depósito lado a lado, como en el panel de la web. */}
      <View style={styles.filaTotales}>
        <View style={[styles.cajaTotal, { backgroundColor: Colors.cream2 }]}>
          <Text style={styles.cajaTotalLabel}>Total estimado del evento</Text>
          {promoAplicable && total !== null && (
            <Text style={styles.promoTexto}>
              {promoAplicable.etiqueta || "Promoción"} · -{promoAplicable.porcentaje_descuento}%
            </Text>
          )}
          {(descuentoMonto > 0 || descuentoCodigoMonto > 0) && subtotal !== null && (
            <Text style={styles.precioTachado}>{fmtColones(subtotal)}</Text>
          )}
          <Text style={styles.cajaTotalValor}>
            {total !== null ? fmtColones(total) : "A cotizar"}
          </Text>
        </View>
        <View style={[styles.cajaTotal, { backgroundColor: Colors.accentLight }]}>
          <Text style={styles.cajaTotalLabel}>Depósito (se paga ahora)</Text>
          <Text style={[styles.cajaTotalValor, { color: Colors.accent }]}>
            {fmtColones(rancho?.deposito_reserva ?? 25000)}
          </Text>
        </View>
      </View>
      <Text style={styles.hint}>
        Solo el depósito se paga ahora — el resto de la cotización se coordina
        para el día del evento.
      </Text>

      {metodosDisponibles.length > 0 && (
        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Cómo pagar</Text>
          <View style={styles.chips}>
            {metodosDisponibles.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMetodoPago(m)}
                style={[styles.chip, metodoPago === m && styles.chipActivo]}
              >
                <Text style={[styles.chipTexto, metodoPago === m && styles.chipTextoActivo]}>
                  {m === "sinpe" ? "SINPE Móvil" : "Transferencia bancaria"}
                </Text>
              </Pressable>
            ))}
            {/* Prevista de Stripe: se ve, todavía no cobra — cuando la
                pasarela esté viva este chip se activa. */}
            <View style={[styles.chip, { opacity: 0.55 }]}>
              <Text style={styles.chipTexto}>💳 Tarjeta — muy pronto</Text>
            </View>
          </View>

          {metodoPago === "sinpe" && rancho?.sinpe_numero && (
            <View style={styles.tarjetaDatos}>
              <CampoCopiable label="Número SINPE" valor={rancho.sinpe_numero} onCopiar={copiar} />
              {rancho.sinpe_titular && (
                <CampoCopiable label="A nombre de" valor={rancho.sinpe_titular} onCopiar={copiar} />
              )}
            </View>
          )}
          {metodoPago === "transferencia" && rancho?.cuenta_numero && (
            <View style={styles.tarjetaDatos}>
              {rancho.cuenta_banco && (
                <CampoCopiable label="Banco" valor={rancho.cuenta_banco} onCopiar={copiar} />
              )}
              <CampoCopiable label="Número de cuenta" valor={rancho.cuenta_numero} onCopiar={copiar} />
              {rancho.cuenta_titular && (
                <CampoCopiable label="A nombre de" valor={rancho.cuenta_titular} onCopiar={copiar} />
              )}
            </View>
          )}

          <Pressable style={styles.zonaFoto} onPress={elegirComprobante}>
            {comprobanteUri ? (
              <Image
                source={{ uri: comprobanteUri }}
                style={styles.previewFoto}
                contentFit="cover"
                alt="Comprobante de depósito"
              />
            ) : (
              <Text style={styles.zonaFotoTexto}>Tocá para subir una foto del comprobante</Text>
            )}
          </Pressable>

          <Pressable style={styles.filaCheckbox} onPress={() => setTerminosAceptados((v) => !v)}>
            <Switch value={terminosAceptados} onValueChange={setTerminosAceptados} trackColor={{ true: Colors.navy }} />
            <Text style={styles.avisoTexto}>Acepto los términos y condiciones de la reserva.</Text>
          </Pressable>
        </View>
      )}

      {errorEnvio && <Text style={styles.error}>{errorEnvio}</Text>}

      <Pressable
        style={[styles.botonPrimario, !puedeEnviar && styles.botonDeshabilitado]}
        disabled={!puedeEnviar}
        onPress={enviarReserva}
      >
        {enviando ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.botonPrimarioTexto}>Confirmar mi reserva</Text>
        )}
      </Pressable>
      </>)}
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
    <View style={styles.gap2}>
      <Text style={styles.campoLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType ?? "default"}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        style={styles.input}
        placeholderTextColor={Colors.inkSoft}
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
      <View>
        <Text style={styles.copiableLabel}>{label}</Text>
        <Text style={styles.copiableValor}>{valor}</Text>
      </View>
      <Text style={styles.copiableAccion}>Copiar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.three },
  error: { color: Colors.danger, textAlign: "center" },
  avisoTiempo: {
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    padding: Spacing.three,
  },
  avisoTiempoTexto: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 13, textAlign: "center" },
  avisoCapacidad: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 12, marginTop: -4 },
  bloque: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.line,
    gap: Spacing.three,
  },
  bloqueTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink },
  gap2: { gap: 6 },
  campoLabel: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft, textTransform: "uppercase" },
  input: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.ink,
    backgroundColor: Colors.cream,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.cream2,
  },
  chipActivo: { backgroundColor: Colors.navy },
  chipTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  chipTextoActivo: { color: "#ffffff" },
  filaAddon: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  addonTexto: { fontSize: 14, color: Colors.ink, flexShrink: 1 },
  filaCheckbox: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.two, marginTop: Spacing.two },
  avisoTexto: { fontSize: 12.5, color: Colors.inkSoft, flex: 1, lineHeight: 18 },
  promoTexto: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.green },
  totalTexto: { fontSize: 26, fontFamily: Fonts.extraBold, color: Colors.ink },
  hint: { fontSize: 13, color: Colors.inkSoft },
  tarjetaDatos: { backgroundColor: Colors.cream, borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  filaCopiable: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  copiableLabel: { fontSize: 11, color: Colors.inkSoft, textTransform: "uppercase", fontFamily: Fonts.bold },
  copiableValor: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.ink },
  copiableAccion: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.accent },
  zonaFoto: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.line,
    borderRadius: 12,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zonaFotoTexto: { color: Colors.inkSoft, fontSize: 13, padding: Spacing.three, textAlign: "center" },
  previewFoto: { width: "100%", height: 160 },
  botonPrimario: {
    backgroundColor: Colors.navy,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonDeshabilitado: { opacity: 0.4 },
  botonPrimarioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
  botonSecundario: { paddingVertical: 10, paddingHorizontal: Spacing.four },
  botonSecundarioTexto: { color: Colors.accent, fontFamily: Fonts.bold },
  tituloConfirmacion: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.ink, textAlign: "center" },
  textoConfirmacion: { fontSize: 14, color: Colors.inkSoft, textAlign: "center" },
  pasos: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  pasoPill: {
    backgroundColor: Colors.cream2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pasoPillActivo: { backgroundColor: Colors.accent },
  pasoPillHecho: { backgroundColor: Colors.greenLight },
  pasoPillTexto: { fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  pasoPillTextoActivo: { color: "#ffffff" },
  pasoPillTextoHecho: { color: Colors.green },
  botonSiguiente: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  linkVolver: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 13 },
  filaCodigo: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  botonCodigo: {
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  codigoOk: { flex: 1, fontSize: 13, fontFamily: Fonts.bold, color: Colors.green },
  codigoQuitar: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.danger },
  filaTotales: { flexDirection: "row", gap: Spacing.two },
  cajaTotal: { flex: 1, borderRadius: 12, padding: Spacing.three, gap: 2 },
  cajaTotalLabel: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    color: Colors.inkSoft,
    textTransform: "uppercase",
  },
  cajaTotalValor: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.ink },
  precioTachado: { fontSize: 13, color: Colors.inkSoft, textDecorationLine: "line-through" },
});
