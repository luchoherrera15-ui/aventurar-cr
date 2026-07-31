import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Colors } from "@/constants/theme";

/**
 * Pantalla puente del login social.
 *
 * En condiciones normales nadie la ve: `openAuthSessionAsync` atrapa el
 * deep link de vuelta antes de que llegue al router. Existe para cuando
 * eso NO pasa — en Android, Expo Go a veces recarga el proyecto al
 * recibir el intent, y entonces la URL se la queda expo-router. Sin
 * esta ruta, la persona aterriza en "Unmatched Route" justo después de
 * autenticarse, que es la peor pantalla posible en ese momento.
 *
 * Quien de verdad rescata la sesión es el listener de _layout.tsx; acá
 * solo se espera un momento a que termine y se sigue de largo.
 */
WebBrowser.maybeCompleteAuthSession();

export default function PuenteAuth() {
  const router = useRouter();

  useEffect(() => {
    // El respiro le da tiempo al canje del código antes de mostrar la
    // cuenta; si ya hay sesión, /cuenta la muestra al toque.
    const id = setTimeout(() => router.replace("/cuenta"), 800);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <View style={styles.centro}>
      <ActivityIndicator color={Colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    alignItems: "center",
    backgroundColor: Colors.cream,
    flex: 1,
    justifyContent: "center",
  },
});
