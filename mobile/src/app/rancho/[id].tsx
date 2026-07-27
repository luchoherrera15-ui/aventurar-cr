import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import {
  CATEGORIA_LABEL,
  fmtColones,
  type DiaDisponibilidad,
  type Rancho,
} from "@/lib/types";

const DIAS_A_MOSTRAR = 60;
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function RanchoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [rancho, setRancho] = useState<Rancho | null>(null);
  const [disponibilidad, setDisponibilidad] = useState<Record<string, DiaDisponibilidad>>({});
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("ranchos")
      .select("*")
      .eq("id", id)
      .eq("estado", "aprobado")
      .maybeSingle();

    if (error || !data) {
      setError("No encontramos esta publicación.");
      return;
    }
    const fila = data as Rancho;
    setRancho(fila);
    navigation.setOptions({ title: fila.nombre });

    if (fila.categoria !== "lugares") return;

    // Limpia holds vencidos antes de leer, igual que /web, para no
    // mostrar como ocupada una fecha que ya se liberó sola.
    await supabase
      .from("reservas")
      .delete()
      .eq("rancho_id", fila.id)
      .eq("estado", "temporal")
      .lt("expira_en", new Date().toISOString());

    const { data: dispData } = await supabase
      .from("disponibilidad_rancho")
      .select("fecha, estado")
      .eq("rancho_id", fila.id);

    const acc: Record<string, DiaDisponibilidad> = {};
    (dispData ?? []).forEach((r) => {
      const dia = acc[r.fecha] ?? { confirmada: false, pendientes: 0, temporales: 0 };
      if (r.estado === "confirmada") dia.confirmada = true;
      else if (r.estado === "temporal") dia.temporales += 1;
      else dia.pendientes += 1;
      acc[r.fecha] = dia;
    });
    setDisponibilidad(acc);
  }, [id, navigation]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  const proximosDias = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Array.from({ length: DIAS_A_MOSTRAR }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!rancho) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const esLugar = rancho.categoria === "lugares";
  const whatsappHref = rancho.contacto_whatsapp
    ? `https://wa.me/${rancho.contacto_whatsapp.replace(/[^0-9]/g, "")}`
    : null;
  const ubicacion = [rancho.provincia, rancho.direccion_exacta || rancho.canton]
    .filter(Boolean)
    .join(", ");

  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={{ paddingBottom: Spacing.six }}>
      <Image
        source={rancho.foto_url ? { uri: rancho.foto_url } : undefined}
        style={styles.portada}
        contentFit="cover"
        alt={rancho.nombre}
      />

      <View style={styles.seccion}>
        <Text style={styles.etiqueta}>{CATEGORIA_LABEL[rancho.categoria]}</Text>
        <Text style={styles.titulo}>{rancho.nombre}</Text>
        {ubicacion ? <Text style={styles.ubicacion}>{ubicacion}</Text> : null}

        {rancho.descripcion ? (
          <Text style={styles.descripcion}>{rancho.descripcion}</Text>
        ) : null}

        <View style={styles.datosFila}>
          {(rancho.capacidad_min || rancho.capacidad_max) && (
            <View style={styles.dato}>
              <Text style={styles.datoTitulo}>Capacidad</Text>
              <Text style={styles.datoValor}>
                {rancho.capacidad_min ?? "?"}–{rancho.capacidad_max ?? "?"} personas
              </Text>
            </View>
          )}
          {rancho.precio_desde !== null && (
            <View style={styles.dato}>
              <Text style={styles.datoTitulo}>Precio</Text>
              <Text style={styles.datoValor}>Desde {fmtColones(rancho.precio_desde)}</Text>
            </View>
          )}
        </View>

        {rancho.amenidades.length > 0 && (
          <View style={styles.bloque}>
            <Text style={styles.bloqueTitulo}>Amenidades</Text>
            <View style={styles.chips}>
              {rancho.amenidades.map((a) => (
                <View key={a} style={styles.chip}>
                  <Text style={styles.chipTexto}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {esLugar ? (
          <View style={styles.bloque}>
            <Text style={styles.bloqueTitulo}>Disponibilidad</Text>
            <Text style={styles.hint}>
              Elegí un día libre para empezar tu reserva.
            </Text>
            <View style={styles.diasGrid}>
              {proximosDias.map((d) => {
                const iso = fechaISO(d);
                const info = disponibilidad[iso];
                const bloqueado = !!info?.confirmada;
                return (
                  <Pressable
                    key={iso}
                    disabled={bloqueado}
                    onPress={() =>
                      router.push({
                        pathname: "/rancho/[id]/reservar",
                        params: { id: rancho.id, fecha: iso },
                      })
                    }
                    style={[
                      styles.diaCelda,
                      bloqueado && styles.diaBloqueado,
                      !bloqueado && !!info?.pendientes && styles.diaPendiente,
                    ]}
                  >
                    <Text style={styles.diaSemana}>{DIAS_SEMANA[d.getDay()]}</Text>
                    <Text style={[styles.diaNumero, bloqueado && styles.diaNumeroBloqueado]}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.leyenda}>
              <View style={styles.leyendaItem}>
                <View style={[styles.leyendaPunto, { backgroundColor: Colors.surface, borderColor: Colors.line, borderWidth: 1 }]} />
                <Text style={styles.leyendaTexto}>Libre</Text>
              </View>
              <View style={styles.leyendaItem}>
                <View style={[styles.leyendaPunto, { backgroundColor: Colors.accentLight }]} />
                <Text style={styles.leyendaTexto}>Con solicitudes</Text>
              </View>
              <View style={styles.leyendaItem}>
                <View style={[styles.leyendaPunto, { backgroundColor: Colors.line }]} />
                <Text style={styles.leyendaTexto}>Ocupado</Text>
              </View>
            </View>
          </View>
        ) : (
          whatsappHref && (
            <Pressable
              style={styles.botonPrimario}
              onPress={() => Linking.openURL(whatsappHref)}
            >
              <Text style={styles.botonPrimarioTexto}>Pedir cotización por WhatsApp</Text>
            </Pressable>
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  error: { color: Colors.danger, textAlign: "center" },
  portada: { width: "100%", height: 240, backgroundColor: Colors.cream2 },
  seccion: { padding: Spacing.four, gap: Spacing.two },
  etiqueta: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: Colors.accent,
  },
  titulo: { fontSize: 24, fontFamily: Fonts.extraBold, color: Colors.ink },
  ubicacion: { fontSize: 14, color: Colors.inkSoft },
  descripcion: { fontSize: 14, color: Colors.ink, lineHeight: 20, marginTop: Spacing.two },
  datosFila: { flexDirection: "row", gap: Spacing.four, marginTop: Spacing.three },
  dato: { gap: 2 },
  datoTitulo: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.inkSoft, textTransform: "uppercase" },
  datoValor: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  bloque: { marginTop: Spacing.four, gap: Spacing.two },
  bloqueTitulo: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.ink },
  hint: { fontSize: 13, color: Colors.inkSoft },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    backgroundColor: Colors.cream2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipTexto: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.ink },
  diasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  diaCelda: {
    width: 42,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  diaPendiente: { backgroundColor: Colors.accentLight },
  diaBloqueado: { backgroundColor: Colors.line, opacity: 0.6 },
  diaSemana: { fontSize: 9, color: Colors.inkSoft, fontFamily: Fonts.bold },
  diaNumero: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  diaNumeroBloqueado: { color: Colors.inkSoft },
  leyenda: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three, marginTop: Spacing.two },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  leyendaPunto: { width: 12, height: 12, borderRadius: 4 },
  leyendaTexto: { fontSize: 12, color: Colors.inkSoft },
  botonPrimario: {
    marginTop: Spacing.four,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonPrimarioTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
});
