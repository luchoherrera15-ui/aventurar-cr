"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 */
export default function FormularioCodigoAcceso({
  destino,
  acento = "navy",
  crearCuenta = false,
  pedirNombre = false,
  datosNuevos,
  soloAdmin = false,
}: {
  /** A dónde navegar cuando la sesión queda iniciada. */
  destino: string;
  acento?: "navy" | "orange";
  /** true = un correo sin cuenta se registra solo en el mismo paso. */
  crearCuenta?: boolean;
  pedirNombre?: boolean;
  /** Metadata del usuario nuevo (rol, etc.) cuando crearCuenta. */
  datosNuevos?: Record<string, unknown>;
  soloAdmin?: boolean;
}) {
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);

  const correoLimpio = email.trim().toLowerCase();
  const botonCls = `mt-1 flex h-11 items-center justify-center rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60 ${
    acento === "orange"
      ? "bg-aventurea-orange hover:bg-aventurea-orange-dark"
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
    if (pedirNombre && !nombre.trim()) {
      setError("Contanos tu nombre para crear la cuenta.");
      return;
    }
    setPendiente(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: correoLimpio,
      options: {
        shouldCreateUser: crearCuenta,
        data: pedirNombre
          ? { ...datosNuevos, nombre: nombre.trim() }
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
        await supabase.auth.signOut();
        setPendiente(false);
        setError("Esta cuenta no tiene acceso al panel de administración.");
        return;
      }
    }

    // Navegación completa (no push): así el servidor rehace el layout
    // con la cookie de sesión recién puesta.
    window.location.href = destino;
  }

  if (paso === "codigo") {
    return (
      <form onSubmit={verificarCodigo} className="mt-5.5 flex flex-col gap-3.5">
        <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
          Te mandamos un código de 6 dígitos a{" "}
          <strong className="text-aventurea-ink">{correoLimpio}</strong>. Puede
          tardar un momento — revisá spam si no aparece.
        </p>
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
      {pedirNombre && (
        <div>
          <label className={labelCls}>Tu nombre</label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            className={inputCls}
          />
        </div>
      )}
      <div>
        <label className={labelCls}>Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          className={inputCls}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
      )}

      <button type="submit" disabled={pendiente} className={botonCls}>
        {pendiente ? "Enviando..." : "Enviarme el código"}
      </button>

      <p className="text-center text-[12px] leading-relaxed text-zinc-400">
        Sin contraseñas: te mandamos un código al correo y con eso entrás.
      </p>
    </form>
  );
}
