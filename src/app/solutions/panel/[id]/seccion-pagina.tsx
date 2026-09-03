"use client";

import { useState, useTransition } from "react";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ESTADO_AVISO, ROTULO_CAMPO } from "@/components/panel/sistema";
import SubirImagen from "@/components/subir-imagen";
import { TOPES, paletaDe, type NegocioSolutions } from "@/lib/solutions/tipos";
import { guardarPaginaSolutions } from "./actions";

/** MI PÁGINA — marca, portada, contacto e interruptores. Un solo «Guardar». */
export default function SeccionPagina({
  negocio,
  urlPublica,
  recienCreado,
}: {
  negocio: NegocioSolutions;
  urlPublica: string;
  recienCreado: boolean;
}) {
  const [f, setF] = useState({
    nombre: negocio.nombre,
    slug: negocio.slug,
    bajada: negocio.bajada,
    colorFondo: negocio.color_fondo,
    colorAcento: negocio.color_acento,
    logoUrl: negocio.logo_url ?? "",
    fotoPortadaUrl: negocio.foto_portada_url ?? "",
    whatsapp: negocio.whatsapp ?? "",
    direccion: negocio.direccion ?? "",
    publicado: negocio.publicado,
    mostrarMenu: negocio.mostrar_menu,
    aceptaPedidos: negocio.acepta_pedidos,
    mesas: negocio.mesas,
  });
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [guardando, arrancar] = useTransition();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const paleta = paletaDe(f.colorFondo, f.colorAcento);

  const guardar = () => {
    setMsg(null);
    arrancar(async () => {
      const r = await guardarPaginaSolutions(negocio.id, f);
      setMsg(r.ok ? { tono: "exito", texto: "Guardado. Ya está en tu página." } : { tono: "alerta", texto: r.motivo });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {recienCreado && (
        <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
          ¡Tu negocio ya existe! Ponele tu marca acá, cargá la carta en «La carta» y agregá tus enlaces. Cuando
          quieras, imprimí los QR de mesa.
        </p>
      )}

      <Card
        eyebrow="Tu página en la calle"
        titulo="El enlace"
        accion={<PildoraEstado estado={f.publicado ? "info" : "neutro"}>{f.publicado ? "Publicada" : "Apagada"}</PildoraEstado>}
      >
        <p className="break-all text-[13.5px] font-bold text-aventurea-ink">{urlPublica}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label htmlFor="slug" className={ROTULO_CAMPO}>Cambiar el enlace (bookea.lat/s/…)</label>
            <input id="slug" type="text" value={f.slug} onChange={(e) => set("slug", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
            <input type="checkbox" checked={f.publicado} onChange={(e) => set("publicado", e.target.checked)} className="h-4 w-4" />
            Página publicada
          </label>
        </div>
      </Card>

      <Card eyebrow="Cómo se ve" titulo="Tu marca">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className={ROTULO_CAMPO}>Nombre</label>
            <input id="nombre" type="text" value={f.nombre} maxLength={TOPES.nombre} onChange={(e) => set("nombre", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div>
            <label htmlFor="bajada" className={ROTULO_CAMPO}>La línea bajo el nombre</label>
            <input id="bajada" type="text" value={f.bajada} maxLength={TOPES.bajada} placeholder="Café de especialidad · Escazú" onChange={(e) => set("bajada", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div>
            <label htmlFor="colorFondo" className={ROTULO_CAMPO}>Color de fondo</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input id="colorFondo" type="color" value={f.colorFondo} onChange={(e) => set("colorFondo", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-aventurea-line" />
              <input type="text" value={f.colorFondo} onChange={(e) => set("colorFondo", e.target.value)} className={`w-[120px] ${CAMPO_PANEL}`} />
            </div>
          </div>
          <div>
            <label htmlFor="colorAcento" className={ROTULO_CAMPO}>Color de acento (botones)</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input id="colorAcento" type="color" value={f.colorAcento} onChange={(e) => set("colorAcento", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-aventurea-line" />
              <input type="text" value={f.colorAcento} onChange={(e) => set("colorAcento", e.target.value)} className={`w-[120px] ${CAMPO_PANEL}`} />
            </div>
          </div>
          <SubirImagen valor={f.logoUrl} alCambiar={(u) => set("logoUrl", u)} destino="logo" etiqueta="Logo" carpeta="solutions/logos" bucket="solutions-fotos" />
          <SubirImagen valor={f.fotoPortadaUrl} alCambiar={(u) => set("fotoPortadaUrl", u)} destino="banner" etiqueta="Foto de portada" carpeta="solutions/portadas" bucket="solutions-fotos" />
        </div>

        {/* Vista previa en vivo de la cabecera, con los colores elegidos. */}
        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ background: paleta.fondo, color: paleta.tinta, borderColor: paleta.borde }}>
          <div className="flex items-center gap-3 p-4">
            {f.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-xl text-[20px] font-extrabold" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
                {(f.nombre.trim().charAt(0) || "•").toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold">{f.nombre || "Tu negocio"}</p>
              <p className="truncate text-[12px]" style={{ color: paleta.suave }}>{f.bajada || "La línea bajo tu nombre"}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card eyebrow="Para que te encuentren" titulo="Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="whatsapp" className={ROTULO_CAMPO}>WhatsApp (solo números)</label>
            <input id="whatsapp" type="tel" value={f.whatsapp} placeholder="88887777" onChange={(e) => set("whatsapp", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div>
            <label htmlFor="direccion" className={ROTULO_CAMPO}>Dirección (abre en Google Maps)</label>
            <input id="direccion" type="text" value={f.direccion} maxLength={TOPES.direccion} onChange={(e) => set("direccion", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
        </div>
      </Card>

      <Card eyebrow="Las puertas" titulo="Menú y pedidos">
        <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
          <input type="checkbox" checked={f.mostrarMenu} onChange={(e) => set("mostrarMenu", e.target.checked)} className="h-4 w-4" />
          Mostrar la carta en la página
        </label>
        <label className="mt-3 flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
          <input type="checkbox" checked={f.aceptaPedidos} onChange={(e) => set("aceptaPedidos", e.target.checked)} className="h-4 w-4" />
          Recibir pedidos desde la mesa
        </label>
        <p className="mt-1.5 text-[12.5px] leading-snug text-aventurea-ink-soft">
          Con esto prendido, quien escanee el QR de su mesa puede armar el pedido desde el teléfono y te llega a
          «Comandas». El pago sigue siendo en tu caja.
        </p>
        <div className="mt-4 border-t border-aventurea-line pt-4">
          <label htmlFor="mesas" className={ROTULO_CAMPO}>Cuántas mesas tenés</label>
          <input id="mesas" type="number" min={0} max={TOPES.mesas} value={f.mesas} onChange={(e) => set("mesas", Math.max(0, Math.min(TOPES.mesas, Number(e.target.value) || 0)))} className={`mt-1.5 w-[110px] ${CAMPO_PANEL}`} />
          <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">Cada mesa tiene su propio QR. Se imprimen en «QR de mesas».</p>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando} className={BOTON_PANEL_PRIMARIO}>
          {guardando ? "Guardando…" : "Guardar la página"}
        </button>
        <a href={urlPublica} target="_blank" rel="noopener noreferrer" className={BOTON_PANEL}>Ver como cliente →</a>
        {msg && <p className={`text-[13px] font-bold ${msg.tono === "exito" ? "text-green-700" : "text-red-700"}`}>{msg.texto}</p>}
      </div>
    </div>
  );
}
