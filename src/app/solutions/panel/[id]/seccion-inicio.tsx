import Link from "next/link";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CIFRA,
  ROTULO_CIFRA,
} from "@/components/panel/sistema";
import { IconCheck, IconStar } from "@/components/icons";
import type { NegocioSolutions } from "@/lib/solutions/tipos";

/**
 * INICIO — el tablero que abre el panel.
 *
 * Pedido del dueño (4 sep 2026): «al entrar habrá un dashboard que dirá
 * qué paquetes están incluidos en lo que se está utilizando».
 *
 * ── QUÉ MUESTRA Y QUÉ NO ───────────────────────────────────────────
 * Todo lo de acá sale de datos REALES que la página ya cargó: no hay
 * una consulta nueva ni un número inventado. Es la regla del panel
 * (`piezas.tsx`): una tarjeta sin dato real es peor que una tarjeta de
 * menos, porque un cero de relleno se lee como un dato.
 *
 * Por eso NO hay «visitas» ni «escaneos»: hoy no se miden. El día que
 * se midan, entran acá.
 *
 * ── EL ORDEN ES EL DEL TRABAJO ─────────────────────────────────────
 * Primero lo que falta para estar en la calle (la lista de armado),
 * después lo que ya está funcionando, y al final qué trae el plan. Es
 * el mismo criterio que el tablero de mi-negocio: el trabajo primero,
 * los números después.
 */

type Paso = {
  clave: string;
  titulo: string;
  detalle: string;
  listo: boolean;
  href: string;
  accion: string;
};

