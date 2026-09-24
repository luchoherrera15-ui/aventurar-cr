import { IconoQr } from "@/components/celebrar/iconos-celebrar";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { RUTA } from "@/lib/celebrar/rutas";

/**
 * La vitrina del producto: tres filas alternadas (texto + maqueta),
 * como hacen Joy y Greenvelope para mostrar el panel sin capturas. Las
 * maquetas son CSS puro con datos ILUSTRATIVOS y así rotulados
 * («Ejemplo»): es marketing, no el panel real, y nunca se confunde
 * con un dato del usuario.
 */
export default function Vitrina() {
  return (
    <section aria-labelledby="vitrina-titulo" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <h2 id="vitrina-titulo" className="sr-only">
        Así funciona el panel
      </h2>

      <Fila
        pastilla="Invitación + confirmaciones"
        titulo="Mandás un link. Las confirmaciones llegan solas."
        texto="Cada invitado abre la invitación en su teléfono, confirma cuántos vienen y anota si alguien tiene una restricción alimentaria. Vos ves el conteo al día en tu panel, sin perseguir a nadie por WhatsApp."
        puntos={["Link propio y QR para la tarjeta impresa", "Acompañantes, mesa y notas por invitado", "Recordatorio a quien no ha respondido"]}
        maqueta={<MaquetaConfirmaciones />}
      />

      <Fila
        invertida
        pastilla="Álbum + QR"
        titulo="Un QR en cada mesa. Todas las fotos, en un solo lugar."
        texto="Los invitados escanean y suben sus fotos y videos en el momento, sin instalar nada. Vos aprobás lo que se publica y al final te llevás todo en alta calidad."
        puntos={["Subida sin cuenta ni app", "Moderación antes de publicar", "Descarga completa al terminar"]}
        maqueta={<MaquetaAlbum />}
      />

      <Fila
        pastilla="Recuerdos"
        titulo="Después de la fiesta, la página se queda."
        texto="La misma dirección se convierte en la página de recuerdos: las fotos de todos, los mensajes del libro de firmas, el video y la historia. Para volver cuando quieran, y para mandársela a quien no pudo ir."
        puntos={["Misma URL, sin reenviar nada", "Libro de firmas con nombre y foto", "Se puede renovar por más tiempo"]}
        maqueta={<MaquetaRecuerdos />}
        ultima
      />
    </section>
  );
}

