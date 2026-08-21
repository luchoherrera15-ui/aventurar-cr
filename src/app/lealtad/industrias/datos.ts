/**
 * LAS SEIS INDUSTRIAS DE /lealtad/industrias/[slug] — contenido
 * comercial redactado a mano (ago 2026, pedido del dueño: una página
 * por industria que explique por qué ESE negocio necesita el programa,
 * con su pase demo configurado). Los negocios son FICTICIOS y no hay
 * ni una estadística inventada: la persuasión va por la mecánica.
 * La gasolinera usa el ejemplo textual del dueño (tanque ≥ ₡15.000).
 */
export type IndustriaLealtad = {
  slug: string;
  nombre: string;
  titulo: string;
  subtitulo: string;
  negocioFicticio: string;
  colorFondo: string;
  colorSello: string;
  regalia: string;
  metaSellos: number;
  mecanica: string;
  dolores: string[];
  comoFunciona: string[];
  porQue: string[];
};

export const INDUSTRIAS: IndustriaLealtad[] = [
  {
    "slug": "lavacar",
    "nombre": "Lavacar",
    "titulo": "Que cada lavado le gane al de la esquina",
    "subtitulo": "Tarjeta de sellos digital en el Wallet del cliente: cada lavado suma, y el próximo se lo hace con usted, no con la competencia.",
    "negocioFicticio": "Lavacar El Torque",
    "colorFondo": "#0B2A4A",
    "colorSello": "#5BC8F5",
    "regalia": "Lavado completo gratis (carrocería, aspirado y llantas)",
    "metaSellos": 8,
    "mecanica": "Un sello por cada lavado pagado desde ₡5.000; al juntar 8, el siguiente lavado completo va por la casa.",
    "dolores": [
      "El cliente lava donde le queda de paso, no donde lo conocen.",
      "Las tarjetas de cartón se arruinan con agua y se pierden en la guantera.",
      "En semanas de lluvia bajan los lavados y nadie tiene motivo para volver."
    ],
    "comoFunciona": [
      "El cliente paga su lavado y muestra el pase de su Wallet en la caja.",
      "Quien cobra escanea el código con el celular del negocio; el sello entra al instante.",
      "Al llegar a 8 sellos, el pase avisa solo y el cliente canjea su lavado gratis."
    ],
    "porQue": [
      "Un lavacar vive de la repetición: el mismo carro se ensucia cada semana y la decisión de dónde lavarlo se toma en segundos, casi siempre por cercanía o costumbre. Con otro lavacar a pocos metros y precios parecidos, el que no da una razón concreta para volver está regalando clientes. Un programa de sellos convierte cada lavado en un avance visible hacia un premio, y eso cambia la pregunta del cliente: ya no es «¿cuál me queda más cerca?», sino «¿cuántos me faltan con ustedes?».",
      "El cartón sellado nunca funcionó bien en un negocio donde todo se moja: se arruga, se borra y termina olvidado en la guantera. El pase en el Wallet vive en el teléfono, no se pierde ni se daña, y muestra el conteo actualizado sin que el cliente haga nada. Cada vez que abre su billetera digital, ahí está su lavacar recordándole cuánto le falta para el lavado gratis. Sin app que instalar, sin registro engorroso: mostrar, escanear y listo."
    ]
  },
  {
    "slug": "casilleros",
    "nombre": "Casilleros",
    "titulo": "Que cada paquete asegure el siguiente envío",
    "subtitulo": "Tarjeta de sellos digital para tu casillero: el cliente que retira hoy tiene una razón concreta para traerte su próxima compra.",
    "negocioFicticio": "TicoBox Casilleros",
    "colorFondo": "#16283E",
    "colorSello": "#F5A94B",
    "regalia": "1 kilo de flete internacional gratis en su siguiente paquete",
    "metaSellos": 10,
    "mecanica": "Un sello por cada paquete retirado con flete pagado de ₡5.000 o más.",
    "dolores": [
      "El cliente compara tarifa por kilo y se va al courier más barato.",
      "Traen un paquete, prueban el servicio y nunca vuelven a consolidar con vos.",
      "Las promos de envío gratis de couriers grandes te roban a los frecuentes."
    ],
    "comoFunciona": [
      "El cliente paga su flete en mostrador y muestra el pase de Wallet en su teléfono.",
      "Quien entrega el paquete escanea el código y el sello cae al instante en la tarjeta.",
      "Al llegar a 10 sellos, el pase avisa solo y canjea su kilo de flete gratis."
    ],
    "porQue": [
      "En casilleros el cliente no te compra una vez: te compra cada vez que pide algo por internet. El problema es que la dirección de Miami de la competencia funciona igual que la tuya, y cambiar de courier cuesta cinco minutos. Sin un programa de lealtad, cada retiro es una despedida posible: el día que otro publique una tarifa un poco más baja, ese cliente se lleva todos sus envíos futuros. Una tarjeta de sellos convierte cada paquete en un avance hacia un premio que solo vos le das, y hace que irse tenga un costo real.",
      "Para tu cliente, la tarjeta vive donde ya vive su vida de compras: el teléfono. No es un cartón que se pierde entre recibos; es un pase en Apple o Google Wallet que le muestra cuántos sellos lleva y cuánto le falta para su kilo gratis, sin instalar ninguna app. Cada vez que retira, ve el progreso en pantalla y siente que su próximo pedido conviene traerlo con vos. Y cuando completa la tarjeta, el mismo pase le avisa: la regalía lo trae de vuelta al mostrador sin que tengás que perseguirlo."
    ]
  },
  {
    "slug": "salas-de-belleza",
    "nombre": "Salas de belleza",
    "titulo": "Que cada cita deje la próxima agendada",
    "subtitulo": "Tarjeta de sellos digital en el Wallet de tus clientas: cada tinte, corte o manicure suma para una regalía que las hace volver a tu sala, no a la de enfrente.",
    "negocioFicticio": "Sala de Belleza Girasol",
    "colorFondo": "#3D1230",
    "colorSello": "#F2C4CE",
    "regalia": "Un blower con tratamiento hidratante gratis al completar la tarjeta",
    "metaSellos": 8,
    "mecanica": "Un sello por cada visita con servicio de ₡8.000 o más, un sello por día.",
    "dolores": [
      "Clientas fieles de años que un día se pasaron a la sala nueva del barrio",
      "El cartoncito de sellos siempre quedó en la otra cartera o se perdió",
      "Semanas de agenda floja porque nadie tiene una razón concreta para volver ya"
    ],
    "comoFunciona": [
      "La clienta agrega tu tarjeta a su Wallet desde un QR en el espejo o la recepción.",
      "Al cobrar, quien atiende escanea el pase desde el celular del negocio y suma el sello.",
      "Al llegar a 8 sellos, el pase avisa solo y ella canjea su blower gratis en la próxima cita."
    ],
    "porQue": [
      "Una sala de belleza vive de la clienta que vuelve: el tinte hay que retocarlo, el corte crece, las uñas se levantan. El servicio se repite cada pocas semanas, pero nada obliga a que se repita con vos. Cada vez que abre una sala nueva cerca o una colega se independiza, tus clientas tienen una excusa para probar otro lugar. Sin un programa de lealtad, esa decisión se toma por precio o por antojo; con uno, dejar tu sala significa abandonar sellos ya ganados y una regalía que estaba cerca.",
      "Para la clienta, el cartón de siempre es un estorbo: se arruga, se moja, se queda en la otra cartera justo el día de la cita. La tarjeta en el Wallet vive en el mismo celular con el que agenda y paga, no se pierde y no hay que instalar nada. Ve cuántos sellos lleva y cuánto le falta para su premio, y el pase le aparece en pantalla cuando anda cerca de tu sala. Ese recordatorio silencioso, con tu nombre y tus colores, trabaja por vos entre cita y cita."
    ]
  },
  {
    "slug": "barberias",
    "nombre": "Barberías",
    "titulo": "Que cada corte deje amarrado el siguiente",
    "subtitulo": "Tarjeta de sellos digital en el Wallet del cliente: cada corte suma, y a la meta se gana un servicio de la casa.",
    "negocioFicticio": "Barbería El Patrón, Heredia",
    "colorFondo": "#1C1C1E",
    "colorSello": "#D4A24C",
    "regalia": "Corte gratis con arreglo de barba incluido",
    "metaSellos": 10,
    "mecanica": "Un sello por visita con servicio pagado desde ₡5.000, sea corte, barba o combo.",
    "dolores": [
      "El cliente fiel se va cuando su barbero cambia de silla",
      "Cartones de sellos que se pierden en la lavadora",
      "Abren dos barberías nuevas en el barrio cada año"
    ],
    "comoFunciona": [
      "El cliente paga su corte y muestra el pase; el barbero escanea desde su propio celular.",
      "El sello cae al instante en el Apple o Google Wallet, sin app ni cartón.",
      "Al sello 10, el pase avisa solo: le toca corte y barba de la casa."
    ],
    "porQue": [
      "Un corte se repite cada tres o cuatro semanas: pocas industrias tienen una frecuencia tan predecible. Pero esa misma frecuencia hace que el cliente pruebe la barbería nueva que abrió más cerca de su casa, la que le queda de camino al trabajo o la que le ofreció el primer corte a mitad de precio. Sin un programa que premie la constancia, cada visita es una decisión abierta. Con una tarjeta de sellos, cambiar de barbería significa dejar botado un premio que ya casi era suyo.",
      "El cartón de sellos ya lo intentaste: se arruga, se olvida en el otro pantalón y nadie lo anda el día que importa. El pase en el Wallet vive donde el cliente vive: en su teléfono, junto a sus tarjetas y sus tiquetes. No instala nada, no crea contraseñas, y cada vez que abre el pase ve tu marca, tus colores y cuántos cortes le faltan. Cuando está a un sello de la meta, el teléfono se lo recuerda por vos — y esa visita cae en tu silla, no en la de la competencia."
    ]
  },
  {
    "slug": "gasolineras",
    "nombre": "Gasolineras",
    "titulo": "Que cada tanque lleno traiga el siguiente",
    "subtitulo": "Convertí a los que pasan de largo en clientes que llenan siempre en tu estación, aunque haya otra bomba en la misma ruta.",
    "negocioFicticio": "Estación de Servicio El Trapiche",
    "colorFondo": "#1B2A41",
    "colorSello": "#F5A623",
    "regalia": "Un shampoo para parabrisas y limpieza de vidrios de cortesía",
    "metaSellos": 10,
    "mecanica": "Por cada llenada de ₡15.000 en adelante ganás un sello; a los 10 sellos te llevás un shampoo para parabrisas de regalo.",
    "dolores": [
      "El precio del combustible es igual en todas: no tenés cómo diferenciarte.",
      "El cliente llena donde le queda de paso, no donde vos querés.",
      "Invertís en pista y minisúper, pero nadie tiene razón para volver."
    ],
    "comoFunciona": [
      "El cliente llena ₡15.000 o más y el pistero le muestra el código QR en la bomba.",
      "El cliente lo escanea con la cámara y el sello cae directo a su pase en el Wallet.",
      "Al sello 10, el pase avisa solo: pasa a caja y retira su shampoo para parabrisas."
    ],
    "porQue": [
      "En combustible el precio lo fija el margen regulado: no podés competir bajando la pampa. Lo único que decide dónde llena un conductor es la costumbre y la conveniencia de la ruta. Un carro tanquea cada una o dos semanas, así que cada cliente que se te va a la estación de enfrente representa decenas de llenadas al año que perdés sin darte cuenta. Un programa de sellos le da una razón concreta para desviarse dos cuadras y llenar con vos, y de paso arrastra ventas al minisúper y a los servicios de pista.",
      "Nadie guarda un cartoncito de gasolinera en la guantera: se mancha, se pierde, se olvida. El pase de Wallet vive en el mismo teléfono con el que el cliente paga en la bomba, muestra cuántos sellos lleva y cuánto le falta para su regalía, y aparece solo cuando se acerca a la estación. Cada sello nuevo es un recordatorio de que le conviene volver con vos. Para tu equipo es mostrar un QR, sin papeles, sin sellos de hule y sin discusiones en caja."
    ]
  },
  {
    "slug": "carnicerias",
    "nombre": "Carnicerías",
    "titulo": "Que su carne de confianza tenga premio",
    "subtitulo": "Tarjeta de sellos digital en el Wallet para que el cliente que le compra la carne del gallo pinto, la parrillada y la olla de carne vuelva siempre a su mostrador — no al súper.",
    "negocioFicticio": "Carnicería Don Chalo",
    "colorFondo": "#4A1418",
    "colorSello": "#F2C14E",
    "regalia": "1 kilo de carne molida especial o de bistec de res gratis",
    "metaSellos": 10,
    "mecanica": "1 sello por cada compra de ₡8.000 o más en el mostrador.",
    "dolores": [
      "El súper de la esquina le roba clientes con carne empacada más barata.",
      "El cliente compra parejo todo el mes y usted no tiene cómo premiarlo.",
      "Los cartones de sellos se pierden entre la fila y el papel encerado."
    ],
    "comoFunciona": [
      "El cliente paga sus cortes y muestra el pase de su Wallet en el mostrador.",
      "Quien cobra escanea el código con el celular del negocio; el sello entra al instante.",
      "Al sello 10, el pase avisa solo: le toca su kilo gratis en la próxima visita."
    ],
    "porQue": [
      "La carnicería vive de la compra semanal: la carne del casado, el pollo del arroz, la posta para la olla. Ese cliente compra carne sí o sí — la pregunta es dónde. Cada vez que el súper o la carnicería nueva del barrio le queda más a mano, usted pierde una compra que era suya. Sin un programa de lealtad, el cliente frecuente y el que llega una vez al año reciben exactamente el mismo trato, y la fidelidad que usted se ganó cortando bien y pesando honesto no se traduce en nada concreto que lo amarre a su mostrador.",
      "Un cartón de sellos en una carnicería dura poco: se mancha, se moja, se queda en el otro pantalón. La tarjeta en el Wallet vive en el celular que el cliente ya trae para pagar con SINPE; no hay nada que instalar ni que acordarse de traer. Cada sello queda registrado al momento, el cliente ve cuánto le falta para su kilo gratis, y el pase mismo le avisa cuando está cerca de la meta. Esa cuenta visible es la razón silenciosa por la que la próxima compra de carne vuelve a ser en su negocio."
    ]
  }
];

export function industriaPorSlug(slug: string): IndustriaLealtad | null {
  return INDUSTRIAS.find((i) => i.slug === slug) ?? null;
}
