import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Sombras, Spacing } from "@/constants/theme";
import { cargarContextoNegocio, type ModuloId } from "@/lib/business";

/**
 * Las secciones del panel del dueño, en una barra fija abajo.
 *
 * El panel tenía siete atajos sueltos en la cabecera del Inicio y en un
 * teléfono eso es un muro: nadie los lee, y lo importante (lo que hay
 * que aceptar hoy) quedaba empujado hacia abajo. Ahora son CUATRO
 * destinos —los mismos que la web— y siempre están a la vista sin
 * robarle el arranque de la pantalla a los avisos:
 *
 *   Inicio · Catálogo (si el negocio vende cosas) · Finanzas · Config.
 *
 * Todo lo demás (editar la página, precios, cobros, sincronizar
 * calendarios, equipo y horario) vive un escalón adentro, en
 * Configuración. Se ve formal a propósito: barra blanca con una línea
 * fina arriba, y la sección activa lleva su propia card sólida (azul
 * claro, esquinas cerradas, sombra de tarjeta) con el ícono relleno y
 * el rótulo en navy — nada de dock de vidrio ni píldoras: ese es el
 * lenguaje del lado del cliente, no el del panel.
 *
 * BOOKEA BUSINESS: qué destinos aparecen lo deciden los MÓDULOS que el
 * negocio tiene encendidos (src/lib/business.ts), igual que el menú
 * lateral de la web — apagar "Servicios" en el panel web también acorta
 * esta barra. La consulta se hace acá adentro para que las cuatro
 * pantallas del panel no tengan que cargarlo cada una; mientras llega,
 * manda `mostrarCatalogo` (lo que ya sabe la pantalla), así la barra
 * nunca parpadea.
 */

export type SeccionPanel = "inicio" | "catalogo" | "finanzas" | "configuracion";

/**
 * Lo que cada pantalla del panel debe dejar libre al final del scroll.
 * 86 = 6 de paddingTop + 45 de card activa (4+20+3+14+4) + 34 del
 * inset inferior de un iPhone con gesto, +1 de margen. Subió de 84
 * cuando el rótulo pasó de 10pt a 11pt con su card detrás.
 */
export const ALTO_PANEL_NAV = 86;

type Destino = {
  /** "mensajes" no es una `SeccionPanel`: no tiene pantalla propia
   *  adentro de `negocio/[id]/*`, así que nunca puede ser el valor de
   *  `activa` -es un salto hacia AFUERA del panel, a la bandeja
   *  compartida (`/?tab=mensajes`), no una sección más para quedarse. */
  id: SeccionPanel | "mensajes";
  label: string;
  /** Nombre completo para lectores de pantalla cuando `label` viene
   *  abreviado para caber en su quinto de barra (p. ej. "Config."). */
  a11y?: string;
  icono: keyof typeof Ionicons.glyphMap;
  iconoActivo: keyof typeof Ionicons.glyphMap;
  ruta: string;
};

export default function PanelNav({
  negocioId,
  activa,
  mostrarCatalogo,
  etiquetaCatalogo = "Catálogo",
}: {
  negocioId: string;
  activa: SeccionPanel;
  /** Los lugares no tienen catálogo: alquilan la fecha, no productos. */
  mostrarCatalogo: boolean;
  /** "Catálogo" en eventos, "Servicios" en citas. */
  etiquetaCatalogo?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [modulos, setModulos] = useState<Set<ModuloId> | null>(null);

  useEffect(() => {
    let vigente = true;
    cargarContextoNegocio(negocioId)
      .then((ctx) => {
        if (vigente) setModulos(ctx.modulos);
      })
      // Sin módulos (red caída, migración sin correr) la barra se queda
      // con lo que la pantalla ya sabía: nunca se queda sin destinos.
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [negocioId]);

  const conCatalogo = modulos ? modulos.has("servicios") : mostrarCatalogo;
  const conFinanzas = modulos ? modulos.has("pagos") : true;

  const destinos: Destino[] = [
    {
      id: "inicio",
      label: "Inicio",
      icono: "home-outline",
      iconoActivo: "home",
      ruta: `/negocio/${negocioId}`,
    },
    ...(conCatalogo
      ? [
          {
            id: "catalogo" as const,
            label: etiquetaCatalogo,
            icono: "list-outline" as const,
            iconoActivo: "list" as const,
            ruta: `/negocio/${negocioId}/catalogo`,
          },
        ]
      : []),
    ...(conFinanzas
      ? [
          {
            id: "finanzas" as const,
            label: "Finanzas",
            icono: "trending-up-outline" as const,
            iconoActivo: "trending-up" as const,
            ruta: `/negocio/${negocioId}/finanzas`,
          },
        ]
      : []),
    {
      id: "configuracion",
      // Abreviado como en la doc de arriba ("… Finanzas · Config."):
      // con el rótulo a 11pt, "Configuración" entero no cabe en un
      // quinto de barra y quedaría cortado con puntos suspensivos.
      label: "Config.",
      a11y: "Configuración",
      icono: "settings-outline",
      iconoActivo: "settings",
      ruta: `/negocio/${negocioId}/configuracion`,
    },
    // Único destino de esta barra que NO vive adentro de `negocio/[id]`:
    // la bandeja de consultas (`/consultas`), compartida con el modo
    // cliente. Sin esto, quien administra su negocio no tenía forma de
    // ver la consulta de un cliente sin salir de "modo negocio".
    {
      id: "mensajes",
      label: "Consultas",
      icono: "chatbubble-outline",
      iconoActivo: "chatbubble",
      ruta: "/consultas",
    },
  ];

  return (
    <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {destinos.map((d) => {
        const esActiva = d.id === activa;
        return (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityState={{ selected: esActiva }}
            accessibilityLabel={d.a11y ?? d.label}
            disabled={esActiva}
            // navigate y no push: si la sección ya está en la pila, se
            // vuelve a ella en vez de apilar una copia — moverse entre
            // los cuatro destinos no puede dejar una torre de pantallas.
            onPress={() => router.navigate(d.ruta as never)}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            {/* La card del destino activo: superficie sólida azul claro
                con sombra de tarjeta. El destino inactivo lleva la misma
                caja transparente, así nada se mueve al cambiar de
                sección — solo aparece la superficie. */}
            <View style={[styles.caja, esActiva && styles.cajaActiva]}>
              <Ionicons
                name={esActiva ? d.iconoActivo : d.icono}
                size={20}
                color={esActiva ? Colors.navy : Colors.inkMuted}
              />
              <Text style={[styles.label, esActiva && styles.labelActiva]} numberOfLines={1}>
                {d.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingHorizontal: Spacing.two,
    // 6 y no 9: la card activa ya trae aire propio (paddingVertical 4),
    // y así la barra cierra dentro de los 86pt de ALTO_PANEL_NAV con el
    // rótulo a 11pt (6 + 45 de card + inset inferior).
    paddingTop: 6,
    position: "absolute",
    right: 0,
  },
  item: { alignItems: "center", flex: 1 },
  // Ícono + rótulo comparten una sola caja con esquinas cerradas; en
  // reposo es invisible y en lo activo se vuelve la card sólida.
  caja: {
    alignItems: "center",
    borderRadius: Radios.md,
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cajaActiva: { backgroundColor: Colors.blueLight, ...Sombras.tarjeta },
  label: { color: Colors.inkMuted, fontFamily: Fonts.semiBold, fontSize: 11, lineHeight: 14 },
  labelActiva: { color: Colors.navy, fontFamily: Fonts.extraBold },
});
