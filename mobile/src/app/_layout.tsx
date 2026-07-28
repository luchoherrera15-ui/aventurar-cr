import { useCallback, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from "@expo-google-fonts/figtree";
import { AuthProvider } from "@/lib/auth-context";
import { Colors, Fonts } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });

  const alListo = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    alListo();
  }, [alListo]);

  if (!fontsLoaded) return null;

  // El pager de pestañas (/) va sin barra nativa sobre fondo claro →
  // íconos de estado oscuros; las pantallas de detalle conservan el
  // header navy → íconos claros.
  const esPestana = pathname === "/";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      <StatusBar style={esPestana ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontFamily: Fonts.extraBold, fontSize: 17 },
          contentStyle: { backgroundColor: Colors.cream },
          // Volver deslizando desde cualquier parte de la pantalla (no
          // solo el borde), como Instagram — navegación mucho más fluida.
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="favoritos" options={{ headerShown: false }} />
        <Stack.Screen name="reservas" options={{ headerShown: false }} />
        <Stack.Screen name="mensajes/index" options={{ headerShown: false }} />
        <Stack.Screen name="cuenta" options={{ headerShown: false }} />
        <Stack.Screen name="rancho/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="rancho/[id]/reservar"
          options={{ title: "Reservar" }}
        />
        <Stack.Screen name="mensajes/[reservaId]" options={{ title: "Mensajes" }} />
        <Stack.Screen name="mensajes/hilo/[conversacionId]" options={{ title: "Mensajes" }} />
        <Stack.Screen name="negocio/index" options={{ title: "Mi negocio" }} />
        <Stack.Screen name="negocio/nuevo" options={{ title: "Publicar servicio" }} />
        <Stack.Screen name="negocio/[id]" options={{ title: "Reservas" }} />
      </Stack>
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
