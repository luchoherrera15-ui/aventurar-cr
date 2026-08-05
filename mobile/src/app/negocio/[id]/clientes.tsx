import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/finanzas";
import { fechaISOLocal, MESES_CORTO } from "@/lib/citas";
import {
  agruparClientes,
  DIAS_INACTIVO,
  esInactivo,
  esReincidente,
  type ClienteCRM,
  type ReservaCliente,
  type SegmentoCampana,
} from "@/lib/crm";

/**
 * El CRM del negocio de citas desde el teléfono — la pantalla que en
 * la web vive en /mi-negocio/[id]/citas (ClientesPanel): quién viene,
 * quién dejó de venir y quién está fallando, con el botón para
 * escribirle una promoción de re-enganche ahí mismo. La ficha se
 * deriva de las reservas (lib crm, gemelo de crm-citas de /web); el
 * envío necesita secretos del servidor, así que el teléfono delega en
 * POST /api/citas/campanas con el token de la sesión.
 */

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

type Filtro = "todos" | "no_show" | "inactivos";

const FILTRO_LABEL: Record<Filtro, string> = {
  todos: "Todos",
  no_show: "Faltan seguido",
  inactivos: "Inactivos",
};

type Destino =
  | { tipo: "cliente"; cliente: ClienteCRM }
  | { tipo: "segmento"; segmento: SegmentoCampana; correos: string[] };

/** Lo que devuelve POST /api/citas/campanas. */
type ResultadoCampana = {
  error: string | null;
  enviados: number;
  fallidos: number;
  excluidos: number;
  omitidosRecientes: number;
};

