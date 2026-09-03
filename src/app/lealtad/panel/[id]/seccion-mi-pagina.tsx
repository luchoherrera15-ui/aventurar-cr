"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { CAMPO_PANEL, ESTADO_AVISO, ROTULO_CAMPO } from "@/components/panel/sistema";
import SubirImagen from "@/components/subir-imagen";
import { TOPE_MESAS, type PaginaLealtad, type QrDestino } from "@/lib/lealtad/pagina-negocio";
import { ACCION, ACCION_TINTA, BOTON_ACCION, BOTON_LEALTAD } from "../sistema-lealtad";
import { guardarPaginaLealtad } from "./pagina-actions";

/**
 * MI PÁGINA — el editor de la página pública /r/<slug> (0229).
 *
 * La pantalla edita SOLO lo no derivable: publicada, bajada, foto de
 * portada, promo, destino del QR y la prevista de mesas. El menú vive
 * en el catálogo del negocio (rancho_items) y la marca en la tarjeta —
 * por eso acá hay LINKS a esos editores, no copias de ellos (dos
 * pantallas editando lo mismo es el bug de mañana).
 *
 * El QR que se muestra apunta a /r/<slug> y es para hojas NUEVAS: el
 * QR viejo de /tarjeta/<slug> ya impreso no cambia de destino nunca
 * (esa garantía vive en programa-principal.ts y esta pantalla no la
 * toca).
 */

