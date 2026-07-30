import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useLocalSearchParams } from "expo-router";
import TabBar, { TABS } from "@/components/tab-bar";
import Explorar from "@/pantallas/explorar";
import Favoritos from "@/pantallas/favoritos";
import Reservas from "@/pantallas/reservas";
import Mensajes from "@/pantallas/mensajes";
import Perfil from "@/pantallas/perfil";
import Portada from "@/pantallas/portada";

/**
 * Al abrir la app en frío aparece la portada — la misma intro que la
 * web — para escoger qué se quiere reservar; entrar a Eventos revela
 * las pestañas. El resto de la sesión la portada no vuelve a salir
 * (bandera de módulo), y los enlaces internos con ?tab=... la saltan.
 *
 * Las cinco pestañas viven en un pager horizontal: se cambia tocando
 * la barra inferior O deslizando la pantalla hacia los lados, como
 * Instagram. Las rutas viejas (/favoritos, /cuenta...) redirigen acá
 * con ?tab=... para que todos los enlaces internos sigan funcionando.
 */
let portadaVista = false;

// El pager animado deja que onPageScroll alimente un Animated.Value
// en el hilo nativo — la píldora de la tab bar sigue el dedo sin jank.
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function TabsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [mostrarPortada, setMostrarPortada] = useState(
    () => !portadaVista && tab == null,
  );
  const [activa, setActiva] = useState(() => {
    const i = TABS.findIndex((t) => t.id === tab);
    return i >= 0 ? i : 0;
  });
  const pagerRef = useRef<PagerView>(null);

  // Posición continua del pager (página + corrimiento del deslizamiento):
  // la tab bar la usa para que su indicador acompañe el gesto en vivo.
  // Van en useState perezoso (no useRef): son instancias estables que
  // sí participan del render, justo lo que pide react-hooks/refs.
  const [posicion] = useState(() => new Animated.Value(activa));
  const [corrimiento] = useState(() => new Animated.Value(0));
  const desplazamiento = useMemo(
    () => Animated.add(posicion, corrimiento),
    [posicion, corrimiento],
  );
  const onPageScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { position: posicion, offset: corrimiento } }],
        { useNativeDriver: true },
      ),
    [posicion, corrimiento],
  );

  // Si llega un ?tab=... con la portada todavía visible, se descarta
  // durante el render mismo (el patrón de React para ajustar estado
  // cuando cambian las props — sin efecto de por medio).
  if (mostrarPortada && tab != null) {
    setMostrarPortada(false);
  }

  // La bandera de módulo se escribe fuera del render: apenas la
  // portada sale de pantalla, no vuelve a aparecer en esta sesión.
  useEffect(() => {
    if (!mostrarPortada) portadaVista = true;
  }, [mostrarPortada]);

  // Navegaciones tipo router.replace("/?tab=perfil") mueven el pager.
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

  if (mostrarPortada) {
    return <Portada onEntrar={() => setMostrarPortada(false)} />;
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
        <View key="explorar" style={{ flex: 1 }}>
          <Explorar activa={activa === 0} />
        </View>
        <View key="favoritos" style={{ flex: 1 }}>
          <Favoritos activa={activa === 1} />
        </View>
        <View key="reservas" style={{ flex: 1 }}>
          <Reservas activa={activa === 2} />
        </View>
        <View key="mensajes" style={{ flex: 1 }}>
          <Mensajes activa={activa === 3} />
        </View>
        <View key="perfil" style={{ flex: 1 }}>
          <Perfil activa={activa === 4} />
        </View>
      </AnimatedPagerView>
      <TabBar activa={activa} desplazamiento={desplazamiento} onCambiar={irA} />
    </View>
  );
}
