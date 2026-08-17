"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import {
  ACUERDO_VERSION,
  esScopeValido,
  esSistemaValido,
  hashDelAcuerdo,
} from "@/lib/lealtad/api/acuerdo";

/**
 * PEDIR ACCESO DE DESARROLLADOR — la puerta 1.
 *
 * Calcado del patrón de `solicitudes_lealtad` (0126) que ya existe: el
 * INSERT va con la sesión del usuario y las políticas de la 0176 son
 * las que deciden («a nombre propio y siempre naciendo pendiente»).
 * Este archivo no inventa permisos, los hereda.
 *
 * El aviso a Bookea sale en `after()` —después de responder— y la FILA
 * es la fuente de verdad: si el correo se pierde, la solicitud sigue
 * visible en /admin/developers.
 *
 * ------------------------------------------------------------------
 * APROBAR ACÁ NO ABRE NINGÚN DATO
 * ------------------------------------------------------------------
 * Bookea aprueba EXISTIR, no aprueba datos. Un desarrollador aprobado
 * queda con estado `aprobado` y cero llaves: hasta que el dueño de un
 * negocio lo autorice desde SU panel, no puede leer nada de nadie.
 * Si Bookea aprobara sola y con eso se abrieran 300 barberías, Bookea
 * sería la parte que cede datos ajenos sin autorización del
 * responsable — indefendible ante la PRODHAB y ante el negocio.
 */

export type ResultadoSolicitud = { ok: true } | { ok: false; motivo: string };

export type DatosSolicitudDeveloper = {
  razonSocial: string;
  cedula: string;
  correoTecnico: string;
  correoSeguridad: string;
  sitioWeb: string;
  sistema: string;
  usoDeclarado: string;
  datosQueAlmacena: string;
  scopes: string[];
  justificacion: Record<string, string>;
  ips: string;
  acepta: boolean;
};

/** Un correo "suficientemente correo" — la verdad la dice el envío. */
function pareceCorreo(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) && valor.length <= 160;
}

