"use client";

import Link from "next/link";
import { useActionState } from "react";
import { afiliarPorQr, type EstadoAlta } from "./actions";

/**
 * EL NOMBRE Y UN CONTACTO. Dos campos y un botón.
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
 * EL NOMBRE PASÓ A SER OBLIGATORIO, Y EL SEGUNDO CONTACTO DEJÓ DE SERLO
 * ------------------------------------------------------------------
 * Era al revés: nombre opcional, WhatsApp Y correo obligatorios. Y salió
 * mal por los dos lados. Sin nombre, la lista de clientes del dueño se
 * llenó de fichas que dicen «Cliente sin datos» —un sello que no se le
 * puede atribuir a nadie no es control de nada— y con los dos contactos
 * obligatorios, quien se sabe solo su número de memoria escribía
 * cualquier cosa en el campo del correo.
 *
 * Así que el mínimo se movió a donde de verdad sirve: NOMBRE + UN
 * CANAL. La cuenta de campos que tiene que llenar la persona parada en
 * la fila es la misma que antes (dos), pero ahora los dos identifican.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL WHATSAPP VA ANTES QUE EL CORREO
 * ------------------------------------------------------------------
 * Es el dato que la gente se sabe de memoria y el que el negocio de
 * verdad usa para escribirle. El correo va después porque es el que más
 * se equivoca y el que más cuesta tipear en un teléfono. Ninguno de los
 * dos lleva `required` en el HTML —cualquiera de los dos alcanza— así
 * que el navegador no puede decidir esto solo: lo decide `revisarAlta`,
 * en el servidor, y por eso los dos campos comparten el mismo rótulo de
 * «con uno alcanza».
 *
 * El texto del consentimiento llega por PROP desde el servidor y no se
 * escribe acá: es EXACTAMENTE el mismo string que se guarda como prueba
 * en `consentimientos_persona` (0138). Si se escribiera en los dos
 * lados, la prueba diría una cosa y la persona habría leído otra.
 */

/**
 * El azul de acción, en hexadecimal y no en `var(--accion)`.
 *
 * Esta ruta es la única de Lealtad que NO cuelga de
 * `src/app/lealtad/layout.tsx`, o sea que no lleva la clase `.lealtad`
 * y no ve los tokens del módulo: un `var(--accion)` acá quedaría sin
 * valor. Se copian los del contrato de color, que es también el motivo
 * de que estén nombrados y no sueltos en un `style`.
 *
 * Todo lo de este archivo se pinta sobre la card BLANCA de `page.tsx`,
 * así que va el par claro: relleno #0f4c9e con letra blanca (8,24:1).
 * El naranja que había daba 2,9:1 con la misma letra — no llegaba a AA.
 */
const ACCION = "#0f4c9e";
const ACCION_TINTA = "#ffffff";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 " +
  "text-[16px] text-aventurea-ink placeholder:text-zinc-500";
const inputMalCls = "border-red-400 bg-red-50";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

const ESTADO_INICIAL: EstadoAlta = { error: null };

