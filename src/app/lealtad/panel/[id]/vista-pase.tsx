"use client";

import { useState } from "react";
import {
  camposSegunModo,
  coloresDe,
  tiraDelPase,
  type CamposTarjeta,
  type ConfigPase,
  type MetaRecompensa,
  type TiraDelPase,
} from "@/lib/wallet/tarjeta";
import { metaDe, tipoDe, type ConfigBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import { iconoDelSello, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { SelloConIcono } from "./iconos";

/**
 * LA VISTA PREVIA DEL PASE, en vivo.
 *
 * La usa el creador de tarjetas y el editor del diseño. Una sola, no
 * una por pantalla: dos maquetas del mismo pase se separan en cuanto
 * alguien toca una, y a partir de ahí el negocio ve una cosa en el
 * creador y otra en el editor.
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
  /** El icono de cada sello (0145). null = el logo, como siempre. */
  iconoSello?: IconoSello | null;
  /** Saldo de ejemplo. Por defecto, la mitad de la meta. */
  saldoEjemplo?: number;
};

type Plataforma = "apple" | "google";

export default function VistaPase({ datos }: { datos: DatosVista }) {
  const [plataforma, setPlataforma] = useState<Plataforma>("apple");

  const tipo = tipoDe(datos.modo);
  const meta = metaDe(datos.beneficio);
  // A la mitad: una tarjeta al 0% se ve vacía y una al 100% se ve
  // terminada. La mitad es la que muestra que la cosa avanza.
  const saldo = datos.saldoEjemplo ?? (meta ? Math.floor(meta / 2) : 0);

  // UNA sola config para todo, igual que en el pase real: los textos,
  // los colores y el strip salen del mismo dato.
  const config: ConfigPase = {
    modo: tipo,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_logo_url: datos.logoUrl,
    pase_banner_url: datos.bannerUrl ?? null,
    // Por el MISMO filtro que el pase real: elegir un icono y después
    // cambiar el tipo a «cupón» no puede dejar la vista previa
    // dibujando sellos con dibujo mientras el teléfono no los tiene.
    pase_sello_icono: iconoDelSello({ tipo, icono: datos.iconoSello }),
  };
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
        style={{ background: "rgba(255,255,255,.08)" }}
      >
        {(["apple", "google"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={plataforma === p}
            onClick={() => setPlataforma(p)}
            className={`presionable rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
              plataforma === p ? "bg-white text-[#062653]" : "text-white/60 hover:text-white"
            }`}
          >
            {p === "apple" ? "Apple Wallet" : "Google Wallet"}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {plataforma === "apple" ? (
          <TarjetaApple
            datos={datos}
            campos={campos}
            colores={colores}
            tira={tira}
            saldo={saldo}
            icono={config.pase_sello_icono ?? null}
          />
        ) : (
          <TarjetaGoogle datos={datos} campos={campos} colores={colores} />
        )}
      </div>

      <p className="mt-3 text-center text-[11px] leading-snug text-white/40">
        Vista aproximada. La apariencia final puede variar según el dispositivo y la
        plataforma.
      </p>
    </div>
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
  icono,
}: {
  datos: DatosVista;
  campos: CamposTarjeta;
  colores: { fondo: string; sello: string };
  tira: TiraDelPase;
  saldo: number;
  /** El icono del sello, ya filtrado por tipo. */
  icono: IconoSello | null;
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

        <Tira tira={tira} colores={colores} saldo={saldo} icono={icono} />

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
  icono,
}: {
  tira: TiraDelPase;
  colores: { fondo: string; sello: string };
  saldo: number;
  /** El icono del sello (0145). null = el círculo liso de siempre. */
  icono: IconoSello | null;
}) {
  if (tira.tipo === "ninguna") return null;

  return (
    <div
      className="relative mt-3 overflow-hidden rounded-lg"
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
          <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-1.5 px-3">
            {Array.from({ length: Math.min(tira.total, 20) }, (_, i) =>
              icono ? (
                // Con icono: LLENO el ganado, CONTORNO el que falta —
                // lo mismo que dibuja `dibujarTiraDeSellos` en el pase.
                <SelloConIcono
                  key={i}
                  icono={icono}
                  encendido={i < saldo}
                  colorFondo={colores.fondo}
                  colorSello={colores.sello}
                  lado={20}
                />
              ) : (
                <span
                  key={i}
                  className="h-5 w-5 rounded-full transition-opacity"
                  style={{ background: colores.sello, opacity: i < saldo ? 1 : 0.26 }}
                />
              ),
            )}
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
