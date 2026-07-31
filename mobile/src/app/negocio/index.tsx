import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import { CATEGORIA_LABEL, type Categoria, type EstadoRancho } from "@/lib/types";

/**
 * "Mi negocio": los servicios y lugares que esta cuenta publicó, cada
 * uno con su estado y la entrada a administrar sus reservas. Espejo
 * del hub /mi-rancho de la web, en versión de bolsillo.
 */

const ESTADO_LABEL: Record<EstadoRancho, string> = {
  pendiente: "En revisión",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};
const ESTADO_COLOR: Record<EstadoRancho, string> = {
  pendiente: Colors.accent,
  aprobado: Colors.green,
  rechazado: Colors.danger,
};

type NegocioFila = {
  id: string;
  nombre: string;
  categoria: Categoria;
  provincia: string | null;
  foto_url: string | null;
  estado: EstadoRancho;
};

export default function MisNegociosScreen() {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [negocios, setNegocios] = useState<NegocioFila[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let vigente = true;
      supabase
        .from("ranchos")
        .select("id, nombre, categoria, provincia, foto_url, estado")
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          if (vigente) setNegocios((data ?? []) as NegocioFila[]);
        });
      return () => {
        vigente = false;
      };
    }, [session]),
  );

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacioTitulo}>Iniciá sesión</Text>
        <Text style={styles.vacioTexto}>
          Entrá a tu cuenta para publicar y administrar tus servicios.
        </Text>
        <Pressable style={styles.boton} onPress={() => router.replace("/cuenta")}>
          <Text style={styles.botonTexto}>Ir a mi perfil</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Mi negocio" subtitulo="Tus servicios y lugares publicados" />
      <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.three, paddingBottom: 40, gap: Spacing.two }}
      data={negocios ?? []}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={
        <Pressable
          style={styles.botonNuevo}
          onPress={() => router.push("/negocio/nuevo" as never)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
          <Text style={styles.botonNuevoTexto}>Publicar un servicio o lugar</Text>
        </Pressable>
      }
      ListEmptyComponent={
        negocios === null ? (
          <View style={styles.centro}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <View style={styles.centro}>
            <Text style={styles.vacioTitulo}>Todavía no publicaste nada</Text>
            <Text style={styles.vacioTexto}>
              Publicá tu lugar, catering, barra o cualquier servicio para
              eventos — una misma cuenta puede ofrecer varias cosas.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.tarjeta}
          onPress={() => router.push(`/negocio/${item.id}` as never)}
        >
          {item.foto_url ? (
            <Image source={{ uri: item.foto_url }} style={styles.foto} contentFit="cover" alt="" />
          ) : (
            <View style={[styles.foto, { backgroundColor: Colors.cream2, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="business-outline" size={22} color={Colors.inkSoft} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.categoria}>{CATEGORIA_LABEL[item.categoria]}</Text>
            <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
            {item.provincia && <Text style={styles.provincia}>{item.provincia}</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[item.estado] }]}>
            <Text style={styles.badgeTexto}>{ESTADO_LABEL[item.estado]}</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.inkSoft} />
        </Pressable>
      )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five, gap: Spacing.two },
  vacioTitulo: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.ink, textAlign: "center" },
  vacioTexto: { fontSize: 13.5, color: Colors.inkSoft, textAlign: "center", lineHeight: 19, maxWidth: 300 },
  boton: {
    marginTop: Spacing.two,
    backgroundColor: Colors.navy,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },
  botonTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 13.5 },
  botonNuevo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: Spacing.two,
  },
  botonNuevoTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14.5 },
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 16,
    padding: Spacing.two,
  },
  foto: { width: 52, height: 52, borderRadius: 12 },
  categoria: {
    fontSize: 10,
    fontFamily: Fonts.extraBold,
    textTransform: "uppercase",
    letterSpacing: 1.7,
    color: Colors.accent,
  },
  nombre: { fontSize: 14.5, fontFamily: Fonts.extraBold, color: Colors.ink },
  provincia: { fontSize: 12, color: Colors.inkSoft },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTexto: { color: "#ffffff", fontSize: 9.5, fontFamily: Fonts.bold },
});
