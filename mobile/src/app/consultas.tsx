import BandejaConsultas from "@/pantallas/mensajes";

/**
 * LAS CONSULTAS, ya no una pestaña del menú inferior.
 *
 * El producto se movió a "lo más automatizado posible": nadie le
 * escribe a una tienda por gusto, así que la bandeja dejó de ser una
 * de las cinco raíces de la app. Vive acá, y se llega desde
 * Perfil › Consultas (cliente) o desde la barra del panel (negocio).
 *
 * La conversación se ABRE únicamente desde el botón "Consultar" de un
 * negocio de Eventos/Ranchos, mientras se arma una reserva — nunca
 * desde acá: esta pantalla solo LEE lo que ya existe.
 */
export default function ConsultasScreen() {
  return <BandejaConsultas />;
}