export async function solicitarAccesoDeveloper(
  datos: DatosSolicitudDeveloper,
): Promise<ResultadoSolicitud> {
  const razonSocial = datos.razonSocial.trim().slice(0, 120);
  const cedula = datos.cedula.trim().slice(0, 30);
  const correoTecnico = datos.correoTecnico.trim().toLowerCase();
  const correoSeguridad = datos.correoSeguridad.trim().toLowerCase();
  const sitioWeb = datos.sitioWeb.trim();
  const usoDeclarado = datos.usoDeclarado.trim().slice(0, 1000);
  const datosQueAlmacena = datos.datosQueAlmacena.trim().slice(0, 1000);

  if (razonSocial.length < 2) return { ok: false, motivo: "Escribí la razón social." };
  if (cedula.length < 5) {
    return { ok: false, motivo: "Escribí la cédula jurídica o física de quien integra." };
  }
  if (!pareceCorreo(correoTecnico)) return { ok: false, motivo: "El correo técnico no es válido." };
  if (!pareceCorreo(correoSeguridad)) {
    return { ok: false, motivo: "El correo de seguridad no es válido." };
  }
  // Separado y obligatorio: el día del incidente, el correo técnico
  // puede estar justamente en manos del atacante.
  if (correoSeguridad === correoTecnico) {
    return {
      ok: false,
      motivo: "El correo de seguridad tiene que ser DISTINTO del técnico — es el del día del problema.",
    };
  }
  if (sitioWeb && !/^https:\/\/[^\s]+$/.test(sitioWeb)) {
    return { ok: false, motivo: "El sitio web tiene que empezar con https://" };
  }
  if (!esSistemaValido(datos.sistema)) {
    return { ok: false, motivo: "Elegí qué tipo de sistema vas a conectar." };
  }
  if (usoDeclarado.length < 20) {
    return {
      ok: false,
      motivo: "Contanos con detalle para qué vas a usar la API (mínimo 20 caracteres).",
    };
  }
  if (datosQueAlmacena.length < 10) {
    return { ok: false, motivo: "Decinos qué vas a guardar de tu lado." };
  }

  // La lista blanca de verdad vive en el `check` de la base; esto es la
  // segunda puerta del mismo pasillo.
  const scopes = [...new Set(datos.scopes.filter(esScopeValido))];
  if (scopes.length === 0) {
    return { ok: false, motivo: "Elegí al menos un permiso, y explicá para qué lo necesitás." };
  }
  const justificacion: Record<string, string> = {};
  for (const scope of scopes) {
    const texto = (datos.justificacion[scope] ?? "").trim().slice(0, 400);
    if (texto.length < 10) {
      return {
        ok: false,
        motivo: `Falta la justificación del permiso «${scope}»: escribí para qué lo necesitás.`,
      };
    }
    justificacion[scope] = texto;
  }

  // Las IPs son opcionales. Se validan por forma acá y la base las
  // rechaza si no son `inet` de verdad.
  const ips = datos.ips
    .split(/[\s,;]+/)
    .map((i) => i.trim())
    .filter(Boolean)
    .slice(0, 20);
  const ipMala = ips.find((i) => !/^[0-9a-fA-F.:]{3,45}$/.test(i));
  if (ipMala) return { ok: false, motivo: `«${ipMala}» no parece una dirección IP.` };

  if (!datos.acepta) {
    return { ok: false, motivo: "Hay que aceptar el Acuerdo de Tratamiento de Datos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión para pedir acceso." };

  const { error } = await supabase.from("desarrolladores").insert({
    razon_social: razonSocial,
    cedula,
    correo_tecnico: correoTecnico,
    correo_seguridad: correoSeguridad,
    sitio_web: sitioWeb || null,
    sistema: datos.sistema,
    uso_declarado: usoDeclarado,
    datos_que_almacena: datosQueAlmacena,
    scopes_solicitados: scopes,
    justificacion,
    ips_permitidas: ips.length ? ips : null,
    acuerdo_version: ACUERDO_VERSION,
    acuerdo_hash: hashDelAcuerdo(),
    solicitante_id: user.id,
    estado: "pendiente",
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        motivo: "Ya tenés una solicitud en revisión — te contactamos apenas la veamos.",
      };
    }
    if (error.code === "42501") {
      return { ok: false, motivo: "Tu sesión no permite dejar esta solicitud." };
    }
    if (/desarrolladores/.test(error.message) && /does not exist|schema cache|Could not find/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0176 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo enviar: " + error.message };
  }

  const correo = user.email ?? "(sin correo)";
  after(() =>
    avisarAAdministradores({
      subject: `SOLICITUD DE DEVELOPER — ${razonSocial}`,
      html: `
        <h2 style="margin:0 0 12px">Alguien pide acceso a la API de Lealtad</h2>
        <p style="margin:0 0 12px;padding:10px 12px;background:#fff4e5;border-left:3px solid #ee7420;font-size:13px">
          Aprobar acá <b>no abre ningún dato</b>: solo lo habilita a existir. Después, cada
          negocio tiene que autorizarlo desde su propio panel.
        </p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0"><b>Razón social</b></td><td>${escapar(razonSocial)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Cédula</b></td><td>${escapar(cedula)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Sistema</b></td><td>${escapar(datos.sistema)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Sitio</b></td><td>${escapar(sitioWeb || "—")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Correo técnico</b></td><td>${escapar(correoTecnico)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Correo de seguridad</b></td><td>${escapar(correoSeguridad)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Cuenta Bookea</b></td><td>${escapar(correo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Permisos pedidos</b></td><td>${escapar(scopes.join(", "))}</td></tr>
        </table>
        <p style="margin:16px 0 4px"><b>Para qué dice que la va a usar</b></p>
        <p style="margin:0;font-size:13px">${escapar(usoDeclarado)}</p>
        <p style="margin:16px 0 4px"><b>Qué guarda de su lado</b></p>
        <p style="margin:0;font-size:13px">${escapar(datosQueAlmacena)}</p>
        <p style="margin:16px 0 0">
          Se atiende en <a href="https://www.bookea.lat/admin/developers">/admin/developers</a>.
        </p>
      `,
    }),
  );

  return { ok: true };
}

/** Lo mínimo para que un nombre con <> no rompa (ni inyecte) el HTML. */
function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
