import { useCallback, useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import { AuthProvider } from "@/lib/auth-context";
import { Colors, Fonts } from "@/constants/theme";
import TabBar from "@/components/tab-bar";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  const alListo = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    alListo();
  }, [alListo]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontFamily: Fonts.extraBold, fontSize: 17 },
          contentStyle: { backgroundColor: Colors.cream },
        }}
      >
        <Stack.Screen name="index" options={{ title: "BookeaCR" }} />
        <Stack.Screen name="rancho/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="rancho/[id]/reservar"
          options={{ title: "Reservar" }}
        />
        <Stack.Screen name="cuenta" options={{ title: "Mi cuenta" }} />
        <Stack.Screen name="mensajes/index" options={{ title: "Mensajes" }} />
        <Stack.Screen name="mensajes/[reservaId]" options={{ title: "Mensajes" }} />
      </Stack>
      <TabBar />
    </AuthProvider>
  );
}
