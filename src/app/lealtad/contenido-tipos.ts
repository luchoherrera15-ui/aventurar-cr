import type { TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { PALETAS, type TernaColor } from "@/lib/lealtad/paletas";
import type { NombreIcono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * QUÉ SE PUEDE HACER CON CADA TIPO DE PASE, en detalle.
 *
 * Vive en su propio archivo porque es CONTENIDO, no interfaz: son
 * ~200 líneas de texto que no tienen por qué estar mezcladas con la
 * lógica del componente que las pinta. Cambiar una frase no debería
 * obligar a leer un archivo de estado, hover y accesibilidad.
 *
 * ------------------------------------------------------------------
 * TODO SALE DE LO QUE EL PRODUCTO HACE
 * ------------------------------------------------------------------
 * Cada capacidad de acá corresponde a un campo real de
 * `src/lib/lealtad/tipos-tarjeta.ts` (la config de cada tipo) o a una
 * columna de la 0136 (vigencia, días, horarios, topes).
 *
 * No hay ninguna inventada, y esa es la regla: una landing que promete
 * algo que el panel no tiene se paga con un reembolso y un cliente que
 * cuenta la historia.
 */

export type Capacidad = { icono: NombreIcono; titulo: string; texto: string };

export type FichaTipo = {
  /** Una línea que resume el tipo. */
  gancho: string;
  /** Para quién es, en concreto. */
  paraQuien: string;
  puede: Capacidad[];
  /** El negocio de ejemplo del pase. */
  negocio: string;
  /**
   * La paleta del tipo. NO se escribe acá: sale de
   * `src/lib/lealtad/paletas.ts`, que es la misma lista que el creador
   * ofrece como plantillas de un toque. Con los hexadecimales copiados
   * en los dos lados, el dueño elegía «ese café» en la landing y le
   * salía otro al armar la tarjeta.
   */
  colores: TernaColor;
  foto: string;
  arriba: string;
  valor: string;
  abajo: string;
  /** El reverso del pase: las reglas de este tipo, tal como Wallet las muestra. */
  detalle: { etiqueta: string; valor: string }[];
  /** Las últimas dos líneas del historial. */
  movimientos: { texto: string; cuando: string }[];
};

/** Las que valen para los ocho: se repiten al final de cada lista. */
const COMUNES: Capacidad[] = [
  {
    icono: "reloj",
    titulo: "Vigencia con fecha",
    texto: "Desde cuándo y hasta cuándo vale. Al vencer deja de emitirse y de canjearse.",
  },
  {
    icono: "candado",
    titulo: "Validado en el servidor",
    texto: "Una captura de pantalla no sirve: cada canje se autoriza contra la base, no contra el pase.",
  },
];

export const FICHAS: Record<TipoTarjeta, FichaTipo> = {
  sellos: {
    gancho: "El cartón de toda la vida, pero que no se pierde ni se olvida en casa.",
    paraQuien: "Cafeterías, barberías, lavacars — todo lo que se repite seguido.",
    puede: [
      {
        icono: "escanear",
        titulo: "Se sella escaneando",
        texto: "Abrís el escáner del panel, leés su código y el sello entra. Sin apuntar nada a mano.",
      },
      {
        icono: "sellos",
        titulo: "Vos ponés la meta",
        texto: "De 1 a 15 sellos, y qué se gana al completarlos. La tarjeta muestra «7 de 10».",
      },
      {
        icono: "regalo",
        titulo: "Sellos de regalo al afiliarse",
        texto: "Arrancar con uno o dos hace que se sienta empezada — y las empezadas se terminan.",
      },
      {
        icono: "repetir",
        titulo: "Se repite sola",
        texto: "Al completarla arranca otra vuelta, sin que nadie tenga que emitir nada.",
      },
      ...COMUNES,
    ],
    negocio: "Café La Esquina",
    colores: PALETAS.sellos.colores,
    foto: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=520&q=70",
    arriba: "SELLOS",
    valor: "7/10",
    abajo: "Te faltan 3 para tu café",
    detalle: [
      { etiqueta: "Premio", valor: "Café gratis" },
      { etiqueta: "Te faltan", valor: "3 sellos" },
      { etiqueta: "Se reinicia", valor: "Al completarla" },
      { etiqueta: "Vence", valor: "31 dic 2026" },
    ],
    movimientos: [
      { texto: "Sello agregado", cuando: "hoy 3:12 pm" },
      { texto: "Sello agregado", cuando: "12 ago" },
    ],
  },

  puntos: {
    gancho: "Suma por lo que gasta y canjea por lo que quiera.",
    paraQuien: "Súpers, tiendas y todo donde el ticket cambia mucho de una visita a otra.",
    puede: [
      {
        icono: "moneda",
        titulo: "Por visita, por monto, o los dos",
        texto: "1 punto por venir y 0,05 por colón gastado se combinan como quieras.",
      },
      {
        icono: "estrella",
        titulo: "Con el nombre que quieras",
        texto: "«Puntos», «estrellas», «granos» — como los llame tu negocio.",
      },
      {
        icono: "regalo",
        titulo: "Mínimo para canjear",
        texto: "Definís desde cuántos se puede canjear, así nadie se lleva el premio en la primera visita.",
      },
      {
        icono: "tope",
        titulo: "Tope acumulable",
        texto: "Un techo opcional para que el saldo no crezca sin control.",
      },
      ...COMUNES,
    ],
    negocio: "Súper La Cosecha",
    colores: PALETAS.puntos.colores,
    foto: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=520&q=70",
    arriba: "PUNTOS",
    valor: "340",
    abajo: "Canjeá desde 200",
    detalle: [
      { etiqueta: "Ganás", valor: "1 pt por visita" },
      { etiqueta: "Y además", valor: "0,05 pt por colón" },
      { etiqueta: "Canje mínimo", valor: "200 pts" },
      { etiqueta: "Tope", valor: "5 000 pts" },
    ],
    movimientos: [
      { texto: "+18 pts por ₡36 000", cuando: "hoy 11:04 am" },
      { texto: "−200 pts canjeados", cuando: "2 ago" },
    ],
  },

  cupon: {
    gancho: "Un beneficio puntual que llega al teléfono y se usa una vez.",
    paraQuien: "Para reactivar al que hace rato no viene, o premiar una fecha.",
    puede: [
      {
        icono: "porcentaje",
        titulo: "Porcentaje, monto o producto",
        texto: "«20% off», «₡3.000 menos» o «un postre gratis». Las tres formas.",
      },
      {
        icono: "moneda",
        titulo: "Compra mínima",
        texto: "Aplica desde el monto que definas, para que no se use en una compra de ₡500.",
      },
      {
        icono: "tope",
        titulo: "Usos por cliente",
        texto: "Uno solo, o los que decidas. El servidor lleva la cuenta y rechaza el siguiente.",
      },
      {
        icono: "campana",
        titulo: "Aviso antes de vencer",
        texto: "El cupón que nadie recuerda no se canjea. La notificación llega al pase.",
      },
      ...COMUNES,
    ],
    negocio: "Pizzería Nápoli",
    colores: PALETAS.cupon.colores,
    foto: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=520&q=70",
    arriba: "CUPÓN",
    valor: "2x1",
    abajo: "Válido hasta el 30 de setiembre",
    detalle: [
      { etiqueta: "Beneficio", valor: "2x1 en pizza" },
      { etiqueta: "Compra mínima", valor: "₡6 000" },
      { etiqueta: "Usos", valor: "1 por cliente" },
      { etiqueta: "Vence", valor: "30 set 2026" },
    ],
    movimientos: [
      { texto: "Cupón recibido", cuando: "hoy 9:00 am" },
      { texto: "Aviso de vencimiento", cuando: "programado 27 set" },
    ],
  },

  descuento: {
    gancho: "«30% de lunes a jueves», con sus días y sus horas de verdad.",
    paraQuien: "Para llenar las horas flojas sin regalar las que ya se llenan solas.",
    puede: [
      {
        icono: "actividad",
        titulo: "Solo ciertos días",
        texto: "De lunes a jueves, o los martes nada más. Elegís cuáles y el resto no aplica.",
      },
      {
        icono: "reloj",
        titulo: "Y solo ciertas horas",
        texto: "De 2 a 5 de la tarde, en hora de Costa Rica. Incluso ventanas que cruzan la medianoche.",
      },
      {
        icono: "tope",
        titulo: "Tope de descuento",
        texto: "Un 30% con techo de ₡5.000, para que una cuenta grande no se lleve el margen.",
      },
      {
        icono: "personas",
        titulo: "Límite global",
        texto: "«Los primeros 100» — al llegar al tope se apaga solo, sin que nadie esté mirando.",
      },
      ...COMUNES,
    ],
    negocio: "Silence Barber Shop",
    colores: PALETAS.descuento.colores,
    foto: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=520&q=70",
    arriba: "DESCUENTO",
    valor: "30% OFF",
    abajo: "Lunes a jueves, de 9 a 5",
    detalle: [
      { etiqueta: "Días", valor: "Lun a jue" },
      { etiqueta: "Horario", valor: "9:00 a 17:00" },
      { etiqueta: "Tope", valor: "₡5 000" },
      { etiqueta: "Cupos", valor: "100 · quedan 38" },
    ],
    movimientos: [
      { texto: "Descuento aplicado −₡4 200", cuando: "mar 3:40 pm" },
      { texto: "Rechazado: fuera de horario", cuando: "lun 7:10 pm" },
    ],
  },

  membresia: {
    gancho: "El carnet de socio que nunca se queda en la otra cartera.",
    paraQuien: "Gimnasios, clubes y todo lo que se cobra por mes.",
    puede: [
      {
        icono: "estrella",
        titulo: "Niveles con nombre",
        texto: "Gold, Platinum, Socio Fundador — el que uses vos, no una lista fija.",
      },
      {
        icono: "listo",
        titulo: "Sus beneficios a la vista",
        texto: "Lo que incluye la membresía se lee en el pase, no en un correo de hace seis meses.",
      },
      {
        icono: "reloj",
        titulo: "Vigencia en meses",
        texto: "Con la fecha de renovación visible: el socio sabe cuándo vence sin preguntar.",
      },
      {
        icono: "repetir",
        titulo: "Renovación automática",
        texto: "Al vencer se extiende otro período, si vos lo dejás activado.",
      },
      ...COMUNES,
    ],
    negocio: "Gimnasio Titán",
    colores: PALETAS.membresia.colores,
    foto: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=520&q=70",
    arriba: "MEMBRESÍA",
    valor: "Gold",
    abajo: "Renueva el 1 de marzo",
    detalle: [
      { etiqueta: "Nivel", valor: "Gold" },
      { etiqueta: "Incluye", valor: "Clases + parqueo" },
      { etiqueta: "Renueva", valor: "1 mar 2027" },
      { etiqueta: "Renovación", valor: "Automática" },
    ],
    movimientos: [
      { texto: "Ingreso registrado", cuando: "hoy 6:02 am" },
      { texto: "Renovación cobrada", cuando: "1 feb" },
    ],
  },

  giftcard: {
    gancho: "Plata que entra hoy por un consumo que llega después.",
    paraQuien: "Spas, restaurantes y todo lo que se regala en diciembre.",
    puede: [
      {
        icono: "moneda",
        titulo: "En colones o en dólares",
        texto: "El valor lo ponés vos y el pase muestra el saldo que queda.",
      },
      {
        icono: "sumar",
        titulo: "Se gasta de a poco",
        texto: "No se consume entera de una: el saldo baja con cada uso, como una tarjeta de verdad.",
      },
      {
        icono: "afiliar",
        titulo: "Se puede regalar",
        texto: "Quien la compra se la pasa a otra persona, y le llega al Wallet lista para usarse.",
      },
      {
        icono: "plan",
        titulo: "Caja por adelantado",
        texto: "El dinero entra cuando se vende, no cuando se consume.",
      },
      ...COMUNES,
    ],
    negocio: "Spa Serenity",
    colores: PALETAS.giftcard.colores,
    foto: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=520&q=70",
    arriba: "SALDO",
    valor: "₡15 000",
    abajo: "Gift card de regalo",
    detalle: [
      { etiqueta: "Valor original", valor: "₡25 000" },
      { etiqueta: "Consumido", valor: "₡10 000" },
      { etiqueta: "Saldo", valor: "₡15 000" },
      { etiqueta: "Transferible", valor: "Sí" },
    ],
    movimientos: [
      { texto: "−₡10 000 consumidos", cuando: "9 ago" },
      { texto: "Gift card activada", cuando: "24 dic" },
    ],
  },

  evento: {
    gancho: "La entrada con fecha, lugar y control en la puerta.",
    paraQuien: "Ranchos, salones y cualquiera que venda entradas.",
    puede: [
      {
        icono: "evento",
        titulo: "Fecha y hora",
        texto: "El pase aparece solo en la pantalla del teléfono el día del evento.",
      },
      {
        icono: "ubicacion",
        titulo: "Dónde es",
        texto: "Con la ubicación adentro, para que nadie escriba preguntando la dirección.",
      },
      {
        icono: "personas",
        titulo: "Cupo por aforo",
        texto: "Definís cuántas entradas hay y el sistema deja de emitir al llegar. Sin sobreventa.",
      },
      {
        icono: "escanear",
        titulo: "Se valida escaneando",
        texto: "En la puerta se lee el código, no se busca un nombre en una lista impresa.",
      },
      ...COMUNES,
    ],
    negocio: "Rancho Las Torres",
    colores: PALETAS.evento.colores,
    foto: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=520&q=70",
    arriba: "ENTRADA",
    valor: "20 set · 7 pm",
    abajo: "Alajuela · entrada general",
    detalle: [
      { etiqueta: "Lugar", valor: "Rancho Las Torres" },
      { etiqueta: "Puerta", valor: "6:30 pm" },
      { etiqueta: "Entrada", valor: "General" },
      { etiqueta: "Aforo", valor: "180 · quedan 24" },
    ],
    movimientos: [
      { texto: "Entrada emitida", cuando: "5 set" },
      { texto: "Recordatorio enviado", cuando: "programado 19 set" },
    ],
  },

  cashback: {
    gancho: "Devolvés un porcentaje y vuelve a gastarse con vos.",
    paraQuien: "Donde el descuento directo duele: la plata se queda en tu negocio.",
    puede: [
      {
        icono: "porcentaje",
        titulo: "El porcentaje lo ponés vos",
        texto: "Un 5% de cada compra vuelve como saldo al pase del cliente.",
      },
      {
        icono: "moneda",
        titulo: "Compra mínima",
        texto: "Devolvés solo desde el monto que valga la pena para tu margen.",
      },
      {
        icono: "tope",
        titulo: "Tope por compra",
        texto: "Un techo por transacción, para que una cuenta grande no se lleve el mes.",
      },
      {
        icono: "plan",
        titulo: "La plata no se va",
        texto: "A diferencia del descuento, el saldo solo se gasta con vos. Es una visita más, no menos margen.",
      },
      ...COMUNES,
    ],
    negocio: "Lavacar El Rayo",
    colores: PALETAS.cashback.colores,
    foto: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=520&q=70",
    arriba: "SALDO",
    valor: "₡3 400",
    abajo: "5% de vuelta en cada lavado",
    detalle: [
      { etiqueta: "Devolución", valor: "5% de cada compra" },
      { etiqueta: "Compra mínima", valor: "₡5 000" },
      { etiqueta: "Tope por compra", valor: "₡2 000" },
      { etiqueta: "Saldo", valor: "₡3 400" },
    ],
    movimientos: [
      { texto: "+₡1 400 devueltos", cuando: "hoy 4:20 pm" },
      { texto: "+₡2 000 devueltos", cuando: "28 jul" },
    ],
  },
};
