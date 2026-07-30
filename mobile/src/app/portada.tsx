import { useRouter } from "expo-router";
import Portada from "@/pantallas/portada";

/**
 * La portada como pantalla suelta: para volver al selector de las
 * tres verticales (Eventos / Citas / Hospedajes) desde adentro de la
 * app — el botón de inicio en Explorar llega acá. Elegir Eventos
 * simplemente regresa a las pestañas, que quedaron debajo en la pila.
 */
export default function PortadaScreen() {
  const router = useRouter();
  return <Portada onEntrar={() => router.back()} />;
}
