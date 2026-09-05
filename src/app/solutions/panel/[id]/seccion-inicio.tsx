import Link from "next/link";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, CIFRA, ROTULO_CIFRA } from "@/components/panel/sistema";
import { IconCheck } from "@/components/icons";
import { fmtColones } from "@/lib/finanzas";
import { ADDON, ADDONS, type EstadoAddons } from "@/lib/solutions/addons";
import type { NegocioSolutions } from "@/lib/solutions/tipos";
import AddonToggle from "./addon-toggle";
import EscanerSolutions from "./escaner-solutions";
import type { EscanerLealtad } from "@/lib/solutions/lealtad-puente";

/**
 * INICIO — el tablero que abre el panel.
 *
 * Pedido del dueño (4 sep 2026): «una cuenta principal; a base de eso
 * el negocio tiene add-ons que se venden por separado. Lo primero, lo
 * gratuito, es el link hub; de ahí la persona dice qué quiere añadir».
 *
 * ── EL FLUJO DE UNA EMPRESA QUE VENDE SERVICIOS ────────────────────
 *   1. La persona crea UNA cuenta de Bookea (la misma para todo).
 *   2. Crea su negocio: ya tiene su link hub, gratis, en la calle.
 *   3. Acá, en Inicio, ve qué tiene y qué puede agregar — con precio.
 *   4. Agrega el menú, los pedidos o la tarjeta cuando los necesite.
 *   5. El rail de la izquierda se arma con lo que tiene prendido.
 *
 * Por eso esta pantalla tiene TRES bloques y en este orden: lo que
 * falta para estar en la calle (el trabajo), lo que está funcionando
 * (los números reales) y los add-ons (lo que se vende). El trabajo
 * primero, la venta después: a un tablero que abre vendiendo no se le
 * cree.
 *
 * ── QUÉ MUESTRA Y QUÉ NO ───────────────────────────────────────────
 * Todo sale de datos REALES que la página ya cargó: ni una consulta
 * nueva ni un número inventado. Es la regla del panel (`piezas.tsx`):
 * una tarjeta sin dato real es peor que una tarjeta de menos. Por eso
 * NO hay «visitas» ni «escaneos»: hoy no se miden.
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
  addons,
  puedeEditar,
  escaneres,
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
   * Es por cuenta, no por este negocio — Lealtad vive sobre `ranchos` y
   * Solutions sobre sus propias tablas, así que no hay forma de decir
   * «la tarjeta ES de este local». Sirve para lo único que se usa acá:
   * dar el add-on por puesto aunque la fila de Solutions no exista.
   */
  tieneLealtad: boolean;
  /** Qué tiene prendido el negocio (0233). */
  addons: EstadoAddons;
  puedeEditar: boolean;
  /** Los escáneres de pases de la cuenta (5 sep 2026). Vacío = no se muestra. */
  escaneres: EscanerLealtad[];
}) {
  const base = `/solutions/panel/${negocio.id}`;
  const lealtadActiva = addons.lealtad || tieneLealtad;

  // ── Los pasos: solo los de lo que el negocio TIENE ────────────────
  // Sin el add-on de menú, «cargá tu menú» sería pedirle que haga algo
  // que no puede; sin el de pedidos, los QR de mesa no llevan a nada.
  const pasos: Paso[] = [
    {
      clave: "marca",
      titulo: "Ponele tu marca",
      detalle: "Logo, foto de portada, fuente y colores de tu local.",
      listo: Boolean(negocio.logo_url || negocio.foto_portada_url),
      href: `${base}?tab=pagina`,
      accion: "Elegir el diseño",
    },
    {
      clave: "enlaces",
      titulo: "Sumá tus enlaces",
      detalle: "Instagram, reservas, cómo llegar, lo que uses.",
      listo: totalLinks > 0,
      href: `${base}?tab=pagina#enlaces`,
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
  ];
  if (addons.menu) {
    pasos.push({
      clave: "menu",
      titulo: "Cargá tu menú",
      detalle: "Secciones, platos, fotos y precios.",
      listo: totalPlatos > 0,
      href: `${base}?tab=menu`,
      accion: "Agregar platos",
    });
  }
  if (addons.pedidos) {
    pasos.push({
      clave: "pedidos",
      titulo: "Decidí cómo recibís pedidos",
      detalle: "Desde la mesa, To go o exprés, y con qué se paga.",
      listo: negocio.acepta_pedidos || negocio.pedidos_llevar || negocio.pedidos_express,
      href: `${base}?tab=pagina`,
      accion: "Configurar",
    });
    if (negocio.acepta_pedidos) {
      pasos.push({
        clave: "mesas",
        titulo: "Imprimí tus QR de mesa",
        detalle: "Uno por mesa, para que pidan desde el teléfono.",
        listo: negocio.mesas > 0,
        href: `${base}/mesas`,
        accion: "Generar los QR",
      });
    }
  }

  const hechos = pasos.filter((p) => p.listo).length;
  const avance = Math.round((hechos / pasos.length) * 100);
  const faltan = pasos.filter((p) => !p.listo);

  // ── Los números: solo los que tienen algo detrás ──────────────────
  const metricas: { r: string; v: string }[] = [{ r: "Enlaces visibles", v: String(totalLinks) }];
  if (addons.menu) metricas.push({ r: "Platos en el menú", v: String(totalPlatos) });
  if (addons.pedidos) metricas.push({ r: "Pedidos hoy", v: String(comandasHoy) });

  /** Qué dice cada add-on debajo del nombre, con lo que el negocio ya hizo. */
  const detalleDe = (id: (typeof ADDONS)[number]): string => {
    if (id === "linkhub") return urlPublica.replace(/^https?:\/\//, "");
    if (id === "menu" && addons.menu) return totalPlatos > 0 ? `${totalPlatos} platos en ${totalSecciones || 1} secciones` : "Sin platos todavía";
    if (id === "pedidos" && addons.pedidos) {
      const modos = [
        negocio.acepta_pedidos && `mesa (${negocio.mesas})`,
        negocio.pedidos_llevar && "to go",
        negocio.pedidos_express && "exprés",
      ].filter(Boolean);
      return modos.length > 0 ? `${modos.join(" · ")} · sin comisión` : "Sin modalidad elegida todavía";
    }
    if (id === "lealtad" && lealtadActiva) return "Ya tenés una tarjeta en tu cuenta de Lealtad";
    return ADDON[id].pie;
  };

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
      </Card>

      {/* ── EL ESCÁNER DE PASES (dueño, 5 sep 2026) ──────────────
          Solo cuando la cuenta tiene una tarjeta de Lealtad con la que
          acreditar. Es el mismo escáner del panel de Lealtad, montado
          acá para que la caja no cambie de producto para sumar un
          sello. */}
      {escaneres.length > 0 && (
        <Card eyebrow="Tu tarjeta de lealtad" titulo="Escanear el pase de un cliente">
          <p className="mb-3 text-[12.5px] leading-snug text-aventurea-ink-soft">
            Apuntá la cámara al QR del pase y se le suma el sello o los puntos. La cámara se pide
            recién al tocar el botón.
          </p>
          <EscanerSolutions opciones={escaneres} />
        </Card>
      )}

      {/* ── LO QUE ESTÁ FUNCIONANDO HOY ──────────────────────────── */}
      <div className={`grid gap-3 ${metricas.length === 3 ? "sm:grid-cols-3" : metricas.length === 2 ? "sm:grid-cols-2" : ""}`}>
        {metricas.map((m) => (
          <div key={m.r} className="rounded-2xl border border-aventurea-line bg-white p-4">
            <p className={ROTULO_CIFRA}>{m.r}</p>
            <p className={CIFRA}>{m.v}</p>
          </div>
        ))}
      </div>

      {/* ── LOS ADD-ONS: LO QUE TENÉS Y LO QUE PODÉS AGREGAR ─────── */}
      <Card
        eyebrow="Tu cuenta"
        titulo="Tus add-ons"
        accion={<PildoraEstado estado="info">Todo en ₡0 mientras dure la prueba</PildoraEstado>}
      >
        <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
          Una cuenta, tu negocio, y los add-ons que quieras. El link hub viene incluido; el resto lo
          agregás cuando lo necesités y lo apagás cuando quieras.
        </p>
        <ul className="mt-3 flex flex-col divide-y divide-aventurea-line">
          {ADDONS.map((id) => {
            const def = ADDON[id];
            const activo = id === "lealtad" ? lealtadActiva : addons[id];
            const precio = def.incluido ? "Gratis" : def.precioMes === 0 ? "₡0 · en prueba" : `${fmtColones(def.precioMes)}/mes`;
            return (
              <li key={id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  aria-hidden
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    activo ? "bg-green-50 text-green-700" : "bg-aventurea-cream-2 text-aventurea-ink-soft"
                  }`}
                >
                  {activo ? <IconCheck className="h-4 w-4" /> : <span className="text-[13px]">·</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[14px] font-bold text-aventurea-ink">{def.nombre}</span>
                    <span className="text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">
                      {precio}
                    </span>
                  </span>
                  <span className="block truncate text-[12.5px] text-aventurea-ink-soft">{detalleDe(id)}</span>
                  {!activo && (
                    <span className="mt-0.5 block text-[11.5px] text-aventurea-ink-soft">
                      {def.incluye.join(" · ")}
                    </span>
                  )}
                </span>
                <AddonToggle
                  negocioId={negocio.id}
                  addon={id}
                  activo={activo}
                  incluido={def.incluido}
                  externoHref={id === "lealtad" ? (lealtadActiva ? "/lealtad/panel" : def.externo?.href) : undefined}
                  puedeEditar={puedeEditar}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ── EL ENLACE, SIEMPRE A MANO ────────────────────────────── */}
      <Card eyebrow="Tu página en la calle" titulo="Compartí tu enlace">
        <p className="break-all text-[14px] font-bold text-aventurea-navy">{urlPublica}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={urlPublica} target="_blank" rel="noopener noreferrer" className={BOTON_PANEL}>
            Ver como cliente →
          </a>
          {addons.pedidos && negocio.acepta_pedidos && (
            <Link href={`${base}/mesas`} className={BOTON_PANEL}>
              Imprimir QR de mesas →
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
