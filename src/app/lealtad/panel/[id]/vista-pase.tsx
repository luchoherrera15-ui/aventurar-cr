"use client";

import { useState } from "react";
import { camposSegunModo, coloresDe, type CamposTarjeta } from "@/lib/wallet/tarjeta";
import { metaDe, tipoDe, type ConfigBeneficio } from "@/lib/lealtad/tipos-tarjeta";

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

  const campos = camposSegunModo({
    negocioNombre: datos.negocioNombre || "Tu negocio",
    saldo,
    meta: meta ? { nombre: nombreDeLaMeta(datos.beneficio), costo_puntos: meta } : null,
    config: {
      modo: tipo,
      pase_color_fondo: datos.colorFondo,
      pase_color_sello: datos.colorSello,
      pase_logo_url: datos.logoUrl,
    },
    beneficio: datos.beneficio,
    serialNumber: "EJEMPLO",
    passTypeIdentifier: "",
    teamIdentifier: "",
  });

  const colores = coloresDe({
    modo: tipo,
    pase_color_fondo: datos.colorFondo,
    pase_color_sello: datos.colorSello,
    pase_logo_url: datos.logoUrl,
  });

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
          <TarjetaApple datos={datos} campos={campos} colores={colores} tipo={tipo} saldo={saldo} meta={meta} />
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
  tipo,
  saldo,
  meta,
}: {
  datos: DatosVista;
  campos: CamposTarjeta;
  colores: { fondo: string; sello: string };
  tipo: string;
  saldo: number;
  meta: number | null;
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

        {datos.bannerUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={datos.bannerUrl}
            alt=""
            className="mt-3 h-[74px] w-full rounded-lg object-cover"
          />
        ) : null}

        {/* Los sellos solo tienen sentido en la tarjeta que acumula de
            a uno. En puntos o cashback, ese número no son «cosas» que
            se dibujen. */}
        {tipo === "sellos" && meta !== null && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(meta, 20) }, (_, i) => (
              <span
                key={i}
                className="h-5 w-5 rounded-full transition-opacity"
                style={{ background: colores.sello, opacity: i < saldo ? 1 : 0.24 }}
              />
            ))}
          </div>
        )}

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
      <div className="mt-4 bg-white px-4 py-3.5">
        <div className="mx-auto h-[86px] w-[86px] rounded-md bg-[#0a1226]" aria-hidden />
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
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

        <div className="mt-3.5 h-[52px] w-full rounded-md bg-[#0a1226]" aria-hidden />
        <p className="mt-1.5 text-center text-[8.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}
