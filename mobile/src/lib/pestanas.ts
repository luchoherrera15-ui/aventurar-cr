/**
 * Los identificadores de las cuatro pestañas raíz.
 *
 * Viven acá, en `src/lib`, y no dentro de `components/tab-bar.tsx`,
 * por una razón concreta: `tab-bar.tsx` importa React Native, y las
 * pruebas de este proyecto corren en Node sin montar componentes (ver
 * el comentario de `vitest.config.mts`). Cualquier lógica que necesite
 * saber qué pestañas existen —como la que decide adónde lleva una
 * notificación— quedaría sin poder probarse.
 *
 * `tab-bar.tsx` sigue siendo el dueño de cómo se VEN (rótulo, ícono,
 * orden); acá solo está QUÉ hay. Los dos leen esta lista, así que no
 * se pueden desincronizar.
 *
 * El id "explorar" quedó como nombre interno aunque la pestaña se
 * llame "Inicio": lo usan `?tab=explorar` y los botones de los estados
 * vacíos, y renombrarlo rompería las notificaciones ya enviadas.
 */
export const IDS_PESTANAS = ["explorar", "promos", "reservas", "perfil"] as const;

export type IdPestana = (typeof IDS_PESTANAS)[number];