export default function FormularioAlta({
  slug,
  tarjeta,
  textoConsentimiento,
  yaSabido,
}: {
  slug: string;
  /**
   * La llave de LA TARJETA que la pantalla acaba de dibujar
   * (`llave-tarjeta.ts`). Viaja escondida para que el alta afilie a esa
   * y no a una hermana suya: desde que un negocio puede tener varias,
   * «la tarjeta del negocio» dejó de ser una sola cosa.
   */
  tarjeta: string;
  /** El mismo string que se archiva como prueba. Ver arriba. */
  textoConsentimiento: string;
  /**
   * Lo que Bookea YA sabe de quien está mirando esta pantalla.
   *
   * Existe para el caso que este trabajo vino a arreglar: alguien que
   * se afilió por el camino roto —sin nombre, sin vínculo, sin
   * consentimiento— y hoy vuelve. A esa persona no se le puede apagar
   * la tarjeta, pero sí se le pide lo que falta, y sería absurdo
   * hacerla tipear de nuevo el dato que sí dejó. Se precarga y ella
   * completa el hueco.
   */
  yaSabido?: { nombre: string | null; correo: string | null; telefono: string | null };
}) {
  const [estado, enviar, pendiente] = useActionState(afiliarPorQr, ESTADO_INICIAL);

  return (
    <form action={enviar} className="flex flex-col gap-3.5 text-left">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="tarjeta" value={tarjeta} />

      <div>
        <label className={labelCls} htmlFor="nombre">
          Tu nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="name"
          maxLength={60}
          required
          autoFocus={!yaSabido?.nombre}
          defaultValue={yaSabido?.nombre ?? ""}
          placeholder="¿Cómo te llamás?"
          className={`${inputCls} ${estado.campo === "nombre" ? inputMalCls : ""}`}
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
          defaultValue={yaSabido?.telefono ?? ""}
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
          defaultValue={yaSabido?.correo ?? ""}
          placeholder="tucorreo@ejemplo.com"
          className={`${inputCls} ${estado.campo === "correo" ? inputMalCls : ""}`}
        />
      </div>

      {/* El rótulo del "uno de los dos" va DEBAJO de los dos campos y no
          dentro de uno: puesto en el del WhatsApp se lee como que el
          correo sí es obligatorio, que es justo lo que dejó de ser. */}
      <p className="-mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
        Con uno de los dos alcanza — es por donde el negocio te avisa cuando
        completás tu premio.
      </p>

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
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ accentColor: ACCION }}
        />
        <span className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          {textoConsentimiento}
        </span>
      </label>

      {estado.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] leading-relaxed text-red-700">
          {estado.error}
        </div>
      )}

      {/* ── EL DESVÍO, QUE ANTES ERA UN CALLEJÓN SIN SALIDA ──────────
          Cuando el contacto tecleado ya tiene dueño, acá había un
          renglón rojo y un link al login: fin del camino. En la caja,
          con la fila atrás, eso es un cliente que se va sin tarjeta.

          Ahora son DOS salidas y las dos siguen desde acá, sin volver
          a tipear nada:

            1. RECUPERARLA (primero, y en el botón lleno). Es la que
               corresponde cuando el contacto SÍ es suyo: el código del
               correo es la prueba de posesión, y con ella vuelven los
               sellos que ya tenía. Va primero a propósito — es la única
               que devuelve un saldo.

            2. SEGUIR SIN CUENTA. Para el dedazo, el correo compartido y
               el que simplemente no quiere abrir cuenta. Reenvía este
               MISMO formulario con `sin_cuenta`, y el servidor le abre
               una tarjeta NUEVA, de cero, sin tocar la ajena.

          El botón normal se esconde mientras esto está a la vista: con
          los mismos datos va a dar el mismo rebote, y tres botones que
          hacen casi lo mismo es la forma más rápida de que alguien
          toque el que no era. */}
      {estado.requierePrueba && (
        <div className="flex flex-col gap-2 rounded-lg bg-aventurea-cream-2 px-3 py-3">
          <Link
            href={`/tarjeta/${slug}${tarjeta ? `/${tarjeta}` : ""}?entrar=1`}
            className="flex h-12 items-center justify-center rounded-xl text-center text-[15px] font-bold"
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            Es mía — recuperarla con mi correo
          </Link>
          <button
            type="submit"
            name="sin_cuenta"
            value="si"
            disabled={pendiente}
            className="flex h-11 items-center justify-center rounded-xl border-2 text-[14px] font-bold disabled:opacity-60"
            style={{ borderColor: ACCION, color: ACCION }}
          >
            {pendiente ? "Creando tu tarjeta..." : "No es mía — dame una nueva"}
          </button>
          <p className="text-[11.5px] leading-relaxed text-zinc-500">
            La nueva empieza en cero y no toca la otra tarjeta ni sus sellos.
          </p>
        </div>
      )}

      {!estado.requierePrueba && (
        <button
          type="submit"
          disabled={pendiente}
          className="mt-1 flex h-12 items-center justify-center rounded-xl text-[15px] font-bold transition-colors disabled:opacity-60"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {pendiente ? "Creando tu tarjeta..." : "Quiero mi tarjeta"}
        </button>
      )}

      <p className="text-center text-[11.5px] leading-relaxed text-zinc-500">
        Con esos datos reconocemos tu tarjeta en cada visita. No hay
        contraseña que recordar ni código que buscar en el correo.
      </p>
    </form>
  );
}
