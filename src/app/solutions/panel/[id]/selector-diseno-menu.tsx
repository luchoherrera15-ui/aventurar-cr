"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ajustesDePlantilla,
  ESTILO_MENU,
  ESTILOS_MENU,
  estiloDeAjustes,
  OPCIONES_MENU,
  PORTADA_MENU,
  PORTADAS_MENU,
  ROTULO_MENU,
  TAMANO_MENU,
  TAMANOS_MENU,
  TEMA_MENU,
  TEMAS_MENU,
  type AjustesMenu,
  type DefEstiloMenu,
  type EstiloMenu,
  type FuenteMenu,
} from "@/lib/solutions/menu-estilos";
import { FUENTE, FUENTES, type Fuente } from "@/lib/solutions/temas";
import Telefono from "@/components/solutions/telefono";
import { guardarAjustesMenuSolutions } from "./actions";
import { LP_BOTON_CHICO, LP_PILDORA } from "./sistema-linksy";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL ESTUDIO DEL CATÁLOGO — cinco temas y todo lo demás en tus manos
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (9 sep 2026): «que dé cinco temas de colores y lo
 * demás que sea cien por ciento customizable: colores, letras, tipos de
 * fuente, tamaños».
 *
 * ── CÓMO ESTÁ ORDENADO, Y POR QUÉ ASÍ ───────────────────────────────
 * De lo que más cambia la cara a lo que la afina:
 *   1. TEMA — cinco papeles. Un toque y el catálogo entero cambia.
 *   2. COLORES — los tres que importan (fondo, tinta, acento). Lo que
 *      se toca acá gana sobre el tema; las superficies y los bordes se
 *      derivan solos para que nunca queden peleados.
 *   3. LETRA — familia y tamaño.
 *   4. LA CARTA — cómo se apilan los platos, la foto, el precio, el
 *      separador, los títulos, el aire y las esquinas.
 *   5. PLANTILLAS — las 26 cartas de siempre, ahora como punto de
 *      partida: tocar una llena todo lo de arriba y desde ahí se sigue
 *      tocando. Molde, no camisa de fuerza.
 *
 * ── LA PREVIA ES LA PÁGINA DE VERDAD ────────────────────────────────
 * A la derecha hay un <iframe> con `/s/<slug>/menu?previa=1&ajustes=…`:
 * el catálogo real, con los platos y las fotos del negocio. Los ajustes
 * viajan en la URL SIN guardar, así que se ve antes de decidir; el
 * servidor los sanea igual que a los guardados.
 */

