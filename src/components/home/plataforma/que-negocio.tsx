import Link from "next/link";
import type { ComponentType } from "react";
import { IconGorroChef, IconStore, IconTijeras } from "@/components/icons";
import { Encabezado, Seccion, VerMas } from "./piezas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  ¿QUÉ NEGOCIO TENÉS? — los tres perfiles, con lo que se lleva cada uno
 * ════════════════════════════════════════════════════════════════════
 *
 * La §4 de `docs/bookea-producto.md`: gastronomía, tienda y citas. No
 * es una sección decorativa — es LA MISMA pregunta que el alta le va a
 * hacer al negocio, así que el home empieza el onboarding: quien se
 * reconoce acá ya sabe qué elegir cuando toque «Empezá gratis».
 *
 * ── POR QUÉ TRES Y NO DIECIOCHO ─────────────────────────────────────
 * Los tipos reales son los 18 de `src/lib/business/modulos.ts` (la
 * taxonomía canónica, decisión congelada #5). Estos tres son la
 * AGRUPACIÓN COMERCIAL de esos tipos, no una lista nueva: nadie elige
 * «gastronomía» en ninguna pantalla — elige «restaurante» o
 * «cafetería», que caen acá.
 *
 * ── LA LISTA DE CADA TARJETA ES UNA LISTA DE PROMESAS ───────────────
 * Todo lo que aparece existe y se puede entregar hoy. Por eso citas
 * dice «aparecés en el directorio» (el marketplace vive en `/all`) y
 * gastronomía NO dice «reservá tu mesa» (las mesas no son un recurso
 * reservable — la misma regla de `reservas.tsx`).
 */

type Perfil = {
  nombre: string;
  ejemplos: string;
  dolor: string;
  seLleva: readonly string[];
  Icono: ComponentType<{ className?: string }>;
};

const PERFILES: Perfil[] = [
  {
    nombre: "Gastronomía",
    ejemplos: "Restaurante · cafetería · soda · panadería",
    dolor: "El menú desactualizado y los pedidos perdidos en el chat.",
    seLleva: [
      "Tu página con menú y fotos",
      "Pedidos que entran armados a tu panel",
      "QR por mesa",
      "Plan de lealtad con sellos",
    ],
    Icono: IconGorroChef,
  },
  {
    nombre: "Tienda",
    ejemplos: "Física o en línea · boutique · floristería",
    dolor: "Sin dónde mostrar el catálogo ni cómo recibir un pedido.",
    seLleva: [
      "Catálogo con fotos y precios",
      "Pedidos para recoger o con envío",
      "Tus redes y tus links en un lugar",
      "Plan de lealtad con sellos",
    ],
    Icono: IconStore,
  },
  {
    nombre: "Citas",
    ejemplos: "Barbería · salón · uñas · spa · masajes",
    dolor: "La agenda en papel y las cadenas de mensajes para cuadrar una hora.",
    seLleva: [
      "Agenda real, con tu equipo y tus horarios",
      "Reserva instantánea, sin aprobar a mano",
      "Ficha de cliente",
      "Aparecés en el directorio de Bookea",
    ],
    Icono: IconTijeras,
  },
];

export default function QueNegocio() {
  return (
    <Seccion id="tu-rubro">
      <Encabezado rotulo="Para tu rubro" titulo="¿Qué negocio tenés?">
        Es lo primero que te preguntamos al registrarte — y de ahí tu
        panel se arma solo.
      </Encabezado>

      <div className="mt-12 grid gap-5 sm:mt-14 lg:grid-cols-3">
        {PERFILES.map(({ nombre, ejemplos, dolor, seLleva, Icono }) => (
          <Link
            key={nombre}
            href="/empezar"
            className="group flex flex-col rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--superficie)] p-7 text-left transition-colors hover:border-[color:var(--acento)]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-[color:var(--linea)] bg-[color:var(--papel)]">
              <Icono className="h-6 w-6 text-[color:var(--tinta)]" />
            </span>
            <p className="mt-5 text-[19px] font-extrabold text-[color:var(--tinta)]">
              {nombre}
            </p>
            <p className="mt-0.5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--tinta-tenue)]">
              {ejemplos}
            </p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[color:var(--tinta-suave)]">
              {dolor}
            </p>
            <ul className="mb-7 mt-4 space-y-2">
              {seLleva.map((x) => (
                <li key={x} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[11px] font-extrabold text-[color:var(--ok)]"
                  >
                    ✓
                  </span>
                  <span className="text-[14px] leading-snug text-[color:var(--tinta)]">
                    {x}
                  </span>
                </li>
              ))}
            </ul>
            <VerMas className="mt-auto self-start">Empezá gratis</VerMas>
          </Link>
        ))}
      </div>
    </Seccion>
  );
}
