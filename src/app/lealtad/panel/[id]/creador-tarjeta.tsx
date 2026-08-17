"use client";

import { useState, useTransition } from "react";
import {
  configPorDefecto,
  TIPOS_TARJETA,
  validarBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { coloresDePaleta, PALETAS, paletaDeLosColores } from "@/lib/lealtad/paletas";
import type { IconoSello } from "@/lib/lealtad/iconos-sello";
import { Icono } from "./iconos";
import SelectorTipo from "@/components/lealtad/selector-tipo";
import PasoBeneficio from "@/components/lealtad/paso-beneficio";
import PasoReglas, { REGLAS_VACIAS, resumenDeReglas, type Reglas } from "./paso-reglas";
import SubirImagen from "@/components/subir-imagen";
import CampoColor from "@/components/campo-color";
import PlantillasColor from "@/components/lealtad/plantillas-color";
import SelectorIconoSello from "@/components/lealtad/selector-icono-sello";
import VistaPase from "@/components/lealtad/vista-pase";
import AyudaDeDiseno from "./ayuda-diseno";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";
import { crearTarjeta, type BorradorTarjeta } from "./crear-actions";

/**
 * EL CREADOR DE TARJETAS, en cinco pasos.
 *
 *   1. Tipo   2. Diseño   3. Beneficio   4. Reglas   5. Revisar
 *
 * En escritorio: formulario a la izquierda, vista previa pegada a la
 * derecha. En móvil el formulario ocupa todo y la vista se abre con un
 * botón, porque una tarjeta fija arriba se comería media pantalla en
 * el paso donde más campos hay.
 *
 * ------------------------------------------------------------------
 * POR QUÉ LOS PASOS NO SE DESMONTAN
 * ------------------------------------------------------------------
 * Todos quedan montados y se esconden con `hidden`. Volver atrás no
 * pierde lo escrito ni re-renderiza el formulario entero, y la
 * transición entre pasos puede animar de verdad (la utilidad `pasos`
 * de globals.css los apila en una celda de grid, así el contenedor
 * mide el más alto y nada salta al cambiar).
 *
 * ------------------------------------------------------------------
 * LO QUE ESTE ARCHIVO NO DECIDE
 * ------------------------------------------------------------------
 * Si el beneficio es válido lo dice `validarBeneficio()`, la misma
 * función que corre en el servidor antes de guardar. Acá se llama para
 * poder avisar antes — no para autorizar. Una petición armada a mano
 * se saltaría todo lo que hay en este archivo.
 */

const PASOS = [
  { id: "tipo", titulo: "Tipo de tarjeta", bajada: "¿Qué clase de programa vas a armar?" },
  { id: "diseno", titulo: "Diseño", bajada: "Cómo se ve en el teléfono de tu cliente." },
  { id: "beneficio", titulo: "Beneficio", bajada: "Qué se gana y cómo." },
  { id: "reglas", titulo: "Reglas", bajada: "Cuándo vale y cuántas veces." },
  { id: "revisar", titulo: "Revisar", bajada: "Una última mirada antes de publicar." },
] as const;

const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris";

// El paso 4 —vigencia, días, topes— vive en `paso-reglas.tsx` desde que
// el editor de la tarjeta ya creada lo usa también. Su tipo y sus
// valores vacíos se re-exportan acá para no romper a nadie que los
// importara de este archivo.
export type { Reglas };

export default function CreadorTarjeta({
  ranchoId,
  negocioNombre,
  plan = null,
  ayudaInicial = null,
}: {
  ranchoId: string;
  negocioNombre: string;
  /**
   * El paquete del negocio. Decide qué tipos de tarjeta se pueden
   * elegir (0142) — se pinta acá para avisar temprano, y `crearTarjeta`
   * lo vuelve a comprobar en el servidor, que es lo que manda.
   */
  plan?: string | null;
  /** El hilo de ayuda con el equipo, si ya hay uno abierto (0149). */
  ayudaInicial?: HiloAyuda | null;
}) {
  const [paso, setPaso] = useState(0);
  const [verPase, setVerPase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();

  const [tipo, setTipo] = useState<TipoTarjeta>("sellos");
  const [beneficio, setBeneficio] = useState<ConfigBeneficio>(configPorDefecto("sellos"));
  const [nombre, setNombre] = useState("");
  // Arranca en la plantilla DEL TIPO, no en el navy de Bookea: es la
  // paleta que el dueño vio en la página cuando eligió «sellos», y
  // llegar al paso de diseño con esa ya puesta es la mitad del arreglo.
  const [colorFondo, setColorFondo] = useState(coloresDePaleta(PALETAS.sellos).fondo);
  const [colorSello, setColorSello] = useState(coloresDePaleta(PALETAS.sellos).sello);
  const [iconoSello, setIconoSello] = useState<IconoSello | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [reglas, setReglas] = useState<Reglas>(REGLAS_VACIAS);

  // Cambiar de tipo REEMPLAZA la config: los campos de una gift card
  // no tienen ningún significado en una tarjeta de sellos, y
  // arrastrarlos dejaría basura invisible en el jsonb.
  function elegirTipo(nuevo: TipoTarjeta) {
    setTipo(nuevo);
    setBeneficio(configPorDefecto(nuevo));
    // Los colores siguen al tipo SOLO si todavía son los de una
    // plantilla. Si el dueño ya afinó una rueda, volver atrás a cambiar
    // el tipo no puede pisarle el color que eligió a mano.
    if (paletaDeLosColores(colorFondo, colorSello)) {
      const c = coloresDePaleta(PALETAS[nuevo]);
      setColorFondo(c.fondo);
      setColorSello(c.sello);
    }
    setError(null);
  }

  const motivoBeneficio = validarBeneficio(beneficio);
  const puedeSeguir =
    paso === 2 ? motivoBeneficio === null : paso === 1 ? nombre.trim().length > 0 : true;

  function publicar() {
    setError(null);
    const borrador: BorradorTarjeta = {
          ranchoId,
      nombre: nombre.trim(),
      tipo,
      beneficio,
      colorFondo,
      colorSello,
      // Solo las de sellos llevan icono. El servidor lo vuelve a
      // comprobar: acá se limpia para no mandar basura, no para
      // autorizar nada.
      iconoSello: tipo === "sellos" ? iconoSello : null,
      logoUrl: logoUrl.trim(),
      bannerUrl: bannerUrl.trim(),
      reglas,
    };
    guardar(async () => {
      const res = await crearTarjeta(borrador);
      if (res.ok) setCreada(res.programaId);
      else setError(res.motivo);
    });
  }

  if (creada) {
    return (
      <div className="rounded-3xl border border-bookea-linea bg-white p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bookea-azul-suave text-bookea-azul">
          <Icono nombre="listo" className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-[20px] font-extrabold text-bookea-tinta">
          Tu tarjeta ya existe
        </h2>
        <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-bookea-gris">
          <strong>{nombre}</strong> quedó publicada. Compartí tu QR desde el panel y tus
          clientes ya la pueden agregar al teléfono.
        </p>
        <a
          href={`/lealtad/panel/${ranchoId}#poster`}
          className="presionable mt-5 inline-block rounded-xl px-5 py-3 text-[13.5px] font-extrabold text-bookea-azul"
          style={{ background: "var(--orange)" }}
        >
          Ver mi QR →
        </a>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
      <div className="min-w-0">
        {/* ── Progreso ─────────────────────────────────────────── */}
        <ol className="flex gap-1.5" aria-label="Pasos del creador">
          {PASOS.map((p, i) => (
            <li key={p.id} className="flex-1">
              <span
                className="block h-1.5 rounded-full transition-colors duration-300"
                style={{ background: i <= paso ? "var(--orange)" : "var(--line)" }}
              />
              <span className="sr-only">
                {p.titulo}
                {i === paso ? " (paso actual)" : i < paso ? " (completado)" : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11.5px] font-bold uppercase tracking-wide text-bookea-gris">
          Paso {paso + 1} de {PASOS.length}
        </p>
        <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-bookea-tinta">
          {PASOS[paso].titulo}
        </h2>
        <p className="mt-1 text-[13.5px] text-bookea-gris">{PASOS[paso].bajada}</p>

        {/* ── Los pasos ────────────────────────────────────────── */}
        <div className="pasos mt-5">
          <section
            className="paso"
            data-estado={paso === 0 ? "activo" : "saliendo"}
            hidden={paso !== 0}
          >
            <SelectorTipo valor={tipo} alElegir={elegirTipo} plan={plan} />
          </section>

          <section
            className="paso"
            data-estado={paso === 1 ? "activo" : "saliendo"}
            hidden={paso !== 1}
          >
            <div className="space-y-4">
              <div>
                <label className={etiqueta} htmlFor="c-nombre">
                  Nombre de la tarjeta
                </label>
                <input
                  id="c-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={`${TIPOS_TARJETA[tipo].nombre} de ${negocioNombre}`}
                  className={campo}
                />
              </div>
              {/* ── Los colores ─────────────────────────────────────
                  Primero las plantillas, DESPUÉS las ruedas. Las ocho
                  son las mismas que la página pública muestra tipo por
                  tipo, y la del tipo elegido viene puesta: el dueño
                  llega acá y su tarjeta ya se parece a la que vio.

                  Las ruedas no desaparecen —el que tiene los colores de
                  su marca los quiere tal cual— pero quedan abajo,
                  porque dos ruedas sueltas producen tarjetas
                  ilegibles cuando el que elige no es diseñador. */}
              <div>
                <span className={etiqueta}>Plantillas</span>
                <PlantillasColor
                  colorFondo={colorFondo}
                  colorSello={colorSello}
                  alElegir={({ fondo, sello }) => {
                    setColorFondo(fondo);
                    setColorSello(sello);
                  }}
                />
                <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                  Las mismas que ves en la página. Todas se leen bien en el teléfono.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoColor id="c-fondo" etiqueta="Color de fondo" valor={colorFondo} alCambiar={setColorFondo} />
                <CampoColor id="c-sello" etiqueta="Color del acento" valor={colorSello} alCambiar={setColorSello} />
              </div>

              {/* ── El icono del sello (0145) ───────────────────────
                  Solo en sellos: es lo único que tiene círculos que
                  llenar. En una gift card no habría dónde dibujarlo. */}
              {tipo === "sellos" && (
                <div>
                  <span className={etiqueta}>Icono del sello</span>
                  <SelectorIconoSello
                    valor={iconoSello}
                    alElegir={setIconoSello}
                    colorFondo={colorFondo}
                    colorSello={colorSello}
                  />
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">
                    Se llena cuando el cliente gana el sello y queda en contorno el que le
                    falta. Con «Mi logo» va tu logo adentro del círculo, como hasta ahora.
                  </p>
                </div>
              )}
              {/* Acá se pedía «Logo (URL https)», o sea que el dueño de
                  una barbería tenía que subir su logo a algún lado,
                  encontrar el link DIRECTO y comprobar que fuera https.
                  La mitad pegaba el link de una carpeta de Drive —que
                  no es una imagen— y se quedaba sin logo sin entender
                  por qué. Ahora se arrastra el archivo y ya. */}
              <div className="sm:col-span-2">
                <SubirImagen
                  etiqueta="Logo del negocio"
                  valor={logoUrl}
                  alCambiar={setLogoUrl}
                  destino="logo"
                  carpeta="lealtad/logos"
                />
                <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                  Sin logo, la tarjeta escribe el nombre del negocio.
                </p>
              </div>

              <div className="sm:col-span-2">
                <SubirImagen
                  etiqueta="Banda de la tarjeta (opcional)"
                  valor={bannerUrl}
                  alCambiar={setBannerUrl}
                  destino="banner"
                  carpeta="lealtad/bandas"
                />
                <p className="mt-1.5 text-[11.5px] text-bookea-gris">
                  La franja de arriba del pase. Una foto de tu local o de lo que vendés.
                </p>
              </div>
            </div>
          </section>

          <section
            className="paso"
            data-estado={paso === 2 ? "activo" : "saliendo"}
            hidden={paso !== 2}
          >
            <PasoBeneficio config={beneficio} alCambiar={setBeneficio} />
            {motivoBeneficio && (
              <p
                role="status"
                className="mt-4 rounded-xl bg-bookea-naranja-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-naranja-fuerte"
              >
                {motivoBeneficio}
              </p>
            )}
          </section>

          <section
            className="paso"
            data-estado={paso === 3 ? "activo" : "saliendo"}
            hidden={paso !== 3}
          >
            <PasoReglas reglas={reglas} alCambiar={setReglas} />
          </section>

          <section
            className="paso"
            data-estado={paso === 4 ? "activo" : "saliendo"}
            hidden={paso !== 4}
          >
            <Resumen
              nombre={nombre}
              tipo={tipo}
              beneficio={beneficio}
              reglas={reglas}
              motivo={motivoBeneficio}
            />
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] font-bold text-red-700">
                {error}
              </p>
            )}
          </section>
        </div>

        {/* ── La salida cuando no le gusta cómo va quedando ──────
            Va acá abajo y en TODOS los pasos, no escondida en el de
            diseño: el momento en que alguien se da cuenta de que no le
            gusta no tiene por qué coincidir con el paso donde eligió
            los colores, y una puerta que hay que buscar no es una
            puerta. Manda lo que tiene en pantalla AHORA — que es lo
            único que existe, porque todavía no se guardó nada. */}
        <div className="mt-6">
          <AyudaDeDiseno
            ranchoId={ranchoId}
            programaId={null}
            hiloInicial={ayudaInicial}
            tipo={tipo}
            colorFondo={colorFondo}
            colorSello={colorSello}
            iconoSello={tipo === "sellos" ? iconoSello : null}
            tieneLogo={logoUrl.trim().length > 0}
            tieneBanda={bannerUrl.trim().length > 0}
          />
        </div>

        {/* ── Barra de navegación ────────────────────────────────
            `--hoja` y no `bg-white`. La clase blanca se re-mapea dentro
            del panel oscuro a un blanco al 5% —o sea, casi transparente—
            y una barra PEGAJOSA translúcida deja ver el formulario
            pasando por detrás de los botones: se lee como si estuviera
            rota, que es exactamente lo que se veía.

            El token es opaco en los dos temas, así que la barra tapa lo
            que pasa debajo tanto en la pantalla clara de /crear como
            acá adentro.

            Y el padding lateral es propio, con `rounded-b`: sin eso el
            borde superior nacía y moría en un ancho distinto al de la
            caja que la contiene, y la barra parecía cortada al costado. */}
        <div
          className="sticky bottom-0 -mx-1 mt-6 flex items-center gap-2 rounded-b-2xl border-t border-bookea-linea px-4 py-3.5"
          style={{ background: "var(--hoja)" }}
        >
          <button
            type="button"
            onClick={() => setPaso((p) => Math.max(0, p - 1))}
            disabled={paso === 0}
            className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-gris"
          >
            Atrás
          </button>
          <button
            type="button"
            onClick={() => setVerPase(true)}
            className="presionable rounded-xl border border-bookea-linea px-4 py-2.5 text-[13px] font-bold text-bookea-gris lg:hidden"
          >
            Ver tarjeta
          </button>
          <span className="flex-1" />
          {paso < PASOS.length - 1 ? (
            <button
              type="button"
              onClick={() => setPaso((p) => p + 1)}
              disabled={!puedeSeguir}
              className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-bookea-azul disabled:opacity-40"
              style={{ background: "var(--orange)" }}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={publicar}
              disabled={guardando || motivoBeneficio !== null || !nombre.trim()}
              className="presionable rounded-xl px-5 py-2.5 text-[13px] font-extrabold text-bookea-azul disabled:opacity-40"
              style={{ background: "var(--orange)" }}
            >
              {guardando ? "Publicando…" : "Publicar tarjeta"}
            </button>
          )}
        </div>
      </div>

      {/* ── Vista previa ─────────────────────────────────────────
          Pegada en escritorio; en móvil se abre desde la barra. */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <VistaPase
            datos={{
              negocioNombre: nombre.trim() || negocioNombre,
              modo: tipo,
              beneficio,
              colorFondo,
              colorSello,
              iconoSello,
              logoUrl: logoUrl.trim() || null,
              bannerUrl: bannerUrl.trim() || null,
            }}
          />
        </div>
      </aside>

      {verPase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la tarjeta"
        >
          <div className="w-full max-w-[340px]">
            <VistaPase
              datos={{
                negocioNombre: nombre.trim() || negocioNombre,
                modo: tipo,
                beneficio,
                colorFondo,
                colorSello,
                iconoSello,
                logoUrl: logoUrl.trim() || null,
                bannerUrl: bannerUrl.trim() || null,
              }}
            />
            <button
              type="button"
              onClick={() => setVerPase(false)}
              className="presionable mt-4 w-full rounded-xl bg-white py-3 text-[13px] font-bold text-bookea-tinta"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────

function Resumen({
  nombre,
  tipo,
  beneficio,
  reglas,
  motivo,
}: {
  nombre: string;
  tipo: TipoTarjeta;
  beneficio: ConfigBeneficio;
  reglas: Reglas;
  motivo: string | null;
}) {
  // Las tres líneas de reglas las arma `resumenDeReglas`, la misma que
  // usa el editor de la tarjeta ya creada: si el asistente resumiera a
  // su manera, las dos pantallas contarían la misma regla distinto.
  const r = resumenDeReglas(reglas);
  const lineas: [string, string][] = [
    ["Nombre", nombre.trim() || "— falta"],
    ["Tipo", TIPOS_TARJETA[tipo].nombre],
    ["Beneficio", resumenDelBeneficio(beneficio)],
    ["Vigencia", r.vigencia],
    ["Cuándo vale", r.cuando],
    ["Canjes", r.canjes],
  ];

  return (
    <div className="rounded-3xl border border-bookea-linea bg-white p-5">
      <dl className="divide-y divide-bookea-linea">
        {lineas.map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-[12px] font-bold uppercase tracking-wide text-bookea-gris">{k}</dt>
            <dd className="text-[13.5px] font-bold text-bookea-tinta">{v}</dd>
          </div>
        ))}
      </dl>
      {motivo && (
        <p className="mt-4 rounded-xl bg-bookea-naranja-suave px-3.5 py-2.5 text-[12.5px] font-bold text-bookea-naranja-fuerte">
          Falta algo en el beneficio: {motivo}
        </p>
      )}
    </div>
  );
}

function resumenDelBeneficio(b: ConfigBeneficio): string {
  switch (b.tipo) {
    case "sellos":
      return `${b.requeridos} sellos → ${b.recompensa || "…"}`;
    case "puntos":
      return `${b.porVisita} por visita · ${b.porMoneda} por colón`;
    case "cupon":
    case "descuento":
      return b.beneficio.forma === "porcentaje"
        ? `${b.beneficio.valor}% de descuento`
        : b.beneficio.forma === "monto"
          ? `₡${b.beneficio.valor.toLocaleString("es-CR")} de descuento`
          : `${b.beneficio.que || "…"} gratis`;
    case "membresia":
      return `${b.nivel || "…"} · ${b.vigenciaMeses} meses`;
    case "giftcard":
      return `${b.moneda === "USD" ? "$" : "₡"}${b.valor.toLocaleString("es-CR")}`;
    case "evento":
      return `${b.fecha || "…"} ${b.hora} · ${b.ubicacion || "…"}`;
    case "cashback":
      return `${b.porcentaje}% de vuelta`;
  }
}