/** "2026-08-03" → "3 ago" (como fmtFechaCorta de /web). */
function fmtFechaCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTO[m - 1] ?? ""}`;
}

export default function ClientesNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteCRM[] | null>(null);

  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  // La campaña en curso: a quién va, con su asunto y mensaje editables.
  const [destino, setDestino] = useState<Destino | null>(null);
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCampana | null>(null);

  const cargar = useCallback(async () => {
    if (!id || !session) return;
    const [ranchoRes, reservasRes] = await Promise.all([
      supabase.from("ranchos").select("nombre").eq("id", id).maybeSingle(),
      supabase
        .from("reservas")
        .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
        .eq("rancho_id", id)
        .not("hora_inicio", "is", null)
        .order("fecha", { ascending: false })
        .limit(3000),
    ]);
    setNombreNegocio((ranchoRes.data as { nombre: string } | null)?.nombre ?? null);
    const filas = (reservasRes.data ?? []) as ReservaCliente[];
    setClientes(agruparClientes(filas, fechaISOLocal(new Date())));
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const lista = useMemo(() => clientes ?? [], [clientes]);
  const reincidentes = useMemo(() => lista.filter(esReincidente), [lista]);
  const inactivos = useMemo(() => lista.filter((c) => esInactivo(c)), [lista]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let base = lista;
    if (filtro === "no_show") base = reincidentes;
    if (filtro === "inactivos") base = inactivos;
    if (!q) return base;
    return base.filter(
      (c) =>
        (c.nombre ?? "").toLowerCase().includes(q) ||
        (c.correo ?? "").toLowerCase().includes(q) ||
        (c.whatsapp ?? "").includes(q),
    );
  }, [busqueda, filtro, lista, reincidentes, inactivos]);

  const negocio = nombreNegocio ?? "nuestro negocio";

  function abrirPromoCliente(cliente: ClienteCRM) {
    setResultado(null);
    setDestino({ tipo: "cliente", cliente });
    setAsunto(`Te extrañamos en ${negocio} — tu próxima cita te espera`);
    setMensaje(
      `Hola ${cliente.nombre?.split(" ")[0] ?? ""}:\n\nHace tiempo no te vemos por ${negocio} y queremos que volvás. Escribinos o reservá en línea y te guardamos el espacio.\n\n¡Te esperamos!`,
    );
  }

  function abrirCampanaSegmento(segmento: SegmentoCampana, correos: string[]) {
    setResultado(null);
    setDestino({ tipo: "segmento", segmento, correos });
    setAsunto(
      segmento === "inactivos" ? `Te extrañamos en ${negocio}` : `Novedades de ${negocio}`,
    );
    setMensaje(
      segmento === "inactivos"
        ? `Hola:\n\nHace tiempo no te vemos por ${negocio}. Reservá tu próxima cita en línea — te esperamos.\n`
        : `Hola:\n\nEn ${negocio} tenemos novedades para vos. Reservá tu próxima cita en línea.\n`,
    );
  }

  /**
   * El envío pasa por el servidor de /web: consentimiento con ámbito,
   * frenos anti-abuso y la bitácora viven allá (route campanas).
   */
  async function enviar() {
    if (!destino || !session || enviando) return;
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch(`${SITIO_URL}/api/citas/campanas`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ranchoId: id,
          tipo:
            destino.tipo === "cliente" || destino.segmento !== "todos"
              ? "reenganche"
              : "campana",
          segmento:
            destino.tipo === "cliente"
              ? "manual"
              : destino.segmento === "todos"
                ? "todos"
                : destino.segmento,
          asunto,
          mensaje,
          correos:
            destino.tipo === "cliente" ? [destino.cliente.correo ?? ""] : destino.correos,
        }),
      });
      const data = (await res.json()) as ResultadoCampana;
      setResultado(data);
      if (!data.error) setDestino(null);
    } catch {
      setResultado({
        error: "No hubo conexión con el servidor. Intentá de nuevo.",
        enviados: 0,
        fallidos: 0,
        excluidos: 0,
        omitidosRecientes: 0,
      });
    } finally {
      setEnviando(false);
    }
  }

  const correosDe = (grupo: ClienteCRM[]) => [
    ...new Set(grupo.filter((c) => c.correo).map((c) => c.correo as string)),
  ];

  // Mismo resguardo que las pantallas hermanas del panel: sin sesión no
  // hay panel (y las políticas RLS ya limitan los datos al dueño).
  if (!session) {
    router.replace("/cuenta");
    return null;
  }

  if (clientes === null) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Clientes" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  const nombresReincidentes =
    reincidentes
      .slice(0, 3)
      .map((c) => c.nombre ?? "sin nombre")
      .join(", ") + (reincidentes.length > 3 ? ` y ${reincidentes.length - 3} más` : "");

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Clientes" subtitulo={nombreNegocio ?? undefined} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {lista.length === 0 ? (
          <View style={styles.bloque}>
            <Text style={styles.vacio}>
              Tus clientes van a aparecer acá solos, con su historial de citas,
              cuando entren las primeras reservas.
            </Text>
          </View>
        ) : (
          <>
            {/* Resumen: cuántos son y cuántos piden atención. */}
            <View style={styles.resumen}>
              <View style={styles.cifra}>
                <Text style={styles.cifraLabel}>Clientes</Text>
                <Text style={styles.cifraNumero}>{lista.length}</Text>
              </View>
              <View style={[styles.cifra, reincidentes.length > 0 && styles.cifraRoja]}>
                <Text style={styles.cifraLabel}>Faltan seguido</Text>
                <Text
                  style={[
                    styles.cifraNumero,
                    reincidentes.length > 0 && { color: Colors.danger },
                  ]}
                >
                  {reincidentes.length}
                </Text>
              </View>
              <View style={[styles.cifra, inactivos.length > 0 && styles.cifraNaranja]}>
                <Text style={styles.cifraLabel}>{DIAS_INACTIVO}+ días sin venir</Text>
                <Text style={styles.cifraNumero}>{inactivos.length}</Text>
              </View>
            </View>

            {reincidentes.length > 0 && (
              <View style={styles.alerta}>
                <Text style={styles.alertaTexto}>
                  <Text style={styles.alertaFuerte}>
                    {reincidentes.length === 1
                      ? "Un cliente te está fallando"
                      : `${reincidentes.length} clientes te están fallando`}
                    :
                  </Text>{" "}
                  {nombresReincidentes} faltaron a sus últimas 2 citas (o más). Una
                  promoción a tiempo suele recuperarlos.
                </Text>
              </View>
            )}

            {/* Campañas por segmento. */}
            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Escribirles por correo</Text>
              <View style={styles.filaBotones}>
                <BotonSegmento
                  texto={`A todos (${correosDe(lista).length})`}
                  deshabilitado={correosDe(lista).length === 0}
                  onPress={() => abrirCampanaSegmento("todos", correosDe(lista))}
                />
                <BotonSegmento
                  texto={`A los inactivos (${correosDe(inactivos).length})`}
                  deshabilitado={correosDe(inactivos).length === 0}
                  onPress={() => abrirCampanaSegmento("inactivos", correosDe(inactivos))}
                />
                <BotonSegmento
                  texto={`A los que faltan (${correosDe(reincidentes).length})`}
                  deshabilitado={correosDe(reincidentes).length === 0}
                  onPress={() => abrirCampanaSegmento("no_show", correosDe(reincidentes))}
                />
              </View>
            </View>

            {/* El formulario de la campaña. */}
            {destino && (
              <View style={[styles.bloque, styles.bloqueCampana]}>
                <Text style={styles.bloqueTitulo}>
                  {destino.tipo === "cliente"
                    ? `Promoción para ${destino.cliente.nombre ?? destino.cliente.correo}`
                    : `Correo a ${destino.correos.length} cliente${destino.correos.length === 1 ? "" : "s"}`}
                </Text>
                <Text style={styles.bloqueAyuda}>
                  Sale con el nombre de {negocio} a través de Bookea, con link de
                  baja incluido. No se le repite al que ya le escribiste hace poco
                  ni al que se dio de baja.
                </Text>
                <View style={styles.campo}>
                  <Text style={styles.campoLabel}>Asunto</Text>
                  <TextInput
                    value={asunto}
                    onChangeText={setAsunto}
                    maxLength={150}
                    placeholder="Asunto del correo"
                    placeholderTextColor={Colors.inkMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.campo}>
                  <Text style={styles.campoLabel}>Mensaje</Text>
                  <TextInput
                    value={mensaje}
                    onChangeText={setMensaje}
                    maxLength={5000}
                    multiline
                    textAlignVertical="top"
                    placeholder="El mensaje para tus clientes"
                    placeholderTextColor={Colors.inkMuted}
                    style={[styles.input, styles.inputMultilinea]}
                  />
                </View>
                <View style={styles.filaBotones}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Enviar la campaña"
                    disabled={enviando || !asunto.trim() || !mensaje.trim()}
                    onPress={enviar}
                    style={[
                      styles.botonEnviar,
                      (enviando || !asunto.trim() || !mensaje.trim()) && { opacity: 0.5 },
                    ]}
                  >
                    {enviando ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.botonEnviarTexto}>Enviar</Text>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar la campaña"
                    disabled={enviando}
                    onPress={() => setDestino(null)}
                    style={styles.botonCancelar}
                  >
                    <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* El resultado del envío, con lo que quedó fuera y por qué. */}
            {resultado && (
              <View style={[styles.aviso, resultado.error ? styles.avisoError : styles.avisoOk]}>
                <Text
                  style={[
                    styles.avisoTexto,
                    { color: resultado.error ? Colors.danger : Colors.green },
                  ]}
                >
                  {resultado.error
                    ? resultado.error
                    : `Se ${
                        resultado.enviados === 1
                          ? "envió 1 correo"
                          : `enviaron ${resultado.enviados} correos`
                      }.` +
                      (resultado.excluidos > 0
                        ? ` ${resultado.excluidos} quedaron fuera (dados de baja o correo rebotado).`
                        : "") +
                      (resultado.omitidosRecientes > 0
                        ? ` ${resultado.omitidosRecientes} ya recibieron un correo tuyo hace poco.`
                        : "") +
                      (resultado.fallidos > 0 ? ` ${resultado.fallidos} fallaron.` : "")}
                </Text>
              </View>
            )}

            {/* Filtros y búsqueda. */}
            <View style={styles.filaBotones}>
              {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filtro === f }}
                  onPress={() => setFiltro(f)}
                  style={[styles.chip, filtro === f && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, filtro === f && styles.chipTextoActivo]}>
                    {FILTRO_LABEL[f]}
                    {f === "no_show" && reincidentes.length > 0 ? ` (${reincidentes.length})` : ""}
                    {f === "inactivos" && inactivos.length > 0 ? ` (${inactivos.length})` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar por nombre, correo o teléfono"
              placeholderTextColor={Colors.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Buscar cliente"
              style={styles.input}
            />

            {/* La lista de fichas. */}
            {visibles.length === 0 ? (
              <View style={styles.bloque}>
                <Text style={styles.vacio}>Ningún cliente calza con ese filtro.</Text>
              </View>
            ) : (
              <View style={styles.listaClientes}>
                {visibles.slice(0, 100).map((c, i) => (
                  <View key={c.clave} style={[styles.filaCliente, i > 0 && styles.filaBorde]}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarTexto}>
                        {(c.nombre ?? c.correo ?? "?").trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.filaNombre}>
                        <Text style={styles.clienteNombre} numberOfLines={1}>
                          {c.nombre ?? c.correo ?? c.whatsapp ?? "Cliente"}
                        </Text>
                        {esReincidente(c) && (
                          <View style={[styles.badge, styles.badgeRojo]}>
                            <Text style={[styles.badgeTexto, { color: Colors.danger }]}>
                              Faltó a sus últimas {c.fallosSeguidos}
                            </Text>
                          </View>
                        )}
                        {esInactivo(c) && (
                          <View style={[styles.badge, styles.badgeNaranja]}>
                            <Text style={[styles.badgeTexto, { color: "#a2490c" }]}>
                              {c.diasSinVenir} días sin venir
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.clienteDetalle}>
                        {c.cumplidas} visita{c.cumplidas === 1 ? "" : "s"}
                        {c.noAsistio > 0 &&
                          ` · ${c.noAsistio} no-show${c.noAsistio === 1 ? "" : "s"}`}
                        {c.gastoTotal > 0 && ` · ${fmtColones(c.gastoTotal)}`}
                        {c.ultimaVisita && ` · última: ${fmtFechaCorta(c.ultimaVisita)}`}
                        {c.proximaCita && (
                          <Text style={styles.proxima}>
                            {" "}
                            · próxima: {fmtFechaCorta(c.proximaCita)}
                          </Text>
                        )}
                      </Text>
                      {(c.correo || c.whatsapp) && (
                        <Text style={styles.clienteContacto} numberOfLines={1}>
                          {[c.correo, c.whatsapp].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                      {c.correo && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Mandar promo a ${c.nombre ?? c.correo}`}
                          onPress={() => abrirPromoCliente(c)}
                          style={styles.botonPromo}
                        >
                          <Text style={styles.botonPromoTexto}>Mandar promo</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
                {visibles.length > 100 && (
                  <Text style={styles.nota}>
                    Se muestran los primeros 100 — usá la búsqueda para encontrar al
                    resto.
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Botón de campaña por segmento: contorno, se apaga sin correos. */
function BotonSegmento({
  texto,
  deshabilitado,
  onPress,
}: {
  texto: string;
  deshabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.botonSegmento,
        deshabilitado && { opacity: 0.4 },
        pressed && !deshabilitado && { opacity: 0.85 },
      ]}
    >
      <Text style={styles.botonSegmentoTexto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  resumen: { flexDirection: "row", gap: Spacing.two },
  cifra: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two + 4,
  },
  cifraRoja: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger },
  cifraNaranja: { backgroundColor: Colors.skyLight, borderColor: Colors.sky },
  cifraLabel: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  cifraNumero: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 18 },

  alerta: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.danger,
    borderRadius: Radios.md,
    borderWidth: 1,
    padding: Spacing.three,
  },
  alertaTexto: { color: Colors.ink, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },
  alertaFuerte: { fontFamily: Fonts.extraBold },

  bloque: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  bloqueCampana: { borderColor: Colors.navy },
  bloqueTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  bloqueAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17 },
  vacio: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: Spacing.two,
  },

  filaBotones: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  botonSegmento: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  botonSegmentoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },

  campo: { gap: 5 },
  campoLabel: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: Colors.cream,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  inputMultilinea: { minHeight: 120 },
  botonEnviar: {
    alignItems: "center",
    backgroundColor: Colors.sky,
    borderRadius: 12,
    justifyContent: "center",
    minWidth: 110,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  botonEnviarTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
  botonCancelar: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  botonCancelarTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 13 },

  aviso: { borderRadius: Radios.md, padding: Spacing.three },
  avisoError: { backgroundColor: Colors.dangerLight },
  avisoOk: { backgroundColor: Colors.greenLight },
  avisoTexto: { fontFamily: Fonts.bold, fontSize: 12.5, lineHeight: 18 },

  chip: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 12.5 },
  chipTextoActivo: { color: "#ffffff" },

  listaClientes: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: Spacing.three,
  },
  filaCliente: {
    flexDirection: "row",
    gap: Spacing.two + 2,
    paddingVertical: Spacing.three,
  },
  filaBorde: { borderTopColor: Colors.line, borderTopWidth: 1 },
  avatar: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: Radios.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 15 },
  filaNombre: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  clienteNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeRojo: { backgroundColor: Colors.dangerLight },
  badgeNaranja: { backgroundColor: Colors.skyLight },
  badgeTexto: { fontFamily: Fonts.bold, fontSize: 10.5 },
  clienteDetalle: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  proxima: { color: Colors.green, fontFamily: Fonts.bold },
  clienteContacto: { color: Colors.inkMuted, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 2 },
  botonPromo: {
    alignSelf: "flex-start",
    backgroundColor: Colors.cream2,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    marginTop: Spacing.two,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  botonPromoTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12 },
  nota: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12,
    paddingVertical: Spacing.two + 4,
  },
});