export default function SeccionInicio({
  negocio,
  urlPublica,
  totalLinks,
  totalPlatos,
  totalSecciones,
  comandasHoy,
  tieneLealtad,
}: {
  negocio: NegocioSolutions;
  urlPublica: string;
  totalLinks: number;
  totalPlatos: number;
  totalSecciones: number;
  comandasHoy: number;
  /**
   * ¿Esta CUENTA ya tiene alguna tarjeta en Bookea Lealtad?
   *
   * Ojo con lo que significa: es por cuenta, no por este negocio —
   * Lealtad vive sobre `ranchos` y Solutions sobre sus propias tablas,
   * así que no hay forma de decir «la tarjeta ES de este local». Sirve
   * para lo único que se usa acá: decidir si vale la pena ofrecerla.
   * Por eso el texto dice «tenés una», no «la de este local».
   */
  tieneLealtad: boolean;
}) {
  const base = `/solutions/panel/${negocio.id}`;

  const pasos: Paso[] = [
    {
      clave: "marca",
      titulo: "Ponele tu marca",
      detalle: "Logo, foto de portada y los colores de tu local.",
      listo: Boolean(negocio.logo_url || negocio.foto_portada_url),
      href: `${base}?tab=pagina`,
      accion: "Elegir el diseño",
    },
    {
      clave: "carta",
      titulo: "Cargá tu carta",
      detalle: "Secciones, platos, fotos y precios.",
      listo: totalPlatos > 0,
      href: `${base}?tab=menu`,
      accion: "Agregar platos",
    },
    {
      clave: "enlaces",
      titulo: "Sumá tus enlaces",
      detalle: "Instagram, reservas, cómo llegar, lo que uses.",
      listo: totalLinks > 0,
      href: `${base}?tab=links`,
      accion: "Agregar enlaces",
    },
    {
      clave: "contacto",
      titulo: "Dejá tu contacto",
      detalle: "WhatsApp y dirección, para que te encuentren.",
      listo: Boolean(negocio.whatsapp || negocio.direccion),
      href: `${base}?tab=pagina`,
      accion: "Completar",
    },
    {
      clave: "mesas",
      titulo: "Imprimí tus QR de mesa",
      detalle: "Uno por mesa, para que pidan desde el teléfono.",
      listo: negocio.mesas > 0,
      href: `${base}/mesas`,
      accion: "Generar los QR",
    },
  ];

  const hechos = pasos.filter((p) => p.listo).length;
  const avance = Math.round((hechos / pasos.length) * 100);
  const faltan = pasos.filter((p) => !p.listo);

  /** Lo que el negocio TIENE prendido hoy, con su costo real. */
  const incluido = [
    {
      t: "Tu página pública",
      d: urlPublica.replace(/^https?:\/\//, ""),
      activo: negocio.publicado,
      plan: "Gratis",
    },
    {
      t: "Carta digital",
      d: totalPlatos > 0 ? `${totalPlatos} platos en ${totalSecciones || 1} secciones` : "Sin platos todavía",
      activo: negocio.mostrar_menu && totalPlatos > 0,
      plan: "Gratis",
    },
    {
      t: "Pedidos desde la mesa",
      d: negocio.acepta_pedidos
        ? `${negocio.mesas} ${negocio.mesas === 1 ? "mesa" : "mesas"} · sin comisión`
        : "Apagado",
      activo: negocio.acepta_pedidos,
      plan: "Gratis",
    },
    {
      t: "Tarjeta de lealtad",
      d: tieneLealtad ? "Ya tenés una en tu cuenta de Lealtad" : "No la tenés todavía",
      activo: tieneLealtad,
      plan: "Aparte",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ── LO QUE FALTA PARA ESTAR EN LA CALLE ──────────────────── */}
      <Card
        eyebrow="Tu sitio"
        titulo={avance === 100 ? "Tu sitio está completo" : "Terminá de armar tu sitio"}
        accion={
          <PildoraEstado estado={avance === 100 ? "exito" : "aviso"}>
            {hechos} de {pasos.length}
          </PildoraEstado>
        }
      >
        {/* La barra es el ÚNICO adorno, y dice algo: cuánto falta. */}
        <div className="h-2 overflow-hidden rounded-full bg-aventurea-cream-2" role="presentation">
          <div
            className="h-full rounded-full bg-aventurea-navy transition-[width] duration-500"
            style={{ width: `${avance}%` }}
          />
        </div>

        {faltan.length === 0 ? (
          <p className="mt-3.5 flex items-center gap-2 text-[13.5px] text-aventurea-ink">
            <IconCheck className="h-4 w-4 text-green-700" />
            Todo listo. Tu página está publicada y lista para el QR.
          </p>
        ) : (
          <ul className="mt-3.5 flex flex-col divide-y divide-aventurea-line">
            {faltan.map((p) => (
              <li key={p.clave} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-aventurea-ink">{p.titulo}</span>
                  <span className="block text-[12.5px] text-aventurea-ink-soft">{p.detalle}</span>
                </span>
                <Link href={p.href} className={BOTON_PANEL}>
                  {p.accion} →
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hechos > 0 && faltan.length > 0 && (
          <p className="mt-3 text-[12px] text-aventurea-ink-soft">
            Ya hiciste: {pasos.filter((p) => p.listo).map((p) => p.titulo.toLowerCase()).join(", ")}.
          </p>
        )}
      </Card>

      {/* ── LO QUE ESTÁ FUNCIONANDO HOY ──────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { r: "Comandas hoy", v: String(comandasHoy) },
          { r: "Platos en la carta", v: String(totalPlatos) },
          { r: "Enlaces visibles", v: String(totalLinks) },
        ].map((m) => (
          <div key={m.r} className="rounded-2xl border border-aventurea-line bg-white p-4">
            <p className={ROTULO_CIFRA}>{m.r}</p>
            <p className={CIFRA}>{m.v}</p>
          </div>
        ))}
      </div>

      {/* ── QUÉ TRAE TU PLAN ─────────────────────────────────────── */}
      <Card
        eyebrow="Tu plan"
        titulo="Qué estás usando"
        accion={<PildoraEstado estado="info">Gratis</PildoraEstado>}
      >
        <ul className="flex flex-col divide-y divide-aventurea-line">
          {incluido.map((x) => (
            <li key={x.t} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  x.activo ? "bg-green-50 text-green-700" : "bg-aventurea-cream-2 text-aventurea-ink-soft"
                }`}
              >
                {x.activo ? <IconCheck className="h-4 w-4" /> : <span className="text-[13px]">·</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-aventurea-ink">{x.t}</span>
                <span className="block truncate text-[12.5px] text-aventurea-ink-soft">{x.d}</span>
              </span>
              <span className="shrink-0 text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">
                {x.plan}
              </span>
            </li>
          ))}
        </ul>

        {!tieneLealtad && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-aventurea-line bg-[#f7f9fc] p-3.5">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{ background: "var(--accion-suave)", color: "var(--accion)" }}
            >
              <IconStar className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-aventurea-ink">
                Sumale una tarjeta de lealtad
              </span>
              <span className="block text-[12.5px] leading-snug text-aventurea-ink-soft">
                Sellos o puntos en Apple y Google Wallet. Se arma con esta misma cuenta y aparece
                como una puerta más en tu página.
              </span>
            </span>
            <Link href="/lealtad/crear" className={BOTON_PANEL_PRIMARIO}>
              Ver Lealtad →
            </Link>
          </div>
        )}
      </Card>

      {/* ── EL ENLACE, SIEMPRE A MANO ────────────────────────────── */}
      <Card eyebrow="Tu página en la calle" titulo="Compartí tu enlace">
        <p className="break-all text-[14px] font-bold text-aventurea-navy">{urlPublica}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={urlPublica} target="_blank" rel="noopener noreferrer" className={BOTON_PANEL}>
            Ver como cliente →
          </a>
          <Link href={`${base}/mesas`} className={BOTON_PANEL}>
            Imprimir QR de mesas →
          </Link>
        </div>
      </Card>
    </div>
  );
}
