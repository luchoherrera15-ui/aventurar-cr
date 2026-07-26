import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AccionesSesion from "@/components/acciones-sesion";
import {
  IconCalendarLine,
  IconCheck,
  IconGlobe,
  IconPin,
  IconSparkles,
  IconTagLine,
  IconUsers,
  IconWhatsapp,
} from "@/components/icons";
import {
  CANTONES,
  CATEGORIAS,
  CATEGORIA_ICONO,
  CATEGORIA_LABEL,
  PROVINCIAS,
  SUBCATEGORIAS_TODAS,
} from "../mi-rancho/types";

export const metadata = {
  title: "Publicá tu negocio — Aventurea CR",
  description:
    "Sumá tu salón, rancho, catering, DJ o servicio para eventos al directorio de Aventurea CR. Publicar es gratis.",
};

export default async function PublicarPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("ranchos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "aprobado");

  const publicados = count ?? 0;
  const totalCantones = Object.values(CANTONES).reduce(
    (n, lista) => n + lista.length,
    0,
  );

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-5 px-6 py-3.5 lg:px-10">
          <Link href="/ranchos-eventos" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-white">
              A
            </span>
            <span className="text-base font-bold text-aventurea-ink">
              AVENTUREA CR
            </span>
          </Link>
          <AccionesSesion />
        </div>
      </header>

      {/* ---------- Portada ---------- */}
      <section className="relative isolate overflow-hidden">
        {/* Manchas suaves de fondo, el patrón de la referencia */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-[18%] -top-[45%] h-[820px] w-[820px] rounded-full bg-aventurea-navy-3/[0.12]" />
          <div className="absolute -left-[22%] top-[20%] h-[720px] w-[720px] rounded-full bg-aventurea-green/[0.10] blur-[90px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-aventurea-navy-3/[0.06] to-transparent" />
        </div>

        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center sm:py-28 lg:px-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-aventurea-line bg-aventurea-surface px-4 py-1.5 text-[12px] font-bold text-aventurea-ink-soft">
            <IconSparkles className="h-3.5 w-3.5 text-aventurea-orange" />
            Publicar es gratis
          </span>

          <h1 className="mx-auto mt-6 max-w-[16ch] text-balance text-[38px] font-bold leading-[1.08] tracking-tight text-aventurea-orange-dark sm:text-[56px]">
            El directorio de eventos de Costa Rica
          </h1>
          <p className="mx-auto mt-5 max-w-[54ch] text-balance text-[16px] leading-relaxed text-aventurea-ink-soft sm:text-[18px]">
            Salones, ranchos, catering, DJs, decoración y todo lo que hace falta
            para un evento. Sumá tu negocio y que te encuentren los que están
            organizando el suyo.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/mi-rancho/registro"
              className="rounded-xl bg-aventurea-orange px-7 py-3.5 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-orange-dark"
            >
              Publicar mi negocio
            </Link>
            <Link
              href="/ranchos-eventos"
              className="rounded-xl border border-aventurea-line bg-aventurea-surface px-7 py-3.5 text-[14.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-orange hover:text-aventurea-orange"
            >
              Ver el directorio
            </Link>
          </div>

          {publicados > 0 && (
            <p className="mt-6 text-[13px] text-aventurea-ink-soft">
              {publicados} negocio{publicados === 1 ? "" : "s"} ya
              {publicados === 1 ? " está" : " están"} publicado
              {publicados === 1 ? "" : "s"} en el directorio.
            </p>
          )}
        </div>
      </section>

      {/* ---------- Datos en cards ---------- */}
      <section className="relative isolate overflow-hidden pb-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-[10%] top-[5%] h-[600px] w-[600px] rounded-full bg-aventurea-navy-3/[0.09]" />
          <div className="absolute -left-[8%] bottom-[5%] h-[420px] w-[420px] rounded-full bg-aventurea-navy-3/[0.07] blur-[70px]" />
        </div>

        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DatoCard
              icono={<IconSparkles />}
              color="text-aventurea-orange"
              dato={`${SUBCATEGORIAS_TODAS.length} rubros`}
              texto="Desde salones y fincas hasta mariachis, queques y photo booth. Si es para un evento, tiene su lugar."
            />
            <DatoCard
              icono={<IconPin />}
              color="text-emerald-600"
              dato={`${totalCantones} cantones`}
              texto={`Cobertura en las ${PROVINCIAS.length} provincias del país, con búsqueda por zona para que te encuentren cerca.`}
            />
            <DatoCard
              icono={<IconTagLine />}
              color="text-amber-600"
              dato="₡0"
              texto="Publicar tu negocio no cuesta nada. Creás tu cuenta, cargás tus datos y quedás en el directorio."
            />
            <DatoCard
              icono={<IconCalendarLine />}
              color="text-sky-700"
              dato="Reservas en línea"
              texto="Los lugares reciben reservas con calendario, depósito y comprobante. Vos aprobás cada una."
            />
            <DatoCard
              icono={<IconGlobe />}
              color="text-violet-600"
              dato="Tu propia página"
              texto="Galería de fotos, redes sociales, amenidades y botones de Google Maps y Waze para que lleguen sin preguntar."
            />
            <DatoCard
              icono={<IconWhatsapp />}
              color="text-teal-600"
              dato="Contacto directo"
              texto="El cliente te escribe por WhatsApp desde tu página. Sin intermediarios ni comisión por el mensaje."
            />
          </div>
        </div>
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section className="border-t border-aventurea-line bg-aventurea-surface py-20">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="text-center">
            <p className="flex items-center justify-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              Cómo funciona
            </p>
            <h2 className="mt-2 text-[28px] font-bold text-aventurea-orange-dark sm:text-[34px]">
              Tres pasos y quedás publicado
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <Paso
              n={1}
              titulo="Creá tu cuenta"
              texto="Con tu correo y una contraseña. No pedimos tarjeta ni datos de la empresa para empezar."
            />
            <Paso
              n={2}
              titulo="Cargá tu negocio"
              texto="Elegís tu rubro, subís hasta 8 fotos, ponés tus precios, tus redes y la ubicación en el mapa."
            />
            <Paso
              n={3}
              titulo="Te revisamos y salís"
              texto="Revisamos que todo esté completo y tu página queda pública en el directorio."
            />
          </div>
        </div>
      </section>

      {/* ---------- Para quién es ---------- */}
      <section className="py-20">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="text-center">
            <h2 className="text-[28px] font-bold text-aventurea-orange-dark sm:text-[34px]">
              ¿Qué tipo de negocio tenés?
            </h2>
            <p className="mx-auto mt-2.5 max-w-[52ch] text-[14.5px] text-aventurea-ink-soft">
              Estas son las categorías del directorio. Dentro de cada una hay
              rubros específicos para que el cliente te encuentre por lo que
              realmente hacés.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIAS.map((cat) => (
              <Link
                key={cat}
                href="/ranchos-eventos"
                className="group flex flex-col items-center gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-aventurea-orange/40 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-aventurea-orange/10 text-aventurea-orange [&_svg]:h-6 [&_svg]:w-6">
                  {CATEGORIA_ICONO[cat]}
                </span>
                <span className="text-[13px] font-bold text-aventurea-ink">
                  {CATEGORIA_LABEL[cat]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Qué incluye ---------- */}
      <section className="border-t border-aventurea-line bg-aventurea-surface py-20">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
                Tu publicación
              </p>
              <h2 className="mt-2 text-[28px] font-bold text-aventurea-orange-dark sm:text-[34px]">
                Todo lo que podés administrar vos
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
                Desde tu panel cambiás lo que quieras cuando quieras, sin
                pedirle nada a nadie. Los cambios se ven al instante en tu
                página pública.
              </p>
              <Link
                href="/mi-rancho/registro"
                className="mt-7 inline-flex rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-orange-dark"
              >
                Empezar ahora
              </Link>
            </div>

            <ul className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {[
                "Hasta 8 fotos en galería",
                "Descripción y presentación larga",
                "Instagram, Facebook, TikTok y sitio web",
                "Ubicación con Google Maps y Waze",
                "Amenidades del lugar",
                "Precios y monto mínimo",
                "Códigos de descuento",
                "Promociones por día de la semana",
                "Tus propios términos y condiciones",
                "Calendario de disponibilidad",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] text-aventurea-ink"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aventurea-green/15 text-aventurea-green">
                    <IconCheck className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className="relative isolate overflow-hidden py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-aventurea-navy-3/[0.11]" />
        </div>
        <div className="mx-auto max-w-[720px] px-6 text-center">
          <span className="flex justify-center text-aventurea-orange [&_svg]:h-9 [&_svg]:w-9">
            <IconUsers />
          </span>
          <h2 className="mt-4 text-[30px] font-bold text-aventurea-orange-dark sm:text-[38px]">
            Sumate al directorio
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
            Publicar es gratis y toma unos minutos. Si después querés cambiar
            algo, lo hacés vos mismo desde tu panel.
          </p>
          <Link
            href="/mi-rancho/registro"
            className="mt-8 inline-flex rounded-xl bg-aventurea-orange px-8 py-4 text-[15px] font-bold text-white shadow-sm hover:bg-aventurea-orange-dark"
          >
            Publicar mi negocio gratis
          </Link>
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          AVENTUREA CR — Costa Rica ·{" "}
          <Link href="/ranchos-eventos" className="font-bold text-aventurea-orange">
            Ver el directorio
          </Link>
        </p>
      </footer>
    </div>
  );
}

function DatoCard({
  icono,
  color,
  dato,
  texto,
}: {
  icono: React.ReactNode;
  color: string;
  dato: string;
  texto: string;
}) {
  return (
    <div className="rounded-[22px] bg-aventurea-surface p-7 shadow-[0_2px_16px_rgba(16,26,44,0.06)]">
      <span className={`flex [&_svg]:h-8 [&_svg]:w-8 ${color}`}>{icono}</span>
      <p className="mt-5 text-[24px] font-bold leading-tight text-aventurea-orange-dark">
        {dato}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-aventurea-ink-soft">
        {texto}
      </p>
    </div>
  );
}

function Paso({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-aventurea-orange text-[18px] font-bold text-white">
        {n}
      </span>
      <h3 className="mt-4 text-[17px] font-bold text-aventurea-ink">{titulo}</h3>
      <p className="mx-auto mt-2 max-w-[34ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
        {texto}
      </p>
    </div>
  );
}
