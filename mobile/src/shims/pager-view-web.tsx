import { Children, forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Reemplazo de `react-native-pager-view` para el navegador.
 *
 * El paquete real es solo nativo (importa internals de React Native
 * que no existen en web) y, como expo-router mete todas las rutas en
 * un mismo bundle, ese import rompía el build web COMPLETO — no solo
 * la pantalla de pestañas. `metro.config.js` lo cambia por este shim
 * cuando la plataforma es web; el bundle nativo nunca lo ve y sigue
 * usando el pager de verdad.
 *
 * Implementa lo mínimo que usa `src/app/index.tsx`: mostrar la página
 * activa y responder a `setPage`. Lo que se pierde en el navegador es
 * el gesto de deslizar entre pestañas — que en escritorio no existe —
 * así que la barra inferior sigue siendo la forma de cambiar.
 */

type Props = {
  initialPage?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
  /** Lo alimenta un Animated.event en nativo; acá nadie lo dispara. */
  onPageScroll?: unknown;
};

export type PagerViewWebRef = {
  setPage: (indice: number) => void;
  setPageWithoutAnimation: (indice: number) => void;
};

const PagerViewWeb = forwardRef<PagerViewWebRef, Props>(function PagerViewWeb(
  { initialPage = 0, style, children, onPageSelected },
  ref,
) {
  const [pagina, setPagina] = useState(initialPage);

  const ir = (indice: number) => {
    setPagina(indice);
    onPageSelected?.({ nativeEvent: { position: indice } });
  };

  useImperativeHandle(ref, () => ({
    setPage: ir,
    setPageWithoutAnimation: ir,
  }));

  // Solo se monta la página activa: las pestañas de la app reciben
  // `activa` y evitan trabajo cuando no se ven, así que montarlas
  // todas en web sería puro gasto.
  const paginas = Children.toArray(children);
  return <View style={style}>{paginas[pagina] ?? null}</View>;
});

export default PagerViewWeb;
