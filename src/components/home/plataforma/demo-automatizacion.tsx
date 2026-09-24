"use client";

import { IconInstagram } from "@/components/icons";
import { Escenas } from "./piezas";
import { useSecuencia } from "./use-secuencia";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA AUTOMATIZACIÓN, EN DOS ESCENAS QUE SE REEMPLAZAN
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «que sea AUTOMÁTICO el proceso, no
 * interactivo de cliquear, sino que todo se dé fluyendo» y, después,
 * «que los cuadros se reemplacen».
 *
 * Antes los tres mensajes se apilaban y la tarjeta crecía hacia abajo.
 * Ahora son dos superficies que ocupan el MISMO lugar y se cruzan — que
 * además es lo que de verdad pasa, porque son dos pantallas distintas
 * de Instagram:
 *
 *   ESCENA 1   la publicación: el comentario y la respuesta pública
 *   ESCENA 2   la bandeja: el mensaje directo con tu link
 *
 * El alto (`ALTO`) es el mismo que el de `demo-reservas.tsx` a
 * propósito: las dos demos viven una al lado de la otra y si midieran
 * distinto la fila quedaría torcida.
 *
 * ── LO QUE SE ENSEÑA ES LO QUE ESTÁ CONSTRUIDO ──────────────────────
 *
 * Todo esto es Instagram Auto Reply (migración 0238), con la API
 * oficial de Meta («Instagram API with Instagram Login»): disparador
 * por PALABRA CLAVE o por cualquier comentario, respuesta pública
 * debajo del comentario y DM privado con el enlace del negocio.
 *
 * ── ⚠️ POR QUÉ NO HAY BOTÓN DE FACEBOOK ─────────────────────────────
 *
 * Porque no existe. La integración usa Instagram Login, y su propia
 * documentación lo dice como ventaja: «No hace falta Página de
 * Facebook». Automatizar Facebook es otro flujo (Facebook Login +
 * Página) que no está construido. Poner el botón sería prometer un
 * canal que no se puede entregar.
 *
 * WhatsApp tampoco: en Bookea WhatsApp es de SALIDA (el pedido sale por
 * `wa.me`), no hay automatización de mensajes entrantes.
 */

/**
 * ⚠️ EL PRIMER NÚMERO ES EL HUECO EN BLANCO.
 *
 * `esperas[0]` no es lo que dura el primer paso: es lo que tarda en
 * aparecer. Si se estira, al rebobinar el panel se queda vacío y parece
 * roto. Medio segundo alcanza para que se lea como «arranca de nuevo».
 */
const ESPERAS = [400, 1700, 1900, 2800];

/** El alto del escenario. Fijo, y el mismo que el de la demo de reservas. */
const ALTO = 268;

/** La cabecera de cada escena. */
function Cabecera({
  titulo,
  bajada,
  corriendo,
}: {
  titulo: string;
  bajada: string;
  corriendo: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--linea)] px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <IconInstagram className="h-5 w-5 shrink-0 text-[#C13584]" />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-extrabold text-[color:var(--tinta)]">
            {titulo}
          </span>
          <span className="block truncate text-[10px] text-[color:var(--tinta-suave)]">
            {bajada}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--ok-suave)] px-2 py-0.5">
        <span
          className={`h-1.5 w-1.5 rounded-full bg-[color:var(--ok)] ${
            corriendo ? "animate-pulse" : ""
          }`}
        />
        <span className="text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--ok)]">
          Automático
        </span>
      </span>
    </div>
  );
}

/** Los tres puntitos del «escribiendo…». */
function Escribiendo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex w-fit gap-1 rounded-[12px] px-3 py-2.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#667781]"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}

export default function DemoAutomatizacion() {
  const { caja, visibles, corriendo } = useSecuencia({
    pasos: 4,
    esperas: ESPERAS,
  });

  const comentario = visibles >= 1;
  const publica = visibles >= 2;
  // Desde el paso 3 manda la bandeja: la publicación se va.
  const escena = visibles >= 3 ? 1 : 0;

  const publicacion = (
    <div className="h-full overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-white">
      <Cabecera
        titulo="casamatcha"
        bajada="En tu publicación"
        corriendo={corriendo}
      />

      <div aria-live="polite" className="space-y-2.5 px-4 py-3">
        {comentario ? (
          <div className="anim-entra">
            <p className="mb-1 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--tinta-suave)]">
              Alguien comenta
            </p>
            <div className="rounded-[12px] bg-[color:var(--superficie)] px-3.5 py-2.5">
              <p className="text-[12px] text-[#0F172A]">
                <span className="font-extrabold">maria.j</span> ¿Cuánto cuesta?{" "}
                <span className="font-extrabold text-[color:var(--acento)]">
                  MENÚ
                </span>
              </p>
            </div>
          </div>
        ) : null}

        {publica ? (
          // La respuesta pública va indentada: cuelga del comentario.
          <div className="anim-entra ml-5 border-l-2 border-[color:var(--linea)] pl-3">
            <p className="mb-1 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--tinta-suave)]">
              Bookea contesta en público
            </p>
            <div className="rounded-[12px] bg-[color:var(--superficie)] px-3.5 py-2.5">
              <p className="text-[12px] text-[#0F172A]">
                ¡Hola María! Te lo mandamos por privado 💬
              </p>
            </div>
          </div>
        ) : comentario && corriendo ? (
          <Escribiendo className="ml-5 bg-[color:var(--superficie)]" />
        ) : null}
      </div>
    </div>
  );

  const bandeja = (
    <div className="flex h-full flex-col overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-white">
      <Cabecera
        titulo="maria.j"
        bajada="Mensajes directos"
        corriendo={corriendo}
      />

      {/* `justify-end`: en una bandeja el mensaje nuevo se apoya abajo,
          no arriba. Es lo que hace que se lea como un chat. */}
      <div className="flex flex-1 flex-col justify-end px-4 py-3">
        <div className="anim-entra ml-auto max-w-[92%] rounded-[12px] rounded-tr-[4px] bg-[#DCF8C6] px-3.5 py-2.5">
          <p className="text-[12px] leading-snug text-[#111B21]">
            ¡Hola! Acá está todo nuestro menú y podés pedir:
          </p>
          <p className="text-[12px] font-bold text-[#027EB5]">casamatcha.app</p>
          <p className="mt-1 text-right text-[9px] text-[#667781]">11:58 ✓✓</p>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={caja}>
      <Escenas alto={ALTO} activa={escena} escenas={[publicacion, bandeja]} />
      {/* El rótulo dice en qué mitad estamos: sin él, el cambio de
          escena se lee como que la tarjeta se rompió. */}
      <p className="mt-2.5 text-center text-[11px] text-[color:var(--tinta-suave)]">
        {escena === 0
          ? "La palabra clave y los mensajes los escribís vos"
          : "↓ y le llega el privado con tu link, solo"}
      </p>
    </div>
  );
}
