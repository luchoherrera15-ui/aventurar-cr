/**
 * Los datos de los restaurantes DEMO del directorio: dos por cada
 * categoría de comida, con su menú.
 *
 * Son negocios FICTICIOS — nombres inventados, no corresponden a
 * ningún local real de Costa Rica. Los siembra
 * scripts/seed-demo-restaurantes.mjs con el prefijo "demo-" en el
 * slug, que es lo que pinta la insignia "Demo" en las cards.
 *
 * Editar acá y volver a correr el seed: es idempotente.
 */
export const RESTAURANTES = [
  {
    "categoria": "tipica",
    "nombre": "Cocina Tomillo y Coco",
    "slug": "cocina-tomillo-y-coco",
    "descripcion": "Cocina caribeña de olla: rice and beans cocinado en leche de coco con tomillo y pollo guisado con chile panameño. El patí sale del horno a media tarde.",
    "provincia": "Limón",
    "canton": "Talamanca",
    "direccion_exacta": "Calle principal de Puerto Viejo de Talamanca, 150 m sur del parque, mano derecha.",
    "precio_desde": 7200,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Patí de carne",
        "descripcion": "Empanada horneada de masa hojaldrada rellena de carne con chile panameño.",
        "precio": 1800
      },
      {
        "grupo": "Entradas",
        "nombre": "Ensalada de palmito con coco",
        "descripcion": "Palmito fresco, coco rallado, limón criollo y culantro coyote.",
        "precio": 3800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Rice and beans con pollo caribeño",
        "descripcion": "Arroz y frijoles en leche de coco con tomillo, más pollo guisado con panameño.",
        "precio": 9800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Costilla de cerdo en jengibre y coco",
        "descripcion": "Costilla cocinada lento en salsa de jengibre, coco y tapa de dulce.",
        "precio": 11500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pollo jerk a la parrilla",
        "descripcion": "Marinado un día entero en especias y pimienta de Jamaica, con plátano asado.",
        "precio": 10500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Plátano maduro relleno",
        "descripcion": "Maduro horneado relleno de picadillo de carne y queso, con frijoles molidos.",
        "precio": 7200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Agua de sapo",
        "descripcion": "Infusión fría de jengibre con tapa de dulce y limón criollo.",
        "precio": 1500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Horchata de arroz con coco",
        "descripcion": "Arroz remojado, coco y canela, servida bien fría.",
        "precio": 1600
      },
      {
        "grupo": "Postres",
        "nombre": "Pan bon casero",
        "descripcion": "Rebanada de pan bon con especias y fruta confitada, servida con queso.",
        "precio": 1500
      }
    ]
  },
  {
    "categoria": "tipica",
    "nombre": "Soda El Chayotal",
    "slug": "soda-el-chayotal",
    "descripcion": "Casados de olla con picadillo del día y gallo pinto hecho en fogón de leña. Los sábados sale olla de carne con yuca, elote y ñampí hasta que se acaba la paila.",
    "provincia": "Cartago",
    "canton": "Paraíso",
    "direccion_exacta": "300 m norte de la iglesia de Paraíso, contiguo al taller de bicicletas.",
    "precio_desde": 4300,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Desayunos",
        "nombre": "Gallo pinto con huevo",
        "descripcion": "Pinto de la casa con huevo al gusto, natilla, queso turrialba y tortilla palmeada.",
        "precio": 2800
      },
      {
        "grupo": "Desayunos",
        "nombre": "Chorreadas con natilla",
        "descripcion": "Dos chorreadas de maíz tierno hechas en el comal, con natilla fresca.",
        "precio": 2200
      },
      {
        "grupo": "Casados",
        "nombre": "Casado de pollo en salsa",
        "descripcion": "Arroz, frijoles, picadillo del día, ensalada de repollo y pollo en salsa criolla.",
        "precio": 4300
      },
      {
        "grupo": "Casados",
        "nombre": "Casado de bistec encebollado",
        "descripcion": "Bistec de posta con cebolla, plátano maduro y el picadillo que haya ese día.",
        "precio": 4800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Olla de carne (solo sábados)",
        "descripcion": "Costilla con yuca, ñampí, elote, chayote y plátano; el arroz viene aparte.",
        "precio": 5200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Chicharrones con yuca",
        "descripcion": "Chicharrón de cerdo frito al momento con yuca cocida, tortilla y chimichurri.",
        "precio": 4500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Fresco de cas en agua",
        "descripcion": "Cas colado del día; se prepara sin azúcar si se pide así.",
        "precio": 1100
      },
      {
        "grupo": "Bebidas",
        "nombre": "Agua dulce con leche",
        "descripcion": "Tapa de dulce raspada al momento, servida caliente.",
        "precio": 900
      },
      {
        "grupo": "Postres",
        "nombre": "Arroz con leche",
        "descripcion": "Con canela y cáscara de limón, hecho en la mañana.",
        "precio": 1300
      }
    ]
  },
  {
    "categoria": "carnes",
    "nombre": "Asados La Ventanilla",
    "slug": "asados-la-ventanilla",
    "descripcion": "Parrilla de barrio con leña de laurel: lomo de aguja, costilla de cerdo y chorizo casero con yuca frita. Se pide en la ventanilla y se come en mesas de madera bajo techo.",
    "provincia": "Alajuela",
    "canton": "San Carlos",
    "direccion_exacta": "1 km este del cruce de Florencia, sobre la ruta 141 hacia Ciudad Quesada, mano derecha.",
    "precio_desde": 5900,
    "rango_precio": 2,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Para picar",
        "nombre": "Chorizo casero con tortilla",
        "descripcion": "Chorizo hecho en la casa, asado y partido, con tortilla y chimichurri.",
        "precio": 2600
      },
      {
        "grupo": "Para picar",
        "nombre": "Chicharrón de costilla",
        "descripcion": "Costilla de cerdo frita en su grasa, con limón y cebolla curtida.",
        "precio": 3400
      },
      {
        "grupo": "De la parrilla",
        "nombre": "Lomo de aguja (250 g)",
        "descripcion": "Corte de res sobre leña de laurel, con yuca y ensalada de repollo.",
        "precio": 6800
      },
      {
        "grupo": "De la parrilla",
        "nombre": "Costilla de cerdo en tapa de dulce",
        "descripcion": "Asada lento y barnizada con tapa de dulce y mostaza; sale bien tostada.",
        "precio": 7400
      },
      {
        "grupo": "De la parrilla",
        "nombre": "Medio pollo al carbón",
        "descripcion": "Marinado en achiote y naranja agria, con papa asada.",
        "precio": 5900
      },
      {
        "grupo": "De la parrilla",
        "nombre": "Bistec de vuelta y vuelta",
        "descripcion": "Posta delgada con cebolla y chile dulce, arroz y frijoles.",
        "precio": 6200
      },
      {
        "grupo": "Acompañamientos",
        "nombre": "Yuca frita con chimichurri",
        "descripcion": "Yuca cocida y frita al momento, para compartir.",
        "precio": 1900
      },
      {
        "grupo": "Acompañamientos",
        "nombre": "Ensalada de repollo y zanahoria",
        "descripcion": "Repollo picado fino con zanahoria, limón y culantro.",
        "precio": 1400
      },
      {
        "grupo": "Bebidas",
        "nombre": "Fresco de tamarindo",
        "descripcion": "Tamarindo colado, en vaso o en jarra para la mesa.",
        "precio": 1200
      }
    ]
  },
  {
    "categoria": "carnes",
    "nombre": "Brasa y Roble",
    "slug": "brasa-y-roble",
    "descripcion": "Parrilla de leña de roble con carne madurada 30 días en cámara propia. El corte llega entero a la mesa y se porciona ahí, con guarniciones de temporada.",
    "provincia": "San José",
    "canton": "Santa Ana",
    "direccion_exacta": "400 m sur del parque de Santa Ana, plaza comercial a mano derecha, local 4.",
    "precio_desde": 28000,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Tártara de lomito",
        "descripcion": "Lomito picado a cuchillo, yema curada en sal y tostadas de maíz criollo.",
        "precio": 9500
      },
      {
        "grupo": "Entradas",
        "nombre": "Mollejas a la brasa",
        "descripcion": "Mollejas doradas sobre leña, con limón mandarina y berros.",
        "precio": 8200
      },
      {
        "grupo": "Cortes",
        "nombre": "Bife ancho madurado 30 días (350 g)",
        "descripcion": "Madurado en cámara propia, sellado sobre roble y reposado 8 minutos.",
        "precio": 31000
      },
      {
        "grupo": "Cortes",
        "nombre": "Lomito con hueso a la leña (400 g)",
        "descripcion": "Corte con hueso para trinchar en mesa, con sal marina de Guanacaste.",
        "precio": 36000
      },
      {
        "grupo": "Cortes",
        "nombre": "Costilla de res a fuego bajo",
        "descripcion": "Ocho horas sobre brasa suave hasta soltarse del hueso.",
        "precio": 28000
      },
      {
        "grupo": "Cortes",
        "nombre": "Pierna de cordero al rescoldo (para dos)",
        "descripcion": "Cocinada entre brasas y ceniza, con jugo de romero y ajo asado.",
        "precio": 52000
      },
      {
        "grupo": "Guarniciones",
        "nombre": "Papas nuevas al rescoldo",
        "descripcion": "Papas enteras cocinadas entre brasas, abiertas con natilla ahumada y cebollín.",
        "precio": 5500
      },
      {
        "grupo": "Guarniciones",
        "nombre": "Chayote y elote a la parrilla",
        "descripcion": "Verduras del día marcadas al fuego, con mantequilla de chile panameño.",
        "precio": 4800
      },
      {
        "grupo": "Postres",
        "nombre": "Tres leches de café chorreado",
        "descripcion": "Bizcocho empapado en tres leches con café de Tarrazú y crema batida.",
        "precio": 6200
      }
    ]
  },
  {
    "categoria": "mariscos",
    "nombre": "Leña y Anzuelo",
    "slug": "lena-y-anzuelo",
    "descripcion": "Pesca de línea de Sámara cocinada al fuego: pargo entero a la leña, tiraditos con chile congo y arroz de cabezas. El menú cambia según lo que entra el bote.",
    "provincia": "Guanacaste",
    "canton": "Nicoya",
    "direccion_exacta": "En playa Sámara, 200 m sur de la escuela, camino a playa Carrillo, mano izquierda.",
    "precio_desde": 24000,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Crudos",
        "nombre": "Tiradito de pargo",
        "descripcion": "Láminas de pargo con leche de tigre de chile congo y aceite de culantro.",
        "precio": 9800
      },
      {
        "grupo": "Crudos",
        "nombre": "Ostras del Golfo de Nicoya (media docena)",
        "descripcion": "Abiertas al momento, con mignonette de limón mandarina.",
        "precio": 12500
      },
      {
        "grupo": "Del fuego",
        "nombre": "Pargo entero a la leña (para dos)",
        "descripcion": "Pescado del día abierto y asado sobre brasa, con recado de achiote.",
        "precio": 42000
      },
      {
        "grupo": "Del fuego",
        "nombre": "Atún aleta amarilla sellado",
        "descripcion": "Lomo marcado por fuera y crudo por dentro, con salsa de tamarindo.",
        "precio": 27000
      },
      {
        "grupo": "Del fuego",
        "nombre": "Arroz de cabezas con camarón",
        "descripcion": "Arroz cocinado en caldo de cabezas de camarón, terminado a la leña.",
        "precio": 24000
      },
      {
        "grupo": "Del fuego",
        "nombre": "Pulpo a la brasa",
        "descripcion": "Pulpo cocido lento y terminado al fuego, sobre puré de yuca.",
        "precio": 26000
      },
      {
        "grupo": "Guarniciones",
        "nombre": "Ensalada de palmito y mango verde",
        "descripcion": "Palmito fresco, mango verde, ajonjolí tostado y limón.",
        "precio": 6500
      },
      {
        "grupo": "Postres",
        "nombre": "Helado de leche de coco",
        "descripcion": "Hecho en casa, con miel de tapa de dulce y ralladura de limón.",
        "precio": 5800
      }
    ]
  },
  {
    "categoria": "mariscos",
    "nombre": "Marisquería Boca del Estero",
    "slug": "marisqueria-boca-del-estero",
    "descripcion": "Ceviche de corvina picado a cuchillo y pescado entero frito con patacones. Lo que entra en la lancha en la mañana es lo que hay ese día.",
    "provincia": "Puntarenas",
    "canton": "Puntarenas",
    "direccion_exacta": "Sobre el Paseo de los Turistas, 100 m este de la Casa de la Cultura, contiguo al parqueo público.",
    "precio_desde": 5900,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Ceviches",
        "nombre": "Ceviche de corvina",
        "descripcion": "Corvina en cubos con limón, cebolla morada y culantro coyote; con galletas.",
        "precio": 3900
      },
      {
        "grupo": "Ceviches",
        "nombre": "Ceviche mixto",
        "descripcion": "Corvina, camarón y chucheca, con chile dulce y un toque de jengibre.",
        "precio": 5200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pescado entero frito",
        "descripcion": "Pargo del día frito con patacones, ensalada y frijoles molidos.",
        "precio": 8900
      },
      {
        "grupo": "Fuertes",
        "nombre": "Arroz con camarones",
        "descripcion": "Arroz salteado con camarón, chile dulce y culantro; alcanza para dos.",
        "precio": 6800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Sopa de mariscos",
        "descripcion": "Caldo de pescado, camarón y almeja con leche de coco y culantro.",
        "precio": 7500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Casado de filete a la plancha",
        "descripcion": "Filete de corvina con arroz, frijoles, picadillo y maduro.",
        "precio": 5900
      },
      {
        "grupo": "Acompañamientos",
        "nombre": "Patacones con frijoles molidos",
        "descripcion": "Plátano verde majado y frito, con natilla y chilero de la casa.",
        "precio": 2200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Fresco de maracuyá",
        "descripcion": "Maracuyá en agua, bien frío y no muy dulce.",
        "precio": 1200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Agua de pipa",
        "descripcion": "Pipa fría abierta al momento, servida en el coco.",
        "precio": 1200
      }
    ]
  },
  {
    "categoria": "pastas",
    "nombre": "La Mesa de Emilia",
    "slug": "la-mesa-de-emilia",
    "descripcion": "Cocina italiana de menú corto: pastas extruidas en bronce, cortes al horno de leña y vinos de productores pequeños. Comedor de 24 puestos alrededor de la cocina abierta.",
    "provincia": "San José",
    "canton": "Escazú",
    "direccion_exacta": "De la entrada de Trejos Montealegre, 200 m sur y 50 m este, local 3 de la plaza de piedra",
    "precio_desde": 13500,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Para empezar",
        "nombre": "Crudo de atún y limón mandarina",
        "descripcion": "Atún de Puntarenas, aceite de oliva verde, alcaparras fritas y ralladura de limón mandarina.",
        "precio": 9500
      },
      {
        "grupo": "Para empezar",
        "nombre": "Burrata con higos asados",
        "descripcion": "Burrata del día, higos criollos al horno, miel de flor de café y pimienta negra.",
        "precio": 10500
      },
      {
        "grupo": "Pastas y arroces",
        "nombre": "Tagliolini de mantequilla dorada",
        "descripcion": "Pasta al huevo con mantequilla noisette, salvia y parmesano curado 24 meses.",
        "precio": 13500
      },
      {
        "grupo": "Pastas y arroces",
        "nombre": "Ravioli de rabo de res",
        "descripcion": "Relleno de rabo braseado en vino tinto, con su jugo reducido y ralladura de naranja.",
        "precio": 15500
      },
      {
        "grupo": "Pastas y arroces",
        "nombre": "Risotto de hongos de Cartago",
        "descripcion": "Arroz carnaroli con hongos ostra y portobello de Cartago, tomillo y aceite de trufa.",
        "precio": 14500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Lomito al horno de leña",
        "descripcion": "Corte de 250 g, papa aplastada con romero y jugo del asado.",
        "precio": 22500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Corvina al horno",
        "descripcion": "Filete con tomate confitado, aceitunas y alcaparras, al estilo de la costa.",
        "precio": 19500
      },
      {
        "grupo": "Postres",
        "nombre": "Panna cotta de vainilla",
        "descripcion": "Con compota de mora silvestre y crumble de almendra tostada.",
        "precio": 6500
      },
      {
        "grupo": "Postres",
        "nombre": "Semifreddo de café",
        "descripcion": "Café de Tarrazú semihelado con cacao amargo y avellana quebrada.",
        "precio": 6800
      }
    ]
  },
  {
    "categoria": "pastas",
    "nombre": "Pastas El Rodillo",
    "slug": "pastas-el-rodillo",
    "descripcion": "Pastas frescas amasadas cada mañana con rodillo y máquina de manivela, y salsas de olla: boloñesa de tres horas y pesto de albahaca del huerto de al lado. Se pide en el mostrador y se come en mesas comunales.",
    "provincia": "Heredia",
    "canton": "Santo Domingo",
    "direccion_exacta": "300 m norte de la iglesia de Santo Domingo, contiguo a la panadería, casa de dos plantas color mostaza",
    "precio_desde": 5200,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Pan de ajo con perejil",
        "descripcion": "Baguette del día tostado con mantequilla de ajo asado y perejil fresco.",
        "precio": 1800
      },
      {
        "grupo": "Entradas",
        "nombre": "Ensalada tibia de tomate",
        "descripcion": "Tomates de Cartago, albahaca y lascas de queso duro con aceite de oliva.",
        "precio": 2600
      },
      {
        "grupo": "Pastas",
        "nombre": "Boloñesa de olla",
        "descripcion": "Ragú de res cocinado tres horas sobre tallarín fresco, con queso rallado al momento.",
        "precio": 5500
      },
      {
        "grupo": "Pastas",
        "nombre": "Pesto de albahaca",
        "descripcion": "Fettuccine con pesto de albahaca, ajo y semilla de marañón tostada.",
        "precio": 5200
      },
      {
        "grupo": "Pastas",
        "nombre": "Cuatro quesos criollo",
        "descripcion": "Penne en salsa cremosa de queso Turrialba maduro, mozzarella, parmesano y azul.",
        "precio": 6200
      },
      {
        "grupo": "Pastas",
        "nombre": "Lasaña de la casa",
        "descripcion": "Ocho capas de pasta fresca con ragú y bechamel, gratinada por porción.",
        "precio": 6800
      },
      {
        "grupo": "Bebidas",
        "nombre": "Fresco del día",
        "descripcion": "Cas, mora o limón con hierbabuena, hechos con fruta del mercado.",
        "precio": 1500
      },
      {
        "grupo": "Postres",
        "nombre": "Tiramisú de la abuela",
        "descripcion": "Bizcocho remojado en café chorreado y crema batida con un toque de tapa de dulce.",
        "precio": 2900
      }
    ]
  },
  {
    "categoria": "pizza",
    "nombre": "Leña Sabanera",
    "slug": "lena-sabanera",
    "descripcion": "Napolitana de masa fermentada 48 horas y horneada 90 segundos en leña de guanacaste. Mozzarella fresca de una quesería de Nicoya y tomate San Marzano.",
    "provincia": "Guanacaste",
    "canton": "Santa Cruz",
    "direccion_exacta": "600 m oeste de la escuela de Villarreal, camino a Tamarindo, portón de madera a mano derecha",
    "precio_desde": 9500,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Focaccia de romero",
        "descripcion": "Del mismo horno, con aceite de oliva, romero y sal en escamas.",
        "precio": 4200
      },
      {
        "grupo": "Entradas",
        "nombre": "Burrata con tomate asado",
        "descripcion": "Burrata fresca, tomates cherry al horno de leña y albahaca.",
        "precio": 8500
      },
      {
        "grupo": "Pizzas",
        "nombre": "Margarita",
        "descripcion": "Tomate San Marzano, mozzarella fresca de Nicoya, albahaca y aceite de oliva.",
        "precio": 9500
      },
      {
        "grupo": "Pizzas",
        "nombre": "Diávola",
        "descripcion": "Salame picante, tomate, mozzarella y un hilo de miel de abeja de mangle al final.",
        "precio": 12500
      },
      {
        "grupo": "Pizzas",
        "nombre": "Sabanera",
        "descripcion": "Chorizo de la zona, cebolla morada encurtida, queso palmito y chile panameño.",
        "precio": 13500
      },
      {
        "grupo": "Pizzas",
        "nombre": "Bianca de hongos",
        "descripcion": "Sin salsa de tomate: crema de ajo, hongos ostra, tomillo y parmesano.",
        "precio": 12000
      },
      {
        "grupo": "Pizzas",
        "nombre": "Cuatro estaciones",
        "descripcion": "Alcachofa, hongos, jamón y aceituna, un cuarto de cada uno.",
        "precio": 14500
      },
      {
        "grupo": "Postres",
        "nombre": "Calzone dulce de avellana",
        "descripcion": "Masa rellena de crema de avellana, horneada y con azúcar en polvo.",
        "precio": 5500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Limonada de albahaca",
        "descripcion": "Limón mandarina, albahaca del huerto y agua con gas.",
        "precio": 2800
      }
    ]
  },
  {
    "categoria": "pizza",
    "nombre": "Pizzería La Mejenga",
    "slug": "pizzeria-la-mejenga",
    "descripcion": "Pizza de masa gruesa y borde crocante, con pepperoni de la carnicería del pueblo. Local sencillo de mantel de hule, con mesas largas donde cabe el equipo completo después del partido.",
    "provincia": "Alajuela",
    "canton": "San Carlos",
    "direccion_exacta": "Esquina noreste del parque de Ciudad Quesada, al lado de la ferretería, entrando por el portón verde",
    "precio_desde": 8500,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Pizzas",
        "nombre": "Pepperoni doble",
        "descripcion": "Masa gruesa, salsa de tomate de la casa y pepperoni en dos capas. Mediana de 30 cm.",
        "precio": 8500
      },
      {
        "grupo": "Pizzas",
        "nombre": "Suprema La Mejenga",
        "descripcion": "Jamón, salchichón, chile dulce, cebolla, hongos y aceituna negra. Mediana de 30 cm.",
        "precio": 10500
      },
      {
        "grupo": "Pizzas",
        "nombre": "Hawaiana con natilla",
        "descripcion": "Jamón, piña y un hilo de natilla apenas sale del horno. Mediana de 30 cm.",
        "precio": 9200
      },
      {
        "grupo": "Pizzas",
        "nombre": "Pollo y maíz dulce",
        "descripcion": "Pollo desmenuzado, maíz dulce y bastante mozzarella con orégano. Mediana de 30 cm.",
        "precio": 9800
      },
      {
        "grupo": "Extras",
        "nombre": "Palitos de ajo",
        "descripcion": "Ocho palitos de la misma masa con mantequilla de ajo y salsa de tomate aparte.",
        "precio": 3200
      },
      {
        "grupo": "Extras",
        "nombre": "Alitas bañadas",
        "descripcion": "Diez alitas en salsa barbacoa o picante, con apio y aderezo ranch.",
        "precio": 5900
      },
      {
        "grupo": "Bebidas",
        "nombre": "Jarra de fresco de cas",
        "descripcion": "Un litro de fresco natural, alcanza para dos o tres.",
        "precio": 2500
      },
      {
        "grupo": "Postres",
        "nombre": "Pizza de canela",
        "descripcion": "La misma masa horneada con azúcar, canela y glaseado de queso crema.",
        "precio": 3500
      }
    ]
  },
  {
    "categoria": "hamburguesas",
    "nombre": "Cebollazo Burger",
    "slug": "cebollazo-burger",
    "descripcion": "Hamburguesa de plancha con la cebolla aplastada dentro de la carne, en pan de la panadería del pueblo. Se pide en la ventanilla y se come de pie o en el carro.",
    "provincia": "Puntarenas",
    "canton": "Esparza",
    "direccion_exacta": "Sobre la carretera Interamericana en Esparza, 100 m antes del puente sobre el río Barranca, ventanilla azul",
    "precio_desde": 3200,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Hamburguesas",
        "nombre": "Sencilla de plancha",
        "descripcion": "Torta de 100 g con cebolla aplastada, queso amarillo, tomate y salsa de la casa.",
        "precio": 3200
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "Doble con queso",
        "descripcion": "Dos tortas, doble queso y pepinillo encurtido en pan tostado con mantequilla.",
        "precio": 4800
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "Criolla",
        "descripcion": "Torta con queso Turrialba, natilla, tomate y tajadas de plátano maduro.",
        "precio": 5200
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "Pollo crocante",
        "descripcion": "Pechuga empanizada, repollo morado y mayonesa de chile panameño.",
        "precio": 4500
      },
      {
        "grupo": "Acompañamientos",
        "nombre": "Papas con chimichurri",
        "descripcion": "Papa en bastón frita al momento con chimichurri de perejil y ajo.",
        "precio": 2200
      },
      {
        "grupo": "Acompañamientos",
        "nombre": "Yuca frita con curtido",
        "descripcion": "Yuca en gajos con curtido de repollo y salsa rosada.",
        "precio": 2000
      },
      {
        "grupo": "Bebidas",
        "nombre": "Batido de fruta en leche",
        "descripcion": "Mora, guanábana o cas, batido al momento. Vaso de 16 onzas.",
        "precio": 1800
      },
      {
        "grupo": "Postres",
        "nombre": "Batido helado de galleta",
        "descripcion": "Helado de vainilla batido con galleta de chocolate molida.",
        "precio": 2500
      }
    ]
  },
  {
    "categoria": "hamburguesas",
    "nombre": "Yunque Burger",
    "slug": "yunque-burger",
    "descripcion": "Hamburguesas de res madurada 21 días, molida en casa y sellada en plancha de hierro, con pan brioche del día. Pizarra corta de cervezas ticas de barril.",
    "provincia": "Cartago",
    "canton": "Cartago",
    "direccion_exacta": "125 m sur de las Ruinas de Cartago, casa esquinera con portón de hierro negro",
    "precio_desde": 8900,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Para picar",
        "nombre": "Aros de cebolla en tempura",
        "descripcion": "Cebolla blanca en masa liviana con mayonesa de chipotle ahumado.",
        "precio": 3800
      },
      {
        "grupo": "Para picar",
        "nombre": "Papas con queso y tocineta",
        "descripcion": "Papa rústica, salsa de queso maduro, tocineta crocante y cebollín.",
        "precio": 4900
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "La del Yunque",
        "descripcion": "Doble torta de res madurada, cheddar curado, cebolla caramelizada y salsa de la casa.",
        "precio": 9800
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "Turrialba ahumada",
        "descripcion": "Torta sellada, queso Turrialba fundido, tocineta y mermelada de chile dulce.",
        "precio": 10500
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "Hongos y trufa",
        "descripcion": "Res madurada, hongos salteados, queso suizo y mayonesa con aceite de trufa.",
        "precio": 11500
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "Cerdo desmenuzado",
        "descripcion": "Cerdo cocinado ocho horas, curtido de repollo y salsa barbacoa de café.",
        "precio": 9500
      },
      {
        "grupo": "Hamburguesas",
        "nombre": "Vegetal de frijol negro",
        "descripcion": "Torta de frijol negro y remolacha, aguacate, tomate asado y alioli.",
        "precio": 8900
      },
      {
        "grupo": "Bebidas",
        "nombre": "Cerveza artesanal de barril",
        "descripcion": "Rotativa: IPA, roja o de trigo, de cervecerías ticas. Vaso de 12 onzas.",
        "precio": 3500
      },
      {
        "grupo": "Postres",
        "nombre": "Brownie con helado",
        "descripcion": "Brownie tibio de chocolate 70 % con helado de vainilla y sal marina.",
        "precio": 4200
      }
    ]
  },
  {
    "categoria": "china",
    "nombre": "Vapor y Bambú",
    "slug": "vapor-y-bambu",
    "descripcion": "Casa de dim sum: canastas de bambú que salen cada diez minutos, pato laqueado que se encarga con un día y té en tetera de barro. Cocina cantonesa, sin fusión.",
    "provincia": "Heredia",
    "canton": "Belén",
    "direccion_exacta": "300 m oeste del Ojo de Agua, San Antonio de Belén, casa esquinera con farolitos",
    "precio_desde": 15000,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Dim sum",
        "nombre": "Har gow (4 u.)",
        "descripcion": "Empanadita traslúcida de camarón entero y brotes de bambú.",
        "precio": 5200
      },
      {
        "grupo": "Dim sum",
        "nombre": "Siu mai de cerdo y camarón (4 u.)",
        "descripcion": "Al vapor, coronados con una lasca fina de zanahoria.",
        "precio": 4800
      },
      {
        "grupo": "Dim sum",
        "nombre": "Char siu bao (3 u.)",
        "descripcion": "Pan al vapor relleno de cerdo asado en salsa dulce.",
        "precio": 4600
      },
      {
        "grupo": "Dim sum",
        "nombre": "Rollo de arroz con res",
        "descripcion": "Lámina de arroz enrollada, bañada en soya dulce y ajonjolí.",
        "precio": 5400
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pato laqueado (media porción)",
        "descripcion": "Piel crocante con panqueques, pepino y cebollino. Se encarga con un día de anticipación.",
        "precio": 28000
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pescado entero al vapor",
        "descripcion": "Corvina del día con jengibre, cebollino y aceite caliente encima.",
        "precio": 19500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Berenjena en salsa de frijol negro",
        "descripcion": "Salteada al wok hasta quedar suave, picante bajo.",
        "precio": 7800
      },
      {
        "grupo": "Tés",
        "nombre": "Oolong en tetera",
        "descripcion": "Servido en tetera de barro para dos, con rellenos de agua.",
        "precio": 3500
      },
      {
        "grupo": "Postres",
        "nombre": "Tarta de huevo cantonesa (2 u.)",
        "descripcion": "Hojaldre tibio con natilla de huevo recién horneada.",
        "precio": 3200
      }
    ]
  },
  {
    "categoria": "china",
    "nombre": "Wok La Ventanilla",
    "slug": "wok-la-ventanilla",
    "descripcion": "Chop suey de wok bien tostadito y arroz cantonés en porciones para compartir; se pide en la ventanilla y sale en cajita de cartón en menos de diez minutos.",
    "provincia": "San José",
    "canton": "Desamparados",
    "direccion_exacta": "100 m sur y 25 m este de la iglesia de Desamparados, local con toldo rojo",
    "precio_desde": 6000,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Rollitos primavera (3 u.)",
        "descripcion": "Repollo, zanahoria y cerdo, fritos al momento; vienen con salsa agridulce.",
        "precio": 2500
      },
      {
        "grupo": "Entradas",
        "nombre": "Wantán frito (6 u.)",
        "descripcion": "Masa crocante rellena de cerdo y cebollino, con salsa de tamarindo.",
        "precio": 2900
      },
      {
        "grupo": "Fuertes",
        "nombre": "Chop suey mixto",
        "descripcion": "Cerdo, pollo, camarón y vegetales al wok, con fideo crocante encima.",
        "precio": 5200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Arroz cantonés de la casa",
        "descripcion": "Arroz frito con jamón, huevo, culantro y chicharrón de cerdo.",
        "precio": 4800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Chow mein de res",
        "descripcion": "Fideo salteado con res en tiritas, chile dulce y cebolla.",
        "precio": 5600
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pollo agridulce",
        "descripcion": "Pollo empanizado con piña y chile dulce en salsa agridulce de la casa.",
        "precio": 5400
      },
      {
        "grupo": "Bebidas",
        "nombre": "Fresco de maracuyá en agua",
        "descripcion": "Vaso grande, hecho al momento y con poco dulce.",
        "precio": 1300
      },
      {
        "grupo": "Postres",
        "nombre": "Bolitas de sésamo (4 u.)",
        "descripcion": "Masa de arroz frita, rellena de pasta dulce de frijol.",
        "precio": 2000
      }
    ]
  },
  {
    "categoria": "japonesa",
    "nombre": "Barra Diez",
    "slug": "barra-diez",
    "descripcion": "Barra de diez asientos con menú omakase: nigiri de pescado curado en la casa, arroz tibio avinagrado y dos o tres platos cocidos entremedio. Un solo turno por noche, con reserva.",
    "provincia": "San José",
    "canton": "Escazú",
    "direccion_exacta": "San Rafael de Escazú, costado sur de Plaza Colonial, segundo piso sobre la floristería",
    "precio_desde": 30000,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Aperitivos",
        "nombre": "Chawanmushi de cangrejo",
        "descripcion": "Flan salado de huevo al vapor con caldo dashi y cangrejo.",
        "precio": 5800
      },
      {
        "grupo": "Aperitivos",
        "nombre": "Sunomono de pepino y pulpo",
        "descripcion": "Pepino encurtido, pulpo cocido despacio y vinagre de arroz.",
        "precio": 6500
      },
      {
        "grupo": "Nigiri",
        "nombre": "Nigiri de atún curado (2 piezas)",
        "descripcion": "Lomo curado en soya, arroz tibio y wasabi rallado al momento.",
        "precio": 6500
      },
      {
        "grupo": "Nigiri",
        "nombre": "Nigiri de pargo (2 piezas)",
        "descripcion": "Pargo madurado tres días, sal de yuzu y una gota de limón.",
        "precio": 6200
      },
      {
        "grupo": "Nigiri",
        "nombre": "Nigiri de camarón flameado (2 piezas)",
        "descripcion": "Camarón del Pacífico apenas flameado, con salsa de su cabeza.",
        "precio": 6800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Omakase de once piezas",
        "descripcion": "Selección del día: diez nigiri, un rollo y sopa. Solo con reserva.",
        "precio": 42000
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pargo entero a la robata",
        "descripcion": "A la brasa de carbón, con nabo rallado y ponzu de la casa.",
        "precio": 24000
      },
      {
        "grupo": "Postres",
        "nombre": "Dorayaki con helado de matcha",
        "descripcion": "Panqueque relleno de frijol dulce y helado de té verde.",
        "precio": 4800
      },
      {
        "grupo": "Bebidas",
        "nombre": "Sake junmai (copa)",
        "descripcion": "Servido frío en vaso de vidrio, con la botella a la vista.",
        "precio": 6000
      }
    ]
  },
  {
    "categoria": "japonesa",
    "nombre": "Sushi del Estero",
    "slug": "sushi-del-estero",
    "descripcion": "Barra de sushi frente al estero: atún y dorado que llegan del muelle en la mañana, rollos generosos y sopa miso con almeja del Golfo de Nicoya.",
    "provincia": "Puntarenas",
    "canton": "Puntarenas",
    "direccion_exacta": "Paseo de los Turistas, 150 m este del muelle de cruceros, local celeste",
    "precio_desde": 9500,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Sopa miso con almeja",
        "descripcion": "Caldo de miso con almeja del golfo, tofu y cebollino.",
        "precio": 2600
      },
      {
        "grupo": "Entradas",
        "nombre": "Edamame con sal de mar",
        "descripcion": "Vainas al vapor con sal gruesa y limón mandarina.",
        "precio": 2200
      },
      {
        "grupo": "Rollos",
        "nombre": "Rollo del muelle",
        "descripcion": "Atún fresco, aguacate y chile panameño, cubierto de ajonjolí.",
        "precio": 6800
      },
      {
        "grupo": "Rollos",
        "nombre": "Rollo tempura de camarón",
        "descripcion": "Camarón en tempura, queso crema y salsa de anguila.",
        "precio": 7200
      },
      {
        "grupo": "Rollos",
        "nombre": "Rollo de dorado ahumado",
        "descripcion": "Dorado ahumado en la casa, pepino y cebollino picado.",
        "precio": 7500
      },
      {
        "grupo": "Sashimi",
        "nombre": "Sashimi de atún (5 cortes)",
        "descripcion": "Corte del día con wasabi y jengibre encurtido.",
        "precio": 8500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Té helado de jazmín",
        "descripcion": "Vaso grande, poco dulce, con hielo y limón.",
        "precio": 1400
      }
    ]
  },
  {
    "categoria": "coreana",
    "nombre": "Brasas y Banchan",
    "slug": "brasas-y-banchan",
    "descripcion": "Parrilla coreana a la mesa: uno mismo asa el galbi y la panceta sobre carbón, con doce banchan de entrada y estofados que llegan burbujeando en olla de barro.",
    "provincia": "Cartago",
    "canton": "La Unión",
    "direccion_exacta": "San Diego de La Unión, 300 m este de la iglesia de San Diego, edificio de madera con patio",
    "precio_desde": 18000,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Banchan",
        "nombre": "Mesa de banchan (12 platitos)",
        "descripcion": "Kimchi, brotes de soya, camote y encurtidos, con rellenos sin costo. Va incluida al pedir parrilla; se cobra solo si se pide aparte.",
        "precio": 3500
      },
      {
        "grupo": "Parrilla",
        "nombre": "Galbi marinado (400 g)",
        "descripcion": "Costilla de res deshuesada, marinada en pera y soya, lista para la brasa.",
        "precio": 26000
      },
      {
        "grupo": "Parrilla",
        "nombre": "Samgyeopsal (350 g)",
        "descripcion": "Panceta de cerdo sin marinar; se asa hasta que suelta toda la grasa.",
        "precio": 16500
      },
      {
        "grupo": "Parrilla",
        "nombre": "Chadolbaegi (300 g)",
        "descripcion": "Falda de res en lascas finas, lista en un minuto sobre el carbón.",
        "precio": 14500
      },
      {
        "grupo": "Parrilla",
        "nombre": "Combo de la casa para dos",
        "descripcion": "Galbi, panceta y falda, más banchan, arroz y estofado de soya.",
        "precio": 44000
      },
      {
        "grupo": "Estofados",
        "nombre": "Kimchi jjigae",
        "descripcion": "Estofado de kimchi viejo con cerdo y tofu; se sirve hirviendo.",
        "precio": 9800
      },
      {
        "grupo": "Estofados",
        "nombre": "Sundubu jjigae",
        "descripcion": "Tofu suave en caldo picante con almeja y un huevo crudo encima.",
        "precio": 9200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Soju (botella)",
        "descripcion": "Bien frío, para tomar en vasito. Hay natural y de frutas.",
        "precio": 6500
      },
      {
        "grupo": "Postres",
        "nombre": "Bingsu de leche condensada",
        "descripcion": "Hielo raspado fino con leche, frijol dulce y trocitos de mochi.",
        "precio": 5800
      }
    ]
  },
  {
    "categoria": "coreana",
    "nombre": "Cuchara y Kimchi",
    "slug": "cuchara-y-kimchi",
    "descripcion": "Casita coreana cerca de la U: bibimbap en olla de piedra, ramyeon con queso y kimchi que fermentan en el patio de atrás. Los banchan se rellenan sin pedirlos.",
    "provincia": "San José",
    "canton": "Montes de Oca",
    "direccion_exacta": "San Pedro, 125 m norte de la iglesia de San Pedro, casa amarilla con reja verde",
    "precio_desde": 6200,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Banchan",
        "nombre": "Kimchi de la casa",
        "descripcion": "Repollo fermentado tres semanas, picante medio. Porción para compartir.",
        "precio": 1800
      },
      {
        "grupo": "Entradas",
        "nombre": "Kimbap de atún",
        "descripcion": "Rollo de arroz con atún, zanahoria y espinaca; ocho tajadas.",
        "precio": 3900
      },
      {
        "grupo": "Entradas",
        "nombre": "Pajeon de cebollino",
        "descripcion": "Torta salada dorada en plancha, con salsa de soya y vinagre.",
        "precio": 4600
      },
      {
        "grupo": "Fuertes",
        "nombre": "Bibimbap en olla de piedra",
        "descripcion": "Arroz tostado en la olla, vegetales, res marinada y huevo frito.",
        "precio": 6200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Bulgogi con arroz",
        "descripcion": "Res marinada en pera y soya, con lechuga para armar los bocados.",
        "precio": 7400
      },
      {
        "grupo": "Fuertes",
        "nombre": "Ramyeon con queso y huevo",
        "descripcion": "Fideo en caldo rojo picante, queso derretido y huevo tibio.",
        "precio": 5200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Tteokbokki",
        "descripcion": "Cilindros de arroz en salsa gochujang con huevo duro y cebollino.",
        "precio": 4800
      },
      {
        "grupo": "Bebidas",
        "nombre": "Refresco de cebada frío",
        "descripcion": "Sin dulce, servido en jarra. Los rellenos van por cuenta de la casa.",
        "precio": 1000
      }
    ]
  },
  {
    "categoria": "mexicana",
    "nombre": "Taquería Comal y Copal",
    "slug": "taqueria-comal-y-copal",
    "descripcion": "Tortilla de maíz nixtamalizado hecha ahí mismo y trompo de pastor que gira todo el día. Se pide en la barra, se come en banco alto y las salsas van aparte, de chile morita y de tomatillo asado.",
    "provincia": "San José",
    "canton": "Desamparados",
    "direccion_exacta": "150 m sur de la Municipalidad de Desamparados, contiguo a la panadería; local con toldo rojo.",
    "precio_desde": 3900,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Antojitos",
        "nombre": "Elote asado",
        "descripcion": "Elote a la parrilla con mayonesa, queso Turrialba rallado y chile en polvo.",
        "precio": 1500
      },
      {
        "grupo": "Antojitos",
        "nombre": "Quesadilla de flor de calabaza",
        "descripcion": "Tortilla de maíz azul con flor de calabaza salteada y queso derretido.",
        "precio": 2500
      },
      {
        "grupo": "Antojitos",
        "nombre": "Frijoles charros",
        "descripcion": "Frijol de la olla con tocineta, chorizo y culantro, en tacita de barro.",
        "precio": 1700
      },
      {
        "grupo": "Tacos",
        "nombre": "Orden de tacos al pastor (3)",
        "descripcion": "Tres tacos cortados del trompo, con piña asada, cebolla y culantro.",
        "precio": 3900
      },
      {
        "grupo": "Tacos",
        "nombre": "Orden de tacos de birria (3)",
        "descripcion": "Res deshebrada, tortilla pasada por la grasa y consomé aparte para mojar.",
        "precio": 4500
      },
      {
        "grupo": "Tacos",
        "nombre": "Taco de chicharrón prensado",
        "descripcion": "Unidad. Chicharrón guisado en salsa verde con papa y aguacate.",
        "precio": 1500
      },
      {
        "grupo": "Tacos",
        "nombre": "Gringa de pastor",
        "descripcion": "Tortilla de harina, queso derretido y carne del trompo, con salsa morita.",
        "precio": 3500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Agua de horchata",
        "descripcion": "Vaso grande de horchata de arroz con canela, bien fría.",
        "precio": 1200
      },
      {
        "grupo": "Postres",
        "nombre": "Churros con cajeta (4)",
        "descripcion": "Cuatro churros recién fritos con azúcar y cajeta para bañar.",
        "precio": 2000
      }
    ]
  },
  {
    "categoria": "mexicana",
    "nombre": "Tepozán Cocina de Leña",
    "slug": "tepozan-cocina-de-lena",
    "descripcion": "Cocina mexicana al fuego de leña: mole negro que toma tres días, cochinita enterrada en hoja de plátano y salsas molcajeteadas al momento. Catorce mesas, carta corta de mezcales y reserva casi obligada de jueves a sábado.",
    "provincia": "Heredia",
    "canton": "Santo Domingo",
    "direccion_exacta": "400 m este de la iglesia de Santo Domingo de Heredia; casa de esquina con portón negro.",
    "precio_desde": 11500,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Tostada de aguachile de camarón",
        "descripcion": "Camarón curado en limón con chile serrano y aguacate sobre tostada de maíz azul.",
        "precio": 6200
      },
      {
        "grupo": "Entradas",
        "nombre": "Esquites con médula",
        "descripcion": "Elote desgranado en su jugo, médula asada y chicharrón de queso encima.",
        "precio": 5400
      },
      {
        "grupo": "Entradas",
        "nombre": "Sopa de tortilla y pasilla",
        "descripcion": "Caldo de tomate quemado con tiras de tortilla, chile pasilla y natilla.",
        "precio": 4200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Enmoladas de hongos",
        "descripcion": "Tortillas rellenas de hongos salteados bañadas en mole rojo. Vegetariano.",
        "precio": 11500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Cochinita pibil en hoja de plátano",
        "descripcion": "Cerdo marinado en achiote y naranja agria, horneado toda la noche, con cebolla curtida y tortillas hechas a mano.",
        "precio": 13500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pesca del día a la talla",
        "descripcion": "Filete abierto con adobo de guajillo, a la parrilla, con arroz blanco y limón.",
        "precio": 14500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Mole negro con pato",
        "descripcion": "Pierna de pato confitada en mole de 28 ingredientes, con tortillas hechas a mano.",
        "precio": 16500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Mezcal espadín (1 oz)",
        "descripcion": "Mezcal artesanal servido en jícara, con naranja y sal de gusano.",
        "precio": 4500
      },
      {
        "grupo": "Postres",
        "nombre": "Flan de cajeta quemada",
        "descripcion": "Flan denso de cajeta con nuez tostada y un toque de sal de mar.",
        "precio": 3900
      }
    ]
  },
  {
    "categoria": "peruana",
    "nombre": "Ají y Shoyu Barra Nikkei",
    "slug": "aji-y-shoyu-barra-nikkei",
    "descripcion": "Barra nikkei de doce puestos frente al cocinero: tiraditos con ponzu de ají amarillo, makis terminados al soplete y pesca que llega de Guanacaste tres veces por semana. La carta cambia según lo que entre.",
    "provincia": "San José",
    "canton": "Escazú",
    "direccion_exacta": "San Rafael de Escazú, 200 m sur de la iglesia de San Rafael; edificio blanco de dos pisos, local 4.",
    "precio_desde": 10500,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Barra fría",
        "nombre": "Tiradito de róbalo al ají amarillo",
        "descripcion": "Láminas de róbalo con ponzu de ají amarillo, aceite de sésamo y cebollino.",
        "precio": 8500
      },
      {
        "grupo": "Barra fría",
        "nombre": "Causa nikkei de atún",
        "descripcion": "Papa amarilla prensada con atún curado en shoyu, aguacate y mayo de rocoto.",
        "precio": 7200
      },
      {
        "grupo": "Barra fría",
        "nombre": "Ceviche nikkei con nori",
        "descripcion": "Pesca del día en leche de tigre con dashi, alga nori y camote crocante.",
        "precio": 9200
      },
      {
        "grupo": "Barra caliente",
        "nombre": "Maki acevichado de langostino",
        "descripcion": "Ocho piezas con langostino tempura, aguacate y salsa acevichada al soplete.",
        "precio": 10500
      },
      {
        "grupo": "Barra caliente",
        "nombre": "Róbalo al miso",
        "descripcion": "Lomo de róbalo glaseado en miso rojo, con espárrago a la plancha.",
        "precio": 15500
      },
      {
        "grupo": "Barra caliente",
        "nombre": "Chaufa de wagyu",
        "descripcion": "Arroz al wok con wagyu marinado en miso, huevo de campo y cebollino.",
        "precio": 16500
      },
      {
        "grupo": "Postres",
        "nombre": "Suspiro limeño con matcha",
        "descripcion": "Manjar blanco con merengue al matcha y crocante de arroz inflado.",
        "precio": 4500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Pisco sour de maracuyá",
        "descripcion": "Pisco quebranta con maracuyá fresca, clara de huevo y amargo de angostura.",
        "precio": 5500
      }
    ]
  },
  {
    "categoria": "peruana",
    "nombre": "Cevichería Tumbo Bravo",
    "slug": "cevicheria-tumbo-bravo",
    "descripcion": "Ceviche cortado al momento con pesca del día del Pacífico y leche de tigre que sí pica. Mesas sencillas bajo techo de zinc frente al estero y arroz con mariscos que sale humeando del wok.",
    "provincia": "Puntarenas",
    "canton": "Puntarenas",
    "direccion_exacta": "200 m norte del Mercado Central de Puntarenas, sobre la calle que da al estero; portón azul.",
    "precio_desde": 5500,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Papa a la huancaína",
        "descripcion": "Papa cocida con crema de ají amarillo y queso, huevo duro y aceituna.",
        "precio": 2900
      },
      {
        "grupo": "Entradas",
        "nombre": "Chicharrón de calamar",
        "descripcion": "Anillos de calamar apanados en chuño, con salsa criolla y limón.",
        "precio": 4800
      },
      {
        "grupo": "Ceviches",
        "nombre": "Ceviche clásico de corvina",
        "descripcion": "Corvina del día en limón con cebolla morada, camote glaseado y choclo.",
        "precio": 5500
      },
      {
        "grupo": "Ceviches",
        "nombre": "Ceviche mixto en leche de tigre",
        "descripcion": "Pescado, pulpo y camarón en leche de tigre con rocoto. Pica de verdad.",
        "precio": 6800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Chaufa de pollo",
        "descripcion": "Arroz frito al wok con pollo, huevo, cebollino y sillao.",
        "precio": 5800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Lomo saltado",
        "descripcion": "Lomito salteado al wok con cebolla, tomate y papa frita; arroz aparte.",
        "precio": 7200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Arroz con mariscos",
        "descripcion": "Arroz cremoso al ají panca con camarón, mejillón y calamar.",
        "precio": 7800
      },
      {
        "grupo": "Bebidas",
        "nombre": "Chicha morada de la casa",
        "descripcion": "Jarra chica de maíz morado hervido con piña, canela y clavo de olor.",
        "precio": 1400
      },
      {
        "grupo": "Postres",
        "nombre": "Picarones",
        "descripcion": "Buñuelos de camote y zapallo con miel de chancaca, cuatro por orden.",
        "precio": 2400
      }
    ]
  },
  {
    "categoria": "mediterranea",
    "nombre": "Higuera y Brasa",
    "slug": "higuera-y-brasa",
    "descripcion": "Mezze del Mediterráneo oriental sobre brasa de leña: berenjena ahumada, pulpo marcado al carbón y kebab de cordero. Terraza de madera hacia la playa y pan que sale del horno de barro cada media hora.",
    "provincia": "Guanacaste",
    "canton": "Santa Cruz",
    "direccion_exacta": "Playa Tamarindo, 300 m sur del cruce de la calle principal; entrada por el sendero de arena.",
    "precio_desde": 10500,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Mezze",
        "nombre": "Baba ganoush",
        "descripcion": "Berenjena ahumada en brasa con tahini, limón y aceite de oliva verde.",
        "precio": 4800
      },
      {
        "grupo": "Mezze",
        "nombre": "Labneh con za'atar",
        "descripcion": "Yogur colado de la casa con za'atar, aceite de oliva y pan del horno.",
        "precio": 4200
      },
      {
        "grupo": "Mezze",
        "nombre": "Hojas de parra rellenas (4)",
        "descripcion": "Cuatro rollos de arroz con hierbas y piñón, cocidos en limón.",
        "precio": 4600
      },
      {
        "grupo": "Brasas",
        "nombre": "Berenjena al rescoldo",
        "descripcion": "Berenjena entera asada entre brasas con granada, tahini y nuez. Vegetariano.",
        "precio": 10500
      },
      {
        "grupo": "Brasas",
        "nombre": "Pulpo a la brasa",
        "descripcion": "Tentáculo cocido despacio y marcado al carbón, sobre puré de garbanzo.",
        "precio": 14500
      },
      {
        "grupo": "Brasas",
        "nombre": "Kebab de cordero",
        "descripcion": "Cordero molido con especias, a la brasa, con yogur de menta y pan pita.",
        "precio": 15800
      },
      {
        "grupo": "Brasas",
        "nombre": "Pescado entero a la sal (para dos)",
        "descripcion": "Pargo del día en costra de sal con limón confitado y aceite de hierbas.",
        "precio": 21000
      },
      {
        "grupo": "Postres",
        "nombre": "Knafeh de queso",
        "descripcion": "Queso fundido bajo cabello de ángel crocante, almíbar y pistacho molido.",
        "precio": 4500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Arak con hielo",
        "descripcion": "Anís libanés servido con agua fría y hielo, se pone blanco en la mesa.",
        "precio": 4200
      }
    ]
  },
  {
    "categoria": "mediterranea",
    "nombre": "Shawarmería Trompo y Pita",
    "slug": "shawarmeria-trompo-y-pita",
    "descripcion": "Shawarma de pollo y res cortado del trompo al pedido, falafel frito por tandas y pan pita del horno propio. Se pide en la ventanilla y hay tres mesas en la acera.",
    "provincia": "Alajuela",
    "canton": "Alajuela",
    "direccion_exacta": "125 m norte del Parque Central de Alajuela, contiguo a la ferretería; ventanilla verde.",
    "precio_desde": 3500,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Pitas",
        "nombre": "Pita de shawarma de pollo",
        "descripcion": "Pollo del trompo con ajo toum, encurtidos y papas fritas adentro del pan.",
        "precio": 3900
      },
      {
        "grupo": "Pitas",
        "nombre": "Pita de shawarma de res",
        "descripcion": "Res marinada con tahini, tomate, cebolla morada y sumac.",
        "precio": 4300
      },
      {
        "grupo": "Pitas",
        "nombre": "Pita de falafel",
        "descripcion": "Seis bolas de garbanzo recién fritas con tahini, tomate y perejil.",
        "precio": 3500
      },
      {
        "grupo": "Platos",
        "nombre": "Plato mixto",
        "descripcion": "Pollo y res del trompo con arroz con fideo, ensalada fatush y salsa de ajo.",
        "precio": 6500
      },
      {
        "grupo": "Mezze",
        "nombre": "Hummus con pan pita",
        "descripcion": "Puré de garbanzo con tahini y aceite de oliva, con dos pitas calientes.",
        "precio": 3000
      },
      {
        "grupo": "Mezze",
        "nombre": "Tabule",
        "descripcion": "Perejil picado fino con trigo bulgur, tomate, limón y aceite de oliva.",
        "precio": 2600
      },
      {
        "grupo": "Mezze",
        "nombre": "Kibbe frito (3)",
        "descripcion": "Tres kibbes de trigo y carne con piñón, fritos al momento.",
        "precio": 3200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Limonada con hierbabuena",
        "descripcion": "Limón mandarina licuado con hierbabuena y hielo.",
        "precio": 1400
      },
      {
        "grupo": "Postres",
        "nombre": "Baklava de pistacho (2)",
        "descripcion": "Dos piezas de hojaldre con pistacho y almíbar de agua de azahar.",
        "precio": 1900
      }
    ]
  },
  {
    "categoria": "vegetariana",
    "nombre": "Soda La Mata Verde",
    "slug": "soda-la-mata-verde",
    "descripcion": "Soda de barrio con casados sin carne: picadillo de arracache, tortas de garbanzo y sopa negra con huevo. El fresco del día se hace con la fruta que llegó en la mañana.",
    "provincia": "San José",
    "canton": "Pérez Zeledón",
    "direccion_exacta": "300 m sur de la iglesia de San Isidro de El General, contiguo al taller de bicicletas.",
    "precio_desde": 4200,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Casados",
        "nombre": "Casado de picadillo de arracache",
        "descripcion": "Arroz, frijoles molidos, picadillo con culantro coyote, maduro frito y ensalada de repollo.",
        "precio": 4200
      },
      {
        "grupo": "Casados",
        "nombre": "Casado de torta de garbanzo",
        "descripcion": "Dos tortas de garbanzo con ajo, arroz, frijoles, plátano y ensalada de tomate.",
        "precio": 4600
      },
      {
        "grupo": "Bocas",
        "nombre": "Frijol tierno con hongos",
        "descripcion": "Frijoles tiernos en su caldo, arroz, hongos ostra dorados, pico de gallo y chicharrones de yuca.",
        "precio": 3800
      },
      {
        "grupo": "Bocas",
        "nombre": "Gallo de picadillo de papa",
        "descripcion": "Tortilla palmeada con picadillo de papa y queso tierno rallado encima.",
        "precio": 1400
      },
      {
        "grupo": "Sopas",
        "nombre": "Sopa negra con huevo",
        "descripcion": "Caldo de frijol con huevo escalfado, cebolla morada y tortilla recién hecha.",
        "precio": 3000
      },
      {
        "grupo": "Bebidas",
        "nombre": "Fresco de cas en leche",
        "descripcion": "Cas de la zona licuado con leche fría, sin azúcar añadida si lo pedís así.",
        "precio": 1300
      },
      {
        "grupo": "Bebidas",
        "nombre": "Horchata de arroz con canela",
        "descripcion": "Preparada de madrugada y servida en vaso de vidrio de medio litro.",
        "precio": 1200
      },
      {
        "grupo": "Postres",
        "nombre": "Arroz con leche",
        "descripcion": "Con clavo de olor, canela y ralladura de limón dulce.",
        "precio": 1200
      }
    ]
  },
  {
    "categoria": "vegetariana",
    "nombre": "Verdolaga Cocina Vegetal",
    "slug": "verdolaga-cocina-vegetal",
    "descripcion": "Cocina vegetal al fuego: berenjena al rescoldo con miso de frijol, ravioles de ayote sazón y ceviche de palmito. Menú corto que cambia cada semana según lo que traen las fincas.",
    "provincia": "Heredia",
    "canton": "San Rafael",
    "direccion_exacta": "200 m norte y 50 m este de la iglesia de San Rafael de Heredia, casa esquinera de dos pisos.",
    "precio_desde": 11800,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Ceviche de palmito y coco",
        "descripcion": "Palmito curtido en limón mandarina, leche de coco y chile panameño.",
        "precio": 6800
      },
      {
        "grupo": "Entradas",
        "nombre": "Pejibaye asado",
        "descripcion": "Pejibaye a las brasas con crema de marañón fermentado y aceite de culantro.",
        "precio": 7200
      },
      {
        "grupo": "Entradas",
        "nombre": "Yuca a la leña",
        "descripcion": "Yuca cocida y quemada al fuego, con chimichurri de culantro coyote y limón criollo.",
        "precio": 6500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Berenjena entera al rescoldo",
        "descripcion": "Enterrada en brasa, con miso de frijol negro de la casa y ajonjolí tostado.",
        "precio": 12500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Ravioles de ayote sazón",
        "descripcion": "Pasta fresca rellena de ayote asado, mantequilla de cacao y salvia del huerto.",
        "precio": 13500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Arroz de hongos y chicasquil",
        "descripcion": "Arroz cremoso con hongos de Fraijanes, hojas de chicasquil y queso de marañón.",
        "precio": 11800
      },
      {
        "grupo": "Postres",
        "nombre": "Tarta de tamarindo",
        "descripcion": "Base de maíz tostado, crema de tamarindo y merengue de aquafaba quemado.",
        "precio": 5500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Kombucha de guanábana",
        "descripcion": "Fermentada en casa por ocho días, servida en copa con hierbabuena.",
        "precio": 3200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Vino natural por copa",
        "descripcion": "Tres etiquetas que rotan cada mes, servidas en copa de 150 ml.",
        "precio": 6500
      }
    ]
  },
  {
    "categoria": "cafeteria",
    "nombre": "Café Manta y Comal",
    "slug": "cafe-manta-y-comal",
    "descripcion": "Café de pueblo con chorreador a la vista: gallo pinto con natilla, empanadas de queso Turrialba salidas del comal y grano de Orosi tostado ahí mismo. Abren a las 5 a. m. para los que van a la finca.",
    "provincia": "Cartago",
    "canton": "Paraíso",
    "direccion_exacta": "150 m oeste del parque de Paraíso, frente al salón comunal.",
    "precio_desde": 2600,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Desayunos",
        "nombre": "Gallo pinto con huevo y natilla",
        "descripcion": "Pinto del día con huevo al gusto, natilla espesa y tortilla palmeada.",
        "precio": 3300
      },
      {
        "grupo": "Desayunos",
        "nombre": "Desayuno del chorreador",
        "descripcion": "Pinto, huevo, queso Turrialba, maduro y taza de café chorreado sin límite.",
        "precio": 4800
      },
      {
        "grupo": "Desayunos",
        "nombre": "Tostadas de pan casero",
        "descripcion": "Pan del día con natilla y mermelada de mora de Llano Grande.",
        "precio": 2600
      },
      {
        "grupo": "Panadería",
        "nombre": "Empanada de queso Turrialba",
        "descripcion": "Masa de maíz rellena de queso fresco, sale del comal cada media hora.",
        "precio": 1100
      },
      {
        "grupo": "Panadería",
        "nombre": "Bizcocho de maíz",
        "descripcion": "Crujiente, con queso seco y un toque de tapa de dulce; se vende por unidad.",
        "precio": 800
      },
      {
        "grupo": "Café",
        "nombre": "Café chorreado",
        "descripcion": "Grano de Orosi tostado en la casa, colado en manta frente a vos.",
        "precio": 1000
      },
      {
        "grupo": "Café",
        "nombre": "Capuchino de Orosi",
        "descripcion": "Doble espresso con leche vaporizada de una lechería de Cot.",
        "precio": 1900
      },
      {
        "grupo": "Postres",
        "nombre": "Tres leches",
        "descripcion": "Queque esponjoso empapado la noche anterior, con canela encima.",
        "precio": 2000
      }
    ]
  },
  {
    "categoria": "cafeteria",
    "nombre": "Terraza Catimor",
    "slug": "terraza-catimor",
    "descripcion": "Brunch en zona cafetalera: benedictinos de plátano maduro, panqueques de maíz con miel de higo y filtrados V60 del lote propio. La terraza da al cafetal.",
    "provincia": "Alajuela",
    "canton": "Naranjo",
    "direccion_exacta": "1 km norte de la iglesia de Naranjo, camino a San Juan, entrada del beneficio a mano izquierda.",
    "precio_desde": 6500,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Brunch",
        "nombre": "Benedictinos de maduro",
        "descripcion": "Huevos pochados sobre plátano maduro y masa madre, con holandesa de achiote.",
        "precio": 8200
      },
      {
        "grupo": "Brunch",
        "nombre": "Tostada de aguacate y huevo",
        "descripcion": "Masa madre, aguacate, huevo pochado, semillas tostadas y chile panameño encurtido.",
        "precio": 7200
      },
      {
        "grupo": "Brunch",
        "nombre": "Panqueques de maíz",
        "descripcion": "Tres panqueques de maíz criollo con miel de higo y natilla batida.",
        "precio": 6500
      },
      {
        "grupo": "Brunch",
        "nombre": "Revueltos de queso de Zarcero",
        "descripcion": "Huevos cremosos con queso semimaduro de una lechería de Zarcero, cebollín y papas al romero.",
        "precio": 6800
      },
      {
        "grupo": "Café de origen",
        "nombre": "Filtrado V60 del lote propio",
        "descripcion": "Catimor lavado del cafetal de atrás, con notas de mandarina y panela.",
        "precio": 2900
      },
      {
        "grupo": "Café de origen",
        "nombre": "Espresso tónico con naranja",
        "descripcion": "Espresso sobre agua tónica, hielo y cáscara de naranja de la zona.",
        "precio": 3400
      },
      {
        "grupo": "Café de origen",
        "nombre": "Cortado",
        "descripcion": "Espresso con leche de la lechería vecina, servido en vaso de vidrio.",
        "precio": 1900
      },
      {
        "grupo": "Dulces",
        "nombre": "Queque de banano con streusel",
        "descripcion": "Horneado en la mañana, con costra de azúcar morena y nuez.",
        "precio": 2600
      },
      {
        "grupo": "Dulces",
        "nombre": "Rollo de canela con cardamomo",
        "descripcion": "Masa de brioche y glaseado de queso crema; sale del horno a las 9 a. m.",
        "precio": 3100
      }
    ]
  },
  {
    "categoria": "postres",
    "nombre": "Dulce Cocotero",
    "slug": "dulce-cocotero",
    "descripcion": "Repostería caribeña: pan bon fermentado tres días, plantintá de maduro, tres leches de coco y journey cake recién horneado. Hay una sola mesa larga, así que conviene apartar.",
    "provincia": "Limón",
    "canton": "Talamanca",
    "direccion_exacta": "Calle principal de Puerto Viejo de Talamanca, 100 m sur de la plaza de deportes, casa de madera azul con jardín.",
    "precio_desde": 1300,
    "rango_precio": 1,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Panadería caribeña",
        "nombre": "Pan bon (rebanada)",
        "descripcion": "Masa fermentada tres días con especias, fruta confitada y miel de tapa de dulce.",
        "precio": 1800
      },
      {
        "grupo": "Panadería caribeña",
        "nombre": "Pan bon entero",
        "descripcion": "Se aparta con un día de anticipación; alcanza para ocho personas.",
        "precio": 8000
      },
      {
        "grupo": "Panadería caribeña",
        "nombre": "Plantintá",
        "descripcion": "Empanada horneada de plátano maduro con canela y un toque de jengibre.",
        "precio": 1600
      },
      {
        "grupo": "Panadería caribeña",
        "nombre": "Journey cake",
        "descripcion": "Pan de coco recién salido del horno, con mantequilla de maní de la casa.",
        "precio": 1300
      },
      {
        "grupo": "Postres",
        "nombre": "Tres leches de coco",
        "descripcion": "Bizcocho empapado en leche de coco fresca, con ralladura tostada encima.",
        "precio": 3500
      },
      {
        "grupo": "Postres",
        "nombre": "Torta de coco y jengibre",
        "descripcion": "Húmeda, con jengibre rallado y melaza; se sirve tibia.",
        "precio": 3000
      },
      {
        "grupo": "Postres",
        "nombre": "Flan de coco quemado",
        "descripcion": "Caramelo oscuro y textura firme, cuajado en molde de aluminio y cortado por porción.",
        "precio": 3000
      },
      {
        "grupo": "Bebidas",
        "nombre": "Agua de sapo",
        "descripcion": "Jengibre rallado, tapa de dulce y limón mandarina, servida bien fría.",
        "precio": 1400
      },
      {
        "grupo": "Bebidas",
        "nombre": "Café con leche de coco",
        "descripcion": "Café de Talamanca colado y leche de coco natural.",
        "precio": 2000
      }
    ]
  },
  {
    "categoria": "postres",
    "nombre": "Heladería Nance y Canela",
    "slug": "heladeria-nance-y-canela",
    "descripcion": "Sorbete de leche batido a la antigua, copos con leche condensada y kola, y paletas de nance. Si avisás un día antes, te empacan el litro para llevar a la casa.",
    "provincia": "Guanacaste",
    "canton": "Nicoya",
    "direccion_exacta": "75 m este de la esquina noreste del parque central de Nicoya, local esquinero de toldo amarillo.",
    "precio_desde": 1800,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Sorbetes",
        "nombre": "Sorbete de leche (dos bolas)",
        "descripcion": "Receta batida a la antigua con leche de la zona y un toque de canela.",
        "precio": 2800
      },
      {
        "grupo": "Sorbetes",
        "nombre": "Sorbete de guanábana",
        "descripcion": "Fruta de temporada colada a mano: solo pulpa, leche y azúcar.",
        "precio": 2800
      },
      {
        "grupo": "Sorbetes",
        "nombre": "Cono de barquillo sencillo",
        "descripcion": "Una bola del sabor del día en barquillo hecho en la casa.",
        "precio": 1800
      },
      {
        "grupo": "Copos y granizados",
        "nombre": "Copo tradicional",
        "descripcion": "Hielo raspado con leche en polvo, leche condensada y sirope de kola.",
        "precio": 1500
      },
      {
        "grupo": "Copos y granizados",
        "nombre": "Granizado de tamarindo",
        "descripcion": "Hielo con pulpa de tamarindo, un poco de sal y limón.",
        "precio": 1600
      },
      {
        "grupo": "Para llevar",
        "nombre": "Litro de sorbete",
        "descripcion": "Cualquier sabor de la vitrina, empacado en frío; conviene avisar un día antes.",
        "precio": 5200
      },
      {
        "grupo": "Para llevar",
        "nombre": "Paleta de nance",
        "descripcion": "Congelada con la fruta entera; también hay de mango verde con chile.",
        "precio": 1200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Batido de cas en agua",
        "descripcion": "Cas maduro, agua helada y azúcar al gusto.",
        "precio": 1800
      }
    ]
  },
  {
    "categoria": "bar",
    "nombre": "Bar y Bocas El Marañal",
    "slug": "bar-y-bocas-el-maranal",
    "descripcion": "Bocas de toda la vida frente a la plaza: ceviche de marlín, chicharrón con yuca y cerveza de barril bien fría. Mesas de madera bajo los marañones del patio y el partido en la tele.",
    "provincia": "Puntarenas",
    "canton": "Esparza",
    "direccion_exacta": "300 m sur de la escuela de Macacona, contiguo a la plaza de deportes, Esparza",
    "precio_desde": 5000,
    "rango_precio": 1,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Bocas",
        "nombre": "Ceviche de marlín",
        "descripcion": "Marlín curado en limón con cebolla morada, culantro y galletas soda.",
        "precio": 3500
      },
      {
        "grupo": "Bocas",
        "nombre": "Chicharrón con yuca",
        "descripcion": "Costilla de cerdo frita con yuca cocida, chimichurri de culantro coyote y limón.",
        "precio": 4200
      },
      {
        "grupo": "Bocas",
        "nombre": "Patacones con frijoles molidos",
        "descripcion": "Plátano verde aplastado y frito, frijoles molidos y natilla de la casa.",
        "precio": 3000
      },
      {
        "grupo": "Bocas",
        "nombre": "Vigorón esparzano",
        "descripcion": "Yuca, chicharrón y curtido de repollo con chile panameño picado.",
        "precio": 3800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Casado de pescado",
        "descripcion": "Filete de tilapia frito con arroz, frijoles, picadillo de chayote y ensalada.",
        "precio": 5000
      },
      {
        "grupo": "Fuertes",
        "nombre": "Arroz con camarones",
        "descripcion": "Arroz salteado con camarón, chile dulce, culantro y un toque de mantequilla.",
        "precio": 6500
      },
      {
        "grupo": "Bebidas",
        "nombre": "Cerveza de barril",
        "descripcion": "Vaso de 12 onzas de cerveza nacional, servida del barril.",
        "precio": 1600
      },
      {
        "grupo": "Bebidas",
        "nombre": "Fresco de cas",
        "descripcion": "Cas natural en agua, poca azúcar, jarra de un litro.",
        "precio": 2200
      }
    ]
  },
  {
    "categoria": "bar",
    "nombre": "Cervecería Ocho Tanques",
    "slug": "cerveceria-ocho-tanques",
    "descripcion": "Cervecería de montaña con ocho tanques a la vista: IPA lupulada en frío, stout con café de la zona de Barva y una parrilla de leña para salchichas y costilla.",
    "provincia": "Heredia",
    "canton": "San Rafael",
    "direccion_exacta": "600 m norte de la iglesia de San Rafael de Heredia, camino a Monte de la Cruz, casa de madera a mano derecha",
    "precio_desde": 11500,
    "rango_precio": 2,
    "acepta_reserva_mesa": true,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Cervezas",
        "nombre": "IPA Ocho Tanques",
        "descripcion": "Amarga y cítrica, lupulada en frío. Pinta de 16 onzas.",
        "precio": 3200
      },
      {
        "grupo": "Cervezas",
        "nombre": "Stout de café de Barva",
        "descripcion": "Negra y sedosa, con café tostado de la zona. Media pinta.",
        "precio": 3000
      },
      {
        "grupo": "Cervezas",
        "nombre": "Tabla de cuatro cervezas",
        "descripcion": "Cuatro vasos de 5 onzas para probar lo que haya en tanque ese día.",
        "precio": 4800
      },
      {
        "grupo": "Para picar",
        "nombre": "Salchicha ahumada de la casa",
        "descripcion": "Cerdo ahumado con madera de café, pan de masa madre y mostaza de miel.",
        "precio": 5500
      },
      {
        "grupo": "Para picar",
        "nombre": "Papas con chorizo y queso Turrialba",
        "descripcion": "Papas rústicas, chorizo criollo y queso Turrialba derretido encima.",
        "precio": 5900
      },
      {
        "grupo": "Fuertes",
        "nombre": "Costilla de cerdo a la leña",
        "descripcion": "Cuatro horas de cocción lenta, glaseada con la stout de la casa.",
        "precio": 9800
      },
      {
        "grupo": "Fuertes",
        "nombre": "Hamburguesa de la casa",
        "descripcion": "Carne molida en el día, cebolla caramelizada en cerveza y queso maduro.",
        "precio": 8500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Trucha a la parrilla",
        "descripcion": "Trucha de la zona con mantequilla de ajo y limón mandarina, con puré de yuca.",
        "precio": 10500
      },
      {
        "grupo": "Postres",
        "nombre": "Brownie con stout",
        "descripcion": "Brownie tibio, helado de vainilla y reducción de la stout.",
        "precio": 3600
      }
    ]
  },
  {
    "categoria": "fusion",
    "nombre": "Fogón de Rescoldo",
    "slug": "fogon-de-rescoldo",
    "descripcion": "Cocina de autor guanacasteca sobre fuego de leña: menú corto que cambia con lo que da la huerta y lo que llega del mar de Sámara. Veinticuatro asientos alrededor del fogón.",
    "provincia": "Guanacaste",
    "canton": "Nicoya",
    "direccion_exacta": "1 km norte de la entrada a Curime, sobre el camino de lastre, portón de madera a mano derecha",
    "precio_desde": 26000,
    "rango_precio": 3,
    "acepta_reserva_mesa": true,
    "acepta_pickup": false,
    "menu": [
      {
        "grupo": "Entradas",
        "nombre": "Tiradito de pargo",
        "descripcion": "Pargo del día con leche de tigre de mango verde y aceite de culantro coyote.",
        "precio": 8500
      },
      {
        "grupo": "Entradas",
        "nombre": "Maíz pujagua en tres texturas",
        "descripcion": "Tortilla soplada, espuma de pujagua y crema agria de leche de cabra.",
        "precio": 7900
      },
      {
        "grupo": "Entradas",
        "nombre": "Corazón de palmito a la brasa",
        "descripcion": "Palmito asado sobre leña con mantequilla de achiote y marañón tostado.",
        "precio": 8200
      },
      {
        "grupo": "Fuertes",
        "nombre": "Cerdo criollo al rescoldo",
        "descripcion": "Doce horas enterrado en brasa, puré de camote y jugo de tapa de dulce.",
        "precio": 19500
      },
      {
        "grupo": "Fuertes",
        "nombre": "Pescado entero al fogón",
        "descripcion": "Del mar de Sámara, en hoja de plátano, con chile congo y limón mandarina.",
        "precio": 21000
      },
      {
        "grupo": "Fuertes",
        "nombre": "Arroz de rabo con ayote sazón",
        "descripcion": "Arroz cremoso con rabo deshebrado, ayote sazón y queso seco rallado.",
        "precio": 17800
      },
      {
        "grupo": "Postres",
        "nombre": "Helado de leche agria",
        "descripcion": "Leche agria de la zona, miel de tapa de dulce y cacao tostado.",
        "precio": 6200
      },
      {
        "grupo": "Postres",
        "nombre": "Sorbete de guanábana y albahaca",
        "descripcion": "Guanábana de la finca, albahaca del jardín y aceite de oliva.",
        "precio": 5800
      },
      {
        "grupo": "Bebidas",
        "nombre": "Maridaje sin alcohol",
        "descripcion": "Cuatro fermentos y frescos de la casa, uno por tiempo del menú.",
        "precio": 12000
      }
    ]
  },
  {
    "categoria": "fusion",
    "nombre": "Wok y Comal",
    "slug": "wok-y-comal",
    "descripcion": "Wok tico-asiático en un local de barra y ocho mesas: gallo pinto salteado con kimchi, tacos de panza al chile panameño y bowls para comer ahí o para llevar.",
    "provincia": "San José",
    "canton": "Curridabat",
    "direccion_exacta": "150 m este del parque de Curridabat, plaza comercial de la esquina, local 4",
    "precio_desde": 8500,
    "rango_precio": 2,
    "acepta_reserva_mesa": false,
    "acepta_pickup": true,
    "menu": [
      {
        "grupo": "Para empezar",
        "nombre": "Chicharrones con tamarindo",
        "descripcion": "Cerdo crujiente bañado en tamarindo agridulce con ajonjolí tostado.",
        "precio": 3900
      },
      {
        "grupo": "Para empezar",
        "nombre": "Gyozas de picadillo de arracache",
        "descripcion": "Ocho unidades selladas en plancha, con salsa de chile dulce fermentado.",
        "precio": 4600
      },
      {
        "grupo": "Bowls",
        "nombre": "Pinto salteado con kimchi",
        "descripcion": "Gallo pinto al wok con kimchi de repollo, huevo frito y cebollín.",
        "precio": 6900
      },
      {
        "grupo": "Bowls",
        "nombre": "Bowl de cerdo desmenuzado",
        "descripcion": "Cerdo cocido en soya y tapa de dulce, arroz jazmín y encurtido de chayote.",
        "precio": 8900
      },
      {
        "grupo": "Bowls",
        "nombre": "Bowl de camarón al curry de coco",
        "descripcion": "Camarón en leche de coco con culantro coyote, arroz y limón.",
        "precio": 9800
      },
      {
        "grupo": "Tacos",
        "nombre": "Tacos de panza de cerdo",
        "descripcion": "Tres tacos con panza glaseada al chile panameño y curtido de mango verde.",
        "precio": 7800
      },
      {
        "grupo": "Tacos",
        "nombre": "Tacos de pescado en tempura",
        "descripcion": "Tilapia crocante, mayonesa de achiote y repollo morado.",
        "precio": 7200
      },
      {
        "grupo": "Bebidas",
        "nombre": "Limonada con hierbabuena y jengibre",
        "descripcion": "Vaso grande, sin azúcar añadida.",
        "precio": 1900
      },
      {
        "grupo": "Bebidas",
        "nombre": "Té frío de flor de jamaica",
        "descripcion": "Jamaica cocida en casa con cáscara de naranja.",
        "precio": 1700
      }
    ]
  }
];
