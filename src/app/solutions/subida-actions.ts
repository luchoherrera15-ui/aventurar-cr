"use server";

import { createClient } from "@/lib/supabase/server";
import { cloudflareConfigurado, configuracionCF, solicitarSubidaDirecta } from "@/lib/media/cloudflare-images";
import { urlDeEntrega } from "@/lib/solutions/fotos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PERMISO DE SUBIDA A CLOUDFLARE IMAGES — para Solutions
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): «quiero que TODO lo que sean imágenes
 * y fotos se almacene y cargue desde Cloudflare».
 *
 * ── QUÉ HACE, Y QUÉ NO ─────────────────────────────────────────────
 * Le pide a Cloudflare un Direct Creator Upload (una URL de un solo
 * uso, válida media hora) y se la da al navegador junto con la URL de
 * entrega que va a tener la imagen. El ARCHIVO no pasa por acá: el
 * navegador lo manda directo a Cloudflare, igual que antes lo mandaba
 * directo al bucket de Supabase. Vercel no ve un byte de la foto.
 *
 * ── QUIÉN PUEDE PEDIRLO ────────────────────────────────────────────
 * Cualquier cuenta con sesión — el mismo criterio que la política del
 * bucket `solutions-fotos` («cuentas con sesión suben»). Lo que
 * termina GUARDADO en un negocio pasa igual por `fotoValida` en cada
 * action, que exige una URL de nuestra cuenta de Cloudflare. Pedir un
 * permiso y no usarlo no cuesta nada: Cloudflare descarta los
 * borradores que nunca reciben archivo.
 *
 * ── SI CLOUDFLARE NO ESTÁ CONFIGURADO ──────────────────────────────
 * Devuelve `configurado: false` y el uploader cae al bucket de
 * Supabase de siempre. Así el entorno local sin las cinco variables
 * sigue funcionando, y producción (que las tiene) va a Cloudflare.
 */

export type PermisoSubida =
  | { ok: true; configurado: true; uploadURL: string; urlFinal: string }
  | { ok: true; configurado: false }
  | { ok: false; motivo: string };

export async function prepararSubidaSolutions(): Promise<PermisoSubida> {
  if (!cloudflareConfigurado()) return { ok: true, configurado: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Se cerró tu sesión. Recargá la página." };

  const permiso = await solicitarSubidaDirecta({
    requiereFirma: false,
    expiraEnSegundos: 30 * 60,
    metadata: { producto: "solutions", usuario: user.id },
  });
  if (!permiso.ok) return { ok: false, motivo: "No se pudo preparar la subida. Probá de nuevo en un momento." };

  const config = configuracionCF();
  if (!config.ok) return { ok: true, configurado: false };

  return {
    ok: true,
    configurado: true,
    uploadURL: permiso.valor.uploadURL,
    urlFinal: urlDeEntrega(config.valor.deliveryUrl, permiso.valor.idBorrador),
  };
}
