/**
 * Los datos de MUESTRA con los que se ve una plantilla antes de usarla:
 * nombres, saludo, fecha y lugar de mentira, uno por tipo de celebración.
 * Los comparten las tarjetas del catálogo (la miniatura de la portada) y
 * la vista previa a pantalla completa (`/celebrar/plantillas/<slug>`).
 * Nada de esto se guarda: al elegir la plantilla, el editor la rellena
 * con los datos de verdad de la celebración.
 */
export const SALUDO_MUESTRA: Record<string, string> = {
  boda: "Nos casamos",
  cumpleanos: "¡Estás invitado!",
  xv: "Mis quince años",
  baby_shower: "Baby shower",
  bautizo: "Mi bautizo",
  graduacion: "Graduación",
  aniversario: "Nuestro aniversario",
  despedida: "Despedida",
  fiesta: "¡Fiesta!",
  corporativo: "Invitación",
  otro: "Te invitamos",
};

export const NOMBRE_MUESTRA: Record<string, string> = {
  boda: "Sofía & Andrés",
  cumpleanos: "Los 7 de Mateo",
  xv: "Camila Fernanda",
  baby_shower: "Bebé Valentina",
  bautizo: "Bautizo de Lucas",
  graduacion: "Graduación de Daniela",
  aniversario: "25 años juntos",
  despedida: "La despedida de Andrea",
  fiesta: "Noche Blanca",
  corporativo: "Cena anual 2026",
  otro: "Nuestra celebración",
};

const LUGAR_MUESTRA: Record<string, { lugar: string; direccion: string; hora: string }> = {
  boda: { lugar: "Hacienda Los Sueños", direccion: "San Rafael de Escazú, San José", hora: "16:00" },
  cumpleanos: { lugar: "Rancho La Ceiba", direccion: "San Joaquín de Flores, Heredia", hora: "14:00" },
  xv: { lugar: "Salón Real", direccion: "Cartago centro", hora: "19:00" },
  baby_shower: { lugar: "Casa de la familia", direccion: "Santa Ana, San José", hora: "11:00" },
  bautizo: { lugar: "Parroquia San José", direccion: "San José centro", hora: "10:00" },
  graduacion: { lugar: "Auditorio UCR", direccion: "San Pedro de Montes de Oca", hora: "18:00" },
  aniversario: { lugar: "Restaurante Il Giardino", direccion: "San Pedro, San José", hora: "19:00" },
  despedida: { lugar: "Terraza del puerto", direccion: "Puntarenas", hora: "18:00" },
  fiesta: { lugar: "Rooftop Central", direccion: "Barrio Escalante, San José", hora: "20:00" },
  corporativo: { lugar: "Hotel Real Intercontinental", direccion: "Escazú, San José", hora: "18:30" },
  otro: { lugar: "El lugar de la celebración", direccion: "San José", hora: "17:00" },
};

/** La celebración de mentira con la que se muestra una plantilla. */
export function celebracionDeMuestra(tipo: string) {
  const l = LUGAR_MUESTRA[tipo] ?? LUGAR_MUESTRA.otro;
  return {
    nombre: NOMBRE_MUESTRA[tipo] ?? NOMBRE_MUESTRA.otro,
    fecha: "2026-12-12",
    hora: l.hora,
    lugarNombre: l.lugar,
    direccion: l.direccion,
    mapsUrl: "",
  };
}
