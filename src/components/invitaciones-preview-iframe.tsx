"use client";

interface PreviewIframeProps {
  html: string;
  titulo?: string;
  cargando?: boolean;
  error?: string;
}

export default function PreviewIframe({
  html,
  titulo = "Preview",
  cargando = false,
  error,
}: PreviewIframeProps) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-white overflow-hidden">
      <div className="border-b border-aventurea-line bg-aventurea-cream-2 px-5 py-3">
        <h3 className="text-[13px] font-bold text-aventurea-ink">
          🎨 {titulo}
        </h3>
      </div>

      {cargando && (
        <div className="flex h-96 items-center justify-center bg-aventurea-cream-2">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-aventurea-orange border-t-transparent" />
            <p className="text-[13px] text-aventurea-ink-soft">Generando invitación...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex h-96 items-center justify-center bg-red-50">
          <div className="text-center">
            <p className="text-[13px] font-semibold text-red-700">Error al generar</p>
            <p className="mt-1 text-[12px] text-red-600">{error}</p>
          </div>
        </div>
      )}

      {!cargando && !error && (
        /* srcDoc + allow-scripts (sin allow-same-origin): las
           animaciones JS de la invitación corren, pero en un origen
           opaco que no puede tocar cookies ni el documento padre. */
        <iframe
          srcDoc={html}
          className="w-full border-none"
          style={{ height: "600px" }}
          title="Invitación preview"
          sandbox="allow-scripts"
        />
      )}
    </div>
  );
}
