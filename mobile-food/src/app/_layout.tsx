import { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { completarSesionDesdeUrl } from "@/lib/auth-social";
import {
  useFonts,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from "@expo-google-fonts/figtree";
import { AuthProvider } from "@/lib/auth-context";
import { ModoPedidoProvider } from "@/lib/modo-pedido";
import { Colors } from "@/constants/theme";
import PantallaBoot from "@/components/pantalla-boot";

SplashScreen.preventAutoHideAsync();

/** Cuánto se ve el logo + los puntitos antes de pasar a la app —
 *  breve a propósito: es una marca de identidad, no una carga real. */
const DURACION_BOOT_MS = 900;

/**
 * El layout raíz de FOOD.BOOKEA — mismo esqueleto que Bookea
 * (mobile/src/app/_layout.tsx): sin header nativo (cada pantalla arma
 * el suyo), y volver deslizando SOLO desde el borde izquierdo
 * (`gestureEnabled: true, fullScreenGestureEnabled: false`), para que
 * un arrastre horizontal dentro de una pantalla (el selector de
 * fecha, la fila de horarios) no se lo robe la navegación.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  // El splash nativo (imagen fija) se esconde en cuanto las fuentes
  // cargan; PantallaBoot (logo + puntitos animados) lo releva sin
  // parpadeo (mismo fondo blanco) y se queda un momento breve antes de
  // dar paso a la app real.
  const [booted, setBooted] = useState(false);

  const alListo = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    alListo();
  }, [alListo]);

  useEffect(() => {
    if (!fontsLoaded) return;
    const id = setTimeout(() => setBooted(true), DURACION_BOOT_MS);
    return () => clearTimeout(id);
  }, [fontsLoaded]);

  // El rescate del login social — mismo patrón que Bookea normal: en
  // Android, expo-web-browser a veces pierde la URL de vuelta (Expo Go
  // recarga el proyecto al recibir el intent). Este listener es
  // persistente y la completa igual.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) void completarSesionDesdeUrl(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      void completarSesionDesdeUrl(url);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;
  if (!booted) return <PantallaBoot />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ModoPedidoProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.canvas },
              gestureEnabled: true,
              fullScreenGestureEnabled: false,
            }}
          />
        </ModoPedidoProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
