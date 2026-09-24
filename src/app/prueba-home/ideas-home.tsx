import type { ReactNode } from "react";
import {
  Barra,
  Caja,
  L,
  Lienzo,
  Tel,
  TituloCentrado,
  TituloIzquierda,
} from "./piezas-wire";

/**
 * ════════════════════════════════════════════════════════════════════
 *  VEINTE FORMAS DE ARMAR EL HOME
 * ════════════════════════════════════════════════════════════════════
 *
 * No son veinte variaciones de lo mismo: cada una resuelve de distinta
 * manera las cuatro preguntas que definen un home de producto.
 *
 *   1. ¿Qué ve la persona ANTES de bajar? ¿El titular, el producto, el
 *      precio, o un negocio parecido al suyo?
 *   2. ¿Los cuatro productos pesan IGUAL o hay uno que manda?
 *   3. ¿El producto se enseña con un teléfono, con una pantalla de
 *      escritorio, con una foto, o no se enseña?
 *   4. ¿Cuánto scroll pide? Una pantalla, tres, o siete.
 *
 * Cada ficha dice qué GANA y qué PIERDE, porque no hay una mejor: hay
 * una que encaja con lo que Bookea necesita hoy. Y hoy Bookea necesita
 * que un dueño de negocio entienda en diez segundos que son CUATRO
 * cosas y que puede activar solo la que le sirve.
 *
 * ⚠️ Página desechable. Cuando se elija, se construye esa a tamaño
 * real y se borra `src/app/prueba-home/` entero.
 */

export type IdeaHome = {
  n: string;
  nombre: string;
  idea: string;
  gana: string;
  pierde: string;
  wire: ReactNode;
};

/** Cuatro teléfonos en fila, con su pie. */
function FilaTelefonos({ acento = -1 }: { acento?: number }) {
  return (
    <div className="flex justify-between gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <Tel h={52} w={26} acento={i === acento} />
          <L w="80%" h={4} fuerte />
          <L w="60%" h={3} />
        </div>
      ))}
    </div>
  );
}