function Fila({
  pastilla,
  titulo,
  texto,
  puntos,
  maqueta,
  invertida = false,
  ultima = false,
}: {
  pastilla: string;
  titulo: string;
  texto: string;
  puntos: string[];
  maqueta: React.ReactNode;
  invertida?: boolean;
  ultima?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${ultima ? "" : "mb-20 lg:mb-28"}`}
    >
      <div className={invertida ? "lg:order-2" : ""}>
        <p className="c-pastilla">{pastilla}</p>
        <h3 className="mt-4 text-[clamp(1.6rem,3vw,2.25rem)] leading-[1.12] text-(--c-tinta)">{titulo}</h3>
        <p className="mt-4 text-[17px] leading-relaxed text-(--c-tinta-suave)">{texto}</p>
        <ul className="mt-6 grid gap-3">
          {puntos.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px] text-(--c-tinta)">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--c-celeste) text-(--c-azul-tinta)">
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="m3.5 8.5 2.8 2.8L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario">
            Crear mi invitación
          </EnlaceCelebrar>
        </div>
      </div>
      <div className={invertida ? "lg:order-1" : ""}>{maqueta}</div>
    </div>
  );
}

/** Marco común de las maquetas: fondo hielo, tarjeta blanca, rótulo «Ejemplo». */
function Marco({ children, titulo }: { children: React.ReactNode; titulo: string }) {
  return (
    <div className="rounded-[24px] bg-(--c-hielo) p-4 sm:p-6" aria-hidden="true">
      <div className="c-tarjeta overflow-hidden">
        <div className="flex items-center justify-between border-b border-(--c-linea) px-5 py-3">
          <span className="c-montserrat text-[13px] font-semibold text-(--c-tinta)">{titulo}</span>
          <span className="c-pastilla c-pastilla-coral">Ejemplo</span>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function MaquetaConfirmaciones() {
  const filas = [
    { nombre: "Familia Jiménez Mora", personas: "4 personas", estado: "Confirmado", ok: true },
    { nombre: "Carlos Mora", personas: "2 personas", estado: "Pendiente", ok: false },
    { nombre: "Ana Lucía Vargas", personas: "1 persona · sin gluten", estado: "Confirmado", ok: true },
    { nombre: "Los Solano", personas: "3 personas", estado: "Confirmado", ok: true },
  ];
  return (
    <Marco titulo="Confirmaciones · Boda de Sofía & Andrés">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Confirmados", "63"],
          ["Pendientes", "21"],
          ["No asistirán", "3"],
        ].map(([r, n]) => (
          <div key={r} className="rounded-xl bg-(--c-hielo) px-3 py-3">
            <p className="text-[11px] font-medium text-(--c-tinta-suave)">{r}</p>
            <p className="c-montserrat mt-1 text-2xl font-bold text-(--c-tinta)">{n}</p>
          </div>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-(--c-linea)">
        {filas.map((f) => (
          <li key={f.nombre} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-(--c-tinta)">{f.nombre}</p>
              <p className="text-[12px] text-(--c-tinta-suave)">{f.personas}</p>
            </div>
            <span className={`c-pastilla ${f.ok ? "c-pastilla-ok" : ""}`}>{f.estado}</span>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

function MaquetaAlbum() {
  const tonos = [
    "linear-gradient(135deg,#dbe4f6,#b8c8ea)",
    "linear-gradient(135deg,#f6dcd7,#eab8b0)",
    "linear-gradient(135deg,#d9ecf7,#a9cfe8)",
    "linear-gradient(135deg,#e6e2f6,#c6bde8)",
    "linear-gradient(135deg,#dff1e6,#b3d9c2)",
  ];
  return (
    <Marco titulo="Álbum · 438 fotos de 96 invitados">
      <div className="grid grid-cols-3 gap-2">
        {tonos.map((t, i) => (
          <div key={i} className="aspect-square rounded-lg" style={{ background: t }} />
        ))}
        <div className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-(--c-linea) bg-(--c-hielo) text-(--c-marino)">
          <IconoQr className="h-6 w-6" />
          <span className="c-montserrat text-[10px] font-semibold">Mesa 4</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-(--c-hielo) px-4 py-3">
        <span className="text-[13px] text-(--c-tinta)">12 fotos esperan tu aprobación</span>
        <span className="c-montserrat rounded-lg bg-(--c-marino) px-3 py-1.5 text-[12px] font-semibold text-(--c-blanco)">
          Revisar
        </span>
      </div>
    </Marco>
  );
}

function MaquetaRecuerdos() {
  return (
    <Marco titulo="celebrar.lat/sofia-y-andres">
      <div className="rounded-xl bg-(--c-marino) px-6 py-8 text-center text-(--c-blanco)">
        <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.14em] text-(--c-sobre-marino-suave)">
          Nuestros recuerdos
        </p>
        <p className="c-montserrat mt-3 text-2xl font-extrabold tracking-tight">Sofía & Andrés</p>
        <p className="mt-1 text-[13px] text-(--c-sobre-marino-suave)">12 de diciembre de 2026 · Escazú</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          ["438", "fotos"],
          ["27", "mensajes"],
          ["1", "video"],
        ].map(([n, r]) => (
          <div key={r} className="rounded-xl border border-(--c-linea) px-3 py-3">
            <p className="c-montserrat text-xl font-bold text-(--c-tinta)">{n}</p>
            <p className="text-[12px] text-(--c-tinta-suave)">{r}</p>
          </div>
        ))}
      </div>
      <blockquote className="mt-4 rounded-xl bg-(--c-hielo) px-4 py-3 text-[13px] leading-relaxed text-(--c-tinta)">
        «Gracias por dejarnos ser parte de este día. Los queremos.»
        <span className="mt-1 block text-[12px] text-(--c-tinta-suave)">Familia Jiménez Mora</span>
      </blockquote>
    </Marco>
  );
}
