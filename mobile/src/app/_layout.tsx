import { useCallback, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
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

  // El rescate del login social. En Android, expo-web-browser resuelve
  // con un Promise.race que a veces pierde la URL de vuelta (Expo Go
  // recarga el proyecto al recibir el intent y se lleva el listener
  // efímero por delante). Este listener es persistente: si la URL llega
  // por acá, la sesión se completa igual y la persona ni se entera.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) void completarSesionDesdeUrl(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      void completarSesionDesdeUrl(url);
    });
    return () => sub.remove();
  }, []);

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
          // Volver deslizando SOLO desde el borde izquierdo, como el
          // gesto nativo de iOS. Con el gesto a pantalla completa
          // (fullScreenGestureEnabled) cualquier arrastre horizontal
          // dentro de la pantalla salía como "volver": los carruseles
          // de fotos, las filas de chips y el calendario se quedaban
          // sin sus deslizamientos porque la navegación se los robaba.
          gestureEnabled: true,
          fullScreenGestureEnabled: false,
        }}
      />
    </AuthProvider>
    </GestureHandlerRootView>
  );
}
