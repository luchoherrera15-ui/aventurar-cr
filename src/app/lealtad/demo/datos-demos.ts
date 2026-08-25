/**
 * LOS DATOS DEL CATÁLOGO DE DEMOS — un objeto por rubro, compartido por
 * dos pantallas:
 *   - `/lealtad/demo` (el índice en cards, `page.tsx` de esta carpeta)
 *   - `/lealtad/demo/[tipo]` (la hoja de venta de un rubro puntual)
 *
 * Vive en su propio archivo (y no adentro de `[tipo]/page.tsx`, que es
 * donde nació) para que el índice no tenga que importar de un archivo
 * de ruta ajeno — los dos consumen la misma fuente en vez de que uno
 * duplique al otro.
 *
 * Cada rubro trae DOS `variantes` (pedido del dueño: "que cada demo
 * tenga varios tipos de cards") — los dos modos que de verdad soporta
 * el motor (0121) que tendrían más sentido para ESE negocio puntual,
 * para que el dueño compare en vez de ver un solo modo ya elegido por
 * mí. Los tres modos que existen son sellos, cashback (% de vuelta) y
 * puntos; ningún rubro repite el mismo par de modos que otro a
 * propósito, para que el catálogo entero muestre variedad real.
 */

export type Variante = {
  modo: "sellos" | "cashback" | "puntos";
  etiquetaCampo: string;
  valor: string;
  /** Solo en modo sellos. */
  total?: number;
  logrados?: number;
  /** Solo en cashback/puntos: la línea grande de la tarjeta. */
  detalle?: string;
  regla: string;
  regalia: string;
};

/** Mismo texto de pestaña en el índice y en la hoja de cada rubro. */
export const ETIQUETA_MODO: Record<Variante["modo"], string> = {
  sellos: "Sellos",
  cashback: "Cashback",
  puntos: "Puntos",
};

export type Demo = {
  categoria: string;
  negocio: string;
  pasos: [string, string, string];
  /**
   * La banda del negocio en el pase (el `strip` de Apple).
   * Que un barbero vea una barbería y no un degradado hace la
   * diferencia entre «qué lindo» y «así se me vería a mí».
   * Opcional: para un rubro sin franja propia todavía en el banco de
   * fotos, `PaseWallet` ya sabe quedarse sin foto en vez de forzar una
   * que no corresponda.
   */
  foto?: string;
  /**
   * Los trazos (`d` de cada `<path>`, viewBox 24×24) del ícono que
   * llevaría CADA sello ganado — mismo banco que ya usa el creador de
   * verdad (`ICONOS_SELLO` de `lib/lealtad/iconos-sello.ts`, más los
   * pocos rubros nuevos de `plantillas-icono.ts`), no un dibujo
   * inventado para esta pantalla. Un café con una tijera adentro del
   * sello no dice nada; un café con una taza sí. Solo se usa en modo
   * sellos — cashback y puntos no tienen círculos que llenar.
   */
  iconoSello: readonly string[];
  /**
   * Un negocio REAL de esa categoría, ya publicado en Bookea, para
   * quien no se conforma con la maqueta. Solo lo declaran las
   * categorías que tienen uno de verdad: el resto no muestra el
   * enlace en vez de mandar a una página de mentira.
   */
  ejemplo?: { href: string; texto: string };
  /** Los modos que este rubro puede mostrar — SIEMPRE 2, nunca 1. */
  variantes: [Variante, Variante];
};

