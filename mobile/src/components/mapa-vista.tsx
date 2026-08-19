import { StyleSheet, View } from "react-native";
import { Vacio } from "@/components/ui";
import { Colors, Spacing } from "@/constants/theme";

/**
 * EL MAPA — versión WEB / sin módulo nativo.
 *
 * `react-native-maps` es nativo puro: importarlo en el bundle web
 * rompe el export entero (`Importing native-only module
 * "codegenNativeCommands" on web`). Metro resuelve `.native.tsx` para
 * iOS/Android y este archivo para web, así que el mapa real vive en
 * `mapa-vista.native.tsx` y acá queda el reemplazo honesto.
 *
 * Esto NO es solo para la web: una app vieja que recibe la
 * actualización por aire tampoco tiene el módulo nativo compilado. En
 * ese caso `mapa-vista.native.tsx` avisa por su cuenta — ver el
 * comentario de allá.
 */

export type RegionMapa = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type PuntoMapa = {
  id: string;
  latitud: number;
  longitud: number;
  etiqueta: string;
  elegido: boolean;
};

export type CentrarRef = { current: ((region: RegionMapa) => void) | null };

export default function MapaVista(_props: {
  regionInicial: RegionMapa;
  puntos: PuntoMapa[];
  onRegionChange: (r: RegionMapa) => void;
  onTocarPunto: (id: string) => void;
  centrarRef: CentrarRef;
}) {
  return (
    <View style={styles.centro}>
      <Vacio
        icono="map-outline"
        titulo="El mapa se ve en la app"
        texto="Abrí Bookea desde tu teléfono para ver los negocios en el mapa."
      />
    </View>
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
});
