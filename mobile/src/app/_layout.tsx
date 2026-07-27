import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: Colors.cream },
        }}
      >
        <Stack.Screen name="index" options={{ title: "BookeaCR" }} />
        <Stack.Screen name="rancho/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="rancho/[id]/reservar"
          options={{ title: "Reservar" }}
        />
      </Stack>
    </>
  );
}
