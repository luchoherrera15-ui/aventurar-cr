"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { entrarComoDemo } from "./acciones-demo";

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_REGEX = /^[0-9+\s-]{8,16}$/;
// Las cuentas de prueba (*.demo@bookea.lat) no tienen buzón real:
// entran con un código fijo validado en el servidor (acciones-demo.ts)
// en vez del OTP por correo.
const DEMO_REGEX = /\.demo@bookea\.lat$/;

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

/**
 * Acceso sin contraseña, compartido por todos los logins del sitio (y
 * el mismo flujo que la app móvil): se pide el correo, Supabase manda
 * un código de 6 dígitos (signInWithOtp) y verificarlo deja la sesión
 * iniciada (verifyOtp). Cada pantalla decide si el correo nuevo crea
 * cuenta (crearCuenta + datosNuevos), si se pide el nombre, y a dónde
 * ir al entrar. `soloAdmin` cierra la sesión si el perfil no es admin
 * — el código llega igual, pero la puerta no se abre.
 *
 * `pedirNombre` fuerza el campo siempre (para pantallas que ya son
 * solo-registro, como /mi-negocio/registro). Cuando login y registro
 * comparten un mismo formulario (/cuenta), en cambio, no se sabe de
 * antemano si hay que pedirlo — por eso existe `pedirNombreSiNuevo`:
 * al enviar, primero consulta si ese correo ya tiene cuenta
 * (existe_cuenta) y solo si es nuevo revela el campo, con una nota de
 * por qué se lo estamos pidiendo.
 */
