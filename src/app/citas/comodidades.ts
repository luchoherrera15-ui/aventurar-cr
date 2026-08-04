/**
 * "Comodidades del local" para la vertical Citas — el equivalente de
 * las Amenidades de Lugares de Eventos, pero con su propio set. Se
 * guardan en la misma columna `amenidades text[]` de `ranchos`: es
 * texto libre sin CHECK constraint en la base, así que mezclar ids de
 * dos sets distintos ahí es seguro (cada portal solo conoce el suyo).
 */

export const COMODIDADES_CITA: { id: string; label: string }[] = [
  { id: "parqueo", label: "Parqueo disponible" },
  { id: "wifi_clientes", label: "Wifi para clientes" },
  { id: "aire_acondicionado", label: "Aire acondicionado" },
  { id: "acceso_silla_ruedas", label: "Acceso para silla de ruedas" },
  { id: "pago_tarjeta", label: "Acepta pago con tarjeta" },
  { id: "espacio_espera", label: "Espacio de espera para acompañantes" },
];

export const COMODIDAD_CITA_LABEL: Record<string, string> = Object.fromEntries(
  COMODIDADES_CITA.map((c) => [c.id, c.label]),
);
