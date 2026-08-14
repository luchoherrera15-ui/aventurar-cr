"use client";

import Link from "next/link";
import { useActionState } from "react";
import { afiliarPorQr, type EstadoAlta } from "./actions";

/**
 * TRES CAMPOS, DOS OBLIGATORIOS.
 *
 * ------------------------------------------------------------------
 * LO QUE HABÍA ACÁ ANTES
 * ------------------------------------------------------------------
 * Un login: escribir el correo → SALIR de la página a buscar un código
 * de 6 dígitos en el buzón → volver → tipear el código → tipear el
 * nombre → y recién ahí aparecía el botón del pase. Todo eso de pie en
 * el mostrador, con la fila atrás. La página prometía "sin apps que
 * instalar" arriba de un formulario que mandaba al correo.
 *
 * ------------------------------------------------------------------
 * EL NOMBRE ES OPCIONAL A PROPÓSITO
 * ------------------------------------------------------------------
 * Pedido del dueño: personaliza el pase y el correo de bienvenida
 * ("¡Bienvenido, Juan!" en vez de un saludo genérico). Pero obligarlo
 * reintroduce la fricción que el resto de esta pantalla existe para
 * evitar — así que queda como el primer campo, sin `required`. Si la
 * persona ya existía con nombre (otro negocio, otra vez), el RPC lo
 * conserva y esto no lo pisa con vacío.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL WHATSAPP VA ANTES QUE EL CORREO
 * ------------------------------------------------------------------
 * Es el dato que la gente se sabe de memoria y el que el negocio de
 * verdad usa para escribirle. El correo va después porque es el que más
 * se equivoca y el que más cuesta tipear en un teléfono.
 *
 * El texto del consentimiento llega por PROP desde el servidor y no se
 * escribe acá: es EXACTAMENTE el mismo string que se guarda como prueba
 * en `consentimientos_persona` (0138). Si se escribiera en los dos
 * lados, la prueba diría una cosa y la persona habría leído otra.
 */

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 " +
  "text-[16px] text-aventurea-ink placeholder:text-zinc-500";
const inputMalCls = "border-red-400 bg-red-50";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

const ESTADO_INICIAL: EstadoAlta = { error: null };

export default function FormularioAlta({
  slug,
  textoConsentimiento,
}: {
  slug: string;
  /** El mismo string que se archiva como prueba. Ver arriba. */
  textoConsentimiento: string;
}) {
  const [estado, enviar, pendiente] = useActionState(afiliarPorQr, ESTADO_INICIAL);

  return (
    <form action={enviar} className="flex flex-col gap-3.5 text-left">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <label className={labelCls} htmlFor="nombre">
          Tu nombre (opcional)
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="name"
          maxLength={60}
          placeholder="¿Cómo te llamás?"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="whatsapp">
          Tu WhatsApp
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          autoFocus
          placeholder="8888 8888"
          className={`${inputCls} ${estado.campo === "whatsapp" ? inputMalCls : ""}`}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="correo">
          Tu correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="tucorreo@ejemplo.com"
          className={`${inputCls} ${estado.campo === "correo" ? inputMalCls : ""}`}
        />
      </div>

      {/* El permiso, escrito como se lo diría una persona a otra. Sin
          marcar por defecto: una casilla premarcada no es un permiso, y
          la tarjeta se entrega igual — el vínculo con el negocio es la
          base del pase, no marketing. */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-aventurea-cream-2 px-3 py-2.5">
        <input
          type="checkbox"
          name="promos"
          value="si"
          defaultChecked={false}
          className="mt-0.5 h-4 w-4 shrink-0 accent-aventurea-orange"
        />
        <span className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          {textoConsentimiento}
        </span>
      </label>

      {estado.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] leading-relaxed text-red-700">
          {estado.error}
          {estado.requierePrueba && (
            <>
              {" "}
              <Link
                href={`/tarjeta/${slug}?entrar=1`}
                className="font-bold underline underline-offset-2"
              >
                Entrar con mi correo
              </Link>
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-1 flex h-12 items-center justify-center rounded-xl text-[15px] font-bold text-white transition-colors disabled:opacity-60"
        style={{ background: "#ee7420" }}
      >
        {pendiente ? "Creando tu tarjeta..." : "Quiero mi tarjeta"}
      </button>

      <p className="text-center text-[11.5px] leading-relaxed text-zinc-500">
        Con esos dos datos reconocemos tu tarjeta en cada visita. No hay
        contraseña que recordar ni código que buscar en el correo.
      </p>
    </form>
  );
}
