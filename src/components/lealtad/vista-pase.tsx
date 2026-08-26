"use client";

import { useState } from "react";
import {
  camposSegunModo,
  coloresDe,
  selloDeLaConfig,
  tiraDelPase,
  type CamposTarjeta,
  type ConfigPase,
  type MetaRecompensa,
  type TiraDelPase,
} from "@/lib/wallet/tarjeta";
import { metaDe, tipoDe, type ConfigBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import { selloParaGuardar, type DibujoDelSello, type SelloElegido } from "@/lib/lealtad/iconos-sello";
import { SelloConIcono, SelloConImagen } from "@/app/lealtad/panel/[id]/iconos";
import { CONFIG_CLASICA, layoutDeLaTira, type ConfigTira } from "@/lib/wallet/layout-tira";

/**
 * LA VISTA PREVIA DEL PASE, en vivo.
 *
 * La usa el creador de tarjetas, el editor del diseño y el asistente de
 * alta. Una sola, no una por pantalla: dos maquetas del mismo pase se
 * separan en cuanto alguien toca una, y a partir de ahí el negocio ve
 * una cosa en el creador y otra en el editor.
 *
 * ------------------------------------------------------------------
 * LOS TEXTOS NO SE INVENTAN ACÁ
 * ------------------------------------------------------------------
 * Qué dice cada campo lo decide `camposSegunModo()`, que es la MISMA
 * función que arma el `pass.json` que se firma y se manda al teléfono
 * (src/lib/wallet/tarjeta.ts).
 *
 * Si esta pantalla escribiera sus propios textos, la vista previa y el
 * pase real dirían cosas distintas — y el negocio se enteraría recién
 * cuando un cliente le muestre el teléfono en el mostrador.
 *
 * Lo que sí es aproximado es el DIBUJO: el layout final lo resuelven
 * Apple y Google, no nosotros. Por eso el aviso al pie, que no es
 * humildad decorativa sino la diferencia entre "se ve distinto" y
 * "esto está roto".
 *
 * Y la BANDA tampoco se decide acá: qué va en el strip lo dice
 * `tiraDelPase()`, la misma función que consulta el generador. Esta
 * pantalla llegó a dibujar la banda y los sellos como dos cosas
 * separadas, y en Apple son UN SOLO archivo — o sea que prometía un
 * pase que el teléfono no podía armar.
 */

export type DatosVista = {
  negocioNombre: string;
  /** El tipo de tarjeta (`programa_lealtad.modo`). */
  modo: string | null;
  beneficio: ConfigBeneficio;
  colorFondo: string | null;
  colorSello: string | null;
  logoUrl: string | null;
  /** Banda superior: `strip.png` en Apple, `heroImage` en Google. */
  bannerUrl?: string | null;
  /**
   * El icono de cada sello (0145). null = el logo, como siempre; desde
   * la 0174 también puede ser `'propio'`, y ahí manda `iconoUrl`.
   */
  iconoSello?: SelloElegido | null;
  /** El ícono propio que subió el negocio (0174). */
  iconoUrl?: string | null;
  /**
   * Dónde y de qué tamaño van los sellos (0212). Ausente = el layout
   * clásico, que es lo que dibuja el pase de todo negocio que no tocó
   * nada. Se pasa YA saneado (`configDesdeJson` / `disenoDeLaConfig`).
   */
  diseno?: ConfigTira;
  /** Saldo de ejemplo. Por defecto, la mitad de la meta. */
  saldoEjemplo?: number;
};

type Plataforma = "apple" | "google";

export default function VistaPase({
  datos,
  superficie = "oscura",
  marco = "ninguno",
}: {
  datos: DatosVista;
  /**
   * Sobre qué fondo vive el componente. Los textos que lo rodean —las
   * pestañas y el aviso al pie— son blancos translúcidos porque el
   * panel es navy; puestos sobre una pantalla clara desaparecen. Con
   * «clara» se pintan en los grises de la marca. La TARJETA no cambia:
   * sus textos van sobre su propio color, no sobre el de la página.
   */
  superficie?: "clara" | "oscura";
  /**
   * «telefono» mete la tarjeta DENTRO de un teléfono dibujado. Las
   * pestañas y el aviso quedan FUERA del marco a propósito: son
   * controles nuestros, no parte de lo que se ve en el teléfono —
   * metidos adentro, el conjunto deja de leerse como un teléfono y
   * pasa a leerse como un dibujo raro.
   */
  marco?: "ninguno" | "telefono";
}) {
  const [plataforma, setPlataforma] = useState<Plataforma>("apple");
  const clara = superficie === "clara";

  const tipo = tipoDe(datos.modo);
  const meta = metaDe(datos.beneficio);
  // A la mitad: una tarjeta al 0% se ve vacía y una al 100% se ve
  // terminada. La mitad es la que muestra que la cosa avanza.
  const saldo = datos.saldoEjemplo ?? (meta ? Math.floor(meta / 2) : 0);

  // UNA sola config para todo, igual que en el pase real: los textos,
  // los colores y el strip salen del mismo dato.
  //
  // Por el MISMO filtro que el pase real: elegir un icono y después
  // cambiar el tipo a «cupón» no puede dejar la vista previa dibujando
  // sellos con dibujo mientras el teléfono no los tiene.
  const columnas = selloParaGuardar({ tipo, icono: datos.iconoSello, url: datos.iconoUrl });
  const config: ConfigPase = {
    modo: tipo,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_logo_url: datos.logoUrl,
    pase_banner_url: datos.bannerUrl ?? null,
    pase_sello_icono: columnas.icono,
    pase_sello_icono_url: columnas.url,
  };
  const sello = selloDeLaConfig(config);
  const recompensa: MetaRecompensa = meta
    ? { nombre: nombreDeLaMeta(datos.beneficio), costo_puntos: meta }
    : null;

  const campos = camposSegunModo({
    negocioNombre: datos.negocioNombre || "Tu negocio",
    saldo,
    meta: recompensa,
    config,
    beneficio: datos.beneficio,
  });

  const colores = coloresDe(config);
  const tira = tiraDelPase(config, recompensa);

  return (
    <div>
      {/* Las dos plataformas. Un negocio que solo mira la de Apple no
          se entera de que en Android su logo se ve distinto. */}
      <div
        className="mx-auto flex w-fit gap-1 rounded-xl p-1"
        role="tablist"
        aria-label="Plataforma de la vista previa"
        style={{ background: clara ? "var(--navy-suave)" : "rgba(255,255,255,.08)" }}
      >
        {(["apple", "google"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={plataforma === p}
            onClick={() => setPlataforma(p)}
            className={`presionable rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
              plataforma === p
                ? "bg-white text-[#062653]"
                : clara
                  ? "text-bookea-gris hover:text-bookea-tinta"
                  : "text-white/60 hover:text-white"
            }`}
          >
            {p === "apple" ? "Apple Wallet" : "Google Wallet"}
          </button>
        ))}
      </div>

      {marco === "telefono" ? (
        <MarcoTelefono plataforma={plataforma}>
          {plataforma === "apple" ? (
            <TarjetaApple
              datos={datos}
              campos={campos}
              colores={colores}
              tira={tira}
              saldo={saldo}
              sello={sello}
            />
          ) : (
            <TarjetaGoogle datos={datos} campos={campos} colores={colores} />
          )}
        </MarcoTelefono>
      ) : (
        <div className="mt-4">
          {plataforma === "apple" ? (
            <TarjetaApple
              datos={datos}
              campos={campos}
              colores={colores}
              tira={tira}
              saldo={saldo}
              sello={sello}
            />
          ) : (
            <TarjetaGoogle datos={datos} campos={campos} colores={colores} />
          )}
        </div>
      )}

      <p
        className={`mt-3 text-center text-[11px] leading-snug ${
          clara ? "text-bookea-gris" : "text-white/40"
        }`}
      >
        Vista aproximada. La apariencia final puede variar según el dispositivo y la
        plataforma.
      </p>
    </div>
  );
}

// ── El teléfono ────────────────────────────────────────────────────
// Lo que hace que un mockup se lea como un teléfono no es el borde
// redondeado: son las tres cosas que el ojo ya tiene memorizadas de
// tanto verlas —la isla dinámica, la barra de estado con SUS íconos y
// la rayita de inicio— más un canto que refleje luz como el metal. Sin
// eso queda un rectángulo negro con una tarjeta encima.

function MarcoTelefono({
  plataforma,
  children,
}: {
  plataforma: Plataforma;
  children: React.ReactNode;
}) {
  // Wallet de Apple es negro; el de Google, claro. La barra de estado
  // se invierte con él — en un teléfono real la hora no se queda
  // blanca sobre una app clara.
  const oscuro = plataforma === "apple";
  const tinta = oscuro ? "#ffffff" : "#0a1226";

  return (
    <div className="mx-auto mt-4 w-full max-w-[262px]">
      <div
        className="relative rounded-[42px] p-[3px]"
        style={{
          // El canto: un degradado que simula el reflejo del titanio.
          background:
            "linear-gradient(150deg,#6b7280,#2a2f38 20%,#171b22 50%,#3f454f 76%,#6b7280)",
          boxShadow: "0 26px 50px -18px rgba(6,12,26,.55), 0 0 0 1px rgba(255,255,255,.05)",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[39px]"
          style={{ background: oscuro ? "#000000" : "#f4f5f7", aspectRatio: "393 / 800" }}
        >
          {/* La isla dinámica, con el punto de la cámara adentro. */}
          <div
            aria-hidden
            className="absolute left-1/2 top-[9px] z-20 flex h-[24px] w-[82px] -translate-x-1/2 items-center justify-end rounded-full pr-2.5"
            style={{ background: "#000000" }}
          >
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: "#0b1a2b", boxShadow: "inset 0 0 3px rgba(90,150,230,.75)" }}
            />
          </div>

          <div
            aria-hidden
            className="absolute inset-x-0 top-0 z-10 flex h-[36px] items-center justify-between px-5 text-[10px] font-semibold"
            style={{ color: tinta }}
          >
            <span className="tracking-tight">9:41</span>
            <span className="flex items-center gap-[4px]">
              <IconoSenal />
              <IconoWifi />
              <IconoBateria />
            </span>
          </div>

          {/* El contenido de la app. El nombre arriba ubica la escena:
              una tarjeta suelta sobre negro no dice DÓNDE está. */}
          <div className="absolute inset-x-0 bottom-0 top-[36px] px-2.5 pt-1">
            <p
              className="mb-2 px-1 text-[13px] font-bold tracking-tight"
              style={{ color: tinta }}
            >
              Wallet
            </p>
            {children}
          </div>

          <span
            aria-hidden
            className="absolute bottom-[7px] left-1/2 h-[4px] w-[100px] -translate-x-1/2 rounded-full"
            style={{ background: oscuro ? "rgba(255,255,255,.9)" : "rgba(10,18,38,.75)" }}
          />
        </div>
      </div>
    </div>
  );
}

function IconoSenal() {
  return (
    <svg width="15" height="10" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
      <rect y="8" width="3" height="4" rx="1" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
      <rect x="15" width="3" height="12" rx="1" fillOpacity=".35" />
    </svg>
  );
}

function IconoWifi() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
      <path d="M8 11.4 6.1 9.2a2.9 2.9 0 0 1 3.8 0L8 11.4Z" />
      <path
        d="M11.6 7.3a5.4 5.4 0 0 0-7.2 0L3.1 5.9a7.3 7.3 0 0 1 9.8 0l-1.3 1.4Z"
        fillOpacity=".9"
      />
      <path d="M14.7 4a9.7 9.7 0 0 0-13.4 0L0 2.6a11.7 11.7 0 0 1 16 0L14.7 4Z" fillOpacity=".75" />
    </svg>
  );
}

