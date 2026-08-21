import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina, TarjetaPanel } from "@/components/food/panel";
import {
  BOTON_PANEL_PRIMARIO,
  CUERPO,
  CUERPO_SUAVE,
  RADIO_TILE,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import { IconChevronDown } from "@/components/icons";

export const metadata: Metadata = { title: "Ayuda · FOOD.BOOKEA" };

/**
 * AYUDA — la pantalla de soporte del panel. Es la única del grupo
 * "Información" del rail y existe para dos cosas: responder las dudas
 * que un dueño de restaurante tiene en su primera semana (sin mandarlo
 * a un PDF ni a un chat), y dejar POR ESCRITO cómo se calcula lo
 * económico del panel — la pregunta "¿de dónde sale este número?" se
 * responde acá con la misma honestidad que las notas de estimación de
 * cada pantalla.
 *
 * Server Component puro con <details> nativo para el acordeón:
 * teclado, lector de pantalla y estado abierto/cerrado gratis, sin
 * hidratar nada. Las preguntas linkean a la pantalla donde se hace
 * cada cosa — la ayuda que sirve es la que te deja a un click de
 * resolverlo.
 */

type Pregunta = {
  id: string;
  titulo: string;
  /** Párrafos de la respuesta, en texto plano. */
  respuesta: string[];
  /** Link opcional "hacelo acá" al final de la respuesta. */
  enlace?: { href: string; rotulo: string };
};

const PREGUNTAS: Pregunta[] = [
  {
    id: "reservas",
    titulo: "¿Cómo me llegan las reservas?",
    respuesta: [
      "Un cliente entra a tu página en Food Bookea, elige una franja con lugar disponible y reserva al instante — no hay negociación ni aprobación manual. La reserva aparece de inmediato en tu Dashboard (sección “Hoy”) y en la pantalla de Reservas, y la campana de arriba te avisa de las próximas confirmadas.",
      "Cada reserva trae un código de confirmación que el cliente presenta al llegar.",
    ],
    enlace: { href: "/food/negocio/reservas", rotulo: "Ver mis reservas" },
  },
  {
    id: "franjas",
    titulo: "¿Cómo funcionan las franjas y los descuentos?",
    respuesta: [
      "Vos decidís qué días y a qué horas recibís reservas por Bookea, cuántos espacios hay en cada franja y qué descuento ofrecés en las horas que querés llenar (por ejemplo, −15% entre semana a la hora de la cena). Las franjas con descuento son las que más clientes nuevos atraen.",
      "Podés abrir, cerrar o ajustar franjas cuando quieras; los cambios rigen para las reservas nuevas.",
    ],
    enlace: { href: "/food/negocio/franjas", rotulo: "Administrar mi disponibilidad" },
  },
  {
    id: "check-in",
    titulo: "¿Qué es el check-in y por qué importa?",
    respuesta: [
      "Cuando el cliente llega, marcás su llegada en la pantalla de Check-ins con el código de su reserva. Ese registro es el que separa a quienes reservaron de quienes efectivamente llegaron a la mesa — y es la base de tus métricas: clientes atendidos, tasa de llegada y el consumo estimado que Bookea te atribuye.",
      "Sin check-in, una reserva cumplida cuenta como no presentada. Un minuto en el mostrador mantiene tus números fieles.",
    ],
    enlace: { href: "/food/negocio/check-in", rotulo: "Ir al check-in" },
  },
  {
    id: "ventas-estimadas",
    titulo: "¿De dónde salen las “ventas estimadas”?",
    respuesta: [
      "Bookea no conoce tu facturación real: no somos punto de venta ni tocamos tu caja. Toda cifra en colones del panel es una estimación que se calcula multiplicando las reservas con check-in por el ticket promedio de tu restaurante (cuánto consume una mesa típica).",
      "Por eso cada cifra económica del panel dice “estimado” y lleva la nota al pie. El ticket promedio se define con vos al activar tu restaurante; si cambió, escribinos a hola@bookea.lat y lo ajustamos para que la estimación se mantenga realista.",
    ],
  },
  {
    id: "menu",
    titulo: "¿Para qué subo mi menú si no venden por acá?",
    respuesta: [
      "El menú es tu vitrina: el cliente que está decidiendo dónde reservar quiere ver qué ofrecés y a qué precio antes de comprometerse. Un menú con fotos y precios al día convierte más visitas en reservas — es de lo primero que mira quien no te conoce.",
    ],
    enlace: { href: "/food/negocio/menu", rotulo: "Editar mi menú" },
  },
  {
    id: "apagar",
    titulo: "¿Puedo pausar mi restaurante unos días?",
    respuesta: [
      "Sí. En Configuración podés apagar tu negocio: deja de aparecer al público y no entran reservas nuevas, pero todo tu panel y tu historial quedan intactos. Cuando volvés a prenderlo, todo sigue donde estaba.",
      "Para cerrar solo un día o una franja puntual, es mejor cerrar esa franja en Disponibilidad y dejar el negocio prendido.",
    ],
    enlace: { href: "/food/negocio/configuracion", rotulo: "Ir a Configuración" },
  },
];

export default function AyudaFoodPage() {
  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Ayuda"
        descripcion="Las respuestas a lo que más se pregunta del panel — y cómo escribirnos si algo no aparece acá."
      />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.72fr)_minmax(260px,0.78fr)]">
        <TarjetaPanel kicker="Preguntas frecuentes" titulo="Cómo funciona tu panel">
          <ul className="flex flex-col gap-2">
            {PREGUNTAS.map((p) => (
              <li key={p.id}>
                <details
                  className={`group ${RADIO_TILE} ${SUPERFICIE_HUNDIDA} transition-colors open:bg-aventurea-surface hover:border-aventurea-navy`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[13.5px] font-bold text-aventurea-ink [&::-webkit-details-marker]:hidden">
                    {p.titulo}
                    <IconChevronDown
                      className="h-3.5 w-3.5 shrink-0 text-aventurea-ink-soft transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                    {p.respuesta.map((parrafo, i) => (
                      <p key={i} className={CUERPO}>
                        {parrafo}
                      </p>
                    ))}
                    {p.enlace && (
                      <Link
                        href={p.enlace.href}
                        className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
                      >
                        {p.enlace.rotulo} →
                      </Link>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </TarjetaPanel>

        <div className="flex flex-col gap-3.5">
          <TarjetaPanel kicker="Soporte" titulo="Escribinos">
            <p className={CUERPO}>
              Si algo no funciona o tenés una duda que no está en la lista, escribinos y te
              respondemos el mismo día hábil.
            </p>
            <a
              href="mailto:hola@bookea.lat?subject=Ayuda%20con%20mi%20restaurante%20en%20Food%20Bookea"
              className={`${BOTON_PANEL_PRIMARIO} mt-3.5 w-full`}
            >
              Escribir a hola@bookea.lat
            </a>
            <p className={`${CUERPO_SUAVE} mt-2.5`}>
              Contanos el nombre de tu restaurante y qué estabas haciendo cuando apareció el
              problema — así lo resolvemos más rápido.
            </p>
          </TarjetaPanel>

          <TarjetaPanel kicker="Sugerencias" titulo="¿Le falta algo al panel?">
            <p className={CUERPO}>
              Food Bookea se construye con lo que los restaurantes piden. Si hay una función que te
              haría la vida más fácil, contanos: las más pedidas son las primeras en llegar.
            </p>
            <a
              href="mailto:hola@bookea.lat?subject=Sugerencia%20para%20Food%20Bookea"
              className="mt-3 inline-block text-[12.5px] font-bold text-aventurea-navy hover:underline"
            >
              Mandar una sugerencia →
            </a>
          </TarjetaPanel>
        </div>
      </div>
    </div>
  );
}
