import type { RestauranteDemo } from "../tipos";

export const INTERNACIONAL: RestauranteDemo[] = [
  {
    slug: "meridiano-siete",
    nombre: "Meridiano Siete",
    descripcion:
      "Un recorrido por siete cocinas del mundo condensado en un menú de autor que cambia con la temporada. Vení por las entradas de la barra y quedate por los fuertes al fuego.",
    categoria: "Internacional",
    cocina: "Cocina de autor internacional",
    zona: "Escazú",
    direccion: "Plaza Miravalle, local 22",
    telefono: "+506 2555-0114",
    precioNivel: 4,
    precioPromedio: 28500,
    menu: [
      {
        nombre: "Lomito madurado en demiglace de café",
        descripcion:
          "Corte sellado al fuego con hongos silvestres y croqueta de tuétano.",
        precio: 32000,
        foto: "/food-demo/m/internacional-1.jpg",
      },
      {
        nombre: "Costillar de cordero en costra de hierbas",
        precio: 31000,
        foto: "/food-demo/m/internacional-6.jpg",
      },
      {
        nombre: "Salmón sellado con puré de coliflor ahumado",
        precio: 29500,
        foto: "/food-demo/m/internacional-2.jpg",
      },
      {
        nombre: "Risotto de hongos y aceite de trufa",
        precio: 27000,
        foto: "/food-demo/m/internacional-3.jpg",
      },
      {
        nombre: "Curry amarillo de mariscos del Pacífico",
        precio: 26500,
        foto: "/food-demo/m/internacional-4.jpg",
      },
      {
        nombre: "Tartar de atún con yema curada y ponzu",
        descripcion:
          "La entrada insignia de la barra, con caviar y chips de la casa.",
        precio: 24500,
        foto: "/food-demo/m/internacional-5.jpg",
      },
      {
        nombre: "Volcán de chocolate 70%",
        precio: 8500,
        foto: "/food-demo/m/internacional-8.jpg",
      },
    ],
    rating: 4.8,
    resenas: 347,
    fotoPrincipal: "/food-demo/r/meridiano-siete-1.jpg",
    galeria: [
      "/food-demo/r/meridiano-siete-2.jpg",
      "/food-demo/r/meridiano-siete-3.jpg",
    ],
    horario: "Mar–Dom · 12:00 – 23:00",
    promociones: [
      { hora: "12:30", descuento: 15 },
      { hora: "17:00", descuento: 30 },
      { hora: "17:30", descuento: 35 },
      { hora: "18:00", descuento: 30 },
      { hora: "19:00", descuento: 20 },
      { hora: "20:30", descuento: 10 },
    ],
  },
  {
    slug: "alisio-bistro",
    nombre: "Alisio Bistró",
    descripcion:
      "Cocina de bistró europeo con guiños asiáticos en un salón lleno de luz natural. El almuerzo es su hora fuerte, con menús cortos que rotan cada semana.",
    categoria: "Internacional",
    cocina: "Bistró de fusión",
    zona: "Lindora",
    direccion: "Centro Comercial Portal del Oeste, local 5",
    telefono: "+506 2555-0127",
    precioNivel: 3,
    precioPromedio: 18500,
    menu: [
      {
        nombre: "Salmón glaseado con miso y vegetales de temporada",
        descripcion:
          "El favorito del almuerzo: glaseado dulce de miso sobre puré cremoso.",
        precio: 21000,
        foto: "/food-demo/m/internacional-2.jpg",
      },
      {
        nombre: "Fusilli al pesto con tomates confitados",
        precio: 19500,
        foto: "/food-demo/m/internacional-7.jpg",
      },
      {
        nombre: "Medallones de res al vino tinto",
        precio: 18500,
        foto: "/food-demo/m/internacional-1.jpg",
      },
      {
        nombre: "Risotto cremoso de champiñones",
        descripcion:
          "Arroz arborio al punto con parmesano añejo y mantequilla avellanada.",
        precio: 18000,
        foto: "/food-demo/m/internacional-3.jpg",
      },
      {
        nombre: "Curry rojo de pollo con arroz jazmín",
        precio: 17500,
        foto: "/food-demo/m/internacional-4.jpg",
      },
      {
        nombre: "Tartar de atún sobre crema de aguacate",
        precio: 16500,
        foto: "/food-demo/m/internacional-5.jpg",
      },
    ],
    rating: 4.5,
    resenas: 92,
    fotoPrincipal: "/food-demo/r/alisio-bistro-1.jpg",
    galeria: [
      "/food-demo/r/alisio-bistro-2.jpg",
      "/food-demo/r/alisio-bistro-3.jpg",
    ],
    horario: "Lun–Sáb · 11:30 – 21:30",
    promociones: [
      { hora: "11:30", descuento: 25 },
      { hora: "12:00", descuento: 40 },
      { hora: "12:30", descuento: 35 },
      { hora: "13:00", descuento: 30 },
      { hora: "13:30", descuento: 20 },
      { hora: "18:30", descuento: 15 },
    ],
  },
  {
    slug: "bitacora-cocina-abierta",
    nombre: "Bitácora Cocina Abierta",
    descripcion:
      "Cocina a la vista donde cada plato cuenta una escala distinta del viaje. Perfecto para cenar tarde: la barra sirve hasta la última franja de la noche.",
    categoria: "Internacional",
    cocina: "Fusión de mercado",
    zona: "Rohrmoser",
    direccion: "Plaza Alameda Norte, local 9",
    telefono: "+506 2555-0138",
    precioNivel: 4,
    precioPromedio: 26500,
    menu: [
      {
        nombre: "Costillas de cordero con chimichurri de menta",
        descripcion:
          "Asadas a la vista en la parrilla de leña — la escala fija del viaje.",
        precio: 30500,
        foto: "/food-demo/m/internacional-6.jpg",
      },
      {
        nombre: "Lomito en reducción de tamarindo",
        precio: 28000,
        foto: "/food-demo/m/internacional-1.jpg",
      },
      {
        nombre: "Salmón a la brasa con mantequilla de ajo negro",
        precio: 27500,
        foto: "/food-demo/m/internacional-2.jpg",
      },
      {
        nombre: "Pasta del mercado con vegetales rostizados",
        precio: 26500,
        foto: "/food-demo/m/internacional-7.jpg",
      },
      {
        nombre: "Curry verde de pesca del día",
        descripcion:
          "Con leche de coco, hierba limón y lo que traiga el mercado esa mañana.",
        precio: 25500,
        foto: "/food-demo/m/internacional-4.jpg",
      },
      {
        nombre: "Atún en dos tiempos: tartar y sellado",
        precio: 24000,
        foto: "/food-demo/m/internacional-5.jpg",
      },
      {
        nombre: "Risotto de hongos ostra al carbón",
        precio: 23500,
        foto: "/food-demo/m/internacional-3.jpg",
      },
    ],
    rating: 4.9,
    resenas: 528,
    fotoPrincipal: "/food-demo/r/bitacora-cocina-abierta-1.jpg",
    galeria: [
      "/food-demo/r/bitacora-cocina-abierta-2.jpg",
      "/food-demo/r/bitacora-cocina-abierta-3.jpg",
    ],
    horario: "Mié–Lun · 17:00 – 23:30",
    promociones: [
      { hora: "17:30", descuento: 10 },
      { hora: "18:30", descuento: 15 },
      { hora: "20:00", descuento: 30 },
      { hora: "20:30", descuento: 45 },
      { hora: "21:00", descuento: 50 },
      { hora: "21:30", descuento: 40 },
    ],
  },
  {
    slug: "doce-husos",
    nombre: "Doce Husos",
    descripcion:
      "Grill internacional que junta cortes, pastas y curries bajo un mismo techo en Belén. Recién abierto, con tardes tranquilas ideales para una sobremesa larga.",
    categoria: "Internacional",
    cocina: "Grill internacional",
    zona: "Belén",
    direccion: "Plaza Cedro Alto, local 7",
    telefono: "+506 2555-0142",
    precioNivel: 3,
    precioPromedio: 16800,
    menu: [
      {
        nombre: "Churrasco de la casa con papas rústicas",
        descripcion:
          "El corte insignia del grill, reposado y servido con chimichurri suave.",
        precio: 18500,
        foto: "/food-demo/m/internacional-1.jpg",
      },
      {
        nombre: "Salmón al grill con ensalada tibia",
        precio: 17500,
        foto: "/food-demo/m/internacional-2.jpg",
      },
      {
        nombre: "Risotto de maíz dulce y parmesano",
        precio: 17000,
        foto: "/food-demo/m/internacional-3.jpg",
      },
      {
        nombre: "Curry de garbanzos y pollo al grill",
        descripcion:
          "Especiado suave, pensado para la sobremesa larga de la tarde.",
        precio: 16000,
        foto: "/food-demo/m/internacional-4.jpg",
      },
      {
        nombre: "Pasta primavera del huerto",
        precio: 15500,
        foto: "/food-demo/m/internacional-7.jpg",
      },
      {
        nombre: "Fondant de chocolate con helado de vainilla",
        precio: 7500,
        foto: "/food-demo/m/internacional-8.jpg",
      },
    ],
    rating: 4.4,
    resenas: 61,
    fotoPrincipal: "/food-demo/r/doce-husos-1.jpg",
    galeria: ["/food-demo/r/doce-husos-2.jpg", "/food-demo/r/doce-husos-3.jpg"],
    horario: "Lun–Dom · 12:00 – 22:00",
    promociones: [
      { hora: "12:00", descuento: 10 },
      { hora: "14:30", descuento: 25 },
      { hora: "15:30", descuento: 30 },
      { hora: "16:30", descuento: 25 },
      { hora: "19:00", descuento: 15 },
    ],
    esNuevo: true,
  },
  {
    slug: "comedor-atlas",
    nombre: "Comedor Atlas",
    descripcion:
      "¿Antojo de almorzar distinto sin salir de Alajuela? Acá sirven recetas de tres continentes sin complicaciones, y llegando temprano agarrás los mejores descuentos del día.",
    categoria: "Internacional",
    cocina: "Cocina del mundo",
    zona: "Alajuela",
    direccion: "Paseo Los Faroles, local 11",
    telefono: "+506 2555-0159",
    precioNivel: 3,
    precioPromedio: 21000,
    menu: [
      {
        nombre: "Filete de res con puré trufado",
        precio: 23500,
        foto: "/food-demo/m/internacional-1.jpg",
      },
      {
        nombre: "Salmón teriyaki con vegetales al wok",
        descripcion:
          "La parada asiática del menú: glaseado brillante y vegetales crocantes.",
        precio: 22500,
        foto: "/food-demo/m/internacional-2.jpg",
      },
      {
        nombre: "Chuletas de cordero al romero",
        precio: 21500,
        foto: "/food-demo/m/internacional-6.jpg",
      },
      {
        nombre: "Tartar de atún estilo nikkei",
        precio: 20000,
        foto: "/food-demo/m/internacional-5.jpg",
      },
      {
        nombre: "Pollo tikka masala con arroz basmati",
        descripcion:
          "La receta india de la casa, suave y especiada, con basmati al vapor.",
        precio: 19500,
        foto: "/food-demo/m/internacional-4.jpg",
      },
      {
        nombre: "Pasta mediterránea con tomate y albahaca",
        precio: 19000,
        foto: "/food-demo/m/internacional-7.jpg",
      },
    ],
    rating: 4.7,
    resenas: 236,
    fotoPrincipal: "/food-demo/r/comedor-atlas-1.jpg",
    galeria: [
      "/food-demo/r/comedor-atlas-2.jpg",
      "/food-demo/r/comedor-atlas-3.jpg",
    ],
    horario: "Lun–Dom · 11:00 – 21:00",
    promociones: [
      { hora: "11:00", descuento: 25 },
      { hora: "11:30", descuento: 20 },
      { hora: "12:00", descuento: 15 },
      { hora: "13:30", descuento: 10 },
      { hora: "15:00", descuento: 15 },
    ],
  },
];
