/**
 * ════════════════════════════════════════════════════════════════════
 *  QUÉ SERVICIOS HACE CADA PERSONA DEL EQUIPO
 * ════════════════════════════════════════════════════════════════════
 *
 * ── LA TABLA SE LEE AL REVÉS DE LO QUE SU NOMBRE SUGIERE ────────────
 *
 * `servicios_recurso` parece una lista de «qué sabe hacer fulano». No
 * lo es. Es una lista de RESTRICCIONES:
 *
 *   · un servicio CON filas  → solo lo dan las personas listadas ahí;
 *   · un servicio SIN filas  → lo da TODO el equipo.
 *
 * Así lo decide el motor de reservas, que es la autoridad sobre esto
 * (`lib/agenda/equipo.ts`: `restringido = asignados.size > 0`). Un
 * negocio que nunca abre esa pantalla —el caso normal, porque no hace
 * falta abrirla para que todo funcione— tiene CERO filas y su equipo
 * hace absolutamente todo.
 *
 * ── POR QUÉ ESTO VIVE ACÁ Y NO SUELTO EN LA PÁGINA ──────────────────
 *
 * Porque ya se leyó mal una vez. La ficha pública recorría las filas y
 * armaba la lista de cada quien, que es exactamente la lectura
 * invertida: mostraba a todo el equipo sin un solo servicio, como si
 * nadie hiciera nada. Se detectó en Glow Nails —12 servicios en el
 * catálogo, 0 en la ficha de la estilista— y el dato correcto no era
 * «faltan datos» sino «los hace todos».
 *
 * Una función con nombre y pruebas al lado hace que la próxima persona
 * lea la regla antes que el bucle.
 *
 * ⚠️ NO SE ARREGLA ESCRIBIÉNDOLE FILAS A LA PERSONA. Eso CREA una
 * restricción donde no había: mientras esté sola da igual, pero el día
 * que el negocio contrate a alguien más, esa persona nueva queda
 * excluida de todos los servicios sin que nadie entienda por qué.
 */

export type ServicioDelCatalogo = { id: string; nombre: string };
export type RestriccionServicio = { item_id: string; miembro_id: string };

/**
 * Devuelve, para cada miembro, los nombres de los servicios que hace.
 *
 * El orden respeta el del catálogo: primero los abiertos a todo el
 * equipo y después los que le tocan por restricción. Importa porque
 * quien llama recorta a los primeros («servicios principales»), y sin
 * un orden estable la tarjeta de una misma persona mostraría cosas
 * distintas entre recargas.
 */
export function serviciosPorMiembro(
  items: ServicioDelCatalogo[],
  miembroIds: string[],
  restricciones: RestriccionServicio[],
): Map<string, string[]> {
  const nombrePorItem = new Map(items.map((i) => [i.id, i.nombre]));

  // Un servicio está restringido si ALGUIEN aparece asignado a él, sin
  // importar quién. Ese "alguien" es lo que apaga el "todos".
  const conRestriccion = new Set(restricciones.map((r) => r.item_id));

  const abiertosATodos = items
    .filter((i) => !conRestriccion.has(i.id))
    .map((i) => i.nombre);

  const porMiembro = new Map<string, string[]>();
  for (const id of miembroIds) porMiembro.set(id, [...abiertosATodos]);

  for (const r of restricciones) {
    const nombre = nombrePorItem.get(r.item_id);
    // Una restricción puede apuntar a un servicio que ya no está en el
    // catálogo (se borró, o se pausó y no vino en la consulta). Se
    // ignora en vez de meter un `undefined` en la lista.
    if (!nombre) continue;
    const lista = porMiembro.get(r.miembro_id);
    // Y puede apuntar a alguien que ya no está en el equipo. Tampoco se
    // inventa una entrada para un miembro que no existe.
    if (!lista) continue;
    if (!lista.includes(nombre)) lista.push(nombre);
  }

  return porMiembro;
}