// ── Los íconos, tal cual los dibuja `iconos-sello.ts` / `plantillas-icono.ts` ──
const ICONO_CAFE = [
  "M5 8.6h11v5.2a5.2 5.2 0 0 1-5.2 5.2h-.6A5.2 5.2 0 0 1 5 13.8z",
  "M16 10.2h1.5a2.4 2.4 0 0 1 0 4.8H16",
  "M3.5 21.4h14",
  "M8.6 5.6c0-1 1-1.4 1-2.6",
  "M12.2 5.6c0-1 1-1.4 1-2.6",
];
const ICONO_TIJERA = [
  "M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  "M20 4 8.12 15.88",
  "M14.47 14.48 20 20",
  "M8.12 8.12 12 12",
];
const ICONO_UNAS = [
  "M11 2.6h2a2 2 0 0 1 2 2v2.2H9V4.6a2 2 0 0 1 2-2z",
  "M10.6 6.8h2.8v2.6h-2.8z",
  "M9.4 9.4h5.2a2.6 2.6 0 0 1 2.6 2.6v6.8a2.6 2.6 0 0 1-2.6 2.6H9.4a2.6 2.6 0 0 1-2.6-2.6V12a2.6 2.6 0 0 1 2.6-2.6z",
];
const ICONO_COMIDA = [
  "M12 2.6 20 20.4a1 1 0 0 1-1.3 1.4 20 20 0 0 0-13.4 0A1 1 0 0 1 4 20.4z",
  "M7.4 16.4q4.6 1.5 9.2 0",
  "M10.4 8.85a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Z",
  "M13.5 12.65a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Z",
];
const ICONO_PESA = ["M4.2 9.6v4.8", "M6.8 7.6v8.8", "M17.2 7.6v8.8", "M19.8 9.6v4.8", "M6.8 12h10.4"];
const ICONO_FLOR = [
  "M12 4.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z",
  "M16.1 6.8a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z",
  "M14.5 11.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z",
  "M9.5 11.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z",
  "M7.9 6.8a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z",
  "M12 8a1.7 1.7 0 1 0 0 3.4A1.7 1.7 0 0 0 12 8Z",
  "M12 16.6V21.4",
];
const ICONO_AUTO = [
  "M2.8 15.8v-2.8a1.6 1.6 0 0 1 .2-.8l2-3.8a2 2 0 0 1 1.8-1.1h10.4a2 2 0 0 1 1.8 1.1l2 3.8a1.6 1.6 0 0 1 .2.8v2.8z",
  "M4.6 12.2h14.8",
  "M7.6 14.7a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z",
  "M16.4 14.7a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8Z",
];
const ICONO_TIENDA = [
  "M4 4h16l1.5 4.5a3 3 0 0 1-2.9 3 3 3 0 0 1-3-2.5 3.1 3.1 0 0 1-3.1 2.5 3.1 3.1 0 0 1-3-2.5 3 3 0 0 1-3 2.5 3 3 0 0 1-3-3L4 4Z",
  "M5 12.5V20h14v-7.5M10 20v-4.5h4V20",
];
const ICONO_PANADERIA = [
  "M4.2 12.4c0-3.3 3.5-5.6 7.8-5.6s7.8 2.3 7.8 5.6c0 .9-.7 1.6-1.6 1.6h-.6v2.6a2.6 2.6 0 0 1-2.6 2.6H9a2.6 2.6 0 0 1-2.6-2.6V14h-.6a1.6 1.6 0 0 1-1.6-1.6Z",
  "M9.4 10.2 8.2 12.1M12.4 10.2l-1.2 1.9M15.4 10.2l-1.2 1.9",
];
const ICONO_PAQUETE = ["M12 3 19.5 7 19.5 15 12 19 4.5 15 4.5 7Z", "M12 11V19", "M12 11 4.5 7", "M12 11 19.5 7"];
// Cámara: nuevo, no vive en el banco del creador (fotografía todavía no
// tiene ícono propio ahí) — mismo estilo (viewBox 24, trazo redondeado)
// que el resto: cuerpo con visor arriba y el lente como círculo grande.
const ICONO_CAMARA = [
  "M3.5 8h3l1.3-1.8h8.4L17.5 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z",
  "M12 10a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z",
  "M16.8 10.2h1.4",
];

