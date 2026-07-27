import { Link, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text } from "react-native";
import { AuthProvider } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: Colors.cream },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "BookeaCR",
            headerRight: () => (
              <Link href="/cuenta">
                <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 13 }}>
                  Mi cuenta
                </Text>
              </Link>
            ),
          }}
        />
        <Stack.Screen name="rancho/[id]" options={{ title: "" }} />
        <Stack.Screen
          name="rancho/[id]/reservar"
          options={{ title: "Reservar" }}
        />
        <Stack.Screen name="cuenta" options={{ title: "Mi cuenta" }} />
      </Stack>
    </AuthProvider>
  );
}
