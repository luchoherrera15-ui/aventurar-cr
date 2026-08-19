import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Vacio } from "@/components/ui";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import type { CentrarRef, PuntoMapa, RegionMapa } from "@/components/mapa-vista";

/**
 * EL MAPA DE VERDAD — solo iOS/Android.
 *
 * ── DOS COSAS DISTINTAS QUE SE PARECEN ─────────────────────────────
 * 1. La WEB no puede con `react-native-maps` (es nativo puro). Eso lo
 *    resuelve Metro solo: en web carga `mapa-vista.tsx`, nunca este.
 * 2. Una app YA INSTALADA que recibe una actualización por aire (OTA)
 *    tampoco tiene el módulo compilado adentro. Eso Metro no lo puede
 *    resolver — el archivo sí se carga, y un `import` normal arriba
 *    reventaría la pantalla en blanco.
 *
 * Por eso el `require` va adentro de un try: en una app vieja queda
 * `null` y se muestra "actualizá la app" en vez de romper.
 */
type MapaModulo = {
  default: React.ComponentType<Record<string, unknown>>;
  Marker: React.ComponentType<Record<string, unknown>>;
};

let mapas: MapaModulo | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga condicional de un módulo nativo, ver arriba
  mapas = require("react-native-maps") as MapaModulo;
} catch {
  mapas = null;
}

export default function MapaVista({
  regionInicial,
  puntos,
  onRegionChange,
  onTocarPunto,
  centrarRef,
}: {
  regionInicial: RegionMapa;
  puntos: PuntoMapa[];
  onRegionChange: (r: RegionMapa) => void;
  onTocarPunto: (id: string) => void;
  /** La pantalla usa esto para "volver a mi ubicación" sin tener que
   *  conocer el tipo del ref nativo. */
  centrarRef: CentrarRef;
}) {
  const mapaRef = useRef<{ animateToRegion: (r: RegionMapa, ms: number) => void } | null>(null);

  if (!mapas) {
    return (
      <View style={styles.centro}>
        <Vacio
          icono="cloud-download-outline"
          titulo="El mapa llega en la próxima versión"
          texto="Esta parte necesita una actualización de la app, no alcanza con recargar. Te avisamos apenas esté lista."
        />
      </View>
    );
  }

  const Mapa = mapas.default;
  const Marcador = mapas.Marker;

  return (
    <Mapa
      ref={(r: { animateToRegion: (reg: RegionMapa, ms: number) => void } | null) => {
        mapaRef.current = r;
        centrarRef.current = r ? (reg: RegionMapa) => r.animateToRegion(reg, 600) : null;
      }}
      style={StyleSheet.absoluteFill}
      initialRegion={regionInicial}
      onRegionChangeComplete={onRegionChange}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {puntos.map((p) => (
        <Marcador
          key={p.id}
          coordinate={{ latitude: p.latitud, longitude: p.longitud }}
          onPress={() => onTocarPunto(p.id)}
        >
          {/* Un pin con el precio, como Airbnb: se lee de un vistazo
              sin tener que tocar cada uno. */}
          <View style={[styles.pin, p.elegido && styles.pinElegido]}>
            <Text style={[styles.pinTexto, p.elegido && styles.pinTextoElegido]} numberOfLines={1}>
              {p.etiqueta}
            </Text>
          </View>
        </Marcador>
      ))}
    </Mapa>
  );
}

const styles = StyleSheet.create({
  centro: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    flex: 1,
    justifyContent: "center",
    padding: Spacing.four,
  },
  pin: {
    backgroundColor: "#ffffff",
    borderColor: Colors.line,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  pinElegido: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pinTexto: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 11.5 },
  pinTextoElegido: { color: "#ffffff" },
});
