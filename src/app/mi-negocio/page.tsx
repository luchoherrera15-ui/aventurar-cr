import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutDueno } from "./actions";
import { IconPlus } from "@/components/icons";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  CATEGORIAS,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  type Categoria,
  type Rancho,
} from "./types";
import { categoriaLabel, esCategoriaValida } from "@/lib/categorias-vertical";

// El texto siempre es blanco sobre vidrio esmerilado (se lee igual
// sobre cualquier foto); el color solo vive en el puntito de estado.
const ESTADO_PUNTO: Record<Rancho["estado"], string> = {
  pendiente: "bg-aventurea-sky",
  aprobado: "bg-aventurea-green",
  rechazado: "bg-red-500",
};

const ESTADO_LABEL: Record<Rancho["estado"], string> = {
  pendiente: "Pendiente",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

// Una franja de color por categoría, arriba de cada card: identidad
// visual sin meter fondos ni fotos de relleno. Solo cubre las 6 de
// Eventos — Citas/Hospedajes/Restaurantes caen en el acento neutro de
// abajo hasta que tengan el suyo propio.
const CATEGORIA_ACENTO: Record<Categoria, string> = {
  lugares: "bg-aventurea-sky",
  alimentacion: "bg-amber-500",
  animacion: "bg-violet-500",
  organizacion: "bg-sky-600",
  decoracion: "bg-rose-500",
  otros: "bg-zinc-500",
};

/** ¿`categoria` es una de las 6 de Eventos? Solo esas indexan los mapas
 *  de arriba (acento, gradiente, ícono) sin caer al valor neutro. */
function esCategoriaEventos(categoria: string): categoria is Categoria {
  return (CATEGORIAS as readonly string[]).includes(categoria);
}

export default async function MiRanchoHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-negocio/login");

  // Los propios...
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  // ...y aquellos donde alguien lo sumó como colaborador (0116). Van en
  // dos consultas y no en un `or`: la RLS ya deja ver los dos conjuntos,
  // pero `.eq("owner_id", ...)` filtra de más y dejaría fuera los
  // colaborados. Se piden los ids aparte y se traen esos negocios.
  const { data: colabs } = await supabase
    .from("rancho_colaboradores")
    .select("rancho_id")
    .eq("usuario_id", user.id);

  const idsColaborados = (colabs ?? [])
    .map((c) => (c as { rancho_id: string }).rancho_id)
    .filter((id) => !(data ?? []).some((r) => (r as Rancho).id === id));

  let colaborados: Rancho[] = [];
  if (idsColaborados.length > 0) {
    const { data: extra } = await supabase
      .from("ranchos")
      .select("*")
      .in("id", idsColaborados)
      .order("created_at", { ascending: true });
    colaborados = (extra ?? []) as Rancho[];
  }

  const propios = (data ?? []) as Rancho[];
  const ranchos = [...propios, ...colaborados];
  const idsPropios = new Set(propios.map((r) => r.id));

  // Nadie llega acá sin publicar nada todavía: el primer servicio se
  // arma con el formulario completo de onboarding, no con una card vacía.
  if (ranchos.length === 0) redirect("/mi-negocio/nuevo");

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-12">
      <RevealOnScroll />
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-aventurea-line pb-7">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
            Marketplace de ranchos
          </p>
          <h1 className="titulo mt-2.5 text-[28px] text-aventurea-ink">
            Tus servicios y espacios
          </h1>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
            Una misma cuenta puede ofrecer varias cosas — tu rancho, tu
            catering, un coffee bar. Cada uno con sus propias reservas y
            finanzas.
          </p>
        </div>
        <form action={logoutDueno}>
          <button
            type="submit"
            className="whitespace-nowrap rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ranchos.map((rancho, i) => {
          // Solo las 6 categorías de Eventos tienen acento/gradiente/ícono
          // propios; el resto (Citas, Hospedajes, Restaurantes) usa el
          // vecino neutro "otros" en vez de romper o mostrar undefined.
          const categoriaEventos = esCategoriaEventos(rancho.categoria)
            ? rancho.categoria
            : "otros";
          const etiquetaCategoria = esCategoriaValida(rancho.vertical ?? "eventos", rancho.categoria)
            ? categoriaLabel(rancho.vertical ?? "eventos", rancho.categoria)
            : rancho.categoria;
          return (
          <Link
            key={rancho.id}
            href={`/mi-negocio/${rancho.id}`}
            data-reveal
            style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
            className="group overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-[0_1px_2px_rgba(16,26,44,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_16px_32px_-12px_rgba(16,26,44,0.18)]"
          >
            <span className={`block h-[3px] w-full ${CATEGORIA_ACENTO[categoriaEventos]}`} />
            <div className="relative flex h-[120px] items-center justify-center overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={
                  rancho.foto_url
                    ? { backgroundImage: `url(${rancho.foto_url})` }
                    : { backgroundImage: CATEGORIA_GRADIENTE[categoriaEventos] }
                }
              />
              {!rancho.foto_url && (
                <span className="relative opacity-30 [&_svg]:h-10 [&_svg]:w-10">
                  {CATEGORIA_ICONO[categoriaEventos]}
                </span>
              )}
              <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/35 px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-md">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ESTADO_PUNTO[rancho.estado]}`} />
                {ESTADO_LABEL[rancho.estado]}
              </span>
            </div>
            <div className="p-4.5">
              <h2 className="truncate text-[15px] font-bold text-aventurea-ink group-hover:text-aventurea-ink">
                {rancho.nombre}
              </h2>
              {/* Un negocio ajeno donde te sumaron se marca: si no, en la
                  grilla se ve idéntico al propio y no queda claro por qué
                  algunas cosas —transferirlo, invitar gente— no aparecen. */}
              {!idsPropios.has(rancho.id) && (
                <span className="mt-0.5 inline-block rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Colaborás acá
                </span>
              )}
              <span className="text-[11px] font-bold uppercase tracking-wide text-aventurea-orange">
                {etiquetaCategoria}
              </span>
              {rancho.provincia && (
                <p className="mt-1 text-[12px] text-zinc-500">{rancho.provincia}</p>
              )}
            </div>
          </Link>
          );
        })}

        <Link
          href="/mi-negocio/nuevo"
          data-reveal
          style={{ "--reveal-delay": `${ranchos.length * 70}ms` } as React.CSSProperties}
          className="group flex min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-aventurea-line p-6 text-center text-aventurea-ink-soft transition-all duration-300 hover:border-aventurea-sky hover:bg-aventurea-sky/5 hover:text-aventurea-orange"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-aventurea-cream-2 transition-transform duration-300 group-hover:scale-110 group-hover:bg-aventurea-sky/10">
            <IconPlus className="h-5 w-5" />
          </span>
          <span className="text-[13.5px] font-bold">Agregar otro servicio</span>
          <span className="max-w-[22ch] text-[11.5px] leading-relaxed">
            Catering, DJ, coffee bar, decoración... publicá algo más con esta
            misma cuenta.
          </span>
        </Link>
      </div>
    </main>
  );
}
