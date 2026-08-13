import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { Aviso, Vacio } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

/**
 * El hub del Panel Admin — espejo de /admin en la web, que dejó el
 * menú superior y ahora es una grilla de cards compactas, una por
 * sección. Acá es lo mismo adaptado al teléfono: dos por fila.
 *
 * Las secciones NO viven nativas: administrar la plataforma es trabajo
 * de escritorio y duplicar cada pantalla acá no paga. Cada card abre
 * su sección de bookea.lat en el navegador (el mismo patrón que ya usa
 * Invitaciones), así el admin resuelve una urgencia desde el teléfono
 * sin que mantengamos dos paneles.
 *
 * Si cambian las secciones del hub en la web, cambiarlas acá: son dos
 * proyectos npm independientes, en paridad a mano.
 */

type Seccion = {
  ruta: string;
  titulo: string;
  detalle: string;
  icono: keyof typeof Ionicons.glyphMap;
};

// El mismo orden que las cards de la web.
const SECCIONES: Seccion[] = [
  {
    ruta: "/admin/ranchos",
    titulo: "Publicaciones",
    detalle: "Aprobá, editá o dá de alta negocios",
    icono: "storefront-outline",
  },
  {
    ruta: "/admin/eventos",
    titulo: "Reservas",
    detalle: "Todas las reservas de la plataforma",
    icono: "ticket-outline",
  },
  {
    ruta: "/admin/agenda",
    titulo: "Agenda",
    detalle: "Los próximos eventos confirmados",
    icono: "calendar-outline",
  },
  {
    ruta: "/admin/finanzas",
    titulo: "Finanzas",
    detalle: "Comisiones, gastos e ingresos",
    icono: "stats-chart-outline",
  },
  {
    ruta: "/admin/invitaciones",
    titulo: "Invitaciones",
    detalle: "Creá y asigná invitaciones digitales",
    icono: "mail-outline",
  },
  {
    ruta: "/admin/usuarios",
    titulo: "Cuentas y accesos",
    detalle: "Dueños, correos y permisos",
    icono: "people-outline",
  },
  {
    ruta: "/admin/complementos",
    titulo: "Complementos",
    detalle: "Módulos y add-ons por negocio",
    icono: "extension-puzzle-outline",
  },
  {
    ruta: "/admin/campanas",
    titulo: "Campañas",
    detalle: "Correos para dueños y clientes",
    icono: "paper-plane-outline",
  },
  {
    ruta: "/admin/eventos/precios",
    titulo: "Precios",
    detalle: "Precios y servicios de eventos",
    icono: "pricetag-outline",
  },
  {
    ruta: "/admin/almacenamiento",
    titulo: "Almacenamiento",
    detalle: "Quién pesa y cuánto cuesta",
    icono: "server-outline",
  },
  {
    ruta: "/admin/ia",
    titulo: "Inteligencia artificial",
    detalle: "Gasto, modelos y conocimiento",
    icono: "hardware-chip-outline",
  },
];

export default function AdminScreen() {
  const router = useRouter();
  const { perfil, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.navy} />
      </View>
    );
  }

  // La puerta de verdad es la web (proxy + requireAdmin); esto solo
  // evita mostrarle la grilla a quien no le va a servir de nada.
  if (perfil?.rol !== "admin") {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Panel Admin" />
        <Vacio
          icono="lock-closed-outline"
          titulo="Solo para administradores"
          texto="Esta sección es del equipo de Bookea. Si creés que deberías tener acceso, escribinos."
          accion={{ texto: "Volver", onPress: () => router.back() }}
        />
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        kicker="Panel Admin"
        titulo="¿Qué querés gestionar?"
        subtitulo="Todas las secciones en un solo lugar"
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Aviso
          texto="Cada sección se abre en bookea.lat: el panel completo vive en la web."
          icono="globe-outline"
        />
        <View style={styles.grilla}>
          {SECCIONES.map((s) => (
            <Pressable
              key={s.ruta}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${s.titulo} en bookea.lat`}
              onPress={() => WebBrowser.openBrowserAsync(`${SITIO_URL}${s.ruta}`)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              {/* Navy, no naranja: el admin es sobrio, igual que en la web. */}
              <View style={styles.cardIcono}>
                <Ionicons name={s.icono} size={18} color={Colors.navy} />
              </View>
              <Text style={styles.cardTitulo} numberOfLines={1}>
                {s.titulo}
              </Text>
              <Text style={styles.cardDetalle} numberOfLines={2}>
                {s.detalle}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  grilla: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  // Dos por fila: el gap se descuenta del ancho, igual que las
  // casillas de hora.
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 2,
    padding: Spacing.three,
  },
  cardIcono: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.sm,
    height: 34,
    justifyContent: "center",
    marginBottom: 6,
    width: 34,
  },
  cardTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 13.5 },
  cardDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, lineHeight: 15 },
});
