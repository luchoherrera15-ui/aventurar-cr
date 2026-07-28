/**
 * Expo SDK 54 no trae declaraciones para importar imágenes, y Metro sí
 * las resuelve. Esto le dice a TypeScript que un `import logo from
 * "...png"` devuelve lo que `<Image source>` espera.
 */
declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";
  const contenido: ImageSourcePropType;
  export default contenido;
}