export const IDEAS: IdeaHome[] = [
  {
    n: "01",
    nombre: "Centrado clásico",
    idea: "Lo que hay hoy: titular al medio, cuatro teléfonos iguales debajo.",
    gana: "Ordenado, simétrico, fácil de mantener.",
    pierde: "Los cuatro pesan igual, así que nada destaca. Cuatro siluetas idénticas se leen como «cuatro teléfonos», no como cuatro productos.",
    wire: (
      <Lienzo>
        <Barra />
        <TituloCentrado />
        <div className="mt-3">
          <FilaTelefonos />
        </div>
      </Lienzo>
    ),
  },
  {
    n: "02",
    nombre: "Bento asimétrico",
    idea: "Cuatro cajas de distinto tamaño: una alta, una ancha, dos chicas.",
    gana: "Jerarquía real: el producto más terminado se lleva el espacio grande. Se ve diseñado.",
    pierde: "Hay que decidir cuál manda, y eso es una decisión de negocio, no de diseño.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2.5 flex flex-col items-center gap-1">
          <L w="52%" h={8} fuerte />
          <L w="38%" h={4} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Caja h={104} acento className="row-span-2" />
          <Caja h={48} className="col-span-2" />
          <Caja h={48} />
          <Caja h={48} />
        </div>
      </Lienzo>
    ),
  },
  {
    n: "03",
    nombre: "Partido en dos",
    idea: "Texto a la izquierda, un solo mockup grande a la derecha.",
    gana: "El patrón más probado del SaaS. El titular respira y el producto se ve grande de una.",
    pierde: "Solo cabe UN producto arriba; los otros tres quedan abajo del fold.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="grid grid-cols-2 items-center gap-3">
          <TituloIzquierda />
          <div className="flex justify-center">
            <Tel h={112} w={56} acento />
          </div>
        </div>
      </Lienzo>
    ),
  },
  {
    n: "04",
    nombre: "Uno manda, tres acompañan",
    idea: "Un producto ocupa el ancho completo; los otros tres van chicos abajo.",
    gana: "Comunica una prioridad clarísima. Ideal si hay un producto gancho.",
    pierde: "Los tres de abajo se leen como secundarios aunque no lo sean.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="56%" h={8} fuerte />
        </div>
        <Caja h={70} acento className="mb-1.5" />
        <div className="grid grid-cols-3 gap-1.5">
          <Caja h={36} />
          <Caja h={36} />
          <Caja h={36} />
        </div>
      </Lienzo>
    ),
  },
  {
    n: "05",
    nombre: "Conmutador de pestañas",
    idea: "Una sola pantalla grande y cuatro pestañas que la cambian.",
    gana: "El producto se ve cuatro veces más grande. Poco scroll.",
    pierde: "Solo se ve lo que la persona toca, y en un home casi nadie toca. Necesita JavaScript.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="50%" h={8} fuerte />
        </div>
        <div className="mb-2 flex justify-center gap-1">
          <L w="26px" h={9} fuerte />
          <L w="26px" h={9} />
          <L w="26px" h={9} />
          <L w="26px" h={9} />
        </div>
        <Caja h={86} acento />
      </Lienzo>
    ),
  },
  {
    n: "06",
    nombre: "Filas alternadas",
    idea: "Cada producto se lleva una banda entera, cambiando de lado.",
    gana: "Es lo que más deja explicar. Cada producto tiene su momento.",
    pierde: "Scroll largo — justo lo que pediste sacar. El cuarto producto casi nadie lo ve.",
    wire: (
      <Lienzo>
        <Barra />
        {[0, 1].map((i) => (
          <div key={i} className="mb-2 grid grid-cols-2 items-center gap-3">
            {i === 0 ? (
              <>
                <Caja h={44} acento={i === 0} />
                <div className="flex flex-col gap-1">
                  <L w="80%" h={6} fuerte />
                  <L w="100%" h={4} />
                  <L w="60%" h={4} />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <L w="80%" h={6} fuerte />
                  <L w="100%" h={4} />
                  <L w="60%" h={4} />
                </div>
                <Caja h={44} />
              </>
            )}
          </div>
        ))}
        <div className="flex justify-center">
          <L w="30%" h={4} />
        </div>
      </Lienzo>
    ),
  },
  {
    n: "07",
    nombre: "Collage de pantallas",
    idea: "Muchas pantallas superpuestas en abanico, como Linear o Framer.",
    gana: "Da sensación de producto grande y maduro. Muy fotogénico.",
    pierde: "No se lee NADA de lo que hay adentro. Vende ambiente, no funciones.",
    wire: (
      <Lienzo>
        <Barra />
        <TituloCentrado boton={false} />
        <div className="relative mt-2 h-[78px]">
          <Caja h={62} className="absolute left-[4%] top-3 w-[30%] -rotate-6" />
          <Caja h={70} className="absolute left-[26%] top-1 w-[34%] rotate-2" acento />
          <Caja h={58} className="absolute right-[6%] top-4 w-[30%] rotate-6" />
        </div>
      </Lienzo>
    ),
  },
  {
    n: "08",
    nombre: "Pantalla de escritorio",
    idea: "Un mockup de navegador grande en vez de teléfonos.",
    gana: "Dice «esto es una herramienta de trabajo», no una app de consumo. El panel se ve legible.",
    pierde: "Tus clientes atienden desde el teléfono. Un monitor puede sonar a algo que no es para ellos.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="54%" h={8} fuerte />
          <L w="40%" h={4} />
        </div>
        <div className="rounded-[5px] border border-[color:var(--tinta-tenue)] bg-white p-1">
          <div className="mb-1 flex gap-[3px]">
            <span className="h-[4px] w-[4px] rounded-full bg-[color:var(--tinta-tenue)]" />
            <span className="h-[4px] w-[4px] rounded-full bg-[color:var(--tinta-tenue)]" />
            <span className="h-[4px] w-[4px] rounded-full bg-[color:var(--tinta-tenue)]" />
          </div>
          <div className="flex gap-1">
            <Caja h={62} className="w-[22%]" />
            <Caja h={62} className="flex-1" acento />
          </div>
        </div>
      </Lienzo>
    ),
  },
  {
    n: "09",
    nombre: "Carrusel automático",
    idea: "Un solo marco donde los cuatro productos rotan solos.",
    gana: "Ocupa lo mismo que uno y enseña cuatro. Movimiento que atrae el ojo.",
    pierde: "La persona no controla el ritmo; si se distrae, se perdió el suyo.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="50%" h={8} fuerte />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 shrink-0 rounded-full border border-[color:var(--tinta-tenue)]" />
          <Caja h={80} acento className="flex-1" />
          <span className="h-4 w-4 shrink-0 rounded-full border border-[color:var(--tinta-tenue)]" />
        </div>
        <div className="mt-1.5 flex justify-center gap-1">
          <span className="h-[4px] w-[10px] rounded-full bg-[color:var(--tinta)]" />
          <span className="h-[4px] w-[4px] rounded-full bg-[color:var(--tinta-tenue)]" />
          <span className="h-[4px] w-[4px] rounded-full bg-[color:var(--tinta-tenue)]" />
          <span className="h-[4px] w-[4px] rounded-full bg-[color:var(--tinta-tenue)]" />
        </div>
      </Lienzo>
    ),
  },
  {
    n: "10",
    nombre: "Índice editorial",
    idea: "Los cuatro productos como una lista numerada 01–04, pura tipografía.",
    gana: "Elegante, rapidísimo de leer, carga en nada. Se entiende que son cuatro cosas.",
    pierde: "No se ve el producto. Hay que confiar en la palabra.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2.5">
          <L w="70%" h={9} fuerte />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-t border-[color:var(--linea)] py-[7px]"
          >
            <L w="12px" h={4} />
            <L w={i === 0 ? "46%" : "38%"} h={7} fuerte />
            <div className="flex-1" />
            <L w="10px" h={4} />
          </div>
        ))}
      </Lienzo>
    ),
  },
  {
    n: "11",
    nombre: "La demo es la portada",
    idea: "Titular chico y, debajo, una demostración corriendo sola a lo grande.",
    gana: "Enseña el producto FUNCIONANDO, no una foto. Es la prueba más fuerte que hay.",
    pierde: "Solo se puede enseñar una cosa a la vez. Y si la animación tarda, la promesa tarda.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="44%" h={7} fuerte />
        </div>
        <Caja h={104} acento>
          <div className="flex h-full flex-col justify-center gap-1.5 p-2">
            <L w="55%" h={8} />
            <L w="72%" h={8} />
            <div className="ml-auto">
              <L w="50%" h={8} />
            </div>
          </div>
        </Caja>
      </Lienzo>
    ),
  },
  {
    n: "12",
    nombre: "El precio de titular",
    idea: "«Gratis» como el texto más grande de la página; los productos, como lista.",
    gana: "Ataca la objeción número uno de un negocio chico antes de que la piense.",
    pierde: "Te encasilla en el precio. Cuando cobres, hay que rehacer la portada.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="flex flex-col items-center gap-1.5">
          <L w="46%" h={16} fuerte />
          <L w="60%" h={5} />
          <div className="mt-1.5 grid w-full grid-cols-2 gap-1.5">
            <Caja h={22} />
            <Caja h={22} />
            <Caja h={22} />
            <Caja h={22} />
          </div>
          <div className="mt-1.5">
            <L w="44px" h={11} fuerte />
          </div>
        </div>
      </Lienzo>
    ),
  },
  {
    n: "13",
    nombre: "«¿Qué negocio tenés?»",
    idea: "Una fila de rubros arriba; al elegir uno, el home se arma para ese rubro.",
    gana: "Cada visitante se ve a sí mismo. Es lo que más convierte en un marketplace de rubros.",
    pierde: "Hay que escribir contenido por rubro, o se nota vacío. Multiplica el trabajo.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="52%" h={8} fuerte />
        </div>
        <div className="mb-2 flex flex-wrap justify-center gap-1">
          <L w="30px" h={9} fuerte />
          <L w="26px" h={9} />
          <L w="34px" h={9} />
          <L w="24px" h={9} />
          <L w="30px" h={9} />
        </div>
        <div className="flex gap-1.5">
          <Caja h={66} className="flex-1" acento />
          <div className="flex flex-1 flex-col justify-center gap-1">
            <L w="80%" h={5} fuerte />
            <L w="100%" h={4} />
            <L w="66%" h={4} />
          </div>
        </div>
      </Lienzo>
    ),
  },
  {
    n: "14",
    nombre: "Antes / después",
    idea: "A la izquierda el desorden de hoy; a la derecha, con Bookea.",
    gana: "Cuenta el problema antes de vender la solución. Muy persuasivo.",
    pierde: "Empieza en negativo, y la mitad izquierda es espacio gastado en algo que no vendés.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="56%" h={8} fuerte />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[4px] border border-dashed border-[color:var(--tinta-tenue)] p-1.5">
            <L w="40%" h={4} />
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Caja h={16} className="w-[45%]" />
              <Caja h={16} className="w-[40%]" />
              <Caja h={16} className="w-[38%]" />
              <Caja h={16} className="w-[46%]" />
            </div>
          </div>
          <div className="rounded-[4px] border border-[color:var(--acento)] p-1.5">
            <L w="40%" h={4} />
            <Caja h={40} acento className="mt-1.5" />
          </div>
        </div>
      </Lienzo>
    ),
  },
  {
    n: "15",
    nombre: "Tira que se sale",
    idea: "Los productos en una fila horizontal que se corta en el borde derecho.",
    gana: "El corte invita a arrastrar. En el teléfono es el gesto natural.",
    pierde: "En escritorio, lo que queda fuera de pantalla casi nadie lo busca.",
    wire: (
      <Lienzo>
        <Barra />
        <TituloCentrado boton={false} />
        <div className="-mr-3 mt-2.5 flex gap-1.5 overflow-hidden">
          <Caja h={62} className="w-[30%] shrink-0" acento />
          <Caja h={62} className="w-[30%] shrink-0" />
          <Caja h={62} className="w-[30%] shrink-0" />
          <Caja h={62} className="w-[30%] shrink-0" />
        </div>
      </Lienzo>
    ),
  },
  {
    n: "16",
    nombre: "Teléfono fijo, texto que corre",
    idea: "El mockup se queda pegado mientras el texto de al lado va cambiando al bajar.",
    gana: "Cuenta cuatro cosas sin que el producto se vaya nunca de la pantalla.",
    pierde: "Secuestra el scroll. Si se hace mal, marea — y en teléfono casi siempre se hace mal.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Tel h={128} w={46} acento />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1">
                <L w={i === 0 ? "70%" : "58%"} h={6} fuerte />
                <L w="100%" h={4} />
                {i === 0 ? <L w="76%" h={4} /> : null}
              </div>
            ))}
          </div>
        </div>
      </Lienzo>
    ),
  },
  {
    n: "17",
    nombre: "Fondo oscuro",
    idea: "Toda la portada en carbón, con los mockups iluminados encima.",
    gana: "Los mockups brillan y el conjunto se ve caro. Distinto a todo lo que hay en Costa Rica.",
    pierde: "Choca con el panel, que es blanco. Y el blanco vende mejor a un negocio de barrio.",
    wire: (
      <Lienzo oscuro>
        <Barra claro />
        <TituloCentrado claro />
        <div className="mt-3 flex justify-between gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ height: 50 }}
              className={`flex-1 rounded-[4px] ${
                i === 1 ? "bg-white" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </Lienzo>
    ),
  },
  {
    n: "18",
    nombre: "Cuadrícula de todo",
    idea: "Doce cuadros chicos con ícono y nombre: todo lo que Bookea hace.",
    gana: "Dice «acá está todo» de un golpe. Bueno para quien compara plataformas.",
    pierde: "Doce cosas iguales no se recuerdan. Y contradice la idea de que son CUATRO productos.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="48%" h={7} fuerte />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Caja key={i} h={30} acento={i === 0}>
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <span className="h-[7px] w-[7px] rounded-full bg-[color:var(--tinta-tenue)]" />
                <L w="60%" h={3} />
              </div>
            </Caja>
          ))}
        </div>
      </Lienzo>
    ),
  },
  {
    n: "19",
    nombre: "Todo en una pantalla",
    idea: "Titular, los cuatro productos y el pie caben sin bajar ni una vez.",
    gana: "La promesa entera se entiende sin scroll. Imposible perderse.",
    pierde: "Todo queda chico. No hay lugar para explicar ni para una demo.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="mb-2 flex flex-col items-center gap-1">
          <L w="58%" h={8} fuerte />
          <L w="42%" h={4} />
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          <Caja h={44} acento />
          <Caja h={44} />
          <Caja h={44} />
          <Caja h={44} />
        </div>
        <div className="flex justify-center">
          <L w="40px" h={10} fuerte />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[color:var(--linea)] pt-1.5">
          <L w="18px" h={4} />
          <div className="flex gap-1">
            <L w="12px" h={3} />
            <L w="12px" h={3} />
            <L w="12px" h={3} />
          </div>
        </div>
      </Lienzo>
    ),
  },
  {
    n: "20",
    nombre: "Foto real con el teléfono encima",
    idea: "La foto de un negocio de verdad ocupando todo, y el teléfono flotando encima.",
    gana: "Humano y local. Se ve un negocio como el suyo, no una ilustración.",
    pierde: "Depende de tener fotos buenas de clientes reales. Con foto de banco se nota y resta.",
    wire: (
      <Lienzo>
        <Barra />
        <div className="relative">
          <Caja h={128} oscuro>
            <div className="flex h-full items-end p-2">
              <div className="flex w-1/2 flex-col gap-1">
                <L w="90%" h={8} fuerte claro />
                <L w="60%" h={8} fuerte claro />
                <L w="70%" h={4} claro />
              </div>
            </div>
          </Caja>
          <div className="absolute -bottom-1 right-3">
            <Tel h={96} w={44} acento />
          </div>
        </div>
      </Lienzo>
    ),
  },
];
