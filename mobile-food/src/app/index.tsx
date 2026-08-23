import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useLocalSearchParams } from "expo-router";
import TabBar, { TABS } from "@/components/tab-bar";
import Inicio from "@/pantallas/inicio";
import Descubrir from "@/pantallas/descubrir";
import Reservas from "@/pantallas/reservas";
import Favoritos from "@/pantallas/favoritos";
import Perfil from "@/pantallas/perfil";

/**
 * Las cinco pestañas raíz en un pager horizontal — mismo patrón que
 * Bookea (mobile/src/app/index.tsx): se cambia tocando el dock,
 * arrastrando el dedo sobre él, O deslizando la pantalla hacia los
 * lados. `onPageScroll` alimenta un Animated.Value en el hilo
 * nativo, así que el dock sigue el dedo sin jank.
 */
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function TabsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();

  const [activa, setActiva] = useState(() => {
    const i = TABS.findIndex((t) => t.id === tab);
    return i >= 0 ? i : 0;
  });
  const pagerRef = useRef<PagerView>(null);

  const [posicion] = useState(() => new Animated.Value(activa));
  const [corrimiento] = useState(() => new Animated.Value(0));
  const desplazamiento = useMemo(() => Animated.add(posicion, corrimiento), [posicion, corrimiento]);
  const onPageScroll = useMemo(
    () => Animated.event([{ nativeEvent: { position: posicion, offset: corrimiento } }], { useNativeDriver: true }),
    [posicion, corrimiento],
  );

  useEffect(() => {
    const i = TABS.findIndex((t) => t.id === tab);
    if (i >= 0) {
      pagerRef.current?.setPage(i);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la pestaña con el parámetro de la URL
      setActiva(i);
    }
  }, [tab]);

  function irA(i: number) {
    pagerRef.current?.setPage(i);
    setActiva(i);
  }

  return (
    <View style={{ flex: 1 }}>
      <AnimatedPagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={activa}
        onPageScroll={onPageScroll}
        onPageSelected={(e) => setActiva(e.nativeEvent.position)}
      >
        <View key="inicio" style={{ flex: 1 }}>
          <Inicio activa={activa === 0} />
        </View>
        <View key="descubrir" style={{ flex: 1 }}>
          <Descubrir activa={activa === 1} />
        </View>
        <View key="reservas" style={{ flex: 1 }}>
          <Reservas activa={activa === 2} />
        </View>
        <View key="favoritos" style={{ flex: 1 }}>
          <Favoritos activa={activa === 3} />
        </View>
        <View key="perfil" style={{ flex: 1 }}>
          <Perfil activa={activa === 4} />
        </View>
      </AnimatedPagerView>
      <TabBar activa={activa} desplazamiento={desplazamiento} onCambiar={irA} />
    </View>
  );
}
