import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * Sincronizar agendas: el dueño conecta el calendario que ya usa
 * (Google o Apple) pegando su dirección .ics privada, y Bookea importa
 * sus compromisos como bloqueos — esas horas dejan de ofrecerse en el
 * sitio y en la app. Las filas viven en `agendas_externas` (migración
 * 0072, RLS del dueño); el fetch + parseo + importación los hace el
 * servidor en /api/agendas/[id]/sync.
 */

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

type AgendaExterna = {
  id: string;
  nombre: string;
  url: string;
  ultima_sync: string | null;
  ultimo_error: string | null;
  eventos_importados: number;
};

type RespuestaSync = { ok: boolean; importados?: number; error?: string };

/** "hace 5 min", "hace 3 horas", "hace 2 días" — o null si nunca. */
function haceCuanto(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas === 1 ? "hace 1 hora" : `hace ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/**
 * Deja la URL lista para guardar: webcal:// (lo que da iCloud) se
 * convierte a https://. Devuelve null si no parece un enlace de
 * calendario válido.
 */
function normalizarUrl(cruda: string): string | null {
  let url = cruda.trim();
  if (/^webcal:\/\//i.test(url)) url = "https://" + url.slice("webcal://".length);
  if (!/^https:\/\//i.test(url)) return null;
  if (!url.includes(".")) return null;
  return url;
}

/** La tabla llega con la migración 0072; sin ella, aviso amable. */
function esTablaAusente(detalle: string): boolean {
  return /agendas_externas|schema cache|does not exist/i.test(detalle);
}

function avisarTablaAusente() {
  Alert.alert(
    "Todavía no está lista",
    "La sincronización se habilita con la próxima actualización de la base.",
  );
}

export default function SincronizarAgendasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null);
  const [agendas, setAgendas] = useState<AgendaExterna[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [verInstrucciones, setVerInstrucciones] = useState(false);

  // El formulario para conectar un calendario nuevo.
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Qué fila está sincronizando ahora mismo (spinner en su botón).
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null);

  // El aviso de "tabla todavía no existe" se muestra una sola vez por
  // visita, no en cada pull-to-refresh.
  const avisado = useRef(false);

  const cargar = useCallback(async () => {
    if (!session) return;
    const [ranchoRes, agendasRes] = await Promise.all([
      supabase.from("ranchos").select("nombre").eq("id", id).maybeSingle(),
      supabase
        .from("agendas_externas")
        .select("id, nombre, url, ultima_sync, ultimo_error, eventos_importados")
        .eq("rancho_id", id)
        .order("created_at", { ascending: true }),
    ]);
    setNombreNegocio((ranchoRes.data as { nombre: string } | null)?.nombre ?? null);
    if (agendasRes.error) {
      if (esTablaAusente(agendasRes.error.message) && !avisado.current) {
        avisado.current = true;
        avisarTablaAusente();
      }
      setAgendas([]);
      return;
    }
    setAgendas((agendasRes.data ?? []) as AgendaExterna[]);
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
   * Le pide al servidor traer el .ics y volcar los eventos como
   * bloqueos, y después relee la fila para mostrar los números al día.
   */
  async function sincronizar(agenda: AgendaExterna) {
    if (sincronizandoId) return;
    setSincronizandoId(agenda.id);
    try {
      let respuesta: RespuestaSync;
      try {
        const res = await fetch(`${SITIO_URL}/api/agendas/${agenda.id}/sync`, {
          method: "POST",
        });
        respuesta = (await res.json()) as RespuestaSync;
      } catch {
        respuesta = { ok: false, error: "No hubo conexión con el servidor. Intentá de nuevo." };
      }

      // La fila fresca manda: el servidor guarda ahí la última
      // sincronización, el conteo y el error si algo falló.
      const { data } = await supabase
        .from("agendas_externas")
        .select("id, nombre, url, ultima_sync, ultimo_error, eventos_importados")
        .eq("id", agenda.id)
        .maybeSingle();
      if (data) {
        const fresca = data as AgendaExterna;
        setAgendas((prev) => (prev ?? []).map((a) => (a.id === fresca.id ? fresca : a)));
      }

      if (respuesta.ok) {
        const n = respuesta.importados ?? 0;
        Alert.alert(
          "Listo",
          n === 1 ? "1 evento importado como bloqueo." : `${n} eventos importados como bloqueos.`,
        );
      } else {
        Alert.alert(
          "No se pudo sincronizar",
          respuesta.error ?? "Revisá que el enlace siga siendo válido e intentá de nuevo.",
        );
      }
    } finally {
      setSincronizandoId(null);
    }
  }

  /** Guarda el calendario nuevo y lo sincroniza de una vez. */
  async function conectar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setErrorForm("Poné un nombre para reconocer el calendario (ej. Mi Google Calendar).");
      return;
    }
    const urlLista = normalizarUrl(url);
    if (!urlLista) {
      setErrorForm(
        "El enlace tiene que empezar con https:// o webcal:// — copialo tal cual desde Google o iCloud.",
      );
      return;
    }
    setErrorForm(null);
    setGuardando(true);
    const { data, error } = await supabase
      .from("agendas_externas")
      .insert({ rancho_id: id, nombre: nombreLimpio, url: urlLista })
      .select("id, nombre, url, ultima_sync, ultimo_error, eventos_importados")
      .single();
    if (error) {
      setGuardando(false);
      if (esTablaAusente(error.message)) {
        avisado.current = true;
        avisarTablaAusente();
        return;
      }
      setErrorForm("No se pudo conectar el calendario: " + error.message);
      return;
    }
    const nueva = data as AgendaExterna;
    setAgendas((prev) => [...(prev ?? []), nueva]);
    setNombre("");
    setUrl("");
    setGuardando(false);
    // Primera sincronización de inmediato, para que se vea el resultado.
    await sincronizar(nueva);
  }

  function confirmarBorrar(agenda: AgendaExterna) {
    Alert.alert(
      "Desconectar calendario",
      `¿Desconectar "${agenda.nombre}"? Se borran también los bloqueos importados de este calendario.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desconectar",
          style: "destructive",
          onPress: async () => {
            // El cascade de la base borra los bloqueos importados.
            const { error } = await supabase
              .from("agendas_externas")
              .delete()
              .eq("id", agenda.id)
              .eq("rancho_id", id);
            if (error) {
              Alert.alert("No se pudo", "No se pudo desconectar: " + error.message);
              return;
            }
            setAgendas((prev) => (prev ?? []).filter((a) => a.id !== agenda.id));
          },
        },
      ],
    );
  }

  // Mismo resguardo que las pantallas hermanas del panel: sin sesión no
  // hay panel (y las políticas RLS ya limitan los datos al dueño).
  if (!session) {
    router.replace("/cuenta");
    return null;
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Sincronizar agendas" subtitulo={nombreNegocio ?? undefined} />

      {agendas === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.cuerpo}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={refrescar}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
        >
          {/* Qué hace esto, en una tarjeta. */}
          <View style={styles.tarjetaIntro}>
            <View style={styles.introIcono}>
              <Ionicons name="calendar-outline" size={20} color={Colors.navy} />
            </View>
            <Text style={styles.introTexto}>
              Conectá el calendario que ya usás (Google o Apple): tus compromisos
              existentes se importan como bloqueos y esas horas dejan de ofrecerse
              en Bookea. Se vuelve a sincronizar cada vez que tocás Sincronizar.
            </Text>
          </View>

          {/* Cómo conseguir la dirección privada del calendario. */}
          <View style={styles.tarjeta}>
            <Pressable
              style={styles.instruccionesCabecera}
              onPress={() => setVerInstrucciones((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Ver cómo conseguir el enlace del calendario"
            >
              <Ionicons name="help-circle-outline" size={18} color={Colors.navy} />
              <Text style={styles.instruccionesTitulo}>¿De dónde saco el enlace?</Text>
              <Ionicons
                name={verInstrucciones ? "chevron-up" : "chevron-down"}
                size={16}
                color={Colors.inkSoft}
              />
            </Pressable>
            {verInstrucciones && (
              <View style={styles.instruccionesCuerpo}>
                <View style={styles.instruccion}>
                  <Text style={styles.instruccionFuente}>Google Calendar</Text>
                  <Text style={styles.instruccionTexto}>
                    En la compu: abrí Google Calendar → Configuración del calendario →
                    “Dirección secreta en formato iCal” → copiá el enlace.
                  </Text>
                </View>
                <View style={styles.instruccion}>
                  <Text style={styles.instruccionFuente}>Apple / iCloud</Text>
                  <Text style={styles.instruccionTexto}>
                    En Calendario: compartí el calendario → activá “Calendario
                    público” → copiá el enlace webcal://.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Conectar uno nuevo. */}
          <View style={styles.tarjeta}>
            <Text style={styles.seccionTitulo}>Conectar un calendario</Text>
            <View>
              <Text style={styles.campoLabel}>Nombre</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Mi Google Calendar"
                placeholderTextColor={Colors.inkSoft}
                style={styles.input}
              />
            </View>
            <View>
              <Text style={styles.campoLabel}>Enlace del calendario (.ics)</Text>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="https://... o webcal://..."
                placeholderTextColor={Colors.inkSoft}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
            </View>
            {errorForm && <Text style={styles.error}>{errorForm}</Text>}
            <Pressable
              style={[styles.botonPrimario, guardando && { opacity: 0.5 }]}
              disabled={guardando}
              onPress={conectar}
            >
              {guardando ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Ionicons name="link-outline" size={16} color="#ffffff" />
              )}
              <Text style={styles.botonPrimarioTexto}>
                {guardando ? "Conectando..." : "Conectar y sincronizar"}
              </Text>
            </Pressable>
          </View>

          {/* Los calendarios ya conectados. */}
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Calendarios conectados</Text>
            {agendas.length === 0 ? (
              <Text style={styles.vacio}>
                Todavía no conectaste ningún calendario. Pegá arriba el enlace del
                que ya usás y tus compromisos quedan bloqueados en Bookea.
              </Text>
            ) : (
              agendas.map((a) => {
                const sincronizando = sincronizandoId === a.id;
                const ultima = haceCuanto(a.ultima_sync);
                return (
                  <View key={a.id} style={styles.filaAgenda}>
                    <View style={styles.filaCabecera}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.agendaNombre} numberOfLines={1}>
                          {a.nombre}
                        </Text>
                        <Text
                          style={styles.agendaUrl}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {a.url}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => confirmarBorrar(a)}
                        style={styles.botonBorrar}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Desconectar ${a.nombre}`}
                      >
                        <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                      </Pressable>
                    </View>

                    <Text style={styles.agendaDetalle}>
                      Última sincronización: {ultima ?? "nunca"}
                      {" · "}
                      {a.eventos_importados === 1
                        ? "1 evento importado"
                        : `${a.eventos_importados} eventos importados`}
                    </Text>
                    {a.ultimo_error && (
                      <Text style={styles.agendaError} numberOfLines={3}>
                        {a.ultimo_error}
                      </Text>
                    )}

                    <Pressable
                      style={[styles.botonSincronizar, sincronizando && { opacity: 0.6 }]}
                      disabled={sincronizandoId !== null}
                      onPress={() => sincronizar(a)}
                    >
                      {sincronizando ? (
                        <ActivityIndicator color={Colors.navy} size="small" />
                      ) : (
                        <Ionicons name="sync-outline" size={15} color={Colors.navy} />
                      )}
                      <Text style={styles.botonSincronizarTexto}>
                        {sincronizando ? "Sincronizando..." : "Sincronizar ahora"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>

          {/* Revisar el resultado en la agenda. */}
          <View style={styles.pie}>
            <Pressable
              style={styles.botonAgenda}
              onPress={() => router.push(`/negocio/${id}/agenda` as never)}
              accessibilityRole="button"
              accessibilityLabel="Ver agenda"
            >
              <Ionicons name="calendar-outline" size={16} color="#ffffff" />
              <Text style={styles.botonAgendaTexto}>Ver agenda</Text>
            </Pressable>
            <Text style={styles.pieTexto}>
              Revisá en la agenda que todo se haya sincronizado bien.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  cuerpo: { padding: Spacing.three, paddingBottom: 48, gap: Spacing.three },

  tarjetaIntro: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.three,
    backgroundColor: Colors.cream2,
    borderRadius: 16,
    padding: Spacing.three,
  },
  introIcono: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  introTexto: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.ink,
    fontFamily: Fonts.regular,
  },

  tarjeta: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  instruccionesCabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  instruccionesTitulo: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: Fonts.bold,
    color: Colors.navy,
  },
  instruccionesCuerpo: { gap: Spacing.two },
  instruccion: {
    backgroundColor: Colors.cream2,
    borderRadius: 12,
    padding: Spacing.three,
    gap: 3,
  },
  instruccionFuente: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.ink },
  instruccionTexto: {
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
  },

  seccion: { gap: Spacing.two },
  seccionTitulo: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: Colors.inkSoft,
  },
  campoLabel: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: Colors.inkSoft,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Colors.cream2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    fontFamily: Fonts.regular,
    color: Colors.ink,
  },
  error: { color: Colors.danger, fontSize: 12.5, lineHeight: 18, fontFamily: Fonts.medium },
  botonPrimario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: Colors.sky,
    borderRadius: 12,
    paddingVertical: 13,
  },
  botonPrimarioTexto: { color: "#ffffff", fontSize: 13.5, fontFamily: Fonts.bold },

  vacio: {
    backgroundColor: Colors.cream2,
    borderRadius: 14,
    padding: Spacing.four,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
  },
  filaAgenda: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  filaCabecera: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  agendaNombre: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  agendaUrl: {
    fontSize: 11.5,
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  botonBorrar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
  agendaDetalle: { fontSize: 12.5, color: Colors.inkSoft, fontFamily: Fonts.medium },
  agendaError: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.danger,
    fontFamily: Fonts.medium,
    backgroundColor: Colors.dangerLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  botonSincronizar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.navy,
    backgroundColor: Colors.surface,
    paddingVertical: 9,
    marginTop: 2,
  },
  botonSincronizarTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.navy },

  pie: { gap: Spacing.two, marginTop: Spacing.two },
  botonAgenda: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
  },
  botonAgendaTexto: { color: "#ffffff", fontSize: 14, fontFamily: Fonts.bold },
  pieTexto: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
    textAlign: "center",
  },
});
