import type { RestauranteDemo } from "../tipos";

export const ASIATICA: RestauranteDemo[] = [
  {
    slug: "farol-de-jade",
    nombre: "Farol de Jade",
    descripcion:
      "Dim sum hecho al momento y pato laqueado en un salón de faroles rojos que se siente de otra época. Vení entre semana al mediodía, cuando las canastas de bambú no dejan de salir.",
    categoria: "Asiática",
    cocina: "Cantonesa contemporánea",
    zona: "San José centro",
    direccion: "Galería Ámbar, local 5",
    telefono: "+506 2555-0142",
    precioNivel: 3,
    precioPromedio: 16500,
    menu: [
      {
        nombre: "Canasta de dim sum de la casa",
        descripcion:
          "Ocho piezas al vapor: har gow de camarón, siu mai y empanadita de chancho asado.",
        precio: 13600,
        foto: "/food-demo/m/asiatica-1.jpg",
      },
      {
        nombre: "Pato laqueado al estilo Cantón",
        descripcion:
          "Laqueado por doce horas, en tajadas con su jugo y vegetales salteados.",
        precio: 24800,
        foto: "/food-demo/m/asiatica-2.jpg",
      },
      {
        nombre: "Bao de panceta caramelizada",
        precio: 10900,
        foto: "/food-demo/m/asiatica-3.jpg",
      },
      {
        nombre: "Fideos de arroz salteados con camarón",
        precio: 16400,
        foto: "/food-demo/m/asiatica-5.jpg",
      },
      {
        nombre: "Sopa de fideos con res y hierbas",
        precio: 15900,
        foto: "/food-demo/m/asiatica-7.jpg",
      },
      {
        nombre: "Caldo de fideos con chancho asado",
        precio: 17400,
        foto: "/food-demo/m/asiatica-4.jpg",
      },
    ],
    rating: 4.7,
    resenas: 342,
    fotoPrincipal: "/food-demo/r/farol-de-jade-1.jpg",
    galeria: ["/food-demo/r/farol-de-jade-2.jpg", "/food-demo/r/farol-de-jade-3.jpg"],
    horario: "Lun–Dom · 11:30 – 22:00",
    promociones: [
      { hora: "11:30", descuento: 35 },
      { hora: "12:00", descuento: 25 },
      { hora: "12:30", descuento: 15 },
      { hora: "13:30", descuento: 20 },
      { hora: "14:00", descuento: 30 },
      { hora: "19:00", descuento: 10 },
    ],
  },
  {
    slug: "bao-y-humo",
    nombre: "Bao & Humo",
    descripcion:
      "Barra de baos rellenos y ramen de caldo lento con la cocina abierta frente a vos. Después de las ocho la plancha agarra ritmo y el descuento también.",
    categoria: "Asiática",
    cocina: "Baos y ramen de barra",
    zona: "Rohrmoser",
    direccion: "Plaza Brisa Oeste, local 14",
    telefono: "+506 2555-0167",
    precioNivel: 2,
    precioPromedio: 9800,
    menu: [
      {
        nombre: "Bao de panceta ahumada",
        descripcion:
          "Pan al vapor con panceta ahumada en casa, pepino encurtido y ajonjolí tostado.",
        precio: 8900,
        foto: "/food-demo/m/asiatica-3.jpg",
      },
      {
        nombre: "Ramen de caldo lento",
        descripcion:
          "Dieciocho horas de cocción, chashu de chancho, huevo marinado y bambú.",
        precio: 12400,
        foto: "/food-demo/m/asiatica-4.jpg",
      },
      {
        nombre: "Gyozas al vapor (6 unidades)",
        precio: 7600,
        foto: "/food-demo/m/asiatica-1.jpg",
      },
      {
        nombre: "Fideos de la plancha con camarón",
        precio: 10800,
        foto: "/food-demo/m/asiatica-5.jpg",
      },
      {
        nombre: "Rollitos frescos con salsa de maní",
        precio: 9300,
        foto: "/food-demo/m/asiatica-8.jpg",
      },
    ],
    rating: 4.9,
    resenas: 58,
    fotoPrincipal: "/food-demo/r/bao-y-humo-1.jpg",
    galeria: ["/food-demo/r/bao-y-humo-2.jpg", "/food-demo/r/bao-y-humo-3.jpg"],
    horario: "Mar–Dom · 17:00 – 23:00",
    promociones: [
      { hora: "17:00", descuento: 15 },
      { hora: "17:30", descuento: 20 },
      { hora: "20:00", descuento: 30 },
      { hora: "20:30", descuento: 40 },
      { hora: "21:00", descuento: 50 },
      { hora: "21:30", descuento: 45 },
    ],
    esNuevo: true,
  },
  {
    slug: "mesa-siam",
    nombre: "Mesa Siam",
    descripcion:
      "¿Antojo de pad thai o de un curry que reconforte? Acá las recetas son de familia, el picante se ajusta a tu gusto y el arroz jazmín llega humeante a la mesa.",
    categoria: "Asiática",
    cocina: "Tailandesa casera",
    zona: "Heredia",
    direccion: "Centro Comercial Monte Claro, local 9",
    telefono: "+506 2555-0129",
    precioNivel: 2,
    precioPromedio: 11500,
    menu: [
      {
        nombre: "Pad thai de camarón",
        descripcion:
          "Fideos de arroz al wok con tamarindo, maní tostado y camarones jumbo.",
        precio: 11800,
        foto: "/food-demo/m/asiatica-5.jpg",
      },
      {
        nombre: "Khao soi de pollo",
        descripcion:
          "Curry del norte con leche de coco, fideos al huevo y limón mandarina.",
        precio: 12600,
        foto: "/food-demo/m/asiatica-6.jpg",
      },
      {
        nombre: "Rollitos frescos con salsa de tamarindo",
        precio: 8900,
        foto: "/food-demo/m/asiatica-8.jpg",
      },
      {
        nombre: "Sopa de fideos estilo barco",
        precio: 10700,
        foto: "/food-demo/m/asiatica-7.jpg",
      },
      {
        nombre: "Pato a la parrilla con tamarindo",
        precio: 15400,
        foto: "/food-demo/m/asiatica-2.jpg",
      },
      {
        nombre: "Kanom jeeb (empanaditas al vapor)",
        precio: 9600,
        foto: "/food-demo/m/asiatica-1.jpg",
      },
    ],
    rating: 4.5,
    resenas: 116,
    fotoPrincipal: "/food-demo/r/mesa-siam-1.jpg",
    galeria: ["/food-demo/r/mesa-siam-2.jpg", "/food-demo/r/mesa-siam-3.jpg"],
    horario: "Lun–Sáb · 11:00 – 21:00",
    promociones: [
      { hora: "12:00", descuento: 10 },
      { hora: "15:30", descuento: 15 },
      { hora: "17:00", descuento: 25 },
      { hora: "17:30", descuento: 30 },
      { hora: "18:00", descuento: 20 },
      { hora: "18:30", descuento: 10 },
    ],
  },
  {
    slug: "anis-estrella",
    nombre: "Anís Estrella",
    descripcion:
      "Cocina vietnamita de autor: pho de cocción larga, rollitos frescos y hierbas que cultivan ahí mismo. Ideal si buscás una cena tranquila con sabores que no se encuentran en cualquier esquina.",
    categoria: "Asiática",
    cocina: "Vietnamita de autor",
    zona: "Curridabat",
    direccion: "Plaza Granate, local 17",
    telefono: "+506 2555-0183",
    precioNivel: 3,
    precioPromedio: 18000,
    menu: [
      {
        nombre: "Pho de res de cocción larga",
        descripcion:
          "Caldo de doce horas con falda de res, fideos de arroz y hierbas de la huerta.",
        precio: 16800,
        foto: "/food-demo/m/asiatica-7.jpg",
      },
      {
        nombre: "Rollitos frescos de camarón",
        precio: 12900,
        foto: "/food-demo/m/asiatica-8.jpg",
      },
      {
        nombre: "Pato glaseado al anís estrella",
        descripcion:
          "El plato de la casa: magret laqueado con especias y reducción de caña.",
        precio: 26400,
        foto: "/food-demo/m/asiatica-2.jpg",
      },
      {
        nombre: "Cà ri de pollo con fideos",
        precio: 17800,
        foto: "/food-demo/m/asiatica-6.jpg",
      },
      {
        nombre: "Phở xào con camarón",
        descripcion: "La versión salteada del pho: fideos dorados al wok.",
        precio: 18600,
        foto: "/food-demo/m/asiatica-5.jpg",
      },
      {
        nombre: "Bánh bao de panceta",
        precio: 15500,
        foto: "/food-demo/m/asiatica-3.jpg",
      },
    ],
    rating: 4.6,
    resenas: 473,
    fotoPrincipal: "/food-demo/r/anis-estrella-1.jpg",
    galeria: ["/food-demo/r/anis-estrella-2.jpg", "/food-demo/r/anis-estrella-3.jpg"],
    horario: "Mié–Lun · 12:00 – 22:30",
    promociones: [
      { hora: "12:00", descuento: 20 },
      { hora: "12:30", descuento: 25 },
      { hora: "14:30", descuento: 30 },
      { hora: "15:00", descuento: 40 },
      { hora: "15:30", descuento: 30 },
      { hora: "19:00", descuento: 15 },
      { hora: "21:00", descuento: 20 },
      { hora: "21:30", descuento: 25 },
    ],
  },
];
