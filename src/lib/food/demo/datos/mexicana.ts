import type { RestauranteDemo } from "../tipos";

export const MEXICANA: RestauranteDemo[] = [
  {
    slug: "comal-nueve",
    nombre: "Comal Nueve",
    descripcion:
      "Tacos de trompo y tortillas palmeadas al momento en pleno corazón de San Pedro. Vení por el pastor y quedate por las aguas frescas de la casa.",
    categoria: "Mexicana",
    cocina: "Taquería urbana",
    zona: "San Pedro",
    direccion: "Plaza Girasol, local 14",
    telefono: "+506 2555-0114",
    precioNivel: 2,
    precioPromedio: 9500,
    menu: [
      {
        nombre: "Orden de tacos al pastor con piña tatemada",
        descripcion:
          "Tres tacos en tortilla palmeada, con cebolla morada, cilantro y salsa de chile seco.",
        precio: 9800,
        foto: "/food-demo/m/mexicana-1.jpg",
      },
      {
        nombre: "Guacamole al molcajete con totopos",
        precio: 8400,
        foto: "/food-demo/m/mexicana-2.jpg",
      },
      {
        nombre: "Quesadilla de birria con su consomé",
        descripcion:
          "Doradita en el comal y servida con consomé de la olla para remojar.",
        precio: 10200,
        foto: "/food-demo/m/mexicana-3.jpg",
      },
      {
        nombre: "Tacos de barbacoa estilo Hidalgo",
        precio: 11400,
        foto: "/food-demo/m/mexicana-5.jpg",
      },
      {
        nombre: "Esquites con tajín y queso cotija",
        precio: 7200,
        foto: "/food-demo/m/mexicana-7.jpg",
      },
      {
        nombre: "Chilaquiles rojos con pollo deshebrado",
        precio: 10000,
        foto: "/food-demo/m/mexicana-6.jpg",
      },
    ],
    rating: 4.6,
    resenas: 289,
    fotoPrincipal: "/food-demo/r/comal-nueve-1.jpg",
    galeria: ["/food-demo/r/comal-nueve-2.jpg", "/food-demo/r/comal-nueve-3.jpg"],
    horario: "Lun–Sáb · 11:30 – 22:00",
    promociones: [
      { hora: "11:30", descuento: 25 },
      { hora: "12:30", descuento: 10 },
      { hora: "13:30", descuento: 20 },
      { hora: "14:30", descuento: 35 },
      { hora: "15:00", descuento: 40 },
    ],
  },
  {
    slug: "pastor-y-pina",
    nombre: "Pastor y Piña",
    descripcion:
      "Acá el trompo gira desde el mediodía y la piña se dora encima, como tiene que ser. Antojitos mexicanos sin complique, a un par de cuadras de La Sabana.",
    categoria: "Mexicana",
    cocina: "Al pastor y antojitos",
    zona: "Sabana",
    direccion: "Centro Comercial Rincón Oeste, local 6",
    telefono: "+506 2555-0127",
    precioNivel: 2,
    precioPromedio: 8500,
    menu: [
      {
        nombre: "Orden de tacos al pastor con piña dorada",
        descripcion:
          "Cinco taquitos directo del trompo, con la piña caramelizada encima.",
        precio: 9400,
        foto: "/food-demo/m/mexicana-1.jpg",
      },
      {
        nombre: "Quesadilla grande de pastor con queso fundido",
        precio: 9200,
        foto: "/food-demo/m/mexicana-3.jpg",
      },
      {
        nombre: "Guacamole con totopos recién fritos",
        precio: 7800,
        foto: "/food-demo/m/mexicana-2.jpg",
      },
      {
        nombre: "Elote callejero con mayonesa y chile piquín",
        precio: 6200,
        foto: "/food-demo/m/mexicana-7.jpg",
      },
      {
        nombre: "Enchiladas rojas de pollo con crema",
        descripcion:
          "Bañadas en salsa de guajillo y gratinadas hasta que el queso burbujea.",
        precio: 9800,
        foto: "/food-demo/m/mexicana-4.jpg",
      },
      {
        nombre: "Churros con canela y cajeta",
        precio: 8600,
        foto: "/food-demo/m/mexicana-8.jpg",
      },
    ],
    rating: 4.4,
    resenas: 172,
    fotoPrincipal: "/food-demo/r/pastor-y-pina-1.jpg",
    galeria: ["/food-demo/r/pastor-y-pina-2.jpg", "/food-demo/r/pastor-y-pina-3.jpg"],
    horario: "Mar–Dom · 12:00 – 21:30",
    promociones: [
      { hora: "16:30", descuento: 35 },
      { hora: "17:00", descuento: 30 },
      { hora: "17:30", descuento: 25 },
      { hora: "18:00", descuento: 15 },
      { hora: "19:00", descuento: 10 },
      { hora: "20:30", descuento: 20 },
    ],
  },
  {
    slug: "cielo-de-agave",
    nombre: "Cielo de Agave",
    descripcion:
      "Cocina mexicana de autor con una barra de mezcales que no vas a encontrar en ningún otro lado de Lindora. Ideal para cenas largas y sobremesas todavía más largas.",
    categoria: "Mexicana",
    cocina: "Mexicana contemporánea",
    zona: "Lindora",
    direccion: "Plaza Vientos, local 21",
    telefono: "+506 2555-0138",
    precioNivel: 2,
    precioPromedio: 12500,
    menu: [
      {
        nombre: "Tacos de pescado al achiote con piña asada",
        precio: 14200,
        foto: "/food-demo/m/mexicana-1.jpg",
      },
      {
        nombre: "Guacamole tatemado al molcajete",
        descripcion:
          "Aguacate, chiles tatemados y totopos de maíz azul, preparado frente a la mesa.",
        precio: 10800,
        foto: "/food-demo/m/mexicana-2.jpg",
      },
      {
        nombre: "Barbacoa de res de 12 horas con consomé",
        descripcion:
          "Cocción lenta envuelta en hoja de plátano, con tortillas recién palmeadas.",
        precio: 16400,
        foto: "/food-demo/m/mexicana-5.jpg",
      },
      {
        nombre: "Enchiladas suizas gratinadas al horno de leña",
        precio: 13800,
        foto: "/food-demo/m/mexicana-4.jpg",
      },
      {
        nombre: "Esquites trufados con cotija añejo",
        precio: 9600,
        foto: "/food-demo/m/mexicana-7.jpg",
      },
      {
        nombre: "Quesadilla de birria con costra de queso",
        precio: 13900,
        foto: "/food-demo/m/mexicana-3.jpg",
      },
      {
        nombre: "Churros con chocolate de metate",
        precio: 8800,
        foto: "/food-demo/m/mexicana-8.jpg",
      },
    ],
    rating: 4.8,
    resenas: 456,
    fotoPrincipal: "/food-demo/r/cielo-de-agave-1.jpg",
    galeria: ["/food-demo/r/cielo-de-agave-2.jpg", "/food-demo/r/cielo-de-agave-3.jpg"],
    horario: "Mié–Dom · 17:00 – 23:00",
    promociones: [
      { hora: "18:00", descuento: 10 },
      { hora: "19:00", descuento: 15 },
      { hora: "20:00", descuento: 25 },
      { hora: "20:30", descuento: 35 },
      { hora: "21:00", descuento: 45 },
      { hora: "21:30", descuento: 50 },
    ],
  },
  {
    slug: "cantina-del-volcan",
    nombre: "Cantina del Volcán",
    descripcion:
      "Una cantina de recetas caseras donde los frijoles se cocinan a fuego lento y la tortilla nunca sale de un paquete. El plan perfecto para un almuerzo largo en Cartago.",
    categoria: "Mexicana",
    cocina: "Cantina tradicional",
    zona: "Cartago",
    direccion: "Centro Comercial Puente Viejo, local 9",
    telefono: "+506 2555-0142",
    precioNivel: 2,
    precioPromedio: 10500,
    menu: [
      {
        nombre: "Chilaquiles de la casa con huevo y chorizo",
        descripcion:
          "Totopos bañados en salsa roja de la olla, con crema, cotija y aguacate.",
        precio: 10600,
        foto: "/food-demo/m/mexicana-6.jpg",
      },
      {
        nombre: "Enchiladas gratinadas de pollo criollo",
        precio: 11800,
        foto: "/food-demo/m/mexicana-4.jpg",
      },
      {
        nombre: "Tacos de barbacoa en tortilla palmeada",
        descripcion:
          "Con su taza de consomé caliente para acompañar, como en las cantinas de antes.",
        precio: 12400,
        foto: "/food-demo/m/mexicana-5.jpg",
      },
      {
        nombre: "Guacamole de la cantina con totopos",
        precio: 9400,
        foto: "/food-demo/m/mexicana-2.jpg",
      },
      {
        nombre: "Churros con chocolate espeso de la abuela",
        precio: 8300,
        foto: "/food-demo/m/mexicana-8.jpg",
      },
    ],
    rating: 4.7,
    resenas: 97,
    fotoPrincipal: "/food-demo/r/cantina-del-volcan-1.jpg",
    galeria: ["/food-demo/r/cantina-del-volcan-2.jpg", "/food-demo/r/cantina-del-volcan-3.jpg"],
    horario: "Lun–Dom · 11:00 – 20:30",
    promociones: [
      { hora: "11:00", descuento: 15 },
      { hora: "12:00", descuento: 10 },
      { hora: "13:30", descuento: 20 },
      { hora: "15:00", descuento: 30 },
      { hora: "16:00", descuento: 30 },
      { hora: "17:00", descuento: 25 },
      { hora: "18:30", descuento: 15 },
      { hora: "19:30", descuento: 10 },
    ],
  },
];
