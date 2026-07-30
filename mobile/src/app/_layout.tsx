import { useCallback, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import {
  useFonts,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from "@expo-google-fonts/figtree";
import { AuthProvider } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

// Con la app abierta, una notificación entra como banner discreto
// arriba (sin robar la pantalla), igual que un mensaje de WhatsApp.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const router = useRouter();

  // Tocar la notificación abre la pantalla que el servidor indicó en
  // data.url (ej. "/?tab=reservas" o "/?tab=mensajes").
  useEffect(() => {
    const suscripcion = Notifications.addNotificationResponseReceivedListener(
      (respuesta) => {
        const url = respuesta.notification.request.content.data?.url;
        if (typeof url === "string") router.push(url as Href);
      },
    );
    return () => suscripcion.remove();
  }, [router]);
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      {/* Todo el fondo de la app es claro, así que los íconos del
          sistema (hora, batería) van siempre oscuros. */}
      <StatusBar style="dark" />
      {/* Sin header nativo en ninguna pantalla: cada una arma su
          navegación — botones de vidrio flotando sobre la foto en el
          detalle, y BarraSuperior clara en el resto. Además de verse
          mejor, evita el título automático sacado del nombre del
          archivo de la ruta (el famoso "‹ index"). */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.cream },
          // Volver deslizando desde cualquier parte de la pantalla (no
          // solo el borde), como Instagram — navegación mucho más fluida.
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
