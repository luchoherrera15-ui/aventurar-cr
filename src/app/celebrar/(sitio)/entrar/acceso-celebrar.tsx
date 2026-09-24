"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LA PUERTA DE CELEBRAR — misma cuenta que Bookea, otra casa
 * ══════════════════════════════════════════════════════════════════
 *
 * Usa la MISMA identidad de Supabase Auth que el resto del sitio (y
 * que la app móvil): un correo que ya tiene cuenta entra; uno nuevo la
 * crea acá mismo. No hay «cuenta de CELEBRAR» aparte — decisión D-3.
 *
 * Tres caminos, por orden de uso esperado:
 *   1. Código por correo (6 dígitos, `signInWithOtp` + `verifyOtp`):
 *      el de siempre en Bookea, sin contraseña que olvidar.
 *   2. Google / Facebook (`signInWithOAuth`), detrás de las mismas
 *      banderas de entorno que el resto del sitio.
 *   3. Contraseña (`signInWithPassword`), para quien prefiera. Como las
 *      cuentas nacen sin contraseña, «Crear o recuperar contraseña»
 *      manda el correo de recuperación y la persona la define después.
 *
 * Por qué NO se reutiliza `FormularioCodigoAcceso` de /cuenta: ese
 * componente lleva la voz, los textos y las clases de Bookea («tus
 * reservas», teléfono obligatorio, paleta navy) y el dueño pidió que
 * acá la persona sienta que está en otra plataforma. Se comparte el
 * MECANISMO (Supabase, la RPC `existe_cuenta`, el callback), no la
 * pantalla. Queda anotado como duplicación deliberada en
 * docs/celebrar/fase-1.md.
 *
 * `destino` llega YA con el prefijo del host (lo calcula la página con
 * `destinoDentroDeCelebrar`). El callback de OAuth se arma con el host
 * real del navegador: en celebrar.lat es `/auth/callback`, en Bookea
 * `/celebrar/auth/callback`.
 */

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Modo = "codigo" | "contrasena";
type Paso = "correo" | "nombre" | "codigo";