function IconoBateria() {
  return (
    <svg width="22" height="11" viewBox="0 0 25 12" fill="none" aria-hidden>
      <rect
        x=".5"
        y=".5"
        width="20"
        height="11"
        rx="3.4"
        stroke="currentColor"
        strokeOpacity=".42"
      />
      <rect x="2" y="2" width="15" height="8" rx="2.2" fill="currentColor" />
      <path
        d="M22.2 4.3v3.4c.85-.28 1.4-.94 1.4-1.7s-.55-1.42-1.4-1.7Z"
        fill="currentColor"
        fillOpacity=".45"
      />
    </svg>
  );
}

/** El nombre de lo que se gana, para el campo «regalía». */
function nombreDeLaMeta(b: ConfigBeneficio): string {
  if (b.tipo === "sellos") return b.recompensa || "Tu regalía";
  if (b.tipo === "giftcard") return "Saldo de regalo";
  return "Tu regalía";
}

// ── Apple ──────────────────────────────────────────────────────────

function TarjetaApple({
  datos,
  campos,
  colores,
  tira,
  saldo,
  sello,
}: {
  datos: DatosVista;
  campos: CamposTarjeta;
  colores: { fondo: string; sello: string };
  tira: TiraDelPase;
  saldo: number;
  /** Qué lleva cada sello, ya filtrado por tipo. */
  sello: DibujoDelSello;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl shadow-flotante"
      style={{ background: colores.fondo }}
    >
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            {datos.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- URL
                 externa del negocio, y acá es una maqueta. */
              <img src={datos.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
            ) : null}
            <span className="truncate text-[12.5px] font-medium text-white/90">
              {datos.negocioNombre || "Tu negocio"}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[8.5px] uppercase tracking-wider text-white/55">
              {campos.encabezado.label}
            </span>
            <span className="block text-[14px] font-bold leading-tight text-white">
              {campos.encabezado.value}
            </span>
          </span>
        </div>

        <Tira
          tira={tira}
          colores={colores}
          saldo={saldo}
          sello={sello}
          diseno={datos.diseno ?? CONFIG_CLASICA}
        />

        <div className="mt-3">
          <span className="block text-[8.5px] uppercase tracking-wider text-white/55">
            {campos.detalle.label}
          </span>
          <span className="block text-[12px] leading-snug text-white/90">
            {campos.detalle.value}
          </span>
        </div>

        {campos.regalia && (
          <div className="mt-2.5">
            <span className="block text-[8.5px] uppercase tracking-wider text-white/55">
              {campos.regalia.label}
            </span>
            <span className="block text-[12px] font-medium text-white">
              {campos.regalia.value}
            </span>
          </div>
        )}
      </div>

      {/* El QR va sobre blanco SIEMPRE: sobre el color de la marca no
          se escanea, y ese es el único trabajo que tiene. */}
      <div className="qr-claro mt-4 bg-white px-4 py-3.5">
        <CodigoDibujado semilla={datos.negocioNombre || "bookea"} lado={86} />
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}

/**
 * EL STRIP: la franja de abajo del encabezado.
 *
 * Es una sola imagen y por eso acá es un solo bloque. La foto va de
 * fondo, el velo oscuro encima —el mismo que pone el generador, si no
 * los sellos apagados desaparecen sobre una foto clara— y los círculos
 * arriba de todo. La proporción es la de Apple (375×123): un strip más
 * alto en la maqueta que en el teléfono le hace creer al negocio que su
 * foto se va a ver entera.
 */
function Tira({
  tira,
  colores,
  saldo,
  sello,
  diseno,
}: {
  tira: TiraDelPase;
  colores: { fondo: string; sello: string };
  saldo: number;
  /** Qué lleva cada sello (0145/0174). «logo» = el círculo liso de siempre. */
  sello: DibujoDelSello;
  /** Dónde va cada uno (0212). Es EL MISMO objeto que recibe sharp. */
  diseno: ConfigTira;
}) {
  if (tira.tipo === "ninguna") return null;

  /* El MISMO cálculo que usa el servidor para componer el PNG del pase
     (`layoutDeLaTira`, en lib/wallet). Se resuelve en el espacio de
     Apple —375×123— y abajo se convierte a porcentaje, así el dibujo
     escala con el ancho que la previa tenga en pantalla sin recalcular
     nada y sin medir con JavaScript. */
  const layout = layoutDeLaTira(tira.tipo === "sellos" ? tira.total : 0, diseno);

  return (
    <div
      /* `container-type: inline-size` es lo que hace que las unidades
         `cqw` de los sellos se resuelvan contra ESTE ancho y no contra
         el de la ventana. Sin esto los sellos salen del tamaño de la
         pantalla. */
      className="relative mt-3 overflow-hidden rounded-lg [container-type:inline-size]"
      style={{ aspectRatio: "375 / 123", background: colores.fondo }}
    >
      {tira.banda ? (
        /* eslint-disable-next-line @next/next/no-img-element -- URL
           externa del negocio, y acá es una maqueta. */
        <img src={tira.banda} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}

      {tira.tipo === "sellos" && (
        <>
          {tira.banda ? (
            <span aria-hidden className="absolute inset-0" style={{ background: "rgba(0,0,0,.42)" }} />
          ) : null}
          {/* ⚠️ ACÁ HABÍA UN SEGUNDO ALGORITMO DE LAYOUT, Y MENTÍA.
              Era `flex flex-wrap justify-center gap-1.5` con sellos de
              20px fijos y un tope de 20 dibujados. El pase real usa una
              grilla calculada: filas según la meta, diámetro según el
              espacio, márgenes en porcentaje. O sea que el dueño
              diseñaba mirando una cosa y su cliente recibía otra —y con
              metas de más de 20 sellos, la previa directamente mostraba
              menos de los que hay.

              Ahora las posiciones salen de `layoutDeLaTira`, la MISMA
              función que usa el servidor para componer el PNG. Se
              calcula en el espacio de Apple (375×123) y se convierte a
              porcentaje, así el dibujo escala con el ancho que tenga la
              previa en pantalla sin recalcular nada. */}
          <div className="absolute inset-0">
            {layout.posiciones.map((pos, i) => {
              const estilo: React.CSSProperties = {
                position: "absolute",
                left: `${(pos.x / layout.ancho) * 100}%`,
                top: `${(pos.y / layout.alto) * 100}%`,
                width: `${(layout.diametro / layout.ancho) * 100}%`,
                aspectRatio: "1 / 1",
              };
              return (
                <span key={i} style={estilo}>
                  {sello.clase === "icono" ? (
                    // Con icono: LLENO el ganado, CONTORNO el que falta —
                    // lo mismo que dibuja `dibujarTiraDeSellos` en el pase.
                    <SelloConIcono
                      icono={sello.icono}
                      encendido={i < saldo}
                      colorFondo={colores.fondo}
                      colorSello={colores.sello}
                      lado={(layout.diametro / layout.ancho) * 100}
                      unidad="cqw"
                    />
                  ) : sello.clase === "propio" ? (
                    // Con el ícono propio: disco blanco con la imagen
                    // adentro, tenue el que falta. Es lo que dibuja
                    // `selloRedondo` — el mismo camino del logo.
                    <SelloConImagen
                      url={sello.url}
                      encendido={i < saldo}
                      lado={(layout.diametro / layout.ancho) * 100}
                      unidad="cqw"
                    />
                  ) : (
                    <span
                      className="block h-full w-full rounded-full transition-opacity"
                      style={{ background: colores.sello, opacity: i < saldo ? 1 : 0.26 }}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * EL CÓDIGO DEL PASE, dibujado.
 *
 * Era un cuadrado oscuro macizo, y un cuadrado macizo no se lee como
 * «código»: se lee como una imagen que no cargó. Con los tres ojos de
 * esquina y módulos adentro el ojo lo reconoce al toque, que es todo
 * lo que tiene que hacer en una vista previa.
 *
 * El patrón sale del nombre del negocio y NO de `Math.random()`: el
 * servidor y el cliente tienen que pintar lo mismo o React tira
 * hydration mismatch. De yapa, cada negocio tiene su propio dibujo.
 */
function CodigoDibujado({ semilla, lado }: { semilla: string; lado: number }) {
  const MODULOS = 21; // el tamaño de un QR de verdad (versión 1)
  const px = lado / MODULOS;

  // FNV-1a: barato, determinista y suficiente para un dibujo.
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h = Math.imul(h ^ semilla.charCodeAt(i), 16777619) >>> 0;
  }

  const celdas: boolean[] = [];
  for (let i = 0; i < MODULOS * MODULOS; i++) {
    const f = Math.floor(i / MODULOS);
    const c = i % MODULOS;
    // Los tres ojos: bloque 7×7 con marco y centro, como el estándar.
    const enOjo = [
      [0, 0],
      [0, MODULOS - 7],
      [MODULOS - 7, 0],
    ].some(([of, oc]) => {
      const df = f - of;
      const dc = c - oc;
      if (df < 0 || df > 6 || dc < 0 || dc > 6) return false;
      const borde = df === 0 || df === 6 || dc === 0 || dc === 6;
      const centro = df >= 2 && df <= 4 && dc >= 2 && dc <= 4;
      return borde || centro;
    });
    const enHueco = [
      [0, 0],
      [0, MODULOS - 8],
      [MODULOS - 8, 0],
    ].some(([of, oc]) => f - of >= 0 && f - of <= 7 && c - oc >= 0 && c - oc <= 7);

    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    celdas.push(enOjo || (!enHueco && (h >>> 16) % 100 < 45));
  }

  return (
    <div
      aria-hidden
      className="mx-auto grid"
      style={{ gridTemplateColumns: `repeat(${MODULOS}, ${px}px)`, width: lado }}
    >
      {celdas.map((lleno, i) => (
        <span
          key={i}
          style={{ height: px, width: px, background: lleno ? "#0a1226" : "transparent" }}
        />
      ))}
    </div>
  );
}

// ── Google ─────────────────────────────────────────────────────────
// Otro layout de verdad, no el de Apple recoloreado: Google pone el
// título grande arriba, el logo en círculo, y el código de barras al
// pie sobre el mismo fondo de la tarjeta.

function TarjetaGoogle({
  datos,
  campos,
  colores,
}: {
  datos: DatosVista;
  campos: CamposTarjeta;
  colores: { fondo: string; sello: string };
}) {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl bg-white shadow-flotante">
      <div className="px-4 py-4" style={{ background: colores.fondo }}>
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white/90 text-[11px] font-extrabold"
            style={{ color: colores.fondo }}
          >
            {datos.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={datos.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (datos.negocioNombre || "B").slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="min-w-0 truncate text-[12.5px] font-medium text-white/90">
            {datos.negocioNombre || "Tu negocio"}
          </span>
        </div>

        <p className="mt-3 text-[10px] uppercase tracking-wider text-white/60">
          {campos.encabezado.label}
        </p>
        <p className="text-[26px] font-extrabold leading-none text-white">
          {campos.encabezado.value}
        </p>
      </div>

      {/* En Android la banda es el `heroImage` del objeto y va debajo
          del encabezado, a lo ancho. Acá no se dibujaba nada: el mismo
          negocio veía su foto en la pestaña de Apple y no en la de
          Google, sin que hubiera ninguna diferencia real. */}
      {datos.bannerUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={datos.bannerUrl}
          alt=""
          className="w-full object-cover"
          style={{ aspectRatio: "1032 / 336" }}
        />
      ) : null}

      <div className="px-4 py-3.5">
        <p className="text-[9px] uppercase tracking-wider text-[#53657f]">
          {campos.detalle.label}
        </p>
        <p className="text-[12.5px] leading-snug text-[#10203a]">{campos.detalle.value}</p>

        {campos.regalia && (
          <>
            <p className="mt-2.5 text-[9px] uppercase tracking-wider text-[#53657f]">
              {campos.regalia.label}
            </p>
            <p className="text-[12.5px] font-medium text-[#10203a]">{campos.regalia.value}</p>
          </>
        )}

        <div className="qr-claro mt-3.5 rounded-md bg-white py-1.5">
          <CodigoDibujado semilla={datos.negocioNombre || "bookea"} lado={52} />
        </div>
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}