export const DEMOS: Record<string, Demo> = {
  restaurantes: {
    categoria: "Restaurantes",
    foto: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=640&q=70",
    negocio: "Restaurante Doña Flor",
    iconoSello: ICONO_COMIDA,
    pasos: [
      "El comensal escanea el QR de la mesa una sola vez.",
      "Al pagar, la tarjeta suma sola — cashback o sello, según el modo.",
      "Vuelve a usarlo con vos: solo vale en tu restaurante.",
    ],
    variantes: [
      {
        // El caso de % de vuelto: la cuenta varía mucho de mesa a mesa,
        // así que premiar por MONTO es más justo que por visita.
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡4.250",
        detalle: "5% de cada cuenta vuelve a tu tarjeta",
        regla: "5% de vuelta sobre lo que gastan (vos elegís el porcentaje)",
        regalia: "El saldo se usa como plata en su próxima visita",
      },
      {
        modo: "sellos",
        etiquetaCampo: "Visitas",
        valor: "6/9",
        total: 9,
        logrados: 6,
        regla: "1 sello por visita, sin importar cuánto gasten",
        regalia: "El postre de la casa gratis en la 9.ª visita",
      },
    ],
  },
  cafeterias: {
    categoria: "Cafeterías",
    foto: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=70",
    negocio: "Café La Esquina",
    iconoSello: ICONO_CAFE,
    pasos: [
      "El cliente agrega la tarjeta a su Wallet con el QR de la barra.",
      "Cada café suma solo — sello o cashback, según el modo.",
      "La regalía lo trae de vuelta mañana — su tarjeta se lo recuerda.",
    ],
    ejemplo: {
      href: "/restaurantes/cafeoscuro",
      texto: "Ver una cafetería de verdad",
    },
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Sellos",
        valor: "8/10",
        total: 10,
        logrados: 8,
        regla: "1 sello por cada bebida",
        regalia: "La bebida N.º 11 va por la casa",
      },
      {
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡1.850",
        detalle: "4% de cada compra vuelve a tu tarjeta",
        regla: "4% de vuelta sobre lo que gastan",
        regalia: "El saldo se usa como plata en su próximo café",
      },
    ],
  },
  barberias: {
    categoria: "Barberías",
    foto: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=640&q=70",
    negocio: "Barbería El Patio",
    iconoSello: ICONO_TIJERA,
    pasos: [
      "El cliente agrega su tarjeta al Wallet en la primera visita.",
      "Cada corte suma solo — vos seguís con la máquina en la mano.",
      "La regalía hace que no pruebe la barbería de la esquina.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Cortes",
        valor: "4/6",
        total: 6,
        logrados: 4,
        regla: "1 sello por corte",
        regalia: "El sexto corte va gratis",
      },
      {
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡3.200",
        detalle: "6% de cada corte vuelve a tu tarjeta",
        regla: "6% de vuelta sobre cada corte",
        regalia: "El saldo se descuenta en su próxima visita",
      },
    ],
  },
  salones: {
    categoria: "Salones de belleza",
    foto: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=640&q=70",
    negocio: "Salón Karla",
    iconoSello: ICONO_UNAS,
    pasos: [
      "La clienta escanea el QR del mostrador mientras espera.",
      "Uñas, tinte o peinado: cada servicio suma solo.",
      "La regalía la trae de vuelta el próximo mes, con cita y todo.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Visitas",
        valor: "6/8",
        total: 8,
        logrados: 6,
        regla: "1 sello por servicio",
        regalia: "Manicure gratis al completar 8",
      },
      {
        modo: "puntos",
        etiquetaCampo: "Puntos",
        valor: "2.600",
        detalle: "1 punto por cada ₡100 · tratamiento a los 5.000",
        regla: "1 punto por cada ₡100 en servicios",
        regalia: "Tratamiento facial gratis al llegar a 5.000 puntos",
      },
    ],
  },
  spas: {
    categoria: "Spas",
    foto: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=640&q=70",
    negocio: "Spa Serena",
    iconoSello: ICONO_FLOR,
    pasos: [
      "Cada visita suma sola — puntos por monto o sello por sesión.",
      "El cliente ve su progreso en el teléfono entre visita y visita.",
      "La regalía convierte la visita ocasional en ritual.",
    ],
    variantes: [
      {
        modo: "puntos",
        etiquetaCampo: "Puntos",
        valor: "3.400",
        detalle: "1 punto por cada ₡100 · masaje a los 5.000",
        regla: "1 punto por cada ₡100 en tratamientos",
        regalia: "Masaje de 30 min al llegar a 5.000 puntos",
      },
      {
        modo: "sellos",
        etiquetaCampo: "Sesiones",
        valor: "3/5",
        total: 5,
        logrados: 3,
        regla: "1 sello por cada sesión",
        regalia: "50% off en la quinta sesión",
      },
    ],
  },
  gimnasios: {
    categoria: "Gimnasios",
    foto: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=640&q=70",
    negocio: "Gimnasio Fuerza",
    iconoSello: ICONO_PESA,
    pasos: [
      "El socio escanea al entrar: su asistencia queda en la tarjeta.",
      "Ver el progreso en el teléfono empuja a no cortar la racha.",
      "La regalía premia la constancia — y renueva la matrícula.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Check-ins",
        valor: "9/12",
        total: 12,
        logrados: 9,
        regla: "1 sello por visita al gym",
        regalia: "Una semana gratis al completar 12",
      },
      {
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡2.400",
        detalle: "3% de vuelta en clases sueltas y tienda",
        regla: "3% de vuelta en compras dentro del gimnasio",
        regalia: "El saldo se usa en tu próxima clase o compra",
      },
    ],
  },
  lavacars: {
    categoria: "Lavacars",
    foto: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=640&q=70",
    negocio: "Lavacar El Rayo",
    iconoSello: ICONO_AUTO,
    pasos: [
      "El cliente escanea el QR de la caseta mientras espera su carro.",
      "Cada lavado suma solo — sin tarjetitas mojadas en la guantera.",
      "La regalía decide a dónde vuelve el próximo sábado.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Lavados",
        valor: "4/6",
        total: 6,
        logrados: 4,
        regla: "1 sello por lavado completo",
        regalia: "El sexto lavado va gratis",
      },
      {
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡2.750",
        detalle: "5% de cada lavado vuelve a tu tarjeta",
        regla: "5% de vuelta sobre cada lavado",
        regalia: "El saldo se descuenta en tu próximo lavado",
      },
    ],
  },
  courier: {
    categoria: "Courier",
    // Autohosteada (banco de franjas de hoy), no un hotlink nuevo — ya
    // verificada a mano sin ninguna marca de otro courier visible.
    foto: "/lealtad/plantillas/franjas/courier-2.jpg",
    negocio: "Envíos Rápido CR",
    iconoSello: ICONO_PAQUETE,
    pasos: [
      "El cliente escanea el QR al dejar el paquete en el mostrador.",
      "Cada envío suma solo — sin cartilla de papel que se pierda.",
      "La regalía lo hace elegirte a vos antes que a otro courier.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Envíos",
        valor: "5/8",
        total: 8,
        logrados: 5,
        regla: "1 sello por cada envío",
        regalia: "El octavo envío va gratis",
      },
      {
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡1.400",
        detalle: "3% de vuelta sobre el costo de cada envío",
        regla: "3% de vuelta sobre el costo de cada envío",
        regalia: "El saldo se descuenta en tu próximo envío",
      },
    ],
  },
  tiendas: {
    categoria: "Tiendas de ropa",
    foto: "/lealtad/plantillas/franjas/tienda-2.jpg",
    negocio: "Boutique Aurora",
    iconoSello: ICONO_TIENDA,
    pasos: [
      "La clienta escanea el QR de la caja al pagar la primera vez.",
      "Cada compra suma sola — cashback o sello, según el modo.",
      "La regalía la trae de vuelta antes de comprar en otro lado.",
    ],
    variantes: [
      {
        // Igual que el restaurante: el ticket varía mucho de compra a
        // compra, así que premiar por MONTO es más justo que por visita.
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡6.800",
        detalle: "8% de cada compra vuelve a tu tarjeta",
        regla: "8% de vuelta sobre lo que compran (vos elegís el %)",
        regalia: "El saldo se descuenta como plata en su próxima compra",
      },
      {
        modo: "sellos",
        etiquetaCampo: "Compras",
        valor: "5/8",
        total: 8,
        logrados: 5,
        regla: "1 sello por cada compra",
        regalia: "20% off en la octava compra",
      },
    ],
  },
  panaderias: {
    categoria: "Panaderías",
    foto: "/lealtad/plantillas/franjas/panaderia-2.jpg",
    negocio: "Panadería Trigo Dorado",
    iconoSello: ICONO_PANADERIA,
    pasos: [
      "El cliente agrega la tarjeta al Wallet en el mostrador.",
      "Pan, repostería o café: cada compra suma sola.",
      "La regalía lo hace pasar por acá antes que por el súper.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Compras",
        valor: "5/8",
        total: 8,
        logrados: 5,
        regla: "1 sello por cada compra",
        regalia: "La compra N.º 9 va por la casa",
      },
      {
        modo: "puntos",
        etiquetaCampo: "Puntos",
        valor: "1.400",
        detalle: "1 punto por cada ₡100 · combo a los 2.000",
        regla: "1 punto por cada ₡100 en compras",
        regalia: "Combo de pan y café gratis al llegar a 2.000 puntos",
      },
    ],
  },
  unas: {
    categoria: "Nail spas",
    foto: "/lealtad/plantillas/franjas/unas-2.jpg",
    negocio: "Nail Studio Bella",
    iconoSello: ICONO_UNAS,
    pasos: [
      "La clienta agrega su tarjeta al Wallet en la primera cita.",
      "Cada set — gel, acrílico o clásico — suma solo.",
      "La regalía la trae de vuelta antes de probar otro salón.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Sets",
        valor: "3/6",
        total: 6,
        logrados: 3,
        regla: "1 sello por cada set de uñas",
        regalia: "El sexto set va gratis",
      },
      {
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡2.900",
        detalle: "6% de vuelta en cada set",
        regla: "6% de vuelta sobre cada set",
        regalia: "El saldo se usa en tu próxima cita",
      },
    ],
  },
  fotografos: {
    categoria: "Fotografía y video",
    // Sin franja propia todavía en el banco de fotos: el pase queda
    // sin foto en vez de forzar una que no sea de este rubro (ver el
    // comentario de PaseWallet — es un estado que ya soporta).
    negocio: "Lente & Luz Estudio",
    iconoSello: ICONO_CAMARA,
    pasos: [
      "El cliente agrega la tarjeta al reservar su primera sesión.",
      "Bodas, retratos o eventos corporativos: cada sesión suma sola.",
      "La regalía lo hace volver a llamarte a vos primero.",
    ],
    variantes: [
      {
        modo: "sellos",
        etiquetaCampo: "Sesiones",
        valor: "3/5",
        total: 5,
        logrados: 3,
        regla: "1 sello por cada sesión contratada",
        regalia: "Edición express y entrega en 48h gratis en la quinta sesión",
      },
      {
        modo: "cashback",
        etiquetaCampo: "Tu saldo",
        valor: "₡18.500",
        detalle: "4% de vuelta sobre el valor de cada sesión",
        regla: "4% de vuelta sobre el valor de cada sesión contratada",
        regalia: "El saldo se descuenta en tu próxima sesión",
      },
    ],
  },
};
