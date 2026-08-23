/** Los identificadores de las cinco pestañas raíz de FOOD.BOOKEA —
 *  mismo motivo que mobile/src/lib/pestanas.ts (Bookea): separado de
 *  tab-bar.tsx porque ese archivo importa React Native y las pruebas
 *  de este proyecto corren en Node. */
export const IDS_PESTANAS = ["inicio", "descubrir", "reservas", "favoritos", "perfil"] as const;

export type IdPestana = (typeof IDS_PESTANAS)[number];