export default function SeccionMiPagina({
  ranchoId,
  slug,
  pagina,
  svgQr,
  urlPublica,
}: {
  ranchoId: string;
  slug: string | null;
  pagina: PaginaLealtad | null;
  svgQr: string | null;
  urlPublica: string | null;
}) {
  const [publicada, setPublicada] = useState(pagina?.publicada ?? true);
  const [bajada, setBajada] = useState(pagina?.bajada ?? "");
  const [foto, setFoto] = useState(pagina?.foto_portada_url ?? "");
  const [promoTitulo, setPromoTitulo] = useState(pagina?.promo_titulo ?? "");
  const [promoDetalle, setPromoDetalle] = useState(pagina?.promo_detalle ?? "");
  const [promoActiva, setPromoActiva] = useState(pagina?.promo_activa ?? false);
  const [qrDestino, setQrDestino] = useState<QrDestino>(pagina?.qr_destino ?? "portada");
  const [mostrarMenu, setMostrarMenu] = useState(pagina?.mostrar_menu ?? true);
  const [mesas, setMesas] = useState(pagina?.mesas ?? 0);
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [guardando, arrancar] = useTransition();

  const guardar = () => {
    setMensaje(null);
    arrancar(async () => {
      const r = await guardarPaginaLealtad(ranchoId, {
        publicada,
        bajada,
        fotoPortadaUrl: foto,
        promoTitulo,
        promoDetalle,
        promoActiva,
        qrDestino,
        mostrarMenu,
        mesas,
      });
      setMensaje(
        r.ok
          ? { tono: "exito", texto: "Guardado. Los cambios ya están en tu página." }
          : { tono: "alerta", texto: r.motivo },
      );
    });
  };

  if (!slug) {
    return (
      <Card eyebrow="Tu página" titulo="Mi página">
        <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
          Tu negocio todavía no tiene dirección pública. Al publicar tu tarjeta se le crea
          su enlace, y con él la página.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── El estado y el QR ─────────────────────────────────────── */}
      <Card
        eyebrow="Tu página en la calle"
        titulo="El link y el QR"
        /* Sin fila todavía (negocio anterior a la 0229): decir
           «Publicada» con un QR que da 404 sería mentirle — la página
           nace con el primer «Guardar». */
        accion={
          <PildoraEstado estado={pagina ? (publicada ? "info" : "neutro") : "aviso"}>
            {pagina ? (publicada ? "Publicada" : "Apagada") : "Sin crear"}
          </PildoraEstado>
        }
      >
        {!pagina && (
          <p className={`mb-4 rounded-xl p-3 text-[12.5px] leading-snug ${ESTADO_AVISO.info}`}>
            Tu página todavía no existe: revisá lo de abajo y tocá «Guardar la página» — con
            eso queda creada y en la calle. Hasta entonces, este QR lleva a una página vacía.
          </p>
        )}
        <div className="flex flex-wrap items-start gap-5">
          {svgQr && (
            <span
              aria-hidden
              className="block h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl border border-aventurea-line bg-white p-1.5 [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svgQr }}
            />
          )}
          <div className="min-w-0 flex-1">
            {urlPublica && (
              <p className="break-all text-[13.5px] font-bold text-aventurea-ink">{urlPublica}</p>
            )}
            <p className="mt-1 text-[12.5px] leading-snug text-aventurea-ink-soft">
              Este QR abre tu página: el menú, tu tarjeta y tu info, con tu marca. Es para
              impresiones nuevas — el QR viejo de tu tarjeta sigue funcionando igual que
              siempre.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/r/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={BOTON_LEALTAD}
              >
                Ver como cliente →
              </a>
            </div>

            <label className="mt-4 flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
              <input
                type="checkbox"
                checked={publicada}
                onChange={(e) => setPublicada(e.target.checked)}
                className="h-4 w-4"
              />
              Página publicada
            </label>

            <fieldset className="mt-3">
              <legend className={ROTULO_CAMPO}>El QR abre…</legend>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
                <label className="flex items-center gap-2 text-[13px] text-aventurea-ink">
                  <input
                    type="radio"
                    name="qr-destino"
                    checked={qrDestino === "portada"}
                    onChange={() => setQrDestino("portada")}
                  />
                  La portada (menú + tarjeta + info)
                </label>
                <label className="flex items-center gap-2 text-[13px] text-aventurea-ink">
                  <input
                    type="radio"
                    name="qr-destino"
                    checked={qrDestino === "menu"}
                    onChange={() => setQrDestino("menu")}
                  />
                  Directo al menú
                </label>
              </div>
            </fieldset>
          </div>
        </div>
      </Card>

      {/* ── La portada ────────────────────────────────────────────── */}
      <Card eyebrow="Cómo se ve" titulo="Portada">
        <label htmlFor="pagina-bajada" className={ROTULO_CAMPO}>
          La línea bajo tu nombre
        </label>
        <input
          id="pagina-bajada"
          type="text"
          value={bajada}
          onChange={(e) => setBajada(e.target.value)}
          maxLength={140}
          placeholder="Parrilla · Santa Ana · hasta las 10 p. m."
          className={`mt-1.5 ${CAMPO_PANEL}`}
        />
        <div className="mt-4">
          <SubirImagen
            valor={foto}
            alCambiar={setFoto}
            destino="banner"
            etiqueta="Foto de portada"
            carpeta="lealtad/portadas"
          />
          <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
            Sin foto, tu página se pinta con los colores de tu tarjeta.
          </p>
        </div>
      </Card>

      {/* ── La promo del día ──────────────────────────────────────── */}
      <Card eyebrow="Un renglón encendible" titulo="Promo del día">
        <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
          <input
            type="checkbox"
            checked={promoActiva}
            onChange={(e) => setPromoActiva(e.target.checked)}
            className="h-4 w-4"
          />
          Mostrarla en la página
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div>
            <label htmlFor="promo-titulo" className={ROTULO_CAMPO}>
              Título
            </label>
            <input
              id="promo-titulo"
              type="text"
              value={promoTitulo}
              onChange={(e) => setPromoTitulo(e.target.value)}
              maxLength={60}
              placeholder="Miércoles de chorizo"
              className={`mt-1.5 ${CAMPO_PANEL}`}
            />
          </div>
          <div>
            <label htmlFor="promo-detalle" className={ROTULO_CAMPO}>
              Detalle
            </label>
            <input
              id="promo-detalle"
              type="text"
              value={promoDetalle}
              onChange={(e) => setPromoDetalle(e.target.value)}
              maxLength={140}
              placeholder="Boca de chorizo por cuenta de la casa con tu casado"
              className={`mt-1.5 ${CAMPO_PANEL}`}
            />
          </div>
        </div>
      </Card>

      {/* ── El menú y las mesas ───────────────────────────────────── */}
      <Card eyebrow="Las puertas" titulo="Menú y mesas">
        <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
          <input
            type="checkbox"
            checked={mostrarMenu}
            onChange={(e) => setMostrarMenu(e.target.checked)}
            className="h-4 w-4"
          />
          Mostrar el menú en la página
        </label>
        <p className="mt-1.5 text-[12.5px] leading-snug text-aventurea-ink-soft">
          Los platos, fotos, secciones y precios se editan en el catálogo de tu negocio —
          la página los muestra tal cual los guardés.
        </p>
        <Link href={`/mi-negocio/${ranchoId}?tab=catalogo`} className={`mt-2.5 inline-flex ${BOTON_LEALTAD}`}>
          Editar tu menú →
        </Link>

        <div className="mt-5 border-t border-aventurea-line pt-4">
          <label htmlFor="pagina-mesas" className={ROTULO_CAMPO}>
            QRs de mesa (prevista de pedidos)
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <input
              id="pagina-mesas"
              type="number"
              min={0}
              max={TOPE_MESAS}
              value={mesas}
              onChange={(e) => setMesas(Math.max(0, Math.min(TOPE_MESAS, Number(e.target.value) || 0)))}
              className={`w-[110px] ${CAMPO_PANEL}`}
            />
            {/* `?mesas=` lleva el número RECIÉN tecleado: la hoja
                imprime la cantidad guardada por defecto, y sin el
                param el dueño que todavía no tocó «Guardar» imprimía
                otra cantidad. */}
            {mesas > 0 && (
              <Link
                href={`/lealtad/panel/${ranchoId}/poster/mesas?mesas=${mesas}`}
                className={BOTON_LEALTAD}
              >
                Imprimir la hoja de QRs →
              </Link>
            )}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-aventurea-ink-soft">
            Cada mesa tiene su propio QR (…/r/{slug}?mesa=4). Hoy todos abren tu página;
            cuando activemos pedidos, el sistema sabrá de qué mesa vino cada uno — sin
            reimprimir nada.
          </p>
        </div>
      </Card>

      {/* ── Guardar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* BOTON_ACCION es solo geometría — el color va por style, es
            el contrato del token (sistema-lealtad.ts). */}
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className={BOTON_ACCION}
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {guardando ? "Guardando…" : pagina ? "Guardar la página" : "Crear y publicar mi página"}
        </button>
        {mensaje && (
          <p
            className={`rounded-xl px-3 py-2 text-[12.5px] font-bold ${ESTADO_AVISO[mensaje.tono]}`}
            role="status"
          >
            {mensaje.texto}
          </p>
        )}
      </div>
    </div>
  );
}
