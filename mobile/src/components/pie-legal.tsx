import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Colors, Fonts, Spacing } from "@/constants/theme";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * El pie legal del app — el equivalente de src/components/site-footer
 * de la web, reducido a lo que importa en un teléfono: los tres
 * documentos, el correo de contacto y la aclaración de que Bookea
 * intermedia y no presta los servicios.
 *
 * Va en la pantalla de Perfil TANTO con sesión como sin ella: App
 * Store y Play exigen que la política de privacidad se alcance desde
 * la app, y quien revisa la app no siempre entra con una cuenta.
 *
 * Los documentos viven en la web y se abren en el navegador in-app
 * (WebBrowser, no Linking): mantenerlos en un solo lugar evita que el
 * texto legal del teléfono y el del sitio se desincronicen — que es
 * exactamente el problema que estos documentos no pueden tener.
 */

const LEGAL: { ruta: string; label: string }[] = [
  { ruta: "/terminos", label: "Términos y condiciones" },
  { ruta: "/politicas", label: "Políticas" },
  { ruta: "/privacidad", label: "Privacidad" },
];

export default function PieLegal() {
  return (
    <View style={styles.contenedor}>
      <View style={styles.enlaces}>
        {LEGAL.map((l, i) => (
          <View key={l.ruta} style={styles.enlaceFila}>
            {i > 0 && <Text style={styles.separador}>·</Text>}
            <Pressable
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(`${SITIO_URL}${l.ruta}`)}
              hitSlop={6}
            >
              <Text style={styles.enlace}>{l.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.aclaracion}>
        Bookea conecta clientes con proveedores independientes. Cada
        servicio lo presta y lo responde el proveedor que lo publica —
        Bookea no organiza ni ejecuta los eventos ni los servicios
        reservados.
      </Text>

      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL("mailto:hola@bookea.lat")}
        hitSlop={6}
      >
        <Text style={styles.correo}>hola@bookea.lat</Text>
      </Pressable>

      <Text style={styles.copy}>© {new Date().getFullYear()} Bookea · Costa Rica</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.four,
  },
  // Los tres enlaces en fila, con su punto separador. Envuelven en
  // pantallas angostas en vez de recortarse.
  enlaces: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  enlaceFila: { alignItems: "center", flexDirection: "row", gap: 6 },
  separador: { color: Colors.line, fontFamily: Fonts.bold, fontSize: 12 },
  enlace: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  aclaracion: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
  },
  correo: { color: Colors.accent, fontFamily: Fonts.bold, fontSize: 12.5 },
  copy: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11 },
});