export default function SelectorDisenoMenu({
  negocioId,
  slug,
  ajustesActuales,
  pro,
  hrefPro,
}: {
  negocioId: string;
  slug: string;
  ajustesActuales: AjustesMenu;
  pro: boolean;
  hrefPro: string;
}) {
  const [a, setA] = useState<AjustesMenu>(ajustesActuales);
  const [guardando, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verPlantillas, setVerPlantillas] = useState(false);

  const cambiar = (parte: Partial<AjustesMenu>) => {
    const previo = a;
    const nuevo = { ...a, ...parte };
    setA(nuevo);
    setError(null);
    arrancar(async () => {
      const r = await guardarAjustesMenuSolutions(negocioId, nuevo);
      if (!r.ok) {
        setA(previo);
        setError(r.motivo);
      }
    });
  };

  const usarPlantilla = (id: EstiloMenu) => {
    if (ESTILO_MENU[id].pro && !pro) return;
    cambiar(ajustesDePlantilla(id, a));
  };

  const def = estiloDeAjustes(a);
  const previa = `/s/${slug}/menu?previa=1&ajustes=${encodeURIComponent(JSON.stringify(a))}`;
  const bloq = !pro;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={LP_PILDORA}>{guardando ? "Guardando…" : `Tema ${TEMA_MENU[a.tema].nombre}`}</span>
          {!pro && (
            <Link href={hrefPro} className={LP_BOTON_CHICO}>
              Personalizarlo todo es de Pro →
            </Link>
          )}
        </div>
        {error && <p className="mb-2 text-[12.5px] font-bold text-red-700">{error}</p>}

        {/* ── 1. El tema ─────────────────────────────────────────── */}
        <Grupo titulo="El tema" pie="Cinco papeles. Lo demás lo cambiás vos abajo.">
          <ul className="flex flex-wrap gap-2">
            {TEMAS_MENU.map((id) => {
              const t = TEMA_MENU[id];
              const activo = a.tema === id && !a.fondo;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => cambiar({ tema: id, fondo: "", tinta: "", acento: "" })}
                    aria-pressed={activo}
                    title={t.pie}
                    className={`presionable flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                      activo ? "border-transparent" : "border-aventurea-line hover:border-aventurea-ink/30"
                    }`}
                    style={activo ? { boxShadow: "0 0 0 2px var(--linksy-carbon, #16181d)" } : undefined}
                  >
                    <span aria-hidden className="flex h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-black/10">
                      <span className="h-full w-1/2" style={{ background: t.papel.fondo }} />
                      <span className="h-full w-1/2" style={{ background: t.papel.acento }} />
                    </span>
                    <span className="text-[12.5px] font-extrabold text-aventurea-ink">{t.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Grupo>

        {/* ── 2. Los colores ─────────────────────────────────────── */}
        <Grupo titulo="Los colores" pie="Lo que toques acá manda sobre el tema." bloqueado={bloq} hrefPro={hrefPro}>
          <div className="flex flex-wrap items-end gap-3">
            <Color rotulo="Fondo" valor={a.fondo || TEMA_MENU[a.tema].papel.fondo} bloqueado={bloq} alCambiar={(fondo) => cambiar({ fondo })} />
            <Color rotulo="Letra" valor={a.tinta || TEMA_MENU[a.tema].papel.tinta} bloqueado={bloq} alCambiar={(tinta) => cambiar({ tinta })} />
            <Color rotulo="Acento" valor={a.acento || TEMA_MENU[a.tema].papel.acento} bloqueado={bloq} alCambiar={(acento) => cambiar({ acento })} />
            {(a.fondo || a.tinta || a.acento) && (
              <button
                type="button"
                onClick={() => cambiar({ fondo: "", tinta: "", acento: "" })}
                className="text-[12.5px] font-bold text-aventurea-ink-soft underline underline-offset-4"
              >
                Volver a los del tema
              </button>
            )}
          </div>
        </Grupo>

        {/* ── 3. La letra ────────────────────────────────────────── */}
        <Grupo titulo="La letra" pie="La familia y su tamaño." bloqueado={bloq} hrefPro={hrefPro}>
          <Fila>
            <Chip activo={a.fuente === "auto"} bloqueado={bloq} onClick={() => cambiar({ fuente: "auto" })}>
              La de la plantilla
            </Chip>
            {FUENTES.map((f: Fuente) => (
              <Chip key={f} activo={a.fuente === f} bloqueado={bloq} onClick={() => cambiar({ fuente: f as FuenteMenu })}>
                <span style={{ fontFamily: `var(${FUENTE[f].cssVar}), ${FUENTE[f].respaldo}` }}>{FUENTE[f].nombre}</span>
              </Chip>
            ))}
          </Fila>
          <Fila>
            {TAMANOS_MENU.map((v) => (
              <Chip key={v} activo={a.tamano === v} bloqueado={bloq} onClick={() => cambiar({ tamano: v })}>
                {TAMANO_MENU[v]}
              </Chip>
            ))}
          </Fila>
        </Grupo>

        {/* ── 4. La carta ────────────────────────────────────────── */}
        <Grupo titulo="La carta" pie="Cómo se apila cada plato." bloqueado={bloq} hrefPro={hrefPro}>
          <Opcion rotulo="Disposición" valores={OPCIONES_MENU.disposicion} rotulos={ROTULO_MENU.disposicion} actual={a.disposicion} bloqueado={bloq} alElegir={(disposicion) => cambiar({ disposicion })} />
          {a.disposicion === "cuadricula" && (
            <Opcion rotulo="Por fila" valores={[2, 3] as const} rotulos={{ 2: "Dos", 3: "Tres" } as Record<number, string>} actual={a.columnas} bloqueado={bloq} alElegir={(columnas) => cambiar({ columnas: columnas as 2 | 3 })} />
          )}
          <Opcion rotulo="La foto" valores={OPCIONES_MENU.foto} rotulos={ROTULO_MENU.foto} actual={a.foto} bloqueado={bloq} alElegir={(foto) => cambiar({ foto })} />
          <Opcion rotulo="El precio" valores={OPCIONES_MENU.precio} rotulos={ROTULO_MENU.precio} actual={a.precio} bloqueado={bloq} alElegir={(precio) => cambiar({ precio })} />
          <Opcion rotulo="Entre platos" valores={OPCIONES_MENU.separador} rotulos={ROTULO_MENU.separador} actual={a.separador} bloqueado={bloq} alElegir={(separador) => cambiar({ separador })} />
          <Opcion rotulo="Los títulos" valores={OPCIONES_MENU.titulo} rotulos={ROTULO_MENU.titulo} actual={a.titulo} bloqueado={bloq} alElegir={(titulo) => cambiar({ titulo })} />
          <Opcion rotulo="El aire" valores={OPCIONES_MENU.aire} rotulos={ROTULO_MENU.aire} actual={a.aire} bloqueado={bloq} alElegir={(aire) => cambiar({ aire })} />
          <Opcion rotulo="Las esquinas" valores={OPCIONES_MENU.radio} rotulos={ROTULO_MENU.radio} actual={a.radio} bloqueado={bloq} alElegir={(radio) => cambiar({ radio })} />
        </Grupo>

        {/* ── 5. La foto de arriba ───────────────────────────────── */}
        <Grupo titulo="La foto de arriba" pie="Es tu foto de portada; acá se decide cómo entra." bloqueado={bloq} hrefPro={hrefPro}>
          <Fila>
            {PORTADAS_MENU.map((v) => (
              <Chip key={v} activo={a.portada === v} bloqueado={bloq} onClick={() => cambiar({ portada: v })} title={PORTADA_MENU[v].pie}>
                {PORTADA_MENU[v].nombre}
              </Chip>
            ))}
          </Fila>
        </Grupo>

        {/* ── 6. Las plantillas ──────────────────────────────────── */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setVerPlantillas((v) => !v)}
            aria-expanded={verPlantillas}
            className="flex w-full items-center justify-between rounded-2xl border border-aventurea-line px-4 py-3 text-left"
          >
            <span>
              <span className="block text-[13px] font-extrabold text-aventurea-ink">
                Empezar de una plantilla · {ESTILOS_MENU.length}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                Cartas ya armadas. Tocás una y después cambiás lo que quieras.
              </span>
            </span>
            <span aria-hidden className="text-[15px] font-bold text-aventurea-ink-soft">
              {verPlantillas ? "−" : "+"}
            </span>
          </button>

          {verPlantillas && (
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ESTILOS_MENU.map((id) => {
                const plantilla = ESTILO_MENU[id];
                const bloqueado = plantilla.pro && !pro;
                const activo = id === a.plantilla;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => usarPlantilla(id)}
                      aria-pressed={activo}
                      aria-disabled={bloqueado}
                      title={bloqueado ? "Plantilla del plan Pro" : plantilla.pie}
                      className={`presionable w-full overflow-hidden rounded-2xl border text-left transition-colors ${
                        activo ? "border-transparent" : "border-aventurea-line hover:border-aventurea-ink/30"
                      } ${bloqueado ? "opacity-60" : ""}`}
                      style={activo ? { boxShadow: "0 0 0 2px var(--linksy-carbon, #16181d)" } : undefined}
                    >
                      <Miniatura def={ajustesDePlantilla(id, a) && estiloDeAjustes(ajustesDePlantilla(id, a))} />
                      <span className="block px-2.5 pb-2.5 pt-2">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[13px] font-extrabold text-aventurea-ink">{plantilla.nombre}</span>
                          {plantilla.pro && (
                            <span className="rounded-full bg-aventurea-ink/8 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-aventurea-ink-soft">
                              {bloqueado ? "🔒 Pro" : "Pro"}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-aventurea-ink-soft">{plantilla.pie}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── La previa: el catálogo de verdad, en un teléfono ──────── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
          Así se ve {guardando && "· guardando…"}
        </p>
        <Telefono ancho={286} className="mx-auto">
          <iframe key={previa} src={previa} title="Previa del catálogo" className="h-full w-full border-0" />
        </Telefono>
        <p className="mt-2 text-center text-[11.5px] text-aventurea-ink-soft">
          {def.nombre} · {ROTULO_MENU.disposicion[a.disposicion].toLowerCase()}
        </p>
        <a
          href={`/s/${slug}/menu`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-center text-[12.5px] font-bold text-aventurea-ink-soft underline underline-offset-4"
        >
          Abrirlo en grande →
        </a>
      </div>
    </div>
  );
}

// ── Piezas del editor ───────────────────────────────────────────────

function Grupo({
  titulo,
  pie,
  bloqueado = false,
  hrefPro,
  children,
}: {
  titulo: string;
  pie: string;
  bloqueado?: boolean;
  hrefPro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="flex flex-wrap items-center gap-2 text-[13px] font-extrabold text-aventurea-ink">
        {titulo}
        {bloqueado && hrefPro && (
          <Link href={hrefPro} className="rounded-full bg-aventurea-ink/8 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-aventurea-ink-soft">
            🔒 Pro
          </Link>
        )}
      </p>
      <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">{pie}</p>
      <div className={`mt-2 ${bloqueado ? "opacity-60" : ""}`}>{children}</div>
    </div>
  );
}

const Fila = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
);

/** Una tanda de opciones con su rótulo: la unidad del editor fino. */
function Opcion<T extends string | number>({
  rotulo,
  valores,
  rotulos,
  actual,
  bloqueado,
  alElegir,
}: {
  rotulo: string;
  valores: readonly T[];
  rotulos: Record<string, string> | Record<number, string>;
  actual: T;
  bloqueado: boolean;
  alElegir: (v: T) => void;
}) {
  return (
    <div className="mt-2.5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">{rotulo}</p>
      <Fila>
        {valores.map((v) => (
          <Chip key={String(v)} activo={actual === v} bloqueado={bloqueado} onClick={() => alElegir(v)}>
            {(rotulos as Record<string, string>)[String(v)] ?? String(v)}
          </Chip>
        ))}
      </Fila>
    </div>
  );
}

function Color({
  rotulo,
  valor,
  bloqueado,
  alCambiar,
}: {
  rotulo: string;
  valor: string;
  bloqueado: boolean;
  alCambiar: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">{rotulo}</span>
      <span className="mt-1 flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-2 py-1.5">
        <input
          type="color"
          value={valor}
          disabled={bloqueado}
          onChange={(e) => alCambiar(e.target.value)}
          aria-label={rotulo}
          className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[11.5px] uppercase text-aventurea-ink-soft">{valor}</span>
      </span>
    </label>
  );
}

function Chip({
  activo,
  bloqueado,
  onClick,
  title,
  children,
}: {
  activo: boolean;
  bloqueado: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={bloqueado ? undefined : onClick}
      aria-pressed={activo}
      aria-disabled={bloqueado}
      title={title}
      className={`presionable min-h-[36px] rounded-xl border px-3 text-[12.5px] font-bold transition-colors ${
        activo ? "border-transparent" : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-ink/30"
      }`}
      style={
        activo
          ? { background: "var(--linksy-carbon, #16181d)", color: "var(--linksy-carbon-tinta, #ffffff)" }
          : undefined
      }
    >
      {children}
    </button>
  );
}

/**
 * La plantilla en 124 px: dos platos de mentira con su papel, su letra y
 * su separador. Se dibuja con los mismos tokens que el catálogo, así que
 * el día que cambie el renderizador, cambia sola.
 */
function Miniatura({ def }: { def: DefEstiloMenu }) {
  const c = def.papel ?? {
    fondo: "#FFFFFF",
    tinta: "#10203A",
    suave: "#7A8BA0",
    superficie: "#F4F7FB",
    borde: "#E2E9F2",
    acento: "#1F6FEB",
    sobreAcento: "#FFFFFF",
  };
  const f = FUENTE[def.fuente];
  const familia = `var(${f.cssVar}), ${f.respaldo}`;
  const conFoto = def.foto !== "ninguna";

  const titulo = (
    <div
      className={
        def.titulo === "centrado"
          ? "text-center text-[7px] font-bold"
          : def.titulo === "alta"
            ? "text-[6px] font-extrabold uppercase tracking-[0.2em]"
            : def.titulo === "serif"
              ? "text-[9px] font-bold"
              : "text-[6px] font-extrabold uppercase tracking-[0.14em]"
      }
      style={{ color: def.titulo === "alta" ? c.acento : def.titulo === "versalitas" ? c.suave : c.tinta }}
    >
      Entradas
    </div>
  );

  const plato = (i: number) => {
    const nombre = (
      <div className={def.titulo === "alta" ? "text-[6.5px] font-extrabold uppercase" : "text-[7px] font-extrabold"} style={{ color: c.tinta }}>
        {i === 0 ? "Ceviche" : "Tartar"}
      </div>
    );
    const precio = (
      <div
        className={def.precio === "pildora" ? "rounded-full px-1.5 text-[6px] font-extrabold" : "text-[6.5px] font-bold"}
        style={def.precio === "pildora" ? { background: c.acento, color: c.sobreAcento } : { color: c.acento }}
      >
        6.500
      </div>
    );
    const foto = conFoto ? (
      <div
        className={
          def.foto === "circular"
            ? "h-5 w-5 shrink-0 rounded-full"
            : def.foto === "grande" || def.foto === "ancha"
              ? "h-7 w-full"
              : `h-5 w-5 shrink-0 ${def.radio === "recto" ? "" : "rounded"}`
        }
        style={{ background: c.acento, opacity: 0.28 }}
      />
    ) : null;

    if (def.disposicion === "guia" || def.disposicion === "columnas") {
      return (
        <div key={i} className="flex items-baseline gap-1">
          {nombre}
          <span
            className="h-px flex-1"
            style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "4px 1px", color: c.suave, opacity: 0.8 }}
          />
          {precio}
        </div>
      );
    }
    if (def.disposicion === "tarjetas" || def.disposicion === "cuadricula" || def.disposicion === "revista") {
      return (
        <div
          key={i}
          className={`overflow-hidden ${def.radio === "recto" ? "" : "rounded-md"} ${def.separador === "tarjeta" ? "border" : ""}`}
          style={def.separador === "tarjeta" ? { background: c.superficie, borderColor: c.borde } : undefined}
        >
          {foto}
          <div className="flex items-center justify-between gap-1 px-1 py-1">
            {nombre}
            {precio}
          </div>
        </div>
      );
    }
    return (
      <div
        key={i}
        className={`flex items-center gap-1.5 ${def.separador === "tarjeta" ? `border p-1 ${def.radio === "recto" ? "" : "rounded-md"}` : "border-b pb-1"}`}
        style={{ background: def.separador === "tarjeta" ? c.superficie : undefined, borderColor: c.borde }}
      >
        {foto}
        <div className="min-w-0 flex-1">{nombre}</div>
        {precio}
      </div>
    );
  };

  const dosColumnas = def.disposicion === "cuadricula" || def.disposicion === "columnas";

  return (
    <div className="h-[124px] w-full overflow-hidden px-2.5 pt-2.5" style={{ background: c.fondo, fontFamily: familia }}>
      {titulo}
      <div className={`mt-1.5 ${dosColumnas ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"}`}>{[0, 1].map(plato)}</div>
    </div>
  );
}
