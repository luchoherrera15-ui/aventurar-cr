"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SCOPES_ENTREGA_1, SISTEMAS } from "@/lib/lealtad/api/acuerdo";
import { solicitarAccesoDeveloper } from "./actions";

/**
 * EL FORMULARIO DE ADMISIÓN (puerta 1).
 *
 * No es un alta de auto-servicio y la pantalla lo dice de entrada:
 * quien lo llena queda PENDIENTE, y aprobarlo no le abre ningún dato —
 * después cada negocio tiene que autorizarlo desde su propio panel.
 *
 * Los tres campos incómodos (para qué la va a usar, qué guarda de su
 * lado, y una justificación por cada permiso) son obligatorios a
 * propósito: son el insumo legal de la Ley 8968 y, en la práctica, el
 * filtro más efectivo que hay. Quien no puede contestar «qué guardo de
 * mi lado» tampoco debería tener una llave.
 */

const ACCION = "var(--accion)";
const ACCION_TINTA = "var(--accion-tinta)";

const entrada =
  "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] text-aventurea-ink outline-none focus:border-aventurea-navy";

export default function FormularioDeveloper({ haySesion }: { haySesion: boolean }) {
  const [razonSocial, setRazonSocial] = useState("");
  const [cedula, setCedula] = useState("");
  const [correoTecnico, setCorreoTecnico] = useState("");
  const [correoSeguridad, setCorreoSeguridad] = useState("");
  const [sitioWeb, setSitioWeb] = useState("");
  const [sistema, setSistema] = useState<string>(SISTEMAS[0].id);
  const [usoDeclarado, setUsoDeclarado] = useState("");
  const [datosQueAlmacena, setDatosQueAlmacena] = useState("");
  // `saldo` viene marcado porque es el permiso que no le hace daño a
  // nadie y sin el cual no hay integración posible: sin él no hay forma
  // de obtener el `ref` con el que después se acredita.
  const [scopes, setScopes] = useState<string[]>(["saldo"]);
  const [justificacion, setJustificacion] = useState<Record<string, string>>({});
  const [ips, setIps] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState("");
  const [enviada, setEnviada] = useState(false);
  const [ocupado, iniciar] = useTransition();

  if (!haySesion) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-white p-6">
        <p className="text-[15px] font-extrabold text-aventurea-ink">
          Para pedir acceso necesitás una cuenta de Bookea.
        </p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          Es gratis, y es lo que nos permite saber quién pidió qué y cuándo. La solicitud queda
          firmada con esa cuenta.
        </p>
        <Link
          href="/cuenta?volver=lealtad/developers"
          className="presionable mt-4 inline-block rounded-xl px-5 py-3 text-[14px] font-extrabold"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          Entrar o crear cuenta →
        </Link>
      </div>
    );
  }

  if (enviada) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-white p-6">
        <p className="text-[15px] font-extrabold text-aventurea-ink">Tu solicitud quedó enviada.</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          La revisamos a mano — miramos la identidad, el dominio y para qué decís que la vas a
          usar. Te escribimos al correo técnico. Cuando quedés aprobado, todavía no vas a tener
          ninguna llave: la genera el dueño de cada negocio al autorizarte desde su panel.
        </p>
      </div>
    );
  }

  const alternarScope = (id: string) => {
    setScopes((previos) =>
      previos.includes(id) ? previos.filter((s) => s !== id) : [...previos, id],
    );
  };

  const enviar = () => {
    setError("");
    iniciar(async () => {
      const r = await solicitarAccesoDeveloper({
        razonSocial,
        cedula,
        correoTecnico,
        correoSeguridad,
        sitioWeb,
        sistema,
        usoDeclarado,
        datosQueAlmacena,
        scopes,
        justificacion,
        ips,
        acepta,
      });
      if (r.ok) setEnviada(true);
      else setError(r.motivo);
    });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-aventurea-line bg-white p-5 sm:p-6">
      <Grupo titulo="Quién integra" bajada="Identidad real: es a quien se le reclama si algo pasa.">
        <Campo etiqueta="Razón social o nombre">
          <input className={entrada} value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
        </Campo>
        <Campo etiqueta="Cédula jurídica o física">
          <input className={entrada} value={cedula} onChange={(e) => setCedula(e.target.value)} />
        </Campo>
        <Campo etiqueta="Sitio web (https://)">
          <input
            className={entrada}
            placeholder="https://mipos.cr"
            value={sitioWeb}
            onChange={(e) => setSitioWeb(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Qué sistema vas a conectar">
          <select className={entrada} value={sistema} onChange={(e) => setSistema(e.target.value)}>
            {SISTEMAS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </Grupo>

      <Grupo
        titulo="Dos correos, y tienen que ser distintos"
        bajada="El de seguridad es el del día del problema: si el técnico está comprometido o de vacaciones, ese sigue funcionando."
      >
        <Campo etiqueta="Correo técnico">
          <input
            className={entrada}
            type="email"
            value={correoTecnico}
            onChange={(e) => setCorreoTecnico(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Correo de seguridad">
          <input
            className={entrada}
            type="email"
            value={correoSeguridad}
            onChange={(e) => setCorreoSeguridad(e.target.value)}
          />
        </Campo>
      </Grupo>

      <Grupo
        titulo="Para qué la vas a usar"
        bajada="Esto no es burocracia: es lo que le tenemos que poder contestar al negocio, y a la PRODHAB, si alguien pregunta."
      >
        <Campo etiqueta="Contanos el caso de uso, con detalle">
          <textarea
            className={`${entrada} min-h-[92px]`}
            value={usoDeclarado}
            onChange={(e) => setUsoDeclarado(e.target.value)}
            placeholder="Ej.: al cerrar una factura en la caja, el POS le suma el sello al cliente que presenta su tarjeta."
          />
        </Campo>
        <Campo etiqueta="Qué guardás de tu lado, y por cuánto tiempo">
          <textarea
            className={`${entrada} min-h-[72px]`}
            value={datosQueAlmacena}
            onChange={(e) => setDatosQueAlmacena(e.target.value)}
            placeholder="Ej.: solo el ref y el número de tiquete, 90 días, en nuestra base en Costa Rica."
          />
        </Campo>
      </Grupo>

      <Grupo
        titulo="Qué permisos pedís"
        bajada="Uno por uno, con su motivo. Pedir de más es la forma más rápida de que la solicitud se demore."
      >
        <div className="space-y-3">
          {SCOPES_ENTREGA_1.map((s) => {
            const marcado = scopes.includes(s.id);
            return (
              <div
                key={s.id}
                className="rounded-xl border p-3.5"
                style={{
                  borderColor: marcado ? "var(--accion)" : "var(--line)",
                  background: marcado ? "var(--accion-suave)" : "transparent",
                }}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={marcado}
                    onChange={() => alternarScope(s.id)}
                  />
                  <span>
                    <span className="block text-[13.5px] font-extrabold text-aventurea-ink">
                      {s.nombre}{" "}
                      <code className="text-[11.5px] font-bold text-aventurea-ink-soft">{s.id}</code>
                    </span>
                    <span className="block text-[12.5px] text-aventurea-ink-soft">{s.detalle}</span>
                  </span>
                </label>
                {marcado && (
                  <textarea
                    className={`${entrada} mt-2.5 min-h-[56px]`}
                    placeholder={`¿Para qué necesitás «${s.id}»?`}
                    value={justificacion[s.id] ?? ""}
                    onChange={(e) =>
                      setJustificacion((j) => ({ ...j, [s.id]: e.target.value }))
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </Grupo>

      <Grupo
        titulo="Desde qué IPs vas a llamar (opcional)"
        bajada="Si las declarás, la llave DEJA de funcionar desde cualquier otro lado. Es el candado más barato que existe, y sube tu solicitud en la fila."
      >
        <input
          className={entrada}
          placeholder="190.10.1.1, 190.10.1.2"
          value={ips}
          onChange={(e) => setIps(e.target.value)}
        />
      </Grupo>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-aventurea-line p-3.5">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
        />
        <span className="text-[13px] leading-relaxed text-aventurea-ink">
          Acepto el <strong>Acuerdo de Tratamiento de Datos</strong> (v1.0): la llave vive solo en
          mi servidor, no intento reidentificar a nadie detrás de un <code>ref</code>, no guardo
          los seriales de las tarjetas, y aviso en 72 horas si algo se filtra.{" "}
          <a href="#acuerdo" className="font-bold underline">
            Leerlo completo
          </a>
          .
        </span>
      </label>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-bold text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={ocupado}
        className="presionable w-full rounded-xl px-5 py-3.5 text-[15px] font-extrabold disabled:opacity-60"
        style={{ background: ACCION, color: ACCION_TINTA }}
      >
        {ocupado ? "Enviando…" : "Pedir acceso"}
      </button>
      <p className="text-center text-[12px] text-aventurea-ink-soft">
        La revisamos a mano. Aprobarte no te da ninguna llave: eso lo hace después el dueño de
        cada negocio, desde su panel.
      </p>
    </div>
  );
}

function Grupo({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[14.5px] font-extrabold text-aventurea-ink">{titulo}</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">{bajada}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {etiqueta}
      </span>
      {children}
    </label>
  );
}
