"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { solicitarAltaConPlan } from "./actions";
import type { DatosPago } from "@/app/lealtad/planes/formulario-solicitud";

/**
 * EL CREADOR DE CARDS — onboarding conversacional (estilo Cockato):
 * una pregunta por pantalla, y la tarjeta se va formando EN VIVO al
 * lado mientras responde. Las respuestas son exactamente lo que el
 * programa necesita para nacer FUNCIONANDO al aprobarse: color,
 * regalía y meta de sellos.
 *
 * La salida «Crear personalizado» cambia de camino: en vez del
 * creador, describe lo que sueña y la solicitud queda EN ESPERA para
 * que el equipo la diseñe a mano.
 */

export type PlanWizard = {
  id: string;
  nombre: string;
  limite: number | null;
  precio: number | null;
  beneficios: string[];
  masBeneficios: number;
  destacado: boolean;
};

const NARANJA = "#ee7420";

const TIPOS: { id: string; label: string }[] = [
  { id: "citas", label: "Citas y servicios" },
  { id: "restaurantes", label: "Restaurante o café" },
  { id: "eventos", label: "Eventos" },
  { id: "hospedajes", label: "Hospedaje" },
  { id: "otro", label: "Otro" },
];

const COLORES = [
  "#0a1226",
  "#16295e",
  "#1f6f50",
  "#7c2d3a",
  "#6b21a8",
  "#b45309",
  "#0e7490",
  "#374151",
];

const METAS = [5, 6, 8, 10, 12];

type Pantalla =
  | "nombre"
  | "tipo"
  | "color"
  | "logo"
  | "regalia"
  | "meta"
  | "descripcion"
  | "paquete"
  | "pago";

const etiqueta = "grid gap-1 text-[11.5px] font-bold uppercase tracking-wide text-white/50";
const campo =
  "rounded-[12px] border border-white/20 bg-[#131c36] px-4 py-3 text-[15px] font-normal normal-case tracking-normal text-white placeholder:text-white/30";

