import { Redirect } from "expo-router";

// La pestaña vive en el pager del inicio — esta ruta solo redirige
// para que los enlaces internos viejos sigan funcionando.
export default function MensajesRedirect() {
  return <Redirect href="/?tab=mensajes" />;
}
