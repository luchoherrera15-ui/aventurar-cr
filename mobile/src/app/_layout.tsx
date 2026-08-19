import { useCallback, useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRootNavigationState, useRouter } from "expo-router";
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
import { rutaDeNotificacion } from "@/lib/abrir-notificacion";
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

  /**
   * ═════════════════════════════════════════════════════════════════
   *  TOCAR UNA NOTIFICACIÓN TIENE QUE LLEVAR A LO QUE HAY QUE HACER
   * ═════════════════════════════════════════════════════════════════
   *
   * ── EL BUG QUE ESTO ARREGLA ────────────────────────────────────
   * Antes acá solo estaba `addNotificationResponseReceivedListener`,
   * que avisa cuando alguien toca una notificación CON LA APP VIVA.
   * Si la app estaba cerrada —que es el caso normal: llega el aviso,
   * el teléfono está en el bolsillo— el sistema la levantaba, y para
   * cuando este listener quedaba registrado el toque YA HABÍA PASADO.
   * Nadie se lo contaba a nadie. La app abría en la pantalla de
   * siempre y la persona quedaba buscando a mano de qué le habían
   * avisado.
   *
   * `getLastNotificationResponseAsync()` es lo que faltaba: pregunta
   * "¿la app se abrió porque alguien tocó algo?" y devuelve ese toque
   * aunque haya ocurrido antes de que existiera el listener.
   *
   * ── Y HAY QUE ESPERAR AL ROUTER ────────────────────────────────
   * En arranque en frío esto corre antes de que el árbol de
   * navegación exista, y navegar ahí tira "Attempted to navigate
   * before mounting the Root Layout". `useRootNavigationState()` no
   * tiene `key` hasta que el router está listo: por eso el efecto
   * depende de él y se vuelve a correr cuando lo está.
   *
   * ── SIN NAVEGAR DOS VECES ──────────────────────────────────────
   * El toque que abrió la app puede aparecer POR LOS DOS CAMINOS. Se
   * recuerda el identificador del último atendido y se ignora el
   * repetido — sin esto, la app abre la pantalla, y encima abre otra
   * igual.
   */
  const navegacionLista = useRootNavigationState()?.key;
  const atendida = useRef<string | null>(null);

  const abrirNotificacion = useCallback(
    (respuesta: Notifications.NotificationResponse | null) => {
      if (!respuesta) return;
      const id = respuesta.notification.request.identifier;
      if (atendida.current === id) return;

      const destino = rutaDeNotificacion(respuesta.notification.request.content.data?.url);
      if (!destino) return;

      atendida.current = id;
      router.push(destino);
    },
    [router],
  );

  // El toque que ABRIÓ la app (venía cerrada).
  useEffect(() => {
    if (!navegacionLista) return;
    let vivo = true;
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (vivo) abrirNotificacion(r);
    });
    return () => {
      vivo = false;
    };
  }, [navegacionLista, abrirNotificacion]);

  // Los toques con la app ya abierta.
  useEffect(() => {
    const suscripcion =
      Notifications.addNotificationResponseReceivedListener(abrirNotificacion);
    return () => suscripcion.remove();
  }, [abrirNotificacion]);

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
