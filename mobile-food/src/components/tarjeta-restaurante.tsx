import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras } from "@/constants/theme";
import type { TarjetaFood } from "@/lib/food-datos";
import { CRC } from "@/lib/food-tipos";
import { useAuth } from "@/lib/auth-context";
import { alternarFavorito } from "@/lib/food-acciones";

/**
 * La tarjeta del directorio — espejo de RestauranteCard en /web
 * (src/components/food/restaurante-card.tsx): foto grande, badge de
 * descuento y de "Nuevo", ubicación real, platos del menú (no un tipo
 * de cocina inventado), descripción, etiqueta + horarios de la fecha
 * más próxima, precio (con tachado si hay descuento), cantidad de
 * reservas y el corazón de favoritos (real desde food_favoritos). Sin
 * CTA de texto: la tarjeta entera es el botón.
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
  const tieneOferta = tarjeta.precioConDescuento != null;

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
        {tarjeta.descripcion && (
          <Text style={styles.descripcion} numberOfLines={2}>{tarjeta.descripcion}</Text>
        )}

        {tarjeta.franjasProximas.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {tarjeta.franjasProximasEtiqueta && (
              <Text style={styles.etiquetaFranjas}>{tarjeta.franjasProximasEtiqueta}</Text>
            )}
            <View style={[styles.filaHorarios, { marginTop: 4 }]}>
              {tarjeta.franjasProximas.map((f) => (
                <View
                  key={f.hora}
                  style={[
                    styles.chipHora,
                    f.descuento > 0 && f.descuento === mejorDelDia && styles.chipHoraDestacado,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipHoraTexto,
                      f.descuento > 0 && f.descuento === mejorDelDia && styles.chipHoraTextoDestacado,
                    ]}
                  >
                    {f.hora}
                    {f.descuento > 0 ? ` −${f.descuento}%` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(tieneOferta || tarjeta.precioDesde != null || tarjeta.conteoReservas > 0) && (
          <View style={styles.filaPie}>
            {tieneOferta ? (
              <View style={styles.filaPrecio}>
                <Text style={styles.precioConDescuento}>{CRC.format(tarjeta.precioConDescuento!)}</Text>
                <Text style={styles.precioTachado}>{CRC.format(tarjeta.precioDesde!)}</Text>
              </View>
            ) : tarjeta.precioDesde != null ? (
              <Text style={styles.precioDesde}>Desde {CRC.format(tarjeta.precioDesde)}</Text>
            ) : (
              <View />
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
  descripcion: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.inkSoft,
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
  chipHoraDestacado: { backgroundColor: Colors.navy },
  chipHoraTexto: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.inkSoft },
  chipHoraTextoDestacado: { color: "#fff" },
  filaPie: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  filaPrecio: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  precioConDescuento: { fontFamily: Fonts.extraBold, fontSize: 16, color: Colors.navy },
  precioTachado: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.inkSoft,
    textDecorationLine: "line-through",
  },
  precioDesde: { fontFamily: Fonts.bold, fontSize: 13.5, color: Colors.ink },
  filaConfianza: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confianzaTexto: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.inkMuted },
});
