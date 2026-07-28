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
import { obtenerIdDispositivo } from "@/lib/device";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- toma el hold temporal al montar, sin librería de data-fetching en este proyecto
    iniciar();
  }, [iniciar]);

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
  const total = subtotal === null ? null : subtotal - descuentoMonto;

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

  const puedeAvanzar =
    !!nombre.trim() &&
    CEDULA_REGEX.test(cedula.trim()) &&
    CORREO_REGEX.test(correo.trim()) &&
    WHATSAPP_REGEX.test(whatsapp.trim()) &&
    !!tipoEvento.trim() &&
    cotizacionCompleta &&
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
        p_codigo_descuento: null,
        p_descuento_monto: descuentoMonto,
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
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar la reserva.");
    } finally {
      setEnviando(false);
      setSubiendo(false);
    }
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
      <BarraSuperior titulo="Reservar" subtitulo={rancho?.nombre ?? undefined} />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
      <View style={styles.avisoTiempo}>
        <Text style={styles.avisoTiempoTexto}>
          Fecha bloqueada por {String(minutos).padStart(2, "0")}:{String(segundos).padStart(2, "0")} min — completá la reserva antes de que se libere.
        </Text>
      </View>

      <View style={styles.bloque}>
        <Text style={styles.bloqueTitulo}>Datos del evento — {fecha}</Text>
        <Campo label="Nombre completo" value={nombre} onChangeText={setNombre} />
        <Campo label="Cédula" value={cedula} onChangeText={setCedula} keyboardType="numeric" />
        <Campo label="Correo" value={correo} onChangeText={setCorreo} keyboardType="email-address" autoCapitalize="none" />
        <Campo label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
        <Campo label="Tipo de evento" value={tipoEvento} onChangeText={setTipoEvento} placeholder="Ej. cumpleaños, boda" />
        {modalidadPrecio === "hora" ? (
          <Campo label="Cantidad de horas" value={horasEvento} onChangeText={setHorasEvento} keyboardType="numeric" placeholder="Ej. 5" />
        ) : modalidadPrecio === "rango_personas" ? (
          <Campo label="Cantidad de invitados" value={invitados} onChangeText={setInvitados} keyboardType="numeric" />
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

      {metodosDisponibles.length > 0 && (
        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Cómo pagar</Text>
          <Text style={styles.hint}>
            Depósito de reserva: {fmtColones(rancho?.deposito_reserva ?? 25000)}
          </Text>
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
});
