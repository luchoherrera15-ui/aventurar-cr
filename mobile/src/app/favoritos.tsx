import Favoritos from "@/pantallas/favoritos";

/**
 * Favoritos, como PANTALLA propia.
 *
 * Antes esto era un `Redirect` a la pestaña: los favoritos vivían
 * mezclados con las promos en la segunda pestaña. Son cosas distintas
 * —una es lo que ofrecen los negocios, la otra es lo que esta persona
 * guardó— y el dueño pidió separarlas. Favoritos vuelve a donde ya
 * estaba su puerta: Perfil › Favoritos.
 */
export default function FavoritosScreen() {
  return <Favoritos />;
}
