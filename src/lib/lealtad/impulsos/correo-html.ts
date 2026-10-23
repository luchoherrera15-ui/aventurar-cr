/**
 * EL CORREO DE UN IMPULSO.
 *
 * Módulo PURO. Todo lo que viene del negocio o del cliente (nombre, título, mensaje) se ESCAPA antes
 * de entrar al HTML: un impulso lo escribe un dueño de negocio, pero el nombre del cliente lo escribió
 * un desconocido, y las dos cosas terminan dentro de un correo que sale con la marca del negocio.
 *
 * Los colores van literales porque ningún cliente de correo soporta variables CSS (mismo criterio que
 * `sello-acreditado.ts`).
 */

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Un párrafo por cada bloque separado por línea en blanco; los saltos simples quedan como <br>. */
export function parrafos(cuerpo: string): string {
  return cuerpo
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b3345">${escaparHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

export function htmlCorreoImpulso(d: { negocio: string; titulo: string; cuerpo: string; urlBaja: string }): string {
  return `
    <div style="max-width:520px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a93a6">
        ${escaparHtml(d.negocio)}
      </p>
      <h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0a1226">${escaparHtml(d.titulo)}</h2>
      ${parrafos(d.cuerpo)}
      <hr style="border:none;border-top:1px solid #e6e9f0;margin:24px 0 14px">
      <p style="margin:0;font-size:12px;line-height:1.5;color:#9aa1b0">
        Recibís este correo porque sos cliente de ${escaparHtml(d.negocio)} y aceptaste que te escribieran.
        <a href="${escaparHtml(d.urlBaja)}" style="color:#6b7487">Darme de baja</a>.
      </p>
    </div>
  `;
}
