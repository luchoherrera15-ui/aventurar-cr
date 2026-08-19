import { Redirect } from "expo-router";

// "Mensajes" dejó de ser una pestaña del menú inferior: la bandeja es
// ahora "Consultas" (`/consultas`), y solo se llega desde Perfil o
// desde la barra del panel del negocio. Esta ruta se queda para que
// cualquier enlace viejo (push, correo, deep link) siga cayendo bien.
export default function MensajesRedirect() {
  return <Redirect href={"/consultas" as never} />;
}
