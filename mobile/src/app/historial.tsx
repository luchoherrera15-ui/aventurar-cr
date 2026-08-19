import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import BarraSuperior from "@/components/barra-superior";
import BarraRapida, { BARRA_RAPIDA_ESPACIO } from "@/components/barra-rapida";
import { Micro, Tarjeta, Vacio } from "@/components/ui";
import { fmtColones } from "@/lib/types";
import { DIAS_CORTO, MESES_CORTO, horaBonita } from "@/lib/citas";

type CitaHistorial = {
  id: string;
  fecha: string;
  hora_inicio: string | null;
  monto_total: number | null;
  ranchos: { nombre: string; foto_url: string | null; vertical: string | null } | null;
};

/** "2026-08-08" → "vie 8 ago 2026" sin corrimiento de zona horaria. */
function fechaBonita(fecha: string): string {
  const d = new Date(fecha + "T00:00:00");
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Historial de citas atendidas y cuánto se invirtió en ellas — a
 * diferencia de "Reservas" (que junta las cuatro verticales, en curso
 * e historial), esta pantalla es solo citas ya cumplidas, con la
 * plata sumada arriba. Se llega desde la tarjeta "Historial" de
 * Perfil; pantalla apilada (no vive en el pager), con `BarraSuperior`
 * y `BarraRapida` como el resto de las pantallas sueltas.
 */
export default function HistorialScreen() {
  const router = useRouter();
  const { session, cargando } = useAuth();
  const [citas, setCitas] = useState<CitaHistorial[] | null>(null);

  const cargar = useCallback(() => {
    if (!session) return;
    let vigente = true;
    supabase
      .from("reservas")
      .select("id, fecha, hora_inicio, monto_total, ranchos(nombre, foto_url, vertical)")
      .eq("cliente_id", session.user.id)
      .eq("estado", "cumplida")
      .order("fecha", { ascending: false })
      .then(({ data }) => {
        if (!vigente) return;
        // Solo citas (belleza, barbería, uñas, spa...) — Lugares,
        // Alimentación y el resto de eventos no entran acá, tienen su
        // resumen en "Reservas".
        setCitas(
          ((data ?? []) as unknown as CitaHistorial[]).filter(
            (r) => r.ranchos?.vertical === "citas",
          ),
        );
      });
    return () => {
      vigente = false;
    };
  }, [session]);

  useFocusEffect(cargar);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.raiz}>
        <BarraSuperior kicker="Tu actividad" titulo="Historial" />
        <View style={styles.centrado}>
          <Vacio
            icono="time-outline"
            titulo="Iniciá sesión"
            texto="Entrá a tu cuenta para ver tu historial de citas."
            accion={{ texto: "Ir a mi perfil", onPress: () => router.replace("/?tab=perfil" as never) }}
          />
        </View>
      </View>
    );
  }

  const totalGastado = (citas ?? []).reduce((acc, c) => acc + (c.monto_total ?? 0), 0);

  return (
    <View style={styles.raiz}>
      <BarraSuperior
        kicker="Tu actividad"
        titulo="Historial"
        subtitulo="Las citas que ya atendiste"
      />

      {citas === null ? (
        <View style={styles.centrado}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : citas.length === 0 ? (
        <View style={styles.centrado}>
          <Vacio
            icono="time-outline"
            titulo="Todavía no tenés citas completadas"
            texto="Cuando termines una cita, la vas a ver acá con lo que invertiste."
            accion={{ texto: "Buscar un servicio", onPress: () => router.replace("/") }}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          <Tarjeta style={styles.resumen}>
            <Micro tono="navy">Total invertido</Micro>
            <Text style={styles.montoGrande}>{fmtColones(totalGastado)}</Text>
            <Text style={styles.resumenDetalle}>
              {citas.length} {citas.length === 1 ? "cita completada" : "citas completadas"}
            </Text>
          </Tarjeta>

          <View style={{ gap: Spacing.two }}>
            {citas.map((c) => (
              <Tarjeta key={c.id} style={styles.filaCita} plana>
                <Image
                  source={c.ranchos?.foto_url ? { uri: c.ranchos.foto_url } : undefined}
                  style={styles.foto}
                  contentFit="cover"
                  alt={c.ranchos?.nombre ?? ""}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.nombre} numberOfLines={1}>
                    {c.ranchos?.nombre ?? "Proveedor"}
                  </Text>
                  <Text style={styles.fecha}>
                    {fechaBonita(c.fecha)}
                    {c.hora_inicio ? ` · ${horaBonita(c.hora_inicio)}` : ""}
                  </Text>
                </View>
                {c.monto_total !== null && (
                  <Text style={styles.monto}>{fmtColones(c.monto_total)}</Text>
                )}
              </Tarjeta>
            ))}
          </View>
        </ScrollView>
      )}

      <BarraRapida />
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  centrado: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.three },
  lista: { gap: Spacing.four, padding: Spacing.three, paddingBottom: BARRA_RAPIDA_ESPACIO },

  resumen: { alignItems: "center", gap: 4, paddingVertical: Spacing.four },
  montoGrande: {
    color: Colors.ink,
    fontFamily: Fonts.extraBold,
    fontSize: 30,
    letterSpacing: -0.5,
  },
  resumenDetalle: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 12.5 },

  filaCita: {
    alignItems: "center",
    borderColor: Colors.line,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two + 2,
    padding: Spacing.three,
  },
  foto: { backgroundColor: Colors.cream2, borderRadius: Radios.sm, height: 52, width: 52 },
  nombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 14.5 },
  fecha: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, marginTop: 2 },
  monto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
});
