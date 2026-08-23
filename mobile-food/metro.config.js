// Configuración de Metro: la de Expo, más un solo cambio.
//
// `react-native-pager-view` (el pager de las cinco pestañas) es un
// paquete solo nativo: importa internals de React Native que no
// existen en el navegador. Como expo-router arma un único bundle con
// TODAS las rutas, ese import rompía el build web entero, no solo la
// pantalla de pestañas — y con él, la posibilidad de previsualizar la
// app en un navegador. Mismo shim que ya usa `mobile/` (Bookea).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const SHIM_PAGER_WEB = path.resolve(__dirname, "src/shims/pager-view-web.tsx");
const resolverPrevio = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-pager-view") {
    return { type: "sourceFile", filePath: SHIM_PAGER_WEB };
  }
  return (resolverPrevio ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
