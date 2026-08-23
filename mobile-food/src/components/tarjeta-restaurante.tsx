import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras } from "@/constants/theme";
import type { TarjetaFood } from "@/lib/food-datos";
import { TIPOS_COCINA } from "@/lib/food-tipos";
import { useAuth } from "@/lib/auth-context";
import { alternarFavorito } from "@/lib/food-acciones";

/**
 * La tarjeta del directorio — espejo de RestauranteCard en /web
 * (src/components/food/restaurante-card.tsx): foto grande, badge de
 * descuento y de "Nuevo", ubicación real, platos del menú (no un tipo
 * de cocina inventado), la clasificación gastronómica del negocio (en
 * vez de una descripción libre), y los horarios con descuento de la
 * fecha más próxima en forma de cupón (borde punteado + muescas). Sin
 * precio ni CTA de texto: la tarjeta entera es el botón.
 */
export default function TarjetaRestaurante({
  tarjeta,
  favorito,
  logueado,
}: {
  tarjeta: TarjetaFood;
  /** undefined = esta pantalla no resolvió favoritos (el corazón no se pinta). */
  favorito?: boolean;
  logueado: boolean;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const [favoritoLocal, setFavoritoLocal] = useState(favorito);
  const mejorDelDia = tarjeta.franjasProximas.reduce((max, f) => Math.max(max, f.descuento), 0);
  const clasificacion = tarjeta.tipoCocina ? TIPOS_COCINA[tarjeta.tipoCocina].nombre : "Varios";

  async function tocarFavorito() {
    if (!logueado || !session) {
      router.push("/?tab=perfil");
      return;
    }
    const anterior = favoritoLocal;
    setFavoritoLocal(!anterior);
    const r = await alternarFavorito(session.user.id, tarjeta.id);
    if (!r.ok) setFavoritoLocal(anterior);
  }

  return (
    <Pressable
      onPress={() => router.push(`/restaurante/${tarjeta.slug}`)}
      style={styles.tarjeta}
    >
      <View style={styles.fotoContenedor}>
        {tarjeta.fotoUrl ? (
          <Image source={{ uri: tarjeta.fotoUrl }} style={styles.foto} resizeMode="cover" />
        ) : (
          <View style={[styles.foto, styles.fotoVacia]}>
            <Ionicons name="restaurant-outline" size={30} color="rgba(22,41,94,0.35)" />
          </View>
        )}

        <View style={styles.insigniasEsquina} pointerEvents="none">
          {tarjeta.descuentoPorcentaje > 0 && (
            <View style={styles.badgeDescuento}>
              <Text style={styles.badgeDescuentoTexto}>−{tarjeta.descuentoPorcentaje}%</Text>
            </View>
          )}
          {tarjeta.esNuevo && (
            <View style={styles.badgeNuevo}>
              <Text style={styles.badgeNuevoTexto}>Nuevo</Text>
            </View>
          )}
        </View>

        {favoritoLocal !== undefined && (
          <Pressable onPress={tocarFavorito} style={styles.botonFavorito} hitSlop={8}>
            <Ionicons
              name={favoritoLocal ? "heart" : "heart-outline"}
              size={18}
              color={favoritoLocal ? Colors.accent : Colors.inkSoft}
            />
          </Pressable>
        )}
      </View>

      <View style={styles.cuerpo}>
        <Text style={styles.nombre} numberOfLines={1}>{tarjeta.nombre}</Text>
        {(tarjeta.ubicacion || tarjeta.platos.length > 0) && (
          <Text style={styles.meta} numberOfLines={1}>
            {[tarjeta.ubicacion, tarjeta.platos.join(" · ")].filter(Boolean).join(" · ")}
          </Text>
        )}
        <Text style={styles.clasificacion} numberOfLines={1}>{clasificacion}</Text>

        {tarjeta.franjasProximas.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {tarjeta.franjasProximasEtiqueta && (
              <Text style={styles.etiquetaFranjas}>{tarjeta.franjasProximasEtiqueta}</Text>
            )}
            <View style={[styles.filaHorarios, { marginTop: 4 }]}>
              {tarjeta.franjasProximas.map((f) => {
                const esOferta = f.descuento > 0;
                if (!esOferta) {
                  return (
                    <View key={f.hora} style={styles.chipHora}>
                      <Text style={styles.chipHoraTexto}>{f.hora}</Text>
                    </View>
                  );
                }
                const esLaMejor = f.descuento === mejorDelDia;
                return (
                  <View key={f.hora} style={[styles.cupon, esLaMejor && styles.cuponDestacado]}>
                    <View style={[styles.cuponMuesca, styles.cuponMuescaIzq]} />
                    <Text style={[styles.cuponTexto, esLaMejor && styles.cuponTextoDestacado]}>{f.hora}</Text>
                    <View style={[styles.cuponDivisor, esLaMejor && styles.cuponDivisorDestacado]} />
                    <Text style={[styles.cuponTexto, styles.cuponDescuento, esLaMejor && styles.cuponTextoDestacado]}>
                      −{f.descuento}%
                    </Text>
                    <View style={[styles.cuponMuesca, styles.cuponMuescaDer]} />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {tarjeta.conteoReservas > 0 && (
          <View style={styles.filaConfianza}>
            <Ionicons name="people-outline" size={13} color={Colors.inkMuted} />
            <Text style={styles.confianzaTexto}>
              {tarjeta.conteoReservas} {tarjeta.conteoReservas === 1 ? "reserva" : "reservas"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: Colors.surface,
    borderRadius: Radios.xl,
    overflow: "hidden",
    ...Sombras.elevada,
  },
  fotoContenedor: { aspectRatio: 16 / 10, backgroundColor: Colors.blueLight },
  foto: { width: "100%", height: "100%" },
  fotoVacia: { alignItems: "center", justifyContent: "center" },
  insigniasEsquina: {
    position: "absolute",
    left: 12,
    top: 12,
    alignItems: "flex-start",
    gap: 6,
  },
  badgeDescuento: {
    backgroundColor: Colors.accent,
    borderRadius: Radios.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDescuentoTexto: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 13 },
  badgeNuevo: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: Radios.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeNuevoTexto: {
    color: Colors.navy,
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  botonFavorito: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: Radios.full,
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cuerpo: { padding: Spacing.three, paddingBottom: Spacing.two },
  nombre: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.ink },
  meta: { marginTop: 3, fontFamily: Fonts.medium, fontSize: 12, color: Colors.inkSoft },
  clasificacion: {
    marginTop: 4,
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.accentDark,
  },
  etiquetaFranjas: {
    fontFamily: Fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Colors.inkSoft,
  },
  filaHorarios: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipHora: {
    borderRadius: Radios.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: Colors.canvas,
  },
  chipHoraTexto: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.inkSoft },
  /** El "cupón": borde punteado + una muesca circular a cada lado que
   *  recorta el fondo de la tarjeta (Colors.surface), simulando el
   *  perforado de un cupón de verdad. */
  cupon: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radios.sm,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  cuponDestacado: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  cuponTexto: { fontFamily: Fonts.bold, fontSize: 11.5, color: Colors.ink },
  cuponDescuento: { color: Colors.accentDark },
  cuponTextoDestacado: { color: "#fff" },
  cuponDivisor: {
    height: 14,
    marginHorizontal: 7,
    borderLeftWidth: 1.5,
    borderLeftColor: Colors.accent,
    borderStyle: "dashed",
  },
  cuponDivisorDestacado: { borderLeftColor: "rgba(255,255,255,0.6)" },
  cuponMuesca: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    top: "50%",
    transform: [{ translateY: -4 }],
  },
  cuponMuescaIzq: { left: -3.5 },
  cuponMuescaDer: { right: -3.5 },
  filaConfianza: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confianzaTexto: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.inkMuted },
});