export default function WizardAlta({ planes, pago }: { planes: PlanWizard[]; pago: DatosPago }) {
  const [camino, setCamino] = useState<"creador" | "personalizado">("creador");
  const [indice, setIndice] = useState(0);

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("citas");
  const [detalleOtro, setDetalleOtro] = useState("");
  const [color, setColor] = useState(COLORES[1]);
  const [logoUrl, setLogoUrl] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState("");
  const [regalia, setRegalia] = useState("");
  const [meta, setMeta] = useState(10);
  const [descripcion, setDescripcion] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<"sinpe" | "transferencia">("sinpe");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviada" | string>("editando");
  const [creado, setCreado] = useState<{ ranchoId: string; slug: string | null } | null>(null);
  const [ocupado, iniciar] = useTransition();

  const pantallas: Pantalla[] =
    camino === "creador"
      ? ["nombre", "tipo", "color", "logo", "regalia", "meta", "paquete", "pago"]
      : ["nombre", "tipo", "descripcion", "paquete", "pago"];
  const pantalla = pantallas[Math.min(indice, pantallas.length - 1)];
  const planElegido = planes.find((p) => p.id === plan) ?? null;
  const esGratis = planElegido?.precio === 0;

  function avanzar() {
    setIndice((i) => Math.min(i + 1, pantallas.length - 1));
  }
  function atras() {
    setIndice((i) => Math.max(i - 1, 0));
  }
  function irAPersonalizado() {
    setCamino("personalizado");
    setIndice(2); // nombre y tipo se conservan; sigue la descripción
  }
  function volverAlCreador() {
    setCamino("creador");
    setIndice(2);
  }

  const puedeAvanzar: Record<Pantalla, boolean> = {
    nombre: !!nombre.trim(),
    tipo: tipo !== "otro" || !!detalleOtro.trim(),
    color: true,
    logo: !subiendoLogo,
    regalia: !!regalia.trim(),
    meta: meta >= 1,
    descripcion: descripcion.trim().length >= 5,
    paquete: !!plan,
    pago: !ocupado && !subiendo && (esGratis || !!comprobanteUrl),
  };

  async function subirComprobante(archivo: File) {
    setErrorSubida("");
    if (archivo.size > 8 * 1024 * 1024) {
      setErrorSubida("El archivo pesa más de 8 MB — mandá una captura más liviana.");
      return;
    }
    setSubiendo(true);
    const supabase = createClient();
    const liviano = await comprimirImagen(archivo);
    const ext = liviano.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `solicitudes-lealtad/alta-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("comprobantes").upload(path, liviano);
    if (error) {
      setErrorSubida("No pudimos subir el comprobante. Intentá de nuevo.");
      setSubiendo(false);
      return;
    }
    const { data } = supabase.storage.from("comprobantes").getPublicUrl(path);
    setComprobanteUrl(data?.publicUrl ?? "");
    setSubiendo(false);
  }

  async function subirLogo(archivo: File) {
    setErrorLogo("");
    if (archivo.size > 8 * 1024 * 1024) {
      setErrorLogo("El archivo pesa más de 8 MB — probá con una versión más liviana.");
      return;
    }
    setSubiendoLogo(true);
    const supabase = createClient();
    const liviano = await comprimirImagen(archivo);
    const ext = liviano.name.split(".").pop()?.toLowerCase() || "png";
    const path = `logos-negocio/alta-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("comprobantes").upload(path, liviano);
    if (error) {
      setErrorLogo("No pudimos subir el logo. Intentá de nuevo.");
      setSubiendoLogo(false);
      return;
    }
    const { data } = supabase.storage.from("comprobantes").getPublicUrl(path);
    setLogoUrl(data?.publicUrl ?? "");
    setSubiendoLogo(false);
  }

  function enviar() {
    if (!planElegido) return;
    iniciar(async () => {
      const res = await solicitarAltaConPlan({
        nombreNegocio: nombre,
        tipo,
        detalleOtro,
        plan: planElegido.id,
        metodoPago: metodo,
        comprobanteUrl,
        telefono,
        personalizado: camino === "personalizado",
        descripcion,
        paseColor: color,
        paseLogoUrl: logoUrl,
        regalia,
        metaSellos: meta,
      });
      if (res.ok && res.creado) setCreado(res.creado);
      setEstado(res.ok ? "enviada" : res.motivo);
    });
  }

  // El camino AUTOMÁTICO del Gratis: no hay espera — la tarjeta existe.
  if (estado === "enviada" && creado) {
    return (
      <div className="rounded-2xl bg-white/10 p-6 text-center">
        <p className="text-[18px] font-extrabold text-white">¡Tu tarjeta está LISTA! 🎉</p>
        <p className="mx-auto mt-2 max-w-[440px] text-[13px] leading-relaxed text-white/60">
          <strong className="text-white">{nombre}</strong> quedó creado con su programa
          funcionando: {meta} sellos → {regalia || "tu regalía"}. Compartí el QR de tu
          panel y tus primeros 5 clientes ya pueden agregarla al teléfono.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/lealtad/panel/${creado.ranchoId}`}
            className="rounded-full px-6 py-3 text-[14px] font-bold text-white"
            style={{ background: NARANJA }}
          >
            Ir a mi panel →
          </a>
          {creado.slug && (
            <a
              href={`/tarjeta/${creado.slug}`}
              className="rounded-full border border-white/25 px-6 py-3 text-[14px] font-bold text-white/85"
            >
              Ver mi tarjeta como cliente
            </a>
          )}
        </div>
      </div>
    );
  }

  if (estado === "enviada") {
    return (
      <div className="rounded-2xl bg-white/10 p-6 text-center">
        <p className="text-[16px] font-extrabold text-white">
          {camino === "personalizado" ? "¡Pedido en espera!" : "¡Solicitud enviada!"}
        </p>
        <p className="mx-auto mt-2 max-w-[440px] text-[13px] leading-relaxed text-white/60">
          {camino === "personalizado" ? (
            <>
              Tu diseño personalizado para{" "}
              <strong className="text-white">{nombre}</strong> quedó en manos del equipo:
              lo armamos con vos y te contactamos al correo.
            </>
          ) : (
            <>
              Recibimos los datos de <strong className="text-white">{nombre}</strong>. Si
              Bookea acepta la solicitud, tu negocio y tu tarjeta quedan creados TAL CUAL
              la armaste — te avisamos al correo.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      {/* ── La pregunta de turno ── */}
      <div className="rounded-2xl bg-white/10 p-5 sm:p-6">
        {/* Progreso */}
        <div className="flex items-center gap-1.5">
          {pantallas.map((p, i) => (
            <span
              key={p}
              className={`h-1.5 flex-1 rounded-full ${i <= indice ? "bg-[#ee7420]" : "bg-white/15"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-white/45">
          {indice + 1} de {pantallas.length}
          {camino === "personalizado" && " · diseño personalizado"}
        </p>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (pantalla === "pago") enviar();
            else if (puedeAvanzar[pantalla]) avanzar();
          }}
        >
          {pantalla === "nombre" && (
            <Pregunta titulo="¿Cómo se llama tu negocio?">
              <input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                placeholder="Café La Esquina"
                className={campo}
              />
            </Pregunta>
          )}

          {pantalla === "tipo" && (
            <Pregunta titulo="¿Qué tipo de negocio es?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TIPOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipo(t.id)}
                    className={`rounded-xl border px-3 py-3 text-[13px] font-bold transition-colors ${
                      tipo === t.id
                        ? "border-[#ee7420] bg-[#ee7420]/15 text-white"
                        : "border-white/20 text-white/60 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tipo === "otro" && (
                <label className={`${etiqueta} mt-3`}>
                  ¿Qué negocio es?
                  <input
                    autoFocus
                    value={detalleOtro}
                    onChange={(e) => setDetalleOtro(e.target.value)}
                    maxLength={80}
                    placeholder="Ferretería, academia de baile, veterinaria…"
                    className={campo}
                  />
                </label>
              )}
            </Pregunta>
          )}

          {pantalla === "color" && (
            <Pregunta titulo="¿De qué color querés tu tarjeta?">
              <div className="flex flex-wrap items-center gap-2.5">
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    className="h-11 w-11 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: color === c ? NARANJA : "rgba(255,255,255,.25)",
                    }}
                  />
                ))}
                <label
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-white/25 px-3 text-[12px] font-bold text-white/70"
                  style={color && !COLORES.includes(color) ? { borderColor: NARANJA } : undefined}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                  Otro color
                </label>
              </div>
            </Pregunta>
          )}

          {pantalla === "logo" && (
            <Pregunta titulo="¿Tenés logo? Subilo (opcional)">
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Tu logo"
                    className="h-16 w-16 rounded-xl border border-white/20 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="text-[12.5px] font-bold text-white/50 underline"
                  >
                    Quitarlo
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  disabled={subiendoLogo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void subirLogo(f);
                  }}
                  className="block w-full text-[12.5px] text-white/60 file:mr-3 file:rounded-[10px] file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-white"
                />
              )}
              {subiendoLogo && <p className="mt-1 text-[12px] text-white/50">Subiendo…</p>}
              {errorLogo && (
                <p className="mt-1 text-[12.5px] font-bold text-red-300">{errorLogo}</p>
              )}
              <p className="mt-2 text-[12px] text-white/45">
                Va arriba de la tarjeta y dentro de cada sello. Sin logo, la tarjeta
                escribe el nombre de tu negocio — podés subirlo después.
              </p>
            </Pregunta>
          )}

          {pantalla === "regalia" && (
            <Pregunta titulo="¿Qué regalía van a perseguir tus clientes?">
              <input
                autoFocus
                value={regalia}
                onChange={(e) => setRegalia(e.target.value)}
                maxLength={120}
                placeholder="Tu bebida favorita gratis"
                className={campo}
              />
              <p className="mt-2 text-[12px] text-white/45">
                Es lo que la tarjeta promete abajo del contador — corto y antojable.
              </p>
            </Pregunta>
          )}

          {pantalla === "meta" && (
            <Pregunta titulo="¿Cuántos sellos cuesta ganarla?">
              <div className="flex flex-wrap gap-2">
                {METAS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMeta(m)}
                    className={`h-12 w-12 rounded-xl border text-[15px] font-extrabold transition-colors ${
                      meta === m
                        ? "border-[#ee7420] bg-[#ee7420]/15 text-white"
                        : "border-white/20 text-white/60 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-white/45">
                10 es el clásico; 5–6 premia rápido y engancha antes.
              </p>
            </Pregunta>
          )}

          {pantalla === "descripcion" && (
            <Pregunta titulo="Contanos cómo la soñás">
              <textarea
                autoFocus
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Colores de mi marca, mi logo, dos niveles de premios, texto en inglés…"
                className={campo}
              />
              <p className="mt-2 text-[12px] text-white/45">
                El equipo de Bookea diseña la tarjeta contigo — este pedido queda en
                espera hasta que lo veamos juntos.{" "}
                <button type="button" onClick={volverAlCreador} className="font-bold underline">
                  ← Mejor uso el creador
                </button>
              </p>
            </Pregunta>
          )}

          {pantalla === "paquete" && (
            <Pregunta titulo="Elegí tu paquete">
              {/* En rejilla, no en lista: cuatro planes apilados hacían
                  la pantalla el doble de alta que las demás. */}
              <div className="grid gap-2 sm:grid-cols-2">
                {planes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPlan(p.id);
                      avanzar();
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      plan === p.id
                        ? "border-[#ee7420] bg-[#ee7420]/10"
                        : p.destacado
                          ? "border-[#ee7420]/50 bg-white/5 hover:bg-white/10"
                          : "border-white/15 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14.5px] font-extrabold text-white">{p.nombre}</span>
                      {p.precio !== null && (
                        <span className="shrink-0 text-[13.5px] font-extrabold text-white">
                          {p.precio === 0 ? "₡0" : `₡${p.precio.toLocaleString("es-CR")}`}
                          <span className="text-[10.5px] font-bold text-white/50">
                            {p.precio === 0 ? "" : "/mes"}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] font-bold text-white/45">
                      {p.limite === null
                        ? "Miembros ilimitados"
                        : `Hasta ${p.limite.toLocaleString("es-CR")} miembros`}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-white/55">
                      {p.beneficios.join(" · ")}
                      {p.masBeneficios > 0 ? ` · y ${p.masBeneficios} más` : ""}
                    </p>
                  </button>
                ))}
              </div>
            </Pregunta>
          )}

          {pantalla === "pago" && planElegido && (
            <Pregunta
              titulo={
                esGratis
                  ? "Listo — el plan Gratis no lleva depósito"
                  : `Depositá ₡${(planElegido.precio ?? 0).toLocaleString("es-CR")} (primer mes)`
              }
            >
              {!esGratis && (
                <div className="grid gap-3 rounded-xl border border-white/15 bg-[#0f1930] p-3.5 sm:grid-cols-2">
                  <div>
                  <div className="flex gap-1.5">
                    {(["sinpe", "transferencia"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetodo(m)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                          metodo === m ? "bg-white text-[#0a1226]" : "bg-white/10 text-white/60"
                        }`}
                      >
                        {m === "sinpe" ? "SINPE Móvil" : "Transferencia"}
                      </button>
                    ))}
                  </div>
                  {metodo === "sinpe" ? (
                    <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                      SINPE Móvil al <strong className="text-white">{pago.sinpe.numero}</strong>{" "}
                      a nombre de <strong className="text-white">{pago.sinpe.titular}</strong>.
                      En el detalle poné «{nombre.trim() || "tu negocio"}».
                    </p>
                  ) : pago.banco.cuenta ? (
                    <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                      {pago.banco.nombre} · cuenta{" "}
                      <strong className="text-white">{pago.banco.cuenta}</strong> a nombre de{" "}
                      <strong className="text-white">{pago.banco.titular}</strong>.
                    </p>
                  ) : (
                    <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                      Escribinos y te pasamos la cuenta — o usá SINPE Móvil al{" "}
                      <strong className="text-white">{pago.sinpe.numero}</strong>, que es
                      inmediato.
                    </p>
                  )}

                  </div>

                  <div className="sm:border-l sm:border-white/10 sm:pl-3">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-white/50">
                    Adjuntá la captura del depósito
                  </p>
                  {comprobanteUrl ? (
                    <p className="mt-1.5 text-[12.5px] font-bold text-emerald-300">
                      ✓ Comprobante adjunto.{" "}
                      <button
                        type="button"
                        onClick={() => setComprobanteUrl("")}
                        className="font-bold text-white/50 underline"
                      >
                        Cambiarlo
                      </button>
                    </p>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      disabled={subiendo}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void subirComprobante(f);
                      }}
                      className="mt-1.5 block w-full text-[12.5px] text-white/60 file:mr-3 file:rounded-[10px] file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-white"
                    />
                  )}
                  {subiendo && <p className="mt-1 text-[12px] text-white/50">Subiendo…</p>}
                  {errorSubida && (
                    <p className="mt-1 text-[12.5px] font-bold text-red-300">{errorSubida}</p>
                  )}
                  </div>
                </div>
              )}

              <label className={`${etiqueta} mt-3`}>
                Teléfono (para coordinar)
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="8888 8888"
                  maxLength={30}
                  className={campo}
                />
              </label>
            </Pregunta>
          )}

          {/* ── Los controles ── */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {pantalla !== "paquete" && (
              <button
                type="submit"
                disabled={!puedeAvanzar[pantalla]}
                className="rounded-xl bg-[#ee7420] px-6 py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
              >
                {pantalla === "pago"
                  ? ocupado
                    ? camino === "creador" && esGratis
                      ? "Creando tu tarjeta…"
                      : "Enviando…"
                    : camino === "personalizado"
                      ? "Enviar mi pedido"
                      : esGratis
                        ? "Crear mi tarjeta YA →"
                        : "Enviar la solicitud"
                  : "Continuar →"}
              </button>
            )}
            {indice > 0 && (
              <button
                type="button"
                onClick={atras}
                className="text-[12.5px] font-bold text-white/50 underline"
              >
                ← Atrás
              </button>
            )}
          </div>

          {/* La salida al diseño a mano, visible durante el creador. */}
          {camino === "creador" && ["color", "regalia", "meta"].includes(pantalla) && (
            <p className="mt-4 text-[12px] text-white/40">
              ¿Lo querés más personalizado (logo, niveles, otro estilo)?{" "}
              <button
                type="button"
                onClick={irAPersonalizado}
                className="font-bold text-white/70 underline"
              >
                Crear personalizado
              </button>
            </p>
          )}

          {estado !== "editando" && (
            <p className="mt-3 text-[12.5px] font-bold text-red-300">{estado}</p>
          )}
        </form>
      </div>

      {/* ── La tarjeta formándose en vivo ── */}
      <div className="lg:sticky lg:top-6">
        <p className="mb-2 text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
          Tu tarjeta, en vivo
        </p>
        {camino === "personalizado" ? (
          <div
            className="flex min-h-[190px] flex-col items-center justify-center rounded-[22px] border border-dashed border-white/30 p-6 text-center"
            style={{ background: "rgba(255,255,255,.04)" }}
          >
            <span className="text-[26px]">✨</span>
            <p className="mt-2 text-[13.5px] font-extrabold text-white">
              {nombre.trim() || "Tu negocio"}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-white/50">
              Diseño personalizado — el equipo la arma contigo.
            </p>
          </div>
        ) : (
          <VistaPrevia
            nombre={nombre}
            color={color}
            logoUrl={logoUrl}
            regalia={regalia}
            meta={meta}
          />
        )}
      </div>
    </div>
  );
}

function Pregunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[20px] font-extrabold leading-snug text-white">{titulo}</h2>
      <div className="mt-4 grid gap-1">{children}</div>
    </div>
  );
}

/** La tarjeta de verdad, con lo respondido hasta ahora. */
function VistaPrevia({
  nombre,
  color,
  logoUrl,
  regalia,
  meta,
}: {
  nombre: string;
  color: string;
  logoUrl: string;
  regalia: string;
  meta: number;
}) {
  const logrados = Math.min(3, Math.max(1, meta - 1));
  const columnas = meta > 10 ? 6 : 5;
  return (
    <div
      className="overflow-hidden rounded-[22px] p-4"
      style={{
        background: `linear-gradient(165deg, ${color} 0%, #070c1f 130%)`,
        boxShadow: "0 22px 40px -20px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.1)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 truncate text-[14px] font-extrabold text-white">
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full border border-white/30 object-cover"
            />
          )}
          {nombre.trim() || "Tu negocio"}
        </p>
        <p className="shrink-0 text-[13px] font-extrabold" style={{ color: "#ffb076" }}>
          {logrados}/{meta}
        </p>
      </div>
      <div
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: meta }, (_, i) => (
          <span
            key={i}
            className="flex aspect-square items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={
              i < logrados
                ? { background: NARANJA }
                : { border: "2px dashed rgba(255,255,255,.35)" }
            }
          >
            {i < logrados ? "✓" : ""}
          </span>
        ))}
      </div>
      <p className="mt-3 truncate text-[11.5px] font-bold text-white/85">
        🎁 {regalia.trim() || "Tu regalía va acá"}
      </p>
      <p className="mt-2 text-right text-[8.5px] text-white/40">Powered by Bookea.lat</p>
    </div>
  );
}
