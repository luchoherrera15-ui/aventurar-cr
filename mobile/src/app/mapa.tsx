import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { selloDe } from "@/components/tag-sello";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import TarjetaNegocio from "@/components/tarjeta-negocio";
import MapaVista, { type CentrarRef, type RegionMapa } from "@/components/mapa-vista";
import { esNegocioNuevo } from "@/components/tag-nuevo";
import { Vacio } from "@/components/ui";
import { Colors, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";

/**
 * EL MAPA, estilo Airbnb: la mitad de arriba es el mapa y la de abajo
 * la lista de lo que hay DENTRO de lo que se está viendo.
 *
 * ── LA REGLA DE ORO ────────────────────────────────────────────────
 * El mapa y la lista muestran SIEMPRE lo mismo. Cuando la persona
 * arrastra o hace zoom, la lista se recalcula contra la región nueva
 * (`onRegionChange`) — nunca queda una lista de "cerca de vos"
 * mientras el mapa mira otra provincia, que es el error clásico de
 * esta pantalla.
 *
 * ── UBICACIÓN: OPCIONAL, NUNCA UN MURO ─────────────────────────────
 * Se pide permiso una vez. Si lo dan, el mapa arranca donde está la
 * persona; si no, arranca sobre el Valle Central y todo lo demás
 * funciona igual. Un mapa que no se puede usar sin GPS es un mapa
 * roto.
 *
 * El MapView vive en `components/mapa-vista` (con su gemelo
 * `.native`): `react-native-maps` es nativo puro y rompe el bundle de
 * web si se importa desde acá.
 */

/** El Valle Central: el arranque cuando no hay permiso de ubicación. */
const REGION_INICIAL: RegionMapa = {
  latitude: 9.9333,
  longitude: -84.0833,
  latitudeDelta: 0.6,
  longitudeDelta: 0.6,
};

type NegocioMapa = {
  /** El sello de la tarjeta: los mismos que la web (0214/0217). */
  verificado?: boolean | null;
  info_publica?: boolean | null;

  id: string;
  nombre: string;
  vertical: string | null;
  categoria: string | null;
  provincia: string | null;
  canton: string | null;
  foto_url: string | null;
  precio_desde: number | null;
  latitud: number;
  longitud: number;
  created_at: string | null;
};

/** A qué ficha lleva cada vertical. */
function rutaDeNegocio(vertical: string | null, id: string): string {
  switch (vertical) {
    case "citas":
      return `/citas/${id}`;
    case "restaurantes":
      return `/restaurantes/${id}`;
    default:
      return `/rancho/${id}`;
  }
}

export default function MapaScreen() {
  const router = useRouter();
  // La vertical desde donde se abrió, para no mezclar barberías con
  // salones de eventos en el mismo mapa.
  const { vertical } = useLocalSearchParams<{ vertical?: string }>();

  const [negocios, setNegocios] = useState<NegocioMapa[] | null>(null);
  const [region, setRegion] = useState<RegionMapa>(REGION_INICIAL);
  const [elegido, setElegido] = useState<string | null>(null);
  const centrarRef = useRef<((r: RegionMapa) => void) | null>(null) as CentrarRef;

  // ── Los negocios con coordenadas ────────────────────────────────
  const cargar = useCallback(async () => {
    let q = supabase
      .from("ranchos")
      .select(
        "id, nombre, vertical, categoria, provincia, canton, foto_url, precio_desde, latitud, longitud, created_at, verificado, info_publica",
      )
      .eq("estado", "aprobado")
      // ⚠️ Sin los negocios de la DEMO (27 ago 2026). El seed de
      // /demo-bookea siembra 99 negocios APROBADOS con
      // en_marketplace=false — la web los filtra así desde
      // home-datos.ts, pero la app no lo hacía y los 99 se le
      // colaron a los listados. `neq` y no `eq(true)`: un NULL
      // viejo no es ni igual ni distinto a true en Postgres.
      .neq("en_marketplace", false)
      // Sin coordenadas no hay nada que poner en el mapa.
      .not("latitud", "is", null)
      .not("longitud", "is", null);
    if (vertical) q = q.eq("vertical", vertical);

    const { data } = await q;
    setNegocios((data ?? []) as NegocioMapa[]);
  }, [vertical]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  // ── La ubicación, si la dan ─────────────────────────────────────
  useEffect(() => {
    let vigente = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !vigente) return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!vigente) return;
      const cerca: RegionMapa = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      };
      setRegion(cerca);
      centrarRef.current?.(cerca);
    })();
    return () => {
      vigente = false;
    };
  }, []);

  // Lo que cae DENTRO de lo que se está viendo. Es lo que hace que el
  // mapa y la lista digan lo mismo.
  const visibles = useMemo(() => {
    if (!negocios) return [];
    const latMin = region.latitude - region.latitudeDelta / 2;
    const latMax = region.latitude + region.latitudeDelta / 2;
    const lngMin = region.longitude - region.longitudeDelta / 2;
    const lngMax = region.longitude + region.longitudeDelta / 2;
    return negocios.filter(
      (n) =>
        n.latitud >= latMin &&
        n.latitud <= latMax &&
        n.longitud >= lngMin &&
        n.longitud <= lngMax,
    );
  }, [negocios, region]);

  const puntos = useMemo(
    () =>
      (negocios ?? []).map((n) => ({
        id: n.id,
        latitud: n.latitud,
        longitud: n.longitud,
        // `fmtColones` puede devolver null; el pin siempre tiene que
        // decir algo, así que cae al nombre corto.
        etiqueta:
          (n.precio_desde ? fmtColones(n.precio_desde) : null) ?? n.nombre.slice(0, 12),
        elegido: elegido === n.id,
      })),
    [negocios, elegido],
  );

  return (
    <View style={styles.contenedor}>
      <BarraSuperior
        titulo="Cerca de vos"
        subtitulo={
          negocios === null
            ? undefined
            : `${visibles.length} ${visibles.length === 1 ? "negocio" : "negocios"} en el mapa`
        }
      />

      {/* ── LA MITAD DE ARRIBA: EL MAPA ──────────────────────────── */}
      <View style={styles.mapaZona}>
        <MapaVista
          regionInicial={REGION_INICIAL}
          puntos={puntos}
          onRegionChange={setRegion}
          onTocarPunto={setElegido}
          centrarRef={centrarRef}
        />
        {negocios === null && (
          <View style={styles.cargandoMapa} pointerEvents="none">
            <ActivityIndicator color={Colors.accent} />
          </View>
        )}
      </View>

      {/* ── LA MITAD DE ABAJO: LO QUE SE VE EN EL MAPA ───────────── */}
      <View style={styles.listaZona}>
        {negocios === null ? (
          <View style={styles.centro}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : negocios.length === 0 ? (
          /* Ningún negocio tiene ubicación cargada todavía. Es distinto
             de "no hay nada en esta zona": el mapa no está roto, es que
             falta el dato — y decirlo así evita que parezca una falla. */
          <View style={styles.centro}>
            <Vacio
              icono="location-outline"
              titulo="Todavía nadie puso su ubicación"
              texto="Los negocios aparecen en el mapa cuando marcan dónde quedan, desde su panel en bookea.lat."
            />
          </View>
        ) : visibles.length === 0 ? (
          <View style={styles.centro}>
            <Vacio
              icono="map-outline"
              titulo="Nada por acá"
              texto="Movete o alejá el mapa para ver negocios en otra zona."
            />
          </View>
        ) : (
          <FlatList
            data={visibles}
            keyExtractor={(n) => n.id}
            numColumns={2}
            columnWrapperStyle={styles.columna}
            contentContainerStyle={styles.lista}
            renderItem={({ item: n }) => (
              <View style={{ flex: 1 }}>
                <TarjetaNegocio
                  nombre={n.nombre}
                  foto={n.foto_url}
                  etiqueta={n.canton ?? n.provincia ?? "Costa Rica"}
                  ubicacion={[n.canton, n.provincia].filter(Boolean).join(", ") || null}
                  nuevo={esNegocioNuevo(n.created_at)}
                  sello={selloDe(n)}
                  onPress={() => router.push(rutaDeNegocio(n.vertical, n.id) as never)}
                />
              </View>
            )}
          />
        )}
      </View>

      {/* Volver a mi ubicación. */}
      <Pressable
        style={styles.botonUbicacion}
        accessibilityLabel="Centrar en mi ubicación"
        onPress={async () => {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== "granted") return;
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          centrarRef.current?.({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          });
        }}
      >
        <Ionicons name="locate" size={19} color={Colors.navy} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  // Mitad y mitad, como pidió el dueño.
  mapaZona: { backgroundColor: Colors.blueLight, flex: 1 },
  listaZona: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center", padding: Spacing.four },
  cargandoMapa: {
    alignItems: "center",
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  lista: { gap: Spacing.three, padding: Spacing.three },
  columna: { gap: Spacing.three },
  botonUbicacion: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: Colors.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: Spacing.three,
    // Justo encima de la línea donde termina el mapa.
    top: "42%",
    width: 44,
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
});
