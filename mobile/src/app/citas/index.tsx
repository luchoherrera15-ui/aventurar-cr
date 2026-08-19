import { Redirect } from "expo-router";

// Citas/Servicios pasó a ser la pestaña de aterrizaje del pager (antes
// era Eventos, ver `pantallas/citas.tsx` y `pantallas/explorar.tsx`) —
// esta ruta solo redirige para que los enlaces internos viejos a
// "/citas" sigan funcionando.
export default function CitasRedirect() {
  return <Redirect href="/" />;
}
