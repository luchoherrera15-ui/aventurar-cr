import type { RestauranteDemo } from "../tipos";

export const PIZZA: RestauranteDemo[] = [
  {
    slug: "piedra-y-masa",
    nombre: "Piedra y Masa",
    descripcion:
      "Horno de leña a la vista y masa reposada 48 horas: probá la napolitana con el borde inflado como debe ser.",
    categoria: "Pizza",
    cocina: "Napolitana de leña",
    zona: "Heredia",
    direccion: "Plaza Encino, local 14",
    telefono: "+506 2555-0141",
    precioNivel: 2,
    precioPromedio: 9500,
    menu: [
      {
        nombre: "Margherita napolitana",
        descripcion:
          "Tomate San Marzano, fior di latte y albahaca, 90 segundos en horno de leña.",
        precio: 9200,
        foto: "/food-demo/m/pizza-1.jpg",
      },
      {
        nombre: "Diavola de pepperoni y miel picante",
        precio: 10400,
        foto: "/food-demo/m/pizza-2.jpg",
      },
      {
        nombre: "Calzone del horno con jamón y hongos",
        descripcion:
          "Masa reposada 48 horas rellena de jamón, hongos y mozzarella fundida.",
        precio: 9800,
        foto: "/food-demo/m/pizza-5.jpg",
      },
      {
        nombre: "Caprese de tomate y albahaca",
        precio: 7400,
        foto: "/food-demo/m/pizza-7.jpg",
      },
      {
        nombre: "Cuatro quesos con borde inflado",
        precio: 11200,
        foto: "/food-demo/m/pizza-4.jpg",
      },
      {
        nombre: "Tiramisú de la casa",
        precio: 4300,
        foto: "/food-demo/m/pizza-8.jpg",
      },
    ],
    rating: 4.8,
    resenas: 214,
    fotoPrincipal: "/food-demo/r/piedra-y-masa-1.jpg",
    galeria: [
      "/food-demo/r/piedra-y-masa-2.jpg",
      "/food-demo/r/piedra-y-masa-3.jpg",
    ],
    horario: "Mar–Dom · 12:00 – 22:00",
    promociones: [
      { hora: "12:00", descuento: 15 },
      { hora: "12:30", descuento: 10 },
      { hora: "17:00", descuento: 30 },
      { hora: "17:30", descuento: 40 },
      { hora: "18:00", descuento: 25 },
      { hora: "18:30", descuento: 15 },
    ],
  },
  {
    slug: "la-redonda-84",
    nombre: "La Redonda 84",
    descripcion:
      "Pizza romana al corte para armar el almuerzo por porción, ideal si andás con poco tiempo y mucha hambre.",
    categoria: "Pizza",
    cocina: "Romana al taglio",
    zona: "Sabana",
    direccion: "Centro Comercial Brisa Oeste, local 3",
    telefono: "+506 2555-0127",
    precioNivel: 2,
    precioPromedio: 8200,
    menu: [
      {
        nombre: "Trío al corte de la vitrina",
        descripcion:
          "Tres porciones a elegir de la barra del día, recién salidas de la plancha.",
        precio: 7900,
        foto: "/food-demo/m/pizza-6.jpg",
      },
      {
        nombre: "Pepperoni al corte doble",
        precio: 6900,
        foto: "/food-demo/m/pizza-2.jpg",
      },
      {
        nombre: "Caprese de tomate cherry",
        precio: 7400,
        foto: "/food-demo/m/pizza-7.jpg",
      },
      {
        nombre: "Margherita romana entera",
        descripcion:
          "Base crocante estilo romano con mozzarella y albahaca, para compartir.",
        precio: 9400,
        foto: "/food-demo/m/pizza-1.jpg",
      },
      {
        nombre: "Calzone relleno del día",
        precio: 9600,
        foto: "/food-demo/m/pizza-5.jpg",
      },
    ],
    rating: 4.6,
    resenas: 57,
    fotoPrincipal: "/food-demo/r/la-redonda-84-1.jpg",
    galeria: [
      "/food-demo/r/la-redonda-84-2.jpg",
      "/food-demo/r/la-redonda-84-3.jpg",
    ],
    horario: "Lun–Sáb · 11:30 – 21:30",
    promociones: [
      { hora: "11:30", descuento: 35 },
      { hora: "12:00", descuento: 20 },
      { hora: "12:30", descuento: 10 },
      { hora: "13:30", descuento: 15 },
      { hora: "14:00", descuento: 30 },
    ],
  },
  {
    slug: "doble-fermento",
    nombre: "Doble Fermento",
    descripcion:
      "Acá la estrella es la fermentación lenta: una masa liviana y crocante con ingredientes de productores del Valle Central.",
    categoria: "Pizza",
    cocina: "Masa madre contemporánea",
    zona: "San José centro",
    direccion: "Edificio Roble Central, local 2",
    telefono: "+506 2555-0163",
    precioNivel: 2,
    precioPromedio: 11500,
    menu: [
      {
        nombre: "Pizza de rúcula y balsámico",
        descripcion:
          "Pollo a la parrilla, rúcula fresca y reducción de balsámico sobre masa madre.",
        precio: 12400,
        foto: "/food-demo/m/pizza-3.jpg",
      },
      {
        nombre: "Margherita de fermento largo",
        precio: 10900,
        foto: "/food-demo/m/pizza-1.jpg",
      },
      {
        nombre: "Cuatro quesos del Valle Central",
        descripcion:
          "Mozzarella, gouda de Turrialba, parmesano y queso azul sobre base liviana.",
        precio: 12800,
        foto: "/food-demo/m/pizza-4.jpg",
      },
      {
        nombre: "Diavola artesanal",
        precio: 11900,
        foto: "/food-demo/m/pizza-2.jpg",
      },
      {
        nombre: "Burrata con tomates y albahaca",
        precio: 10400,
        foto: "/food-demo/m/pizza-7.jpg",
      },
      {
        nombre: "Calzone de hongos salteados",
        precio: 11800,
        foto: "/food-demo/m/pizza-5.jpg",
      },
      {
        nombre: "Tiramisú al café chorreado",
        descripcion:
          "Bizcocho empapado en café chorreado con crema de mascarpone y cacao.",
        precio: 5400,
        foto: "/food-demo/m/pizza-8.jpg",
      },
    ],
    rating: 4.7,
    resenas: 389,
    fotoPrincipal: "/food-demo/r/doble-fermento-1.jpg",
    galeria: [
      "/food-demo/r/doble-fermento-2.jpg",
      "/food-demo/r/doble-fermento-3.jpg",
    ],
    horario: "Lun–Dom · 11:00 – 23:00",
    promociones: [
      { hora: "11:00", descuento: 20 },
      { hora: "12:00", descuento: 10 },
      { hora: "15:00", descuento: 25 },
      { hora: "15:30", descuento: 30 },
      { hora: "16:30", descuento: 25 },
      { hora: "19:00", descuento: 15 },
      { hora: "21:00", descuento: 20 },
      { hora: "21:30", descuento: 25 },
    ],
  },
  {
    slug: "horno-cardinal",
    nombre: "Horno Cardinal",
    descripcion:
      "Doce pizzas de autor salidas de un horno a la piedra, con una terraza tranquila para cerrar el día sin prisa.",
    categoria: "Pizza",
    cocina: "Artesanal a la piedra",
    zona: "Curridabat",
    direccion: "Plaza Lomas del Este, local 21",
    telefono: "+506 2555-0189",
    precioNivel: 2,
    precioPromedio: 8900,
    menu: [
      {
        nombre: "Pizza de autor de pollo y rúcula",
        precio: 9600,
        foto: "/food-demo/m/pizza-3.jpg",
      },
      {
        nombre: "Focaccia de tomate y orégano",
        descripcion:
          "Pan plano de la casa con tomates asados, ideal para arrancar la mesa.",
        precio: 6900,
        foto: "/food-demo/m/pizza-6.jpg",
      },
      {
        nombre: "Margherita a la piedra",
        precio: 8400,
        foto: "/food-demo/m/pizza-1.jpg",
      },
      {
        nombre: "Pepperoni cardinal",
        descripcion:
          "Nuestra clásica con doble pepperoni y borde dorado a la piedra.",
        precio: 9200,
        foto: "/food-demo/m/pizza-2.jpg",
      },
      {
        nombre: "Cuatro quesos cremosa",
        precio: 9900,
        foto: "/food-demo/m/pizza-4.jpg",
      },
      {
        nombre: "Tiramisú de la terraza",
        precio: 4800,
        foto: "/food-demo/m/pizza-8.jpg",
      },
    ],
    rating: 4.5,
    resenas: 132,
    fotoPrincipal: "/food-demo/r/horno-cardinal-1.jpg",
    galeria: [
      "/food-demo/r/horno-cardinal-2.jpg",
      "/food-demo/r/horno-cardinal-3.jpg",
    ],
    horario: "Mié–Dom · 17:00 – 22:30",
    promociones: [
      { hora: "17:00", descuento: 15 },
      { hora: "18:00", descuento: 10 },
      { hora: "20:00", descuento: 35 },
      { hora: "20:30", descuento: 45 },
      { hora: "21:00", descuento: 50 },
      { hora: "21:30", descuento: 40 },
    ],
  },
];