export default function FormularioCodigoAcceso({
  destino,
  acento = "navy",
  crearCuenta = false,
  pedirNombre = false,
  pedirNombreSiNuevo = false,
  datosNuevos,
  soloAdmin = false,
}: {
  /** A dónde navegar cuando la sesión queda iniciada. */
  destino: string;
  acento?: "navy" | "orange";
  /** true = un correo sin cuenta se registra solo en el mismo paso. */
  crearCuenta?: boolean;
  pedirNombre?: boolean;
  /** true = el campo de nombre solo aparece si el correo es nuevo. */
  pedirNombreSiNuevo?: boolean;
  /** Metadata del usuario nuevo (rol, etc.) cuando crearCuenta. */
  datosNuevos?: Record<string, unknown>;
  soloAdmin?: boolean;
}) {
  const [paso, setPaso] = useState<"correo" | "codigo" | "completar">("correo");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);
  // Solo se usa con pedirNombreSiNuevo: null = todavía no se comprobó
  // ese correo, true/false = ya sabemos si existe.
  const [correoEsNuevo, setCorreoEsNuevo] = useState<boolean | null>(null);
  const [comprobando, setComprobando] = useState(false);

  const correoLimpio = email.trim().toLowerCase();
  const esCuentaDemo = DEMO_REGEX.test(correoLimpio);
  const pideNombreAhora = pedirNombre || (pedirNombreSiNuevo && correoEsNuevo === true);
  const botonCls = `mt-1 flex h-11 items-center justify-center rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 ${
    acento === "orange"
      ? "bg-aventurea-sky hover:bg-aventurea-sky-dark"
      : "bg-aventurea-navy hover:bg-aventurea-navy-2"
  }`;
  const enlaceCls = `font-bold underline ${
    acento === "orange" ? "text-aventurea-orange" : "text-aventurea-navy"
  }`;

  async function enviarCodigo(esReenvio = false) {
    setError(null);
    if (!CORREO_REGEX.test(correoLimpio)) {
      setError("Ese correo no parece válido.");
      return;
    }

    // Cuenta demo: no hay buzón que reciba nada — se salta el envío y
    // se va directo a la pantalla del código (el fijo de prueba).
    if (esCuentaDemo) {
      setCodigo("");
      setPaso("codigo");
      return;
    }

    const supabase = createClient();

    // Con pedirNombreSiNuevo, el primer click de un correo nuevo no
    // manda el código todavía: solo revela el campo de nombre (con la
    // explicación de por qué se lo pedimos) y espera un segundo click.
    if (pedirNombreSiNuevo && correoEsNuevo === null && !esReenvio) {
      setComprobando(true);
      const { data, error: rpcError } = await supabase.rpc("existe_cuenta", {
        p_email: correoLimpio,
      });
      setComprobando(false);
      if (rpcError) {
        setError("No se pudo comprobar el correo: " + rpcError.message);
        return;
      }
      setCorreoEsNuevo(!data);
      if (!data) return; // Es nuevo: se detiene acá a pedir el nombre.
    }

    if (pideNombreAhora && !nombre.trim()) {
      setError("Contanos tu nombre para crear la cuenta.");
      return;
    }
    // El teléfono se pide junto al nombre: con eso las reservas y las
    // citas se llenan solas después.
    if (pideNombreAhora && !TELEFONO_REGEX.test(telefono.trim())) {
      setError("Dejanos un teléfono válido (solo números).");
      return;
    }
    setPendiente(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: correoLimpio,
      options: {
        shouldCreateUser: crearCuenta,
        data: pideNombreAhora
          ? { ...datosNuevos, nombre: nombre.trim(), whatsapp: telefono.trim() }
          : datosNuevos,
      },
    });
    setPendiente(false);

    if (error) {
      if (/signups not allowed/i.test(error.message)) {
        setError("No existe una cuenta con ese correo.");
      } else if (error.status === 429) {
        setError(
          "Ya te mandamos un código hace poco — esperá un minuto y probá de nuevo.",
        );
      } else {
        setError("No se pudo enviar el código: " + error.message);
      }
      return;
    }
    setCodigo("");
    setPaso("codigo");
    if (esReenvio) setReenviado(true);
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const codigoLimpio = codigo.trim();
    if (codigoLimpio.length < 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }

    // Cuenta demo: el código fijo se valida en el servidor, que entra
    // con la contraseña interna (nunca llega al navegador).
    if (esCuentaDemo) {
      setPendiente(true);
      const res = await entrarComoDemo(correoLimpio, codigoLimpio);
      if (res.error) {
        setPendiente(false);
        setError(res.error);
        return;
      }
      window.location.href = destino;
      return;
    }

    setPendiente(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: correoLimpio,
      token: codigoLimpio,
      type: "email",
    });

    if (error || !data.user) {
      setPendiente(false);
      setError(
        "Ese código no sirve o ya venció. Revisá que sea el del último correo, o pedí uno nuevo.",
      );
      return;
    }

    if (soloAdmin) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", data.user.id)
        .single();
      if (perfil?.rol !== "admin") {
        // `scope: "local"` — cierra ESTA sesión y nada más.
        //
        // ⚠️ EL DEFAULT DE SUPABASE ES GLOBAL. `signOut()` a secas es
        // `signOut({ scope: "global" })` (auth-js, GoTrueClient), y eso REVOCA
        // los refresh tokens de TODOS los aparatos: quien cerraba sesión acá
        // quedaba también deslogueado del teléfono, sin ninguna pista de por
        // qué. Un botón que dice «cerrar sesión» cierra la de acá.
        await supabase.auth.signOut({ scope: "local" });
        setPendiente(false);
        setError("Esta cuenta no tiene acceso al panel de administración.");
        return;
      }
    }

    // Cuentas viejas sin nombre o teléfono: un último paso los pide
    // acá — con eso las reservas se llenan solas de ahí en adelante.
    if (!soloAdmin) {
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const nombreMeta = [meta.nombre, meta.full_name].find(
        (v): v is string => typeof v === "string" && v.trim() !== "",
      );
      const telefonoMeta =
        typeof meta.whatsapp === "string" && meta.whatsapp.trim() !== ""
          ? meta.whatsapp
          : null;
      if (!nombreMeta || !telefonoMeta) {
        setNombre(nombreMeta ?? "");
        setTelefono(telefonoMeta ?? "");
        setError(null);
        setPendiente(false);
        setPaso("completar");
        return;
      }
    }

    // Navegación completa (no push): así el servidor rehace el layout
    // con la cookie de sesión recién puesta.
    window.location.href = destino;
  }

  async function completarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("Contanos tu nombre.");
      return;
    }
    if (!TELEFONO_REGEX.test(telefono.trim())) {
      setError("Dejanos un teléfono válido (solo números).");
      return;
    }
    setPendiente(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({
      data: { nombre: nombre.trim(), whatsapp: telefono.trim() },
    });
    if (error) {
      setPendiente(false);
      setError("No se pudo guardar: " + error.message);
      return;
    }
    // El nombre visible del perfil va por el RPC (0041): un update
    // directo a `perfiles` solo lo permite la RLS a los admins, así
    // que afectaba 0 filas en silencio y el perfil quedaba sin nombre.
    if (data.user) {
      await supabase.rpc("actualizar_mi_nombre", { p_nombre: nombre.trim() });
    }
    window.location.href = destino;
  }

  if (paso === "completar") {
    return (
      <form onSubmit={completarPerfil} className="mt-5.5 flex flex-col gap-3.5">
        <p className="rounded-lg bg-aventurea-cream-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          ¡Ya entraste! Un último paso: con tu nombre y teléfono, tus
          reservas y citas se llenan solas — no volvés a escribirlos.
        </p>
        <div>
          <label className={labelCls}>Tu nombre</label>
          <input
            type="text"
            required
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            autoComplete="name"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Tu teléfono (WhatsApp)</label>
          <input
            type="tel"
            required
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+506 8888-8888"
            autoComplete="tel"
            inputMode="tel"
            className={inputCls}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
        )}

        <button type="submit" disabled={pendiente} className={botonCls}>
          {pendiente ? "Guardando..." : "Guardar y continuar"}
        </button>
      </form>
    );
  }

  if (paso === "codigo") {
    return (
      <form onSubmit={verificarCodigo} className="mt-5.5 flex flex-col gap-3.5">
        {esCuentaDemo ? (
          <p className="rounded-lg bg-aventurea-sky/10 px-3 py-2.5 text-[13px] leading-relaxed text-aventurea-ink">
            <strong>{correoLimpio}</strong> es una cuenta de prueba: entrá con
            el código de test <strong>123456</strong>.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
            Te mandamos un código de 6 dígitos a{" "}
            <strong className="text-aventurea-ink">{correoLimpio}</strong>. Puede
            tardar un momento — revisá spam si no aparece.
          </p>
        )}
        <div>
          <label className={labelCls}>Código de 6 dígitos</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className={`${inputCls} text-center text-lg font-bold tracking-[0.3em]`}
            autoFocus
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
        )}
        {reenviado && !error && (
          <p className="rounded-lg bg-aventurea-green/10 px-3 py-2 text-[13px] font-bold text-aventurea-green">
            ✓ Código reenviado — revisá tu correo.
          </p>
        )}

        <button type="submit" disabled={pendiente} className={botonCls}>
          {pendiente ? "Verificando..." : "Entrar"}
        </button>

        <p className="text-center text-[12.5px] text-zinc-500">
          ¿No llegó?{" "}
          <button
            type="button"
            disabled={pendiente}
            onClick={() => enviarCodigo(true)}
            className={enlaceCls}
          >
            Reenviar código
          </button>
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setReenviado(false);
            setPaso("correo");
          }}
          className="text-center text-[12.5px] font-bold text-zinc-500 underline"
        >
          ← Usar otro correo
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviarCodigo();
      }}
      className="mt-5.5 flex flex-col gap-3.5"
    >
      {pedirNombreSiNuevo && correoEsNuevo === true && (
        <p className="rounded-lg bg-aventurea-cream-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          No encontramos una cuenta con ese correo — vamos a crearte una
          nueva. Contanos tu nombre y te mandamos el código:
        </p>
      )}
      {pideNombreAhora && (
        <>
          <div>
            <label className={labelCls}>Tu nombre</label>
            <input
              type="text"
              required
              autoFocus={pedirNombreSiNuevo}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              autoComplete="name"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tu teléfono (WhatsApp)</label>
            <input
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+506 8888-8888"
              autoComplete="tel"
              inputMode="tel"
              className={inputCls}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              Con esto tus reservas se llenan solas — no volvés a escribirlo.
            </p>
          </div>
        </>
      )}
      <div>
        <label className={labelCls}>Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            // Si ya se había comprobado este correo y lo siguen
            // editando, hay que volver a comprobar el nuevo.
            if (pedirNombreSiNuevo && correoEsNuevo !== null) setCorreoEsNuevo(null);
          }}
          placeholder="tucorreo@ejemplo.com"
          className={inputCls}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
      )}

      <button type="submit" disabled={pendiente || comprobando} className={botonCls}>
        {comprobando
          ? "Comprobando tu correo..."
          : pendiente
            ? "Enviando..."
            : pedirNombreSiNuevo && correoEsNuevo === true
              ? "Crear mi cuenta y enviarme el código"
              : "Enviarme el código"}
      </button>

      <p className="text-center text-[12px] leading-relaxed text-aventurea-ink-soft">
        Sin contraseñas: te mandamos un código de un solo uso al correo y con
        eso entrás — no hay nada que recordar.
        {pedirNombreSiNuevo &&
          " Si es tu primera vez, primero te pedimos tu nombre; si ya tenés cuenta, seguís directo."}
      </p>
    </form>
  );
}
