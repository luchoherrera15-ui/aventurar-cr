import { NextResponse } from "next/server";
import { celebracionPorId, confirmacionesDe, invitacionDe } from "@/lib/celebrar/datos";
import { normalizarDocumento } from "@/lib/celebrar/invitacion/esquema";

/**
 * Las confirmaciones de una celebración como CSV (Excel/Sheets). Solo la
 * dueña: RLS decide qué devuelve `confirmacionesDe`; si la celebración no
 * es suya, no hay filas ni ficha y responde 404.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("c") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const c = await celebracionPorId(id);
  if (!c) return new NextResponse("No encontrado", { status: 404 });
  const [filas, inv] = await Promise.all([confirmacionesDe(id), invitacionDe(id)]);
  const doc = inv ? normalizarDocumento(inv.contenido) : null;
  const rsvp = doc?.secciones.find((s) => s.tipo === "rsvp");
  const preguntas = rsvp && rsvp.tipo === "rsvp" ? rsvp.datos.preguntas : [];

  const celda = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cabecera = ["Nombre", "Asiste", "Personas", ...preguntas.map((q) => q.etiqueta), "Contacto", "Mensaje", "Fecha"];
  const lineas = filas.map((x) =>
    [x.nombre, x.asiste ? "Sí" : "No", x.asiste ? x.personas : 0, ...preguntas.map((q) => x.respuestas[q.id] ?? ""), x.contacto ?? "", x.mensaje ?? "", x.created_at.slice(0, 16).replace("T", " ")]
      .map(celda)
      .join(","),
  );
  // BOM para que Excel abra las tildes bien.
  const csv = "﻿" + [cabecera.map(celda).join(","), ...lineas].join("\r\n");
  const nombre = `confirmaciones-${c.slug}.csv`;
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}"` },
  });
}
