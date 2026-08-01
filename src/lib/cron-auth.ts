import { NextResponse } from "next/server";

/**
 * La puerta de los endpoints que dispara el cron de Vercel.
 *
 * Antes la verificación estaba escrita así en cada ruta:
 *
 *     if (secreto && header !== `Bearer ${secreto}`) return 401;
 *
 * Con CRON_SECRET sin configurar, `secreto` es undefined, la condición
 * entera da falso y la puerta se abre sola — para cualquiera en
 * internet, no solo para Vercel. Y lo que hay del otro lado no es
 * inofensivo: /api/auto-cobro mueve plata y /api/recordatorios le manda
 * correos a los clientes.
 *
 * Esta versión falla CERRADA: sin secreto configurado no entra nadie, y
 * el problema se ve en el log de una vez en vez de quedar mudo.
 *
 * Vercel manda `Authorization: Bearer <CRON_SECRET>` solo si la
 * variable existe en el proyecto — así que configurarla no es opcional
 * para que los crons sigan corriendo.
 */
export function autorizarCron(request: Request): NextResponse | null {
  const secreto = process.env.CRON_SECRET;

  if (!secreto) {
    console.error(
      "[cron] CRON_SECRET no está configurada: se rechaza la llamada. " +
        "Ponela en las variables de entorno del proyecto o los crons no corren.",
    );
    return NextResponse.json(
      { error: "Cron sin configurar en el servidor." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