export default function AccesoCelebrar({
  destino,
  modoInicial = "codigo",
}: {
  destino: string;
  modoInicial?: Modo;
}) {
  // Solo código por correo: el modo queda fijo.
  const modo: Modo = modoInicial === "contrasena" ? "codigo" : modoInicial;
  const [paso, setPaso] = useState<Paso>("correo");
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const correoLimpio = correo.trim().toLowerCase();

  function irAlDestino() {
    // Navegación completa: el servidor rehace el layout con la cookie
    // recién puesta (un `router.push` mostraría la barra sin sesión).
    window.location.href = destino;
  }

  // ── Camino 1: código por correo ─────────────────────────────────
  async function enviarCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setAviso(null);
    if (!CORREO_REGEX.test(correoLimpio)) {
      setError("Revisá el correo: no parece válido.");
      return;
    }
    const supabase = createClient();
    setPendiente(true);

    // Primera vez con este correo: se pide el nombre antes de mandar el
    // código, y se explica por qué. Segunda vez: directo al código.
    if (paso === "correo") {
      const { data: existe, error: errRpc } = await supabase.rpc("existe_cuenta", {
        p_email: correoLimpio,
      });
      if (errRpc) {
        setPendiente(false);
        setError("No pudimos comprobar el correo. Probá de nuevo en un momento.");
        return;
      }
      if (!existe) {
        setPendiente(false);
        setPaso("nombre");
        return;
      }
    }
    if (paso === "nombre" && nombre.trim().length < 2) {
      setPendiente(false);
      setError("Contanos tu nombre para crear la cuenta.");
      return;
    }

    const { error: errOtp } = await supabase.auth.signInWithOtp({
      email: correoLimpio,
      options: {
        shouldCreateUser: true,
        data:
          paso === "nombre"
            ? { nombre: nombre.trim(), rol: "cliente", origen: "celebrar" }
            : { origen: "celebrar" },
      },
    });
    setPendiente(false);
    if (errOtp) {
      setError(
        errOtp.status === 429
          ? "Ya te mandamos un código hace poco. Esperá un minuto y volvé a intentar."
          : `No se pudo enviar el código: ${errOtp.message}`,
      );
      return;
    }
    setCodigo("");
    setPaso("codigo");
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const limpio = codigo.replace(/\s+/g, "");
    if (limpio.length !== 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }
    setPendiente(true);
    const supabase = createClient();
    const { data, error: errVerificar } = await supabase.auth.verifyOtp({
      email: correoLimpio,
      token: limpio,
      type: "email",
    });
    if (errVerificar || !data.user) {
      setPendiente(false);
      setError("Ese código no sirve o ya venció. Revisá el último correo o pedí uno nuevo.");
      return;
    }
    irAlDestino();
  }


  const ocupado = pendiente;

  return (
    <div className="w-full max-w-md">
      {/* Un solo camino: el código por correo (decisión del dueño, 21 sep 2026).
          La contraseña y los proveedores sociales quedaron fuera de la pantalla. */}
      {modo === "codigo" && paso !== "codigo" && (
        <form onSubmit={enviarCodigo} className="grid gap-5" noValidate>
          <div>
            <label htmlFor="acceso-correo" className="c-rotulo">
              Tu correo
            </label>
            <input
              id="acceso-correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              value={correo}
              onChange={(e) => {
                setCorreo(e.target.value);
                if (paso === "nombre") setPaso("correo");
              }}
              className="c-campo"
              placeholder="nombre@correo.com"
            />
          </div>

          {paso === "nombre" && (
            <div>
              <label htmlFor="acceso-nombre" className="c-rotulo">
                ¿Cómo te llamás?
              </label>
              <input
                id="acceso-nombre"
                type="text"
                autoComplete="name"
                autoFocus
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="c-campo"
                placeholder="Tu nombre"
              />
              <p className="mt-2 text-[14px] leading-relaxed text-(--c-tinta-suave)">
                Es tu primera vez acá: con tu nombre creamos la cuenta. Después te mandamos el
                código.
              </p>
            </div>
          )}

          <Mensajes error={error} aviso={aviso} />

          <button type="submit" disabled={ocupado} className="c-boton c-boton-primario w-full">
            {pendiente
              ? "Un momento…"
              : paso === "nombre"
                ? "Crear mi cuenta y recibir el código"
                : "Recibir el código"}
          </button>
          <p className="text-[14px] leading-relaxed text-(--c-tinta-suave)">
            Te mandamos un código de 6 dígitos. Si ya tenés cuenta en Bookea, es la misma: entrás
            con ese correo.
          </p>
        </form>
      )}

      {modo === "codigo" && paso === "codigo" && (
        <form onSubmit={verificarCodigo} className="grid gap-5" noValidate>
          <div>
            <label htmlFor="acceso-codigo" className="c-rotulo">
              El código que te llegó a {correoLimpio}
            </label>
            <input
              id="acceso-codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="c-campo text-center text-2xl tracking-[0.4em]"
              placeholder="000000"
            />
          </div>

          <Mensajes error={error} aviso={aviso} />

          <button type="submit" disabled={ocupado} className="c-boton c-boton-primario w-full">
            {pendiente ? "Entrando…" : "Entrar"}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                setAviso("Te mandamos otro código.");
                void enviarCodigo();
              }}
              className="c-enlace"
            >
              Mandarme otro código
            </button>
            <button
              type="button"
              onClick={() => {
                setPaso("correo");
                setCodigo("");
                setError(null);
                setAviso(null);
              }}
              className="c-enlace"
            >
              Cambiar el correo
            </button>
          </div>
        </form>
      )}

    </div>
  );

}

function Mensajes({ error, aviso }: { error: string | null; aviso: string | null }) {
  if (!error && !aviso) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-[14px] leading-relaxed ${
        error ? "bg-(--c-coral-suave) text-(--c-coral-tinta)" : "bg-(--c-celeste) text-(--c-azul-tinta)"
      }`}
    >
      {error ?? aviso}
    </p>
  );
}
