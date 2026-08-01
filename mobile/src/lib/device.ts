import AsyncStorage from "@react-native-async-storage/async-storage";

const CLAVE = "bookeacr:device_id";

/**
 * En /web, `reservas.creado_por_ip` guarda la IP de quien reservó
 * (se obtiene en el server action, ver src/app/eventos/reserva-actions.ts).
 * Un cliente móvil no tiene esa noción — no hay request HTTP con
 * headers que pasar por un server component — así que en su lugar
 * generamos un id de dispositivo persistente y lo guardamos en esa
 * misma columna (es texto libre). Sirve igual para identificar qué
 * hold es "propio" al mostrar el estado del calendario.
 */
export async function obtenerIdDispositivo(): Promise<string> {
  const guardado = await AsyncStorage.getItem(CLAVE);
  if (guardado) return guardado;
  const nuevo = `movil-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(CLAVE, nuevo);
  return nuevo;
}
