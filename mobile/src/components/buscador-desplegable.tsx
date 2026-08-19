import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

/**
 * EL DESPLEGABLE DEL BUSCADOR.
 *
 * Se abre al tocar el campo de búsqueda, antes de escribir nada, y
 * ofrece las tres cosas que la persona quiere en ese momento:
 *
 *   · CERCA     — lo que tiene al lado, sin escribir.
 *   · VER MAPA  — la vista de mapa con la lista debajo.
 *   · Búsquedas recientes — lo que ya buscó, para repetirlo de un toque.
 *
 * Las recientes viven en el teléfono (AsyncStorage), no en la base: son
 * de este aparato y de nadie más, y no tiene sentido sincronizarlas ni
 * que sobrevivan a un cierre de sesión.
 */

const CLAVE_RECIENTES = "bookea:busquedas-recientes";
const TOPE_RECIENTES = 6;

/** Guarda un término en las recientes (sin repetir, las más nuevas
 *  primero). Lo llaman las pantallas cuando la búsqueda dio algo. */
export async function recordarBusqueda(termino: string) {
  const limpio = termino.trim();
  if (limpio.length < 2) return;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_RECIENTES);
    const previas: string[] = crudo ? JSON.parse(crudo) : [];
    const sinRepetir = previas.filter((t) => t.toLowerCase() !== limpio.toLowerCase());
    await AsyncStorage.setItem(
      CLAVE_RECIENTES,
      JSON.stringify([limpio, ...sinRepetir].slice(0, TOPE_RECIENTES)),
    );
  } catch {
    // Sin almacenamiento el buscador sigue andando, solo sin memoria.
  }
}

export default function BuscadorDesplegable({
  visible,
  vertical,
  onElegirTermino,
  onCerrar,
}: {
  visible: boolean;
  /** Para que "Ver mapa" abra el mapa de ESTA vertical. */
  vertical?: string;
  onElegirTermino: (termino: string) => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [recientes, setRecientes] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    try {
      const crudo = await AsyncStorage.getItem(CLAVE_RECIENTES);
      setRecientes(crudo ? JSON.parse(crudo) : []);
    } catch {
      setRecientes([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee AsyncStorage (sistema externo) al abrirse
    if (visible) cargar();
  }, [visible, cargar]);

  async function limpiarRecientes() {
    try {
      await AsyncStorage.removeItem(CLAVE_RECIENTES);
    } catch {
      /* nada que limpiar */
    }
    setRecientes([]);
  }

  if (!visible) return null;

  const irAlMapa = () => {
    onCerrar();
    router.push(
      (vertical ? `/mapa?vertical=${vertical}` : "/mapa") as never,
    );
  };

  return (
    <View style={styles.panel}>
      {/* EN CASCADA HACIA ABAJO, no dos cajas lado a lado: "Cerca",
          después "Ver mapa", después las recientes — cada una su
          renglón, como cae la lista de un buscador de verdad. */}
      <Pressable
        style={({ pressed }) => [styles.fila, pressed && { backgroundColor: Colors.cream2 }]}
        onPress={irAlMapa}
      >
        <View style={styles.filaIcono}>
          <Ionicons name="navigate" size={17} color={Colors.navy} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.filaTitulo}>Cerca</Text>
          <Text style={styles.filaTexto} numberOfLines={1}>
            Lo que tenés al lado, con tu ubicación
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.inkMuted} />
      </Pressable>

      <View style={styles.separador} />

      <Pressable
        style={({ pressed }) => [styles.fila, pressed && { backgroundColor: Colors.cream2 }]}
        onPress={irAlMapa}
      >
        <View style={styles.filaIcono}>
          <Ionicons name="map" size={17} color={Colors.navy} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.filaTitulo}>Ver mapa</Text>
          <Text style={styles.filaTexto} numberOfLines={1}>
            El mapa arriba y la lista debajo
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.inkMuted} />
      </Pressable>

      {recientes.length > 0 && (
        <>
          <View style={styles.separador} />
          <View style={styles.recientesEncabezado}>
            <Text style={styles.recientesTitulo}>Búsquedas recientes</Text>
            <Pressable onPress={limpiarRecientes} hitSlop={8}>
              <Text style={styles.limpiar}>Limpiar</Text>
            </Pressable>
          </View>
          {recientes.map((t) => (
            <Pressable
              key={t}
              style={({ pressed }) => [styles.reciente, pressed && { backgroundColor: Colors.cream2 }]}
              onPress={() => {
                onElegirTermino(t);
                onCerrar();
              }}
            >
              <View style={styles.filaIcono}>
                <Ionicons name="time-outline" size={16} color={Colors.inkMuted} />
              </View>
              <Text style={styles.recienteTexto} numberOfLines={1}>
                {t}
              </Text>
              <Ionicons name="arrow-up-outline" size={14} color={Colors.inkMuted} />
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    marginTop: Spacing.two,
    overflow: "hidden",
    paddingVertical: 4,
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  fila: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  filaIcono: {
    alignItems: "center",
    backgroundColor: Colors.cream2,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  filaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 14 },
  filaTexto: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  separador: { backgroundColor: Colors.line, height: 1, marginHorizontal: Spacing.three },
  recientesEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 2,
    paddingBottom: 4,
  },
  recientesTitulo: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  limpiar: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 11.5 },
  reciente: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  recienteTexto: { color: Colors.ink, flex: 1, fontFamily: Fonts.medium, fontSize: 13.5 },
});
